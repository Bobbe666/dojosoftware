// =============================================
// SUPER-ADMIN DASHBOARD - Tiger & Dragon Association International
// =============================================
// Nur sichtbar wenn Dojo-ID = 2 (TDA International) ausgewählt

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config';
import {
  Building2, Users, TrendingUp, Globe, Plus, Edit, Trash2,
  CheckCircle, XCircle, BarChart3, Activity, Award, Calendar, HardDrive, Clock, AlertTriangle,
  ChevronDown, ChevronUp, LayoutDashboard, PieChart, DollarSign, FileText, UserCog, CreditCard, Save, ToggleLeft, ToggleRight, Euro, Ticket,
  Bell, Send, Archive, Eye, EyeOff, RefreshCw, UserPlus, Home, MessageCircle, MessageSquare, Search
} from 'lucide-react';
import StatisticsTab from './StatisticsTab';
import ContractsTab from './ContractsTab';
import UsersTab from './UsersTab';
import FinanzenTab from './FinanzenTab';
import BuchhaltungTab from './BuchhaltungTab';
import ZieleEntwicklung from './ZieleEntwicklung';
import SupportTickets from './SupportTickets';
import VerbandsMitglieder from './VerbandsMitglieder';
import ArtikelVerwaltung from './ArtikelVerwaltung';
import AutoLastschriftTab from './AutoLastschriftTab';
import Lastschriftlauf from './Lastschriftlauf';
import Zahllaeufe from './Zahllaeufe';
import PasswortVerwaltung from './PasswortVerwaltung';
import DojoLizenzverwaltung from './DojoLizenzverwaltung';
import AdminChatPage from './chat/AdminChatPage';
import BesucherChat from './chat/BesucherChat';
import SecurityDashboard from './SecurityDashboard';
import DokumentenZentrale from './DokumentenZentrale';
import Auswertungen from './Auswertungen';
import PlattformZentrale from './PlattformZentrale';
import PlattformZugangsdaten from './PlattformZugangsdaten';
import '../styles/SuperAdminDashboard.css';

// ── EventSoftware-Sektion ──────────────────────────────────────────────────
function EventSoftwareSection({ token }) {
  const [subTab, setSubTab] = useState('uebersicht');
  const [turniere, setTurniere] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suchbegriff, setSuchbegriff] = useState('');

  useEffect(() => {
    if (!token) return;
    axios.get('/plattform-zentrale/turniere', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setTurniere(r.data.turniere || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const heute = new Date();
  heute.setHours(0, 0, 0, 0);

  const upcoming = turniere
    .filter(t => new Date(t.start_datum || t.datum) >= heute)
    .sort((a, b) => new Date(a.start_datum || a.datum) - new Date(b.start_datum || b.datum));
  const vergangen = turniere
    .filter(t => new Date(t.start_datum || t.datum) < heute)
    .sort((a, b) => new Date(b.start_datum || b.datum) - new Date(a.start_datum || a.datum));
  const mitOffenemAnmeldung = turniere.filter(t => t.anmeldeschluss && new Date(t.anmeldeschluss) >= heute);
  const naechstes = upcoming[0];

  const gefiltert = [...upcoming, ...vergangen].filter(t =>
    !suchbegriff || t.name?.toLowerCase().includes(suchbegriff.toLowerCase()) || t.ort?.toLowerCase().includes(suchbegriff.toLowerCase())
  );

  const SCHNELLZUGRIFF = [
    { icon: '🏠', label: 'Dashboard',    url: 'https://events.tda-intl.org/dashboard' },
    { icon: '🥊', label: 'Turniere',     url: 'https://events.tda-intl.org/dashboard' },
    { icon: '🎓', label: 'Lehrgänge',    url: 'https://events.tda-intl.org/dashboard' },
    { icon: '📊', label: 'Ranglisten',   url: 'https://events.tda-intl.org/dashboard' },
    { icon: '⚖️', label: 'Einwaage',     url: 'https://events.tda-intl.org/dashboard' },
    { icon: '👥', label: 'Teilnehmer',   url: 'https://events.tda-intl.org/dashboard' },
    { icon: '📈', label: 'Statistiken',  url: 'https://events.tda-intl.org/dashboard' },
    { icon: '🏆', label: 'Ergebnisse',   url: 'https://events.tda-intl.org/dashboard' },
  ];

  return (
    <div>
      {/* Header + Links */}
      <div className="sad-hof-header">
        <h2 className="sad-hof-title">🗓️ EventSoftware — events.tda-intl.org</h2>
        <div className="sad-hof-btn-row">
          <a href="https://events.tda-intl.org/login" target="_blank" rel="noreferrer" className="sad-hof-admin-link">
            🔐 Admin Login
          </a>
          <a href="https://events.tda-intl.org" target="_blank" rel="noreferrer" className="sad-hof-public-link">
            ↗ Öffentlich
          </a>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="sub-tabs-horizontal sad2-mb-15">
        {[
          { id: 'uebersicht', icon: '📊', label: 'Übersicht' },
          { id: 'turniere',   icon: '🥊', label: 'Turniere & Events' },
          { id: 'vorschau',   icon: '🌐', label: 'Live-Vorschau' },
        ].map(t => (
          <button key={t.id} className={`sub-tab-btn ${subTab === t.id ? 'active' : ''}`} onClick={() => setSubTab(t.id)}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Übersicht ─────────────────────────────────────────────── */}
      {subTab === 'uebersicht' && (
        <div>
          {/* KPI-Karten */}
          <div className="sad-sw-kpi-grid">
            {[
              { label: 'Events gesamt',       val: loading ? '…' : turniere.length,           color: '#6366f1', icon: '🗓️' },
              { label: 'Bevorstehend',         val: loading ? '…' : upcoming.length,           color: '#22c55e', icon: '⏳' },
              { label: 'Anmeldung offen',      val: loading ? '…' : mitOffenemAnmeldung.length, color: '#f59e0b', icon: '📋' },
              { label: 'Abgeschlossen',        val: loading ? '…' : vergangen.length,           color: '#64748b', icon: '✅' },
            ].map(k => (
              <div key={k.label} className="sad-sw-kpi-card" style={{ borderLeftColor: k.color }}>
                <div className="sad-sw-kpi-icon">{k.icon}</div>
                <div>
                  <div className="sad-sw-kpi-val" style={{ color: k.color }}>{k.val}</div>
                  <div className="sad-sw-kpi-label">{k.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="sad-sw-cols">
            {/* Nächste Events */}
            <div className="sad-sw-panel">
              <div className="sad-sw-panel-header">
                <span>⏳ Nächste Events</span>
                <button className="sad-sw-panel-btn" onClick={() => setSubTab('turniere')}>Alle ansehen →</button>
              </div>
              {loading ? (
                <div className="sad-sw-loading">Lade Events…</div>
              ) : upcoming.length === 0 ? (
                <div className="sad-sw-empty">Keine bevorstehenden Events</div>
              ) : (
                upcoming.slice(0, 7).map(t => {
                  const d = new Date(t.start_datum || t.datum);
                  const isOpen = t.anmeldeschluss && new Date(t.anmeldeschluss) >= heute;
                  return (
                    <div key={t.turnier_id || t.id} className="sad-sw-event-row">
                      <div className="sad-sw-event-date">
                        <span className="sad-sw-ev-day">{d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>
                        <span className="sad-sw-ev-year">{d.getFullYear()}</span>
                      </div>
                      <div className="sad-sw-event-info">
                        <div className="sad-sw-event-name">{t.name}</div>
                        {t.ort && <div className="sad-sw-event-ort">📍 {t.ort}</div>}
                      </div>
                      {isOpen && <span className="sad-sw-badge sad-sw-badge--open">Offen</span>}
                    </div>
                  );
                })
              )}
            </div>

            {/* Schnellzugriff + Nächstes Highlight */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="sad-sw-panel">
                <div className="sad-sw-panel-header"><span>⚡ Schnellzugriff</span></div>
                <div className="sad-sw-links-grid">
                  {SCHNELLZUGRIFF.map(link => (
                    <a key={link.label} href={link.url} target="_blank" rel="noreferrer" className="sad-sw-link">
                      <span>{link.icon}</span> {link.label}
                    </a>
                  ))}
                </div>
              </div>

              {naechstes && (
                <div className="sad-sw-highlight">
                  <div className="sad-sw-highlight-label">Nächstes Event</div>
                  <div className="sad-sw-highlight-name">{naechstes.name}</div>
                  <div className="sad-sw-highlight-date">
                    {new Date(naechstes.start_datum || naechstes.datum).toLocaleDateString('de-DE', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </div>
                  {naechstes.ort && <div className="sad-sw-highlight-ort">📍 {naechstes.ort}</div>}
                  {naechstes.anmeldeschluss && (
                    <div className="sad-sw-highlight-meta">
                      Anmeldeschluss: {new Date(naechstes.anmeldeschluss).toLocaleDateString('de-DE')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Turniere & Events ──────────────────────────────────────── */}
      {subTab === 'turniere' && (
        <div>
          <div className="sad-sw-turniere-header">
            <input
              className="sad-sw-search"
              placeholder="Suche nach Name oder Ort…"
              value={suchbegriff}
              onChange={e => setSuchbegriff(e.target.value)}
            />
            <a href="https://events.tda-intl.org/dashboard" target="_blank" rel="noreferrer" className="sad-hof-admin-link">
              + Neu auf events.tda-intl.org
            </a>
          </div>

          {loading ? (
            <div className="sad-sw-loading">Lade Turniere…</div>
          ) : gefiltert.length === 0 ? (
            <div className="sad2-empty-center">
              <span className="sad2-big-icon">🗓️</span>
              <p className="sad2-text-secondary-maxw">Keine Events gefunden.</p>
            </div>
          ) : (
            <div className="sad-sw-turniere-list">
              {gefiltert.map(t => {
                const d = new Date(t.start_datum || t.datum);
                const isPast = d < heute;
                const isOpen = !isPast && t.anmeldeschluss && new Date(t.anmeldeschluss) >= heute;
                const isClosed = !isPast && t.anmeldeschluss && new Date(t.anmeldeschluss) < heute;
                return (
                  <div key={t.turnier_id || t.id} className={`sad-sw-turnier-card ${isPast ? 'sad-sw-tc--past' : ''}`}>
                    <div className="sad-sw-tc-datum">
                      <div className="sad-sw-tc-day">{d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</div>
                      <div className="sad-sw-tc-year">{d.getFullYear()}</div>
                    </div>
                    <div className="sad-sw-tc-body">
                      <div className="sad-sw-tc-name">{t.name}</div>
                      <div className="sad-sw-tc-meta">
                        {t.ort && <span>📍 {t.ort}</span>}
                        {t.datum_ende && t.datum_ende !== t.start_datum && (
                          <span>bis {new Date(t.datum_ende).toLocaleDateString('de-DE')}</span>
                        )}
                        {t.max_teilnehmer > 0 && <span>👥 max. {t.max_teilnehmer} TN</span>}
                        {t.anmeldegebuehr > 0 && <span>💶 {t.anmeldegebuehr} €</span>}
                        {t.anmeldeschluss && (
                          <span>Anmeldeschluss: {new Date(t.anmeldeschluss).toLocaleDateString('de-DE')}</span>
                        )}
                      </div>
                    </div>
                    <div className="sad-sw-tc-right">
                      {isPast  && <span className="sad-sw-badge sad-sw-badge--past">Abgeschlossen</span>}
                      {isOpen  && <span className="sad-sw-badge sad-sw-badge--open">Anmeldung offen</span>}
                      {isClosed && <span className="sad-sw-badge sad-sw-badge--closed">Anmeldung geschlossen</span>}
                      {!isPast && !t.anmeldeschluss && <span className="sad-sw-badge sad-sw-badge--upcoming">Bevorstehend</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Live-Vorschau ─────────────────────────────────────────── */}
      {subTab === 'vorschau' && (
        <div className="sad-hof-preview-wrapper">
          <div className="sad-hof-preview-bar">
            <span className="sad-hof-live-dot" />
            Live-Vorschau — events.tda-intl.org
          </div>
          <iframe
            src="https://events.tda-intl.org"
            title="EventSoftware"
            className="sad-hof-iframe"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}

// ── Academy-Sektion ───────────────────────────────────────────────────────
function AcademySection() {
  const [subTab, setSubTab] = useState('uebersicht');
  const [stats, setStats] = useState(null);
  const [kurse, setKurse] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('https://academy.tda-intl.org/api/admin/public-stats').then(r => r.json()).catch(() => null),
      fetch('https://academy.tda-intl.org/api/kurse').then(r => r.json()).catch(() => null),
    ]).then(([s, k]) => {
      if (s?.success) setStats(s.stats);
      if (k?.success) {
        const heute = new Date(); heute.setHours(0, 0, 0, 0);
        const upcoming = (k.kurse || [])
          .filter(c => new Date(c.start_datum) >= heute)
          .sort((a, b) => new Date(a.start_datum) - new Date(b.start_datum))
          .slice(0, 5);
        setKurse(upcoming);
      }
    }).finally(() => setLoading(false));
  }, []);

  const SCHNELLZUGRIFF = [
    { icon: '🏠', label: 'Dashboard',    url: 'https://academy.tda-intl.org/admin' },
    { icon: '📚', label: 'Kurse',        url: 'https://academy.tda-intl.org/admin' },
    { icon: '📋', label: 'Buchungen',    url: 'https://academy.tda-intl.org/admin' },
    { icon: '👥', label: 'Teilnehmer',   url: 'https://academy.tda-intl.org/admin' },
    { icon: '🎓', label: 'Zertifikate',  url: 'https://academy.tda-intl.org/admin' },
    { icon: '↗',  label: 'Zur Academy',  url: 'https://academy.tda-intl.org' },
  ];

  return (
    <div>
      <div className="sad-hof-header">
        <h2 className="sad-hof-title">🎓 TDA Academy — academy.tda-intl.org</h2>
        <div className="sad-hof-btn-row">
          <a href="https://academy.tda-intl.org/admin" target="_blank" rel="noreferrer" className="sad-hof-admin-link">
            🔐 Academy Admin
          </a>
          <a href="https://academy.tda-intl.org" target="_blank" rel="noreferrer" className="sad-hof-public-link">
            ↗ academy.tda-intl.org
          </a>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="sad-sw-tabs">
        {[
          { id: 'uebersicht', label: '📊 Übersicht' },
          { id: 'kurse',      label: '📚 Bevorstehende Kurse' },
          { id: 'vorschau',   label: '👁 Vorschau' },
        ].map(t => (
          <button key={t.id} className={`sad-sw-tab${subTab === t.id ? ' active' : ''}`} onClick={() => setSubTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'uebersicht' && (
        <div>
          {loading ? <div className="sad-hof-loading">Lade…</div> : stats && (
            <div className="sad-sw-stats-grid">
              {[
                { label: 'Kurse aktiv',        val: stats.kurse_aktiv },
                { label: 'Bevorstehend',        val: stats.kurse_upcoming },
                { label: 'Buchungen gesamt',    val: stats.buchungen_gesamt },
                { label: 'Buchungen offen',     val: stats.buchungen_offen },
                { label: 'Teilnehmer',          val: stats.teilnehmer_gesamt },
                { label: 'Zertifikate',         val: stats.zertifikate },
                { label: 'Umsatz gesamt',       val: `${parseFloat(stats.umsatz_gesamt || 0).toFixed(2)} €` },
              ].map(s => (
                <div key={s.label} className="sad-sw-stat-box">
                  <div className="sad-sw-stat-val">{s.val}</div>
                  <div className="sad-sw-stat-lbl">{s.label}</div>
                </div>
              ))}
            </div>
          )}
          <div className="sad-hof-nav-grid" style={{ marginTop: '1.5rem' }}>
            {SCHNELLZUGRIFF.map(item => (
              <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="sad-hof-nav-link">
                <span className="sad2-fs-12">{item.icon}</span>
                {item.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {subTab === 'kurse' && (
        <div>
          {loading ? <div className="sad-hof-loading">Lade…</div> : kurse.length === 0 ? (
            <div className="sad2-empty-center"><p className="sad2-text-secondary-maxw">Keine bevorstehenden Kurse</p></div>
          ) : (
            <div className="sad-sw-turnier-cards">
              {kurse.map(k => {
                const d = new Date(k.start_datum);
                return (
                  <div key={k.id} className="sad-sw-turnier-card">
                    <div className="sad-sw-tc-date">
                      <div className="sad-sw-tc-month">{d.toLocaleDateString('de-DE', { month: 'short' })}</div>
                      <div className="sad-sw-tc-day">{d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</div>
                      <div className="sad-sw-tc-year">{d.getFullYear()}</div>
                    </div>
                    <div className="sad-sw-tc-body">
                      <div className="sad-sw-tc-name">{k.titel}</div>
                      <div className="sad-sw-tc-meta">
                        {k.ort && <span>📍 {k.ort}</span>}
                        {k.max_teilnehmer > 0 && <span>👥 max. {k.max_teilnehmer} TN</span>}
                        {k.preis > 0 && <span>💶 {parseFloat(k.preis).toFixed(2)} €</span>}
                        {k.buchungen_count !== undefined && <span>📋 {k.buchungen_count} Buchungen</span>}
                      </div>
                    </div>
                    <div className="sad-sw-tc-right">
                      <span className="sad-sw-badge sad-sw-badge--upcoming">{k.typ || 'Kurs'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === 'vorschau' && (
        <div className="sad-hof-preview-wrapper">
          <div className="sad-hof-preview-bar">
            <span className="sad-hof-live-dot" />
            Live-Vorschau — academy.tda-intl.org
          </div>
          <iframe
            src="https://academy.tda-intl.org"
            title="TDA Academy"
            className="sad-hof-iframe"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}

const SuperAdminDashboard = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // State für Statistiken
  const [tdaStats, setTdaStats] = useState(null);
  const [globalStats, setGlobalStats] = useState(null);
  const [dojos, setDojos] = useState([]);
  const [overviewSummary, setOverviewSummary] = useState(null);
  const [hofStats, setHofStats] = useState(null);
  const [eventStats, setEventStats] = useState(null);
  const [academyStats, setAcademyStats] = useState(null);

  // State für Dojo-Management
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDojo, setSelectedDojo] = useState(null);

  // State für Trial-Management
  const [showExtendTrialModal, setShowExtendTrialModal] = useState(false);
  const [showActivateSubscriptionModal, setShowActivateSubscriptionModal] = useState(false);
  const [trialDays, setTrialDays] = useState(14);
  const [subscriptionPlan, setSubscriptionPlan] = useState('starter');
  const [subscriptionInterval, setSubscriptionInterval] = useState('monthly');
  const [subscriptionDuration, setSubscriptionDuration] = useState(12);
  const [customPrice, setCustomPrice] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [isMainSuperAdmin, setIsMainSuperAdmin] = useState(false);
  const [expandedDojos, setExpandedDojos] = useState(new Set());

  // State für Daily Briefing Popup
  const [showDailyBriefing, setShowDailyBriefing] = useState(false);
  const [todos, setTodos] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sa-todos') || '[]'); } catch { return []; }
  });
  const [newTodo, setNewTodo] = useState('');

  // State für Tab-Navigation
  const [activeTab, setActiveTab] = useState('overview');
  // State für Sub-Tabs pro Gruppe
  const [subActiveTab, setSubActiveTab] = useState({
    dojosoftware: 'lizenzen',
    verband: 'verbandsmitglieder',
    finanzen: 'finanzen',
    system: 'benutzer',
    plattform: 'zentrale',
  });
  const setSubTab = (group, tab) => setSubActiveTab(prev => ({ ...prev, [group]: tab }));
  // State für Lastschrift Sub-Tab
  const [lastschriftSubTab, setLastschriftSubTab] = useState('automatisch');
  // State für Kommunikation Sub-Tab (innerhalb DojoSoftware)
  const [kommunikationSubTab, setKommunikationSubTab] = useState('pushnachrichten');
  // State für Software-Sektion (Landing → Unterbereich)
  const [softwareSection, setSoftwareSection] = useState(null);
  // State für Pläne-Verwaltung
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [editingPlan, setEditingPlan] = useState(null);
  const [plansLoading, setPlansLoading] = useState(false);

  // State für Shop-Bestellungen
  const [bestellungen, setBestellungen] = useState([]);
  const [bestellungenStats, setBestellungenStats] = useState(null);
  const [bestellungenLoading, setBestellungenLoading] = useState(false);
  const [bestellungenFilter, setBestellungenFilter] = useState('alle');
  const [selectedBestellung, setSelectedBestellung] = useState(null);
  const [bestellungUpdating, setBestellungUpdating] = useState(false);

  // State für E-Mail-Einstellungen
  const [emailSettings, setEmailSettings] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: true,
    smtp_user: '',
    smtp_password: '',
    default_from_email: 'noreply@tda-intl.com',
    default_from_name: 'DojoSoftware',
    aktiv: true
  });
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [testEmail, setTestEmail] = useState('');

  // iCloud Kalender
  const [icalUrl, setIcalUrl] = useState('');
  const [icalEvents, setIcalEvents] = useState([]);
  const [icalLoading, setIcalLoading] = useState(false);
  const [icalSaveMsg, setIcalSaveMsg] = useState('');

  // State für Aktivitäten und Pushnachrichten
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationFilter, setNotificationFilter] = useState('unread'); // 'all', 'unread', 'archived'

  // State für Push-Nachricht erstellen
  const [newPushMessage, setNewPushMessage] = useState({
    titel: '',
    nachricht: '',
    empfaenger_typ: 'alle', // 'alle', 'verbandsmitglieder', 'dojos', 'mitglieder'
    empfaenger_ids: [],
    prioritaet: 'normal' // 'normal', 'wichtig', 'dringend'
  });
  const [sendingPush, setSendingPush] = useState(false);

  // Prüfe ob Main Super-Admin (nur für den Hauptadministrator)
  useEffect(() => {
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        // Nur für username="admin" oder user_id=1
        setIsMainSuperAdmin(decoded.username === 'admin' || decoded.user_id === 1);
      } catch (err) {
        console.error('Token decode error:', err);
      }
    }
  }, [token]);

  // Daten laden beim Mount
  useEffect(() => {
    loadAllData();
    loadSubscriptionPlans();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError('');

    try {
      // Parallel alle Daten laden
      const [tdaRes, globalRes, dojosRes, overviewRes] = await Promise.all([
        axios.get('/admin/tda-stats', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('/admin/global-stats', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('/admin/dojos', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('/admin/overview-summary', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setTdaStats(tdaRes.data.stats);
      setGlobalStats(globalRes.data.stats);
      setDojos(dojosRes.data.dojos);
      if (overviewRes.data.success) setOverviewSummary(overviewRes.data);

      // HoF Stats (externer Aufruf, kein Auth nötig)
      try {
        const hofRes = await fetch('https://hof.tda-intl.org/api/stats/overview');
        const hofData = await hofRes.json();
        if (hofData.success) setHofStats(hofData.stats);
      } catch (_) {}

      // EventSoftware Stats
      try {
        const evRes = await axios.get('/plattform-zentrale/turniere', { headers: { Authorization: `Bearer ${token}` } });
        const turniere = evRes.data.turniere || [];
        const heute = new Date(); heute.setHours(0, 0, 0, 0);
        const upcoming = turniere.filter(t => new Date(t.start_datum || t.datum) >= heute);
        const offen = turniere.filter(t => t.anmeldeschluss && new Date(t.anmeldeschluss) >= heute);
        const naechstes = upcoming.sort((a, b) => new Date(a.start_datum || a.datum) - new Date(b.start_datum || b.datum))[0];
        setEventStats({ gesamt: turniere.length, upcoming: upcoming.length, offen: offen.length, naechstes });
      } catch (_) {}

      // Academy Stats (public endpoint — kein Auth nötig)
      try {
        const acRes = await fetch('https://academy.tda-intl.org/api/admin/public-stats');
        const acData = await acRes.json();
        if (acData.success) setAcademyStats(acData.stats);
      } catch (_) {}

      // Daily Briefing: einmal pro Tag anzeigen
      const today = new Date().toDateString();
      if (localStorage.getItem('sa-briefing-date') !== today) {
        setShowDailyBriefing(true);
      }

      console.log('✅ Super-Admin Daten geladen');
    } catch (err) {
      console.error('❌ Fehler beim Laden der Super-Admin Daten:', err);
      setError(err.response?.data?.message || 'Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const closeBriefing = () => {
    localStorage.setItem('sa-briefing-date', new Date().toDateString());
    setShowDailyBriefing(false);
  };

  const addTodo = () => {
    if (!newTodo.trim()) return;
    const updated = [...todos, { id: Date.now(), text: newTodo.trim(), done: false }];
    setTodos(updated);
    localStorage.setItem('sa-todos', JSON.stringify(updated));
    setNewTodo('');
  };

  const toggleTodo = (id) => {
    const updated = todos.map(t => t.id === id ? { ...t, done: !t.done } : t);
    setTodos(updated);
    localStorage.setItem('sa-todos', JSON.stringify(updated));
  };

  const deleteTodo = (id) => {
    const updated = todos.filter(t => t.id !== id);
    setTodos(updated);
    localStorage.setItem('sa-todos', JSON.stringify(updated));
  };

  // Subscription-Pläne laden
  const loadSubscriptionPlans = async () => {
    try {
      setPlansLoading(true);
      const response = await axios.get('/admin/subscription-plans', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setSubscriptionPlans(response.data.plans);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Pläne:', error);
    } finally {
      setPlansLoading(false);
    }
  };

  // E-Mail-Einstellungen laden
  const loadEmailSettings = async () => {
    try {
      setEmailLoading(true);
      const response = await axios.get('/email-settings/global', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setEmailSettings(response.data.data);
      }
    } catch (error) {
      console.error('Fehler beim Laden der E-Mail-Einstellungen:', error);
    } finally {
      setEmailLoading(false);
    }
  };

  // Shop-Bestellungen laden
  const loadBestellungen = async (statusFilter = 'alle') => {
    try {
      setBestellungenLoading(true);
      const params = statusFilter !== 'alle' ? `?status=${statusFilter}` : '';
      const response = await axios.get(`/verband-auth/admin/bestellungen${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setBestellungen(response.data.bestellungen);
        setBestellungenStats(response.data.stats);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Bestellungen:', error);
    } finally {
      setBestellungenLoading(false);
    }
  };

  // Bestellstatus aktualisieren
  const updateBestellungStatus = async (bestellungId, updates) => {
    try {
      setBestellungUpdating(true);
      const response = await axios.put(`/verband-auth/admin/bestellungen/${bestellungId}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        // Liste neu laden
        await loadBestellungen(bestellungenFilter);
        setSelectedBestellung(null);
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Bestellung:', error);
      alert('Fehler beim Aktualisieren');
    } finally {
      setBestellungUpdating(false);
    }
  };

  // E-Mail-Einstellungen speichern
  const saveEmailSettings = async () => {
    try {
      setEmailLoading(true);
      setEmailMessage('');
      const response = await axios.put('/email-settings/global', emailSettings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setEmailMessage('✅ E-Mail-Einstellungen erfolgreich gespeichert');
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      setEmailMessage('❌ Fehler beim Speichern: ' + (error.response?.data?.error || error.message));
    } finally {
      setEmailLoading(false);
    }
  };

  // Test-E-Mail senden
  const sendTestEmail = async () => {
    if (!testEmail) {
      setEmailMessage('⚠️ Bitte geben Sie eine Test-E-Mail-Adresse ein');
      return;
    }
    try {
      setEmailLoading(true);
      setEmailMessage('');
      const response = await axios.post('/email-settings/test', {
        test_email: testEmail,
        use_global: true
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setEmailMessage(`✅ ${response.data.message}`);
      }
    } catch (error) {
      console.error('Test-E-Mail fehlgeschlagen:', error);
      setEmailMessage('❌ ' + (error.response?.data?.error || error.message));
    } finally {
      setEmailLoading(false);
    }
  };

  // iCloud Kalender laden
  const loadIcalSettings = async () => {
    try {
      const r = await axios.get('/admin/calendar/settings', { headers: { Authorization: `Bearer ${token}` } });
      if (r.data.success) setIcalUrl(r.data.ical_url || '');
    } catch (e) { console.error('ical settings:', e); }
  };

  const loadIcalEvents = async () => {
    setIcalLoading(true);
    try {
      const r = await axios.get('/admin/calendar/events', { headers: { Authorization: `Bearer ${token}` } });
      if (r.data.success) setIcalEvents(r.data.events || []);
    } catch (e) { console.error('ical events:', e); }
    finally { setIcalLoading(false); }
  };

  const saveIcalUrl = async () => {
    try {
      await axios.put('/admin/calendar/settings', { ical_url: icalUrl }, { headers: { Authorization: `Bearer ${token}` } });
      setIcalSaveMsg('✅ URL gespeichert');
      loadIcalEvents();
      setTimeout(() => setIcalSaveMsg(''), 3000);
    } catch (e) {
      const errRaw = e.response?.data?.error ?? e.response?.data?.message ?? e.message;
      setIcalSaveMsg('❌ ' + (typeof errRaw === 'object' ? JSON.stringify(errRaw) : errRaw));
    }
  };

  // Lade E-Mail-Einstellungen wenn Tab aktiv
  useEffect(() => {
    if (activeTab === 'system' && subActiveTab.system === 'email') {
      loadEmailSettings();
    }
  }, [activeTab, subActiveTab.system]);

  // Lade iCloud Kalender nur wenn Kalender-Tab aktiv
  useEffect(() => {
    if (activeTab === 'system' && subActiveTab.system === 'kalender') {
      loadIcalSettings();
      loadIcalEvents();
    }
  }, [activeTab, subActiveTab.system]);

  // Lade Aktivitäten und Benachrichtigungen
  useEffect(() => {
    loadActivities();
    loadNotifications();
  }, []);

  // Lade Benachrichtigungen wenn Tab aktiv
  useEffect(() => {
    if (activeTab === 'kommunikation' && kommunikationSubTab === 'pushnachrichten') {
      loadNotifications();
    }
  }, [activeTab, kommunikationSubTab, notificationFilter]);

  // Aktivitäten laden (letzte Registrierungen, etc.)
  const loadActivities = async () => {
    try {
      setActivitiesLoading(true);
      const response = await axios.get('/admin/activities', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setActivities(response.data.activities || []);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Aktivitäten:', error);
      // Fallback: Erstelle Aktivitäten aus vorhandenen Daten
      generateActivitiesFromData();
    } finally {
      setActivitiesLoading(false);
    }
  };

  // Fallback: Aktivitäten aus vorhandenen Daten generieren
  const generateActivitiesFromData = () => {
    const generatedActivities = [];

    // Aus Dojos die neuesten
    if (dojos && dojos.length > 0) {
      const recentDojos = dojos
        .filter(d => d.erstellt_am)
        .sort((a, b) => new Date(b.erstellt_am) - new Date(a.erstellt_am))
        .slice(0, 5);

      recentDojos.forEach(dojo => {
        generatedActivities.push({
          id: `dojo-${dojo.id}`,
          typ: 'dojo_registriert',
          titel: 'Neues Dojo registriert',
          beschreibung: `${dojo.dojoname} wurde registriert`,
          details: { dojoname: dojo.dojoname, inhaber: dojo.inhaber },
          erstellt_am: dojo.erstellt_am,
          icon: '🏠'
        });
      });
    }

    setActivities(generatedActivities.sort((a, b) => new Date(b.erstellt_am) - new Date(a.erstellt_am)));
  };

  // Benachrichtigungen laden
  const loadNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const response = await axios.get(`/admin/notifications?filter=${notificationFilter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setNotifications(response.data.notifications || []);
        setUnreadCount(response.data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Benachrichtigungen:', error);
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  };

  // Benachrichtigung als gelesen markieren
  const markNotificationAsRead = async (notificationId) => {
    try {
      await axios.put(`/admin/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadNotifications();
    } catch (error) {
      console.error('Fehler beim Markieren als gelesen:', error);
    }
  };

  // Benachrichtigung archivieren
  const archiveNotification = async (notificationId) => {
    try {
      await axios.put(`/admin/notifications/${notificationId}/archive`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadNotifications();
    } catch (error) {
      console.error('Fehler beim Archivieren:', error);
    }
  };

  // Alle als gelesen markieren
  const markAllAsRead = async () => {
    try {
      await axios.put('/admin/notifications/mark-all-read', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadNotifications();
    } catch (error) {
      console.error('Fehler beim Markieren aller als gelesen:', error);
    }
  };

  // Push-Nachricht senden
  const sendPushNotification = async () => {
    if (!newPushMessage.titel || !newPushMessage.nachricht) {
      alert('Bitte Titel und Nachricht eingeben');
      return;
    }

    try {
      setSendingPush(true);
      const response = await axios.post('/admin/push-notifications/send', newPushMessage, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        alert(`Push-Nachricht erfolgreich gesendet an ${response.data.recipientCount} Empfänger`);
        setNewPushMessage({
          titel: '',
          nachricht: '',
          empfaenger_typ: 'alle',
          empfaenger_ids: [],
          prioritaet: 'normal'
        });
        loadNotifications();
      } else {
        alert('Fehler: ' + (response.data.error || 'Unbekannter Fehler'));
      }
    } catch (error) {
      console.error('Fehler beim Senden:', error);
      alert('Fehler beim Senden der Push-Nachricht');
    } finally {
      setSendingPush(false);
    }
  };

  // Lade Bestellungen wenn Tab aktiv
  useEffect(() => {
    if (activeTab === 'finanzen' && subActiveTab.finanzen === 'bestellungen') {
      loadBestellungen(bestellungenFilter);
    }
  }, [activeTab, subActiveTab.finanzen, bestellungenFilter]);

  // Plan aktualisieren
  const updatePlan = async (planId, updates) => {
    try {
      const response = await axios.put(`/admin/subscription-plans/${planId}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        loadSubscriptionPlans();
        setEditingPlan(null);
        alert('Plan erfolgreich aktualisiert');
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      alert('Fehler beim Aktualisieren des Plans');
    }
  };

  const handleCreateDojo = () => {
    setSelectedDojo(null);
    setShowCreateModal(true);
  };

  const handleEditDojo = (dojo) => {
    setSelectedDojo(dojo);
    setShowEditModal(true);
  };

  const handleDeleteDojo = async (dojo) => {
    if (!confirm(`Möchten Sie "${dojo.dojoname}" wirklich deaktivieren?`)) {
      return;
    }

    try {
      await axios.delete(`/admin/dojos/${dojo.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(`Dojo "${dojo.dojoname}" wurde deaktiviert`);
      loadAllData(); // Neu laden
    } catch (err) {
      console.error('❌ Fehler beim Löschen:', err);
      alert(err.response?.data?.error || 'Fehler beim Löschen');
    }
  };

  // Trial-Management Handler
  const handleExtendTrial = (dojo) => {
    setSelectedDojo(dojo);
    setTrialDays(14);
    setShowExtendTrialModal(true);
  };

  const handleActivateSubscription = (dojo) => {
    setSelectedDojo(dojo);
    setSubscriptionPlan('basic');
    setSubscriptionInterval('monthly');
    setSubscriptionDuration(12);
    setCustomPrice('');
    setCustomNotes('');
    setShowActivateSubscriptionModal(true);
  };

  const confirmExtendTrial = async () => {
    if (!selectedDojo) return;

    try {
      await axios.put(
        `/admin/dojos/${selectedDojo.id}/extend-trial`,
        { days: trialDays },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert(`Trial für "${selectedDojo.dojoname}" um ${trialDays} Tage verlängert`);
      setShowExtendTrialModal(false);
      loadAllData();
    } catch (err) {
      console.error('❌ Fehler beim Verlängern:', err);
      alert(err.response?.data?.error || 'Fehler beim Verlängern des Trials');
    }
  };

  const confirmActivateSubscription = async () => {
    if (!selectedDojo) return;

    try {
      const requestData = {
        plan: subscriptionPlan,
        interval: subscriptionInterval,
        duration_months: subscriptionDuration
      };

      // Zusätzliche Felder für custom/free (nur für Main Super-Admin)
      if (isMainSuperAdmin) {
        if (subscriptionPlan === 'free') {
          requestData.is_free = true;
        } else if (subscriptionPlan === 'custom') {
          requestData.custom_price = customPrice;
          requestData.custom_notes = customNotes;
        }
      }

      await axios.put(
        `/admin/dojos/${selectedDojo.id}/activate-subscription`,
        requestData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const message = subscriptionPlan === 'free'
        ? `Kostenloser Account für "${selectedDojo.dojoname}" aktiviert (unbegrenzt)`
        : subscriptionPlan === 'custom'
        ? `Custom Abo für "${selectedDojo.dojoname}" aktiviert (${customPrice}€, ${subscriptionDuration} Monate)`
        : `Abonnement für "${selectedDojo.dojoname}" aktiviert (${subscriptionPlan}, ${subscriptionDuration} Monate)`;

      alert(message);
      setShowActivateSubscriptionModal(false);
      loadAllData();
    } catch (err) {
      console.error('❌ Fehler beim Aktivieren:', err);
      alert(err.response?.data?.error || 'Fehler beim Aktivieren des Abonnements');
    }
  };

  // Helper-Funktionen
  const getSubscriptionStatusBadge = (dojo) => {
    const statusMap = {
      trial: { label: 'Trial', className: 'info', icon: <Clock size={14} /> },
      active: { label: 'Aktiv', className: 'success', icon: <CheckCircle size={14} /> },
      expired: { label: 'Abgelaufen', className: 'danger', icon: <XCircle size={14} /> },
      cancelled: { label: 'Gekündigt', className: 'warning', icon: <AlertTriangle size={14} /> },
      suspended: { label: 'Gesperrt', className: 'danger', icon: <XCircle size={14} /> }
    };

    const status = statusMap[dojo.subscription_status] || statusMap.trial;

    return (
      <span className={`status-badge ${status.className}`}>
        {status.icon} {status.label}
      </span>
    );
  };

  const getSubscriptionEndInfo = (dojo) => {
    if (dojo.subscription_status === 'trial') {
      const daysRemaining = dojo.trial_days_remaining;
      if (daysRemaining === null) return '-';
      if (daysRemaining < 0) return <span className="text-danger">Abgelaufen</span>;
      if (daysRemaining === 0) return <span className="text-danger">Heute</span>;
      if (daysRemaining <= 3) return <span className="text-danger">{daysRemaining} Tage</span>;
      if (daysRemaining <= 7) return <span className="text-warning">{daysRemaining} Tage</span>;
      return <span>{daysRemaining} Tage</span>;
    } else if (dojo.subscription_status === 'active') {
      const daysRemaining = dojo.subscription_days_remaining;
      if (daysRemaining === null) return '-';
      if (daysRemaining < 0) return <span className="text-danger">Abgelaufen</span>;
      if (daysRemaining === 0) return <span className="text-danger">Heute</span>;
      if (daysRemaining <= 14) return <span className="text-warning">{daysRemaining} Tage</span>;

      const endDate = new Date(dojo.subscription_ends_at);
      return endDate.toLocaleDateString('de-DE');
    }
    return '-';
  };

  const toggleDojoExpand = (dojoId) => {
    setExpandedDojos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dojoId)) {
        newSet.delete(dojoId);
      } else {
        newSet.add(dojoId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="super-admin-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Lade Super-Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="super-admin-dashboard">
        <div className="error-container">
          <XCircle size={48} />
          <h2>Fehler</h2>
          <p>{error}</p>
          <button onClick={loadAllData} className="btn btn-primary">
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  // Tab Definitions — produkt-basierte Hauptnavigation
  const tabs = [
    { id: 'overview',      label: 'Cockpit',            icon: '🎛️' },
    { id: 'software',      label: 'Software',           icon: '💻' },
    { id: 'verband',       label: 'Verband',            icon: '🏆' },
    { id: 'kommunikation', label: 'Kommunikation',      icon: '📣', badge: unreadCount > 0 ? unreadCount : null },
    { id: 'entwicklung',   label: 'Entwicklung',        icon: '🎯' },
    { id: 'finanzen',      label: 'Finanzen',           icon: '💰' },
    { id: 'plattform',     label: 'Plattform-Zentrale', icon: '🌐' },
    { id: 'system',        label: 'System',             icon: '⚙️' }
  ];

  // Sub-Tab-Navigation rendern
  const renderSubTabs = (group, subtabs) => (
    <div className="sub-tabs-horizontal sad2-mb-15">
      {subtabs.map(tab => (
        <button
          key={tab.id}
          className={`sub-tab-btn ${subActiveTab[group] === tab.id ? 'active' : ''}`}
          onClick={() => setSubTab(group, tab.id)}
        >
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );

  const briefingHour = new Date().getHours();
  const briefingGreeting = briefingHour < 12 ? 'Guten Morgen' : briefingHour < 18 ? 'Guten Tag' : 'Guten Abend';

  return (
    <div className="super-admin-dashboard">

      {/* ── Daily Briefing Popup ──────────────────────────────────── */}
      {showDailyBriefing && (
        <div className="sad-briefing-overlay" onClick={closeBriefing}>
          <div className="sad-briefing-modal" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="sad-briefing-header">
              <div>
                <div className="sad-briefing-greeting">
                  ☀️ {briefingGreeting}!
                </div>
                <div className="sad-briefing-date">
                  {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <button onClick={closeBriefing} className="sad-briefing-close">×</button>
            </div>

            <div className="sad-briefing-body">

              {/* KPI-Schnellblick */}
              <div>
                <div className="sad-uppercase-meta">Aktueller Stand</div>
                <div className="sad-briefing-kpi-grid">
                  {[
                    { label: 'Aktive Dojos',          value: globalStats?.dojos?.active_dojos || 0,        icon: '🏯' },
                    { label: 'Dojo-Mitglieder',        value: globalStats?.members?.active_members || 0,    icon: '👥' },
                    { label: 'Verbandsmitglieder',     value: overviewSummary?.goals?.find(g => g.typ === 'verband_mitglieder')?.ist_wert || 0, icon: '🏆' },
                    { label: 'Neu diese Woche (Dojos)', value: `+${overviewSummary?.new_registrations?.dojos?.week || 0}`,    icon: '🆕' },
                    { label: 'Neu diese Woche (Mitgl.)',value: `+${overviewSummary?.new_registrations?.mitglieder?.week || 0}`,icon: '👤' },
                    { label: 'Ungelesene Nachrichten', value: unreadCount,                                  icon: unreadCount > 0 ? '🔴' : '✅' },
                  ].map((s, i) => (
                    <div key={i} className="sad-briefing-kpi-item">
                      <span className="sad2-fs-12">{s.icon}</span>
                      <div>
                        <div className="sad-briefing-kpi-value">{s.value}</div>
                        <div className="sad2-text-secondary-075">{s.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trial-Warnungen */}
              {overviewSummary?.trial_expiring?.length > 0 && (
                <div>
                  <div className="sad-trial-warning-meta">⚠️ Trial läuft bald ab</div>
                  <div className="sad2-flex-col-04">
                    {overviewSummary.trial_expiring.map((d, i) => (
                      <div key={i} className={`sad-trial-item ${d.tage_noch <= 3 ? 'sad-trial-item--urgent' : 'sad-trial-item--warning'}`}>
                        <span className="sad2-fw600">{d.dojoname}</span>
                        <span className={d.tage_noch <= 3 ? 'sad-trial-days--urgent' : 'sad-trial-days--warning'}>noch {d.tage_noch} Tag{d.tage_noch !== 1 ? 'e' : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Jahresziele */}
              {overviewSummary?.goals?.length > 0 && (
                <div>
                  <div className="sad-uppercase-meta">🎯 Jahresziele {new Date().getFullYear()}</div>
                  <div className="sad-briefing-goals-list">
                    {overviewSummary.goals.map(goal => {
                      const label = goal.typ === 'dojos' ? '🏯 Dojos' : goal.typ === 'verband_mitglieder' ? '🏆 Verbandsmitglieder' : goal.typ === 'software_nutzer' ? '🥋 Software-Nutzer' : goal.typ;
                      const pct = Math.min(goal.prozent, 100);
                      const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
                      return (
                        <div key={goal.typ}>
                          <div className="sad-briefing-goal-header">
                            <span className="sad2-fw600">{label}</span>
                            <span className="u-text-secondary">{goal.ist_wert} / {goal.ziel_wert} <span className={`sad-briefing-goal-pct sad-goal-pct--${pct >= 80 ? 'good' : pct >= 50 ? 'mid' : 'low'}`}>({pct}%)</span></span>
                          </div>
                          <div className="sad-briefing-goal-bar-track">
                            <div className="sad-briefing-goal-bar-fill" style={{ width: `${pct}%`, backgroundSize: `${Math.round(10000 / Math.max(pct, 1))}% 100%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* To-Do Liste */}
              <div>
                <div className="sad-uppercase-meta">📋 Meine To-Do Liste</div>
                <div className="sad-briefing-todo-row">
                  <input
                    value={newTodo}
                    onChange={e => setNewTodo(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTodo()}
                    placeholder="Neues To-Do hinzufügen..."
                    className="sad-briefing-todo-input"
                  />
                  <button onClick={addTodo} className="sad-briefing-todo-add">+</button>
                </div>
                {todos.length === 0 ? (
                  <div className="sad-briefing-todo-empty">
                    Noch keine To-Dos — trag was ein!
                  </div>
                ) : (
                  <div className="sad-briefing-todo-list">
                    {todos.map(todo => (
                      <div key={todo.id} className="sad-briefing-todo-item">
                        <input type="checkbox" checked={todo.done} onChange={() => toggleTodo(todo.id)} className="sad-briefing-todo-checkbox" />
                        <span className={`sad-todo-text ${todo.done ? 'sad-todo-text--done' : 'sad-todo-text--active'}`}>{todo.text}</span>
                        <button onClick={() => deleteTodo(todo.id)} className="sad-briefing-todo-delete">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="sad-briefing-footer">
              <span className="sad-briefing-footer-hint">Erscheint einmal täglich beim ersten Login</span>
              <button onClick={closeBriefing} className="sad-briefing-footer-btn">
                Los geht's →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation - wie im normalen Dashboard */}
      <div className="dashboard-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`dashboard-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            {tab.badge && (
              <span className="sad-tab-badge">
                {tab.badge > 9 ? '9+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <>
            {/* ── KPI-Leiste ─────────────────────────────────────────── */}
            <div className="compact-stats-bar sad2-mb-15">
              <div className="compact-stat">
                <Building2 size={18} />
                <span className="compact-stat-value">{globalStats?.dojos?.active_dojos || 0}</span>
                <span className="compact-stat-label">Aktive Dojos</span>
              </div>
              <div className="compact-stat">
                <Users size={18} />
                <span className="compact-stat-value">{globalStats?.members?.active_members || 0}</span>
                <span className="compact-stat-label">Mitglieder</span>
              </div>
              <div className="compact-stat">
                <Award size={18} />
                <span className="compact-stat-value">{overviewSummary?.goals?.find(g => g.typ === 'verband_mitglieder')?.ist_wert ?? tdaStats?.members?.active_members ?? 0}</span>
                <span className="compact-stat-label">Verbandsmitglieder</span>
              </div>
              <div className="compact-stat">
                <Activity size={18} />
                <span className="compact-stat-value">{globalStats?.checkins?.active_checkins_today || 0}</span>
                <span className="compact-stat-label">Check-ins heute</span>
              </div>
              <div className={`compact-stat ${globalStats?.payments?.open_payments > 0 ? 'compact-stat--warning' : ''}`}>
                <Euro size={18} />
                <span className="compact-stat-value">{globalStats?.payments?.open_payments || 0}</span>
                <span className="compact-stat-label">Offene Zahlungen</span>
              </div>
              <div className={`compact-stat ${unreadCount > 0 ? 'compact-stat--danger' : ''}`}>
                <Bell size={18} />
                <span className="compact-stat-value">{unreadCount}</span>
                <span className="compact-stat-label">Ungelesen</span>
              </div>
              <div className={`compact-stat ${(globalStats?.storage?.percent_used || 0) > 80 ? 'compact-stat--danger' : ''}`}>
                <HardDrive size={18} />
                <span className="compact-stat-value">{globalStats?.storage?.percent_used || 0}%</span>
                <span className="compact-stat-label">Speicher ({globalStats?.storage?.used_gb || 0}/{globalStats?.storage?.total_gb || 0} GB)</span>
              </div>
            </div>

            {/* ── Jahres-Ziele Soll/Ist ───────────────────────────────── */}
            {overviewSummary?.goals?.length > 0 && (
              <section className="sad-goals-section">
                <div className="sad-goals-section-header">
                  <h3 className="sad-goals-section-title">
                    <TrendingUp size={18} /> Jahresziele {new Date().getFullYear()} — Soll/Ist
                  </h3>
                  <button onClick={() => setActiveTab('entwicklung')} className="sad-goals-section-btn">
                    Details →
                  </button>
                </div>
                <div className="sad-goals-grid" style={{ gridTemplateColumns: `repeat(${overviewSummary.goals.length}, 1fr)` }}>
                  {overviewSummary.goals.map(goal => {
                    const label = goal.typ === 'dojos' ? '🏯 Dojos' : goal.typ === 'verband_mitglieder' ? '🏆 Verbandsmitglieder' : goal.typ === 'software_nutzer' ? '🥋 Software-Nutzer' : goal.typ === 'umsatz' ? '💰 Umsatz' : goal.typ;
                    const pct = Math.min(goal.prozent, 100);
                    const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
                    return (
                      <div key={goal.typ}>
                        <div className="sad-goals-goal-header">
                          <span className="sad2-fw600">{label}</span>
                          <span className="u-text-secondary">{goal.ist_wert} / {goal.ziel_wert}</span>
                        </div>
                        <div className="sad-goals-bar-track">
                          <div className="sad-goals-bar-fill" style={{ width: `${pct}%`, backgroundSize: `${Math.round(10000 / Math.max(pct, 1))}% 100%` }} />
                        </div>
                        <div className={`sad-goals-pct-label sad-goal-pct--${pct >= 80 ? 'good' : pct >= 50 ? 'mid' : 'low'}`}>{pct}%</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Produkt-Status / Neuanmeldungen ────────────────────── */}
            <div className="sad-product-cards-grid">
              {/* DojoSoftware */}
              <div onClick={() => setActiveTab('dojosoftware')} className="sad2-clickable-card">
                <div className="sad2-icon-15">🥋</div>
                <div className="sad-gold-heading">DojoSoftware</div>
                <div className="sad-product-card-sub">
                  <div className="sad2-flex-between-mb03">
                    <span>Aktive Dojos</span><strong className="mds-info-value">{globalStats?.dojos?.active_dojos || 0}</strong>
                  </div>
                  <div className="sad2-flex-between-mb03">
                    <span>Neu diese Woche</span><strong className={(overviewSummary?.new_registrations?.dojos?.week || 0) > 0 ? 'sad-new-count--positive' : 'sad-new-count--neutral'}>+{overviewSummary?.new_registrations?.dojos?.week || 0}</strong>
                  </div>
                  <div className="u-flex-between">
                    <span>Neu diesen Monat</span><strong className="mds-info-value">+{overviewSummary?.new_registrations?.dojos?.month || 0}</strong>
                  </div>
                </div>
                {overviewSummary?.trial_expiring?.length > 0 && (
                  <div className="sad-trial-expiring-mini">
                    ⚠️ {overviewSummary.trial_expiring.length} Trial läuft bald ab
                  </div>
                )}
              </div>

              {/* Verband */}
              <div onClick={() => setActiveTab('verband')} className="sad2-clickable-card">
                <div className="sad2-icon-15">🏆</div>
                <div className="sad-gold-heading">Verband</div>
                <div className="sad-text-secondary-sm">
                  <div className="sad2-flex-between-mb03">
                    <span>Aktive Mitglieder</span><strong className="mds-info-value">{overviewSummary?.goals?.find(g => g.typ === 'verband_mitglieder')?.ist_wert || 0}</strong>
                  </div>
                  <div className="sad2-flex-between-mb03">
                    <span>Neu diese Woche</span><strong className={(overviewSummary?.new_registrations?.verband?.week || 0) > 0 ? 'sad-new-count--positive' : 'sad-new-count--neutral'}>+{overviewSummary?.new_registrations?.verband?.week || 0}</strong>
                  </div>
                  <div className="u-flex-between">
                    <span>Neu diesen Monat</span><strong className="mds-info-value">+{overviewSummary?.new_registrations?.verband?.month || 0}</strong>
                  </div>
                </div>
              </div>

              {/* EventSoftware */}
              <div onClick={() => { setActiveTab('software'); setSoftwareSection('eventsoftware'); }} className="sad2-clickable-card">
                <div className="sad2-icon-15">🗓️</div>
                <div className="sad-gold-heading">EventSoftware</div>
                <div className="sad-text-secondary-sm">
                  {eventStats ? (
                    <div className="sad2-flex-col-04">
                      <div className="sad2-flex-between-mb03">
                        <span>Events gesamt</span><strong className="mds-info-value">{eventStats.gesamt}</strong>
                      </div>
                      <div className="sad2-flex-between-mb03">
                        <span>Bevorstehend</span><strong className={(eventStats.upcoming > 0) ? 'sad-new-count--positive' : 'mds-info-value'}>{eventStats.upcoming}</strong>
                      </div>
                      <div className="u-flex-between">
                        <span>Anmeldung offen</span><strong className="mds-info-value">{eventStats.offen}</strong>
                      </div>
                      {eventStats.naechstes && (
                        <div className="sad-hof-next-event" style={{ marginTop: '0.5rem' }}>
                          <div className="sad-hof-next-event-title">Nächstes Event</div>
                          <div className="sad-hof-next-event-name">{eventStats.naechstes.name}</div>
                          <div className="u-text-secondary">
                            {new Date(eventStats.naechstes.start_datum || eventStats.naechstes.datum).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="sad-hof-loading">Lade…</div>
                  )}
                </div>
              </div>

              {/* Academy */}
              <div onClick={() => { setActiveTab('software'); setSoftwareSection('academy'); }} className="sad2-clickable-card">
                <div className="sad2-icon-15">🎓</div>
                <div className="sad-gold-heading">TDA Academy</div>
                <div className="sad-text-secondary-sm">
                  {academyStats ? (
                    <div className="sad2-flex-col-04">
                      <div className="sad2-flex-between-mb03">
                        <span>Kurse aktiv</span><strong className="mds-info-value">{academyStats.kurse_aktiv}</strong>
                      </div>
                      <div className="sad2-flex-between-mb03">
                        <span>Buchungen</span><strong className="mds-info-value">{academyStats.buchungen_gesamt}</strong>
                      </div>
                      <div className="u-flex-between">
                        <span>Umsatz</span><strong className="mds-info-value">{parseFloat(academyStats.umsatz_gesamt || 0).toFixed(0)} €</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="sad-hof-loading">Lade…</div>
                  )}
                </div>
              </div>

              {/* Hall of Fame */}
              <div onClick={() => setActiveTab('halloffame')} className="sad2-clickable-card">
                <div className="sad2-icon-15">🌟</div>
                <div className="sad-gold-heading">Hall of Fame</div>
                <div className="sad-text-secondary-sm">
                  {hofStats ? (
                    <div className="sad2-flex-col-04">
                      <div className="u-flex-between">
                        <span>Sportler</span>
                        <strong className="mds-info-value">{hofStats.total_sportler}</strong>
                      </div>
                      <div className="u-flex-between">
                        <span>Nominierungen</span>
                        <strong className="mds-info-value">{hofStats.nominierungen_gesamt}</strong>
                      </div>
                      <div className="u-flex-between">
                        <span>Veranstaltungen</span>
                        <strong className="mds-info-value">{hofStats.veranstaltungen_gesamt}</strong>
                      </div>
                      {hofStats.naechste_veranstaltung && (
                        <div className="sad-hof-next-event">
                          <div className="sad-hof-next-event-title">Nächste Veranstaltung</div>
                          <div className="sad-hof-next-event-name">{hofStats.naechste_veranstaltung.titel}</div>
                          <div className="u-text-secondary">{new Date(hofStats.naechste_veranstaltung.datum).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="sad-hof-loading">Lade…</div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Neueste Anmeldungen + Benachrichtigungen ── */}
            <div className="sad-widgets-4col">

              {/* Neueste Dojos */}
              <section className="dashboard-widget">
                <div className="widget-header">
                  <h3><Building2 size={16} /> Neue Dojos</h3>
                  <button onClick={() => setActiveTab('dojosoftware')} className="widget-action-btn">Alle →</button>
                </div>
                <div className="widget-content">
                  {overviewSummary?.neueste_dojos?.length === 0 ? (
                    <div className="widget-empty">Keine Daten</div>
                  ) : (
                    <div className="sad-flex-col-sm">
                      {(overviewSummary?.neueste_dojos || []).map((dojo, i) => (
                        <div key={i} className="sad-list-row">
                          <div>
                            <div className="sad2-fw600">{dojo.dojoname}</div>
                            <div className="sad2-text-secondary-xs">{dojo.ort} · {dojo.inhaber}</div>
                          </div>
                          <span className="sad2-text-secondary-075">
                            {new Date(dojo.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Neueste Verbandsmitglieder */}
              <section className="dashboard-widget">
                <div className="widget-header">
                  <h3><Award size={16} /> Neue Verbandsmitglieder</h3>
                  <button onClick={() => setActiveTab('verband')} className="widget-action-btn">Alle →</button>
                </div>
                <div className="widget-content">
                  {overviewSummary?.neueste_verbandsmitglieder?.length === 0 ? (
                    <div className="widget-empty">Keine Daten</div>
                  ) : (
                    <div className="sad-flex-col-sm">
                      {(overviewSummary?.neueste_verbandsmitglieder || []).map((m, i) => (
                        <div key={i} className="sad-list-row">
                          <div>
                            <div className="sad2-fw600">{m.name}</div>
                            <div className="sad2-text-secondary-xs">{m.mitgliedsnummer} · {m.typ}</div>
                          </div>
                          <span className={`sad-member-status ${m.status === 'aktiv' ? 'sad-member-status--aktiv' : 'sad-member-status--inaktiv'}`}>
                            {m.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Neueste Dojo-Mitglieder */}
              <section className="dashboard-widget">
                <div className="widget-header">
                  <h3><Users size={16} /> Neue Dojo-Mitglieder</h3>
                </div>
                <div className="widget-content">
                  {!overviewSummary?.neueste_mitglieder?.length ? (
                    <div className="widget-empty">Keine Daten</div>
                  ) : (
                    <div className="sad-flex-col-sm">
                      {overviewSummary.neueste_mitglieder.map((m, i) => (
                        <div key={i} className="sad-list-row">
                          <div>
                            <div className="sad2-fw600">{m.vorname} {m.nachname}</div>
                            <div className="sad2-text-secondary-xs">{m.dojoname}</div>
                          </div>
                          <span className="sad-date-span">
                            {new Date(m.eintrittsdatum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Benachrichtigungen */}
              <section className="dashboard-widget">
                <div className="widget-header">
                  <h3>
                    <Bell size={16} /> Benachrichtigungen
                    {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
                  </h3>
                  <button onClick={() => { setActiveTab('kommunikation'); setKommunikationSubTab('pushnachrichten'); }} className="widget-action-btn">
                    Alle anzeigen
                  </button>
                </div>
                <div className="widget-content">
                  {notificationsLoading ? (
                    <div className="widget-empty">Lade...</div>
                  ) : notifications.filter(n => !n.gelesen).length === 0 ? (
                    <div className="widget-empty">
                      <CheckCircle size={20} className="sad2-opacity-04" /><br />Keine ungelesenen
                    </div>
                  ) : (
                    <div className="notification-list">
                      {notifications.filter(n => !n.gelesen).slice(0, 5).map((notification) => (
                        <div key={notification.id} className="notification-item">
                          <span className="notification-icon">
                            {notification.typ === 'mitglied_registriert' ? '👤' :
                             notification.typ === 'dojo_registriert' ? '🏠' :
                             notification.typ === 'verbandsmitglied_registriert' ? '🏆' : '🔔'}
                          </span>
                          <div className="notification-content">
                            <div className="notification-title">{notification.titel}</div>
                            <div className="notification-desc">{notification.nachricht}</div>
                          </div>
                          <div className="notification-actions">
                            <button onClick={() => markNotificationAsRead(notification.id)} title="Gelesen"><Eye size={14} /></button>
                            <button onClick={() => archiveNotification(notification.id)} title="Archivieren"><Archive size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* ── Trial-Monitor + Aktivitäten ─────────────────────────── */}
            <div className="u-grid-2col">

              {/* Trial läuft ab */}
              <section className="dashboard-widget">
                <div className="widget-header">
                  <h3><Clock size={16} /> Trial-Monitor</h3>
                </div>
                <div className="widget-content">
                  {(overviewSummary?.trial_expiring || []).length === 0 ? (
                    <div className="widget-empty"><CheckCircle size={20} className="sad2-opacity-04" /><br />Kein Trial läuft bald ab</div>
                  ) : (
                    <div className="sad-flex-col-sm">
                      {overviewSummary.trial_expiring.map((d, i) => (
                        <div key={i} className={`sad-trial-item ${d.tage_noch <= 3 ? 'sad-trial-item--urgent' : 'sad-trial-item--warning'}`}>
                          <span className="sad2-fw600">{d.dojoname}</span>
                          <span className={d.tage_noch <= 3 ? 'sad-trial-days--urgent' : 'sad-trial-days--warning'}>
                            noch {d.tage_noch} Tag{d.tage_noch !== 1 ? 'e' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Letzte Aktivitäten */}
              <section className="dashboard-widget">
                <div className="widget-header">
                  <h3><Activity size={16} /> Letzte Aktivitäten</h3>
                  <button onClick={loadActivities} className="widget-refresh-btn" title="Aktualisieren"><RefreshCw size={14} /></button>
                </div>
                <div className="widget-content">
                  {activitiesLoading ? (
                    <div className="widget-empty">Lade...</div>
                  ) : activities.length === 0 ? (
                    <div className="widget-empty">Keine aktuellen Aktivitäten</div>
                  ) : (
                    <div className="activity-list">
                      {activities.slice(0, 6).map((activity, index) => (
                        <div key={activity.id || index} className="activity-item">
                          <span className="activity-icon">{activity.icon || '📋'}</span>
                          <div className="activity-content">
                            <div className="activity-title">{activity.titel}</div>
                            <div className="activity-desc">{activity.beschreibung}</div>
                            <div className="activity-time">
                              {activity.erstellt_am ? new Date(activity.erstellt_am).toLocaleString('de-DE') : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* ── Dojo-Auswertungen ── */}
            <div style={{ marginTop: '2.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)', margin: 0 }}>
                  📈 Dojo-Auswertungen
                </h2>
                <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', margin: '0.25rem 0 0' }}>
                  Aktualisiert sich automatisch bei Dojo-Wechsel
                </p>
              </div>
              <div className="sad-auswertungen-embed">
                <Auswertungen />
              </div>
            </div>


          </>
        )}

        {/* ═══ Software ═════════════════════════════════════════════ */}
        {activeTab === 'software' && (
          <div>
            {/* Breadcrumb / Zurück-Button */}
            {softwareSection && (
              <div className="sad-software-breadcrumb">
                <button className="sad-software-back-btn" onClick={() => setSoftwareSection(null)}>
                  ← Software-Übersicht
                </button>
                <span className="sad-software-breadcrumb-sep">/</span>
                <span className="sad-software-breadcrumb-cur">
                  {softwareSection === 'lizenzen' ? '🥋 Lizenzen (DojoSoftware)' :
                   softwareSection === 'eventsoftware' ? '🗓️ EventSoftware' :
                   softwareSection === 'halloffame' ? '🌟 Hall of Fame' :
                   softwareSection === 'academy' ? '🎓 TDA Academy' :
                   softwareSection === 'dojos' ? '🏯 TDA-Dojos' : ''}
                </span>
              </div>
            )}

            {/* Landing — 4 Kacheln */}
            {!softwareSection && (
              <div className="sad-software-landing">
                <h2 className="sad-software-landing-title">Software-Übersicht</h2>
                <div className="sad-software-cards">
                  {[
                    { id: 'lizenzen',      icon: '🥋', title: 'Lizenzen',           subtitle: 'Dojos, Abonnements, Dokumente',         color: '#6366f1' },
                    { id: 'eventsoftware', icon: '🗓️', title: 'EventSoftware',      subtitle: 'Turniere, Lehrgänge, Seminare',          color: '#f59e0b' },
                    { id: 'academy',       icon: '🎓', title: 'TDA Academy',         subtitle: 'Ausbildungen, Weiterbildungen, Buchungen', color: '#22c55e' },
                    { id: 'halloffame',    icon: '🌟', title: 'Hall of Fame',        subtitle: 'Nominierungen, Sportler, Veranstaltungen', color: '#eab308' },
                    { id: 'dojos',         icon: '🏯', title: 'TDA-Dojos',          subtitle: 'Eigene Standorte & Trainer',            color: '#10b981' },
                  ].map(card => (
                    <div key={card.id} className="sad-software-card" onClick={() => setSoftwareSection(card.id)} style={{ borderTopColor: card.color }}>
                      <div className="sad-software-card-icon" style={{ color: card.color }}>{card.icon}</div>
                      <div className="sad-software-card-title">{card.title}</div>
                      <div className="sad-software-card-sub">{card.subtitle}</div>
                      <div className="sad-software-card-arrow">→</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Lizenzen (ehemals DojoSoftware) ───────────────────── */}
            {softwareSection === 'lizenzen' && (
              <div>
            {renderSubTabs('dojosoftware', [
              { id: 'lizenzen', icon: '📜', label: 'Lizenzen' },
              { id: 'dokumente', icon: '📂', label: 'Dokumente' }
            ])}

            {subActiveTab.dojosoftware === 'lizenzen' && (
              <DojoLizenzverwaltung />
            )}

            {subActiveTab.dojosoftware === 'dokumente' && (
              <DokumentenZentrale embedded />
            )}

              </div>
            )}

            {/* ── EventSoftware ──────────────────────────────────────── */}
            {softwareSection === 'eventsoftware' && (
              <EventSoftwareSection token={token} />
            )}

            {/* ── TDA Academy ────────────────────────────────────────── */}
            {softwareSection === 'academy' && (
              <AcademySection />
            )}

            {/* ── Hall of Fame ───────────────────────────────────────── */}
            {softwareSection === 'halloffame' && (
              <div>
                <div className="sad-hof-header">
                  <h2 className="sad-hof-title">🌟 TDA Hall of Fame</h2>
                  <div className="sad-hof-btn-row">
                    <a href="https://hof.tda-intl.org/login" target="_blank" rel="noreferrer" className="sad-hof-admin-link">
                      🔐 HoF Admin Login
                    </a>
                    <a href="https://hof.tda-intl.org" target="_blank" rel="noreferrer" className="sad-hof-public-link">
                      ↗ hof.tda-intl.org
                    </a>
                  </div>
                </div>
                <div className="sad-hof-nav-grid">
                  {[
                    { icon: '🏠', label: 'Übersicht',       url: 'https://hof.tda-intl.org/dashboard' },
                    { icon: '🏅', label: 'Sportler',        url: 'https://hof.tda-intl.org/dashboard/sportler' },
                    { icon: '🏷️', label: 'Kategorien',      url: 'https://hof.tda-intl.org/dashboard/kategorien' },
                    { icon: '📋', label: 'Nominierungen',   url: 'https://hof.tda-intl.org/dashboard/nominierungen' },
                    { icon: '🏟️', label: 'Veranstaltungen', url: 'https://hof.tda-intl.org/dashboard/veranstaltungen' },
                  ].map(item => (
                    <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="sad-hof-nav-link">
                      <span className="sad2-fs-12">{item.icon}</span>
                      {item.label}
                    </a>
                  ))}
                </div>
                <div className="sad-hof-preview-wrapper">
                  <div className="sad-hof-preview-bar">
                    <span className="sad-hof-live-dot" />
                    Live-Vorschau — hof.tda-intl.org
                  </div>
                  <iframe
                    src="https://hof.tda-intl.org"
                    title="Hall of Fame"
                    className="sad-hof-iframe"
                    loading="lazy"
                  />
                </div>
              </div>
            )}

            {/* ── TDA-Dojos ──────────────────────────────────────────── */}
            {softwareSection === 'dojos' && (
              <div className="sad2-empty-center">
                <span className="sad2-big-icon">🏯</span>
                <h2 className="sad2-primary-mb">TDA-eigene Dojos</h2>
                <p className="sad2-text-secondary-maxw">
                  Verwaltung der eigenen TDA-Dojos — Standorte, Trainer, Stundenpläne.<br />
                  Diese Sektion wird gerade aufgebaut.
                </p>
              </div>
            )}

          </div>
        )}

        {/* ═══ Kommunikation ════════════════════════════════════════ */}
        {activeTab === 'kommunikation' && (
          <div>
            <div className="sub-tabs-horizontal sad2-mb-15">
              <button className={`sub-tab-btn ${kommunikationSubTab === 'pushnachrichten' ? 'active' : ''}`} onClick={() => setKommunikationSubTab('pushnachrichten')}>
                <Bell size={16} /><span>Pushnachrichten</span>
              </button>
              <button className={`sub-tab-btn ${kommunikationSubTab === 'chat-zentrale' ? 'active' : ''}`} onClick={() => setKommunikationSubTab('chat-zentrale')}>
                <MessageCircle size={16} /><span>Chat-Zentrale</span>
              </button>
              <button className={`sub-tab-btn ${kommunikationSubTab === 'support' ? 'active' : ''}`} onClick={() => setKommunikationSubTab('support')}>
                <MessageSquare size={16} /><span>Support</span>
              </button>
              <button className={`sub-tab-btn ${kommunikationSubTab === 'besucher-chat' ? 'active' : ''}`} onClick={() => setKommunikationSubTab('besucher-chat')}>
                <Globe size={16} /><span>Besucher-Chat</span>
              </button>
            </div>

            {kommunikationSubTab === 'pushnachrichten' && (
              <div className="pushnachrichten-tab">
                <h2 className="section-title sad-section-header">
                  <Bell size={24} /> Pushnachrichten
                </h2>
                <div className="sad2-grid-2col-15">
                  <div className="sad-card">
                    <h3 className="sad2-flex-icon-row-mb">
                      <Send size={18} /> Neue Push-Nachricht senden
                    </h3>
                    <div className="form-group sad2-mb-1">
                      <label className="sad-form-label">Empfänger *</label>
                      <select value={newPushMessage.empfaenger_typ} onChange={(e) => setNewPushMessage({...newPushMessage, empfaenger_typ: e.target.value})} className="sad2-full-input">
                        <option value="alle">🌐 Alle (Verbandsmitglieder, Dojos & Mitglieder)</option>
                        <option value="verbandsmitglieder">🏆 Nur Verbandsmitglieder</option>
                        <option value="dojos">🏠 Nur Dojos (Dojo-Administratoren)</option>
                        <option value="mitglieder">👥 Nur Mitglieder in Dojos</option>
                      </select>
                    </div>
                    <div className="form-group sad2-mb-1">
                      <label className="sad-form-label">Priorität</label>
                      <select value={newPushMessage.prioritaet} onChange={(e) => setNewPushMessage({...newPushMessage, prioritaet: e.target.value})} className="sad2-full-input">
                        <option value="normal">📋 Normal</option>
                        <option value="wichtig">⚠️ Wichtig</option>
                        <option value="dringend">🚨 Dringend</option>
                      </select>
                    </div>
                    <div className="form-group sad2-mb-1">
                      <label className="sad-form-label">Titel *</label>
                      <input type="text" value={newPushMessage.titel} onChange={(e) => setNewPushMessage({...newPushMessage, titel: e.target.value})} placeholder="z.B. Neue Funktion verfügbar" className="sad2-full-input" />
                    </div>
                    <div className="form-group sad2-mb-15">
                      <label className="sad-form-label">Nachricht *</label>
                      <textarea value={newPushMessage.nachricht} onChange={(e) => setNewPushMessage({...newPushMessage, nachricht: e.target.value})} placeholder="Ihre Nachricht hier eingeben..." rows={4} className="sad-push-textarea" />
                    </div>
                    <button onClick={sendPushNotification} disabled={sendingPush || !newPushMessage.titel || !newPushMessage.nachricht} className="sad-push-send-btn">
                      <Send size={18} />
                      {sendingPush ? 'Wird gesendet...' : 'Push-Nachricht senden'}
                    </button>
                    <div className="sad-push-hint">
                      <strong>ℹ️ Hinweis:</strong> Push-Nachrichten werden sofort an alle ausgewählten Empfänger gesendet.
                    </div>
                  </div>
                  <div className="sad-card">
                    <div className="sad2-flex-between-center-mb">
                      <h3 className="sad2-flex-icon-row">
                        📥 Eingehende Benachrichtigungen
                        {unreadCount > 0 && <span className="sad-unread-badge">{unreadCount} neu</span>}
                      </h3>
                      <div className="u-flex-gap-sm">
                        <button onClick={markAllAsRead} disabled={unreadCount === 0} className="sad-tertiary-btn" title="Alle als gelesen markieren">
                          <CheckCircle size={14} /> Alle gelesen
                        </button>
                        <button onClick={loadNotifications} className="sad-refresh-btn" title="Aktualisieren">
                          <RefreshCw size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="sad2-flex-gap-05-mb">
                      {['unread','all','archived'].map(f => (
                        <button key={f} onClick={() => setNotificationFilter(f)} className={`sad-notif-filter-btn ${notificationFilter === f ? 'sad-notif-filter-btn--active' : ''}`}>
                          {f === 'unread' ? `Ungelesen (${unreadCount})` : f === 'all' ? 'Alle' : 'Archiv'}
                        </button>
                      ))}
                    </div>
                    {notificationsLoading ? (
                      <div className="sad-text-center-empty">Lade Benachrichtigungen...</div>
                    ) : notifications.filter(n => notificationFilter === 'unread' ? !n.gelesen : notificationFilter === 'archived' ? n.archiviert : true).length === 0 ? (
                      <div className="sad-text-center-empty">
                        <CheckCircle size={32} className="sad-empty-icon" /><br />Keine Benachrichtigungen
                      </div>
                    ) : (
                      <div className="sad-notif-scroll">
                        {notifications.filter(n => notificationFilter === 'unread' ? !n.gelesen : notificationFilter === 'archived' ? n.archiviert : true).map(notification => (
                          <div key={notification.id} className={`sad-notif-item ${!notification.gelesen ? 'sad-notif-item--unread' : ''}`}>
                            <span className="sad-notif-icon">{notification.typ === 'mitglied_registriert' ? '👤' : notification.typ === 'dojo_registriert' ? '🏠' : notification.typ === 'verbandsmitglied_registriert' ? '🏆' : '🔔'}</span>
                            <div className="u-flex-1">
                              <div className="sad-notif-titel">{notification.titel}</div>
                              <div className="sad-notif-nachricht">{notification.nachricht}</div>
                            </div>
                            <div className="sad-notif-btn-row">
                              {!notification.gelesen && <button onClick={() => markNotificationAsRead(notification.id)} className="sad2-icon-btn" title="Gelesen"><Eye size={14} /></button>}
                              <button onClick={() => archiveNotification(notification.id)} className="sad2-icon-btn" title="Archivieren"><Archive size={14} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {kommunikationSubTab === 'chat-zentrale' && (
              <SuperAdminChatZentraleWrapper token={token} />
            )}

            {kommunikationSubTab === 'support' && (
              <SupportTickets bereich="org" showAllBereiche={true} />
            )}

            {kommunikationSubTab === 'besucher-chat' && (
              <div style={{ height: 600 }}>
                <BesucherChat />
              </div>
            )}
          </div>
        )}

        {/* ═══ Verband ══════════════════════════════════════════════ */}
        {activeTab === 'verband' && (
          <div>
            {renderSubTabs('verband', [
              { id: 'verbandsmitglieder', icon: '🏆', label: 'Verbandsmitglieder' }
            ])}
            {subActiveTab.verband === 'verbandsmitglieder' && (
              <VerbandsMitglieder />
            )}
          </div>
        )}

        {/* ═══ Entwicklung ══════════════════════════════════════════ */}
        {activeTab === 'entwicklung' && (
          <ZieleEntwicklung bereich="org" />
        )}

        {/* ═══ Finanzen ══════════════════════════════════════════════ */}
        {activeTab === 'finanzen' && (
          <div>
            {renderSubTabs('finanzen', [
              { id: 'finanzen',     icon: '💰', label: 'Übersicht' },
              { id: 'lastschrift',  icon: '🏦', label: 'Lastschrift' },
              { id: 'buchhaltung',  icon: '📒', label: 'Buchhaltung' },
              { id: 'shop',         icon: '🛒', label: 'Shop' },
              { id: 'bestellungen', icon: '📦', label: 'Bestellungen' },
              { id: 'statistiken',  icon: '📈', label: 'Statistiken' }
            ])}

            {subActiveTab.finanzen === 'finanzen' && (
              <FinanzenTab token={token} />
            )}

            {subActiveTab.finanzen === 'lastschrift' && (
              <div className="lastschrift-management">
                <h2 className="section-title sad-section-header">
                  <CreditCard size={24} /> Lastschrift Verwaltung
                </h2>
                <div className="sub-tabs-horizontal sad2-mb-15">
                  <button className={`sub-tab-btn ${lastschriftSubTab === 'lastschriftlauf' ? 'active' : ''}`} onClick={() => setLastschriftSubTab('lastschriftlauf')}><CreditCard size={18} /><span>Neuer Lastschriftlauf</span></button>
                  <button className={`sub-tab-btn ${lastschriftSubTab === 'zahllaeufe' ? 'active' : ''}`} onClick={() => setLastschriftSubTab('zahllaeufe')}><FileText size={18} /><span>Zahlläufe-Übersicht</span></button>
                  <button className={`sub-tab-btn ${lastschriftSubTab === 'automatisch' ? 'active' : ''}`} onClick={() => setLastschriftSubTab('automatisch')}><Calendar size={18} /><span>Automatische Einzüge</span></button>
                </div>
                <div className="sub-tab-content sad-card">
                  {lastschriftSubTab === 'lastschriftlauf' && <Lastschriftlauf embedded={true} dojoIdOverride={2} />}
                  {lastschriftSubTab === 'zahllaeufe' && <Zahllaeufe embedded={true} />}
                  {lastschriftSubTab === 'automatisch' && <AutoLastschriftTab embedded={true} dojoIdOverride={2} />}
                </div>
              </div>
            )}

            {subActiveTab.finanzen === 'buchhaltung' && (
              <BuchhaltungTab token={token} />
            )}

            {subActiveTab.finanzen === 'shop' && (
              <ArtikelVerwaltung />
            )}

            {subActiveTab.finanzen === 'bestellungen' && (
              <section className="bestellungen-section">
                <h2 className="section-title">📦 Shop-Bestellungen</h2>
                {bestellungenStats && (
                  <div className="bestellungen-stats">
                    <div className="stat-card stat-offen" onClick={() => setBestellungenFilter('offen')}><span className="stat-number">{bestellungenStats.offen || 0}</span><span className="stat-label">Offen</span></div>
                    <div className="stat-card stat-bearbeitung" onClick={() => setBestellungenFilter('in_bearbeitung')}><span className="stat-number">{bestellungenStats.in_bearbeitung || 0}</span><span className="stat-label">In Bearbeitung</span></div>
                    <div className="stat-card stat-versendet" onClick={() => setBestellungenFilter('versendet')}><span className="stat-number">{bestellungenStats.versendet || 0}</span><span className="stat-label">Versendet</span></div>
                    <div className="stat-card stat-abgeschlossen" onClick={() => setBestellungenFilter('abgeschlossen')}><span className="stat-number">{bestellungenStats.abgeschlossen || 0}</span><span className="stat-label">Abgeschlossen</span></div>
                    <div className="stat-card stat-alle" onClick={() => setBestellungenFilter('alle')}><span className="stat-number">{bestellungenStats.gesamt || 0}</span><span className="stat-label">Gesamt</span></div>
                  </div>
                )}

            {/* Filter */}
            <div className="bestellungen-filter">
              <label>Status:</label>
              <select value={bestellungenFilter} onChange={(e) => setBestellungenFilter(e.target.value)}>
                <option value="alle">Alle</option>
                <option value="offen">Offen</option>
                <option value="in_bearbeitung">In Bearbeitung</option>
                <option value="versendet">Versendet</option>
                <option value="abgeschlossen">Abgeschlossen</option>
                <option value="storniert">Storniert</option>
              </select>
            </div>

            {/* Bestellungen-Liste */}
            {bestellungenLoading ? (
              <div className="loading-spinner">Lade Bestellungen...</div>
            ) : bestellungen.length === 0 ? (
              <div className="empty-state">
                <p>Keine Bestellungen gefunden.</p>
              </div>
            ) : (
              <div className="bestellungen-liste">
                {bestellungen.map(bestellung => (
                  <div
                    key={bestellung.id}
                    className={`bestellung-card ${selectedBestellung?.id === bestellung.id ? 'selected' : ''}`}
                    onClick={() => setSelectedBestellung(selectedBestellung?.id === bestellung.id ? null : bestellung)}
                  >
                    <div className="bestellung-header">
                      <span className="bestellung-nummer">{bestellung.bestellnummer}</span>
                      <span className={`bestellung-status status-${bestellung.status}`}>
                        {bestellung.status === 'offen' && '🟡 Offen'}
                        {bestellung.status === 'in_bearbeitung' && '🔵 In Bearbeitung'}
                        {bestellung.status === 'versendet' && '📬 Versendet'}
                        {bestellung.status === 'abgeschlossen' && '✅ Abgeschlossen'}
                        {bestellung.status === 'storniert' && '❌ Storniert'}
                      </span>
                    </div>
                    <div className="bestellung-info">
                      <div className="bestellung-kunde">
                        <strong>{bestellung.kunde_name}</strong>
                        <span>{bestellung.kunde_email}</span>
                        {bestellung.mitgliedsnummer && <span className="mitglied-nr">({bestellung.mitgliedsnummer})</span>}
                      </div>
                      <div className="bestellung-betrag">
                        <strong>{bestellung.gesamtbetrag_euro?.toFixed(2)} €</strong>
                        <span>{bestellung.anzahl_positionen} Artikel</span>
                      </div>
                      <div className="bestellung-datum">
                        {new Date(bestellung.bestellt_am).toLocaleDateString('de-DE', {
                          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>

                    {/* Aufgeklappte Details */}
                    {selectedBestellung?.id === bestellung.id && (
                      <div className="bestellung-details">
                        <div className="details-section">
                          <h4>Lieferadresse</h4>
                          <p>
                            {bestellung.lieferadresse_strasse}<br />
                            {bestellung.lieferadresse_plz} {bestellung.lieferadresse_ort}<br />
                            {bestellung.lieferadresse_land}
                          </p>
                        </div>

                        <div className="details-section">
                          <h4>Bestellte Artikel</h4>
                          <table className="positionen-table">
                            <thead>
                              <tr>
                                <th>Artikel</th>
                                <th>Variante</th>
                                <th>Menge</th>
                                <th>Preis</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bestellung.positionen?.map((pos, idx) => (
                                <tr key={idx}>
                                  <td>{pos.artikel_name}</td>
                                  <td>{pos.variante || '-'}</td>
                                  <td>{pos.menge}</td>
                                  <td>{(pos.gesamtpreis_cent / 100).toFixed(2)} €</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {bestellung.kundennotiz && (
                          <div className="details-section">
                            <h4>Kundennotiz</h4>
                            <p className="kundennotiz">{bestellung.kundennotiz}</p>
                          </div>
                        )}

                        <div className="details-section">
                          <h4>Status ändern</h4>
                          <div className="status-actions">
                            {bestellung.status === 'offen' && (
                              <button
                                className="btn btn-primary"
                                onClick={(e) => { e.stopPropagation(); updateBestellungStatus(bestellung.id, { status: 'in_bearbeitung' }); }}
                                disabled={bestellungUpdating}
                              >
                                In Bearbeitung nehmen
                              </button>
                            )}
                            {bestellung.status === 'in_bearbeitung' && (
                              <>
                                <input
                                  type="text"
                                  placeholder="Tracking-Nummer (optional)"
                                  className="tracking-input"
                                  onClick={(e) => e.stopPropagation()}
                                  id={`tracking-${bestellung.id}`}
                                />
                                <button
                                  className="btn btn-success"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const tracking = document.getElementById(`tracking-${bestellung.id}`).value;
                                    updateBestellungStatus(bestellung.id, { status: 'versendet', tracking_nummer: tracking });
                                  }}
                                  disabled={bestellungUpdating}
                                >
                                  Als versendet markieren
                                </button>
                              </>
                            )}
                            {bestellung.status === 'versendet' && (
                              <button
                                className="btn btn-success"
                                onClick={(e) => { e.stopPropagation(); updateBestellungStatus(bestellung.id, { status: 'abgeschlossen' }); }}
                                disabled={bestellungUpdating}
                              >
                                Abschließen
                              </button>
                            )}
                            {['offen', 'in_bearbeitung'].includes(bestellung.status) && (
                              <button
                                className="btn btn-danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm('Bestellung wirklich stornieren?')) {
                                    updateBestellungStatus(bestellung.id, { status: 'storniert' });
                                  }
                                }}
                                disabled={bestellungUpdating}
                              >
                                Stornieren
                              </button>
                            )}
                          </div>
                          {bestellung.tracking_nummer && (
                            <p className="tracking-info">
                              📦 Tracking: {bestellung.tracking_nummer}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
              </section>
            )}

            {subActiveTab.finanzen === 'statistiken' && (
              <StatisticsTab token={token} />
            )}
          </div>
        )}

        {/* ═══ Plattform-Zentrale ═══════════════════════════════════ */}
        {activeTab === 'plattform' && (
          <div>
            {renderSubTabs('plattform', [
              { id: 'zentrale',     icon: '🌐', label: 'Plattform-Zentrale' },
              { id: 'zugangsdaten', icon: '🔐', label: 'Zugangsdaten' },
            ])}
            {(subActiveTab.plattform ?? 'zentrale') === 'zentrale' && <PlattformZentrale />}
            {subActiveTab.plattform === 'zugangsdaten' && <PlattformZugangsdaten />}
          </div>
        )}

        {/* ═══ System ════════════════════════════════════════════════ */}
        {activeTab === 'system' && (
          <div>
            {renderSubTabs('system', [
              { id: 'benutzer',    icon: '👤', label: 'Benutzer' },
              { id: 'email',       icon: '✉️', label: 'E-Mail' },
              { id: 'passwoerter', icon: '🔑', label: 'Passwörter' },
              { id: 'security',    icon: '🛡️', label: 'Security' },
              { id: 'kalender',    icon: '📅', label: 'iCloud Kalender' }
            ])}

            {subActiveTab.system === 'benutzer' && (
              <UsersTab token={token} />
            )}

            {subActiveTab.system === 'email' && (
              <div className="section-card">
                <h3 className="sad2-flex-align-05-mb">
                  ✉️ Globale E-Mail-Einstellungen
                </h3>
                <p className="sad2-text-secondary-mb">
                  Diese Einstellungen werden als Fallback für alle Dojos verwendet, die keine eigenen SMTP-Daten hinterlegt haben.
                </p>
                {emailMessage && (
                  <div className={`sad-feedback-box ${emailMessage.includes('✅') ? 'sad-feedback-box--success' : 'sad-feedback-box--error'}`}>
                    {emailMessage}
                  </div>
                )}
                <div className="sad2-grid-2col-1">
                  <div className="form-group"><label>SMTP-Server</label><input type="text" value={emailSettings.smtp_host} onChange={(e) => setEmailSettings({ ...emailSettings, smtp_host: e.target.value })} placeholder="smtp.tda-intl.com" /></div>
                  <div className="form-group"><label>SMTP-Port</label><input type="number" value={emailSettings.smtp_port} onChange={(e) => setEmailSettings({ ...emailSettings, smtp_port: parseInt(e.target.value) || 587 })} placeholder="587" /></div>
                  <div className="form-group"><label>SMTP-Benutzer</label><input type="text" value={emailSettings.smtp_user} onChange={(e) => setEmailSettings({ ...emailSettings, smtp_user: e.target.value })} placeholder="E-Mail-Adresse für Login" /></div>
                  <div className="form-group"><label>SMTP-Passwort</label><input type="password" value={emailSettings.smtp_password} onChange={(e) => setEmailSettings({ ...emailSettings, smtp_password: e.target.value })} placeholder={emailSettings.has_password ? '********' : 'Passwort eingeben'} /></div>
                  <div className="form-group"><label>Absender-E-Mail</label><input type="email" value={emailSettings.default_from_email} onChange={(e) => setEmailSettings({ ...emailSettings, default_from_email: e.target.value })} placeholder="noreply@tda-intl.com" /></div>
                  <div className="form-group"><label>Absender-Name</label><input type="text" value={emailSettings.default_from_name} onChange={(e) => setEmailSettings({ ...emailSettings, default_from_name: e.target.value })} placeholder="DojoSoftware" /></div>
                </div>
                <div className="sad2-flex-align-gap-mb">
                  <label className="sad-flex-row"><input type="checkbox" checked={emailSettings.smtp_secure} onChange={(e) => setEmailSettings({ ...emailSettings, smtp_secure: e.target.checked })} /> TLS/SSL verwenden</label>
                  <label className="sad-flex-row"><input type="checkbox" checked={emailSettings.aktiv} onChange={(e) => setEmailSettings({ ...emailSettings, aktiv: e.target.checked })} /> E-Mail-Versand aktiviert</label>
                </div>
                <div className="sad2-flex-gap-1-mb2">
                  <button className="btn-primary u-flex-row-sm" onClick={saveEmailSettings} disabled={emailLoading} >
                    <Save size={18} /> {emailLoading ? 'Speichern...' : 'Einstellungen speichern'}
                  </button>
                </div>
                <hr className="sad2-hr" />
                <h4 className="sad2-mb-1">🧪 Test-E-Mail senden</h4>
                <div className="sad2-flex-gap-1-align-end">
                  <div className="form-group sad2-flex-1-no-mb">
                    <label>Test-E-Mail-Adresse</label>
                    <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="ihre-email@beispiel.de" />
                  </div>
                  <button className="btn-secondary sad2-mb-05" onClick={sendTestEmail} disabled={emailLoading || !testEmail}>
                    {emailLoading ? 'Sende...' : 'Test senden'}
                  </button>
                </div>
              </div>
            )}

            {subActiveTab.system === 'passwoerter' && (
              <PasswortVerwaltung />
            )}

            {subActiveTab.system === 'security' && (
              <SecurityDashboard />
            )}

            {subActiveTab.system === 'kalender' && (
              <div className="section-card">
                <h3 style={{ marginBottom: '0.5rem' }}>📅 Privater iCloud Kalender</h3>
                <p style={{ color: 'var(--text-3)', fontSize: '13px', marginBottom: '1.2rem' }}>
                  Trage die private iCal-URL deines Apple iCloud Kalenders ein. Du findest sie in der iCloud-Kalender-App unter
                  <strong> Kalender → ⓘ → Kalender-Abo-Link</strong> (privater Link aktivieren).
                  Termine werden stündlich gecacht und beim Anlegen neuer Termine automatisch auf Konflikte geprüft.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>iCal-URL (webcal:// oder https://)</label>
                    <input
                      type="url"
                      value={icalUrl}
                      onChange={e => setIcalUrl(e.target.value)}
                      placeholder="webcal://p62-caldav.icloud.com/published/2/..."
                      style={{ fontFamily: 'monospace', fontSize: '12px' }}
                    />
                  </div>
                  <button className="btn-primary" onClick={saveIcalUrl} style={{ whiteSpace: 'nowrap' }}>
                    Speichern &amp; Laden
                  </button>
                </div>
                {icalSaveMsg && (
                  <div className={`sad-feedback-box ${icalSaveMsg.includes('✅') ? 'sad-feedback-box--success' : 'sad-feedback-box--error'}`}>
                    {icalSaveMsg}
                  </div>
                )}
                {icalLoading && <div style={{ color: 'var(--text-3)', fontSize: '13px', marginTop: '1rem' }}>Lade Kalender…</div>}
                {!icalLoading && icalEvents.length > 0 && (
                  <>
                    <hr className="sad2-hr" />
                    <h4 style={{ marginBottom: '0.6rem' }}>Nächste Termine (90 Tage)</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {icalEvents.slice(0, 20).map((ev, i) => (
                        <div key={i} className="ical-event-row">
                          <span className="ical-event-date">
                            {new Date(ev.start).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                            {!ev.allDay && ' ' + new Date(ev.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="ical-event-summary">{ev.summary}</span>
                          {ev.location && <span className="ical-event-location">📍 {ev.location}</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {!icalLoading && icalEvents.length === 0 && icalUrl && (
                  <p style={{ color: 'var(--text-3)', fontSize: '13px', marginTop: '1rem' }}>
                    Keine Termine in den nächsten 90 Tagen — oder URL noch nicht gespeichert.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {false && activeTab === 'lastschrift_REMOVED' && (
          <div className="lastschrift-management">
            <h2 className="section-title sad-section-header">
              <CreditCard size={24} /> Lastschrift Verwaltung
            </h2>

            {/* Sub-Tab Navigation */}
            <div className="sub-tabs-horizontal sad2-mb-15">
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
            <div className="sub-tab-content sad-card">
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
        )}

        {/* Buchhaltung Tab - EÜR */}
        {activeTab === 'buchhaltung' && (
          <BuchhaltungTab token={token} />
        )}

        {activeTab === 'users' && (
          <UsersTab token={token} />
        )}

        {/* Pushnachrichten Tab */}
        {activeTab === 'pushnachrichten' && (
          <div className="pushnachrichten-tab">
            <h2 className="section-title sad-section-header">
              <Bell size={24} /> Pushnachrichten
            </h2>

            <div className="sad2-grid-2col-15">
              {/* Linke Seite: Push-Nachricht erstellen */}
              <div className="sad-card">
                <h3 className="sad2-flex-icon-row-mb">
                  <Send size={18} /> Neue Push-Nachricht senden
                </h3>

                <div className="form-group sad2-mb-1">
                  <label className="sad-form-label">Empfänger *</label>
                  <select
                    value={newPushMessage.empfaenger_typ}
                    onChange={(e) => setNewPushMessage({...newPushMessage, empfaenger_typ: e.target.value})}
                    className="sad2-full-input"
                  >
                    <option value="alle">🌐 Alle (Verbandsmitglieder, Dojos & Mitglieder)</option>
                    <option value="verbandsmitglieder">🏆 Nur Verbandsmitglieder</option>
                    <option value="dojos">🏠 Nur Dojos (Dojo-Administratoren)</option>
                    <option value="mitglieder">👥 Nur Mitglieder in Dojos</option>
                  </select>
                </div>

                <div className="form-group sad2-mb-1">
                  <label className="sad-form-label">Priorität</label>
                  <select
                    value={newPushMessage.prioritaet}
                    onChange={(e) => setNewPushMessage({...newPushMessage, prioritaet: e.target.value})}
                    className="sad2-full-input"
                  >
                    <option value="normal">📋 Normal</option>
                    <option value="wichtig">⚠️ Wichtig</option>
                    <option value="dringend">🚨 Dringend</option>
                  </select>
                </div>

                <div className="form-group sad2-mb-1">
                  <label className="sad-form-label">Titel *</label>
                  <input
                    type="text"
                    value={newPushMessage.titel}
                    onChange={(e) => setNewPushMessage({...newPushMessage, titel: e.target.value})}
                    placeholder="z.B. Neue Funktion verfügbar"
                    className="sad2-full-input"
                  />
                </div>

                <div className="form-group sad2-mb-15">
                  <label className="sad-form-label">Nachricht *</label>
                  <textarea
                    value={newPushMessage.nachricht}
                    onChange={(e) => setNewPushMessage({...newPushMessage, nachricht: e.target.value})}
                    placeholder="Ihre Nachricht hier eingeben..."
                    rows={4}
                    className="sad-push-textarea"
                  />
                </div>

                <button
                  onClick={sendPushNotification}
                  disabled={sendingPush || !newPushMessage.titel || !newPushMessage.nachricht}
                  className="sad-push-send-btn"
                >
                  <Send size={18} />
                  {sendingPush ? 'Wird gesendet...' : 'Push-Nachricht senden'}
                </button>

                <div className="sad-push-hint">
                  <strong>ℹ️ Hinweis:</strong> Push-Nachrichten werden sofort an alle ausgewählten Empfänger gesendet.
                  Diese erscheinen in deren Benachrichtigungs-Bereich.
                </div>
              </div>

              {/* Rechte Seite: Benachrichtigungen Inbox */}
              <div className="sad-card">
                <div className="sad2-flex-between-center-mb">
                  <h3 className="sad2-flex-icon-row">
                    📥 Eingehende Benachrichtigungen
                    {unreadCount > 0 && (
                      <span className="sad-unread-badge">
                        {unreadCount} neu
                      </span>
                    )}
                  </h3>
                  <div className="u-flex-gap-sm">
                    <button
                      onClick={markAllAsRead}
                      disabled={unreadCount === 0}
                      className="sad-tertiary-btn"
                      title="Alle als gelesen markieren"
                    >
                      <CheckCircle size={14} /> Alle gelesen
                    </button>
                    <button
                      onClick={loadNotifications}
                      className="sad-refresh-btn"
                      title="Aktualisieren"
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>
                </div>

                {/* Filter */}
                <div className="sad2-flex-gap-05-mb">
                  <button onClick={() => setNotificationFilter('unread')} className={`sad-notif-filter-btn ${notificationFilter === 'unread' ? 'sad-notif-filter-btn--active' : ''}`}>
                    Ungelesen
                  </button>
                  <button onClick={() => setNotificationFilter('all')} className={`sad-notif-filter-btn ${notificationFilter === 'all' ? 'sad-notif-filter-btn--active' : ''}`}>
                    Alle
                  </button>
                  <button onClick={() => setNotificationFilter('archived')} className={`sad-notif-filter-btn ${notificationFilter === 'archived' ? 'sad-notif-filter-btn--active' : ''}`}>
                    Archiv
                  </button>
                </div>

                {/* Benachrichtigungen Liste */}
                {notificationsLoading ? (
                  <div className="sad-text-center-empty">
                    Lade Benachrichtigungen...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="sad-text-center-empty">
                    {notificationFilter === 'archived' ? (
                      <>
                        <Archive size={32} className="sad2-mb-05-faded" /><br />
                        Keine archivierten Benachrichtigungen
                      </>
                    ) : notificationFilter === 'unread' ? (
                      <>
                        <CheckCircle size={32} className="sad2-mb-05-faded" /><br />
                        Alle Benachrichtigungen gelesen
                      </>
                    ) : (
                      <>
                        <Bell size={32} className="sad2-mb-05-faded" /><br />
                        Keine Benachrichtigungen
                      </>
                    )}
                  </div>
                ) : (
                  <div className="sad-notif-scroll sad-notif-scroll--tall">
                    {notifications.map((notification) => (
                      <div key={notification.id} className={`sad-notif-item ${!notification.gelesen ? 'sad-notif-item--unread' : ''} ${notification.archiviert ? 'sad-notif-item--archived' : ''}`}>
                        <span className="sad-notif-icon-lg">
                          {notification.typ === 'mitglied_registriert' ? '👤' :
                           notification.typ === 'dojo_registriert' ? '🏠' :
                           notification.typ === 'verbandsmitglied_registriert' ? '🏆' :
                           notification.prioritaet === 'dringend' ? '🚨' :
                           notification.prioritaet === 'wichtig' ? '⚠️' : '🔔'}
                        </span>
                        <div className="u-flex-1">
                          <div className={`sad-notif-title ${notification.gelesen ? 'sad-notif-title--read' : 'sad-notif-title--unread'}`}>
                            {notification.titel}
                            {!notification.gelesen && (
                              <span className="sad-notif-new-badge">NEU</span>
                            )}
                          </div>
                          <div className="sad-text-secondary-sm">
                            {notification.nachricht}
                          </div>
                          <div className="sad-notif-date">
                            {notification.erstellt_am ? new Date(notification.erstellt_am).toLocaleString('de-DE') : ''}
                          </div>
                        </div>
                        <div className="sad-notif-btn-row">
                          {!notification.gelesen && (
                            <button
                              onClick={() => markNotificationAsRead(notification.id)}
                              className="sad-notif-read-btn"
                              title="Als gelesen markieren"
                            >
                              <Eye size={14} />
                            </button>
                          )}
                          {!notification.archiviert && (
                            <button
                              onClick={() => archiveNotification(notification.id)}
                              className="sad-notif-archive-btn"
                              title="Archivieren"
                            >
                              <Archive size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* E-Mail-Einstellungen Tab */}
        {activeTab === 'email' && (
          <div className="tab-content">
            <div className="section-card">
              <h3 className="sad2-flex-align-05-mb">
                ✉️ Globale E-Mail-Einstellungen
              </h3>
              <p className="sad2-text-secondary-mb">
                Diese Einstellungen werden als Fallback für alle Dojos verwendet, die keine eigenen SMTP-Daten hinterlegt haben.
              </p>

              {emailMessage && (
                <div className={`sad-feedback-box ${emailMessage.includes('✅') ? 'sad-feedback-box--success' : 'sad-feedback-box--error'}`}>
                  {emailMessage}
                </div>
              )}

              <div className="sad2-grid-2col-1">
                <div className="form-group">
                  <label>SMTP-Server</label>
                  <input
                    type="text"
                    value={emailSettings.smtp_host}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtp_host: e.target.value })}
                    placeholder="z.B. smtp.tda-intl.com"
                  />
                </div>
                <div className="form-group">
                  <label>SMTP-Port</label>
                  <input
                    type="number"
                    value={emailSettings.smtp_port}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtp_port: parseInt(e.target.value) || 587 })}
                    placeholder="587"
                  />
                </div>
                <div className="form-group">
                  <label>SMTP-Benutzer</label>
                  <input
                    type="text"
                    value={emailSettings.smtp_user}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtp_user: e.target.value })}
                    placeholder="E-Mail-Adresse für Login"
                  />
                </div>
                <div className="form-group">
                  <label>SMTP-Passwort</label>
                  <input
                    type="password"
                    value={emailSettings.smtp_password}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtp_password: e.target.value })}
                    placeholder={emailSettings.has_password ? '********' : 'Passwort eingeben'}
                  />
                </div>
                <div className="form-group">
                  <label>Absender-E-Mail</label>
                  <input
                    type="email"
                    value={emailSettings.default_from_email}
                    onChange={(e) => setEmailSettings({ ...emailSettings, default_from_email: e.target.value })}
                    placeholder="noreply@tda-intl.com"
                  />
                </div>
                <div className="form-group">
                  <label>Absender-Name</label>
                  <input
                    type="text"
                    value={emailSettings.default_from_name}
                    onChange={(e) => setEmailSettings({ ...emailSettings, default_from_name: e.target.value })}
                    placeholder="DojoSoftware"
                  />
                </div>
              </div>

              <div className="sad2-flex-align-gap-mb">
                <label className="sad-flex-row">
                  <input
                    type="checkbox"
                    checked={emailSettings.smtp_secure}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtp_secure: e.target.checked })}
                  />
                  TLS/SSL verwenden
                </label>
                <label className="sad-flex-row">
                  <input
                    type="checkbox"
                    checked={emailSettings.aktiv}
                    onChange={(e) => setEmailSettings({ ...emailSettings, aktiv: e.target.checked })}
                  />
                  E-Mail-Versand aktiviert
                </label>
              </div>

              <div className="sad2-flex-gap-1-mb2">
                <button
                  className="btn-primary u-flex-row-sm"
                  onClick={saveEmailSettings}
                  disabled={emailLoading}
                >
                  <Save size={18} />
                  {emailLoading ? 'Speichern...' : 'Einstellungen speichern'}
                </button>
              </div>

              <hr className="sad2-hr" />

              <h4 className="sad2-mb-1">🧪 Test-E-Mail senden</h4>
              <p className="sad-email-test-hint">
                Senden Sie eine Test-E-Mail, um die Konfiguration zu prüfen.
              </p>
              <div className="sad2-flex-gap-1-align-end">
                <div className="form-group sad2-flex-1-no-mb">
                  <label>Test-E-Mail-Adresse</label>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="ihre-email@beispiel.de"
                  />
                </div>
                <button
                  className="btn-secondary sad2-mb-05"
                  onClick={sendTestEmail}
                  disabled={emailLoading || !testEmail}
                >
                  {emailLoading ? 'Sende...' : 'Test senden'}
                </button>
              </div>

              <div className="sad-email-info-box">
                <h4 className="sad-email-info-h4">ℹ️ So funktioniert das 3-Stufen-System</h4>
                <ol className="sad-email-info-ol">
                  <li className="sad2-mb-05"><strong>Eigene SMTP-Daten:</strong> Dojos können eigene Mailserver-Daten hinterlegen</li>
                  <li className="sad2-mb-05"><strong>TDA-E-Mail:</strong> Sie können Dojos eine @tda-intl.com Adresse zuweisen</li>
                  <li><strong>Zentraler Versand (Fallback):</strong> Diese globalen Einstellungen werden verwendet, wenn nichts anderes konfiguriert ist</li>
                </ol>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Modals für Create/Edit */}
      {showCreateModal && (
        <DojoFormModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadAllData();
          }}
          token={token}
        />
      )}

      {showEditModal && selectedDojo && (
        <DojoFormModal
          dojo={selectedDojo}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            loadAllData();
          }}
          token={token}
        />
      )}

      {/* Trial verlängern Modal */}
      {showExtendTrialModal && selectedDojo && (
        <div className="modal-overlay" onClick={() => setShowExtendTrialModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <Clock size={24} />
                Trial verlängern
              </h2>
              <button onClick={() => setShowExtendTrialModal(false)} className="modal-close">
                <XCircle size={20} />
              </button>
            </div>

            <div className="modal-body">
              <p><strong>Dojo:</strong> {selectedDojo.dojoname}</p>
              <p><strong>Aktuelles Trial-Ende:</strong> {new Date(selectedDojo.trial_ends_at).toLocaleDateString('de-DE')}</p>
              <p><strong>Verbleibende Tage:</strong> {selectedDojo.trial_days_remaining} Tage</p>

              <div className="form-group sad2-mt-15">
                <label>Trial verlängern um (Tage):</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={trialDays}
                  onChange={(e) => setTrialDays(parseInt(e.target.value))}
                  className="form-control"
                />
                <small className="sad2-text-secondary-block-mt">
                  Neues Trial-Ende: {new Date(new Date(selectedDojo.trial_ends_at).getTime() + trialDays * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE')}
                </small>
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowExtendTrialModal(false)} className="btn btn-secondary">
                Abbrechen
              </button>
              <button onClick={confirmExtendTrial} className="btn btn-warning">
                Trial verlängern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Abo aktivieren Modal */}
      {showActivateSubscriptionModal && selectedDojo && (
        <div className="modal-overlay" onClick={() => setShowActivateSubscriptionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <CheckCircle size={24} />
                Abonnement aktivieren
              </h2>
              <button onClick={() => setShowActivateSubscriptionModal(false)} className="modal-close">
                <XCircle size={20} />
              </button>
            </div>

            <div className="modal-body">
              <p><strong>Dojo:</strong> {selectedDojo.dojoname}</p>

              <div className="form-group sad2-mt-15">
                <label>Abo-Plan:</label>
                <select
                  value={subscriptionPlan}
                  onChange={(e) => setSubscriptionPlan(e.target.value)}
                  className="form-control"
                >
                  <option value="starter">Starter (49€/Monat)</option>
                  <option value="professional">Professional (89€/Monat)</option>
                  <option value="premium">Premium (149€/Monat)</option>
                  <option value="enterprise">Enterprise (249€/Monat)</option>
                  {isMainSuperAdmin && (
                    <>
                      <option value="free">🎁 Kostenloser Account (Lifetime)</option>
                      <option value="custom">⚙️ Flexibel/Custom</option>
                    </>
                  )}
                </select>
              </div>

              {/* Custom Pricing Felder - nur bei Plan "custom" */}
              {subscriptionPlan === 'custom' && isMainSuperAdmin && (
                <>
                  <div className="form-group">
                    <label>Custom Preis (€):</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      className="form-control"
                      placeholder="z.B. 39.99"
                    />
                  </div>

                  <div className="form-group">
                    <label>Notizen/Details:</label>
                    <textarea
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      className="form-control"
                      rows="3"
                      placeholder="z.B. Sonderkonditionen, Rabatte, besondere Vereinbarungen..."
                    />
                  </div>
                </>
              )}

              {/* Zahlungsintervall - nicht bei free */}
              {subscriptionPlan !== 'free' && (
                <div className="form-group">
                  <label>Zahlungsintervall:</label>
                  <select
                    value={subscriptionInterval}
                    onChange={(e) => setSubscriptionInterval(e.target.value)}
                    className="form-control"
                  >
                    <option value="monthly">Monatlich</option>
                    <option value="quarterly">Quartalsweise</option>
                    <option value="yearly">Jährlich</option>
                  </select>
                </div>
              )}

              {/* Laufzeit - nicht bei free */}
              {subscriptionPlan !== 'free' && (
                <div className="form-group">
                  <label>Laufzeit (Monate):</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={subscriptionDuration}
                    onChange={(e) => setSubscriptionDuration(parseInt(e.target.value))}
                    className="form-control"
                  />
                  <small className="sad2-text-secondary-block-mt">
                    Abo-Ende: {new Date(new Date().setMonth(new Date().getMonth() + subscriptionDuration)).toLocaleDateString('de-DE')}
                  </small>
                </div>
              )}

              {/* Hinweis bei Free */}
              {subscriptionPlan === 'free' && (
                <div className="sad-free-hint">
                  <strong>🎁 Kostenloser Account</strong><br />
                  Dieser Account hat unbegrenzten Zugriff ohne Ablaufdatum.
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowActivateSubscriptionModal(false)} className="btn btn-secondary">
                Abbrechen
              </button>
              <button onClick={confirmActivateSubscription} className="btn btn-success">
                Abo aktivieren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================
// DOJO FORM MODAL (Create/Edit)
// =============================================
const DojoFormModal = ({ dojo, onClose, onSuccess, token }) => {
  const isEdit = !!dojo;

  const [formData, setFormData] = useState({
    dojoname: dojo?.dojoname || '',
    subdomain: dojo?.subdomain || '',
    inhaber: dojo?.inhaber || '',
    email: dojo?.email || '',
    telefon: dojo?.telefon || '',
    strasse: dojo?.strasse || '',
    hausnummer: dojo?.hausnummer || '',
    plz: dojo?.plz || '',
    ort: dojo?.ort || '',
    land: dojo?.land || 'Deutschland',
    ist_aktiv: dojo?.ist_aktiv !== undefined ? dojo.ist_aktiv : true
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (isEdit) {
        // Update
        await axios.put(
          `/admin/dojos/${dojo.id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        alert('Dojo erfolgreich aktualisiert!');
      } else {
        // Create
        await axios.post(
          `/admin/dojos`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        alert('Dojo erfolgreich angelegt!');
      }

      onSuccess();
    } catch (err) {
      console.error('❌ Fehler beim Speichern:', err);
      setError(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Dojo bearbeiten' : 'Neues Dojo anlegen'}</h2>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="dojo-form">
          <div className="form-row">
            <div className="form-group">
              <label>Dojo-Name *</label>
              <input
                type="text"
                name="dojoname"
                value={formData.dojoname}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Subdomain *</label>
              <input
                type="text"
                name="subdomain"
                value={formData.subdomain}
                onChange={handleChange}
                placeholder="z.B. mein-dojo"
                required
              />
              <small>.dojo.tda-intl.org</small>
            </div>
          </div>

          <div className="form-group">
            <label>Inhaber *</label>
            <input
              type="text"
              name="inhaber"
              value={formData.inhaber}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>E-Mail</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Telefon</label>
              <input
                type="tel"
                name="telefon"
                value={formData.telefon}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-2">
              <label>Straße</label>
              <input
                type="text"
                name="strasse"
                value={formData.strasse}
                onChange={handleChange}
              />
            </div>

            <div className="form-group flex-1">
              <label>Hausnr.</label>
              <input
                type="text"
                name="hausnummer"
                value={formData.hausnummer}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>PLZ</label>
              <input
                type="text"
                name="plz"
                value={formData.plz}
                onChange={handleChange}
              />
            </div>

            <div className="form-group flex-2">
              <label>Ort</label>
              <input
                type="text"
                name="ort"
                value={formData.ort}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Land</label>
              <input
                type="text"
                name="land"
                value={formData.land}
                onChange={handleChange}
              />
            </div>
          </div>

          {isEdit && (
            <div className={`form-group sad-active-status-box ${formData.ist_aktiv ? 'sad-active-status-box--active' : 'sad-active-status-box--inactive'}`}>
              <label className="sad-active-status-label">
                <input
                  type="checkbox"
                  checked={formData.ist_aktiv}
                  onChange={(e) => setFormData(prev => ({ ...prev, ist_aktiv: e.target.checked }))}
                  className="sad-active-status-checkbox"
                />
                <span className={formData.ist_aktiv ? 'sad-active-status-text--active' : 'sad-active-status-text--inactive'}>
                  {formData.ist_aktiv ? '✓ Dojo ist aktiv' : '✗ Dojo ist inaktiv'}
                </span>
              </label>
            </div>
          )}

          {error && (
            <div className="error-message">
              <XCircle size={16} />
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={submitting}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Speichere...' : (isEdit ? 'Aktualisieren' : 'Anlegen')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SUPER-ADMIN CHAT-ZENTRALE WRAPPER
// Kombiniert Monitoring-Ansicht + Eigener Chat (AdminChatPage)
// ─────────────────────────────────────────────────────────────────────────────
const SuperAdminChatZentraleWrapper = ({ token }) => {
  const [chatTab, setChatTab] = useState('monitoring'); // 'monitoring' | 'eigener-chat'
  return (
    <div>
      <div className="sad-chat-sub-tabs">
        <button
          className={`sad-chat-sub-tab ${chatTab === 'monitoring' ? 'sad-chat-sub-tab--active' : ''}`}
          onClick={() => setChatTab('monitoring')}
        >
          📊 Monitoring
        </button>
        <button
          className={`sad-chat-sub-tab ${chatTab === 'eigener-chat' ? 'sad-chat-sub-tab--active' : ''}`}
          onClick={() => setChatTab('eigener-chat')}
        >
          💬 Eigener Chat
        </button>
      </div>
      {chatTab === 'monitoring' && <SuperAdminChatZentrale token={token} />}
      {chatTab === 'eigener-chat' && (
        <div className="sad-chat-embedded">
          <AdminChatPage />
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SUPER-ADMIN CHAT-ZENTRALE
// Zeigt alle Chat-Räume aller Dojos — nur für Super-Admins
// ─────────────────────────────────────────────────────────────────────────────
const SuperAdminChatZentrale = ({ token }) => {
  const [allRooms, setAllRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = React.useRef(null);

  const TYPE_CONFIG = {
    direct:       { icon: '💬', label: 'Direkt',       color: 'var(--text-muted)', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.25)' },
    group:        { icon: '👥', label: 'Gruppe',        color: 'var(--color-info-400)', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.25)'  },
    announcement: { icon: '📣', label: 'Ankündigung',  color: '#daa520', bg: 'rgba(218,165,32,0.12)',  border: 'rgba(218,165,32,0.25)'  },
  };

  const loadAllRooms = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/chat/admin/all-rooms', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setAllRooms(data.rooms || []);
      else setError(data.message || 'Fehler beim Laden');
    } catch (e) {
      setError('Verbindungsfehler: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadAllRooms(); }, [loadAllRooms]);

  const loadMessages = async (room) => {
    setActiveRoom(room);
    setMsgLoading(true);
    setMessages([]);
    try {
      const res = await fetch(`/api/chat/rooms/${room.id}/messages?dojo_id=${room.dojo_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setMessages(data.messages || []);
    } catch (e) {} finally { setMsgLoading(false); }
  };

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMsg.trim() || !activeRoom || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/chat/rooms/${activeRoom.id}/messages?dojo_id=${activeRoom.dojo_id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMsg.trim() })
      });
      const data = await res.json();
      if (data.success) { setMessages(prev => [...prev, data.message]); setNewMsg(''); }
    } catch (e) {} finally { setSending(false); }
  };

  // Stats
  const totalUnread = allRooms.reduce((s, r) => s + (r.unread_count || 0), 0);
  const uniqueDojos = new Set(allRooms.map(r => r.dojo_id)).size;

  // Filter
  const filteredRooms = React.useMemo(() => allRooms.filter(r => {
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return r.name?.toLowerCase().includes(q) || r.dojo_name?.toLowerCase().includes(q);
    }
    return true;
  }), [allRooms, typeFilter, searchQuery]);

  // Group by dojo
  const groupedByDojo = React.useMemo(() => {
    const map = new Map();
    filteredRooms.forEach(r => {
      const key = r.dojo_id ?? 0;
      if (!map.has(key)) map.set(key, { dojo_id: r.dojo_id, dojo_name: r.dojo_name || 'System', rooms: [] });
      map.get(key).rooms.push(r);
    });
    return [...map.values()].sort((a, b) => a.dojo_name.localeCompare(b.dojo_name));
  }, [filteredRooms]);

  const filterTabs = [
    { id: 'all',          label: 'Alle',          count: allRooms.length },
    { id: 'announcement', label: 'Ankündigungen', count: allRooms.filter(r => r.type === 'announcement').length },
    { id: 'group',        label: 'Gruppen',       count: allRooms.filter(r => r.type === 'group').length },
    { id: 'direct',       label: 'Direkt',        count: allRooms.filter(r => r.type === 'direct').length },
  ];

  const getInitials = (name) => (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const fmtTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const diff = Date.now() - d;
    if (diff < 86400000) return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="sad-chat-wrapper">

      {/* ── Top Header ── */}
      <div className="sad-chat-topbar">
        <MessageCircle size={17} className="u-flex-shrink-accent" />
        <span className="sad-chat-title">Chat-Zentrale</span>
        <div className="sad-chat-stats">
          {[
            { v: allRooms.length, l: 'Räume' },
            { v: uniqueDojos, l: 'Dojos' },
            { v: totalUnread, l: 'Ungelesen', accent: totalUnread > 0 },
          ].map(s => (
            <span key={s.l} className={`sad-stats-item ${s.accent ? 'sad-stats-item--accent' : ''}`}>
              <strong className={`sad-stats-value ${s.accent ? 'sad-stats-value--accent' : ''}`}>{s.v}</strong>{s.l}
            </span>
          ))}
        </div>
        <button onClick={loadAllRooms} className="sad-chat-refresh-btn" title="Aktualisieren">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="sad-chat-body">

        {/* ── Left Sidebar ── */}
        <div className="sad-chat-sidebar">

          {/* Search */}
          <div className="sad-chat-search-wrap">
            <div className="sad-chat-search-inner">
              <Search size={12} className="sad-search-icon" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Raum oder Dojo suchen…"
                className="sad-chat-search-input"
              />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="sad-chat-filter-row">
            {filterTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setTypeFilter(tab.id)}
                className={`sad-type-filter-btn ${typeFilter === tab.id ? 'sad-type-filter-btn--active' : ''}`}
              >
                {tab.label}{tab.count > 0 && <span className="sad-type-filter-count">({tab.count})</span>}
              </button>
            ))}
          </div>

          {/* Room List */}
          <div className="sad-chat-room-list">
            {loading ? (
              <div className="sad-chat-loading">
                <div className="sad-chat-spinner" />
                Lade Räume…
              </div>
            ) : error ? (
              <div className="sad-chat-error">{error}</div>
            ) : groupedByDojo.length === 0 ? (
              <div className="sad-chat-empty">Keine Räume gefunden</div>
            ) : groupedByDojo.map(group => (
              <div key={group.dojo_id ?? 'sys'}>
                {/* Dojo Section Header */}
                <div className="sad-chat-group-header">
                  <span className="sad-chat-group-label">🥋 {group.dojo_name}</span>
                  <span className="sad-chat-group-count">{group.rooms.length}</span>
                </div>

                {group.rooms.map(room => {
                  const tc = TYPE_CONFIG[room.type] || TYPE_CONFIG.group;
                  const isActive = activeRoom?.id === room.id;
                  return (
                    <div
                      key={room.id}
                      onClick={() => loadMessages(room)}
                      className={`sad-chat-room-item ${isActive ? 'sad-chat-room-item--active' : ''}`}
                      style={{ '--tc-bg': tc.bg, '--tc-border': tc.border, '--tc-color': tc.color }}
                    >
                      <div
                        className="sad-chat-room-icon"
                        style={room.type === 'group' && room.avatar_emoji ? {
                          background: room.avatar_color || '#4f7cff',
                          color: 'white',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.1rem'
                        } : {}}
                      >
                        {room.type === 'group' && room.avatar_emoji ? room.avatar_emoji : tc.icon}
                      </div>
                      <div className="u-flex-1-min0">
                        <div className="sad-chat-room-item-row">
                          <span className={`sad-chat-room-name-text ${isActive ? 'sad-chat-room-name-text--active' : ''}`}>
                            {room.name || `${tc.label} #${room.id}`}
                          </span>
                          {room.unread_count > 0 && (
                            <span className="sad-chat-unread-badge">
                              {room.unread_count > 99 ? '99+' : room.unread_count}
                            </span>
                          )}
                        </div>
                        <div className="sad-chat-room-sub-row">
                          <span className="sad-chat-room-type-label">{tc.label}</span>
                          {room.last_message && (
                            <>
                              <span className="sad-chat-separator">·</span>
                              <span className="sad-chat-room-last-msg">
                                {room.last_message.substring(0, 35)}{room.last_message.length > 35 ? '…' : ''}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* ── Chat Window ── */}
        <div className="sad-chat-window">
          {!activeRoom ? (
            <div className="sad-chat-placeholder">
              <MessageCircle size={42} className="sad-chat-placeholder-icon" />
              <span className="sad-chat-placeholder-text">Chat-Raum auswählen</span>
            </div>
          ) : (() => {
            const tc = TYPE_CONFIG[activeRoom.type] || TYPE_CONFIG.group;
            return (
              <>
                {/* Chat Header */}
                <div className="sad-chat-room-header" style={{ '--tc-bg': tc.bg, '--tc-border': tc.border, '--tc-color': tc.color }}>
                  <div className="sad-chat-header-icon">
                    {tc.icon}
                  </div>
                  <div className="u-flex-1-min0">
                    <div className="sad-chat-room-name">
                      {activeRoom.name || `${tc.label} #${activeRoom.id}`}
                    </div>
                    <div className="sad-chat-room-meta">
                      <span>🥋 {activeRoom.dojo_name}</span>
                      <span className="sad2-opacity-035">·</span>
                      <span className="sad-chat-header-type">{tc.label}</span>
                      {activeRoom.member_count > 0 && <><span className="sad2-opacity-035">·</span><span>{activeRoom.member_count} Mitglieder</span></>}
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="sad-chat-messages">
                  {msgLoading ? (
                    <div className="sad-chat-msg-loading">Lade Nachrichten…</div>
                  ) : messages.length === 0 ? (
                    <div className="sad-chat-msg-empty">Noch keine Nachrichten in diesem Raum</div>
                  ) : messages.map(msg => {
                    const isAdmin = msg.sender_type === 'admin';
                    return (
                      <div key={msg.id} className={`sad-msg-wrapper ${isAdmin ? 'sad-msg-wrapper--admin' : ''}`}>
                        <div className={`sad-msg-header ${isAdmin ? 'sad-msg-header--admin' : ''}`}>
                          <div className={`sad-msg-avatar ${isAdmin ? 'sad-msg-avatar--admin' : 'sad-msg-avatar--member'}`}>
                            {getInitials(msg.sender_name || msg.sender_type)}
                          </div>
                          <span className="sad-msg-sender">{msg.sender_name || msg.sender_type}</span>
                          <span className="sad-msg-time">{fmtTime(msg.sent_at)}</span>
                        </div>
                        <div className={`sad-msg-bubble ${isAdmin ? 'sad-msg-bubble--admin' : 'sad-msg-bubble--member'} ${msg.deleted_at ? 'sad-msg-bubble--deleted' : ''}`}>
                          {msg.deleted_at ? <em>Nachricht gelöscht</em> : msg.content}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="sad-chat-input-row">
                  <input
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder={`Nachricht an „${activeRoom.name || tc.label}" …`}
                    className="sad-chat-input"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMsg.trim() || sending}
                    className={`sad-chat-send-btn ${newMsg.trim() ? 'sad-chat-send-btn--active' : 'sad-chat-send-btn--empty'}`}
                  >
                    <Send size={14} />
                    {sending ? '…' : 'Senden'}
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
