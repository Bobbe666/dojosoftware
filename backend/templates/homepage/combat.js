// ============================================================
// TEMPLATE: COMBAT
// Stil: MMA / BJJ / Submission Wrestling
// Farben: Tiefes Schwarz + Blutrot + Chrome-Silber
// Gefühl: Aggressiv, kraftvoll, roh
// ============================================================

'use strict';

function renderCombat(config, schedule = []) {
  const c = config || {};
  const primary = c.primary_color || '#C41E3A';
  const accent = c.gold_color || '#8B8B8B';
  const schoolName = escHtml(c.school_name || 'Dojo');
  const subtitle = escHtml(c.school_subtitle || '');
  const tagline = escHtml(c.tagline || 'Keine Ausreden. Nur Training.');
  const kanji = escHtml(c.logo_kanji || '闘');
  const logoUrl = c.logo_url || null;
  const heroImage = c.hero_image_url || null;

  const navItems = (c.nav_items || [])
    .map(n => `<a href="${escAttr(n.href)}">${escHtml(n.label)}</a>`)
    .join('');

  const stile = (c.stile || []).map(s => `
    <div class="style-block">
      <div class="style-header">
        <span class="style-icon">${escHtml(s.icon || '🥊')}</span>
        <span class="style-kanji">${escHtml(s.kanji || '')}</span>
      </div>
      <h3>${escHtml(s.name || '')}</h3>
      <p>${escHtml(s.japanese || '')}</p>
      <div class="style-bar"></div>
    </div>`).join('');

  const werte = (c.werte || []).map((w, i) => `
    <div class="wert-block">
      <div class="wert-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="wert-kanji">${escHtml(w.kanji || '')}</div>
      <h3>${escHtml(w.name || '')}</h3>
      <p>${escHtml(w.text || '')}</p>
    </div>`).join('');

  const scheduleRows = schedule.slice(0, 8).map(row => `
    <tr>
      <td><span class="td-label">TAG</span>${escHtml(row.wochentag || row.day || '')}</td>
      <td><span class="td-label">ZEIT</span>${escHtml(row.uhrzeit || row.time || '')}</td>
      <td><span class="td-label">KURS</span>${escHtml(row.kursname || row.course || '')}</td>
      <td><span class="td-label">TRAINER</span>${escHtml(row.trainer || '—')}</td>
    </tr>`).join('');

  const contact = c.contact || {};
  const cta = c.cta || {};

  const heroStyle = heroImage
    ? `background: linear-gradient(135deg, rgba(0,0,0,0.9) 0%, rgba(${hexToRgb(primary)},0.4) 100%), url('${escAttr(heroImage)}') center/cover;`
    : `background: linear-gradient(135deg, #0d0d0d 0%, #1a0000 50%, #0d0d0d 100%);`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${schoolName} — ${subtitle || 'MMA & Combat Sports'}</title>
  <meta name="description" content="${tagline}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;700;900&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --primary: ${primary};
      --accent: ${accent};
      --dark: #0d0d0d;
      --dark2: #111;
      --dark3: #181818;
      --text: #e8e8e8;
      --text-dim: #666;
      --chrome: #9ca3af;
    }

    html { scroll-behavior: smooth; }
    body {
      font-family: 'Inter', sans-serif;
      background: var(--dark);
      color: var(--text);
      line-height: 1.6;
    }

    /* ── NAV ── */
    nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 5%; height: 68px;
      background: rgba(13,13,13,0.97);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .nav-logo {
      display: flex; align-items: center; gap: 12px;
      text-decoration: none; color: var(--text);
    }
    .nav-logo .kanji {
      font-family: serif; font-size: 1.8rem;
      color: var(--primary); line-height: 1;
    }
    .nav-logo .name {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.3rem; letter-spacing: 0.1em;
    }
    .nav-links { display: flex; gap: 28px; }
    .nav-links a {
      color: var(--text-dim); text-decoration: none;
      font-size: 0.78rem; letter-spacing: 0.12em;
      text-transform: uppercase; transition: color 0.2s;
    }
    .nav-links a:hover { color: var(--primary); }
    .nav-cta {
      background: var(--primary); color: #fff;
      padding: 10px 22px; text-decoration: none;
      font-family: 'Bebas Neue', sans-serif;
      font-size: 0.9rem; letter-spacing: 0.1em;
      clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%);
      transition: background 0.2s;
    }
    .nav-cta:hover { background: #a01530; }

    /* ── HERO ── */
    .hero {
      min-height: 100vh;
      ${heroStyle}
      display: flex; align-items: center;
      padding: 100px 5% 80px;
      position: relative; overflow: hidden;
    }
    .hero::after {
      content: '${kanji}';
      position: absolute; right: 5%; bottom: -5%;
      font-family: serif; font-size: 40vw;
      color: rgba(${hexToRgb(primary)},0.04);
      line-height: 1; pointer-events: none;
      user-select: none;
    }
    .hero-content { position: relative; z-index: 1; max-width: 700px; }
    .hero-label {
      display: inline-flex; align-items: center; gap: 10px;
      background: rgba(${hexToRgb(primary)},0.15);
      border: 1px solid rgba(${hexToRgb(primary)},0.3);
      padding: 6px 16px; margin-bottom: 24px;
      font-size: 0.7rem; letter-spacing: 0.25em;
      text-transform: uppercase; color: var(--primary);
    }
    .hero h1 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: clamp(4rem, 9vw, 8rem);
      line-height: 0.9; letter-spacing: 0.02em;
      margin-bottom: 8px;
    }
    .hero h1 span { color: var(--primary); display: block; }
    .hero-tagline {
      font-size: 1.05rem; color: var(--chrome);
      margin-bottom: 48px; font-weight: 300;
      border-left: 3px solid var(--primary);
      padding-left: 16px; max-width: 480px;
    }
    .hero-btns { display: flex; gap: 16px; flex-wrap: wrap; }
    .btn-primary {
      background: var(--primary); color: #fff;
      padding: 16px 36px; text-decoration: none;
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1rem; letter-spacing: 0.12em;
      clip-path: polygon(10px 0%,100% 0%,calc(100%-10px) 100%,0% 100%);
      transition: all 0.2s; border: none;
    }
    .btn-primary:hover { background: #a01530; }
    .btn-outline {
      border: 1px solid rgba(255,255,255,0.2); color: var(--text);
      padding: 16px 36px; text-decoration: none;
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1rem; letter-spacing: 0.12em;
      clip-path: polygon(10px 0%,100% 0%,calc(100%-10px) 100%,0% 100%);
      transition: all 0.2s;
    }
    .btn-outline:hover { border-color: var(--primary); color: var(--primary); }
    .hero-tape {
      position: absolute; bottom: 0; left: 0; right: 0;
      background: var(--primary); height: 3px;
    }

    /* ── SECTIONS ── */
    section { padding: 90px 5%; }
    .section-tag {
      display: inline-block;
      background: rgba(${hexToRgb(primary)},0.15);
      border-left: 3px solid var(--primary);
      padding: 4px 12px;
      font-size: 0.65rem; letter-spacing: 0.3em;
      text-transform: uppercase; color: var(--primary);
      margin-bottom: 20px;
    }
    .section-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: clamp(2.5rem, 5vw, 4rem);
      letter-spacing: 0.05em; margin-bottom: 12px;
    }
    .section-sub { color: var(--chrome); max-width: 480px; font-size: 0.9rem; margin-bottom: 48px; }

    /* ── STILE ── */
    #stile { background: var(--dark2); }
    .stile-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 2px; max-width: 1100px;
    }
    .style-block {
      background: var(--dark3); padding: 36px 28px;
      border-bottom: 3px solid transparent;
      transition: all 0.2s; position: relative; overflow: hidden;
    }
    .style-block:hover { border-bottom-color: var(--primary); transform: translateY(-2px); }
    .style-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .style-icon { font-size: 1.8rem; }
    .style-kanji { font-family: serif; font-size: 1.6rem; color: var(--primary); }
    .style-block h3 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.4rem; letter-spacing: 0.06em;
      margin-bottom: 8px;
    }
    .style-block p { color: var(--text-dim); font-size: 0.82rem; font-style: italic; }
    .style-bar {
      position: absolute; bottom: 0; left: 0; width: 0;
      height: 3px; background: var(--primary);
      transition: width 0.3s;
    }
    .style-block:hover .style-bar { width: 100%; }

    /* ── STUNDENPLAN ── */
    #stundenplan { background: var(--dark); }
    .schedule-wrap { max-width: 1000px; border: 1px solid rgba(255,255,255,0.08); }
    table { width: 100%; border-collapse: collapse; }
    thead { background: var(--primary); }
    thead th {
      padding: 16px 20px; text-align: left;
      font-family: 'Bebas Neue', sans-serif;
      font-size: 0.9rem; letter-spacing: 0.1em;
    }
    tbody tr { border-bottom: 1px solid rgba(255,255,255,0.05); }
    tbody tr:hover { background: rgba(255,255,255,0.03); }
    tbody td { padding: 16px 20px; font-size: 0.88rem; }
    .td-label { display: none; }

    /* ── WERTE ── */
    #werte { background: var(--dark2); }
    .werte-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 2px; max-width: 1100px;
    }
    .wert-block {
      padding: 40px 32px;
      background: var(--dark3);
      border-top: 3px solid transparent;
      transition: border-color 0.2s;
    }
    .wert-block:hover { border-top-color: var(--primary); }
    .wert-num {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 3.5rem; color: rgba(${hexToRgb(primary)},0.15);
      line-height: 1; margin-bottom: -8px;
    }
    .wert-kanji {
      font-family: serif; font-size: 2.4rem;
      color: var(--primary); margin-bottom: 12px;
    }
    .wert-block h3 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.4rem; letter-spacing: 0.06em;
      margin-bottom: 10px;
    }
    .wert-block p { color: var(--text-dim); font-size: 0.88rem; }

    /* ── CTA ── */
    #cta {
      background: var(--primary);
      text-align: center; position: relative; overflow: hidden;
    }
    #cta::before {
      content: 'FIGHT';
      position: absolute; left: -5%; top: 50%; transform: translateY(-50%);
      font-family: 'Bebas Neue', sans-serif;
      font-size: 20vw; color: rgba(0,0,0,0.2);
      pointer-events: none;
    }
    #cta h2 {
      position: relative;
      font-family: 'Bebas Neue', sans-serif;
      font-size: clamp(2.5rem, 5vw, 4rem);
      letter-spacing: 0.06em; margin-bottom: 12px;
    }
    #cta p {
      position: relative;
      color: rgba(255,255,255,0.8); max-width: 480px;
      margin: 0 auto 36px; font-size: 1rem;
    }
    #cta .btn-cta {
      position: relative;
      background: #0d0d0d; color: #fff;
      padding: 18px 48px; text-decoration: none;
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.1rem; letter-spacing: 0.12em;
      clip-path: polygon(12px 0%,100% 0%,calc(100%-12px) 100%,0% 100%);
      display: inline-block; transition: background 0.2s;
    }
    #cta .btn-cta:hover { background: #1a1a1a; }

    /* ── FOOTER ── */
    footer {
      background: #070707; padding: 60px 5% 28px;
      border-top: 3px solid var(--primary);
    }
    .footer-content {
      display: grid; grid-template-columns: 2fr 1fr 1fr;
      gap: 48px; max-width: 1100px; margin: 0 auto;
    }
    .footer-logo-name {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1.8rem; color: #fff; letter-spacing: 0.08em;
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 12px;
    }
    .footer-logo-name .kanji { color: var(--primary); font-family: serif; font-size: 2rem; }
    .footer-brand p { color: var(--text-dim); font-size: 0.85rem; }
    .footer-col h4 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 1rem; letter-spacing: 0.12em;
      color: var(--primary); margin-bottom: 16px;
    }
    .footer-col p, .footer-col a {
      display: block; color: var(--text-dim);
      text-decoration: none; font-size: 0.84rem;
      margin-bottom: 8px; transition: color 0.2s;
    }
    .footer-col a:hover { color: var(--text); }
    .footer-bottom {
      max-width: 1100px; margin: 36px auto 0;
      padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06);
      display: flex; justify-content: space-between;
      font-size: 0.72rem; color: var(--text-dim);
    }
    .footer-bottom a { color: var(--text-dim); text-decoration: none; }
    .footer-bottom a:hover { color: var(--primary); }

    /* ── RESPONSIVE ── */
    @media (max-width: 768px) {
      .nav-links { display: none; }
      .footer-content { grid-template-columns: 1fr; gap: 28px; }
      .footer-bottom { flex-direction: column; gap: 8px; }
      .td-label { display: inline; font-size: 0.65rem; color: var(--primary); letter-spacing: 0.1em; text-transform: uppercase; margin-right: 4px; }
      table { display: block; }
      thead { display: none; }
      tbody, tr, td { display: block; }
      tbody tr { padding: 12px 20px; }
      tbody td { padding: 3px 0; border: none; }
    }
  </style>
</head>
<body>

  <!-- NAV -->
  <nav>
    <a href="#" class="nav-logo">
      ${logoUrl
        ? `<img src="${escAttr(logoUrl)}" alt="${schoolName}" style="height:36px;object-fit:contain;">`
        : `<span class="kanji">${kanji}</span>`}
      <span class="name">${schoolName}</span>
    </a>
    <div class="nav-links">${navItems}</div>
    <a href="${escAttr(c.hero_cta_primary?.href || '#kontakt')}" class="nav-cta">
      ${escHtml(c.hero_cta_primary?.text || 'Probetraining')}
    </a>
  </nav>

  <!-- HERO -->
  <section class="hero" id="hero">
    <div class="hero-content">
      ${subtitle ? `<div class="hero-label">${subtitle}</div>` : ''}
      <h1>${schoolName.includes(' ') ? schoolName.replace(/ /, '<br><span>') + '</span>' : schoolName}</h1>
      <p class="hero-tagline">${tagline}</p>
      <div class="hero-btns">
        <a href="${escAttr(c.hero_cta_primary?.href || '#kontakt')}" class="btn-primary">
          ${escHtml(c.hero_cta_primary?.text || 'Probetraining')}
        </a>
        <a href="${escAttr(c.hero_cta_secondary?.href || '#stile')}" class="btn-outline">
          ${escHtml(c.hero_cta_secondary?.text || 'Programm ansehen')}
        </a>
      </div>
    </div>
    <div class="hero-tape"></div>
  </section>

  <!-- STILE -->
  ${(c.sections || []).find(s => s.type === 'kampfkunststile' && s.visible !== false) ? `
  <section id="stile">
    <div class="section-tag">Disziplinen</div>
    <h2 class="section-title">Combat Sports</h2>
    <p class="section-sub">Wir trainieren echte Kampfsysteme — für den Sport, die Straße und den Geist.</p>
    <div class="stile-grid">${stile || '<p style="color:var(--text-dim)">Keine Stile konfiguriert</p>'}</div>
  </section>` : ''}

  <!-- STUNDENPLAN -->
  ${(c.sections || []).find(s => s.type === 'stundenplan_preview' && s.visible !== false) ? `
  <section id="stundenplan">
    <div class="section-tag">Training</div>
    <h2 class="section-title">Trainingszeiten</h2>
    <p class="section-sub">Regelmäßiges Training ist der Schlüssel zum Fortschritt.</p>
    ${scheduleRows ? `
    <div class="schedule-wrap">
      <table>
        <thead><tr><th>Tag</th><th>Zeit</th><th>Kurs</th><th>Trainer</th></tr></thead>
        <tbody>${scheduleRows}</tbody>
      </table>
    </div>` : '<p style="color:var(--text-dim)">Stundenplan wird nach Veröffentlichung angezeigt.</p>'}
  </section>` : ''}

  <!-- WERTE -->
  ${(c.sections || []).find(s => s.type === 'werte' && s.visible !== false) ? `
  <section id="werte">
    <div class="section-tag">Philosophie</div>
    <h2 class="section-title">Code of Conduct</h2>
    <p class="section-sub">Kampfkunst formt Charakter. Diese Werte leben wir täglich.</p>
    <div class="werte-grid">${werte || ''}</div>
  </section>` : ''}

  <!-- CTA -->
  <section id="cta">
    <h2>${escHtml(cta.title || 'Bist du bereit?')}</h2>
    <p>${escHtml(cta.text || 'Komm zum kostenlosen Probetraining. Keine Verpflichtung.')}</p>
    <a href="${escAttr(cta.button_href || '#kontakt')}" class="btn-cta">
      ${escHtml(cta.button_text || 'Probetraining buchen')}
    </a>
  </section>

  <!-- FOOTER -->
  <footer id="kontakt">
    <div class="footer-content">
      <div class="footer-brand">
        <div class="footer-logo-name">
          <span class="kanji">${kanji}</span>
          ${schoolName}
        </div>
        <p>${subtitle || tagline}</p>
      </div>
      <div class="footer-col">
        <h4>Kontakt</h4>
        ${contact.address ? `<p>${escHtml(contact.address)}</p>` : ''}
        ${contact.phone ? `<a href="tel:${escAttr(contact.phone)}">${escHtml(contact.phone)}</a>` : ''}
        ${contact.email ? `<a href="mailto:${escAttr(contact.email)}">${escHtml(contact.email)}</a>` : ''}
      </div>
      <div class="footer-col">
        <h4>Navigation</h4>
        ${(c.nav_items || []).map(n => `<a href="${escAttr(n.href)}">${escHtml(n.label)}</a>`).join('')}
      </div>
    </div>
    <div class="footer-bottom">
      <span>&copy; ${new Date().getFullYear()} ${schoolName}</span>
      <a href="https://dojo.tda-intl.org" target="_blank" rel="noopener">Powered by Dojosoftware</a>
    </div>
  </footer>

</body>
</html>`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function escAttr(str) {
  if (!str) return '#';
  return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#C41E3A');
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '196,30,58';
}

module.exports = { render: renderCombat, id: 'combat', name: 'Combat', description: 'Aggressives Dark-Design für MMA & BJJ — Schwarz, Rot, Chrome' };
