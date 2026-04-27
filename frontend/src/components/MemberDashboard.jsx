import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx';
import {
  User,
  Calendar,
  CreditCard,
  BarChart3,
  Clock,
  Award,
  Settings,
  Bell,
  Trophy,
  Package,
  Star,
  QrCode,
  Download,
  CalendarSync,
  CalendarX,
  Copy,
  Check,
  Gift
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import dojoLogo from '../assets/logo-kampfkunstschule-schreiner.png';
import '../styles/MitgliedDetail.css';
import MemberHeader from './MemberHeader.jsx';
import UmfragePopup from './UmfragePopup.jsx';
import BadgeDisplay from './BadgeDisplay';
import MemberCheckin from './MemberCheckin.jsx';
import MemberQRCode from './MemberQRCode.jsx';
import MotivationQuotes from './MotivationQuotes.jsx';
import TrainingReminders from './TrainingReminders.jsx';
import BuddyGruppenWidget from './BuddyGruppenWidget.jsx';
import '../styles/themes.css';
import '../styles/Dashboard.css';
import '../styles/DashboardStart.css';
import '../styles/MemberNavigation.css';
import '../styles/MotivationQuotes.css';
import '../styles/TrainingReminders.css';
import '../styles/MemberDashboard.responsive.css';
import '../styles/MemberDashboard.css';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import EventNotificationPopup from './EventNotificationPopup.jsx';
import PushNotificationPopup from './PushNotificationPopup.jsx';
import ProfilWizard from './ProfilWizard.jsx';
import AbwesenheitWidget from './AbwesenheitWidget.jsx';
import NextTrainingsWidget from './NextTrainingsWidget.jsx';


function MemberNewsSlideshow({ bilder, titel }) {
  const [aktiv, setAktiv] = useState(0);
  const timerRef = useRef(null);
  useEffect(() => {
    setAktiv(0);
    if (bilder.length < 2) return;
    timerRef.current = setInterval(() => {
      setAktiv(prev => (prev + 1) % bilder.length);
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, [bilder.length]);
  return (
    <div className="member-news-slideshow">
      {bilder.map((url, i) => (
        <img key={i} src={url} alt={`${titel} ${i + 1}`}
          className={`member-news-slide${i === aktiv ? ' aktiv' : ''}`} loading="lazy" />
      ))}
      {bilder.length > 1 && (
        <div className="member-news-slide-dots">
          {bilder.map((_, i) => (
            <span key={i} className={`member-slide-dot${i === aktiv ? ' aktiv' : ''}`}
              onClick={() => setAktiv(i)} />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberNewsModal({ artikel, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
  const inhalt = artikel.inhalt || '';
  const isHtml = /<[a-z][\s\S]*>/i.test(inhalt);
  return (
    <div className="member-news-modal-overlay" onClick={onClose}>
      <div className="member-news-modal-box" onClick={e => e.stopPropagation()}>
        <button className="member-news-modal-close" onClick={onClose} aria-label="Schließen">✕</button>
        {artikel.bilder.length > 0 && (
          <div className="member-news-modal-bild">
            <MemberNewsSlideshow bilder={artikel.bilder} titel={artikel.titel} />
          </div>
        )}
        <div className="member-news-modal-inhalt">
          <div className="member-news-modal-date">{formatDate(artikel.datum)}</div>
          <h2 className="member-news-modal-titel">{artikel.titel}</h2>
          <div className="member-news-modal-text">
            {isHtml
              ? <div dangerouslySetInnerHTML={{ __html: inhalt }} />
              : inhalt.split(/\n\s*\n/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)
            }
          </div>
        </div>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

const MemberDashboard = () => {
  const { t } = useTranslation('member');
  const { user } = useAuth();
  const { activeDojo } = useDojoContext();

  const navigate = useNavigate();

  // Haupt-Daten States
  const [stats, setStats] = useState({
    trainingsstunden: 0,
    anwesenheitAnwesend: 0,
    anwesenheitMoeglich: 0,
    anwesenheit: null,
    offeneBeitraege: 0,
    naechstePruefung: null
  });
  const [memberData, setMemberData] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [error, setError] = useState(null);

  // Konsolidierte Modal States (vorher 3 separate useState)
  const [modals, setModals] = useState({
    checkin: false,
    qrCode: false,
    examRegistration: false
  });

  // Konsolidierte Stil & Gurt Daten (vorher 5 separate useState)
  const [styleData, setStyleData] = useState({
    memberStile: [],
    styleSpecificData: {},
    stile: [],
    loading: false
  });

  // Konsolidierte Prüfungs-Daten (vorher 4 separate useState)
  const [examData, setExamData] = useState({
    nextExam: null,
    approved: [],
    results: [],
    selected: null,
    acceptedConditions: false
  });

  // Konsolidierte Benachrichtigungen (vorher 2 separate useState)
  const [notificationData, setNotificationData] = useState({
    list: [],
    unreadCount: 0
  });
  const [showPushPopup, setShowPushPopup] = useState(false);
  const [pushStatus, setPushStatus] = useState('unknown');
  const [pushLoading, setPushLoading] = useState(false);
  const [expandedNotif, setExpandedNotif] = useState(null);

  // Zahlungshinweise / Mahnungen aus mitglied_nachrichten
  const [zahlungsNachrichten, setZahlungsNachrichten] = useState([]);
  const [hatMahnung, setHatMahnung] = useState(false);

  // Referral / Freunde werben Freunde
  const [referralData, setReferralData] = useState(null);
  const [referralCopied, setReferralCopied] = useState(false);

  // Dokumente
  const [memberDokumente, setMemberDokumente] = useState([]);
  const [dokLoading, setDokLoading] = useState(false);

  // Ankündigungen (Chat-Announcement-Räume)
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);

  // ProfilWizard: beim ersten Login anzeigen
  const [showProfilWizard, setShowProfilWizard] = useState(false);

  // Familienmitglieder laden
  const [familyMembers, setFamilyMembers] = useState([]);
  const [familySwitching, setFamilySwitching] = useState(false);

  useEffect(() => {
    const loadFamily = async () => {
      try {
        const res = await fetchWithAuth(`${config.apiBaseUrl}/auth/family-members`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.members.length > 1) {
            setFamilyMembers(data.members);
          }
        }
      } catch (e) { /* ignore */ }
    };
    loadFamily();
  }, []);

  const handleFamilySwitch = async (targetMitgliedId) => {
    if (targetMitgliedId === user?.mitglied_id || familySwitching) return;
    setFamilySwitching(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/auth/family-switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitglied_id: targetMitgliedId })
      });
      const data = await res.json();
      if (data.success && data.token) {
        // Token-Payload dekodieren für Expiry
        const payload = JSON.parse(atob(data.token.split('.')[1]));
        const expiryTime = payload.exp ? payload.exp * 1000 : Date.now() + (30 * 24 * 60 * 60 * 1000);
        localStorage.setItem('dojo_auth_token', data.token);
        localStorage.setItem('dojo_user', JSON.stringify(data.user));
        localStorage.setItem('dojo_session_expiry', expiryTime.toString());
        window.location.reload();
      }
    } catch (e) {
      console.error('Familie-Wechsel fehlgeschlagen:', e);
    } finally {
      setFamilySwitching(false);
    }
  };

  // Push-Benachrichtigungen: Status beim Mount prüfen
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported');
    } else {
      setPushStatus(Notification.permission);
    }
  }, []);

  const handlePushSubscribe = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setPushStatus(permission);
      if (permission !== 'granted') return;
      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = 'BKzKRA_Tojs8YsxKH5yR2oToWDm5uI8QvMjZNLCP6hSMBxyA3pwOIk2rc80a8kyd04T4stIUIrLXMj2O_CMCnfc';
      const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: convertedKey });
      }
      const subJson = subscription.toJSON();
      await fetchWithAuth(`${config.apiBaseUrl}/notifications/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subJson.endpoint, p256dh: subJson.keys?.p256dh, auth: subJson.keys?.auth, userAgent: navigator.userAgent })
      });
      setPushStatus('granted');
    } catch (err) {
      console.error('Push-Aktivierung fehlgeschlagen:', err);
    } finally {
      setPushLoading(false);
    }
  };

  // Event-Benachrichtigungs-Popup
  const [neueEvents, setNeueEvents] = useState([]);
  const [showEventPopup, setShowEventPopup] = useState(false);

  // Alle kommenden Events für Dashboard-Widget
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  // News für Member-Dashboard
  const [memberNews, setMemberNews] = useState([]);
  const [offeneNews, setOffeneNews] = useState(null);

  // Meine Umfragen (beantwortete + offene)
  const [meineUmfragen, setMeineUmfragen] = useState([]);
  const [pendingUmfragen, setPendingUmfragen] = useState([]);
  const [umfrageAntworten, setUmfrageAntworten] = useState({}); // { [id]: { antwort, kommentar } }
  const [umfrageSending, setUmfrageSending] = useState(null);

  // Vertrag-Anpassungen (Mitglied-Sicht)
  const [meineAnpassungen, setMeineAnpassungen] = useState([]);
  const [showAnpassungForm, setShowAnpassungForm] = useState(false);
  const [anpassungForm, setAnpassungForm] = useState({ typ: 'student', gueltig_von: '', gueltig_bis: '', grund: '' });
  const [anpassungLoading, setAnpassungLoading] = useState(false);
  const [anpassungError, setAnpassungError] = useState('');
  const [anpassungSuccess, setAnpassungSuccess] = useState('');
  const [showAbwesenheitWidget, setShowAbwesenheitWidget] = useState(false);
  // Ruhepause
  const [showRuhepauseForm, setShowRuhepauseForm] = useState(false);
  const [ruhepauseForm, setRuhepauseForm] = useState({ gueltig_von: '', gueltig_bis: '', grund: '' });
  const [ruhepauseLoading, setRuhepauseLoading] = useState(false);
  const [ruhepauseError, setRuhepauseError] = useState('');
  const [ruhepauseSuccess, setRuhepauseSuccess] = useState('');
  const [ruhepauseInfo, setRuhepauseInfo] = useState(null);
  const [ruhepauseMaxMonate, setRuhepauseMaxMonate] = useState(3);

  // Abwärtskompatibilität: Destrukturierte Werte für bestehenden Code
  const showMemberCheckin = modals.checkin;
  const showQRCode = modals.qrCode;
  const showExamRegistrationModal = modals.examRegistration;
  const memberStile = styleData.memberStile;
  const styleSpecificData = styleData.styleSpecificData;
  const stile = styleData.stile;
  const stileLoading = styleData.loading;
  const nextExam = examData.nextExam;
  const approvedExams = examData.approved;
  const examResults = examData.results;
  const selectedExam = examData.selected;
  const acceptedConditions = examData.acceptedConditions;
  const notifications = notificationData.list;
  const unreadCount = notificationData.unreadCount;

  // Ref für Mitgliedsausweis-Download
  const ausweisRef = useRef(null);

  // Setter-Funktionen für Abwärtskompatibilität
  const setShowMemberCheckin = useCallback((val) => setModals(prev => ({ ...prev, checkin: val })), []);
  const setShowQRCode = useCallback((val) => setModals(prev => ({ ...prev, qrCode: val })), []);
  const setShowExamRegistrationModal = useCallback((val) => setModals(prev => ({ ...prev, examRegistration: val })), []);
  const setMemberStile = useCallback((val) => setStyleData(prev => ({ ...prev, memberStile: typeof val === 'function' ? val(prev.memberStile) : val })), []);
  const setStyleSpecificData = useCallback((val) => setStyleData(prev => ({ ...prev, styleSpecificData: typeof val === 'function' ? val(prev.styleSpecificData) : val })), []);
  const setStile = useCallback((val) => setStyleData(prev => ({ ...prev, stile: val })), []);
  const setStileLoading = useCallback((val) => setStyleData(prev => ({ ...prev, loading: val })), []);
  const setNextExam = useCallback((val) => setExamData(prev => ({ ...prev, nextExam: val })), []);
  const setApprovedExams = useCallback((val) => setExamData(prev => ({ ...prev, approved: val })), []);
  const setExamResults = useCallback((val) => setExamData(prev => ({ ...prev, results: val })), []);
  const setSelectedExam = useCallback((val) => setExamData(prev => ({ ...prev, selected: val })), []);
  const setAcceptedConditions = useCallback((val) => setExamData(prev => ({ ...prev, acceptedConditions: val })), []);
  const setNotifications = useCallback((val) => setNotificationData(prev => ({ ...prev, list: val })), []);
  const setUnreadCount = useCallback((val) => setNotificationData(prev => ({ ...prev, unreadCount: val })), []);

  // Prüfungsprotokoll
  const [pruefProtokolle, setPruefProtokolle] = useState([]);
  const [protokollViewId, setProtokolViewId] = useState(null);

  // Prüfungseinladungs-Popup (Lesebestätigung)
  const [pruefungsEinladungPopup, setPruefungsEinladungPopup] = useState(null);

  // Quick Action Handler
  const handleQuickAction = (action) => {
    switch (action) {
      case 'checkin':
        setShowMemberCheckin(true);
        break;
      case 'notifications':
        // Scrolle zu den Benachrichtigungen
        const notificationsElement = document.getElementById('member-notifications');
        if (notificationsElement) {
          notificationsElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        break;
      default:
        break;
    }
  };


  // Lade neue Events für Popup-Benachrichtigung
  const loadNeueEvents = async (memberId) => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/events/member/${memberId}/neu`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.events?.length > 0) {
          setNeueEvents(data.events);
          setShowEventPopup(true);
        }
      }
    } catch (e) {
      // Event-Popup optional — kein Fehler anzeigen
    }
  };

  // Lade alle kommenden Events für Dashboard-Widget
  const loadUpcomingEvents = async (memberId) => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/events/member/${memberId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUpcomingEvents(data.events || []);
        }
      }
    } catch (e) {
      // optional — kein Fehler anzeigen
    }
  };

  // Lade aktive + noch nicht beantwortete Umfragen
  const loadMeineUmfragen = async () => {
    try {
      const [rAktiv, rPending] = await Promise.allSettled([
        fetchWithAuth(`${config.apiBaseUrl}/umfragen/dojo/aktiv`),
        fetchWithAuth(`${config.apiBaseUrl}/umfragen/pending`),
      ]);
      if (rAktiv.status === 'fulfilled' && rAktiv.value.ok) {
        const data = await rAktiv.value.json();
        setMeineUmfragen(data.umfragen || []);
      }
      if (rPending.status === 'fulfilled' && rPending.value.ok) {
        const data = await rPending.value.json();
        setPendingUmfragen(data.umfragen || []);
        // Antwort-State vorinitialisieren
        const init = {};
        (data.umfragen || []).forEach(u => { init[u.id] = { antwort: null, kommentar: '' }; });
        setUmfrageAntworten(init);
      }
    } catch {}
  };

  const submitUmfrageAntwort = async (umfrageId) => {
    const a = umfrageAntworten[umfrageId] || {};
    setUmfrageSending(umfrageId);
    try {
      await fetchWithAuth(`${config.apiBaseUrl}/umfragen/${umfrageId}/antwort`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ antwort: a.antwort || null, kommentar: a.kommentar || null }),
      });
      // Nach Abstimmung: aus pending entfernen
      setPendingUmfragen(prev => prev.filter(u => u.id !== umfrageId));
    } catch {} finally { setUmfrageSending(null); }
  };

  // Lade News für Member-Dashboard
  const loadMemberNews = async () => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/news/public`);
      if (response.ok) {
        const data = await response.json();
        if (data.news && data.news.length > 0) {
          const toAbs = (url) => url ? (url.startsWith('http') ? url : `https://app.tda-vib.de${url}`) : null;
          const mapped = data.news.map(a => {
            let bilder = [];
            if (a.bilder_json) {
              try { bilder = JSON.parse(a.bilder_json).map(toAbs).filter(Boolean); } catch {}
            }
            if (bilder.length === 0 && a.bild_url) bilder = [toAbs(a.bild_url)];
            return {
              id: a.id,
              titel: a.titel,
              kurzbeschreibung: a.kurzbeschreibung,
              inhalt: a.inhalt || '',
              bilder,
              datum: a.veroeffentlicht_am || a.created_at,
            };
          });
          setMemberNews(mapped);
        }
      }
    } catch (e) {
      // News optional — kein Fehler anzeigen
    }
  };

  const handleEventPopupAnmelden = async (event, bestellungen) => {
    try {
      await fetchWithAuth(`${config.apiBaseUrl}/events/${event.event_id}/anmelden`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitglied_id: memberData?.mitglied_id, bestellungen })
      });
      await fetchWithAuth(`${config.apiBaseUrl}/events/${event.event_id}/gesehen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitglied_id: memberData?.mitglied_id, aktion: 'angemeldet' })
      });
    } catch (e) { /* silent */ }
    const remaining = neueEvents.filter(e => e.event_id !== event.event_id);
    setNeueEvents(remaining);
    if (remaining.length === 0) setShowEventPopup(false);
  };

  const handleEventPopupAblehnen = async (event) => {
    try {
      await fetchWithAuth(`${config.apiBaseUrl}/events/${event.event_id}/gesehen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitglied_id: memberData?.mitglied_id, aktion: 'abgelehnt' })
      });
    } catch (e) { /* silent */ }
    const remaining = neueEvents.filter(e => e.event_id !== event.event_id);
    setNeueEvents(remaining);
    if (remaining.length === 0) setShowEventPopup(false);
  };

  const handleEventPopupSpaeter = async (event) => {
    // Nur als "gesehen" markieren — wird nicht mehr beim nächsten Login angezeigt
    try {
      await fetchWithAuth(`${config.apiBaseUrl}/events/${event.event_id}/gesehen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitglied_id: memberData?.mitglied_id, aktion: 'gesehen' })
      });
    } catch (e) { /* silent */ }
    const remaining = neueEvents.filter(e => e.event_id !== event.event_id);
    setNeueEvents(remaining);
    if (remaining.length === 0) setShowEventPopup(false);
  };

  // Lade Dokumente + Rechnungen (unified)
  const loadMemberDokumente = async (memberId) => {
    setDokLoading(true);
    try {
      const [docsRes, rechnungenRes] = await Promise.all([
        fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${memberId}/dokumente`),
        fetchWithAuth(`${config.apiBaseUrl}/member-payments/rechnungen`)
      ]);

      const docsData = docsRes.ok ? await docsRes.json() : {};
      const docs = (Array.isArray(docsData) ? docsData : docsData.dokumente || [])
        .filter(d => d.typ === 'dokument')
        .map(d => ({ ...d, _itemType: 'dokument' }));

      let rechnungen = [];
      if (rechnungenRes.ok) {
        const rData = await rechnungenRes.json();
        rechnungen = (rData.rechnungen || []).slice(0, 10).map(r => ({
          id: r.rechnung_id,
          _itemType: 'rechnung',
          dokumentname: `${r.art === 'pruefungsgebuehr' ? '🎓 ' : r.art === 'mitgliedsbeitrag' ? '📅 ' : '💶 '}${r.rechnungsnummer}`,
          beschreibung: r.beschreibung || r.art,
          betrag: r.betrag,
          status: r.status,
          erstellt_am: r.datum,
          rechnung_id: r.rechnung_id
        }));
      }

      setMemberDokumente([...docs, ...rechnungen]);
    } catch (e) { /* optional */ }
    finally { setDokLoading(false); }
  };

  // Lade Ankündigungen aus Chat-Announcement-Räumen
  const loadAnnouncements = async () => {
    setAnnouncementsLoading(true);
    try {
      const r = await fetchWithAuth(`${config.apiBaseUrl}/chat/announcements?limit=5`);
      if (r.ok) {
        const data = await r.json();
        setAnnouncements(data.announcements || []);
      }
    } catch (e) { /* optional */ }
    finally { setAnnouncementsLoading(false); }
  };

  // Lade Referral-Daten (Freunde werben Freunde)
  const loadReferralData = async (memberId) => {
    try {
      const [settingsRes, codesRes] = await Promise.all([
        fetchWithAuth(`${config.apiBaseUrl}/referral/settings`),
        fetchWithAuth(`${config.apiBaseUrl}/referral/codes?mitglied_id=${memberId}`)
      ]);

      // Settings laden (optional – falls nicht erreichbar trotzdem Code anzeigen)
      let settings = {};
      if (settingsRes.ok) {
        settings = await settingsRes.json();
      }

      // Code laden – anzeigen sobald ein Code vorhanden ist, unabhängig von aktiv-Flag
      if (!codesRes.ok) return;
      const codes = await codesRes.json();
      const activeCode = Array.isArray(codes) ? codes.find(c => c.aktiv) : null;
      if (!activeCode) return;

      setReferralData({ ...settings, code: activeCode.code });
    } catch (e) {
      // Referral optional – kein Fehler anzeigen
    }
  };

  // Lade Push-Benachrichtigungen für dieses Mitglied
  const loadNotifications = async (email) => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/notifications/member/${encodeURIComponent(email)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const allNotifs = data.notifications || [];
          setNotifications(allNotifs);
          const unread = allNotifs.filter(n => n.status === 'unread');
          setUnreadCount(unread.length);

          // App-Icon-Badge setzen (Chrome Android / Desktop)
          if ('setAppBadge' in navigator) {
            unread.length > 0
              ? navigator.setAppBadge(unread.length).catch(() => {})
              : navigator.clearAppBadge().catch(() => {});
          }
          // Service Worker Badge-Update (Fallback via postMessage)
          if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'SET_BADGE',
              count: unread.length
            });
          }

          // Popup-Logik:
          // - Normale Notifications: einmalig zeigen, in localStorage tracken, sofort als gelesen markieren
          // - requires_confirmation: bei JEDEM Login zeigen bis bestaetigt, NICHT in localStorage speichern
          if (unread.length > 0) {
            const storageKey = `pnp_shown_${email}`;
            const alreadyShown = new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'));

            const newRegular = unread.filter(n => !n.requires_confirmation && !alreadyShown.has(String(n.id)));
            const pendingConfirm = unread.filter(n => n.requires_confirmation && !n.confirmed_at);
            const toShow = [...pendingConfirm, ...newRegular];

            if (toShow.length > 0) {
              // Normale als gesehen markieren
              newRegular.forEach(n => alreadyShown.add(String(n.id)));
              if (newRegular.length > 0) {
                localStorage.setItem(storageKey, JSON.stringify([...alreadyShown]));
                fetchWithAuth(`${config.apiBaseUrl}/notifications/member/mark-read`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email, ids: newRegular.map(n => n.id) })
                }).catch(() => {});
              }
              setShowPushPopup(true);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der Benachrichtigungen:', error);
    }
  };

  // Bestätige eine Benachrichtigung
  const confirmNotification = async (notificationId) => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/notifications/confirm/${notificationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mitglied_id: memberData.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert('✅ Benachrichtigung bestätigt!');
          // Benachrichtigungen neu laden
          await loadNotifications(memberData.email || user?.email);
        }
      } else {
        const error = await response.json();
        alert('❌ Fehler: ' + (error.error || 'Konnte nicht bestätigt werden'));
      }
    } catch (error) {
      console.error('❌ Fehler beim Bestätigen der Benachrichtigung:', error);
      alert('❌ Fehler beim Bestätigen der Benachrichtigung');
    }
  };

  // Lade zugelassene Prüfungen für dieses Mitglied
  const loadApprovedExams = async (memberId) => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/pruefungen?mitglied_id=${memberId}&status=geplant`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.pruefungen) {
          setApprovedExams(data.pruefungen);

          // Nächste Prüfung: nur aus tatsächlicher Teilnahme-Liste setzen
          if (data.pruefungen.length > 0) {
            const nextExamData = data.pruefungen[0]; // Erste Prüfung (nach Datum sortiert)
            setNextExam({
              date: nextExamData.pruefungsdatum,
              stil: nextExamData.stil_name,
              stilId: nextExamData.stil_id,
              graduierung: nextExamData.graduierung_nachher
            });
          } else {
            // Kein aktiver Prüfungstermin mehr → Countdown ausblenden
            setNextExam(null);
          }
        }
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der Prüfungstermine:', error);
    }
  };

  // Zeige Einladungs-Popup wenn ungelesene Prüfungseinladung vorhanden
  useEffect(() => {
    if (approvedExams && approvedExams.length > 0) {
      const ungelesen = approvedExams.find(e => !e.benachrichtigung_gelesen);
      if (ungelesen) {
        setPruefungsEinladungPopup(ungelesen);
      }
    }
  }, [approvedExams]);

  const handlePruefungsEinladungGelesen = async (pruefung) => {
    try {
      await fetchWithAuth(`${config.apiBaseUrl}/pruefungen/kandidaten/${pruefung.pruefung_id}/gelesen`, {
        method: 'POST',
      });
      setApprovedExams(prev => prev.map(e =>
        e.pruefung_id === pruefung.pruefung_id
          ? { ...e, benachrichtigung_gelesen: 1 }
          : e
      ));
    } catch (err) {
      console.error('Fehler beim Speichern der Lesebestätigung', err);
    }
    setPruefungsEinladungPopup(null);
  };

  // Lade abgeschlossene Prüfungen (Ergebnisse)
  const loadExamResults = async (memberId) => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/pruefungen/mitglied/${memberId}/historie`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.historie) {
          setExamResults(data.historie);
        }
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der Prüfungsergebnisse:', error);
    }
    // Protokolle laden
    try {
      const r = await fetchWithAuth(`${config.apiBaseUrl}/pruefungen/mitglied/${memberId}/protokolle`);
      if (r.ok) {
        const d = await r.json();
        if (d.success) setPruefProtokolle(d.protokolle || []);
      }
    } catch (_) {}
  };

  // Echte Daten für das eingeloggte Mitglied laden
  useEffect(() => {
    const loadMemberData = async () => {
      try {
        // 🔐 WICHTIG: Verwende mitglied_id aus JWT-Token (nicht E-Mail!)
        const mitgliedId = user?.mitglied_id;

        if (!mitgliedId) {
          console.error('❌ Keine mitglied_id im User-Token gefunden!', user);
          setError('Kein Mitgliedsprofil gefunden. Bitte kontaktieren Sie den Administrator.');
          return;
        }

        console.log('🔍 Lade Mitgliedsdaten für ID:', mitgliedId);

        // Alle 4 initialen Fetches parallel — mitgliedId ist aus JWT bekannt
        const [memberResponse, attendanceResponse, vertraegeResponse, kurseResponse] = await Promise.all([
          fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${mitgliedId}`),
          fetchWithAuth(`${config.apiBaseUrl}/anwesenheit/${mitgliedId}`),
          fetchWithAuth(`${config.apiBaseUrl}/vertraege?mitglied_id=${mitgliedId}`),
          fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${mitgliedId}/kurse`),
        ]);

        if (!memberResponse.ok) {
          throw new Error(`HTTP ${memberResponse.status}: ${memberResponse.statusText}`);
        }

        const memberData = await memberResponse.json();
        console.log('✅ Mitgliedsdaten empfangen:', memberData);

        // ProfilWizard: Beim ersten Login anzeigen (fehlender Notfallkontakt)
        const wizardKey = `profil_wizard_done_${memberData.mitglied_id}`;
        if (!localStorage.getItem(wizardKey) && !memberData.notfallkontakt_name) {
          setShowProfilWizard(true);
        }

        let attendanceData = [];
        if (attendanceResponse.ok) {
          try {
            attendanceData = await attendanceResponse.json();
          } catch (e) {
            console.error('❌ Fehler beim Parsen der Anwesenheitsdaten:', e);
          }
        } else if (attendanceResponse.status !== 404) {
          console.error('❌ Fehler beim Laden der Anwesenheitsdaten:', attendanceResponse.statusText);
        }

        let vertraegeData = [];
        if (vertraegeResponse.ok) {
          try {
            vertraegeData = await vertraegeResponse.json();
          } catch (e) {
            console.error('❌ Fehler beim Parsen der Vertragsdaten:', e);
          }
        } else if (vertraegeResponse.status !== 404) {
          console.error('❌ Fehler beim Laden der Vertragsdaten:', vertraegeResponse.statusText);
        }

        // Berechne offene Beiträge aus Verträgen
        const memberVertraege = Array.isArray(vertraegeData?.data)
          ? vertraegeData.data.filter(v => v.mitglied_id === mitgliedId)
          : Array.isArray(vertraegeData)
            ? vertraegeData.filter(v => v.mitglied_id === mitgliedId)
            : [];

        const paymentsData = memberVertraege;

        let memberKurse = [];
        try {
          if (kurseResponse.ok) {
            const kurseData = await kurseResponse.json();
            memberKurse = Array.isArray(kurseData) ? kurseData : (kurseData.kurse || []);
          }
        } catch (e) {
          console.warn('⚠️ Kurse für Anwesenheitsberechnung nicht ladbar:', e);
        }

        // Berechne Statistiken

        // Tatsächlich besuchte Trainings (anwesend=1)
        const totalAnwesend = Array.isArray(attendanceData)
          ? attendanceData.filter(a => a.anwesend === 1 || a.anwesend === true).length
          : 0;

        // Mögliche Trainings seit Eintrittsdatum berechnen (Stundenplan-basiert)
        const wochentagMap = {
          'Montag': 1, 'Dienstag': 2, 'Mittwoch': 3, 'Donnerstag': 4,
          'Freitag': 5, 'Samstag': 6, 'Sonntag': 0
        };

        const eintrittsdatum = memberData.eintrittsdatum ? new Date(memberData.eintrittsdatum) : null;
        const heute = new Date();
        heute.setHours(23, 59, 59, 0);

        let moeglich = 0;
        if (eintrittsdatum && memberKurse.length > 0) {
          memberKurse.forEach(kurs => {
            if (!kurs.wochentag) return;
            const zielTag = wochentagMap[kurs.wochentag];
            if (zielTag === undefined) return;

            // Ersten Trainingstag ab Eintrittsdatum finden
            const start = new Date(eintrittsdatum);
            start.setHours(0, 0, 0, 0);
            const tageOffset = (zielTag - start.getDay() + 7) % 7;
            start.setDate(start.getDate() + tageOffset);

            if (start <= heute) {
              const diffMs = heute - start;
              const diffTage = Math.floor(diffMs / (1000 * 60 * 60 * 24));
              moeglich += Math.floor(diffTage / 7) + 1;
            }
          });
        }

        const attendancePercentage = moeglich > 0
          ? Math.round((totalAnwesend / moeglich) * 100)
          : null;

        // Offene Beiträge zählen - ABER: Beitragsfreie Mitglieder haben immer 0
        // Gelöschte/archivierte Verträge (geloescht=true) ebenfalls ausschließen
        const openPayments = memberData.beitragsfrei === 1 || memberData.beitragsfrei === true
          ? 0
          : (Array.isArray(paymentsData)
              ? paymentsData.filter(v =>
                  !v.geloescht &&
                  v.status === 'aktiv' &&
                  (!v.lastschrift_status || v.lastschrift_status === 'ausstehend' || v.lastschrift_status === 'fehlgeschlagen')
                ).length
              : 0);

        const nextExam = memberData.naechste_pruefung_datum;

        setStats({
          trainingsstunden: totalAnwesend,
          anwesenheitAnwesend: totalAnwesend,
          anwesenheitMoeglich: moeglich,
          anwesenheit: attendancePercentage,
          offeneBeitraege: openPayments,
          naechstePruefung: nextExam
        });
        
        // Speichere Mitgliederdaten für weitere Verwendung
        setMemberData(memberData);
        console.log('✅ memberData State gesetzt für:', memberData.vorname, memberData.nachname);
        setAttendanceHistory(attendanceData);
        setPaymentHistory(paymentsData);

        // Alle nachgelagerten Loads parallel ausführen
        await Promise.all([
          loadMemberStyles(memberData.mitglied_id),
          loadNotifications(memberData.email || user?.email),
          loadApprovedExams(memberData.mitglied_id),
          loadExamResults(memberData.mitglied_id),
          loadReferralData(memberData.mitglied_id),
          loadNeueEvents(memberData.mitglied_id),
          loadUpcomingEvents(memberData.mitglied_id),
          loadMemberNews(),
          loadMemberDokumente(memberData.mitglied_id),
          loadAnnouncements(),
        ]);

        // Separat laden — darf Hauptload nicht blockieren
        loadMeineUmfragen();

      } catch (error) {
        console.error('❌ Fehler beim Laden der Mitgliederdaten:', error);
        // Fallback auf Mock-Daten
        setStats({
          trainingsstunden: 156,
          anwesenheit: 89,
          offeneBeitraege: 2,
          naechstePruefung: '2024-02-15'
        });
      }
    };

    // Geburtstags-Prüfung
    const checkBirthday = async () => {
      if (!user?.mitglied_id) return;

      try {
        const response = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${user.mitglied_id}/birthday-check`);
        const data = await response.json();

        if (data.hasBirthday) {
          // Füge Geburtstags-Benachrichtigung hinzu
          const birthdayNotification = {
            id: `birthday-${Date.now()}`,
            type: 'birthday',
            title: '🎉 Herzlichen Glückwunsch!',
            message: `Alles Gute zum ${data.mitglied.alter}. Geburtstag! Wir wünschen dir einen wundervollen Tag! 🎂`,
            timestamp: new Date().toISOString(),
            read: false,
            priority: 'high'
          };

          setNotifications(prev => [birthdayNotification, ...prev]);
          setUnreadCount(prev => prev + 1);

          console.log(`🎂 Geburtstag erkannt: ${data.mitglied.vorname} wird ${data.mitglied.alter} Jahre alt!`);
        }
      } catch (error) {
        console.error('Fehler beim Geburtstags-Check:', error);
      }
    };

    if (user?.email || user?.mitglied_id) {
      loadMemberData();
      checkBirthday();
    }
  }, [user?.email, user?.mitglied_id]);

  // Meine Vertrag-Anpassungen + Ruhepause laden
  useEffect(() => {
    if (!user?.mitglied_id) return;
    const token = localStorage.getItem('memberToken') || localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };
    const loadAnpassungen = async () => {
      try {
        const resp = await fetch('/api/vertrag-anpassungen/meine', { headers });
        if (resp.ok) { const data = await resp.json(); setMeineAnpassungen(data.anpassungen || []); }
      } catch (_) {}
    };
    const loadRuhepause = async () => {
      try {
        const resp = await fetch('/api/vertrag-anpassungen/aktive-ruhepause', { headers });
        if (resp.ok) { const data = await resp.json(); if (data.success) setRuhepauseInfo(data); }
      } catch (_) {}
    };
    const loadRuhepauseMax = async () => {
      try {
        const resp = await fetch('/api/vertrag-anpassungen/ruhepause-einstellungen', { headers });
        if (resp.ok) { const data = await resp.json(); if (data.success) setRuhepauseMaxMonate(data.max_monate || 3); }
      } catch (_) {}
    };
    loadAnpassungen();
    loadRuhepause();
    loadRuhepauseMax();
  }, [user?.mitglied_id]);

  // Zahlungshinweise / Mahnungen laden
  useEffect(() => {
    if (!user?.email) return;
    const loadNachrichten = async () => {
      try {
        const resp = await fetchWithAuth('/api/member/nachrichten');
        if (resp.ok) {
          const data = await resp.json();
          setZahlungsNachrichten(data.nachrichten || []);
          setHatMahnung(data.hatMahnung || false);
        }
      } catch (err) {
        // Fehler still ignorieren — Banner ist nicht kritisch
      }
    };
    loadNachrichten();
  }, [user?.email]);

  // Browser-Titel und URL dynamisch setzen
  useEffect(() => {
    if (memberData) {
      const name = `${memberData.vorname} ${memberData.nachname}`;
      const dojo = activeDojo?.dojoname || memberData.dojo_name || 'Dojosoftware';
      document.title = `${name} | ${dojo}`;
    }
    return () => { document.title = 'Dojosoftware'; };
  }, [memberData, activeDojo]);

  // Lade alle verfügbaren Stile
  const loadStile = async () => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/stile`);
      if (response.ok) {
        const data = await response.json();
        setStile(data);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Stile:', error);
    }
  };

  // Lade Stil & Gurt Daten
  const loadMemberStyles = async (memberId) => {
    setStileLoading(true);
    try {
      // Lade zuerst alle Stile
      await loadStile();
      
      const response = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${memberId}/stile`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.stile) {
          setMemberStile(result.stile);
          
          // Lade stilspezifische Daten für jeden Stil
          result.stile.forEach(async (stil) => {
            await loadStyleSpecificData(memberId, stil.stil_id);
          });
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Mitglied-Stile:', error);
    } finally {
      setStileLoading(false);
    }
  };

  // Lade stilspezifische Daten
  const loadStyleSpecificData = async (memberId, stilId) => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${memberId}/stil/${stilId}/data`);
      if (response.ok) {
        const result = await response.json();
        setStyleSpecificData(prev => ({
          ...prev,
          [stilId]: result.data
        }));

        // naechste_pruefung aus Stil-Daten wird NICHT für den Countdown verwendet,
        // da sie aus pruefungstermin_vorlagen kommt (unabhängig von tatsächlicher Anmeldung).
        // Stattdessen setzt loadApprovedExams den echten Teilnehmer-Status.
      }
    } catch (error) {
      console.error(`Fehler beim Laden stilspezifischer Daten für Stil ${stilId}:`, error);
    }
  };

  // Prüfungsanmeldung Handler
  const handleOpenExamRegistration = (exam) => {
    setSelectedExam(exam);
    setAcceptedConditions(false);
    setShowExamRegistrationModal(true);
  };

  const handleExamRegistration = async () => {
    if (!selectedExam || !acceptedConditions) {
      alert('Bitte akzeptiere die Teilnahmebedingungen.');
      return;
    }

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/pruefungen/${selectedExam.pruefung_id}/teilnahme-bestaetigen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mitglied_id: memberData.mitglied_id
        })
      });

      if (response.ok) {
        const result = await response.json();

        // Reload exams to reflect the new confirmation status
        await loadApprovedExams(memberData.mitglied_id);

        // Close modal and reset state
        setShowExamRegistrationModal(false);
        setSelectedExam(null);
        setAcceptedConditions(false);

        // Show success message
        alert('✅ Deine Teilnahme wurde erfolgreich bestätigt!');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fehler bei der Anmeldung');
      }
    } catch (error) {
      console.error('❌ Fehler bei Prüfungsanmeldung:', error);
      alert(`Fehler bei der Anmeldung: ${error.message}`);
    }
  };

  const handleNavigation = (path) => {
    navigate(path);
  };

  // Berechne Tage bis zur Prüfung
  const getDaysUntilExam = (examDate) => {
    const today = new Date();
    const exam = new Date(examDate);
    const diffTime = exam - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Keine geplant';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  // Berechne aktuelle Gürtelfarben aus memberStile
  const currentBelts = useMemo(() => {
    if (!memberStile || memberStile.length === 0) {
      return [{ name: 'Weiß', farbe: '#ffffff' }];
    }

    const belts = memberStile.map(stil => {
      const stilData = styleSpecificData[stil.stil_id];
      const stilName = stil.name || '';

      if (!stilData || !stilData.current_graduierung_id) {
        if (stil.current_gurtfarbe) {
          return { stilName, name: stil.current_gurtfarbe, farbe: null };
        }
        const firstGrad = stil.graduierungen?.[0];
        return { stilName, name: firstGrad?.name || 'Weiß', farbe: firstGrad?.farbe_hex || '#ffffff' };
      }

      const currentGrad = stil.graduierungen?.find(g => g.graduierung_id === stilData.current_graduierung_id);
      return { stilName, name: currentGrad?.name || 'Weiß', farbe: currentGrad?.farbe_hex || '#ffffff' };
    }).filter(Boolean);

    return belts.length > 0 ? belts : [{ name: 'Weiß', farbe: '#ffffff' }];
  }, [memberStile, styleSpecificData]);

  // Debug: Log memberData status on render
  console.log('🎨 MemberDashboard Render - memberData:', memberData ? 'vorhanden' : 'nicht vorhanden', memberData);
  console.log('🎨 Aktuelle Gürtel:', currentBelts.map(b => b.name).join(', '));

  return (
    <div className="dashboard-container">
      <MemberHeader />

      {/* Umfragen-Popup: erscheint beim Login wenn offene Umfragen vorhanden */}
      <UmfragePopup />

      {/* ProfilWizard: Notfallkontakt beim ersten Login */}
      {showProfilWizard && memberData && (
        <ProfilWizard
          mitgliedId={memberData.mitglied_id}
          vorname={memberData.vorname}
          onClose={() => setShowProfilWizard(false)}
        />
      )}

      {/* Event-Benachrichtigungs-Popup */}
      {showEventPopup && neueEvents.length > 0 && (
        <EventNotificationPopup
          events={neueEvents}
          memberData={memberData}
          onAnmelden={handleEventPopupAnmelden}
          onAblehnen={handleEventPopupAblehnen}
          onSpaeter={handleEventPopupSpaeter}
          onClose={() => setShowEventPopup(false)}
        />
      )}

      {/* Push-Benachrichtigungs-Popup */}
      {showPushPopup && notifications.filter(n => n.status === 'unread' || (n.requires_confirmation && !n.confirmed_at)).length > 0 && (
        <PushNotificationPopup
          notifications={notifications.filter(n => n.status === 'unread' || (n.requires_confirmation && !n.confirmed_at))}
          onClose={() => setShowPushPopup(false)}
          onConfirm={async (id) => {
            await confirmNotification(id);
            // Nachrichten neu laden nach Bestätigung
            if (memberData?.email || user?.email) {
              await loadNotifications(memberData?.email || user?.email);
            }
          }}
        />
      )}

      {/* Benachrichtigung "Weiterlesen" Modal */}
      {expandedNotif && (
        <div className="pnp-overlay" onClick={() => setExpandedNotif(null)}>
          <div className="pnp-card" onClick={e => e.stopPropagation()}>
            <div className="pnp-header">
              <div className="pnp-header-left">
                <Bell size={16} className="pnp-bell-icon" />
                <span className="pnp-header-title">{expandedNotif.subject || expandedNotif.title || 'Benachrichtigung'}</span>
              </div>
              <button className="pnp-close-btn" onClick={() => setExpandedNotif(null)} title="Schließen">
                ✕
              </button>
            </div>
            <div className="pnp-body">
              <div className="pnp-message">{expandedNotif.message}</div>
              {expandedNotif.created_at && (
                <div className="pnp-time">
                  {new Date(expandedNotif.created_at).toLocaleString('de-DE', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              )}
              {!!expandedNotif.requires_confirmation && !expandedNotif.confirmed_at && (
                <button
                  className="pnp-confirm-btn"
                  style={{ marginTop: '0.75rem' }}
                  onClick={async () => {
                    await confirmNotification(expandedNotif.id);
                    if (memberData?.email || user?.email) {
                      await loadNotifications(memberData?.email || user?.email);
                    }
                    setExpandedNotif(null);
                  }}
                >
                  <Check size={14} /> Bestätigen
                </button>
              )}
              {!!expandedNotif.requires_confirmation && expandedNotif.confirmed_at && (
                <div className="pnp-confirmed-badge" style={{ marginTop: '0.75rem' }}>
                  ✓ Bestätigt am {new Date(expandedNotif.confirmed_at).toLocaleString('de-DE')}
                </div>
              )}
            </div>
            <div className="pnp-footer">
              <span />
              <button className="pnp-next-btn" onClick={() => setExpandedNotif(null)}>Schließen</button>
            </div>
          </div>
        </div>
      )}

      {/* Prüfungseinladungs-Popup (Lesebestätigung) */}
      {pruefungsEinladungPopup && (
        <div className="pnp-overlay" onClick={() => setPruefungsEinladungPopup(null)}>
          <div className="pnp-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="pnp-header">
              <div className="pnp-header-left">
                <span style={{ fontSize: '20px' }}>🥋</span>
                <span className="pnp-header-title">Gürtelprüfung – Einladung</span>
              </div>
              <button className="pnp-close-btn" onClick={() => setPruefungsEinladungPopup(null)} title="Schließen">✕</button>
            </div>
            <div className="pnp-body">
              <p style={{ marginBottom: '0.75rem', lineHeight: '1.5' }}>
                Du wurdest zur <strong>{pruefungsEinladungPopup.stil_name}</strong>-Prüfung eingeladen!
              </p>
              {pruefungsEinladungPopup.graduierung_nachher && (
                <p style={{ marginBottom: '0.5rem' }}>
                  🎯 Prüfung zum: <strong>{pruefungsEinladungPopup.graduierung_nachher}</strong>
                </p>
              )}
              {pruefungsEinladungPopup.pruefungsdatum && (
                <p style={{ marginBottom: '0.5rem' }}>
                  📅 Termin: <strong>{new Date(pruefungsEinladungPopup.pruefungsdatum).toLocaleDateString('de-DE', {
                    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
                  })}</strong>
                  {pruefungsEinladungPopup.pruefungszeit && ` um ${pruefungsEinladungPopup.pruefungszeit} Uhr`}
                </p>
              )}
              {pruefungsEinladungPopup.pruefungsort && (
                <p style={{ marginBottom: '0.75rem' }}>
                  📍 Ort: <strong>{pruefungsEinladungPopup.pruefungsort}</strong>
                </p>
              )}
              <button
                className="pnp-confirm-btn"
                style={{ marginTop: '0.5rem', width: '100%' }}
                onClick={() => handlePruefungsEinladungGelesen(pruefungsEinladungPopup)}
              >
                ✓ Zur Kenntnis genommen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zahlungshinweis-Banner */}
      {hatMahnung && zahlungsNachrichten.length > 0 && (
        <div className="member-alert-banner">
          <span className="member-alert-icon">⚠️</span>
          <div className="member-alert-content">
            <strong className="member-alert-title">Offene Zahlung auf Ihrem Konto</strong>
            <span className="member-alert-text">
              Es gibt eine ausstehende Zahlung. Bitte prüfen Sie Ihre Zahlungsdaten und kontaktieren Sie uns bei Fragen.
            </span>
          </div>
          <a href="/member/payments" className="member-alert-link">
            Zur Zahlungsübersicht
          </a>
        </div>
      )}

      <div className="dashboard-content">
        <div className="dashboard-start">
          {/* Header - Karate Design */}
          <div className="member-welcome-wrap">
            <div className="member-welcome-dojo">
              道場 — {activeDojo?.dojoname || 'Kampfkunstschule'}
            </div>
            <div className="member-welcome-row">
              <span className="member-welcome-kanji">歓迎</span>
              <h1 className="member-welcome-title">
                {memberData ? `${memberData.vorname} ${memberData.nachname}` : user?.username || 'Mitglied'}
              </h1>
              <span className="member-welcome-kanji">歓迎</span>
            </div>
            <div className="member-welcome-subtitle">
              心技体 — Shin · Gi · Tai
            </div>
          </div>

      {/* Push-Benachrichtigungen Banner — ganz oben, verschwindet nach Aktivierung */}
      {pushStatus !== 'unsupported' && pushStatus !== 'granted' && pushStatus !== 'denied' && (
        <div className="md-push-banner">
          <span className="md-push-banner-icon">🔔</span>
          <span className="md-push-banner-text">Trainings-Erinnerungen aktivieren</span>
          <button
            className="md-push-banner-btn"
            onClick={handlePushSubscribe}
            disabled={pushLoading}
          >
            {pushLoading ? '…' : 'Aktivieren'}
          </button>
        </div>
      )}

      {/* Mobile Hero: QR + Check-in prominente Schnellbuttons */}
      <div className="md-mobile-hero">
        <button
          className="md-mobile-hero-btn md-mobile-hero-btn--primary"
          onClick={() => setShowQRCode(true)}
        >
          <span className="md-mobile-hero-btn-icon">📱</span>
          <span className="md-mobile-hero-btn-label">QR-Code</span>
          <span className="md-mobile-hero-btn-sub">Mitgliedsausweis</span>
        </button>
        <button
          className="md-mobile-hero-btn md-mobile-hero-btn--secondary"
          onClick={() => handleQuickAction('checkin')}
        >
          <span className="md-mobile-hero-btn-icon">✅</span>
          <span className="md-mobile-hero-btn-label">Check-in</span>
          <span className="md-mobile-hero-btn-sub">Training erfassen</span>
        </button>
      </div>

      {/* Nächste Trainings Widget — mobil prominent oben */}
      <div className="md-mobile-schedule-widget">
        <NextTrainingsWidget />
      </div>

      {/* Ausweis + Stats: 2 Karten | Ausweis | 2 Karten */}
      {memberData && (
        <div className="member-stats-grid md-stats-grid">

          {/* Linke Spalte: Training + Anwesenheit */}
          <div className="member-stat-column">
            <div className="member-stat-card">
              <div className="member-stat-icon">🏃‍♂️</div>
              <h3 className="member-stat-label">TRAININGS</h3>
              <div className="member-stat-value">{stats.trainingsstunden}</div>
              <div className="member-stat-sublabel">Einheiten absolviert</div>
            </div>
            <div className="member-stat-card">
              <div className="member-stat-icon">📊</div>
              <h3 className="member-stat-label">ANWESENHEIT</h3>
              <div className="member-stat-value">
                {stats.anwesenheit !== null ? `${stats.anwesenheit}%` : '—'}
              </div>
              {stats.anwesenheitAnwesend > 0 && (
                <div className="member-stat-sublabel">
                  {stats.anwesenheitAnwesend} Termine
                </div>
              )}
            </div>
          </div>

          {/* Mitte: Mitgliedsausweis */}
          <div className="mitgliedsausweis-container">
            <div className="mitgliedsausweis" ref={ausweisRef}>
              <div className="ausweis-title">
                <span className="title-jp">格闘技学校</span>
                <span className="title-de">Kampfkunstschule Schreiner</span>
              </div>
              <div className="ausweis-body">
                <div className="ausweis-left">
                  <img
                    src={dojoLogo}
                    alt="Kampfkunstschule Schreiner"
                    className="ausweis-logo"
                  />
                </div>
                <div className="ausweis-center">
                  <div className="ausweis-kanji">武道</div>
                  <div className="ausweis-name">
                    {memberData.vorname} · {memberData.nachname}
                  </div>
                  <div className="ausweis-info-list">
                    <div className="ausweis-info-row">
                      <span className="info-label">Mitglieds-Nr.</span>
                      <span className="info-value">{String(memberData.mitglied_id).padStart(5, '0')}</span>
                    </div>
                    <div className="ausweis-info-row">
                      <span className="info-label">Mitglied seit</span>
                      <span className="info-value">
                        {memberData.eintrittsdatum
                          ? new Date(memberData.eintrittsdatum).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' })
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="ausweis-right">
                  <div className="ausweis-foto">
                    {memberData.foto_pfad ? (
                      <img
                        src={`${config.apiBaseUrl.replace('/api', '')}/${memberData.foto_pfad}`}
                        alt={`${memberData.vorname} ${memberData.nachname}`}
                      />
                    ) : (
                      <div className="ausweis-foto-placeholder">
                        <span>写真</span>
                      </div>
                    )}
                  </div>
                  <div className="ausweis-qr">
                    <QRCodeSVG
                      value={`DOJO-CHECKIN:${memberData.dojo_id || '0'}:${memberData.mitglied_id || '0'}`}
                      size={70}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  </div>
                </div>
              </div>
              <div className="ausweis-footer">
                <div className="ausweis-motto">心技体 — Shin Gi Tai</div>
                <div className="ausweis-website">www.tda-vib.de</div>
              </div>
            </div>
          </div>

          {/* Rechte Spalte: Gurt + Beiträge */}
          <div className="member-stat-column">
            <div className="member-stat-card">
              <div className="member-stat-icon">🎓</div>
              <h3 className="member-stat-label">GÜRTEL</h3>
              <div className="member-belt-list">
                {currentBelts.map((b, i) => (
                  <div key={i} className="member-belt-entry">
                    {b.stilName && (
                      <span className="member-belt-stilname">{b.stilName}</span>
                    )}
                    <div className="member-belt-item">
                      <span
                        className="member-belt-stripe"
                        style={{ background: b.farbe || '#ffffff' }}
                      />
                      <span className="member-belt-name">{b.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="member-stat-card">
              <div className="member-stat-icon">{stats.offeneBeitraege > 0 ? '⚠️' : '✅'}</div>
              <h3 className="member-stat-label">BEITRÄGE</h3>
              {stats.offeneBeitraege === 0 ? (
                <>
                  <div className="member-stat-value md-stat-value--success">✓</div>
                  <div className="member-stat-sublabel">Alles bezahlt</div>
                </>
              ) : (
                <>
                  <div className="member-stat-value md-stat-value--error">{stats.offeneBeitraege}</div>
                  <div className="member-stat-sublabel md-stat-sublabel--error">offen</div>
                </>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Hauptnavigation - alle 6 Karten in einer Reihe */}
      <div className="cta-grid member-navigation-grid md-navigation-grid">
        <div className="cta-tile cta-tile-nav" onClick={() => handleNavigation('/member/profile')}>
          <User size={24} />
          <span className="cta-tile-nav-label">{t('navigation.myData')}</span>
        </div>
        <div className="cta-tile cta-tile-nav" onClick={() => handleNavigation('/member/schedule')}>
          <Calendar size={24} />
          <span className="cta-tile-nav-label">{t('navigation.mySchedule')}</span>
        </div>
        <div className="cta-tile cta-tile-nav" onClick={() => handleNavigation('/member/payments')}>
          <CreditCard size={24} />
          <span className="cta-tile-nav-label">{t('navigation.myPayments')}</span>
        </div>
        <div className="cta-tile cta-tile-nav" onClick={() => handleNavigation('/member/stats')}>
          <BarChart3 size={24} />
          <span className="cta-tile-nav-label">{t('navigation.myStats')}</span>
        </div>
        <div className="cta-tile cta-tile-nav" onClick={() => handleNavigation('/member/styles')}>
          <Trophy size={24} />
          <span className="cta-tile-nav-label">{t('navigation.styleAndBelt')}</span>
        </div>
        <div className="cta-tile cta-tile-nav" onClick={() => handleNavigation('/member/equipment')}>
          <Package size={24} />
          <span className="cta-tile-nav-label">{t('navigation.equipment')}</span>
        </div>
        <div className="cta-tile cta-tile-nav" onClick={() => handleNavigation('/member/kalender')}>
          <CalendarSync size={24} />
          <span className="cta-tile-nav-label">{t('navigation.calendarSync')}</span>
        </div>
      </div>

      {/* Schnellzugriff - eine Zeile */}
      <div className="member-quick-actions-grid">
        <div className="cta-tile cta-tile-quick" onClick={() => handleQuickAction('checkin')}>
          <Clock size={20} />
          <span className="cta-tile-quick-label">{t('quickActions.checkin')}</span>
        </div>
        <div className="cta-tile cta-tile-quick cta-tile-qr" onClick={() => setShowQRCode(true)}>
          <QrCode size={20} />
          <span className="cta-tile-quick-label">{t('quickActions.myQrCode')}</span>
        </div>
        <div className={`cta-tile cta-tile-quick${showAbwesenheitWidget ? ' cta-tile--active' : ''}`} onClick={() => setShowAbwesenheitWidget(v => !v)}>
          <CalendarX size={20} />
          <span className="cta-tile-quick-label">Abwesenheit</span>
        </div>
        <div className="cta-tile cta-tile-quick" onClick={() => navigate('/member/events')}>
          <Calendar size={20} />
          <span className="cta-tile-quick-label">{t('quickActions.events')}</span>
        </div>
        <div className="cta-tile cta-tile-quick" onClick={() => handleQuickAction('notifications')}>
          <Bell size={20} />
          <span className="cta-tile-quick-label">{t('quickActions.notifications')}</span>
          {unreadCount > 0 && (
            <span className="member-notif-badge">{unreadCount}</span>
          )}
        </div>
      </div>

      {/* Abwesenheit Widget — per Tile-Klick aufklappbar */}
      {showAbwesenheitWidget && <AbwesenheitWidget />}

      {/* Kommende Events Widget */}
      {upcomingEvents.length > 0 && (
        <div className="member-events-wrap">
          <div className="member-events-header">
            <h3 className="member-events-title">
              <Calendar size={16} /> Kommende Events
            </h3>
            <span className="member-events-link" onClick={() => navigate('/member/events')}>
              Alle ansehen →
            </span>
          </div>
          <div className="member-event-list">
            {upcomingEvents.slice(0, 3).map(event => {
              const eventDate = new Date(event.datum).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' });
              return (
                <div
                  key={event.event_id}
                  onClick={() => navigate('/member/events')}
                  className={`md-event-card${event.ist_angemeldet ? ' md-event-card--registered' : ''}`}
                >
                  <div className="member-event-date">
                    <div className="member-event-weekday">{eventDate.split(' ')[0]}</div>
                    <div className="member-event-day">{eventDate.split(' ')[1]}</div>
                    <div className="member-event-month">{eventDate.split(' ')[2]}</div>
                  </div>
                  <div className="member-event-info">
                    <div className="member-event-name">{event.titel}</div>
                    {event.ort && <div className="member-event-location">{event.ort}</div>}
                  </div>
                  {event.ist_angemeldet ? (
                    <span className="member-event-badge registered">✓ Angemeldet</span>
                  ) : (
                    <span className="member-event-badge register">Anmelden</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* News Widget */}
      {memberNews.length > 0 && (
        <div className="member-news-wrap">
          <div className="member-news-header">
            <h3 className="member-news-title">📰 Aktuelles</h3>
          </div>
          <div className="member-news-list">
            {memberNews.slice(0, 3).map(artikel => (
              <div key={artikel.id} className="member-news-card">
                {artikel.bilder.length > 0 && (
                  <MemberNewsSlideshow bilder={artikel.bilder} titel={artikel.titel} />
                )}
                <div className="member-news-card-content">
                  <div className="member-news-date">
                    {artikel.datum
                      ? new Date(artikel.datum).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
                      : ''}
                  </div>
                  <div className="member-news-card-titel">{artikel.titel}</div>
                  {artikel.kurzbeschreibung && (
                    <p className="member-news-card-excerpt">{artikel.kurzbeschreibung}</p>
                  )}
                  {artikel.inhalt && (
                    <button className="member-news-weiterlesen" onClick={() => setOffeneNews(artikel)}>
                      Weiterlesen →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* News Modal */}
      {offeneNews && (
        <MemberNewsModal artikel={offeneNews} onClose={() => setOffeneNews(null)} />
      )}

      {/* Freunde werben Freunde – prominent nach den Quick Actions */}
      {referralData && (
        <div className="member-referral-wrap">
          {/* Titel */}
          <div className="member-referral-header">
            <span className="member-referral-icon">🤝</span>
            <div>
              <div className="member-referral-title">Freunde werben Freunde</div>
              <div className="member-referral-subtitle">
                Empfehle uns und kassiere{referralData.standard_praemie ? ` ${referralData.standard_praemie} €` : ' eine Prämie'}!
              </div>
            </div>
          </div>

          {/* Prämie prominent */}
          {referralData.standard_praemie && (
            <div className="md-referral-praemie">
              <span className="md-referral-praemie-icon">💶</span>
              <div>
                <div className="md-referral-praemie-amount">
                  {referralData.standard_praemie} € pro Mitglied
                </div>
                <div className="md-referral-praemie-sub">
                  Für jede erfolgreiche Empfehlung — unbegrenzt!
                </div>
              </div>
            </div>
          )}

          {/* Erklärung */}
          <div className="md-referral-explanation">
            Empfehle uns an Freunde oder Familie weiter. Für <strong className="u-text-primary">jedes neue Mitglied</strong>,
            das sich mit deinem persönlichen Code anmeldet, bekommst du{' '}
            <strong className="u-text-accent">
              {referralData.standard_praemie ? `${referralData.standard_praemie} €` : 'eine Prämie'}
              {referralData.max_kostenlos_monate > 0 ? ` oder bis zu ${referralData.max_kostenlos_monate} Gratismonate` : ''}
            </strong>.
            {' '}Je mehr du wirbst, desto mehr verdienst du!
          </div>

          {/* Code */}
          <div>
            <div className="md-referral-code-label">
              Dein persönlicher Empfehlungscode
            </div>
            <div className="md-referral-code-box">
              <span className="md-referral-code-value">
                {referralData.code}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(referralData.code);
                  setReferralCopied(true);
                  setTimeout(() => setReferralCopied(false), 2000);
                }}
                className={`md-referral-copy-btn${referralCopied ? ' md-referral-copy-btn--copied' : ''}`}
              >
                {referralCopied ? <><Check size={14} /> Kopiert!</> : <><Copy size={14} /> Kopieren</>}
              </button>
            </div>
          </div>

          {/* Anmelde-Link */}
          <div className="md-referral-link-wrap">
            <div className="md-referral-link-label">
              Anmeldeseite für deine Freunde:
            </div>
            <div className="md-referral-link-url">
              {window.location.origin}/mitglied-werden
            </div>
          </div>
        </div>
      )}

      {/* Badges / Auszeichnungen */}
      {memberData && (
        <div className="md-badges-section">
          <BadgeDisplay mitgliedId={memberData.mitglied_id} compact={false} />
        </div>
      )}

      {/* Vertragsstatus / Tarifanpassung */}
      <div className="md-anpassung-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>📋 Mein Vertragsstatus</h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setShowRuhepauseForm(f => !f); setShowAnpassungForm(false); setRuhepauseError(''); setRuhepauseSuccess(''); }}
              style={{ background: showRuhepauseForm ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${showRuhepauseForm ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.12)'}`, borderRadius: 8, padding: '0.35rem 0.75rem', color: showRuhepauseForm ? '#60a5fa' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem' }}
            >
              {showRuhepauseForm ? '↑ Schließen' : '⏸ Ruhepause beantragen'}
            </button>
            <button
              onClick={() => { setShowAnpassungForm(f => !f); setShowRuhepauseForm(false); setAnpassungError(''); setAnpassungSuccess(''); }}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '0.35rem 0.75rem', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem' }}
            >
              {showAnpassungForm ? '↑ Schließen' : '+ Anpassung beantragen'}
            </button>
          </div>
        </div>

        {/* Aktive Anpassung anzeigen */}
        {meineAnpassungen.filter(a => a.status === 'genehmigt').length > 0 && (
          <div style={{ background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.3)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
            {meineAnpassungen.filter(a => a.status === 'genehmigt').map(a => {
              const typLabels = { schueler: 'Schüler', student: 'Student', azubi: 'Azubi', rentner: 'Rentner', sonstiges: 'Sonstiges' };
              return (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ color: '#4caf50', fontWeight: 600 }}>✓ {typLabels[a.typ] || a.typ}-Tarif aktiv</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{parseFloat(a.neuer_betrag).toFixed(2).replace('.', ',')} €/Monat</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>bis {new Date(a.gueltig_bis).toLocaleDateString('de-DE')}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Offene Anträge */}
        {meineAnpassungen.filter(a => a.status === 'beantragt').length > 0 && (
          <div style={{ background: 'rgba(255,152,0,0.08)', border: '1px solid rgba(255,152,0,0.3)', borderRadius: 10, padding: '0.65rem 1rem', marginBottom: '0.75rem', fontSize: '0.85rem', color: '#ff9800' }}>
            ⏳ Dein Antrag wartet auf Genehmigung durch den Administrator.
          </div>
        )}

        {/* Aktive / geplante Ruhepause */}
        {ruhepauseInfo?.aktiv && ruhepauseInfo.ruhepause && (
          <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
              <span style={{ color: '#60a5fa', fontWeight: 600 }}>⏸ Ruhepause aktiv</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                {new Date(ruhepauseInfo.ruhepause.von + 'T00:00').toLocaleDateString('de-DE')} – {new Date(ruhepauseInfo.ruhepause.bis + 'T00:00').toLocaleDateString('de-DE')}
                {ruhepauseInfo.ruhepause.dauer_monate && ` · ${ruhepauseInfo.ruhepause.dauer_monate} Monat${ruhepauseInfo.ruhepause.dauer_monate !== 1 ? 'e' : ''}`}
              </span>
            </div>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Während der Ruhepause werden keine Beiträge eingezogen. Dein Vertrag läuft danach automatisch weiter.
            </p>
          </div>
        )}
        {ruhepauseInfo?.geplant && !ruhepauseInfo?.aktiv && ruhepauseInfo.ruhepause && (
          <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '0.65rem 1rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
            <span style={{ color: '#93c5fd' }}>
              📅 Ruhepause geplant: {new Date(ruhepauseInfo.ruhepause.von + 'T00:00').toLocaleDateString('de-DE')} – {new Date(ruhepauseInfo.ruhepause.bis + 'T00:00').toLocaleDateString('de-DE')}
            </span>
          </div>
        )}
        {ruhepauseInfo?.pending && !ruhepauseInfo?.aktiv && !ruhepauseInfo?.geplant && (
          <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, padding: '0.65rem 1rem', marginBottom: '0.75rem', fontSize: '0.85rem', color: '#a5b4fc' }}>
            ⏳ Dein Ruhepause-Antrag ({new Date(ruhepauseInfo.pending.gueltig_von + 'T00:00').toLocaleDateString('de-DE')} – {new Date(ruhepauseInfo.pending.gueltig_bis + 'T00:00').toLocaleDateString('de-DE')}) wartet auf Genehmigung.
          </div>
        )}

        {/* Ruhepause-Formular */}
        {showRuhepauseForm && (
          <div style={{ background: 'rgba(59,130,246,0.05)', borderRadius: 10, padding: '1rem', border: '1px solid rgba(59,130,246,0.2)', marginBottom: '0.75rem' }}>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Eine Ruhepause unterbricht deinen Vertrag für einen bestimmten Zeitraum – keine Beiträge, volle Reaktivierung danach. Max. {ruhepauseMaxMonate} Monat{ruhepauseMaxMonate !== 1 ? 'e' : ''} möglich.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.65rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Ruhepause ab</label>
                <input type="date" value={ruhepauseForm.gueltig_von}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={e => setRuhepauseForm(f => ({ ...f, gueltig_von: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Ruhepause bis</label>
                <input type="date" value={ruhepauseForm.gueltig_bis}
                  min={ruhepauseForm.gueltig_von || new Date().toISOString().slice(0, 10)}
                  onChange={e => setRuhepauseForm(f => ({ ...f, gueltig_bis: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Grund (optional)</label>
                <input type="text" placeholder="z.B. Verletzung, Urlaub, berufliche Auszeit…"
                  value={ruhepauseForm.grund}
                  onChange={e => setRuhepauseForm(f => ({ ...f, grund: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
            </div>
            {ruhepauseError && <div style={{ color: '#f87171', fontSize: '0.82rem', marginBottom: '0.5rem' }}>⚠️ {ruhepauseError}</div>}
            {ruhepauseSuccess && <div style={{ color: '#60a5fa', fontSize: '0.82rem', marginBottom: '0.5rem' }}>✓ {ruhepauseSuccess}</div>}
            <button
              disabled={ruhepauseLoading}
              onClick={async () => {
                const { gueltig_von, gueltig_bis, grund } = ruhepauseForm;
                if (!gueltig_von || !gueltig_bis) { setRuhepauseError('Bitte Beginn und Ende ausfüllen.'); return; }
                if (gueltig_bis < gueltig_von) { setRuhepauseError('Enddatum muss nach Startdatum liegen.'); return; }
                const von = new Date(gueltig_von), bis = new Date(gueltig_bis);
                const diffMonate = (bis.getFullYear() - von.getFullYear()) * 12 + (bis.getMonth() - von.getMonth()) + (bis.getDate() >= von.getDate() ? 0 : -1) + 1;
                if (diffMonate > ruhepauseMaxMonate) { setRuhepauseError(`Ruhepause darf maximal ${ruhepauseMaxMonate} Monat${ruhepauseMaxMonate !== 1 ? 'e' : ''} dauern.`); return; }
                setRuhepauseLoading(true); setRuhepauseError('');
                try {
                  const token = localStorage.getItem('memberToken') || localStorage.getItem('token');
                  const resp = await fetch('/api/vertrag-anpassungen/beantragen', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ typ: 'ruhepause', gueltig_von, gueltig_bis, grund: grund || null })
                  });
                  const data = await resp.json();
                  if (!resp.ok) throw new Error(data.error || 'Fehler');
                  setRuhepauseSuccess('Antrag gestellt! Der Administrator wird ihn prüfen und bestätigen.');
                  setRuhepauseForm({ gueltig_von: '', gueltig_bis: '', grund: '' });
                  setShowRuhepauseForm(false);
                  // Ruhepause-Info neu laden
                  const r2 = await fetch('/api/vertrag-anpassungen/aktive-ruhepause', { headers: { 'Authorization': `Bearer ${token}` } });
                  const d2 = await r2.json();
                  if (d2.success) setRuhepauseInfo(d2);
                } catch (err) { setRuhepauseError(err.message); }
                finally { setRuhepauseLoading(false); }
              }}
              style={{ width: '100%', padding: '0.6rem', borderRadius: 8, background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', border: 'none', color: '#fff', fontWeight: 600, cursor: ruhepauseLoading ? 'not-allowed' : 'pointer', opacity: ruhepauseLoading ? 0.7 : 1 }}
            >
              {ruhepauseLoading ? '⏳ Senden…' : '⏸ Ruhepause beantragen'}
            </button>
          </div>
        )}

        {/* Antrags-Formular */}
        {showAnpassungForm && (
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '1rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.65rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Grund der Anpassung</label>
                <select
                  value={anpassungForm.typ}
                  onChange={e => setAnpassungForm(f => ({ ...f, typ: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)' }}
                >
                  <option value="schueler">Schüler</option>
                  <option value="student">Student</option>
                  <option value="azubi">Azubi</option>
                  <option value="rentner">Rentner</option>
                  <option value="sonstiges">Sonstiges</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Gültig von</label>
                <input type="date" value={anpassungForm.gueltig_von} onChange={e => setAnpassungForm(f => ({ ...f, gueltig_von: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Gültig bis</label>
                <input type="date" value={anpassungForm.gueltig_bis} onChange={e => setAnpassungForm(f => ({ ...f, gueltig_bis: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Begründung (optional)</label>
                <input type="text" placeholder="z.B. Immatrikulation liegt vor" value={anpassungForm.grund} onChange={e => setAnpassungForm(f => ({ ...f, grund: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
            </div>
            {anpassungError && <div style={{ color: '#ff6b6b', fontSize: '0.82rem', marginBottom: '0.5rem' }}>⚠️ {anpassungError}</div>}
            {anpassungSuccess && <div style={{ color: '#4caf50', fontSize: '0.82rem', marginBottom: '0.5rem' }}>✓ {anpassungSuccess}</div>}
            <button
              disabled={anpassungLoading}
              onClick={async () => {
                const { typ, gueltig_von, gueltig_bis, grund } = anpassungForm;
                if (!gueltig_von || !gueltig_bis) { setAnpassungError('Bitte Beginn und Ende ausfüllen.'); return; }
                setAnpassungLoading(true); setAnpassungError('');
                try {
                  const token = localStorage.getItem('memberToken') || localStorage.getItem('token');
                  const resp = await fetch('/api/vertrag-anpassungen/beantragen', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ typ, gueltig_von, gueltig_bis, grund: grund || null })
                  });
                  const data = await resp.json();
                  if (!resp.ok) throw new Error(data.error || 'Fehler');
                  setAnpassungSuccess('Antrag erfolgreich gestellt! Der Administrator wird ihn prüfen.');
                  setAnpassungForm({ typ: 'student', gueltig_von: '', gueltig_bis: '', grund: '' });
                  setShowAnpassungForm(false);
                  // Anpassungen neu laden
                  const r2 = await fetch('/api/vertrag-anpassungen/meine', { headers: { 'Authorization': `Bearer ${token}` } });
                  const d2 = await r2.json();
                  setMeineAnpassungen(d2.anpassungen || []);
                } catch (err) { setAnpassungError(err.message); }
                finally { setAnpassungLoading(false); }
              }}
              style={{ width: '100%', padding: '0.6rem', borderRadius: 8, background: 'linear-gradient(135deg, var(--primary), var(--primary-dark, #b8860b))', border: 'none', color: '#fff', fontWeight: 600, cursor: anpassungLoading ? 'not-allowed' : 'pointer' }}
            >
              {anpassungLoading ? '⏳ Senden...' : '📩 Antrag stellen'}
            </button>
          </div>
        )}
      </div>

      {/* Persönliche Informationen - kompakter */}
      {memberData && (
        <div className="md-info-section">
          <h2 className="md-info-section-title">{t('info.title')}</h2>
          <div className="md-info-list">

            {/* Trainer-Empfehlung */}
            {memberData.trainer_empfehlung && (
              <div className="md-info-card">
                <div className="mb-icon-lg">👨‍🏫</div>
                <div>
                  <h4 className="mb-value-primary">Trainer-Empfehlung</h4>
                  <p className="mb-label-sm">{memberData.trainer_empfehlung}</p>
                </div>
              </div>
            )}

            {/* Medizinische Hinweise */}
            {memberData.medizinische_hinweise && memberData.medizinische_hinweise !== 'Keine besonderen Hinweise' && (
              <div className="md-info-card">
                <div className="mb-icon-lg">🏥</div>
                <div>
                  <h4 className="mb-value-primary">Medizinische Hinweise</h4>
                  <p className="mb-label-sm">{memberData.medizinische_hinweise}</p>
                </div>
              </div>
            )}

            {/* Prüfungs-Countdown */}
            {nextExam && (
              <div className="md-info-card">
                <div className="mb-icon-lg">🎓</div>
                <div className="u-flex-1">
                  <h4 className="mb-value-primary">Nächste Prüfung</h4>
                  <p className="md-exam-date-text">
                    {nextExam.stil} - {formatDate(nextExam.date)}
                  </p>
                  <div className="md-countdown-badge">
                    {getDaysUntilExam(nextExam.date)} Tage verbleiben
                  </div>
                </div>
              </div>
            )}

            {/* Trainingsstunden-Tracker */}
            {Object.values(styleSpecificData).some(data => data && data.stunden_seit_letzter_pruefung !== undefined) && (
              <div className="md-info-card">
                <div className="mb-icon-lg">🎯</div>
                <div className="u-flex-1">
                  <h4 className="mb-value-primary">Trainingsfortschritt</h4>
                  {Object.entries(styleSpecificData).map(([stilId, data]) => {
                    if (!data || !data.stunden_seit_letzter_pruefung) return null;
                    
                    const stil = memberStile.find(s => s.stil_id === parseInt(stilId));
                    if (!stil) return null;
                    
                    const nextGraduation = stil.graduierungen?.find(g => g.graduierung_id === data.current_graduierung_id);
                    const requiredHours = nextGraduation?.min_stunden || 0;
                    const hoursNeeded = Math.max(0, requiredHours - data.stunden_seit_letzter_pruefung);
                    
                    return (
                      <div key={stilId} className="md-progress-row">
                        <div className="md-progress-header">
                          <span className="md-progress-stil-name">
                            {stil.name}
                          </span>
                          {hoursNeeded > 0 ? (
                            <span className="md-hours-needed">
                              Noch {hoursNeeded}h
                            </span>
                          ) : (
                            <span className="md-hours-ready">
                              ✅ Bereit
                            </span>
                          )}
                        </div>
                        <div className="md-progress-track">
                          <div className="md-progress-fill" style={{
                            width: `${Math.min(100, (data.stunden_seit_letzter_pruefung / requiredHours) * 100)}%`
                          }}></div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="md-hint-text">
                    💡 Klicke auf "Stil & Gurt" für Details
                  </div>
                </div>
              </div>
            )}

            {/* Aktuelle Stile & Gürtel */}
            {memberStile.length > 0 && (
              <div className="md-info-card md-stile-card">
                <div className="md-stile-card__header">
                  <span className="md-stile-card__icon">🥋</span>
                  <span className="md-stile-card__title">Meine Kampfkunst-Stile</span>
                  <span className="md-hint-text md-hint-inline">💡 Klicke auf "Stil &amp; Gurt" für Details</span>
                </div>
                <div className="md-stile-card__chips">
                  {memberStile.map((stil) => {
                    const stilData = styleSpecificData[stil.stil_id];
                    const currentGraduation = stilData?.current_graduierung_id ?
                      stil.graduierungen?.find(g => g.graduierung_id === stilData.current_graduierung_id) :
                      stil.graduierungen?.[0];
                    return (
                      <div key={stil.stil_id} className="md-stil-chip">
                        <span className="md-stil-chip__name">{stil.name}</span>
                        {currentGraduation && (
                          <span className="md-graduation-badge">{currentGraduation.name}</span>
                        )}
                        {stilData?.letzte_pruefung && (
                          <span className="md-stil-chip__exam">Prüfung: {new Date(stilData.letzte_pruefung).toLocaleDateString('de-DE')}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Familienrabatt */}
            {memberData.rabatt_prozent && memberData.rabatt_grund && (
              <div className="md-info-card">
                <div className="mb-icon-lg">👨‍👩‍👧‍👦</div>
                <div>
                  <h4 className="mb-value-primary">Familienrabatt</h4>
                  <p className="mb-label-sm">
                    Du erhältst {memberData.rabatt_prozent}% Rabatt ({memberData.rabatt_grund})
                  </p>
                </div>
              </div>
            )}

            {/* Buddy-Gruppen Widget */}
            <BuddyGruppenWidget compact={true} />


            {/* Trainings-Erinnerungen */}
            <TrainingReminders />

            {/* Motivationssprüche */}
            <MotivationQuotes compact={true} />

            {/* Zugelassene Prüfungen */}
            {approvedExams.length > 0 && (
              <div className="md-info-card-purple">
                <div className="mb-flex-center-gap">
                  <div className="mb-icon-lg">🎓</div>
                  <div className="u-flex-1">
                    <h4 className="md-section-heading-purple">
                      Zugelassene Prüfungen
                      <span className="md-count-badge-purple">
                        {approvedExams.length}
                      </span>
                    </h4>
                  </div>
                </div>

                <div className="u-flex-col-sm">
                  {approvedExams.map((exam, index) => (
                    <div
                      key={exam.pruefung_id}
                      className="md-exam-card-purple"
                    >
                      <div className="md-exam-card-header">
                        <div>
                          <div className="md-exam-name-purple">
                            {exam.stil_name}
                          </div>
                          <div className="md-exam-sub-text">
                            Prüfung zum {exam.graduierung_nachher}
                          </div>
                        </div>
                        {exam.graduierung_nachher && exam.farbe_nachher && (
                          <div
                            className="md-belt-dot md-belt-dot--sm"
                            style={{ '--belt-color': exam.farbe_nachher }}
                            title={exam.graduierung_nachher}
                          />
                        )}
                      </div>
                      <div className="md-exam-date-text-sm">
                        📅 {exam.pruefungsdatum ? new Date(exam.pruefungsdatum).toLocaleDateString('de-DE', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) : 'Termin wird noch bekanntgegeben'}
                      </div>
                      {exam.pruefungsdatum && getDaysUntilExam(exam.pruefungsdatum) > 0 && (
                        <div className="md-exam-countdown">
                          In {getDaysUntilExam(exam.pruefungsdatum)} Tagen
                        </div>
                      )}

                      {/* Anmelden Button */}
                      {!exam.teilnahme_bestaetigt ? (
                        <button
                          onClick={() => handleOpenExamRegistration(exam)}
                          className="md-exam-register-btn"
                          onMouseOver={(e) => e.target.style.transform = 'scale(1.02)'}
                          onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                        >
                          Jetzt Anmelden
                        </button>
                      ) : (
                        <div className="md-exam-confirmed-badge">
                          ✅ Teilnahme bestätigt
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prüfungsergebnisse */}
            {examResults.length > 0 && (
              <div className="md-info-card-col">
                <div className="mb-flex-center-gap">
                  <div className="mb-icon-lg">🏆</div>
                  <div className="u-flex-1">
                    <h4 className="md-section-heading-primary">
                      Prüfungsergebnisse
                    </h4>
                  </div>
                </div>

                <div className="u-flex-col-sm">
                  {examResults.slice(0, 3).map((result, index) => (
                    <div
                      key={result.pruefung_id}
                      className={`md-exam-result-card${result.bestanden ? ' md-exam-result-card--pass' : ' md-exam-result-card--fail'}`}
                    >
                      <div className="md-result-header">
                        <div>
                          <div className={`md-exam-result-stil${result.bestanden ? ' md-exam-result-stil--pass' : ' md-exam-result-stil--fail'}`}>
                            {result.stil_name}
                          </div>
                          <div className="md-result-sub-text">
                            {result.graduierung_nachher}
                          </div>
                        </div>
                        <div className="md-result-emoji">
                          {result.bestanden ? '✅' : '❌'}
                        </div>
                      </div>
                      <div className="md-result-date-text">
                        📅 {new Date(result.pruefungsdatum).toLocaleDateString('de-DE')}
                      </div>
                      {result.punktzahl && result.max_punktzahl && (
                        <div className="md-result-score-text">
                          Punktzahl: {result.punktzahl} / {result.max_punktzahl}
                        </div>
                      )}
                      {(() => {
                        const proto = pruefProtokolle.find(p => p.pruefung_id === result.pruefung_id);
                        if (!proto || !proto.gesendet_am) return null;
                        return (
                          <button
                            onClick={() => setProtokolViewId(result.pruefung_id)}
                            style={{ marginTop: '8px', width: '100%', padding: '6px 10px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.35)', borderRadius: '6px', color: '#818cf8', cursor: 'pointer', fontSize: '12px', fontWeight: 600, textAlign: 'center' }}
                          >
                            📋 Prüfungsprotokoll ansehen
                          </button>
                        );
                      })()}
                    </div>
                  ))}
                  {examResults.length > 3 && (
                    <div className="md-more-items-hint">
                      +{examResults.length - 3} weitere Prüfungen
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Meine Umfragen */}
            {(pendingUmfragen.length > 0 || meineUmfragen.length > 0) && (
              <div className="md-info-card-col">
                <div className="mb-flex-center-gap">
                  <div className="mb-icon-lg">📋</div>
                  <div className="u-flex-1">
                    <h4 className="md-section-heading-primary">
                      Umfragen
                      {pendingUmfragen.length > 0 && (
                        <span className="md-count-badge-red" style={{ marginLeft: 6 }}>{pendingUmfragen.length}</span>
                      )}
                    </h4>
                  </div>
                </div>
                <div className="u-flex-col-sm">
                  {/* Offene (noch nicht beantwortete) Umfragen */}
                  {pendingUmfragen.map(u => {
                    const a = umfrageAntworten[u.id] || {};
                    const hatJaNein = u.typ === 'ja_nein' || u.typ === 'beides';
                    const hatKommentar = u.typ === 'kommentar' || u.typ === 'beides';
                    const kannAbsenden = hatJaNein ? a.antwort !== null : (a.kommentar || '').trim().length > 0;
                    return (
                      <div key={u.id} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.35)', borderRadius: 8, padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>{u.titel}</div>
                        {u.beschreibung && <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>{u.beschreibung}</div>}
                        {hatJaNein && (
                          <div style={{ display: 'flex', gap: 8, marginBottom: hatKommentar ? 8 : 10 }}>
                            {['ja','nein'].map(val => (
                              <button key={val} onClick={() => setUmfrageAntworten(prev => ({ ...prev, [u.id]: { ...prev[u.id], antwort: prev[u.id]?.antwort === val ? null : val } }))}
                                style={{ flex: 1, padding: '0.5rem', borderRadius: 7, border: `2px solid ${a.antwort === val ? (val === 'ja' ? '#22c55e' : '#ef4444') : 'rgba(255,255,255,0.15)'}`, background: a.antwort === val ? (val === 'ja' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)') : 'rgba(255,255,255,0.05)', color: a.antwort === val ? (val === 'ja' ? '#86efac' : '#fca5a5') : 'rgba(255,255,255,0.6)', fontWeight: 600, cursor: 'pointer' }}>
                                {val === 'ja' ? '✓ Ja' : '✗ Nein'}
                              </button>
                            ))}
                          </div>
                        )}
                        {hatKommentar && (
                          <textarea rows={2} placeholder="Kommentar (optional)…" value={a.kommentar || ''} onChange={e => setUmfrageAntworten(prev => ({ ...prev, [u.id]: { ...prev[u.id], kommentar: e.target.value } }))}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '0.5rem 0.7rem', color: '#e2e8f0', fontSize: '0.85rem', resize: 'vertical', marginBottom: 10, boxSizing: 'border-box' }} />
                        )}
                        <button onClick={() => submitUmfrageAntwort(u.id)} disabled={!kannAbsenden || umfrageSending === u.id}
                          style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', border: 'none', borderRadius: 7, color: '#fff', fontWeight: 600, padding: '0.5rem 1.25rem', cursor: kannAbsenden ? 'pointer' : 'not-allowed', opacity: kannAbsenden ? 1 : 0.4, fontSize: '0.85rem' }}>
                          {umfrageSending === u.id ? 'Wird gesendet…' : 'Absenden'}
                        </button>
                      </div>
                    );
                  })}
                  {/* Bereits beantwortete / laufende Umfragen (Ergebnisübersicht) */}
                  {meineUmfragen.filter(u => !pendingUmfragen.find(p => p.id === u.id)).map(u => (
                    <div key={u.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 4, color: '#cbd5e1' }}>{u.titel}</div>
                      <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
                        ✓ Beantwortet · {u.antworten_gesamt || 0} Stimmen gesamt
                        {u.typ !== 'kommentar' && u.antworten_gesamt > 0 && ` · ✓ ${u.antworten_ja || 0} Ja · ✗ ${u.antworten_nein || 0} Nein`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Push-Benachrichtigungen */}
            <div
              id="member-notifications"
              className="md-info-card-col"
            >
              <div className="mb-flex-center-gap">
                <div className="mb-icon-lg">📢</div>
                <div className="u-flex-1">
                  <h4 className="md-section-heading-primary">
                    {t('notifications.title')}
                    {unreadCount > 0 && (
                      <span className="md-count-badge-red">
                        {unreadCount}
                      </span>
                    )}
                  </h4>
                </div>
              </div>

              {notifications.length > 0 ? (
                <div className="u-flex-col-sm">
                  {notifications.slice(0, 3).map((notification, index) => (
                    <div
                      key={notification.id || index}
                      className={`md-notif-item${notification.status === 'unread' ? ' md-notif-item--unread' : ''}`}
                    >
                      <div className={`md-notif-title${notification.status === 'unread' ? ' md-notif-title--unread' : ''}`}>
                        {notification.subject || notification.title}
                      </div>
                      <div className="md-notif-message">
                        {(() => {
                          const msg = notification.message || '';
                          const MAX = 200;
                          if (msg.length <= MAX) return msg;
                          // Bis zu 3 Sätze oder MAX Zeichen
                          const sätze = msg.match(/[^.!?\n]+[.!?\n]+/g) || [];
                          let preview = '';
                          for (let i = 0; i < Math.min(3, sätze.length); i++) {
                            if (i > 0 && (preview + sätze[i]).length > MAX) break;
                            preview += sätze[i];
                          }
                          if (!preview) preview = msg.slice(0, MAX);
                          return (
                            <>
                              {preview.trim()}
                              <button
                                className="md-notif-readmore"
                                onClick={() => setExpandedNotif(notification)}
                              >
                                … Weiterlesen
                              </button>
                            </>
                          );
                        })()}
                      </div>
                      <div className="md-notif-timestamp">
                        {notification.created_at ? new Date(notification.created_at).toLocaleString('de-DE') : 'Gerade eben'}
                      </div>
                      {(() => {
                        try {
                          const meta = typeof notification.metadata === 'string'
                            ? JSON.parse(notification.metadata)
                            : notification.metadata;
                          if (meta?.nominierung_id && (meta.type === 'hof_approved' || meta.type === 'hof_nominiert')) {
                            const downloadPdf = async (e) => {
                              e.stopPropagation();
                              const token = localStorage.getItem('memberToken') || localStorage.getItem('token') || localStorage.getItem('dojo_auth_token');
                              try {
                                const resp = await fetch(`/api/hof/nominierung/${meta.nominierung_id}/pdf`, {
                                  headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                                });
                                if (!resp.ok) throw new Error('PDF nicht verfügbar');
                                const blob = await resp.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `HOF_Nominierung_${meta.nominierungsnummer || meta.nominierung_id}.pdf`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                              } catch {
                                alert('Urkunde konnte nicht geladen werden. Bitte versuche es später erneut.');
                              }
                            };
                            return (
                              <button
                                onClick={downloadPdf}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                                  marginTop: '8px', padding: '7px 14px',
                                  background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.4)',
                                  borderRadius: '8px', color: '#d4af37', fontSize: '13px', fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                📄 Nominierungsurkunde herunterladen
                              </button>
                            );
                          }
                        } catch {}
                        return null;
                      })()}
                      {!!notification.requires_confirmation && !notification.confirmed_at && (
                        <button
                          onClick={() => confirmNotification(notification.id)}
                          className="md-notif-confirm-btn"
                          onMouseOver={(e) => {
                            e.target.style.transform = 'translateY(-1px)';
                            e.target.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.4)';
                          }}
                          onMouseOut={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 2px 8px rgba(34, 197, 94, 0.3)';
                          }}
                        >
                          ✓ Bestätigen
                        </button>
                      )}
                      {!!notification.requires_confirmation && notification.confirmed_at && (
                        <div className="md-notif-confirmed-badge">
                          ✓ Bestätigt am {new Date(notification.confirmed_at).toLocaleString('de-DE')}
                        </div>
                      )}
                    </div>
                  ))}
                  {notifications.length > 3 && (
                    <div className="md-more-items-hint">
                      +{notifications.length - 3} weitere Benachrichtigungen
                    </div>
                  )}
                </div>
              ) : (
                <p className="md-notif-empty">
                  📭 {t('notifications.noNotifications')}
                </p>
              )}

              {/* Push-Benachrichtigungen aktivieren */}
              {pushStatus !== 'unsupported' && pushStatus !== 'granted' && (
                <div style={{ marginTop: '12px' }}>
                  {pushStatus === 'denied' ? (
                    <p className="md-notif-empty">Push-Benachrichtigungen blockiert — bitte in den Browser-Einstellungen erlauben.</p>
                  ) : (
                    <button
                      className="md-notif-confirm-btn"
                      onClick={handlePushSubscribe}
                      disabled={pushLoading}
                    >
                      {pushLoading ? 'Wird aktiviert…' : '🔔 Benachrichtigungen aktivieren'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Prüfungsanmeldung Modal */}
      {showExamRegistrationModal && selectedExam && (
        <div className="md-modal-overlay">
          <div className="md-modal-box">
            {/* Header */}
            <div className="md-modal-header">
              <div className="mb-flex-center-gap">
                <div className="md-modal-icon">🎓</div>
                <div>
                  <h2 className="md-modal-title">
                    Prüfungsanmeldung
                  </h2>
                  <p className="md-modal-subtitle">
                    Bestätige deine Teilnahme
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowExamRegistrationModal(false);
                  setSelectedExam(null);
                  setAcceptedConditions(false);
                }}
                className="md-modal-close-btn"
              >
                ×
              </button>
            </div>

            {/* Prüfungsdetails */}
            <div className="md-modal-details">
              {/* Stil & Graduierung */}
              <div className="md-modal-stil-card">
                <div className="md-modal-stil-inner">
                  <div>
                    <div className="md-modal-field-label">
                      Kampfkunst-Stil
                    </div>
                    <div className="md-modal-stil-name">
                      {selectedExam.stil_name}
                    </div>
                    <div className="md-modal-pruefung-label">
                      Prüfung zum
                    </div>
                    <div className="md-modal-pruefung-value">
                      {selectedExam.graduierung_nachher}
                    </div>
                  </div>
                  {selectedExam.farbe_nachher && (
                    <div
                      className="md-belt-dot md-belt-dot--lg"
                      style={{ '--belt-color': selectedExam.farbe_nachher }}
                      title={selectedExam.graduierung_nachher}
                    />
                  )}
                </div>
              </div>

              {/* Termin & Ort */}
              <div className="md-modal-termin-grid">
                {selectedExam.pruefungsdatum && (
                  <div className="md-modal-info-card">
                    <div className="mb-label-xs">
                      📅 Datum & Uhrzeit
                    </div>
                    <div className="md-modal-info-value">
                      {new Date(selectedExam.pruefungsdatum).toLocaleDateString('de-DE', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                    {selectedExam.pruefungszeit && (
                      <div className="md-modal-time-text">
                        Uhrzeit: {selectedExam.pruefungszeit} Uhr
                      </div>
                    )}
                  </div>
                )}

                {selectedExam.pruefungsort && (
                  <div className="md-modal-info-card">
                    <div className="mb-label-xs">
                      📍 Ort
                    </div>
                    <div className="md-modal-info-value-sm">
                      {selectedExam.pruefungsort}
                    </div>
                  </div>
                )}
              </div>

              {/* Gebühr & Anmeldefrist */}
              <div className="md-modal-fee-grid">
                {selectedExam.pruefungsgebuehr && (
                  <div className="md-modal-fee-card">
                    <div className="mb-label-xs">
                      💰 Prüfungsgebühr
                    </div>
                    <div className="md-modal-fee-value">
                      {parseFloat(selectedExam.pruefungsgebuehr).toFixed(2)} €
                    </div>
                  </div>
                )}

                {selectedExam.anmeldefrist && (
                  <div className="md-modal-frist-card">
                    <div className="mb-label-xs">
                      ⏰ Anmeldefrist
                    </div>
                    <div className="md-modal-frist-value">
                      {new Date(selectedExam.anmeldefrist).toLocaleDateString('de-DE')}
                    </div>
                  </div>
                )}
              </div>

              {/* Gurtlänge */}
              {selectedExam.gurtlaenge && (
                <div className="md-modal-belt-card">
                  <div className="mb-label-xs">
                    📏 Empfohlene Gurtlänge
                  </div>
                  <div className="md-modal-info-value-sm">
                    {selectedExam.gurtlaenge}
                  </div>
                </div>
              )}

              {/* Bemerkungen */}
              {selectedExam.bemerkungen && (
                <div className="md-modal-remarks-card">
                  <div className="mb-label-xs">
                    📝 Bemerkungen
                  </div>
                  <div className="md-modal-remarks-text">
                    {selectedExam.bemerkungen}
                  </div>
                </div>
              )}

              {/* Teilnahmebedingungen */}
              {selectedExam.teilnahmebedingungen && (
                <div className="md-modal-conditions-card">
                  <div className="md-modal-conditions-title">
                    📋 Teilnahmebedingungen
                  </div>
                  <div className="md-modal-conditions-text">
                    {selectedExam.teilnahmebedingungen}
                  </div>
                </div>
              )}
            </div>

            {/* Bestätigung */}
            <div className="md-modal-checkbox-wrap">
              <label className="md-modal-checkbox-label">
                <input
                  type="checkbox"
                  checked={acceptedConditions}
                  onChange={(e) => setAcceptedConditions(e.target.checked)}
                  className="md-modal-checkbox-input"
                />
                <span className="u-text-primary">
                  Ich bestätige hiermit meine Teilnahme an der Prüfung und akzeptiere die Teilnahmebedingungen.
                  Mir ist bewusst, dass die Prüfungsgebühr fällig wird.
                </span>
              </label>
            </div>

            {/* Aktionen */}
            <div className="md-modal-actions">
              <button
                onClick={() => {
                  setShowExamRegistrationModal(false);
                  setSelectedExam(null);
                  setAcceptedConditions(false);
                }}
                className="md-modal-cancel-btn"
                onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.15)'}
                onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
              >
                Abbrechen
              </button>
              <button
                onClick={handleExamRegistration}
                disabled={!acceptedConditions}
                className="md-exam-confirm-btn"
                onMouseOver={(e) => { if (acceptedConditions) e.target.style.transform = 'scale(1.02)'; }}
                onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
              >
                ✅ Teilnahme bestätigen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ankündigungen */}
      {(announcementsLoading || announcements.length > 0) && (
        <div className="md-anpassung-section" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>📢 Ankündigungen</h3>
          {announcementsLoading ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Lädt...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {announcements.map(ann => (
                <div key={ann.id} style={{
                  display: 'flex', flexDirection: 'column', gap: '0.3rem',
                  padding: '0.7rem 0.9rem',
                  background: ann.is_read ? 'rgba(255,255,255,0.03)' : 'rgba(99,102,241,0.08)',
                  border: `1px solid ${ann.is_read ? 'rgba(255,255,255,0.07)' : 'rgba(99,102,241,0.25)'}`,
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5, flex: 1 }}>
                      {ann.message_type === 'push_ref'
                        ? ann.content.replace(/^📣 \*\*/, '').replace(/\*\*\n\n/, ' — ')
                        : ann.content}
                    </span>
                    {!ann.is_read && <span style={{ fontSize: '0.65rem', background: 'rgba(99,102,241,0.3)', color: '#818cf8', borderRadius: '4px', padding: '1px 5px', flexShrink: 0, fontWeight: 600 }}>NEU</span>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    <span>📣 {ann.room_name} · {ann.sender_name}</span>
                    <span>{new Date(ann.sent_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Meine Dokumente + Rechnungen */}
      {(dokLoading || memberDokumente.length > 0) && (
        <div className="md-anpassung-section" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>📄 Meine Dokumente & Rechnungen</h3>
          {dokLoading ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Lädt...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {memberDokumente.map(dok => {
                const isRechnung = dok._itemType === 'rechnung';
                const statusColor = dok.status === 'bezahlt' ? '#22c55e'
                  : dok.status === 'offen' ? '#fbbf24'
                  : dok.status === 'ueberfaellig' ? '#ef4444'
                  : 'var(--text-secondary)';
                return (
                  <div key={`${dok._itemType}-${dok.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.85rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{isRechnung ? '🧾' : '📋'}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dok.dokumentname}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span>{new Date(dok.erstellt_am).toLocaleDateString('de-DE')}</span>
                          {isRechnung && dok.betrag != null && <span>· {parseFloat(dok.betrag).toFixed(2)} €</span>}
                          {isRechnung && dok.status && <span style={{ color: statusColor, fontWeight: 500 }}>· {dok.status === 'bezahlt' ? '✓ Bezahlt' : dok.status === 'offen' ? '⚠ Offen' : dok.status === 'ueberfaellig' ? '⛔ Überfällig' : dok.status}</span>}
                        </div>
                      </div>
                    </div>
                    <button
                      style={{ background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: '6px', padding: '0.3rem 0.7rem', color: '#ffd700', fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0, fontWeight: 500 }}
                      onClick={async () => {
                        try {
                          const authToken = localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('dojo_auth_token');
                          let url, filename;
                          if (isRechnung) {
                            url = `${window.location.origin}/api/rechnungen/${dok.rechnung_id}/pdf`;
                            filename = `Rechnung-${dok.dokumentname}.pdf`;
                          } else {
                            url = `${window.location.origin}/api/mitglieder/${dok.mitglied_id}/dokumente/${dok.id}/download`;
                            filename = `${dok.dokumentname}.pdf`;
                          }
                          const r = await fetch(url, { headers: { Authorization: `Bearer ${authToken}` } });
                          if (!r.ok) throw new Error('Fehler');
                          const blob = await r.blob();
                          const blobUrl = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = blobUrl;
                          a.download = filename;
                          a.click();
                          URL.revokeObjectURL(blobUrl);
                        } catch (e) { alert('Download fehlgeschlagen'); }
                      }}
                    >⬇ PDF</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Ehrungen Platzhalter */}
      <div className="md-ehrungen-card">
        <span className="md-hof-icon">🏅</span>
        <div>
          <h4 className="md-hof-title">Meine Ehrungen</h4>
          <p className="md-hof-sub">Hier erscheinen deine Auszeichnungen, sobald du in die Hall of Fame aufgenommen wirst.</p>
        </div>
      </div>

      {/* Member Check-in Modal */}
      {showMemberCheckin && (
        <MemberCheckin onClose={() => setShowMemberCheckin(false)} />
      )}

      {/* Member QR Code Modal */}
      {showQRCode && memberData && (
        <MemberQRCode
          memberData={memberData}
          onClose={() => setShowQRCode(false)}
        />
      )}

      {/* Prüfungsprotokoll Modal */}
      {protokollViewId && (() => {
        const proto = pruefProtokolle.find(p => p.pruefung_id === protokollViewId);
        if (!proto?.html_inhalt) return null;
        return (
          <div onClick={() => setProtokolViewId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', overflowY: 'auto', padding: '16px' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '8px', width: '100%', maxWidth: '210mm', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #e0e0e0', background: '#f5f5f5', borderRadius: '8px 8px 0 0' }}>
                <span style={{ fontWeight: 600, color: '#333', fontSize: '14px' }}>📋 Prüfungsprotokoll</span>
                <button onClick={() => setProtokolViewId(null)} style={{ background: '#e0e0e0', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontWeight: 500, color: '#333', fontSize: '13px' }}>✕ Schließen</button>
              </div>
              <div style={{ padding: '16mm 12mm', color: '#1a1a1a' }} dangerouslySetInnerHTML={{ __html: proto.html_inhalt }} />
            </div>
          </div>
        );
      })()}

        </div>
      </div>
    </div>
  );
};

export default MemberDashboard;
