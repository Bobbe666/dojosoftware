// ============================================================================
// LIZENZVERTRAG — Einstellungen + PDF-Generierung + Elektronische Signatur
// GET  /api/admin/lizenzvertrag/settings
// PUT  /api/admin/lizenzvertrag/settings
// POST /api/admin/lizenzvertrag/pdf     { dojoId, plan, interval }
// POST /api/admin/lizenzvertrag/sign    { sigDataUrl, dojoId, plan, interval, signedBy }
// GET  /api/admin/lizenzvertrag/signaturen
// ============================================================================
const express    = require('express');
const router     = express.Router();
const puppeteer  = require('puppeteer');
const path       = require('path');
const fs         = require('fs');
const db         = require('../../db');
const { authenticateToken } = require('../../middleware/auth');
const { buildContractHTML } = require('./lizenzvertrag-template');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/lizenzvertraege');

const pool = db.promise();

function onlySuperAdmin(req, res, next) {
  const role = req.user?.rolle;
  const ok   = role === 'super_admin' || (!req.user?.dojo_id && role === 'admin');
  if (!ok) return res.status(403).json({ success: false, error: 'Nur Super-Admin' });
  next();
}

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unbekannt'
  );
}

const LV_KEYS = [
  'lv_anbieter_name', 'lv_anbieter_strasse', 'lv_anbieter_plz_ort',
  'lv_anbieter_email', 'lv_anbieter_telefon', 'lv_anbieter_website',
  'lv_anbieter_steuernr', 'lv_anbieter_ust_id',
  'lv_support_email', 'lv_support_zeiten', 'lv_kuendigungsfrist',
  'lv_datenspeicherung_tage', 'lv_verfuegbarkeit_prozent', 'lv_gerichtsstand',
];

const LV_DEFAULTS = {
  lv_anbieter_name:             'Tiger & Dragon Association – International',
  lv_anbieter_strasse:          '',
  lv_anbieter_plz_ort:          '',
  lv_anbieter_email:            'info@tda-intl.com',
  lv_anbieter_telefon:          '',
  lv_anbieter_website:          'www.tda-intl.com',
  lv_anbieter_steuernr:         '',
  lv_anbieter_ust_id:           '',
  lv_support_email:             'info@tda-intl.com',
  lv_support_zeiten:            'Mo–Fr, 09:00–17:00 Uhr',
  lv_kuendigungsfrist:          '30 Tage zum Monatsende',
  lv_datenspeicherung_tage:     '30',
  lv_verfuegbarkeit_prozent:    '99',
  lv_gerichtsstand:             'Sitz des Anbieters',
};

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
async function fetchSettings() {
  const [rows] = await pool.query(
    `SELECT setting_key, setting_value FROM saas_settings WHERE setting_key IN (?)`,
    [LV_KEYS]
  );
  const settings = { ...LV_DEFAULTS };
  for (const r of rows) settings[r.setting_key] = r.setting_value;
  return settings;
}

async function fetchDojo(dojoId) {
  if (!dojoId) return {};
  const [rows] = await pool.query(
    `SELECT id, dojoname, subdomain, strasse, plz, ort, email FROM dojo WHERE id = ?`,
    [dojoId]
  );
  return rows[0] || {};
}

async function generatePdf(html) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '20mm', bottom: '15mm', left: '20mm' }
    });
    return pdfBuffer;
  } finally {
    await browser.close().catch(() => {});
  }
}

// ── GET /settings ─────────────────────────────────────────────────────────────
router.get('/settings', authenticateToken, onlySuperAdmin, async (req, res) => {
  try {
    res.json({ success: true, settings: await fetchSettings() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PUT /settings ─────────────────────────────────────────────────────────────
router.put('/settings', authenticateToken, onlySuperAdmin, async (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      if (!LV_KEYS.includes(key)) continue;
      await pool.query(
        `INSERT INTO saas_settings (setting_key, setting_value, description, setting_type, category)
         VALUES (?, ?, ?, 'string', 'general')
         ON DUPLICATE KEY UPDATE setting_value = ?`,
        [key, value, key, value]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /pdf ─────────────────────────────────────────────────────────────────
// Entwurf ohne Signatur — Frontend schickt { dojoId, plan, interval }
router.post('/pdf', authenticateToken, onlySuperAdmin, async (req, res) => {
  const { dojoId, plan = 'starter', interval = 'monthly' } = req.body;
  if (!dojoId) return res.status(400).json({ success: false, error: 'dojoId fehlt' });

  try {
    const [settings, dojo] = await Promise.all([fetchSettings(), fetchDojo(dojoId)]);
    const html      = buildContractHTML(settings, dojo, plan, interval);
    const pdfBuffer = await generatePdf(html);

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="Lizenzvertrag_Entwurf.pdf"`,
      'Content-Length':      pdfBuffer.length
    });
    res.end(pdfBuffer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /sign ────────────────────────────────────────────────────────────────
// Signierter Vertrag: { sigDataUrl, dojoId, plan, interval, signedBy }
router.post('/sign', authenticateToken, onlySuperAdmin, async (req, res) => {
  const { sigDataUrl, dojoId, plan = 'starter', interval = 'monthly', signedBy } = req.body;
  if (!dojoId)    return res.status(400).json({ success: false, error: 'dojoId fehlt' });
  if (!sigDataUrl) return res.status(400).json({ success: false, error: 'Signatur fehlt' });

  const ip        = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';
  const sigTimestamp = new Date().toISOString();
  const filename  = `Lizenzvertrag_${dojoId}_${Date.now()}.pdf`;

  try {
    const [settings, dojo] = await Promise.all([fetchSettings(), fetchDojo(dojoId)]);

    const html = buildContractHTML(settings, dojo, plan, interval, {
      sigDataUrl,
      sigTimestamp,
      sigIp:   ip,
      sigName: signedBy || dojo.dojoname || '',
    });

    const pdfBuffer = await generatePdf(html);

    // PDF auf Disk speichern
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const pdfPath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(pdfPath, pdfBuffer);

    // IP + Metadaten + Dateipfad loggen
    await pool.query(
      `INSERT INTO lizenz_signaturen (dojo_id, plan, interval_type, ip_address, user_agent, signed_by, pdf_filename, pdf_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [dojoId, plan, interval, ip, userAgent, signedBy || null, filename, pdfPath]
    );

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      pdfBuffer.length
    });
    res.end(pdfBuffer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /signaturen ───────────────────────────────────────────────────────────
router.get('/signaturen', authenticateToken, onlySuperAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ls.*, d.dojoname
       FROM lizenz_signaturen ls
       LEFT JOIN dojo d ON ls.dojo_id = d.id
       ORDER BY ls.signed_at DESC
       LIMIT 200`
    );
    res.json({ success: true, signaturen: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /dojo/:dojoId — Verträge eines bestimmten Dojos ───────────────────────
router.get('/dojo/:dojoId', authenticateToken, onlySuperAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, plan, interval_type, signed_at, ip_address, signed_by, pdf_filename,
              CASE WHEN pdf_path IS NOT NULL AND pdf_path != '' THEN 1 ELSE 0 END AS has_file
       FROM lizenz_signaturen
       WHERE dojo_id = ?
       ORDER BY signed_at DESC`,
      [req.params.dojoId]
    );
    res.json({ success: true, vertraege: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /download/:id — PDF herunterladen ─────────────────────────────────────
router.get('/download/:id', authenticateToken, onlySuperAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT pdf_path, pdf_filename FROM lizenz_signaturen WHERE id = ?`,
      [req.params.id]
    );
    if (!rows.length || !rows[0].pdf_path) {
      return res.status(404).json({ success: false, error: 'Datei nicht gefunden' });
    }
    const { pdf_path, pdf_filename } = rows[0];
    if (!fs.existsSync(pdf_path)) {
      return res.status(404).json({ success: false, error: 'Datei auf Server nicht gefunden' });
    }
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${pdf_filename}"`,
    });
    fs.createReadStream(pdf_path).pipe(res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
