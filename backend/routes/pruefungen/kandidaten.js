/**
 * Pruefungen Kandidaten Routes
 * Prüfungskandidaten-Verwaltung
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();
const { getSecureDojoId } = require('../../utils/dojo-filter-helper');
const { sendPushToMitglied } = require('../../utils/pushNotification');
const { sendEmailForDojo } = require('../../services/emailService');

// GET /kandidaten - Ermittelt alle Prüfungskandidaten (mit Tenant-Isolation)
router.get('/', (req, res) => {
  const { stil_id } = req.query;
  const secureDojoId = getSecureDojoId(req);

  let whereConditions = [];
  let queryParams = [];

  if (secureDojoId) {
    // Normaler Admin: IMMER nur eigenes Dojo
    whereConditions.push('m.dojo_id = ?');
    queryParams.push(secureDojoId);
  } else {
    // Super-Admin: optionale Filterung
    const { dojo_ids, dojo_id } = req.query;
    if (dojo_ids) {
      const ids = dojo_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (ids.length > 0) {
        whereConditions.push(`m.dojo_id IN (${ids.map(() => '?').join(',')})`);
        queryParams.push(...ids);
      }
    } else if (dojo_id && dojo_id !== 'all') {
      whereConditions.push('m.dojo_id = ?');
      queryParams.push(parseInt(dojo_id));
    }
  }

  if (stil_id) {
    whereConditions.push('msd.stil_id = ?');
    queryParams.push(parseInt(stil_id));
  }

  const whereClause = whereConditions.length > 0
    ? 'WHERE ' + whereConditions.join(' AND ')
    : "WHERE m.dojo_id NOT IN (SELECT DISTINCT dojo_id FROM admin_users WHERE dojo_id IS NOT NULL AND rolle NOT IN ('eingeschraenkt', 'trainer', 'checkin'))"; // Kein Filter: nur verwaltete Dojos

  const query = `
    SELECT m.mitglied_id, m.vorname, m.nachname, m.geburtsdatum, m.email, m.dojo_id,
      s.stil_id, s.name as stil_name, msd.current_graduierung_id,
      g_current.name as aktuelle_graduierung, g_current.farbe_hex as aktuelle_farbe, g_current.reihenfolge as aktuelle_reihenfolge,
      g_next.graduierung_id as naechste_graduierung_id, g_next.name as naechste_graduierung, g_next.farbe_hex as naechste_farbe,
      g_next.reihenfolge as naechste_reihenfolge,
      g_next.trainingsstunden_min as benoetigte_stunden, g_next.mindestzeit_monate as benoetigte_monate,
      msd.letzte_pruefung,
      COALESCE((SELECT COUNT(*) FROM anwesenheit a WHERE a.mitglied_id = m.mitglied_id AND a.anwesend = 1 AND (msd.letzte_pruefung IS NULL OR a.datum > msd.letzte_pruefung)), 0) as absolvierte_stunden,
      CASE WHEN msd.letzte_pruefung IS NULL THEN TIMESTAMPDIFF(MONTH, m.eintrittsdatum, CURDATE()) ELSE TIMESTAMPDIFF(MONTH, msd.letzte_pruefung, CURDATE()) END as monate_seit_letzter_pruefung,
      CASE WHEN g_next.graduierung_id IS NULL THEN 0
        WHEN (COALESCE((SELECT COUNT(*) FROM anwesenheit a WHERE a.mitglied_id = m.mitglied_id AND a.anwesend = 1 AND (msd.letzte_pruefung IS NULL OR a.datum > msd.letzte_pruefung)), 0) >= g_next.trainingsstunden_min
          AND CASE WHEN msd.letzte_pruefung IS NULL THEN TIMESTAMPDIFF(MONTH, m.eintrittsdatum, CURDATE()) ELSE TIMESTAMPDIFF(MONTH, msd.letzte_pruefung, CURDATE()) END >= g_next.mindestzeit_monate) THEN 1
        ELSE 0 END as berechtigt,
      (SELECT COUNT(*) FROM pruefungen p WHERE p.mitglied_id = m.mitglied_id AND p.stil_id = s.stil_id AND p.status = 'geplant') as bereits_zugelassen,
      (SELECT p.pruefung_id FROM pruefungen p WHERE p.mitglied_id = m.mitglied_id AND p.stil_id = s.stil_id AND p.status = 'geplant' LIMIT 1) as pruefung_id,
      (SELECT p.graduierung_nachher_id FROM pruefungen p WHERE p.mitglied_id = m.mitglied_id AND p.stil_id = s.stil_id AND p.status = 'geplant' LIMIT 1) as angestrebte_graduierung_id
    FROM mitglieder m
    INNER JOIN mitglied_stil_data msd ON m.mitglied_id = msd.mitglied_id
    INNER JOIN stile s ON msd.stil_id = s.stil_id
    LEFT JOIN graduierungen g_current ON msd.current_graduierung_id = g_current.graduierung_id
    LEFT JOIN graduierungen g_next ON (g_next.stil_id = s.stil_id AND g_next.aktiv = 1 AND g_next.reihenfolge = (SELECT MIN(g2.reihenfolge) FROM graduierungen g2 WHERE g2.stil_id = s.stil_id AND g2.aktiv = 1 AND (g_current.reihenfolge IS NULL OR g2.reihenfolge > g_current.reihenfolge)))
    ${whereClause}
    AND m.aktiv = 1 AND g_next.graduierung_id IS NOT NULL
    ORDER BY berechtigt DESC, s.name ASC, m.nachname ASC, m.vorname ASC
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Ermitteln der Prüfungskandidaten:', { error: err });
      return res.status(500).json({ error: 'Fehler beim Laden der Prüfungskandidaten', details: err.message });
    }

    const kandidaten = results.map(row => ({
      ...row,
      berechtigt: row.berechtigt === 1,
      bereits_zugelassen: row.bereits_zugelassen > 0,
      fortschritt_prozent: row.benoetigte_stunden > 0 ? Math.min(100, Math.round((row.absolvierte_stunden / row.benoetigte_stunden) * 100)) : 0
    }));

    res.json({ success: true, count: kandidaten.length, berechtigt_count: kandidaten.filter(k => k.berechtigt).length, kandidaten });
  });
});

// POST /kandidaten/extern - Externe Person für Prüfung zulassen (kein Mitglied)
router.post('/extern', (req, res) => {
  const { extern_vorname, extern_nachname, extern_verein, stil_id, graduierung_nachher_id, pruefungsdatum, pruefungsort, pruefungszeit, pruefungsgebuehr, dojo_id: bodyDojoId } = req.body;
  const secureDojoId = getSecureDojoId(req);
  const dojo_id = secureDojoId || parseInt(bodyDojoId);

  if (!extern_vorname || !extern_nachname) {
    return res.status(400).json({ error: 'Vorname und Nachname sind Pflichtfelder' });
  }
  if (!stil_id || !graduierung_nachher_id || !pruefungsdatum || !dojo_id) {
    return res.status(400).json({ error: 'Fehlende Pflichtfelder: stil_id, graduierung_nachher_id, pruefungsdatum, dojo_id' });
  }

  const insertQuery = `
    INSERT INTO pruefungen
      (mitglied_id, stil_id, dojo_id, graduierung_vorher_id, graduierung_nachher_id,
       pruefungsdatum, pruefungszeit, pruefungsort, pruefungsgebuehr, status,
       is_extern, extern_vorname, extern_nachname, extern_verein,
       bestanden, erstellt_am, aktualisiert_am)
    VALUES (NULL, ?, ?, NULL, ?, ?, ?, ?, ?, 'geplant', 1, ?, ?, ?, FALSE, NOW(), NOW())
  `;

  db.query(insertQuery, [
    parseInt(stil_id), dojo_id, parseInt(graduierung_nachher_id),
    pruefungsdatum,
    pruefungszeit || '10:00',
    pruefungsort || null,
    pruefungsgebuehr || null,
    extern_vorname.trim(), extern_nachname.trim(),
    extern_verein || null
  ], (err, result) => {
    if (err) {
      logger.error('Fehler beim Hinzufügen des externen Teilnehmers:', { error: err });
      return res.status(500).json({ error: 'Fehler beim Hinzufügen', details: err.message });
    }
    logger.success('Externer Teilnehmer hinzugefügt', { id: result.insertId, extern_nachname });
    res.status(201).json({ success: true, pruefung_id: result.insertId, message: 'Externer Teilnehmer erfolgreich hinzugefügt' });
  });
});

// Hilfsfunktion: Erstellt automatisch eine Rechnung für eine Prüfungsgebühr
// zahlungsart: 'lastschrift' → Beleg-Rechnung + Beitrag für Lastschriftlauf
//              'rechnung'    → Offene Rechnung, kein Lastschrift-Beitrag
async function createPruefungsRechnung(mitglied_id, pruefungsgebuehr, pruefungsdatum, stilName, dojoId, zahlungsart = 'lastschrift') {
  const pool = db.promise();
  const heute = new Date();
  const datumPrefix = `${heute.getFullYear()}${String(heute.getMonth() + 1).padStart(2, '0')}`;
  const jahr = heute.getFullYear();

  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count FROM rechnungen r JOIN mitglieder m ON r.mitglied_id = m.mitglied_id WHERE YEAR(r.datum) = ? AND m.dojo_id = ?`,
    [jahr, dojoId]
  );
  const laufnummer = 1000 + count;
  const rechnungsnummer = `${datumPrefix}-${laufnummer}`;

  const betrag = parseFloat(pruefungsgebuehr);
  const faellig = new Date(pruefungsdatum || heute);
  const fDate = faellig.toISOString().split('T')[0];
  const beschreibung = `Prüfungsgebühr${stilName ? ' – ' + stilName : ''}`;
  const isLastschrift = zahlungsart === 'lastschrift';
  const dbZahlungsart = isLastschrift ? 'Lastschrift' : 'Rechnung';

  const [result] = await pool.query(
    `INSERT INTO rechnungen (rechnungsnummer, mitglied_id, datum, faelligkeitsdatum, betrag, netto_betrag, brutto_betrag, mwst_satz, mwst_betrag, art, beschreibung, status, zahlungsart, dojo_id)
     VALUES (?, ?, CURDATE(), ?, ?, ?, ?, 0, 0, 'pruefungsgebuehr', ?, 'offen', ?, ?)`,
    [rechnungsnummer, mitglied_id, fDate, betrag, betrag, betrag, beschreibung, dbZahlungsart, dojoId]
  );
  const rechnungId = result.insertId;

  await pool.query(
    `INSERT INTO rechnungspositionen (rechnung_id, position_nr, bezeichnung, menge, einzelpreis, gesamtpreis, mwst_satz)
     VALUES (?, 1, ?, 1, ?, ?, 0)`,
    [rechnungId, beschreibung, betrag, betrag]
  );

  // Nur bei Lastschrift: Beitrag für Lastschriftlauf anlegen
  if (isLastschrift) {
    await pool.query(
      `INSERT INTO beitraege (mitglied_id, betrag, zahlungsdatum, zahlungsart, bezahlt, dojo_id, magicline_description, art, rechnung_id)
       VALUES (?, ?, ?, 'Lastschrift', 0, ?, ?, 'pruefungsgebuehr', ?)`,
      [mitglied_id, betrag, fDate, dojoId, beschreibung, rechnungId]
    );
  }

  return rechnungId;
}

// Erstellt Rechnung + (bei Lastschrift) Beitrag für eine Prüfung — ERST wenn das
// Mitglied die Teilnahme zusagt ("kommt"). Idempotent: legt nichts an, wenn schon
// eine gebuehr_rechnung_id existiert. Wird aus dem Antwort-Endpoint aufgerufen,
// damit NIE vor der Zusage abgebucht wird.
async function createRechnungBeiZusage(pruefungId) {
  const pool = db.promise();
  const [[p]] = await pool.query(
    `SELECT pruefung_id, mitglied_id, stil_id, dojo_id, pruefungsdatum,
            pruefungsgebuehr, zahlungsart, gebuehr_auto_verrechnen, gebuehr_rechnung_id
     FROM pruefungen WHERE pruefung_id = ? LIMIT 1`,
    [pruefungId]
  );
  if (!p) return;
  if (p.gebuehr_rechnung_id) return; // schon erstellt → idempotent, kein Doppel-Einzug
  const gebuehr = parseFloat(p.pruefungsgebuehr);
  if (!gebuehr || gebuehr <= 0) return;

  const datumStr = (p.pruefungsdatum instanceof Date)
    ? p.pruefungsdatum.toISOString().split('T')[0]
    : String(p.pruefungsdatum).split('T')[0];

  // Rechnung nötig? explizite zahlungsart (rechnung/lastschrift) ODER Termin-Auto-Verrechnung
  const sollRechnung = (p.zahlungsart === 'rechnung' || p.zahlungsart === 'lastschrift');
  let effektiv = sollRechnung ? 1 : p.gebuehr_auto_verrechnen;
  if (!sollRechnung && (effektiv === null || effektiv === undefined)) {
    const [[termin]] = await pool.query(
      `SELECT gebuehr_auto_verrechnen FROM pruefungstermin_vorlagen
       WHERE pruefungsdatum = ? AND stil_id = ? AND dojo_id = ? LIMIT 1`,
      [datumStr, p.stil_id, p.dojo_id]
    );
    effektiv = termin?.gebuehr_auto_verrechnen ?? 0;
  }
  if (effektiv !== 1) return;

  const [[stilRow]] = await pool.query('SELECT name FROM stile WHERE stil_id = ? LIMIT 1', [p.stil_id]);
  const rechnungId = await createPruefungsRechnung(
    p.mitglied_id, gebuehr, datumStr, stilRow?.name || '', p.dojo_id, p.zahlungsart || 'lastschrift'
  );
  await pool.query('UPDATE pruefungen SET gebuehr_rechnung_id = ? WHERE pruefung_id = ?', [rechnungId, pruefungId]);
  logger.info('Prüfungsrechnung bei Teilnahme-Zusage erstellt', { pruefungId, rechnungId, betrag: gebuehr, zahlungsart: p.zahlungsart });

  // Bei Lastschrift: SEPA-Zustimmungs-Notification
  if (p.zahlungsart === 'lastschrift') {
    const [[m]] = await pool.query('SELECT email FROM mitglieder WHERE mitglied_id = ? LIMIT 1', [p.mitglied_id]);
    if (m?.email) {
      const messageLS = `Die Pruefungsgebuehr von ${gebuehr.toFixed(2)} EUR wird per Lastschrift von deinem Konto abgebucht. Bist du damit einverstanden?`;
      const metaLS = JSON.stringify({ type: 'pruefung_lastschrift', pruefung_id: pruefungId, betrag: gebuehr });
      await pool.query(
        `INSERT INTO notifications (type, recipient, subject, message, status, requires_confirmation, metadata, created_at)
         VALUES ('push', ?, 'SEPA-Lastschrift Pruefungsgebuehr', ?, 'unread', 1, ?, NOW())`,
        [m.email, messageLS, metaLS]
      );
    }
  }
}

// POST /kandidaten/:mitglied_id/zulassen - Mitglied für Prüfung zulassen
router.post('/:mitglied_id/zulassen', (req, res) => {
  const mitglied_id = parseInt(req.params.mitglied_id);
  const secureDojoId = getSecureDojoId(req);
  const { stil_id, graduierung_nachher_id, pruefungsdatum, pruefungsort, pruefungsgebuehr, anmeldefrist, gurtlaenge, bemerkungen, teilnahmebedingungen, pruefungszeit = '10:00', zahlungsart, gebuehr_auto_verrechnen } = req.body;

  // Dojo-ID immer aus Token erzwingen
  const dojo_id = secureDojoId || parseInt(req.body.dojo_id);

  if (!mitglied_id || !stil_id || !graduierung_nachher_id || !dojo_id) {
    return res.status(400).json({ error: 'Fehlende erforderliche Felder', required: ['mitglied_id', 'stil_id', 'graduierung_nachher_id', 'dojo_id'] });
  }

  db.query('SELECT id FROM dojo WHERE id = ?', [dojo_id], (dojoErr, dojoResults) => {
    if (dojoErr) return res.status(500).json({ error: 'Fehler beim Prüfen des Dojos', details: dojoErr.message });
    if (dojoResults.length === 0) return res.status(400).json({ error: `Dojo mit ID ${dojo_id} existiert nicht` });

    // Doppelschutz: kein zweiter Eintrag für selbes Mitglied + Stil + Datum
    const dupCheck = pruefungsdatum
      ? `SELECT pruefung_id FROM pruefungen WHERE mitglied_id = ? AND stil_id = ? AND DATE(pruefungsdatum) = ? AND status = 'geplant' AND dojo_id = ? LIMIT 1`
      : `SELECT pruefung_id FROM pruefungen WHERE mitglied_id = ? AND stil_id = ? AND DATE(pruefungsdatum) = DATE(NOW() + INTERVAL 30 DAY) AND status = 'geplant' AND dojo_id = ? LIMIT 1`;
    const dupParams = [mitglied_id, stil_id, ...(pruefungsdatum ? [pruefungsdatum] : []), dojo_id];
    db.query(dupCheck, dupParams, (dupErr, dupRows) => {
      if (dupErr) return res.status(500).json({ error: 'Fehler bei Duplikatprüfung', details: dupErr.message });
      if (dupRows.length > 0) {
        return res.status(409).json({ error: 'Mitglied ist für diesen Prüfungstermin bereits zugelassen', pruefung_id: dupRows[0].pruefung_id });
      }

    db.query('SELECT current_graduierung_id FROM mitglied_stil_data WHERE mitglied_id = ? AND stil_id = ?', [mitglied_id, stil_id], async (gradErr, gradResults) => {
      if (gradErr) return res.status(500).json({ error: 'Fehler beim Abrufen der aktuellen Graduierung', details: gradErr.message });

      const graduierung_vorher_id = gradResults.length > 0 ? gradResults[0].current_graduierung_id : null;
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 30);
      const finalPruefungsdatum = pruefungsdatum || defaultDate.toISOString().split('T')[0];

      // Effektives auto_verrechnen: expliziter Wert aus Body hat Vorrang, sonst NULL (Termin-Einstellung)
      const autoVerrechnenValue = (gebuehr_auto_verrechnen === true || gebuehr_auto_verrechnen === 1) ? 1
                                : (gebuehr_auto_verrechnen === false || gebuehr_auto_verrechnen === 0) ? 0
                                : null;

      // Automatische Gebührenberechnung: 35 € pro Graduierungsschritt
      const GEBUEHR_PRO_STUFE = 35;
      let finaleGebuehr = pruefungsgebuehr ? parseFloat(pruefungsgebuehr) : null;
      if (!finaleGebuehr && graduierung_vorher_id && graduierung_nachher_id) {
        try {
          const pool = db.promise();
          const [[vorher]] = await pool.query('SELECT reihenfolge FROM graduierungen WHERE graduierung_id = ?', [graduierung_vorher_id]);
          const [[nachher]] = await pool.query('SELECT reihenfolge FROM graduierungen WHERE graduierung_id = ?', [graduierung_nachher_id]);
          if (vorher && nachher) {
            const stufen = Math.max(1, nachher.reihenfolge - vorher.reihenfolge);
            finaleGebuehr = stufen * GEBUEHR_PRO_STUFE;
          }
        } catch (e) {
          logger.error('Fehler bei Gebührenberechnung:', { error: e.message });
        }
      } else if (!finaleGebuehr && !graduierung_vorher_id && graduierung_nachher_id) {
        // Erste Prüfung (kein Vorher-Gurt) = 1 Stufe
        finaleGebuehr = GEBUEHR_PRO_STUFE;
      }

      const insertQuery = `
        INSERT INTO pruefungen (mitglied_id, stil_id, dojo_id, graduierung_vorher_id, graduierung_nachher_id, pruefungsdatum, pruefungszeit, pruefungsort, pruefungsgebuehr, anmeldefrist, gurtlaenge, bemerkungen, teilnahmebedingungen, zahlungsart, gebuehr_auto_verrechnen, status, bestanden, erstellt_am, aktualisiert_am)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'geplant', FALSE, NOW(), NOW())
      `;

      db.query(insertQuery, [mitglied_id, stil_id, dojo_id, graduierung_vorher_id, graduierung_nachher_id, finalPruefungsdatum, pruefungszeit, pruefungsort || null, finaleGebuehr || null, anmeldefrist || null, gurtlaenge || null, bemerkungen || null, teilnahmebedingungen || null, zahlungsart || null, autoVerrechnenValue], (insertErr, result) => {
        if (insertErr) return res.status(500).json({ error: 'Fehler beim Zulassen zur Prüfung', details: insertErr.message });

        const pruefungId = result.insertId;
        res.status(201).json({ success: true, message: 'Mitglied erfolgreich zur Prüfung zugelassen', pruefung_id: pruefungId, mitglied_id });

        // WICHTIG: Rechnung/Lastschrift werden hier NICHT mehr erstellt.
        // Sie entstehen erst, wenn das Mitglied die Teilnahme zusagt ("kommt")
        // → createRechnungBeiZusage() im /antwort-Endpoint. So wird nie vor der
        // Zusage abgebucht und bei "kommt nicht" entsteht keine Forderung.

        // Notification + Push (fire and forget)
        db.query('SELECT email, vorname, nachname FROM mitglieder WHERE mitglied_id = ? LIMIT 1', [mitglied_id], (emailErr, emailRows) => {
          if (emailErr || !emailRows[0]?.email) return;
          const { email, vorname } = emailRows[0];
          // Datum ohne Timezone-Shift
          const [y, m, d] = finalPruefungsdatum.split('-');
          const datum = `${d}.${m}.${y}`;
          const pruefungId = result.insertId;

          // 1. Zulassungs-Notification (requires_confirmation = 1 → bleibt bis Antwort)
          const subject = 'Pruefungszulassung';
          const message = `Hallo ${vorname}, du wurdest zur Guertelprüfung am ${datum} zugelassen! Kannst du kommen?`.replace(/ü/g,'ue').replace(/ö/g,'oe').replace(/ä/g,'ae').replace(/Ü/g,'Ue').replace(/Ö/g,'Oe').replace(/Ä/g,'Ae').replace(/ß/g,'ss');
          const meta = JSON.stringify({ type: 'pruefung_zulassung', pruefung_id: pruefungId, pruefungsdatum: finalPruefungsdatum, zahlungsart: zahlungsart || null });

          db.query(
            `INSERT INTO notifications (type, recipient, subject, message, status, requires_confirmation, metadata, created_at)
             VALUES ('push', ?, ?, ?, 'unread', 1, ?, NOW())`,
            [email, subject, message, meta],
            () => {}
          );

          // Hinweis: Die SEPA-Lastschrift-Zustimmung wird erst nach der Teilnahme-Zusage
          // verschickt (createRechnungBeiZusage), nicht schon bei der Zulassung.

          sendPushToMitglied(mitglied_id, subject, message, '/member/dashboard', { type: 'pruefung_zulassung' })
            .catch(() => {});
        });
      });
    });
    }); // end dupCheck
  });
});

// DELETE /kandidaten/:mitglied_id/zulassung/:pruefung_id - Zulassung widerrufen
// Ohne ?force=true: nur unbewertete (status='geplant') löschbar; bewertete → 409 (already_graded).
// Mit ?force=true: löscht auch bereits bewertete Prüfungen (Rückfrage im Frontend) + räumt
// eine evtl. vergebene Urkunde aus dem Verbandsregister mit weg.
router.delete('/:mitglied_id/zulassung/:pruefung_id', (req, res) => {
  const mitglied_id = parseInt(req.params.mitglied_id);
  const pruefung_id = parseInt(req.params.pruefung_id);
  const force = req.query.force === 'true' || req.query.force === '1';
  const secureDojoId = getSecureDojoId(req);

  const dojoCond = secureDojoId ? ' AND dojo_id = ?' : '';
  const baseParams = secureDojoId ? [pruefung_id, mitglied_id, secureDojoId] : [pruefung_id, mitglied_id];

  // 1) Prüfung laden (Status + ggf. Urkundennummer)
  db.query(
    `SELECT status, urkunde_nr FROM pruefungen WHERE pruefung_id = ? AND mitglied_id = ?${dojoCond}`,
    baseParams,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Fehler beim Widerrufen der Zulassung', details: err.message });
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Prüfung nicht gefunden' });

      const pr = rows[0];
      const istBewertet = pr.status !== 'geplant';
      if (istBewertet && !force) {
        // Frontend fragt nach und ruft mit ?force=true erneut auf
        return res.status(409).json({ error: 'Prüfung bereits bewertet', already_graded: true, status: pr.status });
      }

      // 2) Löschen (mit force auch bewertete)
      db.query(
        `DELETE FROM pruefungen WHERE pruefung_id = ? AND mitglied_id = ?${dojoCond}`,
        baseParams,
        (e2, result) => {
          if (e2) return res.status(500).json({ error: 'Fehler beim Widerrufen der Zulassung', details: e2.message });
          if (result.affectedRows === 0) return res.status(404).json({ error: 'Prüfung nicht gefunden' });
          // 3) Verwaiste Urkunde aus dem Verbandsregister entfernen (falls vergeben)
          if (pr.urkunde_nr) {
            db.query("DELETE FROM verband_urkunden WHERE urkundennummer = ?", [pr.urkunde_nr], () => {});
          }
          res.json({ success: true, message: 'Zulassung erfolgreich widerrufen', war_bewertet: istBewertet });
        }
      );
    }
  );
});

// POST /:pruefung_id/gelesen - Mitglied bestätigt Lesebestätigung der Prüfungseinladung
router.post('/:pruefung_id/gelesen', (req, res) => {
  const pruefung_id = parseInt(req.params.pruefung_id);
  if (!pruefung_id || isNaN(pruefung_id)) return res.status(400).json({ error: 'Ungültige Prüfungs-ID' });

  db.query(
    `UPDATE pruefungen SET benachrichtigung_gelesen = 1, benachrichtigung_gelesen_am = NOW()
     WHERE pruefung_id = ? AND (benachrichtigung_gelesen = 0 OR benachrichtigung_gelesen IS NULL)`,
    [pruefung_id],
    (err) => {
      if (err) return res.status(500).json({ error: 'Fehler beim Speichern der Lesebestätigung', details: err.message });
      res.json({ success: true });
    }
  );
});

// PUT /:pruefung_id/admin-status - Admin setzt Anmelde- und Bestätigungsstatus manuell
router.put('/:pruefung_id/admin-status', (req, res) => {
  const pruefung_id = parseInt(req.params.pruefung_id);
  if (!pruefung_id || isNaN(pruefung_id)) return res.status(400).json({ error: 'Ungültige Prüfungs-ID' });

  const secureDojoId = getSecureDojoId(req);
  const { mitglied_antwort, teilnahme_bestaetigt } = req.body;

  // Valide Werte prüfen
  const erlaubteAntworten = ['kommt', 'kommt_nicht', null];
  if (mitglied_antwort !== undefined && !erlaubteAntworten.includes(mitglied_antwort)) {
    return res.status(400).json({ error: 'mitglied_antwort muss kommt, kommt_nicht oder null sein' });
  }

  const felder = [];
  const werte = [];

  if (mitglied_antwort !== undefined) {
    felder.push('mitglied_antwort = ?');
    felder.push('mitglied_antwort_am = ?');
    werte.push(mitglied_antwort);
    werte.push(mitglied_antwort ? new Date() : null);
  }

  if (teilnahme_bestaetigt !== undefined) {
    felder.push('teilnahme_bestaetigt = ?');
    felder.push('teilnahme_bestaetigt_am = ?');
    werte.push(teilnahme_bestaetigt ? 1 : 0);
    werte.push(teilnahme_bestaetigt ? new Date() : null);
  }

  if (felder.length === 0) return res.status(400).json({ error: 'Keine Felder zum Aktualisieren' });

  werte.push(pruefung_id);
  let whereSql = 'WHERE pruefung_id = ?';
  if (secureDojoId) { whereSql += ' AND dojo_id = ?'; werte.push(secureDojoId); }
  db.query(
    `UPDATE pruefungen SET ${felder.join(', ')} ${whereSql}`,
    werte,
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Fehler beim Aktualisieren', details: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Prüfung nicht gefunden' });
      res.json({ success: true });
    }
  );
});

// POST /:pruefung_id/teilnahme-bestaetigen - Teilnahme bestätigen
router.post('/:pruefung_id/teilnahme-bestaetigen', (req, res) => {
  const pruefung_id = parseInt(req.params.pruefung_id);
  const { mitglied_id } = req.body;

  if (!pruefung_id || isNaN(pruefung_id)) return res.status(400).json({ error: 'Ungültige Prüfungs-ID' });
  if (!mitglied_id) return res.status(400).json({ error: 'Mitglied-ID erforderlich' });

  // 🔒 Member-Sicherheit: Token-mitglied_id muss übereinstimmen
  if (req.user?.mitglied_id && req.user.mitglied_id !== parseInt(mitglied_id)) {
    return res.status(403).json({ error: 'Keine Berechtigung für diese Prüfung' });
  }

  db.query('SELECT pruefung_id, mitglied_id, status, teilnahme_bestaetigt FROM pruefungen WHERE pruefung_id = ? AND mitglied_id = ?', [pruefung_id, mitglied_id], (checkErr, checkResults) => {
    if (checkErr) return res.status(500).json({ error: 'Fehler beim Prüfen der Prüfung', details: checkErr.message });
    if (checkResults.length === 0) return res.status(404).json({ error: 'Prüfung nicht gefunden' });

    const pruefung = checkResults[0];
    if (pruefung.status !== 'geplant') return res.status(400).json({ error: 'Prüfung ist nicht im Status "geplant"' });
    if (pruefung.teilnahme_bestaetigt) return res.status(400).json({ error: 'Teilnahme wurde bereits bestätigt' });

    db.query('UPDATE pruefungen SET teilnahme_bestaetigt = TRUE, teilnahme_bestaetigt_am = NOW(), aktualisiert_am = NOW() WHERE pruefung_id = ?', [pruefung_id], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: 'Fehler beim Bestätigen der Teilnahme', details: updateErr.message });
      res.json({ success: true, message: 'Teilnahme erfolgreich bestätigt', pruefung_id, teilnahme_bestaetigt_am: new Date() });
    });
  });
});

// POST /kandidaten/antwort - Mitglied antwortet auf Prüfungszulassung
router.post('/antwort', (req, res) => {
  const { pruefung_id, antwort, notification_id, alternative_termine } = req.body;
  if (!pruefung_id || !['kommt', 'kommt_nicht'].includes(antwort)) {
    return res.status(400).json({ error: 'pruefung_id und antwort (kommt/kommt_nicht) erforderlich.' });
  }

  const alternativeJson = (antwort === 'kommt_nicht' && Array.isArray(alternative_termine) && alternative_termine.length > 0)
    ? JSON.stringify(alternative_termine)
    : null;

  const secureDojoId = getSecureDojoId(req);
  const antwortParams = [antwort, alternativeJson, pruefung_id];
  let antwortWhere = 'WHERE pruefung_id = ?';
  if (secureDojoId) { antwortWhere += ' AND dojo_id = ?'; antwortParams.push(secureDojoId); }

  db.query(
    `UPDATE pruefungen SET mitglied_antwort = ?, mitglied_antwort_am = NOW(), alternative_termine = ? ${antwortWhere}`,
    antwortParams,
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Fehler beim Speichern der Antwort.' });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Prüfung nicht gefunden' });

      // Notification als confirmed markieren
      if (notification_id) {
        db.query(
          "UPDATE notifications SET status = 'read', confirmed_at = NOW() WHERE id = ?",
          [notification_id], () => {}
        );
      }

      // Erst bei Zusage ("kommt") Rechnung/Lastschrift erstellen — vorher wird nichts abgebucht.
      if (antwort === 'kommt') {
        createRechnungBeiZusage(pruefung_id).catch(e =>
          logger.error('Fehler beim Erstellen der Prüfungsrechnung bei Zusage:', { error: e.message, pruefung_id })
        );
      }

      res.json({ success: true });
    }
  );
});

// PUT /kandidaten/:pruefung_id/gebuehr-bar - Gebühr als Bar-Zahlung markieren
router.put('/:pruefung_id/gebuehr-bar', async (req, res) => {
  const pruefung_id = parseInt(req.params.pruefung_id);
  if (!pruefung_id || isNaN(pruefung_id)) return res.status(400).json({ error: 'Ungültige Prüfungs-ID' });

  const secureDojoId = getSecureDojoId(req);
  try {
    const pool = db.promise();
    const ownerCheck = secureDojoId
      ? 'SELECT pruefung_id FROM pruefungen WHERE pruefung_id = ? AND dojo_id = ?'
      : 'SELECT pruefung_id FROM pruefungen WHERE pruefung_id = ?';
    const ownerParams = secureDojoId ? [pruefung_id, secureDojoId] : [pruefung_id];
    const [[pruefung]] = await pool.query(ownerCheck, ownerParams);
    if (!pruefung) return res.status(404).json({ error: 'Prüfung nicht gefunden' });

    // Verknüpfte Rechnung + Beitrag vor dem Nullsetzen holen
    const [[pruefungMitRechnung]] = await pool.query(
      'SELECT gebuehr_rechnung_id FROM pruefungen WHERE pruefung_id = ?', [pruefung_id]
    );
    const rechnungId = pruefungMitRechnung?.gebuehr_rechnung_id;

    await pool.query(
      `UPDATE pruefungen SET zahlungsart = 'bar', gebuehr_bezahlt = 1, gebuehr_bezahlt_am = CURDATE(),
       gebuehr_auto_verrechnen = 0, gebuehr_rechnung_id = NULL WHERE pruefung_id = ?`,
      [pruefung_id]
    );

    // Verknüpfte Rechnung + Beitrag als bezahlt markieren
    if (rechnungId) {
      await pool.query(
        `UPDATE rechnungen SET status = 'bezahlt', bezahlt_am = CURDATE(), zahlungsart = 'Bar' WHERE rechnung_id = ?`,
        [rechnungId]
      );
      await pool.query(
        `UPDATE beitraege SET bezahlt = 1, bezahlt_am = NOW(), zahlungsart = 'Bar' WHERE rechnung_id = ?`,
        [rechnungId]
      );
      logger.info('Verknüpfte Rechnung + Beitrag als bar bezahlt markiert', { pruefung_id, rechnungId });
    }

    logger.info('Prüfungsgebühr bar bezahlt', { pruefung_id });
    res.json({ success: true, zahlungsart: 'bar', gebuehr_bezahlt: 1 });
  } catch (err) {
    logger.error('Fehler bei Bar-Zahlung:', { error: err.message });
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PUT /kandidaten/:pruefung_id/gebuehr-null - Gebühr auf 0 setzen (kostenlos)
router.put('/:pruefung_id/gebuehr-null', async (req, res) => {
  const pruefung_id = parseInt(req.params.pruefung_id);
  if (!pruefung_id || isNaN(pruefung_id)) return res.status(400).json({ error: 'Ungültige Prüfungs-ID' });

  const secureDojoId = getSecureDojoId(req);
  try {
    const pool = db.promise();

    // Zugriff prüfen + bestehende Rechnung holen
    const ownerCheck = secureDojoId
      ? 'SELECT pruefung_id, gebuehr_rechnung_id FROM pruefungen WHERE pruefung_id = ? AND dojo_id = ?'
      : 'SELECT pruefung_id, gebuehr_rechnung_id FROM pruefungen WHERE pruefung_id = ?';
    const ownerParams = secureDojoId ? [pruefung_id, secureDojoId] : [pruefung_id];
    const [[pruefung]] = await pool.query(ownerCheck, ownerParams);
    if (!pruefung) return res.status(404).json({ error: 'Prüfung nicht gefunden' });

    // Gebühr auf 0 setzen, als bezahlt markieren, Auto-Verrechnung deaktivieren
    await pool.query(
      `UPDATE pruefungen
       SET pruefungsgebuehr = 0, gebuehr_bezahlt = 1, gebuehr_bezahlt_am = CURDATE(),
           gebuehr_auto_verrechnen = 0, zahlungsart = 'kostenlos', gebuehr_rechnung_id = NULL
       WHERE pruefung_id = ?`,
      [pruefung_id]
    );

    // Eventuell bereits erstellte Rechnung stornieren
    if (pruefung.gebuehr_rechnung_id) {
      await pool.query(
        `UPDATE rechnungen SET status = 'storniert', storno_grund = 'Gebühr erlassen', storniert_am = NOW()
         WHERE rechnung_id = ?`,
        [pruefung.gebuehr_rechnung_id]
      );
    }

    logger.info('Prüfungsgebühr auf 0 gesetzt (kostenlos)', { pruefung_id });
    res.json({ success: true });
  } catch (err) {
    logger.error('Fehler bei Gebühr-Null:', { error: err.message });
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PUT /kandidaten/:pruefung_id/gebuehr-auto - Individuelle Gebühren-Einstellung überschreiben
router.put('/:pruefung_id/gebuehr-auto', async (req, res) => {
  const pruefung_id = parseInt(req.params.pruefung_id);
  if (!pruefung_id || isNaN(pruefung_id)) return res.status(400).json({ error: 'Ungültige Prüfungs-ID' });

  const secureDojoId = getSecureDojoId(req);
  const { gebuehr_auto_verrechnen } = req.body;

  // null = Termin-Einstellung übernehmen, 1 = erzwingen, 0 = unterdrücken
  const wert = gebuehr_auto_verrechnen === null ? null
             : (gebuehr_auto_verrechnen ? 1 : 0);

  try {
    const pool = db.promise();
    const ownerCheck = secureDojoId
      ? 'SELECT pruefung_id, mitglied_id, pruefungsgebuehr, dojo_id, status, zahlungsart, gebuehr_rechnung_id FROM pruefungen WHERE pruefung_id = ? AND dojo_id = ?'
      : 'SELECT pruefung_id, mitglied_id, pruefungsgebuehr, dojo_id, status, zahlungsart, gebuehr_rechnung_id FROM pruefungen WHERE pruefung_id = ?';
    const ownerParams = secureDojoId ? [pruefung_id, secureDojoId] : [pruefung_id];
    const [[pruefung]] = await pool.query(ownerCheck, ownerParams);

    if (!pruefung) return res.status(404).json({ error: 'Prüfung nicht gefunden oder kein Zugriff' });

    await pool.query('UPDATE pruefungen SET gebuehr_auto_verrechnen = ? WHERE pruefung_id = ?', [wert, pruefung_id]);

    // Wenn jetzt aktiviert + noch keine Rechnung + Gebühr vorhanden → auto erstellen
    if (wert === 1 && pruefung.pruefungsgebuehr && parseFloat(pruefung.pruefungsgebuehr) > 0 && pruefung.status === 'geplant') {
      if (!pruefung.gebuehr_rechnung_id) {
        const [[stilRow]] = await pool.query(
          `SELECT s.name FROM stile s JOIN pruefungen p ON p.stil_id = s.stil_id WHERE p.pruefung_id = ? LIMIT 1`, [pruefung_id]
        );
        const [[{ pruefungsdatum }]] = await pool.query('SELECT pruefungsdatum FROM pruefungen WHERE pruefung_id = ?', [pruefung_id]);
        const zahlungsartFuerRechnung = pruefung.zahlungsart || 'lastschrift';
        const rechnungId = await createPruefungsRechnung(pruefung.mitglied_id, pruefung.pruefungsgebuehr, pruefungsdatum, stilRow?.name || '', pruefung.dojo_id, zahlungsartFuerRechnung);
        await pool.query('UPDATE pruefungen SET gebuehr_rechnung_id = ? WHERE pruefung_id = ?', [rechnungId, pruefung_id]);
        logger.info('Auto-Rechnung (manuell aktiviert) erstellt', { pruefung_id, rechnungId });
        return res.json({ success: true, gebuehr_auto_verrechnen: wert, rechnung_erstellt: true, rechnung_id: rechnungId });
      }
    }

    res.json({ success: true, gebuehr_auto_verrechnen: wert });
  } catch (err) {
    logger.error('Fehler beim Setzen der Gebühren-Einstellung:', { error: err.message });
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /kandidaten/erinnerung-ohne-antwort
// Sendet E-Mail + Push an alle Kandidaten eines Termins die noch nicht geantwortet haben
router.post('/erinnerung-ohne-antwort', async (req, res) => {
  const { datum, stil_id } = req.body;
  if (!datum || !stil_id) {
    return res.status(400).json({ error: 'datum und stil_id sind erforderlich.' });
  }

  const secureDojoId = getSecureDojoId(req);

  try {
    const pool = db.promise();

    // Alle geplanten Kandidaten ohne Antwort für diesen Termin laden
    let query = `
      SELECT p.pruefung_id, p.mitglied_id, p.pruefungsdatum, p.pruefungszeit, p.pruefungsort,
             m.email, m.vorname, m.nachname, m.dojo_id,
             g_vor.name AS graduierung_vorher, g_nach.name AS graduierung_nachher,
             s.name AS stil_name
      FROM pruefungen p
      JOIN mitglieder m ON p.mitglied_id = m.mitglied_id
      LEFT JOIN graduierungen g_vor ON p.graduierung_vorher_id = g_vor.graduierung_id
      LEFT JOIN graduierungen g_nach ON p.graduierung_nachher_id = g_nach.graduierung_id
      LEFT JOIN stile s ON p.stil_id = s.stil_id
      WHERE DATE(p.pruefungsdatum) = ?
        AND p.stil_id = ?
        AND p.status = 'geplant'
        AND p.mitglied_antwort IS NULL
        AND p.mitglied_id IS NOT NULL
    `;
    const params = [datum, stil_id];
    if (secureDojoId) {
      query += ' AND p.dojo_id = ?';
      params.push(secureDojoId);
    }

    const [kandidaten] = await pool.query(query, params);

    if (kandidaten.length === 0) {
      return res.json({ success: true, count: 0, message: 'Alle Kandidaten haben bereits geantwortet.' });
    }

    const [d, m2, y] = (() => {
      const parts = datum.split('-');
      return [parts[2], parts[1], parts[0]];
    })();
    const datumFormatiert = `${d}.${m2}.${y}`;

    let gesendet = 0;
    const ergebnisse = [];

    for (const kandidat of kandidaten) {
      const dojoId = kandidat.dojo_id;
      const wochentage = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
      const datObj = new Date(kandidat.pruefungsdatum);
      const wochentag = wochentage[datObj.getDay()];

      const pushTitle = `⏰ Erinnerung: Prüfung am ${wochentag}, ${datumFormatiert}`;
      const pushBody  = `Hallo ${kandidat.vorname}, bitte antworte ob du zur Gürtelprüfung (${kandidat.graduierung_nachher || kandidat.stil_name}) kommen kannst. Noch keine Antwort vorhanden!`;

      // Push-Notification
      sendPushToMitglied(kandidat.mitglied_id, pushTitle, pushBody, '/member/dashboard', {
        type: 'pruefung_erinnerung',
        pruefung_id: kandidat.pruefung_id
      }).catch(() => {});

      // Notification in DB speichern
      const meta = JSON.stringify({ type: 'pruefung_erinnerung', pruefung_id: kandidat.pruefung_id, pruefungsdatum: datum });
      pool.query(
        `INSERT INTO notifications (type, recipient, subject, message, status, requires_confirmation, metadata, created_at)
         VALUES ('push', ?, ?, ?, 'unread', 1, ?, NOW())`,
        [kandidat.email, 'Prüfungs-Erinnerung', pushBody, meta]
      ).catch(() => {});

      // E-Mail senden
      if (kandidat.email) {
        const zeitInfo = kandidat.pruefungszeit ? ` um ${kandidat.pruefungszeit} Uhr` : '';
        const ortInfo  = kandidat.pruefungsort  ? `<br><strong>Ort:</strong> ${kandidat.pruefungsort}` : '';

        const emailHtml = `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
            <div style="background:#1a1a1a;padding:24px 32px;border-radius:8px 8px 0 0;">
              <h2 style="color:#c9a227;margin:0;font-size:20px;">⏰ Erinnerung: Prüfungsanmeldung</h2>
            </div>
            <div style="background:#f9f7f3;padding:28px 32px;border-radius:0 0 8px 8px;border:1px solid #e5e0d8;border-top:none;">
              <p style="margin-top:0;">Hallo <strong>${kandidat.vorname}</strong>,</p>
              <p>du wurdest zur <strong>Gürtelprüfung</strong> zugelassen, aber wir haben noch keine Rückmeldung von dir erhalten.</p>
              <div style="background:#fff;border:1px solid #e5e0d8;border-left:4px solid #c9a227;border-radius:4px;padding:16px 20px;margin:20px 0;">
                <p style="margin:0 0 6px 0;"><strong>Prüfungsdatum:</strong> ${wochentag}, ${datumFormatiert}${zeitInfo}</p>
                <p style="margin:0 0 6px 0;"><strong>Stil:</strong> ${kandidat.stil_name || '–'}</p>
                ${kandidat.graduierung_nachher ? `<p style="margin:0 0 6px 0;"><strong>Prüfung zum:</strong> ${kandidat.graduierung_nachher}</p>` : ''}
                ${ortInfo}
              </div>
              <p><strong>Bitte melde dich an oder teile mit, ob du zur Prüfung kommen kannst.</strong><br>
              Du kannst direkt in der Mitglieder-App antworten.</p>
              <p style="font-size:13px;color:#666;margin-bottom:0;">Kampfkunstschule Schreiner</p>
            </div>
          </div>
        `;
        const emailText = `Hallo ${kandidat.vorname},\n\nErinnerung: Du wurdest zur Gürtelprüfung am ${wochentag}, ${datumFormatiert}${zeitInfo} zugelassen.\nBitte antworte ob du kommen kannst.\n\nKampfkunstschule Schreiner`;

        sendEmailForDojo({
          to:      kandidat.email,
          subject: `Erinnerung: Prüfung am ${datumFormatiert} — Bitte antworte`,
          text:    emailText,
          html:    emailHtml,
        }, dojoId).catch(() => {});
      }

      // Erinnerungs-Timestamp auf der Prüfung setzen (Audit-Trail)
      pool.query(
        `UPDATE pruefungen
         SET erinnerung_gesendet_am = NOW(),
             erinnerung_anzahl = erinnerung_anzahl + 1
         WHERE pruefung_id = ?`,
        [kandidat.pruefung_id]
      ).catch(() => {});

      gesendet++;
      ergebnisse.push({ vorname: kandidat.vorname, nachname: kandidat.nachname, email: kandidat.email });
    }

    logger.info('Prüfungs-Erinnerungen gesendet', { datum, stil_id, gesendet });
    res.json({ success: true, count: gesendet, empfaenger: ergebnisse });

  } catch (err) {
    logger.error('Fehler beim Senden der Prüfungs-Erinnerungen:', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Senden der Erinnerungen.', details: err.message });
  }
});

// POST /kandidaten/lastschrift-zustimmung - Mitglied stimmt Lastschrift zu/ab
router.post('/lastschrift-zustimmung', (req, res) => {
  const { pruefung_id, zugestimmt, notification_id } = req.body;
  if (!pruefung_id || zugestimmt === undefined) {
    return res.status(400).json({ error: 'pruefung_id und zugestimmt erforderlich.' });
  }
  const secureDojoId = getSecureDojoId(req);
  const lsParams = [zugestimmt ? 1 : 0, pruefung_id];
  let lsWhere = 'WHERE pruefung_id = ?';
  if (secureDojoId) { lsWhere += ' AND dojo_id = ?'; lsParams.push(secureDojoId); }
  db.query(
    `UPDATE pruefungen SET lastschrift_zugestimmt = ?, lastschrift_zugestimmt_am = NOW() ${lsWhere}`,
    lsParams,
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Fehler beim Speichern.' });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Prüfung nicht gefunden' });
      if (notification_id) {
        db.query(
          "UPDATE notifications SET status = 'read', confirmed_at = NOW() WHERE id = ?",
          [notification_id], () => {}
        );
      }
      res.json({ success: true });
    }
  );
});

module.exports = router;
