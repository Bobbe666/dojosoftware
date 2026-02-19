/**
 * Admin SaaS Settings Routes
 * Verwaltung der globalen SaaS-Einstellungen
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const { requireSuperAdmin } = require('./shared');
const saasSettings = require('../../services/saasSettingsService');

// Alle Routes erfordern Super-Admin
router.use(requireSuperAdmin);

// =============================================
// GET /api/admin/saas-settings
// Alle Einstellungen abrufen
// =============================================
router.get('/', async (req, res) => {
  try {
    const settings = await saasSettings.getAllSettingsForAdmin();

    // Nach Kategorien gruppieren
    const grouped = {};
    for (const setting of settings) {
      if (!grouped[setting.category]) {
        grouped[setting.category] = [];
      }
      grouped[setting.category].push(setting);
    }

    res.json({
      success: true,
      settings: grouped,
      categories: Object.keys(grouped)
    });
  } catch (error) {
    logger.error('Fehler beim Laden der SaaS Settings:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Einstellungen' });
  }
});

// =============================================
// GET /api/admin/saas-settings/category/:category
// Einstellungen einer Kategorie abrufen
// =============================================
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const settings = await saasSettings.getSettingsByCategory(category);

    res.json({
      success: true,
      category,
      settings
    });
  } catch (error) {
    logger.error('Fehler beim Laden der Kategorie:', error);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// =============================================
// PUT /api/admin/saas-settings
// Mehrere Einstellungen aktualisieren
// =============================================
router.put('/', async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings-Objekt erforderlich' });
    }

    // Leere Werte für Secrets ignorieren (damit ******** nicht gespeichert wird)
    const filteredSettings = {};
    for (const [key, value] of Object.entries(settings)) {
      if (value !== '********' && value !== '') {
        filteredSettings[key] = value;
      }
    }

    const success = await saasSettings.setSettings(filteredSettings);

    if (success) {
      logger.info('SaaS Settings durch Admin aktualisiert', {
        admin: req.user?.username,
        keys: Object.keys(filteredSettings)
      });

      res.json({
        success: true,
        message: `${Object.keys(filteredSettings).length} Einstellungen aktualisiert`
      });
    } else {
      res.status(500).json({ error: 'Fehler beim Speichern' });
    }
  } catch (error) {
    logger.error('Fehler beim Aktualisieren der SaaS Settings:', error);
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

// =============================================
// PUT /api/admin/saas-settings/:key
// Einzelne Einstellung aktualisieren
// =============================================
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    // Leere Secrets nicht überschreiben
    if (value === '********') {
      return res.json({ success: true, message: 'Keine Änderung (Secret unverändert)' });
    }

    const success = await saasSettings.setSetting(key, value);

    if (success) {
      logger.info('SaaS Setting aktualisiert', {
        admin: req.user?.username,
        key
      });

      res.json({ success: true, message: 'Einstellung gespeichert' });
    } else {
      res.status(500).json({ error: 'Fehler beim Speichern' });
    }
  } catch (error) {
    logger.error('Fehler beim Aktualisieren:', error);
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

// =============================================
// POST /api/admin/saas-settings/test-stripe
// Stripe-Verbindung testen
// =============================================
router.post('/test-stripe', async (req, res) => {
  try {
    const stripeSettings = await saasSettings.getStripeSettings();

    if (!stripeSettings.stripe_secret_key) {
      return res.json({
        success: false,
        message: 'Kein Stripe Secret Key konfiguriert'
      });
    }

    const Stripe = require('stripe');
    const stripe = new Stripe(stripeSettings.stripe_secret_key);

    // Teste die Verbindung durch Abrufen des Accounts
    const account = await stripe.accounts.retrieve();

    res.json({
      success: true,
      message: 'Stripe-Verbindung erfolgreich',
      mode: stripeSettings.stripe_test_mode ? 'Test' : 'Live',
      accountId: account.id
    });
  } catch (error) {
    logger.error('Stripe-Test fehlgeschlagen:', error);
    res.json({
      success: false,
      message: `Stripe-Fehler: ${error.message}`
    });
  }
});

// =============================================
// POST /api/admin/saas-settings/test-email
// Email-Verbindung testen
// =============================================
router.post('/test-email', async (req, res) => {
  try {
    const { sendEmail } = require('../../services/emailService');
    const adminEmail = await saasSettings.getAdminEmail();

    const result = await sendEmail({
      to: adminEmail,
      subject: 'DojoSoftware - Email-Test',
      text: 'Dies ist eine Test-Email von DojoSoftware SaaS.',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Email-Test erfolgreich!</h2>
          <p>Diese Test-Email wurde von den SaaS-Einstellungen gesendet.</p>
          <p>Zeitstempel: ${new Date().toLocaleString('de-DE')}</p>
        </div>
      `
    });

    res.json({
      success: result.success,
      message: result.success ? `Test-Email an ${adminEmail} gesendet` : result.error
    });
  } catch (error) {
    logger.error('Email-Test fehlgeschlagen:', error);
    res.json({
      success: false,
      message: `Email-Fehler: ${error.message}`
    });
  }
});

// =============================================
// POST /api/admin/saas-settings/clear-cache
// Cache leeren
// =============================================
router.post('/clear-cache', async (req, res) => {
  try {
    saasSettings.invalidateCache();
    await saasSettings.loadAllSettings();

    logger.info('SaaS Settings Cache geleert', { admin: req.user?.username });

    res.json({
      success: true,
      message: 'Cache geleert und neu geladen'
    });
  } catch (error) {
    logger.error('Cache-Clear fehlgeschlagen:', error);
    res.status(500).json({ error: 'Fehler beim Leeren des Cache' });
  }
});

module.exports = router;
