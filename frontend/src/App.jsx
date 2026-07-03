// Frontend/src/App.jsx - OPTIMIERTE VERSION mit aggressivem Lazy Loading
import React, { Suspense, lazy, useEffect } from "react";
import "./styles/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";

// Authentifizierung & Context
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { KursProvider } from "./context/KursContext.jsx";
import { DojoProvider } from "./context/DojoContext.jsx";
import { StandortProvider } from "./context/StandortContext.jsx";
import { MitgliederUpdateProvider } from "./context/MitgliederUpdateContext.jsx";
import { SubscriptionProvider } from "./context/SubscriptionContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { ChatProvider } from "./context/ChatContext.jsx";
import { DatenProvider } from "@shared/DatenContext.jsx";

// AGB-Bestaetigung Wrapper
import AgbConfirmationWrapper from "./components/AgbConfirmationWrapper";

// API Health Check - Zeigt Wartungsmeldung wenn Backend nicht erreichbar
import ApiHealthCheck from "./components/ApiHealthCheck";

// Update-Banner — zeigt "Neue Version verfügbar" wenn ein Deploy gelaufen ist
import UpdateBanner from "./components/UpdateBanner";

// Auto-reload on stale chunk 404 (happens after deployments with cached index.html)
const lazyWithReload = (importFn) => {
  return lazy(() =>
    importFn().catch((err) => {
      const isChunkError =
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('Importing a module script failed') ||
        err?.message?.includes('Loading chunk') ||
        err?.name === 'ChunkLoadError';
      if (isChunkError && !sessionStorage.getItem('chunk_reload_attempted')) {
        sessionStorage.setItem('chunk_reload_attempted', '1');
        window.location.reload();
        return new Promise(() => {}); // prevent further error propagation
      }
      throw err;
    })
  );
};

// ============================================================================
// SOFORT GELADEN - Kritisch für Initial Load
// ============================================================================
import Login from "./components/Login";
import MitgliederLogin from "./components/MitgliederLogin";
import ClubMemberLogin from "./components/ClubMemberLogin";
import CheckinLogin from "./components/CheckinLogin";
import SSOLogin from "./components/SSOLogin";
import LandingPage from "./pages/LandingPage";
import SupportPortal from "./components/SupportPortal";

// ============================================================================
// LAZY LOADED - Dashboard & Hauptbereiche
// ============================================================================
const Dashboard = lazyWithReload(() => import(/* webpackChunkName: "dashboard" */ "./components/Dashboard"));
const PasswordReset = lazyWithReload(() => import(/* webpackChunkName: "auth" */ "./components/PasswordReset"));
const VerifyEmail = lazyWithReload(() => import(/* webpackChunkName: "auth" */ "./components/VerifyEmail"));
const DashboardTdaVib = lazyWithReload(() => import(/* webpackChunkName: "dashboard-tda" */ "./components/DashboardTdaVib"));
const DashboardStart = lazyWithReload(() => import(/* webpackChunkName: "dashboard-start" */ "./components/DashboardStart"));

// ============================================================================
// LAZY LOADED - Mitglieder-Management
// ============================================================================
const MitgliederListe = lazyWithReload(() => import(/* webpackChunkName: "members" */ "./components/MitgliederListe"));
const MitgliedDetail = lazyWithReload(() => import(/* webpackChunkName: "member-detail" */ "./components/MitgliedDetail"));
const MitgliedDetailShared = lazyWithReload(() => import(/* webpackChunkName: "member-detail-shared" */ "./components/MitgliedDetailShared"));
const EhemaligenListe = lazyWithReload(() => import(/* webpackChunkName: "members" */ "./components/EhemaligenListe"));
const InteressentenListe = lazyWithReload(() => import(/* webpackChunkName: "members" */ "./components/InteressentenListe"));
const MitgliederFilter = lazyWithReload(() => import(/* webpackChunkName: "members" */ "./components/MitgliederFilter"));

// ============================================================================
// LAZY LOADED - Anwesenheit & Check-In
// ============================================================================
const Anwesenheit = lazyWithReload(() => import(/* webpackChunkName: "attendance" */ "./components/Anwesenheit"));
const AnwesenheitDashboard = lazyWithReload(() => import(/* webpackChunkName: "attendance" */ "./components/AnwesenheitDashboard"));
const CheckinSystem = lazyWithReload(() => import(/* webpackChunkName: "checkin" */ "./components/CheckinSystem"));
const PersonalCheckin = lazyWithReload(() => import(/* webpackChunkName: "checkin" */ "./components/PersonalCheckin"));
const PublicCheckinDisplay = lazyWithReload(() => import(/* webpackChunkName: "public" */ "./components/PublicCheckinDisplay"));
const TimerExternDisplay = lazyWithReload(() => import(/* webpackChunkName: "public" */ "./components/TimerExternDisplay"));

// ============================================================================
// LAZY LOADED - Kurse & Stundenplan
// ============================================================================
const Stundenplan = lazyWithReload(() => import(/* webpackChunkName: "courses" */ "./components/Stundenplan"));
const Kurse = lazyWithReload(() => import(/* webpackChunkName: "courses" */ "./components/Kurse"));
const Trainer = lazyWithReload(() => import(/* webpackChunkName: "courses" */ "./components/Trainer"));
const TrainerStunden = lazyWithReload(() => import(/* webpackChunkName: "courses" */ "./components/TrainerStunden"));
const GruppenStilverwaltung = lazyWithReload(() => import(/* webpackChunkName: "courses" */ "./components/GruppenStilverwaltung"));
const Stilverwaltung = lazyWithReload(() => import(/* webpackChunkName: "styles" */ "./components/Stilverwaltung"));
const StandortVerwaltung = lazyWithReload(() => import(/* webpackChunkName: "settings" */ "./components/StandortVerwaltung"));
const PublicTimetableDisplay = lazyWithReload(() => import(/* webpackChunkName: "public" */ "./components/PublicTimetableDisplay"));
const PublicWerbeDisplay = lazyWithReload(() => import(/* webpackChunkName: "public" */ "./components/PublicWerbeDisplay"));
const DisplayVerwaltung = lazyWithReload(() => import(/* webpackChunkName: "settings" */ "./components/DisplayVerwaltung"));

// ============================================================================
// LAZY LOADED - Finanzen & Beiträge
// ============================================================================
const Finanzcockpit = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./components/Finanzcockpit"));
const BuchhaltungPage = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./pages/BuchhaltungPage"));
const EuerUebersicht = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./components/EuerUebersicht"));
const AusgabenVerwaltung = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./components/AusgabenVerwaltung"));
const KontoauszugImport = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./components/KontoauszugImport"));
const Jahresuebersicht = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./components/Jahresuebersicht"));
const RuecklastschriftVerwaltung = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./components/RuecklastschriftVerwaltung"));
const LastschriftEinverstaendnis = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./components/LastschriftEinverstaendnis"));
const VorlagenVerwaltung = lazyWithReload(() => import(/* webpackChunkName: "vorlagen" */ "./components/VorlagenVerwaltung"));
const Beitraege = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./components/Beitraege"));
const Mahnwesen = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./components/Mahnwesen"));
const OffeneZahlungen = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./components/OffeneZahlungen"));
const MahnstufenEinstellungen = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./components/MahnstufenEinstellungen"));
const Rechnungsverwaltung = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./components/Rechnungsverwaltung"));
const RechnungErstellen = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./components/RechnungErstellen"));
const SepaMandateVerwaltung = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./components/SepaMandateVerwaltung"));
const LastschriftManagement = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./components/LastschriftManagement"));
const Lastschriftlauf = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./components/Lastschriftlauf"));
const TarifePreise = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./components/TarifePreise"));
const Rabattsystem = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./components/Rabattsystem"));
const ZahlungszyklenSeite = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./components/ZahlungszyklenSeite"));
const ZahlungsEinstellungen = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./components/ZahlungsEinstellungen"));

// ============================================================================
// LAZY LOADED - Verkauf & Artikel
// ============================================================================
const TresenUebersicht = lazyWithReload(() => import(/* webpackChunkName: "sales" */ "./components/TresenUebersicht"));
const ArtikelVerwaltung = lazyWithReload(() => import(/* webpackChunkName: "sales" */ "./components/ArtikelVerwaltung"));
const ArtikelFormular = lazyWithReload(() => import(/* webpackChunkName: "sales" */ "./components/ArtikelFormular"));
const VerkaufKasse = lazyWithReload(() => import(/* webpackChunkName: "sales" */ "./components/VerkaufKasse"));
const ArtikelgruppenVerwaltung = lazyWithReload(() => import(/* webpackChunkName: "sales" */ "./components/ArtikelgruppenVerwaltung"));
const ShopBestellungenVerwaltung = lazyWithReload(() => import(/* webpackChunkName: "sales" */ "./components/shop/ShopBestellungenVerwaltung"));
const OffeneArtikelEinzuege = lazyWithReload(() => import(/* webpackChunkName: "sales" */ "./components/OffeneArtikelEinzuege"));
const GutscheineVerwaltung = lazyWithReload(() => import(/* webpackChunkName: "sales" */ "./components/GutscheineVerwaltung"));
const KiChatEinstellungen = lazyWithReload(() => import(/* webpackChunkName: "integrations" */ "./components/KiChatEinstellungen"));

// ============================================================================
// LAZY LOADED - Member-Bereich
// ============================================================================
const MemberDashboard = lazyWithReload(() => import(/* webpackChunkName: "member-area" */ "./components/MemberDashboard"));
const ChatPage = lazyWithReload(() => import(/* webpackChunkName: "member-chat" */ "./components/chat/ChatPage"));
const AdminChatPage = lazyWithReload(() => import(/* webpackChunkName: "admin-chat" */ "./components/chat/AdminChatPage"));
const BesucherChat = lazyWithReload(() => import(/* webpackChunkName: "besucher-chat" */ "./components/chat/BesucherChat"));
const MemberHeader = lazyWithReload(() => import(/* webpackChunkName: "member-area" */ "./components/MemberHeader"));
const MemberProfilePage = lazyWithReload(() => import(/* webpackChunkName: "member-area" */ "./components/MemberProfilePage"));
const MemberSchedule = lazyWithReload(() => import(/* webpackChunkName: "member-area" */ "./components/MemberSchedule"));
const MemberEvents = lazyWithReload(() => import(/* webpackChunkName: "member-area" */ "./components/MemberEvents"));
const MemberPayments = lazyWithReload(() => import(/* webpackChunkName: "member-area" */ "./components/MemberPayments"));
const MemberStats = lazyWithReload(() => import(/* webpackChunkName: "member-area" */ "./components/MemberStats"));
const MemberCommunityPage = lazyWithReload(() => import(/* webpackChunkName: "member-area" */ "./components/MemberCommunityPage"));
const MemberStyles = lazyWithReload(() => import(/* webpackChunkName: "member-area" */ "./components/MemberStyles"));
const CourseRating = lazyWithReload(() => import(/* webpackChunkName: "member-area" */ "./components/CourseRating"));
const EquipmentChecklist = lazyWithReload(() => import(/* webpackChunkName: "member-area" */ "./components/EquipmentChecklist"));
const AppInstallPage = lazyWithReload(() => import(/* webpackChunkName: "member-area" */ "./pages/AppInstallPage"));

// ============================================================================
// LAZY LOADED - Trainer-Bereich
// ============================================================================
const TrainerDashboard = lazyWithReload(() => import(/* webpackChunkName: "trainer" */ "./components/TrainerDashboard"));
const TrainerOnlyRoute = lazyWithReload(() => import(/* webpackChunkName: "trainer" */ "./components/TrainerOnlyRoute"));
const CourseRatingAdmin = lazyWithReload(() => import(/* webpackChunkName: "trainer" */ "./components/CourseRatingAdmin"));

// ============================================================================
// LAZY LOADED - Admin-Verwaltung
// ============================================================================
const Personal = lazyWithReload(() => import(/* webpackChunkName: "admin" */ "./components/TrainerPersonal"));
const EinstellungenDojo = lazyWithReload(() => import(/* webpackChunkName: "admin" */ "./components/EinstellungenDojo"));
const CheckinEinstellungen = lazyWithReload(() => import(/* webpackChunkName: "admin" */ "./components/CheckinEinstellungen"));
const ProbetrainingIntegration = lazyWithReload(() => import(/* webpackChunkName: "admin" */ "./components/ProbetrainingIntegration"));
const ThemeEinstellungen = lazyWithReload(() => import(/* webpackChunkName: "admin" */ "./components/ThemeEinstellungen"));
const AuditLog = lazyWithReload(() => import(/* webpackChunkName: "admin" */ "./components/AuditLog"));
const SecurityDashboard = lazyWithReload(() => import(/* webpackChunkName: "admin" */ "./components/SecurityDashboard"));
const BuddyVerwaltung = lazyWithReload(() => import(/* webpackChunkName: "admin" */ "./components/BuddyVerwaltung"));
const FreundeWerbenFreunde = lazyWithReload(() => import(/* webpackChunkName: "admin" */ "./components/FreundeWerbenFreunde"));
const MarketingZentrale = lazyWithReload(() => import(/* webpackChunkName: "marketing" */ "./components/MarketingZentrale"));
const UmfragenDashboard = lazyWithReload(() => import(/* webpackChunkName: "umfragen" */ "./components/UmfragenDashboard"));
const Auswertungen = lazyWithReload(() => import(/* webpackChunkName: "admin" */ "./components/Auswertungen"));
const GuertelMassenzuweisung = lazyWithReload(() => import(/* webpackChunkName: "admin" */ "./components/GuertelMassenzuweisung"));
const BerichteDokumente = lazyWithReload(() => import(/* webpackChunkName: "admin" */ "./components/BerichteDokumente"));
const DojosVerwaltung = lazyWithReload(() => import(/* webpackChunkName: "admin" */ "./components/DojosVerwaltung"));
const DojoEdit = lazyWithReload(() => import(/* webpackChunkName: "admin" */ "./components/DojoEdit"));
const DokumenteVerwaltung = lazyWithReload(() => import(/* webpackChunkName: "documents" */ "./components/DokumenteVerwaltung"));
const DokumentenZentrale = lazyWithReload(() => import(/* webpackChunkName: "documents" */ "./components/DokumentenZentrale"));
const NotificationSystem = lazyWithReload(() => import(/* webpackChunkName: "notifications" */ "./components/NotificationSystem"));
const PruefungsVerwaltung = lazyWithReload(() => import(/* webpackChunkName: "exams" */ "./components/PruefungsVerwaltung"));
const PruefungDurchfuehren = lazyWithReload(() => import(/* webpackChunkName: "exams" */ "./components/PruefungDurchfuehren"));
const UrkundenVorlagenEditor = lazyWithReload(() => import(/* webpackChunkName: "exams" */ "./components/UrkundenVorlagenEditor"));
const FunktionsUebersicht = lazyWithReload(() => import(/* webpackChunkName: "help" */ "./components/FunktionsUebersicht"));
const BadgeAdminOverview = lazyWithReload(() => import(/* webpackChunkName: "badges" */ "./components/BadgeAdminOverview"));
const PasswortVerwaltung = lazyWithReload(() => import(/* webpackChunkName: "admin" */ "./components/PasswortVerwaltung"));
const DojoLizenzverwaltung = lazyWithReload(() => import(/* webpackChunkName: "admin" */ "./components/DojoLizenzverwaltung"));

// ============================================================================
// LAZY LOADED - Support-Ticketsystem & Feature Board
// ============================================================================
const SupportTickets = lazyWithReload(() => import(/* webpackChunkName: "support" */ "./components/SupportTickets"));
const FeatureBoard = lazyWithReload(() => import(/* webpackChunkName: "support" */ "./components/FeatureBoard"));

// ============================================================================
// LAZY LOADED - Verband Dashboard
// ============================================================================
const VerbandDashboard = lazyWithReload(() => import(/* webpackChunkName: "verband" */ "./components/VerbandDashboard"));

// ============================================================================
// LAZY LOADED - Integrations (Webhooks, PayPal, LexOffice, DATEV)
// ============================================================================
const WebhookVerwaltung = lazyWithReload(() => import(/* webpackChunkName: "integrations" */ "./components/WebhookVerwaltung"));
const IntegrationsEinstellungen = lazyWithReload(() => import(/* webpackChunkName: "integrations" */ "./components/IntegrationsEinstellungen"));
const DatevExport = lazyWithReload(() => import(/* webpackChunkName: "integrations" */ "./components/DatevExport"));
const SteuerAssistent = lazyWithReload(() => import(/* webpackChunkName: "finance" */ "./components/SteuerAssistent"));
const KalenderAbo = lazyWithReload(() => import(/* webpackChunkName: "member-area" */ "./components/KalenderAbo"));
const KalenderZentrale = lazyWithReload(() => import(/* webpackChunkName: "kalender" */ "./components/KalenderZentrale"));

// ============================================================================
// LAZY LOADED - Payment Checkout
// ============================================================================
const PaymentCheckout = lazyWithReload(() => import(/* webpackChunkName: "payment" */ "./components/PaymentCheckout"));
const EventPaymentCheckout = lazyWithReload(() => import(/* webpackChunkName: "payment" */ "./components/EventPaymentCheckout"));
const MemberRechnungCheckout = lazyWithReload(() => import(/* webpackChunkName: "payment" */ "./components/MemberRechnungCheckout"));
const EventsDashboard = lazyWithReload(() => import(/* webpackChunkName: "events" */ "./components/EventsDashboard"));

// ============================================================================
// LAZY LOADED - Turnierverwaltung & Lernplattform
// ============================================================================
const Turnierverwaltung = lazyWithReload(() => import(/* webpackChunkName: "turniere" */ "./components/Turnierverwaltung"));
const Lernplattform = lazyWithReload(() => import(/* webpackChunkName: "lernplattform" */ "./pages/LernplattformPage"));
const ElternZugaenge = lazyWithReload(() => import(/* webpackChunkName: "eltern" */ "./components/ElternZugaenge"));
const ElternPortal = lazyWithReload(() => import(/* webpackChunkName: "eltern" */ "./components/ElternPortal"));
const HomepageDashboard = lazyWithReload(() => import(/* webpackChunkName: "homepage-builder" */ "./components/HomepageDashboard"));
const DojoSite = lazyWithReload(() => import(/* webpackChunkName: "dojo-site" */ "./components/DojoSite"));

// ============================================================================
// LAZY LOADED - Events & News
// ============================================================================
const Events = lazyWithReload(() => import(/* webpackChunkName: "events" */ "./components/Events"));
const MeineEvents = lazyWithReload(() => import(/* webpackChunkName: "events" */ "./components/MeineEvents"));
const NewsVerwaltung = lazyWithReload(() => import(/* webpackChunkName: "news" */ "./components/NewsVerwaltung"));
const NewsFormular = lazyWithReload(() => import(/* webpackChunkName: "news" */ "./components/NewsFormular"));

// ============================================================================
// LAZY LOADED - Public & Registration
// ============================================================================
const Homepage = lazyWithReload(() => import(/* webpackChunkName: "public" */ "./components/Homepage"));
const PublicRegistration = lazyWithReload(() => import(/* webpackChunkName: "public" */ "./components/PublicRegistration"));
const BuddyInviteRegistration = lazyWithReload(() => import(/* webpackChunkName: "public" */ "./components/BuddyInviteRegistration"));
const LastschriftZustimmung = lazyWithReload(() => import(/* webpackChunkName: "public" */ "./pages/LastschriftZustimmung"));
const VerbandMitgliedWerden = lazyWithReload(() => import(/* webpackChunkName: "public" */ "./components/VerbandMitgliedWerden"));
const ProbetrainingBuchung = lazyWithReload(() => import(/* webpackChunkName: "public" */ "./pages/ProbetrainingBuchung"));
const PublicProbetrainingTermin = lazyWithReload(() => import(/* webpackChunkName: "public" */ "./pages/PublicProbetrainingTermin"));
const DemoBuchung = lazyWithReload(() => import(/* webpackChunkName: "public" */ "./pages/DemoBuchung"));
const PilotFeedback = lazyWithReload(() => import(/* webpackChunkName: "public" */ "./pages/PilotFeedback"));
const EventGastAnmeldung = lazyWithReload(() => import(/* webpackChunkName: "public" */ "./components/EventGastAnmeldung"));
const GutscheinShop = lazyWithReload(() => import(/* webpackChunkName: "gutschein-shop" */ "./pages/GutscheinShop"));
const PublicShop = lazyWithReload(() => import(/* webpackChunkName: "shop" */ "./pages/shop/PublicShop"));
const PublicShopWarenkorb = lazyWithReload(() => import(/* webpackChunkName: "shop" */ "./pages/shop/PublicShopWarenkorb"));
const PublicShopCheckout = lazyWithReload(() => import(/* webpackChunkName: "shop" */ "./pages/shop/PublicShopCheckout"));
const PublicShopBestaetigung = lazyWithReload(() => import(/* webpackChunkName: "shop" */ "./pages/shop/PublicShopBestaetigung"));
const MagicLineImport = lazyWithReload(() => import(/* webpackChunkName: "import" */ "./pages/MagicLineImport"));
const CSVImport = lazyWithReload(() => import(/* webpackChunkName: "import" */ "./pages/CSVImport"));

// ============================================================================
// LAZY LOADED - Marketing Pages
// ============================================================================
const PricingPage = lazyWithReload(() => import(/* webpackChunkName: "marketing" */ "./pages/PricingPage"));
const RegisterPage = lazyWithReload(() => import(/* webpackChunkName: "marketing" */ "./pages/RegisterPage"));
const ContactPage = lazyWithReload(() => import(/* webpackChunkName: "marketing" */ "./pages/ContactPage"));
const ImpressumPage = lazyWithReload(() => import(/* webpackChunkName: "marketing" */ "./pages/ImpressumPage"));
const AboutPage = lazyWithReload(() => import(/* webpackChunkName: "marketing" */ "./pages/AboutPage"));
const DatenschutzPage = lazyWithReload(() => import(/* webpackChunkName: "marketing" */ "./pages/DatenschutzPage"));
const AGBPage = lazyWithReload(() => import(/* webpackChunkName: "marketing" */ "./pages/AGBPage"));
const WiderrufsPage = lazyWithReload(() => import(/* webpackChunkName: "marketing" */ "./pages/WiderrufsPage"));
const HelpPage = lazyWithReload(() => import(/* webpackChunkName: "marketing" */ "./pages/HelpPage"));
const GaleriePage = lazyWithReload(() => import(/* webpackChunkName: "marketing" */ "./pages/GaleriePage"));
const DemoPage = lazyWithReload(() => import(/* webpackChunkName: "marketing" */ "./pages/DemoPage"));

// Loading Fallback für Lazy-Loaded Komponenten
const LazyLoadFallback = () => (
  <div className="app-lazy-fallback">
    <div className="loading-spinner"></div>
  </div>
);

// Protected Route Komponente mit AuthContext
const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();

  // 🔧 DEV BYPASS - NUR im echten Dev-Modus aktiv. import.meta.env.DEV ist im
  // Production-Build IMMER false → Bypass kann live niemals greifen, egal welche .env.
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS === 'true') {
    return loading ? (
      <div className="app-loading-screen">
        <div className="loading-spinner-large"></div>
        <div>Authentifizierung wird geprüft...</div>
      </div>
    ) : children;
  }

  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="loading-spinner-large"></div>
        <div>Authentifizierung wird gepr�ft...</div>
      </div>
    );
  }

  if (!token) {
    console.log('Kein Token gefunden, Weiterleitung zu Login');
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Dashboard 404 - redirects members back, shows styled error for admins
const DashboardNotFound = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role || user?.rolle || 'member';

  if (role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="app-not-found-container">
      <h2>Seite nicht gefunden</h2>
      <p>Die angeforderte Dashboard-Seite existiert nicht.</p>
      <button
        onClick={() => navigate('/dashboard')}
        className="app-not-found-btn"
      >
        Zum Dashboard
      </button>
    </div>
  );
};

// Admin-Only Route - Redirects members to their member area
const AdminOnlyRoute = ({ children }) => {
  const { token, user, loading } = useAuth();

  // Dev-Bypass: NUR im echten Dev-Modus (import.meta.env.DEV) — Prod-Build = immer false
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS === 'true') {
    return loading ? (
      <div className="app-loading-screen">
        <div className="loading-spinner-large"></div>
        <div>Authentifizierung wird geprüft...</div>
      </div>
    ) : children;
  }

  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="loading-spinner-large"></div>
        <div>Authentifizierung wird geprüft...</div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Redirect members to their member area
  if (user?.role === 'member' || user?.role === 'mitglied') {
    return <Navigate to="/member/dashboard" replace />;
  }

  return children;
};

// Member-Only Route - Only allows users with 'member' role
const MemberOnlyRoute = ({ children }) => {
  const { token, user, loading } = useAuth();

  // Washi-Light-Theme für alle Member-Seiten erzwingen
  useEffect(() => {
    const root = document.documentElement;
    const prevTheme = root.getAttribute('data-theme') || 'midnight';
    const prevBodyBg = document.body.style.backgroundColor;
    root.setAttribute('data-theme', 'tda-vib');
    document.body.style.backgroundColor = '#f7f7f8';
    return () => {
      root.setAttribute('data-theme', prevTheme);
      document.body.style.backgroundColor = prevBodyBg;
    };
  }, []);

  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="loading-spinner-large"></div>
        <div>Authentifizierung wird geprüft...</div>
      </div>
    );
  }

  if (!token) {
    console.log('Kein Token gefunden, Weiterleitung zu Login');
    return <Navigate to="/login" replace />;
  }

  // Redirect admins to their dashboard
  if (user?.role === 'admin') {
    console.log('Admin versucht auf Member-Route zuzugreifen, Weiterleitung zu Dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Root Redirect basierend auf Authentifizierungsstatus
// Login Route Handler - Subdomain-basiert
const LoginRouteHandler = () => {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');

  // Prüfe ob es eine Dojo-Subdomain ist
  const isDojoSubdomain = () => {
    // Bei localhost: subdomain.localhost
    if (hostname.includes('localhost')) {
      return parts.length > 1 && parts[0] !== 'localhost';
    }

    // Bei Production: subdomain.dojo.tda-intl.org
    // parts[0] = subdomain, parts[1] = dojo, parts[2] = tda-intl, parts[3] = org
    if (parts.length === 4 && parts[1] === 'dojo') {
      // Ignoriere www als Subdomain
      return parts[0] !== 'www';
    }

    return false;
  };

  // Member-App (app.tda-vib.de) → ClubMemberLogin (schlichter Mitglieder-Login)
  if (hostname === 'app.tda-vib.de') {
    return <ClubMemberLogin />;
  }

  // Check-In App (checkin.tda-intl.org) → CheckinLogin (Trainer-Login direkt zum CheckinSystem)
  if (hostname === 'checkin.tda-intl.org' || hostname === 'checkin.dojo.tda-intl.org') {
    return <CheckinLogin />;
  }

  // Admin-Subdomains → normales Admin-Login (kein ClubMemberLogin)
  if (hostname === 'support.tda-intl.org' || hostname === 'finanzen.tda-intl.org') {
    return <Login />;
  }

  // Wenn Dojo-Subdomain (z.B. demo1.dojo.tda-intl.org, dojo-3.dojo.tda-intl.org) → ClubMemberLogin
  // Sonst (dojo.tda-intl.org) → normales Login
  return isDojoSubdomain() ? <ClubMemberLogin /> : <Login />;
};

const RootRedirect = () => {
  const { token, user, loading } = useAuth();

  if (loading) {
    return <div>Lade...</div>;
  }

  const hostname = window.location.hostname;

  // Member-App (app.tda-vib.de) → immer Member-Bereich
  if (hostname === 'app.tda-vib.de') {
    if (!token) return <Navigate to="/login" replace />;
    return <Navigate to="/member/dashboard" replace />;
  }

  // Check-In App (checkin.tda-intl.org oder checkin.dojo.tda-intl.org) → direkt zur CheckinApp
  if (hostname === 'checkin.tda-intl.org' || hostname === 'checkin.dojo.tda-intl.org') {
    if (!token) return <Navigate to="/login" replace />;
    return <Navigate to="/dashboard/checkin" replace />;
  }

  // Prüfe ob es eine Subdomain ist (nicht die Haupt-Domain)
  const isSubdomain = () => {
    // Subdomain wenn: xxx.dojo.tda-intl.org oder xxx.localhost
    const parts = hostname.split('.');
    if (hostname.includes('localhost')) {
      return parts.length > 1; // z.B. demo1.localhost
    }
    // Bei dojo.tda-intl.org: Subdomain wenn mehr als 3 Teile (xxx.dojo.tda-intl.org)
    return parts.length > 3;
  };

  // Wenn nicht eingeloggt
  if (!token) {
    // Admin-Subdomains → direkt zum Login
    if (hostname === 'support.tda-intl.org' || hostname === 'finanzen.tda-intl.org') {
      return <Navigate to="/login" replace />;
    }
    // Bei Subdomain → direkt zur Login-Seite
    if (isSubdomain()) {
      return <Navigate to="/login" replace />;
    }
    // Bei Haupt-Domain → Landing Page
    return <LandingPage />;
  }

  // Wenn eingeloggt, weiter zum Dashboard
  return <Navigate to="/dashboard" replace />;
};

// Screen Wake Lock: verhindert, dass das Display abschaltet solange die App geöffnet ist.
// Strategie 1: Wake Lock API (Chrome + Safari 16.4+)
// Strategie 2: Fallback für älteres iOS — winziges silent <video> das in Schleife läuft
function useWakeLock() {
  useEffect(() => {
    let lock = null;
    let videoEl = null;
    let intervalId = null;

    const acquireNative = async () => {
      if (!('wakeLock' in navigator)) return false;
      try {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
        return true;
      } catch (_) { return false; }
    };

    // iOS-Fallback: 0-Byte-Video in Schleife hält das Display wach
    const startVideoFallback = () => {
      if (videoEl) return;
      videoEl = document.createElement('video');
      videoEl.setAttribute('playsinline', '');
      videoEl.setAttribute('muted', '');
      videoEl.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
      // Minimal-MP4 (1×1px, 1s stumm) als Data-URI
      videoEl.src = '/keepawake.mp4';
      videoEl.loop = true;
      document.body.appendChild(videoEl);
      videoEl.play().catch(() => {});
    };

    const stopVideoFallback = () => {
      if (videoEl) { videoEl.pause(); videoEl.remove(); videoEl = null; }
    };

    const setup = async () => {
      const gotNative = await acquireNative();
      if (!gotNative) startVideoFallback();
    };

    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      if (lock) return; // noch aktiv
      const gotNative = await acquireNative();
      if (!gotNative) startVideoFallback();
    };

    // Ersten Versuch sofort + nach erstem Tap (iOS braucht User Gesture)
    setup();
    document.addEventListener('visibilitychange', onVisible);
    const onInteraction = () => { if (!lock && !videoEl) setup(); };
    document.addEventListener('touchstart', onInteraction, { once: true });
    document.addEventListener('click', onInteraction, { once: true });

    // Watchdog: alle 30s prüfen ob Lock noch aktiv
    intervalId = setInterval(() => { if (!lock && !videoEl) setup(); }, 30000);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(intervalId);
      lock?.release();
      stopVideoFallback();
    };
  }, []);
}

// Safari-Fix: input[type="date"] feuert onChange nicht zuverlässig bei nativer Datumsauswahl.
// Globaler input-Listener feuert ein synthetisches change-Event nach, das React aufgreift.
function useSafariDateFix() {
  useEffect(() => {
    const lastVal = new WeakMap();
    const handle = (e) => {
      const el = e.target;
      if (!el || el.tagName !== 'INPUT' || el.type !== 'date') return;
      const val = el.value;
      if (lastVal.get(el) === val) return;
      lastVal.set(el, val);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    document.addEventListener('input', handle, true);
    return () => document.removeEventListener('input', handle, true);
  }, []);
}

// ── Support-Portal Branch (support.tda-intl.org) ──────────────────────────
const SupportPortalBranch = () => (
  <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <SupportPortal />
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
);

// Haupt-App Komponente
const App = () => {
  useSafariDateFix();
  useWakeLock();

  // Support-Portal auf dedizierter Subdomain
  if (window.location.hostname === 'support.tda-intl.org') {
    return <SupportPortalBranch />;
  }

  return (
    <ThemeProvider>
      <UpdateBanner />
      <ApiHealthCheck>
        <AuthProvider>
          <ChatProvider>
          <SubscriptionProvider>
            <DojoProvider>
              <DatenProvider>
              <StandortProvider>
                <KursProvider>
                  <MitgliederUpdateProvider>
                    <BrowserRouter>
                      <AgbConfirmationWrapper>
              <Routes>
              {/* ======== PUBLIC ROUTES ======== */}
              <Route path="/login" element={<LoginRouteHandler />} />
              <Route path="/sso-login" element={<SSOLogin />} />
              <Route path="/password-reset" element={<Suspense fallback={<LazyLoadFallback />}><PasswordReset /></Suspense>} />
              <Route path="/verify-email" element={<Suspense fallback={<LazyLoadFallback />}><VerifyEmail /></Suspense>} />

              {/* Public Marketing Pages - Lazy Loaded */}
              <Route path="/pricing" element={<Suspense fallback={<LazyLoadFallback />}><PricingPage /></Suspense>} />
              <Route path="/register" element={<Suspense fallback={<LazyLoadFallback />}><RegisterPage /></Suspense>} />
              <Route path="/contact" element={<Suspense fallback={<LazyLoadFallback />}><ContactPage /></Suspense>} />
              <Route path="/impressum" element={<Suspense fallback={<LazyLoadFallback />}><ImpressumPage /></Suspense>} />
              <Route path="/about" element={<Suspense fallback={<LazyLoadFallback />}><AboutPage /></Suspense>} />
              <Route path="/datenschutz" element={<Suspense fallback={<LazyLoadFallback />}><DatenschutzPage /></Suspense>} />
              <Route path="/agb" element={<Suspense fallback={<LazyLoadFallback />}><AGBPage /></Suspense>} />
              <Route path="/widerruf" element={<Suspense fallback={<LazyLoadFallback />}><WiderrufsPage /></Suspense>} />
              <Route path="/help" element={<Suspense fallback={<LazyLoadFallback />}><HelpPage /></Suspense>} />
              <Route path="/galerie" element={<Suspense fallback={<LazyLoadFallback />}><GaleriePage /></Suspense>} />
              <Route path="/demo" element={<Suspense fallback={<LazyLoadFallback />}><DemoPage /></Suspense>} />

            {/* Public Homepage - No authentication required */}
            <Route path="/home" element={<Suspense fallback={<LazyLoadFallback />}><Homepage /></Suspense>} />

            {/* Dojo-Homepages (Enterprise Feature) - No authentication required */}
            <Route path="/site/:slug" element={<Suspense fallback={<div style={{display:'flex',justifyContent:'center',padding:'4rem',fontSize:'1.2rem'}}>Wird geladen…</div>}><DojoSite /></Suspense>} />

            {/* Public Check-in Display - No authentication required */}
            <Route path="/public-checkin" element={<Suspense fallback={<LazyLoadFallback />}><PublicCheckinDisplay /></Suspense>} />
            <Route path="/timer-extern" element={<Suspense fallback={<div style={{background:'#0a0a0a',minHeight:'100vh'}} />}><TimerExternDisplay /></Suspense>} />

            {/* Public Timetable Display - No authentication required */}
            <Route path="/public-timetable" element={<Suspense fallback={<LazyLoadFallback />}><PublicTimetableDisplay /></Suspense>} />

            {/* Public Werbe-/Info-Display (Digital Signage) - No authentication required */}
            <Route path="/public-display" element={<Suspense fallback={<LazyLoadFallback />}><PublicWerbeDisplay /></Suspense>} />

            {/* Buddy Invite Registration - No authentication required */}
            <Route path="/registration/buddy-invite/:token" element={<Suspense fallback={<LazyLoadFallback />}><BuddyInviteRegistration /></Suspense>} />

            {/* Lastschrift-Einverständnis — Mitglied antwortet via E-Mail-Link */}
            <Route path="/lastschrift-zustimmung/:token" element={<Suspense fallback={<LazyLoadFallback />}><LastschriftZustimmung /></Suspense>} />

            {/* Verbandsmitgliedschaft - Öffentliche Anmeldung */}
            <Route path="/verband/mitglied-werden" element={<Suspense fallback={<LazyLoadFallback />}><VerbandMitgliedWerden /></Suspense>} />

            {/* Probetraining-Buchung - Öffentlich zugänglich */}
            <Route path="/probetraining" element={<Suspense fallback={<LazyLoadFallback />}><ProbetrainingBuchung /></Suspense>} />
            <Route path="/probetraining/termin/:token" element={<Suspense fallback={<LazyLoadFallback />}><PublicProbetrainingTermin /></Suspense>} />

            {/* Demo-Termin buchen - Öffentlich zugänglich (für Software-Interessenten) */}
            <Route path="/demo-buchen" element={<Suspense fallback={<LazyLoadFallback />}><DemoBuchung /></Suspense>} />

            {/* Pilot-Partner Feedback-Umfrage - Öffentlich (Token-Link aus E-Mail) */}
            <Route path="/pilot-feedback/:token" element={<Suspense fallback={<LazyLoadFallback />}><PilotFeedback /></Suspense>} />

            {/* Event Gast-Anmeldung - Öffentlich zugänglich (kein Login erforderlich) */}
            <Route path="/event/:eventId/gast" element={<Suspense fallback={<LazyLoadFallback />}><EventGastAnmeldung /></Suspense>} />

            {/* Shop - Öffentlich zugänglich (kein Login erforderlich) */}
            <Route path="/gutschein-shop/:dojoId" element={<Suspense fallback={<LazyLoadFallback />}><GutscheinShop /></Suspense>} />
            <Route path="/shop/:dojoId" element={<Suspense fallback={<LazyLoadFallback />}><PublicShop /></Suspense>} />
            <Route path="/shop/:dojoId/warenkorb" element={<Suspense fallback={<LazyLoadFallback />}><PublicShopWarenkorb /></Suspense>} />
            <Route path="/shop/:dojoId/checkout" element={<Suspense fallback={<LazyLoadFallback />}><PublicShopCheckout /></Suspense>} />
            <Route path="/shop/:dojoId/bestellung/:bestellnummer" element={<Suspense fallback={<LazyLoadFallback />}><PublicShopBestaetigung /></Suspense>} />

            {/* Neumitglied-Registrierung - Öffentlich zugänglich */}
            <Route path="/mitglied-werden" element={<Suspense fallback={<LazyLoadFallback />}><PublicRegistration /></Suspense>} />

            {/* ======== MITGLIEDER-ROUTEN (Lazy Loaded) ======== */}
            <Route
              path="/app-install"
              element={
                <MemberOnlyRoute>
                  <Suspense fallback={<LazyLoadFallback />}><AppInstallPage /></Suspense>
                </MemberOnlyRoute>
              }
            />
            <Route
              path="/member/dashboard"
              element={
                <MemberOnlyRoute>
                  <Suspense fallback={<LazyLoadFallback />}><MemberDashboard /></Suspense>
                </MemberOnlyRoute>
              }
            />
            {/* /member-app (alte Mobile-Version entfernt) → auf das echte Dashboard umleiten,
                damit alte Lesezeichen/PWA-Icons nicht ins Leere laufen. */}
            <Route path="/member-app" element={<Navigate to="/member/dashboard" replace />} />
            <Route
              path="/member/profile"
              element={
                <MemberOnlyRoute>
                  <Suspense fallback={<LazyLoadFallback />}>
                    <MemberProfilePage />
                  </Suspense>
                </MemberOnlyRoute>
              }
            />
            <Route
              path="/member/schedule"
              element={
                <MemberOnlyRoute>
                  <Suspense fallback={<LazyLoadFallback />}><MemberSchedule /></Suspense>
                </MemberOnlyRoute>
              }
            />
            <Route
              path="/member/events"
              element={
                <MemberOnlyRoute>
                  <Suspense fallback={<LazyLoadFallback />}><MemberEvents /></Suspense>
                </MemberOnlyRoute>
              }
            />
            <Route
              path="/member/events/:eventId/bezahlen"
              element={
                <MemberOnlyRoute>
                  <Suspense fallback={<LazyLoadFallback />}><EventPaymentCheckout /></Suspense>
                </MemberOnlyRoute>
              }
            />
            <Route
              path="/trainer"
              element={
                <Suspense fallback={<LazyLoadFallback />}>
                  <TrainerOnlyRoute>
                    <TrainerDashboard />
                  </TrainerOnlyRoute>
                </Suspense>
              }
            />
            <Route
              path="/member/payments"
              element={
                <MemberOnlyRoute>
                  <Suspense fallback={<LazyLoadFallback />}><MemberPayments /></Suspense>
                </MemberOnlyRoute>
              }
            />
            <Route
              path="/member/zahlung/:rechnungId"
              element={
                <MemberOnlyRoute>
                  <Suspense fallback={<LazyLoadFallback />}><MemberRechnungCheckout /></Suspense>
                </MemberOnlyRoute>
              }
            />
            <Route
              path="/member/stats"
              element={
                <MemberOnlyRoute>
                  <Suspense fallback={<LazyLoadFallback />}><MemberStats /></Suspense>
                </MemberOnlyRoute>
              }
            />
            <Route
              path="/member/rating"
              element={
                <MemberOnlyRoute>
                  <Suspense fallback={<LazyLoadFallback />}><CourseRating /></Suspense>
                </MemberOnlyRoute>
              }
            />
            <Route
              path="/member/equipment"
              element={
                <MemberOnlyRoute>
                  <Suspense fallback={<LazyLoadFallback />}><EquipmentChecklist /></Suspense>
                </MemberOnlyRoute>
              }
            />
            <Route
              path="/member/styles"
              element={
                <MemberOnlyRoute>
                  <Suspense fallback={<LazyLoadFallback />}><MemberStyles /></Suspense>
                </MemberOnlyRoute>
              }
            />
            <Route
              path="/member/kalender"
              element={
                <MemberOnlyRoute>
                  <Suspense fallback={<LazyLoadFallback />}><KalenderAbo /></Suspense>
                </MemberOnlyRoute>
              }
            />
            <Route
              path="/member/support"
              element={
                <MemberOnlyRoute>
                  <Suspense fallback={<LazyLoadFallback />}>
                    <div className="member-support-wrapper">
                      <MemberHeader />
                      <div className="app-member-content">
                        <SupportTickets />
                      </div>
                    </div>
                  </Suspense>
                </MemberOnlyRoute>
              }
            />
            <Route
              path="/member/wunschliste"
              element={
                <MemberOnlyRoute>
                  <Suspense fallback={<LazyLoadFallback />}>
                    <div className="member-support-wrapper">
                      <MemberHeader />
                      <div className="app-member-content">
                        <FeatureBoard />
                      </div>
                    </div>
                  </Suspense>
                </MemberOnlyRoute>
              }
            />

            <Route
              path="/member/community"
              element={
                <MemberOnlyRoute>
                  <Suspense fallback={<LazyLoadFallback />}>
                    <MemberCommunityPage />
                  </Suspense>
                </MemberOnlyRoute>
              }
            />

            <Route
              path="/member/chat"
              element={
                <MemberOnlyRoute>
                  <Suspense fallback={<LazyLoadFallback />}>
                    <ChatPage />
                  </Suspense>
                </MemberOnlyRoute>
              }
            />


            {/* Standard-Weiterleitung basierend auf Authentifizierung */}
            <Route path="/" element={<RootRedirect />} />

            {/* Eltern-Portal (öffentlich, token-basiert) */}
            <Route path="/eltern-portal" element={<Suspense fallback={<LazyLoadFallback />}><ElternPortal /></Suspense>} />

            {/* ======== TDA-VIB STYLE DASHBOARD (TEST) ======== */}
            <Route
              path="/dashboard-tda-vib"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LazyLoadFallback />}><DashboardTdaVib /></Suspense>
                </ProtectedRoute>
              }
            />

            {/* ======== VERBAND DASHBOARD ======== */}
            <Route
              path="/verband"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LazyLoadFallback />}><VerbandDashboard /></Suspense>
                </ProtectedRoute>
              }
            />

            {/* ======== PROTECTED DASHBOARD ROUTES (Lazy Loaded) ======== */}
            <Route
              path="/dashboard"
              element={
                <AdminOnlyRoute>
                  <Suspense fallback={<LazyLoadFallback />}><Dashboard /></Suspense>
                </AdminOnlyRoute>
              }
            >
              {/* Dashboard Startseite */}
              <Route index element={<Suspense fallback={<LazyLoadFallback />}><DashboardStart /></Suspense>} />

              {/* ======== HAUPTBEREICHE ======== */}

              {/* Übersicht mit Statistiken */}
              <Route path="uebersicht" element={<Suspense fallback={<LazyLoadFallback />}><AnwesenheitDashboard /></Suspense>} />

              {/* ======== MITGLIEDER-BEREICHE ======== */}

              {/* Anwesenheits-Management */}
              <Route path="anwesenheit" element={<Suspense fallback={<LazyLoadFallback />}><Anwesenheit /></Suspense>} />

              {/* Mitglieder-Management */}
              <Route path="mitglieder" element={<Suspense fallback={<LazyLoadFallback />}><MitgliederListe /></Suspense>} />
              <Route path="mitglieder/:id" element={<Suspense fallback={<LazyLoadFallback />}><MitgliedDetail /></Suspense>} />

              {/* Ehemalige & Interessenten */}
              <Route path="ehemalige" element={<Suspense fallback={<LazyLoadFallback />}><EhemaligenListe /></Suspense>} />
              <Route path="interessenten" element={<Suspense fallback={<LazyLoadFallback />}><InteressentenListe /></Suspense>} />

              {/* Check-In System */}
              <Route path="checkin" element={<Suspense fallback={<LazyLoadFallback />}><CheckinSystem /></Suspense>} />

              {/* Werbe-/Info-Bildschirm (Digital Signage) Verwaltung */}
              <Route path="werbe-display" element={<Suspense fallback={<LazyLoadFallback />}><DisplayVerwaltung /></Suspense>} />

              {/* Personal Check-In System */}
              <Route path="personal-checkin" element={<Suspense fallback={<LazyLoadFallback />}><PersonalCheckin /></Suspense>} />

              {/* Tresen-Übersicht */}
              <Route path="tresen" element={<Suspense fallback={<LazyLoadFallback />}><TresenUebersicht /></Suspense>} />

              {/* ======== VERKAUFSSYSTEM ======== */}

              {/* Artikelgruppen-Verwaltung */}
              <Route path="artikelgruppen" element={<Suspense fallback={<LazyLoadFallback />}><ArtikelgruppenVerwaltung /></Suspense>} />

              {/* Artikelverwaltung */}
              <Route path="artikel" element={<Suspense fallback={<LazyLoadFallback />}><ArtikelVerwaltung /></Suspense>} />
              <Route path="artikel/neu" element={<Suspense fallback={<LazyLoadFallback />}><ArtikelFormular mode="create" /></Suspense>} />
              <Route path="artikel/bearbeiten/:id" element={<Suspense fallback={<LazyLoadFallback />}><ArtikelFormular mode="edit" /></Suspense>} />

              {/* Kassensystem */}
              <Route path="kasse" element={<Suspense fallback={<LazyLoadFallback />}><VerkaufKasse /></Suspense>} />

              {/* Shop-Bestellungen */}
              <Route path="shop-bestellungen" element={<Suspense fallback={<LazyLoadFallback />}><ShopBestellungenVerwaltung /></Suspense>} />

              {/* Offene Artikel-Einzüge */}
              <Route path="offene-einzuege" element={<Suspense fallback={<LazyLoadFallback />}><OffeneArtikelEinzuege /></Suspense>} />

              {/* Gutscheine */}
              <Route path="gutscheine" element={<Suspense fallback={<LazyLoadFallback />}><GutscheineVerwaltung /></Suspense>} />

              {/* KI-Chat Widget Einstellungen */}
              <Route path="ki-chat" element={<Suspense fallback={<LazyLoadFallback />}><KiChatEinstellungen /></Suspense>} />

              {/* ======== STIL-VERWALTUNG (ERWEITERT) ======== */}
              <Route path="stile" element={<Suspense fallback={<LazyLoadFallback />}><Stilverwaltung /></Suspense>} />
              <Route path="stile/:stilId" element={<Suspense fallback={<LazyLoadFallback />}><Stilverwaltung /></Suspense>} />

              {/* ======== VERWALTUNGSBEREICHE ======== */}

              {/* Gruppen-Verwaltung */}
              <Route path="gruppen" element={<Suspense fallback={<LazyLoadFallback />}><GruppenStilverwaltung /></Suspense>} />

              {/* Standort-Verwaltung */}
              <Route path="standorte" element={<Suspense fallback={<LazyLoadFallback />}><StandortVerwaltung /></Suspense>} />

              {/* Kurs-Management */}
              <Route path="kurse" element={<Suspense fallback={<LazyLoadFallback />}><Kurse /></Suspense>} />

              {/* Stundenplan-Management */}
              <Route path="stundenplan" element={<Suspense fallback={<LazyLoadFallback />}><Stundenplan /></Suspense>} />

              {/* Trainer-Management */}
              <Route path="trainer" element={<Suspense fallback={<LazyLoadFallback />}><Trainer /></Suspense>} />
              <Route path="trainer-stunden" element={<Suspense fallback={<LazyLoadFallback />}><TrainerStunden /></Suspense>} />

              {/* Prüfungsverwaltung (Gurtprüfungen) */}
              <Route path="termine" element={<Suspense fallback={<LazyLoadFallback />}><PruefungsVerwaltung /></Suspense>} />
              <Route path="pruefung-durchfuehren" element={<Suspense fallback={<LazyLoadFallback />}><PruefungDurchfuehren /></Suspense>} />
              <Route path="urkunden-vorlagen" element={<Suspense fallback={<LazyLoadFallback />}><UrkundenVorlagenEditor /></Suspense>} />
              <Route path="funktionen" element={<Suspense fallback={<LazyLoadFallback />}><FunktionsUebersicht /></Suspense>} />
              <Route path="kalender" element={<Suspense fallback={<LazyLoadFallback />}><KalenderZentrale /></Suspense>} />

              {/* Badge-Verwaltung (Auszeichnungen) */}
              <Route path="badges" element={<Suspense fallback={<LazyLoadFallback />}><BadgeAdminOverview /></Suspense>} />

              {/* Events-Verwaltung */}
              <Route path="events" element={<Suspense fallback={<LazyLoadFallback />}><Events /></Suspense>} />
              <Route path="events-dashboard" element={<Suspense fallback={<LazyLoadFallback />}><EventsDashboard /></Suspense>} />
              <Route path="meine-events" element={<Suspense fallback={<LazyLoadFallback />}><MeineEvents /></Suspense>} />

              {/* Turnierverwaltung & Lernplattform */}
              <Route path="turniere" element={<Suspense fallback={<LazyLoadFallback />}><Turnierverwaltung /></Suspense>} />
              <Route path="lernplattform" element={<Suspense fallback={<LazyLoadFallback />}><Lernplattform /></Suspense>} />
              <Route path="eltern-zugaenge" element={<Suspense fallback={<LazyLoadFallback />}><ElternZugaenge /></Suspense>} />
              <Route path="homepage" element={<Suspense fallback={<LazyLoadFallback />}><HomepageDashboard /></Suspense>} />

              {/* News-Verwaltung (nur Haupt-Admin) */}
              <Route path="news" element={<Suspense fallback={<LazyLoadFallback />}><NewsVerwaltung /></Suspense>} />
              <Route path="news/neu" element={<Suspense fallback={<LazyLoadFallback />}><NewsFormular mode="create" /></Suspense>} />
              <Route path="news/bearbeiten/:id" element={<Suspense fallback={<LazyLoadFallback />}><NewsFormular mode="edit" /></Suspense>} />

              {/* Support-Ticketsystem */}
              <Route path="support" element={<Suspense fallback={<LazyLoadFallback />}><SupportTickets /></Suspense>} />

              {/* Finanzen & Beitrags-Management */}
              <Route path="buchhaltung" element={<Suspense fallback={<LazyLoadFallback />}><BuchhaltungPage /></Suspense>} />
              <Route path="finanzcockpit" element={<Suspense fallback={<LazyLoadFallback />}><Finanzcockpit /></Suspense>} />
              <Route path="euer" element={<Suspense fallback={<LazyLoadFallback />}><EuerUebersicht /></Suspense>} />
              <Route path="euer-tda" element={<Suspense fallback={<LazyLoadFallback />}><EuerUebersicht isTDA={true} /></Suspense>} />
              <Route path="ausgaben" element={<Suspense fallback={<LazyLoadFallback />}><AusgabenVerwaltung /></Suspense>} />
              <Route path="kontoauszug-import" element={<Suspense fallback={<LazyLoadFallback />}><KontoauszugImport /></Suspense>} />
              <Route path="jahresuebersicht" element={<Suspense fallback={<LazyLoadFallback />}><Jahresuebersicht /></Suspense>} />
              <Route path="ruecklastschriften" element={<Suspense fallback={<LazyLoadFallback />}><RuecklastschriftVerwaltung /></Suspense>} />
              <Route path="vorlagen" element={<Suspense fallback={<LazyLoadFallback />}><VorlagenVerwaltung /></Suspense>} />
              <Route path="mitglieder-filter/:filterType" element={<Suspense fallback={<LazyLoadFallback />}><MitgliederFilter /></Suspense>} />
              <Route path="beitraege" element={<Suspense fallback={<LazyLoadFallback />}><Beitraege /></Suspense>} />
              <Route path="mahnwesen" element={<Suspense fallback={<LazyLoadFallback />}><Mahnwesen /></Suspense>} />
              <Route path="offene-zahlungen" element={<Suspense fallback={<LazyLoadFallback />}><OffeneZahlungen /></Suspense>} />
              <Route path="mahnstufen-einstellungen" element={<Suspense fallback={<LazyLoadFallback />}><MahnstufenEinstellungen /></Suspense>} />
              <Route path="rechnungen" element={<Suspense fallback={<LazyLoadFallback />}><Rechnungsverwaltung /></Suspense>} />
              <Route path="rechnungen/:id" element={<Suspense fallback={<LazyLoadFallback />}><Rechnungsverwaltung /></Suspense>} />
              <Route path="rechnung-erstellen" element={<Suspense fallback={<LazyLoadFallback />}><RechnungErstellen /></Suspense>} />
              <Route path="zahlung/:rechnungId" element={<Suspense fallback={<LazyLoadFallback />}><PaymentCheckout /></Suspense>} />
              <Route path="lastschriftlauf" element={<Suspense fallback={<LazyLoadFallback />}><Lastschriftlauf /></Suspense>} />
              <Route path="sepa-mandate" element={<Suspense fallback={<LazyLoadFallback />}><SepaMandateVerwaltung /></Suspense>} />
              <Route path="zahllaeufe" element={<Suspense fallback={<LazyLoadFallback />}><LastschriftManagement /></Suspense>} />
              <Route path="lastschrift-einverstaendnis" element={<Suspense fallback={<LazyLoadFallback />}><LastschriftEinverstaendnis /></Suspense>} />

              {/* Zahlungszyklen-Management */}
              <Route path="zahlungszyklen" element={<Suspense fallback={<LazyLoadFallback />}><ZahlungszyklenSeite /></Suspense>} />

              {/* Tarife & Preise Management */}
              <Route path="tarife" element={<Suspense fallback={<LazyLoadFallback />}><TarifePreise /></Suspense>} />
              <Route path="rabattsystem" element={<Suspense fallback={<LazyLoadFallback />}><Rabattsystem /></Suspense>} />

              {/* Personal-Management */}
              <Route path="personal" element={<Suspense fallback={<LazyLoadFallback />}><Personal /></Suspense>} />

              {/* Buddy-Gruppen Verwaltung */}
              <Route path="buddy-gruppen" element={<Suspense fallback={<LazyLoadFallback />}><BuddyVerwaltung /></Suspense>} />

              {/* Freunde werben Freunde → jetzt in Marketingzentrale */}
              <Route path="freunde-werben" element={<Navigate to="/dashboard/marketingzentrale?tab=freunde-werben" replace />} />

              {/* Marketing-Zentrale */}
              <Route path="marketingzentrale" element={<Suspense fallback={<LazyLoadFallback />}><MarketingZentrale /></Suspense>} />

              {/* Umfragen */}
              <Route path="umfragen" element={<Suspense fallback={<LazyLoadFallback />}><UmfragenDashboard /></Suspense>} />

              {/* Auswertungen (Analytics & Reports) */}
              <Route path="auswertungen" element={<Suspense fallback={<LazyLoadFallback />}><Auswertungen /></Suspense>} />
              <Route path="guertel-massenzuweisung" element={<Suspense fallback={<LazyLoadFallback />}><GuertelMassenzuweisung /></Suspense>} />
              <Route path="course-ratings" element={<Suspense fallback={<LazyLoadFallback />}><CourseRatingAdmin /></Suspense>} />

              {/* MagicLine Import */}
              <Route path="magicline-import" element={<Suspense fallback={<LazyLoadFallback />}><MagicLineImport /></Suspense>} />

              {/* CSV Import */}
              <Route path="csv-import" element={<Suspense fallback={<LazyLoadFallback />}><CSVImport /></Suspense>} />

              {/* Berichte & Dokumente (PDF Management) */}
              <Route path="berichte" element={<Suspense fallback={<LazyLoadFallback />}><BerichteDokumente /></Suspense>} />

              {/* Vertrags-Dokumentenverwaltung (AGB, Datenschutz, etc.) */}
              <Route path="vertragsdokumente" element={<Suspense fallback={<LazyLoadFallback />}><DokumenteVerwaltung /></Suspense>} />

              {/* DokumentenZentrale — Zentraler Hub */}
              <Route path="dokumentenzentrale" element={<Suspense fallback={<LazyLoadFallback />}><DokumentenZentrale /></Suspense>} />

              {/* Multi-Dojo-Verwaltung & Steuer-Tracking */}
              <Route path="dojos" element={<Suspense fallback={<LazyLoadFallback />}><DojosVerwaltung /></Suspense>} />
              <Route path="dojos/edit/:id" element={<Suspense fallback={<LazyLoadFallback />}><DojoEdit /></Suspense>} />
              <Route path="dojos/new" element={<Suspense fallback={<LazyLoadFallback />}><DojoEdit /></Suspense>} />

              {/* Newsletter & Benachrichtigungssystem */}
              <Route path="notifications" element={<Suspense fallback={<LazyLoadFallback />}><NotificationSystem /></Suspense>} />


              {/* ======== EINSTELLUNGEN ======== */}
              <Route path="einstellungen" element={<Suspense fallback={<LazyLoadFallback />}><EinstellungenDojo /></Suspense>} />
              <Route path="einstellungen/meindojo" element={<Suspense fallback={<LazyLoadFallback />}><EinstellungenDojo /></Suspense>} />
              <Route path="einstellungen/zahlungen" element={<Suspense fallback={<LazyLoadFallback />}><ZahlungsEinstellungen /></Suspense>} />
              <Route path="einstellungen/design" element={<Suspense fallback={<LazyLoadFallback />}><ThemeEinstellungen /></Suspense>} />
              <Route path="einstellungen/checkin" element={<Suspense fallback={<LazyLoadFallback />}><CheckinEinstellungen /></Suspense>} />
              <Route path="einstellungen/probetraining-link" element={<Suspense fallback={<LazyLoadFallback />}><ProbetrainingIntegration /></Suspense>} />

              {/* Audit-Log (Änderungsprotokoll) */}
              <Route path="audit-log" element={<Suspense fallback={<LazyLoadFallback />}><AuditLog /></Suspense>} />

              {/* Security Dashboard (Angriffserkennung & Monitoring) */}
              <Route path="security" element={<Suspense fallback={<LazyLoadFallback />}><SecurityDashboard /></Suspense>} />

              {/* Integrations (Webhooks, PayPal, LexOffice, DATEV, Kalender) */}
              <Route path="webhooks" element={<Suspense fallback={<LazyLoadFallback />}><WebhookVerwaltung /></Suspense>} />
              <Route path="integrationen" element={<Suspense fallback={<LazyLoadFallback />}><IntegrationsEinstellungen /></Suspense>} />
              <Route path="datev-export" element={<Suspense fallback={<LazyLoadFallback />}><DatevExport /></Suspense>} />
              <Route path="steuer" element={<Suspense fallback={<LazyLoadFallback />}><SteuerAssistent /></Suspense>} />
              <Route path="kalender-sync" element={<Suspense fallback={<LazyLoadFallback />}><KalenderAbo /></Suspense>} />

              {/* ======== SUPER ADMIN ======== */}
              <Route path="passwoerter" element={<Suspense fallback={<LazyLoadFallback />}><PasswortVerwaltung dojoOnly={false} /></Suspense>} />
              <Route path="lizenzen" element={<Suspense fallback={<LazyLoadFallback />}><DojoLizenzverwaltung /></Suspense>} />

              {/* Chat für Admins / Trainer */}
              <Route path="chat" element={<Suspense fallback={<LazyLoadFallback />}><AdminChatPage /></Suspense>} />

              {/* Besucher-Chat für Admins / Super-Admin */}
              <Route path="besucher-chat" element={<Suspense fallback={<LazyLoadFallback />}><BesucherChat /></Suspense>} />

              {/* Fehlerseite für ungültige Dashboard-Unterrouten */}
              <Route
                path="*"
                element={<DashboardNotFound />}
              />
            </Route>
            
            {/* ======== GLOBAL 404 ======== */}
            <Route 
              path="*" 
              element={
                <div className="app-404-container">
                  <h1 className="u-emoji-xl">404</h1>
                  <h2 className="app-404-h2">Seite nicht gefunden</h2>
                  <p className="app-404-p">
                    Die angeforderte URL existiert nicht.
                  </p>
                  <button
                    onClick={() => window.location.href = '/dashboard'}
                    className="app-404-btn"
                  >
                    Zum Dashboard
                  </button>
                </div>
              } 
            />
                </Routes>
                      </AgbConfirmationWrapper>
                </BrowserRouter>
                </MitgliederUpdateProvider>
              </KursProvider>
            </StandortProvider>
              </DatenProvider>
          </DojoProvider>
        </SubscriptionProvider>
          </ChatProvider>
      </AuthProvider>
    </ApiHealthCheck>
  </ThemeProvider>
);
};

export default App;

/*
================================================================================
APP.JSX ROUTE-DOKUMENTATION
================================================================================

ROUTE-STRUKTUR:
/                           -> Redirect zu /dashboard
/login                      -> Login-Seite
/dashboard                  -> Dashboard Layout (Protected)
  +-- /                     -> DashboardStart (Startseite)
  +-- /uebersicht          -> AnwesenheitDashboard  
  +-- /anwesenheit         -> Anwesenheit
  +-- /mitglieder          -> MitgliederListe
  +-- /mitglieder/:id      -> MitgliedDetail
  +-- /checkin             -> CheckinSystem
  +-- /tresen              -> TresenUebersicht
  +-- /stile               -> Stilverwaltung (FALLBACK: GruppenStilverwaltung)
  +-- /stile/:stilId       -> Stilverwaltung (Detail - FALLBACK)
  +-- /stil                -> GruppenStilverwaltung (Alt)
  +-- /kurse               -> Kurse
  +-- /stundenplan         -> Stundenplan
  +-- /trainer             -> Trainer
  +-- /einstellungen       -> EinstellungenDojo
  +-- /einstellungen/meindojo -> EinstellungenDojo

WICHTIGE HINWEISE:
- /stile nutzt momentan GruppenStilverwaltung als Fallback
- TODO: Erweiterte StilVerwaltung-Komponente mit Graduierungen erstellen
- /stil = alte einfache Stil-Verwaltung (bleibt als Alternative)

�NDERUNGEN IN DIESER VERSION:
- Import von StilVerwaltung zeigt nun auf GruppenStilverwaltung (Zeile 55)
- Kommentar hinzugef�gt: TODO f�r zuk�nftige Implementierung
- Routen /stile und /stile/:stilId funktionieren nun ohne Fehler

API-ANFORDERUNGEN F�R ZUK�NFTIGE /stile IMPLEMENTIERUNG:
- GET /api/stile                           -> Alle Stile mit Graduierungen
- GET /api/stile/:id                       -> Einzelner Stil mit Graduierungen  
- POST /api/stile                          -> Neuen Stil erstellen
- PUT /api/stile/:id                       -> Stil aktualisieren
- DELETE /api/stile/:id                    -> Stil l�schen
- POST /api/stile/:stilId/graduierungen    -> Graduierung hinzuf�gen
- PUT /api/stile/graduierungen/:id         -> Graduierung aktualisieren
- DELETE /api/stile/graduierungen/:id      -> Graduierung l�schen
- PUT /api/stile/:stilId/graduierungen/reorder -> Drag & Drop Reordering
================================================================================
*/
