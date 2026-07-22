const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const { sendWelcomeEmail, sendVerificationEmail } = require('../services/emailTemplates');
const { sendMitgliederAnleitung } = require('../services/onboardingEmails');
const crypto = require('crypto');
const saasSettings = require('../services/saasSettingsService');
const { syncPlanFeatures } = require('../middleware/featureAccess');

/**
 * Dojo Onboarding Routes (SaaS Multi-Tenant Registration)
 * Ermöglicht neuen Dojos sich als Kunden zu registrieren
 */

// ============================================
// 1. CHECK SUBDOMAIN AVAILABILITY
// ============================================
router.get('/check-subdomain/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params;

    // Validierung: Nur Kleinbuchstaben, Zahlen und Bindestriche, 3-30 Zeichen
    if (!/^[a-z0-9-]{3,30}$/.test(subdomain)) {
      return res.json({
        available: false,
        reason: 'Ung\u00fcltiges Format. Nur Kleinbuchstaben, Zahlen und Bindestriche (3-30 Zeichen)'
      });
    }

    // Reservierte Subdomains
    const reserved = [
      'www', 'api', 'admin', 'app', 'mail', 'ftp', 'smtp', 'pop', 'imap',
      'support', 'help', 'docs', 'blog', 'shop', 'store', 'cdn', 'static',
      'assets', 'download', 'upload', 'test', 'staging', 'dev', 'demo'
    ];

    if (reserved.includes(subdomain.toLowerCase())) {
      return res.json({
        available: false,
        reason: 'Diese Subdomain ist reserviert'
      });
    }

    // Pr\u00fcfe ob bereits vergeben
    try {
      const [existing] = await db.promise().query(
        'SELECT subdomain FROM dojo_subscriptions WHERE subdomain = ?',
        [subdomain.toLowerCase()]
      );

      if (existing.length > 0) {
        return res.json({
          available: false,
          reason: 'Diese Subdomain ist bereits vergeben'
        });
      }

      // Verf\u00fcgbar!
      res.json({ available: true });
    } catch (dbError) {
      logger.error('Datenbankfehler bei Subdomain-Check:', { error: dbError });
      // Falls die Tabelle nicht existiert, zurückgeben dass die Subdomain verfügbar ist (für erste Registrierungen)
      if (dbError.code === 'ER_NO_SUCH_TABLE') {
        logger.warn('Tabelle dojo_subscriptions existiert nicht. Rücke Fallback-Verhalten.');
        res.json({ available: true });
      } else {
        throw dbError; // Andere DB-Fehler weiterwerfen
      }
    }

  } catch (error) {
    logger.error('Fehler bei Subdomain-Check:', { error: error });
    res.status(500).json({
      available: false,
      error: error.message || 'Serverfehler bei der Pr\u00fcfung',
      reason: error.message || 'Serverfehler bei der Pr\u00fcfung'
    });
  }
});

// ============================================
// 2. REGISTER NEW DOJO
// ============================================
router.post('/register-dojo', async (req, res) => {
  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const {
      dojo_name,
      subdomain,
      owner_name,
      owner_email,
      password,
      phone,
      selected_plan // 'starter', 'professional', 'premium', 'enterprise'
    } = req.body;

    // ===== VALIDIERUNG =====
    if (!dojo_name || !subdomain || !owner_email || !password) {
      throw new Error('Pflichtfelder fehlen (Dojo-Name, Subdomain, Email, Passwort)');
    }

    // Email-Format pr\u00fcfen
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(owner_email)) {
      throw new Error('Ung\u00fcltige E-Mail-Adresse');
    }

    // Passwort-L\u00e4nge
    if (password.length < 8) {
      throw new Error('Passwort muss mindestens 8 Zeichen lang sein');
    }

    // Subdomain-Format
    if (!/^[a-z0-9-]{3,30}$/.test(subdomain)) {
      throw new Error('Ung\u00fcltiges Subdomain-Format');
    }

    // Pr\u00fcfe nochmal ob Subdomain verf\u00fcgbar
    const [existingSubdomain] = await connection.query(
      'SELECT subdomain FROM dojo_subscriptions WHERE subdomain = ?',
      [subdomain.toLowerCase()]
    );

    if (existingSubdomain.length > 0) {
      throw new Error('Subdomain bereits vergeben');
    }

    // Pr\u00fcfe ob Email bereits existiert
    const [existingEmail] = await connection.query(
      'SELECT email FROM admin_users WHERE email = ?',
      [owner_email.toLowerCase()]
    );

    if (existingEmail.length > 0) {
      throw new Error('Ein Account mit dieser E-Mail-Adresse existiert bereits');
    }

    // ===== PLAN-DETAILS LADEN =====
    const planName = selected_plan || 'starter'; // Default: Starter
    const [planDetails] = await connection.query(
      'SELECT * FROM subscription_plans WHERE plan_name = ? AND is_visible = TRUE',
      [planName]
    );

    if (planDetails.length === 0) {
      throw new Error('Ung\u00fcltiger Plan gew\u00e4hlt');
    }

    const plan = planDetails[0];

    // ===== 1. ERSTELLE DOJO =====
    const [dojoResult] = await connection.query(
      `INSERT INTO dojo (dojoname, subdomain, inhaber, telefon, email,
                         onboarding_completed, registration_date)
       VALUES (?, ?, ?, ?, ?, FALSE, NOW())`,
      [dojo_name, subdomain.toLowerCase(), owner_name || 'Admin', phone || '', owner_email.toLowerCase()]
    );

    const dojo_id = dojoResult.insertId;
    logger.info('Dojo erstellt: ${dojo_name} (ID: ${dojo_id})');

    // ===== 2. ERSTELLE SUBSCRIPTION (Trial-Phase) =====
    const trialDurationDays = await saasSettings.getTrialDurationDays();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDurationDays);

    await connection.query(
      `INSERT INTO dojo_subscriptions
       (dojo_id, subdomain, plan_type, status,
        feature_verkauf, feature_buchfuehrung, feature_events, feature_multidojo, feature_api,
        max_members, max_dojos, storage_limit_mb,
        trial_ends_at, monthly_price, billing_interval, billing_email)
       VALUES (?, ?, 'trial', 'trial', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'monthly', ?)`,
      [
        dojo_id,
        subdomain.toLowerCase(),
        plan.feature_verkauf,
        plan.feature_buchfuehrung,
        plan.feature_events,
        plan.feature_multidojo,
        plan.feature_api,
        plan.max_members,
        plan.max_dojos,
        plan.storage_limit_mb,
        trialEndsAt,
        plan.price_monthly,
        owner_email.toLowerCase()
      ]
    );

    logger.info('Subscription erstellt', { plan: planName, trialEndsAt: trialEndsAt.toISOString().split('T')[0] });

    // ===== 3. ERSTELLE ADMIN-USER (Owner) =====
    const hashedPassword = await bcrypt.hash(password, 10);

    // Split owner_name into vorname/nachname (falls vorhanden)
    const nameParts = (owner_name || 'Admin').trim().split(' ');
    const vorname = nameParts[0] || 'Admin';
    const nachname = nameParts.slice(1).join(' ') || '';

    await connection.query(
      `INSERT INTO admin_users (dojo_id, username, vorname, nachname, email, password, rolle, email_verifiziert, aktiv)
       VALUES (?, ?, ?, ?, ?, ?, 'admin', FALSE, TRUE)`,
      [dojo_id, owner_email.toLowerCase().split('@')[0], vorname, nachname, owner_email.toLowerCase(), hashedPassword]
    );

    logger.info('Admin-User erstellt: ${owner_email}');

    // ===== 3c. HAUPTSTANDORT ANLEGEN =====
    // Pflicht-STRUKTUR (kein Inhalts-Seed wie Stile/Gürtel/Tarife): Räume und Kurse
    // brauchen zwingend einen Hauptstandort. Ohne ihn scheitert das allererste Anlegen
    // eines Raums/Kurses mit "Kein Hauptstandort gefunden" (raeume.js/kurse.js). Jedes
    // bestehende Dojo hat genau einen — neue bekommen ihn jetzt automatisch bei Registrierung.
    await connection.query(
      `INSERT INTO standorte (dojo_id, name, ist_hauptstandort, telefon, email)
       VALUES (?, ?, TRUE, ?, ?)`,
      [dojo_id, `${dojo_name} - Hauptstandort`, phone || null, owner_email.toLowerCase()]
    );
    logger.info(`Hauptstandort erstellt für Dojo ${dojo_id}`);

    // ===== 3b. VERBANDSMITGLIED VERKNÜPFEN (falls vorhanden) =====
    // Prüfen ob ein Verbandsmitglied mit gleicher Email existiert
    const [verbandsMitglieder] = await connection.query(
      `SELECT id FROM verbandsmitgliedschaften
       WHERE (person_email = ? OR dojo_email = ?) AND dojo_id IS NULL`,
      [owner_email.toLowerCase(), owner_email.toLowerCase()]
    );

    if (verbandsMitglieder.length > 0) {
      // Automatische Verknüpfung herstellen
      await connection.query(
        `UPDATE verbandsmitgliedschaften SET dojo_id = ? WHERE id = ?`,
        [dojo_id, verbandsMitglieder[0].id]
      );
      logger.info(`Verbandsmitglied ${verbandsMitglieder[0].id} automatisch mit Dojo ${dojo_id} verknüpft`);
    }

    // ===== 4. KEINE INITIALEN DATEN (Policy) =====
    // Neue Dojos/Subdomains starten KOMPLETT LEER — keine Default-Stile/Gürtel/Tarife.
    // Der Inhaber legt Inhalte selbst an (dojo-gescoped). Der frühere Seed
    // (initializeDojoDefaults) wurde entfernt: er nutzte nicht-existente Tabellen
    // (gurte, zahlungszyklen) + falsche tarife-Spalten (preis/laufzeit_typ).

    // ===== 5. AUDIT-LOG =====
    const [subscription] = await connection.query(
      'SELECT subscription_id FROM dojo_subscriptions WHERE dojo_id = ?',
      [dojo_id]
    );

    await connection.query(
      `INSERT INTO subscription_audit_log
       (subscription_id, dojo_id, action, new_plan, reason)
       VALUES (?, ?, 'created', ?, 'Neue Dojo-Registrierung')`,
      [subscription[0].subscription_id, dojo_id, planName]
    );

    // ===== COMMIT =====
    await connection.commit();

    // Trial = volle Testphase: ALLE Features freischalten (syncPlanFeatures mappt 'trial' → enterprise).
    // plan_type bleibt 'trial' — nur die feature_* Spalten werden auf Enterprise-Niveau gesetzt,
    // damit auch das Frontend (das die Flags liest) im Trial alles anzeigt. Der gewählte Plan
    // (planName) greift erst bei der echten Aktivierung nach dem Trial.
    await syncPlanFeatures(dojo_id, 'trial', { updatePlanType: false });

    // ===== Early Bird Promo Registrierung (im Backend – zuverlässig) =====
    try {
      const PROMO_NAME = 'early-bird-2026';
      const PROMO_MAX = 50;
      const PROMO_START_COUNT = 9; // Simulierte Vorab-Registrierungen

      await db.promise().query(`
        CREATE TABLE IF NOT EXISTS promo_registrations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          promo_name VARCHAR(100) NOT NULL,
          dojo_id INT,
          registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          discount_percent INT DEFAULT 50,
          discount_months INT DEFAULT 12,
          free_months INT DEFAULT 2,
          UNIQUE KEY unique_dojo_promo (dojo_id, promo_name)
        )
      `);

      const [promoCount] = await db.promise().query(
        'SELECT COUNT(*) as count FROM promo_registrations WHERE promo_name = ?',
        [PROMO_NAME]
      );

      if (promoCount[0].count + PROMO_START_COUNT < PROMO_MAX) {
        await db.promise().query(
          `INSERT IGNORE INTO promo_registrations
           (promo_name, dojo_id, discount_percent, discount_months, free_months)
           VALUES (?, ?, 50, 12, 2)`,
          [PROMO_NAME, dojo_id]
        );
        logger.info(`✅ Early Bird Promo registriert für Dojo ${dojo_id} (${dojo_name})`);
      }
    } catch (promoErr) {
      logger.warn('⚠️ Early Bird Promo-Registrierung fehlgeschlagen (Dojo wurde trotzdem angelegt):', promoErr.message);
    }

    // ===== Super-Admin Benachrichtigung =====
    try {
      await db.promise().query(`
        INSERT INTO super_admin_notifications (typ, titel, nachricht, prioritaet, empfaenger_typ)
        VALUES ('dojo_registriert', 'Neues Dojo registriert', ?, 'wichtig', 'admin')
      `, [`${dojo_name} hat sich registriert (${subdomain}.dojo.tda-intl.org) - Inhaber: ${owner_name || owner_email}`]);
      logger.info('📬 Super-Admin Benachrichtigung erstellt für neues Dojo');
    } catch (notifErr) {
      logger.warn('⚠️ Super-Admin Benachrichtigung konnte nicht erstellt werden:', notifErr.message);
    }

    // Willkommens-Email senden
    try {
      await sendWelcomeEmail(owner_email, {
        dojoName: dojo_name,
        adminName: owner_name,
        subdomain: subdomain,
        loginUrl: `https://${subdomain}.dojo.tda-intl.org/login`
      });
      logger.info(`Willkommens-Email gesendet an ${owner_email}`);
    } catch (emailErr) {
      logger.warn(`Willkommens-Email konnte nicht gesendet werden: ${emailErr.message}`);
    }

    // Kurzanleitung "Mitglieder anlegen" senden (nicht blockierend)
    try {
      await sendMitgliederAnleitung({ to: owner_email, name: owner_name, dojoName: dojo_name });
      logger.info(`Mitglieder-Anleitung gesendet an ${owner_email}`);
    } catch (anleitungErr) {
      logger.warn(`Mitglieder-Anleitung konnte nicht gesendet werden: ${anleitungErr.message}`);
    }

    // Verifikations-Email senden
    try {
      const [[newUser]] = await db.promise().query(
        'SELECT id FROM admin_users WHERE email = ? AND dojo_id = ?',
        [owner_email.toLowerCase(), dojo_id]
      );
      if (newUser) {
        const verificationToken = crypto.randomBytes(32).toString('hex');
        await db.promise().query(
          `INSERT INTO email_verification_tokens (admin_user_id, token, expires_at)
           VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
          [newUser.id, verificationToken]
        );
        const verificationUrl = `https://${subdomain}.dojo.tda-intl.org/verify-email?token=${verificationToken}`;
        await sendVerificationEmail(owner_email, {
          name: owner_name,
          verificationToken,
          verificationUrl
        });
        logger.info(`Verifikations-Email gesendet an ${owner_email}`);
      }
    } catch (verifyErr) {
      logger.warn(`Verifikations-Email konnte nicht gesendet werden: ${verifyErr.message}`);
    }

    // ===== ERFOLG! =====
    res.status(201).json({
      success: true,
      dojo_id,
      subdomain,
      login_url: `https://${subdomain}.dojo.tda-intl.org/login`,
      message: 'Dojo erfolgreich registriert! Willkommens-Email wurde versendet.',
      trial_ends_at: trialEndsAt.toISOString().split('T')[0]
    });

  } catch (error) {
    await connection.rollback();
    logger.error('Registrierungsfehler:', error);

    res.status(400).json({
      success: false,
      error: error.message || 'Registrierung fehlgeschlagen'
    });

  } finally {
    connection.release();
  }
});


// ============================================
// 4. GET PLAN DETAILS (f\u00fcr Pricing-Page)
// ============================================
router.get('/plans', async (req, res) => {
  try {
    const [plans] = await db.promise().query(
      `SELECT plan_name, display_name, description,
              price_monthly, price_yearly,
              feature_verkauf, feature_buchfuehrung, feature_events,
              feature_multidojo, feature_api,
              max_members, max_dojos, storage_limit_mb,
              sort_order
       FROM subscription_plans
       WHERE is_visible = TRUE AND is_deprecated = FALSE
       ORDER BY sort_order ASC`
    );

    res.json({ plans });

  } catch (error) {
    logger.error('Fehler beim Laden der Pl\u00e4ne:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der Pl\u00e4ne' });
  }
});

module.exports = router;
