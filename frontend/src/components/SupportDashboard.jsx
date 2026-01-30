// ============================================================================
// SUPPORT DASHBOARD - Ticket-System für TDA
// ============================================================================
// Separates Dashboard für die Support-Verwaltung
// - Ticket-Übersicht
// - Statistiken
// - Ticket-Management

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import config from '../config/config';
import {
  Ticket, BarChart3, Settings, Clock, CheckCircle,
  AlertCircle, MessageSquare, Users, TrendingUp,
  Loader2, RefreshCw, Filter, Search, Lightbulb, ThumbsUp
} from 'lucide-react';
import SupportTickets from './SupportTickets';
import FeatureBoard from './FeatureBoard';
import '../styles/SupportDashboard.css';

const SupportDashboard = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('tickets');

  // State für Support-Statistiken
  const [stats, setStats] = useState({
    gesamt: 0,
    offen: 0,
    in_bearbeitung: 0,
    warten_auf_antwort: 0,
    erledigt: 0,
    geschlossen: 0,
    heute_erstellt: 0,
    durchschnittliche_bearbeitungszeit: 0
  });

  // State für Feature-Request Statistiken
  const [featureStats, setFeatureStats] = useState({
    gesamt: 0,
    neu: 0,
    geprueft: 0,
    geplant: 0,
    in_arbeit: 0,
    umgesetzt: 0,
    abgelehnt: 0
  });

  // Prüfe ob User Super-Admin ist
  const isSuperAdmin = (user?.rolle === 'admin' || user?.role === 'admin') && user?.dojo_id === null;

  // Tabs für Support-Dashboard
  const tabs = [
    { id: 'tickets', label: 'Tickets', icon: Ticket },
    { id: 'wunschliste', label: 'Wunschliste', icon: Lightbulb },
    { id: 'statistiken', label: 'Statistiken', icon: BarChart3 }
  ];

  // Statistiken laden
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setError('');

    try {
      // Lade Support-Tickets und Feature-Requests Statistiken parallel
      const [ticketResponse, featureResponse] = await Promise.all([
        axios.get(`${config.apiBaseUrl}/support-tickets/statistiken`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${config.apiBaseUrl}/feature-requests`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (ticketResponse.data.success) {
        setStats(ticketResponse.data.statistiken || {});
      }

      if (featureResponse.data.success) {
        setFeatureStats(featureResponse.data.stats || {});
      }
    } catch (err) {
      console.error('Fehler beim Laden der Statistiken:', err);
      setError('Fehler beim Laden der Statistiken');
    } finally {
      setLoading(false);
    }
  };

  // Statistik-Karten für Übersicht
  const StatCard = ({ icon: Icon, label, value, color, trend }) => (
    <div className="support-stat-card" style={{ borderLeftColor: color }}>
      <div className="stat-icon" style={{ backgroundColor: `${color}20` }}>
        <Icon size={24} color={color} />
      </div>
      <div className="stat-content">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {trend && (
          <div className={`stat-trend ${trend > 0 ? 'up' : 'down'}`}>
            <TrendingUp size={12} />
            {Math.abs(trend)}% vs. letzte Woche
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="support-dashboard">
      {/* Header */}
      <div className="support-header">
        <div className="support-header-info">
          <h1>
            <Ticket size={28} />
            Support Center
          </h1>
          <p>Verwalten Sie Support-Tickets aus allen Bereichen</p>
        </div>

        <div className="support-header-actions">
          <button
            onClick={loadStats}
            className="btn-refresh"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Statistik-Übersicht */}
      <div className="support-stats-grid">
        <StatCard
          icon={Ticket}
          label="Gesamt"
          value={stats.gesamt || 0}
          color="#6366f1"
        />
        <StatCard
          icon={AlertCircle}
          label="Offen"
          value={stats.offen || 0}
          color="#f59e0b"
        />
        <StatCard
          icon={Clock}
          label="In Bearbeitung"
          value={stats.in_bearbeitung || 0}
          color="#3b82f6"
        />
        <StatCard
          icon={MessageSquare}
          label="Warten auf Antwort"
          value={stats.warten_auf_antwort || 0}
          color="#8b5cf6"
        />
        <StatCard
          icon={CheckCircle}
          label="Erledigt"
          value={stats.erledigt || 0}
          color="#10b981"
        />
      </div>

      {/* Tab Navigation */}
      <div className="support-tabs">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`support-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="support-content">
        {/* Tickets Tab */}
        {activeTab === 'tickets' && (
          <SupportTickets
            bereich="support"
            showAllBereiche={isSuperAdmin}
            compact={false}
          />
        )}

        {/* Wunschliste Tab */}
        {activeTab === 'wunschliste' && (
          <FeatureBoard adminMode={true} />
        )}

        {/* Statistiken Tab */}
        {activeTab === 'statistiken' && (
          <div className="support-statistiken">
            <div className="statistiken-two-columns">
              {/* LINKE SPALTE: Support-Tickets */}
              <div className="statistiken-column tickets-column">
                <div className="column-header">
                  <Ticket size={24} />
                  <h2>Support-Tickets</h2>
                </div>

                {/* Ticket Zahlen */}
                <div className="stats-numbers-row">
                  <div className="stat-number-box">
                    <span className="stat-big-number">{stats.gesamt || 0}</span>
                    <span className="stat-number-label">Gesamt</span>
                  </div>
                  <div className="stat-number-box orange">
                    <span className="stat-big-number">{stats.offen || 0}</span>
                    <span className="stat-number-label">Offen</span>
                  </div>
                  <div className="stat-number-box blue">
                    <span className="stat-big-number">{stats.in_bearbeitung || 0}</span>
                    <span className="stat-number-label">In Bearbeitung</span>
                  </div>
                  <div className="stat-number-box green">
                    <span className="stat-big-number">{stats.erledigt || 0}</span>
                    <span className="stat-number-label">Erledigt</span>
                  </div>
                </div>

                {/* Tickets nach Kategorie */}
                <div className="statistik-card">
                  <h3>Nach Kategorie</h3>
                  <div className="kategorie-bars">
                    {[
                      { name: 'Vertrag', count: stats.kategorie_vertrag || 0, color: '#3b82f6' },
                      { name: 'Hilfe', count: stats.kategorie_hilfe || 0, color: '#10b981' },
                      { name: 'Problem', count: stats.kategorie_problem || 0, color: '#f59e0b' },
                      { name: 'Sonstiges', count: stats.kategorie_sonstiges || 0, color: '#6b7280' }
                    ].map(kat => {
                      const total = (stats.kategorie_vertrag || 0) + (stats.kategorie_hilfe || 0) +
                                    (stats.kategorie_problem || 0) + (stats.kategorie_sonstiges || 0);
                      const percent = total > 0 ? (kat.count / total) * 100 : 0;
                      return (
                        <div key={kat.name} className="kategorie-item">
                          <div className="kategorie-label">
                            <span>{kat.name}</span>
                            <span>{kat.count}</span>
                          </div>
                          <div className="kategorie-bar">
                            <div className="kategorie-fill" style={{ width: `${percent}%`, backgroundColor: kat.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Tickets nach Bereich */}
                <div className="statistik-card">
                  <h3>Nach Bereich</h3>
                  <div className="bereich-stats">
                    <div className="bereich-item dojo">
                      <div className="bereich-icon">🥋</div>
                      <div className="bereich-info">
                        <span className="bereich-name">Dojo</span>
                        <span className="bereich-count">{stats.bereich_dojo || 0}</span>
                      </div>
                    </div>
                    <div className="bereich-item verband">
                      <div className="bereich-icon">🌐</div>
                      <div className="bereich-info">
                        <span className="bereich-name">Verband</span>
                        <span className="bereich-count">{stats.bereich_verband || 0}</span>
                      </div>
                    </div>
                    <div className="bereich-item org">
                      <div className="bereich-icon">🏆</div>
                      <div className="bereich-info">
                        <span className="bereich-name">Org</span>
                        <span className="bereich-count">{stats.bereich_org || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance */}
                <div className="statistik-card">
                  <h3>Performance</h3>
                  <div className="performance-stats">
                    <div className="performance-item">
                      <Clock size={20} />
                      <div>
                        <span className="performance-value">{stats.durchschnittliche_bearbeitungszeit || '-'} Std</span>
                        <span className="performance-label">Ø Bearbeitungszeit</span>
                      </div>
                    </div>
                    <div className="performance-item">
                      <Ticket size={20} />
                      <div>
                        <span className="performance-value">{stats.heute_erstellt || 0}</span>
                        <span className="performance-label">Heute erstellt</span>
                      </div>
                    </div>
                    <div className="performance-item">
                      <CheckCircle size={20} />
                      <div>
                        <span className="performance-value">{stats.heute_geschlossen || 0}</span>
                        <span className="performance-label">Heute geschlossen</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RECHTE SPALTE: Feature-Wünsche */}
              <div className="statistiken-column features-column">
                <div className="column-header features">
                  <Lightbulb size={24} />
                  <h2>Feature-Wünsche</h2>
                </div>

                {/* Feature Zahlen */}
                <div className="stats-numbers-row">
                  <div className="stat-number-box">
                    <span className="stat-big-number">{featureStats.gesamt || 0}</span>
                    <span className="stat-number-label">Gesamt</span>
                  </div>
                  <div className="stat-number-box orange">
                    <span className="stat-big-number">{featureStats.neu || 0}</span>
                    <span className="stat-number-label">Neu</span>
                  </div>
                  <div className="stat-number-box purple">
                    <span className="stat-big-number">{featureStats.geplant || 0}</span>
                    <span className="stat-number-label">Geplant</span>
                  </div>
                  <div className="stat-number-box green">
                    <span className="stat-big-number">{featureStats.umgesetzt || 0}</span>
                    <span className="stat-number-label">Umgesetzt</span>
                  </div>
                </div>

                {/* Feature nach Status */}
                <div className="statistik-card">
                  <h3>Nach Status</h3>
                  <div className="kategorie-bars">
                    {[
                      { name: 'Neu', count: featureStats.neu || 0, color: '#f59e0b' },
                      { name: 'Geprüft', count: featureStats.geprueft || 0, color: '#3b82f6' },
                      { name: 'Geplant', count: featureStats.geplant || 0, color: '#8b5cf6' },
                      { name: 'In Arbeit', count: featureStats.in_arbeit || 0, color: '#ec4899' },
                      { name: 'Umgesetzt', count: featureStats.umgesetzt || 0, color: '#10b981' },
                      { name: 'Abgelehnt', count: featureStats.abgelehnt || 0, color: '#6b7280' }
                    ].map(status => {
                      const total = featureStats.gesamt || 1;
                      const percent = total > 0 ? (status.count / total) * 100 : 0;
                      return (
                        <div key={status.name} className="kategorie-item">
                          <div className="kategorie-label">
                            <span>{status.name}</span>
                            <span>{status.count}</span>
                          </div>
                          <div className="kategorie-bar">
                            <div className="kategorie-fill" style={{ width: `${percent}%`, backgroundColor: status.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top Votes Info */}
                <div className="statistik-card">
                  <h3>Voting-Info</h3>
                  <div className="voting-info">
                    <div className="voting-stat">
                      <ThumbsUp size={20} />
                      <div>
                        <span className="voting-value">
                          {featureStats.gesamt > 0 ? Math.round(((featureStats.geplant || 0) + (featureStats.in_arbeit || 0) + (featureStats.umgesetzt || 0)) / featureStats.gesamt * 100) : 0}%
                        </span>
                        <span className="voting-label">Umsetzungsrate</span>
                      </div>
                    </div>
                    <div className="voting-stat">
                      <Clock size={20} />
                      <div>
                        <span className="voting-value">{featureStats.in_arbeit || 0}</span>
                        <span className="voting-label">Aktuell in Arbeit</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportDashboard;
