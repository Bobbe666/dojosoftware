/**
 * EMAIL SETTINGS ROUTES
 * =====================
 * API für globale und Dojo-spezifische E-Mail-Einstellungen
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const nodemailer = require('nodemailer');

// Promise-Wrapper für db.query
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

/**
 * GET /api/email-settings/global
 * Globale E-Mail-Einstellungen abrufen (nur Super-Admin)
 */
router.get('/global', async (req, res) => {
  try {
    // Prüfe ob User Super-Admin ist
    if (req.user?.rolle !== 'super_admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Keine Berechtigung'
      });
    }

    const settings = await queryAsync('SELECT * FROM email_settings WHERE id = 1');

    if (settings.length === 0) {
      // Erstelle Standardeinstellungen
      await queryAsync(`
        INSERT INTO email_settings (id, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, default_from_email, default_from_name, aktiv)
        VALUES (1, '', 587, 1, '', '', 'noreply@tda-intl.com', 'DojoSoftware', 1)
      `);

      return res.json({
        success: true,
        data: {
          smtp_host: '',
          smtp_port: 587,
          smtp_secure: true,
          smtp_user: '',
          smtp_password: '',
          default_from_email: 'noreply@tda-intl.com',
          default_from_name: 'DojoSoftware',
          aktiv: true
        }
      });
    }

    // Passwort nicht im Klartext zurückgeben
    const data = settings[0];
    res.json({
      success: true,
      data: {
        smtp_host: data.smtp_host,
        smtp_port: data.smtp_port,
        smtp_secure: !!data.smtp_secure,
        smtp_user: data.smtp_user,
        smtp_password: data.smtp_password ? '********' : '',
        default_from_email: data.default_from_email,
        default_from_name: data.default_from_name,
        aktiv: !!data.aktiv,
        has_password: !!data.smtp_password
      }
    });

  } catch (error) {
    logger.error('Fehler beim Laden der globalen E-Mail-Einstellungen', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Serverfehler beim Laden der Einstellungen'
    });
  }
});

/**
 * PUT /api/email-settings/global
 * Globale E-Mail-Einstellungen aktualisieren (nur Super-Admin)
 */
router.put('/global', async (req, res) => {
  try {
    // Prüfe ob User Super-Admin ist
    if (req.user?.rolle !== 'super_admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Keine Berechtigung'
      });
    }

    const {
      smtp_host,
      smtp_port,
      smtp_secure,
      smtp_user,
      smtp_password,
      default_from_email,
      default_from_name,
      aktiv
    } = req.body;

    // Wenn Passwort "********" ist, behalte das alte
    let passwordUpdate = '';
    let params = [
      smtp_host || '',
      smtp_port || 587,
      smtp_secure ? 1 : 0,
      smtp_user || '',
      default_from_email || 'noreply@tda-intl.com',
      default_from_name || 'DojoSoftware',
      aktiv ? 1 : 0
    ];

    if (smtp_password && smtp_password !== '********') {
      passwordUpdate = ', smtp_password = ?';
      params.push(smtp_password);
    }

    params.push(1); // WHERE id = 1

    await queryAsync(`
      UPDATE email_settings SET
        smtp_host = ?,
        smtp_port = ?,
        smtp_secure = ?,
        smtp_user = ?,
        default_from_email = ?,
        default_from_name = ?,
        aktiv = ?
        ${passwordUpdate}
      WHERE id = ?
    `, params);

    logger.info('Globale E-Mail-Einstellungen aktualisiert', { user: req.user?.username });

    res.json({
      success: true,
      message: 'E-Mail-Einstellungen erfolgreich gespeichert'
    });

  } catch (error) {
    logger.error('Fehler beim Speichern der globalen E-Mail-Einstellungen', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Serverfehler beim Speichern der Einstellungen'
    });
  }
});

/**
 * POST /api/email-settings/test
 * Test-E-Mail senden (globale oder Dojo-spezifische Einstellungen)
 */
router.post('/test', async (req, res) => {
  try {
    const { test_email, dojo_id, use_global } = req.body;

    if (!test_email) {
      return res.status(400).json({
        success: false,
        error: 'Test-E-Mail-Adresse erforderlich'
      });
    }

    let smtpConfig;

    if (use_global || !dojo_id) {
      // Globale Einstellungen verwenden
      const settings = await queryAsync('SELECT * FROM email_settings WHERE id = 1');
      if (settings.length === 0 || !settings[0].smtp_host) {
        return res.status(400).json({
          success: false,
          error: 'Globale E-Mail-Einstellungen nicht konfiguriert'
        });
      }
      smtpConfig = settings[0];
    } else {
      // Dojo-spezifische Einstellungen
      const dojos = await queryAsync('SELECT email, dojoname FROM dojo WHERE id = ?', [dojo_id]);
      if (dojos.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Dojo nicht gefunden'
        });
      }

      const dojo = dojos[0];

      // E-Mail-Einstellungen aus separater Tabelle holen
      const emailSettings = await queryAsync('SELECT * FROM dojo_email_settings WHERE dojo_id = ?', [dojo_id]);
      const dojoEmail = emailSettings[0] || { email_mode: 'zentral' };

      if (dojoEmail.email_mode === 'eigener_smtp' && dojoEmail.smtp_host) {
        smtpConfig = {
          smtp_host: dojoEmail.smtp_host,
          smtp_port: dojoEmail.smtp_port || 587,
          smtp_secure: dojoEmail.smtp_secure,
          smtp_user: dojoEmail.smtp_user,
          smtp_password: dojoEmail.smtp_password,
          default_from_email: dojo.email,
          default_from_name: dojo.dojoname
        };
      } else if (dojoEmail.email_mode === 'tda_email' && dojoEmail.tda_email) {
        // TDA-E-Mail verwenden - hole globale SMTP-Einstellungen
        const globalSettings = await queryAsync('SELECT * FROM email_settings WHERE id = 1');
        smtpConfig = {
          smtp_host: globalSettings[0]?.smtp_host,
          smtp_port: globalSettings[0]?.smtp_port || 587,
          smtp_secure: globalSettings[0]?.smtp_secure,
          smtp_user: dojoEmail.tda_email,
          smtp_password: dojoEmail.tda_email_password,
          default_from_email: dojoEmail.tda_email,
          default_from_name: dojo.dojoname
        };
      } else {
        // Fallback zu globalen Einstellungen
        const settings = await queryAsync('SELECT * FROM email_settings WHERE id = 1');
        smtpConfig = settings[0];
      }
    }

    if (!smtpConfig || !smtpConfig.smtp_host) {
      return res.status(400).json({
        success: false,
        error: 'Keine SMTP-Konfiguration verfügbar'
      });
    }

    // Transporter erstellen
    const transporter = nodemailer.createTransport({
      host: smtpConfig.smtp_host,
      port: smtpConfig.smtp_port || 587,
      secure: !!smtpConfig.smtp_secure,
      auth: {
        user: smtpConfig.smtp_user,
        pass: smtpConfig.smtp_password
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verbindung testen
    await transporter.verify();

    // Test-E-Mail senden
    await transporter.sendMail({
      from: `"${smtpConfig.default_from_name}" <${smtpConfig.default_from_email || smtpConfig.smtp_user}>`,
      to: test_email,
      subject: 'DojoSoftware - Test-E-Mail',
      text: 'Dies ist eine Test-E-Mail von DojoSoftware. Wenn Sie diese E-Mail erhalten haben, funktioniert Ihre E-Mail-Konfiguration korrekt!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: #FFD700; margin: 0;">DojoSoftware</h1>
            <p style="color: #fff; margin: 10px 0 0;">E-Mail-Konfiguration erfolgreich!</p>
          </div>
          <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px;">
            <p style="color: #333; font-size: 16px;">
              ✅ <strong>Glückwunsch!</strong> Diese Test-E-Mail bestätigt, dass Ihre E-Mail-Konfiguration korrekt funktioniert.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #666; font-size: 14px;">
              <strong>SMTP-Server:</strong> ${smtpConfig.smtp_host}:${smtpConfig.smtp_port}<br>
              <strong>Absender:</strong> ${smtpConfig.default_from_email || smtpConfig.smtp_user}
            </p>
          </div>
        </div>
      `
    });

    logger.info('Test-E-Mail erfolgreich gesendet', { to: test_email });

    res.json({
      success: true,
      message: `Test-E-Mail erfolgreich an ${test_email} gesendet`
    });

  } catch (error) {
    logger.error('Test-E-Mail fehlgeschlagen', { error: error.message });
    res.status(500).json({
      success: false,
      error: `E-Mail-Versand fehlgeschlagen: ${error.message}`
    });
  }
});

/**
 * GET /api/email-settings/dojo/:id
 * Dojo-spezifische E-Mail-Einstellungen abrufen
 */
router.get('/dojo/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Dojo-Basisdaten holen
    const dojos = await queryAsync('SELECT email, dojoname FROM dojo WHERE id = ?', [id]);
    if (dojos.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dojo nicht gefunden'
      });
    }

    const dojo = dojos[0];

    // E-Mail-Einstellungen aus separater Tabelle holen
    const settings = await queryAsync('SELECT * FROM dojo_email_settings WHERE dojo_id = ?', [id]);

    if (settings.length === 0) {
      // Standardwerte zurückgeben
      return res.json({
        success: true,
        data: {
          email_mode: 'zentral',
          smtp_host: '',
          smtp_port: 587,
          smtp_secure: true,
          smtp_user: '',
          has_smtp_password: false,
          tda_email: '',
          has_tda_password: false,
          dojo_email: dojo.email,
          dojoname: dojo.dojoname
        }
      });
    }

    const emailSettings = settings[0];

    res.json({
      success: true,
      data: {
        email_mode: emailSettings.email_mode || 'zentral',
        smtp_host: emailSettings.smtp_host || '',
        smtp_port: emailSettings.smtp_port || 587,
        smtp_secure: !!emailSettings.smtp_secure,
        smtp_user: emailSettings.smtp_user || '',
        has_smtp_password: !!emailSettings.smtp_password,
        tda_email: emailSettings.tda_email || '',
        has_tda_password: !!emailSettings.tda_email_password,
        dojo_email: dojo.email,
        dojoname: dojo.dojoname
      }
    });

  } catch (error) {
    logger.error('Fehler beim Laden der Dojo-E-Mail-Einstellungen', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Serverfehler beim Laden der Einstellungen'
    });
  }
});

/**
 * PUT /api/email-settings/dojo/:id
 * Dojo-spezifische E-Mail-Einstellungen aktualisieren
 */
router.put('/dojo/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      email_mode,
      smtp_host,
      smtp_port,
      smtp_secure,
      smtp_user,
      smtp_password,
      tda_email,
      tda_email_password
    } = req.body;

    // Prüfen ob bereits ein Eintrag existiert
    const existing = await queryAsync('SELECT id, smtp_password, tda_email_password FROM dojo_email_settings WHERE dojo_id = ?', [id]);

    if (existing.length === 0) {
      // Neuen Eintrag erstellen
      const insertParams = [
        id,
        email_mode || 'zentral',
        email_mode === 'eigener_smtp' ? (smtp_host || '') : null,
        email_mode === 'eigener_smtp' ? (smtp_port || 587) : null,
        email_mode === 'eigener_smtp' ? (smtp_secure ? 1 : 0) : null,
        email_mode === 'eigener_smtp' ? (smtp_user || '') : null,
        (email_mode === 'eigener_smtp' && smtp_password && smtp_password !== '********') ? smtp_password : null,
        email_mode === 'tda_email' ? (tda_email || '') : null,
        (email_mode === 'tda_email' && tda_email_password && tda_email_password !== '********') ? tda_email_password : null
      ];

      await queryAsync(`
        INSERT INTO dojo_email_settings
        (dojo_id, email_mode, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, tda_email, tda_email_password)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, insertParams);
    } else {
      // Bestehenden Eintrag aktualisieren
      let updates = ['email_mode = ?'];
      let params = [email_mode || 'zentral'];

      if (email_mode === 'eigener_smtp') {
        updates.push('smtp_host = ?', 'smtp_port = ?', 'smtp_secure = ?', 'smtp_user = ?');
        params.push(smtp_host || '', smtp_port || 587, smtp_secure ? 1 : 0, smtp_user || '');

        if (smtp_password && smtp_password !== '********') {
          updates.push('smtp_password = ?');
          params.push(smtp_password);
        }
      } else {
        // Wenn nicht eigener SMTP, setze SMTP-Felder auf null
        updates.push('smtp_host = NULL', 'smtp_port = NULL', 'smtp_secure = NULL', 'smtp_user = NULL');
        if (!smtp_password || smtp_password !== '********') {
          updates.push('smtp_password = NULL');
        }
      }

      if (email_mode === 'tda_email') {
        updates.push('tda_email = ?');
        params.push(tda_email || '');

        if (tda_email_password && tda_email_password !== '********') {
          updates.push('tda_email_password = ?');
          params.push(tda_email_password);
        }
      } else {
        // Wenn nicht TDA-Email, setze TDA-Felder auf null
        updates.push('tda_email = NULL');
        if (!tda_email_password || tda_email_password !== '********') {
          updates.push('tda_email_password = NULL');
        }
      }

      params.push(id);

      await queryAsync(`UPDATE dojo_email_settings SET ${updates.join(', ')} WHERE dojo_id = ?`, params);
    }

    logger.info('Dojo-E-Mail-Einstellungen aktualisiert', { dojo_id: id, email_mode });

    res.json({
      success: true,
      message: 'E-Mail-Einstellungen erfolgreich gespeichert'
    });

  } catch (error) {
    logger.error('Fehler beim Speichern der Dojo-E-Mail-Einstellungen', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Serverfehler beim Speichern der Einstellungen'
    });
  }
});

module.exports = router;
