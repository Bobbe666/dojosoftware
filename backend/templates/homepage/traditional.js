// ============================================================
// TEMPLATE: TRADITIONELL
// Stil: TDA/Japanische Kampfkunst — Crimson + Gold + Schwarz
// Für: Traditionelle Schulen (TDA, TKD, Karate, klassische MA)
// Inspiriert von tda-vib.de Design
// ============================================================

'use strict';

function renderTraditional(config, schedule = []) {
  const c = config || {};
  const primary = c.primary_color || '#DC143C';
  const gold = c.gold_color || '#c9a227';
  const schoolName = escHtml(c.school_name || 'Dojo');
  const subtitle = escHtml(c.school_subtitle || '');
  const tagline = escHtml(c.tagline || 'Der Weg beginnt mit dem ersten Schritt');
  const kanji = escHtml(c.logo_kanji || '武');
  const logoUrl = c.logo_url || null;
  const heroImage = c.hero_image_url || null;

  const navItems = (c.nav_items || [])
    .map(n => `<a href="${escAttr(n.href)}">${escHtml(n.label)}</a>`)
    .join('');

  const stile = (c.stile || []).map(s => `
    <div class="style-card">
      <div class="style-icon">${escHtml(s.icon || '🥋')}</div>
      <div class="style-kanji" style="color:${escAttr(s.color || primary)}">${escHtml(s.kanji || '')}</div>
      <h3>${escHtml(s.name || '')}</h3>
      <p class="style-jp">${escHtml(s.japanese || '')}</p>
    </div>`).join('');

  const werte = (c.werte || []).map(w => `
    <div class="wert-item">
      <div class="wert-kanji">${escHtml(w.kanji || '')}</div>
      <div class="wert-reading">${escHtml(w.reading || '')}</div>
      <h3>${escHtml(w.name || '')}</h3>
      <p>${escHtml(w.text || '')}</p>
    </div>`).join('');

  const scheduleRows = schedule.slice(0, 8).map(row => `
    <tr>
      <td>${escHtml(row.wochentag || row.day || '')}</td>
      <td>${escHtml(row.uhrzeit || row.time || '')}</td>
      <td>${escHtml(row.kursname || row.course || '')}</td>
      <td>${escHtml(row.trainer || '')}</td>
    </tr>`).join('');

  const contact = c.contact || {};
  const cta = c.cta || {};

  const heroStyle = heroImage
    ? `background-image: linear-gradient(135deg, rgba(0,0,0,0.78) 0%, rgba(${hexToRgb(primary)},0.45) 100%), url('${escAttr(heroImage)}'); background-size: cover; background-position: center;`
    : `background: linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 40%, #0a0a0a 100%);`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${schoolName} — ${subtitle || 'Kampfkunstschule'}</title>
  <meta name="description" content="${tagline}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --primary: ${primary};
      --gold: ${gold};
      --dark: #0a0a0a;
      --dark2: #141414;
      --dark3: #1e1e1e;
      --text: #f0ece4;
      --text-muted: #9a9690;
      --border: rgba(201,162,39,0.2);
    }

    html { scroll-behavior: smooth; }
    body {
      font-family: 'Inter', sans-serif;
      background: var(--dark);
      color: var(--text);
      line-height: 1.7;
    }

    /* ── NAV ── */
    nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 5%;
      height: 72px;
      background: rgba(10,10,10,0.92);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
    }
    .nav-logo {
      display: flex; align-items: center; gap: 14px;
      text-decoration: none; color: var(--text);
    }
    .nav-kanji {
      font-size: 2rem; color: var(--primary);
      line-height: 1; font-family: serif;
    }
    .nav-name {
      font-family: 'Cinzel', serif;
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: 0.08em;
    }
    .nav-links { display: flex; gap: 32px; }
    .nav-links a {
      color: var(--text-muted); text-decoration: none;
      font-size: 0.85rem; letter-spacing: 0.1em; text-transform: uppercase;
      transition: color 0.2s;
    }
    .nav-links a:hover { color: var(--gold); }
    .nav-cta {
      background: var(--primary); color: #fff;
      padding: 10px 22px; border-radius: 2px;
      text-decoration: none; font-size: 0.8rem;
      letter-spacing: 0.1em; text-transform: uppercase;
      font-weight: 600; transition: background 0.2s;
    }
    .nav-cta:hover { background: #b01030; }

    /* ── HERO ── */
    .hero {
      min-height: 100vh;
      ${heroStyle}
      display: flex; align-items: center; justify-content: center;
      text-align: center;
      padding: 120px 5% 80px;
      position: relative;
    }
    .hero::before {
      content: '';
      position: absolute; inset: 0;
      background: radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%);
    }
    .hero-content { position: relative; z-index: 1; max-width: 800px; }
    .hero-kanji-large {
      font-family: serif;
      font-size: clamp(6rem, 12vw, 10rem);
      color: var(--primary);
      opacity: 0.15;
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      user-select: none;
    }
    .hero-badge {
      display: inline-block;
      border: 1px solid var(--gold);
      color: var(--gold);
      font-size: 0.7rem; letter-spacing: 0.25em;
      text-transform: uppercase; padding: 6px 18px;
      margin-bottom: 28px;
    }
    .hero h1 {
      font-family: 'Cinzel', serif;
      font-size: clamp(2.2rem, 5vw, 4rem);
      font-weight: 900;
      line-height: 1.1;
      margin-bottom: 16px;
      text-shadow: 0 2px 20px rgba(0,0,0,0.8);
    }
    .hero-tagline {
      font-size: clamp(1rem, 2vw, 1.2rem);
      color: var(--text-muted);
      margin-bottom: 48px;
      font-weight: 300;
    }
    .hero-btns { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
    .btn-primary {
      background: var(--primary); color: #fff;
      padding: 16px 36px; text-decoration: none;
      font-size: 0.85rem; letter-spacing: 0.15em; text-transform: uppercase;
      font-weight: 700; border-radius: 2px; transition: all 0.2s;
      border: 2px solid var(--primary);
    }
    .btn-primary:hover { background: transparent; color: var(--primary); }
    .btn-outline {
      border: 2px solid rgba(255,255,255,0.3); color: var(--text);
      padding: 16px 36px; text-decoration: none;
      font-size: 0.85rem; letter-spacing: 0.15em; text-transform: uppercase;
      font-weight: 600; border-radius: 2px; transition: all 0.2s;
    }
    .btn-outline:hover { border-color: var(--gold); color: var(--gold); }
    .hero-scroll {
      position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      color: var(--text-muted); font-size: 0.7rem; letter-spacing: 0.2em;
      text-transform: uppercase;
    }
    .hero-scroll::after {
      content: '';
      width: 1px; height: 40px;
      background: linear-gradient(to bottom, var(--gold), transparent);
    }

    /* ── SECTION BASE ── */
    section { padding: 100px 5%; }
    .section-header { text-align: center; margin-bottom: 64px; }
    .section-label {
      display: inline-block;
      color: var(--gold); font-size: 0.7rem;
      letter-spacing: 0.3em; text-transform: uppercase;
      margin-bottom: 16px;
    }
    .section-header h2 {
      font-family: 'Cinzel', serif;
      font-size: clamp(1.6rem, 3vw, 2.4rem);
      font-weight: 700;
    }
    .section-header p {
      color: var(--text-muted); max-width: 560px;
      margin: 16px auto 0; font-size: 0.95rem;
    }
    .divider {
      width: 60px; height: 2px;
      background: linear-gradient(to right, transparent, var(--primary), transparent);
      margin: 24px auto 0;
    }

    /* ── KAMPFKUNSTSTILE ── */
    #stile { background: var(--dark2); }
    .stile-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 24px; max-width: 1100px; margin: 0 auto;
    }
    .style-card {
      background: var(--dark3);
      border: 1px solid var(--border);
      padding: 40px 28px; text-align: center;
      transition: all 0.3s; cursor: default;
      position: relative; overflow: hidden;
    }
    .style-card::before {
      content: '';
      position: absolute; bottom: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(to right, transparent, var(--primary), transparent);
      transform: scaleX(0); transition: transform 0.3s;
    }
    .style-card:hover { transform: translateY(-4px); border-color: rgba(201,162,39,0.4); }
    .style-card:hover::before { transform: scaleX(1); }
    .style-icon { font-size: 2.4rem; margin-bottom: 16px; }
    .style-kanji {
      font-family: serif; font-size: 2rem;
      margin-bottom: 12px; opacity: 0.9;
    }
    .style-card h3 {
      font-family: 'Cinzel', serif; font-size: 1rem;
      font-weight: 700; margin-bottom: 8px;
    }
    .style-jp { color: var(--text-muted); font-size: 0.8rem; font-style: italic; }

    /* ── STUNDENPLAN ── */
    #stundenplan { background: var(--dark); }
    .schedule-table {
      width: 100%; max-width: 900px; margin: 0 auto;
      border-collapse: collapse;
    }
    .schedule-table thead tr {
      background: rgba(${hexToRgb(primary)},0.15);
      border-bottom: 2px solid var(--primary);
    }
    .schedule-table th {
      padding: 14px 20px; text-align: left;
      font-family: 'Cinzel', serif; font-size: 0.75rem;
      letter-spacing: 0.1em; text-transform: uppercase;
      color: var(--gold);
    }
    .schedule-table td {
      padding: 14px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      font-size: 0.9rem;
    }
    .schedule-table tbody tr:hover { background: rgba(255,255,255,0.03); }
    .schedule-placeholder {
      text-align: center; color: var(--text-muted);
      padding: 40px; font-size: 0.9rem;
    }

    /* ── WERTE ── */
    #werte { background: var(--dark2); }
    .werte-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 2px; max-width: 1000px; margin: 0 auto;
    }
    .wert-item {
      padding: 48px 36px; text-align: center;
      background: var(--dark3);
      border: 1px solid var(--border);
    }
    .wert-kanji {
      font-family: serif; font-size: 4rem;
      color: var(--primary); margin-bottom: 4px;
      line-height: 1;
    }
    .wert-reading {
      color: var(--gold); font-size: 0.7rem;
      letter-spacing: 0.3em; text-transform: uppercase;
      margin-bottom: 16px;
    }
    .wert-item h3 {
      font-family: 'Cinzel', serif; font-size: 1.1rem;
      font-weight: 700; margin-bottom: 12px;
    }
    .wert-item p { color: var(--text-muted); font-size: 0.9rem; }

    /* ── CTA ── */
    #cta {
      background: linear-gradient(135deg, var(--dark) 0%, rgba(${hexToRgb(primary)},0.12) 100%);
      text-align: center;
      border-top: 1px solid var(--border);
    }
    #cta h2 {
      font-family: 'Cinzel', serif;
      font-size: clamp(1.8rem, 3.5vw, 2.8rem);
      font-weight: 900; margin-bottom: 20px;
    }
    #cta p {
      color: var(--text-muted); max-width: 520px;
      margin: 0 auto 40px; font-size: 1rem;
    }
    #cta .btn-cta {
      background: var(--primary); color: #fff;
      padding: 18px 48px; text-decoration: none;
      font-size: 0.9rem; letter-spacing: 0.15em;
      text-transform: uppercase; font-weight: 700;
      border-radius: 2px; border: 2px solid var(--primary);
      display: inline-block; transition: all 0.2s;
    }
    #cta .btn-cta:hover { background: transparent; color: var(--primary); }

    /* ── KONTAKT / FOOTER ── */
    footer {
      background: #060606;
      border-top: 1px solid rgba(255,255,255,0.06);
      padding: 60px 5% 32px;
    }
    .footer-content {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 48px; max-width: 1100px; margin: 0 auto;
    }
    .footer-brand .footer-logo {
      font-family: 'Cinzel', serif; font-size: 1.2rem;
      font-weight: 700; color: var(--text);
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 16px;
    }
    .footer-brand .footer-logo .kanji { color: var(--primary); font-size: 1.6rem; font-family: serif; }
    .footer-brand p { color: var(--text-muted); font-size: 0.85rem; max-width: 280px; }
    .footer-col h4 {
      font-family: 'Cinzel', serif; font-size: 0.75rem;
      letter-spacing: 0.2em; text-transform: uppercase;
      color: var(--gold); margin-bottom: 20px;
    }
    .footer-col p, .footer-col a {
      color: var(--text-muted); font-size: 0.85rem;
      text-decoration: none; display: block;
      margin-bottom: 8px; transition: color 0.2s;
    }
    .footer-col a:hover { color: var(--text); }
    .footer-bottom {
      max-width: 1100px; margin: 40px auto 0;
      padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.06);
      display: flex; justify-content: space-between; align-items: center;
      font-size: 0.75rem; color: var(--text-muted);
    }
    .footer-powered a { color: var(--text-muted); text-decoration: none; }
    .footer-powered a:hover { color: var(--gold); }

    /* ── RESPONSIVE ── */
    @media (max-width: 768px) {
      .nav-links { display: none; }
      .footer-content { grid-template-columns: 1fr; gap: 32px; }
      .footer-bottom { flex-direction: column; gap: 8px; text-align: center; }
      section { padding: 70px 5%; }
    }
    @media (max-width: 480px) {
      .hero-btns { flex-direction: column; align-items: center; }
    }
  </style>
</head>
<body>

  <!-- NAV -->
  <nav>
    <a href="#" class="nav-logo">
      ${logoUrl
        ? `<img src="${escAttr(logoUrl)}" alt="${schoolName}" style="height:40px;object-fit:contain;">`
        : `<span class="nav-kanji">${kanji}</span>`}
      <span class="nav-name">${schoolName}</span>
    </a>
    <div class="nav-links">${navItems}</div>
    <a href="${escAttr(c.hero_cta_primary?.href || '#kontakt')}" class="nav-cta">
      ${escHtml(c.hero_cta_primary?.text || 'Probetraining')}
    </a>
  </nav>

  <!-- HERO -->
  <section class="hero" id="hero">
    <div class="hero-kanji-large">${kanji}</div>
    <div class="hero-content">
      ${subtitle ? `<div class="hero-badge">${subtitle}</div>` : ''}
      <h1>${schoolName}</h1>
      <p class="hero-tagline">${tagline}</p>
      <div class="hero-btns">
        <a href="${escAttr(c.hero_cta_primary?.href || '#kontakt')}" class="btn-primary">
          ${escHtml(c.hero_cta_primary?.text || 'Probetraining')}
        </a>
        <a href="${escAttr(c.hero_cta_secondary?.href || '#stile')}" class="btn-outline">
          ${escHtml(c.hero_cta_secondary?.text || 'Unsere Kurse')}
        </a>
      </div>
    </div>
    <div class="hero-scroll">Entdecken</div>
  </section>

  <!-- KAMPFKUNSTSTILE -->
  ${(c.sections || []).find(s => s.type === 'kampfkunststile' && s.visible !== false) ? `
  <section id="stile">
    <div class="section-header">
      <span class="section-label">Unsere Disziplinen</span>
      <h2>Kampfkunststile</h2>
      <p>Wählen Sie Ihren Weg — jede Disziplin hat ihre eigene Philosophie und Geschichte.</p>
      <div class="divider"></div>
    </div>
    <div class="stile-grid">${stile || '<p style="text-align:center;color:var(--text-muted)">Noch keine Stile konfiguriert</p>'}</div>
  </section>` : ''}

  <!-- STUNDENPLAN -->
  ${(c.sections || []).find(s => s.type === 'stundenplan_preview' && s.visible !== false) ? `
  <section id="stundenplan">
    <div class="section-header">
      <span class="section-label">Training</span>
      <h2>Stundenplan</h2>
      <div class="divider"></div>
    </div>
    ${scheduleRows ? `
    <table class="schedule-table">
      <thead><tr><th>Tag</th><th>Zeit</th><th>Kurs</th><th>Trainer</th></tr></thead>
      <tbody>${scheduleRows}</tbody>
    </table>` : `<p class="schedule-placeholder">Der Stundenplan wird nach der Veröffentlichung automatisch angezeigt.</p>`}
  </section>` : ''}

  <!-- WERTE -->
  ${(c.sections || []).find(s => s.type === 'werte' && s.visible !== false) ? `
  <section id="werte">
    <div class="section-header">
      <span class="section-label">Philosophie</span>
      <h2>Unsere Werte</h2>
      <p>Die Prinzipien der Kampfkunst sind ein Weg zur Persönlichkeitsentwicklung.</p>
      <div class="divider"></div>
    </div>
    <div class="werte-grid">${werte || ''}</div>
  </section>` : ''}

  <!-- CTA -->
  <section id="cta">
    <h2>${escHtml(cta.title || 'Beginne deinen Weg')}</h2>
    <p>${escHtml(cta.text || 'Das erste Probetraining ist kostenlos und unverbindlich.')}</p>
    <a href="${escAttr(cta.button_href || '#kontakt')}" class="btn-cta">
      ${escHtml(cta.button_text || 'Probetraining vereinbaren')}
    </a>
  </section>

  <!-- FOOTER -->
  <footer id="kontakt">
    <div class="footer-content">
      <div class="footer-brand">
        <div class="footer-logo">
          <span class="kanji">${kanji}</span>
          <span>${schoolName}</span>
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
      <span class="footer-powered">Powered by <a href="https://dojo.tda-intl.org" target="_blank" rel="noopener">Dojosoftware</a></span>
    </div>
  </footer>

</body>
</html>`;
}

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escAttr(str) {
  if (!str) return '#';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#DC143C');
  return result
    ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`
    : '220,20,60';
}

module.exports = { render: renderTraditional, id: 'traditional', name: 'Traditionell', description: 'Elegantes japanisches Martial-Arts-Design in Crimson & Gold' };
