const express = require('express');
const nodemailer = require('nodemailer');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

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
      
      emailTransporter = nodemailer.createTransport({
        host: emailConfig.smtp_host,
        port: emailConfig.smtp_port,
        secure: emailConfig.smtp_secure,
        auth: {
          user: emailConfig.smtp_user,
          pass: emailConfig.smtp_password
        },
        tls: {
          rejectUnauthorized: false
        }
      });

    }
  } catch (error) {
    console.error('Email Transporter Fehler:', error);
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
    console.error('Dashboard Fehler:', error);
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
    console.error('Settings Fehler:', error);
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
    console.error('Settings Update Fehler:', error);
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
    console.error('Test-Email Fehler:', error);
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
    console.error('Email Send Fehler:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Senden der Emails' });
  }
});

// ===================================================================
// 📱 PUSH NOTIFICATION FUNKTIONEN
// ===================================================================

// Web Push Service Worker Registration
router.post('/push/subscribe', authenticateToken, async (req, res) => {
  try {
    const { subscription, user_id } = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, message: 'Ungültige Subscription-Daten' });
    }

    // Subscription in Datenbank speichern
    await new Promise((resolve, reject) => {
      db.query(`
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key, user_agent, is_active)
        VALUES (?, ?, ?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE
        p256dh_key = VALUES(p256dh_key),
        auth_key = VALUES(auth_key),
        user_agent = VALUES(user_agent),
        is_active = TRUE,
        updated_at = NOW()
      `, [
        user_id,
        subscription.endpoint,
        subscription.keys?.p256dh || null,
        subscription.keys?.auth || null,
        req.get('User-Agent') || 'Unknown'
      ], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    res.json({ success: true, message: 'Push-Subscription erfolgreich registriert' });
  } catch (error) {
    console.error('Push Subscribe Fehler:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Registrieren der Push-Subscription' });
  }
});

// Push-Notification senden
router.post('/push/send', authenticateToken, async (req, res) => {
  try {
    const { recipients, title, message, data, icon, badge, url } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Titel und Nachricht sind erforderlich' });
    }

    if (!recipients || recipients.length === 0) {
      return res.status(400).json({ success: false, message: 'Mindestens ein Empfänger erforderlich' });
    }

    const results = [];
    let sentCount = 0;

    // Sende Push-Notification an jeden Empfänger
    for (const recipient of recipients) {
      try {
        // Hier würde der echte Push-Versand stattfinden (web-push)
        // const pushPayload = JSON.stringify({
        //   title: title,
        //   body: message,
        //   icon: icon || '/icons/icon-192x192.png',
        //   badge: badge || '/icons/badge-72x72.png',
        //   data: data || { url: url || '/' }
        // });

        // await webpush.sendNotification(subscription, pushPayload);

        // Push-Notification in Datenbank loggen
        await new Promise((resolve, reject) => {
          db.query(`
            INSERT INTO notifications (type, recipient, subject, message, status, created_at)
            VALUES (?, ?, ?, ?, 'sent', NOW())
          `, ['push', recipient, title, message], (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });

        results.push({ recipient: recipient, status: 'sent' });
        sentCount++;
      } catch (error) {
        console.error(`Fehler beim Senden an ${recipient}:`, error);

        // Fehlerhafte Push-Notification loggen
        await new Promise((resolve, reject) => {
          db.query(`
            INSERT INTO notifications (type, recipient, subject, message, status, error_message, created_at)
            VALUES (?, ?, ?, ?, 'failed', ?, NOW())
          `, ['push', recipient, title, message, error.message], (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });

        results.push({
          recipient: recipient,
          status: 'failed',
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `${sentCount} von ${recipients.length} Push-Nachrichten erfolgreich gesendet`,
      results,
      sentCount,
      totalRecipients: recipients.length
    });
  } catch (error) {
    console.error('Push Send Fehler:', error);
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
    console.error('Push Subscriptions Fehler:', error);
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
    console.error('Push Unsubscribe Fehler:', error);
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
    console.error('History Fehler:', error);
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
    console.error('Delete Notification Fehler:', error);
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
    console.error('Bulk Delete Notification Fehler:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Löschen der Benachrichtigungen' });
  }
});

// ===================================================================
// EMPFÄNGER GRUPPEN
// ===================================================================

router.get('/recipients', authenticateToken, async (req, res) => {
  try {
    const { dojo_id } = req.query;

    // Hole verschiedene Empfängergruppen - prüfe zuerst welche Tabellen existieren
    let memberEmails = [];
    let trainerEmails = [];
    let personalEmails = [];
    let adminEmails = [];

    // Erstelle WHERE clause für dojo_id Filter
    const dojoFilter = dojo_id && dojo_id !== 'all' ? 'AND dojo_id = ?' : '';
    const dojoParams = dojo_id && dojo_id !== 'all' ? [parseInt(dojo_id)] : [];

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
            console.error('Admin query error:', err);
            resolve([]); // Leeres Array bei Fehler
          } else {
            console.log('✅ Admin users loaded:', results.length);
            resolve(results);
          }
        });
      });
    } catch (error) {
      console.error('Admin load error:', error);
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
    console.error('Recipients Fehler:', error);
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
    console.error('Templates Fehler:', error);
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
    console.error('Template Create Fehler:', error);
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
      unreadCount: notifications.filter(n => !n.read).length
    });
  } catch (error) {
    console.error('Member Notifications Fehler:', error);
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
          console.error('Fehler beim Laden der bestätigten Benachrichtigungen:', err);
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
    console.error('Fehler beim Laden der bestätigten Benachrichtigungen:', error);
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
    console.error('Mark Read Fehler:', error);
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
          console.error('Fehler beim Abrufen der Admin-Benachrichtigungen:', err);
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
    console.error('Admin Notifications Fehler:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Benachrichtigungen' });
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
    console.error('Mark Read Fehler:', error);
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

    console.log('🧪 Creating test notification...');

    await new Promise((resolve, reject) => {
      db.query(`
        INSERT INTO notifications (type, recipient, subject, message, status, created_at)
        VALUES ('admin_alert', 'admin', 'Neue Mitglieder-Registrierung', ?, 'unread', NOW())
      `, [testMessage], (err, result) => {
        if (err) {
          console.error('❌ Error inserting notification:', err);
          reject(err);
        } else {
          console.log('✅ Notification created successfully! ID:', result.insertId);
          resolve(result);
        }
      });
    });

    res.json({
      success: true,
      message: 'Test-Benachrichtigung erfolgreich erstellt! Das Popup sollte in max. 10 Sekunden erscheinen.'
    });
  } catch (error) {
    console.error('❌ Test Notification Fehler:', error);
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
    console.log('🔧 Starting notifications table migration...');

    // Add 'admin_alert' to type enum
    await new Promise((resolve, reject) => {
      db.query(`
        ALTER TABLE notifications
        MODIFY COLUMN type ENUM('email', 'push', 'sms', 'admin_alert') NOT NULL
      `, (err, result) => {
        if (err) {
          console.error('❌ Error updating type enum:', err);
          reject(err);
        } else {
          console.log('✅ Type enum updated successfully');
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
          console.error('❌ Error updating status enum:', err);
          reject(err);
        } else {
          console.log('✅ Status enum updated successfully');
          resolve(result);
        }
      });
    });

    console.log('🎉 Migration completed successfully!');

    res.json({
      success: true,
      message: 'Notifications table successfully migrated! Type and status enums updated.'
    });
  } catch (error) {
    console.error('❌ Migration Fehler:', error);
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
    console.error('❌ Debug Fehler:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Debuggen',
      error: error.message
    });
  }
});

// Email Transporter beim Start initialisieren
initEmailTransporter();

module.exports = router;
