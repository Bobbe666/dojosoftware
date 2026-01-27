// Frontend/src/App.jsx - OPTIMIERTE VERSION mit aggressivem Lazy Loading
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Authentifizierung & Context
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { KursProvider } from "./context/KursContext.jsx";
import { DojoProvider } from "./context/DojoContext.jsx";
import { StandortProvider } from "./context/StandortContext.jsx";
import { MitgliederUpdateProvider } from "./context/MitgliederUpdateContext.jsx";
import { SubscriptionProvider } from "./context/SubscriptionContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";

// AGB-Bestaetigung Wrapper
import AgbConfirmationWrapper from "./components/AgbConfirmationWrapper";

// ============================================================================
// SOFORT GELADEN - Kritisch für Initial Load
// ============================================================================
import Login from "./components/Login";
import LandingPage from "./pages/LandingPage";

// ============================================================================
// LAZY LOADED - Dashboard & Hauptbereiche
// ============================================================================
const Dashboard = lazy(() => import(/* webpackChunkName: "dashboard" */ "./components/Dashboard"));
const DashboardTdaVib = lazy(() => import(/* webpackChunkName: "dashboard-tda" */ "./components/DashboardTdaVib"));
const DashboardStart = lazy(() => import(/* webpackChunkName: "dashboard-start" */ "./components/DashboardStart"));

// ============================================================================
// LAZY LOADED - Mitglieder-Management
// ============================================================================
const MitgliederListe = lazy(() => import(/* webpackChunkName: "members" */ "./components/MitgliederListe"));
const MitgliedDetail = lazy(() => import(/* webpackChunkName: "member-detail" */ "./components/MitgliedDetail"));
const MitgliedDetailShared = lazy(() => import(/* webpackChunkName: "member-detail-shared" */ "./components/MitgliedDetailShared"));
const EhemaligenListe = lazy(() => import(/* webpackChunkName: "members" */ "./components/EhemaligenListe"));
const InteressentenListe = lazy(() => import(/* webpackChunkName: "members" */ "./components/InteressentenListe"));
const MitgliederFilter = lazy(() => import(/* webpackChunkName: "members" */ "./components/MitgliederFilter"));

// ============================================================================
// LAZY LOADED - Anwesenheit & Check-In
// ============================================================================
const Anwesenheit = lazy(() => import(/* webpackChunkName: "attendance" */ "./components/Anwesenheit"));
const AnwesenheitDashboard = lazy(() => import(/* webpackChunkName: "attendance" */ "./components/AnwesenheitDashboard"));
const CheckinSystem = lazy(() => import(/* webpackChunkName: "checkin" */ "./components/CheckinSystem"));
const PersonalCheckin = lazy(() => import(/* webpackChunkName: "checkin" */ "./components/PersonalCheckin"));
const PublicCheckinDisplay = lazy(() => import(/* webpackChunkName: "public" */ "./components/PublicCheckinDisplay"));

// ============================================================================
// LAZY LOADED - Kurse & Stundenplan
// ============================================================================
const Stundenplan = lazy(() => import(/* webpackChunkName: "courses" */ "./components/Stundenplan"));
const Kurse = lazy(() => import(/* webpackChunkName: "courses" */ "./components/Kurse"));
const Trainer = lazy(() => import(/* webpackChunkName: "courses" */ "./components/Trainer"));
const GruppenStilverwaltung = lazy(() => import(/* webpackChunkName: "courses" */ "./components/GruppenStilverwaltung"));
const Stilverwaltung = lazy(() => import(/* webpackChunkName: "styles" */ "./components/Stilverwaltung"));
const StandortVerwaltung = lazy(() => import(/* webpackChunkName: "settings" */ "./components/StandortVerwaltung"));
const PublicTimetableDisplay = lazy(() => import(/* webpackChunkName: "public" */ "./components/PublicTimetableDisplay"));

// ============================================================================
// LAZY LOADED - Finanzen & Beiträge
// ============================================================================
const Finanzcockpit = lazy(() => import(/* webpackChunkName: "finance" */ "./components/Finanzcockpit"));
const Beitraege = lazy(() => import(/* webpackChunkName: "finance" */ "./components/Beitraege"));
const Mahnwesen = lazy(() => import(/* webpackChunkName: "finance" */ "./components/Mahnwesen"));
const MahnstufenEinstellungen = lazy(() => import(/* webpackChunkName: "finance" */ "./components/MahnstufenEinstellungen"));
const Rechnungsverwaltung = lazy(() => import(/* webpackChunkName: "finance" */ "./components/Rechnungsverwaltung"));
const RechnungErstellen = lazy(() => import(/* webpackChunkName: "finance" */ "./components/RechnungErstellen"));
const SepaMandateVerwaltung = lazy(() => import(/* webpackChunkName: "finance" */ "./components/SepaMandateVerwaltung"));
const LastschriftManagement = lazy(() => import(/* webpackChunkName: "finance" */ "./components/LastschriftManagement"));
const TarifePreise = lazy(() => import(/* webpackChunkName: "finance" */ "./components/TarifePreise"));
const Rabattsystem = lazy(() => import(/* webpackChunkName: "finance" */ "./components/Rabattsystem"));
const ZahlungszyklenSeite = lazy(() => import(/* webpackChunkName: "finance" */ "./components/ZahlungszyklenSeite"));
const ZahlungsEinstellungen = lazy(() => import(/* webpackChunkName: "finance" */ "./components/ZahlungsEinstellungen"));

// ============================================================================
// LAZY LOADED - Verkauf & Artikel
// ============================================================================
const TresenUebersicht = lazy(() => import(/* webpackChunkName: "sales" */ "./components/TresenUebersicht"));
const ArtikelVerwaltung = lazy(() => import(/* webpackChunkName: "sales" */ "./components/ArtikelVerwaltung"));
const ArtikelFormular = lazy(() => import(/* webpackChunkName: "sales" */ "./components/ArtikelFormular"));
const VerkaufKasse = lazy(() => import(/* webpackChunkName: "sales" */ "./components/VerkaufKasse"));
const ArtikelgruppenVerwaltung = lazy(() => import(/* webpackChunkName: "sales" */ "./components/ArtikelgruppenVerwaltung"));

// ============================================================================
// LAZY LOADED - Member-Bereich
// ============================================================================
const MemberDashboard = lazy(() => import(/* webpackChunkName: "member-area" */ "./components/MemberDashboard"));
const MemberHeader = lazy(() => import(/* webpackChunkName: "member-area" */ "./components/MemberHeader"));
const MemberSchedule = lazy(() => import(/* webpackChunkName: "member-area" */ "./components/MemberSchedule"));
const MemberEvents = lazy(() => import(/* webpackChunkName: "member-area" */ "./components/MemberEvents"));
const MemberPayments = lazy(() => import(/* webpackChunkName: "member-area" */ "./components/MemberPayments"));
const MemberStats = lazy(() => import(/* webpackChunkName: "member-area" */ "./components/MemberStats"));
const MemberStyles = lazy(() => import(/* webpackChunkName: "member-area" */ "./components/MemberStyles"));
const CourseRating = lazy(() => import(/* webpackChunkName: "member-area" */ "./components/CourseRating"));
const EquipmentChecklist = lazy(() => import(/* webpackChunkName: "member-area" */ "./components/EquipmentChecklist"));
const AppInstallPage = lazy(() => import(/* webpackChunkName: "member-area" */ "./pages/AppInstallPage"));

// ============================================================================
// LAZY LOADED - Trainer-Bereich
// ============================================================================
const TrainerDashboard = lazy(() => import(/* webpackChunkName: "trainer" */ "./components/TrainerDashboard"));
const TrainerOnlyRoute = lazy(() => import(/* webpackChunkName: "trainer" */ "./components/TrainerOnlyRoute"));
const CourseRatingAdmin = lazy(() => import(/* webpackChunkName: "trainer" */ "./components/CourseRatingAdmin"));

// ============================================================================
// LAZY LOADED - Admin-Verwaltung
// ============================================================================
const Personal = lazy(() => import(/* webpackChunkName: "admin" */ "./components/Personal"));
const EinstellungenDojo = lazy(() => import(/* webpackChunkName: "admin" */ "./components/EinstellungenDojo"));
const AuditLog = lazy(() => import(/* webpackChunkName: "admin" */ "./components/AuditLog"));
const BuddyVerwaltung = lazy(() => import(/* webpackChunkName: "admin" */ "./components/BuddyVerwaltung"));
const Auswertungen = lazy(() => import(/* webpackChunkName: "admin" */ "./components/Auswertungen"));
const BerichteDokumente = lazy(() => import(/* webpackChunkName: "admin" */ "./components/BerichteDokumente"));
const DojosVerwaltung = lazy(() => import(/* webpackChunkName: "admin" */ "./components/DojosVerwaltung"));
const DojoEdit = lazy(() => import(/* webpackChunkName: "admin" */ "./components/DojoEdit"));
const DokumenteVerwaltung = lazy(() => import(/* webpackChunkName: "documents" */ "./components/DokumenteVerwaltung"));
const NotificationSystem = lazy(() => import(/* webpackChunkName: "notifications" */ "./components/NotificationSystem"));
const PruefungsVerwaltung = lazy(() => import(/* webpackChunkName: "exams" */ "./components/PruefungsVerwaltung"));
const PruefungDurchfuehren = lazy(() => import(/* webpackChunkName: "exams" */ "./components/PruefungDurchfuehren"));

// ============================================================================
// LAZY LOADED - Events & News
// ============================================================================
const Events = lazy(() => import(/* webpackChunkName: "events" */ "./components/Events"));
const MeineEvents = lazy(() => import(/* webpackChunkName: "events" */ "./components/MeineEvents"));
const NewsVerwaltung = lazy(() => import(/* webpackChunkName: "news" */ "./components/NewsVerwaltung"));
const NewsFormular = lazy(() => import(/* webpackChunkName: "news" */ "./components/NewsFormular"));

// ============================================================================
// LAZY LOADED - Public & Registration
// ============================================================================
const Homepage = lazy(() => import(/* webpackChunkName: "public" */ "./components/Homepage"));
const PublicRegistration = lazy(() => import(/* webpackChunkName: "public" */ "./components/PublicRegistration"));
const BuddyInviteRegistration = lazy(() => import(/* webpackChunkName: "public" */ "./components/BuddyInviteRegistration"));
const MagicLineImport = lazy(() => import(/* webpackChunkName: "import" */ "./pages/MagicLineImport"));

// ============================================================================
// LAZY LOADED - Marketing Pages
// ============================================================================
const PricingPage = lazy(() => import(/* webpackChunkName: "marketing" */ "./pages/PricingPage"));
const RegisterPage = lazy(() => import(/* webpackChunkName: "marketing" */ "./pages/RegisterPage"));
const ContactPage = lazy(() => import(/* webpackChunkName: "marketing" */ "./pages/ContactPage"));
const ImpressumPage = lazy(() => import(/* webpackChunkName: "marketing" */ "./pages/ImpressumPage"));
const AboutPage = lazy(() => import(/* webpackChunkName: "marketing" */ "./pages/AboutPage"));
const DatenschutzPage = lazy(() => import(/* webpackChunkName: "marketing" */ "./pages/DatenschutzPage"));
const AGBPage = lazy(() => import(/* webpackChunkName: "marketing" */ "./pages/AGBPage"));
const HelpPage = lazy(() => import(/* webpackChunkName: "marketing" */ "./pages/HelpPage"));
const GaleriePage = lazy(() => import(/* webpackChunkName: "marketing" */ "./pages/GaleriePage"));
const DemoPage = lazy(() => import(/* webpackChunkName: "marketing" */ "./pages/DemoPage"));

// Loading Fallback für Lazy-Loaded Komponenten
const LazyLoadFallback = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px',
    fontSize: '1rem',
    color: '#666'
  }}>
    <div className="loading-spinner"></div>
  </div>
);

// Protected Route Komponente mit AuthContext
const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();

  // 🔧 DEVELOPMENT BYPASS - Temporär deaktiviert für Multi-Tenant Testing
  // const isDevelopment = import.meta.env.MODE === 'development';
  // if (isDevelopment) {
  //   console.log('🔧 Development Mode: Login-Bypass aktiv');
  //   return children;
  // }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        flexDirection: 'column',
        gap: '1rem'
      }}>
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

// Member-Only Route - Only allows users with 'member' role
const MemberOnlyRoute = ({ children }) => {
  const { token, user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div className="loading-spinner-large"></div>
        <div>Authentifizierung wird gepr�ft...</div>
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
const RootRedirect = () => {
  const { token, user, loading } = useAuth();

  if (loading) {
    return <div>Lade...</div>;
  }

  // Wenn nicht eingeloggt, zeige Landing Page
  if (!token) {
    return <LandingPage />;
  }

  // Wenn eingeloggt, weiter zum Dashboard
  return <Navigate to="/dashboard" replace />;
};

// Haupt-App Komponente
const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <DojoProvider>
            <StandortProvider>
              <KursProvider>
                <MitgliederUpdateProvider>
                  <BrowserRouter>
                    <AgbConfirmationWrapper>
              <Routes>
              {/* ======== PUBLIC ROUTES ======== */}
              <Route path="/login" element={<Login />} />

              {/* Public Marketing Pages - Lazy Loaded */}
              <Route path="/pricing" element={<Suspense fallback={<LazyLoadFallback />}><PricingPage /></Suspense>} />
              <Route path="/register" element={<Suspense fallback={<LazyLoadFallback />}><RegisterPage /></Suspense>} />
              <Route path="/contact" element={<Suspense fallback={<LazyLoadFallback />}><ContactPage /></Suspense>} />
              <Route path="/impressum" element={<Suspense fallback={<LazyLoadFallback />}><ImpressumPage /></Suspense>} />
              <Route path="/about" element={<Suspense fallback={<LazyLoadFallback />}><AboutPage /></Suspense>} />
              <Route path="/datenschutz" element={<Suspense fallback={<LazyLoadFallback />}><DatenschutzPage /></Suspense>} />
              <Route path="/agb" element={<Suspense fallback={<LazyLoadFallback />}><AGBPage /></Suspense>} />
              <Route path="/help" element={<Suspense fallback={<LazyLoadFallback />}><HelpPage /></Suspense>} />
              <Route path="/galerie" element={<Suspense fallback={<LazyLoadFallback />}><GaleriePage /></Suspense>} />
              <Route path="/demo" element={<Suspense fallback={<LazyLoadFallback />}><DemoPage /></Suspense>} />

            {/* Public Homepage - No authentication required */}
            <Route path="/home" element={<Suspense fallback={<LazyLoadFallback />}><Homepage /></Suspense>} />

            {/* Public Check-in Display - No authentication required */}
            <Route path="/public-checkin" element={<Suspense fallback={<LazyLoadFallback />}><PublicCheckinDisplay /></Suspense>} />

            {/* Public Timetable Display - No authentication required */}
            <Route path="/public-timetable" element={<Suspense fallback={<LazyLoadFallback />}><PublicTimetableDisplay /></Suspense>} />

            {/* Buddy Invite Registration - No authentication required */}
            <Route path="/registration/buddy-invite/:token" element={<Suspense fallback={<LazyLoadFallback />}><BuddyInviteRegistration /></Suspense>} />

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
              path="/member/profile"
              element={
                <MemberOnlyRoute>
                  <Suspense fallback={<LazyLoadFallback />}>
                    <div className="member-profile-wrapper">
                      <MemberHeader />
                      <MitgliedDetailShared isAdmin={false} />
                    </div>
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

            {/* Standard-Weiterleitung basierend auf Authentifizierung */}
            <Route path="/" element={<RootRedirect />} />

            {/* ======== TDA-VIB STYLE DASHBOARD (TEST) ======== */}
            <Route
              path="/dashboard-tda-vib"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LazyLoadFallback />}><DashboardTdaVib /></Suspense>
                </ProtectedRoute>
              }
            />

            {/* ======== PROTECTED DASHBOARD ROUTES (Lazy Loaded) ======== */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LazyLoadFallback />}><Dashboard /></Suspense>
                </ProtectedRoute>
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

              {/* Prüfungsverwaltung (Gurtprüfungen) */}
              <Route path="termine" element={<Suspense fallback={<LazyLoadFallback />}><PruefungsVerwaltung /></Suspense>} />
              <Route path="pruefung-durchfuehren" element={<Suspense fallback={<LazyLoadFallback />}><PruefungDurchfuehren /></Suspense>} />

              {/* Events-Verwaltung */}
              <Route path="events" element={<Suspense fallback={<LazyLoadFallback />}><Events /></Suspense>} />
              <Route path="meine-events" element={<Suspense fallback={<LazyLoadFallback />}><MeineEvents /></Suspense>} />

              {/* News-Verwaltung (nur Haupt-Admin) */}
              <Route path="news" element={<Suspense fallback={<LazyLoadFallback />}><NewsVerwaltung /></Suspense>} />
              <Route path="news/neu" element={<Suspense fallback={<LazyLoadFallback />}><NewsFormular mode="create" /></Suspense>} />
              <Route path="news/bearbeiten/:id" element={<Suspense fallback={<LazyLoadFallback />}><NewsFormular mode="edit" /></Suspense>} />

              {/* Finanzen & Beitrags-Management */}
              <Route path="finanzcockpit" element={<Suspense fallback={<LazyLoadFallback />}><Finanzcockpit /></Suspense>} />
              <Route path="mitglieder-filter/:filterType" element={<Suspense fallback={<LazyLoadFallback />}><MitgliederFilter /></Suspense>} />
              <Route path="beitraege" element={<Suspense fallback={<LazyLoadFallback />}><Beitraege /></Suspense>} />
              <Route path="mahnwesen" element={<Suspense fallback={<LazyLoadFallback />}><Mahnwesen /></Suspense>} />
              <Route path="mahnstufen-einstellungen" element={<Suspense fallback={<LazyLoadFallback />}><MahnstufenEinstellungen /></Suspense>} />
              <Route path="rechnungen" element={<Suspense fallback={<LazyLoadFallback />}><Rechnungsverwaltung /></Suspense>} />
              <Route path="rechnungen/:id" element={<Suspense fallback={<LazyLoadFallback />}><Rechnungsverwaltung /></Suspense>} />
              <Route path="rechnung-erstellen" element={<Suspense fallback={<LazyLoadFallback />}><RechnungErstellen /></Suspense>} />
              <Route path="lastschriftlauf" element={<Suspense fallback={<LazyLoadFallback />}><LastschriftManagement /></Suspense>} />
              <Route path="sepa-mandate" element={<Suspense fallback={<LazyLoadFallback />}><SepaMandateVerwaltung /></Suspense>} />
              <Route path="zahllaeufe" element={<Suspense fallback={<LazyLoadFallback />}><LastschriftManagement /></Suspense>} />

              {/* Zahlungszyklen-Management */}
              <Route path="zahlungszyklen" element={<Suspense fallback={<LazyLoadFallback />}><ZahlungszyklenSeite /></Suspense>} />

              {/* Tarife & Preise Management */}
              <Route path="tarife" element={<Suspense fallback={<LazyLoadFallback />}><TarifePreise /></Suspense>} />
              <Route path="rabattsystem" element={<Suspense fallback={<LazyLoadFallback />}><Rabattsystem /></Suspense>} />

              {/* Personal-Management */}
              <Route path="personal" element={<Suspense fallback={<LazyLoadFallback />}><Personal /></Suspense>} />

              {/* Buddy-Gruppen Verwaltung */}
              <Route path="buddy-gruppen" element={<Suspense fallback={<LazyLoadFallback />}><BuddyVerwaltung /></Suspense>} />

              {/* Auswertungen (Analytics & Reports) */}
              <Route path="auswertungen" element={<Suspense fallback={<LazyLoadFallback />}><Auswertungen /></Suspense>} />
              <Route path="course-ratings" element={<Suspense fallback={<LazyLoadFallback />}><CourseRatingAdmin /></Suspense>} />

              {/* MagicLine Import */}
              <Route path="magicline-import" element={<Suspense fallback={<LazyLoadFallback />}><MagicLineImport /></Suspense>} />

              {/* Berichte & Dokumente (PDF Management) */}
              <Route path="berichte" element={<Suspense fallback={<LazyLoadFallback />}><BerichteDokumente /></Suspense>} />

              {/* Vertrags-Dokumentenverwaltung (AGB, Datenschutz, etc.) */}
              <Route path="vertragsdokumente" element={<Suspense fallback={<LazyLoadFallback />}><DokumenteVerwaltung /></Suspense>} />

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

              {/* Audit-Log (Änderungsprotokoll) */}
              <Route path="audit-log" element={<Suspense fallback={<LazyLoadFallback />}><AuditLog /></Suspense>} />

              {/* Fehlerseite f�r ung�ltige Dashboard-Unterrouten */}
              <Route 
                path="*" 
                element={
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '2rem',
                    color: '#666'
                  }}>
                    <h2>Seite nicht gefunden</h2>
                    <p>Die angeforderte Dashboard-Seite existiert nicht.</p>
                    <button 
                      onClick={() => window.history.back()}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Zur�ck
                    </button>
                  </div>
                } 
              />
            </Route>
            
            {/* ======== GLOBAL 404 ======== */}
            <Route 
              path="*" 
              element={
                <div style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100vh',
                  textAlign: 'center',
                  backgroundColor: '#f8f9fa'
                }}>
                  <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>404</h1>
                  <h2 style={{ marginBottom: '1rem' }}>Seite nicht gefunden</h2>
                  <p style={{ marginBottom: '2rem', color: '#666' }}>
                    Die angeforderte URL existiert nicht.
                  </p>
                  <button
                    onClick={() => window.location.href = '/dashboard'}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '1rem'
                    }}
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
        </DojoProvider>
      </SubscriptionProvider>
    </AuthProvider>
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
