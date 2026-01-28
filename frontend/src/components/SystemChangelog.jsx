// ============================================================================
// SYSTEM CHANGELOG
// Frontend/src/components/SystemChangelog.jsx
// Zeigt wichtige System-Updates und Änderungen an
// ============================================================================

import React, { useState } from 'react';
import {
  Sparkles, Calendar, Zap, Shield, CreditCard, Users,
  Settings, Bug, Star, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';

// ============================================================================
// CHANGELOG DATEN - Hier neue Einträge hinzufügen!
// Der ERSTE Eintrag ist immer die AKTUELLE VERSION!
// ============================================================================
export const CHANGELOG = [
  {
    version: '2.6.0',
    date: '2026-01-28',
    type: 'feature',
    title: 'TDA Verbandsmitgliedschaften',
    highlights: [
      'Dojo-Mitgliedschaft im Verband (99€/Jahr)',
      'Einzelmitgliedschaft im Verband (49€/Jahr)',
      'Automatische Rechnungsstellung & Verlängerung',
      'Vorteile & Rabatte für Mitglieder'
    ],
    details: 'Neuer Tab "Verbandsmitglieder" im Super-Admin Dashboard (TDA Int\'l Org). Dojos und Einzelpersonen können Verbandsmitglied werden und erhalten Rabatte auf Turniere, Seminare und Shop.',
    files: ['VerbandsMitglieder.jsx', 'verbandsmitgliedschaften.js']
  },
  {
    version: '2.5.0',
    date: '2026-01-28',
    type: 'feature',
    title: 'Integrationen & Kalender-Sync',
    highlights: [
      'Kalender-Synchronisation für Google, Outlook, Apple',
      'Webhook-System für Zapier & Automatisierungen',
      'PayPal Integration vorbereitet',
      'LexOffice Buchhaltungs-Anbindung',
      'DATEV Export für Steuerberater'
    ],
    details: 'Neue Integrations-Seite unter Einstellungen. Mitglieder können ihre Trainings direkt in ihren Kalender abonnieren.',
    files: ['KalenderAbo.jsx', 'WebhookVerwaltung.jsx', 'IntegrationsEinstellungen.jsx', 'DatevExport.jsx']
  },
  {
    version: '2.4.0',
    date: '2026-01-27',
    type: 'feature',
    title: 'Badge-System & Auszeichnungen',
    highlights: [
      'Badges für Mitglieder vergeben',
      'Automatische Badge-Vergabe (Anwesenheit, Jubiläum)',
      'Badge-Übersicht im Mitglieder-Profil',
      'Admin-Verwaltung für Badge-Typen'
    ],
    details: 'Motiviere deine Mitglieder mit Auszeichnungen! Unter Prüfungswesen → Auszeichnungen.',
    files: ['BadgeAdminOverview.jsx', 'MitgliedFortschritt.jsx']
  },
  {
    version: '2.3.0',
    date: '2026-01-26',
    type: 'feature',
    title: 'SEPA-Lastschrift System',
    highlights: [
      'SEPA-Mandate verwalten',
      'Lastschriftläufe erstellen',
      'SEPA-XML Export (PAIN.008)',
      'Rücklastschriften-Handling'
    ],
    details: 'Vollständiges SEPA-Lastschrift-Management unter Finanzen → Lastschriftlauf.',
    files: ['SepaMandateVerwaltung.jsx', 'LastschriftManagement.jsx']
  },
  {
    version: '2.2.0',
    date: '2026-01-25',
    type: 'feature',
    title: 'Prüfungswesen & Graduierungen',
    highlights: [
      'Prüfungstermine planen',
      'Live-Prüfungsansicht',
      'Graduierungen verwalten',
      'Prüfungsergebnisse dokumentieren'
    ],
    details: 'Komplettes Prüfungsmanagement unter Prüfungswesen → Prüfungen & Termine.',
    files: ['PruefungsVerwaltung.jsx', 'PruefungDurchfuehren.jsx', 'Stilverwaltung.jsx']
  },
  {
    version: '2.1.0',
    date: '2026-01-20',
    type: 'feature',
    title: 'Buddy-System & Freunde werben',
    highlights: [
      'Buddy-Gruppen erstellen',
      'Einladungslinks generieren',
      'Werber-Tracking',
      'Gruppen-Rabatte'
    ],
    details: 'Mitglieder können Freunde einladen unter Dashboard → Buddy-Gruppen.',
    files: ['BuddyVerwaltung.jsx', 'BuddyInviteRegistration.jsx']
  },
  {
    version: '2.0.0',
    date: '2026-01-15',
    type: 'major',
    title: 'Multi-Dojo & Steuer-Compliance',
    highlights: [
      'Multi-Dojo Unterstützung',
      'Dojo-Switcher im Header',
      'Steuerlich getrennte Buchhaltung',
      'Super-Admin Dashboard'
    ],
    details: 'Verwalte mehrere Dojos mit getrennter Buchhaltung aus einem Account.',
    files: ['DojoSwitcher.jsx', 'SuperAdminDashboard.jsx']
  },
  {
    version: '1.9.0',
    date: '2026-01-10',
    type: 'feature',
    title: 'Vertragsdokumente & AGB',
    highlights: [
      'AGB & Datenschutz verwalten',
      'Versionierung von Dokumenten',
      'Digitale Zustimmung',
      'DSGVO-konform'
    ],
    details: 'Unter Berichte → Vertragsdokumente können alle rechtlichen Dokumente verwaltet werden.',
    files: ['DokumenteVerwaltung.jsx', 'AgbConfirmationWrapper.jsx']
  },
  {
    version: '1.8.0',
    date: '2026-01-05',
    type: 'improvement',
    title: 'Finanzcockpit & Auswertungen',
    highlights: [
      'Finanz-Dashboard mit Grafiken',
      'Umsatz-Statistiken',
      'Zahlungsübersicht',
      'Mahnwesen-Integration'
    ],
    details: 'Umfassende Finanzübersicht unter Finanzen → Finanzcockpit.',
    files: ['Finanzcockpit.jsx', 'Auswertungen.jsx']
  }
];

// ============================================================================
// AKTUELLE VERSION - Wird automatisch aus dem ersten Changelog-Eintrag geholt
// ============================================================================
export const CURRENT_VERSION = CHANGELOG[0].version;
export const CURRENT_BUILD_DATE = CHANGELOG[0].date;

// Icon basierend auf Typ
const getTypeIcon = (type) => {
  switch (type) {
    case 'feature': return <Sparkles size={18} />;
    case 'major': return <Star size={18} />;
    case 'security': return <Shield size={18} />;
    case 'bugfix': return <Bug size={18} />;
    case 'improvement': return <Zap size={18} />;
    default: return <Settings size={18} />;
  }
};

// Farbe basierend auf Typ
const getTypeColor = (type) => {
  switch (type) {
    case 'feature': return '#ffd700';
    case 'major': return '#f59e0b';
    case 'security': return '#ef4444';
    case 'bugfix': return '#10b981';
    case 'improvement': return '#3b82f6';
    default: return '#888';
  }
};

// Label basierend auf Typ
const getTypeLabel = (type) => {
  switch (type) {
    case 'feature': return 'Neue Funktion';
    case 'major': return 'Major Update';
    case 'security': return 'Sicherheit';
    case 'bugfix': return 'Bugfix';
    case 'improvement': return 'Verbesserung';
    default: return 'Update';
  }
};

const SystemChangelog = ({ maxItems = 5, showAll = false }) => {
  const [expandedItems, setExpandedItems] = useState({});
  const [showAllItems, setShowAllItems] = useState(showAll);

  const toggleExpand = (version) => {
    setExpandedItems(prev => ({
      ...prev,
      [version]: !prev[version]
    }));
  };

  const displayedChangelog = showAllItems ? CHANGELOG : CHANGELOG.slice(0, maxItems);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Sparkles size={24} color="#ffd700" />
        <div>
          <h3 style={styles.title}>Neuigkeiten & Updates</h3>
          <p style={styles.subtitle}>Aktuelle Änderungen im System</p>
        </div>
      </div>

      <div style={styles.changelogList}>
        {displayedChangelog.map((entry, index) => (
          <div
            key={entry.version}
            style={{
              ...styles.changelogItem,
              borderLeft: `3px solid ${getTypeColor(entry.type)}`
            }}
          >
            <div style={styles.itemHeader} onClick={() => toggleExpand(entry.version)}>
              <div style={styles.itemMeta}>
                <span style={{
                  ...styles.typeBadge,
                  background: `${getTypeColor(entry.type)}20`,
                  color: getTypeColor(entry.type)
                }}>
                  {getTypeIcon(entry.type)}
                  {getTypeLabel(entry.type)}
                </span>
                <span style={styles.version}>v{entry.version}</span>
                <span style={styles.date}>
                  <Calendar size={12} />
                  {new Date(entry.date).toLocaleDateString('de-DE')}
                </span>
              </div>
              <div style={styles.itemTitleRow}>
                <h4 style={styles.itemTitle}>{entry.title}</h4>
                {expandedItems[entry.version] ?
                  <ChevronUp size={18} color="#888" /> :
                  <ChevronDown size={18} color="#888" />
                }
              </div>
            </div>

            {/* Highlights immer sichtbar */}
            <ul style={styles.highlights}>
              {entry.highlights.map((highlight, i) => (
                <li key={i} style={styles.highlight}>
                  <span style={styles.bulletPoint}>•</span>
                  {highlight}
                </li>
              ))}
            </ul>

            {/* Details nur wenn expandiert */}
            {expandedItems[entry.version] && (
              <div style={styles.expandedContent}>
                {entry.details && (
                  <p style={styles.details}>{entry.details}</p>
                )}
                {entry.files && entry.files.length > 0 && (
                  <div style={styles.filesSection}>
                    <span style={styles.filesLabel}>Betroffene Dateien:</span>
                    <div style={styles.filesList}>
                      {entry.files.map((file, i) => (
                        <code key={i} style={styles.fileTag}>{file}</code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {!showAllItems && CHANGELOG.length > maxItems && (
        <button
          style={styles.showMoreButton}
          onClick={() => setShowAllItems(true)}
        >
          Alle {CHANGELOG.length} Updates anzeigen
          <ChevronDown size={16} />
        </button>
      )}

      {showAllItems && CHANGELOG.length > maxItems && (
        <button
          style={styles.showMoreButton}
          onClick={() => setShowAllItems(false)}
        >
          Weniger anzeigen
          <ChevronUp size={16} />
        </button>
      )}
    </div>
  );
};

const styles = {
  container: {
    background: 'var(--glass-bg, rgba(255, 255, 255, 0.05))',
    borderRadius: '16px',
    padding: '1.5rem',
    border: '1px solid var(--border-accent, rgba(255, 215, 0, 0.2))'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '1.5rem'
  },
  title: {
    color: 'var(--primary, #ffd700)',
    margin: 0,
    fontSize: '1.1rem'
  },
  subtitle: {
    color: 'var(--text-secondary, #888)',
    margin: '4px 0 0 0',
    fontSize: '0.85rem'
  },
  changelogList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  changelogItem: {
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '12px',
    padding: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  itemHeader: {
    marginBottom: '12px'
  },
  itemMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
    flexWrap: 'wrap'
  },
  typeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '600'
  },
  version: {
    color: 'var(--text-secondary, #888)',
    fontSize: '0.8rem',
    fontFamily: 'monospace'
  },
  date: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: 'var(--text-secondary, #888)',
    fontSize: '0.8rem'
  },
  itemTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  itemTitle: {
    color: 'var(--text-primary, #fff)',
    margin: 0,
    fontSize: '1rem',
    fontWeight: '600'
  },
  highlights: {
    margin: 0,
    padding: 0,
    listStyle: 'none'
  },
  highlight: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    color: 'var(--text-secondary, #aaa)',
    fontSize: '0.85rem',
    marginBottom: '4px'
  },
  bulletPoint: {
    color: 'var(--primary, #ffd700)',
    fontWeight: 'bold'
  },
  expandedContent: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)'
  },
  details: {
    color: 'var(--text-secondary, #aaa)',
    fontSize: '0.85rem',
    margin: '0 0 12px 0',
    lineHeight: 1.5
  },
  filesSection: {
    marginTop: '8px'
  },
  filesLabel: {
    color: 'var(--text-secondary, #666)',
    fontSize: '0.75rem',
    display: 'block',
    marginBottom: '6px'
  },
  filesList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px'
  },
  fileTag: {
    background: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.7rem'
  },
  showMoreButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    marginTop: '16px',
    padding: '12px',
    background: 'rgba(255, 215, 0, 0.1)',
    border: '1px solid rgba(255, 215, 0, 0.3)',
    borderRadius: '8px',
    color: 'var(--primary, #ffd700)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: 'all 0.2s'
  }
};

export default SystemChangelog;
