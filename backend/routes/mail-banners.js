// routes/mail-banners.js
// =============================================================================
// Zentrale Verwaltung der Mail-Banner für alle Apps (HOF, Dojo, Events) —
// nur Super-Admin. Banner liegen unter backend/uploads/mail-banners/ und sind
// über https://dojo.tda-intl.org/uploads/mail-banners/<datei> erreichbar.
//
// dojo_id: 0 = app-weites Banner (HOF/Events immer 0; Dojo-Default für alle Dojos).
//          >0 = Banner speziell für dieses Dojo (nur app='dojo', NUR Enterprise/Trial).
// Renderer-Fallback: Dojo X nutzt sein eigenes Banner, sonst das Dojo-Default (0).
//
// manifest.json (von allen App-Renderern gelesen): key = "<app>-<anlass>" (global)
// bzw. "<app>-<anlass>-d<dojoId>" (dojo-spezifisch).
// =============================================================================
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const pool = db.promise();
const logger = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

const superOnly = (req, res, next) => {
  const u = req.user || {};
  if (u.role === 'super_admin' || u.dojo_id === null) return next();
  return res.status(403).json({ error: 'Nur Super-Admin erlaubt' });
};
const requireSuperAdmin = [authenticateToken, superOnly];

const APPS = ['hof', 'dojo', 'events'];
const ANLAESSE = ['einladung', 'begruessung', 'rechnung', 'allgemein'];
// 'kuendigung' gilt nur für Dojo-Mitglieder-Mails (nicht hof/events/verband) → nur Upload erlaubt
const UPLOAD_ANLAESSE = [...ANLAESSE, 'kuendigung'];
const BANNER_DIR = path.join(__dirname, '../uploads/mail-banners');
const MANIFEST = path.join(BANNER_DIR, 'manifest.json');
const PUBLIC_BASE = process.env.MAIL_BANNER_BASE_URL || 'https://dojo.tda-intl.org/uploads/mail-banners';

if (!fs.existsSync(BANNER_DIR)) fs.mkdirSync(BANNER_DIR, { recursive: true });

pool.query(`
  CREATE TABLE IF NOT EXISTS mail_banner (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app VARCHAR(20) NOT NULL,
    anlass VARCHAR(20) NOT NULL,
    dojo_id INT NOT NULL DEFAULT 0,
    dateiname VARCHAR(255) NOT NULL,
    mime VARCHAR(60),
    groesse INT,
    hochgeladen_am DATETIME DEFAULT CURRENT_TIMESTAMP,
    hochgeladen_von VARCHAR(120),
    UNIQUE KEY uq_app_anlass_dojo (app, anlass, dojo_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(e => logger.error?.('[mailBanners] Tabelle:', e.message));

// Eigene Dojo-Banner = Enterprise-Feature (Trial zählt mit, hat alle Features).
// dojo_id 0 (Default/HOF/Events) ist immer erlaubt.
async function dojoMayBrand(dojoId) {
  if (!dojoId || dojoId <= 0) return true;
  try {
    const [[s]] = await pool.query('SELECT plan_type, status FROM dojo_subscriptions WHERE dojo_id=? LIMIT 1', [dojoId]);
    if (!s) return false;
    if (['suspended', 'cancelled', 'expired'].includes(s.status)) return false;
    return s.plan_type === 'enterprise' || s.status === 'trial';
  } catch { return false; }
}

function bannerFilename(app, anlass, dojoId, ext) {
  return dojoId > 0 ? `${app}-${anlass}-d${dojoId}${ext}` : `${app}-${anlass}${ext}`;
}
function manifestKey(app, anlass, dojoId) {
  return dojoId > 0 ? `${app}-${anlass}-d${dojoId}` : `${app}-${anlass}`;
}

async function writeManifest() {
  try {
    const [rows] = await pool.query('SELECT app, anlass, dojo_id, dateiname, mime, UNIX_TIMESTAMP(hochgeladen_am) AS ts FROM mail_banner');
    const m = {};
    for (const r of rows) {
      m[manifestKey(r.app, r.anlass, r.dojo_id)] = { datei: r.dateiname, url: `${PUBLIC_BASE}/${r.dateiname}`, mime: r.mime, ts: r.ts };
    }
    fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2));
  } catch (e) { logger.error?.('[mailBanners] manifest:', e.message); }
}

const dojoIdFrom = (req) => Math.max(0, parseInt(req.query.dojo_id ?? req.body?.dojo_id ?? '0', 10) || 0);

const storage = multer.diskStorage({
  destination: (req, file, cb) => { if (!fs.existsSync(BANNER_DIR)) fs.mkdirSync(BANNER_DIR, { recursive: true }); cb(null, BANNER_DIR); },
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.png').toLowerCase();
    cb(null, bannerFilename(req.params.app, req.params.anlass, dojoIdFrom(req), ext));
  }
});
const fileFilter = (req, file, cb) => {
  const ok = ['image/png', 'image/jpeg', 'image/jpg'].includes(file.mimetype);
  cb(ok ? null : new Error(`Ungültiges Format: ${file.mimetype}. Erlaubt: PNG, JPG (kein WebP — Outlook!)`), ok);
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } });

const validParams = (req, res, next) => {
  if (!APPS.includes(req.params.app)) return res.status(400).json({ error: 'Ungültige App' });
  if (!UPLOAD_ANLAESSE.includes(req.params.anlass)) return res.status(400).json({ error: 'Ungültiger Anlass' });
  if (dojoIdFrom(req) > 0 && req.params.app !== 'dojo') return res.status(400).json({ error: 'Dojo-spezifische Banner nur für app=dojo' });
  next();
};

// GET /api/mail-banners → alle Banner-Zeilen + Dojo-Liste (mit Plan) — UI baut Matrix
router.get('/', requireSuperAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT app, anlass, dojo_id, dateiname, groesse, hochgeladen_am, hochgeladen_von FROM mail_banner');
    const banners = rows.map(r => ({
      app: r.app, anlass: r.anlass, dojo_id: r.dojo_id,
      url: `${PUBLIC_BASE}/${r.dateiname}?t=${Date.parse(r.hochgeladen_am) || ''}`,
      groesse: r.groesse, hochgeladen_am: r.hochgeladen_am, hochgeladen_von: r.hochgeladen_von,
    }));
    // Dojos + ob sie eigene Banner dürfen (Enterprise/Trial)
    const [dojos] = await pool.query(`
      SELECT d.id, d.dojoname,
             COALESCE(s.plan_type,'') AS plan_type, COALESCE(s.status,'') AS status,
             CASE WHEN s.status IN ('suspended','cancelled','expired') THEN 0
                  WHEN s.plan_type='enterprise' OR s.status='trial' THEN 1 ELSE 0 END AS darf_branden
      FROM dojo d LEFT JOIN dojo_subscriptions s ON s.dojo_id = d.id
      ORDER BY d.dojoname`);
    res.json({ apps: APPS, anlaesse: ANLAESSE, dojos, banners, basisUrl: PUBLIC_BASE });
  } catch (e) {
    logger.error?.('[mailBanners] GET:', e.message);
    res.status(500).json({ error: 'Banner konnten nicht geladen werden' });
  }
});

// POST /api/mail-banners/:app/:anlass[?dojo_id=X]
router.post('/:app/:anlass', requireSuperAdmin, validParams, upload.single('banner'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen' });
  const { app, anlass } = req.params;
  const dojoId = dojoIdFrom(req);
  try {
    // Enterprise-Gate für dojo-spezifische Banner
    if (dojoId > 0 && !(await dojoMayBrand(dojoId))) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Eigene Banner sind ein Enterprise-Feature. Dieses Dojo hat keinen Enterprise-Plan.', upgrade: true });
    }
    for (const ext of ['.png', '.jpg', '.jpeg']) {
      const p = path.join(BANNER_DIR, bannerFilename(app, anlass, dojoId, ext));
      if (p !== req.file.path && fs.existsSync(p)) fs.unlinkSync(p);
    }
    const by = req.user?.email || req.user?.username || ('user#' + (req.user?.id || '?'));
    await pool.query(
      `INSERT INTO mail_banner (app, anlass, dojo_id, dateiname, mime, groesse, hochgeladen_von)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE dateiname=VALUES(dateiname), mime=VALUES(mime), groesse=VALUES(groesse),
         hochgeladen_am=CURRENT_TIMESTAMP, hochgeladen_von=VALUES(hochgeladen_von)`,
      [app, anlass, dojoId, req.file.filename, req.file.mimetype, req.file.size, by]
    );
    await writeManifest();
    logger.success?.('[mailBanners] hochgeladen', { app, anlass, dojoId, datei: req.file.filename });
    res.json({ success: true, app, anlass, dojo_id: dojoId, url: `${PUBLIC_BASE}/${req.file.filename}`, datei: req.file.filename });
  } catch (e) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    logger.error?.('[mailBanners] POST:', e.message);
    res.status(500).json({ error: 'Banner konnte nicht gespeichert werden' });
  }
});

// DELETE /api/mail-banners/:app/:anlass[?dojo_id=X]
router.delete('/:app/:anlass', requireSuperAdmin, validParams, async (req, res) => {
  const { app, anlass } = req.params;
  const dojoId = dojoIdFrom(req);
  try {
    const [[row]] = await pool.query('SELECT dateiname FROM mail_banner WHERE app=? AND anlass=? AND dojo_id=?', [app, anlass, dojoId]);
    if (row) { const p = path.join(BANNER_DIR, row.dateiname); if (fs.existsSync(p)) fs.unlinkSync(p); }
    await pool.query('DELETE FROM mail_banner WHERE app=? AND anlass=? AND dojo_id=?', [app, anlass, dojoId]);
    await writeManifest();
    res.json({ success: true });
  } catch (e) {
    logger.error?.('[mailBanners] DELETE:', e.message);
    res.status(500).json({ error: 'Banner konnte nicht gelöscht werden' });
  }
});

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Datei zu groß. Maximum: 2 MB' });
    return res.status(400).json({ error: `Upload-Fehler: ${error.message}` });
  }
  if (error) return res.status(400).json({ error: error.message });
  next();
});

module.exports = router;
