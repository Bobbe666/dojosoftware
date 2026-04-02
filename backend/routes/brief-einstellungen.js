/**
 * brief-einstellungen.js
 * =======================
 * Einstellungen für Briefvorlagen und PDF-Generierung pro Dojo.
 * - DIN 5008 A/B Presets oder benutzerdefinierte Ränder
 * - Schriftart und -größe
 * - Fußzeilen-Konfiguration (Bank, Kontakt, Inhaber, freier Text)
 * - Standard-Absender-Profil
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const { buildLetterheadHtml } = require('../utils/vorlagenPdfGenerator');

// ── Logo als Data-URI laden ────────────────────────────────────────────────────
async function getLogoDataUri(dojoId, pool) {
  try {
    const [[logo]] = await pool.query(
      "SELECT file_name FROM dojo_logos WHERE dojo_id = ? AND logo_type = 'haupt' LIMIT 1",
      [dojoId]
    );
    if (!logo?.file_name) return null;
    const filePath = path.join(__dirname, '..', 'uploads', 'logos', logo.file_name);
    const data = fs.readFileSync(filePath);
    const ext = path.extname(logo.file_name).toLowerCase().replace('.', '');
    const mimes = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
    return `data:${mimes[ext] || 'image/png'};base64,${data.toString('base64')}`;
  } catch { return null; }
}

router.use(authenticateToken);

const pool = db.promise();

// ── Beispieldaten für Vorschau ─────────────────────────────────────────────────
const VORSCHAU_MITGLIED = {
  anrede: 'Sehr geehrte Damen und Herren',
  vorname: 'Maria',
  nachname: 'Mustermann',
  strasse: 'Hauptstraße',
  hausnummer: '12',
  plz: '80333',
  ort: 'München',
  email: 'maria.mustermann@example.de',
};

const VORSCHAU_BRIEF_HTML = `
<p>vielen Dank für Ihr Interesse an unserem Dojo und unseren Trainingsangeboten.</p>
<p>Mit diesem Schreiben möchten wir Ihnen einen Überblick über unsere aktuellen Kurse und Trainingsmöglichkeiten geben. Unser erfahrenes Trainer-Team freut sich darauf, Sie auf Ihrem Weg in der Kampfkunst zu begleiten.</p>
<p><strong>Unser Kursangebot umfasst:</strong></p>
<ul>
  <li>Anfängerkurse für Kinder (ab 6 Jahre) und Erwachsene</li>
  <li>Fortgeschrittenen-Training und Leistungsgruppen</li>
  <li>Prüfungsvorbereitungen für alle Gürtelgrade</li>
  <li>Seminare, Lehrgänge und Sonderveranstaltungen</li>
</ul>
<p>Die Trainingszeiten und weitere Informationen entnehmen Sie bitte unserer aktuellen Kursübersicht oder besuchen Sie uns auf unserer Website.</p>
<p>Wir freuen uns auf Sie!</p>
<p>Mit freundlichen Grüßen</p>
`;

// ── DIN-Presets ───────────────────────────────────────────────────────────────
const DIN_PRESETS = {
  din5008a: { margin_top_mm: 27.00,  margin_bottom_mm: 26.46, margin_left_mm: 25.00, margin_right_mm: 20.00 },
  din5008b: { margin_top_mm: 45.00,  margin_bottom_mm: 26.46, margin_left_mm: 25.00, margin_right_mm: 20.00 },
};

// ── Default-Einstellungen (werden zurückgegeben wenn kein Eintrag vorhanden) ──
const DEFAULT_EINSTELLUNGEN = {
  din_format: 'din5008a',
  margin_top_mm: 27.00,
  margin_bottom_mm: 26.46,
  margin_left_mm: 25.00,
  margin_right_mm: 20.00,
  font_family: 'Helvetica',
  font_size_pt: 10.0,
  line_height: 1.60,
  footer_show_bank: 1,
  footer_show_contact: 1,
  footer_show_inhaber: 1,
  footer_custom_html: null,
  standard_profil_id: null,
  farbe_primaer: null,
  footer_bank_ids: null,
  footer_inhaber_aus_stammdaten: 0,
  logo_position: 'rechts',
};

// ── GET / — Einstellungen laden (oder Defaults) ───────────────────────────────
router.get('/', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  try {
    const [[row]] = await pool.query(
      'SELECT * FROM brief_einstellungen WHERE dojo_id = ? LIMIT 1',
      [dojoId]
    );
    res.json({ success: true, einstellungen: row || { ...DEFAULT_EINSTELLUNGEN, dojo_id: dojoId } });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Einstellungen' });
  }
});

// ── PUT / — Einstellungen speichern (UPSERT) ──────────────────────────────────
router.put('/', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const {
    din_format = 'din5008a',
    margin_top_mm, margin_bottom_mm, margin_left_mm, margin_right_mm,
    font_family = 'Helvetica', font_size_pt = 10.0, line_height = 1.60,
    footer_show_bank = 1, footer_show_contact = 1, footer_show_inhaber = 1,
    footer_custom_html = null,
    standard_profil_id = null,
    farbe_primaer = null,
    footer_bank_ids = null,
    footer_inhaber_aus_stammdaten = 0,
    logo_position = 'rechts',
  } = req.body;

  // Bei DIN-Presets → Margin-Werte vom Preset übernehmen (außer bei custom)
  const preset = DIN_PRESETS[din_format];
  const finalMarginTop    = preset ? preset.margin_top_mm    : (parseFloat(margin_top_mm)    || 27.00);
  const finalMarginBottom = preset ? preset.margin_bottom_mm : (parseFloat(margin_bottom_mm) || 26.46);
  const finalMarginLeft   = preset ? preset.margin_left_mm   : (parseFloat(margin_left_mm)   || 25.00);
  const finalMarginRight  = preset ? preset.margin_right_mm  : (parseFloat(margin_right_mm)  || 20.00);

  try {
    await pool.query(`
      INSERT INTO brief_einstellungen
        (dojo_id, din_format, margin_top_mm, margin_bottom_mm, margin_left_mm, margin_right_mm,
         font_family, font_size_pt, line_height,
         footer_show_bank, footer_show_contact, footer_show_inhaber,
         footer_custom_html, standard_profil_id, farbe_primaer, footer_bank_ids,
         footer_inhaber_aus_stammdaten, logo_position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        din_format                   = VALUES(din_format),
        margin_top_mm                = VALUES(margin_top_mm),
        margin_bottom_mm             = VALUES(margin_bottom_mm),
        margin_left_mm               = VALUES(margin_left_mm),
        margin_right_mm              = VALUES(margin_right_mm),
        font_family                  = VALUES(font_family),
        font_size_pt                 = VALUES(font_size_pt),
        line_height                  = VALUES(line_height),
        footer_show_bank             = VALUES(footer_show_bank),
        footer_show_contact          = VALUES(footer_show_contact),
        footer_show_inhaber          = VALUES(footer_show_inhaber),
        footer_custom_html           = VALUES(footer_custom_html),
        standard_profil_id           = VALUES(standard_profil_id),
        farbe_primaer                = VALUES(farbe_primaer),
        footer_bank_ids              = VALUES(footer_bank_ids),
        footer_inhaber_aus_stammdaten = VALUES(footer_inhaber_aus_stammdaten),
        logo_position                = VALUES(logo_position)
    `, [
      dojoId, din_format, finalMarginTop, finalMarginBottom, finalMarginLeft, finalMarginRight,
      font_family, font_size_pt, line_height,
      footer_show_bank ? 1 : 0, footer_show_contact ? 1 : 0, footer_show_inhaber ? 1 : 0,
      footer_custom_html || null,
      standard_profil_id || null,
      farbe_primaer || null,
      footer_bank_ids ? JSON.stringify(footer_bank_ids) : null,
      footer_inhaber_aus_stammdaten ? 1 : 0,
      logo_position || 'rechts',
    ]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Speichern: ' + err.message });
  }
});

// ── POST /vorschau — HTML-Vorschau mit aktuellen (noch ungespeicherten) Einstellungen ──
router.post('/vorschau', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { settings = {}, absender_profil_id } = req.body;

  try {
    // Absender-Profil aus DB laden wenn angegeben
    let absenderProfil = null;
    if (absender_profil_id) {
      [[absenderProfil]] = await pool.query(
        'SELECT * FROM absender_profile WHERE id = ? AND dojo_id = ?',
        [absender_profil_id, dojoId]
      );
    }

    // Fallback: Dojo-Stammdaten aus dojos-Tabelle laden wenn kein Profil
    if (!absenderProfil) {
      const [[dojo]] = await pool.query(
        'SELECT dojoname, inhaber, strasse, hausnummer, plz, ort, telefon, email, internet, bank_name, bank_iban, bank_bic, bank_inhaber FROM dojo WHERE id = ? LIMIT 1',
        [dojoId]
      );
      if (dojo && dojo.dojoname) {
        absenderProfil = {
          name: dojo.dojoname,
          organisation: dojo.dojoname,
          inhaber: dojo.inhaber || '',
          strasse: dojo.strasse || '',
          hausnummer: dojo.hausnummer || '',
          plz: dojo.plz || '',
          ort: dojo.ort || '',
          telefon: dojo.telefon || '',
          email: dojo.email || '',
          internet: dojo.internet || '',
          bank_name: dojo.bank_name || '',
          bank_iban: dojo.bank_iban || '',
          bank_bic: dojo.bank_bic || '',
          bank_inhaber: dojo.bank_inhaber || '',
          farbe_primaer: '#8B0000',
        };
      }
    }

    // Einstellungen mit Defaults zusammenführen
    const einstellungen = { ...DEFAULT_EINSTELLUNGEN, ...settings };

    // Inhaber aus Stammdaten überschreiben wenn gewünscht
    if (einstellungen.footer_inhaber_aus_stammdaten) {
      const [[dj]] = await pool.query('SELECT inhaber FROM dojo WHERE id = ? LIMIT 1', [dojoId]);
      if (dj?.inhaber) absenderProfil = { ...absenderProfil, inhaber: dj.inhaber };
    }

    // Banken laden wenn footer_bank_ids gesetzt
    let banken = [];
    if (einstellungen.footer_bank_ids) {
      try {
        const bankIds = typeof einstellungen.footer_bank_ids === 'string'
          ? JSON.parse(einstellungen.footer_bank_ids)
          : einstellungen.footer_bank_ids;
        if (bankIds.length > 0) {
          const phs = bankIds.map(() => '?').join(',');
          [banken] = await pool.query(
            `SELECT * FROM dojo_bankverbindungen WHERE id IN (${phs}) AND dojo_id = ? ORDER BY sort_order`,
            [...bankIds, dojoId]
          );
        }
      } catch { /* JSON parse error → keine Banken */ }
    }

    const datumStr = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const logoUrl = await getLogoDataUri(dojoId, pool);

    const html = buildLetterheadHtml({
      briefHtml: VORSCHAU_BRIEF_HTML,
      absenderProfil,
      empfaenger: VORSCHAU_MITGLIED,
      briefTitel: 'Informationsschreiben — Vorschau',
      datumStr,
      einstellungen,
      banken,
      logoUrl,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: 'Fehler bei der Vorschau: ' + err.message });
  }
});

module.exports = router;
