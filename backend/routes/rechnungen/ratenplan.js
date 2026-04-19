// =====================================================================================
// RATENPLAN ROUTES — Ratenzahlung für Mitglieder mit Nachzahlungen
// =====================================================================================

const express = require('express');
const router = express.Router();
const db = require('../../db');
const pool = db.promise();
const { getSecureDojoId } = require('../../middleware/tenantSecurity');
const logger = require('../../utils/logger');

// ─── GET /ratenplan/:mitglied_id — Aktiven Plan laden ────────────────────────

router.get('/ratenplan/:mitglied_id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    const mitglied_id = parseInt(req.params.mitglied_id);

    // Tenant-Check: Mitglied gehört zum Dojo?
    if (dojoId) {
      const [[m]] = await pool.query(
        `SELECT mitglied_id FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?`,
        [mitglied_id, dojoId]
      );
      if (!m) return res.status(403).json({ success: false, message: 'Kein Zugriff' });
    }

    const [[plan]] = await pool.query(
      `SELECT * FROM mitglied_ratenplan WHERE mitglied_id = ? AND aktiv = 1 ORDER BY erstellt_am DESC LIMIT 1`,
      [mitglied_id]
    );

    // Summe offener Rechnungen für dieses Mitglied
    const [[offene]] = await pool.query(
      `SELECT COALESCE(SUM(betrag), 0) AS summe
       FROM rechnungen
       WHERE mitglied_id = ? AND status IN ('offen', 'ueberfaellig', 'teilweise_bezahlt')`,
      [mitglied_id]
    );

    res.json({
      success: true,
      plan: plan || null,
      offener_betrag: parseFloat(offene.summe)
    });
  } catch (err) {
    logger.error('Ratenplan laden Fehler', { error: err.message });
    res.status(500).json({ success: false, message: 'Fehler beim Laden' });
  }
});

// ─── POST /ratenplan — Plan erstellen ────────────────────────────────────────

router.post('/ratenplan', async (req, res) => {
  try {
    let dojoId = getSecureDojoId(req);

    const { mitglied_id, ausstehender_betrag, modell, monatlicher_aufschlag, notizen } = req.body;

    if (!mitglied_id || !ausstehender_betrag || !modell || !monatlicher_aufschlag) {
      return res.status(400).json({ success: false, message: 'Pflichtfelder fehlen' });
    }

    // Tenant-Check / dojo_id ermitteln
    if (dojoId) {
      // Normaler Admin: Mitglied muss zum eigenen Dojo gehören
      const [[m]] = await pool.query(
        `SELECT mitglied_id FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?`,
        [mitglied_id, dojoId]
      );
      if (!m) return res.status(403).json({ success: false, message: 'Kein Zugriff' });
    } else {
      // Super-Admin: dojo_id aus Mitglied ableiten
      const [[m]] = await pool.query(
        `SELECT dojo_id FROM mitglieder WHERE mitglied_id = ?`,
        [mitglied_id]
      );
      if (!m) return res.status(404).json({ success: false, message: 'Mitglied nicht gefunden' });
      dojoId = m.dojo_id;
    }

    // Evtl. bestehende aktive Pläne deaktivieren
    await pool.query(
      `UPDATE mitglied_ratenplan SET aktiv = 0 WHERE mitglied_id = ? AND aktiv = 1`,
      [mitglied_id]
    );

    const [result] = await pool.query(
      `INSERT INTO mitglied_ratenplan
         (mitglied_id, dojo_id, ausstehender_betrag, modell, monatlicher_aufschlag, notizen)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [mitglied_id, dojoId, ausstehender_betrag, modell, monatlicher_aufschlag, notizen || null]
    );

    logger.info('Ratenplan erstellt', { mitglied_id, modell, aufschlag: monatlicher_aufschlag });
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    logger.error('Ratenplan erstellen Fehler', { error: err.message });
    res.status(500).json({ success: false, message: 'Fehler beim Erstellen' });
  }
});

// ─── PUT /ratenplan/:id — Plan aktualisieren (Betrag, Notizen, deaktivieren) ─

router.put('/ratenplan/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);

    const plan_id = parseInt(req.params.id);
    const { aktiv, monatlicher_aufschlag, notizen, bereits_abgezahlt } = req.body;

    // Tenant-Check: Super-Admin darf alle, normaler Admin nur eigenes Dojo
    const planQuery = dojoId
      ? `SELECT r.id FROM mitglied_ratenplan r JOIN mitglieder m ON r.mitglied_id = m.mitglied_id WHERE r.id = ? AND m.dojo_id = ?`
      : `SELECT id FROM mitglied_ratenplan WHERE id = ?`;
    const planParams = dojoId ? [plan_id, dojoId] : [plan_id];
    const [[plan]] = await pool.query(planQuery, planParams);
    if (!plan) return res.status(403).json({ success: false, message: 'Kein Zugriff' });

    const updates = [];
    const values = [];
    if (aktiv !== undefined)               { updates.push('aktiv = ?');               values.push(aktiv ? 1 : 0); }
    if (monatlicher_aufschlag !== undefined){ updates.push('monatlicher_aufschlag = ?'); values.push(monatlicher_aufschlag); }
    if (notizen !== undefined)             { updates.push('notizen = ?');             values.push(notizen); }
    if (bereits_abgezahlt !== undefined)   { updates.push('bereits_abgezahlt = ?');   values.push(bereits_abgezahlt); }

    if (updates.length === 0) return res.json({ success: true });

    values.push(plan_id);
    await pool.query(`UPDATE mitglied_ratenplan SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ success: true });
  } catch (err) {
    logger.error('Ratenplan update Fehler', { error: err.message });
    res.status(500).json({ success: false, message: 'Fehler beim Aktualisieren' });
  }
});

// ─── POST /rueckwirkend — Rückwirkende Beiträge abrechnen ────────────────────
//
// Modus:
//   'einmal'      → eine Sammelrechnung über alle offenen Monate
//   'teilzahlung' → eine Rechnung pro offenem Monat
//   'raten'       → Ratenplan-Eintrag (monatlicher Aufschlag), keine Rechnungen

router.post('/rueckwirkend', async (req, res) => {
  try {
    let dojoId = getSecureDojoId(req);

    const { mitglied_id, vertrag_id, modus, monatlicher_aufschlag } = req.body;

    if (!mitglied_id || !vertrag_id || !modus) {
      return res.status(400).json({ success: false, message: 'mitglied_id, vertrag_id und modus sind Pflichtfelder' });
    }

    // Tenant-Check / dojo_id ermitteln
    if (dojoId) {
      const [[m]] = await pool.query(
        `SELECT mitglied_id FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?`,
        [mitglied_id, dojoId]
      );
      if (!m) return res.status(403).json({ success: false, message: 'Kein Zugriff' });
    } else {
      const [[m]] = await pool.query(
        `SELECT dojo_id FROM mitglieder WHERE mitglied_id = ?`,
        [mitglied_id]
      );
      if (!m) return res.status(404).json({ success: false, message: 'Mitglied nicht gefunden' });
      dojoId = m.dojo_id;
    }

    // Vertrag laden
    const [[vertrag]] = await pool.query(
      `SELECT v.*, t.name AS tarif_name
       FROM vertraege v
       LEFT JOIN tarife t ON v.tarif_id = t.id
       WHERE v.id = ? AND v.mitglied_id = ?`,
      [vertrag_id, mitglied_id]
    );
    if (!vertrag) return res.status(404).json({ success: false, message: 'Vertrag nicht gefunden' });

    const monatsbeitrag = parseFloat(vertrag.monatsbeitrag || vertrag.monatlicher_beitrag || 0);
    if (monatsbeitrag <= 0) {
      return res.status(400).json({ success: false, message: 'Vertrag hat keinen gültigen Monatsbeitrag' });
    }

    // Offene Monate berechnen (von vertragsbeginn bis letzten Monat)
    const beginn = new Date(vertrag.vertragsbeginn);
    const heute = new Date();
    // Letzter abzurechnender Monat = Vormonat (aktueller Monat wird normal abgerechnet)
    const bisMonat = new Date(heute.getFullYear(), heute.getMonth() - 1, 1);

    if (beginn > bisMonat) {
      return res.status(400).json({ success: false, message: 'Vertrag beginnt nicht in der Vergangenheit' });
    }

    // Monate sammeln
    const monate = [];
    const cursor = new Date(beginn.getFullYear(), beginn.getMonth(), 1);
    while (cursor <= bisMonat) {
      monate.push({ monat: cursor.getMonth() + 1, jahr: cursor.getFullYear() });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // Bereits existierende Mitgliedsbeitrags-Rechnungen ausfiltern
    const [vorhandene] = await pool.query(
      `SELECT MONTH(datum) AS monat, YEAR(datum) AS jahr
       FROM rechnungen
       WHERE mitglied_id = ? AND art = 'mitgliedsbeitrag'`,
      [mitglied_id]
    );
    const vorhanden = new Set(vorhandene.map(r => `${r.jahr}-${r.monat}`));
    const offeneMonate = monate.filter(({ monat, jahr }) => !vorhanden.has(`${jahr}-${monat}`));

    if (offeneMonate.length === 0) {
      return res.json({ success: true, message: 'Keine offenen Monate gefunden', erstellte_rechnungen: 0 });
    }

    const gesamtbetrag = monatsbeitrag * offeneMonate.length;

    // Hilfsfunktion: Rechnung einfügen
    const insertRechnung = async (datumStr, betrag, beschreibung) => {
      // Rechnungsnummer: Zähle vorhandene Rechnungen dieses Jahres
      const [[ { count } ]] = await pool.query(
        `SELECT (SELECT COUNT(*) FROM rechnungen WHERE YEAR(datum) = ?) +
                (SELECT COUNT(*) FROM verbandsmitgliedschaft_zahlungen WHERE YEAR(rechnungsdatum) = ?) AS count`,
        [new Date(datumStr).getFullYear(), new Date(datumStr).getFullYear()]
      );
      const d = new Date(datumStr);
      const nr = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}-${1000 + count}`;

      const netto = betrag / 1.19;
      const mwst  = betrag - netto;
      const faelligkeit = new Date(datumStr);
      faelligkeit.setDate(faelligkeit.getDate() + 14);
      const faelligkeitsdatum = faelligkeit.toISOString().slice(0, 10);

      const [result] = await pool.query(
        `INSERT INTO rechnungen
           (rechnungsnummer, mitglied_id, datum, faelligkeitsdatum,
            betrag, netto_betrag, brutto_betrag, mwst_satz, mwst_betrag,
            art, beschreibung, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'mitgliedsbeitrag', ?, 'offen')`,
        [nr, mitglied_id, datumStr, faelligkeitsdatum,
         betrag, netto, betrag, 19.00, mwst, beschreibung]
      );
      const rechnung_id = result.insertId;

      await pool.query(
        `INSERT INTO rechnungspositionen
           (rechnung_id, position_nr, bezeichnung, menge, einzelpreis, gesamtpreis, mwst_satz)
         VALUES (?, 1, ?, 1, ?, ?, 19.00)`,
        [rechnung_id, beschreibung, betrag, betrag]
      );
      return rechnung_id;
    };

    // ── Modus-Handling ──────────────────────────────────────────────────────────

    if (modus === 'einmal') {
      const datumStr = new Date().toISOString().slice(0, 10);
      const letzterMonat = offeneMonate[offeneMonate.length - 1];
      const ersterMonat  = offeneMonate[0];
      const beschreibung = `Rückwirkende Mitgliedsbeiträge ${ersterMonat.monat}/${ersterMonat.jahr}–${letzterMonat.monat}/${letzterMonat.jahr} (${offeneMonate.length} Monate)`;
      await insertRechnung(datumStr, gesamtbetrag, beschreibung);
      return res.json({ success: true, erstellte_rechnungen: 1, gesamtbetrag, monate: offeneMonate.length });
    }

    if (modus === 'teilzahlung') {
      for (const { monat, jahr } of offeneMonate) {
        const datumStr = `${jahr}-${String(monat).padStart(2,'0')}-01`;
        const beschreibung = `Mitgliedsbeitrag ${monat}/${jahr} - ${vertrag.tarif_name || 'Mitgliedschaft'}`;
        await insertRechnung(datumStr, monatsbeitrag, beschreibung);
      }
      return res.json({ success: true, erstellte_rechnungen: offeneMonate.length, gesamtbetrag, monate: offeneMonate.length });
    }

    if (modus === 'raten') {
      const aufschlag = parseFloat(monatlicher_aufschlag);
      if (!aufschlag || aufschlag <= 0) {
        return res.status(400).json({ success: false, message: 'monatlicher_aufschlag muss > 0 sein' });
      }
      // Bestehende aktive Pläne deaktivieren
      await pool.query(
        `UPDATE mitglied_ratenplan SET aktiv = 0 WHERE mitglied_id = ? AND aktiv = 1`,
        [mitglied_id]
      );
      const [result] = await pool.query(
        `INSERT INTO mitglied_ratenplan
           (mitglied_id, dojo_id, ausstehender_betrag, modell, monatlicher_aufschlag, notizen)
         VALUES (?, ?, ?, 'aufschlag', ?, ?)`,
        [mitglied_id, dojoId, gesamtbetrag, aufschlag,
         `Rückwirkende Beiträge ${offeneMonate[0].monat}/${offeneMonate[0].jahr}–${offeneMonate[offeneMonate.length-1].monat}/${offeneMonate[offeneMonate.length-1].jahr}`]
      );
      return res.json({ success: true, erstellte_rechnungen: 0, ratenplan_id: result.insertId, gesamtbetrag, monate: offeneMonate.length, monatlicher_aufschlag: aufschlag });
    }

    return res.status(400).json({ success: false, message: 'Unbekannter Modus. Erlaubt: einmal, teilzahlung, raten' });

  } catch (err) {
    logger.error('Rückwirkende Abrechnung Fehler', { error: err.message });
    res.status(500).json({ success: false, message: 'Serverfehler: ' + err.message });
  }
});

// ─── DELETE /ratenplan/:id — Plan löschen ────────────────────────────────────

router.delete('/ratenplan/:id', async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);

    const plan_id = parseInt(req.params.id);

    // Tenant-Check: Super-Admin darf alle, normaler Admin nur eigenes Dojo
    const planQuery = dojoId
      ? `SELECT r.id FROM mitglied_ratenplan r JOIN mitglieder m ON r.mitglied_id = m.mitglied_id WHERE r.id = ? AND m.dojo_id = ?`
      : `SELECT id FROM mitglied_ratenplan WHERE id = ?`;
    const planParams = dojoId ? [plan_id, dojoId] : [plan_id];
    const [[plan]] = await pool.query(planQuery, planParams);
    if (!plan) return res.status(403).json({ success: false, message: 'Kein Zugriff' });

    await pool.query(`DELETE FROM mitglied_ratenplan WHERE id = ?`, [plan_id]);
    res.json({ success: true });
  } catch (err) {
    logger.error('Ratenplan löschen Fehler', { error: err.message });
    res.status(500).json({ success: false, message: 'Fehler beim Löschen' });
  }
});

module.exports = router;
