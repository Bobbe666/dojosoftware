/* ═══════════════════════════════════════════════════════════════════════════
   DS-THEME — White-Label-Theme-Engine.
   Eine Config → setzt CSS-Variablen + data-ds-mode auf <html> → ganze App folgt.

   Drei Ebenen:
   1. mode        Basis-Flächen (dark | light | washi)
   2. branding    Akzent, Button, Text, Hintergründe, Rahmen, Schrift, Radius
   3. effekte     Verlauf, Schatten, Glow

   Leeres Feld ("") = „Modus-Standard verwenden" (kein Override).
   Persistenz: localStorage; später zusätzlich pro Dojo im Backend.
   ═══════════════════════════════════════════════════════════════════════════ */

import axios from 'axios';

const STORAGE_KEY = 'ds-theme-config';

export const FONT_OPTIONS = [
  { label: 'Inter (Standard)', value: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { label: 'System',           value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { label: 'Roboto',           value: "'Roboto', sans-serif" },
  { label: 'Poppins',          value: "'Poppins', sans-serif" },
  { label: 'Montserrat',       value: "'Montserrat', sans-serif" },
  { label: 'Noto Sans JP',     value: "'Noto Sans JP', 'Inter', sans-serif" },
  { label: 'Georgia (Serif)',  value: "Georgia, 'Times New Roman', serif" },
  { label: 'Oswald (Display)', value: "'Oswald', 'Inter', sans-serif" },
  { label: 'Karate', value: "'Karate', 'Oswald', sans-serif" },
  { label: 'Bonzai', value: "'Bonzai', 'Yuji Syuku', cursive" },
];

export const MODE_OPTIONS = [
  { label: 'Dunkel', value: 'dark',  icon: '🌙' },
  { label: 'Hell',   value: 'light', icon: '☀️' },
  { label: 'Washi',  value: 'washi', icon: '🎋' },
];

export const SHADOW_PRESETS = {
  none:   { sm: 'none', md: 'none', lg: 'none' },
  soft:   { sm: '0 1px 3px rgba(0,0,0,0.12)',  md: '0 3px 12px rgba(0,0,0,0.18)', lg: '0 6px 20px rgba(0,0,0,0.24)' },
  normal: { sm: '0 2px 8px rgba(0,0,0,0.18)',  md: '0 6px 24px rgba(0,0,0,0.32)', lg: '0 12px 40px rgba(0,0,0,0.40)' },
  strong: { sm: '0 3px 12px rgba(0,0,0,0.3)',  md: '0 10px 34px rgba(0,0,0,0.45)', lg: '0 18px 54px rgba(0,0,0,0.55)' },
};

export const RADIUS_PRESETS = {
  sharp:  { sm: '3px',  md: '4px',  lg: '6px',  xl: '8px'  },
  normal: { sm: '8px',  md: '10px', lg: '14px', xl: '18px' },
  round:  { sm: '12px', md: '16px', lg: '22px', xl: '28px' },
};

// Button-Form → border-radius
export const BTN_SHAPES = {
  sharp:   '3px',
  normal:  '',      // '' = globaler Radius (--ds-radius-md)
  rounded: '14px',
  pill:    '999px',
};

export const BTN_SHAPE_OPTIONS = [
  { label: 'Eckig',     value: 'sharp' },
  { label: 'Normal',    value: 'normal' },
  { label: 'Rund',      value: 'rounded' },
  { label: 'Pill',      value: 'pill' },
];

export const TAB_STYLE_OPTIONS = [
  { label: 'Standard',     value: 'default' },
  { label: 'Pill',         value: 'pill-solid' },
  { label: 'Unterstrich',  value: 'underline' },
  { label: 'Rahmen',       value: 'bordered' },
];

// Schriftgrößen-Stufen (Multiplikator)
export const SCALE_OPTIONS = [
  { label: 'Klein',     value: 'klein',  factor: 0.9 },
  { label: 'Normal',    value: 'normal', factor: 1.0 },
  { label: 'Groß',      value: 'gross',  factor: 1.12 },
  { label: 'Sehr groß', value: 'xl',     factor: 1.25 },
];
const scaleFactor = (v) => (SCALE_OPTIONS.find(s => s.value === v) || SCALE_OPTIONS[1]).factor;

// Basis-Schriftgrößen (rem) — getrennt nach Text und Überschrift
const FS_TEXT    = { '--ds-fs-xs': 0.7, '--ds-fs-sm': 0.8, '--ds-fs-base': 0.9, '--ds-fs-md': 0.95 };
const FS_HEADING = { '--ds-fs-lg': 1.1, '--ds-fs-xl': 1.4, '--ds-fs-2xl': 1.6 };

export const DEFAULT_THEME = {
  mode: 'dark',          // dark | light | washi
  preset: 'klassik',     // welches Themen-Preset zuletzt gewählt (nur UI-Markierung)
  accent: '#d4af37',
  accentOn: true,        // false = neutraler Grau-Akzent
  buttonColor: '',       // '' = Button nutzt Akzent; sonst eigene Farbe
  textColor: '',         // '' = Modus-Standard; sonst eigene Basis-Textfarbe
  bgBody: '',            // '' = Modus-Standard Seitenhintergrund
  bgCard: '',            // '' = Modus-Standard Kartenhintergrund
  border: '',            // '' = Modus-Standard Rahmen
  font: FONT_OPTIONS[0].value,
  textScale: 'normal',   // klein | normal | gross | xl  (Fließtext)
  headingScale: 'normal',// klein | normal | gross | xl  (Überschriften)
  radius: 'normal',      // sharp | normal | round  (global)
  btnShape: 'normal',    // sharp | normal | rounded | pill  (Buttons)
  tabStyle: 'default',   // default | pill-solid | underline | bordered  (Tabs)
  gradient: true,        // Karten mit dezentem Verlauf
  shadow: 'normal',      // none | soft | normal | strong
  glow: false,           // Akzent-Glow auf Buttons/Badges
  // ── Sidebar (eigene Ebene) ──
  sidebarBg: '',         // '' = Modus-Standard (Surface)
  sidebarText: '',       // '' = Modus-Standard
  sidebarActive: '',     // '' = Akzent
  // ── Header (eigene Ebene) ──
  headerBg: '',          // '' = Modus-Standard (Surface)
  headerText: '',        // '' = Modus-Standard
  // ── Überschriften ──
  headingColor: 'accent',   // 'accent' | 'text' | '#hex'
  headingUppercase: true,   // GROSSBUCHSTABEN
  headingShadow: false,     // dezenter Schatten
  // ── Deko ──
  kanji: false,          // dezentes Kanji-Wasserzeichen im Hintergrund
  kanjiChar: '武道',      // welches Zeichen (Budō = „Kriegskunst-Weg")
};

// Auswählbare Kanji-Zeichen fürs Wasserzeichen
export const KANJI_OPTIONS = [
  { label: '武道 — Budō (Kampfkunst-Weg)', value: '武道' },
  { label: '道 — Dō (der Weg)',            value: '道' },
  { label: '武 — Bu (Kampf)',             value: '武' },
  { label: '拳 — Ken (Faust)',            value: '拳' },
  { label: '礼 — Rei (Respekt)',          value: '礼' },
  { label: '空手 — Karate',               value: '空手' },
  { label: '柔道 — Jūdō',                 value: '柔道' },
  { label: '力 — Riki (Kraft)',           value: '力' },
];

/* ── Themen-Presets — komplette Bündel, danach feintunebar ─────────────────── */
export const THEME_PRESETS = [
  {
    key: 'klassik', label: 'Klassisch Gold', emoji: '👑', swatch: '#d4af37',
    cfg: { mode: 'dark', accent: '#d4af37', accentOn: true, buttonColor: '',
           textColor: '', bgBody: '', bgCard: '', border: '',
           font: FONT_OPTIONS[0].value, radius: 'normal', gradient: true, shadow: 'normal', glow: false },
  },
  {
    key: 'washi', label: 'Washi', emoji: '🍵', swatch: '#c9a227',
    // Das bestehende helle Design — warmes Papier, goldener Akzent, ruhig
    cfg: { mode: 'washi', accent: '#c9a227', accentOn: true, buttonColor: '',
           textColor: '', bgBody: '', bgCard: '', border: '',
           font: FONT_OPTIONS[0].value, radius: 'normal', gradient: false, shadow: 'soft', glow: false },
  },
  {
    key: 'karate', label: 'Karate', emoji: '🥋', swatch: '#b91c1c',
    // Weißes Gi, schwarzer/roter Gürtel — hell, klar, sachlich
    cfg: { mode: 'light', accent: '#b91c1c', accentOn: true, buttonColor: '#111111',
           textColor: '', bgBody: '', bgCard: '', border: '',
           font: FONT_OPTIONS[6].value, radius: 'sharp', gradient: false, shadow: 'soft', glow: false },
  },
  {
    key: 'japan', label: 'Japanisch', emoji: '🎋', swatch: '#c0392b',
    // Washi-Papier, Zinnoberrot (朱), ruhig — mit Kanji-Wasserzeichen
    cfg: { mode: 'washi', accent: '#c0392b', accentOn: true, buttonColor: '',
           textColor: '', bgBody: '', bgCard: '', border: '',
           font: FONT_OPTIONS[5].value, radius: 'normal', gradient: false, shadow: 'soft', glow: false,
           kanji: true, kanjiChar: '武道' },
  },
  {
    key: 'china', label: 'Chinesisch', emoji: '🐉', swatch: '#d4282a',
    // Kaiserliches Rot + Gold, dunkel, leuchtend
    cfg: { mode: 'dark', accent: '#e0b13a', accentOn: true, buttonColor: '#c8102e',
           textColor: '', bgBody: '#1a0f0f', bgCard: '', border: '',
           font: FONT_OPTIONS[0].value, radius: 'round', gradient: true, shadow: 'normal', glow: true },
  },
  {
    key: 'kickbox', label: 'Kickboxen', emoji: '🥊', swatch: '#2563eb',
    // Energetisch, elektrisches Blau, kantig
    cfg: { mode: 'dark', accent: '#3b82f6', accentOn: true, buttonColor: '',
           textColor: '', bgBody: '#0b1220', bgCard: '', border: '',
           font: FONT_OPTIONS[7].value, radius: 'sharp', gradient: false, shadow: 'strong', glow: true },
  },
  {
    key: 'mma', label: 'MMA', emoji: '🔥', swatch: '#dc2626',
    // Aggressiv, Stahl + Rot, flach-industriell
    cfg: { mode: 'dark', accent: '#dc2626', accentOn: true, buttonColor: '',
           textColor: '', bgBody: '#0d0d0f', bgCard: '', border: '',
           font: FONT_OPTIONS[7].value, radius: 'sharp', gradient: false, shadow: 'strong', glow: false },
  },
  {
    key: 'zen', label: 'Zen Hell', emoji: '🍃', swatch: '#10b981',
    // Hell, ruhig, Smaragd-Akzent
    cfg: { mode: 'light', accent: '#10b981', accentOn: true, buttonColor: '',
           textColor: '', bgBody: '', bgCard: '', border: '',
           font: FONT_OPTIONS[0].value, radius: 'round', gradient: false, shadow: 'soft', glow: false },
  },
];

export function loadThemeConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THEME };
    return { ...DEFAULT_THEME, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_THEME };
  }
}

function hexToRgba(hex, alpha) {
  try {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch {
    return hex;
  }
}

// Setzt Property bei Wert, entfernt sie sonst (→ Modus-Standard greift wieder)
function setOrClear(root, name, value) {
  if (value) root.setProperty(name, value);
  else root.removeProperty(name);
}

export function applyThemeConfig(cfg) {
  const el = document.documentElement;
  const root = el.style;
  const c = { ...DEFAULT_THEME, ...cfg };

  // ── Modus (Basis-Flächen) ──
  if (c.mode && c.mode !== 'dark') el.setAttribute('data-ds-mode', c.mode);
  else el.removeAttribute('data-ds-mode');

  // ── Akzent ──
  const accent = c.accentOn ? c.accent : '#9a9a9a';
  root.setProperty('--ds-accent', accent);

  // ── Button-Farbe (getrennt vom Akzent) ──
  const btn = c.buttonColor || accent;
  root.setProperty('--ds-btn-color', btn);
  root.setProperty('--ds-btn-contrast', isLight(btn) ? '#111111' : '#ffffff');

  // ── Schrift ──
  setOrClear(root, '--ds-font', c.font);

  // ── Schriftgrößen (Text + Überschrift getrennt) ──
  const ts = scaleFactor(c.textScale), hs = scaleFactor(c.headingScale);
  for (const [k, v] of Object.entries(FS_TEXT))    root.setProperty(k, (v * ts).toFixed(3) + 'rem');
  for (const [k, v] of Object.entries(FS_HEADING)) root.setProperty(k, (v * hs).toFixed(3) + 'rem');
  root.setProperty('--ds-text-scale', ts);
  root.setProperty('--ds-heading-scale', hs);

  // ── Textfarbe (nur wenn gesetzt → sonst Modus-Standard) ──
  if (c.textColor) {
    root.setProperty('--ds-text', hexToRgba(c.textColor, 0.95));
    root.setProperty('--ds-text-secondary', hexToRgba(c.textColor, 0.70));
    root.setProperty('--ds-text-muted', hexToRgba(c.textColor, 0.48));
    root.setProperty('--ds-text-faint', hexToRgba(c.textColor, 0.32));
  } else {
    ['--ds-text', '--ds-text-secondary', '--ds-text-muted', '--ds-text-faint'].forEach(v => root.removeProperty(v));
  }

  // ── Hintergründe (optional) ──
  setOrClear(root, '--ds-bg-body', c.bgBody);
  if (c.bgCard) {
    root.setProperty('--ds-bg-card', c.bgCard);
    root.setProperty('--ds-bg-card-hover', c.bgCard);
  } else {
    root.removeProperty('--ds-bg-card');
    root.removeProperty('--ds-bg-card-hover');
  }

  // ── Rahmen (optional) ──
  setOrClear(root, '--ds-border', c.border);

  // ── Radius-Preset ──
  const rad = RADIUS_PRESETS[c.radius] || RADIUS_PRESETS.normal;
  root.setProperty('--ds-radius-sm', rad.sm);
  root.setProperty('--ds-radius-md', rad.md);
  root.setProperty('--ds-radius-lg', rad.lg);
  root.setProperty('--ds-radius-xl', rad.xl);

  // ── Verlauf an/aus ──
  root.setProperty('--ds-gradient-card', c.gradient
    ? 'linear-gradient(160deg, color-mix(in srgb, var(--ds-text) 5%, transparent) 0%, transparent 70%), var(--ds-bg-card)'
    : 'var(--ds-bg-card)');

  // ── Schatten-Preset ──
  const sh = SHADOW_PRESETS[c.shadow] || SHADOW_PRESETS.normal;
  root.setProperty('--ds-shadow-sm', sh.sm);
  root.setProperty('--ds-shadow-md', sh.md);
  root.setProperty('--ds-shadow-lg', sh.lg);

  // ── Glow (alte Glow-Token mitsteuern) ──
  root.setProperty('--glow-gold',    c.glow ? `0 0 12px ${hexToRgba(accent, 0.45)}` : 'none');
  root.setProperty('--glow-gold-sm', c.glow ? `0 0 6px ${hexToRgba(accent, 0.35)}`  : 'none');
  root.setProperty('--glow-gold-lg', c.glow ? `0 0 20px ${hexToRgba(accent, 0.55)}` : 'none');

  // ── Sidebar (eigene Ebene, Fallback = Modus/Akzent) ──
  setOrClear(root, '--ds-sidebar-bg', c.sidebarBg);
  if (c.sidebarText) {
    root.setProperty('--ds-sidebar-text', hexToRgba(c.sidebarText, 0.65));
    root.setProperty('--ds-sidebar-text-hover', hexToRgba(c.sidebarText, 0.95));
  } else {
    root.removeProperty('--ds-sidebar-text');
    root.removeProperty('--ds-sidebar-text-hover');
  }
  if (c.sidebarActive) {
    root.setProperty('--ds-sidebar-active', c.sidebarActive);
    root.setProperty('--ds-sidebar-active-bg', hexToRgba(c.sidebarActive, 0.14));
    root.setProperty('--ds-sidebar-hover', hexToRgba(c.sidebarActive, 0.07));
  } else {
    ['--ds-sidebar-active', '--ds-sidebar-active-bg', '--ds-sidebar-hover'].forEach(v => root.removeProperty(v));
  }

  // ── Button-Form ──
  const btnRadius = BTN_SHAPES[c.btnShape] ?? '';
  setOrClear(root, '--ds-btn-radius', btnRadius);
  // Attribut nur bei abweichender Form → globale Regel greift dann für ALLE Buttons
  if (btnRadius) el.setAttribute('data-ds-btnshape', c.btnShape);
  else el.removeAttribute('data-ds-btnshape');

  // ── Tab-Stil (nutzt bestehendes data-tab-style-System) ──
  if (c.tabStyle && c.tabStyle !== 'default') el.dataset.tabStyle = c.tabStyle;
  else delete el.dataset.tabStyle;

  // ── Header (eigene Ebene, Fallback = Modus) ──
  setOrClear(root, '--ds-header-bg', c.headerBg);
  if (c.headerText) {
    root.setProperty('--ds-header-text', c.headerText);
    root.setProperty('--ds-header-border', hexToRgba(c.headerText, 0.18));
  } else {
    root.removeProperty('--ds-header-text');
    root.removeProperty('--ds-header-border');
  }

  // ── Überschriften ──
  const hColor = c.headingColor === 'text' ? 'var(--ds-text)'
    : (typeof c.headingColor === 'string' && c.headingColor.startsWith('#')) ? c.headingColor
    : 'var(--ds-accent)';
  root.setProperty('--ds-heading-color', hColor);
  root.setProperty('--ds-heading-transform', c.headingUppercase ? 'uppercase' : 'none');
  root.setProperty('--ds-heading-shadow', c.headingShadow ? '0 1px 3px rgba(0,0,0,0.35)' : 'none');

  // ── Kanji-Wasserzeichen ──
  if (c.kanji) {
    el.setAttribute('data-ds-kanji', 'on');
    root.setProperty('--ds-kanji-char', `'${c.kanjiChar || '武道'}'`);
  } else {
    el.removeAttribute('data-ds-kanji');
    root.removeProperty('--ds-kanji-char');
  }
}

// Helligkeit grob abschätzen (für Button-Kontrastfarbe)
function isLight(hex) {
  try {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
  } catch {
    return false;
  }
}

export function saveThemeConfig(cfg) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {}
  applyThemeConfig(cfg);
}

export function resetThemeConfig() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  applyThemeConfig(DEFAULT_THEME);
  return { ...DEFAULT_THEME };
}

/** Nur den Modus setzen (dark|light|washi) — übernimmt restliche Config */
export function setThemeMode(mode) {
  const next = { ...loadThemeConfig(), mode };
  saveThemeConfig(next);
  return next;
}

/** Themen-Preset anwenden → liefert die neue, vollständige Config zurück */
export function applyPreset(key) {
  const p = THEME_PRESETS.find(x => x.key === key);
  if (!p) return loadThemeConfig();
  const next = { ...DEFAULT_THEME, ...p.cfg, preset: key };
  saveThemeConfig(next);
  return next;
}

/** Beim App-Start aufrufen */
export function initTheme() {
  applyThemeConfig(loadThemeConfig());
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRO-DOJO-PERSISTENZ (Backend)  —  axios baseURL ist bereits '/api'.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Theme des Dojos vom Server holen (null = keins gespeichert) */
export async function fetchDojoTheme(dojoId) {
  const params = dojoId ? { dojo_id: dojoId } : {};
  try {
    const { data } = await axios.get('/dojo-theme', { params });
    return data?.theme || null;
  } catch {
    return null;
  }
}

/** Theme des Dojos auf dem Server speichern */
export async function pushDojoTheme(cfg, dojoId) {
  const params = dojoId ? { dojo_id: dojoId } : {};
  await axios.put('/dojo-theme', { theme: cfg }, { params });
}

/** Server-Theme zurücksetzen */
export async function deleteDojoTheme(dojoId) {
  const params = dojoId ? { dojo_id: dojoId } : {};
  await axios.delete('/dojo-theme', { params });
}

/** Server-Theme anwenden + lokal cachen (ohne Rück-Speichern) */
export function applyServerTheme(cfg) {
  const merged = { ...DEFAULT_THEME, ...cfg };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch {}
  applyThemeConfig(merged);
  return merged;
}

/** Subdomain aus dem Host ableiten (null = Hauptdomain/localhost/andere Apps) */
export function detectSubdomain() {
  try {
    const host = window.location.hostname;
    const label = (host.split('.')[0] || '').toLowerCase();
    const skip = ['localhost', '127', 'www', 'dojo', 'app', 'events', 'kids',
                  'hof', 'checkin', 'finanzen', 'staging', 'test'];
    if (!label || /^\d+$/.test(label) || skip.includes(label)) return null;
    return label;
  } catch { return null; }
}

/** Öffentliches Theme per Subdomain holen (ohne Login) */
export async function fetchPublicTheme(subdomain) {
  if (!subdomain) return null;
  try {
    const { data } = await axios.get('/dojo-theme/public', {
      headers: { 'x-tenant-subdomain': subdomain },
    });
    return data?.theme || null;
  } catch { return null; }
}

/** Beim App-Start: Theme der Subdomain laden + anwenden (Branding vor Login) */
export async function initPublicTheme() {
  const sub = detectSubdomain();
  if (!sub) return;
  const theme = await fetchPublicTheme(sub);
  if (theme) applyServerTheme(theme);
}
