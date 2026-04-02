// Backend/routes/emailService.js
// API-Routen für E-Mail-Service

const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const db = require('../db');
const logger = require('../utils/logger');

// ===================================================================
// E-MAIL KONFIGURATION
// ===================================================================

// GET /api/email-service/settings - E-Mail-Einstellungen abrufen
router.get('/settings', async (req, res) => {
  try {
    const settings = await emailService.getEmailSettings();
    res.json({ success: true, settings });
  } catch (error) {
    logger.error('E-Mail Settings Fehler', { error: error.message });
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Einstellungen' });
  }
});

// PUT /api/email-service/settings - E-Mail-Einstellungen speichern
router.put('/settings', async (req, res) => {
  try {
    const {
      email_enabled,
      email_config,
      default_from_email,
      default_from_name
    } = req.body;

    // Validierung
    if (email_enabled && email_config) {
      const config = typeof email_config === 'string' ? JSON.parse(email_config) : email_config;
      if (!config.smtp_host || !config.smtp_port || !config.smtp_user || !config.smtp_password) {
        return res.status(400).json({ 
          success: false, 
          message: 'E-Mail-Konfiguration unvollständig' 
        });
      }
    }

    // Einstellungen in Datenbank speichern
    await new Promise((resolve, reject) => {
      db.query(`
        INSERT INTO notification_settings 
        (id, email_enabled, email_config, default_from_email, default_from_name)
        VALUES (1, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        email_enabled = VALUES(email_enabled),
        email_config = VALUES(email_config),
        default_from_email = VALUES(default_from_email),
        default_from_name = VALUES(default_from_name),
        updated_at = NOW()
      `, [
        email_enabled || false,
        JSON.stringify(email_config || {}),
        default_from_email || '',
        default_from_name || 'Dojo Software'
      ], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    res.json({ success: true, message: 'E-Mail-Einstellungen gespeichert' });
  } catch (error) {
    logger.error('E-Mail Settings Update Fehler', { error: error.message });
    res.status(500).json({ success: false, message: 'Fehler beim Speichern der Einstellungen' });
  }
});

// ===================================================================
// E-MAIL TEST
// ===================================================================

// POST /api/email-service/test - Test-E-Mail versenden
router.post('/test', async (req, res) => {
  try {
    const { to, subject, message } = req.body;
    
    if (!to) {
      return res.status(400).json({ 
        success: false, 
        message: 'Empfänger-E-Mail-Adresse ist erforderlich' 
      });
    }

    const testSubject = subject || 'Test-E-Mail von Dojo Software';
    const testMessage = message || `
      <h2>Test-E-Mail erfolgreich!</h2>
      <p>Diese E-Mail wurde erfolgreich über das Dojo Software E-Mail-System gesendet.</p>
      <p><strong>Zeitstempel:</strong> ${new Date().toLocaleString('de-DE')}</p>
      <p><strong>SMTP-Server:</strong> Konfiguriert</p>
      <hr>
      <p><em>Dojo Software - E-Mail-Service</em></p>
    `;

    const result = await emailService.sendEmail({
      to,
      subject: testSubject,
      html: testMessage,
      text: 'Test-E-Mail erfolgreich versendet. Zeitstempel: ' + new Date().toLocaleString('de-DE')
    });

    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Test-E-Mail erfolgreich gesendet',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Test-E-Mail konnte nicht versendet werden',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Test-E-Mail Fehler', { error: error.message });
    res.status(500).json({ success: false, message: 'Fehler beim Senden der Test-E-Mail' });
  }
});

// ===================================================================
// E-MAIL VERSAND
// ===================================================================

// POST /api/email-service/send - E-Mail versenden
router.post('/send', async (req, res) => {
  try {
    const { to, subject, text, html, attachments } = req.body;
    
    if (!to || !subject) {
      return res.status(400).json({ 
        success: false, 
        message: 'Empfänger und Betreff sind erforderlich' 
      });
    }

    const result = await emailService.sendEmail({
      to,
      subject,
      text,
      html,
      attachments
    });

    if (result.success) {
      res.json({ 
        success: true, 
        message: 'E-Mail erfolgreich versendet',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'E-Mail konnte nicht versendet werden',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('E-Mail Send Fehler', { error: error.message });
    res.status(500).json({ success: false, message: 'Fehler beim Senden der E-Mail' });
  }
});

// ===================================================================
// E-MAIL VERBINDUNG TESTEN
// ===================================================================

// GET /api/email-service/verify - SMTP-Verbindung testen
router.get('/verify', async (req, res) => {
  try {
    const transporter = await emailService.createEmailTransporter();
    
    if (!transporter) {
      return res.status(400).json({ 
        success: false, 
        message: 'E-Mail-Service ist nicht konfiguriert oder deaktiviert' 
      });
    }

    // Verbindung testen
    await transporter.verify();
    
    res.json({ 
      success: true, 
      message: 'SMTP-Verbindung erfolgreich getestet' 
    });
  } catch (error) {
    logger.error('SMTP Verify Fehler', { error: error.message });
    res.status(500).json({ 
      success: false, 
      message: 'SMTP-Verbindung fehlgeschlagen',
      error: error.message
    });
  }
});

module.exports = router;
