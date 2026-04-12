/**
 * Vorlagen Routes
 * ================
 * CRUD + Preview + Versand für Dokument-Vorlagen.
 * - System-Vorlagen (dojo_id=NULL, system_vorlage=1): nur lesen + kopieren
 * - Eigene Vorlagen: vollständig editierbar
 * - PDF-Erzeugung via vorlagenPdfGenerator.js (Puppeteer)
 * - Platzhalter-Ersatz via Handlebars
 * - Email-Versand via nodemailer (Pattern aus mahnwesen.js)
 */

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');
const nodemailer = require('nodemailer');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const { generateVorlagePdf, buildLetterheadHtml } = require('../utils/vorlagenPdfGenerator');
const { generateVereinbarungPdf, generateInfoblattPdf } = require('../utils/trainerPdfGenerator');

const TRAINER_KATEGORIEN = ['trainer_vereinbarung', 'trainer_infoblatt'];

router.use(authenticateToken);

const pool = db.promise();

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function formatDateDE(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatDateLangDE(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Anrede-Helfer ──────────────────────────────────────────────────────────────
function buildFormaleAnrede(mitglied) {
  const anrede = mitglied?.anrede || '';
  const nachname = mitglied?.nachname || '';
  if (anrede === 'Frau') return `Sehr geehrte Frau ${nachname},`;
  if (anrede === 'Herr') return `Sehr geehrter Herr ${nachname},`;
  return nachname ? `Sehr geehrte/r Frau/Herr ${nachname},` : 'Sehr geehrte Damen und Herren,';
}

function buildPersoenlicheAnrede(mitglied) {
  const anrede = mitglied?.anrede || '';
  const vorname = mitglied?.vorname || '';
  if (anrede === 'Frau') return `Liebe ${vorname},`;
  if (anrede === 'Herr') return `Lieber ${vorname},`;
  return `Liebe/r ${vorname},`;
}

// ── Signatur-Abstand: 3 Leerzeilen vor {{absender_inhaber}} / {{absender_name}} ──
function addSignaturSpacing(html) {
  if (!html) return html;
  const spacer = '<p style="line-height:1.4;margin:0">&nbsp;</p>'.repeat(3);
  if (html.includes('{{absender_inhaber}}')) {
    return html.replace(
      /(<\/p>\s*)(<p[^>]*>[^<]*\{\{absender_inhaber\}\})/,
      `$1${spacer}$2`
    );
  }
  if (html.includes('{{absender_name}}')) {
    return html.replace(
      /(<\/p>\s*)(<p[^>]*>[^<]*\{\{absender_name\}\})/,
      `$1${spacer}$2`
    );
  }
  return html;
}

function buildPlatzhalterDaten(mitglied, absenderProfil, zusatzDaten = {}) {
  const heute = new Date();
  return {
    anrede: mitglied?.anrede || 'Frau/Herr',
    anrede_formal: buildFormaleAnrede(mitglied),
    anrede_persoenlich: buildPersoenlicheAnrede(mitglied),
    vorname: mitglied?.vorname || '',
    nachname: mitglied?.nachname || '',
    vollname: [mitglied?.vorname, mitglied?.nachname].filter(Boolean).join(' '),
    mitgliedsnummer: mitglied?.mitgliedsnummer || String(mitglied?.mitglied_id || ''),
    email: mitglied?.email || '',
    strasse: [mitglied?.strasse, mitglied?.hausnummer].filter(Boolean).join(' '),
    plz: mitglied?.plz || '',
    ort: mitglied?.ort || '',
    geburtstag: formatDateDE(mitglied?.geburtsdatum),
    eintrittsdatum: formatDateDE(mitglied?.eintrittsdatum),
    // Absender
    absender_name: absenderProfil?.organisation || absenderProfil?.name || '',
    absender_strasse: [absenderProfil?.strasse, absenderProfil?.hausnummer].filter(Boolean).join(' '),
    absender_plz: absenderProfil?.plz || '',
    absender_ort: absenderProfil?.ort || '',
    absender_telefon: absenderProfil?.telefon || '',
    absender_email: absenderProfil?.email || '',
    absender_internet: absenderProfil?.internet || '',
    absender_inhaber: absenderProfil?.inhaber || '',
    bank_name: absenderProfil?.bank_name || '',
    bank_iban: absenderProfil?.bank_iban || '',
    bank_bic: absenderProfil?.bank_bic || '',
    bank_inhaber: absenderProfil?.bank_inhaber || '',
    // Datum
    datum: formatDateDE(heute),
    datum_lang: formatDateLangDE(heute),
    jahr: String(heute.getFullYear()),
    monat: String(heute.getMonth() + 1).padStart(2, '0'),
    // Kontext-spezifisch aus zusatz_daten
    ...zusatzDaten
  };
}

function ersetzePlatzhalter(htmlText, daten) {
  if (!htmlText) return '';
  try {
    const template = handlebars.compile(htmlText, { noEscape: true });
    return template(daten);
  } catch (e) {
    // Fallback: manuelle Ersetzung wenn Handlebars fehlschlägt
    return htmlText.replace(/\{\{(\w+)\}\}/g, (_, key) => daten[key] || '');
  }
}

async function getMailTransporter() {
  const [[settings]] = await pool.query('SELECT * FROM email_einstellungen LIMIT 1').catch(async () => {
    const [[s]] = await pool.query('SELECT * FROM email_settings LIMIT 1');
    return [[s]];
  });
  if (!settings) throw new Error('E-Mail-Einstellungen fehlen');
  return nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port,
    secure: settings.smtp_port === 465,
    auth: { user: settings.smtp_user, pass: settings.smtp_password }
  });
}

async function getAbsenderProfil(profilId, dojoId) {
  if (profilId) {
    const [[profil]] = await pool.query('SELECT * FROM absender_profile WHERE id = ? LIMIT 1', [profilId]);
    if (profil) return profil;
  }
  // Fallback: erstes Profil des Dojos
  const [[profil]] = await pool.query(
    'SELECT * FROM absender_profile WHERE dojo_id = ? AND aktiv = 1 ORDER BY typ LIMIT 1',
    [dojoId]
  );
  return profil || null;
}

// Logo als Data-URI laden
async function getLogoDataUri(dojoId) {
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

// Inhaber aus Stammdaten laden wenn footer_inhaber_aus_stammdaten aktiv
async function getDojoInhaber(einstellungen, dojoId) {
  if (!einstellungen?.footer_inhaber_aus_stammdaten) return null;
  const [[dj]] = await pool.query('SELECT inhaber FROM dojo WHERE id = ? LIMIT 1', [dojoId]);
  return dj?.inhaber || null;
}

// Banken aus dojo_bankverbindungen laden basierend auf footer_bank_ids
async function getBanken(einstellungen, dojoId) {
  if (!einstellungen?.footer_bank_ids) return [];
  try {
    const ids = typeof einstellungen.footer_bank_ids === 'string'
      ? JSON.parse(einstellungen.footer_bank_ids)
      : einstellungen.footer_bank_ids;
    if (!ids || !ids.length) return [];
    const phs = ids.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT * FROM dojo_bankverbindungen WHERE id IN (${phs}) AND dojo_id = ? ORDER BY sort_order`,
      [...ids, dojoId]
    );
    return rows;
  } catch { return []; }
}

// Beispiel-Daten für Vorschau
const BEISPIEL_MITGLIED = {
  anrede: 'Herr', vorname: 'Max', nachname: 'Mustermann',
  mitgliedsnummer: 'M-0042', email: 'max.mustermann@beispiel.de',
  strasse: 'Musterstraße', hausnummer: '1', plz: '80333', ort: 'München',
  geburtsdatum: '1985-06-15', eintrittsdatum: '2020-01-01'
};
const BEISPIEL_ZUSATZ = {
  betrag: '45,00 €', faelligkeitsdatum: '01.04.2026',
  kuendigungsdatum: '31.12.2026', ruhezeitbeginn: '01.07.2026', ruhezeitende: '30.09.2026',
  kurs_name: 'Graduierungsprüfung April 2026', lizenz_nummer: 'L-2026-042',
  lizenz_ablauf: '31.12.2026', guertelstufe: 'Blaugurt'
};

// ── GET /kategorien — Kategorien + Platzhalter-Infos ─────────────────────────
router.get('/kategorien', (req, res) => {
  res.json({
    kategorien: [
      { key: 'begruessung', label: 'Begrüßungsschreiben', gruppe: 'mitgliedschaft' },
      { key: 'geburtstag', label: 'Geburtstagsgratulation', gruppe: 'mitgliedschaft' },
      { key: 'kuendigung_bestaetigung', label: 'Kündigung Bestätigung', gruppe: 'mitgliedschaft' },
      { key: 'ruhezeit', label: 'Ruhezeit-Bestätigung', gruppe: 'mitgliedschaft' },
      { key: 'kursanmeldung', label: 'Kursanmeldung Bestätigung', gruppe: 'mitgliedschaft' },
      { key: 'zahlungserinnerung', label: 'Zahlungserinnerung (freundlich)', gruppe: 'finanzen' },
      { key: 'mahnung', label: 'Mahnung', gruppe: 'finanzen' },
      { key: 'mahnbescheid', label: 'Mahnbescheid / Inkasso', gruppe: 'finanzen' },
      { key: 'ruecklastschrift_info', label: 'Rücklastschrift-Information', gruppe: 'finanzen' },
      { key: 'pruefung_einladung', label: 'Prüfungs-Einladung', gruppe: 'pruefungen' },
      { key: 'pruefung_ergebnis', label: 'Prüfungsergebnis', gruppe: 'pruefungen' },
      { key: 'guertelvergabe', label: 'Gürtelvergabe / Urkunde', gruppe: 'pruefungen' },
      { key: 'lizenz_ausstellung', label: 'Lizenz-Ausstellung', gruppe: 'verband' },
      { key: 'lizenz_verlaengerung', label: 'Lizenz-Verlängerung', gruppe: 'verband' },
      { key: 'verband_info', label: 'Verbandsinformation', gruppe: 'verband' },
      { key: 'info_brief', label: 'Allgemeiner Infobrief', gruppe: 'allgemein' },
      { key: 'rundschreiben', label: 'Rundschreiben', gruppe: 'allgemein' },
      { key: 'sonstiges', label: 'Sonstiges', gruppe: 'allgemein' },
      { key: 'trainer_vereinbarung', label: 'Trainervereinbarung freie Mitarbeit', gruppe: 'personal' },
      { key: 'trainer_infoblatt', label: 'Trainer-Infoblatt', gruppe: 'personal' },
    ],
    platzhalter: [
      { gruppe: 'Empfänger', felder: ['{{anrede}}', '{{anrede_formal}}', '{{anrede_persoenlich}}', '{{vorname}}', '{{nachname}}', '{{vollname}}', '{{mitgliedsnummer}}', '{{email}}', '{{strasse}}', '{{plz}}', '{{ort}}', '{{geburtstag}}', '{{eintrittsdatum}}'] },
      { gruppe: 'Absender', felder: ['{{absender_name}}', '{{absender_strasse}}', '{{absender_ort}}', '{{absender_telefon}}', '{{absender_email}}', '{{absender_inhaber}}', '{{bank_iban}}', '{{bank_bic}}', '{{bank_inhaber}}'] },
      { gruppe: 'Datum', felder: ['{{datum}}', '{{datum_lang}}', '{{jahr}}', '{{monat}}'] },
      { gruppe: 'Finanzen', felder: ['{{betrag}}', '{{faelligkeitsdatum}}'] },
      { gruppe: 'Mitgliedschaft', felder: ['{{kuendigungsdatum}}', '{{ruhezeitbeginn}}', '{{ruhezeitende}}'] },
      { gruppe: 'Prüfung / Kurs', felder: ['{{kurs_name}}', '{{guertelstufe}}'] },
      { gruppe: 'Lizenz', felder: ['{{lizenz_nummer}}', '{{lizenz_ablauf}}'] },
    ]
  });
});

// ── GET / — Liste aller Vorlagen (System + eigene) ───────────────────────────
router.get('/', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { kategorie, gruppe } = req.query;

  try {
    let where = '(v.dojo_id = ? OR v.dojo_id IS NULL) AND v.aktiv = 1';
    const params = [dojoId];

    if (kategorie) {
      where += ' AND v.kategorie = ?';
      params.push(kategorie);
    }

    const [rows] = await pool.query(`
      SELECT v.*, ap.name AS absender_name, ap.typ AS absender_typ, ap.farbe_primaer
      FROM dokument_vorlagen v
      LEFT JOIN absender_profile ap ON v.absender_profil_id = ap.id
      WHERE ${where}
      ORDER BY v.system_vorlage ASC, v.kategorie, v.name
    `, params);

    res.json({ success: true, vorlagen: rows });
  } catch (err) {
    logger.error('Vorlagen laden:', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// ── POST / — Neue Vorlage anlegen ────────────────────────────────────────────
router.post('/', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { kategorie = 'sonstiges', name, email_betreff, email_html, brief_titel, brief_html, absender_profil_id, mit_pdf_anhang } = req.body;
  if (!name) return res.status(400).json({ error: 'Name ist Pflichtfeld' });

  try {
    const [result] = await pool.query(
      `INSERT INTO dokument_vorlagen (dojo_id, kategorie, name, email_betreff, email_html, brief_titel, brief_html, absender_profil_id, mit_pdf_anhang)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [dojoId, kategorie, name, email_betreff || null, email_html || null, brief_titel || null, brief_html || null,
       absender_profil_id || null, mit_pdf_anhang ? 1 : 0]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    logger.error('Vorlage anlegen:', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Anlegen' });
  }
});

// ── PUT /:id — Vorlage bearbeiten ────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { id } = req.params;

  // System-Vorlagen sind schreibgeschützt
  const [[vorlage]] = await pool.query('SELECT * FROM dokument_vorlagen WHERE id = ?', [id]);
  if (!vorlage) return res.status(404).json({ error: 'Vorlage nicht gefunden' });
  if (vorlage.system_vorlage) return res.status(403).json({ error: 'System-Vorlagen können nicht bearbeitet werden. Bitte kopieren Sie die Vorlage.' });
  if (vorlage.dojo_id !== dojoId) return res.status(403).json({ error: 'Keine Berechtigung' });

  // Phase 7: Aktuelle Version vor dem Update sichern
  try {
    const [[maxVer]] = await pool.query(
      'SELECT COALESCE(MAX(version_nr), 0) AS max_ver FROM vorlage_versionen WHERE vorlage_id = ?', [id]
    );
    await pool.query(
      `INSERT INTO vorlage_versionen (vorlage_id, version_nr, geaendert_von_user_id, email_html, brief_html, email_betreff, brief_titel)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, (maxVer.max_ver || 0) + 1, req.user?.userId || null,
       vorlage.email_html, vorlage.brief_html, vorlage.email_betreff, vorlage.brief_titel]
    );
  } catch { /* non-critical — Versionen-Tabelle evtl. noch nicht angelegt */ }

  const fields = ['kategorie', 'name', 'email_betreff', 'email_html', 'brief_titel', 'brief_html', 'absender_profil_id', 'mit_pdf_anhang'];
  const updates = {};
  fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f] !== '' ? req.body[f] : null; });

  try {
    if (Object.keys(updates).length > 0) {
      const setClauses = Object.keys(updates).map(f => `${f} = ?`).join(', ');
      await pool.query(`UPDATE dokument_vorlagen SET ${setClauses} WHERE id = ? AND dojo_id = ?`, [...Object.values(updates), id, dojoId]);
    }
    res.json({ success: true });
  } catch (err) {
    logger.error('Vorlage bearbeiten:', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Bearbeiten' });
  }
});

// ── DELETE /:id — Vorlage löschen ────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const [[vorlage]] = await pool.query('SELECT dojo_id, system_vorlage FROM dokument_vorlagen WHERE id = ?', [req.params.id]);
  if (!vorlage) return res.status(404).json({ error: 'Vorlage nicht gefunden' });
  if (vorlage.system_vorlage) return res.status(403).json({ error: 'System-Vorlagen können nicht gelöscht werden' });
  if (vorlage.dojo_id !== dojoId) return res.status(403).json({ error: 'Keine Berechtigung' });

  try {
    await pool.query('UPDATE dokument_vorlagen SET aktiv = 0 WHERE id = ? AND dojo_id = ?', [req.params.id, dojoId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// ── POST /:id/kopieren — System-Vorlage als eigene Kopie anlegen ─────────────
router.post('/:id/kopieren', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  try {
    const [[orig]] = await pool.query('SELECT * FROM dokument_vorlagen WHERE id = ?', [req.params.id]);
    if (!orig) return res.status(404).json({ error: 'Vorlage nicht gefunden' });

    const [result] = await pool.query(
      `INSERT INTO dokument_vorlagen (dojo_id, system_vorlage, kategorie, name, email_betreff, email_html, brief_titel, brief_html, absender_profil_id, mit_pdf_anhang)
       VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [dojoId, orig.kategorie, `${orig.name} (Kopie)`, orig.email_betreff, orig.email_html, orig.brief_titel, orig.brief_html, null, orig.mit_pdf_anhang]
    );
    res.json({ success: true, id: result.insertId, message: 'Vorlage kopiert' });
  } catch (err) {
    logger.error('Vorlage kopieren:', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Kopieren' });
  }
});

// ── GET /:id/preview-html — HTML-Vorschau (Beispiel- oder echte Mitgliedsdaten) ──
router.get('/:id/preview-html', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  try {
    const [[vorlage]] = await pool.query('SELECT * FROM dokument_vorlagen WHERE id = ? AND (dojo_id = ? OR dojo_id IS NULL)', [req.params.id, dojoId]);
    if (!vorlage) return res.status(404).json({ error: 'Vorlage nicht gefunden' });

    // Echtes Mitglied oder Beispieldaten
    let mitglied = BEISPIEL_MITGLIED;
    if (req.query.mitglied_id) {
      const [[gefunden]] = await pool.query('SELECT * FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?', [req.query.mitglied_id, dojoId]);
      if (gefunden) mitglied = gefunden;
    }

    let absenderProfil = await getAbsenderProfil(vorlage.absender_profil_id, dojoId);
    const [[einstellungen]] = await pool.query('SELECT * FROM brief_einstellungen WHERE dojo_id = ? LIMIT 1', [dojoId]);
    const banken = await getBanken(einstellungen, dojoId);
    const dojoInhaber = await getDojoInhaber(einstellungen, dojoId);
    if (dojoInhaber) absenderProfil = { ...absenderProfil, inhaber: dojoInhaber };
    const logoUrl = await getLogoDataUri(dojoId);
    const daten = buildPlatzhalterDaten(mitglied, absenderProfil, BEISPIEL_ZUSATZ);

    const briefHtml = ersetzePlatzhalter(addSignaturSpacing(vorlage.brief_html || vorlage.email_html), daten);
    const briefTitel = ersetzePlatzhalter(vorlage.brief_titel, daten);
    const datumStr = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const html = buildLetterheadHtml({ briefHtml, absenderProfil, empfaenger: mitglied, briefTitel, datumStr, einstellungen: einstellungen || null, banken, logoUrl });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    logger.error('Vorlage HTML-Preview:', { error: err.message });
    res.status(500).json({ error: 'Fehler bei der Vorschau' });
  }
});

// ── GET /:id/preview-pdf — PDF-Vorschau mit Beispieldaten ────────────────────
router.get('/:id/preview-pdf', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  try {
    const [[vorlage]] = await pool.query('SELECT * FROM dokument_vorlagen WHERE id = ? AND (dojo_id = ? OR dojo_id IS NULL)', [req.params.id, dojoId]);
    if (!vorlage) return res.status(404).json({ error: 'Vorlage nicht gefunden' });

    // ── Trainer-Kategorien: spezielles rotes KKS-Design ──────────────────────
    if (TRAINER_KATEGORIEN.includes(vorlage.kategorie)) {
      const [[dojoRow]] = await pool.query(
        'SELECT dojoname, inhaber, strasse, hausnummer, plz, ort, steuernummer FROM dojo WHERE id = ? LIMIT 1',
        [dojoId]
      );
      const dojo = dojoRow || {};

      const beispielTrainer = {
        vorname: 'Max', nachname: 'Mustermann',
        anschrift: 'Musterstraße 1, 12345 Musterstadt',
        geburtsdatum: '1985-06-15',
        graduierung: '3',
        steuer_id: '12 345 678 900',
      };
      const beispielParams = {
        mitgliedsbeitrag_monatlich: '79',
        sachleistungen_jahreswert: '1200',
        vertragsbeginn: new Date().toISOString().slice(0, 10),
        wettbewerb_radius: '10',
        trainingsbereich: 'Karate, Kumite',
      };

      let pdfBuffer;
      if (vorlage.kategorie === 'trainer_vereinbarung') {
        pdfBuffer = await generateVereinbarungPdf(beispielTrainer, dojo, beispielParams);
      } else {
        pdfBuffer = await generateInfoblattPdf(beispielTrainer, dojo);
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Vorschau_${vorlage.name.replace(/\s+/g, '_')}.pdf"`);
      return res.send(pdfBuffer);
    }

    // ── Standard Briefkopf-Design ─────────────────────────────────────────────
    let absenderProfil = await getAbsenderProfil(vorlage.absender_profil_id, dojoId);
    const [[einstellungen]] = await pool.query('SELECT * FROM brief_einstellungen WHERE dojo_id = ? LIMIT 1', [dojoId]);
    const banken = await getBanken(einstellungen, dojoId);
    const dojoInhaber = await getDojoInhaber(einstellungen, dojoId);
    if (dojoInhaber) absenderProfil = { ...absenderProfil, inhaber: dojoInhaber };
    const logoUrl = await getLogoDataUri(dojoId);
    const daten = buildPlatzhalterDaten(BEISPIEL_MITGLIED, absenderProfil, BEISPIEL_ZUSATZ);

    const briefHtml = ersetzePlatzhalter(addSignaturSpacing(vorlage.brief_html || vorlage.email_html), daten);
    const briefTitel = ersetzePlatzhalter(vorlage.brief_titel, daten);

    const pdfBuffer = await generateVorlagePdf({
      briefHtml,
      absenderProfil,
      empfaenger: BEISPIEL_MITGLIED,
      briefTitel,
      einstellungen: einstellungen || null,
      banken,
      logoUrl,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Vorschau_${vorlage.name.replace(/\s+/g, '_')}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    logger.error('Vorlage PDF-Preview:', { error: err.message });
    res.status(500).json({ error: 'Fehler bei der PDF-Vorschau' });
  }
});

// ── POST /:id/senden — Vorlage an Mitglied senden ────────────────────────────
router.post('/:id/senden', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { mitglied_id, zusatz_daten = {}, versand_art = 'email', geplant_fuer = null } = req.body;
  if (!mitglied_id && versand_art !== 'pdf') {
    return res.status(400).json({ error: 'mitglied_id ist erforderlich' });
  }

  try {
    const [[vorlage]] = await pool.query('SELECT * FROM dokument_vorlagen WHERE id = ? AND (dojo_id = ? OR dojo_id IS NULL)', [req.params.id, dojoId]);
    if (!vorlage) return res.status(404).json({ error: 'Vorlage nicht gefunden' });

    let mitglied = null;
    if (mitglied_id) {
      [[mitglied]] = await pool.query('SELECT * FROM mitglieder WHERE mitglied_id = ?', [mitglied_id]);
      if (!mitglied) return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    let absenderProfil = await getAbsenderProfil(vorlage.absender_profil_id, dojoId);
    const [[einstellungen]] = await pool.query('SELECT * FROM brief_einstellungen WHERE dojo_id = ? LIMIT 1', [dojoId]);
    const banken = await getBanken(einstellungen, dojoId);
    const dojoInhaber = await getDojoInhaber(einstellungen, dojoId);
    if (dojoInhaber) absenderProfil = { ...absenderProfil, inhaber: dojoInhaber };
    const logoUrl = await getLogoDataUri(dojoId);
    const daten = buildPlatzhalterDaten(mitglied, absenderProfil, zusatz_daten);

    const emailHtmlFilled = ersetzePlatzhalter(vorlage.email_html, daten);
    const emailBetreffFilled = ersetzePlatzhalter(vorlage.email_betreff, daten) || vorlage.name;
    const briefHtmlFilled = ersetzePlatzhalter(addSignaturSpacing(vorlage.brief_html || vorlage.email_html), daten);
    const briefTitelFilled = ersetzePlatzhalter(vorlage.brief_titel, daten);

    // Phase 6: Geplanter Versand — nur vormerken, nicht sofort senden
    if (geplant_fuer) {
      const planDate = new Date(geplant_fuer);
      if (planDate > new Date()) {
        try {
          await pool.query(
            `INSERT INTO versandhistorie (dojo_id, mitglied_id, vorlage_id, vorlage_name, versand_art, empfaenger_email, empfaenger_name, betreff, status, gesendet_von_user_id, geplant_fuer, status_detail)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'gesendet', ?, ?, 'ausstehend')`,
            [dojoId, mitglied?.mitglied_id || null, vorlage.id, vorlage.name, versand_art,
             mitglied?.email || null,
             mitglied ? `${mitglied.vorname || ''} ${mitglied.nachname || ''}`.trim() : null,
             emailBetreffFilled || vorlage.name, req.user?.userId || null, planDate]
          );
          return res.json({ success: true, geplant: true, message: `Versand für ${planDate.toLocaleString('de-DE')} geplant` });
        } catch (err) {
          return res.status(500).json({ error: 'Fehler beim Planen: ' + err.message });
        }
      }
    }

    // PDF herunterladen
    if (versand_art === 'pdf') {
      const pdfBuffer = await generateVorlagePdf({
        briefHtml: briefHtmlFilled,
        absenderProfil,
        empfaenger: mitglied || {},
        briefTitel: briefTitelFilled,
        einstellungen: einstellungen || null,
        banken,
        logoUrl,
      });
      const name = mitglied ? `${mitglied.nachname || 'Dokument'}` : 'Dokument';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${vorlage.name.replace(/\s+/g, '_')}_${name}.pdf"`);
      // Non-critical: Versandhistorie
      try {
        await pool.query(
          `INSERT INTO versandhistorie (dojo_id, mitglied_id, vorlage_id, vorlage_name, versand_art, empfaenger_email, empfaenger_name, betreff, status, gesendet_von_user_id)
           VALUES (?, ?, ?, ?, 'pdf', ?, ?, ?, 'gesendet', ?)`,
          [dojoId, mitglied?.mitglied_id || null, vorlage.id, vorlage.name,
           mitglied?.email || null,
           mitglied ? `${mitglied.vorname || ''} ${mitglied.nachname || ''}`.trim() : null,
           briefTitelFilled || vorlage.name, req.user?.userId || null]
        );
      } catch { /* non-critical */ }
      return res.send(pdfBuffer);
    }

    // Email senden (mit oder ohne PDF-Anhang)
    if (versand_art === 'email' || versand_art === 'email_mit_pdf') {
      if (!mitglied?.email) return res.status(400).json({ error: 'Mitglied hat keine Email-Adresse' });

      const transporter = await getMailTransporter();
      const fromName = absenderProfil?.organisation || absenderProfil?.name || 'Dojo';

      const attachments = [];
      if (versand_art === 'email_mit_pdf' || vorlage.mit_pdf_anhang) {
        const pdfBuffer = await generateVorlagePdf({
          briefHtml: briefHtmlFilled,
          absenderProfil,
          empfaenger: mitglied,
          briefTitel: briefTitelFilled,
          einstellungen: einstellungen || null,
          banken,
          logoUrl,
        });
        attachments.push({
          filename: `${vorlage.name.replace(/\s+/g, '_')}_${mitglied.nachname || ''}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        });
      }

      await transporter.sendMail({
        from: `"${fromName}" <${absenderProfil?.email || transporter.options?.auth?.user}>`,
        to: mitglied.email,
        subject: emailBetreffFilled,
        html: emailHtmlFilled,
        text: emailHtmlFilled.replace(/<[^>]+>/g, ''),
        attachments
      });

      // Non-critical: Versandhistorie
      try {
        await pool.query(
          `INSERT INTO versandhistorie (dojo_id, mitglied_id, vorlage_id, vorlage_name, versand_art, empfaenger_email, empfaenger_name, betreff, status, gesendet_von_user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'gesendet', ?)`,
          [dojoId, mitglied.mitglied_id, vorlage.id, vorlage.name,
           versand_art, mitglied.email,
           `${mitglied.vorname || ''} ${mitglied.nachname || ''}`.trim(),
           emailBetreffFilled || vorlage.name, req.user?.userId || null]
        );
      } catch { /* non-critical */ }
      return res.json({ success: true, message: `Email an ${mitglied.email} gesendet` });
    }

    res.status(400).json({ error: 'Unbekannte versand_art' });

  } catch (err) {
    logger.error('Vorlage senden:', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Senden: ' + err.message });
  }
});

// ── POST /:id/serien-senden — Serienbrief an gefilterte Mitgliedergruppe ─────
router.post('/:id/serien-senden', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { filter = 'alle_mit_email', mitglied_ids = [], versand_art = 'email', zusatz_daten = {} } = req.body;

  try {
    const [[vorlage]] = await pool.query(
      'SELECT * FROM dokument_vorlagen WHERE id = ? AND (dojo_id = ? OR dojo_id IS NULL)', [req.params.id, dojoId]
    );
    if (!vorlage) return res.status(404).json({ error: 'Vorlage nicht gefunden' });

    // Mitglieder laden
    let mitglieder = [];
    if (filter === 'ids' && mitglied_ids.length > 0) {
      const phs = mitglied_ids.map(() => '?').join(',');
      [mitglieder] = await pool.query(
        `SELECT * FROM mitglieder WHERE mitglied_id IN (${phs}) AND dojo_id = ? AND email IS NOT NULL AND email != ''`,
        [...mitglied_ids, dojoId]
      );
    } else if (filter === 'alle_aktiv') {
      [mitglieder] = await pool.query(
        `SELECT * FROM mitglieder WHERE dojo_id = ? AND status = 'aktiv' AND email IS NOT NULL AND email != ''`,
        [dojoId]
      );
    } else {
      [mitglieder] = await pool.query(
        `SELECT * FROM mitglieder WHERE dojo_id = ? AND email IS NOT NULL AND email != ''`,
        [dojoId]
      );
    }

    if (!mitglieder.length) {
      return res.json({ success: true, gesendet: 0, fehler: 0, fehler_details: [], total: 0 });
    }

    let absenderProfil = await getAbsenderProfil(vorlage.absender_profil_id, dojoId);
    const [[einstellungen]] = await pool.query('SELECT * FROM brief_einstellungen WHERE dojo_id = ? LIMIT 1', [dojoId]);
    const banken = await getBanken(einstellungen, dojoId);
    const dojoInhaber = await getDojoInhaber(einstellungen, dojoId);
    if (dojoInhaber) absenderProfil = { ...absenderProfil, inhaber: dojoInhaber };
    const logoUrl = await getLogoDataUri(dojoId);
    const fromName = absenderProfil?.organisation || absenderProfil?.name || 'Dojo';

    const transporter = await getMailTransporter();

    let gesendet = 0, fehler = 0;
    const fehler_details = [];

    for (const mitglied of mitglieder) {
      try {
        if (!mitglied.email) {
          fehler++;
          fehler_details.push({ name: `${mitglied.vorname} ${mitglied.nachname}`, error: 'Keine E-Mail' });
          continue;
        }
        const daten = buildPlatzhalterDaten(mitglied, absenderProfil, zusatz_daten);
        const emailHtmlFilled = ersetzePlatzhalter(vorlage.email_html, daten);
        const emailBetreffFilled = ersetzePlatzhalter(vorlage.email_betreff, daten) || vorlage.name;
        const briefHtmlFilled = ersetzePlatzhalter(addSignaturSpacing(vorlage.brief_html || vorlage.email_html), daten);
        const briefTitelFilled = ersetzePlatzhalter(vorlage.brief_titel, daten);

        const attachments = [];
        if (versand_art === 'email_mit_pdf' || vorlage.mit_pdf_anhang) {
          const pdfBuffer = await generateVorlagePdf({
            briefHtml: briefHtmlFilled, absenderProfil, empfaenger: mitglied,
            briefTitel: briefTitelFilled, einstellungen: einstellungen || null, banken, logoUrl,
          });
          attachments.push({
            filename: `${vorlage.name.replace(/\s+/g, '_')}_${mitglied.nachname || ''}.pdf`,
            content: pdfBuffer, contentType: 'application/pdf'
          });
        }

        await transporter.sendMail({
          from: `"${fromName}" <${absenderProfil?.email || transporter.options?.auth?.user}>`,
          to: mitglied.email, subject: emailBetreffFilled,
          html: emailHtmlFilled, text: emailHtmlFilled.replace(/<[^>]+>/g, ''), attachments
        });

        try {
          await pool.query(
            `INSERT INTO versandhistorie (dojo_id, mitglied_id, vorlage_id, vorlage_name, versand_art, empfaenger_email, empfaenger_name, betreff, status, gesendet_von_user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'gesendet', ?)`,
            [dojoId, mitglied.mitglied_id, vorlage.id, vorlage.name, versand_art,
             mitglied.email, `${mitglied.vorname || ''} ${mitglied.nachname || ''}`.trim(),
             emailBetreffFilled, req.user?.userId || null]
          );
        } catch {}

        gesendet++;
        await new Promise(r => setTimeout(r, 150));
      } catch (err) {
        fehler++;
        fehler_details.push({ name: `${mitglied.vorname} ${mitglied.nachname}`, email: mitglied.email, error: err.message });
      }
    }

    res.json({ success: true, gesendet, fehler, fehler_details, total: mitglieder.length });
  } catch (err) {
    logger.error('Serien-Senden:', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Serien-Senden: ' + err.message });
  }
});

// ── GET /:id/serien-count — Anzahl der Empfänger für Serienbrief ──────────────
router.get('/:id/serien-count', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });
  const { filter = 'alle_mit_email' } = req.query;
  try {
    let count = 0;
    if (filter === 'alle_aktiv') {
      const [[r]] = await pool.query(
        `SELECT COUNT(*) AS n FROM mitglieder WHERE dojo_id = ? AND status = 'aktiv' AND email IS NOT NULL AND email != ''`, [dojoId]
      );
      count = r.n;
    } else {
      const [[r]] = await pool.query(
        `SELECT COUNT(*) AS n FROM mitglieder WHERE dojo_id = ? AND email IS NOT NULL AND email != ''`, [dojoId]
      );
      count = r.n;
    }
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /:id/versionen — Versionshistorie ─────────────────────────────────────
router.get('/:id/versionen', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });
  try {
    const [[vorlage]] = await pool.query(
      'SELECT id FROM dokument_vorlagen WHERE id = ? AND (dojo_id = ? OR dojo_id IS NULL)', [req.params.id, dojoId]
    );
    if (!vorlage) return res.status(404).json({ error: 'Vorlage nicht gefunden' });

    const [versionen] = await pool.query(
      `SELECT id, version_nr, geaendert_am, geaendert_von_user_id, email_betreff, brief_titel, aenderungsnotiz
       FROM vorlage_versionen WHERE vorlage_id = ? ORDER BY version_nr DESC LIMIT 20`,
      [req.params.id]
    );
    res.json({ success: true, versionen });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /:id/versionen/:versionId/wiederherstellen ───────────────────────────
router.post('/:id/versionen/:versionId/wiederherstellen', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });
  try {
    const [[vorlage]] = await pool.query('SELECT * FROM dokument_vorlagen WHERE id = ? AND dojo_id = ?', [req.params.id, dojoId]);
    if (!vorlage) return res.status(404).json({ error: 'Vorlage nicht gefunden' });
    if (vorlage.system_vorlage) return res.status(403).json({ error: 'System-Vorlagen nicht wiederherstellbar' });

    const [[version]] = await pool.query(
      'SELECT * FROM vorlage_versionen WHERE id = ? AND vorlage_id = ?', [req.params.versionId, req.params.id]
    );
    if (!version) return res.status(404).json({ error: 'Version nicht gefunden' });

    // Aktuelle Version als neue Sicherung speichern
    const [[maxVer]] = await pool.query('SELECT COALESCE(MAX(version_nr), 0) AS max_ver FROM vorlage_versionen WHERE vorlage_id = ?', [req.params.id]);
    await pool.query(
      `INSERT INTO vorlage_versionen (vorlage_id, version_nr, geaendert_von_user_id, email_html, brief_html, email_betreff, brief_titel, aenderungsnotiz)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, (maxVer.max_ver || 0) + 1, req.user?.userId || null,
       vorlage.email_html, vorlage.brief_html, vorlage.email_betreff, vorlage.brief_titel,
       `Sicherung vor Wiederherstellung von Version ${version.version_nr}`]
    );

    await pool.query(
      `UPDATE dokument_vorlagen SET email_html = ?, brief_html = ?, email_betreff = ?, brief_titel = ? WHERE id = ? AND dojo_id = ?`,
      [version.email_html, version.brief_html, version.email_betreff, version.brief_titel, req.params.id, dojoId]
    );
    res.json({ success: true, message: `Version ${version.version_nr} wiederhergestellt` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
