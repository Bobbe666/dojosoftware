// ============================================================================
// EVENTS DASHBOARD - Admin-Übersicht für Event-Statistiken und Zahlungen
// ============================================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useDojoContext } from '../context/DojoContext';
import config from '../config/config';
import {
  Calendar, Users, CreditCard, Clock, AlertTriangle,
  Download, Mail, RefreshCw, ChevronRight, TrendingUp,
  CheckCircle, XCircle, FileText
} from 'lucide-react';
import '../styles/Events.css';

const EventsDashboard = () => {
  const { token } = useAuth();
  const { activeDojo } = useDojoContext();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [topEvents, setTopEvents] = useState([]);
  const [sendingReminder, setSendingReminder] = useState({});

  useEffect(() => {
    if (activeDojo?.id) {
      loadDashboard();
    }
  }, [activeDojo?.id]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${config.apiBaseUrl}/events/stats/dashboard?dojo_id=${activeDojo?.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setStats(response.data.stats);
        setTopEvents(response.data.top_events || []);
      }
    } catch (err) {
      console.error('Fehler beim Laden des Dashboards:', err);
    } finally {
      setLoading(false);
    }
  };

  const sendReminder = async (eventId) => {
    setSendingReminder(prev => ({ ...prev, [eventId]: true }));
    try {
      const response = await axios.post(
        `${config.apiBaseUrl}/events/${eventId}/send-reminder`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(response.data.message || 'Erinnerungen gesendet');
    } catch (err) {
      alert('Fehler beim Senden: ' + (err.response?.data?.error || err.message));
    } finally {
      setSendingReminder(prev => ({ ...prev, [eventId]: false }));
    }
  };

  const exportCSV = async (eventId) => {
    try {
      const response = await axios.get(
        `${config.apiBaseUrl}/events/${eventId}/export/csv`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `teilnehmer_${eventId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export-Fehler:', err);
      alert('Fehler beim Export');
    }
  };

  const exportPDF = async (eventId) => {
    try {
      const response = await axios.get(
        `${config.apiBaseUrl}/events/${eventId}/export/pdf`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `teilnehmer_${eventId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export-Fehler:', err);
      alert('Fehler beim Export');
    }
  };

  if (loading) {
    return (
      <div className="events-container">
        <div className="events-loading">
          <RefreshCw size={32} className="spin" />
          <p>Lade Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="events-container">
      {/* Header */}
      <div className="events-header">
        <div>
          <h1>
            <TrendingUp size={28} />
            Event-Dashboard
          </h1>
          <p>Übersicht über Events, Anmeldungen und Zahlungen</p>
        </div>
        <button onClick={loadDashboard} className="btn-refresh">
          <RefreshCw size={16} />
          Aktualisieren
        </button>
      </div>

      {/* KPI Cards */}
      <div className="events-stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#6366f1' }}>
            <Calendar size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats?.aktive_events || 0}</span>
            <span className="stat-label">Aktive Events</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>
            <CreditCard size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats?.offene_zahlungen || 0}</span>
            <span className="stat-label">Offene Zahlungen</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
            <AlertTriangle size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">
              {(stats?.offene_summe || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </span>
            <span className="stat-label">Offener Betrag</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' }}>
            <Users size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats?.anmeldungen_woche || 0}</span>
            <span className="stat-label">Anmeldungen (7 Tage)</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#8b5cf6' }}>
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats?.warteliste || 0}</span>
            <span className="stat-label">Auf Warteliste</span>
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="events-section">
        <h2>Kommende Events mit Anmeldungen</h2>

        <div className="events-table-container">
          <table className="events-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Datum</th>
                <th>Teilnehmer</th>
                <th>Bezahlt</th>
                <th>Offen</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {topEvents.length === 0 ? (
                <tr>
                  <td colSpan="6" className="no-data">
                    Keine aktiven Events
                  </td>
                </tr>
              ) : (
                topEvents.map(event => (
                  <tr key={event.event_id}>
                    <td>
                      <strong>{event.titel}</strong>
                      {event.teilnahmegebuehr > 0 && (
                        <span className="fee-badge">
                          {parseFloat(event.teilnahmegebuehr).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </span>
                      )}
                    </td>
                    <td>{new Date(event.datum).toLocaleDateString('de-DE')}</td>
                    <td>
                      <span className="count-badge">
                        {event.anmeldungen}
                        {event.max_teilnehmer && ` / ${event.max_teilnehmer}`}
                      </span>
                    </td>
                    <td>
                      <span className="status-badge success">
                        <CheckCircle size={12} />
                        {event.bezahlt || 0}
                      </span>
                    </td>
                    <td>
                      {event.offen_summe > 0 ? (
                        <span className="status-badge warning">
                          <XCircle size={12} />
                          {parseFloat(event.offen_summe).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </span>
                      ) : (
                        <span className="status-badge success">-</span>
                      )}
                    </td>
                    <td className="actions-cell">
                      {event.offen_summe > 0 && (
                        <button
                          onClick={() => sendReminder(event.event_id)}
                          disabled={sendingReminder[event.event_id]}
                          className="btn-action"
                          title="Zahlungserinnerung senden"
                        >
                          {sendingReminder[event.event_id] ? (
                            <RefreshCw size={14} className="spin" />
                          ) : (
                            <Mail size={14} />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => exportCSV(event.event_id)}
                        className="btn-action"
                        title="CSV exportieren"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => exportPDF(event.event_id)}
                        className="btn-action"
                        title="PDF exportieren"
                      >
                        <FileText size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Info */}
      <div className="events-info-box">
        <h3>Hinweise</h3>
        <ul>
          <li><strong>Zahlungserinnerungen:</strong> Sendet eine Email an alle Teilnehmer mit offenen Zahlungen.</li>
          <li><strong>CSV Export:</strong> Exportiert die Teilnehmerliste mit allen Details.</li>
          <li><strong>PDF Export:</strong> Erstellt eine druckbare Liste mit Unterschriftenfeldern.</li>
          <li><strong>Warteliste:</strong> Wenn ein Teilnehmer absagt, rückt automatisch der nächste von der Warteliste nach.</li>
        </ul>
      </div>
    </div>
  );
};

export default EventsDashboard;
