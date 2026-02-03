const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');

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
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14 Tage Trial

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
       VALUES (?, ?, ?, ?, ?, ?, 'admin', TRUE, TRUE)`,
      [dojo_id, owner_email.toLowerCase().split('@')[0], vorname, nachname, owner_email.toLowerCase(), hashedPassword]
    );

    logger.info('Admin-User erstellt: ${owner_email}');

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

    // ===== 4. ERSTELLE INITIALE DATEN =====
    // HINWEIS: Für lokale DB auskommentiert, da Stile/Gürtel/Tarife global sind
    // await initializeDojoDefaults(connection, dojo_id);

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

    // ===== ERFOLG! =====
    res.status(201).json({
      success: true,
      dojo_id,
      subdomain,
      login_url: `https://${subdomain}.dojo.tda-intl.org/login`,
      message: 'Dojo erfolgreich registriert! Willkommens-Email wurde versendet.',
      trial_ends_at: trialEndsAt.toISOString().split('T')[0]
    });

    // TODO: Sende Willkommens-Email
    // sendWelcomeEmail(owner_email, subdomain, dojo_name, trialEndsAt);

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
// 3. HILFSFUNKTION: Initiale Daten f\u00fcr neues Dojo
// ============================================
async function initializeDojoDefaults(connection, dojo_id) {
  logger.debug('📦 Erstelle Standard-Daten f\u00fcr Dojo ${dojo_id}...');

  // --- STANDARD-STILE ---
  const defaultStile = [
    'Karate',
    'Judo',
    'Taekwondo',
    'Aikido',
    'Kung Fu',
    'Kickboxen',
    'Brazilian Jiu-Jitsu',
    'Krav Maga'
  ];

  for (const stil of defaultStile) {
    await connection.query(
      'INSERT INTO stile (name, dojo_id) VALUES (?, ?)',
      [stil, dojo_id]
    );
  }

  // --- STANDARD-G\u00dcRTEL (Karate-System) ---
  const defaultGurte = [
    { name: '9. Kyu (Wei\u00dfgurt)', farbe: 'Wei\u00df', reihenfolge: 1 },
    { name: '8. Kyu (Gelbgurt)', farbe: 'Gelb', reihenfolge: 2 },
    { name: '7. Kyu (Orangegurt)', farbe: 'Orange', reihenfolge: 3 },
    { name: '6. Kyu (Gr\u00fcngurt)', farbe: 'Gr\u00fcn', reihenfolge: 4 },
    { name: '5. Kyu (Blaugurt)', farbe: 'Blau', reihenfolge: 5 },
    { name: '4. Kyu (Brauner Gurt 1)', farbe: 'Braun', reihenfolge: 6 },
    { name: '3. Kyu (Brauner Gurt 2)', farbe: 'Braun', reihenfolge: 7 },
    { name: '2. Kyu (Brauner Gurt 3)', farbe: 'Braun', reihenfolge: 8 },
    { name: '1. Kyu (Brauner Gurt 4)', farbe: 'Braun', reihenfolge: 9 },
    { name: '1. Dan (Schwarzgurt)', farbe: 'Schwarz', reihenfolge: 10 },
    { name: '2. Dan (Schwarzgurt)', farbe: 'Schwarz', reihenfolge: 11 },
    { name: '3. Dan (Schwarzgurt)', farbe: 'Schwarz', reihenfolge: 12 }
  ];

  for (const gurt of defaultGurte) {
    await connection.query(
      'INSERT INTO gurte (name, farbe, reihenfolge, dojo_id) VALUES (?, ?, ?, ?)',
      [gurt.name, gurt.farbe, gurt.reihenfolge, dojo_id]
    );
  }

  // --- STANDARD-TARIFE ---
  await connection.query(
    `INSERT INTO tarife (dojo_id, name, preis, laufzeit_typ, beschreibung) VALUES
     (?, 'Monatsbeitrag Erwachsene', 50.00, 'monatlich', 'Standardbeitrag f\u00fcr erwachsene Mitglieder'),
     (?, 'Monatsbeitrag Kinder', 35.00, 'monatlich', 'Erm\u00e4\u00dfigter Beitrag f\u00fcr Kinder bis 14 Jahre'),
     (?, 'Monatsbeitrag Jugend', 40.00, 'monatlich', 'Beitrag f\u00fcr Jugendliche 14-18 Jahre'),
     (?, '10er-Karte', 100.00, 'einmalig', 'Flexibles Training - 10 Einheiten g\u00fcltig 3 Monate')`,
    [dojo_id, dojo_id, dojo_id, dojo_id]
  );

  // --- STANDARD-ZAHLUNGSZYKLEN ---
  await connection.query(
    `INSERT INTO zahlungszyklen (dojo_id, name, intervall) VALUES
     (?, 'Monatlich', 'monatlich'),
     (?, 'Viertelj\u00e4hrlich', 'quartalsweise'),
     (?, 'Halbj\u00e4hrlich', 'halbjaehrlich'),
     (?, 'J\u00e4hrlich', 'jaehrlich')`,
    [dojo_id, dojo_id, dojo_id, dojo_id]
  );

  logger.info('Standard-Daten erstellt f\u00fcr Dojo ${dojo_id}');
}

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
