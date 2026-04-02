import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx';
import {
  Home, Calendar, CreditCard, User, MoreHorizontal,
  QrCode, Clock, Bell, ChevronRight, Trophy, Package,
  BarChart3, CalendarSync, Download, Check, Copy,
  Star, LogOut, Award, MessageSquare
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import dojoLogo from '../assets/logo-kampfkunstschule-schreiner.png';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config.js';
import MemberCheckin from './MemberCheckin.jsx';
import MemberQRCode from './MemberQRCode.jsx';
import BadgeDisplay from './BadgeDisplay';
import '../styles/themes.css';
import '../styles/MemberDashboardMobile.css';

// ─────────────────────────────────────────────────────────────────
// News-Modal (Bottom Sheet)
// ─────────────────────────────────────────────────────────────────
function NewsModal({ artikel, onClose }) {
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = orig;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const absätze = (artikel.inhalt || '').split(/\n\s*\n/).filter(Boolean);
  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="mapp-modal-overlay" onClick={onClose}>
      <div className="mapp-modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="mapp-modal-close">
          <button className="mapp-modal-close-btn" onClick={onClose}>✕</button>
        </div>
        {artikel.bilder?.[0] && (
          <img
            src={artikel.bilder[0]}
            alt={artikel.titel}
            style={{ width: '100%', borderRadius: 12, marginBottom: '0.75rem', maxHeight: 200, objectFit: 'cover' }}
          />
        )}
        <div className="mapp-modal-date">{formatDate(artikel.datum)}</div>
        <div className="mapp-modal-title">{artikel.titel}</div>
        <div className="mapp-modal-text">
          {absätze.length > 0
            ? absätze.map((p, i) => <p key={i}>{p}</p>)
            : <p>{artikel.inhalt}</p>
          }
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Mehr-Drawer (Bottom Sheet)
// ─────────────────────────────────────────────────────────────────
function MehrDrawer({ onClose, onNavigate, onLogout }) {
  const items = [
    { icon: <BarChart3 size={20} />, label: 'Statistiken', path: '/member/stats' },
    { icon: <Package size={20} />, label: 'Equipment', path: '/member/equipment' },
    { icon: <CalendarSync size={20} />, label: 'Kalender\nSync', path: '/member/kalender' },
    { icon: <Star size={20} />, label: 'Stil & Gürtel', path: '/member/styles' },
    { icon: <Calendar size={20} />, label: 'Events', path: '/member/events' },
    { icon: <Download size={20} />, label: 'App\ninstallieren', path: '/app-install' },
    { icon: <MessageSquare size={20} />, label: 'Chat', path: '/member/chat' },
    { icon: <Award size={20} />, label: 'Auszeich-\nnungen', path: null },
  ];

  return (
    <div className="mapp-drawer-overlay" onClick={onClose}>
      <div className="mapp-drawer" onClick={e => e.stopPropagation()}>
        <div className="mapp-drawer-handle" />
        <div className="mapp-drawer-title">Weitere Bereiche</div>
        <div className="mapp-drawer-grid">
          {items.map((item, i) => (
            <div
              key={i}
              className="mapp-drawer-item"
              onClick={() => { onClose(); if (item.path) onNavigate(item.path); }}
            >
              <span className="mapp-drawer-item-icon">{item.icon}</span>
              <span className="mapp-drawer-item-label">{item.label}</span>
            </div>
          ))}
        </div>
        <button className="mapp-drawer-logout" onClick={onLogout}>
          <LogOut size={16} /> Abmelden
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Hauptkomponente
// ─────────────────────────────────────────────────────────────────
const MemberDashboardMobile = () => {
  const { user, logout } = useAuth();
  const { activeDojo } = useDojoContext();
  const navigate = useNavigate();

  // ── Daten-States ──────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [memberData, setMemberData] = useState(null);
  const [stats, setStats] = useState({ trainings: 0, anwesenheit: null, offeneBeitraege: 0 });
  const [belts, setBelts] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [news, setNews] = useState([]);
  const [referralData, setReferralData] = useState(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [hatMahnung, setHatMahnung] = useState(false);
  const [meineAnpassungen, setMeineAnpassungen] = useState([]);

  // ── UI-States ─────────────────────────────────────────────────
  const [showCheckin, setShowCheckin] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showMehr, setShowMehr] = useState(false);
  const [offeneNews, setOffeneNews] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  // ── Daten laden ───────────────────────────────────────────────
  useEffect(() => {
    if (!user?.email) return;

    const load = async () => {
      try {
        const mitgliedId = user?.mitglied_id;
        if (!mitgliedId) return;

        const [memberRes, attendanceRes, vertraegeRes, kurseRes] = await Promise.all([
          fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${mitgliedId}`),
          fetchWithAuth(`${config.apiBaseUrl}/anwesenheit/${mitgliedId}`),
          fetchWithAuth(`${config.apiBaseUrl}/vertraege?mitglied_id=${mitgliedId}`),
          fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${mitgliedId}/kurse`),
        ]);

        if (!memberRes.ok) throw new Error('Mitgliedsdaten nicht ladbar');

        const md = await memberRes.json();
        setMemberData(md);

        // Anwesenheit
        let attendanceData = [];
        if (attendanceRes.ok) {
          try { attendanceData = await attendanceRes.json(); } catch {}
        }

        // Kurse für Anwesenheitsberechnung
        let memberKurse = [];
        if (kurseRes.ok) {
          try {
            const kd = await kurseRes.json();
            memberKurse = Array.isArray(kd) ? kd : (kd.kurse || []);
          } catch {}
        }

        // Mögliche Trainings berechnen
        const wochentagMap = { 'Montag': 1, 'Dienstag': 2, 'Mittwoch': 3, 'Donnerstag': 4, 'Freitag': 5, 'Samstag': 6, 'Sonntag': 0 };
        const eintrittsdatum = md.eintrittsdatum ? new Date(md.eintrittsdatum) : null;
        const heute = new Date(); heute.setHours(23, 59, 59, 0);
        let moeglich = 0;
        if (eintrittsdatum && memberKurse.length > 0) {
          memberKurse.forEach(kurs => {
            const zielTag = wochentagMap[kurs.wochentag];
            if (zielTag === undefined) return;
            const start = new Date(eintrittsdatum); start.setHours(0,0,0,0);
            const offset = (zielTag - start.getDay() + 7) % 7;
            start.setDate(start.getDate() + offset);
            if (start <= heute) {
              moeglich += Math.floor((heute - start) / (7 * 24 * 3600 * 1000)) + 1;
            }
          });
        }

        const anwesend = Array.isArray(attendanceData)
          ? attendanceData.filter(a => a.anwesend === 1 || a.anwesend === true).length
          : 0;

        // Verträge / offene Beiträge
        let vertraegeData = [];
        if (vertraegeRes.ok) {
          try {
            const vd = await vertraegeRes.json();
            vertraegeData = Array.isArray(vd?.data) ? vd.data : (Array.isArray(vd) ? vd : []);
          } catch {}
        }

        const offeneBeitraege = md.beitragsfrei === 1 || md.beitragsfrei === true ? 0
          : vertraegeData.filter(v =>
              !v.geloescht && v.status === 'aktiv' &&
              (!v.lastschrift_status || v.lastschrift_status === 'ausstehend' || v.lastschrift_status === 'fehlgeschlagen')
            ).length;

        setStats({
          trainings: anwesend,
          anwesenheit: moeglich > 0 ? Math.round((anwesend / moeglich) * 100) : null,
          offeneBeitraege,
        });

        // Alle weiteren Daten parallel laden
        await Promise.all([
          loadBelts(mitgliedId),
          loadNotifications(md.email || user?.email),
          loadUpcomingEvents(mitgliedId),
          loadNews(),
          loadReferral(mitgliedId),
          loadAnpassungen(mitgliedId),
          loadZahlungsNachrichten(mitgliedId),
        ]);

      } catch (err) {
        console.error('Fehler beim Laden der Mitgliedsdaten:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.email, user?.mitglied_id]);

  // ── Live-Daten: Polling + visibilitychange + SW-Update ────────
  useEffect(() => {
    if (!user?.mitglied_id || loading) return;
    const mitgliedId = user.mitglied_id;
    const email = user.email;

    // Schnell-Refresh: nur Notifications + Events (leichtgewichtig)
    const quickRefresh = async () => {
      await Promise.all([
        loadNotifications(email),
        loadUpcomingEvents(mitgliedId),
      ]);
      setLastRefresh(new Date());
    };

    // Polling: Notifications alle 30s, Events alle 5 Min
    const notifInterval = setInterval(() => loadNotifications(email), 30_000);
    const eventsInterval = setInterval(() => loadUpcomingEvents(mitgliedId), 5 * 60_000);

    // Refresh wenn App wieder sichtbar wird (Tab-Wechsel / Handy entsperren)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') quickRefresh();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // SW-Update-Banner
    const onSwUpdate = () => setUpdateAvailable(true);
    window.addEventListener('sw-update-available', onSwUpdate);

    return () => {
      clearInterval(notifInterval);
      clearInterval(eventsInterval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('sw-update-available', onSwUpdate);
    };
  }, [user?.mitglied_id, user?.email, loading, loadNotifications, loadUpcomingEvents]);

  // ── Pull-to-Refresh ───────────────────────────────────────────
  useEffect(() => {
    if (!user?.mitglied_id || loading) return;
    const mitgliedId = user.mitglied_id;
    const email = user.email;

    let startY = 0;
    let pulling = false;

    const onTouchStart = (e) => {
      const scrollEl = document.querySelector('.mapp-scroll');
      if (scrollEl && scrollEl.scrollTop === 0) {
        startY = e.touches[0].clientY;
        pulling = true;
      }
    };

    const onTouchEnd = async (e) => {
      if (!pulling) return;
      const deltaY = e.changedTouches[0].clientY - startY;
      pulling = false;
      if (deltaY > 60) {
        setPullRefreshing(true);
        await Promise.all([
          loadNotifications(email),
          loadUpcomingEvents(mitgliedId),
          loadNews(),
        ]);
        setLastRefresh(new Date());
        setPullRefreshing(false);
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [user?.mitglied_id, user?.email, loading, loadNotifications, loadUpcomingEvents, loadNews]);

  const loadBelts = useCallback(async (mitgliedId) => {
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${mitgliedId}/stile`);
      if (!res.ok) return;
      const data = await res.json();
      const memberStile = Array.isArray(data) ? data : (data.stile || []);
      const extracted = memberStile.map(ms => ({
        stilName: ms.stil_name || ms.stilName,
        name: ms.aktueller_gurt || ms.gurt_name || ms.gurtName || ms.belt || '—',
        farbe: ms.gurt_farbe || ms.gurtFarbe || ms.belt_color || '#aaaaaa',
      })).filter(b => b.name && b.name !== '—');
      setBelts(extracted);
    } catch {}
  }, []);

  const loadNotifications = useCallback(async (email) => {
    if (!email) return;
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/mitglied-nachrichten?email=${encodeURIComponent(email)}`);
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  const loadUpcomingEvents = useCallback(async (mitgliedId) => {
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/events/upcoming?mitglied_id=${mitgliedId}`);
      if (!res.ok) return;
      const data = await res.json();
      setUpcomingEvents(Array.isArray(data) ? data.slice(0, 5) : []);
    } catch {}
  }, []);

  const loadNews = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/news/member`);
      if (!res.ok) return;
      const data = await res.json();
      const liste = Array.isArray(data) ? data : (data.news || []);
      setNews(liste.slice(0, 5).map(a => ({
        ...a,
        bilder: Array.isArray(a.bilder) ? a.bilder
          : (a.bilder ? [a.bilder] : (a.bild_pfad ? [`${config.apiBaseUrl.replace('/api', '')}/${a.bild_pfad}`] : []))
      })));
    } catch {}
  }, []);

  const loadReferral = useCallback(async (mitgliedId) => {
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/referral/member/${mitgliedId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data?.code) setReferralData(data);
    } catch {}
  }, []);

  const loadAnpassungen = useCallback(async (mitgliedId) => {
    try {
      const token = localStorage.getItem('dojo_auth_token');
      const res = await fetch('/api/vertrag-anpassungen/meine', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setMeineAnpassungen(data.anpassungen || []);
    } catch {}
  }, []);

  const loadZahlungsNachrichten = useCallback(async (mitgliedId) => {
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${mitgliedId}/nachrichten?typ=mahnung`);
      if (!res.ok) return;
      const data = await res.json();
      const mahnungen = Array.isArray(data) ? data.filter(n => n.typ === 'mahnung') : [];
      setHatMahnung(mahnungen.length > 0);
    } catch {}
  }, []);

  const handleLogout = () => {
    if (logout) logout();
    window.location.href = '/login';
  };

  // ── Render: Ladescreen ────────────────────────────────────────
  if (loading) {
    return (
      <div className="mapp-root">
        <div className="mapp-topbar">
          <div className="mapp-topbar-left">
            <img src={dojoLogo} alt="Logo" className="mapp-topbar-logo" />
            <span className="mapp-topbar-dojo">道場</span>
          </div>
        </div>
        <div className="mapp-scroll">
          <div className="mapp-loading">
            <div className="mapp-spinner" />
            Lade Daten…
          </div>
        </div>
      </div>
    );
  }

  // ── Gürtel für Anzeige ────────────────────────────────────────
  const primaryBelt = belts[0];

  const gurtStatValue = primaryBelt ? (
    <div className="mapp-belt-mini">
      <div className="mapp-belt-mini-stripe" style={{ background: primaryBelt.farbe }} />
      <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{primaryBelt.name}</span>
    </div>
  ) : <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>—</span>;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="mapp-root">

      {/* ── Top Bar ── */}
      <div className="mapp-topbar">
        <div className="mapp-topbar-left">
          <img src={dojoLogo} alt="Logo" className="mapp-topbar-logo" />
          <span className="mapp-topbar-dojo">
            {activeDojo?.dojoname || '道場'}
          </span>
        </div>
        <div className="mapp-topbar-right">
          <button
            className="mapp-notif-btn"
            onClick={() => navigate('/member/dashboard')}
            title="Desktop-Ansicht"
            style={{ fontSize: '0.65rem', width: 'auto', borderRadius: 8, padding: '0 0.5rem', gap: '0.25rem', flexDirection: 'row' }}
          >
            <span>🖥</span>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>Desktop</span>
          </button>
          <button
            className="mapp-notif-btn"
            onClick={() => navigate('/member/dashboard')}
            title="Benachrichtigungen"
            style={{ display: unreadCount > 0 ? 'flex' : 'none' }}
          >
            <Bell size={16} />
            {unreadCount > 0 && <span className="mapp-notif-badge">{unreadCount}</span>}
          </button>
        </div>
      </div>

      {/* ── App-Update-Banner ── */}
      {updateAvailable && (
        <div className="mapp-update-banner">
          <span className="mapp-update-text">🔄 Neue Version verfügbar</span>
          <button
            className="mapp-update-btn"
            onClick={() => window.location.reload()}
          >
            Jetzt laden
          </button>
        </div>
      )}

      {/* ── Scrollbarer Inhalt ── */}
      <div className="mapp-scroll">
        <div className="mapp-content">

          {/* Pull-to-Refresh Indikator */}
          {pullRefreshing && (
            <div className="mapp-ptr">
              <div className="mapp-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
              <span>Aktualisiere…</span>
            </div>
          )}

          {/* Zahlungshinweis */}
          {hatMahnung && (
            <div className="mapp-alert">
              <span style={{ fontSize: '1.2rem' }}>⚠️</span>
              <div className="mapp-alert-text">
                <div className="mapp-alert-title">Offene Zahlung</div>
                <div className="mapp-alert-sub">Bitte prüfe deine Zahlungsdaten</div>
              </div>
              <button className="mapp-alert-btn" onClick={() => navigate('/member/payments')}>
                Zahlung
              </button>
            </div>
          )}

          {/* Hero / Name */}
          <div className="mapp-hero">
            <div className="mapp-hero-kanji">武 道</div>
            <div className="mapp-hero-name">
              {memberData ? `${memberData.vorname} ${memberData.nachname}` : user?.username || 'Mitglied'}
            </div>
            <div className="mapp-hero-meta">
              {primaryBelt && (
                <span className="mapp-belt-badge">
                  <span className="mapp-belt-dot" style={{ background: primaryBelt.farbe }} />
                  {primaryBelt.name}
                  {primaryBelt.stilName && ` · ${primaryBelt.stilName}`}
                </span>
              )}
              {memberData?.mitglied_id && (
                <span className="mapp-member-id">
                  #{String(memberData.mitglied_id).padStart(5, '0')}
                </span>
              )}
            </div>
          </div>

          {/* Mini-Mitgliedsausweis */}
          {memberData && (
            <div className="mapp-ausweis">
              {/* Linke Seite: Logo + Daten */}
              <div className="mapp-ausweis-left">
                <img src={dojoLogo} alt="Logo" className="mapp-ausweis-logo" />
                <div className="mapp-ausweis-info">
                  <div className="mapp-ausweis-dojo">格闘技学校</div>
                  <div className="mapp-ausweis-name">
                    {memberData.vorname} {memberData.nachname}
                  </div>
                  <div className="mapp-ausweis-meta">
                    <span>Nr. {String(memberData.mitglied_id).padStart(5, '0')}</span>
                    {memberData.eintrittsdatum && (
                      <span>· seit {new Date(memberData.eintrittsdatum).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' })}</span>
                    )}
                  </div>
                  {primaryBelt && (
                    <div className="mapp-ausweis-belt">
                      <span className="mapp-ausweis-belt-stripe" style={{ background: primaryBelt.farbe }} />
                      <span>{primaryBelt.name}</span>
                    </div>
                  )}
                </div>
              </div>
              {/* Rechte Seite: Foto + QR */}
              <div className="mapp-ausweis-right">
                {memberData.foto_pfad ? (
                  <img
                    src={`${config.apiBaseUrl.replace('/api', '')}/${memberData.foto_pfad}`}
                    alt="Foto"
                    className="mapp-ausweis-foto"
                  />
                ) : (
                  <div className="mapp-ausweis-foto mapp-ausweis-foto--placeholder">写</div>
                )}
                <QRCodeSVG
                  value={`DOJO-CHECKIN:${memberData.dojo_id || '0'}:${memberData.mitglied_id}`}
                  size={36}
                  level="M"
                  bgColor="transparent"
                  fgColor="#ffffff"
                  className="mapp-ausweis-qr"
                />
              </div>
            </div>
          )}

          {/* Stats 2×2 */}
          <div className="mapp-stats">
            <div className="mapp-stat">
              <div className="mapp-stat-icon">🏃‍♂️</div>
              <div className="mapp-stat-label">Trainings</div>
              <div className="mapp-stat-value">{stats.trainings}</div>
              <div className="mapp-stat-sub">Einheiten</div>
            </div>
            <div className="mapp-stat">
              <div className="mapp-stat-icon">📊</div>
              <div className="mapp-stat-label">Anwesenheit</div>
              <div className="mapp-stat-value">
                {stats.anwesenheit !== null ? `${stats.anwesenheit}%` : '—'}
              </div>
              <div className="mapp-stat-sub">Quote</div>
            </div>
            <div className="mapp-stat">
              <div className="mapp-stat-icon">🥋</div>
              <div className="mapp-stat-label">Gürtel</div>
              <div className="mapp-stat-value" style={{ fontSize: '1rem', paddingTop: '0.1rem' }}>
                {gurtStatValue}
              </div>
            </div>
            <div className="mapp-stat">
              <div className="mapp-stat-icon">
                {stats.offeneBeitraege > 0 ? '⚠️' : '✅'}
              </div>
              <div className="mapp-stat-label">Beiträge</div>
              {stats.offeneBeitraege === 0 ? (
                <>
                  <div className="mapp-stat-value mapp-stat-value--ok" style={{ fontSize: '1.2rem' }}>✓</div>
                  <div className="mapp-stat-sub">Alles OK</div>
                </>
              ) : (
                <>
                  <div className="mapp-stat-value mapp-stat-value--err">{stats.offeneBeitraege}</div>
                  <div className="mapp-stat-sub" style={{ color: 'var(--error)' }}>offen</div>
                </>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mapp-quick">
            <button className="mapp-qa-btn mapp-qa-btn--primary" onClick={() => setShowCheckin(true)}>
              <Clock size={22} className="mapp-qa-icon" />
              <span className="mapp-qa-label">Check-in</span>
            </button>
            <button className="mapp-qa-btn" onClick={() => setShowQR(true)}>
              <QrCode size={22} className="mapp-qa-icon" />
              <span className="mapp-qa-label">Mein QR-Code</span>
            </button>
          </div>

          {/* Kommende Events */}
          {upcomingEvents.length > 0 && (
            <div className="mapp-section">
              <div className="mapp-section-head">
                <span className="mapp-section-title">
                  <Calendar size={13} /> Kommende Events
                </span>
                <span className="mapp-section-link" onClick={() => navigate('/member/events')}>
                  Alle <ChevronRight size={12} />
                </span>
              </div>
              <div className="mapp-section-body">
                {upcomingEvents.map(event => {
                  const d = new Date(event.datum);
                  const day = d.toLocaleDateString('de-DE', { day: '2-digit' });
                  const month = d.toLocaleDateString('de-DE', { month: 'short' });
                  return (
                    <div
                      key={event.event_id}
                      className="mapp-event"
                      onClick={() => navigate('/member/events')}
                    >
                      <div className="mapp-event-date">
                        <div className="mapp-event-day">{day}</div>
                        <div className="mapp-event-month">{month}</div>
                      </div>
                      <div className="mapp-event-info">
                        <div className="mapp-event-name">{event.titel}</div>
                        {event.ort && <div className="mapp-event-loc">📍 {event.ort}</div>}
                      </div>
                      {event.ist_angemeldet
                        ? <span className="mapp-event-badge mapp-event-badge--reg">✓ Dabei</span>
                        : <span className="mapp-event-badge mapp-event-badge--open">Anmelden</span>
                      }
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* News */}
          {news.length > 0 && (
            <div className="mapp-section">
              <div className="mapp-section-head">
                <span className="mapp-section-title">📰 Aktuelles</span>
              </div>
              <div className="mapp-section-body">
                {news.map((artikel, i) => (
                  <div
                    key={artikel.id || i}
                    className="mapp-news"
                    onClick={() => artikel.inhalt && setOffeneNews(artikel)}
                  >
                    {artikel.bilder?.[0]
                      ? <img src={artikel.bilder[0]} alt={artikel.titel} className="mapp-news-img" />
                      : <div className="mapp-news-img-placeholder">📄</div>
                    }
                    <div className="mapp-news-body">
                      {artikel.datum && (
                        <div className="mapp-news-date">
                          {new Date(artikel.datum).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                      <div className="mapp-news-title">{artikel.titel}</div>
                      {artikel.kurzbeschreibung && (
                        <div className="mapp-news-excerpt">{artikel.kurzbeschreibung}</div>
                      )}
                    </div>
                    {artikel.inhalt && <ChevronRight size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Badges */}
          {memberData && (
            <div className="mapp-section">
              <div className="mapp-section-head">
                <span className="mapp-section-title"><Award size={13} /> Auszeichnungen</span>
              </div>
              <div style={{ padding: '0.5rem 1rem 0.75rem' }}>
                <BadgeDisplay mitgliedId={memberData.mitglied_id} compact={true} />
              </div>
            </div>
          )}

          {/* Freunde werben */}
          {referralData && (
            <div className="mapp-referral">
              <div className="mapp-referral-head">
                <span className="mapp-referral-emoji">🤝</span>
                <div>
                  <div className="mapp-referral-title">Freunde werben</div>
                  <div className="mapp-referral-sub">
                    {referralData.standard_praemie
                      ? `${referralData.standard_praemie} € pro Empfehlung`
                      : 'Prämie für jede Empfehlung'}
                  </div>
                </div>
              </div>
              {referralData.standard_praemie && (
                <div className="mapp-referral-praemie">
                  <span style={{ fontSize: '1.2rem' }}>💶</span>
                  <div>
                    <div className="mapp-referral-praemie-amount">{referralData.standard_praemie} € pro Mitglied</div>
                    <div className="mapp-referral-praemie-sub">Für jede erfolgreiche Empfehlung</div>
                  </div>
                </div>
              )}
              <div className="mapp-referral-code-row">
                <span className="mapp-referral-code">{referralData.code}</span>
                <button
                  className={`mapp-referral-copy${referralCopied ? ' mapp-referral-copy--copied' : ''}`}
                  onClick={() => {
                    navigator.clipboard.writeText(referralData.code);
                    setReferralCopied(true);
                    setTimeout(() => setReferralCopied(false), 2000);
                  }}
                >
                  {referralCopied ? <><Check size={12} /> Kopiert</> : <><Copy size={12} /> Kopieren</>}
                </button>
              </div>
            </div>
          )}

          {/* Vertragsstatus */}
          {meineAnpassungen.length > 0 && (
            <div className="mapp-vertrag">
              <div className="mapp-vertrag-head">
                <span className="mapp-vertrag-title">📋 Vertragsstatus</span>
                <button className="mapp-vertrag-btn" onClick={() => navigate('/member/payments')}>
                  Details →
                </button>
              </div>
              {meineAnpassungen.filter(a => a.status === 'genehmigt').map(a => {
                const typLabels = { schueler: 'Schüler', student: 'Student', azubi: 'Azubi', rentner: 'Rentner', sonstiges: 'Sonstiges' };
                return (
                  <div key={a.id} className="mapp-vertrag-aktiv">
                    ✓ {typLabels[a.typ] || a.typ}-Tarif aktiv ·{' '}
                    {parseFloat(a.neuer_betrag).toFixed(2).replace('.', ',')} €/Monat ·{' '}
                    bis {new Date(a.gueltig_bis).toLocaleDateString('de-DE')}
                  </div>
                );
              })}
              {meineAnpassungen.filter(a => a.status === 'beantragt').length > 0 && (
                <div className="mapp-vertrag-pending">
                  ⏳ Antrag wartet auf Genehmigung
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Bottom Tab Bar ── */}
      <div className="mapp-tabbar">
        <button className="mapp-tab active">
          <div className="mapp-tab-icon-wrap"><Home size={20} /></div>
          <span className="mapp-tab-label">Home</span>
        </button>
        <button className="mapp-tab" onClick={() => navigate('/member/schedule')}>
          <div className="mapp-tab-icon-wrap"><Calendar size={20} /></div>
          <span className="mapp-tab-label">Stundenplan</span>
        </button>
        <button className="mapp-tab" onClick={() => navigate('/member/payments')}>
          <div className="mapp-tab-icon-wrap">
            <CreditCard size={20} />
            {stats.offeneBeitraege > 0 && <span className="mapp-tab-dot" />}
          </div>
          <span className="mapp-tab-label">Zahlung</span>
        </button>
        <button className="mapp-tab" onClick={() => navigate('/member/profile')}>
          <div className="mapp-tab-icon-wrap"><User size={20} /></div>
          <span className="mapp-tab-label">Profil</span>
        </button>
        <button className="mapp-tab" onClick={() => setShowMehr(true)}>
          <div className="mapp-tab-icon-wrap"><MoreHorizontal size={20} /></div>
          <span className="mapp-tab-label">Mehr</span>
        </button>
      </div>

      {/* ── Modals ── */}
      {showCheckin && memberData && (
        <MemberCheckin
          mitgliedId={memberData.mitglied_id}
          onClose={() => setShowCheckin(false)}
        />
      )}

      {showQR && memberData && (
        <MemberQRCode
          memberData={memberData}
          onClose={() => setShowQR(false)}
        />
      )}

      {offeneNews && (
        <NewsModal artikel={offeneNews} onClose={() => setOffeneNews(null)} />
      )}

      {showMehr && (
        <MehrDrawer
          onClose={() => setShowMehr(false)}
          onNavigate={navigate}
          onLogout={handleLogout}
        />
      )}

    </div>
  );
};

export default MemberDashboardMobile;
