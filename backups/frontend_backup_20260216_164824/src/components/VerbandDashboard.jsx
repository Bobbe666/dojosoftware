// ============================================================================
// VERBAND DASHBOARD - Tiger & Dragon Association International
// ============================================================================
// Separates Dashboard für die Verbandsverwaltung
// - Mitgliedsschulen (Dojos)
// - Verbandsmitglieder (Einzelpersonen)
// - Turniere & Events
// - Verbands-Finanzen

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import config from '../config/config';
import {
  Building2, Users, Trophy, Calendar, Euro, TrendingUp,
  Globe, Award, ChevronRight, Activity, BarChart3,
  CreditCard, FileText, PieChart, RefreshCw, AlertTriangle,
  CheckCircle, Clock, UserPlus, Building, Loader2, ShoppingCart, Target, Ticket,
  Banknote
} from 'lucide-react';
import VerbandsMitglieder from './VerbandsMitglieder';
import ArtikelVerwaltung from './ArtikelVerwaltung';
import ZieleEntwicklung from './ZieleEntwicklung';
import SupportTickets from './SupportTickets';
import AutoLastschriftTab from './AutoLastschriftTab';
import Lastschriftlauf from './Lastschriftlauf';
import Zahllaeufe from './Zahllaeufe';
import '../styles/VerbandDashboard.css';

const VerbandDashboard = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // State für Verbands-Statistiken
  const [stats, setStats] = useState({
    mitgliedsschulen: 0,
    mitgliedsschulenGesamt: 0,
    mitgliedsschulenMitBeitrag: 0,
    mitgliedsschulenVertragsfrei: 0,
    einzelmitglieder: 0,
    aktiveMitgliedschaften: 0,
    pendingMitgliedschaften: 0,
    turniere: 0,
    events: 0,
    jahresbeitraege: 0,
    offeneBeitraege: 0
  });

  // State für Listen
  const [recentMitgliedschaften, setRecentMitgliedschaften] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [beitragsStatus, setBeitragsStatus] = useState([]);

  // Daten laden
  useEffect(() => {
    loadVerbandData();
  }, []);

  const loadVerbandData = async () => {
    setLoading(true);
    setError('');

    try {
      // Lade Verbands-Statistiken
      const [statsRes, mitgliedschaftenRes, eventsRes] = await Promise.all([
        axios.get('/verbandsmitgliedschaften/stats', {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { success: false } })),
        axios.get('/verbandsmitgliedschaften?limit=10', {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { success: false, mitgliedschaften: [] } })),
        axios.get('/events?public=true&limit=5', {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { success: false, events: [] } }))
      ]);

      // Stats verarbeiten
      if (statsRes.data.success) {
        const s = statsRes.data.stats || {};
        setStats({
          mitgliedsschulen: s.dojos || 0,
          mitgliedsschulenGesamt: s.dojosGesamt || 0,
          mitgliedsschulenMitBeitrag: s.dojosMitBeitrag || 0,
          mitgliedsschulenVertragsfrei: s.dojosVertragsfrei || 0,
          einzelmitglieder: s.einzelpersonen || 0,
          aktiveMitgliedschaften: s.aktiv || 0,
          pendingMitgliedschaften: s.pending || 0,
          turniere: s.turniere || 0,
          events: s.events || 0,
          jahresbeitraege: s.jahresbeitraege || 0,
          offeneBeitraege: s.offene_beitraege || 0
        });
      }

      // Mitgliedschaften verarbeiten
      if (mitgliedschaftenRes.data.success) {
        setRecentMitgliedschaften(mitgliedschaftenRes.data.mitgliedschaften || []);
      }

      // Events verarbeiten
      if (eventsRes.data.success) {
        setUpcomingEvents(eventsRes.data.events || []);
      }

    } catch (err) {
      console.error('Fehler beim Laden der Verbandsdaten:', err);
      setError('Fehler beim Laden der Verbandsdaten');
    } finally {
      setLoading(false);
    }
  };

  // Tabs für Navigation
  const tabs = [
    { id: 'overview', label: 'Übersicht', icon: BarChart3 },
    { id: 'mitglieder', label: 'Mitglieder', icon: Users },
    { id: 'shop', label: 'Artikel/Shop', icon: ShoppingCart },
    { id: 'entwicklung', label: 'Entwicklung', icon: Target },
    { id: 'support', label: 'Support', icon: Ticket },
    { id: 'turniere', label: 'Turniere', icon: Trophy },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'finanzen', label: 'Finanzen', icon: Euro },
    { id: 'lastschrift', label: 'Lastschrift', icon: Banknote }
  ];

  // Status-Badge Component
  const StatusBadge = ({ status }) => {
    const statusConfig = {
      aktiv: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.2)', label: 'Aktiv' },
      pending: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)', label: 'Ausstehend' },
      inaktiv: { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.2)', label: 'Inaktiv' },
      gekuendigt: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)', label: 'Gekündigt' }
    };
    const config = statusConfig[status] || statusConfig.pending;

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: config.color,
        background: config.bg
      }}>
        {config.label}
      </span>
    );
  };

  // Overview Tab Content
  const OverviewContent = () => (
    <div className="verband-overview">
      {/* Statistik-Karten */}
      <div className="verband-stats-grid">
        <div className="verband-stat-card primary">
          <div className="stat-icon">
            <Building2 size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.mitgliedsschulenGesamt}</span>
            <span className="stat-label">MITGLIEDSSCHULEN</span>
            <div className="stat-breakdown">
              <span className="breakdown-item">
                <span className="breakdown-value">{stats.mitgliedsschulenMitBeitrag}</span> mit Beitrag
              </span>
              <span className="breakdown-separator">•</span>
              <span className="breakdown-item">
                <span className="breakdown-value">{stats.mitgliedsschulenVertragsfrei}</span> vertragsfrei
              </span>
            </div>
          </div>
          <div className="stat-badge">
            <span className="badge-text">99€/Jahr</span>
          </div>
        </div>

        <div className="verband-stat-card secondary">
          <div className="stat-icon">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.einzelmitglieder}</span>
            <span className="stat-label">Einzelmitglieder</span>
          </div>
          <div className="stat-badge">
            <span className="badge-text">49€/Jahr</span>
          </div>
        </div>

        <div className="verband-stat-card success">
          <div className="stat-icon">
            <CheckCircle size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.aktiveMitgliedschaften}</span>
            <span className="stat-label">Aktive Mitgliedschaften</span>
          </div>
        </div>

        <div className="verband-stat-card warning">
          <div className="stat-icon">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.pendingMitgliedschaften}</span>
            <span className="stat-label">Ausstehend</span>
          </div>
        </div>

        <div className="verband-stat-card gold">
          <div className="stat-icon">
            <Trophy size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.turniere}</span>
            <span className="stat-label">Turniere</span>
          </div>
        </div>

        <div className="verband-stat-card info">
          <div className="stat-icon">
            <Euro size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.jahresbeitraege.toLocaleString('de-DE')}€</span>
            <span className="stat-label">Jahresbeiträge</span>
          </div>
        </div>
      </div>

      {/* Zwei-Spalten Layout */}
      <div className="verband-content-grid">
        {/* Neueste Mitgliedschaften */}
        <div className="verband-panel">
          <div className="panel-header">
            <h3><Users size={18} /> Neueste Mitgliedschaften</h3>
            <button
              className="btn-link"
              onClick={() => setActiveTab('mitglieder')}
            >
              Alle anzeigen <ChevronRight size={14} />
            </button>
          </div>
          <div className="panel-content">
            {recentMitgliedschaften.length > 0 ? (
              <div className="mitgliedschaft-list">
                {recentMitgliedschaften.map(m => (
                  <div key={m.id} className="mitgliedschaft-item">
                    <div className="mitgliedschaft-icon">
                      {m.typ === 'dojo' ? <Building2 size={20} /> : <Users size={20} />}
                    </div>
                    <div className="mitgliedschaft-info">
                      <span className="mitgliedschaft-name">
                        {m.typ === 'dojo' ? m.dojo_name : `${m.person_vorname} ${m.person_nachname}`}
                      </span>
                      <span className="mitgliedschaft-meta">
                        {m.mitgliedsnummer} • seit {m.gueltig_von ? new Date(m.gueltig_von).toLocaleDateString('de-DE') : '-'}
                      </span>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Users size={32} />
                <p>Keine Mitgliedschaften vorhanden</p>
              </div>
            )}
          </div>
        </div>

        {/* Kommende Events */}
        <div className="verband-panel">
          <div className="panel-header">
            <h3><Calendar size={18} /> Kommende Events</h3>
            <button
              className="btn-link"
              onClick={() => setActiveTab('events')}
            >
              Alle anzeigen <ChevronRight size={14} />
            </button>
          </div>
          <div className="panel-content">
            {upcomingEvents.length > 0 ? (
              <div className="event-list">
                {upcomingEvents.map(event => (
                  <div key={event.id} className="event-item">
                    <div className="event-date">
                      <span className="date-day">
                        {new Date(event.datum).getDate()}
                      </span>
                      <span className="date-month">
                        {new Date(event.datum).toLocaleDateString('de-DE', { month: 'short' })}
                      </span>
                    </div>
                    <div className="event-info">
                      <span className="event-title">{event.titel}</span>
                      <span className="event-location">{event.ort || 'Online'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Calendar size={32} />
                <p>Keine kommenden Events</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="verband-quick-actions">
        <h3>Schnellzugriff</h3>
        <div className="quick-action-grid">
          <button
            className="quick-action-btn"
            onClick={() => setActiveTab('mitglieder')}
          >
            <UserPlus size={24} />
            <span>Neues Mitglied</span>
          </button>
          <button
            className="quick-action-btn"
            onClick={() => window.open('https://events.tda-intl.org', '_blank')}
          >
            <Trophy size={24} />
            <span>Turnier erstellen</span>
          </button>
          <button
            className="quick-action-btn"
            onClick={() => setActiveTab('finanzen')}
          >
            <FileText size={24} />
            <span>Beiträge verwalten</span>
          </button>
          <button
            className="quick-action-btn"
            onClick={() => window.open('https://www.tda-intl.com', '_blank')}
          >
            <Globe size={24} />
            <span>Verbandswebsite</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Turniere Tab Content
  const TurniereContent = () => (
    <div className="verband-turniere">
      <div className="info-banner">
        <Trophy size={24} />
        <div>
          <h4>Turnierverwaltung</h4>
          <p>Die Turniere werden über die separate Turniersoftware verwaltet.</p>
          <a
            href="https://events.tda-intl.org"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            Zur Turniersoftware <ChevronRight size={16} />
          </a>
        </div>
      </div>

      {/* Hier könnten Turnier-Statistiken angezeigt werden */}
      <div className="verband-stats-grid" style={{ marginTop: '2rem' }}>
        <div className="verband-stat-card gold">
          <div className="stat-icon"><Trophy size={24} /></div>
          <div className="stat-content">
            <span className="stat-value">{stats.turniere}</span>
            <span className="stat-label">Turniere gesamt</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Events Tab Content
  const EventsContent = () => (
    <div className="verband-events">
      <div className="panel-header">
        <h3><Calendar size={20} /> Verbands-Events</h3>
        <button className="btn-secondary">
          <Activity size={16} /> Event erstellen
        </button>
      </div>

      {upcomingEvents.length > 0 ? (
        <div className="events-list-full">
          {upcomingEvents.map(event => (
            <div key={event.id} className="event-card">
              <div className="event-card-date">
                <span className="date-day">{new Date(event.datum).getDate()}</span>
                <span className="date-month">
                  {new Date(event.datum).toLocaleDateString('de-DE', { month: 'long' })}
                </span>
                <span className="date-year">{new Date(event.datum).getFullYear()}</span>
              </div>
              <div className="event-card-content">
                <h4>{event.titel}</h4>
                <p>{event.beschreibung}</p>
                <div className="event-meta">
                  <span><Calendar size={14} /> {event.ort || 'Online'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state large">
          <Calendar size={48} />
          <h4>Keine Events geplant</h4>
          <p>Erstellen Sie neue Events für den Verband.</p>
        </div>
      )}
    </div>
  );

  // Finanzen Tab Content
  const FinanzenContent = () => (
    <div className="verband-finanzen">
      <div className="verband-stats-grid">
        <div className="verband-stat-card success">
          <div className="stat-icon"><Euro size={24} /></div>
          <div className="stat-content">
            <span className="stat-value">{stats.jahresbeitraege.toLocaleString('de-DE')}€</span>
            <span className="stat-label">Eingegangene Beiträge</span>
          </div>
        </div>
        <div className="verband-stat-card warning">
          <div className="stat-icon"><AlertTriangle size={24} /></div>
          <div className="stat-content">
            <span className="stat-value">{stats.offeneBeitraege.toLocaleString('de-DE')}€</span>
            <span className="stat-label">Offene Beiträge</span>
          </div>
        </div>
        <div className="verband-stat-card info">
          <div className="stat-icon"><CreditCard size={24} /></div>
          <div className="stat-content">
            <span className="stat-value">
              {stats.mitgliedsschulen * 99 + stats.einzelmitglieder * 49}€
            </span>
            <span className="stat-label">Erwartete Jahresbeiträge</span>
          </div>
        </div>
      </div>

      <div className="info-banner" style={{ marginTop: '2rem' }}>
        <PieChart size={24} />
        <div>
          <h4>Beitragsstruktur</h4>
          <p>
            <strong>Mitgliedsschulen (Dojos):</strong> 99€ pro Jahr<br />
            <strong>Einzelmitglieder:</strong> 49€ pro Jahr
          </p>
        </div>
      </div>
    </div>
  );

  // State für Lastschrift Sub-Tab
  const [lastschriftSubTab, setLastschriftSubTab] = useState('automatisch');

  // Lastschrift Tab Content
  const LastschriftContent = () => (
    <div className="verband-lastschrift">
      {/* Sub-Tab Navigation */}
      <div className="sub-tabs-horizontal" style={{ marginBottom: '1.5rem' }}>
        <button
          className={`sub-tab-btn ${lastschriftSubTab === 'lastschriftlauf' ? 'active' : ''}`}
          onClick={() => setLastschriftSubTab('lastschriftlauf')}
        >
          <CreditCard size={18} />
          <span>Neuer Lastschriftlauf</span>
        </button>
        <button
          className={`sub-tab-btn ${lastschriftSubTab === 'zahllaeufe' ? 'active' : ''}`}
          onClick={() => setLastschriftSubTab('zahllaeufe')}
        >
          <FileText size={18} />
          <span>Zahlläufe-Übersicht</span>
        </button>
        <button
          className={`sub-tab-btn ${lastschriftSubTab === 'automatisch' ? 'active' : ''}`}
          onClick={() => setLastschriftSubTab('automatisch')}
        >
          <Calendar size={18} />
          <span>Automatische Einzüge</span>
        </button>
      </div>

      {/* Sub-Tab Content */}
      <div className="sub-tab-content">
        {lastschriftSubTab === 'lastschriftlauf' && (
          <Lastschriftlauf embedded={true} dojoIdOverride={2} />
        )}
        {lastschriftSubTab === 'zahllaeufe' && (
          <Zahllaeufe embedded={true} />
        )}
        {lastschriftSubTab === 'automatisch' && (
          <AutoLastschriftTab embedded={true} dojoIdOverride={2} />
        )}
      </div>
    </div>
  );

  // Loading State
  if (loading) {
    return (
      <div className="verband-dashboard loading">
        <div className="loading-spinner">
          <Loader2 size={40} className="spin" />
          <p>Lade Verbandsdaten...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="verband-dashboard">
      {/* Kompakter Header mit Refresh */}
      <div className="verband-subheader">
        <div className="subheader-left">
          <Globe size={20} className="subheader-icon" />
          <span>Verbandsverwaltung</span>
        </div>
        <button className="btn-refresh-small" onClick={loadVerbandData}>
          <RefreshCw size={14} /> Aktualisieren
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-banner">
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="verband-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`verband-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="verband-tab-content">
        {activeTab === 'overview' && <OverviewContent />}
        {activeTab === 'mitglieder' && <VerbandsMitglieder />}
        {activeTab === 'shop' && <ArtikelVerwaltung />}
        {activeTab === 'entwicklung' && <ZieleEntwicklung bereich="verband" />}
        {activeTab === 'support' && <SupportTickets bereich="verband" />}
        {activeTab === 'turniere' && <TurniereContent />}
        {activeTab === 'events' && <EventsContent />}
        {activeTab === 'finanzen' && <FinanzenContent />}
        {activeTab === 'lastschrift' && <LastschriftContent />}
      </div>
    </div>
  );
};

export default VerbandDashboard;
