/**
 * Steuer Routes — UStVA + EÜR
 * ============================
 * Umsatzsteuer-Voranmeldung (Preview + ELSTER-XML) und EÜR-Jahresübersicht
 * für einzelne Dojos (Multi-Tenant).
 *
 * Routen:
 *   GET /api/steuer/ustVA/preview   — UStVA-Vorschau (JSON)
 *   GET /api/steuer/ustVA/xml       — ELSTER-kompatibler XML-Export
 *   GET /api/steuer/euer/summary    — EÜR-Jahresübersicht (JSON)
 */

'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../db');
const logger  = require('../utils/logger');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

// Promise-basierter Pool
const pool = db.promise();

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Berechnet von/bis Datum für einen Zeitraum.
 * @param {number} jahr
 * @param {'monatlich'|'vierteljaehrlich'} art
 * @param {number} zeitraum  1-12 (Monat) oder 1-4 (Quartal)
 * @returns {{ von: string, bis: string, bezeichnung: string, monate: number[] }}
 */
function zeitraumDaten(jahr, art, zeitraum) {
  if (art === 'vierteljaehrlich') {
    const quartale = {
      1: { monate: [1, 2, 3],    von: `${jahr}-01-01`, bis: `${jahr}-03-31`, bez: `Q1 ${jahr}` },
      2: { monate: [4, 5, 6],    von: `${jahr}-04-01`, bis: `${jahr}-06-30`, bez: `Q2 ${jahr}` },
      3: { monate: [7, 8, 9],    von: `${jahr}-07-01`, bis: `${jahr}-09-30`, bez: `Q3 ${jahr}` },
      4: { monate: [10, 11, 12], von: `${jahr}-10-01`, bis: `${jahr}-12-31`, bez: `Q4 ${jahr}` },
    };
    const q = quartale[zeitraum] || quartale[1];
    return { von: q.von, bis: q.bis, bezeichnung: q.bez, monate: q.monate };
  }
  // monatlich
  const monatsnamen = [
    '', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  const monat = zeitraum >= 1 && zeitraum <= 12 ? zeitraum : 1;
  const letzterTag = new Date(jahr, monat, 0).getDate();
  const mm = String(monat).padStart(2, '0');
  return {
    von:         `${jahr}-${mm}-01`,
    bis:         `${jahr}-${mm}-${letzterTag}`,
    bezeichnung: `${monatsnamen[monat]} ${jahr}`,
    monate:      [monat]
  };
}

/**
 * Liefert den Kz10-Wert für den ELSTER-Voranmeldungszeitraum.
 * Monate → "01"–"12", Quartale → "41"–"44"
 */
function kz10Wert(art, zeitraum) {
  if (art === 'vierteljaehrlich') {
    return String(40 + zeitraum);
  }
  return String(zeitraum).padStart(2, '0');
}

/**
 * Rundet einen Eurobetrag auf 2 Dezimalstellen.
 */
const runden = (v) => Math.round((v || 0) * 100) / 100;

// ---------------------------------------------------------------------------
// Route 1: GET /api/steuer/ustVA/preview  (alias: /ustVA)
// ---------------------------------------------------------------------------
async function handleUstVAPreview(req, res) {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) {
      return res.status(400).json({ error: 'Kein Dojo ausgewählt.' });
    }

    const jahr         = parseInt(req.query.jahr) || new Date().getFullYear();
    const zeitraumArt  = req.query.zeitraum_art === 'vierteljaehrlich' ? 'vierteljaehrlich' : 'monatlich';
    const zeitraumNr   = parseInt(req.query.zeitraum) || (zeitraumArt === 'monatlich' ? new Date().getMonth() + 1 : 1);

    const zd = zeitraumDaten(jahr, zeitraumArt, zeitraumNr);

    // ----- Dojo-Steuerinfo ------------------------------------------------
    const [[dojoRow]] = await pool.query(
      `SELECT steuernummer, umsatzsteuer_id, steuer_status, kleinunternehmer, finanzamt_name
       FROM dojo WHERE id = ?`,
      [dojoId]
    );

    if (!dojoRow) {
      return res.status(404).json({ error: 'Dojo nicht gefunden.' });
    }

    const istKleinunternehmer = !!(dojoRow.kleinunternehmer || dojoRow.steuer_status === 'kleinunternehmer');

    const dojoInfo = {
      steuernummer:      dojoRow.steuernummer   || null,
      umsatzsteuer_id:   dojoRow.umsatzsteuer_id || null,
      finanzamt:         dojoRow.finanzamt_name  || null,
      steuer_status:     dojoRow.steuer_status   || 'kleinunternehmer',
      ist_kleinunternehmer: istKleinunternehmer,
    };

    const zeitraumInfo = {
      jahr,
      art:         zeitraumArt,
      zeitraum:    zeitraumNr,
      von:         zd.von,
      bis:         zd.bis,
      bezeichnung: zd.bezeichnung,
    };

    // Bei Kleinunternehmer: Bruttoumsätze aus v_euer_einnahmen holen (zur Info)
    if (istKleinunternehmer) {
      let bruttoUmsatz = 0;
      try {
        const [[{ summe }]] = await pool.query(
          `SELECT COALESCE(SUM(betrag_brutto), 0) AS summe
           FROM v_euer_einnahmen
           WHERE dojo_id = ? AND datum BETWEEN ? AND ?`,
          [dojoId, zd.von, zd.bis]
        );
        bruttoUmsatz = runden(summe);
      } catch (_) {}
      return res.json({
        dojo:    dojoInfo,
        zeitraum: zeitraumInfo,
        kennziffern: {
          Kz81: 0, Kz86: 0, Kz35: 0, Kz36: 0,
          Kz66: 0, Kz_steuerfreie: bruttoUmsatz,
          gesamtsteuer: 0, zahllast: 0,
        },
        details: { einnahmen_19: [], einnahmen_7: [], steuerfreie: [], vorsteuer: [] },
        hinweis: 'Kleinunternehmer gem. §19 UStG — keine Umsatzsteuer ausgewiesen.',
      });
    }

    // ----- Parallele DB-Abfragen ------------------------------------------

    // Rechnungen — Ausgangsumsätze
    const rechnungenQuery = pool.query(
      `SELECT
         rechnung_id   AS id,
         'rechnung'    AS quelle,
         rechnungsnummer,
         netto_betrag,
         mwst_satz,
         mwst_betrag,
         COALESCE(bezahlt_am, erstellt_am) AS datum
       FROM rechnungen
       WHERE dojo_id = ?
         AND COALESCE(bezahlt_am, erstellt_am) BETWEEN ? AND ?
         AND status IN ('bezahlt', 'offen', 'teilbezahlt')
      `,
      [dojoId, zd.von, zd.bis]
    ).catch(err => { logger.warn('steuer: rechnungen nicht abfragbar', { err: err.message }); return [[]]; });

    // Verkäufe — Ausgangsumsätze
    const verkaufeQuery = pool.query(
      `SELECT
         verkauf_id    AS id,
         'verkauf'     AS quelle,
         NULL          AS rechnungsnummer,
         netto_gesamt_cent / 100  AS netto_betrag,
         mwst_satz,
         mwst_gesamt_cent / 100   AS mwst_betrag,
         erstellt_am              AS datum
       FROM verkaeufe
       WHERE dojo_id = ?
         AND erstellt_am BETWEEN ? AND ?
         AND (storniert IS NULL OR storniert = 0)
      `,
      [dojoId, zd.von, zd.bis]
    ).catch(err => { logger.warn('steuer: verkaeufe nicht abfragbar', { err: err.message }); return [[]]; });

    // buchhaltung_belege Einnahmen — Ausgangsumsätze
    const belegeEinnahmenQuery = pool.query(
      `SELECT
         beleg_id      AS id,
         'beleg'       AS quelle,
         beleg_nummer  AS rechnungsnummer,
         betrag_netto  AS netto_betrag,
         mwst_satz,
         mwst_betrag,
         beleg_datum    AS datum
       FROM buchhaltung_belege
       WHERE dojo_id = ?
         AND beleg_datum BETWEEN ? AND ?
         AND buchungsart = 'einnahme'
      `,
      [dojoId, zd.von, zd.bis]
    ).catch(err => { logger.warn('steuer: buchhaltung_belege einnahmen nicht abfragbar', { err: err.message }); return [[]]; });

    // buchhaltung_belege Ausgaben — Vorsteuer
    const belegeAusgabenQuery = pool.query(
      `SELECT
         beleg_id      AS id,
         'beleg'       AS quelle,
         beleg_nummer  AS rechnungsnummer,
         betrag_netto  AS netto_betrag,
         mwst_satz,
         mwst_betrag,
         beleg_datum    AS datum,
         beschreibung
       FROM buchhaltung_belege
       WHERE dojo_id = ?
         AND beleg_datum BETWEEN ? AND ?
         AND buchungsart = 'ausgabe'
         AND mwst_betrag > 0
      `,
      [dojoId, zd.von, zd.bis]
    ).catch(err => { logger.warn('steuer: buchhaltung_belege ausgaben nicht abfragbar', { err: err.message }); return [[]]; });

    // kassenbuch Ausgaben — Vorsteuer aus Kassenbuch-Einträgen mit MwSt
    const kassenbuchQuery = pool.query(
      `SELECT
         eintrag_id        AS id,
         'kassenbuch'      AS quelle,
         beleg_nummer      AS rechnungsnummer,
         betrag_cent / 100 AS netto_betrag,
         mwst_satz,
         mwst_betrag_cent / 100 AS mwst_betrag,
         geschaeft_datum   AS datum,
         beschreibung
       FROM kassenbuch
       WHERE dojo_id = ?
         AND geschaeft_datum BETWEEN ? AND ?
         AND bewegungsart = 'ausgabe'
         AND mwst_betrag_cent > 0
      `,
      [dojoId, zd.von, zd.bis]
    ).catch(err => { logger.warn('steuer: kassenbuch nicht abfragbar', { err: err.message }); return [[]]; });

    // Beitraege — Mitgliedsbeiträge als Umsatz mit 19% MwSt, gruppiert nach Monat
    const beitraegeQuery = pool.query(
      `SELECT
         NULL                                               AS id,
         'beitrag'                                          AS quelle,
         NULL                                               AS rechnungsnummer,
         ROUND(SUM(betrag) / 1.19, 2)                      AS netto_betrag,
         19                                                 AS mwst_satz,
         ROUND(SUM(betrag) - SUM(betrag) / 1.19, 2)        AS mwst_betrag,
         DATE_FORMAT(MIN(zahlungsdatum), '%Y-%m-01')        AS datum,
         CONCAT('Mitgliedsbeiträge ', DATE_FORMAT(MIN(zahlungsdatum), '%M %Y')) AS beschreibung
       FROM beitraege
       WHERE dojo_id = ?
         AND zahlungsdatum BETWEEN ? AND ?
         AND bezahlt = 1
       GROUP BY YEAR(zahlungsdatum), MONTH(zahlungsdatum)
      `,
      [dojoId, zd.von, zd.bis]
    ).catch(err => { logger.warn('steuer: beitraege nicht abfragbar', { err: err.message }); return [[]]; });

    // Alle Abfragen parallel ausführen
    const [
      [rechnungen],
      [verkaeufe],
      [belegeEinnahmen],
      [belegeAusgaben],
      [kassenbuch],
      [beitraege],
    ] = await Promise.all([
      rechnungenQuery,
      verkaufeQuery,
      belegeEinnahmenQuery,
      belegeAusgabenQuery,
      kassenbuchQuery,
      beitraegeQuery,
    ]);

    // ----- Kennziffern berechnen ------------------------------------------

    // Alle Einnahmen-Zeilen zusammenführen (beitraege ohne MwSt-Satz → landen in steuerfreie)
    const alleEinnahmen = [...rechnungen, ...verkaeufe, ...belegeEinnahmen, ...beitraege];

    const einnahmen19   = alleEinnahmen.filter(r => Number(r.mwst_satz) === 19);
    const einnahmen7    = alleEinnahmen.filter(r => Number(r.mwst_satz) === 7);
    const steuerfreie   = alleEinnahmen.filter(r => !r.mwst_satz || Number(r.mwst_satz) === 0);

    const Kz81 = runden(einnahmen19.reduce((s, r) => s + Number(r.netto_betrag || 0), 0));
    const Kz86 = runden(einnahmen7.reduce( (s, r) => s + Number(r.netto_betrag || 0), 0));

    // Kz35/36: bevorzuge gespeicherte mwst_betrag, sonst berechne
    const Kz35 = runden(einnahmen19.reduce((s, r) => {
      const mb = Number(r.mwst_betrag);
      return s + (mb > 0 ? mb : Number(r.netto_betrag || 0) * 0.19);
    }, 0));
    const Kz36 = runden(einnahmen7.reduce((s, r) => {
      const mb = Number(r.mwst_betrag);
      return s + (mb > 0 ? mb : Number(r.netto_betrag || 0) * 0.07);
    }, 0));

    const Kz_steuerfreie = runden(steuerfreie.reduce((s, r) => s + Number(r.netto_betrag || 0), 0));

    // Vorsteuer aus Belegen + Kassenbuch
    const alleVorsteuer = [...belegeAusgaben, ...kassenbuch];
    const Kz66 = runden(alleVorsteuer.reduce((s, r) => s + Math.abs(Number(r.mwst_betrag || 0)), 0));

    const gesamtsteuer = runden(Kz35 + Kz36);
    const zahllast     = runden(gesamtsteuer - Kz66);

    // Detaillisten aufbereiten (Beträge als Zahlen)
    const formatRow = (r) => ({
      id:              r.id,
      quelle:          r.quelle,
      rechnungsnummer: r.rechnungsnummer || null,
      netto_betrag:    runden(Number(r.netto_betrag || 0)),
      mwst_satz:       Number(r.mwst_satz || 0),
      mwst_betrag:     runden(Math.abs(Number(r.mwst_betrag || 0))),
      datum:           r.datum ? String(r.datum).slice(0, 10) : null,
      beschreibung:    r.beschreibung || null,
    });

    return res.json({
      dojo:     dojoInfo,
      zeitraum: zeitraumInfo,
      kennziffern: {
        Kz81, Kz86, Kz35, Kz36,
        Kz66, Kz_steuerfreie,
        gesamtsteuer, zahllast,
      },
      details: {
        einnahmen_19: einnahmen19.map(formatRow),
        einnahmen_7:  einnahmen7.map(formatRow),
        steuerfreie:  steuerfreie.map(formatRow),
        vorsteuer:    alleVorsteuer.map(formatRow),
      },
    });

  } catch (err) {
    logger.error('steuer/ustVA/preview: Fehler', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Interner Serverfehler beim Abrufen der UStVA-Vorschau.' });
  }
}

router.get('/ustVA/preview', handleUstVAPreview);
router.get('/ustVA', handleUstVAPreview); // Alias für Frontend-Kompatibilität

// ---------------------------------------------------------------------------
// Route 2: GET /api/steuer/ustVA/xml   (ELSTER-kompatibler XML-Export)
// ---------------------------------------------------------------------------
router.get('/ustVA/xml', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) {
      return res.status(400).json({ error: 'Kein Dojo ausgewählt.' });
    }

    const jahr        = parseInt(req.query.jahr) || new Date().getFullYear();
    const zeitraumArt = req.query.zeitraum_art === 'vierteljaehrlich' ? 'vierteljaehrlich' : 'monatlich';
    const zeitraumNr  = parseInt(req.query.zeitraum) || (zeitraumArt === 'monatlich' ? new Date().getMonth() + 1 : 1);

    // Vorschaudaten intern laden — Preview-Logik wiederverwenden via direktem DB-Aufruf
    // Wir rufen die berechnete Preview ab, indem wir denselben Berechnungscode inline aufrufen.

    const zd = zeitraumDaten(jahr, zeitraumArt, zeitraumNr);

    // Dojo-Info
    const [[dojoRow]] = await pool.query(
      `SELECT steuernummer, umsatzsteuer_id, steuer_status, kleinunternehmer, finanzamt_name
       FROM dojo WHERE id = ?`,
      [dojoId]
    );
    if (!dojoRow) {
      return res.status(404).json({ error: 'Dojo nicht gefunden.' });
    }

    const istKleinunternehmer = !!(dojoRow.kleinunternehmer || dojoRow.steuer_status === 'kleinunternehmer');

    // Steuernummer bereinigen (nur Ziffern)
    const steuernummerRein = (dojoRow.steuernummer || '').replace(/[^0-9]/g, '');

    // Zeitraum-Kennziffer Kz10
    const kz10 = kz10Wert(zeitraumArt, zeitraumNr);

    // Dateiname für Content-Disposition
    const dateiname = `UStVA_${jahr}_${String(zeitraumNr).padStart(2, '0')}.xml`;

    let xmlBody;

    if (istKleinunternehmer) {
      // Kleinunternehmer: Kz211=1, keine Betragsfelder
      xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<Elster xmlns="http://www.elster.de/elsterxml/schema/v12">
  <TransferHeader version="12">
    <Verfahren>ElsterAnmeldung</Verfahren>
    <DatenArt>UStVA</DatenArt>
    <Vorgang>send-Auth</Vorgang>
    <RC><Rueckgabe><Code>0</Code><Text>Keine Fehler</Text></Rueckgabe></RC>
    <TransferTicket/>
    <Signaturen/>
  </TransferHeader>
  <DatenTeil>
    <Nutzdatenblock>
      <NutzdatenHeader version="12">
        <NutzdatenTicket>1</NutzdatenTicket>
        <Empfaenger id="F">0</Empfaenger>
      </NutzdatenHeader>
      <Nutzdaten>
        <Anmeldungssteuern art="UStVA" version="${jahr}01">
          <Steuerfall>
            <Steuerpflichtiger>
              <Steuernummer>${escapeXml(steuernummerRein)}</Steuernummer>
            </Steuerpflichtiger>
            <Zeitraum>
              <Voranmeldungszeitraum Kz10="${kz10}" Kz18="${jahr}"/>
            </Zeitraum>
            <Steuerberechnung>
              <Kz211>1</Kz211>
            </Steuerberechnung>
          </Steuerfall>
        </Anmeldungssteuern>
      </Nutzdaten>
    </Nutzdatenblock>
  </DatenTeil>
</Elster>`;
    } else {
      // Regelbesteuerung — Kennziffern berechnen
      const [rechnungen]     = await pool.query(
        `SELECT netto_betrag, mwst_satz, mwst_betrag FROM rechnungen
         WHERE dojo_id = ? AND COALESCE(bezahlt_am, erstellt_am) BETWEEN ? AND ?
           AND status IN ('bezahlt', 'offen', 'teilbezahlt')`,
        [dojoId, zd.von, zd.bis]
      ).catch(() => [[]]);

      const [verkaeufe]      = await pool.query(
        `SELECT netto_gesamt_cent/100 AS netto_betrag, mwst_satz, mwst_gesamt_cent/100 AS mwst_betrag
         FROM verkaeufe
         WHERE dojo_id = ? AND erstellt_am BETWEEN ? AND ?
           AND (storniert IS NULL OR storniert = 0)`,
        [dojoId, zd.von, zd.bis]
      ).catch(() => [[]]);

      const [belegeEin]      = await pool.query(
        `SELECT betrag_netto AS netto_betrag, mwst_satz, mwst_betrag FROM buchhaltung_belege
         WHERE dojo_id = ? AND beleg_datum BETWEEN ? AND ? AND buchungsart = 'einnahme'`,
        [dojoId, zd.von, zd.bis]
      ).catch(() => [[]]);

      const [belegeAus]      = await pool.query(
        `SELECT mwst_betrag FROM buchhaltung_belege
         WHERE dojo_id = ? AND beleg_datum BETWEEN ? AND ? AND buchungsart = 'ausgabe' AND mwst_betrag > 0`,
        [dojoId, zd.von, zd.bis]
      ).catch(() => [[]]);

      const [kassenbuchRows] = await pool.query(
        `SELECT mwst_betrag_cent / 100 AS mwst_betrag FROM kassenbuch
         WHERE dojo_id = ? AND geschaeft_datum BETWEEN ? AND ? AND bewegungsart = 'ausgabe' AND mwst_betrag_cent > 0`,
        [dojoId, zd.von, zd.bis]
      ).catch(() => [[]]);
      const kassenbuch = kassenbuchRows;

      const alle = [...rechnungen, ...verkaeufe, ...belegeEin];
      const ein19 = alle.filter(r => Number(r.mwst_satz) === 19);
      const ein7  = alle.filter(r => Number(r.mwst_satz) === 7);

      const Kz81 = runden(ein19.reduce((s, r) => s + Number(r.netto_betrag || 0), 0));
      const Kz86 = runden(ein7.reduce( (s, r) => s + Number(r.netto_betrag || 0), 0));
      const Kz35 = runden(ein19.reduce((s, r) => {
        const mb = Number(r.mwst_betrag); return s + (mb > 0 ? mb : Number(r.netto_betrag || 0) * 0.19);
      }, 0));
      const Kz36 = runden(ein7.reduce((s, r) => {
        const mb = Number(r.mwst_betrag); return s + (mb > 0 ? mb : Number(r.netto_betrag || 0) * 0.07);
      }, 0));
      const Kz66 = runden([...belegeAus, ...kassenbuch].reduce(
        (s, r) => s + Math.abs(Number(r.mwst_betrag || 0)), 0
      ));
      const zahllast = runden(Kz35 + Kz36 - Kz66);

      // Beträge in Cent (ganze Zahlen)
      const toCent = (euro) => Math.round(euro * 100);

      xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<Elster xmlns="http://www.elster.de/elsterxml/schema/v12">
  <TransferHeader version="12">
    <Verfahren>ElsterAnmeldung</Verfahren>
    <DatenArt>UStVA</DatenArt>
    <Vorgang>send-Auth</Vorgang>
    <RC><Rueckgabe><Code>0</Code><Text>Keine Fehler</Text></Rueckgabe></RC>
    <TransferTicket/>
    <Signaturen/>
  </TransferHeader>
  <DatenTeil>
    <Nutzdatenblock>
      <NutzdatenHeader version="12">
        <NutzdatenTicket>1</NutzdatenTicket>
        <Empfaenger id="F">0</Empfaenger>
      </NutzdatenHeader>
      <Nutzdaten>
        <Anmeldungssteuern art="UStVA" version="${jahr}01">
          <Steuerfall>
            <Steuerpflichtiger>
              <Steuernummer>${escapeXml(steuernummerRein)}</Steuernummer>
            </Steuerpflichtiger>
            <Zeitraum>
              <Voranmeldungszeitraum Kz10="${kz10}" Kz18="${jahr}"/>
            </Zeitraum>
            <Steuerberechnung>${Kz81 > 0  ? `\n              <Kz81>${toCent(Kz81)}</Kz81>` : ''}${Kz35 > 0  ? `\n              <Kz35>${toCent(Kz35)}</Kz35>` : ''}${Kz86 > 0  ? `\n              <Kz86>${toCent(Kz86)}</Kz86>` : ''}${Kz36 > 0  ? `\n              <Kz36>${toCent(Kz36)}</Kz36>` : ''}${Kz66 > 0  ? `\n              <Kz66>${toCent(Kz66)}</Kz66>` : ''}
              <Kz83>${toCent(zahllast)}</Kz83>
            </Steuerberechnung>
          </Steuerfall>
        </Anmeldungssteuern>
      </Nutzdaten>
    </Nutzdatenblock>
  </DatenTeil>
</Elster>`;
    }

    res.setHeader('Content-Type', 'application/xml; charset=UTF-8');
    res.setHeader('Content-Disposition', `attachment; filename="${dateiname}"`);
    return res.send(xmlBody);

  } catch (err) {
    logger.error('steuer/ustVA/xml: Fehler', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Interner Serverfehler beim Erstellen der ELSTER-XML.' });
  }
});

// ---------------------------------------------------------------------------
// Route 3: GET /api/steuer/euer/summary
// ---------------------------------------------------------------------------
router.get('/euer/summary', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) {
      return res.status(400).json({ error: 'Kein Dojo ausgewählt.' });
    }

    const jahr        = parseInt(req.query.jahr) || new Date().getFullYear();
    const vorjahr     = jahr - 1;

    // ----- Einnahmen via View oder Fallback -------------------------------
    let einnahmenRows = [];
    try {
      const [rows] = await pool.query(
        `SELECT * FROM v_euer_einnahmen WHERE dojo_id = ? AND YEAR(datum) = ?`,
        [dojoId, jahr]
      );
      einnahmenRows = rows;
    } catch (viewErr) {
      logger.warn('steuer/euer: v_euer_einnahmen nicht verfügbar, nutze Fallback', { err: viewErr.message });
      // Fallback: Rechnungen + Verkäufe direkt
      const [rechnungen] = await pool.query(
        `SELECT
           MONTH(COALESCE(bezahlt_am, erstellt_am)) AS monat,
           netto_betrag AS betrag_netto,
           mwst_satz,
           mwst_betrag,
           COALESCE(bezahlt_am, erstellt_am) AS datum,
           'Mitgliedsbeitrag/Rechnung' AS kategorie,
           'rechnung' AS quelle,
           1 AS steuerrelevant
         FROM rechnungen
         WHERE dojo_id = ? AND YEAR(COALESCE(bezahlt_am, erstellt_am)) = ?
           AND status IN ('bezahlt', 'offen', 'teilbezahlt')`,
        [dojoId, jahr]
      ).catch(() => [[]]);

      const [verkaeufe] = await pool.query(
        `SELECT
           MONTH(erstellt_am) AS monat,
           netto_gesamt_cent/100 AS betrag_netto,
           mwst_satz,
           mwst_gesamt_cent/100 AS mwst_betrag,
           erstellt_am AS datum,
           'Verkauf' AS kategorie,
           'verkauf' AS quelle,
           1 AS steuerrelevant
         FROM verkaeufe
         WHERE dojo_id = ? AND YEAR(erstellt_am) = ?
           AND (storniert IS NULL OR storniert = 0)`,
        [dojoId, jahr]
      ).catch(() => [[]]);

      const [belege] = await pool.query(
        `SELECT
           MONTH(beleg_datum) AS monat,
           betrag_netto,
           mwst_satz,
           mwst_betrag,
           beleg_datum AS datum,
           COALESCE(kategorie, 'Sonstige Einnahmen') AS kategorie,
           'beleg' AS quelle,
           1 AS steuerrelevant
         FROM buchhaltung_belege
         WHERE dojo_id = ? AND YEAR(beleg_datum) = ? AND buchungsart = 'einnahme'`,
        [dojoId, jahr]
      ).catch(() => [[]]);

      einnahmenRows = [...rechnungen, ...verkaeufe, ...belege];
    }

    // ----- Ausgaben via View oder Fallback --------------------------------
    let ausgabenRows = [];
    try {
      const [rows] = await pool.query(
        `SELECT * FROM v_euer_ausgaben WHERE dojo_id = ? AND YEAR(datum) = ?`,
        [dojoId, jahr]
      );
      ausgabenRows = rows;
    } catch (viewErr) {
      logger.warn('steuer/euer: v_euer_ausgaben nicht verfügbar, nutze Fallback', { err: viewErr.message });

      // kassenbuch hat keine MwSt-Spalten und andere Spaltennamen → überspringen
      const kassenbuch = [];

      const [belege] = await pool.query(
        `SELECT
           MONTH(beleg_datum) AS monat,
           betrag_netto,
           mwst_satz,
           mwst_betrag,
           beleg_datum AS datum,
           COALESCE(kategorie, 'Sonstiges') AS kategorie,
           'beleg' AS quelle,
           1 AS steuerrelevant
         FROM buchhaltung_belege
         WHERE dojo_id = ? AND YEAR(beleg_datum) = ? AND buchungsart = 'ausgabe'`,
        [dojoId, jahr]
      ).catch(() => [[]]);

      ausgabenRows = [...kassenbuch, ...belege];
    }

    // ----- Vorjahresvergleich (optional) ----------------------------------
    let vorjahrEinnahmen = 0;
    let vorjahrAusgaben  = 0;
    try {
      const [[vjEin]] = await pool.query(
        `SELECT COALESCE(SUM(betrag_netto), 0) AS gesamt FROM v_euer_einnahmen
         WHERE dojo_id = ? AND YEAR(datum) = ?`,
        [dojoId, vorjahr]
      );
      const [[vjAus]] = await pool.query(
        `SELECT COALESCE(SUM(betrag_netto), 0) AS gesamt FROM v_euer_ausgaben
         WHERE dojo_id = ? AND YEAR(datum) = ?`,
        [dojoId, vorjahr]
      );
      vorjahrEinnahmen = runden(Number(vjEin?.gesamt || 0));
      vorjahrAusgaben  = runden(Number(vjAus?.gesamt || 0));
    } catch {
      // Vorjahresvergleich optional — kein Fehler
    }

    // ----- Monatliche Aufschlüsselung ------------------------------------
    const monatsnamen = [
      '', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];

    const monatsData = Array.from({ length: 12 }, (_, i) => ({
      monat:      i + 1,
      bezeichnung: monatsnamen[i + 1],
      einnahmen:  0,
      ausgaben:   0,
      ueberschuss: 0,
    }));

    einnahmenRows.forEach(r => {
      const m = Number(r.monat) - 1;
      if (m >= 0 && m < 12) {
        monatsData[m].einnahmen = runden(monatsData[m].einnahmen + Number(r.betrag_netto || 0));
      }
    });

    ausgabenRows.forEach(r => {
      const m = Number(r.monat) - 1;
      if (m >= 0 && m < 12) {
        monatsData[m].ausgaben = runden(monatsData[m].ausgaben + Number(r.betrag_netto || 0));
      }
    });

    monatsData.forEach(m => {
      m.ueberschuss = runden(m.einnahmen - m.ausgaben);
    });

    // ----- Kategorienauswertung ------------------------------------------
    const kategorienEinnahmen = {};
    einnahmenRows.forEach(r => {
      const kat = r.kategorie || 'Sonstige Einnahmen';
      kategorienEinnahmen[kat] = runden((kategorienEinnahmen[kat] || 0) + Number(r.betrag_netto || 0));
    });

    const kategorienAusgaben = {};
    ausgabenRows.forEach(r => {
      const kat = r.kategorie || 'Sonstige Ausgaben';
      kategorienAusgaben[kat] = runden((kategorienAusgaben[kat] || 0) + Number(r.betrag_netto || 0));
    });

    // ----- Gesamtsummen --------------------------------------------------
    const gesamteinnahmen = runden(monatsData.reduce((s, m) => s + m.einnahmen, 0));
    const gesamtausgaben  = runden(monatsData.reduce((s, m) => s + m.ausgaben, 0));
    const ueberschuss     = runden(gesamteinnahmen - gesamtausgaben);

    return res.json({
      jahr,
      monatlich: monatsData,
      gesamt: {
        einnahmen: gesamteinnahmen,
        ausgaben:  gesamtausgaben,
        ueberschuss,
      },
      kategorien: {
        einnahmen: kategorienEinnahmen,
        ausgaben:  kategorienAusgaben,
      },
      vorjahresvergleich: {
        jahr:      vorjahr,
        einnahmen: vorjahrEinnahmen,
        ausgaben:  vorjahrAusgaben,
        ueberschuss: runden(vorjahrEinnahmen - vorjahrAusgaben),
      },
      details: {
        einnahmen: einnahmenRows.map(r => ({
          monat:          Number(r.monat),
          betrag_netto:   runden(Number(r.betrag_netto || 0)),
          mwst_satz:      Number(r.mwst_satz || 0),
          mwst_betrag:    runden(Number(r.mwst_betrag || 0)),
          datum:          r.datum ? String(r.datum).slice(0, 10) : null,
          kategorie:      r.kategorie || null,
          quelle:         r.quelle   || null,
          steuerrelevant: !!r.steuerrelevant,
        })),
        ausgaben: ausgabenRows.map(r => ({
          monat:          Number(r.monat),
          betrag_netto:   runden(Number(r.betrag_netto || 0)),
          mwst_satz:      Number(r.mwst_satz || 0),
          mwst_betrag:    runden(Number(r.mwst_betrag || 0)),
          datum:          r.datum ? String(r.datum).slice(0, 10) : null,
          kategorie:      r.kategorie || null,
          quelle:         r.quelle   || null,
          steuerrelevant: !!r.steuerrelevant,
        })),
      },
    });

  } catch (err) {
    logger.error('steuer/euer/summary: Fehler', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Interner Serverfehler beim Abrufen der EÜR-Zusammenfassung.' });
  }
});

// ---------------------------------------------------------------------------
// XML-Escaping Hilfsfunktion
// ---------------------------------------------------------------------------
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}

module.exports = router;
