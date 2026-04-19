/**
 * MarketingZentrale.jsx
 * =====================
 * Zentraler Hub für alle Marketing-Funktionen
 */

import React, { useState, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarDays, Zap, Loader2, Users, Gift,
  Megaphone, TrendingUp, Target
} from 'lucide-react';
import '../styles/MarketingZentrale.css';

const MarketingJahresplan   = lazy(() => import('./MarketingJahresplan'));
const FreundeWerbenFreunde  = lazy(() => import('./FreundeWerbenFreunde'));
const FreieAktionen         = lazy(() => import('./FreieAktionen'));
const GutscheineVerwaltung  = lazy(() => import('./GutscheineVerwaltung'));

const TABS = [
  {
    id:    'jahresplan',
    label: 'Jahresplan',
    icon:  CalendarDays,
    desc:  'Geplante Aktionen & Kampagnen',
  },
  {
    id:    'freunde-werben',
    label: 'Freunde werben',
    icon:  Users,
    desc:  'Empfehlungs-Programm',
  },
  {
    id:    'freie-aktionen',
    label: 'Freie Aktionen',
    icon:  Zap,
    desc:  'Spontane Kampagnen',
  },
  {
    id:    'gutscheine',
    label: 'Gutscheine',
    icon:  Gift,
    desc:  'Gutschein-Generator',
    premium: true,
  },
];

const LazyFallback = () => (
  <div className="mz-lazy-fallback">
    <Loader2 className="mz-spinner" size={28} />
    <span>Wird geladen…</span>
  </div>
);

export default function MarketingZentrale({ embedded = false }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'jahresplan';
  const [activeTab, setActiveTab] = useState(initialTab);

  const activeTabData = TABS.find(t => t.id === activeTab);

  return (
    <div className="mz-container">

      {/* Hero-Header */}
      {!embedded && (
        <div className="mz-hero">
          <div className="mz-hero-bg" />
          <div className="mz-hero-inner">
            <button className="mz-back-btn" onClick={() => navigate('/dashboard')}>
              <ArrowLeft size={16} /> Zurück
            </button>
            <div className="mz-hero-content">
              <div className="mz-hero-icon-wrap">
                <Megaphone size={28} />
              </div>
              <div>
                <h1 className="mz-hero-title">Marketing-Zentrale</h1>
                <p className="mz-hero-sub">
                  Jahresplanung · Kampagnen · Gutscheine · Empfehlungen
                </p>
              </div>
            </div>
            <div className="mz-hero-stats">
              <div className="mz-stat">
                <TrendingUp size={15} />
                <span>Wachstum fördern</span>
              </div>
              <div className="mz-stat">
                <Target size={15} />
                <span>Zielgruppe erreichen</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab-Navigation */}
      <div className="mz-tabs-wrap">
        <nav className="mz-tabs">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`mz-tab ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="mz-tab-icon-wrap">
                  <Icon size={17} />
                </span>
                <span className="mz-tab-texts">
                  <span className="mz-tab-label">{tab.label}</span>
                  <span className="mz-tab-desc">{tab.desc}</span>
                </span>
                {tab.premium && <span className="mz-tab-badge">Premium</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Aktiver Tab-Titel (mobil-freundlich) */}
      {activeTabData && (
        <div className="mz-active-header">
          <activeTabData.icon size={16} />
          <span>{activeTabData.label}</span>
          {activeTabData.desc && (
            <span className="mz-active-desc">— {activeTabData.desc}</span>
          )}
        </div>
      )}

      {/* Inhalt */}
      <div className="mz-content">
        {activeTab === 'jahresplan' && (
          <Suspense fallback={<LazyFallback />}>
            <MarketingJahresplan />
          </Suspense>
        )}
        {activeTab === 'freunde-werben' && (
          <Suspense fallback={<LazyFallback />}>
            <FreundeWerbenFreunde />
          </Suspense>
        )}
        {activeTab === 'freie-aktionen' && (
          <Suspense fallback={<LazyFallback />}>
            <FreieAktionen onSwitchToJahresplan={() => setActiveTab('jahresplan')} />
          </Suspense>
        )}
        {activeTab === 'gutscheine' && (
          <Suspense fallback={<LazyFallback />}>
            <GutscheineVerwaltung />
          </Suspense>
        )}
      </div>
    </div>
  );
}
