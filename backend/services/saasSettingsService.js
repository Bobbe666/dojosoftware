/**
 * SaaS Settings Service
 * Zentrale Verwaltung aller SaaS-Einstellungen mit Caching
 */

const db = require('../db');
const logger = require('../utils/logger');

// In-Memory Cache für schnellen Zugriff
let settingsCache = null;
let cacheTimestamp = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 Minuten Cache

/**
 * Lädt alle Settings aus der Datenbank
 */
async function loadAllSettings() {
  try {
    const [rows] = await db.promise().query(
      'SELECT setting_key, setting_value, setting_type, category, is_secret FROM saas_settings'
    );

    const settings = {};
    for (const row of rows) {
      settings[row.setting_key] = {
        value: parseValue(row.setting_value, row.setting_type),
        type: row.setting_type,
        category: row.category,
        isSecret: row.is_secret
      };
    }

    settingsCache = settings;
    cacheTimestamp = Date.now();
    logger.debug('SaaS Settings geladen', { count: rows.length });

    return settings;
  } catch (error) {
    logger.error('Fehler beim Laden der SaaS Settings:', error.message);
    return {};
  }
}

/**
 * Parst den Wert basierend auf dem Typ
 */
function parseValue(value, type) {
  if (value === null || value === undefined) return null;

  switch (type) {
    case 'number':
      return parseFloat(value);
    case 'boolean':
      return value === 'true' || value === '1' || value === true;
    case 'json':
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
}

/**
 * Serialisiert den Wert für die Datenbank
 */
function serializeValue(value, type) {
  if (value === null || value === undefined) return null;

  switch (type) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'json':
      return typeof value === 'string' ? value : JSON.stringify(value);
    default:
      return String(value);
  }
}

/**
 * Holt eine einzelne Einstellung
 */
async function getSetting(key, defaultValue = null) {
  // Cache prüfen
  if (settingsCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_TTL_MS)) {
    const cached = settingsCache[key];
    return cached ? cached.value : defaultValue;
  }

  // Cache neu laden
  await loadAllSettings();

  const setting = settingsCache?.[key];
  return setting ? setting.value : defaultValue;
}

/**
 * Holt mehrere Einstellungen auf einmal
 */
async function getSettings(keys) {
  if (!settingsCache || !cacheTimestamp || (Date.now() - cacheTimestamp >= CACHE_TTL_MS)) {
    await loadAllSettings();
  }

  const result = {};
  for (const key of keys) {
    const setting = settingsCache?.[key];
    result[key] = setting ? setting.value : null;
  }
  return result;
}

/**
 * Holt alle Einstellungen einer Kategorie
 */
async function getSettingsByCategory(category) {
  if (!settingsCache || !cacheTimestamp || (Date.now() - cacheTimestamp >= CACHE_TTL_MS)) {
    await loadAllSettings();
  }

  const result = {};
  for (const [key, data] of Object.entries(settingsCache || {})) {
    if (data.category === category) {
      result[key] = data.value;
    }
  }
  return result;
}

/**
 * Setzt eine Einstellung
 */
async function setSetting(key, value) {
  try {
    // Typ aus Cache oder DB holen
    let type = 'string';
    if (settingsCache?.[key]) {
      type = settingsCache[key].type;
    } else {
      const [rows] = await db.promise().query(
        'SELECT setting_type FROM saas_settings WHERE setting_key = ?',
        [key]
      );
      if (rows.length > 0) {
        type = rows[0].setting_type;
      }
    }

    const serialized = serializeValue(value, type);

    await db.promise().query(
      `INSERT INTO saas_settings (setting_key, setting_value, setting_type)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`,
      [key, serialized, type, serialized]
    );

    // Cache invalidieren
    invalidateCache();

    logger.info('SaaS Setting aktualisiert', { key });
    return true;
  } catch (error) {
    logger.error('Fehler beim Setzen der SaaS Setting:', { key, error: error.message });
    return false;
  }
}

/**
 * Setzt mehrere Einstellungen auf einmal
 */
async function setSettings(settings) {
  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    for (const [key, value] of Object.entries(settings)) {
      let type = 'string';
      if (settingsCache?.[key]) {
        type = settingsCache[key].type;
      }

      const serialized = serializeValue(value, type);

      await connection.query(
        `UPDATE saas_settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ?`,
        [serialized, key]
      );
    }

    await connection.commit();
    invalidateCache();

    logger.info('SaaS Settings aktualisiert', { count: Object.keys(settings).length });
    return true;
  } catch (error) {
    await connection.rollback();
    logger.error('Fehler beim Setzen der SaaS Settings:', error.message);
    return false;
  } finally {
    connection.release();
  }
}

/**
 * Invalidiert den Cache
 */
function invalidateCache() {
  settingsCache = null;
  cacheTimestamp = null;
}

/**
 * Holt alle Settings für Admin-UI (ohne Secret-Werte)
 */
async function getAllSettingsForAdmin() {
  try {
    const [rows] = await db.promise().query(
      `SELECT setting_key, setting_value, setting_type, category, description, display_name, is_secret, updated_at
       FROM saas_settings
       ORDER BY category, setting_key`
    );

    return rows.map(row => ({
      key: row.setting_key,
      displayName: row.display_name || row.setting_key,
      value: row.is_secret ? (row.setting_value ? '********' : null) : parseValue(row.setting_value, row.setting_type),
      type: row.setting_type,
      category: row.category,
      description: row.description,
      isSecret: row.is_secret,
      updatedAt: row.updated_at
    }));
  } catch (error) {
    logger.error('Fehler beim Laden der Admin Settings:', error.message);
    return [];
  }
}

// =============================================
// CONVENIENCE GETTERS
// =============================================

async function getStripeSettings() {
  return getSettingsByCategory('stripe');
}

async function getTrialSettings() {
  return getSettingsByCategory('trial');
}

async function getEmailSettings() {
  return getSettingsByCategory('email');
}

async function getBrandingSettings() {
  return getSettingsByCategory('branding');
}

async function getLimitsSettings() {
  return getSettingsByCategory('limits');
}

async function getPricingSettings() {
  return getSettingsByCategory('pricing');
}

async function isMaintenanceMode() {
  return getSetting('maintenance_mode', false);
}

async function isRegistrationEnabled() {
  return getSetting('registration_enabled', true);
}

async function getTrialDurationDays() {
  return getSetting('trial_duration_days', 14);
}

async function getAdminEmail() {
  return getSetting('admin_notification_email', 'admin@tda-intl.org');
}

module.exports = {
  // Core functions
  getSetting,
  getSettings,
  getSettingsByCategory,
  setSetting,
  setSettings,
  invalidateCache,
  loadAllSettings,
  getAllSettingsForAdmin,

  // Category getters
  getStripeSettings,
  getTrialSettings,
  getEmailSettings,
  getBrandingSettings,
  getLimitsSettings,
  getPricingSettings,

  // Convenience getters
  isMaintenanceMode,
  isRegistrationEnabled,
  getTrialDurationDays,
  getAdminEmail
};
