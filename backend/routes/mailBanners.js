// routes/mailBanners.js
// =============================================================================
// Zentrale Verwaltung der Mail-Banner für ALLE Apps (HOF, Dojo, Events) —
// nur Super-Admin. Banner liegen unter backend/uploads/mail-banners/ und sind
// über https://dojo.tda-intl.org/uploads/mail-banners/<datei> erreichbar.
// Da Mail-Bilder von jeder Domain laden, nutzen alle drei Apps diese eine Quelle.
//
// Ein manifest.json im selben Verzeichnis sagt den Renderern (auch in HOF/Events),
// welche (app, anlass) ein Banner haben → pro-Anlass an/aus, zentral gepflegt.
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

// Super-Admin = role 'super_admin' oder dojo_id null im JWT (eigenständig,
// um nicht von middleware/shared abzuhängen, das nur server-seitig existiert).
const superOnly = (req, res, next) => {
  const u = req.user || {};
  if (u.role === 'super_admin' || u.dojo_id === null) return next();
  return res.status(403).json({ error: 'Nur Super-Admin erlaubt' });
};
const requireSuperAdmin = [authenticateToken, superOnly];

const APPS = ['hof', 'dojo', 'events'];
const ANLAESSE = ['einladung', 'begruessung', 'rechnung', 'allgemein'];
const BANNER_DIR = path.join(__dirname, '../uploads/mail-banners');
const MANIFEST = path.join(BANNER_DIR, 'manifest.json');
const PUBLIC_BASE = process.env.MAIL_BANNER_BASE_URL || 'https://dojo.tda-intl.org/uploads/mail-banners';

if (!fs.existsSync(BANNER_DIR)) fs.mkdirSync(BANNER_DIR, { recursive: true });

// Tabelle einmalig sicherstellen
pool.query(`
  CREATE TABLE IF NOT EXISTS mail_banner (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app VARCHAR(20) NOT NULL,
    anlass VARCHAR(20) NOT NULL,
    dateiname VARCHAR(255) NOT NULL,
    mime VARCHAR(60),
    groesse INT,
    hochgeladen_am DATETIME DEFAULT CURRENT_TIMESTAMP,
    hochgeladen_von VARCHAR(120),
    UNIQUE KEY uq_app_anlass (app, anlass)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(e => logger.error?.('[mailBanners] Tabelle:', e.message));

// manifest.json aus DB neu schreiben (von allen App-Renderern gelesen)
async function writeManifest() {
  try {
    const [rows] = await pool.query('SELECT app, anlass, dateiname, mime, UNIX_TIMESTAMP(hochgeladen_am) AS ts FROM mail_banner');
    const m = {};
    for (const r of rows) {
      m[`${r.app}-${r.anlass}`] = { datei: r.dateiname, url: `${PUBLIC_BASE}/${r.dateiname}`, mime: r.mime, ts: r.ts };
    }
    fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2));
  } catch (e) { logger.error?.('[mailBanners] manifest:', e.message); }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => { if (!fs.existsSync(BANNER_DIR)) fs.mkdirSync(BANNER_DIR, { recursive: true }); cb(null, BANNER_DIR); },
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.png').toLowerCase();
    cb(null, `${req.params.app}-${req.params.anlass}${ext}`);
  }
});
const fileFilter = (req, file, cb) => {
  const ok = ['image/png', 'image/jpeg', 'image/jpg'].includes(file.mimetype);
  cb(ok ? null : new Error(`Ungültiges Format: ${file.mimetype}. Erlaubt: PNG, JPG (kein WebP — Outlook!)`), ok);
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } });

const validParams = (req, res, next) => {
  if (!APPS.includes(req.params.app)) return res.status(400).json({ error: 'Ungültige App' });
  if (!ANLAESSE.includes(req.params.anlass)) return res.status(400).json({ error: 'Ungültiger Anlass' });
  next();
};

// GET /api/mail-banners → komplette Matrix (app × anlass) mit Status
router.get('/', requireSuperAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT app, anlass, dateiname, mime, groesse, hochgeladen_am, hochgeladen_von FROM mail_banner');
    const map = {};
    rows.forEach(r => { map[`${r.app}-${r.anlass}`] = r; });
    const matrix = [];
    for (const app of APPS) for (const anlass of ANLAESSE) {
      const r = map[`${app}-${anlass}`];
      matrix.push({
        app, anlass,
        vorhanden: !!r,
        url: r ? `${PUBLIC_BASE}/${r.dateiname}?t=${Date.parse(r.hochgeladen_am) || ''}` : null,
        groesse: r?.groesse || null,
        hochgeladen_am: r?.hochgeladen_am || null,
        hochgeladen_von: r?.hochgeladen_von || null,
      });
    }
    res.json({ apps: APPS, anlaesse: ANLAESSE, banners: matrix, basisUrl: PUBLIC_BASE });
  } catch (e) {
    logger.error?.('[mailBanners] GET:', e.message);
    res.status(500).json({ error: 'Banner konnten nicht geladen werden' });
  }
});

// POST /api/mail-banners/:app/:anlass  (multipart 'banner')
router.post('/:app/:anlass', requireSuperAdmin, validParams, upload.single('banner'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen' });
  const { app, anlass } = req.params;
  try {
    // andere Endung derselben Kombination entfernen (z.B. alt .jpg, neu .png)
    for (const ext of ['.png', '.jpg', '.jpeg']) {
      const p = path.join(BANNER_DIR, `${app}-${anlass}${ext}`);
      if (p !== req.file.path && fs.existsSync(p)) fs.unlinkSync(p);
    }
    const by = req.user?.email || req.user?.username || ('user#' + (req.user?.id || '?'));
    await pool.query(
      `INSERT INTO mail_banner (app, anlass, dateiname, mime, groesse, hochgeladen_von)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE dateiname=VALUES(dateiname), mime=VALUES(mime), groesse=VALUES(groesse),
         hochgeladen_am=CURRENT_TIMESTAMP, hochgeladen_von=VALUES(hochgeladen_von)`,
      [app, anlass, req.file.filename, req.file.mimetype, req.file.size, by]
    );
    await writeManifest();
    logger.success?.('[mailBanners] hochgeladen', { app, anlass, datei: req.file.filename });
    res.json({ success: true, app, anlass, url: `${PUBLIC_BASE}/${req.file.filename}`, datei: req.file.filename });
  } catch (e) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    logger.error?.('[mailBanners] POST:', e.message);
    res.status(500).json({ error: 'Banner konnte nicht gespeichert werden' });
  }
});

// DELETE /api/mail-banners/:app/:anlass
router.delete('/:app/:anlass', requireSuperAdmin, validParams, async (req, res) => {
  const { app, anlass } = req.params;
  try {
    const [[row]] = await pool.query('SELECT dateiname FROM mail_banner WHERE app=? AND anlass=?', [app, anlass]);
    if (row) {
      const p = path.join(BANNER_DIR, row.dateiname);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    await pool.query('DELETE FROM mail_banner WHERE app=? AND anlass=?', [app, anlass]);
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
