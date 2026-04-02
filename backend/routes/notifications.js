const express = require('express');
const logger = require('../utils/logger');
const nodemailer = require('nodemailer');
const webpush = require('web-push');
const db = require('../db');
const pool = db.promise(); // Promise-basierte API von mysql2
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const enc = require('../services/encryptionService');
const router = express.Router();

// VAPID konfigurieren für Web Push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@dojo.tda-intl.org',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// ===================================================================
// EMAIL TRANSPORTER KONFIGURATION
// ===================================================================

let emailTransporter = null;

// Email-Konfiguration initialisieren
const initEmailTransporter = async () => {
  try {
    // Hole Email-Einstellungen aus der Datenbank
    const settings = await getNotificationSettings();
    
    if (settings.email_enabled && settings.email_config) {
      const emailConfig = JSON.parse(settings.email_config);
      
      // TLS-Zertifikatsvalidierung: In Produktion streng, in Development optional deaktivierbar
      const isProduction = process.env.NODE_ENV === 'production';
      const skipTlsVerify = process.env.SMTP_SKIP_TLS_VERIFY === 'true';

      emailTransporter = nodemailer.createTransport({
        host: emailConfig.smtp_host,
        port: emailConfig.smtp_port,
        secure: emailConfig.smtp_secure,
        auth: {
          user: emailConfig.smtp_user,
          pass: emailConfig.smtp_password
        },
        tls: {
          // In Produktion immer TLS validieren, außer explizit deaktiviert
          rejectUnauthorized: isProduction ? !skipTlsVerify : !skipTlsVerify
        }
      });

      if (!isProduction || skipTlsVerify) {
        logger.warn('⚠️ SMTP TLS-Zertifikatsvalidierung ist deaktiviert - nur für Development verwenden!');
      }

    }
  } catch (error) {
    logger.error('Email Transporter Fehler:', { error: error });
  }
};

// ===================================================================
// HILFSFUNKTIONEN
// ===================================================================

// Notification Settings aus Datenbank holen
const getNotificationSettings = async () => {
  return new Promise((resolve, reject) => {
    db.query(
      'SELECT * FROM notification_settings WHERE id = 1',
      (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results[0] || {
            email_enabled: false,
            push_enabled: false,
            email_config: '{}',
            push_config: '{}',
            default_from_email: '',
            default_from_name: 'Dojo Software'
          });
        }
      }
    );
  });
};

// ===================================================================
// BENACHRICHTIGUNGEN DASHBOARD
// ===================================================================

router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const settings = await getNotificationSettings();
    
    // Statistiken sammeln
    const stats = await new Promise((resolve, reject) => {
      db.query(`
        SELECT 
          COUNT(*) as total_notifications,
          COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_notifications,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_notifications,
          COUNT(CASE WHEN type = 'email' THEN 1 END) as email_notifications,
          COUNT(CASE WHEN type = 'push' THEN 1 END) as push_notifications
        FROM notifications 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `, (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });

    // Letzte Benachrichtigungen
    const recentNotifications = await new Promise((resolve, reject) => {
      db.query(`
        SELECT * FROM notifications 
        ORDER BY created_at DESC 
        LIMIT 10
      `, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    res.json({
      success: true,
      settings,
      stats,
      recentNotifications
    });
  } catch (error) {
    logger.error('Dashboard Fehler:', { error: error });
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Daten' });
  }
});

// ===================================================================
// EINSTELLUNGEN VERWALTUNG
// ===================================================================

router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const settings = await getNotificationSettings();
    res.json({ success: true, settings });
  } catch (error) {
    logger.error('Settings Fehler:', { error: error });
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Einstellungen' });
  }
});

router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const {
      email_enabled,
      push_enabled,
      email_config,
      push_config,
      default_from_email,
      default_from_name
    } = req.body;

    // Validierung
    if (email_enabled && email_config) {
      const config = JSON.parse(email_config);
      if (!config.smtp_host || !config.smtp_port || !config.smtp_user || !config.smtp_password) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email-Konfiguration unvollständig' 
        });
      }
    }

    // Einstellungen speichern
    await new Promise((resolve, reject) => {
      db.query(`
        INSERT INTO notification_settings 
        (id, email_enabled, push_enabled, email_config, push_config, default_from_email, default_from_name)
        VALUES (1, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        email_enabled = VALUES(email_enabled),
        push_enabled = VALUES(push_enabled),
        email_config = VALUES(email_config),
        push_config = VALUES(push_config),
        default_from_email = VALUES(default_from_email),
        default_from_name = VALUES(default_from_name)
      `, [
        email_enabled,
        push_enabled,
        JSON.stringify(email_config || {}),
        JSON.stringify(push_config || {}),
        default_from_email,
        default_from_name
      ], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    // Email Transporter neu initialisieren
    await initEmailTransporter();

    res.json({ success: true, message: 'Einstellungen gespeichert' });
  } catch (error) {
    logger.error('Settings Update Fehler:', { error: error });
    res.status(500).json({ success: false, message: 'Fehler beim Speichern der Einstellungen' });
  }
});

// ===================================================================
// EMAIL FUNKTIONEN
// ===================================================================

router.post('/email/test', authenticateToken, async (req, res) => {
  try {
    const { test_email, test_subject, test_message } = req.body;
    
    if (!emailTransporter) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email-Service nicht konfiguriert' 
      });
    }

    const settings = await getNotificationSettings();
    
    const mailOptions = {
      from: `${settings.default_from_name} <${settings.default_from_email}>`,
      to: test_email,
      subject: test_subject || 'Test-Email von Dojo Software',
      html: test_message || `
        <h2>Test-Email erfolgreich!</h2>
        <p>Diese Email wurde erfolgreich über das Dojo Software Benachrichtigungssystem gesendet.</p>
        <p><strong>Zeitstempel:</strong> ${new Date().toLocaleString('de-DE')}</p>
        <hr>
        <p><em>Dojo Software - Benachrichtigungssystem</em></p>
      `
    };

    await emailTransporter.sendMail(mailOptions);
    
    // Test-Email in Datenbank loggen
    await new Promise((resolve, reject) => {
      db.query(`
        INSERT INTO notifications (type, recipient, subject, message, status, created_at)
        VALUES (?, ?, ?, ?, 'sent', NOW())
      `, ['email', test_email, mailOptions.subject, mailOptions.html], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    res.json({ success: true, message: 'Test-Email erfolgreich gesendet' });
  } catch (error) {
    logger.error('Test-Email Fehler:', { error: error });
    res.status(500).json({ success: false, message: 'Fehler beim Senden der Test-Email' });
  }
});

router.post('/email/send', authenticateToken, async (req, res) => {
  try {
    const { recipients, subject, message, template_type } = req.body;
    
    if (!emailTransporter) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email-Service nicht konfiguriert' 
      });
    }

    const settings = await getNotificationSettings();
    const results = [];

    for (const recipient of recipients) {
      try {
        const mailOptions = {
          from: `${settings.default_from_name} <${settings.default_from_email}>`,
          to: recipient,
          subject: subject,
          html: message
        };

        await emailTransporter.sendMail(mailOptions);
        
        // Erfolgreiche Email loggen
        await new Promise((resolve, reject) => {
          db.query(`
            INSERT INTO notifications (type, recipient, subject, message, status, created_at)
            VALUES (?, ?, ?, ?, 'sent', NOW())
          `, ['email', recipient, subject, message], (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });

        results.push({ recipient, status: 'sent' });
      } catch (error) {
        // Fehlgeschlagene Email loggen
        await new Promise((resolve, reject) => {
          db.query(`
            INSERT INTO notifications (type, recipient, subject, message, status, error_message, created_at)
            VALUES (?, ?, ?, ?, 'failed', ?, NOW())
          `, ['email', recipient, subject, message, error.message], (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });

        results.push({ recipient, status: 'failed', error: error.message });
      }
    }

    res.json({ 
      success: true, 
      message: `${results.filter(r => r.status === 'sent').length} von ${results.length} Emails erfolgreich gesendet`,
      results 
    });
  } catch (error) {
    logger.error('Email Send Fehler:', { error: error });
    res.status(500).json({ success: false, message: 'Fehler beim Senden der Emails' });
  }
});

// ===================================================================
// 📱 PUSH NOTIFICATION FUNKTIONEN
// ===================================================================

// Web Push Service Worker Registration
router.post('/push/subscribe', authenticateToken, async (req, res) => {
  try {
    // Akzeptiert beide Formate:
    // Altes Format: { subscription: { endpoint, keys: { p256dh, auth } }, user_id }
    // Neues flaches Format: { endpoint, p256dh, auth }
    const body = req.body;
    let endpoint, p256dh, auth;

    if (body.subscription && body.subscription.endpoint) {
      endpoint = body.subscription.endpoint;
      p256dh = body.subscription.keys?.p256dh || null;
      auth = body.subscription.keys?.auth || null;
    } else if (body.endpoint) {
      endpoint = body.endpoint;
      p256dh = body.p256dh || null;
      auth = body.auth || null;
    } else {
      return res.status(400).json({ success: false, message: 'Ungültige Subscription-Daten' });
    }

    // user_id sicher aus JWT ableiten (nicht aus Body)
    const userId = req.user.mitglied_id || req.user.user_id || req.user.id || null;

    // Subscription in Datenbank speichern
    await new Promise((resolve, reject) => {
      db.query(`
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key, user_agent, is_active)
        VALUES (?, ?, ?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE
        user_id = VALUES(user_id),
        p256dh_key = VALUES(p256dh_key),
        auth_key = VALUES(auth_key),
        user_agent = VALUES(user_agent),
        is_active = TRUE,
        updated_at = NOW()
      `, [
        userId,
        endpoint,
        p256dh,
        auth,
        req.get('User-Agent') || 'Unknown'
      ], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    res.json({ success: true, message: 'Push-Subscription erfolgreich registriert' });
  } catch (error) {
    logger.error('Push Subscribe Fehler:', { error: error });
    res.status(500).json({ success: false, message: 'Fehler beim Registrieren der Push-Subscription' });
  }
});

// Push-Notification senden
router.post('/push/send', authenticateToken, async (req, res) => {
  try {
    const { recipients, title, message, data, icon, badge, url, send_to_chat } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Titel und Nachricht sind erforderlich' });
    }

    if (!recipients || recipients.length === 0) {
      return res.status(400).json({ success: false, message: 'Mindestens ein Empfänger erforderlich' });
    }

    const dojo_id = req.user.dojo_id;
    const results = [];
    let sentCount = 0;
    let notificationDbId = null;

    // Zuerst in DB loggen (für send_to_chat Referenz)
    try {
      const [logResult] = await pool.query(
        `INSERT INTO notifications (type, recipient, subject, message, status, created_at)
         VALUES ('push', 'broadcast', ?, ?, 'sent', NOW())`,
        [title, message]
      );
      notificationDbId = logResult.insertId;
    } catch (e) {
      logger.warn('Notification-Log Fehler', { error: e.message });
    }

    // Option A: Push-Nachricht auch im Ankündigungs-Chat anzeigen
    if (send_to_chat && dojo_id) {
      try {
        const adminId = req.user.user_id || req.user.admin_id;

        // Ankündigungs-Raum suchen oder erstellen
        let [announcementRooms] = await pool.query(
          `SELECT id FROM chat_rooms WHERE dojo_id = ? AND type = 'announcement' LIMIT 1`,
          [dojo_id]
        );

        let announcement_room_id;
        if (announcementRooms[0]) {
          announcement_room_id = announcementRooms[0].id;
        } else {
          // Ankündigungsraum anlegen
          const [newRoom] = await pool.query(
            `INSERT INTO chat_rooms (dojo_id, type, name, description, created_by_id, created_by_type)
             VALUES (?, 'announcement', 'Ankündigungen', 'Offizielle Mitteilungen vom Dojo', ?, 'admin')`,
            [dojo_id, adminId]
          );
          announcement_room_id = newRoom.insertId;

          // Alle Mitglieder des Dojos zum Ankündigungsraum hinzufügen
          const [allMembers] = await pool.query(
            `SELECT mitglied_id FROM mitglieder WHERE dojo_id = ? AND status = 'aktiv'`,
            [dojo_id]
          );
          if (allMembers.length) {
            const memberValues = allMembers.map(m => [announcement_room_id, m.mitglied_id, 'mitglied', 'member']);
            await pool.query(
              `INSERT IGNORE INTO chat_room_members (room_id, member_id, member_type, role) VALUES ?`,
              [memberValues]
            );
          }
        }

        // Nachricht im Chat speichern (als push_ref)
        const chatContent = `📣 **${title}**\n\n${message}`;
        const [chatMsg] = await pool.query(
          `INSERT INTO chat_messages (room_id, sender_id, sender_type, message_type, content, push_notification_id)
           VALUES (?, ?, 'admin', 'push_ref', ?, ?)`,
          [announcement_room_id, adminId, chatContent, notificationDbId]
        );

        // Via Socket.io broadcasten
        const io = req.app.get('io');
        if (io) {
          io.to(`dojo:${dojo_id}`).emit('chat:message', {
            id: chatMsg.insertId,
            room_id: announcement_room_id,
            sender_id: adminId,
            sender_type: 'admin',
            message_type: 'push_ref',
            content: chatContent,
            sent_at: new Date(),
            sender_name: req.user.username || 'Admin',
            reactions: []
          });
        }

        logger.info('Push-Nachricht in Chat gespiegelt', { room_id: announcement_room_id, dojo_id });
      } catch (chatError) {
        logger.error('send_to_chat Fehler', { error: chatError.message });
      }
    }

    // Sende Push-Notification an jeden Empfänger via Web Push
    for (const recipient of recipients) {
      try {
        // Push-Subscriptions des Empfängers laden
        const [subscriptions] = await pool.query(
          `SELECT endpoint, p256dh_key, auth_key FROM push_subscriptions
           WHERE user_id = ? AND is_active = TRUE`,
          [recipient]
        );

        const pushPayload = JSON.stringify({
          title,
          body: message,
          icon: icon || '/icons/icon-192x192.png',
          badge: badge || '/icons/badge-72x72.png',
          data: data || { url: url || '/member/dashboard' }
        });

        let recipientSent = false;
        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
              pushPayload
            );
            recipientSent = true;
          } catch (pushError) {
            if (pushError.statusCode === 410 || pushError.statusCode === 404) {
              await pool.query(
                `UPDATE push_subscriptions SET is_active = FALSE WHERE endpoint = ?`,
                [sub.endpoint]
              );
            }
          }
        }

        results.push({ recipient, status: recipientSent ? 'sent' : 'no_subscription' });
        if (recipientSent) sentCount++;
      } catch (error) {
        logger.error(`Push-Senden Fehler für Empfänger ${recipient}`, { error: error.message });
        results.push({ recipient, status: 'failed', error: error.message });
      }
    }

    // In-App Benachrichtigung für alle Empfänger (erscheint in Glocke im MemberDashboard)
    try {
      if (recipients && recipients.length > 0) {
        const uniqueEmails = [...new Set(recipients.map(e => String(e).toLowerCase().trim()))];
        for (const email of uniqueEmails) {
          await pool.query(
            "INSERT INTO notifications (type, recipient, subject, message, status, created_at) VALUES (?, ?, ?, ?, 'unread', NOW())",
            ['push', email, title, message]
          );
        }
      }
    } catch (inAppErr) {
      logger.warn('In-App Notification Insert Fehler:', { error: inAppErr.message });
    }

    res.json({
      success: true,
      message: `${sentCount} von ${recipients.length} Push-Nachrichten gesendet, alle in Benachrichtigungen gespeichert`,
      results,
      sentCount,
      totalRecipients: recipients.length
    });
  } catch (error) {
    logger.error('Push Send Fehler:', { error: error });
    res.status(500).json({ success: false, message: 'Fehler beim Senden der Push-Nachrichten' });
  }
});

// Push-Subscriptions verwalten
router.get('/push/subscriptions', authenticateToken, async (req, res) => {
  try {
    const subscriptions = await new Promise((resolve, reject) => {
      db.query(`
        SELECT ps.*, u.username, u.email 
        FROM push_subscriptions ps
        LEFT JOIN users u ON ps.user_id = u.id
        WHERE ps.is_active = TRUE
        ORDER BY ps.created_at DESC
      `, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    res.json({ success: true, subscriptions });
  } catch (error) {
    logger.error('Push Subscriptions Fehler:', { error: error });
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Push-Subscriptions' });
  }
});

// Push-Subscription deaktivieren
router.delete('/push/subscribe/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    await new Promise((resolve, reject) => {
      db.query(`
        UPDATE push_subscriptions 
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = ?
      `, [id], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    res.json({ success: true, message: 'Push-Subscription erfolgreich deaktiviert' });
  } catch (error) {
    logger.error('Push Unsubscribe Fehler:', { error: error });
    res.status(500).json({ success: false, message: 'Fehler beim Deaktivieren der Push-Subscription' });
  }
});

// ===================================================================
// BENACHRICHTIGUNGS-VERLAUF
// ===================================================================

router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status, recipient } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    let params = [];

    if (type) {
      whereClause += ' AND type = ?';
      params.push(type);
    }

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (recipient) {
      whereClause += ' AND recipient = ?';
      params.push(recipient);
    }
    
    // Gesamtanzahl
    const totalCount = await new Promise((resolve, reject) => {
      db.query(`SELECT COUNT(*) as count FROM notifications WHERE ${whereClause}`, params, (err, results) => {
        if (err) reject(err);
        else resolve(results[0].count);
      });
    });
    
    // Benachrichtigungen
    const notifications = await new Promise((resolve, reject) => {
      db.query(`
        SELECT * FROM notifications 
        WHERE ${whereClause}
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit), parseInt(offset)], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    res.json({
      success: true,
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    logger.error('History Fehler:', { error: error });
    res.status(500).json({ success: false, message: 'Fehler beim Laden des Verlaufs' });
  }
});

// Einzelne Benachrichtigung löschen
router.delete('/history/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    await new Promise((resolve, reject) => {
      db.query('DELETE FROM notifications WHERE id = ?', [id], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    res.json({ success: true, message: 'Benachrichtigung erfolgreich gelöscht' });
  } catch (error) {
    logger.error('Delete Notification Fehler:', { error: error });
    res.status(500).json({ success: false, message: 'Fehler beim Löschen der Benachrichtigung' });
  }
});

// Alle Benachrichtigungen mit gleichem Subject und Timestamp löschen (für alle Empfänger)
router.delete('/history/bulk/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Hole zuerst Subject und Timestamp der Benachrichtigung
    const notification = await new Promise((resolve, reject) => {
      db.query('SELECT subject, created_at FROM notifications WHERE id = ?', [id], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Benachrichtigung nicht gefunden' });
    }

    // Lösche alle Benachrichtigungen mit gleichem Subject und Timestamp
    const result = await new Promise((resolve, reject) => {
      db.query(
        'DELETE FROM notifications WHERE subject = ? AND created_at = ?',
        [notification.subject, notification.created_at],
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
    });

    res.json({
      success: true,
      message: `${result.affectedRows} Benachrichtigung(en) erfolgreich gelöscht`,
      deletedCount: result.affectedRows
    });
  } catch (error) {
    logger.error('Bulk Delete Notification Fehler:', { error: error });
    res.status(500).json({ success: false, message: 'Fehler beim Löschen der Benachrichtigungen' });
  }
});

// ===================================================================
// EMPFÄNGER GRUPPEN
// ===================================================================

router.get('/recipients', authenticateToken, async (req, res) => {
  try {
    // 🔒 SICHER: Verwende getSecureDojoId statt req.query.dojo_id
    const secureDojoId = getSecureDojoId(req);

    // Hole verschiedene Empfängergruppen - prüfe zuerst welche Tabellen existieren
    let memberEmails = [];
    let trainerEmails = [];
    let personalEmails = [];
    let adminEmails = [];

    // Erstelle WHERE clause für dojo_id Filter
    const dojoFilter = secureDojoId ? 'AND dojo_id = ?' : 'AND dojo_id NOT IN (SELECT id FROM dojo WHERE ist_aktiv = 0)';
    const dojoParams = secureDojoId ? [secureDojoId] : [];

    // Prüfe ob mitglieder Tabelle existiert und hole Daten
    try {
      memberEmails = await new Promise((resolve, reject) => {
        db.query(`
          SELECT DISTINCT
            COALESCE(email, '') as email,
            CONCAT(COALESCE(vorname, ''), ' ', COALESCE(nachname, '')) as name,
            'mitglied' as type
          FROM mitglieder
          WHERE email IS NOT NULL
            AND email != ''
            AND email != 'NULL'
            AND email LIKE '%@%'
            ${dojoFilter}
          ORDER BY name
        `, dojoParams, (err, results) => {
          if (err) {

            // Fallback: Hole alle Mitglieder und filtere später
            db.query(`
              SELECT DISTINCT
                COALESCE(email, '') as email,
                CONCAT(COALESCE(vorname, ''), ' ', COALESCE(nachname, '')) as name,
                'mitglied' as type
              FROM mitglieder
              WHERE 1=1
                ${dojoFilter}
              ORDER BY name
            `, dojoParams, (fallbackErr, fallbackResults) => {
              if (fallbackErr) {

                resolve([]);
              } else {
                // Filtere Ergebnisse mit gültigen Emails
                const validMembers = fallbackResults.filter(member => 
                  member.email && 
                  member.email !== '' && 
                  member.email !== 'NULL' && 
                  member.email.includes('@')
                );

                resolve(validMembers);
              }
            });
          } else {

            resolve(results);
          }
        });
      });
    } catch (error) {

      memberEmails = [];
    }

    // Prüfe ob trainer Tabelle existiert und hole Daten
    try {
      trainerEmails = await new Promise((resolve, reject) => {
        db.query(`
          SELECT DISTINCT email, CONCAT(COALESCE(vorname, ''), ' ', COALESCE(nachname, '')) as name, 'trainer' as type
          FROM trainer
          WHERE email IS NOT NULL AND email != '' AND email != 'NULL'
            ${dojoFilter}
          ORDER BY name
        `, dojoParams, (err, results) => {
          if (err) {

            resolve([]); // Leeres Array bei Fehler
          } else {

            resolve(results);
          }
        });
      });
    } catch (error) {

      trainerEmails = [];
    }

    // Prüfe ob personal Tabelle existiert und hole Daten
    try {
      personalEmails = await new Promise((resolve, reject) => {
        db.query(`
          SELECT DISTINCT email, CONCAT(COALESCE(vorname, ''), ' ', COALESCE(nachname, '')) as name, 'personal' as type
          FROM personal
          WHERE email IS NOT NULL AND email != '' AND email != 'NULL'
            ${dojoFilter}
          ORDER BY name
        `, dojoParams, (err, results) => {
          if (err) {

            resolve([]); // Leeres Array bei Fehler
          } else {

            resolve(results);
          }
        });
      });
    } catch (error) {

      personalEmails = [];
    }

    // Prüfe ob users Tabelle existiert und hole Admin-Daten
    try {
      adminEmails = await new Promise((resolve, reject) => {
        db.query(`
          SELECT DISTINCT
            email,
            CONCAT(COALESCE(username, ''), ' (Admin)') as name,
            'admin' as type
          FROM users
          WHERE role IN ('admin', 'super_admin')
            AND email IS NOT NULL
            AND email != ''
            AND email != 'NULL'
          ORDER BY username
        `, (err, results) => {
          if (err) {
            logger.error('Admin query error:', { error: err });
            resolve([]); // Leeres Array bei Fehler
          } else {
            logger.info('Admin users loaded:', { details: results.length });
            resolve(results);
          }
        });
      });
    } catch (error) {
      logger.error('Admin load error:', { error: error });
      adminEmails = [];
    }

    res.json({
      success: true,
      recipients: {
        mitglieder: memberEmails,
        trainer: trainerEmails,
        personal: personalEmails,
        admin: adminEmails,
        alle: [...memberEmails, ...trainerEmails, ...personalEmails, ...adminEmails]
      }
    });
  } catch (error) {
    logger.error('Recipients Fehler:', { error: error });
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Empfänger' });
  }
});

// ===================================================================
// EMAIL TEMPLATES
// ===================================================================

router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const templates = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM email_templates ORDER BY name', (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    res.json({ success: true, templates });
  } catch (error) {
    logger.error('Templates Fehler:', { error: error });
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Templates' });
  }
});

router.post('/templates', authenticateToken, async (req, res) => {
  try {
    const { name, subject, content, variables } = req.body;
    
    await new Promise((resolve, reject) => {
      db.query(`
        INSERT INTO email_templates (name, subject, content, variables, created_at)
        VALUES (?, ?, ?, ?, NOW())
      `, [name, subject, content, JSON.stringify(variables || [])], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    res.json({ success: true, message: 'Template erfolgreich erstellt' });
  } catch (error) {
    logger.error('Template Create Fehler:', { error: error });
    res.status(500).json({ success: false, message: 'Fehler beim Erstellen des Templates' });
  }
});

// ===================================================================
// MEMBER BENACHRICHTIGUNGEN
// ===================================================================

// Hole Benachrichtigungen für ein bestimmtes Mitglied (via Email)
router.get('/member/:email', authenticateToken, async (req, res) => {
  try {
    const { email } = req.params;

    // Hole Benachrichtigungen für dieses Mitglied
    const notifications = await new Promise((resolve, reject) => {
      db.query(`
        SELECT * FROM notifications
        WHERE recipient = ? AND type = 'push'
          AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
        ORDER BY created_at DESC
        LIMIT 50
      `, [email], (err, results) => {
        if (err) {

          resolve([]);
        } else {

          resolve(results);
        }
      });
    });

    res.json({
      success: true,
      notifications: notifications,
      unreadCount: notifications.filter(n => n.status === 'unread').length
    });
  } catch (error) {
    logger.error('Member Notifications Fehler:', { error: error });
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Benachrichtigungen' });
  }
});

// Hole bestätigte Dokument-Benachrichtigungen für ein Mitglied (via ID)
router.get('/member/:id/confirmed', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const notifications = await new Promise((resolve, reject) => {
      db.query(`
        SELECT
          n.id,
          n.subject,
          n.message,
          n.metadata,
          n.confirmed_at,
          n.created_at
        FROM notifications n
        WHERE n.recipient = ?
          AND n.type = 'push'
          AND n.requires_confirmation = TRUE
          AND n.confirmed_at IS NOT NULL
        ORDER BY n.confirmed_at DESC
      `, [id.toString()], (err, results) => {
        if (err) {
          logger.error('Fehler beim Laden der bestätigten Benachrichtigungen:', { error: err });
          resolve([]);
        } else {
          // Parse metadata JSON
          const parsed = results.map(n => ({
            ...n,
            metadata: n.metadata ? JSON.parse(n.metadata) : null
          }));
          resolve(parsed);
        }
      });
    });

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    logger.error('Fehler beim Laden der bestätigten Benachrichtigungen:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der bestätigten Benachrichtigungen'
    });
  }
});

// Benachrichtigung als gelesen markieren
router.put('/member/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    await new Promise((resolve, reject) => {
      db.query(`
        UPDATE notifications
        SET read = TRUE
        WHERE id = ?
      `, [id], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    res.json({ success: true, message: 'Benachrichtigung als gelesen markiert' });
  } catch (error) {
    logger.error('Mark Read Fehler:', { error: error });
    res.status(500).json({ success: false, message: 'Fehler beim Markieren als gelesen' });
  }
});

// ===================================================================
// ADMIN BENACHRICHTIGUNGEN
// ===================================================================

// Hole ungelesene Admin-Benachrichtigungen
router.get('/admin/unread', authenticateToken, async (req, res) => {
  try {
    const notifications = await new Promise((resolve, reject) => {
      db.query(`
        SELECT * FROM notifications
        WHERE type = 'admin_alert' AND status = 'unread'
        ORDER BY created_at DESC
      `, (err, results) => {
        if (err) {
          logger.error('Fehler beim Abrufen der Admin-Benachrichtigungen:', { error: err });
          resolve([]);
        } else {
          resolve(results);
        }
      });
    });

    res.json({
      success: true,
      notifications: notifications
    });
  } catch (error) {
    logger.error('Admin Notifications Fehler:', { error: error });
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Benachrichtigungen' });
  }
});

// Erstcheck: Vollständige Registrierungsdaten für einen Admin-Alert laden
router.get('/admin/registration-check/:email', authenticateToken, async (req, res) => {
  try {
    const { email } = req.params;

    const [regRows] = await pool.query(`
      SELECT r.*,
             t.name AS tarif_name, t.price_cents, t.duration_months
      FROM registrierungen r
      LEFT JOIN tarife t ON r.tarif_id = t.id
      WHERE r.email = ?
      ORDER BY r.created_at DESC
      LIMIT 1
    `, [email]);

    if (regRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Keine Registrierung gefunden' });
    }

    const reg = regRows[0];

    // Mitglied in mitglieder-Tabelle nachschlagen (falls bereits angelegt)
    const [mitgliedRows] = await pool.query(`
      SELECT mitglied_id, status, mitgliedsnummer
      FROM mitglieder WHERE email = ? LIMIT 1
    `, [email]);

    const mitglied = mitgliedRows[0] || null;

    // Gesundheitsfragen entschlüsseln + parsen
    let gesundheit = null;
    if (reg.gesundheitsfragen) {
      gesundheit = enc.decryptJSON(reg.gesundheitsfragen);
    }

    res.json({
      success: true,
      registration: {
        id: reg.id,
        email: reg.email,
        vorname: reg.vorname,
        nachname: reg.nachname,
        geburtsdatum: reg.geburtsdatum,
        geschlecht: reg.geschlecht,
        strasse: reg.strasse,
        hausnummer: reg.hausnummer,
        plz: reg.plz,
        ort: reg.ort,
        telefon: reg.telefon,
        iban: reg.iban ? reg.iban.replace(/(.{4})/g, '$1 ').trim() : null,
        bic: reg.bic,
        bank_name: reg.bank_name,
        kontoinhaber: reg.kontoinhaber,
        tarif_name: reg.tarif_name,
        price_cents: reg.price_cents,
        duration_months: reg.duration_months,
        billing_cycle: reg.billing_cycle,
        payment_method: reg.payment_method,
        vertragsbeginn: reg.vertragsbeginn,
        gesundheitsfragen: gesundheit,
        agb_accepted: !!reg.agb_accepted,
        dsgvo_accepted: !!reg.dsgvo_accepted,
        widerrufsrecht_acknowledged: !!reg.widerrufsrecht_acknowledged,
        kuendigungshinweise_acknowledged: !!reg.kuendigungshinweise_acknowledged,
        vertreter1_name: reg.vertreter1_name,
        vertreter1_telefon: reg.vertreter1_telefon,
        vertreter1_email: reg.vertreter1_email,
        status: reg.status,
        created_at: reg.created_at
      },
      mitglied
    });
  } catch (error) {
    logger.error('Registration Check Fehler:', { error: error });
    res.status(500).json({ success: false, error: 'Serverfehler' });
  }
});

// Markiere Admin-Benachrichtigung als gelesen
router.put('/admin/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    await new Promise((resolve, reject) => {
      db.query(`
        UPDATE notifications
        SET status = 'read'
        WHERE id = ? AND type = 'admin_alert'
      `, [id], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    res.json({ success: true, message: 'Benachrichtigung als gelesen markiert' });
  } catch (error) {
    logger.error('Mark Read Fehler:', { error: error });
    res.status(500).json({ success: false, message: 'Fehler beim Markieren als gelesen' });
  }
});

// TEST-ENDPUNKT: Erstelle Test-Benachrichtigung für neue Registrierung
router.post('/admin/test-registration', authenticateToken, async (req, res) => {
  try {
    const testMessage = `
      <strong>Neues Mitglied registriert!</strong><br><br>
      <strong>Name:</strong> Max Mustermann<br>
      <strong>Email:</strong> max.mustermann@test.de<br>
      <strong>Geburtsdatum:</strong> 15.05.1990<br>
      <strong>Adresse:</strong> Teststraße 123, 12345 Teststadt<br>
      <strong>Telefon:</strong> 0123-456789<br>
      <strong>Tarif:</strong> Premium Mitgliedschaft - 49.90€ / 12 Monate<br>
      <strong>Zahlungszyklus:</strong> monatlich<br>
      <strong>Zahlungsmethode:</strong> lastschrift<br>
      <strong>Vertragsbeginn:</strong> 01.01.2025<br>
      <strong>Registrierungsdatum:</strong> ${new Date().toLocaleString('de-DE')}
    `;

    logger.debug('🧪 Creating test notification...');

    await new Promise((resolve, reject) => {
      db.query(`
        INSERT INTO notifications (type, recipient, subject, message, status, created_at)
        VALUES ('admin_alert', 'admin', 'Neue Mitglieder-Registrierung', ?, 'unread', NOW())
      `, [testMessage], (err, result) => {
        if (err) {
          logger.error('Error inserting notification:', err);
          reject(err);
        } else {
          logger.info('Notification created successfully! ID:', { details: result.insertId });
          resolve(result);
        }
      });
    });

    res.json({
      success: true,
      message: 'Test-Benachrichtigung erfolgreich erstellt! Das Popup sollte in max. 10 Sekunden erscheinen.'
    });
  } catch (error) {
    logger.error('Test Notification Fehler:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Erstellen der Test-Benachrichtigung',
      error: error.message
    });
  }
});

// MIGRATION-ENDPUNKT: Fixe notifications Tabelle
router.post('/admin/migrate', authenticateToken, async (req, res) => {
  try {
    logger.debug('🔧 Starting notifications table migration...');

    // Add 'admin_alert' to type enum
    await new Promise((resolve, reject) => {
      db.query(`
        ALTER TABLE notifications
        MODIFY COLUMN type ENUM('email', 'push', 'sms', 'admin_alert') NOT NULL
      `, (err, result) => {
        if (err) {
          logger.error('Error updating type enum:', err);
          reject(err);
        } else {
          logger.info('Type enum updated successfully');
          resolve(result);
        }
      });
    });

    // Add 'unread' and 'read' to status enum
    await new Promise((resolve, reject) => {
      db.query(`
        ALTER TABLE notifications
        MODIFY COLUMN status ENUM('pending', 'sent', 'failed', 'delivered', 'unread', 'read') DEFAULT 'pending'
      `, (err, result) => {
        if (err) {
          logger.error('Error updating status enum:', err);
          reject(err);
        } else {
          logger.info('Status enum updated successfully');
          resolve(result);
        }
      });
    });

    logger.debug('🎉 Migration completed successfully!');

    res.json({
      success: true,
      message: 'Notifications table successfully migrated! Type and status enums updated.'
    });
  } catch (error) {
    logger.error('Migration Fehler:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler bei der Migration',
      error: error.message
    });
  }
});

// DEBUG-ENDPUNKT: Prüfe Tabelle notifications
router.get('/admin/debug', authenticateToken, async (req, res) => {
  try {
    // Prüfe ob Tabelle existiert
    const tableExists = await new Promise((resolve, reject) => {
      db.query(`
        SHOW TABLES LIKE 'notifications'
      `, (err, results) => {
        if (err) reject(err);
        else resolve(results.length > 0);
      });
    });

    if (!tableExists) {
      return res.json({
        success: false,
        message: 'Tabelle notifications existiert nicht!',
        tableExists: false
      });
    }

    // Hole Tabellenstruktur
    const structure = await new Promise((resolve, reject) => {
      db.query('DESCRIBE notifications', (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    // Hole alle admin_alert Benachrichtigungen
    const notifications = await new Promise((resolve, reject) => {
      db.query(`
        SELECT * FROM notifications
        WHERE type = 'admin_alert'
        ORDER BY created_at DESC
        LIMIT 10
      `, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    res.json({
      success: true,
      tableExists: true,
      structure: structure,
      notifications: notifications,
      totalCount: notifications.length
    });
  } catch (error) {
    logger.error('Debug Fehler:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Debuggen',
      error: error.message
    });
  }
});

// ─── Mitglied: gesehene Notifications als gelesen markieren ──────────────────
router.post('/member/mark-read', authenticateToken, async (req, res) => {
  try {
    const { email, ids } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'email fehlt' });

    await new Promise((resolve, reject) => {
      if (ids && ids.length) {
        db.query(
          `UPDATE notifications SET status = 'read'
           WHERE recipient = ? AND type = 'push' AND (requires_confirmation IS NULL OR requires_confirmation = 0)
             AND id IN (?)`,
          [email, ids],
          (err) => err ? reject(err) : resolve()
        );
      } else {
        db.query(
          `UPDATE notifications SET status = 'read'
           WHERE recipient = ? AND type = 'push' AND (requires_confirmation IS NULL OR requires_confirmation = 0)`,
          [email],
          (err) => err ? reject(err) : resolve()
        );
      }
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('mark-read Fehler', { error: error.message });
    res.status(500).json({ success: false });
  }
});


module.exports = router;
