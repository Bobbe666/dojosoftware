// =====================================================================================
// HOMEPAGE BUILDER ROUTES — Enterprise Feature
// =====================================================================================
// GET  /api/homepage/config           → Homepage-Konfiguration des Dojos laden
// PUT  /api/homepage/config           → Konfiguration speichern
// POST /api/homepage/publish          → Publizieren / Depublizieren
// GET  /api/homepage/slug-check/:slug → Slug-Verfügbarkeit prüfen
// GET  /api/homepage/public/:slug     → Öffentlicher Endpunkt (kein Auth)

const express = require('express');
const router = express.Router();
const db = require('../db');
const pool = db.promise();
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const multer = require('multer');
const fs = require('fs');
const pathModule = require('path');

// ─── Logo-Upload Konfiguration ───────────────────────────────────────────────
const logoUploadDir = pathModule.join(__dirname, '../uploads/logos');
if (!fs.existsSync(logoUploadDir)) fs.mkdirSync(logoUploadDir, { recursive: true });

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, logoUploadDir),
  filename: (req, file, cb) => {
    const ext = pathModule.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `homepage-logo-${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`);
  }
});
const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|gif|webp|svg\+xml)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Nur Bilddateien erlaubt'), false);
  }
});

// ─── Standard-Konfiguration ─────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  school_name: '',
  school_subtitle: 'Mitglied der TDA International',
  logo_kanji: '武',
  tagline: 'Der Weg beginnt mit dem ersten Schritt',
  primary_color: '#DC143C',
  gold_color: '#c9a227',
  hero_cta_primary: { text: 'Probetraining', href: '#kontakt' },
  hero_cta_secondary: { text: 'Unsere Kurse', href: '#stile' },
  contact: {
    address: '',
    email: '',
    phone: '',
  },
  nav_items: [
    { id: '1', label: 'Kampfkunststile', href: '#stile' },
    { id: '2', label: 'Stundenplan', href: '#stundenplan' },
    { id: '3', label: 'Trainer', href: '#trainer' },
    { id: '4', label: 'Events', href: '#events' },
    { id: '5', label: 'Über uns', href: '#ueber-uns' },
  ],
  sections: [
    { id: 'hero', type: 'hero', visible: true, order: 1 },
    { id: 'stile', type: 'kampfkunststile', visible: true, order: 2 },
    { id: 'stundenplan', type: 'stundenplan_preview', visible: true, order: 3 },
    { id: 'werte', type: 'werte', visible: true, order: 4 },
    { id: 'cta', type: 'cta', visible: true, order: 5 },
  ],
  stile: [
    { name: 'Karate', kanji: '空手道', japanese: 'Enso Karate-Dō', icon: '🥋', color: '#DC143C' },
    { name: 'Kickboxen', kanji: 'キックボクシング', japanese: 'Kikku-bokushingu', icon: '🥊', color: '#264653' },
    { name: 'ShieldX', kanji: 'シールドX', japanese: 'Jikoboei', icon: '🛡️', color: '#c9a227' },
    { name: 'Brazilian Jiu-Jitsu', kanji: '柔術', japanese: 'Jūjutsu', icon: '🤼', color: '#5c6b4c' },
  ],
  werte: [
    { kanji: '礼', reading: 'Rei', name: 'Respekt', text: 'Höflichkeit und Achtung im Umgang miteinander.' },
    { kanji: '誠', reading: 'Makoto', name: 'Aufrichtigkeit', text: 'Ehrlichkeit in Wort und Tat.' },
    { kanji: '忍', reading: 'Nin', name: 'Beharrlichkeit', text: 'Geduld und Beständigkeit auf dem Weg.' },
  ],
  cta: {
    title: 'Beginne deinen Weg',
    text: 'Das erste Probetraining ist kostenlos und unverbindlich.',
    button_text: 'Probetraining vereinbaren',
    button_href: '#kontakt',
  },
};

// ─── Slug generieren ─────────────────────────────────────────────────────────

function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

// ─── Feature-Check Middleware ─────────────────────────────────────────────────

async function requireHomepageFeature(req, res, next) {
  try {
    const dojoId = req.user?.dojo_id;
    if (!dojoId && req.user?.rolle !== 'super_admin' && req.user?.role !== 'super_admin') {
      return next(); // Super-Admin darf immer
    }

    if (dojoId) {
      const [rows] = await pool.query(
        'SELECT feature_homepage_builder, plan_type FROM dojo_subscriptions WHERE dojo_id = ?',
        [dojoId]
      );
      if (rows.length === 0 || (!rows[0].feature_homepage_builder && rows[0].plan_type !== 'enterprise')) {
        return res.status(403).json({
          error: 'Feature nicht verfügbar',
          message: 'Der Homepage Builder ist nur im Enterprise-Plan verfügbar.',
          feature: 'homepage_builder',
          required_plan: 'enterprise',
        });
      }
    }
    next();
  } catch (err) {
    logger.error('Homepage-Feature-Check Fehler:', { error: err.message });
    next();
  }
}

// ─── ÖFFENTLICHER ENDPUNKT ────────────────────────────────────────────────────
// GET /api/homepage/public/:slug
// Kein Auth benötigt — gibt nur publizierte Homepages zurück

router.get('/public/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({ error: 'Ungültiger Slug' });
    }

    const [rows] = await pool.query(
      `SELECT dh.config, dh.slug, dh.dojo_id, d.dojoname
       FROM dojo_homepage dh
       JOIN dojo d ON dh.dojo_id = d.id
       WHERE dh.slug = ? AND dh.is_published = 1`,
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Homepage nicht gefunden',
        message: 'Diese Homepage existiert nicht oder ist noch nicht publiziert.',
      });
    }

    const row = rows[0];
    const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;

    res.json({
      slug: row.slug,
      dojo_id: row.dojo_id,
      dojoname: row.dojoname,
      config,
    });
  } catch (err) {
    logger.error('Öffentliche Homepage Fehler:', { error: err.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ─── GESCHÜTZTE ENDPUNKTE ─────────────────────────────────────────────────────

// GET /api/homepage/config
// Konfiguration des Dojos laden (oder Defaults wenn noch keine angelegt)
router.get('/config', authenticateToken, requireHomepageFeature, async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) {
      return res.status(400).json({ error: 'Keine Dojo-ID' });
    }

    // Dojo-Name für automatischen Slug-Vorschlag
    const [dojoRows] = await pool.query(
      'SELECT dojoname FROM dojo WHERE id = ?',
      [dojoId]
    );
    const dojoName = dojoRows[0]?.dojoname || '';

    const [rows] = await pool.query(
      'SELECT * FROM dojo_homepage WHERE dojo_id = ?',
      [dojoId]
    );

    if (rows.length === 0) {
      // Automatischer Slug-Vorschlag aus Dojoname
      const suggestedSlug = generateSlug(dojoName) || `dojo-${dojoId}`;

      // Prüfen ob Slug frei ist
      const [slugCheck] = await pool.query(
        'SELECT id FROM dojo_homepage WHERE slug = ?',
        [suggestedSlug]
      );
      const finalSlug = slugCheck.length > 0 ? `${suggestedSlug}-${dojoId}` : suggestedSlug;

      return res.json({
        exists: false,
        slug: finalSlug,
        is_published: false,
        config: {
          ...DEFAULT_CONFIG,
          school_name: dojoName,
        },
      });
    }

    const row = rows[0];
    const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;

    res.json({
      exists: true,
      slug: row.slug,
      is_published: !!row.is_published,
      config: { ...DEFAULT_CONFIG, ...config },
    });
  } catch (err) {
    logger.error('Homepage Config laden Fehler:', { error: err.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// PUT /api/homepage/config
// Konfiguration speichern (erstellt Eintrag wenn noch nicht vorhanden)
router.put('/config', authenticateToken, requireHomepageFeature, async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) {
      return res.status(400).json({ error: 'Keine Dojo-ID' });
    }

    const { config, slug } = req.body;

    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Ungültige Konfiguration' });
    }

    // Slug validieren und bereinigen
    const cleanSlug = slug ? generateSlug(slug) : null;
    if (cleanSlug && cleanSlug.length < 2) {
      return res.status(400).json({ error: 'Slug zu kurz (mind. 2 Zeichen)' });
    }

    // Prüfen ob Slug schon von anderem Dojo belegt ist
    if (cleanSlug) {
      const [slugCheck] = await pool.query(
        'SELECT dojo_id FROM dojo_homepage WHERE slug = ? AND dojo_id != ?',
        [cleanSlug, dojoId]
      );
      if (slugCheck.length > 0) {
        return res.status(409).json({
          error: 'Slug bereits vergeben',
          message: 'Dieser URL-Name wird bereits von einem anderen Dojo verwendet.',
        });
      }
    }

    const [existing] = await pool.query(
      'SELECT id, slug FROM dojo_homepage WHERE dojo_id = ?',
      [dojoId]
    );

    if (existing.length === 0) {
      // Neuen Eintrag erstellen
      const finalSlug = cleanSlug || generateSlug(config.school_name || '') || `dojo-${dojoId}`;
      await pool.query(
        'INSERT INTO dojo_homepage (dojo_id, slug, config) VALUES (?, ?, ?)',
        [dojoId, finalSlug, JSON.stringify(config)]
      );
      res.json({ success: true, slug: finalSlug, message: 'Homepage erstellt' });
    } else {
      // Bestehenden Eintrag updaten
      const finalSlug = cleanSlug || existing[0].slug;
      await pool.query(
        'UPDATE dojo_homepage SET config = ?, slug = ? WHERE dojo_id = ?',
        [JSON.stringify(config), finalSlug, dojoId]
      );
      res.json({ success: true, slug: finalSlug, message: 'Homepage gespeichert' });
    }
  } catch (err) {
    logger.error('Homepage Config speichern Fehler:', { error: err.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/homepage/publish
// Homepage publizieren oder depublizieren
router.post('/publish', authenticateToken, requireHomepageFeature, async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) {
      return res.status(400).json({ error: 'Keine Dojo-ID' });
    }

    const { publish } = req.body; // true = publizieren, false = depublizieren

    const [rows] = await pool.query(
      'SELECT id, slug, is_published FROM dojo_homepage WHERE dojo_id = ?',
      [dojoId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Homepage nicht gefunden',
        message: 'Bitte zuerst die Homepage speichern.',
      });
    }

    const newStatus = publish ? 1 : 0;
    await pool.query(
      'UPDATE dojo_homepage SET is_published = ? WHERE dojo_id = ?',
      [newStatus, dojoId]
    );

    logger.info('Homepage Status geändert', {
      dojo_id: dojoId,
      slug: rows[0].slug,
      published: !!newStatus,
    });

    res.json({
      success: true,
      is_published: !!newStatus,
      slug: rows[0].slug,
      public_url: newStatus ? `/site/${rows[0].slug}` : null,
      message: newStatus ? 'Homepage ist jetzt öffentlich erreichbar' : 'Homepage wurde depubliziert',
    });
  } catch (err) {
    logger.error('Homepage publish Fehler:', { error: err.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/homepage/slug-check/:slug
// Prüft ob ein Slug noch verfügbar ist
router.get('/slug-check/:slug', authenticateToken, async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    const { slug } = req.params;
    const cleanSlug = generateSlug(slug);

    if (!cleanSlug || cleanSlug.length < 2) {
      return res.json({ available: false, slug: cleanSlug, reason: 'Zu kurz' });
    }

    const [rows] = await pool.query(
      'SELECT dojo_id FROM dojo_homepage WHERE slug = ?',
      [cleanSlug]
    );

    const available = rows.length === 0 || (rows.length === 1 && rows[0].dojo_id === dojoId);

    res.json({
      available,
      slug: cleanSlug,
      reason: available ? null : 'Bereits vergeben',
    });
  } catch (err) {
    logger.error('Slug-Check Fehler:', { error: err.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/homepage/preview
// Auth-geschützte Preview: gibt Config zurück unabhängig von is_published
router.get('/preview', authenticateToken, requireHomepageFeature, async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) {
      return res.status(400).json({ error: 'Keine Dojo-ID' });
    }

    const [dojoRows] = await pool.query('SELECT dojoname FROM dojo WHERE id = ?', [dojoId]);
    const dojoName = dojoRows[0]?.dojoname || '';

    const [rows] = await pool.query('SELECT * FROM dojo_homepage WHERE dojo_id = ?', [dojoId]);

    if (rows.length === 0) {
      const suggestedSlug = generateSlug(dojoName) || `dojo-${dojoId}`;
      return res.json({
        exists: false,
        slug: suggestedSlug,
        is_published: false,
        dojo_id: dojoId,
        dojoname: dojoName,
        config: { ...DEFAULT_CONFIG, school_name: dojoName },
      });
    }

    const row = rows[0];
    const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;

    res.json({
      exists: true,
      slug: row.slug,
      is_published: !!row.is_published,
      dojo_id: dojoId,
      dojoname: dojoName,
      config: { ...DEFAULT_CONFIG, ...config },
    });
  } catch (err) {
    logger.error('Homepage Preview Fehler:', { error: err.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/homepage/logo
// Logo-Bild hochladen → gibt URL zurück
router.post('/logo', authenticateToken, requireHomepageFeature, logoUpload.single('logo'), async (req, res) => {
  try {
    const dojoId = getSecureDojoId(req);
    if (!dojoId) {
      return res.status(400).json({ error: 'Keine Dojo-ID' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Kein Bild hochgeladen' });
    }
    const url = `/uploads/logos/${req.file.filename}`;
    res.json({ success: true, url });
  } catch (err) {
    logger.error('Logo-Upload Fehler:', { error: err.message });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
