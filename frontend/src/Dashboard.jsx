import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx'; // 🔒 TAX COMPLIANCE
import { useStandortContext } from '../context/StandortContext.jsx';
import { useMitgliederUpdate } from '../context/MitgliederUpdateContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx'; // 🎨 Theme Switching
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import config from '../config/config.js';
import { fetchDashboardBatch, fetchDashboardStats, fetchRecentActivities } from '../utils/apiCache.js';
import '../styles/themes.css';         // Centralized theme system
import '../styles/Dashboard.css';      // Dashboard-spezifische Styles (MUSS VOR components.css stehen!)
import '../styles/components.css';     // Universal component styles
import '../styles/BuddyVerwaltung.css'; // Buddy-Verwaltung Styles
import { Users, Trophy, ClipboardList, Calendar, Menu, FileText, ChevronDown, Moon, Sun, ArrowLeft } from 'lucide-react';

const logo = '/dojo-logo.png';
import DojoSwitcher from './DojoSwitcher';
import StandortSwitcher from './StandortSwitcher';
import MemberDashboard from './MemberDashboard';
import AdminRegistrationPopup from './AdminRegistrationPopup';
import SuperAdminDashboard from './SuperAdminDashboard';
import TrialBanner from './TrialBanner';
import AgbStatusWidget from './AgbStatusWidget';

function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, logout } = useAuth();
  const { getDojoFilterParam, selectedDojo } = useDojoContext(); // 🔒 TAX COMPLIANCE: Dojo-Filter für alle API-Calls
  const { standorte } = useStandortContext(); // Multi-Location support
  const { updateTrigger } = useMitgliederUpdate(); // 🔄 Automatische Updates nach Mitgliedsanlage
  const { theme, setTheme, isDarkMode, toggleDarkMode, themes } = useTheme(); // 🎨 Theme Switching

  // State für echte Daten
  const [stats, setStats] = useState({
    mitglieder: 0,
    anwesenheit: 0,
    kurse: 0,
    trainer: 0,
    beitraege: 0,
    checkins_heute: 0,  // ✨ NEU für heutige Check-ins
    stile: 0,           // ✨ NEU für Anzahl Stile
    termine: 0,         // ✨ NEU für Termine/Prüfungen
    inventar: 0,        // ✨ NEU für Equipment/Inventar
    personal: 0,        // ✨ NEU für Personal/Mitarbeiter
    buddy_gruppen: 0,   // ✨ NEU für Buddy-Gruppen
    tarife: 0,          // ✨ NEU für Tarife
    zahlungszyklen: 0   // ✨ NEU für Zahlungszyklen
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userDisplayName, setUserDisplayName] = useState(''); // Angezeigter Username/Name

  // Tab-State für Dashboard
  const [activeTab, setActiveTab] = useState('checkin');

  let role = 'mitglied';
  let isMainAdmin = false; // Haupt-Admin Check für News-Feature

  try {
    if (token) {
      const decoded = jwtDecode(token);
      role = decoded.role || 'mitglied';
      // Haupt-Admin: user.id === 1 oder username === 'admin'
      isMainAdmin = decoded.id === 1 || decoded.user_id === 1 || decoded.username === 'admin';
    }
  } catch (error) {
    console.error("Fehler beim Dekodieren des Tokens:", error);
  }

  // 🚀 Optimierte Dashboard-Daten mit Batch-Loading und Caching
  // 🔒 TAX COMPLIANCE: Alle API-Calls verwenden dojo_id Filter!
  const fetchDashboardStatsOptimized = async () => {
    setLoading(true);
    setError('');
    try {
      // 🔒 TAX COMPLIANCE: Hole aktuellen Dojo-Filter
      const dojoFilterParam = getDojoFilterParam();

      // Verwende das neue Batch-API für bessere Performance
      const data = await fetchDashboardBatch(token, dojoFilterParam);

      setStats({
        ...data.stats,
        checkins_heute: data.stats.checkins_heute || 0,
        stile: data.stats.stile || 0,
        termine: data.stats.termine || 0,
        inventar: data.stats.inventar || 0,
        personal: data.stats.personal || 0,
        buddy_gruppen: data.stats.buddy_gruppen || 0,
        tarife: data.stats.tarife || 0,
        zahlungszyklen: data.stats.zahlungszyklen || 0
      });

      // Auch Recent Activities aus dem Batch laden
      if (data.activities) {
        const activities = data.activities.activities || data.activities || [];
        setRecentActivities(activities);
      }


    } catch (err) {
      console.error('Fehler beim Laden der Dashboard-Statistiken:', err);
      setError('Fehler beim Laden der Statistiken: ' + err.message);

      // Fallback: Einzelne API Calls mit Cache
      try {
        const dojoFilterParam = getDojoFilterParam();
        const [statsData, activitiesData] = await Promise.all([
          fetchDashboardStats(token, dojoFilterParam),
          fetchRecentActivities(token, dojoFilterParam)
        ]);

        setStats({
          ...statsData,
          checkins_heute: statsData.checkins_heute || 0,
          stile: statsData.stile || 0,
          termine: statsData.termine || 0,
          inventar: statsData.inventar || 0,
          personal: statsData.personal || 0,
          buddy_gruppen: statsData.buddy_gruppen || 0,
          tarife: statsData.tarife || 0,
          zahlungszyklen: statsData.zahlungszyklen || 0
        });

        const activities = activitiesData.activities || activitiesData || [];
        setRecentActivities(activities);
        setError(''); // Fallback erfolgreich
      } catch (fallbackErr) {
        console.error('Fallback fehlgeschlagen:', fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Nur laden wenn Token vorhanden ist
    if (token) {
      fetchDashboardStatsOptimized();
    }
    // 🔒 TAX COMPLIANCE: Refetch when dojo filter changes!
    // 🔄 AUTOMATISCHES UPDATE: Lädt neu wenn sich Token, Dojo-Filter oder Mitglieder ändern
  }, [token, getDojoFilterParam, updateTrigger]); // Lädt neu wenn sich Token, Dojo-Filter oder Mitglieder ändern

  // Lade Benutzername/Name für Anzeige im Header
  useEffect(() => {
    const loadUserDisplayName = async () => {
      try {
        if (token) {
          const decoded = jwtDecode(token);

          // Für Admins: Zeige Username aus Token
          if (decoded.role === 'admin') {
            setUserDisplayName(decoded.username || 'Admin');
          }
          // Für Mitglieder: Lade vollen Namen aus API
          else if (decoded.email) {
            try {
              const response = await axios.get(`/mitglieder/by-email/${encodeURIComponent(decoded.email)}`);
              if (response.data) {
                const fullName = `${response.data.vorname || ''} ${response.data.nachname || ''}`.trim();
                setUserDisplayName(fullName || decoded.username || 'Mitglied');
              }
            } catch (err) {
              console.error('Fehler beim Laden des Mitgliedsnamens:', err);
              setUserDisplayName(decoded.username || 'Mitglied');
            }
          }
        }
      } catch (error) {
        console.error('Fehler beim Dekodieren des Tokens:', error);
      }
    };

    loadUserDisplayName();
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavigation = (path) => {
    // ✅ STUNDENPLAN FIX: Spezielle Behandlung für Stundenplan
    if (path === '/dashboard/stundenplan') {
      try {
        navigate(path);
      } catch (error) {
        console.error('❌ Stundenplan Navigation Fehler:', error);
        // Fallback: Versuche direkte URL
        window.location.href = path;
      }
    } else {
      navigate(path);
    }
  };

  // Tab-Definitionen
  const baseTabs = [
    { id: 'checkin', label: 'Check-in Systeme', icon: '📱' },
    { id: 'mitglieder', label: 'Mitgliederverwaltung', icon: '👥' },
    { id: 'pruefungswesen', label: 'Prüfungswesen', icon: '🏆' },
    { id: 'events', label: 'Events', icon: '📅' },
    { id: 'finanzen', label: 'Finanzen', icon: '💰' },
    { id: 'artikelverwaltung', label: 'Artikelverwaltung', icon: '📦' },
    { id: 'verwaltung', label: 'Dojo-Verwaltung', icon: '🔧' },
    { id: 'personal', label: 'Personal', icon: '👨‍🏫' },
    { id: 'berichte', label: 'Berichte', icon: '📊' },
    { id: 'einstellungen', label: 'Einstellungen', icon: '⚙️' },
    { id: 'schnellaktionen', label: 'Schnellaktionen', icon: '⚡' },
    { id: 'info', label: 'Info', icon: 'ℹ️' }
  ];

  const tabs = baseTabs;

  // Formatiere Zahlen für bessere Lesbarkeit
  const formatNumber = (num) => {
    if (num === 0) return '0';
    return num.toLocaleString('de-DE');
  };

  // Icon basierend auf Activity Type
  const getActivityIcon = (type) => {
    switch (type) {
      case 'checkin': return '📱';
      case 'anwesenheit': return '✅';
      case 'mitglied': return '👤';
      case 'kurs': return '🥋';
      case 'beitrag': return '💰';
      case 'stil': return '🎖️';        // ✨ NEU für Stil-Activities
      case 'pruefung': return '🏆';     // ✨ NEU für Prüfungen
      default: return '📋';
    }
  };

  // Prüfe ob wir auf der Dashboard-Hauptseite sind
  const isMainDashboard = location.pathname === '/dashboard';
  const headerTitle = role === 'admin' ? 'Dojo Admin Dashboard' : 'Mitglieder Dashboard';

  // ✨ Mitgliederverwaltung - Fokus auf Member-Management ✨
  const mitgliederCards = [
    {
      icon: '👥',
      title: 'Mitglieder',
      description: 'Verwalten Sie alle Dojo-Mitglieder',
      path: '/dashboard/mitglieder',
      count: stats.mitglieder
    },
    {
      icon: '👥',
      title: 'Buddy-Gruppen',
      description: 'Freunde-Einladungen und Gruppenverwaltung',
      path: '/dashboard/buddy-gruppen',
      badge: 'NEU',
      featured: true,
      count: stats.buddy_gruppen || 0
    },
    {
      icon: '📧',
      title: 'Newsletter & Benachrichtigungen',
      description: 'Email-Versand, Push-Nachrichten & Server-Einstellungen',
      path: '/dashboard/notifications',
      badge: 'NEU',
      featured: true
    },
    {
      icon: '👋',
      title: 'Ehemalige',
      description: 'Ehemalige Mitglieder verwalten',
      path: '/dashboard/ehemalige',
      badge: 'NEU',
      count: stats.ehemalige || 0
    },
    {
      icon: '💼',
      title: 'Interessenten',
      description: 'Potenzielle Mitglieder und Leads',
      path: '/dashboard/interessenten',
      badge: 'NEU',
      count: stats.interessenten || 0
    }
  ];

  // ✨ Dojo-Verwaltung - Kurse, Stile, Training ✨
  const verwaltungCards = [
    {
      icon: '🥋',
      title: 'Kurse',
      description: 'Kurse und Gruppen verwalten',
      path: '/dashboard/kurse',
      count: stats.kurse
    },
    {
      icon: '📋',
      title: 'Stundenplan',
      description: 'Stundenplan und Kurszeiten verwalten',
      path: '/dashboard/stundenplan',
      featured: true
    },
    // ✨ NEUE STIL-VERWALTUNG ✨
    {
      icon: '🎖️',
      title: 'Stil-Verwaltung',
      description: 'Kampfkunst-Stile, Prüfungen & Techniken',
      path: '/dashboard/stile',
      badge: 'NEU',
      featured: true,
      count: stats.stile || 0
    },
    {
      icon: '👥',
      title: 'Gruppen',
      description: 'Trainingsgruppen verwalten',
      path: '/dashboard/gruppen'
    },
    {
      icon: '📍',
      title: 'Standorte',
      description: 'Standorte & Filialen verwalten',
      path: '/dashboard/standorte',
      count: standorte?.length || 0
    }
  ];

  // ✨ Personal - Trainer & Mitarbeiter ✨
  const personalCards = [
    {
      icon: '👨‍🏫',
      title: 'Trainer',
      description: 'Trainer und Qualifikationen verwalten',
      path: '/dashboard/trainer',
      count: stats.trainer
    },
    {
      icon: '🧑‍💼',
      title: 'Personal',
      description: 'Mitarbeiter & Personalverwaltung',
      path: '/dashboard/personal',
      count: stats.personal,
      badge: 'NEU',
      featured: true
    }
  ];

  // ✨ Finanzen - Zahlungen, Beiträge, Rechnungen ✨
  const finanzenCards = [
    {
      icon: '📊',
      title: 'Finanzcockpit',
      description: 'Übersicht über alle Finanzkennzahlen',
      path: '/dashboard/finanzcockpit',
      featured: true
    },
    {
      icon: '💰',
      title: 'Beiträge',
      description: 'Mitgliedsbeiträge und Zahlungen',
      path: '/dashboard/beitraege',
      count: stats.beitraege,
      featured: true
    },
    {
      icon: '🧾',
      title: 'Rechnungen',
      description: 'Rechnungen erstellen und verwalten',
      path: '/dashboard/rechnungen',
      featured: true
    },
    {
      icon: '💳',
      title: 'Lastschriftlauf',
      description: 'SEPA-Lastschriften generieren und verwalten',
      path: '/dashboard/lastschriftlauf',
      featured: true
    },
    {
      icon: '📋',
      title: 'SEPA-Mandate',
      description: 'SEPA-Einzugsermächtigungen verwalten',
      path: '/dashboard/sepa-mandate',
      featured: true
    },
    {
      icon: '⚠️',
      title: 'Mahnwesen',
      description: 'Offene Rechnungen und Mahnungen',
      path: '/dashboard/mahnwesen',
      featured: true
    },
    {
      icon: '🎯',
      title: 'Tarife & Preise',
      description: 'Mitgliedschaftstarife und Preisgestaltung',
      path: '/dashboard/tarife',
      featured: true
    },
    {
      icon: '🔄',
      title: 'Zahlungszyklen',
      description: 'Automatische Beitragszahlungen verwalten',
      path: '/dashboard/zahlungszyklen',
      badge: 'NEU',
      featured: true
    },
    {
      icon: '⚙️',
      title: 'Zahlungseinstellungen',
      description: 'Stripe & DATEV Integration',
      path: '/dashboard/einstellungen/zahlungen',
      badge: 'NEU',
      featured: true
    },
    {
      icon: '📊',
      title: 'DATEV Export',
      description: 'Buchungsdaten für Steuerberater exportieren',
      path: '/dashboard/datev-export',
      badge: 'NEU',
      featured: true
    }
  ];

  // ✨ Einstellungen - System-Konfiguration ✨
  const einstellungenCards = [
    {
      icon: '🏯',
      title: 'Dojo-Verwaltung',
      description: 'Dojos verwalten, Design, Theme, Verträge & Steuern',
      path: '/dashboard/dojos',
      badge: 'DESIGN',
      featured: true
    },
    {
      icon: '📥',
      title: 'MagicLine Import',
      description: 'Mitglieder & Verträge aus MagicLine importieren',
      path: '/dashboard/magicline-import',
      badge: 'IMPORT',
      featured: true
    },
    {
      icon: '📋',
      title: 'Audit-Log',
      description: 'Alle Änderungen nachverfolgen - Wer hat wann was geändert?',
      path: '/dashboard/audit-log',
      badge: 'NEU',
      featured: false
    },
    {
      icon: '🔗',
      title: 'Webhooks & Zapier',
      description: 'Automatisierungen mit externen Services',
      path: '/dashboard/webhooks',
      badge: 'NEU',
      featured: true
    },
    {
      icon: '🔌',
      title: 'Integrationen',
      description: 'PayPal, LexOffice, DATEV konfigurieren',
      path: '/dashboard/integrationen',
      badge: 'NEU',
      featured: true
    }
  ];

  // ✨ Prüfungswesen - Termine & Prüfungen ✨
  const pruefungswesensCards = [
    {
      icon: '🎯',
      title: 'Prüfung durchführen',
      description: 'Live-Ansicht für Prüfungstag - Ergebnisse eintragen',
      path: '/dashboard/pruefung-durchfuehren',
      badge: 'LIVE',
      featured: true
    },
    {
      icon: '🏆',
      title: 'Prüfungen & Termine',
      description: 'Events, Prüfungen und Termine verwalten',
      path: '/dashboard/termine',
      badge: 'NEU',
      featured: true,
      count: stats.termine || 0
    },
    {
      icon: '🏅',
      title: 'Auszeichnungen',
      description: 'Badges vergeben und verwalten',
      path: '/dashboard/badges',
      badge: 'NEU',
      featured: true
    }
  ];

  // ✨ Artikelverwaltung - Shop & Inventar ✨
  const artikelverwaltungCards = [
    {
      icon: '📁',
      title: 'Artikelgruppen',
      description: 'Kampfsport-Kategorien und Unterkategorien',
      path: '/dashboard/artikelgruppen',
      badge: 'NEU',
      featured: true
    },
    {
      icon: '📦',
      title: 'Artikelverwaltung',
      description: 'Sortiment und Lagerbestände verwalten',
      path: '/dashboard/artikel',
      badge: 'NEU',
      featured: true
    }
  ];

  // ✨ Berichte & Übersicht - Reporting ✨
  const berichteCards = [
    {
      icon: '📊',
      title: 'Auswertungen',
      description: 'Statistiken und Berichte erstellen',
      path: '/dashboard/auswertungen',
      badge: 'NEU',
      featured: true
    },
    {
      icon: '📄',
      title: 'Berichte & Dokumente',
      description: 'PDF-Berichte erstellen, ändern & verwalten',
      path: '/dashboard/berichte',
      badge: 'NEU',
      featured: true
    },
    {
      icon: '📋',
      title: 'Vertragsdokumente',
      description: 'AGB, Datenschutz & Hausordnung verwalten',
      path: '/dashboard/vertragsdokumente',
      badge: 'NEU',
      featured: true
    },
    {
      icon: '🥊',
      title: 'Equipment',
      description: 'Inventar und Ausrüstung verwalten',
      path: '/dashboard/inventar',
      badge: 'NEU',
      featured: true,
      count: stats.inventar || 0
    }
  ];

  // ✨ Events - Veranstaltungen & Termine ✨
  const eventsCards = [
    {
      icon: '📅',
      title: 'Events verwalten',
      description: 'Veranstaltungen, Wettkämpfe und besondere Termine',
      path: '/dashboard/events',
      badge: 'NEU',
      featured: true
    }
  ];

  // ✨ ERWEITERTE Admin Quick Actions mit Stil-Verwaltung ✨
  const adminQuickActions = [
    {
      label: '➕ Neues Mitglied',
      path: '/dashboard/mitglieder/neu',
      className: 'primary'
    },
    {
      label: '🎖️ Neuen Stil anlegen',
      path: '/dashboard/stile/neu',
      className: 'info'
    },
    {
      label: '✅ Anwesenheit erfassen',
      path: '/dashboard/anwesenheit',
      className: 'secondary'
    },
    {
      label: '🥋 Prüfung verwalten',
      path: '/dashboard/stile/pruefungen',
      className: 'warning'
    },
    {
      label: '👥 Buddy-Gruppe erstellen',
      path: '/dashboard/buddy-gruppen',
      className: 'success'
    },
    {
      label: '🎯 Neuen Tarif anlegen',
      path: '/dashboard/tarife',
      className: 'info'
    },
    {
      label: '📦 Artikel hinzufügen',
      path: '/dashboard/artikel',
      className: 'success'
    },
    {
      label: '💰 Barverkauf',
      path: '/dashboard/kasse',
      className: 'primary'
    },
    {
      label: '💰 Zahlungseinstellungen',
      path: '/dashboard/einstellungen/zahlungen',
      className: 'warning'
    }
  ];

  // Mitglieder Navigation (vereinfacht)
  const mitgliedNavigationCards = [
    {
      icon: '✅',
      title: 'Meine Anwesenheit',
      description: 'Ihre Trainingshistorie einsehen',
      path: '/dashboard/meine-anwesenheit'
    },
    {
      icon: '🥋',
      title: 'Meine Kurse',
      description: 'Angemeldete Kurse und Termine',
      path: '/dashboard/meine-kurse'
    },
    {
      icon: '👤',
      title: 'Meine Daten',
      description: 'Persönliche Daten bearbeiten',
      path: '/dashboard/meine-daten'
    },
    {
      icon: '🎖️',
      title: 'Meine Prüfungen',
      description: 'Prüfungsstatus und nächste Gürtelprüfung',
      path: '/dashboard/meine-pruefungen'
    },
    {
      icon: '💰',
      title: 'Meine Beiträge',
      description: 'Zahlungshistorie und offene Beiträge',
      path: '/dashboard/meine-beitraege'
    }
  ];

  const mitgliedQuickActions = [
    {
      label: '📅 Kurs buchen',
      path: '/dashboard/kurse',
      className: 'primary'
    },
    {
      label: '👤 Daten bearbeiten',
      path: '/dashboard/meine-daten',
      className: 'secondary'
    }
  ];

  // Für Members auf der Hauptseite: Zeige nur MemberDashboard (hat eigenen Header)
  if (role !== 'admin' && isMainDashboard) {
    return <MemberDashboard />;
  }

  // 🏆 Super-Admin Dashboard: Zeige erweiterte Ansicht für TDA Int'l Org
  console.log('🔍 Super-Admin Dashboard Check:', { role, selectedDojo, isMainDashboard, pathname: location.pathname });
  if (role === 'admin' && selectedDojo === 'super-admin') {
    console.log('✅ Zeige Super-Admin Dashboard für TDA Int\'l Org');
    return (
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div className="dashboard-header-left">
            <img src={logo} alt="DojoSoftware Logo" className="dashboard-logo dojo-software-logo" />
            <h2>🏆 TDA Int'l Org - Super-Admin</h2>
          </div>
          <div className="dashboard-header-right">
            <DojoSwitcher />
            {/* 🎨 Theme Toggle */}
            <button
              className="theme-toggle-button"
              onClick={toggleDarkMode}
              title={isDarkMode ? 'Zu hellem Theme wechseln' : 'Zu dunklem Theme wechseln'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                background: isDarkMode ? 'rgba(255, 215, 0, 0.15)' : 'rgba(0, 0, 0, 0.1)',
                border: '1px solid ' + (isDarkMode ? 'rgba(255, 215, 0, 0.3)' : 'rgba(0, 0, 0, 0.2)'),
                borderRadius: '8px',
                color: isDarkMode ? '#ffd700' : '#333',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                fontSize: '0.85rem',
                fontWeight: '500'
              }}
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
              <span>{isDarkMode ? 'Hell' : 'Dunkel'}</span>
            </button>
            {userDisplayName && (
              <div className="user-display">
                <span className="user-greeting">Willkommen</span>
                <span className="user-name">{userDisplayName}</span>
              </div>
            )}
            <button onClick={logout} className="logout-button">
              Abmelden
            </button>
          </div>
        </header>

        <main className="dashboard-main">
          <SuperAdminDashboard />
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <img src={logo} alt="DojoSoftware Logo" className="dashboard-logo dojo-software-logo" />
          <h2>{headerTitle}</h2>
          <span className="version-badge">v{config.app.version}</span>
        </div>
        <div className="dashboard-header-right">
          {role === 'admin' && <DojoSwitcher />}
          {role === 'admin' && <StandortSwitcher />}
          {/* Zurück-Button - nutzt Browser History */}
          {!isMainDashboard && window.history.length > 1 && (
            <button
              onClick={() => navigate(-1)}
              className="back-button"
              title="Zur vorherigen Seite"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
            >
              <ArrowLeft size={16} />
              <span>Zurück</span>
            </button>
          )}
          {!isMainDashboard && (
            <button
              onClick={() => navigate('/dashboard')}
              className="logout-button"
            >
              ← Dashboard
            </button>
          )}
          {/* 🎨 Theme Toggle */}
          <button
            className="theme-toggle-button"
            onClick={toggleDarkMode}
            title={isDarkMode ? 'Zu hellem Theme wechseln' : 'Zu dunklem Theme wechseln'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              background: isDarkMode ? 'rgba(255, 215, 0, 0.15)' : 'rgba(0, 0, 0, 0.1)',
              border: '1px solid ' + (isDarkMode ? 'rgba(255, 215, 0, 0.3)' : 'rgba(0, 0, 0, 0.2)'),
              borderRadius: '8px',
              color: isDarkMode ? '#ffd700' : '#333',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontSize: '0.85rem',
              fontWeight: '500'
            }}
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            <span>{isDarkMode ? 'Hell' : 'Dunkel'}</span>
          </button>
          {userDisplayName && (
            <div className="user-display">
              <span className="user-greeting">Willkommen</span>
              <span className="user-name">{userDisplayName}</span>
            </div>
          )}
          <button className="logout-button" onClick={handleLogout}>
            <svg
              className="logout-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span className="logout-text">Logout</span>
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <main className="dashboard-main">
          {isMainDashboard ? (
            <div className="content-card">
              {error && (
                <div className="error-message">
                  ⚠️ {error}
                  <button
                    onClick={fetchDashboardStatsOptimized}
                    className="btn btn-neutral btn-small"
                    style={{ marginLeft: '10px' }}
                  >
                    🔄 Erneut versuchen
                  </button>
                </div>
              )}

              {/* 🔔 Trial/Subscription Banner */}
              <TrialBanner stats={stats} />

              {/* Navigation basierend auf Rolle */}
              {role === 'admin' && (
                <>
                  {/* Tab Navigation */}
                  <div className="dashboard-tabs">
                    {tabs.map(tab => (
                      <button
                        key={tab.id}
                        className={`dashboard-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                      >
                        <span className="tab-icon">{tab.icon}</span>
                        <span className="tab-label">{tab.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Navigation basierend auf Rolle */}
              <div className="dashboard-navigation">
                {role === 'admin' ? (
                  <>
                    {/* Tab Content */}
                    <div className="tab-content">
                      {/* ✨ Check-in Systems Tab ✨ */}
                      {activeTab === 'checkin' && (
                        <div className="nav-cards">
                          <div 
                            onClick={() => handleNavigation('/dashboard/checkin')}
                            className="nav-card clickable featured"
                          >
                            <div className="nav-badge live">LIVE</div>
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">📱</span>
                                <h3>
                                  Mitglieder Check-in
                                  <span className="nav-count">({formatNumber(stats.checkins_heute)})</span>
                                </h3>
                              </div>
                              <p>Touch & QR-Code Check-in für Mitglieder</p>
                            </div>
                            <div className="nav-arrow">→</div>
                          </div>
                          
                          <div
                            onClick={() => handleNavigation('/dashboard/anwesenheit')}
                            className="nav-card clickable"
                          >
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">✅</span>
                                <h3>
                                  Anwesenheit
                                  <span className="nav-count">({formatNumber(stats.anwesenheit)})</span>
                                </h3>
                              </div>
                              <p>Anwesenheitsverfolgung und Statistiken</p>
                            </div>
                            <div className="nav-arrow">→</div>
                          </div>

                          <div 
                            onClick={() => handleNavigation('/dashboard/personal-checkin')}
                            className="nav-card clickable featured"
                          >
                            <div className="nav-badge new">NEU</div>
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">👥</span>
                                <h3>
                                  Personal Check-in
                                  <span className="nav-count">({formatNumber(stats.personal_checkins_heute || 0)})</span>
                                </h3>
                              </div>
                              <p>Arbeitszeit-Erfassung für Personal</p>
                            </div>
                            <div className="nav-arrow">→</div>
                          </div>
                          
                          <div 
                            onClick={() => window.open('/public-checkin', '_blank', 'fullscreen=yes,scrollbars=yes')}
                            className="nav-card clickable featured"
                          >
                            <div className="nav-badge live">LIVE</div>
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">🖥️</span>
                                <h3>
                                  Check-in Anzeige
                                  <span className="nav-count">(LIVE)</span>
                                </h3>
                              </div>
                              <p>Check-in Display für 2. Monitor</p>
                            </div>
                            <div className="nav-arrow">↗</div>
                          </div>
                          
                          <div
                            onClick={() => window.open('/public-timetable', '_blank', 'fullscreen=yes,scrollbars=yes')}
                            className="nav-card clickable featured"
                          >
                            <div className="nav-badge live">LIVE</div>
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">📚</span>
                                <h3>
                                  Stundenplan Anzeige
                                  <span className="nav-count">(AUTO)</span>
                                </h3>
                              </div>
                              <p>Rotierender Stundenplan für 2. Monitor</p>
                            </div>
                            <div className="nav-arrow">↗</div>
                          </div>
                          
                          <div
                            onClick={() => handleNavigation('/dashboard/kasse')}
                            className="nav-card clickable featured"
                          >
                            <div className="nav-badge new">NEU</div>
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">💰</span>
                                <h3>Barverkauf</h3>
                              </div>
                              <p>Touch-Kasse für Verkäufe und Barzahlungen</p>
                            </div>
                            <div className="nav-arrow">→</div>
                          </div>

                          <div
                            onClick={() => handleNavigation('/dashboard/tresen')}
                            className="nav-card clickable featured"
                          >
                            <div className="nav-badge live">LIVE</div>
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">🏪</span>
                                <h3>Tresen-Übersicht</h3>
                              </div>
                              <p>Empfang, Checkin & Tagesübersicht</p>
                            </div>
                            <div className="nav-arrow">→</div>
                          </div>
                        </div>
                      )}

                      {/* ✨ Mitgliederverwaltung Tab ✨ */}
                      {activeTab === 'mitglieder' && (
                        <div className="nav-cards">
                        {mitgliederCards.map((card, index) => (
                          <div
                            key={index}
                            onClick={() => handleNavigation(card.path)}
                            className={`nav-card clickable ${card.featured ? 'featured' : ''}`}
                          >
                            {card.badge && (
                              <div className={`nav-badge ${card.badge === 'NEU' ? 'new' : 'live'}`}>
                                {card.badge}
                              </div>
                            )}
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">{card.icon}</span>
                                <h3>
                                  {card.title}
                                  {card.count !== undefined && (
                                    <span className="nav-count">({formatNumber(card.count)})</span>
                                  )}
                                </h3>
                              </div>
                              <p>{card.description}</p>
                            </div>
                            <div className="nav-arrow">→</div>
                          </div>
                        ))}
                        </div>
                      )}

                      {/* ✨ Prüfungswesen Tab ✨ */}
                      {activeTab === 'pruefungswesen' && (
                        <div className="nav-cards">
                        {pruefungswesensCards.map((card, index) => (
                          <div
                            key={index}
                            onClick={() => handleNavigation(card.path)}
                            className={`nav-card clickable ${card.featured ? 'featured' : ''}`}
                          >
                            {card.badge && (
                              <div className={`nav-badge ${card.badge === 'NEU' ? 'new' : card.badge === 'LIVE' ? 'live' : 'admin'}`}>
                                {card.badge}
                              </div>
                            )}
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">{card.icon}</span>
                                <h3>
                                  {card.title}
                                  {card.count !== undefined && (
                                    <span className="nav-count">({formatNumber(card.count)})</span>
                                  )}
                                </h3>
                              </div>
                              <p>{card.description}</p>
                            </div>
                            <div className="nav-arrow">→</div>
                          </div>
                        ))}
                        </div>
                      )}

                      {/* ✨ Events Tab ✨ */}
                      {activeTab === 'events' && (
                        <div className="nav-cards">
                        {eventsCards.map((card, index) => (
                          <div
                            key={index}
                            onClick={() => handleNavigation(card.path)}
                            className={`nav-card clickable ${card.featured ? 'featured' : ''}`}
                          >
                            {card.badge && (
                              <div className={`nav-badge ${card.badge === 'NEU' ? 'new' : card.badge === 'LIVE' ? 'live' : 'admin'}`}>
                                {card.badge}
                              </div>
                            )}
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">{card.icon}</span>
                                <h3>{card.title}</h3>
                              </div>
                              <p>{card.description}</p>
                            </div>
                            <div className="nav-arrow">→</div>
                          </div>
                        ))}
                        </div>
                      )}

                      {/* ✨ Finanzen Tab ✨ */}
                      {activeTab === 'finanzen' && (
                        <div className="nav-cards">
                        {finanzenCards.map((card, index) => (
                          <div
                            key={index}
                            onClick={() => handleNavigation(card.path)}
                            className={`nav-card clickable ${card.featured ? 'featured' : ''}`}
                          >
                            {card.badge && (
                              <div className={`nav-badge ${card.badge === 'NEU' ? 'new' : 'live'}`}>
                                {card.badge}
                              </div>
                            )}
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">{card.icon}</span>
                                <h3>
                                  {card.title}
                                  {card.count !== undefined && (
                                    <span className="nav-count">({formatNumber(card.count)})</span>
                                  )}
                                </h3>
                              </div>
                              <p>{card.description}</p>
                            </div>
                            <div className="nav-arrow">→</div>
                          </div>
                        ))}
                        </div>
                      )}

                      {/* ✨ Artikelverwaltung Tab ✨ */}
                      {activeTab === 'artikelverwaltung' && (
                        <div className="nav-cards">
                        {artikelverwaltungCards.map((card, index) => (
                          <div
                            key={index}
                            onClick={() => handleNavigation(card.path)}
                            className={`nav-card clickable ${card.featured ? 'featured' : ''}`}
                          >
                            {card.badge && (
                              <div className={`nav-badge ${card.badge === 'NEU' ? 'new' : card.badge === 'LIVE' ? 'live' : 'admin'}`}>
                                {card.badge}
                              </div>
                            )}
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">{card.icon}</span>
                                <h3>{card.title}</h3>
                              </div>
                              <p>{card.description}</p>
                            </div>
                            <div className="nav-arrow">→</div>
                          </div>
                        ))}
                        </div>
                      )}

                      {/* ✨ Dojo-Verwaltung Tab ✨ */}
                      {activeTab === 'verwaltung' && (
                        <div className="nav-cards">
                        {verwaltungCards.map((card, index) => (
                          <div
                            key={index}
                            onClick={() => handleNavigation(card.path)}
                            className={`nav-card clickable ${card.featured ? 'featured' : ''}`}
                          >
                            {card.badge && (
                              <div className={`nav-badge ${card.badge === 'NEU' ? 'new' : 'live'}`}>
                                {card.badge}
                              </div>
                            )}
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">{card.icon}</span>
                                <h3>
                                  {card.title}
                                  {card.count !== undefined && (
                                    <span className="nav-count">({formatNumber(card.count)})</span>
                                  )}
                                </h3>
                              </div>
                              <p>{card.description}</p>
                            </div>
                            <div className="nav-arrow">→</div>
                          </div>
                        ))}
                        </div>
                      )}

                      {/* ✨ Personal Tab ✨ */}
                      {activeTab === 'personal' && (
                        <div className="nav-cards">
                        {personalCards.map((card, index) => (
                          <div
                            key={index}
                            onClick={() => handleNavigation(card.path)}
                            className={`nav-card clickable ${card.featured ? 'featured' : ''}`}
                          >
                            {card.badge && (
                              <div className={`nav-badge ${card.badge === 'NEU' ? 'new' : 'live'}`}>
                                {card.badge}
                              </div>
                            )}
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">{card.icon}</span>
                                <h3>
                                  {card.title}
                                  {card.count !== undefined && (
                                    <span className="nav-count">({formatNumber(card.count)})</span>
                                  )}
                                </h3>
                              </div>
                              <p>{card.description}</p>
                            </div>
                            <div className="nav-arrow">→</div>
                          </div>
                        ))}
                        </div>
                      )}

                      {/* ✨ Berichte Tab ✨ */}
                      {activeTab === 'berichte' && (
                        <div className="nav-cards">
                        {berichteCards.map((card, index) => (
                          <div
                            key={index}
                            onClick={() => handleNavigation(card.path)}
                            className={`nav-card clickable ${card.featured ? 'featured' : ''}`}
                          >
                            {card.badge && (
                              <div className={`nav-badge ${card.badge === 'NEU' ? 'new' : card.badge === 'LIVE' ? 'live' : 'admin'}`}>
                                {card.badge}
                              </div>
                            )}
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">{card.icon}</span>
                                <h3>
                                  {card.title}
                                  {card.count !== undefined && (
                                    <span className="nav-count">({formatNumber(card.count)})</span>
                                  )}
                                </h3>
                              </div>
                              <p>{card.description}</p>
                            </div>
                            <div className="nav-arrow">→</div>
                          </div>
                        ))}
                        </div>
                      )}

                      {/* ✨ Einstellungen Tab ✨ */}
                      {activeTab === 'einstellungen' && (
                        <div className="nav-cards">
                        {einstellungenCards.map((card, index) => (
                          <div
                            key={index}
                            onClick={() => handleNavigation(card.path)}
                            className={`nav-card clickable ${card.featured ? 'featured' : ''}`}
                          >
                            {card.badge && (
                              <div className={`nav-badge ${card.badge === 'NEU' ? 'new' : card.badge === 'LIVE' ? 'live' : 'admin'}`}>
                                {card.badge}
                              </div>
                            )}
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">{card.icon}</span>
                                <h3>{card.title}</h3>
                              </div>
                              <p>{card.description}</p>
                            </div>
                            <div className="nav-arrow">→</div>
                          </div>
                        ))}
                        </div>
                      )}

                      {/* ✨ Schnellaktionen Tab ✨ */}
                      {activeTab === 'schnellaktionen' && (
                        <div className="nav-section">
                          <h2 className="section-header quick-actions-header" style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '0.5rem',
                            backgroundImage: 'none',
                            WebkitBackgroundClip: 'unset',
                            WebkitTextFillColor: '#FFD700',
                            backgroundClip: 'unset',
                            color: '#FFD700',
                            textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                            marginBottom: '2rem'
                          }}>
                            <span style={{ 
                              fontSize: '1.5rem',
                              filter: 'drop-shadow(0 2px 8px rgba(255, 215, 0, 0.3))',
                              position: 'relative',
                              zIndex: 10,
                              lineHeight: 1,
                              display: 'inline-block',
                              flexShrink: 0
                            }}>⚡</span>
                            <span style={{ 
                              WebkitFontSmoothing: 'antialiased',
                              MozOsxFontSmoothing: 'grayscale',
                              color: '#FFD700 !important',
                              WebkitTextFillColor: '#FFD700 !important',
                              backgroundImage: 'none !important',
                              WebkitBackgroundClip: 'unset !important',
                              backgroundClip: 'unset !important'
                            }}>Schnellaktionen</span>
                          </h2>
                          {role === 'admin' ? (
                            <div className="quick-actions">
                              {adminQuickActions.map((action, index) => (
                                <button 
                                  key={index}
                                  onClick={() => handleNavigation(action.path)}
                                  className={`quick-action-btn ${action.className}`}
                                >
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="quick-actions">
                              {mitgliedQuickActions.map((action, index) => (
                                <button 
                                  key={index}
                                  onClick={() => handleNavigation(action.path)}
                                  className={`quick-action-btn ${action.className}`}
                                >
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          )}
                          {/* Aktualisieren Button */}
                          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                            <button
                              onClick={fetchDashboardStatsOptimized}
                              className="quick-action-btn info"
                              disabled={loading}
                            >
                              🔄 {loading ? 'Lädt...' : 'Statistiken aktualisieren'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ℹ️ Info Tab ℹ️ */}
                      {activeTab === 'info' && (
                        <div className="nav-section">
                          <h2 className="section-header">ℹ️ System & Status</h2>

                          {/* Grid Layout für Info-Karten */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                            gap: '1.5rem',
                            maxWidth: '1200px',
                            margin: '0 auto'
                          }}>

                            {/* AGB/DSGVO Status - Wichtig, daher prominent */}
                            <div style={{
                              gridColumn: 'span 1',
                              background: 'var(--glass-bg)',
                              borderRadius: '16px',
                              border: '1px solid var(--border-accent)',
                              overflow: 'hidden'
                            }}>
                              <AgbStatusWidget />
                            </div>

                            {/* Dojo Statistiken */}
                            <div style={{
                              background: 'var(--glass-bg)',
                              borderRadius: '16px',
                              padding: '1.5rem',
                              border: '1px solid var(--border-accent)'
                            }}>
                              <h3 style={{
                                color: 'var(--primary)',
                                marginBottom: '1rem',
                                fontSize: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}>
                                📊 Dojo Statistiken
                              </h3>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{
                                  background: 'rgba(255,215,0,0.1)',
                                  padding: '1rem',
                                  borderRadius: '8px',
                                  textAlign: 'center'
                                }}>
                                  <div style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--primary)' }}>
                                    {formatNumber(stats.mitglieder)}
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Mitglieder</div>
                                </div>
                                <div style={{
                                  background: 'rgba(96,165,250,0.1)',
                                  padding: '1rem',
                                  borderRadius: '8px',
                                  textAlign: 'center'
                                }}>
                                  <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#60A5FA' }}>
                                    {formatNumber(stats.kurse)}
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Kurse</div>
                                </div>
                                <div style={{
                                  background: 'rgba(52,211,153,0.1)',
                                  padding: '1rem',
                                  borderRadius: '8px',
                                  textAlign: 'center'
                                }}>
                                  <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#34D399' }}>
                                    {formatNumber(stats.trainer)}
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Trainer</div>
                                </div>
                                <div style={{
                                  background: 'rgba(244,114,182,0.1)',
                                  padding: '1rem',
                                  borderRadius: '8px',
                                  textAlign: 'center'
                                }}>
                                  <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#F472B6' }}>
                                    {formatNumber(stats.checkins_heute)}
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Check-ins heute</div>
                                </div>
                              </div>
                            </div>

                            {/* System Info */}
                            <div style={{
                              background: 'var(--glass-bg)',
                              borderRadius: '16px',
                              padding: '1.5rem',
                              border: '1px solid var(--border-accent)'
                            }}>
                              <h3 style={{
                                color: 'var(--primary)',
                                marginBottom: '1rem',
                                fontSize: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}>
                                ⚙️ System
                              </h3>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  padding: '0.5rem 0',
                                  borderBottom: '1px solid var(--border-accent)'
                                }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Version</span>
                                  <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>v{config.app.version}</span>
                                </div>
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  padding: '0.5rem 0',
                                  borderBottom: '1px solid var(--border-accent)'
                                }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Build</span>
                                  <span style={{ color: 'var(--text-primary)' }}>{config.app.buildDate}</span>
                                </div>
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  padding: '0.5rem 0',
                                  borderBottom: '1px solid var(--border-accent)'
                                }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Entwickler</span>
                                  <span style={{ color: 'var(--text-primary)' }}>{config.app.author}</span>
                                </div>
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  padding: '0.5rem 0'
                                }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Support</span>
                                  <a href={`mailto:${config.app.contactEmail}`} style={{ color: 'var(--primary)' }}>
                                    {config.app.contactEmail}
                                  </a>
                                </div>
                              </div>
                            </div>

                            {/* Schnellzugriff */}
                            <div style={{
                              background: 'var(--glass-bg)',
                              borderRadius: '16px',
                              padding: '1.5rem',
                              border: '1px solid var(--border-accent)'
                            }}>
                              <h3 style={{
                                color: 'var(--primary)',
                                marginBottom: '1rem',
                                fontSize: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}>
                                🔗 Schnellzugriff
                              </h3>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <button
                                  onClick={() => handleNavigation('/dashboard/einstellungen')}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.75rem 1rem',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border-accent)',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    width: '100%'
                                  }}
                                >
                                  <span>🏯</span>
                                  <span>Dojo-Einstellungen</span>
                                </button>
                                <button
                                  onClick={() => handleNavigation('/dashboard/audit-log')}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.75rem 1rem',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border-accent)',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    width: '100%'
                                  }}
                                >
                                  <span>📋</span>
                                  <span>Audit-Log</span>
                                </button>
                                <button
                                  onClick={() => handleNavigation('/dashboard/vertragsdokumente')}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.75rem 1rem',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border-accent)',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    width: '100%'
                                  }}
                                >
                                  <span>📄</span>
                                  <span>AGB & Datenschutz bearbeiten</span>
                                </button>
                              </div>
                            </div>

                          </div>
                        </div>
                      )}

                    </div>

                  </>
                ) : (
                  <>
                    {/* Mitglieder Navigation */}
                    <div className="nav-section">
                      <h2 className="section-header">🥋 Meine Dojo-Bereiche</h2>
                      <div className="nav-cards">
                        {mitgliedNavigationCards.map((card, index) => (
                          <div 
                            key={index}
                            onClick={() => handleNavigation(card.path)}
                            className="nav-card clickable"
                          >
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">{card.icon}</span>
                                <h3>{card.title}</h3>
                              </div>
                              <p>{card.description}</p>
                            </div>
                            <div className="nav-arrow">→</div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </>
                )}
              </div>
            </div>
          ) : (
            /* Outlet für Unterseiten wie /dashboard/mitglieder/:id */
            <div className="content-card">
              <Outlet />
            </div>
          )}
        </main>
      </div>

      {/* Admin Registration Popup - Zeigt neue Mitglieder-Registrierungen */}
      {role === 'admin' && <AdminRegistrationPopup />}
    </div>
  );
}

export default Dashboard;
