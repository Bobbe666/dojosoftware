// Backend/services/emailLayout.js
// =============================================================================
// Zentrales Dojo-Mail-Layout — EINE Quelle für das HTML-Grundgerüst aller Mails.
// Tabellen-basiert (Outlook-robust), responsive, heller Body mit dunklem Header.
//
// White-Label: Pro Dojo werden Name + Akzentfarbe (+ Logo, falls vorhanden) aus
// der dojo-Tabelle gezogen (dojoname, theme_farbe, farbe, logo_url). Der Loader
// akzeptiert dojoId ODER dojoname, damit bestehende Sendestellen (die nur den
// Namen kennen) ohne Aufrufer-Umbau ein passendes Theme bekommen.
//
//   const { renderEmail, getDojoMailTheme } = require('./emailLayout');
//   const theme = await getDojoMailTheme({ dojoId, dojoname });
//   const html  = renderEmail({ theme, titel, bodyHtml, cta });
// =============================================================================

const db = require('../db');
const fs = require('fs');

const PUBLIC_URL = process.env.DOJO_PUBLIC_URL || 'https://dojo.tda-intl.org';

// Zentrale Banner-Verwaltung: ein manifest.json (gepflegt vom Super-Admin-Dashboard)
// sagt, welche (app, anlass) ein Banner haben. Liegt im Dojo-uploads und wird von
// allen drei Apps gelesen. Fehlt es → kein Banner (kein broken-image).
const MANIFEST_PATH = process.env.MAIL_BANNER_MANIFEST || '/var/www/dojosoftware/backend/uploads/mail-banners/manifest.json';
let _bm = { t: 0, v: {} };
function bannerUrlFor(app, anlass) {
  try {
    if (Date.now() - _bm.t > 60000) { _bm = { t: Date.now(), v: JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) }; }
    const e = _bm.v[`${app}-${anlass}`];
    return e ? e.url : null;
  } catch { return null; }
}

const DEFAULT_THEME = {
  primary:  '#1e293b',   // Header-Gradient dunkel
  primary2: '#0f172a',
  accent:   '#DAA520',   // Akzent/Headline (Default = TDA-Gold)
  accent2:  '#FFD700',
  logoUrl:  null,
  dojoName: null,
  publicUrl: PUBLIC_URL,
};

const _themeCache = new Map(); // key → { t, v }

// Lädt das Mail-Theme eines Dojos aus der dojo-Tabelle. dojoId hat Vorrang,
// sonst Lookup per dojoname. Fällt immer sauber auf DEFAULT_THEME zurück.
async function getDojoMailTheme(opts = {}) {
  const base = { ...DEFAULT_THEME, dojoName: opts.dojoname || null };
  const key = opts.dojoId ? ('id:' + opts.dojoId) : (opts.dojoname ? ('n:' + opts.dojoname) : null);
  if (!key) return base;
  const cached = _themeCache.get(key);
  if (cached && (Date.now() - cached.t < 120000)) return cached.v;
  try {
    const pool = db.promise();
    let row;
    if (opts.dojoId) {
      [[row]] = await pool.query('SELECT dojoname, logo_url, theme_farbe, farbe FROM dojo WHERE id = ? LIMIT 1', [opts.dojoId]);
    } else {
      [[row]] = await pool.query('SELECT dojoname, logo_url, theme_farbe, farbe FROM dojo WHERE dojoname = ? LIMIT 1', [opts.dojoname]);
    }
    let theme = base;
    if (row) {
      let logo = row.logo_url || null;
      if (logo && !/^https?:\/\//i.test(logo)) logo = PUBLIC_URL + (logo.startsWith('/') ? '' : '/') + logo;
      theme = {
        ...base,
        dojoName: row.dojoname || base.dojoName,
        logoUrl:  logo,
        accent:   row.theme_farbe || base.accent,
        accent2:  row.farbe || base.accent2,
      };
    }
    _themeCache.set(key, { t: Date.now(), v: theme });
    return theme;
  } catch {
    return base;
  }
}

// Bulletproof Button in der Akzentfarbe des Dojos.
function button(cta, theme) {
  if (!cta || !cta.url) return '';
  const bg = cta.color || theme.accent || '#DAA520';
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:6px auto 2px;">
    <tr><td align="center" bgcolor="${bg}" style="border-radius:7px;">
      <a href="${cta.url}" target="_blank"
         style="display:inline-block;padding:13px 34px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#1a1a1a;text-decoration:none;border-radius:7px;">
        ${cta.label || 'Mehr erfahren'}
      </a>
    </td></tr>
  </table>`;
}

/**
 * Rendert eine vollständige HTML-Mail im Dojo-Look (White-Label pro Dojo).
 * @param {object} o
 * @param {object} [o.theme]     aus getDojoMailTheme(); fehlt → DEFAULT_THEME
 * @param {string} o.titel       Header-Titel (Default: Dojo-Name)
 * @param {string} [o.subtitel]  Zeile unter dem Titel
 * @param {string} o.bodyHtml    Haupt-Inhalt (HTML-Schnipsel)
 * @param {object} [o.cta]       { url, label, color }
 * @param {string} [o.footerNote] zusätzliche Footer-Zeile
 * @param {string} [o.anlass]    einladung|begruessung|rechnung|allgemein (für Banner)
 * @param {string} [o.bannerUrl] Banner-URL überschreiben
 * @param {boolean}[o.showBanner]
 */
function renderEmail(o = {}) {
  const theme = { ...DEFAULT_THEME, ...(o.theme || {}) };
  const anlass = o.anlass || 'allgemein';
  const titel = o.titel || theme.dojoName || 'Dojo';
  const subtitel = o.subtitel || '';
  const body = o.bodyHtml || '';
  const footerName = theme.dojoName || 'Dojo';
  const footerNote = o.footerNote || '';
  const bannerUrl = o.showBanner === false
    ? null
    : (o.bannerUrl || bannerUrlFor('dojo', anlass));

  const bannerRow = bannerUrl
    ? `<tr><td style="padding:0;font-size:0;line-height:0;"><img src="${bannerUrl}" width="600" alt="${titel}" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/></td></tr>`
    : '';

  const headerInner = theme.logoUrl
    ? `<img src="${theme.logoUrl}" alt="${titel}" height="48" style="height:48px;max-height:48px;width:auto;border:0;display:inline-block;" />`
    : `<div style="font-size:22px;font-weight:bold;color:${theme.accent};line-height:1.2;">${titel}</div>`;

  const ctaRow = o.cta && o.cta.url
    ? `<tr><td class="pad" align="center" style="padding:4px 32px 26px;">${button(o.cta, theme)}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<title>${titel}</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  img{-ms-interpolation-mode:bicubic;}
  .b h2{color:${theme.primary};margin-top:0;font-size:19px;}
  .b a{color:${theme.primary};}
  .b .box{background:#f0f9ff;border-left:4px solid ${theme.accent};padding:13px 16px;margin:18px 0;border-radius:0 6px 6px 0;}
  .b .box p{margin:4px 0;font-size:14px;color:#334155;}
  .b table.data{width:100%;border-collapse:collapse;margin:16px 0;}
  .b table.data td{padding:8px 10px;font-size:13px;border-bottom:1px solid #eef2f7;color:#334155;}
  @media only screen and (max-width:620px){.container{width:100%!important;}.pad{padding-left:20px!important;padding-right:20px!important;}}
</style></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${subtitel || titel}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f5f9"><tr><td align="center" style="padding:22px 12px;">
  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:600px;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(15,23,42,.12);">
    ${bannerRow}
    <tr><td align="center" style="background:${theme.primary};background:linear-gradient(135deg,${theme.primary} 0%,${theme.primary2} 100%);padding:30px 32px;font-family:Arial,Helvetica,sans-serif;">
      ${headerInner}
      ${subtitel ? `<div style="font-size:13px;color:rgba(255,255,255,.82);margin-top:8px;">${subtitel}</div>` : ''}
    </td></tr>
    <tr><td class="b pad" style="padding:26px 32px;font-family:Arial,Helvetica,sans-serif;color:#475569;line-height:1.6;font-size:14px;">${body}</td></tr>
    ${ctaRow}
    <tr><td class="pad" align="center" style="background:#f8fafc;padding:18px 32px;border-top:1px solid #eef2f7;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94a3b8;line-height:1.6;">
      ${footerNote ? `<div style="margin-bottom:8px;color:#64748b;">${footerNote}</div>` : ''}
      <strong style="color:#64748b;">${footerName}</strong><br/>
      Diese E-Mail wurde automatisch generiert.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

module.exports = { renderEmail, getDojoMailTheme, DEFAULT_THEME, PUBLIC_URL };
