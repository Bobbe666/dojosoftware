// =====================================================================================
// HOMEPAGE BUILDER — Premium Feature
// Drag & Drop Split-Pane Builder für Dojo-Homepages
// =====================================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { useSubscription } from '../context/SubscriptionContext';
import { useDojoContext } from '../context/DojoContext';
import '../styles/HomepageDashboard.css';


// ─── Standard-Config ──────────────────────────────────────────────────────────

const SECTION_LABELS = {
  hero: { icon: '🏯', label: 'Hero-Bereich' },
  kampfkunststile: { icon: '🥋', label: 'Kampfkunststile' },
  stundenplan_preview: { icon: '📅', label: 'Stundenplan-Vorschau' },
  werte: { icon: '⛩️', label: 'Werte & Philosophie' },
  cta: { icon: '📣', label: 'Call-to-Action' },
};

// ─── Feature Gate ─────────────────────────────────────────────────────────────

function HomepageFeatureGate({ children }) {
  const { hasFeature, subscription, loading } = useSubscription();

  if (loading) {
    return (
      <div className="hpb-loading">
        <div className="hpb-spinner" />
        <p>Wird geladen…</p>
      </div>
    );
  }

  if (!hasFeature('homepage_builder')) {
    const plan = subscription?.plan_type || 'starter';
    return (
      <div className="hpb-gate">
        <div className="hpb-gate-icon">🌐</div>
        <h2>Homepage Builder</h2>
        <p className="hpb-gate-sub">Professionelle Homepage für Ihr Dojo — ab dem Premium-Paket</p>
        <div className="hpb-gate-features">
          <div className="hpb-gate-feature">✓ 4 professionelle Kampfsport-Designs zur Auswahl</div>
          <div className="hpb-gate-feature">✓ Traditionell · Zen · Combat · Dynamic</div>
          <div className="hpb-gate-feature">✓ Eigene Subdomain (mein-dojo.dojo-pages.de)</div>
          <div className="hpb-gate-feature">✓ Live-Stundenplan direkt auf der Homepage</div>
          <div className="hpb-gate-feature">✓ Farben & Bilder individuell anpassbar</div>
        </div>
        <div className="hpb-gate-current">
          Aktueller Plan: <strong>{plan.charAt(0).toUpperCase() + plan.slice(1)}</strong>
        </div>
        <a href="/dashboard/subscription" className="hpb-gate-btn">
          Auf Premium upgraden →
        </a>
      </div>
    );
  }

  return children;
}

// ─── Logo-Upload ──────────────────────────────────────────────────────────────

function LogoUploadField({ value, onChange }) {
  const { activeDojo } = useDojoContext();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const withDojo = useCallback((url) => {
    return activeDojo?.id
      ? `${url}${url.includes('?') ? '&' : '?'}dojo_id=${activeDojo.id}`
      : url;
  }, [activeDojo]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append('logo', file);
    try {
      const res = await axios.post(withDojo('/homepage/logo'), formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(res.data.url);
    } catch (err) {
      setUploadError('Upload fehlgeschlagen');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="hpb-field">
      <label>Logo-Bild (optional)</label>
      {value && (
        <div className="hpb-logo-preview-wrap">
          <img src={value} alt="Logo" className="hpb-logo-preview" />
        </div>
      )}
      <div className="hpb-logo-upload-row">
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
          onChange={handleUpload}
        />
        <button
          className="hpb-btn-secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? '⏳ Lädt…' : '📷 Bild hochladen'}
        </button>
        {value && (
          <button className="hpb-btn-remove" onClick={() => onChange('')} title="Logo entfernen">
            × Entfernen
          </button>
        )}
      </div>
      {uploadError && <p className="hpb-error">{uploadError}</p>}
      <p className="hpb-hint">Wird als Logo-Bild oben links angezeigt. Max. 5 MB.</p>
    </div>
  );
}

// ─── Sektion-Einstellungen ────────────────────────────────────────────────────

function SectionSettings({ section, config, onChange }) {
  const updateSection = (field, value) => {
    const updated = config.sections.map(s =>
      s.id === section.id ? { ...s, [field]: value } : s
    );
    onChange({ sections: updated });
  };

  const updateConfig = (field, value) => {
    onChange({ [field]: value });
  };

  const updateNested = (key, field, value) => {
    onChange({ [key]: { ...config[key], [field]: value } });
  };

  if (section.type === 'hero') {
    return (
      <div className="hpb-settings">
        <div className="hpb-field">
          <label>Schulname</label>
          <input
            type="text"
            value={config.school_name || ''}
            onChange={e => updateConfig('school_name', e.target.value)}
            placeholder="z.B. Kampfkunstschule Schreiner"
          />
        </div>
        <div className="hpb-field">
          <label>Untertitel</label>
          <input
            type="text"
            value={config.school_subtitle || ''}
            onChange={e => updateConfig('school_subtitle', e.target.value)}
            placeholder="z.B. Mitglied der TDA International"
          />
        </div>
        <div className="hpb-field">
          <label>Kanji-Zeichen (Logo)</label>
          <input
            type="text"
            value={config.logo_kanji || '武'}
            onChange={e => updateConfig('logo_kanji', e.target.value)}
            placeholder="武"
            maxLength={2}
          />
        </div>
        <LogoUploadField
          value={config.logo_url || ''}
          onChange={url => updateConfig('logo_url', url)}
        />
        <div className="hpb-field">
          <label>Tagline / Motto</label>
          <input
            type="text"
            value={config.tagline || ''}
            onChange={e => updateConfig('tagline', e.target.value)}
            placeholder="Der Weg beginnt mit dem ersten Schritt"
          />
        </div>
        <div className="hpb-field-row">
          <div className="hpb-field">
            <label>Button 1 Text</label>
            <input
              type="text"
              value={config.hero_cta_primary?.text || ''}
              onChange={e => updateConfig('hero_cta_primary', { ...config.hero_cta_primary, text: e.target.value })}
              placeholder="Probetraining"
            />
          </div>
          <div className="hpb-field">
            <label>Button 1 Link</label>
            <input
              type="text"
              value={config.hero_cta_primary?.href || ''}
              onChange={e => updateConfig('hero_cta_primary', { ...config.hero_cta_primary, href: e.target.value })}
              placeholder="#kontakt"
            />
          </div>
        </div>
        <div className="hpb-field-row">
          <div className="hpb-field">
            <label>Button 2 Text</label>
            <input
              type="text"
              value={config.hero_cta_secondary?.text || ''}
              onChange={e => updateConfig('hero_cta_secondary', { ...config.hero_cta_secondary, text: e.target.value })}
              placeholder="Unsere Kurse"
            />
          </div>
          <div className="hpb-field">
            <label>Button 2 Link</label>
            <input
              type="text"
              value={config.hero_cta_secondary?.href || ''}
              onChange={e => updateConfig('hero_cta_secondary', { ...config.hero_cta_secondary, href: e.target.value })}
              placeholder="#stile"
            />
          </div>
        </div>
      </div>
    );
  }

  if (section.type === 'kampfkunststile') {
    const stile = config.stile || [];
    return (
      <div className="hpb-settings">
        <p className="hpb-hint">Kampfkunststile die auf der Homepage angezeigt werden:</p>
        {stile.map((stil, i) => (
          <div key={i} className="hpb-stil-row">
            <div className="hpb-field hpb-field-sm">
              <label>Icon</label>
              <input
                type="text"
                value={stil.icon || ''}
                onChange={e => {
                  const updated = stile.map((s, idx) => idx === i ? { ...s, icon: e.target.value } : s);
                  updateConfig('stile', updated);
                }}
                placeholder="🥋"
                maxLength={4}
              />
            </div>
            <div className="hpb-field hpb-field-lg">
              <label>Name</label>
              <input
                type="text"
                value={stil.name || ''}
                onChange={e => {
                  const updated = stile.map((s, idx) => idx === i ? { ...s, name: e.target.value } : s);
                  updateConfig('stile', updated);
                }}
                placeholder="Karate"
              />
            </div>
            <div className="hpb-field hpb-field-md">
              <label>Kanji</label>
              <input
                type="text"
                value={stil.kanji || ''}
                onChange={e => {
                  const updated = stile.map((s, idx) => idx === i ? { ...s, kanji: e.target.value } : s);
                  updateConfig('stile', updated);
                }}
                placeholder="空手道"
              />
            </div>
            <button
              className="hpb-btn-remove"
              onClick={() => updateConfig('stile', stile.filter((_, idx) => idx !== i))}
              title="Entfernen"
            >×</button>
          </div>
        ))}
        <button
          className="hpb-btn-add"
          onClick={() => updateConfig('stile', [...stile, { name: '', kanji: '', japanese: '', icon: '🥋', color: '#DC143C' }])}
        >
          + Stil hinzufügen
        </button>
      </div>
    );
  }

  if (section.type === 'stundenplan_preview') {
    return (
      <div className="hpb-settings">
        <div className="hpb-info-box">
          <span>📅</span>
          <p>Der Stundenplan wird automatisch aus Ihren Dojosoftware-Daten geladen und zeigt die nächsten Trainingstage an.</p>
        </div>
        <div className="hpb-field">
          <label>Abschnitts-Titel</label>
          <input
            type="text"
            value={section.title || 'Nächste Trainings'}
            onChange={e => updateSection('title', e.target.value)}
            placeholder="Nächste Trainings"
          />
        </div>
      </div>
    );
  }

  if (section.type === 'werte') {
    const werte = config.werte || [];
    return (
      <div className="hpb-settings">
        <p className="hpb-hint">Kanji-Werte die im dunklen Bereich angezeigt werden:</p>
        {werte.map((wert, i) => (
          <div key={i} className="hpb-wert-row">
            <div className="hpb-field hpb-field-sm">
              <label>Kanji</label>
              <input
                type="text"
                value={wert.kanji || ''}
                onChange={e => {
                  const updated = werte.map((w, idx) => idx === i ? { ...w, kanji: e.target.value } : w);
                  updateConfig('werte', updated);
                }}
                placeholder="礼"
                maxLength={4}
              />
            </div>
            <div className="hpb-field hpb-field-md">
              <label>Lesung</label>
              <input
                type="text"
                value={wert.reading || ''}
                onChange={e => {
                  const updated = werte.map((w, idx) => idx === i ? { ...w, reading: e.target.value } : w);
                  updateConfig('werte', updated);
                }}
                placeholder="Rei"
              />
            </div>
            <div className="hpb-field hpb-field-lg">
              <label>Name</label>
              <input
                type="text"
                value={wert.name || ''}
                onChange={e => {
                  const updated = werte.map((w, idx) => idx === i ? { ...w, name: e.target.value } : w);
                  updateConfig('werte', updated);
                }}
                placeholder="Respekt"
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (section.type === 'cta') {
    return (
      <div className="hpb-settings">
        <div className="hpb-field">
          <label>CTA-Titel</label>
          <input
            type="text"
            value={config.cta?.title || ''}
            onChange={e => updateConfig('cta', { ...config.cta, title: e.target.value })}
            placeholder="Beginne deinen Weg"
          />
        </div>
        <div className="hpb-field">
          <label>CTA-Text</label>
          <textarea
            value={config.cta?.text || ''}
            onChange={e => updateConfig('cta', { ...config.cta, text: e.target.value })}
            placeholder="Das erste Probetraining ist kostenlos..."
            rows={2}
          />
        </div>
        <div className="hpb-field-row">
          <div className="hpb-field">
            <label>Button-Text</label>
            <input
              type="text"
              value={config.cta?.button_text || ''}
              onChange={e => updateConfig('cta', { ...config.cta, button_text: e.target.value })}
              placeholder="Probetraining vereinbaren"
            />
          </div>
          <div className="hpb-field">
            <label>Button-Link</label>
            <input
              type="text"
              value={config.cta?.button_href || ''}
              onChange={e => updateConfig('cta', { ...config.cta, button_href: e.target.value })}
              placeholder="#kontakt"
            />
          </div>
        </div>
      </div>
    );
  }

  return <div className="hpb-settings"><p className="hpb-hint">Keine Einstellungen verfügbar.</p></div>;
}

// ─── Navigations-Editor ───────────────────────────────────────────────────────

function NavEditor({ navItems, onChange }) {
  const addItem = () => {
    onChange([...navItems, { id: Date.now().toString(), label: 'Neuer Link', href: '#' }]);
  };

  const removeItem = (id) => {
    onChange(navItems.filter(item => item.id !== id));
  };

  const updateItem = (id, field, value) => {
    onChange(navItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  return (
    <div className="hpb-nav-editor">
      <p className="hpb-hint">Menüpunkte die in der Navigation angezeigt werden:</p>
      {navItems.map((item) => (
        <div key={item.id} className="hpb-nav-item-row">
          <input
            type="text"
            value={item.label}
            onChange={e => updateItem(item.id, 'label', e.target.value)}
            placeholder="Menüpunkt"
            className="hpb-nav-label"
          />
          <input
            type="text"
            value={item.href}
            onChange={e => updateItem(item.id, 'href', e.target.value)}
            placeholder="#anker oder https://..."
            className="hpb-nav-href"
          />
          <button className="hpb-btn-remove" onClick={() => removeItem(item.id)} title="Entfernen">×</button>
        </div>
      ))}
      <button className="hpb-btn-add" onClick={addItem}>+ Menüpunkt hinzufügen</button>
    </div>
  );
}

// ─── Template-Auswahl ─────────────────────────────────────────────────────────

const TEMPLATE_META = [
  {
    id: 'traditional',
    name: 'Traditionell',
    emoji: '⛩️',
    desc: 'Japanisches Martial-Arts-Design in Crimson & Gold',
    style: 'Karate · TDA · Traditionell',
    colors: ['#DC143C', '#c9a227', '#0a0a0a'],
    preview: 'Elegantes dunkles Design, inspiriert von tda-vib.de',
  },
  {
    id: 'zen',
    name: 'Zen',
    emoji: '🥋',
    desc: 'Minimalistisch · Blau, Weiß & Gold',
    style: 'Karate · Taekwondo · Judo',
    colors: ['#1B2A4A', '#B8963E', '#f8f6f1'],
    preview: 'Ruhiges, helles Design für traditionelle Stile',
  },
  {
    id: 'combat',
    name: 'Combat',
    emoji: '🥊',
    desc: 'Aggressiv · Schwarz, Rot & Chrome',
    style: 'MMA · BJJ · Wrestling',
    colors: ['#C41E3A', '#8B8B8B', '#0d0d0d'],
    preview: 'Dunkles, kraftvolles Design für Combat Sports',
  },
  {
    id: 'dynamic',
    name: 'Dynamic',
    emoji: '🔥',
    desc: 'Energetisch · Anthrazit & Orange',
    style: 'Kickboxen · Muay Thai · Fitness',
    colors: ['#FF5722', '#12192C', '#1a2235'],
    preview: 'Modernes, dynamisches Design für Kampfsport & Fitness',
  },
];

function TemplateSelector({ templateId, onSelect }) {
  return (
    <div className="hpb-template-selector">
      <p className="hpb-hint" style={{ marginBottom: '16px' }}>
        Wähle das Design-Template das am besten zu deiner Schule passt.
        Farben und Bilder kannst du danach individuell anpassen.
      </p>
      <div className="hpb-template-grid">
        {TEMPLATE_META.map(tpl => (
          <div
            key={tpl.id}
            className={`hpb-template-card ${templateId === tpl.id ? 'active' : ''}`}
            onClick={() => onSelect(tpl.id)}
          >
            <div className="hpb-tpl-header" style={{ background: tpl.colors[2] }}>
              <div className="hpb-tpl-dots">
                {tpl.colors.map((c, i) => (
                  <span key={i} style={{ background: c, width: 10, height: 10, borderRadius: '50%', display: 'inline-block', marginRight: 4 }} />
                ))}
              </div>
              <div className="hpb-tpl-emoji">{tpl.emoji}</div>
            </div>
            <div className="hpb-tpl-body">
              <div className="hpb-tpl-name-row">
                <strong>{tpl.name}</strong>
                {templateId === tpl.id && <span className="hpb-tpl-active-badge">Aktiv</span>}
              </div>
              <p className="hpb-tpl-style">{tpl.style}</p>
              <p className="hpb-tpl-preview">{tpl.preview}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Design-Einstellungen ─────────────────────────────────────────────────────

function DesignSettings({ config, onChange }) {
  return (
    <div className="hpb-design-settings">
      <div className="hpb-field-row">
        <div className="hpb-field">
          <label>Primärfarbe</label>
          <div className="hpb-color-row">
            <input
              type="color"
              value={config.primary_color || '#DC143C'}
              onChange={e => onChange({ primary_color: e.target.value })}
            />
            <span>{config.primary_color || '#DC143C'}</span>
          </div>
        </div>
        <div className="hpb-field">
          <label>Goldfarbe</label>
          <div className="hpb-color-row">
            <input
              type="color"
              value={config.gold_color || '#c9a227'}
              onChange={e => onChange({ gold_color: e.target.value })}
            />
            <span>{config.gold_color || '#c9a227'}</span>
          </div>
        </div>
      </div>
      <div className="hpb-info-box">
        <span>🎨</span>
        <p>Das Template basiert auf dem traditionellen japanischen Design von tda-vib.de (Washi-Papier, Kanji, Enso).</p>
      </div>
    </div>
  );
}

// ─── Kontakt-Einstellungen ────────────────────────────────────────────────────

function KontaktSettings({ config, onChange }) {
  const updateContact = (field, value) => {
    onChange({ contact: { ...config.contact, [field]: value } });
  };

  return (
    <div className="hpb-settings">
      <div className="hpb-field">
        <label>Adresse</label>
        <input
          type="text"
          value={config.contact?.address || ''}
          onChange={e => updateContact('address', e.target.value)}
          placeholder="Musterstraße 1, 12345 Musterstadt"
        />
      </div>
      <div className="hpb-field">
        <label>E-Mail</label>
        <input
          type="email"
          value={config.contact?.email || ''}
          onChange={e => updateContact('email', e.target.value)}
          placeholder="info@meindojo.de"
        />
      </div>
      <div className="hpb-field">
        <label>Telefon</label>
        <input
          type="text"
          value={config.contact?.phone || ''}
          onChange={e => updateContact('phone', e.target.value)}
          placeholder="+49 123 456789"
        />
      </div>
    </div>
  );
}

// ─── URL-Einstellungen ────────────────────────────────────────────────────────

function SlugSettings({ slug, onSlugChange, slugAvailable, onSlugCheck }) {
  const [inputVal, setInputVal] = useState(slug || '');
  const [checking, setChecking] = useState(false);

  useEffect(() => { setInputVal(slug || ''); }, [slug]);

  const handleBlur = async () => {
    if (!inputVal || inputVal === slug) return;
    setChecking(true);
    await onSlugCheck(inputVal);
    setChecking(false);
  };

  return (
    <div className="hpb-settings">
      <div className="hpb-field">
        <label>URL-Name (Slug)</label>
        <div className="hpb-slug-row">
          <span className="hpb-slug-prefix" style={{ fontSize: '0.78rem' }}></span>
          <input
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            onBlur={handleBlur}
            placeholder="mein-dojo"
          />
        </div>
        {inputVal && (
          <div className="hpb-slug-preview-box">
            <span className="hpb-slug-preview-url">{inputVal}.dojo-pages.de</span>
          </div>
        )}
        {checking && <p className="hpb-slug-status checking">Prüfe Verfügbarkeit…</p>}
        {!checking && slugAvailable === true && <p className="hpb-slug-status ok">✓ Verfügbar</p>}
        {!checking && slugAvailable === false && <p className="hpb-slug-status error">✗ Bereits vergeben</p>}
        <button
          className="hpb-btn-secondary"
          onClick={() => onSlugChange(inputVal)}
          style={{ marginTop: '0.5rem' }}
        >
          Übernehmen
        </button>
      </div>
      <div className="hpb-info-box">
        <span>🔗</span>
        <p>
          Deine Homepage ist unter <strong>{inputVal || 'dein-name'}.dojo-pages.de</strong> erreichbar.
          Optional kann auch eine eigene Domain (z.B. meine-schule.de) eingerichtet werden.
        </p>
      </div>
    </div>
  );
}

// ─── Server-Einstellungen ─────────────────────────────────────────────────────

function ServerSettings({ slug, config, onChange }) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCname, setCopiedCname] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);
  const publicUrl = slug ? `https://dojo.tda-intl.org/site/${slug}` : '';
  const cnameTarget = 'dojo.tda-intl.org';
  const serverIp = '185.80.92.166';
  const customDomain = config?.custom_domain || '';

  const copy = (text, setter) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <div className="hpb-settings">
      {/* Aktuelle URL */}
      <div className="hpb-server-section">
        <div className="hpb-server-label">🔗 Aktuelle Adresse</div>
        {slug ? (
          <div className="hpb-server-url-row">
            <span className="hpb-server-url">{publicUrl}</span>
            <button className="hpb-btn-copy-sm" onClick={() => copy(publicUrl, setCopiedUrl)} title="Kopieren">
              {copiedUrl ? '✓' : '⎘'}
            </button>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="hpb-server-ext-link">↗</a>
          </div>
        ) : (
          <p className="hpb-hint">Erst URL-Namen vergeben (Tab "URL")</p>
        )}
      </div>

      {/* Custom Domain */}
      <div className="hpb-server-section">
        <div className="hpb-server-label">🌐 Eigene Domain (optional)</div>
        <div className="hpb-field">
          <input
            type="text"
            value={customDomain}
            onChange={e => onChange({ custom_domain: e.target.value.toLowerCase().trim() })}
            placeholder="www.mein-dojo.de"
          />
        </div>
        <p className="hpb-hint" style={{ marginTop: '0.25rem' }}>z.B. www.kampfkunstschule-schreiner.de</p>
      </div>

      {/* DNS Anleitung */}
      <div className="hpb-server-section">
        <div className="hpb-server-label">📡 DNS-Einrichtung</div>
        <p className="hpb-hint">Variante A — CNAME (empfohlen für Subdomain wie www.):</p>
        <div className="hpb-dns-table" style={{ marginBottom: '0.75rem' }}>
          <div className="hpb-dns-row">
            <span className="hpb-dns-col-label">Typ</span>
            <span className="hpb-dns-col-value">CNAME</span>
          </div>
          <div className="hpb-dns-row">
            <span className="hpb-dns-col-label">Name</span>
            <span className="hpb-dns-col-value">
              {customDomain ? customDomain.replace(/^https?:\/\//, '').split('/')[0].split('.')[0] : 'www'}
            </span>
          </div>
          <div className="hpb-dns-row">
            <span className="hpb-dns-col-label">Ziel</span>
            <span className="hpb-dns-col-value hpb-dns-highlight">{cnameTarget}</span>
            <button className="hpb-btn-copy-sm" onClick={() => copy(cnameTarget, setCopiedCname)} title="Kopieren">
              {copiedCname ? '✓' : '⎘'}
            </button>
          </div>
          <div className="hpb-dns-row">
            <span className="hpb-dns-col-label">TTL</span>
            <span className="hpb-dns-col-value">3600</span>
          </div>
        </div>
        <p className="hpb-hint">Variante B — A-Record (für Root-Domain wie mein-dojo.de):</p>
        <div className="hpb-dns-table">
          <div className="hpb-dns-row">
            <span className="hpb-dns-col-label">Typ</span>
            <span className="hpb-dns-col-value">A</span>
          </div>
          <div className="hpb-dns-row">
            <span className="hpb-dns-col-label">Name</span>
            <span className="hpb-dns-col-value">@ (Root)</span>
          </div>
          <div className="hpb-dns-row">
            <span className="hpb-dns-col-label">IP</span>
            <span className="hpb-dns-col-value hpb-dns-highlight">{serverIp}</span>
            <button className="hpb-btn-copy-sm" onClick={() => copy(serverIp, setCopiedIp)} title="Kopieren">
              {copiedIp ? '✓' : '⎘'}
            </button>
          </div>
          <div className="hpb-dns-row">
            <span className="hpb-dns-col-label">TTL</span>
            <span className="hpb-dns-col-value">3600</span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="hpb-info-box">
        <span>ℹ️</span>
        <p>
          Nach dem DNS-Eintrag bitte Bescheid geben — wir richten die Domain dann auf dem Server ein.
          SSL/HTTPS wird automatisch eingerichtet (Let's Encrypt).
        </p>
      </div>

      {/* Support */}
      <div className="hpb-server-section">
        <div className="hpb-server-label">📧 Technischer Support</div>
        <p className="hpb-hint">
          Für Domain-Einrichtung oder technische Fragen:<br/>
          <a href="mailto:admin@tda-intl.org" style={{ color: 'var(--color-primary, #2563eb)' }}>admin@tda-intl.org</a>
        </p>
      </div>
    </div>
  );
}

// ─── Live-Vorschau ────────────────────────────────────────────────────────────

function LivePreview({ config, slug, isPublished, dojoId }) {
  const previewRef = useRef(null);
  const [previewKey, setPreviewKey] = useState(0);
  const publicUrl = slug ? `https://${slug}.dojo-pages.de` : null;
  // Vorschau über den neuen Render-Endpunkt (preview=1 = auch unpublished Seiten)
  const previewSrc = slug
    ? `/api/homepage/render/${slug}?preview=1${dojoId ? `&dojo_id=${dojoId}` : ''}`
    : null;

  // Iframe neu laden wenn Seite gespeichert wurde (von außen trigger)
  const refreshPreview = () => setPreviewKey(k => k + 1);

  return (
    <div className="hpb-preview-panel">
      <div className="hpb-preview-bar">
        <div className="hpb-preview-dots">
          <span /><span /><span />
        </div>
        <div className="hpb-preview-url">
          {slug ? `${slug}.dojo-pages.de` : '(noch kein URL-Name vergeben)'}
        </div>
        <div className="hpb-preview-bar-right">
          {slug && (
            <button
              className="hpb-preview-refresh"
              onClick={refreshPreview}
              title="Vorschau aktualisieren"
            >↺</button>
          )}
          {publicUrl && isPublished && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hpb-preview-open"
              title="Im Browser öffnen"
            >
              ↗
            </a>
          )}
        </div>
      </div>
      <div className="hpb-preview-frame">
        {previewSrc ? (
          <iframe
            key={previewKey}
            ref={previewRef}
            src={previewSrc}
            title="Homepage-Vorschau"
            className="hpb-preview-iframe"
          />
        ) : (
          <div className="hpb-preview-placeholder">
            <div className="hpb-preview-ph-kanji">{config.logo_kanji || '武'}</div>
            <p>{config.school_name || 'Ihr Schulname'}</p>
            <p className="hpb-preview-ph-sub">
              Erst URL-Namen vergeben (Tab "URL") — dann erscheint hier die Vorschau
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

function HomepageBuilderInner() {
  const { activeDojo } = useDojoContext();
  const dojoId = activeDojo?.id || null;

  const [config, setConfig] = useState(null);
  const [slug, setSlug] = useState('');
  const [templateId, setTemplateId] = useState('traditional');
  const [isPublished, setIsPublished] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');
  const [activePanel, setActivePanel] = useState('sections'); // 'sections'|'nav'|'template'|'design'|'kontakt'|'url'
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [slugAvailable, setSlugAvailable] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Dojo-ID Query-Param für Super-Admin (dojo_id=null im JWT)
  const withDojo = useCallback((url) => {
    const id = activeDojo?.id;
    if (!id) return url;
    return url + (url.includes('?') ? '&' : '?') + `dojo_id=${id}`;
  }, [activeDojo]);

  const loadConfig = useCallback(async () => {
    if (!dojoId) return; // Kein Dojo ausgewählt
    try {
      const res = await axios.get(withDojo('/homepage/config'));
      setConfig(res.data.config);
      setSlug(res.data.slug || '');
      setTemplateId(res.data.template_id || 'traditional');
      setIsPublished(res.data.is_published || false);
    } catch (err) {
      setError('Fehler beim Laden der Homepage-Konfiguration.');
      console.error(err);
    }
  }, [dojoId, withDojo]);

  // Konfiguration laden (nur wenn Dojo ausgewählt)
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);


  const handleConfigChange = useCallback((changes) => {
    setConfig(prev => ({ ...prev, ...changes }));
    setIsDirty(true);
  }, []);

  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await axios.put(withDojo('/homepage/config'), { config, slug, template_id: templateId });
      setSlug(res.data.slug);
      setIsDirty(false);
      showSuccess('Gespeichert!');
    } catch (err) {
      const msg = err.response?.data?.message || 'Fehler beim Speichern.';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (isPublishing) return;
    if (isDirty) {
      await handleSave();
    }
    setIsPublishing(true);
    setError(null);
    try {
      const res = await axios.post(withDojo('/homepage/publish'), { publish: !isPublished });
      setIsPublished(res.data.is_published);
      showSuccess(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Publizieren.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSlugCheck = async (newSlug) => {
    if (!newSlug || newSlug.length < 2) return;
    try {
      const res = await axios.get(withDojo(`/homepage/slug-check/${newSlug}`));
      setSlugAvailable(res.data.available);
      if (res.data.available) {
        setSlug(newSlug);
        setIsDirty(true);
      }
    } catch (err) {
      setSlugAvailable(null);
    }
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Drag & Drop für Sektion-Reordering
  const handleDragStart = (idx) => setDragIdx(idx);
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const handleDrop = (e, dropIdx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === dropIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const sections = [...config.sections];
    const [moved] = sections.splice(dragIdx, 1);
    sections.splice(dropIdx, 0, moved);
    const reordered = sections.map((s, i) => ({ ...s, order: i + 1 }));
    setConfig(prev => ({ ...prev, sections: reordered }));
    setIsDirty(true);
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const toggleSectionVisible = (sectionId) => {
    const updated = config.sections.map(s =>
      s.id === sectionId ? { ...s, visible: !s.visible } : s
    );
    setConfig(prev => ({ ...prev, sections: updated }));
    setIsDirty(true);
  };

  // Kein Dojo ausgewählt (Super-Admin im "Alle Dojos" Modus)
  if (!dojoId) {
    return (
      <div className="hpb-gate">
        <div className="hpb-gate-icon">🏯</div>
        <h2>Dojo auswählen</h2>
        <p className="hpb-gate-sub">
          Bitte wähle oben links im Dojo-Wechsler ein Dojo aus,
          um dessen Homepage zu bearbeiten.
        </p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="hpb-loading">
        <div className="hpb-spinner" />
        <p>Konfiguration wird geladen…</p>
      </div>
    );
  }

  const activeSecObj = config.sections.find(s => s.id === activeSection);

  return ReactDOM.createPortal(
    <div className="hpb-root">
      {/* ─── Toolbar ─── */}
      <div className="hpb-toolbar">
        <div className="hpb-toolbar-left">
          <span className="hpb-toolbar-title">🌐 Meine Homepage</span>
          <span className={`hpb-status-chip ${isPublished ? 'published' : 'draft'}`}>
            {isPublished ? '✓ Publiziert' : '○ Entwurf'}
          </span>
          {isPublished && slug && (
            <a
              href={`/api/homepage/render/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hpb-toolbar-link"
            >
              {slug}.dojo-pages.de ↗
            </a>
          )}
        </div>
        <div className="hpb-toolbar-right">
          {error && <span className="hpb-toolbar-error">⚠ {error}</span>}
          {successMsg && <span className="hpb-toolbar-success">✓ {successMsg}</span>}
          <button
            className={`hpb-btn-save ${isDirty ? 'active' : ''}`}
            onClick={handleSave}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? 'Speichert…' : '💾 Speichern'}
          </button>
          <button
            className={`hpb-btn-publish ${isPublished ? 'unpublish' : 'publish'}`}
            onClick={handlePublish}
            disabled={isPublishing}
          >
            {isPublishing ? '…' : isPublished ? '⏹ Depublizieren' : '🚀 Publizieren'}
          </button>
        </div>
      </div>

      {/* ─── Split-Pane ─── */}
      <div className="hpb-split">
        {/* ─── Linkes Panel ─── */}
        <div className="hpb-left-panel">
          {/* Panel-Tabs */}
          <div className="hpb-panel-tabs">
            {[
              { key: 'sections', label: 'Sektionen' },
              { key: 'template', label: 'Template' },
              { key: 'nav', label: 'Navigation' },
              { key: 'design', label: 'Design' },
              { key: 'kontakt', label: 'Kontakt' },
              { key: 'url', label: 'URL' },
              { key: 'server', label: 'Server' },
            ].map(tab => (
              <button
                key={tab.key}
                className={`hpb-panel-tab ${activePanel === tab.key ? 'active' : ''}`}
                onClick={() => setActivePanel(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sektionen-Panel */}
          {activePanel === 'sections' && (
            <div className="hpb-sections-panel">
              <div className="hpb-section-list">
                {config.sections
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((section, idx) => {
                    const meta = SECTION_LABELS[section.type] || { icon: '📄', label: section.type };
                    const isDragging = dragIdx === idx;
                    const isOver = dragOverIdx === idx;
                    return (
                      <div
                        key={section.id}
                        className={`hpb-section-item ${activeSection === section.id ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${isOver ? 'drag-over' : ''}`}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={e => handleDragOver(e, idx)}
                        onDrop={e => handleDrop(e, idx)}
                        onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                        onClick={() => setActiveSection(section.id)}
                      >
                        <span className="hpb-drag-handle" title="Ziehen zum Neuordnen">⠿</span>
                        <span className="hpb-section-icon">{meta.icon}</span>
                        <span className="hpb-section-label">{meta.label}</span>
                        <button
                          className={`hpb-visibility-btn ${section.visible ? 'visible' : 'hidden'}`}
                          onClick={e => { e.stopPropagation(); toggleSectionVisible(section.id); }}
                          title={section.visible ? 'Ausblenden' : 'Einblenden'}
                        >
                          {section.visible ? '👁' : '🙈'}
                        </button>
                      </div>
                    );
                  })}
              </div>

              {/* Aktive Sektion Einstellungen */}
              {activeSecObj && (
                <div className="hpb-section-settings-wrap">
                  <div className="hpb-section-settings-title">
                    {SECTION_LABELS[activeSecObj.type]?.icon} {SECTION_LABELS[activeSecObj.type]?.label}
                  </div>
                  <SectionSettings
                    section={activeSecObj}
                    config={config}
                    onChange={handleConfigChange}
                  />
                </div>
              )}
            </div>
          )}

          {activePanel === 'template' && (
            <div className="hpb-sections-panel">
              <TemplateSelector
                templateId={templateId}
                onSelect={(id) => {
                  setTemplateId(id);
                  setIsDirty(true);
                }}
              />
            </div>
          )}

          {activePanel === 'nav' && (
            <div className="hpb-sections-panel">
              <NavEditor
                navItems={config.nav_items || []}
                onChange={items => handleConfigChange({ nav_items: items })}
              />
            </div>
          )}

          {activePanel === 'design' && (
            <div className="hpb-sections-panel">
              <DesignSettings config={config} onChange={handleConfigChange} />
            </div>
          )}

          {activePanel === 'kontakt' && (
            <div className="hpb-sections-panel">
              <KontaktSettings config={config} onChange={handleConfigChange} />
            </div>
          )}

          {activePanel === 'url' && (
            <div className="hpb-sections-panel">
              <SlugSettings
                slug={slug}
                onSlugChange={newSlug => { setSlug(newSlug); setIsDirty(true); }}
                slugAvailable={slugAvailable}
                onSlugCheck={handleSlugCheck}
              />
            </div>
          )}

          {activePanel === 'server' && (
            <div className="hpb-sections-panel">
              <ServerSettings slug={slug} config={config} onChange={handleConfigChange} />
            </div>
          )}
        </div>

        {/* ─── Rechtes Panel (Vorschau) ─── */}
        <div className="hpb-right-panel">
          <LivePreview config={config} slug={slug} isPublished={isPublished} dojoId={dojoId} />
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function HomepageDashboard() {
  return (
    <HomepageFeatureGate>
      <HomepageBuilderInner />
    </HomepageFeatureGate>
  );
}
