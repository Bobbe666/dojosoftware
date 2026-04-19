// ============================================================
// TEMPLATE: ZEN
// Stil: Karate / Taekwondo / Traditionelle Kampfkünste
// Farben: Mitternachtsblau + Reinweiß + Zartes Gold
// Gefühl: Ruhig, diszipliniert, meditativ
// ============================================================

'use strict';

function renderZen(config, schedule = []) {
  const c = config || {};
  const primary = c.primary_color || '#1B2A4A';
  const accent = c.gold_color || '#B8963E';
  const schoolName = escHtml(c.school_name || 'Dojo');
  const subtitle = escHtml(c.school_subtitle || '');
  const tagline = escHtml(c.tagline || 'Stärke kommt von innen');
  const kanji = escHtml(c.logo_kanji || '道');
  const logoUrl = c.logo_url || null;
  const heroImage = c.hero_image_url || null;

  const navItems = (c.nav_items || [])
    .map(n => `<a href="${escAttr(n.href)}">${escHtml(n.label)}</a>`)
    .join('');

  const stile = (c.stile || []).map((s, i) => `
    <div class="style-item ${i % 2 === 0 ? '' : 'style-item--right'}">
      <div class="style-number">${String(i + 1).padStart(2, '0')}</div>
      <div class="style-body">
        <div class="style-top">
          <span class="style-kanji">${escHtml(s.kanji || '')}</span>
          <span class="style-icon">${escHtml(s.icon || '🥋')}</span>
        </div>
        <h3>${escHtml(s.name || '')}</h3>
        <p>${escHtml(s.japanese || '')}</p>
      </div>
    </div>`).join('');

  const werte = (c.werte || []).map(w => `
    <div class="wert-card">
      <div class="wert-symbol">${escHtml(w.kanji || '')}</div>
      <div class="wert-info">
        <span class="wert-jp">${escHtml(w.reading || '')} — ${escHtml(w.name || '')}</span>
        <p>${escHtml(w.text || '')}</p>
      </div>
    </div>`).join('');

  const scheduleRows = schedule.slice(0, 8).map(row => `
    <div class="sched-row">
      <span class="sched-day">${escHtml(row.wochentag || row.day || '')}</span>
      <span class="sched-time">${escHtml(row.uhrzeit || row.time || '')}</span>
      <span class="sched-course">${escHtml(row.kursname || row.course || '')}</span>
      <span class="sched-trainer">${escHtml(row.trainer || '')}</span>
    </div>`).join('');

  const contact = c.contact || {};
  const cta = c.cta || {};

  const heroBg = heroImage
    ? `background: linear-gradient(to right, rgba(${hexToRgb(primary)},0.95) 0%, rgba(${hexToRgb(primary)},0.6) 100%), url('${escAttr(heroImage)}') center/cover no-repeat;`
    : `background: linear-gradient(135deg, ${primary} 0%, #0d1930 100%);`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${schoolName} — ${subtitle || 'Kampfkunstschule'}</title>
  <meta name="description" content="${tagline}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --primary: ${primary};
      --accent: ${accent};
      --bg: #f8f6f1;
      --bg2: #ffffff;
      --dark: #0d1930;
      --text: #1a1a2e;
      --text-light: #6b7280;
      --border: #e5e0d5;
    }

    html { scroll-behavior: smooth; }
    body {
      font-family: 'Inter', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.8;
    }

    /* ── NAV ── */
    nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 6%;
      height: 76px;
      background: rgba(248,246,241,0.95);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border);
    }
    .nav-logo {
      display: flex; align-items: center; gap: 14px;
      text-decoration: none; color: var(--text);
    }
    .nav-logo .kanji {
      font-family: serif; font-size: 2rem;
      color: var(--primary); line-height: 1;
    }
    .nav-logo .name {
      font-family: 'Playfair Display', serif;
      font-size: 1.1rem; font-weight: 700;
    }
    .nav-links { display: flex; gap: 32px; }
    .nav-links a {
      color: var(--text-light); text-decoration: none;
      font-size: 0.85rem; transition: color 0.2s;
    }
    .nav-links a:hover { color: var(--primary); }
    .nav-cta {
      background: var(--primary); color: #fff;
      padding: 11px 24px; border-radius: 40px;
      text-decoration: none; font-size: 0.82rem;
      font-weight: 600; transition: all 0.2s;
    }
    .nav-cta:hover { background: var(--dark); }

    /* ── HERO ── */
    .hero {
      min-height: 100vh;
      ${heroBg}
      display: grid;
      grid-template-columns: 1fr 1fr;
      align-items: center;
      padding: 100px 6% 80px;
      color: #fff;
      gap: 60px;
    }
    .hero-left {}
    .hero-eyebrow {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 28px;
    }
    .hero-eyebrow .line { width: 40px; height: 1px; background: var(--accent); }
    .hero-eyebrow span {
      color: var(--accent); font-size: 0.72rem;
      letter-spacing: 0.3em; text-transform: uppercase;
    }
    .hero h1 {
      font-family: 'Playfair Display', serif;
      font-size: clamp(2.5rem, 5vw, 4.5rem);
      font-weight: 900; line-height: 1.1;
      margin-bottom: 20px;
    }
    .hero-sub {
      font-size: 1.05rem; color: rgba(255,255,255,0.75);
      margin-bottom: 48px; font-weight: 300;
    }
    .hero-btns { display: flex; gap: 16px; flex-wrap: wrap; }
    .btn-primary {
      background: var(--accent); color: var(--dark);
      padding: 15px 34px; text-decoration: none;
      font-size: 0.85rem; font-weight: 700;
      border-radius: 40px; transition: all 0.2s;
    }
    .btn-primary:hover { background: #fff; }
    .btn-outline {
      border: 2px solid rgba(255,255,255,0.4); color: #fff;
      padding: 15px 34px; text-decoration: none;
      font-size: 0.85rem; font-weight: 500;
      border-radius: 40px; transition: all 0.2s;
    }
    .btn-outline:hover { border-color: var(--accent); color: var(--accent); }
    .hero-right {
      display: flex; justify-content: center; align-items: center;
    }
    .hero-kanji-block {
      font-family: serif;
      font-size: clamp(8rem, 14vw, 14rem);
      color: rgba(255,255,255,0.1);
      line-height: 1;
      text-shadow: 0 0 60px rgba(255,255,255,0.08);
    }
    .hero-stats {
      display: flex; gap: 40px; margin-top: 52px;
    }
    .stat { }
    .stat-num {
      font-family: 'Playfair Display', serif;
      font-size: 2rem; font-weight: 900; color: var(--accent);
    }
    .stat-label { font-size: 0.75rem; color: rgba(255,255,255,0.55); text-transform: uppercase; letter-spacing: 0.1em; }

    /* ── SECTION BASE ── */
    section { padding: 100px 6%; }
    .section-header { margin-bottom: 56px; }
    .section-header .eyebrow {
      display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
    }
    .section-header .eyebrow .line { width: 32px; height: 1px; background: var(--accent); }
    .section-header .eyebrow span {
      color: var(--accent); font-size: 0.7rem;
      letter-spacing: 0.25em; text-transform: uppercase;
    }
    .section-header h2 {
      font-family: 'Playfair Display', serif;
      font-size: clamp(1.8rem, 3vw, 2.8rem); font-weight: 700;
    }
    .section-header p { color: var(--text-light); max-width: 500px; margin-top: 12px; }

    /* ── KAMPFKUNSTSTILE ── */
    #stile { background: var(--bg2); }
    .stile-list { max-width: 1000px; }
    .style-item {
      display: flex; align-items: center; gap: 32px;
      padding: 28px 32px;
      border: 1px solid var(--border);
      margin-bottom: 12px;
      background: var(--bg);
      transition: all 0.2s;
    }
    .style-item:hover { transform: translateX(6px); border-color: var(--primary); }
    .style-number {
      font-family: 'Playfair Display', serif;
      font-size: 2.5rem; color: var(--border);
      font-weight: 900; min-width: 60px;
    }
    .style-top { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
    .style-kanji { font-family: serif; font-size: 1.8rem; color: var(--primary); }
    .style-icon { font-size: 1.4rem; }
    .style-body h3 {
      font-family: 'Playfair Display', serif;
      font-size: 1.2rem; font-weight: 700;
    }
    .style-body p { color: var(--text-light); font-size: 0.85rem; margin-top: 4px; font-style: italic; }

    /* ── STUNDENPLAN ── */
    #stundenplan { background: var(--bg); }
    .schedule-list { max-width: 900px; }
    .sched-row {
      display: grid;
      grid-template-columns: 120px 120px 1fr auto;
      gap: 20px; align-items: center;
      padding: 18px 24px;
      border-bottom: 1px solid var(--border);
    }
    .sched-row:first-child { background: var(--primary); color: #fff; border-radius: 4px 4px 0 0; }
    .sched-day { font-weight: 600; font-size: 0.9rem; }
    .sched-time { color: var(--accent); font-size: 0.9rem; font-weight: 500; }
    .sched-course { font-size: 0.9rem; }
    .sched-trainer { color: var(--text-light); font-size: 0.82rem; }

    /* ── WERTE ── */
    #werte { background: var(--primary); color: #fff; }
    #werte .section-header h2 { color: #fff; }
    #werte .section-header p { color: rgba(255,255,255,0.6); }
    .werte-list { max-width: 800px; }
    .wert-card {
      display: flex; align-items: flex-start; gap: 28px;
      padding: 28px 0;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .wert-card:last-child { border-bottom: none; }
    .wert-symbol {
      font-family: serif; font-size: 3rem;
      color: var(--accent); line-height: 1;
      min-width: 60px; text-align: center;
    }
    .wert-jp {
      display: block; color: var(--accent);
      font-size: 0.7rem; letter-spacing: 0.2em;
      text-transform: uppercase; margin-bottom: 8px;
    }
    .wert-info p { color: rgba(255,255,255,0.7); font-size: 0.9rem; }

    /* ── CTA ── */
    #cta {
      background: var(--bg2);
      display: grid; grid-template-columns: 1fr auto;
      gap: 40px; align-items: center;
    }
    #cta h2 {
      font-family: 'Playfair Display', serif;
      font-size: clamp(1.6rem, 2.5vw, 2.2rem); font-weight: 700;
    }
    #cta p { color: var(--text-light); margin-top: 10px; }
    #cta .btn-cta {
      background: var(--primary); color: #fff;
      padding: 18px 40px; text-decoration: none;
      font-size: 0.9rem; font-weight: 600;
      border-radius: 40px; white-space: nowrap;
      transition: background 0.2s;
    }
    #cta .btn-cta:hover { background: var(--dark); }

    /* ── FOOTER ── */
    footer {
      background: var(--dark); color: rgba(255,255,255,0.6);
      padding: 60px 6% 32px;
    }
    .footer-grid {
      display: grid; grid-template-columns: 2fr 1fr 1fr;
      gap: 48px; max-width: 1100px; margin: 0 auto;
    }
    .footer-brand-name {
      font-family: 'Playfair Display', serif;
      font-size: 1.3rem; color: #fff; margin-bottom: 12px;
    }
    .footer-brand p { font-size: 0.85rem; line-height: 1.7; }
    .footer-col h4 {
      color: var(--accent); font-size: 0.7rem;
      letter-spacing: 0.2em; text-transform: uppercase;
      margin-bottom: 20px;
    }
    .footer-col a, .footer-col p {
      display: block; color: rgba(255,255,255,0.5);
      text-decoration: none; font-size: 0.85rem;
      margin-bottom: 10px; transition: color 0.2s;
    }
    .footer-col a:hover { color: #fff; }
    .footer-bottom {
      max-width: 1100px; margin: 40px auto 0;
      padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08);
      display: flex; justify-content: space-between;
      font-size: 0.75rem;
    }
    .footer-bottom a { color: rgba(255,255,255,0.4); text-decoration: none; }
    .footer-bottom a:hover { color: var(--accent); }

    /* ── RESPONSIVE ── */
    @media (max-width: 900px) {
      .hero { grid-template-columns: 1fr; }
      .hero-right { display: none; }
      #cta { grid-template-columns: 1fr; }
      .footer-grid { grid-template-columns: 1fr; gap: 32px; }
    }
    @media (max-width: 768px) {
      .nav-links { display: none; }
      .sched-row { grid-template-columns: 1fr 1fr; }
      .sched-trainer { display: none; }
    }
  </style>
</head>
<body>

  <!-- NAV -->
  <nav>
    <a href="#" class="nav-logo">
      ${logoUrl
        ? `<img src="${escAttr(logoUrl)}" alt="${schoolName}" style="height:40px;object-fit:contain;">`
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
    <div class="hero-left">
      <div class="hero-eyebrow">
        <div class="line"></div>
        <span>${subtitle || 'Kampfkunstschule'}</span>
      </div>
      <h1>${schoolName}</h1>
      <p class="hero-sub">${tagline}</p>
      <div class="hero-btns">
        <a href="${escAttr(c.hero_cta_primary?.href || '#kontakt')}" class="btn-primary">
          ${escHtml(c.hero_cta_primary?.text || 'Probetraining')}
        </a>
        <a href="${escAttr(c.hero_cta_secondary?.href || '#stile')}" class="btn-outline">
          ${escHtml(c.hero_cta_secondary?.text || 'Unsere Kurse')}
        </a>
      </div>
      <div class="hero-stats">
        <div class="stat"><div class="stat-num">∞</div><div class="stat-label">Wachstum</div></div>
        <div class="stat"><div class="stat-num">道</div><div class="stat-label">Der Weg</div></div>
        <div class="stat"><div class="stat-num">礼</div><div class="stat-label">Respekt</div></div>
      </div>
    </div>
    <div class="hero-right">
      <div class="hero-kanji-block">${kanji}</div>
    </div>
  </section>

  <!-- KAMPFKUNSTSTILE -->
  ${(c.sections || []).find(s => s.type === 'kampfkunststile' && s.visible !== false) ? `
  <section id="stile">
    <div class="section-header">
      <div class="eyebrow"><div class="line"></div><span>Disziplinen</span></div>
      <h2>Kampfkunststile</h2>
      <p>Jede Disziplin ist ein Pfad zur Vervollkommnung von Körper, Geist und Charakter.</p>
    </div>
    <div class="stile-list">${stile || '<p style="color:var(--text-light)">Noch keine Stile konfiguriert</p>'}</div>
  </section>` : ''}

  <!-- STUNDENPLAN -->
  ${(c.sections || []).find(s => s.type === 'stundenplan_preview' && s.visible !== false) ? `
  <section id="stundenplan">
    <div class="section-header">
      <div class="eyebrow"><div class="line"></div><span>Training</span></div>
      <h2>Stundenplan</h2>
    </div>
    ${scheduleRows ? `
    <div class="schedule-list">
      <div class="sched-row">
        <span class="sched-day" style="color:#fff">Tag</span>
        <span class="sched-time" style="color:#fff">Uhrzeit</span>
        <span class="sched-course" style="color:#fff">Kurs</span>
        <span class="sched-trainer" style="color:#fff">Trainer</span>
      </div>
      ${scheduleRows}
    </div>` : '<p style="color:var(--text-light)">Stundenplan wird nach der Veröffentlichung angezeigt.</p>'}
  </section>` : ''}

  <!-- WERTE -->
  ${(c.sections || []).find(s => s.type === 'werte' && s.visible !== false) ? `
  <section id="werte">
    <div class="section-header">
      <div class="eyebrow"><div class="line"></div><span>Philosophie</span></div>
      <h2>Unsere Werte</h2>
      <p>Die Werte der Kampfkunst bilden das Fundament unserer Gemeinschaft.</p>
    </div>
    <div class="werte-list">${werte || ''}</div>
  </section>` : ''}

  <!-- CTA -->
  <section id="cta">
    <div>
      <h2>${escHtml(cta.title || 'Beginne deinen Weg')}</h2>
      <p>${escHtml(cta.text || 'Das erste Probetraining ist kostenlos und unverbindlich.')}</p>
    </div>
    <a href="${escAttr(cta.button_href || '#kontakt')}" class="btn-cta">
      ${escHtml(cta.button_text || 'Probetraining vereinbaren')}
    </a>
  </section>

  <!-- FOOTER -->
  <footer id="kontakt">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="footer-brand-name">${schoolName}</div>
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
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#1B2A4A');
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '27,42,74';
}

module.exports = { render: renderZen, id: 'zen', name: 'Zen', description: 'Minimalistisches Design für Karate & Taekwondo — Blau, Weiß, Gold' };
