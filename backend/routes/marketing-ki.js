// =============================================================================
// MARKETING KI ROUTES
// KI-Textgenerator, Templates, Newsletter, Geburtstags-Posts
// =============================================================================

const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const { sendEmailForDojo } = require('../services/emailService');
const logger = require('../utils/logger');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// =============================================================================
// KI-TEXTGENERATOR
// =============================================================================

router.post('/generate', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  const { thema, plattform, tonalitaet, anlass, zusatzinfos } = req.body;

  if (!thema) return res.status(400).json({ error: 'Thema ist erforderlich' });

  try {
    const db = req.db;
    const [[dojo]] = await db.query('SELECT dojoname FROM dojo WHERE id = ?', [dojoId]);
    const dojoName = dojo?.dojoname || 'Kampfkunstschule';

    const plattformHinweis = {
      facebook:  'Facebook-Post (längere Texte ok, persönlicher Ton, 1-3 Hashtags)',
      instagram: 'Instagram-Post (prägnant, visuell, bis zu 30 relevante Hashtags am Ende)',
      beide:     'sowohl für Facebook als auch Instagram geeignet (2 Varianten)',
      story:     'Instagram Story-Text (sehr kurz, max. 3-4 Zeilen, große Schrift gedacht, 1-2 Hashtags)'
    }[plattform] || 'Social Media Post';

    const tonHinweis = {
      professionell: 'professionell und seriös',
      freundlich:    'warm, freundlich und einladend',
      motivierend:   'motivierend, energetisch und inspirierend',
      humorvoll:     'locker, humorvoll und sympathisch'
    }[tonalitaet] || 'freundlich und professionell';

    const anlassHinweis = anlass ? `Anlass/Typ: ${anlass}` : '';

    const prompt = `Du bist Social-Media-Texter für ${dojoName}, eine Kampfkunstschule.

Erstelle einen ${plattformHinweis}.
Tonalität: ${tonHinweis}
Thema: ${thema}
${anlassHinweis}
${zusatzinfos ? `Zusatzinfos: ${zusatzinfos}` : ''}

${plattform === 'beide' ? `Erstelle ZWEI Varianten:
**FACEBOOK:**
[Facebook-Text hier]

**INSTAGRAM:**
[Instagram-Text hier]
[Hashtags]` : `Schreibe den Post-Text${plattform === 'instagram' || plattform === 'story' ? ' und füge am Ende passende Hashtags hinzu' : ''}.`}

Wichtig:
- Keine Markdown-Formatierung im eigentlichen Post-Text (kein **, keine #-Überschriften)
- Emojis sind erlaubt und erwünscht
- Hashtags am Ende, jeder mit # Zeichen
- Kein "Hier ist dein Post:" oder ähnliche Einleitungen — direkt mit dem Content starten`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    });

    const generated = response.content[0]?.text || '';
    res.json({ success: true, content: generated, tokens: response.usage?.input_tokens });
  } catch (err) {
    logger.error('KI-Content-Generierung fehlgeschlagen', { error: err.message });
    res.status(500).json({ error: 'KI-Generierung fehlgeschlagen: ' + err.message });
  }
});

// =============================================================================
// TEMPLATES
// =============================================================================

router.get('/templates', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  try {
    const db = req.db;
    const [rows] = await db.query(
      'SELECT * FROM marketing_templates WHERE dojo_id = ? ORDER BY kategorie, name',
      [dojoId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Templates konnten nicht geladen werden' });
  }
});

router.post('/templates', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  const { name, kategorie, plattform, content, hashtags, tonalitaet } = req.body;
  if (!name || !content) return res.status(400).json({ error: 'Name und Inhalt sind erforderlich' });
  try {
    const db = req.db;
    const [result] = await db.query(
      'INSERT INTO marketing_templates (dojo_id, name, kategorie, plattform, content, hashtags, tonalitaet) VALUES (?,?,?,?,?,?,?)',
      [dojoId, name, kategorie || 'allgemein', plattform || 'beide', content, hashtags || '', tonalitaet || 'freundlich']
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Template konnte nicht gespeichert werden' });
  }
});

router.delete('/templates/:id', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  try {
    const db = req.db;
    await db.query('DELETE FROM marketing_templates WHERE id = ? AND dojo_id = ?', [req.params.id, dojoId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Template konnte nicht gelöscht werden' });
  }
});

// =============================================================================
// GEBURTSTAGE (diese Woche + diesen Monat)
// =============================================================================

router.get('/geburtstage', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  try {
    const db = req.db;
    const [rows] = await db.query(`
      SELECT mitglied_id, vorname, nachname, geburtsdatum, email,
        TIMESTAMPDIFF(YEAR, geburtsdatum, CURDATE()) AS alter_jahre,
        DATE_FORMAT(geburtsdatum, '%m-%d') AS geburtstag_md,
        DATEDIFF(
          DATE(CONCAT(YEAR(CURDATE()), '-', MONTH(geburtsdatum), '-', DAY(geburtsdatum))),
          CURDATE()
        ) AS tage_bis
      FROM mitglieder
      WHERE dojo_id = ? AND aktiv = 1 AND geburtsdatum IS NOT NULL
        AND DATE_FORMAT(geburtsdatum, '%m-%d') BETWEEN
          DATE_FORMAT(CURDATE(), '%m-%d') AND
          DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 30 DAY), '%m-%d')
      ORDER BY geburtstag_md
      LIMIT 20
    `, [dojoId]);

    res.json(rows.map(r => ({
      ...r,
      tage_bis: r.tage_bis < 0 ? r.tage_bis + 365 : r.tage_bis
    })));
  } catch (err) {
    res.status(500).json({ error: 'Geburtstage konnten nicht geladen werden' });
  }
});

router.post('/geburtstage/generate', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  const { vorname, alter, plattform } = req.body;
  if (!vorname) return res.status(400).json({ error: 'Vorname erforderlich' });

  try {
    const db = req.db;
    const [[dojo]] = await db.query('SELECT dojoname FROM dojo WHERE id = ?', [dojoId]);
    const dojoName = dojo?.dojoname || 'Kampfkunstschule';

    const plattformHint = plattform === 'story'
      ? 'Instagram Story (sehr kurz, 2-3 Zeilen, groß gedacht)'
      : plattform === 'instagram'
        ? 'Instagram-Post mit passenden Hashtags'
        : 'Facebook-Post';

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      messages: [{
        role: 'user',
        content: `Schreibe einen herzlichen Geburtstags-${plattformHint} für ${dojoName}.
Das Mitglied heißt ${vorname}${alter ? ` und wird ${alter}` : ''}.
Warm, persönlich, mit Kampfsport-Bezug. Emojis sind willkommen.
Keine Einleitungen, direkt mit dem Post starten.`
      }]
    });

    res.json({ success: true, content: response.content[0]?.text || '' });
  } catch (err) {
    res.status(500).json({ error: 'KI-Generierung fehlgeschlagen' });
  }
});

// =============================================================================
// NEWSLETTER
// =============================================================================

router.get('/newsletter', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  try {
    const db = req.db;
    const [rows] = await db.query(
      'SELECT * FROM marketing_newsletter_campaigns WHERE dojo_id = ? ORDER BY created_at DESC LIMIT 20',
      [dojoId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Newsletter-Kampagnen konnten nicht geladen werden' });
  }
});

router.post('/newsletter/preview-empfaenger', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  const { filter } = req.body; // { altersgruppe, geschlecht, alle }
  try {
    const db = req.db;
    let where = 'dojo_id = ? AND aktiv = 1 AND email IS NOT NULL AND email != ""';
    const params = [dojoId];
    if (filter?.geschlecht && filter.geschlecht !== 'alle') {
      where += ' AND geschlecht = ?'; params.push(filter.geschlecht);
    }
    const [rows] = await db.query(
      `SELECT COUNT(*) AS anzahl FROM mitglieder WHERE ${where}`, params
    );
    res.json({ anzahl: rows[0]?.anzahl || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Fehler bei Empfänger-Vorschau' });
  }
});

router.post('/newsletter/ki-text', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  const { thema, tonalitaet } = req.body;
  try {
    const db = req.db;
    const [[dojo]] = await db.query('SELECT dojoname FROM dojo WHERE id = ?', [dojoId]);
    const dojoName = dojo?.dojoname || 'Kampfkunstschule';

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Schreibe einen Newsletter-Text für ${dojoName} (Kampfkunstschule).
Thema: ${thema}
Tonalität: ${tonalitaet || 'freundlich und professionell'}
Der Text soll als E-Mail-Inhalt dienen, also mit Anrede "Liebe Mitglieder," beginnen.
Kein HTML, nur Text. Am Ende eine freundliche Grußformel mit ${dojoName}.`
      }]
    });

    res.json({ success: true, content: response.content[0]?.text || '' });
  } catch (err) {
    res.status(500).json({ error: 'KI-Generierung fehlgeschlagen' });
  }
});

router.post('/newsletter/send', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  const { betreff, content, filter } = req.body;
  if (!betreff || !content) return res.status(400).json({ error: 'Betreff und Inhalt erforderlich' });

  try {
    const db = req.db;
    const [[dojo]] = await db.query('SELECT dojoname FROM dojo WHERE id = ?', [dojoId]);
    const dojoName = dojo?.dojoname || 'Kampfkunstschule';

    let where = 'dojo_id = ? AND aktiv = 1 AND email IS NOT NULL AND email != ""';
    const params = [dojoId];
    if (filter?.geschlecht && filter.geschlecht !== 'alle') {
      where += ' AND geschlecht = ?'; params.push(filter.geschlecht);
    }

    const [mitglieder] = await db.query(
      `SELECT vorname, nachname, email FROM mitglieder WHERE ${where}`, params
    );

    if (mitglieder.length === 0) return res.status(400).json({ error: 'Keine Empfänger gefunden' });

    // Kampagne speichern
    const [kampagne] = await db.query(
      'INSERT INTO marketing_newsletter_campaigns (dojo_id, betreff, content, empfaenger_filter, status, empfaenger_anzahl) VALUES (?,?,?,?,?,?)',
      [dojoId, betreff, content, JSON.stringify(filter || {}), 'draft', mitglieder.length]
    );

    // E-Mails senden (bis 50 auf einmal, dann in Batches)
    let gesendet = 0;
    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#1a1a2e;padding:24px 28px">
      <h2 style="color:#fff;margin:0;font-size:1.1rem">${dojoName}</h2>
      <p style="color:#aaa;margin:4px 0 0;font-size:0.85rem">Newsletter</p>
    </div>
    <div style="padding:28px">
      <div style="color:#333;white-space:pre-wrap;line-height:1.6">${content.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
    </div>
    <div style="background:#f9fafb;padding:14px 28px;border-top:1px solid #eee">
      <p style="color:#999;font-size:0.75rem;margin:0">${dojoName} · Diese E-Mail wurde über das Mitgliederverwaltungssystem versandt.</p>
    </div>
  </div>
</body></html>`;

    for (const m of mitglieder) {
      try {
        await sendEmailForDojo({
          to: m.email,
          subject: betreff,
          html: htmlContent,
          text: content
        }, dojoId);
        gesendet++;
      } catch (emailErr) {
        logger.warn('Newsletter-E-Mail fehlgeschlagen', { to: m.email, error: emailErr.message });
      }
    }

    // Status aktualisieren
    await db.query(
      'UPDATE marketing_newsletter_campaigns SET status=?, empfaenger_anzahl=?, gesendet_at=NOW() WHERE id=?',
      [gesendet === mitglieder.length ? 'sent' : 'failed', gesendet, kampagne.insertId]
    );

    res.json({ success: true, gesendet, gesamt: mitglieder.length });
  } catch (err) {
    logger.error('Newsletter-Versand fehlgeschlagen', { error: err.message });
    res.status(500).json({ error: 'Newsletter-Versand fehlgeschlagen: ' + err.message });
  }
});

module.exports = router;
