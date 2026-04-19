// ============================================================
// TEMPLATE: DYNAMIC
// Stil: Kickboxen / Muay Thai / Fitness-Kampfsport
// Farben: Dunkles Anthrazit + Electric Orange + Weiß
// Gefühl: Energetisch, modern, athletisch
// ============================================================

'use strict';

function renderDynamic(config, schedule = []) {
  const c = config || {};
  const primary = c.primary_color || '#FF5722';
  const dark = '#12192C';
  const schoolName = escHtml(c.school_name || 'Dojo');
  const subtitle = escHtml(c.school_subtitle || '');
  const tagline = escHtml(c.tagline || 'Schlag härter. Steh schneller auf.');
  const kanji = escHtml(c.logo_kanji || '力');
  const logoUrl = c.logo_url || null;
  const heroImage = c.hero_image_url || null;

  const navItems = (c.nav_items || [])
    .map(n => `<a href="${escAttr(n.href)}">${escHtml(n.label)}</a>`)
    .join('');

  const stile = (c.stile || []).map((s, i) => `
    <div class="prog-card" style="--delay:${i * 0.1}s">
      <div class="prog-icon">${escHtml(s.icon || '🥊')}</div>
      <div class="prog-badge">${escHtml(s.kanji || '')}</div>
      <h3>${escHtml(s.name || '')}</h3>
      <p>${escHtml(s.japanese || '')}</p>
      <a href="#kontakt" class="prog-link">Einsteigen →</a>
    </div>`).join('');

  const werte = (c.werte || []).map(w => `
    <div class="feature-item">
      <div class="feature-symbol">${escHtml(w.kanji || '')}</div>
      <div class="feature-text">
        <strong>${escHtml(w.name || '')}</strong>
        <span>${escHtml(w.text || '')}</span>
      </div>
    </div>`).join('');

  const scheduleItems = schedule.slice(0, 6).map(row => `
    <div class="class-card">
      <div class="class-time">${escHtml(row.uhrzeit || row.time || '')}</div>
      <div class="class-info">
        <strong>${escHtml(row.kursname || row.course || '')}</strong>
        <span>${escHtml(row.wochentag || row.day || '')}${row.trainer ? ` · ${escHtml(row.trainer)}` : ''}</span>
      </div>
      <a href="#kontakt" class="class-join">+</a>
    </div>`).join('');

  const contact = c.contact || {};
  const cta = c.cta || {};

  const heroBg = heroImage
    ? `background: linear-gradient(120deg, rgba(${hexToRgb(dark)},0.92) 0%, rgba(${hexToRgb(primary)},0.5) 100%), url('${escAttr(heroImage)}') center/cover;`
    : `background: linear-gradient(120deg, ${dark} 0%, #1a0f05 50%, ${dark} 100%);`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${schoolName} — ${subtitle || 'Kickboxen & Kampfsport'}</title>
  <meta name="description" content="${tagline}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --primary: ${primary};
      --dark: ${dark};
      --dark2: #0e1420;
      --dark3: #1a2235;
      --text: #f1f5f9;
      --text-dim: #64748b;
      --border: rgba(255,255,255,0.08);
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
      padding: 0 5%; height: 70px;
      background: rgba(14,20,32,0.96);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
    }
    .nav-logo {
      display: flex; align-items: center; gap: 12px;
      text-decoration: none; color: var(--text);
    }
    .nav-logo .kanji {
      width: 38px; height: 38px;
      background: var(--primary);
      display: flex; align-items: center; justify-content: center;
      font-family: serif; font-size: 1.4rem; color: #fff;
      border-radius: 6px;
    }
    .nav-logo .name {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 1.25rem; font-weight: 800;
      letter-spacing: 0.06em; text-transform: uppercase;
    }
    .nav-links { display: flex; gap: 28px; }
    .nav-links a {
      color: var(--text-dim); text-decoration: none;
      font-size: 0.84rem; font-weight: 500;
      transition: color 0.2s;
    }
    .nav-links a:hover { color: var(--primary); }
    .nav-cta {
      background: var(--primary); color: #fff;
      padding: 10px 22px; border-radius: 8px;
      text-decoration: none; font-size: 0.84rem; font-weight: 700;
      transition: all 0.2s; box-shadow: 0 4px 12px rgba(${hexToRgb(primary)},0.35);
    }
    .nav-cta:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(${hexToRgb(primary)},0.5); }

    /* ── HERO ── */
    .hero {
      min-height: 100vh;
      ${heroBg}
      display: flex; align-items: center;
      padding: 110px 5% 80px;
      position: relative; overflow: hidden;
    }
    .hero-shapes {
      position: absolute; inset: 0; pointer-events: none;
    }
    .hero-shapes::before {
      content: '';
      position: absolute; right: 0; top: 0;
      width: 50%; height: 100%;
      background: linear-gradient(135deg, transparent 40%, rgba(${hexToRgb(primary)},0.08) 100%);
      clip-path: polygon(30% 0, 100% 0, 100% 100%, 0% 100%);
    }
    .hero-shapes::after {
      content: '${kanji}';
      position: absolute; right: 8%; top: 50%;
      transform: translateY(-50%);
      font-family: serif; font-size: clamp(12rem, 22vw, 22rem);
      color: rgba(255,255,255,0.03);
      line-height: 1;
    }
    .hero-content { position: relative; z-index: 1; max-width: 680px; }
    .hero-chip {
      display: inline-flex; align-items: center; gap: 8px;
      background: rgba(${hexToRgb(primary)},0.12);
      border: 1px solid rgba(${hexToRgb(primary)},0.3);
      border-radius: 100px; padding: 6px 16px;
      font-size: 0.72rem; color: var(--primary);
      letter-spacing: 0.15em; text-transform: uppercase;
      margin-bottom: 28px;
    }
    .hero-chip::before { content: '●'; font-size: 0.5rem; }
    .hero h1 {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: clamp(3rem, 7vw, 7rem);
      font-weight: 900; line-height: 0.95;
      text-transform: uppercase; letter-spacing: -0.01em;
      margin-bottom: 20px;
    }
    .hero h1 em {
      font-style: normal; color: var(--primary);
      display: block;
    }
    .hero-sub {
      font-size: 1.05rem; color: rgba(255,255,255,0.6);
      margin-bottom: 44px; max-width: 440px;
    }
    .hero-btns { display: flex; gap: 14px; flex-wrap: wrap; }
    .btn-fire {
      background: var(--primary); color: #fff;
      padding: 16px 36px; text-decoration: none;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 1rem; font-weight: 800;
      letter-spacing: 0.08em; text-transform: uppercase;
      border-radius: 8px; transition: all 0.2s;
      box-shadow: 0 4px 16px rgba(${hexToRgb(primary)},0.4);
    }
    .btn-fire:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(${hexToRgb(primary)},0.55); }
    .btn-ghost {
      border: 2px solid rgba(255,255,255,0.15); color: var(--text);
      padding: 16px 36px; text-decoration: none;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 1rem; font-weight: 700;
      letter-spacing: 0.08em; text-transform: uppercase;
      border-radius: 8px; transition: all 0.2s;
    }
    .btn-ghost:hover { border-color: var(--primary); color: var(--primary); }
    .hero-pulse {
      position: absolute; bottom: 40px; left: 50%;
      transform: translateX(-50%);
      width: 28px; height: 44px;
      border: 2px solid rgba(255,255,255,0.2);
      border-radius: 14px; display: flex;
      align-items: flex-start; justify-content: center;
      padding-top: 6px;
    }
    .hero-pulse::after {
      content: '';
      width: 4px; height: 8px;
      background: var(--primary); border-radius: 2px;
      animation: scrollDot 1.8s ease-in-out infinite;
    }
    @keyframes scrollDot {
      0% { transform: translateY(0); opacity: 1; }
      100% { transform: translateY(14px); opacity: 0; }
    }

    /* ── SECTIONS ── */
    section { padding: 88px 5%; }
    .section-badge {
      display: inline-flex; align-items: center; gap: 8px;
      background: rgba(${hexToRgb(primary)},0.1);
      border-radius: 100px; padding: 5px 14px;
      font-size: 0.68rem; color: var(--primary);
      letter-spacing: 0.2em; text-transform: uppercase;
      margin-bottom: 18px;
      border: 1px solid rgba(${hexToRgb(primary)},0.2);
    }
    .section-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: clamp(2rem, 4vw, 3.5rem);
      font-weight: 900; text-transform: uppercase;
      letter-spacing: 0.02em; margin-bottom: 10px;
    }
    .section-sub { color: var(--text-dim); max-width: 460px; margin-bottom: 48px; font-size: 0.92rem; }

    /* ── PROGRAMME ── */
    #stile { background: var(--dark2); }
    .prog-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px; max-width: 1100px;
    }
    .prog-card {
      background: var(--dark3);
      border: 1px solid var(--border);
      border-radius: 12px; padding: 32px 24px;
      transition: all 0.25s; position: relative;
      overflow: hidden;
    }
    .prog-card::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0;
      height: 3px;
      background: linear-gradient(to right, var(--primary), transparent);
      opacity: 0; transition: opacity 0.25s;
    }
    .prog-card:hover { transform: translateY(-6px); border-color: rgba(${hexToRgb(primary)},0.3); }
    .prog-card:hover::before { opacity: 1; }
    .prog-icon { font-size: 2.4rem; margin-bottom: 12px; }
    .prog-badge {
      font-family: serif; font-size: 1.4rem;
      color: var(--primary); margin-bottom: 12px;
      opacity: 0.8;
    }
    .prog-card h3 {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 1.3rem; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.04em;
      margin-bottom: 8px;
    }
    .prog-card p { color: var(--text-dim); font-size: 0.84rem; margin-bottom: 20px; }
    .prog-link {
      color: var(--primary); font-size: 0.82rem; font-weight: 600;
      text-decoration: none; transition: letter-spacing 0.2s;
    }
    .prog-link:hover { letter-spacing: 0.08em; }

    /* ── STUNDENPLAN ── */
    #stundenplan { background: var(--dark); }
    .classes-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px; max-width: 1100px;
    }
    .class-card {
      background: var(--dark3);
      border: 1px solid var(--border);
      border-radius: 10px; padding: 18px 20px;
      display: flex; align-items: center; gap: 16px;
      transition: all 0.2s;
    }
    .class-card:hover { border-color: rgba(${hexToRgb(primary)},0.3); }
    .class-time {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 1.4rem; font-weight: 800;
      color: var(--primary); min-width: 72px;
    }
    .class-info { flex: 1; }
    .class-info strong { display: block; font-size: 0.95rem; margin-bottom: 2px; }
    .class-info span { color: var(--text-dim); font-size: 0.78rem; }
    .class-join {
      width: 32px; height: 32px;
      background: rgba(${hexToRgb(primary)},0.15);
      border: 1px solid rgba(${hexToRgb(primary)},0.3);
      border-radius: 50%; color: var(--primary);
      display: flex; align-items: center; justify-content: center;
      text-decoration: none; font-size: 1.2rem; font-weight: 300;
      transition: all 0.2s;
    }
    .class-join:hover { background: var(--primary); color: #fff; }

    /* ── FEATURES (WERTE) ── */
    #werte { background: var(--dark2); }
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 2px; max-width: 1100px;
    }
    .feature-item {
      display: flex; align-items: flex-start; gap: 20px;
      padding: 32px; background: var(--dark3);
      transition: background 0.2s;
    }
    .feature-item:hover { background: #1e2840; }
    .feature-symbol {
      font-family: serif; font-size: 2.4rem;
      color: var(--primary); min-width: 48px;
      text-align: center;
    }
    .feature-text strong { display: block; font-size: 1.05rem; font-weight: 600; margin-bottom: 6px; }
    .feature-text span { color: var(--text-dim); font-size: 0.87rem; }

    /* ── CTA ── */
    #cta {
      background: linear-gradient(135deg, var(--dark2) 0%, #1a0d05 100%);
      position: relative; overflow: hidden;
    }
    .cta-inner {
      max-width: 700px; position: relative; z-index: 1;
    }
    .cta-glow {
      position: absolute; right: -100px; top: -100px;
      width: 400px; height: 400px;
      background: radial-gradient(circle, rgba(${hexToRgb(primary)},0.15) 0%, transparent 70%);
      pointer-events: none;
    }
    #cta h2 {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: clamp(2.5rem, 5vw, 4.5rem);
      font-weight: 900; text-transform: uppercase;
      letter-spacing: 0.02em; margin-bottom: 16px;
      line-height: 1;
    }
    #cta h2 span { color: var(--primary); }
    #cta p { color: rgba(255,255,255,0.6); max-width: 440px; margin-bottom: 36px; }
    #cta .btn-cta {
      background: var(--primary); color: #fff;
      padding: 18px 44px; text-decoration: none;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 1.1rem; font-weight: 900;
      letter-spacing: 0.1em; text-transform: uppercase;
      border-radius: 10px; display: inline-block;
      box-shadow: 0 6px 24px rgba(${hexToRgb(primary)},0.4);
      transition: all 0.2s;
    }
    #cta .btn-cta:hover { transform: translateY(-3px); box-shadow: 0 10px 32px rgba(${hexToRgb(primary)},0.55); }

    /* ── FOOTER ── */
    footer {
      background: var(--dark2);
      border-top: 1px solid var(--border);
      padding: 60px 5% 28px;
    }
    .footer-grid {
      display: grid; grid-template-columns: 2fr 1fr 1fr;
      gap: 48px; max-width: 1100px; margin: 0 auto;
    }
    .footer-brand-logo {
      display: flex; align-items: center; gap: 12px; margin-bottom: 14px;
    }
    .footer-brand-logo .fkanji {
      width: 42px; height: 42px;
      background: var(--primary); border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-family: serif; font-size: 1.5rem; color: #fff;
    }
    .footer-brand-logo .fname {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 1.3rem; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.06em;
    }
    .footer-brand p { color: var(--text-dim); font-size: 0.85rem; }
    .footer-col h4 {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 0.85rem; font-weight: 700;
      letter-spacing: 0.15em; text-transform: uppercase;
      color: var(--primary); margin-bottom: 18px;
    }
    .footer-col a, .footer-col p {
      display: block; color: var(--text-dim);
      text-decoration: none; font-size: 0.85rem;
      margin-bottom: 10px; transition: color 0.2s;
    }
    .footer-col a:hover { color: var(--text); }
    .footer-bottom {
      max-width: 1100px; margin: 40px auto 0;
      padding-top: 20px; border-top: 1px solid var(--border);
      display: flex; justify-content: space-between;
      font-size: 0.75rem; color: var(--text-dim);
    }
    .footer-bottom a { color: var(--text-dim); text-decoration: none; }
    .footer-bottom a:hover { color: var(--primary); }

    /* ── RESPONSIVE ── */
    @media (max-width: 768px) {
      .nav-links { display: none; }
      .footer-grid { grid-template-columns: 1fr; gap: 28px; }
      .footer-bottom { flex-direction: column; gap: 8px; }
    }
    @media (max-width: 480px) {
      .hero-btns { flex-direction: column; }
    }
  </style>
</head>
<body>

  <!-- NAV -->
  <nav>
    <a href="#" class="nav-logo">
      ${logoUrl
        ? `<img src="${escAttr(logoUrl)}" alt="${schoolName}" style="height:38px;object-fit:contain;">`
        : `<div class="kanji">${kanji}</div>`}
      <span class="name">${schoolName}</span>
    </a>
    <div class="nav-links">${navItems}</div>
    <a href="${escAttr(c.hero_cta_primary?.href || '#kontakt')}" class="nav-cta">
      ${escHtml(c.hero_cta_primary?.text || 'Probetraining')}
    </a>
  </nav>

  <!-- HERO -->
  <section class="hero" id="hero">
    <div class="hero-shapes" aria-hidden="true"></div>
    <div class="hero-content">
      <div class="hero-chip">${subtitle || 'Kampfsport & Fitness'}</div>
      <h1>
        ${schoolName.includes(' ')
          ? `${schoolName.split(' ')[0]}<em>${schoolName.split(' ').slice(1).join(' ')}</em>`
          : schoolName}
      </h1>
      <p class="hero-sub">${tagline}</p>
      <div class="hero-btns">
        <a href="${escAttr(c.hero_cta_primary?.href || '#kontakt')}" class="btn-fire">
          ${escHtml(c.hero_cta_primary?.text || 'Probetraining')}
        </a>
        <a href="${escAttr(c.hero_cta_secondary?.href || '#stile')}" class="btn-ghost">
          ${escHtml(c.hero_cta_secondary?.text || 'Unsere Kurse')}
        </a>
      </div>
    </div>
    <div class="hero-pulse" aria-hidden="true"></div>
  </section>

  <!-- PROGRAMME -->
  ${(c.sections || []).find(s => s.type === 'kampfkunststile' && s.visible !== false) ? `
  <section id="stile">
    <div class="section-badge">Disziplinen</div>
    <h2 class="section-title">Unsere Programme</h2>
    <p class="section-sub">Für Einsteiger und Fortgeschrittene — finde deinen Kurs.</p>
    <div class="prog-grid">${stile || '<p style="color:var(--text-dim)">Keine Programme konfiguriert</p>'}</div>
  </section>` : ''}

  <!-- STUNDENPLAN -->
  ${(c.sections || []).find(s => s.type === 'stundenplan_preview' && s.visible !== false) ? `
  <section id="stundenplan">
    <div class="section-badge">Zeiten</div>
    <h2 class="section-title">Trainingszeiten</h2>
    <p class="section-sub">Trainiere wann es dir passt — wir bieten flexible Kurszeiten.</p>
    ${scheduleItems ? `<div class="classes-grid">${scheduleItems}</div>` : '<p style="color:var(--text-dim)">Stundenplan wird nach Veröffentlichung angezeigt.</p>'}
  </section>` : ''}

  <!-- WERTE -->
  ${(c.sections || []).find(s => s.type === 'werte' && s.visible !== false) ? `
  <section id="werte">
    <div class="section-badge">Das sind wir</div>
    <h2 class="section-title">Wofür wir stehen</h2>
    <p class="section-sub">Kampfsport ist mehr als Technik — es ist eine Lebenseinstellung.</p>
    <div class="features-grid">${werte || ''}</div>
  </section>` : ''}

  <!-- CTA -->
  <section id="cta">
    <div class="cta-glow" aria-hidden="true"></div>
    <div class="cta-inner">
      <div class="section-badge">Jetzt starten</div>
      <h2>${escHtml(cta.title || 'Bereit zu trainieren?')} <span>Los geht's.</span></h2>
      <p>${escHtml(cta.text || 'Erstes Probetraining kostenlos. Kein Vertrag. Keine Ausreden.')}</p>
      <a href="${escAttr(cta.button_href || '#kontakt')}" class="btn-cta">
        ${escHtml(cta.button_text || 'Probetraining sichern')}
      </a>
    </div>
  </section>

  <!-- FOOTER -->
  <footer id="kontakt">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="footer-brand-logo">
          <div class="fkanji">${kanji}</div>
          <span class="fname">${schoolName}</span>
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
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#FF5722');
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '255,87,34';
}

module.exports = { render: renderDynamic, id: 'dynamic', name: 'Dynamic', description: 'Energetisches Design für Kickboxen & Muay Thai — Orange & Anthrazit' };
