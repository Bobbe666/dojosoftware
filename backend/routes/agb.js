// Backend/routes/agb.js
// Rechtliche Dokumente Verwaltung mit Versionierung
// AGB, Datenschutz, Dojo-Regeln, Hausordnung

const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// E-Mail Transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// =====================================================
// GET /api/agb/:dojoId - Alle rechtlichen Dokumente abrufen
// =====================================================
router.get('/:dojoId', (req, res) => {
  const { dojoId } = req.params;

  const query = `
    SELECT
      agb_text,
      agb_version,
      agb_letzte_aenderung,
      dsgvo_text,
      dsgvo_version,
      dsgvo_letzte_aenderung,
      dojo_regeln_text,
      dojo_regeln_version,
      dojo_regeln_letzte_aenderung,
      hausordnung_text,
      hausordnung_version,
      hausordnung_letzte_aenderung
    FROM dojo
    WHERE id = ?
  `;

  req.db.query(query, [dojoId], (err, results) => {
    if (err) {
      console.error('Fehler beim Abrufen der Dokumente:', err);
      return res.status(500).json({ error: 'Fehler beim Laden' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }

    res.json(results[0]);
  });
});

// =====================================================
// PUT /api/agb/:dojoId/update - Dokumente aktualisieren
// =====================================================
router.put('/:dojoId/update', async (req, res) => {
  const { dojoId } = req.params;
  const {
    agb_text, agb_version,
    dsgvo_text, dsgvo_version,
    dojo_regeln_text, dojo_regeln_version,
    hausordnung_text, hausordnung_version,
    sendNotification
  } = req.body;

  try {
    const oldDataQuery = `
      SELECT agb_version, dsgvo_version, dojo_regeln_version, hausordnung_version, dojoname
      FROM dojo WHERE id = ?
    `;
    const [oldData] = await new Promise((resolve, reject) => {
      req.db.query(oldDataQuery, [dojoId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (!oldData) {
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }

    const updateData = {};
    const changedDocuments = [];

    // AGB
    if (agb_text !== undefined) {
      updateData.agb_text = agb_text;
      updateData.agb_version = agb_version || oldData.agb_version;
      updateData.agb_letzte_aenderung = new Date();
      if (oldData.agb_version !== agb_version) changedDocuments.push('AGB');
    }

    // Datenschutz
    if (dsgvo_text !== undefined) {
      updateData.dsgvo_text = dsgvo_text;
      updateData.dsgvo_version = dsgvo_version || oldData.dsgvo_version;
      updateData.dsgvo_letzte_aenderung = new Date();
      if (oldData.dsgvo_version !== dsgvo_version) changedDocuments.push('Datenschutz');
    }

    // Dojo-Regeln
    if (dojo_regeln_text !== undefined) {
      updateData.dojo_regeln_text = dojo_regeln_text;
      updateData.dojo_regeln_version = dojo_regeln_version || oldData.dojo_regeln_version;
      updateData.dojo_regeln_letzte_aenderung = new Date();
      if (oldData.dojo_regeln_version !== dojo_regeln_version) changedDocuments.push('Dojo-Regeln');
    }

    // Hausordnung
    if (hausordnung_text !== undefined) {
      updateData.hausordnung_text = hausordnung_text;
      updateData.hausordnung_version = hausordnung_version || oldData.hausordnung_version;
      updateData.hausordnung_letzte_aenderung = new Date();
      if (oldData.hausordnung_version !== hausordnung_version) changedDocuments.push('Hausordnung');
    }

    await new Promise((resolve, reject) => {
      req.db.query('UPDATE dojo SET ? WHERE id = ?', [updateData, dojoId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    // E-Mail Benachrichtigungen
    if (sendNotification && changedDocuments.length > 0 && process.env.EMAIL_USER) {
      const mitgliederQuery = `
        SELECT email, vorname, nachname
        FROM mitglieder
        WHERE dojo_id = ? AND aktiv = 1 AND email IS NOT NULL AND email != ''
      `;
      const mitglieder = await new Promise((resolve, reject) => {
        req.db.query(mitgliederQuery, [dojoId], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      const transporter = createTransporter();
      const changedDocsText = changedDocuments.join(', ');

      const emailPromises = mitglieder.map(m => {
        return transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
          to: m.email,
          subject: `Aktualisierung: ${changedDocsText} - ${oldData.dojoname}`,
          html: `
            <div style="font-family: Arial, sans-serif;">
              <h2>Wichtige Aktualisierung</h2>
              <p>Hallo ${m.vorname} ${m.nachname},</p>
              <p>Folgende Dokumente wurden aktualisiert: <strong>${changedDocsText}</strong></p>
              <p>Bitte lesen und akzeptieren Sie die neuen Versionen bei Ihrem naechsten Login.</p>
              <p>Mit freundlichen Gruessen<br>${oldData.dojoname}</p>
            </div>
          `
        }).catch(err => ({ error: err.message, email: m.email }));
      });

      const results = await Promise.all(emailPromises);
      const sent = results.filter(r => !r.error).length;

      res.json({ success: true, message: 'Dokumente aktualisiert', notifications: { sent, total: mitglieder.length } });
    } else {
      res.json({ success: true, message: 'Dokumente aktualisiert' });
    }

  } catch (error) {
    console.error('Fehler beim Aktualisieren:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// GET /api/agb/:dojoId/members-need-acceptance - Mitglieder ohne Akzeptanz
// =====================================================
router.get("/:dojoId/members-need-acceptance", (req, res) => {
  const { dojoId } = req.params;

  // Bei "all" oder "null" alle Dojos prüfen
  const isAllDojos = dojoId === "all" || dojoId === "null" || dojoId === "undefined";

  const query = isAllDojos ? `
    SELECT
      m.mitglied_id,
      m.vorname,
      m.nachname,
      m.email,
      m.dojo_id,
      d.dojoname,
      m.agb_akzeptiert_version,
      m.dsgvo_akzeptiert_version,
      m.dojo_regeln_akzeptiert_version,
      m.hausordnung_akzeptiert_version,
      d.agb_version,
      d.dsgvo_version,
      d.dojo_regeln_version,
      d.hausordnung_version,
      CASE WHEN m.agb_akzeptiert_version IS NULL OR m.agb_akzeptiert_version != d.agb_version THEN 1 ELSE 0 END as agb_akzeptanz_fehlt,
      CASE WHEN m.dsgvo_akzeptiert_version IS NULL OR m.dsgvo_akzeptiert_version != d.dsgvo_version THEN 1 ELSE 0 END as dsgvo_akzeptanz_fehlt,
      CASE WHEN m.dojo_regeln_akzeptiert_version IS NULL OR m.dojo_regeln_akzeptiert_version != d.dojo_regeln_version THEN 1 ELSE 0 END as dojo_regeln_akzeptanz_fehlt,
      CASE WHEN m.hausordnung_akzeptiert_version IS NULL OR m.hausordnung_akzeptiert_version != d.hausordnung_version THEN 1 ELSE 0 END as hausordnung_akzeptanz_fehlt
    FROM mitglieder m
    JOIN dojo d ON m.dojo_id = d.id
    WHERE m.aktiv = 1
    HAVING agb_akzeptanz_fehlt = 1 OR dsgvo_akzeptanz_fehlt = 1 OR dojo_regeln_akzeptanz_fehlt = 1 OR hausordnung_akzeptanz_fehlt = 1
  ` : `
    SELECT
      m.mitglied_id,
      m.vorname,
      m.nachname,
      m.email,
      m.agb_akzeptiert_version,
      m.dsgvo_akzeptiert_version,
      m.dojo_regeln_akzeptiert_version,
      m.hausordnung_akzeptiert_version,
      d.agb_version,
      d.dsgvo_version,
      d.dojo_regeln_version,
      d.hausordnung_version,
      CASE WHEN m.agb_akzeptiert_version IS NULL OR m.agb_akzeptiert_version != d.agb_version THEN 1 ELSE 0 END as agb_akzeptanz_fehlt,
      CASE WHEN m.dsgvo_akzeptiert_version IS NULL OR m.dsgvo_akzeptiert_version != d.dsgvo_version THEN 1 ELSE 0 END as dsgvo_akzeptanz_fehlt,
      CASE WHEN m.dojo_regeln_akzeptiert_version IS NULL OR m.dojo_regeln_akzeptiert_version != d.dojo_regeln_version THEN 1 ELSE 0 END as dojo_regeln_akzeptanz_fehlt,
      CASE WHEN m.hausordnung_akzeptiert_version IS NULL OR m.hausordnung_akzeptiert_version != d.hausordnung_version THEN 1 ELSE 0 END as hausordnung_akzeptanz_fehlt
    FROM mitglieder m
    CROSS JOIN dojo d
    WHERE m.dojo_id = ? AND d.id = ? AND m.aktiv = 1
    HAVING agb_akzeptanz_fehlt = 1 OR dsgvo_akzeptanz_fehlt = 1 OR dojo_regeln_akzeptanz_fehlt = 1 OR hausordnung_akzeptanz_fehlt = 1
  `;

  const params = isAllDojos ? [] : [dojoId, dojoId];

  req.db.query(query, params, (err, results) => {
    if (err) {
      console.error("Fehler:", err);
      return res.status(500).json({ error: "Fehler beim Laden" });
    }
    res.json({ count: results.length, members: results });
  });
});

// =====================================================
// POST /api/agb/member/:mitgliedId/accept - Akzeptanz erfassen
// =====================================================
router.post('/member/:mitgliedId/accept', (req, res) => {
  const { mitgliedId } = req.params;
  const { agb_version, dsgvo_version, dojo_regeln_version, hausordnung_version } = req.body;

  const updateData = {};
  const now = new Date();

  if (agb_version) {
    updateData.agb_akzeptiert_version = agb_version;
    updateData.agb_akzeptiert_am = now;
  }
  if (dsgvo_version) {
    updateData.dsgvo_akzeptiert_version = dsgvo_version;
    updateData.dsgvo_akzeptiert_am = now;
  }
  if (dojo_regeln_version) {
    updateData.dojo_regeln_akzeptiert_version = dojo_regeln_version;
    updateData.dojo_regeln_akzeptiert_am = now;
  }
  if (hausordnung_version) {
    updateData.hausordnung_akzeptiert_version = hausordnung_version;
    updateData.hausordnung_akzeptiert_am = now;
  }

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: 'Keine Versionen angegeben' });
  }

  req.db.query('UPDATE mitglieder SET ? WHERE mitglied_id = ?', [updateData, mitgliedId], (err) => {
    if (err) {
      console.error('Fehler:', err);
      return res.status(500).json({ error: 'Fehler beim Speichern' });
    }
    res.json({ success: true, message: 'Akzeptanz gespeichert' });
  });
});

// =====================================================
// POST /api/agb/import-confirmation/:mitgliedId - Erst-Login Bestaetigung
// =====================================================
router.post('/import-confirmation/:mitgliedId', async (req, res) => {
  const { mitgliedId } = req.params;
  const {
    agb_akzeptiert,
    datenschutz_akzeptiert,
    dojo_regeln_akzeptiert,
    hausordnung_akzeptiert,
    dojo_id
  } = req.body;

  try {
    const [dojo] = await new Promise((resolve, reject) => {
      req.db.query(
        'SELECT agb_version, dsgvo_version, dojo_regeln_version, hausordnung_version FROM dojo WHERE id = ?',
        [dojo_id],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    const now = new Date();
    const updateData = {
      import_bestaetigt: true,
      import_bestaetigt_am: now
    };

    if (agb_akzeptiert) {
      updateData.agb_akzeptiert_version = dojo?.agb_version || '1.0';
      updateData.agb_akzeptiert_am = now;
    }
    if (datenschutz_akzeptiert) {
      updateData.dsgvo_akzeptiert_version = dojo?.dsgvo_version || '1.0';
      updateData.dsgvo_akzeptiert_am = now;
    }
    if (dojo_regeln_akzeptiert) {
      updateData.dojo_regeln_akzeptiert_version = dojo?.dojo_regeln_version || '1.0';
      updateData.dojo_regeln_akzeptiert_am = now;
    }
    if (hausordnung_akzeptiert) {
      updateData.hausordnung_akzeptiert_version = dojo?.hausordnung_version || '1.0';
      updateData.hausordnung_akzeptiert_am = now;
    }

    await new Promise((resolve, reject) => {
      req.db.query('UPDATE mitglieder SET ? WHERE mitglied_id = ?', [updateData, mitgliedId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    res.json({ success: true, message: 'Bestaetigung gespeichert' });

  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// GET /api/agb/check-versions/:mitgliedId - Versions-Check fuer Login
// =====================================================
router.get('/check-versions/:mitgliedId', (req, res) => {
  const { mitgliedId } = req.params;

  const query = `
    SELECT
      m.agb_akzeptiert_version,
      m.dsgvo_akzeptiert_version,
      m.dojo_regeln_akzeptiert_version,
      m.hausordnung_akzeptiert_version,
      m.import_bestaetigt,
      d.agb_version,
      d.dsgvo_version,
      d.dojo_regeln_version,
      d.hausordnung_version,
      d.agb_text,
      d.dsgvo_text,
      d.dojo_regeln_text,
      d.hausordnung_text
    FROM mitglieder m
    JOIN dojo d ON m.dojo_id = d.id
    WHERE m.mitglied_id = ?
  `;

  req.db.query(query, [mitgliedId], (err, results) => {
    if (err) {
      console.error('Fehler:', err);
      return res.status(500).json({ error: 'Fehler beim Laden' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    const d = results[0];

    res.json({
      needsConfirmation: !d.import_bestaetigt,
      needsAgbUpdate: d.agb_akzeptiert_version !== d.agb_version,
      needsDsgvoUpdate: d.dsgvo_akzeptiert_version !== d.dsgvo_version,
      needsDojoRegelnUpdate: d.dojo_regeln_akzeptiert_version !== d.dojo_regeln_version,
      needsHausordnungUpdate: d.hausordnung_akzeptiert_version !== d.hausordnung_version,
      currentVersions: {
        agb: d.agb_version || '1.0',
        dsgvo: d.dsgvo_version || '1.0',
        dojo_regeln: d.dojo_regeln_version || '1.0',
        hausordnung: d.hausordnung_version || '1.0'
      },
      acceptedVersions: {
        agb: d.agb_akzeptiert_version,
        dsgvo: d.dsgvo_akzeptiert_version,
        dojo_regeln: d.dojo_regeln_akzeptiert_version,
        hausordnung: d.hausordnung_akzeptiert_version
      },
      documents: {
        agb_text: d.agb_text,
        dsgvo_text: d.dsgvo_text,
        dojo_regeln_text: d.dojo_regeln_text,
        hausordnung_text: d.hausordnung_text
      }
    });
  });
});

module.exports = router;
