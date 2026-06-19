// =============================================
// SUPER-ADMIN DASHBOARD - Tiger & Dragon Association International
// =============================================
// Nur sichtbar wenn Dojo-ID = 2 (TDA International) ausgewählt

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config';
import {
  Building2, Users, TrendingUp, Globe, Plus, Edit, Trash2,
  CheckCircle, XCircle, BarChart3, Activity, Award, Calendar, HardDrive, Clock, AlertTriangle,
  ChevronDown, ChevronUp, LayoutDashboard, PieChart, DollarSign, FileText, UserCog, CreditCard, Save, ToggleLeft, ToggleRight, Euro, Ticket,
  Bell, Send, Archive, Eye, EyeOff, RefreshCw, UserPlus, Home, MessageCircle, MessageSquare, Search, Sparkles
} from 'lucide-react';
import '../styles/SuperAdminDashboard.css';
import TodoPanel from './TodoPanel';
import HeuteTab from './HeuteTab';
import CronStatus from './CronStatus';
import SslWarnungen from './SslWarnungen';
import JahreszieleProgress from './JahreszieleProgress';
import LastschriftAutoProtokollBanner from './LastschriftAutoProtokollBanner';
import StilErinnerungBanner from './StilErinnerungBanner';

// Lazy-load all tab-specific components so they don't block initial render
const ContractsTab        = lazy(() => import('./ContractsTab'));
const UsersTab            = lazy(() => import('./UsersTab'));
const SuperAdminFinanzen  = lazy(() => import('./SuperAdminFinanzen'));
const FehlendeMandateTab  = lazy(() => import('./FinanzenTab').then(m => ({ default: m.FehlendeMandateTab || (() => null) })));
const BuchhaltungTab      = lazy(() => import('./BuchhaltungTab'));
const ZieleEntwicklung    = lazy(() => import('./ZieleEntwicklung'));
const SupportTickets      = lazy(() => import('./SupportTickets'));
const KampagnenDashboard  = lazy(() => import('./KampagnenDashboard'));
const VerbandsMitglieder  = lazy(() => import('./VerbandsMitglieder'));
const ArtikelVerwaltung   = lazy(() => import('./ArtikelVerwaltung'));
const AutoLastschriftTab  = lazy(() => import('./AutoLastschriftTab'));
const Lastschriftlauf     = lazy(() => import('./Lastschriftlauf'));
const Zahllaeufe          = lazy(() => import('./Zahllaeufe'));
const PasswortVerwaltung  = lazy(() => import('./PasswortVerwaltung'));
const DojoLizenzverwaltung = lazy(() => import('./DojoLizenzverwaltung'));
const AkquiseDashboard    = lazy(() => import('./AkquiseDashboard'));
const AdminChatPage       = lazy(() => import('./chat/AdminChatPage'));
const BesucherChat        = lazy(() => import('./chat/BesucherChat'));
const SecurityDashboard   = lazy(() => import('./SecurityDashboard'));
const SuperAdminMarketing = lazy(() => import('./SuperAdminMarketing'));
const BackupEinstellungen = lazy(() => import('./BackupEinstellungen'));
const DokumentenZentrale  = lazy(() => import('./DokumentenZentrale'));
const Auswertungen        = lazy(() => import('./Auswertungen'));
const PlattformZentrale   = lazy(() => import('./PlattformZentrale'));
const PlattformZugangsdaten = lazy(() => import('./PlattformZugangsdaten'));
const AppsMonitor           = lazy(() => import('./AppsMonitor'));
const AuditTrailTab         = lazy(() => import('./AuditTrailTab'));
const PlatformStatusTab     = lazy(() => import('./PlatformStatusTab'));
const OnboardingStatusTab   = lazy(() => import('./OnboardingStatusTab'));
const MRRTab                = lazy(() => import('./MRRTab'));
const InfraChecks           = lazy(() => import('./InfraChecks'));
const WachstumPrognose      = lazy(() => import('./WachstumPrognose'));

const TabLoader = () => <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Lädt…</div>;

// Produkt-Sektionen + Briefing (ausgelagert in eigene Dateien)
import EventSoftwareSection from './EventSoftwareSection';
import AcademySection from './AcademySection';
import HofLiveSection from './HofLiveSection';
import DailyBriefing from './DailyBriefing';
import MailBannerVerwaltung from './MailBannerVerwaltung';
import ShopBestellungen from './ShopBestellungen';
import CommandPalette from './CommandPalette';


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
  const [turniereList, setTurniereList] = useState(null); // Roh-Liste für EventSoftwareSection (kein Doppel-Load)
  const [academyStats, setAcademyStats] = useState(null);

  // State für Dojo-Management
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDojo, setSelectedDojo] = useState(null);

  // State für Trial-Management
  const [showExtendTrialModal, setShowExtendTrialModal] = useState(false);
  const [showActivateSubscriptionModal, setShowActivateSubscriptionModal] = useState(false);
  const [trialDays, setTrialDays] = useState(14);
  const [aboForm, setAboForm] = useState({ plan: 'starter', interval: 'monthly', duration: 12, customPrice: '', customNotes: '' });
  const subscriptionPlan     = aboForm.plan;
  const subscriptionInterval = aboForm.interval;
  const subscriptionDuration = aboForm.duration;
  const customPrice          = aboForm.customPrice;
  const customNotes          = aboForm.customNotes;
  const setSubscriptionPlan     = v => setAboForm(f => ({ ...f, plan: v }));
  const setSubscriptionInterval = v => setAboForm(f => ({ ...f, interval: v }));
  const setSubscriptionDuration = v => setAboForm(f => ({ ...f, duration: v }));
  const setCustomPrice          = v => setAboForm(f => ({ ...f, customPrice: v }));
  const setCustomNotes          = v => setAboForm(f => ({ ...f, customNotes: v }));
  const [isMainSuperAdmin, setIsMainSuperAdmin] = useState(false);
  const [expandedDojos, setExpandedDojos] = useState(new Set());

  // State für Daily Briefing Popup
  const [showDailyBriefing, setShowDailyBriefing] = useState(false);
  const [sslWarnings, setSslWarnings] = useState([]);
  // State für Tab-Navigation — ☀️ Heute ist die Standard-Ansicht.
  // Deep-Link ?pz=<tab> (z.B. aus Termin-Klicks) öffnet direkt die Plattform-Zentrale.
  const [activeTab, setActiveTab] = useState(() =>
    new URLSearchParams(window.location.search).get('pz') ? 'plattform' : 'heute'
  );
  // State für Sub-Tabs pro Gruppe
  const [subActiveTab, setSubActiveTab] = useState({
    dojosoftware: 'lizenzen',
    verband: 'verbandsmitglieder',
    finanzen: 'finanzen',
    system: 'status',
    plattform: 'zentrale',
    entwicklung: 'ziele',
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
  const [myFeedUrl, setMyFeedUrl] = useState('');
  const [myFeedWebcalUrl, setMyFeedWebcalUrl] = useState('');
  const [feedCopied, setFeedCopied] = useState(false);

  // Verbands-Fremdtermine (andere Kampfsportverbände)
  const [fremdtermine, setFremdtermine] = useState([]);
  const [ftLoading, setFtLoading] = useState(false);
  const [ftMsg, setFtMsg] = useState('');
  const [ftSyncing, setFtSyncing] = useState(false);
  const [ftEditId, setFtEditId] = useState(null);
  const ftEmptyForm = { verband: 'DKV', titel: '', start_datum: '', end_datum: '', ort: '', region: '', quelle_url: '', notiz: '' };
  const [ftForm, setFtForm] = useState(ftEmptyForm);

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

  // Daten laden beim Mount — nur kritische interne Calls
  useEffect(() => {
    loadAllData();
    loadSubscriptionPlans();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError('');

    try {
      // Phase 1: Kritische interne Calls — schnell, blockieren Loading-State
      const [tdaRes, globalRes, overviewRes] = await Promise.allSettled([
        axios.get('/admin/tda-stats',        { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/admin/global-stats',     { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/admin/overview-summary', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (tdaRes.status === 'fulfilled')     setTdaStats(tdaRes.value.data.stats);
      if (globalRes.status === 'fulfilled')  setGlobalStats(globalRes.value.data.stats);
      if (overviewRes.status === 'fulfilled' && overviewRes.value.data.success) setOverviewSummary(overviewRes.value.data);

      // Daily Briefing Popup: einmal pro Tag beim ersten Login
      const today = new Date().toDateString();
      if (localStorage.getItem('sa-briefing-day') !== today) {
        setShowDailyBriefing(true);
      }

    } catch (err) {
      console.error('❌ Fehler beim Laden der Super-Admin Daten:', err);
      const errMsg = err.response?.data?.message;
      setError(typeof errMsg === 'string' ? errMsg : 'Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }

    // Phase 2: Hintergrund-Calls — blockieren NICHT den Loading-State
    // Dojos ohne Storage (schnell), externe Services, SSL (langsam)
    const authHeader = { Authorization: `Bearer ${token}` };
    const fetchWithTimeout = (url, timeout = 5000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      return fetch(url, { signal: controller.signal }).then(r => r.json()).finally(() => clearTimeout(id));
    };

    Promise.allSettled([
      axios.get('/admin/dojos?include_storage=false', { headers: authHeader }),
      axios.get('/plattform-zentrale/turniere',        { headers: authHeader }),
      fetchWithTimeout('https://hof.tda-intl.org/api/stats/overview', 5000),
      fetchWithTimeout('https://academy.tda-intl.org/api/admin/public-stats', 5000),
      axios.get('/admin/ssl-status', { headers: authHeader }),
    ]).then(([dojosRes, evResult, hofResult, acResult, sslResult]) => {
      if (dojosRes.status === 'fulfilled')   setDojos(dojosRes.value.data.dojos);

      if (evResult.status === 'fulfilled') {
        const turniere = evResult.value.data?.turniere || [];
        setTurniereList(turniere);
        const heute = new Date(); heute.setHours(0, 0, 0, 0);
        const upcoming = turniere.filter(t => new Date(t.start_datum || t.datum) >= heute);
        const offen = turniere.filter(t => t.anmeldeschluss && new Date(t.anmeldeschluss) >= heute);
        const naechstes = upcoming.sort((a, b) => new Date(a.start_datum || a.datum) - new Date(b.start_datum || b.datum))[0];
        setEventStats({ gesamt: turniere.length, upcoming: upcoming.length, offen: offen.length, naechstes });
      }

      if (hofResult.status === 'fulfilled' && hofResult.value?.success) setHofStats(hofResult.value.stats);
      if (acResult.status === 'fulfilled' && acResult.value?.success) setAcademyStats(acResult.value.stats);
      if (sslResult.status === 'fulfilled' && sslResult.value?.data?.success) setSslWarnings(sslResult.value.data.warnings || []);
    });
  };

  const closeBriefing = () => {
    localStorage.setItem('sa-briefing-day', new Date().toDateString());
    setShowDailyBriefing(false);
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

  const loadMyFeedUrl = async () => {
    try {
      const r = await axios.get('/admin/calendar/my-feed-url', { headers: { Authorization: `Bearer ${token}` } });
      if (r.data.success) {
        setMyFeedUrl(r.data.feedUrl || '');
        setMyFeedWebcalUrl(r.data.webcalUrl || '');
      }
    } catch (e) { console.error('feed url:', e); }
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

  // ── Verbands-Fremdtermine ───────────────────────────────────────────────────
  const ftErr = (e) => {
    const raw = e.response?.data?.error ?? e.response?.data?.message ?? e.message;
    return typeof raw === 'object' ? JSON.stringify(raw) : raw;
  };

  const loadFremdtermine = async () => {
    setFtLoading(true);
    try {
      const r = await axios.get('/admin/calendar/fremdtermine', { headers: { Authorization: `Bearer ${token}` } });
      if (r.data.success) setFremdtermine(r.data.termine || []);
    } catch (e) { console.error('fremdtermine:', e); }
    finally { setFtLoading(false); }
  };

  const resetFtForm = () => { setFtForm(ftEmptyForm); setFtEditId(null); };

  const saveFremdtermin = async () => {
    if (!ftForm.titel.trim() || !ftForm.start_datum) {
      setFtMsg('❌ Titel und Startdatum sind Pflicht');
      setTimeout(() => setFtMsg(''), 3000);
      return;
    }
    try {
      const payload = { ...ftForm, status: 'bestaetigt' };
      if (ftEditId) {
        await axios.put(`/admin/calendar/fremdtermine/${ftEditId}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        setFtMsg('✅ Termin aktualisiert');
      } else {
        await axios.post('/admin/calendar/fremdtermine', payload, { headers: { Authorization: `Bearer ${token}` } });
        setFtMsg('✅ Termin gespeichert');
      }
      resetFtForm();
      loadFremdtermine();
      setTimeout(() => setFtMsg(''), 3000);
    } catch (e) {
      setFtMsg('❌ ' + ftErr(e));
    }
  };

  const editFremdtermin = (t) => {
    setFtEditId(t.id);
    setFtForm({
      verband: t.verband || 'DKV',
      titel: t.titel || '',
      start_datum: (t.start_datum || '').slice(0, 10),
      end_datum: (t.end_datum || '').slice(0, 10),
      ort: t.ort || '', region: t.region || '',
      quelle_url: t.quelle_url || '', notiz: t.notiz || ''
    });
  };

  const confirmFremdtermin = async (id) => {
    try {
      await axios.put(`/admin/calendar/fremdtermine/${id}`, { status: 'bestaetigt' }, { headers: { Authorization: `Bearer ${token}` } });
      loadFremdtermine();
    } catch (e) { setFtMsg('❌ ' + ftErr(e)); }
  };

  const deleteFremdtermin = async (id) => {
    if (!window.confirm('Diesen Verbands-Termin wirklich löschen?')) return;
    try {
      await axios.delete(`/admin/calendar/fremdtermine/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (ftEditId === id) resetFtForm();
      loadFremdtermine();
    } catch (e) { setFtMsg('❌ ' + ftErr(e)); }
  };

  const syncFremdtermine = async () => {
    setFtSyncing(true);
    setFtMsg('🔄 Suche Verbands-Turniere im Web … das kann ~30 Sek dauern.');
    try {
      const r = await axios.post('/admin/calendar/fremdtermine/sync', {}, { headers: { Authorization: `Bearer ${token}` }, timeout: 120000 });
      if (r.data.success) {
        setFtMsg(`✅ Sync fertig: ${r.data.inserted} neu, ${r.data.skipped} übersprungen (von ${r.data.found} gefunden). Bitte unten prüfen & bestätigen.`);
        loadFremdtermine();
      } else {
        setFtMsg('❌ ' + (r.data.error || 'Sync fehlgeschlagen'));
      }
    } catch (e) {
      setFtMsg('❌ ' + ftErr(e));
    } finally {
      setFtSyncing(false);
      setTimeout(() => setFtMsg(''), 8000);
    }
  };

  // Tab-Navigation von Unterkomponenten (z.B. „Zu den Kontakten" in der Lizenzverwaltung)
  useEffect(() => {
    const handler = (e) => { if (e.detail?.tab) setActiveTab(e.detail.tab); };
    window.addEventListener('sa-navigate', handler);
    return () => window.removeEventListener('sa-navigate', handler);
  }, []);

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
      loadMyFeedUrl();
      loadFremdtermine();
    }
  }, [activeTab, subActiveTab.system]);

  // Lade Aktivitäten + Benachrichtigungen erst wenn relevante Tabs geöffnet werden
  useEffect(() => {
    if (activeTab === 'overview') loadActivities();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'plattform' && subActiveTab.plattform === 'kommunikation' && kommunikationSubTab === 'pushnachrichten') {
      loadNotifications();
    }
  }, [activeTab, subActiveTab.plattform, kommunikationSubTab, notificationFilter]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setAboForm({ plan: 'basic', interval: 'monthly', duration: 12, customPrice: '', customNotes: '' });
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
    { id: 'heute',         label: 'Heute',          icon: '☀️' },
    { id: 'plattform',     label: 'Dashboard',      icon: '🌐', badge: unreadCount > 0 ? unreadCount : null },
    { id: 'overview',      label: 'Cockpit',        icon: '🎛️' },
    { id: 'todos',         label: 'To Do',          icon: '✅' },
    { id: 'verband',       label: 'Verband',        icon: '🏆' },
    { id: 'kontakte',      label: 'Kontakte',       icon: '🗂️' },
    { id: 'software',      label: 'Software',       icon: '💻' },
    { id: 'finanzen',      label: 'Finanzen',       icon: '💰' },
    { id: 'entwicklung',   label: 'Entwicklung',    icon: '🎯' },
    { id: 'system',        label: 'System',         icon: '⚙️' },
  ];

  // Sub-Tab-Navigation rendern
  // Zentrale Tab-Navigation — 'kommunikation' ist jetzt Unter-Tab im Dashboard (plattform)
  const navigateTab = (tab) => {
    if (tab === 'kommunikation') {
      setActiveTab('plattform');
      setSubTab('plattform', 'kommunikation');
    } else {
      setActiveTab(tab);
    }
  };

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

  return (
    <div className="super-admin-dashboard">

      {/* ── Cmd+K Command-Palette (globale Suche) ──────────────────── */}
      <CommandPalette onNavigate={navigateTab} />

      {/* ── Daily Briefing Popup (ausgelagert: DailyBriefing.jsx) ──── */}
      {showDailyBriefing && (
        <DailyBriefing
          globalStats={globalStats}
          overviewSummary={overviewSummary}
          unreadCount={unreadCount}
          sslWarnings={sslWarnings}
          onClose={closeBriefing}
          onNavigate={(tab) => { closeBriefing(); navigateTab(tab); }}
        />
      )}

      {/* Tab Navigation - wie im normalen Dashboard */}
      <div className="dashboard-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`dashboard-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => { setActiveTab(tab.id); if (tab.id !== 'software') setSoftwareSection(null); }}
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
      <Suspense fallback={<TabLoader />}>
      <div className="tab-content">
        {activeTab === 'heute' && (
          <HeuteTab onNavigate={navigateTab} />
        )}

        {activeTab === 'overview' && (
          <>
            <LastschriftAutoProtokollBanner dojoId="all" />
            <StilErinnerungBanner dojoId="all" />
            {/* ── Zone 1: KPI-Leiste ──────────────────────────────────── */}
            <div className="compact-stats-bar sad2-mb-15">
              <div className="compact-stat">
                <div className="compact-stat-top"><Building2 size={16} /><span className="compact-stat-value">{globalStats?.dojos?.active_dojos || 0}</span></div>
                <span className="compact-stat-label">Aktive Dojos</span>
              </div>
              <div className="compact-stat">
                <div className="compact-stat-top"><Users size={16} /><span className="compact-stat-value">{globalStats?.members?.active_members || 0}</span></div>
                <span className="compact-stat-label">Mitglieder</span>
              </div>
              <div className="compact-stat">
                <div className="compact-stat-top"><Award size={16} /><span className="compact-stat-value">{overviewSummary?.goals?.find(g => g.typ === 'verband_mitglieder')?.ist_wert ?? tdaStats?.members?.active_members ?? 0}</span></div>
                <span className="compact-stat-label">Verbandsmitglieder</span>
              </div>
              <div className="compact-stat">
                <div className="compact-stat-top"><Activity size={16} /><span className="compact-stat-value">{globalStats?.checkins?.active_checkins_today || 0}</span></div>
                <span className="compact-stat-label">Check-ins heute</span>
              </div>
              <div className={`compact-stat ${globalStats?.payments?.open_payments > 0 ? 'compact-stat--warning' : ''}`}>
                <div className="compact-stat-top"><Euro size={16} /><span className="compact-stat-value">{globalStats?.payments?.open_payments || 0}</span></div>
                <span className="compact-stat-label">Offene Zahlungen</span>
              </div>
              <div
                className={`compact-stat compact-stat--clickable ${unreadCount > 0 ? 'compact-stat--danger' : ''}`}
                onClick={() => { navigateTab('kommunikation'); setKommunikationSubTab('pushnachrichten'); }}
                title="Zu Benachrichtigungen"
              >
                <div className="compact-stat-top"><Bell size={16} /><span className="compact-stat-value">{unreadCount}</span></div>
                <span className="compact-stat-label">Ungelesen</span>
              </div>
              <div className={`compact-stat ${(globalStats?.storage?.percent_used || 0) > 80 ? 'compact-stat--danger' : ''}`}>
                <div className="compact-stat-top"><HardDrive size={16} /><span className="compact-stat-value">{globalStats?.storage?.percent_used || 0}%</span></div>
                <span className="compact-stat-label">Speicher ({globalStats?.storage?.used_gb || 0}/{globalStats?.storage?.total_gb || 0} GB)</span>
              </div>
            </div>

            {/* ── Zone 2: Alerts (SSL + Trial) ────────────────────────── */}
            <SslWarnungen
              warnings={sslWarnings}
              variant="cockpit"
              onRefresh={async () => {
                try {
                  const r = await axios.get('/admin/ssl-status', { headers: { Authorization: `Bearer ${token}` } });
                  if (r.data.success) setSslWarnings(r.data.warnings || []);
                } catch (_) {}
              }}
            />

            {/* Trial-Monitor — kompakter Alert, nur wenn Trials ablaufen */}
            {(overviewSummary?.trial_expiring || []).length > 0 && (
              <div className="sad-trial-alert-bar">
                <div className="sad-trial-alert-header">
                  <span>
                    <Clock size={14} style={{verticalAlign:'middle', marginRight:4}} />
                    Trial läuft bald ab — {overviewSummary.trial_expiring.length} Dojo{overviewSummary.trial_expiring.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    className="sad-trial-alert-btn"
                    onClick={() => { setActiveTab('software'); setSoftwareSection('lizenzen'); }}
                  >
                    Verwalten →
                  </button>
                </div>
                <div className="sad-trial-alert-list">
                  {overviewSummary.trial_expiring.map((d, i) => (
                    <span key={i} className={`sad-trial-alert-chip ${d.tage_noch <= 3 ? 'sad-trial-alert-chip--urgent' : 'sad-trial-alert-chip--warning'}`}>
                      {d.dojoname} · noch {d.tage_noch} Tag{d.tage_noch !== 1 ? 'e' : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Zone 3: Produkt-Karten ───────────────────────────────── */}
            <div className="sad-product-cards-grid">
              <div onClick={() => { setActiveTab('software'); setSoftwareSection('lizenzen'); }} className="sad2-clickable-card">
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
              </div>

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
                        <span>Bevorstehend</span><strong className={eventStats.upcoming > 0 ? 'sad-new-count--positive' : 'mds-info-value'}>{eventStats.upcoming}</strong>
                      </div>
                      <div className="u-flex-between">
                        <span>Anmeldung offen</span><strong className="mds-info-value">{eventStats.offen}</strong>
                      </div>
                      {eventStats.naechstes && (
                        <div className="sad-hof-next-event">
                          <div className="sad-hof-next-event-title">Nächstes Event</div>
                          <div className="sad-hof-next-event-name">{eventStats.naechstes.name}</div>
                          <div className="u-text-secondary">
                            {new Date(eventStats.naechstes.start_datum || eventStats.naechstes.datum).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : <div className="sad-hof-loading">Lade…</div>}
                </div>
              </div>

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
                  ) : <div className="sad-hof-loading">Lade…</div>}
                </div>
              </div>

              <div onClick={() => { setActiveTab('software'); setSoftwareSection('halloffame'); }} className="sad2-clickable-card">
                <div className="sad2-icon-15">🌟</div>
                <div className="sad-gold-heading">Hall of Fame</div>
                <div className="sad-text-secondary-sm">
                  {hofStats ? (
                    <div className="sad2-flex-col-04">
                      <div className="u-flex-between">
                        <span>Sportler</span><strong className="mds-info-value">{hofStats.total_sportler}</strong>
                      </div>
                      <div className="u-flex-between">
                        <span>Nominierungen</span><strong className="mds-info-value">{hofStats.nominierungen_gesamt}</strong>
                      </div>
                      <div className="u-flex-between">
                        <span>Veranstaltungen</span><strong className="mds-info-value">{hofStats.veranstaltungen_gesamt}</strong>
                      </div>
                      {hofStats.naechste_veranstaltung && (
                        <div className="sad-hof-next-event">
                          <div className="sad-hof-next-event-title">Nächste Veranstaltung</div>
                          <div className="sad-hof-next-event-name">{hofStats.naechste_veranstaltung.titel}</div>
                          <div className="u-text-secondary">{new Date(hofStats.naechste_veranstaltung.datum).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                        </div>
                      )}
                    </div>
                  ) : <div className="sad-hof-loading">Lade…</div>}
                </div>
              </div>
            </div>

            {/* ── Zone 4: Jahresziele ─────────────────────────────────── */}
            <JahreszieleProgress
              goals={overviewSummary?.goals || []}
              variant="cockpit"
              onDetails={() => setActiveTab('entwicklung')}
            />

            {/* ── Zone 5: Activity Feed (2-col) ───────────────────────── */}
            <div className="u-grid-2col">

              {/* Neueste Anmeldungen — Dojos + Verbandsmitglieder zusammen */}
              <section className="dashboard-widget">
                <div className="widget-header">
                  <h3><UserPlus size={16} /> Neueste Anmeldungen</h3>
                </div>
                <div className="widget-content">
                  <div className="sad-widget-sublabel">
                    🏯 Neue Dojos
                    <button onClick={() => { setActiveTab('software'); setSoftwareSection('lizenzen'); }} className="sad-widget-sublabel-link">Alle →</button>
                  </div>
                  {(overviewSummary?.neueste_dojos || []).length === 0 ? (
                    <div className="widget-empty widget-empty--sm">Keine Daten</div>
                  ) : (
                    <div className="sad-flex-col-sm">
                      {(overviewSummary.neueste_dojos).map((dojo, i) => (
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

                  <div className="sad-widget-divider" />

                  <div className="sad-widget-sublabel">
                    🏆 Neue Verbandsmitglieder
                    <button onClick={() => setActiveTab('verband')} className="sad-widget-sublabel-link">Alle →</button>
                  </div>
                  {(overviewSummary?.neueste_verbandsmitglieder || []).length === 0 ? (
                    <div className="widget-empty widget-empty--sm">Keine Daten</div>
                  ) : (
                    <div className="sad-flex-col-sm">
                      {(overviewSummary.neueste_verbandsmitglieder).map((m, i) => (
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
                      {activities.slice(0, 8).map((activity, index) => (
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
                   softwareSection === 'dojos' ? '🏯 TDA-Dojos' :
                   softwareSection === 'apps' ? '🖥 Apps & Dienste' : ''}
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
                    { id: 'apps',          icon: '🖥', title: 'Apps & Dienste',      subtitle: 'Live-Status, PM2, Deploy-Info',          color: '#06b6d4' },
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
              { id: 'lizenzen',   icon: '📜', label: 'Lizenzen' },
              { id: 'onboarding', icon: '🚀', label: 'Onboarding' },
              { id: 'dokumente',  icon: '📂', label: 'Dokumente' },
            ])}

            {subActiveTab.dojosoftware === 'lizenzen' && (
              <DojoLizenzverwaltung />
            )}

            {subActiveTab.dojosoftware === 'onboarding' && (
              <Suspense fallback={<TabLoader />}>
                <OnboardingStatusTab token={token} />
              </Suspense>
            )}

            {subActiveTab.dojosoftware === 'dokumente' && (
              <DokumentenZentrale embedded />
            )}

              </div>
            )}

            {/* ── EventSoftware ──────────────────────────────────────── */}
            {softwareSection === 'eventsoftware' && (
              <EventSoftwareSection token={token} preloadedTurniere={turniereList} />
            )}

            {/* ── TDA Academy ────────────────────────────────────────── */}
            {softwareSection === 'academy' && (
              <AcademySection />
            )}

            {/* ── Hall of Fame ───────────────────────────────────────── */}
            {softwareSection === 'halloffame' && (
              <HofLiveSection />
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

            {/* ── Apps & Dienste ─────────────────────────────────────── */}
            {softwareSection === 'apps' && (
              <Suspense fallback={<TabLoader />}>
                <AppsMonitor />
              </Suspense>
            )}


          </div>
        )}

        {/* ═══ Kommunikation ════════════════════════════════════════ */}
        {/* ═══ Verband ══════════════════════════════════════════════ */}
        {activeTab === 'verband' && (
          <VerbandsMitglieder />
        )}

        {/* ═══ Kontakte — zentrale Kontaktdatenbank (alle Bereiche) ══ */}
        {activeTab === 'kontakte' && (
          <Suspense fallback={<TabLoader />}>
            <AkquiseDashboard />
          </Suspense>
        )}

        {/* ═══ Entwicklung — Statistik-Hub ══════════════════════════ */}
        {activeTab === 'entwicklung' && (
          <div>
            {renderSubTabs('entwicklung', [
              { id: 'ziele',    icon: '🎯', label: 'Ziele & Planung' },
              { id: 'wachstum', icon: '📈', label: 'Wachstum & Prognose' },
            ])}
            {(subActiveTab.entwicklung ?? 'ziele') === 'ziele' && <ZieleEntwicklung bereich="org" />}
            {subActiveTab.entwicklung === 'wachstum' && (
              <Suspense fallback={<TabLoader />}>
                <WachstumPrognose />
              </Suspense>
            )}
          </div>
        )}

        {/* ═══ Finanzen ══════════════════════════════════════════════ */}
        {activeTab === 'finanzen' && (
          <div>
            {renderSubTabs('finanzen', [
              { id: 'finanzen',     icon: '💰', label: 'Übersicht' },
              { id: 'mrr',          icon: '📈', label: 'MRR / ARR' },
              { id: 'lastschrift',  icon: '🏦', label: 'Lastschrift' },
              { id: 'mandate',      icon: '⚠️', label: 'Fehlende Mandate' },
              { id: 'buchhaltung',  icon: '📒', label: 'Buchhaltung' },
              { id: 'shop',         icon: '🛒', label: 'Shop' },
              { id: 'bestellungen', icon: '📦', label: 'Bestellungen' },
            ])}

            {subActiveTab.finanzen === 'finanzen' && (
              <Suspense fallback={<TabLoader />}><SuperAdminFinanzen /></Suspense>
            )}

            {subActiveTab.finanzen === 'mrr' && (
              <Suspense fallback={<TabLoader />}><MRRTab token={token} /></Suspense>
            )}

            {subActiveTab.finanzen === 'mandate' && (
              <Suspense fallback={<TabLoader />}><FehlendeMandateTab token={token} /></Suspense>
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
              <ShopBestellungen token={token} />
            )}

          </div>
        )}

        {/* ═══ Plattform-Zentrale ═══════════════════════════════════ */}
        {activeTab === 'plattform' && (
          <div>
            {renderSubTabs('plattform', [
              { id: 'zentrale',      icon: '🌐', label: 'Plattform-Zentrale' },
              { id: 'kommunikation', icon: '📣', label: 'Kommunikation' },
              { id: 'zugangsdaten',  icon: '🔐', label: 'Zugangsdaten' },
            ])}
            {(subActiveTab.plattform ?? 'zentrale') === 'zentrale' && <PlattformZentrale />}
            {/* Kommunikation — Unter-Tab-Inhalt */}
            {subActiveTab.plattform === 'kommunikation' && (
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
                  <button className={`sub-tab-btn ${kommunikationSubTab === 'kampagnen' ? 'active' : ''}`} onClick={() => setKommunikationSubTab('kampagnen')}>
                    <Send size={16} /><span>Kampagnen</span>
                  </button>
                  <button className={`sub-tab-btn ${kommunikationSubTab === 'marketing-ki' ? 'active' : ''}`} onClick={() => setKommunikationSubTab('marketing-ki')}>
                    <Sparkles size={16} /><span>Marketing KI</span>
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

                {kommunikationSubTab === 'kampagnen' && (
                  <KampagnenDashboard />
                )}

                {kommunikationSubTab === 'marketing-ki' && (
                  <SuperAdminMarketing />
                )}
              </div>
            )}
            {subActiveTab.plattform === 'zugangsdaten' && <PlattformZugangsdaten />}
          </div>
        )}

        {/* ═══ System ════════════════════════════════════════════════ */}
        {activeTab === 'system' && (
          <div>
            {renderSubTabs('system', [
              { id: 'status',       icon: '🟢', label: 'Status' },
              { id: 'benutzer',     icon: '👤', label: 'Benutzer' },
              { id: 'email',        icon: '✉️', label: 'E-Mail' },
              { id: 'passwoerter',  icon: '🔑', label: 'Passwörter' },
              { id: 'security',     icon: '🛡️', label: 'Security' },
              { id: 'infrastruktur', icon: '🔍', label: 'Infrastruktur' },
              { id: 'kalender',     icon: '📅', label: 'iCloud Kalender' },
              { id: 'backup',       icon: '💾', label: 'Backups' },
              { id: 'aktivitaeten', icon: '📋', label: 'Aktivitäten' }
            ])}

            {subActiveTab.system === 'status' && (
              <Suspense fallback={<TabLoader />}>
                <CronStatus token={token} />
                <PlatformStatusTab token={token} />
              </Suspense>
            )}

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

            {subActiveTab.system === 'email' && (
              <MailBannerVerwaltung />
            )}

            {subActiveTab.system === 'passwoerter' && (
              <PasswortVerwaltung />
            )}

            {subActiveTab.system === 'security' && (
              <SecurityDashboard />
            )}

            {subActiveTab.system === 'infrastruktur' && (
              <Suspense fallback={<TabLoader />}>
                <InfraChecks />
              </Suspense>
            )}

            {subActiveTab.system === 'kalender' && (
              <>
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

              <div className="section-card" style={{ marginTop: '1rem' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>📲 Dojo-Events auf dem iPhone abonnieren</h3>
                <p style={{ color: 'var(--text-3)', fontSize: '13px', marginBottom: '1.2rem' }}>
                  Abonniere alle Dojo-Events direkt im iPhone-Kalender. Neue Events erscheinen automatisch —
                  so siehst du auf einen Blick ob sich ein Dojo-Termin mit einem privaten Eintrag überschneidet.
                </p>
                {myFeedUrl ? (
                  <>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0, minWidth: '200px' }}>
                        <label>Kalender-Feed-URL</label>
                        <input
                          type="text"
                          readOnly
                          value={myFeedUrl}
                          style={{ fontFamily: 'monospace', fontSize: '12px', cursor: 'text' }}
                          onFocus={e => e.target.select()}
                        />
                      </div>
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          navigator.clipboard.writeText(myFeedUrl);
                          setFeedCopied(true);
                          setTimeout(() => setFeedCopied(false), 2500);
                        }}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {feedCopied ? '✅ Kopiert' : '📋 URL kopieren'}
                      </button>
                      <a
                        href={myFeedWebcalUrl}
                        className="btn-primary"
                        style={{ whiteSpace: 'nowrap', textDecoration: 'none' }}
                      >
                        📲 Zu iPhone hinzufügen
                      </a>
                    </div>
                    <p style={{ color: 'var(--text-3)', fontSize: '12px' }}>
                      <strong>Auf dem iPhone:</strong> Tippe auf "Zu iPhone hinzufügen" — der Kalender öffnet sich und du kannst ihn abonnieren.
                      Oder kopiere die URL und füge sie manuell unter <strong>Kalender → Kalenderabonnement hinzufügen</strong> ein.
                    </p>
                  </>
                ) : (
                  <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>Feed-URL wird geladen…</p>
                )}
              </div>

              {/* ── Verbands-Termine (andere Kampfsportverbände) ───────────────── */}
              <div className="section-card" style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ marginBottom: '0.5rem' }}>🥋 Verbands-Termine (andere Verbände)</h3>
                    <p style={{ color: 'var(--text-3)', fontSize: '13px', marginBottom: '1.2rem', maxWidth: '640px' }}>
                      Turniertermine anderer Kampfsportverbände (DKV, WKU/WAKO, Taekwondo, BKO, WMAC, WOMAA …).
                      <strong> Bestätigte</strong> Termine werden beim Anlegen eigener Turniere/Events automatisch auf Überschneidungen geprüft.
                      Per <strong>Sync</strong> sucht die KI im Web nach kommenden Terminen — diese landen als <em>unbestätigt</em> und müssen von dir freigegeben werden.
                    </p>
                  </div>
                  <button className="btn-secondary" onClick={syncFremdtermine} disabled={ftSyncing} style={{ whiteSpace: 'nowrap' }}>
                    {ftSyncing ? '🔄 Sync läuft…' : '🔄 Web-Sync'}
                  </button>
                </div>

                {ftMsg && (
                  <div className={`sad-feedback-box ${ftMsg.startsWith('✅') ? 'sad-feedback-box--success' : ftMsg.startsWith('❌') ? 'sad-feedback-box--error' : ''}`}>
                    {ftMsg}
                  </div>
                )}

                {/* Eingabe-/Bearbeiten-Formular */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', marginTop: '0.5rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Verband</label>
                    <select value={ftForm.verband} onChange={e => setFtForm({ ...ftForm, verband: e.target.value })}>
                      {['DKV', 'WKU', 'WAKO', 'Taekwondo', 'BKO', 'WMAC', 'WOMAA', 'sonstige'].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                    <label>Titel des Turniers *</label>
                    <input type="text" value={ftForm.titel} onChange={e => setFtForm({ ...ftForm, titel: e.target.value })} placeholder="z.B. DKV Bayernliga" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Datum von *</label>
                    <input type="date" value={ftForm.start_datum} onChange={e => setFtForm({ ...ftForm, start_datum: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Datum bis</label>
                    <input type="date" value={ftForm.end_datum} onChange={e => setFtForm({ ...ftForm, end_datum: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Ort</label>
                    <input type="text" value={ftForm.ort} onChange={e => setFtForm({ ...ftForm, ort: e.target.value })} placeholder="Stadt / Halle" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Region</label>
                    <input type="text" value={ftForm.region} onChange={e => setFtForm({ ...ftForm, region: e.target.value })} placeholder="Bundesland / Land" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                    <label>Quelle-URL</label>
                    <input type="url" value={ftForm.quelle_url} onChange={e => setFtForm({ ...ftForm, quelle_url: e.target.value })} placeholder="https://…" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem' }}>
                  <button className="btn-primary" onClick={saveFremdtermin} style={{ whiteSpace: 'nowrap' }}>
                    {ftEditId ? '💾 Änderung speichern' : '➕ Termin hinzufügen'}
                  </button>
                  {ftEditId && (
                    <button className="btn-secondary" onClick={resetFtForm}>Abbrechen</button>
                  )}
                </div>

                {/* Liste */}
                <hr className="sad2-hr" />
                {ftLoading && <div style={{ color: 'var(--text-3)', fontSize: '13px' }}>Lade Verbands-Termine…</div>}
                {!ftLoading && fremdtermine.length === 0 && (
                  <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>
                    Noch keine Verbands-Termine. Trage welche ein oder nutze den Web-Sync.
                  </p>
                )}
                {!ftLoading && fremdtermine.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {fremdtermine.map(t => (
                      <div key={t.id} className="ical-event-row" style={{ alignItems: 'center', opacity: t.status === 'unbestaetigt' ? 0.75 : 1 }}>
                        <span className="ical-event-date">
                          {new Date(t.start_datum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                          {t.end_datum && t.end_datum !== t.start_datum && ' – ' + new Date(t.end_datum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '12px', padding: '1px 6px', borderRadius: '4px', background: 'var(--bg-2, rgba(255,255,255,0.06))', whiteSpace: 'nowrap' }}>
                          {t.verband}
                        </span>
                        <span className="ical-event-summary">
                          {t.titel}
                          {t.status === 'unbestaetigt' && <em style={{ color: 'var(--warning, #e0a800)', marginLeft: '0.4rem', fontSize: '12px' }}>· unbestätigt{t.quelle_typ === 'sync' ? ' (Web-Sync)' : ''}</em>}
                        </span>
                        {(t.ort || t.region) && <span className="ical-event-location">📍 {[t.ort, t.region].filter(Boolean).join(', ')}</span>}
                        <span style={{ display: 'flex', gap: '0.35rem', marginLeft: 'auto' }}>
                          {t.status === 'unbestaetigt' && (
                            <button className="btn-secondary" onClick={() => confirmFremdtermin(t.id)} title="Bestätigen" style={{ padding: '2px 8px', fontSize: '12px' }}>✓ Bestätigen</button>
                          )}
                          {t.quelle_url && (
                            <a href={t.quelle_url} target="_blank" rel="noopener noreferrer" title="Quelle öffnen" style={{ padding: '2px 6px', fontSize: '12px', textDecoration: 'none' }}>🔗</a>
                          )}
                          <button className="btn-secondary" onClick={() => editFremdtermin(t)} title="Bearbeiten" style={{ padding: '2px 8px', fontSize: '12px' }}>✏️</button>
                          <button className="btn-secondary" onClick={() => deleteFremdtermin(t.id)} title="Löschen" style={{ padding: '2px 8px', fontSize: '12px' }}>🗑️</button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </>
            )}

            {subActiveTab.system === 'backup' && (
              <div className="section-card">
                <BackupEinstellungen />
              </div>
            )}

            {subActiveTab.system === 'aktivitaeten' && (
              <Suspense fallback={<TabLoader />}>
                <AuditTrailTab token={token} />
              </Suspense>
            )}
          </div>
        )}


        {activeTab === 'todos' && (
          <div className="tab-content sad-todo-tab">
            <TodoPanel />
          </div>
        )}

      </div>
      </Suspense>

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
      const errMsg = err.response?.data?.error;
      setError(typeof errMsg === 'string' ? errMsg : 'Fehler beim Speichern');
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
      else setError(typeof data.message === 'string' ? data.message : 'Fehler beim Laden');
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
                          color: 'var(--ds-text)',
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
