/**
 * MarketingZentrale.jsx
 * =====================
 * Zentraler Hub für alle Marketing-Funktionen:
 * - Marketing-Jahresplan
 * - Social Media / Marketing-Aktionen
 * - Freie Aktionen
 */

import React, { useState, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Zap, Loader2, Users } from 'lucide-react';
import '../styles/MarketingZentrale.css';

const MarketingJahresplan   = lazy(() => import('./MarketingJahresplan'));
const FreundeWerbenFreunde  = lazy(() => import('./FreundeWerbenFreunde'));
const FreieAktionen         = lazy(() => import('./FreieAktionen'));

const TABS = [
  { id: 'jahresplan',           label: 'Jahresplan',            icon: CalendarDays },
  { id: 'freunde-werben',       label: 'Freunde werben Freunde', icon: Users },
  { id: 'freie-aktionen',       label: 'Freie Aktionen',        icon: Zap },
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

  return (
    <div className="mz-container">
      {/* Header */}
      {!embedded && (
        <div className="mz-header">
          <button className="mz-back-btn" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={18} /> Zurück
          </button>
          <div className="mz-header-info">
            <h1 className="mz-title">Marketing-Zentrale</h1>
            <p className="mz-subtitle">
              Jahresplanung, Social-Media-Aktionen und spontane Kampagnen
            </p>
          </div>
        </div>
      )}

      {/* Tab-Navigation */}
      <div className="mz-tabs">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`mz-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

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
      </div>
    </div>
  );
}
