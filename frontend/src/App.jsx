// Frontend/src/App.jsx - VOLLST�NDIGE VERSION mit korrekten Routes
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Authentifizierung
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { KursProvider } from "./context/KursContext.jsx";
import { DojoProvider } from "./context/DojoContext.jsx";
import { MitgliederUpdateProvider } from "./context/MitgliederUpdateContext.jsx";

// Bestehende Komponenten
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import MitgliederListe from "./components/MitgliederListe";
import MitgliedDetail from "./components/MitgliedDetail";
import Anwesenheit from "./components/Anwesenheit";
import Stundenplan from "./components/Stundenplan";
import Kurse from "./components/Kurse";
import Trainer from "./components/Trainer";
import GruppenStilverwaltung from "./components/GruppenStilverwaltung";
import AnwesenheitDashboard from "./components/AnwesenheitDashboard";
import DashboardStart from "./components/DashboardStart";

// Check-In System
import CheckinSystem from "./components/CheckinSystem";

// Personal Check-In System
import PersonalCheckin from "./components/PersonalCheckin";

// Public Check-In Display
import PublicCheckinDisplay from "./components/PublicCheckinDisplay";

// Public Timetable Display
import PublicTimetableDisplay from "./components/PublicTimetableDisplay";

// Public Registration
import PublicRegistration from "./components/PublicRegistration";

// Buddy Invite Registration
import BuddyInviteRegistration from "./components/BuddyInviteRegistration";

// Homepage
import Homepage from "./components/Homepage";

// Tresen-�bersicht
import TresenUebersicht from "./components/TresenUebersicht";

// Artikelverwaltung & Verkaufssystem
import ArtikelVerwaltung from "./components/ArtikelVerwaltung";
import VerkaufKasse from "./components/VerkaufKasse";
import ArtikelgruppenVerwaltung from "./components/ArtikelgruppenVerwaltung";

// ERWEITERTE STIL-VERWALTUNG (mit Graduierungen und Drag & Drop)
// TODO: Komponente noch nicht implementiert - verwende GruppenStilverwaltung als Fallback
import Stilverwaltung from "./components/GruppenStilverwaltung";

// MEMBER-KOMPONENTEN
import MemberDashboard from "./components/MemberDashboard";
import CourseRating from "./components/CourseRating";
import MemberSchedule from "./components/MemberSchedule";
import MemberPayments from "./components/MemberPayments";
import MemberStats from "./components/MemberStats";
import MemberStyles from "./components/MemberStyles";
import EquipmentChecklist from "./components/EquipmentChecklist";
import CourseRatingAdmin from "./components/CourseRatingAdmin";
import MitgliedDetailShared from "./components/MitgliedDetailShared";
import MemberHeader from "./components/MemberHeader";

// Beitrags-Management
import Finanzcockpit from "./components/Finanzcockpit";
import Beitraege from "./components/Beitraege";
import Mahnwesen from "./components/Mahnwesen";
import MahnstufenEinstellungen from "./components/MahnstufenEinstellungen";
import Rechnungsverwaltung from "./components/Rechnungsverwaltung";
import Lastschriftlauf from "./components/Lastschriftlauf";
import SepaMandateVerwaltung from "./components/SepaMandateVerwaltung";
import Zahllaeufe from "./components/Zahllaeufe";
import LastschriftManagement from "./components/LastschriftManagement";

// Tarife & Preise Management
import TarifePreise from "./components/TarifePreise";

// Zahlungszyklen-Management
import ZahlungszyklenSeite from "./components/ZahlungszyklenSeite";

// Personal-Management
import Personal from "./components/Personal";

// Zahlungseinstellungen (Stripe + DATEV Integration)
import ZahlungsEinstellungen from "./components/ZahlungsEinstellungen";

// Dojo-Einstellungen & Admin-Verwaltung
import EinstellungenDojo from "./components/EinstellungenDojo";

// Buddy-Gruppen Verwaltung
import BuddyVerwaltung from "./components/BuddyVerwaltung";

// Auswertungen (Analytics & Reports)
import Auswertungen from "./components/Auswertungen";

// Berichte & Dokumente (PDF Management)
import BerichteDokumente from "./components/BerichteDokumente";

// Multi-Dojo-Verwaltung & Steuer-Tracking
import DojosVerwaltung from "./components/DojosVerwaltung";
import DojoEdit from "./components/DojoEdit";

// Vertrags-Dokumentenverwaltung
import DokumenteVerwaltung from "./components/DokumenteVerwaltung";

// Newsletter & Benachrichtigungssystem
import NotificationSystem from "./components/NotificationSystem";

// Pr�fungsverwaltung (Gurtpr�fungen)
import PruefungsVerwaltung from "./components/PruefungsVerwaltung";
import PruefungDurchfuehren from "./components/PruefungDurchfuehren";

// Protected Route Komponente mit AuthContext
const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();

  // 🔧 DEVELOPMENT BYPASS - Login umgehen während der Entwicklung
  const isDevelopment = import.meta.env.MODE === 'development';
  if (isDevelopment) {
    console.log('🔧 Development Mode: Login-Bypass aktiv');
    return children;
  }

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

// Root Redirect basierend auf Rolle
const RootRedirect = () => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>Lade...</div>;
  }
  
  // Basierend auf Rolle weiterleiten - alle zu /dashboard
  return <Navigate to="/dashboard" replace />;
};

// Haupt-App Komponente
const App = () => {
  return (
    <AuthProvider>
      <DojoProvider>
        <KursProvider>
          <MitgliederUpdateProvider>
            <BrowserRouter>
            <Routes>
            {/* ======== PUBLIC ROUTES ======== */}
            <Route path="/login" element={<Login />} />

            {/* Public Homepage - No authentication required */}
            <Route path="/home" element={<Homepage />} />

            {/* Public Check-in Display - No authentication required */}
            <Route path="/public-checkin" element={<PublicCheckinDisplay />} />

            {/* Public Timetable Display - No authentication required */}
            <Route path="/public-timetable" element={<PublicTimetableDisplay />} />

            {/* Buddy Invite Registration - No authentication required */}
            <Route path="/registration/buddy-invite/:token" element={<BuddyInviteRegistration />} />

            {/* ======== MITGLIEDER-ROUTEN ======== */}
            <Route
              path="/member/profile"
              element={
                <MemberOnlyRoute>
                  <div className="member-profile-wrapper">
                    <MemberHeader />
                    <MitgliedDetailShared isAdmin={false} />
                  </div>
                </MemberOnlyRoute>
              }
            />
            <Route
              path="/member/schedule"
              element={
                <MemberOnlyRoute>
                  <MemberSchedule />
                </MemberOnlyRoute>
              }
            />
            <Route
              path="/member/payments"
              element={
                <MemberOnlyRoute>
                  <MemberPayments />
                </MemberOnlyRoute>
              }
            />
            <Route
              path="/member/stats"
              element={
                <MemberOnlyRoute>
                  <MemberStats />
                </MemberOnlyRoute>
              }
            />
            <Route
              path="/member/rating"
              element={
                <MemberOnlyRoute>
                  <CourseRating />
                </MemberOnlyRoute>
              }
            />
            <Route
              path="/member/equipment"
              element={
                <MemberOnlyRoute>
                  <EquipmentChecklist />
                </MemberOnlyRoute>
              }
            />
            <Route
              path="/member/styles"
              element={
                <MemberOnlyRoute>
                  <MemberStyles />
                </MemberOnlyRoute>
              }
            />

            {/* Standard-Weiterleitung basierend auf Rolle */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <RootRedirect />
                </ProtectedRoute>
              } 
            />
            
            {/* ======== PROTECTED DASHBOARD ROUTES ======== */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            >
              {/* Dashboard Startseite */}
              <Route index element={<DashboardStart />} />
              
              {/* ======== HAUPTBEREICHE ======== */}
              
              {/* �bersicht mit Statistiken */}
              <Route path="uebersicht" element={<AnwesenheitDashboard />} />
              
              {/* ======== MITGLIEDER-BEREICHE ======== */}
              
              {/* Mitglieder-spezifische Bereiche - Diese Routen sind jetzt im Member-Bereich definiert */}
              
              {/* Anwesenheits-Management */}
              <Route path="anwesenheit" element={<Anwesenheit />} />
              
              {/* Mitglieder-Management */}
              <Route path="mitglieder" element={<MitgliederListe />} />
              <Route path="mitglieder/:id" element={<MitgliedDetail />} />
              
              {/* Check-In System */}
              <Route path="checkin" element={<CheckinSystem />} />
              
              {/* Personal Check-In System */}
              <Route path="personal-checkin" element={<PersonalCheckin />} />
              
              {/* Tresen-�bersicht */}
              <Route path="tresen" element={<TresenUebersicht />} />
              
              {/* ======== VERKAUFSSYSTEM ======== */}
              
              {/* Artikelgruppen-Verwaltung */}
              <Route path="artikelgruppen" element={<ArtikelgruppenVerwaltung />} />
              
              {/* Artikelverwaltung */}
              <Route path="artikel" element={<ArtikelVerwaltung />} />
              
              {/* Kassensystem */}
              <Route path="kasse" element={<VerkaufKasse />} />
              
              {/* ======== STIL-VERWALTUNG (ERWEITERT) ======== */}
              {/* 
                WICHTIG: Diese Routen verwenden momentan GruppenStilverwaltung als Fallback
                TODO: Erweiterte StilVerwaltung mit Graduierungen implementieren
              */}
              <Route path="stile" element={<Stilverwaltung />} />
              <Route path="stile/:stilId" element={<Stilverwaltung />} />
              
              {/* ======== VERWALTUNGSBEREICHE ======== */}
              
              {/* Einfache Stil-Verwaltung (alt) */}
              <Route path="stil" element={<GruppenStilverwaltung />} />
              
              {/* Kurs-Management */}
              <Route path="kurse" element={<Kurse />} />
              
              {/* Stundenplan-Management */}
              <Route path="stundenplan" element={<Stundenplan />} />
              
              {/* Trainer-Management */}
              <Route path="trainer" element={<Trainer />} />

              {/* Pr�fungsverwaltung (Gurtpr�fungen) */}
              <Route path="termine" element={<PruefungsVerwaltung />} />
              <Route path="pruefung-durchfuehren" element={<PruefungDurchfuehren />} />

              {/* Beitrags-Management */}
              <Route path="finanzcockpit" element={<Finanzcockpit />} />
              <Route path="beitraege" element={<Beitraege />} />
              <Route path="mahnwesen" element={<Mahnwesen />} />
              <Route path="mahnstufen-einstellungen" element={<MahnstufenEinstellungen />} />
              <Route path="rechnungen" element={<Rechnungsverwaltung />} />
              <Route path="rechnungen/:id" element={<Rechnungsverwaltung />} />
              <Route path="lastschriftlauf" element={<LastschriftManagement />} />
              <Route path="sepa-mandate" element={<SepaMandateVerwaltung />} />
              <Route path="zahllaeufe" element={<LastschriftManagement />} />

              {/* Zahlungszyklen-Management */}
              <Route path="zahlungszyklen" element={<ZahlungszyklenSeite />} />

              {/* Tarife & Preise Management */}
              <Route path="tarife" element={<TarifePreise />} />
              
              {/* Personal-Management */}
              <Route path="personal" element={<Personal />} />

              {/* Buddy-Gruppen Verwaltung */}
              <Route path="buddy-gruppen" element={<BuddyVerwaltung />} />

              {/* Auswertungen (Analytics & Reports) */}
              <Route path="auswertungen" element={<Auswertungen />} />
              <Route path="course-ratings" element={<CourseRatingAdmin />} />

              {/* Berichte & Dokumente (PDF Management) */}
              <Route path="berichte" element={<BerichteDokumente />} />

              {/* Vertrags-Dokumentenverwaltung (AGB, Datenschutz, etc.) */}
              <Route path="vertragsdokumente" element={<DokumenteVerwaltung />} />

              {/* Multi-Dojo-Verwaltung & Steuer-Tracking */}
              <Route path="dojos" element={<DojosVerwaltung />} />
              <Route path="dojos/edit/:id" element={<DojoEdit />} />
              <Route path="dojos/new" element={<DojoEdit />} />

              {/* Newsletter & Benachrichtigungssystem */}
              <Route path="notifications" element={<NotificationSystem />} />

              {/* ======== EINSTELLUNGEN ======== */}
              <Route path="einstellungen" element={<EinstellungenDojo />} />
              <Route path="einstellungen/meindojo" element={<EinstellungenDojo />} />
              <Route path="einstellungen/zahlungen" element={<ZahlungsEinstellungen />} />

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
          </BrowserRouter>
          </MitgliederUpdateProvider>
        </KursProvider>
      </DojoProvider>
    </AuthProvider>
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
