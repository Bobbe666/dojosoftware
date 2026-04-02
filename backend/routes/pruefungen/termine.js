/**
 * Pruefungen Termine Routes
 * Prüfungstermin-Verwaltung
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();
const { formatDate } = require('./shared');
const { sendToTdaEvents } = require('../../utils/tdaSync');
const { getSecureDojoId } = require('../../utils/dojo-filter-helper');
const webpush = require('web-push');

// Promise-Wrapper für db.query
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

// Hilfsfunktion: Push-Trainingsausfall an alle Mitglieder des Dojos senden
async function sendTrainingsausfallPush(dojoId, datum, trainingName) {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL || 'mailto:admin@dojo.tda-intl.org',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }
  const pool = db.promise();
  const datumFormatiert = new Date(datum).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
  const payload = JSON.stringify({
    title: '⚠️ Training entfällt',
    body: `${trainingName ? trainingName + ' am ' : 'Training am '}${datumFormatiert} entfällt wegen Gürtelprüfung.`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: { url: '/member/dashboard' }
  });

  try {
    const [subs] = await pool.query(
      `SELECT ps.endpoint, ps.p256dh_key, ps.auth_key
       FROM push_subscriptions ps
       JOIN mitglieder m ON ps.user_id = m.mitglied_id
       WHERE m.dojo_id = ? AND m.status = 'aktiv' AND ps.is_active = TRUE`,
      [dojoId]
    );
    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
          payload
        );
        sent++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await pool.query('UPDATE push_subscriptions SET is_active = FALSE WHERE endpoint = ?', [sub.endpoint]);
        }
      }
    }
    logger.info(`[Trainingsausfall-Push] ${sent} Benachrichtigungen gesendet für Dojo ${dojoId}`);
  } catch (err) {
    logger.error('[Trainingsausfall-Push] Fehler', { error: err.message });
  }
}

// POST /termine - Erstellt einen Prüfungstermin
router.post('/', (req, res) => {
  const { datum, zeit, ort, pruefer_name, stil_id, pruefungsgebuehr, anmeldefrist, bemerkungen, teilnahmebedingungen, oeffentlich, oeffentlich_vib, send_trainingsausfall_push, trainingsausfall_kurs_name } = req.body;

  // Dojo-ID IMMER aus Token, nie aus Body (Sicherheit)
  const secureDojoId = getSecureDojoId(req);
  const dojo_id = secureDojoId || parseInt(req.body.dojo_id);

  if (!datum || !stil_id || !dojo_id) {
    return res.status(400).json({ error: 'Fehlende erforderliche Felder', required: ['datum', 'stil_id', 'dojo_id'] });
  }

  const zeitValue = zeit || '10:00';

  const checkOverlapQuery = `
    SELECT termin_id, pruefungsort, pruefer_name, stil_id
    FROM pruefungstermin_vorlagen
    WHERE pruefungsdatum = ? AND pruefungszeit = ? AND dojo_id = ?
  `;

  db.query(checkOverlapQuery, [datum, zeitValue, dojo_id], (err, overlaps) => {
    if (err) {
      logger.error('Fehler beim Prüfen auf Überschneidungen:', { error: err });
      return res.status(500).json({ error: 'Fehler beim Prüfen auf Überschneidungen', details: err.message });
    }

    if (overlaps && overlaps.length > 0) {
      for (const overlap of overlaps) {
        const sameRoom = (overlap.pruefungsort || '') === (ort || '');
        const sameExaminer = (overlap.pruefer_name || '') === (pruefer_name || '');
        if (sameRoom || sameExaminer) {
          return res.status(409).json({
            error: 'Überschneidung nicht erlaubt',
            message: 'Zu diesem Zeitpunkt existiert bereits eine Prüfung.',
            conflict: { datum, zeit: zeitValue, bestehendeRaeume: overlaps.map(o => o.pruefungsort).filter(Boolean), bestehendePruefer: overlaps.map(o => o.pruefer_name).filter(Boolean) }
          });
        }
      }
    }

    const insertQuery = `
      INSERT INTO pruefungstermin_vorlagen (pruefungsdatum, pruefungszeit, pruefungsort, pruefer_name, stil_id, pruefungsgebuehr, anmeldefrist, bemerkungen, teilnahmebedingungen, oeffentlich, oeffentlich_vib, dojo_id, erstellt_am)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    db.query(insertQuery, [datum, zeitValue, ort || null, pruefer_name || null, stil_id, pruefungsgebuehr || null, anmeldefrist || null, bemerkungen || null, teilnahmebedingungen || null, oeffentlich ? 1 : 0, oeffentlich_vib ? 1 : 0, dojo_id], (err, result) => {
      if (err) {
        logger.error('Fehler beim Erstellen des Prüfungstermins:', { error: err });
        return res.status(500).json({ error: 'Fehler beim Erstellen des Termins', details: err.message });
      }

      const terminId = result.insertId;
      res.status(201).json({ success: true, message: 'Prüfungstermin erfolgreich erstellt', termin_id: terminId });

      // Optionaler Push: Training entfällt wegen Prüfung
      if (send_trainingsausfall_push && dojo_id) {
        sendTrainingsausfallPush(dojo_id, datum, trainingsausfall_kurs_name || '').catch(() => {});
      }

      if (oeffentlich) {
        queryAsync('SELECT * FROM pruefungstermin_vorlagen WHERE termin_id = ?', [terminId])
          .then(rows => rows.length && sendToTdaEvents('pruefung', 'upsert', rows[0]))
          .catch(e => logger.error('[TDA Sync] Auto-sync (POST) Fehler:', e.message));
      }

      // Auto-Sync: Prüfungstermin → Events-Kalender
      (async () => {
        try {
          const stilRows = await queryAsync('SELECT name FROM stile WHERE stil_id = ? LIMIT 1', [stil_id]);
          const stilName = stilRows.length ? stilRows[0].name : '';
          const eventTitel = stilName ? `Gürtelprüfung ${stilName}` : 'Gürtelprüfung';

          const eventResult = await queryAsync(
            `INSERT INTO events (titel, event_typ, datum, uhrzeit_beginn, ort, teilnahmegebuehr, anmeldefrist, status, dojo_id)
             VALUES (?, 'Prüfung', ?, ?, ?, ?, ?, 'geplant', ?)`,
            [eventTitel, datum, zeitValue, ort || null, pruefungsgebuehr || null, anmeldefrist || null, dojo_id]
          );

          await queryAsync(
            'UPDATE pruefungstermin_vorlagen SET event_id = ? WHERE termin_id = ?',
            [eventResult.insertId, terminId]
          );

          logger.debug(`[Events Sync] Event für Prüfungstermin #${terminId} erstellt (event_id=${eventResult.insertId})`);
        } catch (e) {
          logger.error('[Events Sync] Fehler beim Erstellen des Events für Prüfungstermin:', e.message);
        }
      })();
    });
  });
});

// GET /termine - Lädt alle Prüfungstermine (mit Tenant-Isolation)
router.get('/', (req, res) => {
  const { dojo_ids, stil_id } = req.query;
  const secureDojoId = getSecureDojoId(req);

  let whereConditions = [];
  let queryParams = [];

  if (secureDojoId) {
    // Normaler Admin / eingeschränkter User: IMMER nur eigenes Dojo
    whereConditions.push('pt.dojo_id = ?');
    queryParams.push(secureDojoId);
  } else {
    // Super-Admin: optionale Filterung über Query-Parameter
    if (dojo_ids) {
      const ids = dojo_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (ids.length > 0) {
        whereConditions.push(`pt.dojo_id IN (${ids.map(() => '?').join(',')})`);
        queryParams.push(...ids);
      }
    } else if (req.query.dojo_id && req.query.dojo_id !== 'all') {
      whereConditions.push('pt.dojo_id = ?');
      queryParams.push(parseInt(req.query.dojo_id));
    } else {
      // Kein Filter: nur verwaltete Dojos (ohne eigene Admins)
      whereConditions.push(`pt.dojo_id NOT IN (SELECT DISTINCT dojo_id FROM admin_users WHERE dojo_id IS NOT NULL AND rolle NOT IN ('eingeschraenkt', 'trainer', 'checkin'))`);
    }
  }

  if (stil_id && stil_id !== 'all') {
    whereConditions.push('pt.stil_id = ?');
    queryParams.push(parseInt(stil_id));
  }

  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

  const query = `
    SELECT pt.*, s.name as stil_name
    FROM pruefungstermin_vorlagen pt
    INNER JOIN stile s ON pt.stil_id = s.stil_id
    ${whereClause}
    ORDER BY
      CASE WHEN pt.pruefungsdatum >= CURDATE() THEN 0 ELSE 1 END ASC,
      CASE WHEN pt.pruefungsdatum >= CURDATE() THEN DATEDIFF(pt.pruefungsdatum, CURDATE()) ELSE DATEDIFF(CURDATE(), pt.pruefungsdatum) END ASC
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Prüfungstermine:', { error: err });
      return res.status(500).json({ error: 'Fehler beim Laden der Termine', details: err.message });
    }

    const formattedResults = results.map(termin => ({
      ...termin,
      pruefungsdatum: formatDate(termin.pruefungsdatum),
      anmeldefrist: formatDate(termin.anmeldefrist)
    }));

    res.json({ success: true, count: formattedResults.length, termine: formattedResults });
  });
});

// PUT /termine/:id - Aktualisiert einen Prüfungstermin
router.put('/:id', (req, res) => {
  const termin_id = parseInt(req.params.id);
  if (!termin_id || isNaN(termin_id)) return res.status(400).json({ error: 'Ungültige Termin-ID' });

  const secureDojoId = getSecureDojoId(req);
  const { datum, zeit, ort, pruefer_name, stil_id, pruefungsgebuehr, anmeldefrist, bemerkungen, teilnahmebedingungen, oeffentlich, oeffentlich_vib } = req.body;
  if (!datum || !stil_id) return res.status(400).json({ error: 'Fehlende erforderliche Felder', required: ['datum', 'stil_id'] });

  // Ownership-Check: Termin muss zum eigenen Dojo gehören
  const ownerCheck = secureDojoId
    ? 'SELECT termin_id FROM pruefungstermin_vorlagen WHERE termin_id = ? AND dojo_id = ?'
    : 'SELECT termin_id FROM pruefungstermin_vorlagen WHERE termin_id = ?';
  const ownerParams = secureDojoId ? [termin_id, secureDojoId] : [termin_id];

  db.query(ownerCheck, ownerParams, (checkErr, checkRows) => {
    if (checkErr) return res.status(500).json({ error: 'Fehler beim Prüfen des Termins' });
    if (checkRows.length === 0) return res.status(404).json({ error: 'Termin nicht gefunden oder kein Zugriff' });

    const updateQuery = `
      UPDATE pruefungstermin_vorlagen SET pruefungsdatum = ?, pruefungszeit = ?, pruefungsort = ?, pruefer_name = ?,
        stil_id = ?, pruefungsgebuehr = ?, anmeldefrist = ?, bemerkungen = ?, teilnahmebedingungen = ?, oeffentlich = ?, oeffentlich_vib = ?
      WHERE termin_id = ?
    `;

    db.query(updateQuery, [datum, zeit || '10:00', ort || null, pruefer_name || null, stil_id, pruefungsgebuehr || null, anmeldefrist || null, bemerkungen || null, teilnahmebedingungen || null, oeffentlich ? 1 : 0, oeffentlich_vib ? 1 : 0, termin_id], (err, result) => {
      if (err) {
        logger.error('Fehler beim Aktualisieren des Termins:', { error: err });
        return res.status(500).json({ error: 'Fehler beim Aktualisieren', details: err.message });
      }
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Termin nicht gefunden' });
      res.json({ success: true, message: 'Termin erfolgreich aktualisiert' });

      if (oeffentlich) {
        queryAsync('SELECT * FROM pruefungstermin_vorlagen WHERE termin_id = ?', [termin_id])
          .then(rows => rows.length && sendToTdaEvents('pruefung', 'upsert', rows[0]))
          .catch(e => logger.error('[TDA Sync] Auto-sync (PUT) Fehler:', e.message));
      } else {
        sendToTdaEvents('pruefung', 'delete', { id: termin_id });
      }

      // Auto-Sync: Verknüpftes Event aktualisieren
      (async () => {
        try {
          const terminRows = await queryAsync('SELECT event_id FROM pruefungstermin_vorlagen WHERE termin_id = ?', [termin_id]);
          if (!terminRows.length || !terminRows[0].event_id) return;

          const stilRows = await queryAsync('SELECT name FROM stile WHERE stil_id = ? LIMIT 1', [stil_id]);
          const stilName = stilRows.length ? stilRows[0].name : '';
          const eventTitel = stilName ? `Gürtelprüfung ${stilName}` : 'Gürtelprüfung';

          await queryAsync(
            'UPDATE events SET titel=?, datum=?, uhrzeit_beginn=?, ort=?, teilnahmegebuehr=?, anmeldefrist=? WHERE event_id=?',
            [eventTitel, datum, zeit || '10:00', ort || null, pruefungsgebuehr || null, anmeldefrist || null, terminRows[0].event_id]
          );

          logger.debug(`[Events Sync] Event für Prüfungstermin #${termin_id} aktualisiert`);
        } catch (e) {
          logger.error('[Events Sync] Fehler beim Aktualisieren des Events für Prüfungstermin:', e.message);
        }
      })();
    });
  });
});

// DELETE /termine/:id - Löscht einen Prüfungstermin
router.delete('/:id', (req, res) => {
  const termin_id = parseInt(req.params.id);
  if (!termin_id || isNaN(termin_id)) return res.status(400).json({ error: 'Ungültige Termin-ID' });

  const secureDojoId = getSecureDojoId(req);
  const ownerCheck = secureDojoId
    ? 'SELECT termin_id FROM pruefungstermin_vorlagen WHERE termin_id = ? AND dojo_id = ?'
    : 'SELECT termin_id FROM pruefungstermin_vorlagen WHERE termin_id = ?';
  const ownerParams = secureDojoId ? [termin_id, secureDojoId] : [termin_id];

  db.query(ownerCheck, ownerParams, (checkErr, checkRows) => {
    if (checkErr) return res.status(500).json({ error: 'Fehler beim Prüfen des Termins' });
    if (checkRows.length === 0) return res.status(404).json({ error: 'Termin nicht gefunden oder kein Zugriff' });

    // event_id VOR dem Löschen holen
    db.query('SELECT event_id FROM pruefungstermin_vorlagen WHERE termin_id = ?', [termin_id], (getErr, getRows) => {
      const linkedEventId = getRows && getRows.length ? getRows[0].event_id : null;

      db.query('DELETE FROM pruefungstermin_vorlagen WHERE termin_id = ?', [termin_id], (err, result) => {
        if (err) {
          logger.error('Fehler beim Löschen des Termins:', { error: err });
          return res.status(500).json({ error: 'Fehler beim Löschen', details: err.message });
        }
        res.json({ success: true, message: 'Termin erfolgreich gelöscht' });
        sendToTdaEvents('pruefung', 'delete', { id: termin_id });

        // Auto-Sync: Verknüpftes Event löschen
        if (linkedEventId) {
          queryAsync('DELETE FROM events WHERE event_id = ?', [linkedEventId])
            .then(() => logger.debug(`[Events Sync] Event #${linkedEventId} für Prüfungstermin #${termin_id} gelöscht`))
            .catch(e => logger.error('[Events Sync] Fehler beim Löschen des Events:', e.message));
        }
      });
    });
  });
});

// GET /termine/:id/anmeldungen - Lädt externe Anmeldungen für einen Termin
router.get('/:id/anmeldungen', async (req, res) => {
  const termin_id = parseInt(req.params.id);
  if (!termin_id || isNaN(termin_id)) {
    return res.status(400).json({ error: 'Ungültige Termin-ID' });
  }

  try {
    const anmeldungen = await queryAsync(`
      SELECT pa.id, pa.vorname, pa.nachname, pa.email, pa.telefon, pa.verein,
             pa.aktueller_gurt, pa.angestrebter_gurt, pa.bemerkungen, pa.status, pa.erstellt_am,
             COALESCE(pa.stil_id, ptv.stil_id) AS stil_id,
             s.name AS stil_name,
             ptv.pruefungsdatum AS termin_datum,
             p.pruefung_id,
             p.graduierung_nachher_id,
             g.name AS graduierung_nachher_name,
             g.farbe_hex AS farbe_nachher,
             p.bestanden,
             p.punktzahl,
             p.max_punktzahl,
             p.prueferkommentar
      FROM pruefungs_anmeldungen pa
      LEFT JOIN pruefungstermin_vorlagen ptv ON ptv.termin_id = pa.termin_id
      LEFT JOIN stile s ON COALESCE(pa.stil_id, ptv.stil_id) = s.stil_id
      LEFT JOIN pruefungen p ON p.is_extern = 1
        AND p.extern_vorname = pa.vorname
        AND p.extern_nachname = pa.nachname
        AND DATE(p.pruefungsdatum) = DATE(ptv.pruefungsdatum)
      LEFT JOIN graduierungen g ON g.graduierung_id = p.graduierung_nachher_id
      WHERE pa.termin_id = ?
      ORDER BY pa.erstellt_am DESC
    `, [termin_id]);

    res.json({ success: true, count: anmeldungen.length, anmeldungen });
  } catch (error) {
    logger.error('Fehler beim Laden der externen Anmeldungen', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Laden der Anmeldungen', details: error.message });
  }
});

// PUT /termine/:terminId/anmeldungen/:id - Externe Anmeldung bearbeiten
router.put('/:terminId/anmeldungen/:id', async (req, res) => {
  const termin_id = parseInt(req.params.terminId);
  const anmeldung_id = parseInt(req.params.id);
  const { vorname, nachname, email, telefon, verein, stil_id, aktueller_gurt, angestrebter_gurt, status } = req.body;

  if (!anmeldung_id || isNaN(anmeldung_id)) {
    return res.status(400).json({ error: 'Ungültige Anmeldungs-ID' });
  }

  try {
    const fields = [];
    const values = [];

    if (vorname !== undefined)          { fields.push('vorname = ?');          values.push(vorname); }
    if (nachname !== undefined)         { fields.push('nachname = ?');         values.push(nachname); }
    if (email !== undefined)            { fields.push('email = ?');            values.push(email); }
    if (telefon !== undefined)          { fields.push('telefon = ?');          values.push(telefon || null); }
    if (verein !== undefined)           { fields.push('verein = ?');           values.push(verein || null); }
    if (stil_id !== undefined)          { fields.push('stil_id = ?');          values.push(stil_id ? parseInt(stil_id) : null); }
    if (aktueller_gurt !== undefined)   { fields.push('aktueller_gurt = ?');   values.push(aktueller_gurt || null); }
    if (angestrebter_gurt !== undefined){ fields.push('angestrebter_gurt = ?');values.push(angestrebter_gurt || null); }
    if (status !== undefined)           { fields.push('status = ?');           values.push(status); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Keine Felder zum Aktualisieren' });
    }

    values.push(anmeldung_id, termin_id);
    await queryAsync(
      `UPDATE pruefungs_anmeldungen SET ${fields.join(', ')} WHERE id = ? AND termin_id = ?`,
      values
    );

    // Wenn pruefungen-Datensatz existiert: graduierung_nachher_id aktualisieren
    if (angestrebter_gurt && stil_id) {
      const grads = await queryAsync(
        'SELECT graduierung_id FROM graduierungen WHERE stil_id = ? AND name = ? AND aktiv = 1 LIMIT 1',
        [parseInt(stil_id), angestrebter_gurt]
      );
      if (grads.length > 0) {
        const ptv = await queryAsync(
          'SELECT pruefungsdatum FROM pruefungstermin_vorlagen WHERE termin_id = ? LIMIT 1',
          [termin_id]
        );
        if (ptv.length > 0) {
          await queryAsync(
            `UPDATE pruefungen SET graduierung_nachher_id = ? WHERE is_extern = 1
             AND extern_vorname = ? AND extern_nachname = ?
             AND DATE(pruefungsdatum) = DATE(?)`,
            [grads[0].graduierung_id, vorname || req.body.vorname_orig, nachname || req.body.nachname_orig, ptv[0].pruefungsdatum]
          );
        }
      }
    }

    res.json({ success: true, message: 'Anmeldung aktualisiert' });
  } catch (error) {
    logger.error('Fehler beim Aktualisieren der Anmeldung', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Aktualisieren', details: error.message });
  }
});

// ── GET /stundenplan-konflikt ─────────────────────────────────────────────────
// Prüft ob zum Datum/Zeit reguläres Training im Stundenplan stattfindet
// Query: ?datum=YYYY-MM-DD&zeit=HH:MM
router.get('/stundenplan-konflikt', async (req, res) => {
  const { datum, zeit } = req.query;
  if (!datum || !zeit) return res.status(400).json({ error: 'datum und zeit erforderlich' });

  const secureDojoId = getSecureDojoId(req);
  if (!secureDojoId) return res.json({ konflikte: [] });

  const pool = db.promise();
  try {
    const [rows] = await pool.query(
      `SELECT s.stundenplan_id, s.tag, s.uhrzeit_start, s.uhrzeit_ende,
              k.name AS kurs_name, st.name AS stil_name
       FROM stundenplan s
       JOIN kurse k ON s.kurs_id = k.kurs_id
       LEFT JOIN stile st ON k.stil_id = st.stil_id
       WHERE k.dojo_id = ?
         AND s.typ = 'regulaer'
         AND s.tag = ELT(DAYOFWEEK(?), 'Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag')
         AND s.uhrzeit_start <= ? AND s.uhrzeit_ende > ?`,
      [secureDojoId, datum, zeit, zeit]
    );
    res.json({ konflikte: rows });
  } catch (err) {
    logger.error('Stundenplan-Konflikt-Check Fehler', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
