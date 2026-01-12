// Backend/routes/agb.js
// AGB & Datenschutz Verwaltung mit Versionierung und Benachrichtigungen

const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// E-Mail Transporter (verwendet Konfiguration aus .env)
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
// GET /api/agb/:dojoId - AGB & Datenschutz abrufen
// =====================================================
router.get('/:dojoId', (req, res) => {
  const { dojoId } = req.params;

  const query = `
    SELECT
      agb_text,
      agb_version,
      agb_letzte_aenderung,
      datenschutz_text,
      datenschutz_version,
      datenschutz_letzte_aenderung
    FROM dojo
    WHERE id = ?
  `;

  req.db.query(query, [dojoId], (err, results) => {
    if (err) {
      console.error('Fehler beim Abrufen der AGB:', err);
      return res.status(500).json({ error: 'Fehler beim Laden der AGB' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Dojo nicht gefunden' });
    }

    res.json(results[0]);
  });
});

// =====================================================
// PUT /api/agb/:dojoId/update - AGB aktualisieren
// =====================================================
router.put('/:dojoId/update', async (req, res) => {
  const { dojoId } = req.params;
  const { agb_text, agb_version, datenschutz_text, datenschutz_version, sendNotification } = req.body;

  try {
    // Hole alte Version zum Vergleich
    const oldDataQuery = 'SELECT agb_version, datenschutz_version, dojoname FROM dojo WHERE id = ?';
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

    // AGB geändert?
    if (agb_text !== undefined) {
      updateData.agb_text = agb_text;
      updateData.agb_version = agb_version || oldData.agb_version;
      updateData.agb_letzte_aenderung = new Date();

      if (oldData.agb_version !== agb_version) {
        changedDocuments.push('AGB');
      }
    }

    // Datenschutz geändert?
    if (datenschutz_text !== undefined) {
      updateData.datenschutz_text = datenschutz_text;
      updateData.datenschutz_version = datenschutz_version || oldData.datenschutz_version;
      updateData.datenschutz_letzte_aenderung = new Date();

      if (oldData.datenschutz_version !== datenschutz_version) {
        changedDocuments.push('Datenschutzerklärung');
      }
    }

    // Update in DB
    await new Promise((resolve, reject) => {
      req.db.query('UPDATE dojo SET ? WHERE id = ?', [updateData, dojoId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    // Benachrichtigungen senden wenn gewünscht und Dokumente geändert wurden
    if (sendNotification && changedDocuments.length > 0) {
      // Hole alle aktiven Mitglieder mit E-Mail
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

      // Sende E-Mails an alle Mitglieder
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        const transporter = createTransporter();
        const changedDocsText = changedDocuments.join(' und ');

        const emailPromises = mitglieder.map(mitglied => {
          const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: mitglied.email,
            subject: `Wichtige Information: Aktualisierung ${changedDocsText} - ${oldData.dojoname}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #FFD700;">Wichtige Aktualisierung</h2>
                <p>Hallo ${mitglied.vorname} ${mitglied.nachname},</p>

                <p>wir informieren Sie darüber, dass wir unsere <strong>${changedDocsText}</strong> aktualisiert haben.</p>

                ${agb_version && changedDocuments.includes('AGB') ? `
                  <div style="background: #f0f0f0; padding: 15px; margin: 15px 0; border-left: 4px solid #FFD700;">
                    <strong>AGB - Neue Version: ${agb_version}</strong><br>
                    Geändert am: ${new Date().toLocaleDateString('de-DE')}
                  </div>
                ` : ''}

                ${datenschutz_version && changedDocuments.includes('Datenschutzerklärung') ? `
                  <div style="background: #f0f0f0; padding: 15px; margin: 15px 0; border-left: 4px solid #FFD700;">
                    <strong>Datenschutzerklärung - Neue Version: ${datenschutz_version}</strong><br>
                    Geändert am: ${new Date().toLocaleDateString('de-DE')}
                  </div>
                ` : ''}

                <p><strong>Bitte lesen Sie die Änderungen aufmerksam durch.</strong></p>
                <p>Die aktuellen Dokumente können Sie in Ihrem Mitgliederbereich einsehen oder direkt auf unserer Website abrufen.</p>

                <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
                  Mit freundlichen Grüßen<br>
                  ${oldData.dojoname}<br>
                  <br>
                  Dies ist eine automatische Benachrichtigung gemäß DSGVO.
                </p>
              </div>
            `
          };

          return transporter.sendMail(mailOptions).catch(err => {
            console.error(`Fehler beim Senden an ${mitglied.email}:`, err.message);
            return { error: err.message, email: mitglied.email };
          });
        });

        const emailResults = await Promise.all(emailPromises);
        const successCount = emailResults.filter(r => !r.error).length;
        const failureCount = emailResults.filter(r => r.error).length;

        console.log(`📧 E-Mail-Benachrichtigungen: ${successCount} erfolgreich, ${failureCount} fehlgeschlagen`);

        res.json({
          success: true,
          message: `${changedDocsText} erfolgreich aktualisiert`,
          notifications: {
            sent: successCount,
            failed: failureCount,
            total: mitglieder.length
          }
        });
      } else {
        console.warn('⚠️ E-Mail-Credentials nicht konfiguriert - keine Benachrichtigungen gesendet');
        res.json({
          success: true,
          message: `${changedDocsText} erfolgreich aktualisiert`,
          warning: 'E-Mail-Benachrichtigungen nicht konfiguriert'
        });
      }
    } else {
      res.json({
        success: true,
        message: 'Dokumente erfolgreich aktualisiert'
      });
    }

  } catch (error) {
    console.error('Fehler beim Aktualisieren der AGB:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren: ' + error.message });
  }
});

// =====================================================
// GET /api/agb/:dojoId/members-need-acceptance - Mitglieder ohne Akzeptanz
// =====================================================
router.get('/:dojoId/members-need-acceptance', (req, res) => {
  const { dojoId } = req.params;

  const query = `
    SELECT
      m.mitglied_id,
      m.vorname,
      m.nachname,
      m.email,
      m.agb_akzeptiert_version,
      m.datenschutz_akzeptiert_version,
      d.agb_version as aktuelle_agb_version,
      d.datenschutz_version as aktuelle_datenschutz_version,
      CASE
        WHEN m.agb_akzeptiert_version IS NULL OR m.agb_akzeptiert_version != d.agb_version THEN 1
        ELSE 0
      END as agb_akzeptanz_fehlt,
      CASE
        WHEN m.datenschutz_akzeptiert_version IS NULL OR m.datenschutz_akzeptiert_version != d.datenschutz_version THEN 1
        ELSE 0
      END as datenschutz_akzeptanz_fehlt
    FROM mitglieder m
    CROSS JOIN dojo d
    WHERE m.dojo_id = ? AND d.id = ? AND m.aktiv = 1
    HAVING agb_akzeptanz_fehlt = 1 OR datenschutz_akzeptanz_fehlt = 1
  `;

  req.db.query(query, [dojoId, dojoId], (err, results) => {
    if (err) {
      console.error('Fehler beim Abrufen der Mitglieder:', err);
      return res.status(500).json({ error: 'Fehler beim Laden der Daten' });
    }

    res.json({
      count: results.length,
      members: results
    });
  });
});

// =====================================================
// POST /api/agb/member/:mitgliedId/accept - Akzeptanz erfassen
// =====================================================
router.post('/member/:mitgliedId/accept', (req, res) => {
  const { mitgliedId } = req.params;
  const { agb_version, datenschutz_version } = req.body;

  const updateData = {};

  if (agb_version) {
    updateData.agb_akzeptiert_version = agb_version;
    updateData.agb_akzeptiert_am = new Date();
  }

  if (datenschutz_version) {
    updateData.datenschutz_akzeptiert_version = datenschutz_version;
    updateData.datenschutz_akzeptiert_am = new Date();
  }

  req.db.query('UPDATE mitglieder SET ? WHERE mitglied_id = ?', [updateData, mitgliedId], (err) => {
    if (err) {
      console.error('Fehler beim Speichern der Akzeptanz:', err);
      return res.status(500).json({ error: 'Fehler beim Speichern' });
    }

    res.json({
      success: true,
      message: 'Akzeptanz erfolgreich gespeichert'
    });
  });
});

module.exports = router;
