/**
 * DokumentenZentrale.jsx
 * ======================
 * Zentraler Hub für alle Dokumente, Vorlagen und Verträge.
 * Konsolidiert VorlagenVerwaltung, DokumenteVerwaltung und BerichteDokumente.
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import {
  ArrowLeft, FileText, Mail, Shield, BarChart3,
  LayoutGrid, Loader2, History, Zap, Paperclip, Settings, Plus
} from 'lucide-react';
import '../styles/DokumentenZentrale.css';

// Lazy-Load der Sub-Komponenten
const VorlagenVerwaltung = lazy(() => import('./VorlagenVerwaltung'));
const DokumenteVerwaltung = lazy(() => import('./DokumenteVerwaltung'));
const BerichteDokumente = lazy(() => import('./BerichteDokumente'));
const VersandhistorieTab = lazy(() => import('./VersandhistorieTab'));
const AutomatisierungTab = lazy(() => import('./AutomatisierungTab'));
const AnhangBibliothek = lazy(() => import('./AnhangBibliothek'));

// Alle Tabs in einer einzigen Zeile — immer sichtbar
// vorlagen_* Tabs zeigen VorlagenVerwaltung mit der jeweiligen Ansicht
const TABS = [
  { id: 'uebersicht',            label: 'Übersicht',       icon: LayoutGrid },
  { id: 'vorlagen',              label: 'Vorlagen',         icon: Mail },
  { id: 'vorlagen_einstellungen',label: 'Einstellungen',    icon: Settings },
  { id: 'vorlagen_verlauf',      label: 'Verlauf',          icon: History },
  { id: 'vertraege',             label: 'Verträge & Recht', icon: Shield },
  { id: 'berichte',              label: 'Berichte & PDFs',  icon: BarChart3 },
  { id: 'archiv',                label: 'Versandarchiv',    icon: History },
  { id: 'automatisierungen',     label: 'Automatisierungen',icon: Zap },
  { id: 'anhaenge',              label: 'Anhang-Bibliothek',icon: Paperclip },
];

// Mapping Tab-ID → VorlagenVerwaltung-Ansicht
const VORLAGEN_ANSICHT = {
  vorlagen:               'vorlagen',
  vorlagen_einstellungen: 'einstellungen',
  vorlagen_verlauf:       'verlauf',
};

const LazyFallback = () => (
  <div className="dz-lazy-fallback">
    <Loader2 className="dz-spinner" size={32} />
    <span>Wird geladen...</span>
  </div>
);

export default function DokumentenZentrale({ embedded = false }) {
  const navigate = useNavigate();
  const { activeDojo } = useDojoContext();
  const [activeTab, setActiveTab] = useState('uebersicht');
  // 'neu' ist ein einmaliger Trigger für "Neue Vorlage" — wird nach Auslösung zurückgesetzt
  const [vorlagenNeuTrigger, setVorlagenNeuTrigger] = useState(0);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const withDojo = (url) =>
    activeDojo?.id
      ? `${url}${url.includes('?') ? '&' : '?'}dojo_id=${activeDojo.id}`
      : url;

  useEffect(() => {
    loadStats();
  }, [activeDojo]);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const res = await axios.get(withDojo('/dokumente/zentrale/stats'));
      setStats(res.data);
    } catch (err) {
      console.warn('Stats konnten nicht geladen werden:', err.message);
      setStats({ vorlagen: '-', vertragsvorlagen: '-', absenderProfile: '-' });
    } finally {
      setLoadingStats(false);
    }
  };

  const statCards = [
    { label: 'E-Mail & Brief-Vorlagen', value: stats?.vorlagen ?? '-',       icon: Mail,     color: 'var(--info)',    tab: 'vorlagen'  },
    { label: 'Vertragsvorlagen',        value: stats?.vertragsvorlagen ?? '-',icon: Shield,   color: 'var(--success)', tab: 'vertraege' },
    { label: 'Absender-Profile',        value: stats?.absenderProfile ?? '-', icon: FileText, color: 'var(--warning)', tab: 'vorlagen'  },
    { label: 'PDF-Berichte',            value: '-',                           icon: BarChart3,color: '#8b5cf6',        tab: 'berichte'  },
  ];

  // Wird VorlagenVerwaltung gerade angezeigt?
  const isVorlagenTab = activeTab in VORLAGEN_ANSICHT;

  // Aktuelle Ansicht für VorlagenVerwaltung
  const vorlagenAnsicht = VORLAGEN_ANSICHT[activeTab] || 'vorlagen';

  // "Neue Vorlage" Button: wechselt zu Vorlagen-Tab und triggert Editor
  const handleNeueVorlage = () => {
    setActiveTab('vorlagen');
    setVorlagenNeuTrigger(t => t + 1);
  };

  return (
    <div className="dz-container">
      {/* Header */}
      {!embedded && (
      <div className="dz-header">
        <button className="dz-back-btn" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={18} />
          Zurück
        </button>
        <div className="dz-header-info">
          <h1 className="dz-title">DokumentenZentrale</h1>
          <p className="dz-subtitle">
            Alle Dokumente, Vorlagen & Verträge zentral verwalten
          </p>
        </div>
      </div>
      )}

      {/* Einzige Tab-Zeile — alle Einträge immer sichtbar */}
      <div className="dz-tabs">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`dz-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
        {/* "+ Neue Vorlage" als Action-Button am Ende — kein eigener Tab-State */}
        <button
          className="dz-tab dz-tab--action"
          onClick={handleNeueVorlage}
        >
          <Plus size={16} />
          <span>Neue Vorlage</span>
        </button>
      </div>

      {/* Content */}
      <div className="dz-content">

        {/* Übersicht */}
        {activeTab === 'uebersicht' && (
          <div className="dz-uebersicht">
            <div className="dz-stats-grid">
              {statCards.map((card, i) => {
                const Icon = card.icon;
                return (
                  <div
                    key={i}
                    className="dz-stat-card"
                    onClick={() => setActiveTab(card.tab)}
                    style={{ '--accent': card.color }}
                  >
                    <div className="dz-stat-icon">
                      <Icon size={24} />
                    </div>
                    <div className="dz-stat-info">
                      <span className="dz-stat-value">
                        {loadingStats ? '...' : card.value}
                      </span>
                      <span className="dz-stat-label">{card.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="dz-quick-nav">
              <h3>Schnellzugriff</h3>
              <div className="dz-quick-cards">
                <div className="dz-quick-card" onClick={() => setActiveTab('vorlagen')}>
                  <Mail size={28} />
                  <div>
                    <h4>E-Mail & Brief-Vorlagen</h4>
                    <p>Erstellen, bearbeiten und versenden Sie professionelle Vorlagen</p>
                  </div>
                </div>
                <div className="dz-quick-card" onClick={() => setActiveTab('vertraege')}>
                  <Shield size={28} />
                  <div>
                    <h4>Verträge & Rechtliches</h4>
                    <p>AGB, Datenschutz, Hausordnung und Vertragsvorlagen verwalten</p>
                  </div>
                </div>
                <div className="dz-quick-card" onClick={() => setActiveTab('berichte')}>
                  <BarChart3 size={28} />
                  <div>
                    <h4>Berichte & PDFs</h4>
                    <p>Mitgliederlisten, Anwesenheitsberichte und weitere PDFs erstellen</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vorlagen, Einstellungen, Verlauf — alle zeigen VorlagenVerwaltung */}
        {isVorlagenTab && (
          <Suspense fallback={<LazyFallback />}>
            <VorlagenVerwaltung
              embedded
              controlledAnsicht={vorlagenAnsicht}
              onAnsichtChange={(val) => {
                // Wenn VorlagenVerwaltung intern die Ansicht ändert, Tab syncen
                const tabId = Object.keys(VORLAGEN_ANSICHT).find(k => VORLAGEN_ANSICHT[k] === val);
                if (tabId) setActiveTab(tabId);
              }}
              neuVorlageTrigger={vorlagenNeuTrigger}
            />
          </Suspense>
        )}

        {/* Verträge & Recht */}
        {activeTab === 'vertraege' && (
          <Suspense fallback={<LazyFallback />}>
            <DokumenteVerwaltung embedded />
          </Suspense>
        )}

        {/* Berichte & PDFs */}
        {activeTab === 'berichte' && (
          <Suspense fallback={<LazyFallback />}>
            <BerichteDokumente embedded />
          </Suspense>
        )}

        {/* Versandarchiv */}
        {activeTab === 'archiv' && (
          <Suspense fallback={<LazyFallback />}>
            <VersandhistorieTab withDojo={withDojo} />
          </Suspense>
        )}

        {/* Automatisierungen */}
        {activeTab === 'automatisierungen' && (
          <Suspense fallback={<LazyFallback />}>
            <AutomatisierungTab />
          </Suspense>
        )}

        {/* Anhang-Bibliothek */}
        {activeTab === 'anhaenge' && (
          <Suspense fallback={<LazyFallback />}>
            <AnhangBibliothek />
          </Suspense>
        )}

      </div>
    </div>
  );
}
