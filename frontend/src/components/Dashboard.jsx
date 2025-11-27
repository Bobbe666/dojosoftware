import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx'; // 🔒 TAX COMPLIANCE
import { useMitgliederUpdate } from '../context/MitgliederUpdateContext.jsx';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import config from '../config/config.js';
import { fetchDashboardBatch, fetchDashboardStats, fetchRecentActivities } from '../utils/apiCache.js';
import '../styles/themes.css';         // Centralized theme system
import '../styles/Dashboard.css';      // Dashboard-spezifische Styles (MUSS VOR components.css stehen!)
import '../styles/components.css';     // Universal component styles
import '../styles/BuddyVerwaltung.css'; // Buddy-Verwaltung Styles
import logo from '../assets/dojo-logo.png';
import { Users, Trophy, ClipboardList, Calendar, Menu, FileText, ChevronDown } from 'lucide-react';
import DojoSwitcher from './DojoSwitcher';
import MemberDashboard from './MemberDashboard';
import AdminRegistrationPopup from './AdminRegistrationPopup';

function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, logout } = useAuth();
  const { getDojoFilterParam } = useDojoContext(); // 🔒 TAX COMPLIANCE: Dojo-Filter für alle API-Calls
  const { updateTrigger } = useMitgliederUpdate(); // 🔄 Automatische Updates nach Mitgliedsanlage
  
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

  // Kollaps-State für Dashboard-Sektionen (alle standardmäßig geöffnet)
  const [collapsedSections, setCollapsedSections] = useState({
    checkin: false,
    mitglieder: false,
    verwaltung: false,
    einstellungen: false,
    pruefungswesen: false,
    artikelverwaltung: false,
    berichte: false,
    finanzen: false
  });

  let role = 'mitglied';

  try {
    if (token) {
      const decoded = jwtDecode(token);
      role = decoded.role || 'mitglied';
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

  // Funktion zum Umschalten der Kollaps-States
  const toggleSection = (sectionKey) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

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
    }
  ];

  // ✨ Einstellungen - System-Konfiguration ✨
  const einstellungenCards = [
    {
      icon: '🏢',
      title: 'Dojo-Verwaltung',
      description: 'Mehrere Dojos & Steuer-Tracking verwalten',
      path: '/dashboard/dojos',
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
      label: '📁 Gruppe erstellen',
      path: '/dashboard/artikelgruppen',
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

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <img src={logo} alt="TDA Logo" className="dashboard-logo" />
          <h2>{headerTitle}</h2>
        </div>
        <div className="dashboard-header-right">
          {role === 'admin' && <DojoSwitcher />}
          {!isMainDashboard && (
            <button
              onClick={() => navigate('/dashboard')}
              className="logout-button"
            >
              ← Dashboard
            </button>
          )}
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

              {/* ✨ ERWEITERTE Statistiken Übersicht mit Stilen ✨ */}
              <div 
                className="stats-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: '0.5rem',
                  marginBottom: '0.5rem'
                }}
              >
                <div 
                  className={`stat-card ${loading ? 'loading' : ''}`}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    textAlign: 'center',
                    minHeight: '60px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '0.5rem',
                    marginBottom: '0.1rem'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>👥</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ffd700' }}>
                      {loading ? '...' : formatNumber(stats.mitglieder)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Mitglieder
                  </div>
                </div>

                <div 
                  className={`stat-card ${loading ? 'loading' : ''}`}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    textAlign: 'center',
                    minHeight: '60px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '0.5rem',
                    marginBottom: '0.1rem'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>✅</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ffd700' }}>
                      {loading ? '...' : formatNumber(stats.anwesenheit)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Anwesenheiten
                  </div>
                </div>

                {/* ✨ MINI CHECK-IN KARTE ✨ */}
                <div 
                  className={`stat-card ${loading ? 'loading' : ''}`}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    textAlign: 'center',
                    minHeight: '60px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '0.5rem',
                    marginBottom: '0.1rem'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>📱</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ffd700' }}>
                      {loading ? '...' : formatNumber(stats.checkins_heute)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Check-ins
                  </div>
                </div>

                <div 
                  className={`stat-card ${loading ? 'loading' : ''}`}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    textAlign: 'center',
                    minHeight: '60px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '0.5rem',
                    marginBottom: '0.1rem'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>🥋</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ffd700' }}>
                      {loading ? '...' : formatNumber(stats.kurse)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Kurse
                  </div>
                </div>

                {/* ✨ NEUE STILE MINI-KARTE ✨ */}
                <div 
                  className={`stat-card ${loading ? 'loading' : ''}`}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    textAlign: 'center',
                    minHeight: '60px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '0.5rem',
                    marginBottom: '0.1rem'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>🎖️</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ffd700' }}>
                      {loading ? '...' : formatNumber(stats.stile)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Stile
                  </div>
                </div>

                <div 
                  className={`stat-card ${loading ? 'loading' : ''}`}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    textAlign: 'center',
                    minHeight: '60px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '0.5rem',
                    marginBottom: '0.1rem'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>👨‍🏫</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ffd700' }}>
                      {loading ? '...' : formatNumber(stats.trainer)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Trainer
                  </div>
                </div>

                <div 
                  className={`stat-card ${loading ? 'loading' : ''}`}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    textAlign: 'center',
                    minHeight: '60px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '0.5rem',
                    marginBottom: '0.1rem'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>💰</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ffd700' }}>
                      {loading ? '...' : formatNumber(stats.beitraege)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Beiträge
                  </div>
                </div>
              </div>

              {/* Navigation basierend auf Rolle */}
              <div className="dashboard-navigation">
                {role === 'admin' ? (
                  <>
                    {/* ✨ Check-in Systems - Mitglieder & Personal ✨ */}
                    <div className="nav-section">
                      <h2
                        className="section-header collapsible"
                        onClick={() => toggleSection('checkin')}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="section-icon">📱</span>
                          <span className="section-text">Check-in Systeme</span>
                        </span>
                        <span style={{ transform: collapsedSections.checkin ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
                          ▼
                        </span>
                      </h2>
                      {!collapsedSections.checkin && (
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
                    </div>

                    {/* ✨ Mitgliederverwaltung Sektion ✨ */}
                    <div className="nav-section">
                      <h2
                        className="section-header collapsible"
                        onClick={() => toggleSection('mitglieder')}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="section-icon">👥</span>
                          <span className="section-text">Mitgliederverwaltung</span>
                        </span>
                        <span style={{ transform: collapsedSections.mitglieder ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
                          ▼
                        </span>
                      </h2>
                      {!collapsedSections.mitglieder && (
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
                    </div>

                    {/* ✨ Finanzen Sektion ✨ */}
                    <div className="nav-section">
                      <h2
                        className="section-header collapsible"
                        onClick={() => toggleSection('finanzen')}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="section-icon">💰</span>
                          <span className="section-text">Finanzen</span>
                        </span>
                        <span style={{ transform: collapsedSections.finanzen ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
                          ▼
                        </span>
                      </h2>
                      {!collapsedSections.finanzen && (
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
                    </div>

                    {/* ✨ Prüfungswesen Sektion ✨ */}
                    <div className="nav-section">
                      <h2
                        className="section-header collapsible"
                        onClick={() => toggleSection('pruefungswesen')}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="section-icon">🏆</span>
                          <span className="section-text">Prüfungswesen</span>
                        </span>
                        <span style={{ transform: collapsedSections.pruefungswesen ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
                          ▼
                        </span>
                      </h2>
                      {!collapsedSections.pruefungswesen && (
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
                    </div>

                    {/* ✨ Artikelverwaltung Sektion ✨ */}
                    <div className="nav-section">
                      <h2
                        className="section-header collapsible"
                        onClick={() => toggleSection('artikelverwaltung')}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="section-icon">📦</span>
                          <span className="section-text">Artikelverwaltung</span>
                        </span>
                        <span style={{ transform: collapsedSections.artikelverwaltung ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
                          ▼
                        </span>
                      </h2>
                      {!collapsedSections.artikelverwaltung && (
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
                    </div>

                    {/* Admin Verwaltung Sektion */}
                    <div className="nav-section">
                      <h2
                        className="section-header collapsible"
                        onClick={() => toggleSection('verwaltung')}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="section-icon">🔧</span>
                          <span className="section-text">Dojo-Verwaltung</span>
                        </span>
                        <span style={{ transform: collapsedSections.verwaltung ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
                          ▼
                        </span>
                      </h2>
                      {!collapsedSections.verwaltung && (
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
                    </div>

                    {/* Admin Berichte Sektion */}
                    <div className="nav-section">
                      <h2
                        className="section-header collapsible"
                        onClick={() => toggleSection('berichte')}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="section-icon">📊</span>
                          <span className="section-text">Berichte</span>
                        </span>
                        <span style={{ transform: collapsedSections.berichte ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
                          ▼
                        </span>
                      </h2>
                      {!collapsedSections.berichte && (
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
                    </div>

                    {/* ✨ Einstellungen Sektion ✨ */}
                    <div className="nav-section">
                      <h2
                        className="section-header collapsible"
                        onClick={() => toggleSection('einstellungen')}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="section-icon">⚙️</span>
                          <span className="section-text">Einstellungen</span>
                        </span>
                        <span style={{ transform: collapsedSections.einstellungen ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
                          ▼
                        </span>
                      </h2>
                      {!collapsedSections.einstellungen && (
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
                    </div>

                    {/* Admin Quick Actions */}
                    <div className="nav-section">
                      <h2 className="section-header">⚡ Schnellaktionen</h2>
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

                    {/* Mitglieder Quick Actions */}
                    <div className="nav-section">
                      <h2 className="section-header">⚡ Schnellaktionen</h2>
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
                    </div>
                  </>
                )}
                {/* Aktualisieren Button */}
                <div className="nav-section">
                  <div className="quick-actions">
                    <button
                      onClick={fetchDashboardStatsOptimized}
                      className="quick-action-btn info"
                      disabled={loading}
                    >
                      🔄 {loading ? 'Lädt...' : 'Statistiken aktualisieren'}
                    </button>
                  </div>
                </div>
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
