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
  Download, Mail, RefreshCw, TrendingUp,
  CheckCircle, XCircle, FileText, Euro, MapPin,
  ChevronRight, Zap, Award, BarChart3
} from 'lucide-react';
import '../styles/Events.css';
import '../styles/EventsDashboard.css';

const fmt = (n) => parseFloat(n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const fmtDate = (d) => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
const daysUntil = (d) => Math.ceil((new Date(d) - new Date()) / 86400000);

const EventsDashboard = () => {
  const { token } = useAuth();
  const { activeDojo } = useDojoContext();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [topEvents, setTopEvents] = useState([]);
  const [sendingReminder, setSendingReminder] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    if (activeDojo) loadDashboard();
  }, [activeDojo]);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const dojoId = activeDojo?.id;
      // WICHTIG: Kein config.apiBaseUrl-Prefix — Axios hat bereits baseURL: '/api' global gesetzt
      const url = dojoId
        ? `/events/stats/dashboard?dojo_id=${dojoId}`
        : `/events/stats/dashboard`;
      const response = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      if (response.data) {
        setStats(response.data.stats || null);
        setTopEvents(response.data.top_events || []);
      }
    } catch (err) {
      console.error('Fehler beim Laden des Dashboards:', err);
      const raw = err.response?.data?.error || err.message || 'Unbekannter Fehler';
      setError(typeof raw === 'string' ? raw : JSON.stringify(raw));
    } finally {
      setLoading(false);
    }
  };

  const sendReminder = async (eventId) => {
    setSendingReminder(prev => ({ ...prev, [eventId]: true }));
    try {
      const response = await axios.post(
        `/events/${eventId}/send-reminder`, {},
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
      const response = await axios.get(`/events/${eventId}/export/csv`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `teilnehmer_${eventId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch { alert('Fehler beim Export'); }
  };

  const exportPDF = async (eventId) => {
    try {
      const response = await axios.get(`/events/${eventId}/export/pdf`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `teilnehmer_${eventId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch { alert('Fehler beim Export'); }
  };

  if (loading) {
    return (
      <div className="ed-loading-wrap">
        <RefreshCw size={32} className="spin" />
        <p>Lade Dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ed-error-banner">
        <div className="ed-error-title">⚠️ Fehler beim Laden</div>
        <div className="u-text-secondary-sm">{error}</div>
        <button onClick={loadDashboard} className="ed-error-retry-btn">
          Erneut versuchen
        </button>
      </div>
    );
  }

  const kpis = [
    {
      label: 'Aktive Events',
      value: stats?.aktive_events ?? 0,
      icon: Calendar,
      color: 'var(--color-midnight-500)',
      bg: 'rgba(99,102,241,0.12)',
      border: 'rgba(99,102,241,0.25)'
    },
    {
      label: 'Anmeldungen gesamt',
      value: stats?.gesamt_anmeldungen ?? 0,
      icon: Users,
      color: 'var(--success)',
      bg: 'rgba(34,197,94,0.12)',
      border: 'rgba(34,197,94,0.25)'
    },
    {
      label: 'Neue Anmeldungen (7 T.)',
      value: stats?.anmeldungen_woche ?? 0,
      icon: Zap,
      color: 'var(--warning)',
      bg: 'rgba(245,158,11,0.12)',
      border: 'rgba(245,158,11,0.25)'
    },
    {
      label: 'Einnahmen',
      value: fmt(stats?.einnahmen_gesamt),
      icon: Euro,
      color: 'var(--success)',
      bg: 'rgba(16,185,129,0.12)',
      border: 'rgba(16,185,129,0.25)',
      isText: true
    },
    {
      label: 'Offener Betrag',
      value: fmt(stats?.offene_summe),
      icon: AlertTriangle,
      color: 'var(--error)',
      bg: 'rgba(239,68,68,0.12)',
      border: 'rgba(239,68,68,0.25)',
      isText: true,
      sub: `${stats?.offene_zahlungen ?? 0} offene Zahlungen`
    },
    {
      label: 'Warteliste',
      value: stats?.warteliste ?? 0,
      icon: Clock,
      color: '#8b5cf6',
      bg: 'rgba(139,92,246,0.12)',
      border: 'rgba(139,92,246,0.25)'
    },
  ];

  const next = stats?.naechstes_event;
  const nextDays = next ? daysUntil(next.datum) : null;

  return (
    <div className="ed-main-col">

      {/* ── Header ── */}
      <div className="ed-header-row">
        <div>
          <div className="ed-header-title-wrap">
            <BarChart3 size={22} color="#ffd700" />
            <h2 className="ed-h2">
              Event-Dashboard
            </h2>
          </div>
          <p className="ed-subtitle">
            Übersicht · Anmeldungen · Zahlungen
          </p>
        </div>
        <button
          onClick={loadDashboard}
          className="edb-refresh-btn"
        >
          <RefreshCw size={14} /> Aktualisieren
        </button>
      </div>

      {/* ── KPI Grid ── */}
      <div className="edb-kpi-grid">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              className="edb-kpi-card"
              style={{ '--kpi-bg': k.bg, '--kpi-border': k.border, '--kpi-color': k.color }}
            >
              <div className="edb-kpi-icon-box">
                <Icon size={18} color={k.color} />
              </div>
              <div className="ed-min-w-0">
                <div className={`edb-kpi-value${k.isText ? ' edb-kpi-value--text' : ''}`}>
                  {k.value}
                </div>
                <div className="edb-kpi-label">
                  {k.label}
                </div>
                {k.sub && (
                  <div className="edb-kpi-sub">
                    {k.sub}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Nächstes Event Hero ── */}
      {next && (
        <div className="edb-next-event-hero">
          <div className="edb-next-event-counter">
            <div className="ed-stat-big">
              {nextDays}
            </div>
            <div className="ed-stat-label-upper">
              {nextDays === 1 ? 'Tag' : 'Tage'}
            </div>
          </div>
          <div className="u-flex-1-min0">
            <div className="ed-next-label">
              Nächstes Event
            </div>
            <div className="ed-event-name-truncated">
              {next.titel}
            </div>
            <div className="ed-event-muted-meta">
              <span>📅 {fmtDate(next.datum)}{next.uhrzeit_beginn ? ` · ${next.uhrzeit_beginn}` : ''}</span>
              {next.anmeldungen > 0 && (
                <span>👥 {next.anmeldungen}{next.max_teilnehmer ? `/${next.max_teilnehmer}` : ''} Anmeldungen</span>
              )}
            </div>
          </div>
          {next.max_teilnehmer > 0 && (
            <div className="ed-auslastung-col">
              <div className="ed-auslastung-value">
                {Math.round((next.anmeldungen / next.max_teilnehmer) * 100)}%
              </div>
              <div className="ed-auslastung-label">Auslastung</div>
              <div className="ed-capacity-color-bar">
                <div
                  className="ed-capacity-fill"
                  style={{ width: `${Math.min(100, Math.round((next.anmeldungen / next.max_teilnehmer) * 100))}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Events Liste ── */}
      <div>
        <h3 className="ed-section-heading">
          Kommende Events
        </h3>

        <div className="ed-events-col">
          {topEvents.length === 0 ? (
            <div className="ed-empty-state">
              <Calendar size={36} className="edb-empty-icon" />
              <p className="ed-empty-p">Keine aktiven Events</p>
            </div>
          ) : topEvents.map(event => {
            const fillRate = event.max_teilnehmer > 0
              ? Math.min(100, Math.round((event.anmeldungen / event.max_teilnehmer) * 100))
              : null;
            const isFull = fillRate >= 100;
            const days = daysUntil(event.datum);

            return (
              <div key={event.event_id} className="edb-event-card">
                {/* Left: Info */}
                <div className="ed-min-w-0">
                  <div className="ed-event-title-row">
                    <span className="ed-event-title">{event.titel}</span>
                    {isFull && (
                      <span className="ed-badge-overbooked">
                        AUSGEBUCHT
                      </span>
                    )}
                    {event.warteliste > 0 && (
                      <span className="ed-badge-warning">
                        +{event.warteliste} Warteliste
                      </span>
                    )}
                  </div>

                  <div className="ed-event-meta-row">
                    <span>📅 {fmtDate(event.datum)}{event.uhrzeit_beginn ? ` · ${event.uhrzeit_beginn}` : ''}</span>
                    {event.ort && <span><MapPin size={11} className="edb-mappin-inline" />{event.ort}</span>}
                    <span className={days <= 3 ? 'edb-days-text--urgent' : days <= 7 ? 'edb-days-text--warning' : 'edb-days-text--normal'}>
                      in {days} {days === 1 ? 'Tag' : 'Tagen'}
                    </span>
                  </div>

                  {/* Progress + Stats Row */}
                  <div className="ed-event-stats-row">
                    {/* Teilnehmer */}
                    <div className="ed-capacity-bar-wrap">
                      <div className="ed-capacity-label-row">
                        <span>👥 Teilnehmer</span>
                        <span className={`edb-participant-count${isFull ? ' edb-participant-count--full' : ''}`}>
                          {event.anmeldungen}{event.max_teilnehmer ? `/${event.max_teilnehmer}` : ''}
                        </span>
                      </div>
                      {fillRate !== null && (
                        <div className="ed-progress-track">
                          <div
                            className={`edb-fill${fillRate >= 90 ? ' edb-fill--high' : fillRate >= 70 ? ' edb-fill--medium' : ' edb-fill--low'}`}
                            style={{ width: `${fillRate}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Zahlungsstatus */}
                    {event.teilnahmegebuehr > 0 && (
                      <>
                        <div className="ed-info-item">
                          <CheckCircle size={12} color="#22c55e" />
                          <span className="u-text-success">{fmt(event.einnahmen)}</span>
                          <span className="u-text-muted">eingenommen</span>
                        </div>
                        {event.offen_summe > 0 && (
                          <div className="ed-info-item">
                            <XCircle size={12} color="#ef4444" />
                            <span className="u-text-error">{fmt(event.offen_summe)}</span>
                            <span className="u-text-muted">offen</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="ed-action-group">
                  {event.offen_summe > 0 && (
                    <button
                      onClick={() => sendReminder(event.event_id)}
                      disabled={sendingReminder[event.event_id]}
                      title="Zahlungserinnerung senden"
                      className="edb-icon-btn edb-icon-btn--reminder"
                    >
                      {sendingReminder[event.event_id] ? <RefreshCw size={13} className="spin" /> : <Mail size={13} />}
                    </button>
                  )}
                  <button
                    onClick={() => exportCSV(event.event_id)}
                    title="CSV exportieren"
                    className="edb-icon-btn edb-icon-btn--default"
                  >
                    <Download size={13} />
                  </button>
                  <button
                    onClick={() => exportPDF(event.event_id)}
                    title="PDF exportieren"
                    className="edb-icon-btn edb-icon-btn--default"
                  >
                    <FileText size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Legende ── */}
      <div className="edb-legend-container">
        {[
          { icon: <Mail size={13} color="#f59e0b" />, text: 'Zahlungserinnerung per E-Mail' },
          { icon: <Download size={13} color="rgba(255,255,255,0.5)" />, text: 'Teilnehmerliste als CSV' },
          { icon: <FileText size={13} color="rgba(255,255,255,0.5)" />, text: 'Druckbare Liste als PDF' },
        ].map((h, i) => (
          <div key={i} className="ed-legend-row">
            {h.icon} {h.text}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventsDashboard;
