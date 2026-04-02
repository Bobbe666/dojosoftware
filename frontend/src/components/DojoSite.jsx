// =====================================================================================
// DOJO SITE — Öffentliche Homepage (TDA-VIB Template)
// Enterprise Feature: Rendert die konfigurierte Homepage im japanischen Martial-Arts-Design
// =====================================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import '../styles/DojoSite.css';

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function slugify(text) {
  return (text || '').toLowerCase().replace(/\s+/g, '-');
}

// ─── Header / Navigation ──────────────────────────────────────────────────────

function SiteHeader({ config }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { school_name, logo_kanji, logo_url, nav_items, primary_color, gold_color } = config;

  return (
    <header className="ds-header" style={{ '--ds-primary': primary_color || '#DC143C', '--ds-gold': gold_color || '#c9a227' }}>
      <div className="ds-container">
        <div className="ds-nav">
          <div className="ds-logo">
            {logo_url
              ? <img src={logo_url} alt={school_name || 'Logo'} className="ds-logo-img" />
              : <span className="ds-logo-kanji">{logo_kanji || '武'}</span>
            }
            <div className="ds-logo-text">
              <span className="ds-logo-name">{school_name || 'Kampfkunstschule'}</span>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="ds-nav-links">
            {(nav_items || []).map((item) => (
              <a key={item.id} href={item.href} className="ds-nav-link">
                {item.label}
              </a>
            ))}
          </nav>

          {/* Hamburger */}
          <button
            className={`ds-hamburger ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menü"
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="ds-mobile-menu" onClick={() => setMenuOpen(false)}>
          {(nav_items || []).map((item) => (
            <a key={item.id} href={item.href} className="ds-mobile-link">
              {item.label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────

function HeroSection({ config }) {
  const { school_name, school_subtitle, logo_kanji, logo_url, tagline, hero_cta_primary, hero_cta_secondary, primary_color, gold_color } = config;

  return (
    <section
      className="ds-hero"
      style={{ '--ds-primary': primary_color || '#DC143C', '--ds-gold': gold_color || '#c9a227' }}
    >
      {/* Dekorative Elemente */}
      <div className="ds-hero-deco" aria-hidden="true">
        <div className="ds-enso ds-enso-1" />
        <div className="ds-enso ds-enso-2" />
        <div className="ds-kanji-bg ds-kanji-1">{logo_kanji || '武'}</div>
        <div className="ds-kanji-bg ds-kanji-2">道</div>
        <div className="ds-bamboo ds-bamboo-left" />
        <div className="ds-bamboo ds-bamboo-right" />
      </div>

      <div className="ds-container ds-hero-inner">
        <div className="ds-hero-logo-wrap" data-kanji={logo_kanji || '武'}>
          {logo_url
            ? <img src={logo_url} alt={school_name || 'Logo'} className="ds-hero-logo-img" />
            : <div className="ds-hero-logo">{logo_kanji || '武'}</div>
          }
        </div>

        <div className="ds-hero-content">
          <p className="ds-hero-subtitle">{school_subtitle || ''}</p>
          <h1 className="ds-hero-title">{school_name || 'Kampfkunstschule'}</h1>
          <div className="ds-hero-divider" aria-hidden="true">
            <span className="ds-hero-divider-kanji">道</span>
          </div>
          {tagline && (
            <p className="ds-hero-tagline">
              <span className="ds-quote-mark">「</span>
              {tagline}
              <span className="ds-quote-mark">」</span>
            </p>
          )}
          <div className="ds-hero-actions">
            {hero_cta_primary?.text && (
              <a href={hero_cta_primary.href || '#'} className="ds-btn ds-btn-primary">
                {hero_cta_primary.text}
              </a>
            )}
            {hero_cta_secondary?.text && (
              <a href={hero_cta_secondary.href || '#'} className="ds-btn ds-btn-secondary">
                {hero_cta_secondary.text}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Kampfkunststile Section ──────────────────────────────────────────────────

function StileSection({ config }) {
  const stile = config.stile || [];
  if (stile.length === 0) return null;

  return (
    <section id="stile" className="ds-section ds-section-stile">
      <div className="ds-container">
        <div className="ds-section-header">
          <h2 className="ds-section-title">Unsere Kampfkünste</h2>
          <div className="ds-divider" />
        </div>
        <div className="ds-stile-grid">
          {stile.map((stil, i) => (
            <div key={i} className="ds-stil-card">
              <div className="ds-stil-icon">{stil.icon || '🥋'}</div>
              <div className="ds-stil-kanji" style={{ color: stil.color || 'var(--ds-gold, #c9a227)' }}>
                {stil.kanji}
              </div>
              <h3 className="ds-stil-name">{stil.name}</h3>
              {stil.japanese && <p className="ds-stil-japanese">{stil.japanese}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Stundenplan Preview Section ──────────────────────────────────────────────

function StundenplanSection({ config, dojoId }) {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dojoId) { setLoading(false); return; }
    axios.get(`/api/public/stundenplan/${dojoId}`)
      .then(res => {
        setSchedule(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [dojoId]);

  const section = (config.sections || []).find(s => s.type === 'stundenplan_preview') || {};
  const title = section.title || 'Nächste Trainings';

  const WOCHENTAG_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const today = new Date();

  // Nächste 3 Tage mit Training
  const nextDays = [];
  if (schedule && Array.isArray(schedule)) {
    for (let offset = 0; offset < 14 && nextDays.length < 3; offset++) {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      const dayOfWeek = date.getDay(); // 0=So, 1=Mo...
      const entries = schedule.filter(e => e.wochentag === dayOfWeek || e.wochentag === WOCHENTAG_NAMES[dayOfWeek]);
      if (entries.length > 0) {
        nextDays.push({ date, entries });
      }
    }
  }

  return (
    <section id="stundenplan" className="ds-section ds-section-schedule">
      <div className="ds-container">
        <div className="ds-section-header">
          <h2 className="ds-section-title">{title}</h2>
          <div className="ds-divider" />
        </div>

        {loading ? (
          <div className="ds-schedule-loading">Stundenplan wird geladen…</div>
        ) : nextDays.length > 0 ? (
          <div className="ds-schedule-grid">
            {nextDays.map(({ date, entries }, i) => (
              <div key={i} className="ds-schedule-day">
                <div className="ds-schedule-day-header">
                  <span className="ds-schedule-weekday">{WOCHENTAG_NAMES[date.getDay()]}</span>
                  <span className="ds-schedule-date">
                    {date.getDate().toString().padStart(2, '0')}.{(date.getMonth()+1).toString().padStart(2, '0')}.
                  </span>
                </div>
                <div className="ds-schedule-entries">
                  {entries.map((entry, j) => (
                    <div key={j} className="ds-schedule-entry">
                      <span className="ds-entry-time">
                        {entry.startzeit || entry.start_time || ''}
                        {entry.endzeit || entry.end_time ? ` – ${entry.endzeit || entry.end_time}` : ''}
                      </span>
                      <span className="ds-entry-name">{entry.kursname || entry.name || 'Training'}</span>
                      {(entry.stilname || entry.stil) && (
                        <span className="ds-entry-stil">{entry.stilname || entry.stil}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="ds-schedule-empty">
            <p>Stundenplan-Informationen sind in Kürze verfügbar.</p>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Werte Section ────────────────────────────────────────────────────────────

function WerteSection({ config }) {
  const werte = config.werte || [];

  return (
    <section id="werte" className="ds-section ds-section-dark ds-section-werte">
      <div className="ds-container">
        <div className="ds-section-header">
          <h2 className="ds-section-title ds-title-light">Unsere Werte</h2>
          <div className="ds-divider ds-divider-gold" />
        </div>
        <div className="ds-werte-grid">
          {werte.map((wert, i) => (
            <div key={i} className="ds-wert-card">
              <div className="ds-wert-kanji" style={{ color: config.gold_color || '#c9a227' }}>
                {wert.kanji}
              </div>
              <div className="ds-wert-reading">{wert.reading}</div>
              <h3 className="ds-wert-name">{wert.name}</h3>
              {wert.text && <p className="ds-wert-text">{wert.text}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA Section ──────────────────────────────────────────────────────────────

function CtaSection({ config }) {
  const cta = config.cta || {};
  const { primary_color, gold_color } = config;

  return (
    <section
      id="kontakt"
      className="ds-section ds-section-cta"
      style={{ '--ds-primary': primary_color || '#DC143C', '--ds-gold': gold_color || '#c9a227' }}
    >
      <div className="ds-container ds-cta-inner">
        <h2 className="ds-cta-title">{cta.title || 'Beginne deinen Weg'}</h2>
        {cta.text && <p className="ds-cta-text">{cta.text}</p>}
        {cta.button_text && (
          <a href={cta.button_href || '#'} className="ds-btn ds-btn-gold">
            {cta.button_text}
          </a>
        )}
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function SiteFooter({ config }) {
  const { school_name, logo_kanji, contact, nav_items, primary_color, gold_color } = config;

  return (
    <footer className="ds-footer" style={{ '--ds-primary': primary_color || '#DC143C', '--ds-gold': gold_color || '#c9a227' }}>
      <div className="ds-container">
        <div className="ds-footer-grid">
          <div className="ds-footer-brand">
            <div className="ds-footer-kanji">{logo_kanji || '武'}</div>
            <div className="ds-footer-name">{school_name}</div>
          </div>
          <div className="ds-footer-nav">
            <h4 className="ds-footer-heading">Navigation</h4>
            {(nav_items || []).map((item) => (
              <a key={item.id} href={item.href} className="ds-footer-link">{item.label}</a>
            ))}
          </div>
          <div className="ds-footer-contact">
            <h4 className="ds-footer-heading">Kontakt</h4>
            {contact?.address && <p className="ds-footer-text">{contact.address}</p>}
            {contact?.email && (
              <a href={`mailto:${contact.email}`} className="ds-footer-link">{contact.email}</a>
            )}
            {contact?.phone && <p className="ds-footer-text">{contact.phone}</p>}
          </div>
        </div>

        <div className="ds-footer-bottom">
          <p>© {new Date().getFullYear()} {school_name} — Powered by DojoSoftware</p>
          <div className="ds-footer-legal">
            <a href="/impressum">Impressum</a>
            <a href="/datenschutz">Datenschutz</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export default function DojoSite() {
  const { slug } = useParams();
  const [siteData, setSiteData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Preview-Modus: ?preview=1 → auth-geschützter Endpoint (für Builder-Vorschau ohne Publizieren)
  const urlParams = new URLSearchParams(window.location.search);
  const isPreview = urlParams.get('preview') === '1';
  const previewDojoId = urlParams.get('dojo_id');

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return; }

    let endpoint;
    if (isPreview) {
      // dojo_id weiterreichen damit getSecureDojoId() auf Server-Seite funktioniert (Super-Admin)
      // KEIN /api-Prefix — axios hat baseURL: '/api' global gesetzt
      endpoint = previewDojoId
        ? `/homepage/preview?dojo_id=${previewDojoId}`
        : `/homepage/preview`;
    } else {
      endpoint = `/homepage/public/${slug}`;
    }

    axios.get(endpoint)
      .then(res => {
        setSiteData(res.data);
        setLoading(false);
      })
      .catch(err => {
        setNotFound(true);
        setLoading(false);
      });
  }, [slug, isPreview, previewDojoId]);

  if (loading) {
    return (
      <div className="ds-root ds-loading">
        <div className="ds-loading-kanji">武</div>
        <p>Wird geladen…</p>
      </div>
    );
  }

  if (notFound || !siteData) {
    return (
      <div className="ds-root ds-not-found">
        <div className="ds-nf-kanji">無</div>
        <h1>Homepage nicht gefunden</h1>
        <p>Diese Homepage existiert nicht oder wurde noch nicht veröffentlicht.</p>
      </div>
    );
  }

  const { config, dojo_id } = siteData;

  // Sektionen sortieren und nur sichtbare anzeigen
  const sections = (config.sections || [])
    .filter(s => s.visible !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const renderSection = (section) => {
    switch (section.type) {
      case 'hero':
        return <HeroSection key={section.id} config={config} />;
      case 'kampfkunststile':
        return <StileSection key={section.id} config={config} />;
      case 'stundenplan_preview':
        return <StundenplanSection key={section.id} config={config} dojoId={dojo_id} />;
      case 'werte':
        return <WerteSection key={section.id} config={config} />;
      case 'cta':
        return <CtaSection key={section.id} config={config} />;
      default:
        return null;
    }
  };

  return (
    <div className="ds-root" style={{ '--ds-primary': config.primary_color || '#DC143C', '--ds-gold': config.gold_color || '#c9a227' }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap"
        rel="stylesheet"
      />
      <SiteHeader config={config} />
      <main className="ds-main">
        {sections.map(renderSection)}
      </main>
      <SiteFooter config={config} />
    </div>
  );
}
