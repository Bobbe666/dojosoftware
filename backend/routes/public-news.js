// Backend/routes/public-news.js
// Öffentliche News-Endpunkte: JSON-API, iframe-Widget, RSS-Feed
const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');

// CORS-Header Helper (für externe Websites)
function setCorsHeaders(res) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
}

// OPTIONS - CORS Preflight
router.options('*', (req, res) => {
  setCorsHeaders(res);
  res.sendStatus(200);
});

/**
 * GET /api/public/news?dojo_id=X
 * JSON-API: Letzte 10 veröffentlichte News eines Dojos
 */
router.get('/', async (req, res) => {
  setCorsHeaders(res);
  const dojoId = parseInt(req.query.dojo_id);
  if (!dojoId || isNaN(dojoId)) {
    return res.status(400).json({ success: false, error: 'dojo_id ist erforderlich' });
  }

  try {
    const target = req.query.target === 'intl' ? 'intl' : 'vib';
    const zFilter = getZielgruppeFilter(dojoId, target);
    const [rows] = await db.promise().query(
      `SELECT id, titel, kurzbeschreibung, inhalt, bild_url, bilder_json,
              kategorie, tags, featured, auf_intl,
              veroeffentlicht_am, geplant_am, created_at
       FROM news_articles
       WHERE (dojo_id = ? OR dojo_id IS NULL)
         AND (status = 'veroeffentlicht' OR (status = 'geplant' AND geplant_am IS NOT NULL AND geplant_am <= NOW()))
         AND (ablauf_am IS NULL OR ablauf_am > NOW())
         ${zFilter}
       ORDER BY COALESCE(veroeffentlicht_am, geplant_am, created_at) DESC
       LIMIT 10`,
      [dojoId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    logger.error('Fehler beim Laden der öffentlichen News (JSON):', { error: err.message });
    res.status(500).json({ success: false, error: 'Fehler beim Laden der News' });
  }
});

/**
 * GET /api/public/news/widget?dojo_id=X
 * iframe-Widget: Styled HTML-Seite mit News-Liste
 */
router.get('/widget', async (req, res) => {
  setCorsHeaders(res);
  const dojoId = parseInt(req.query.dojo_id);
  if (!dojoId || isNaN(dojoId)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send('<p style="font-family:sans-serif;color:#c00">Fehler: dojo_id fehlt</p>');
  }

  try {
    // Dojo-Name laden
    const [dojos] = await db.promise().query(
      'SELECT dojoname FROM dojo WHERE id = ?', [dojoId]
    );
    const dojoName = dojos.length > 0 ? dojos[0].dojoname : 'Dojo';

    // News laden (zielgruppe-gefiltert)
    const zFilter = getZielgruppeFilter(dojoId);
    const [rows] = await db.promise().query(
      `SELECT id, titel, kurzbeschreibung, inhalt, bild_url, bilder_json, veroeffentlicht_am, created_at
       FROM news_articles
       WHERE (dojo_id = ? OR dojo_id IS NULL) AND status = 'veroeffentlicht' ${zFilter}
       ORDER BY COALESCE(veroeffentlicht_am, created_at) DESC
       LIMIT 8`,
      [dojoId]
    );

    // HTML aufbauen
    const formatDate = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      return dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const stripHtml = (html) => {
      if (!html) return '';
      return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    };

    const articlesHtml = rows.length === 0
      ? '<p class="no-news">Keine aktuellen Neuigkeiten</p>'
      : rows.map(a => {
          const text = a.kurzbeschreibung
            ? stripHtml(a.kurzbeschreibung)
            : stripHtml(a.inhalt).substring(0, 150) + '…';
          const datum = formatDate(a.veroeffentlicht_am || a.created_at);
          return `
          <article class="news-item">
            <div class="news-meta">${datum}</div>
            <h3 class="news-titel">${escapeHtml(a.titel)}</h3>
            <p class="news-text">${escapeHtml(text)}</p>
          </article>`;
        }).join('');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(dojoName)} – Aktuelles</title>
<style>
  :root {
    --bg: #ffffff;
    --text: #1a1a1a;
    --muted: #666;
    --border: #e5e7eb;
    --accent: #8B0000;
    --item-bg: #f9fafb;
    --radius: 8px;
    --font: system-ui, -apple-system, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #1a1a1a;
      --text: #f0f0f0;
      --muted: #aaa;
      --border: #333;
      --accent: #c0392b;
      --item-bg: #252525;
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--text);
    padding: 1rem;
    font-size: 14px;
    line-height: 1.5;
  }
  .widget-header {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--accent);
    border-bottom: 2px solid var(--accent);
    padding-bottom: 0.4rem;
    margin-bottom: 0.75rem;
  }
  .news-item {
    background: var(--item-bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.75rem 1rem;
    margin-bottom: 0.6rem;
  }
  .news-meta {
    font-size: 0.7rem;
    color: var(--muted);
    margin-bottom: 0.25rem;
  }
  .news-titel {
    font-size: 0.9rem;
    font-weight: 600;
    margin-bottom: 0.3rem;
    color: var(--text);
  }
  .news-text {
    font-size: 0.8rem;
    color: var(--muted);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .no-news {
    color: var(--muted);
    font-style: italic;
    text-align: center;
    padding: 1rem 0;
  }
  .widget-footer {
    font-size: 0.65rem;
    color: var(--muted);
    text-align: right;
    margin-top: 0.5rem;
  }
</style>
</head>
<body>
  <div class="widget-header">Aktuelles – ${escapeHtml(dojoName)}</div>
  ${articlesHtml}
  <div class="widget-footer">via Dojosoftware</div>
</body>
</html>`);
  } catch (err) {
    logger.error('Fehler beim News-Widget:', { error: err.message });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(500).send('<p style="font-family:sans-serif;color:#c00">Fehler beim Laden</p>');
  }
});

/**
 * GET /api/public/news/feed.rss?dojo_id=X
 * RSS 2.0 Feed
 */
router.get('/feed.rss', async (req, res) => {
  setCorsHeaders(res);
  const dojoId = parseInt(req.query.dojo_id);
  if (!dojoId || isNaN(dojoId)) {
    return res.status(400).send('<?xml version="1.0"?><error>dojo_id fehlt</error>');
  }

  try {
    // Dojo-Name laden
    const [dojos] = await db.promise().query(
      'SELECT dojoname FROM dojo WHERE id = ?', [dojoId]
    );
    const dojoName = dojos.length > 0 ? dojos[0].dojoname : 'Dojo';

    // News laden
    const zFilter = getZielgruppeFilter(dojoId);
    const [rows] = await db.promise().query(
      `SELECT id, titel, kurzbeschreibung, inhalt, bild_url, bilder_json, veroeffentlicht_am, created_at
       FROM news_articles
       WHERE (dojo_id = ? OR dojo_id IS NULL) AND status = 'veroeffentlicht' ${zFilter}
       ORDER BY COALESCE(veroeffentlicht_am, created_at) DESC
       LIMIT 20`,
      [dojoId]
    );

    const stripHtml = (html) => {
      if (!html) return '';
      return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    };

    const toRfc2822 = (d) => {
      if (!d) return '';
      return new Date(d).toUTCString();
    };

    const items = rows.map(a => {
      const datum = a.veroeffentlicht_am || a.created_at;
      const beschreibung = stripHtml(a.kurzbeschreibung || a.inhalt).substring(0, 500);
      return `
    <item>
      <title><![CDATA[${a.titel}]]></title>
      <description><![CDATA[${beschreibung}]]></description>
      <pubDate>${toRfc2822(datum)}</pubDate>
      <guid>https://app.tda-vib.de/dashboard/news#${a.id}</guid>
    </item>`;
    }).join('');

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title><![CDATA[${dojoName} – Aktuelles]]></title>
    <link>https://app.tda-vib.de</link>
    <description><![CDATA[Aktuelle Neuigkeiten von ${dojoName}]]></description>
    <language>de-de</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(rss);
  } catch (err) {
    logger.error('Fehler beim RSS-Feed:', { error: err.message });
    res.status(500).send('<?xml version="1.0"?><error>Interner Fehler</error>');
  }
});

// TDA dojo_id (nur explizit freigegebene News nach außen filtern)
const TDA_DOJO_ID = 2;

// Zielgruppe-Filter:
// tda-vib.de:    zielgruppe = 'homepage'
// tda-intl.com:  auf_intl = 1
function getZielgruppeFilter(dojoId, target = 'vib') {
  if (dojoId === TDA_DOJO_ID) {
    if (target === 'intl') return "AND auf_intl = 1";
    return "AND zielgruppe = 'homepage'";
  }
  return '';
}

// XSS-Schutz Helper
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

module.exports = router;
