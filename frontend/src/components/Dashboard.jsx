import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { useSubscription } from '../context/SubscriptionContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx'; // 🔒 TAX COMPLIANCE
import { useStandortContext } from '../context/StandortContext.jsx';
import { useMitgliederUpdate } from '../context/MitgliederUpdateContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx'; // 🎨 Theme Switching
import { useChatContext } from '../context/ChatContext.jsx';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import config from '../config/config.js';
import { fetchDashboardBatch, fetchDashboardStats, fetchRecentActivities } from '../utils/apiCache.js';
import '../styles/themes.css';         // Centralized theme system
import '../styles/Dashboard.css';      // Dashboard-spezifische Styles (MUSS VOR components.css stehen!)
import '../styles/components.css';     // Universal component styles
import '../styles/BuddyVerwaltung.css'; // Buddy-Verwaltung Styles
import { Users, Trophy, ClipboardList, Calendar, Menu, FileText, ChevronDown, Moon, Sun, MessageCircle, X, LogOut } from 'lucide-react';

const logo = '/dojo-logo.png';
import DojoSwitcher from './DojoSwitcher';
import StandortSwitcher from './StandortSwitcher';
import MemberDashboard from './MemberDashboard';
import AdminRegistrationPopup from './AdminRegistrationPopup';
import SetupWizard from './SetupWizard';
import SuperAdminDashboard from './SuperAdminDashboard';
import VerbandDashboard from './VerbandDashboard';
import SupportDashboard from './SupportDashboard';
import ShopDashboard from './shop/ShopDashboard';
import HofDashboard from './HofDashboard';
import SupportTickets from './SupportTickets';
import FeatureBoard from './FeatureBoard';
import TrialBanner from './TrialBanner';
import LanguageSwitcher from './LanguageSwitcher';
import AgbStatusWidget from './AgbStatusWidget';
import VisitorChatAlerts from './chat/VisitorChatAlerts';
import SystemChangelog from './SystemChangelog';
import HilfeCenter from './HilfeCenter';
import CockpitUebersicht from './CockpitUebersicht';


function Dashboard() {
  const { t, i18n } = useTranslation('dashboard');
  const location = useLocation();
  const navigate = useNavigate();
  const { token, logout, user } = useAuth();
  const { hasFeature } = useSubscription();
  const { getDojoFilterParam, selectedDojo, activeDojo } = useDojoContext(); // 🔒 TAX COMPLIANCE: Dojo-Filter für alle API-Calls
  const { standorte } = useStandortContext(); // Multi-Location support
  const { updateTrigger } = useMitgliederUpdate(); // 🔄 Automatische Updates nach Mitgliedsanlage
  const { theme, setTheme, isDarkMode, toggleDarkMode, themes } = useTheme(); // 🎨 Theme Switching
  const { unreadCount: chatUnread } = useChatContext();

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

  let role = 'mitglied';
  let isMainAdmin = false; // Haupt-Admin Check für News-Feature
  let isSuperAdmin = false; // Nur für Super-Admin sichtbare Features

  try {
    if (token) {
      const decoded = jwtDecode(token);
      role = decoded.role || 'mitglied';
      // Haupt-Admin: user.id === 1 oder username === 'admin'
      isMainAdmin = decoded.id === 1 || decoded.user_id === 1 || decoded.username === 'admin';
      isSuperAdmin = decoded.dojo_id === null || decoded.dojo_id === undefined || decoded.role === 'super_admin' || isMainAdmin;
    }
  } catch (error) {
    console.error("Fehler beim Dekodieren des Tokens:", error);
  }

  // Setup-Wizard: Zeigen wenn Dojo noch nicht eingerichtet
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  useEffect(() => {
    if (
      role === 'admin' &&
      activeDojo &&
      activeDojo !== 'super-admin' &&
      activeDojo?.onboarding_completed === 0 &&
      !localStorage.getItem(`setup_wizard_done_${activeDojo?.id}`)
    ) {
      setShowSetupWizard(true);
    }
  }, [role, activeDojo]);

  // Tab-State für Dashboard
  const [activeTab, setActiveTab] = useState('checkin');
  const [hilfeSupportView, setHilfeSupportView] = useState(null);
  const [einstellungenView, setEinstellungenView] = useState(null);

  // User-Modal State
  const [showUserMenu, setShowUserMenu] = useState(false);

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

  // User-Dropdown: Escape-Taste + Click-Outside schließt
  useEffect(() => {
    if (!showUserMenu) return;
    const handleKey = (e) => { if (e.key === 'Escape') setShowUserMenu(false); };
    const handleClickOutside = (e) => {
      if (!e.target.closest('.dashboard-user-wrap') && !e.target.closest('.um-modal')) setShowUserMenu(false);
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const handleLogout = () => {
    console.log('🚪 LOGOUT: handleLogout aufgerufen');
    console.log('🚪 LOGOUT: token vor clearSession:', !!localStorage.getItem('dojo_auth_token'));
    logout();
    console.log('🚪 LOGOUT: token nach clearSession:', !!localStorage.getItem('dojo_auth_token'));
    console.log('🚪 LOGOUT: navigiere zu /login...');
    window.location.href = '/login';
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
    { id: 'checkin', label: t('tabs.checkin'), icon: '📱' },
    { id: 'mitglieder', label: t('tabs.mitglieder'), icon: '👥' },
    { id: 'pruefungswesen', label: t('tabs.pruefungswesen'), icon: '🏆' },
    { id: 'hof', label: 'Hall of Fame', icon: '🏛️' },
    { id: 'events', label: t('tabs.events'), icon: '📅' },
    { id: 'kommunikation', label: 'Kommunikation', icon: '📣' },
    { id: 'finanzen', label: t('tabs.finanzen'), icon: '💰' },
    { id: 'shop', label: 'Shop & Kasse', icon: '🛒' },
    { id: 'verwaltung', label: t('tabs.verwaltung'), icon: '🏯' },
    { id: 'berichte', label: t('tabs.berichte'), icon: '📄' },
    { id: 'einstellungen', label: t('tabs.einstellungen'), icon: '⚙️' },
    { id: 'schnellaktionen', label: t('tabs.schnellaktionen'), icon: '⚡' },
    { id: 'hilfe-support', label: t('tabs.hilfeSupport'), icon: '❓' }
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
  const headerTitle = role === 'admin' ? t('header.title') : t('header.memberTitle');

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
      description: 'Interne Buddy-Gruppen und Einladungsverwaltung',
      path: '/dashboard/buddy-gruppen',
      badge: 'NEU',
      featured: true,
      count: stats.buddy_gruppen || 0,
      superAdminOnly: true
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
    },
    {
      icon: '🔑',
      title: 'Passwörter',
      description: 'Passwörter für Dojo-Mitglieder zurücksetzen',
      path: '/dashboard/passwoerter',
      featured: false
    }
  ];

  // ✨ Dojo-Verwaltung - Kurse, Stile, Training ✨
  const verwaltungCards = [
    {
      icon: '🥋',
      title: 'Kursverwaltung',
      description: 'Kurse, Stundenplan & Trainer',
      path: '/dashboard/kurse',
      count: stats.kurse,
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
      icon: '📍',
      title: 'Standorte',
      description: 'Standorte & Filialen verwalten',
      path: '/dashboard/standorte',
      count: standorte?.length || 0
    },
    {
      icon: '⏱️',
      title: 'Stundennachweise',
      description: 'Trainer-Stunden erfassen und auswerten',
      path: '/dashboard/trainer-stunden',
      badge: 'NEU'
    },
    {
      icon: '🧑‍💼',
      title: 'Personal',
      description: 'Mitarbeiter & Personalverwaltung',
      path: '/dashboard/personal',
      count: stats.personal,
      badge: 'NEU',
      featured: true
    },
    {
      icon: '🏆',
      title: 'Turniere',
      description: 'Turniere verwalten, Teilnahmen und HOF-Vorschläge',
      path: '/dashboard/turniere',
      badge: 'NEU',
      featured: true
    },
    {
      icon: '📚',
      title: 'Lernplattform',
      description: 'Techniken, Videos, PDFs und Lernmaterialien',
      path: '/dashboard/lernplattform',
      badge: 'NEU',
      featured: true
    },
    {
      icon: '👨‍👩‍👧',
      title: 'Eltern-Zugänge',
      description: 'Eltern-Zugangslinks für Kinder-Mitglieder verwalten',
      path: '/dashboard/eltern-zugaenge',
      badge: 'NEU'
    },
    // 🌐 HOMEPAGE BUILDER (Enterprise)
    {
      icon: '🌐',
      title: 'Meine Homepage',
      description: 'Professionelle öffentliche Homepage — inklusive im Enterprise-Paket',
      path: '/dashboard/homepage',
      badge: 'ENTERPRISE',
      featured: true
    }
  ];

  // ✨ Shop & Kasse ✨
  const shopCards = [
    { icon: '💰', title: 'Verkauf', description: 'Bar- oder Kontoverkauf an der Kasse', path: '/dashboard/kasse', featured: true },
    { icon: '📦', title: 'Artikel', description: 'Artikel & Produkte verwalten', path: '/dashboard/artikel', featured: true },
    { icon: '🗂️', title: 'Artikelgruppen', description: 'Kategorien & Gruppen', path: '/dashboard/artikelgruppen' },
    { icon: '📋', title: 'Bestellungen', description: 'Online-Shop Bestellungen', path: '/dashboard/shop-bestellungen', featured: true },
    { icon: '💳', title: 'Offene Artikel-Einzüge', description: 'Lastschrift & Stripe Einzüge für Artikelverkäufe', path: '/dashboard/offene-einzuege', featured: true },
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
      icon: '📋',
      title: 'SEPA-Mandate',
      description: 'SEPA-Einzugsermächtigungen verwalten',
      path: '/dashboard/sepa-mandate',
      featured: true
    },
    {
      icon: '🔴',
      title: 'Offene Zahlungen',
      description: 'Rücklastschriften & Chargebacks verwalten',
      path: '/dashboard/offene-zahlungen',
      badge: 'NEU',
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
    },
    {
      icon: '🧾',
      title: 'Steuer-Assistent',
      description: 'UStVA & EÜR — ELSTER XML, Jahresabschluss, Steuerberater-Export',
      path: '/dashboard/steuer',
      badge: 'NEU',
      featured: true
    },
    ...(hasFeature('buchfuehrung') ? [{
      icon: '📒',
      title: 'Buchhaltung & EÜR',
      description: 'Belege, Bankimport, Jahresabschluss und GuV',
      path: '/dashboard/buchhaltung',
      badge: 'PREMIUM',
      featured: true
    }] : [{
      icon: '📒',
      title: 'Buchhaltung & EÜR',
      description: 'Belege, Bankimport, Jahresabschluss und GuV',
      path: '/dashboard/buchhaltung',
      badge: 'PREMIUM',
      featured: false,
      locked: true
    }]),
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
      icon: '📊',
      title: 'CSV Import',
      description: 'Mitglieder aus CSV/Excel importieren',
      path: '/dashboard/csv-import',
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
      icon: '🛡️',
      title: 'Sicherheit',
      description: 'Angriffserkennung, IP-Blockierung & Security-Alerts',
      path: '/dashboard/security',
      badge: 'NEU',
      featured: true
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
    },
    {
      icon: '📅',
      title: 'Kalender-Synchronisation',
      description: 'iCal-Links für Google, Outlook, Apple',
      path: '/dashboard/kalender-sync',
      badge: 'NEU',
      featured: true
    },
    {
      icon: 'ℹ️',
      title: 'System & Info',
      description: 'Statistiken, Versionsinfo & Changelog',
      action: 'info'
    },
  ];

  // ✨ Prüfungswesen - Termine & Prüfungen ✨
  const pruefungswesensCards = [
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

  // ✨ Berichte & Übersicht - Reporting ✨
  const berichteCards = [
    {
      icon: '📂',
      title: 'DokumentenZentrale',
      description: 'Vorlagen, Verträge, AGB, Datenschutz & Automatisierungen',
      path: '/dashboard/dokumentenzentrale',
      badge: 'NEU',
      featured: true
    },
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
      title: 'Berichte',
      description: 'PDF-Berichte erstellen, ändern & verwalten',
      path: '/dashboard/berichte',
      featured: true
    },
    {
      icon: '🥊',
      title: 'Equipment',
      description: 'Inventar und Ausrüstung verwalten',
      path: '/dashboard/inventar',
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
    },
    {
      icon: '📊',
      title: 'Event-Dashboard',
      description: 'Statistiken, Zahlungen & Export',
      path: '/dashboard/events-dashboard',
      badge: 'NEU'
    }
  ];

  // ✨ Kommunikation & Marketing ✨
  const kommunikationCards = [
    {
      icon: '📱',
      title: 'Msg-App öffnen',
      description: 'WhatsApp-Style Messaging für Admin, Trainer & Mitglieder',
      action: 'msg-app',
      badge: 'NEU',
      featured: true
    },
    {
      icon: '📰',
      title: 'News & Beiträge',
      description: 'Nachrichten für Mitglieder und Website veröffentlichen',
      path: '/dashboard/news',
      badge: 'NEU',
      featured: true
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
      icon: '📣',
      title: 'Marketing-Zentrale',
      description: 'Jahresplan, Social-Media-Aktionen und Kampagnen',
      path: '/dashboard/marketingzentrale',
      badge: 'NEU',
      featured: true
    },
    {
      icon: '📋',
      title: 'Umfragen',
      description: 'Mitglieder-Umfragen zur Veranstaltungsteilnahme und Feedback',
      path: '/dashboard/umfragen',
      badge: 'NEU',
      featured: true
    },
  ];

  // ✨ Hilfe & Support - kombinierter Tab ✨
  const hilfeSupportCards = [
    {
      icon: '📚',
      title: 'Help Center',
      description: 'Anleitungen, FAQ und Dokumentation',
      action: 'hilfe'
    },
    {
      icon: '🎫',
      title: 'Support-Tickets',
      description: 'Probleme melden und Anfragen stellen',
      action: 'support'
    },
    {
      icon: '💡',
      title: 'Wunschliste',
      description: 'Feature-Wünsche und Verbesserungsvorschläge',
      action: 'wunschliste'
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

  // 🏆 Super-Admin Dashboard: Zeige erweiterte Ansicht für TDA Int'l Org (NUR auf Hauptseite!)
  console.log('🔍 Super-Admin Dashboard Check:', { role, selectedDojo, isMainDashboard, pathname: location.pathname });
  if ((role === 'admin' || role === 'super_admin') && selectedDojo === 'super-admin' && isMainDashboard) {
    console.log('✅ Zeige Super-Admin Dashboard für TDA Int\'l Org');
    return (
      <div className={`dashboard-container ${theme === 'tda-vib' ? 'dashboard-tda-vib' : ''}`}>
        <header className="dashboard-header">
          <div className="dashboard-header-left">
            <img src={logo} alt="DojoSoftware Logo" className="dashboard-logo dojo-software-logo" />
            <h2>🏆 TDA Int'l Org - Super-Admin</h2>
            <span className="version-badge">v{config.app.version}</span>
          </div>
          <div className="dashboard-header-right">
            <DojoSwitcher />
            {/* Zurück-Button - nutzt Browser History */}
            {!isMainDashboard && window.history.length > 1 && (
              <button
                onClick={() => navigate(-1)}
                className="logout-button"
                title="Zur vorherigen Seite"
              >
                ← {t('header.back')}
              </button>
            )}
            {!isMainDashboard && (
              <button
                onClick={() => navigate('/dashboard')}
                className="logout-button"
              >
                ← {t('header.dashboard')}
              </button>
            )}
            {/* 💬 Chat-Icon */}
            <button
              onClick={() => navigate('/dashboard/chat')}
              className="logout-button chat-header-badge-wrap dashboard-chat-wrap"
              title="Chat"
            >
              <MessageCircle size={18} />
              {chatUnread > 0 && (
                <span className="chat-header-badge">{chatUnread > 99 ? '99+' : chatUnread}</span>
              )}
            </button>
            {/* 👤 User-Dropdown */}
            <div className="dashboard-user-wrap">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="logout-button dashboard-user-btn"
              >
                <span>👤</span>
                <span>{userDisplayName || 'User'}</span>
                <span className="dashboard-user-btn-arrow">▼</span>
              </button>
              {showUserMenu && (
                <div className="dashboard-user-dropdown">
                  <button onClick={toggleDarkMode} className="dashboard-menu-btn">
                    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                    <span>{isDarkMode ? 'Helles Theme' : 'Dunkles Theme'}</span>
                  </button>
                  <div className="dashboard-menu-row">
                    <span>🌐</span>
                    <LanguageSwitcher compact={true} showLabel={false} />
                  </div>
                  <button onClick={() => { setShowUserMenu(false); handleLogout(); }} className="dashboard-menu-btn danger">
                    <span>🚪</span>
                    <span>{t('header.logout')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="dashboard-main">
          <SuperAdminDashboard />
        </main>
      </div>
    );
  }

  // 🌐 Verband Dashboard: Zeige Verbandsverwaltung (nur auf Haupt-Dashboard, nicht auf Sub-Routen)
  if ((role === 'admin' || role === 'super_admin') && selectedDojo === 'verband' && isMainDashboard) {
    console.log('✅ Zeige Verband Dashboard für TDA Verband');
    return (
      <div className={`dashboard-container ${theme === 'tda-vib' ? 'dashboard-tda-vib' : ''}`}>
        <header className="dashboard-header">
          <div className="dashboard-header-left">
            <img src={logo} alt="DojoSoftware Logo" className="dashboard-logo dojo-software-logo" />
            <h2>🌐 TDA Verband</h2>
            <span className="version-badge">v{config.app.version}</span>
          </div>
          <div className="dashboard-header-right">
            <DojoSwitcher />
            {/* 💬 Chat-Icon */}
            <button
              onClick={() => navigate('/dashboard/chat')}
              className="logout-button chat-header-badge-wrap dashboard-chat-wrap"
              title="Chat"
            >
              <MessageCircle size={18} />
              {chatUnread > 0 && (
                <span className="chat-header-badge">{chatUnread > 99 ? '99+' : chatUnread}</span>
              )}
            </button>
            {/* 👤 User-Dropdown */}
            <div className="dashboard-user-wrap">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="logout-button dashboard-user-btn"
              >
                <span>👤</span>
                <span>{userDisplayName || 'User'}</span>
                <span className="dashboard-user-btn-arrow">▼</span>
              </button>
              {showUserMenu && (
                <div className="dashboard-user-dropdown">
                  <button onClick={toggleDarkMode} className="dashboard-menu-btn">
                    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                    <span>{isDarkMode ? 'Helles Theme' : 'Dunkles Theme'}</span>
                  </button>
                  <div className="dashboard-menu-row">
                    <span>🌐</span>
                    <LanguageSwitcher compact={true} showLabel={false} />
                  </div>
                  <button onClick={() => { setShowUserMenu(false); handleLogout(); }} className="dashboard-menu-btn danger">
                    <span>🚪</span>
                    <span>{t('header.logout')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="dashboard-main">
          <VerbandDashboard />
        </main>
      </div>
    );
  }

  // 🎫 Support Dashboard: Zeige Support-Ticketsystem (nur auf Haupt-Dashboard)
  if ((role === 'admin' || role === 'super_admin') && selectedDojo === 'support' && isMainDashboard) {
    console.log('✅ Zeige Support Dashboard für Support Center');
    return (
      <div className={`dashboard-container ${theme === 'tda-vib' ? 'dashboard-tda-vib' : ''}`}>
        <header className="dashboard-header">
          <div className="dashboard-header-left">
            <img src={logo} alt="DojoSoftware Logo" className="dashboard-logo dojo-software-logo" />
            <h2>🎫 Support Center</h2>
            <span className="version-badge">v{config.app.version}</span>
          </div>
          <div className="dashboard-header-right">
            <DojoSwitcher />
            {/* 💬 Chat-Icon */}
            <button
              onClick={() => navigate('/dashboard/chat')}
              className="logout-button chat-header-badge-wrap dashboard-chat-wrap"
              title="Chat"
            >
              <MessageCircle size={18} />
              {chatUnread > 0 && (
                <span className="chat-header-badge">{chatUnread > 99 ? '99+' : chatUnread}</span>
              )}
            </button>
            {/* 👤 User-Dropdown */}
            <div className="dashboard-user-wrap">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="logout-button dashboard-user-btn"
              >
                <span>👤</span>
                <span>{userDisplayName || 'User'}</span>
                <span className="dashboard-user-btn-arrow">▼</span>
              </button>
              {showUserMenu && (
                <div className="dashboard-user-dropdown">
                  <button onClick={toggleDarkMode} className="dashboard-menu-btn">
                    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                    <span>{isDarkMode ? 'Helles Theme' : 'Dunkles Theme'}</span>
                  </button>
                  <div className="dashboard-menu-row">
                    <span>🌐</span>
                    <LanguageSwitcher compact={true} showLabel={false} />
                  </div>
                  <button onClick={() => { setShowUserMenu(false); handleLogout(); }} className="dashboard-menu-btn danger">
                    <span>🚪</span>
                    <span>{t('header.logout')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="dashboard-main">
          <SupportDashboard />
        </main>
      </div>
    );
  }

  // 🛍️ Shop Dashboard: TDA Shop + Dojo-Shop Verwaltung (nur auf Haupt-Dashboard)
  if ((role === 'admin' || role === 'super_admin') && selectedDojo === 'shop' && isMainDashboard) {
    return (
      <div className={`dashboard-container ${theme === 'tda-vib' ? 'dashboard-tda-vib' : ''}`}>
        <header className="dashboard-header">
          <div className="dashboard-header-left">
            <img src={logo} alt="DojoSoftware Logo" className="dashboard-logo dojo-software-logo" />
            <h2>🛍️ TDA Shop</h2>
            <span className="version-badge">v{config.app.version}</span>
          </div>
          <div className="dashboard-header-right">
            <DojoSwitcher />
            <div className="dashboard-user-wrap">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="logout-button dashboard-user-btn"
              >
                <span>👤</span>
                <span>{userDisplayName || 'User'}</span>
                <span className="dashboard-user-btn-arrow">▼</span>
              </button>
              {showUserMenu && (
                <div className="dashboard-user-dropdown">
                  <button onClick={toggleDarkMode} className="dashboard-menu-btn">
                    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                    <span>{isDarkMode ? 'Helles Theme' : 'Dunkles Theme'}</span>
                  </button>
                  <button onClick={() => { setShowUserMenu(false); handleLogout(); }} className="dashboard-menu-btn danger">
                    <span>🚪</span>
                    <span>{t('header.logout')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="dashboard-main">
          <ShopDashboard />
        </main>
      </div>
    );
  }

  return (
    <div className={`dashboard-container ${theme === 'tda-vib' ? 'dashboard-tda-vib' : ''}`}>
      {(role === 'admin' || role === 'super_admin' || role === 'eingeschraenkt') && <VisitorChatAlerts />}
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <img src={logo} alt="DojoSoftware Logo" className="dashboard-logo dojo-software-logo" />
          <h2>{headerTitle}</h2>
          <span className="version-badge">v{config.app.version}</span>
        </div>
        <div className="dashboard-header-right">
          {(role === 'admin' || role === 'super_admin') && <DojoSwitcher />}
          {(role === 'admin' || role === 'super_admin') && <StandortSwitcher />}
          {/* Zurück-Button - nutzt Browser History */}
          {!isMainDashboard && window.history.length > 1 && (
            <button
              onClick={() => navigate(-1)}
              className="logout-button"
              title="Zur vorherigen Seite"
            >
              ← Zurück
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
          {/* 💬 Chat-Icon */}
          <button
            onClick={() => navigate('/dashboard/chat')}
            className="logout-button chat-header-badge-wrap dashboard-chat-wrap"
            title="Chat"
          >
            <MessageCircle size={18} />
            {chatUnread > 0 && (
              <span className="chat-header-badge">{chatUnread > 99 ? '99+' : chatUnread}</span>
            )}
          </button>
          {/* 🌐 Besucher-Chat-Icon (für Admin/Super-Admin/Eingeschränkt) */}
          {(role === 'admin' || role === 'super_admin' || role === 'eingeschraenkt') && (
            <button
              onClick={() => navigate('/dashboard/besucher-chat')}
              className="logout-button chat-header-badge-wrap dashboard-chat-wrap"
              title="Besucher-Chat"
            >
              🌐
            </button>
          )}
          {/* 👤 User-Modal */}
          <div className="dashboard-user-wrap">
            <button
              onClick={() => { console.log('👤 USER BUTTON GEKLICKT, showUserMenu:', showUserMenu); setShowUserMenu(!showUserMenu); }}
              className="logout-button dashboard-user-btn"
            >
              <span>👤</span>
              <span>{userDisplayName || 'User'}</span>
              <ChevronDown size={13} className={`dashboard-user-chevron${showUserMenu ? ' open' : ''}`} />
            </button>
          </div>

          {showUserMenu && createPortal(
            <>
              <div className="um-overlay" onClick={() => setShowUserMenu(false)} />
              <div className="um-modal">
                <div className="um-header">
                  <div className="um-avatar">👤</div>
                  <div className="um-info">
                    <div className="um-name">{userDisplayName || 'User'}</div>
                    <div className="um-role">{role}</div>
                  </div>
                  <button className="um-close" onClick={() => setShowUserMenu(false)}>
                    <X size={15} />
                  </button>
                </div>

                <div className="um-body">
                  <button className="um-btn" onClick={toggleDarkMode}>
                    {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
                    <span>{isDarkMode ? 'Helles Theme' : 'Dunkles Theme'}</span>
                  </button>

                  <div className="um-lang-row">
                    <span className="um-lang-label">🌐 Sprache</span>
                    <div className="um-lang-flags">
                      {[{ code: 'de', flag: '🇩🇪' }, { code: 'en', flag: '🇺🇸' }, { code: 'it', flag: '🇮🇹' }].map(l => (
                        <button
                          key={l.code}
                          className={`um-lang-flag${i18n.language === l.code ? ' active' : ''}`}
                          onClick={() => i18n.changeLanguage(l.code)}
                          title={l.code.toUpperCase()}
                        >
                          {l.flag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="um-footer">
                  <button
                    className="um-logout"
                    onClick={() => { console.log('🚪 PORTAL LOGOUT GEKLICKT'); setShowUserMenu(false); handleLogout(); }}
                  >
                    <LogOut size={16} />
                    <span>{t('header.logout')}</span>
                  </button>
                </div>
              </div>
            </>,
            document.body
          )}
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
                    className="btn btn-neutral btn-small u-ml-1"
                  >
                    🔄 Erneut versuchen
                  </button>
                </div>
              )}

              {/* 🔔 Trial/Subscription Banner */}
              <TrialBanner stats={stats} />

              {/* 📊 Cockpit-Übersicht: Heute & diese Woche */}
              {(role === 'admin' || role === 'super_admin') && <CockpitUebersicht />}

              {/* Navigation basierend auf Rolle */}
              {role === 'admin' && (
                <>
                  {/* Tab Navigation */}
                  <div className="dashboard-tabs">
                    {tabs.map(tab => (
                      <button
                        key={tab.id}
                        className={`dashboard-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => { setActiveTab(tab.id); setHilfeSupportView(null); setEinstellungenView(null); }}
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
                            onClick={() => window.open('https://checkin.dojo.tda-intl.org', '_blank')}
                            className="nav-card clickable featured"
                          >
                            <div className="nav-badge">TRAINER</div>
                            <div className="nav-content">
                              <div className="nav-card-header">
                                <span className="nav-icon">🔗</span>
                                <h3>Trainer Check-in App</h3>
                              </div>
                              <p>checkin.dojo.tda-intl.org öffnen</p>
                            </div>
                            <div className="nav-arrow">↗</div>
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
                        {mitgliederCards.filter(card => !card.superAdminOnly || isSuperAdmin).map((card, index) => (
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

                      {/* 🏛️ Hall of Fame Tab */}
                      {activeTab === 'hof' && (
                        <div className="content-card">
                          <HofDashboard />
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

                      {/* ✨ Kommunikation & Marketing Tab ✨ */}
                      {activeTab === 'kommunikation' && (
                        <div className="nav-cards">
                        {kommunikationCards.map((card, index) => (
                          <div
                            key={index}
                            onClick={() => {
                              if (card.action === 'msg-app') {
                                const dojoParam = selectedDojo?.id ? `&dojo_id=${selectedDojo.id}` : '';
                                const msgUrl = `https://msg.dojo.tda-intl.org/?token=${token}${dojoParam}`;
                                window.open(msgUrl, '_blank');
                              } else {
                                handleNavigation(card.path);
                              }
                            }}
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

                      {/* ✨ Shop & Kasse Tab ✨ */}
                      {activeTab === 'shop' && (
                        <div className="nav-cards">
                        {shopCards.map((card, index) => (
                          <div
                            key={index}
                            onClick={() => handleNavigation(card.path)}
                            className={`nav-card clickable ${card.featured ? 'featured' : ''}`}
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
                              <div className={`nav-badge ${card.badge === 'NEU' ? 'new' : card.badge === 'ENTERPRISE' ? 'enterprise' : 'live'}`}>
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
                        <div className="nav-section">
                          {einstellungenView === 'info' ? (
                            <>
                              <button
                                onClick={() => setEinstellungenView(null)}
                                className="quick-action-btn info u-mb-1"
                              >
                                ← Zurück
                              </button>
                              <h2 className="section-header">ℹ️ {t('info.title')}</h2>
                              <div className="dashboard-info-grid">
                                <div className="dashboard-info-box no-padding">
                                  <AgbStatusWidget />
                                </div>
                                <div className="dashboard-info-box">
                                  <h3>📊 {t('info.dojoStats')}</h3>
                                  <div className="dashboard-stat-grid">
                                    <div className="dashboard-stat-box primary">
                                      <div className="dashboard-stat-value">{formatNumber(stats.mitglieder)}</div>
                                      <div className="dashboard-stat-label">{t('info.members')}</div>
                                    </div>
                                    <div className="dashboard-stat-box indigo">
                                      <div className="dashboard-stat-value">{formatNumber(stats.kurse)}</div>
                                      <div className="dashboard-stat-label">{t('info.courses')}</div>
                                    </div>
                                    <div className="dashboard-stat-box success">
                                      <div className="dashboard-stat-value">{formatNumber(stats.trainer)}</div>
                                      <div className="dashboard-stat-label">{t('info.trainers')}</div>
                                    </div>
                                    <div className="dashboard-stat-box pink">
                                      <div className="dashboard-stat-value">{formatNumber(stats.checkins_heute)}</div>
                                      <div className="dashboard-stat-label">{t('info.checkinsToday')}</div>
                                    </div>
                                  </div>
                                </div>
                                <div className="dashboard-info-box">
                                  <h3>⚙️ {t('info.system')}</h3>
                                  <div className="dashboard-info-rows">
                                    <div className="dashboard-info-row">
                                      <span className="dashboard-info-row-label">{t('info.version')}</span>
                                      <span className="dashboard-info-row-value">v{config.app.version}</span>
                                    </div>
                                    <div className="dashboard-info-row">
                                      <span className="dashboard-info-row-label">{t('info.build')}</span>
                                      <span>{config.app.buildDate}</span>
                                    </div>
                                    <div className="dashboard-info-row">
                                      <span className="dashboard-info-row-label">{t('info.developer')}</span>
                                      <span>{config.app.author}</span>
                                    </div>
                                    <div className="dashboard-info-row">
                                      <span className="dashboard-info-row-label">{t('info.support')}</span>
                                      <a href={`mailto:${config.app.contactEmail}`} className="u-text-accent">{config.app.contactEmail}</a>
                                    </div>
                                  </div>
                                </div>
                                <div className="dashboard-info-box full-width transparent">
                                  <SystemChangelog maxItems={3} isAdmin={user?.role === 'admin' || user?.rolle === 'admin'} />
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="nav-cards">
                              {einstellungenCards.map((card, index) => (
                                <div
                                  key={index}
                                  onClick={() => card.action ? setEinstellungenView(card.action) : handleNavigation(card.path)}
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
                      )}

                      {/* ✨ Schnellaktionen Tab ✨ */}
                      {activeTab === 'schnellaktionen' && (
                        <div className="nav-section">
                          <h2 className="section-header quick-actions-header">
                            <span className="quick-actions-icon">⚡</span>
                            <span>{t('quickActions.title')}</span>
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
                          <div className="dashboard-refresh-wrap">
                            <button
                              onClick={fetchDashboardStatsOptimized}
                              className="quick-action-btn info"
                              disabled={loading}
                            >
                              🔄 {loading ? t('quickActions.loading') : t('quickActions.refreshStats')}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ❓ Hilfe & Support Tab ❓ */}
                      {activeTab === 'hilfe-support' && (
                        <div className="nav-section">
                          {!hilfeSupportView ? (
                            <div className="nav-cards">
                              {hilfeSupportCards.map((card, index) => (
                                <div
                                  key={index}
                                  onClick={() => setHilfeSupportView(card.action)}
                                  className="nav-card clickable featured"
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
                          ) : (
                            <>
                              <button
                                onClick={() => setHilfeSupportView(null)}
                                className="quick-action-btn info u-mb-1"
                              >
                                ← Zurück
                              </button>
                              {hilfeSupportView === 'hilfe' && <HilfeCenter />}
                              {hilfeSupportView === 'support' && <SupportTickets bereich="dojo" />}
                              {hilfeSupportView === 'wunschliste' && <FeatureBoard />}
                            </>
                          )}
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

      {/* Setup Wizard - Ersteinrichtung für neue Dojos */}
      {showSetupWizard && <SetupWizard onClose={() => setShowSetupWizard(false)} />}
    </div>
  );
}

export default Dashboard;
