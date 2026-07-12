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

    // Erstattungen — NEGATIVE Ausgangsumsätze (USt-Korrektur §17 UStG, 19% analog Beiträge)
    const erstattungenQuery = pool.query(
      `SELECT
         NULL                                                  AS id,
         'erstattung'                                          AS quelle,
         NULL                                                  AS rechnungsnummer,
         ROUND(-SUM(betrag) / 1.19, 2)                         AS netto_betrag,
         19                                                    AS mwst_satz,
         ROUND(-(SUM(betrag) - SUM(betrag) / 1.19), 2)         AS mwst_betrag,
         DATE_FORMAT(MIN(erstattet_am), '%Y-%m-01')            AS datum,
         CONCAT('Erstattungen ', DATE_FORMAT(MIN(erstattet_am), '%M %Y')) AS beschreibung
       FROM erstattungen
       WHERE dojo_id = ?
         AND erstattet_am BETWEEN ? AND ?
         AND status IN ('erstattet','veranlasst')
       GROUP BY YEAR(erstattet_am), MONTH(erstattet_am)
      `,
      [dojoId, zd.von, zd.bis]
    ).catch(err => { logger.warn('steuer: erstattungen nicht abfragbar', { err: err.message }); return [[]]; });

    // Alle Abfragen parallel ausführen
    const [
      [rechnungen],
      [verkaeufe],
      [belegeEinnahmen],
      [belegeAusgaben],
      [kassenbuch],
      [beitraege],
      [erstattungen],
    ] = await Promise.all([
      rechnungenQuery,
      verkaufeQuery,
      belegeEinnahmenQuery,
      belegeAusgabenQuery,
      kassenbuchQuery,
      beitraegeQuery,
      erstattungenQuery,
    ]);

    // ----- Kennziffern berechnen ------------------------------------------

    // Alle Einnahmen-Zeilen zusammenführen (Erstattungen mindern als negative 19%-Umsätze)
    const alleEinnahmen = [...rechnungen, ...verkaeufe, ...belegeEinnahmen, ...beitraege, ...erstattungen];

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
// Route 3–6: UStVA Einreichen / Korrektur / Abgabenhistorie
// ---------------------------------------------------------------------------

// Hilfsfunktion: Kennziffern für beliebigen Zeitraum berechnen (shared logic)
async function berechnungKennziffern(dojoId, zd) {
  const [rechnungen] = await pool.query(
    `SELECT netto_betrag, mwst_satz, mwst_betrag FROM rechnungen
     WHERE dojo_id = ? AND COALESCE(bezahlt_am, erstellt_am) BETWEEN ? AND ?
       AND status IN ('bezahlt', 'offen', 'teilbezahlt')`,
    [dojoId, zd.von, zd.bis]
  ).catch(() => [[]]);

  const [verkaeufe] = await pool.query(
    `SELECT netto_gesamt_cent/100 AS netto_betrag, mwst_satz, mwst_gesamt_cent/100 AS mwst_betrag
     FROM verkaeufe WHERE dojo_id = ? AND erstellt_am BETWEEN ? AND ?
       AND (storniert IS NULL OR storniert = 0)`,
    [dojoId, zd.von, zd.bis]
  ).catch(() => [[]]);

  const [belegeEin] = await pool.query(
    `SELECT betrag_netto AS netto_betrag, mwst_satz, mwst_betrag FROM buchhaltung_belege
     WHERE dojo_id = ? AND beleg_datum BETWEEN ? AND ? AND buchungsart = 'einnahme'`,
    [dojoId, zd.von, zd.bis]
  ).catch(() => [[]]);

  const [belegeAus] = await pool.query(
    `SELECT mwst_betrag FROM buchhaltung_belege
     WHERE dojo_id = ? AND beleg_datum BETWEEN ? AND ? AND buchungsart = 'ausgabe' AND mwst_betrag > 0`,
    [dojoId, zd.von, zd.bis]
  ).catch(() => [[]]);

  const [kassenbuch] = await pool.query(
    `SELECT mwst_betrag_cent/100 AS mwst_betrag FROM kassenbuch
     WHERE dojo_id = ? AND geschaeft_datum BETWEEN ? AND ? AND bewegungsart = 'ausgabe' AND mwst_betrag_cent > 0`,
    [dojoId, zd.von, zd.bis]
  ).catch(() => [[]]);

  const alle  = [...rechnungen, ...verkaeufe, ...belegeEin];
  const ein19 = alle.filter(r => Number(r.mwst_satz) === 19);
  const ein7  = alle.filter(r => Number(r.mwst_satz) === 7);

  const Kz81 = runden(ein19.reduce((s, r) => s + Number(r.netto_betrag || 0), 0));
  const Kz86 = runden(ein7.reduce( (s, r) => s + Number(r.netto_betrag || 0), 0));
  const Kz35 = runden(ein19.reduce((s, r) => { const mb = Number(r.mwst_betrag); return s + (mb > 0 ? mb : Number(r.netto_betrag || 0) * 0.19); }, 0));
  const Kz36 = runden(ein7.reduce( (s, r) => { const mb = Number(r.mwst_betrag); return s + (mb > 0 ? mb : Number(r.netto_betrag || 0) * 0.07); }, 0));
  const Kz66 = runden([...belegeAus, ...kassenbuch].reduce((s, r) => s + Math.abs(Number(r.mwst_betrag || 0)), 0));
  const zahllast = runden(Kz35 + Kz36 - Kz66);

  return { Kz81, Kz86, Kz35, Kz36, Kz66, zahllast };
}

// POST /api/steuer/ustVA/einreichen — Meldung als eingereicht markieren (Snapshot)
router.post('/ustVA/einreichen', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo ausgewählt.' });

    const { jahr, zeitraum_art = 'monatlich', zeitraum, notizen } = req.body;
    const jahrInt = parseInt(jahr) || new Date().getFullYear();
    const zeitraumNr = parseInt(zeitraum) || (zeitraum_art === 'monatlich' ? new Date().getMonth() + 1 : 1);
    const zd = zeitraumDaten(jahrInt, zeitraum_art, zeitraumNr);

    const [[dojoRow]] = await pool.query('SELECT organisation_name, kleinunternehmer, steuer_status FROM dojo WHERE id = ?', [dojoId]);
    if (!dojoRow) return res.status(404).json({ error: 'Dojo nicht gefunden.' });

    const istKleinunternehmer = !!(dojoRow.kleinunternehmer || dojoRow.steuer_status === 'kleinunternehmer');
    const orgName = dojoRow.organisation_name || '';
    const userId = req.user?.user_id || req.user?.id || null;

    let kz = { Kz81: 0, Kz86: 0, Kz35: 0, Kz36: 0, Kz66: 0, zahllast: 0 };
    if (!istKleinunternehmer) kz = await berechnungKennziffern(dojoId, zd);

    const dateiname = `UStVA_${jahrInt}_${String(zeitraumNr).padStart(2, '0')}.xml`;

    const [result] = await pool.query(
      `INSERT INTO ustVA_abgaben
         (dojo_id, organisation_name, jahr, zeitraum_art, zeitraum_nr,
          kz81, kz86, kz35, kz36, kz66, zahllast,
          ist_korrektur, abgabe_status, xml_dateiname, eingereicht_von, notizen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'eingereicht', ?, ?, ?)`,
      [dojoId, orgName, jahrInt, zeitraum_art, zeitraumNr,
       kz.Kz81, kz.Kz86, kz.Kz35, kz.Kz36, kz.Kz66, kz.zahllast,
       dateiname, userId, notizen || null]
    );

    res.json({ abgabe_id: result.insertId, ...kz, message: 'Meldung als eingereicht gespeichert.' });
  } catch (err) {
    logger.error('ustVA/einreichen: Fehler', { error: err.message });
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// POST /api/steuer/ustVA/korrektur — Korrekturantrag erstellen
router.post('/ustVA/korrektur', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo ausgewählt.' });

    const { korrektur_zu_id, notizen } = req.body;
    if (!korrektur_zu_id) return res.status(400).json({ error: 'korrektur_zu_id fehlt.' });

    const [[original]] = await pool.query(
      'SELECT * FROM ustVA_abgaben WHERE abgabe_id = ? AND dojo_id = ?',
      [korrektur_zu_id, dojoId]
    );
    if (!original) return res.status(404).json({ error: 'Ursprüngliche Meldung nicht gefunden.' });

    const zd = zeitraumDaten(original.jahr, original.zeitraum_art, original.zeitraum_nr);
    const kz = await berechnungKennziffern(dojoId, zd);

    const dateiname = `UStVA_${original.jahr}_${String(original.zeitraum_nr).padStart(2, '0')}_Korrektur.xml`;
    const userId = req.user?.user_id || req.user?.id || null;

    const [result] = await pool.query(
      `INSERT INTO ustVA_abgaben
         (dojo_id, organisation_name, jahr, zeitraum_art, zeitraum_nr,
          kz81, kz86, kz35, kz36, kz66, zahllast,
          ist_korrektur, korrektur_zu_id, abgabe_status, xml_dateiname, eingereicht_von, notizen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'korrektur', ?, ?, ?)`,
      [dojoId, original.organisation_name, original.jahr, original.zeitraum_art, original.zeitraum_nr,
       kz.Kz81, kz.Kz86, kz.Kz35, kz.Kz36, kz.Kz66, kz.zahllast,
       korrektur_zu_id, dateiname, userId, notizen || null]
    );

    await pool.query('UPDATE ustVA_abgaben SET abgabe_status = ? WHERE abgabe_id = ?', ['korrektur', korrektur_zu_id]);

    res.json({ abgabe_id: result.insertId, ...kz, message: 'Korrekturantrag erstellt.' });
  } catch (err) {
    logger.error('ustVA/korrektur: Fehler', { error: err.message });
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// GET /api/steuer/ustVA/abgaben — Einreichungshistorie
router.get('/ustVA/abgaben', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo ausgewählt.' });

    const { jahr } = req.query;
    const jahrFilter = jahr ? 'AND jahr = ?' : '';
    const params = jahr ? [dojoId, parseInt(jahr)] : [dojoId];

    const [rows] = await pool.query(
      `SELECT abgabe_id, jahr, zeitraum_art, zeitraum_nr, kz81, kz86, kz35, kz36, kz66, zahllast,
              ist_korrektur, korrektur_zu_id, abgabe_status, xml_dateiname, eingereicht_am, notizen
       FROM ustVA_abgaben WHERE dojo_id = ? ${jahrFilter}
       ORDER BY jahr DESC, zeitraum_nr DESC, abgabe_id DESC`,
      params
    );

    res.json({ abgaben: rows });
  } catch (err) {
    logger.error('ustVA/abgaben: Fehler', { error: err.message });
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// GET /api/steuer/ustVA/korrektur/xml — ELSTER-XML für Korrekturantrag (mit Kz10=Berichtigung)
router.get('/ustVA/korrektur/xml', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo ausgewählt.' });

    const { abgabe_id } = req.query;
    if (!abgabe_id) return res.status(400).json({ error: 'abgabe_id fehlt.' });

    const [[abgabe]] = await pool.query(
      'SELECT * FROM ustVA_abgaben WHERE abgabe_id = ? AND dojo_id = ? AND ist_korrektur = 1',
      [abgabe_id, dojoId]
    );
    if (!abgabe) return res.status(404).json({ error: 'Korrekturantrag nicht gefunden.' });

    const [[dojoRow]] = await pool.query(
      'SELECT steuernummer FROM dojo WHERE id = ?', [dojoId]
    );
    const steuernummerRein = (dojoRow?.steuernummer || '').replace(/[^0-9]/g, '');
    const kz10 = kz10Wert(abgabe.zeitraum_art, abgabe.zeitraum_nr);
    const toCent = (euro) => Math.round(euro * 100);
    const kz = { Kz81: abgabe.kz81, Kz86: abgabe.kz86, Kz35: abgabe.kz35, Kz36: abgabe.kz36, Kz66: abgabe.kz66, zahllast: abgabe.zahllast };

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
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
        <Anmeldungssteuern art="UStVA" version="${abgabe.jahr}01">
          <Steuerfall>
            <Steuerpflichtiger>
              <Steuernummer>${escapeXml(steuernummerRein)}</Steuernummer>
            </Steuerpflichtiger>
            <Zeitraum>
              <Voranmeldungszeitraum Kz10="${kz10}" Kz18="${abgabe.jahr}"/>
            </Zeitraum>
            <Steuerberechnung>
              <Kz10>Berichtigung</Kz10>${kz.Kz81 > 0 ? `\n              <Kz81>${toCent(kz.Kz81)}</Kz81>` : ''}${kz.Kz35 > 0 ? `\n              <Kz35>${toCent(kz.Kz35)}</Kz35>` : ''}${kz.Kz86 > 0 ? `\n              <Kz86>${toCent(kz.Kz86)}</Kz86>` : ''}${kz.Kz36 > 0 ? `\n              <Kz36>${toCent(kz.Kz36)}</Kz36>` : ''}${kz.Kz66 > 0 ? `\n              <Kz66>${toCent(kz.Kz66)}</Kz66>` : ''}
              <Kz83>${toCent(kz.zahllast)}</Kz83>
            </Steuerberechnung>
          </Steuerfall>
        </Anmeldungssteuern>
      </Nutzdaten>
    </Nutzdatenblock>
  </DatenTeil>
</Elster>`;

    const dateiname = abgabe.xml_dateiname || `UStVA_${abgabe.jahr}_${String(abgabe.zeitraum_nr).padStart(2,'0')}_Korrektur.xml`;
    res.setHeader('Content-Type', 'application/xml; charset=UTF-8');
    res.setHeader('Content-Disposition', `attachment; filename="${dateiname}"`);
    return res.send(xmlBody);
  } catch (err) {
    logger.error('ustVA/korrektur/xml: Fehler', { error: err.message });
    res.status(500).json({ error: 'Interner Serverfehler.' });
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
        `SELECT *, betrag_brutto AS betrag_netto FROM v_euer_einnahmen WHERE dojo_id = ? AND YEAR(datum) = ?`,
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
        `SELECT *, betrag_brutto AS betrag_netto FROM v_euer_ausgaben WHERE dojo_id = ? AND YEAR(datum) = ?`,
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
        `SELECT COALESCE(SUM(betrag_brutto), 0) AS gesamt FROM v_euer_einnahmen
         WHERE dojo_id = ? AND YEAR(datum) = ?`,
        [dojoId, vorjahr]
      );
      const [[vjAus]] = await pool.query(
        `SELECT COALESCE(SUM(betrag_brutto), 0) AS gesamt FROM v_euer_ausgaben
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

// ---------------------------------------------------------------------------
// Gewerbesteuer — Einstellungen + Berechnung
// ---------------------------------------------------------------------------

router.get('/gewerbesteuer/einstellungen', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo.' });
    const [[row]] = await pool.query('SELECT * FROM gewerbesteuer_einstellungen WHERE dojo_id = ?', [dojoId]);
    res.json(row || { dojo_id: dojoId, hebesatz: 400, ist_gewerbesteuerpflichtig: 1 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/gewerbesteuer/einstellungen', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo.' });
    const { hebesatz, gemeinde, ist_gewerbesteuerpflichtig, hinzurechnungen_miete, hinzurechnungen_leasing, hinzurechnungen_zinsen, kuerz_grundbesitz } = req.body;
    const [[d]] = await pool.query('SELECT organisation_name FROM dojo WHERE id = ?', [dojoId]);
    await pool.query(
      `INSERT INTO gewerbesteuer_einstellungen (dojo_id, organisation_name, hebesatz, gemeinde, ist_gewerbesteuerpflichtig, hinzurechnungen_miete, hinzurechnungen_leasing, hinzurechnungen_zinsen, kuerz_grundbesitz)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE hebesatz=VALUES(hebesatz), gemeinde=VALUES(gemeinde), ist_gewerbesteuerpflichtig=VALUES(ist_gewerbesteuerpflichtig),
         hinzurechnungen_miete=VALUES(hinzurechnungen_miete), hinzurechnungen_leasing=VALUES(hinzurechnungen_leasing),
         hinzurechnungen_zinsen=VALUES(hinzurechnungen_zinsen), kuerz_grundbesitz=VALUES(kuerz_grundbesitz)`,
      [dojoId, d?.organisation_name || '', hebesatz || 400, gemeinde || '', ist_gewerbesteuerpflichtig ? 1 : 0,
       hinzurechnungen_miete || 0, hinzurechnungen_leasing || 0, hinzurechnungen_zinsen || 0, kuerz_grundbesitz || 0]
    );
    res.json({ message: 'Gespeichert' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/gewerbesteuer/berechnung', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo.' });
    const jahr = parseInt(req.query.jahr) || new Date().getFullYear();

    const [[einst]] = await pool.query('SELECT * FROM gewerbesteuer_einstellungen WHERE dojo_id = ?', [dojoId]);
    if (!einst?.ist_gewerbesteuerpflichtig) return res.json({ gewerbesteuer: 0, hinweis: 'Nicht gewerbesteuerpflichtig.' });

    // Gewerbeertrag aus GuV (EBIT = Einnahmen - Ausgaben)
    const [[einnahmen]] = await pool.query(
      'SELECT COALESCE(SUM(betrag_brutto),0) AS summe FROM v_euer_einnahmen WHERE dojo_id = ? AND jahr = ?', [dojoId, jahr]);
    const [[ausgaben]] = await pool.query(
      `SELECT COALESCE(SUM(betrag_brutto),0) AS summe FROM v_euer_ausgaben
       WHERE dojo_id = ? AND jahr = ? AND kategorie NOT IN ('privateinlage','privatentnahme','anlagevermögen')`, [dojoId, jahr]);

    const ebit = Number(einnahmen.summe) - Number(ausgaben.summe);

    // Hinzurechnungen §8 GewStG
    const hinzuMiete   = Number(einst.hinzurechnungen_miete || 0) * 0.125;   // 12,5% unbewegliche WG
    const hinzuLeasing = Number(einst.hinzurechnungen_leasing || 0) * 0.05;  // 5% bewegliche WG
    const hinzuZinsen  = Number(einst.hinzurechnungen_zinsen || 0) * 0.25;   // 25% Zinsen
    const hinzurechnungen = Math.round((hinzuMiete + hinzuLeasing + hinzuZinsen) * 100) / 100;

    // Kürzungen §9 GewStG
    const kuerzungen = Number(einst.kuerz_grundbesitz || 0) * 0.012; // 1,2% Einheitswert

    // Gewerbeertrag (abgerundet auf 100 €)
    const gewerbeertragRoh = Math.max(0, ebit + hinzurechnungen - kuerzungen);
    const freibetrag = 24500; // §11 GewStG
    const gewerbeertragNach = Math.max(0, Math.floor((gewerbeertragRoh - freibetrag) / 100) * 100);
    const steuermessbetrag  = Math.round(gewerbeertragNach * 0.035 * 100) / 100; // 3,5%
    const hebesatz = (einst.hebesatz || 400) / 100;
    const gewerbesteuer = Math.round(steuermessbetrag * hebesatz * 100) / 100;

    res.json({
      jahr, ebit: Math.round(ebit * 100) / 100,
      hinzurechnungen, kuerzungen: Math.round(kuerzungen * 100) / 100,
      gewerbeertrag_roh: Math.round(gewerbeertragRoh * 100) / 100,
      freibetrag, gewerbeertrag_nach_freibetrag: gewerbeertragNach,
      steuermessbetrag, hebesatz: einst.hebesatz || 400,
      gewerbesteuer, gemeinde: einst.gemeinde || ''
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------------------------------------------------------------------------
// Zusammenfassende Meldung (ZM) — §18a UStG
// ---------------------------------------------------------------------------

router.get('/zm', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo.' });
    const { jahr } = req.query;
    const [meldungen] = await pool.query(
      `SELECT z.*, GROUP_CONCAT(CONCAT(p.land_code,':',p.ust_id_empfaenger,':',p.betrag) SEPARATOR '|') AS positionen_raw
       FROM zm_meldungen z LEFT JOIN zm_positionen p ON z.zm_id = p.zm_id
       WHERE z.dojo_id = ? ${jahr ? 'AND z.jahr = ?' : ''}
       GROUP BY z.zm_id ORDER BY z.jahr DESC, z.quartal DESC`,
      jahr ? [dojoId, parseInt(jahr)] : [dojoId]
    );
    res.json({ meldungen });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/zm', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) return res.status(400).json({ error: 'Kein Dojo.' });
    const { jahr, quartal, positionen = [], notizen } = req.body;
    if (!jahr || !quartal) return res.status(400).json({ error: 'Jahr und Quartal erforderlich.' });

    const [[d]] = await pool.query('SELECT organisation_name FROM dojo WHERE id = ?', [dojoId]);
    const betragGesamt = positionen.reduce((s, p) => s + Number(p.betrag || 0), 0);

    const [result] = await pool.query(
      `INSERT INTO zm_meldungen (dojo_id, organisation_name, jahr, quartal, betrag_gesamt, notizen)
       VALUES (?,?,?,?,?,?)`,
      [dojoId, d?.organisation_name || '', parseInt(jahr), parseInt(quartal), betragGesamt, notizen || null]
    );
    const zmId = result.insertId;

    for (const pos of positionen) {
      if (pos.ust_id && pos.betrag) {
        await pool.query(
          'INSERT INTO zm_positionen (zm_id, ust_id_empfaenger, land_code, betrag, art) VALUES (?,?,?,?,?)',
          [zmId, pos.ust_id, pos.land_code || 'DE', pos.betrag, pos.art || 'sonstige_leistung']
        );
      }
    }
    res.json({ zm_id: zmId, message: 'ZM-Meldung gespeichert.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/zm/:id/einreichen', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    const [[zm]] = await pool.query('SELECT * FROM zm_meldungen WHERE zm_id = ? AND dojo_id = ?', [req.params.id, dojoId]);
    if (!zm) return res.status(404).json({ error: 'Nicht gefunden.' });
    await pool.query('UPDATE zm_meldungen SET meldung_status = ?, eingereicht_am = NOW() WHERE zm_id = ?', ['eingereicht', zm.zm_id]);
    res.json({ message: 'Als eingereicht markiert.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
