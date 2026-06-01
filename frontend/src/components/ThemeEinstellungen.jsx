/**
 * ThemeEinstellungen.jsx
 * White-Label-Steuerzentrale — überschreibt die DS-Tokens live.
 * Sticky-Vorschau oben, alle Bereiche einklappbar (Standard zu).
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Lock, ChevronDown, Check, Cloud } from 'lucide-react';
import {
  loadThemeConfig, saveThemeConfig, resetThemeConfig, applyPreset,
  FONT_OPTIONS, MODE_OPTIONS, THEME_PRESETS, KANJI_OPTIONS,
  BTN_SHAPE_OPTIONS, TAB_STYLE_OPTIONS, SCALE_OPTIONS,
  fetchDojoTheme, pushDojoTheme, deleteDojoTheme, applyServerTheme,
} from '../utils/dsTheme';
import { useSubscription } from '../context/SubscriptionContext';
import { useDojoContext } from '../context/DojoContext';
import '../styles/ThemeEinstellungen.css';

const ACCENT_PRESETS = [
  { label: 'Gold', value: '#d4af37' },
  { label: 'Dunkelrot', value: '#8b1a1a' },
  { label: 'Smaragd', value: '#10b981' },
  { label: 'Saphir', value: '#3b82f6' },
  { label: 'Violett', value: '#8b5cf6' },
  { label: 'Kupfer', value: '#c2703d' },
];

const SHADOW_OPTIONS = [
  { label: 'Aus', value: 'none' }, { label: 'Weich', value: 'soft' },
  { label: 'Normal', value: 'normal' }, { label: 'Stark', value: 'strong' },
];
const RADIUS_OPTIONS = [
  { label: 'Kantig', value: 'sharp' }, { label: 'Normal', value: 'normal' }, { label: 'Rund', value: 'round' },
];

// Einklappbarer Bereich (Standard: zu)
function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`ds-card te-card te-section ${open ? 'is-open' : ''}`}>
      <button type="button" className="te-section-head" onClick={() => setOpen(o => !o)}>
        <span className="te-section-title">{title}</span>
        <ChevronDown size={18} className="te-chev" />
      </button>
      {open && <div className="te-section-body">{children}</div>}
    </div>
  );
}

// Segment-Schalter
function Segment({ options, value, onChange }) {
  return (
    <div className="te-segment">
      {options.map(o => (
        <button key={o.value} type="button"
          className={`te-segment-btn ${value === o.value ? 'is-active' : ''}`}
          onClick={() => onChange(o.value)}>
          {o.icon ? `${o.icon} ` : ''}{o.label}
        </button>
      ))}
    </div>
  );
}

// Farbfeld mit optionalem „Modus-Standard" (Wert '' = Standard)
function ColorField({ label, value, fallback, onChange }) {
  const isCustom = !!value;
  return (
    <div className="te-field">
      <div className="te-field-head">
        <span className="te-label">{label}</span>
        <label className="te-mini-toggle">
          <input type="checkbox" checked={isCustom}
            onChange={e => onChange(e.target.checked ? (value || fallback) : '')} />
          <span>eigene</span>
        </label>
      </div>
      <div className={`te-color-field ${!isCustom ? 'te-disabled' : ''}`}>
        <input type="color" value={value || fallback}
          onChange={e => onChange(e.target.value)} disabled={!isCustom} />
        <span className="te-color-hex">{isCustom ? value : 'Modus-Standard'}</span>
      </div>
    </div>
  );
}

export default function ThemeEinstellungen() {
  const navigate = useNavigate();
  const [cfg, setCfg] = useState(loadThemeConfig());

  // ── Enterprise-Gating ──
  let subscription = null, activeDojo = null;
  try { subscription = useSubscription()?.subscription; } catch { /* kein Provider */ }
  try { activeDojo = useDojoContext()?.activeDojo; } catch { /* kein Provider */ }
  const isSuperAdmin = activeDojo === 'super-admin';
  const isEnterprise = isSuperAdmin || subscription?.plan_type === 'enterprise';
  const dojoId = (activeDojo && typeof activeDojo === 'object') ? activeDojo.id : null;

  // saveState: 'idle' | 'saving' | 'saved' | 'local'
  const [saveState, setSaveState] = useState('idle');
  const saveTimer = useRef(null);

  // Beim Öffnen: aktuellen Server-Stand des Dojos holen
  useEffect(() => {
    if (!dojoId) return;
    let cancelled = false;
    fetchDojoTheme(dojoId).then(theme => {
      if (!cancelled && theme) setCfg(applyServerTheme(theme));
    });
    return () => { cancelled = true; };
  }, [dojoId]);

  // Debounced auf Server speichern
  const persist = (next) => {
    if (!dojoId) { setSaveState('local'); return; }   // Super-Admin ohne Dojo-Wahl → nur lokal
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await pushDojoTheme(next, dojoId); setSaveState('saved'); }
      catch { setSaveState('local'); }
    }, 500);
  };

  const update = (patch) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    saveThemeConfig(next);   // lokal sofort
    persist(next);           // Server (debounced)
  };
  const handlePreset = (key) => {
    const next = applyPreset(key);
    setCfg(next);
    persist(next);
  };
  const handleReset = () => {
    const next = resetThemeConfig();
    setCfg(next);
    if (dojoId) deleteDojoTheme(dojoId).then(() => setSaveState('saved')).catch(() => setSaveState('local'));
  };

  if (!isEnterprise) {
    return (
      <div className="te-container">
        <div className="te-header">
          <button className="ds-btn ds-btn--ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={16} /> Zurück
          </button>
        </div>
        <div className="ds-card te-card te-locked">
          <div className="te-locked-icon"><Lock size={40} /></div>
          <h2 className="te-title">Design & Themes</h2>
          <p className="te-subtitle">
            Das individuelle Anpassen von Farben, Schrift und Layout ist ein
            <strong> Enterprise-Feature</strong>. Damit baust du dein Portal exakt im Stil deiner Schule.
          </p>
          <button className="ds-btn ds-btn--primary" onClick={() => navigate('/dashboard/subscription')}>
            Auf Enterprise upgraden
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="te-container">
      <div className="te-header">
        <button className="ds-btn ds-btn--ghost" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} /> Zurück
        </button>
        <div className="te-header-info">
          <h1 className="te-title">🎨 Design & Themes</h1>
          <p className="te-subtitle">
            {dojoId
              ? <>Wird für <strong>{activeDojo.dojoname || 'dieses Dojo'}</strong> gespeichert.</>
              : 'Super-Admin: bitte ein Dojo wählen, um dauerhaft pro Dojo zu speichern (sonst nur lokal).'}
          </p>
        </div>
        <span className={`te-savestate te-savestate--${saveState}`}>
          {saveState === 'saving' && <><Cloud size={14} /> Speichern…</>}
          {saveState === 'saved'  && <><Check size={14} /> Gespeichert</>}
          {saveState === 'local'  && <>Nur lokal</>}
        </span>
        <button className="ds-btn ds-btn--ghost" onClick={handleReset}>
          <RotateCcw size={16} /> Zurücksetzen
        </button>
      </div>

      {/* ── Sticky Live-Vorschau ── */}
      <div className="te-preview-sticky">
        <div className="te-preview-badges">
          <span className="ds-badge ds-badge--accent">Akzent</span>
          <span className="ds-badge ds-badge--success">Erfolg</span>
          <span className="ds-badge ds-badge--danger">Fehler</span>
          <button className="ds-btn ds-btn--primary">Button</button>
          <button className="ds-btn ds-btn--ghost">Ghost</button>
        </div>
        <div className="tab-navigation te-preview-tabs">
          <button className="tab-button active">Übersicht</button>
          <button className="tab-button">Details</button>
          <button className="tab-button">Verlauf</button>
        </div>
        <div className="ds-card te-preview-inner">
          <h2 style={{ margin: '0 0 4px' }}>Beispiel-Überschrift</h2>
          <p style={{ margin: 0, color: 'var(--ds-text-secondary)' }}>
            So sehen Karten, Schrift, Größen und Farben mit deinen Einstellungen aus.
          </p>
        </div>
      </div>

      {/* ── Fertige Themen ── */}
      <Section title="Fertige Themen" defaultOpen>
        <div className="te-theme-gallery">
          {THEME_PRESETS.map(p => (
            <button key={p.key} type="button"
              className={`te-theme-tile ${cfg.preset === p.key ? 'is-active' : ''}`}
              style={{ '--tile': p.swatch }}
              onClick={() => handlePreset(p.key)}>
              <span className="te-theme-emoji">{p.emoji}</span>
              <span className="te-theme-name">{p.label}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* ── Modus ── */}
      <Section title="Basis-Modus">
        <Segment options={MODE_OPTIONS} value={cfg.mode} onChange={v => update({ mode: v })} />
        <p className="te-note">Legt Hintergründe & Grund-Textfarbe fest. Branding-Farben liegen darüber.</p>
      </Section>

      {/* ── Akzent ── */}
      <Section title="Akzentfarbe">
        <label className="te-toggle-row">
          <span>Akzentfarbe verwenden</span>
          <input type="checkbox" className="te-switch" checked={cfg.accentOn}
            onChange={e => update({ accentOn: e.target.checked })} />
        </label>
        <div className={`te-presets ${!cfg.accentOn ? 'te-disabled' : ''}`}>
          {ACCENT_PRESETS.map(p => (
            <button key={p.value} type="button"
              className={`te-swatch ${cfg.accent === p.value ? 'is-active' : ''}`}
              style={{ '--sw': p.value }}
              onClick={() => update({ accent: p.value, accentOn: true })} title={p.label} />
          ))}
          <label className="te-swatch te-swatch--custom" title="Eigene Farbe">
            <input type="color" value={cfg.accent}
              onChange={e => update({ accent: e.target.value, accentOn: true })} />
          </label>
        </div>
      </Section>

      {/* ── Farben ── */}
      <Section title="Farben (Button & Text)">
        <ColorField label="Buttonfarbe" value={cfg.buttonColor} fallback={cfg.accent}
          onChange={v => update({ buttonColor: v })} />
        <ColorField label="Schriftfarbe" value={cfg.textColor} fallback="#ffffff"
          onChange={v => update({ textColor: v })} />
      </Section>

      {/* ── Hintergründe ── */}
      <Section title="Hintergründe">
        <ColorField label="Seitenhintergrund" value={cfg.bgBody} fallback="#0f0f1e"
          onChange={v => update({ bgBody: v })} />
        <ColorField label="Kartenhintergrund" value={cfg.bgCard} fallback="#1a1a2e"
          onChange={v => update({ bgCard: v })} />
        <ColorField label="Rahmen" value={cfg.border} fallback="#2a2a3e"
          onChange={v => update({ border: v })} />
      </Section>

      {/* ── Header ── */}
      <Section title="Header (Kopfleiste)">
        <ColorField label="Hintergrund" value={cfg.headerBg} fallback="#14141f"
          onChange={v => update({ headerBg: v })} />
        <ColorField label="Textfarbe" value={cfg.headerText} fallback="#ffffff"
          onChange={v => update({ headerText: v })} />
      </Section>

      {/* ── Sidebar ── */}
      <Section title="Sidebar (Menü)">
        <ColorField label="Hintergrund" value={cfg.sidebarBg} fallback="#14141f"
          onChange={v => update({ sidebarBg: v })} />
        <ColorField label="Textfarbe" value={cfg.sidebarText} fallback="#ffffff"
          onChange={v => update({ sidebarText: v })} />
        <ColorField label="Aktiv-Farbe" value={cfg.sidebarActive} fallback={cfg.accent}
          onChange={v => update({ sidebarActive: v })} />
      </Section>

      {/* ── Schrift & Größe ── */}
      <Section title="Schrift & Größe">
        <label className="te-field">
          <span className="te-label">Schriftart</span>
          <select className="ds-input" value={cfg.font} onChange={e => update({ font: e.target.value })}>
            {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>
        <label className="te-field">
          <span className="te-label">Text-Größe</span>
          <Segment options={SCALE_OPTIONS} value={cfg.textScale} onChange={v => update({ textScale: v })} />
        </label>
        <label className="te-field">
          <span className="te-label">Überschriften-Größe</span>
          <Segment options={SCALE_OPTIONS} value={cfg.headingScale} onChange={v => update({ headingScale: v })} />
        </label>
      </Section>

      {/* ── Form ── */}
      <Section title="Form (Ecken, Buttons, Tabs)">
        <label className="te-field">
          <span className="te-label">Ecken-Radius (gesamt)</span>
          <Segment options={RADIUS_OPTIONS} value={cfg.radius} onChange={v => update({ radius: v })} />
        </label>
        <label className="te-field">
          <span className="te-label">Button-Form</span>
          <Segment options={BTN_SHAPE_OPTIONS} value={cfg.btnShape} onChange={v => update({ btnShape: v })} />
        </label>
        <label className="te-field">
          <span className="te-label">Tab-Stil</span>
          <Segment options={TAB_STYLE_OPTIONS} value={cfg.tabStyle} onChange={v => update({ tabStyle: v })} />
        </label>
      </Section>

      {/* ── Effekte ── */}
      <Section title="Effekte & Kanji">
        <label className="te-toggle-row">
          <span>Farbverlauf in Karten</span>
          <input type="checkbox" className="te-switch" checked={cfg.gradient}
            onChange={e => update({ gradient: e.target.checked })} />
        </label>
        <label className="te-toggle-row">
          <span>Glow auf Akzent-Elementen</span>
          <input type="checkbox" className="te-switch" checked={cfg.glow}
            onChange={e => update({ glow: e.target.checked })} />
        </label>
        <label className="te-field">
          <span className="te-label">Schatten-Stärke</span>
          <Segment options={SHADOW_OPTIONS} value={cfg.shadow} onChange={v => update({ shadow: v })} />
        </label>
        <label className="te-toggle-row">
          <span>Kanji-Wasserzeichen</span>
          <input type="checkbox" className="te-switch" checked={cfg.kanji}
            onChange={e => update({ kanji: e.target.checked })} />
        </label>
        {cfg.kanji && (
          <label className="te-field">
            <span className="te-label">Kanji-Zeichen</span>
            <select className="ds-input" value={cfg.kanjiChar} onChange={e => update({ kanjiChar: e.target.value })}>
              {KANJI_OPTIONS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>
        )}
      </Section>

    </div>
  );
}
