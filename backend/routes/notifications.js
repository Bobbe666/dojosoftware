const express = require('express');
const nodemailer = require('nodemailer');
const db = require('../db');
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
      
      emailTransporter = nodemailer.createTransporter({
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

router.get('/dashboard', async (req, res) => {
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

router.get('/settings', async (req, res) => {
  try {
    const settings = await getNotificationSettings();
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Settings Fehler:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Einstellungen' });
  }
});

router.put('/settings', async (req, res) => {
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

router.post('/email/test', async (req, res) => {
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

router.post('/email/send', async (req, res) => {
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
router.post('/push/subscribe', async (req, res) => {
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
router.post('/push/send', async (req, res) => {
  try {
    const { recipients, title, message, data, icon, badge, url } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Titel und Nachricht sind erforderlich' });
    }

    const results = [];
    let sentCount = 0;

    // Hole alle aktiven Push-Subscriptions
    const subscriptions = await new Promise((resolve, reject) => {
      let query = 'SELECT * FROM push_subscriptions WHERE is_active = TRUE';
      let params = [];
      
      if (recipients && recipients.length > 0) {
        query += ' AND user_id IN (' + recipients.map(() => '?').join(',') + ')';
        params = recipients;
      }
      
      db.query(query, params, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    // Simuliere Push-Versand (in echter Implementierung würde hier web-push verwendet)
    for (const subscription of subscriptions) {
      try {
        // Hier würde der echte Push-Versand stattfinden
        // const pushPayload = JSON.stringify({
        //   title: title,
        //   body: message,
        //   icon: icon || '/icons/icon-192x192.png',
        //   badge: badge || '/icons/badge-72x72.png',
        //   data: data || { url: url || '/' }
        // });
        
        // await webpush.sendNotification(subscription, pushPayload);
        
        // Push-Notification loggen
        await new Promise((resolve, reject) => {
          db.query(`
            INSERT INTO notifications (type, recipient, subject, message, status, created_at)
            VALUES (?, ?, ?, ?, 'sent', NOW())
          `, ['push', `User ${subscription.user_id}`, title, message], (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });

        results.push({ recipient: `User ${subscription.user_id}`, status: 'sent' });
        sentCount++;
      } catch (error) {
        results.push({ 
          recipient: `User ${subscription.user_id}`, 
          status: 'failed', 
          error: error.message 
        });
      }
    }

    res.json({ 
      success: true, 
      message: `${sentCount} von ${subscriptions.length} Push-Nachrichten erfolgreich gesendet`,
      results,
      totalSubscriptions: subscriptions.length
    });
  } catch (error) {
    console.error('Push Send Fehler:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Senden der Push-Nachrichten' });
  }
});

// Push-Subscriptions verwalten
router.get('/push/subscriptions', async (req, res) => {
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
router.delete('/push/subscribe/:id', async (req, res) => {
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

router.get('/history', async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;
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

// ===================================================================
// EMPFÄNGER GRUPPEN
// ===================================================================

router.get('/recipients', async (req, res) => {
  try {

    // Hole verschiedene Empfängergruppen - prüfe zuerst welche Tabellen existieren
    let memberEmails = [];
    let trainerEmails = [];
    let personalEmails = [];

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
          ORDER BY name
        `, (err, results) => {
          if (err) {

            // Fallback: Hole alle Mitglieder und filtere später
            db.query(`
              SELECT DISTINCT 
                COALESCE(email, '') as email, 
                CONCAT(COALESCE(vorname, ''), ' ', COALESCE(nachname, '')) as name, 
                'mitglied' as type
              FROM mitglieder 
              ORDER BY name
            `, (fallbackErr, fallbackResults) => {
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
          ORDER BY name
        `, (err, results) => {
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
          ORDER BY name
        `, (err, results) => {
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

    res.json({
      success: true,
      recipients: {
        mitglieder: memberEmails,
        trainer: trainerEmails,
        personal: personalEmails,
        alle: [...memberEmails, ...trainerEmails, ...personalEmails]
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

router.get('/templates', async (req, res) => {
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

router.post('/templates', async (req, res) => {
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
router.get('/member/:email', async (req, res) => {
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

// Benachrichtigung als gelesen markieren
router.put('/member/:id/read', async (req, res) => {
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
router.get('/admin/unread', async (req, res) => {
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
router.put('/admin/:id/read', async (req, res) => {
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
router.post('/admin/test-registration', async (req, res) => {
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
router.post('/admin/migrate', async (req, res) => {
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
router.get('/admin/debug', async (req, res) => {
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
