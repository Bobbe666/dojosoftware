// ============================================================================
// SYSTEM CHANGELOG
// Frontend/src/components/SystemChangelog.jsx
// Zeigt wichtige System-Updates und Änderungen an
// ============================================================================

import React, { useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import {
  Sparkles, Calendar, Zap, Shield, CreditCard, Users,
  Settings, Bug, Star, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';

// Super-Admin (kein dojo_id im Token oder super-Rolle) sieht ALLE Einträge;
// Dojo-Admins der Subdomains sehen keine 'intern'-Einträge.
const istSuperAdminScope = () => {
  try {
    const token = localStorage.getItem('dojo_auth_token');
    if (!token) return false;
    const d = jwtDecode(token);
    const role = (d.role || d.rolle || '').toString().toLowerCase();
    return d.dojo_id === null || d.dojo_id === undefined || role.includes('super');
  } catch {
    return false;
  }
};

// ============================================================================
// CHANGELOG DATEN - Hier neue Einträge hinzufügen!
// Der ERSTE Eintrag ist immer die AKTUELLE VERSION!
// ============================================================================
export const CHANGELOG = [
  {
    version: '3.0.155',
    date: '2026-07-20',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Rolle „Turnierleiter" entfernt',
    description: 'Die Rolle Turnierleiter wurde wieder aus der Software genommen — Turniere gehören nicht in die Dojo-Verwaltung, sondern auf die separate Events-Plattform. Die Rolle war neu und noch keinem Konto zugewiesen; Event-Verwaltung bleibt bei Admin und Dojoleiter.',
    highlights: [
      '🗑️ Rolle Turnierleiter aus Auswahl, Rechte-Matrix und Datenbank-Enum entfernt',
    ],
    details: 'Migration 237 (ENUM ohne turnierleiter). admins.js getRollenBerechtigungen: case turnierleiter entfernt. auth.js: aus STAFF_ROLLEN + STAFF_VERWALTBARE_ROLLEN + ORDER BY. Frontend: aus CreateUserModal + MitarbeiterRollen (ROLLEN + ZUWEISBAR). events-Area bleibt bestehen (Admin/Dojoleiter verwalten Events).',
    files: ['backend/migrations/237_admin_users_rolle_turnierleiter_raus.sql', 'backend/routes/admins.js', 'backend/routes/auth.js', 'frontend/src/components/CreateUserModal.jsx', 'frontend/src/components/MitarbeiterRollen.jsx'],
  },
  {
    version: '3.0.154',
    date: '2026-07-20',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Rollensystem Phase 8: Kurs-/Stundenplan an Rechte gebunden (Trainer nur lesen)',
    description: 'Das Anlegen, Bearbeiten und Löschen von Kursen und Stundenplan-Einträgen verlangt jetzt das Recht „Stundenplan“. Bewusste Vorgabe: Trainer dürfen den Kursplan NICHT bearbeiten (nur ansehen) — Verwaltung liegt bei Admin und Dojoleiter. Mitglieder sehen den Stundenplan wie gewohnt.',
    highlights: [
      '📅 Kurs-/Stundenplan-Verwaltung nur mit Stundenplan-Recht (Admin/Dojoleiter)',
      '🚫 Trainer können den Kursplan nicht mehr bearbeiten (nur lesen) — wie gewünscht',
      '✅ Lokal verifiziert: admin/dojoleiter/member durch, trainer/rezeption 🔒',
    ],
    details: 'routes/kurse.js (POST/PUT/DELETE) + routes/stundenplan.js (POST/PUT/DELETE) mit requireStaffPermission(stundenplan, erstellen|bearbeiten|loeschen). Keine Matrix-Änderung nötig — trainer/rezeption haben stundenplan nur lesen. Member-Bypass hält die Stundenplan-Ansicht der Mitglieder-App offen.',
    files: ['backend/routes/kurse.js', 'backend/routes/stundenplan.js'],
  },
  {
    version: '3.0.153',
    date: '2026-07-19',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Rollensystem Phase 7: Events an Rechte gebunden (neue Rolle Turnierleiter) + Prüfungen komplett',
    description: 'Neuer Rechtebereich „Events“: das Anlegen, Bearbeiten, Löschen und Verwalten von Veranstaltungen (Admin-Anmeldung, Bezahlt-Markierung, Warteliste) verlangt jetzt das Events-Recht. Turnierleiter und Dojoleiter dürfen Events verwalten, Trainer/Kassenwart nicht — die Event-Anmeldung der Mitglieder bleibt selbstverständlich offen. Außerdem sind die letzten Prüfungs-Routen (Protokolle, historische Prüfungen) abgesichert. Lokal end-to-end getestet.',
    highlights: [
      '🏆 Event-Verwaltung nur mit Events-Recht (Turnierleiter/Dojoleiter/Admin)',
      '🆕 Rechtebereich „Events“ in allen Rollen hinterlegt',
      '🎓 Prüfungs-Protokolle & Historie abgesichert — Prüfungs-Domäne vollständig',
      '✅ Lokal verifiziert: member/admin/turnierleiter durch, trainer/kassenwart 🔒',
    ],
    details: 'admins.js getRollenBerechtigungen: neue events-Area in allen 12 Rollen-Matrizen (turnierleiter/dojoleiter/admin voll, trainer/rezeption/mitarbeiter nur lesen, kassenwart/pruefer none). events.js: POST / (erstellen), PUT/DELETE /:id, admin-anmelden, anmeldung/bezahlt, warteliste/promote mit requireStaffPermission(events,…) zusätzlich zu requireFeature(events). pruefungen/historie.js (historisch POST/DELETE) + protokoll.js (protokoll POST/senden/ins-dashboard) mit requireStaffPermission(pruefungen,…). Member-Routen (anmelden/abmelden/payment) offen. OFFEN Phase 8: Kurse (stundenplan, Trainer-Policy klären), Area verkauf/shop, Alt-UI-Reste, Elternzugang/Mitglied.',
    files: ['backend/routes/admins.js', 'backend/routes/events.js', 'backend/routes/pruefungen/historie.js', 'backend/routes/pruefungen/protokoll.js'],
  },
  {
    version: '3.0.152',
    date: '2026-07-19',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Rollensystem Phase 6: Prüfungs-Rechte vollständig (Kandidaten + Termine)',
    description: 'Die Rechteprüfung für Prüfungen ist jetzt vollständig: auch Kandidaten-Verwaltung (zulassen, externe Teilnehmer, Gebühren, Erinnerungen, Admin-Status) und Prüfungstermine (anlegen/ändern/löschen/Anmeldungen) verlangen das Recht „Prüfungen“. Mitglieder-Aktionen (Zusage, gelesen, Teilnahme bestätigen) bleiben offen. Lokal end-to-end getestet: Kassenwart wird geblockt, Prüfer/Trainer/Admin und Mitglieder kommen durch.',
    highlights: [
      '🎓 Kandidaten- & Termin-Verwaltung an das Prüfungs-Recht gebunden (17 Routen gesamt)',
      '✅ Lokal gegen laufendes Backend verifiziert (member/admin/prüfer durch, kassenwart 🔒)',
    ],
    details: 'routes/pruefungen/kandidaten.js: /extern (erstellen), /:mitglied_id/zulassen (bearbeiten), /:mitglied_id/zulassung/:pruefung_id DELETE (loeschen), /admin-status, /gebuehr-bar|null|auto, /erinnerung-ohne-antwort (bearbeiten) mit requireStaffPermission. termine.js: POST/PUT/DELETE + anmeldungen-PUT. Member-Routen (antwort/gelesen/teilnahme-bestaetigen) bewusst offen. OFFEN Phase 7: Kurse (stundenplan) + Events (neue events-Area) für Turnier­leiter; Areas events/verkauf; Alt-UI-Reste.',
    files: ['backend/routes/pruefungen/kandidaten.js', 'backend/routes/pruefungen/termine.js'],
  },
  {
    version: '3.0.151',
    date: '2026-07-19',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Rollensystem Phase 5: Prüfungs-Management an Rechte gebunden (member-sicher)',
    description: 'Das Erstellen, Bearbeiten, Löschen, Statusändern und Bewerten von Prüfungen verlangt jetzt das Recht „Prüfungen“. Der Clou: eine member-bewusste Prüfung — Mitglieder (die dieselben Endpunkte für ihre eigenen Prüfungen nutzen) werden unverändert durchgelassen, nur Mitarbeiter-Rollen werden geprüft. Prüfer, Trainer und Dojoleiter dürfen Prüfungen verwalten, Kassenwart/Rezeption nicht. Bestehende Trainer verlieren nichts (Fallback auf die aktuellen Rollen-Standardrechte, kein Datenumzug nötig).',
    highlights: [
      '🎓 Prüfungs-Verwaltung (anlegen/ändern/löschen/bewerten) nur mit Prüfungs-Recht',
      '👥 Member-sicher: Mitglieder-App unberührt (Mitglieder-Zugriff läuft weiter)',
      '↩️ Keine Regression für bestehende Trainer (Default-Rechte-Fallback, kein Backfill)',
    ],
    details: 'middleware/auth.js: neue requireStaffPermission(bereich, aktion) — Mitglieder (users-Tabelle, keine berechtigungen im Token) + super_admin/admin passieren; admin_users-Staff werden gegen gespeicherte berechtigungen ODER aktuelle Rollen-Defaults (getRollenBerechtigungen, lazy) geprüft (deckt veraltete stored-Werte). routes/pruefungen/crud.js: POST / (erstellen), PUT /:id (bearbeiten), DELETE /:id (loeschen), POST /:id/status-aendern + /:id/bewertungen (bearbeiten) damit gegated. OFFEN: weitere Prüfungs-Schreibrouten (kandidaten/termine/protokoll) + Kurse/Events analog; neue Areas events/verkauf.',
    files: ['backend/middleware/auth.js', 'backend/routes/pruefungen/crud.js'],
  },
  {
    version: '3.0.150',
    date: '2026-07-19',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Rollensystem Phase 4: Audit-Log-Einsicht für Dojoleiter',
    description: 'Das Änderungsprotokoll (Audit-Log) ist jetzt an das Recht „Admin-Bereich“ gebunden statt an einen pauschalen Admin-Check: Rollen mit Leserecht auf den Admin-Bereich (z. B. Dojoleiter) können das Protokoll einsehen; Löschen/Bereinigen bleibt Inhaber/Super-Admin vorbehalten. Rein additiv — niemand verliert Zugriff.',
    highlights: [
      '🗂️ Dojoleiter dürfen das Audit-Log lesen (Einsicht wer-was-geändert)',
      '🔒 Löschen/Bereinigen des Protokolls weiterhin nur Admin/Super-Admin',
    ],
    details: 'routes/audit-log.js: lokales requireAdmin ersetzt durch requirePermission — Lese-Routen (admins.lesen), Lösch-/Bereinigungs-Routen (admins.loeschen). WICHTIGER BEFUND: Die Kern-Domänen Prüfungen/Kurse/Events sind KEINE reinen Admin-Bereiche — die Mitglieder-App nutzt dieselben Endpunkte (z. B. GET /pruefungen, Prüfungs-Zusagen). Ein pauschales Gate würde die Mitglieder-App brechen. Echtes Enforcement dort erfordert Trennung member-/staff-Endpunkte bzw. Gates pro einzelner Schreibroute (eigene Etappe). verletzungen.js NICHT konvertiert (lokales requireAdmin erlaubt auch eingeschraenkt → wäre Regression).',
    files: ['backend/routes/audit-log.js'],
  },
  {
    version: '3.0.149',
    date: '2026-07-19',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Rollensystem Phase 3: Rechteprüfung auch bei Tariferhöhungen',
    description: 'Die serverseitige Rechteprüfung wird über die Buchhaltung hinaus ausgeweitet: Tariferhöhungs-Aktionen (Vorschau, Massenerhöhung, Terminierung anlegen/löschen, Benachrichtigungen) verlangen jetzt Finanz-Rechte statt eines pauschalen Admin-Checks. Inhaber/Admins haben weiterhin vollen Zugriff; ein Kassenwart oder Dojoleiter kann diese Finanzaktionen jetzt ebenfalls ausführen, Trainer/Prüfer/Rezeption nicht. Rein additiv — niemand verliert bestehenden Zugriff.',
    highlights: [
      '💶 Tariferhöhungen an das Recht „Finanzen“ gebunden (lesen/bearbeiten/löschen)',
      '➕ Additiv: Admin/Super-Admin unverändert, granulare Finanz-Rollen erhalten Zugang',
    ],
    details: 'middleware/auth.js: neuer Boolean-Helfer hasPermission(req, bereich, aktion) (requirePermission nutzt ihn nun). routes/mitglieder.js: 6 Inline-Checks der /filter/tarif-abweichung/*-Routen von „role !== admin“ auf hasPermission(finanzen, lesen|bearbeiten|loeschen) umgestellt. OFFEN (Phase 4): Enforcement auf Prüfungen/Events/Mitglieder-CRUD — diese Routen sind nicht einheitlich gegatet, brauchen Gates pro Route (sorgfältig, da teils bisher ungegatet).',
    files: ['backend/middleware/auth.js', 'backend/routes/mitglieder.js'],
  },
  {
    version: '3.0.148',
    date: '2026-07-19',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Rollensystem Phase 2: Mitarbeiter-&-Rechte-Verwaltung',
    description: 'Neue Verwaltungsfläche „Mitarbeiter & Rechte“ unter Dojo → Admin-Accounts. Zeigt alle Mitarbeiter-Accounts mit Rolle und einer Rechte-Kurzfassung. Dojo-Admins können ihre eigenen Mitarbeiter anlegen, die Rolle ändern (setzt automatisch die Standard-Rechte der Rolle), aktiv/inaktiv schalten, das Passwort zurücksetzen und löschen — alles auf das eigene Dojo beschränkt. Damit sind die in Phase 1 eingeführten granularen Rollen erstmals vollständig über die Oberfläche verwaltbar.',
    highlights: [
      '🧑‍💼 „Mitarbeiter & Rechte“-Fläche mit Rollen-Badges + Rechte-Chips',
      '🔁 Rolle ändern setzt Standard-Rechte; aktiv/inaktiv, Passwort-Reset, Löschen',
      '🏠 Dojo-scoped: jeder Admin verwaltet nur eigene Mitarbeiter',
      '🛡️ Priv-Escalation-Schutz: Hochstufung zu Admin nur durch Super-Admin, Super-Admin unantastbar',
    ],
    details: 'Backend auth.js: neue dojo-scoped Routen GET/PUT/DELETE /api/auth/staff + POST /api/auth/staff/:id/password (admin_users; Guards: eigenes Dojo, kein Self-Delete, super_admin unantastbar, Admin-Hochstufung nur Super-Admin; Audit RECHTE_GEAENDERT/PASSWORT_GEAENDERT/USER_GELOESCHT). Frontend: neue Komponente MitarbeiterRollen.jsx, eingehängt in DojoEdit.jsx (Sektion Admin-Accounts) über der bestehenden AdminVerwaltung; nutzt CreateUserModal fürs Anlegen. OFFEN: Enforcement über Finanzen hinaus ausweiten (weitere Domänen), Zwei-Tabellen-Reconciliation der Alt-UI.',
    files: ['backend/routes/auth.js', 'frontend/src/components/MitarbeiterRollen.jsx', 'frontend/src/components/DojoEdit.jsx'],
  },
  {
    version: '3.0.147',
    date: '2026-07-19',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Rollensystem Phase 1: ERP-Rollen + serverseitige Rechteprüfung (Finanzen)',
    description: 'Fundament für ein feingranulares Rollen-/Rechtesystem. Neue Mitarbeiter-Rollen (Dojoleiter, Assistenztrainer, Kassenwart, Prüfer, Turnierleiter, Rezeption) mit je hinterlegten Standard-Rechten. Solche Mitarbeiter werden jetzt korrekt als Staff-Account (admin_users) mit Rechten angelegt und lassen sich im „Mitarbeiter anlegen“-Dialog auswählen. Erstmals werden Rechte auch serverseitig durchgesetzt: die Finanz-/Buchhaltungs-Routen verlangen jetzt das Recht „Finanzen: lesen“ — Inhaber/Admins haben weiterhin vollen Zugriff, ein Kassenwart kommt rein, Trainer/Prüfer/Rezeption nicht.',
    highlights: [
      '🧑‍💼 6 neue Mitarbeiter-Rollen mit Standard-Rechten',
      '🔐 Serverseitige Rechteprüfung (requirePermission) — zuerst auf Finanzen scharf',
      '🛡️ Betreiber-Bypass: Admin/Super-Admin nie ausgesperrt',
      '🗂️ Granulare Mitarbeiter landen jetzt in der richtigen Tabelle (admin_users) mit Rechten',
    ],
    details: 'Migration 235 (admin_users.rolle ENUM +6 Rollen). admins.js getRollenBerechtigungen um neue Rollen + trainer/checkin erweitert und exportiert. middleware/auth.js requirePermission(bereich, aktion) — liest per-User berechtigungen aus dem Token, super_admin/admin bypass. server.js: /api/buchhaltung (+afa,+kasse) mit requirePermission(finanzen,lesen). auth.js POST /users routet die 6 Staff-Rollen nach admin_users (berechtigungen aus getRollenBerechtigungen, dojo_id des Anlegenden, Audit USER_ERSTELLT); Legacy/member unverändert. CreateUserModal: neue Rollen wählbar. OFFEN Phase 2: volle Staff-Verwaltungs-UI (Liste/Bearbeiten der admin_users-Rollen, Rollen-Tabs), Enforcement auf weitere Domänen, Zwei-Tabellen-Reconciliation.',
    files: ['backend/migrations/235_admin_users_rolle_erp_rollen.sql', 'backend/routes/admins.js', 'backend/middleware/auth.js', 'backend/server.js', 'backend/routes/auth.js', 'frontend/src/components/CreateUserModal.jsx'],
  },
  {
    version: '3.0.146',
    date: '2026-07-19',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Coach-App: Offline, Installation, Bottom-Nav & native Dialoge',
    description: 'Reifegrad-Ausbau der Trainer-App: Stunden/Anfragen werden für den Offline-Fall zwischengespeichert (zuletzt geladener Stand statt leerer Liste), es gibt einen Installations-Hinweis (inkl. iOS-Anleitung, Voraussetzung für Push) und die Push-Aktivierung direkt im Dashboard. Neue untere Navigationsleiste für schnelle Einhandbedienung, native Bestätigungs-Dialoge statt Browser-Popups, Zeitzonen-Bug bei „Heute/Morgen“ behoben und externe App-Links zentral konfigurierbar.',
    highlights: [
      '📴 Offline-Zwischenspeicher für Stunden & Vertretungsanfragen (Workbox NetworkFirst)',
      '📲 Installations-Banner (Android + iOS-Anleitung) & Push-Aktivierung im Dashboard',
      '🧭 Untere Navigationsleiste + native Bestätigungs-Dialoge',
      '🕒 Zeitzonen-Fix „Heute/Morgen“ (lokal statt UTC), App-Links per Env konfigurierbar',
    ],
    details: 'Coach-App (dojo-coach, nicht versioniert): vite.config.js runtimeCaching (GET /api, NetworkFirst, 5s Timeout); components/InstallPrompt.jsx (beforeinstallprompt + iOS-Standalone-Erkennung, dismissbar); components/ConfirmProvider.jsx (promise-basiertes useConfirm-Modal) ersetzt window.confirm in VertretungSuchen; components/BottomNav.jsx + Shell-Integration in App.jsx; Dashboard.jsx nutzt config.js (APP_URLS, Env-Override) statt hartcodierter URLs, plus Install-/Push-Banner; VertretungSuchen heuteISO/morgenISO auf lokale Zeit; styles.css (bottomnav/install-banner/modal/btn-danger). Coach-App v1.2.0. Kein Backend-Change.',
    files: ['dojo-coach/vite.config.js', 'dojo-coach/src/components/InstallPrompt.jsx', 'dojo-coach/src/components/ConfirmProvider.jsx', 'dojo-coach/src/components/BottomNav.jsx', 'dojo-coach/src/config.js', 'dojo-coach/src/pages/Dashboard.jsx', 'dojo-coach/src/modules/VertretungSuchen.jsx'],
  },
  {
    version: '3.0.145',
    date: '2026-07-19',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Coach-App: Vertretung mit Mehrfach-Zusage, Sicherheits- & Resilienz-Fixes',
    description: 'Die Trainer-App (coach.tda-intl.org) wurde ausgebaut und abgesichert. Bei der Vertretersuche lässt sich pro Anfrage wählen, ob nur EIN Trainer zusagen darf (first-come, wie bisher) ODER MEHRERE Trainer für dieselbe Stunde. Trainer sehen ihre Zusagen unter „Meine Vertretungen" und können eine Mehrfach-Zusage selbst zurückziehen. Zusätzlich: Tenant-Sicherheitsfix, echtes 401-/Fehler-Handling und Audit-Logging aller Vertretungs-Aktionen.',
    highlights: [
      '👥 Mehrfach-Zusage pro Anfrage konfigurierbar (eine vs. mehrere Zusagen)',
      '🗂️ „Meine Vertretungen“-Übersicht + Zusage zurückziehen',
      '🔒 Tenant-Leak (hartes Dojo-3-Default) behoben, Enterprise-Gate auf allen Coach-Routen',
      '🛡️ Audit-Log für Anfrage/Zusage/Storno; 401-Auto-Logout & Fehler-States in der App',
    ],
    details: 'Migration 234 (vertretungs_anfragen.zusage_modus ENUM einzel/mehrfach + Tabelle vertretungs_zusagen mit UNIQUE(anfrage_id,admin_id) + Backfill übernommener Anfragen). Backend routes/coach.js: neue requireCoachAccess-Middleware (getSecureDojoId statt || 3, feature_trainer_app auch auf Daten-Routen), uebernehmen verzweigt einzel/mehrfach, neue Route zusage-zurueckziehen, GET liefert zusagen/hat_zugesagt. auditLogService: Kategorie TRAINING + VERTRETUNG_*-Aktionen. Coach-App (dojo-coach): api.js Response-Interceptor (401→Logout-Event), AuthContext sessionExpired, ErrorBoundary, VertretungSuchen Modus-Umschalter + Zusagen-Anzeige + „Meine Vertretungen“, Versions-Fußzeile (v1.1.0).',
    files: ['backend/routes/coach.js', 'backend/services/auditLogService.js', 'backend/migrations/234_vertretung_mehrfach_zusage.sql', 'dojo-coach/src/api.js', 'dojo-coach/src/context/AuthContext.jsx', 'dojo-coach/src/components/ErrorBoundary.jsx', 'dojo-coach/src/modules/VertretungSuchen.jsx'],
  },
  {
    version: '3.0.144',
    date: '2026-07-10',
    type: 'feature',
    zielgruppe: 'allgemein',
    title: 'Event-Anmeldung für mehrere Personen mit Kategorie (Erwachsener/Kind)',
    description: 'Events können jetzt einen zweiten Preis für Kinder/Jugendliche haben (Feld „Preis Kind" pro Event). Bei der Anmeldung – sowohl in der Mitglieder-App als auch über die öffentliche Gast-Anmeldung – lassen sich mit „+ Person hinzufügen" mehrere Teilnehmer in EINER Anmeldung erfassen, jeweils mit Auswahl „Erwachsener" oder „Kind". Der Gesamtbetrag wird live aus den Kategorien summiert und für die Zahlung übernommen. Ideal z. B. für Camps, bei denen ein Elternteil sich + die Kinder anmeldet.',
    highlights: [
      '👥 Mehrere Personen pro Anmeldung („+ Person hinzufügen")',
      '🧒 Kategorie Erwachsener/Kind mit eigenem Preis pro Event',
      '💶 Live-Gesamtbetrag + korrekte Stripe-Zahlung',
    ],
    details: 'Migration 225 (events.preis_kind, event_anmeldungen/event_gaeste: teilnehmer JSON + gesamt_betrag). events.js: Helper berechneTeilnehmer(), preis_kind in POST/PUT/oeffentlich, teilnehmer+gesamt_betrag in Mitglieds- und Gast-Anmeldung, create-payment-intent nutzt gesamt_betrag. Alte doppelte /anmelden-Route entfernt (überdeckte die vollständige Route). Frontend: Events.jsx (Feld Preis Kind), MemberEvents.jsx + EventGastAnmeldung.jsx (Teilnehmer-Repeater), EventPaymentCheckout.jsx (Betrag aus PaymentIntent).',
    files: ['backend/routes/events.js', 'backend/migrations/225_event_teilnehmer_kategorien.sql', 'frontend/src/components/Events.jsx', 'frontend/src/components/MemberEvents.jsx', 'frontend/src/components/EventGastAnmeldung.jsx', 'frontend/src/components/EventPaymentCheckout.jsx'],
  },
  {
    version: '3.0.143',
    date: '2026-07-09',
    type: 'feature',
    zielgruppe: 'allgemein',
    title: 'Check-in Gürtel-Filter + alle Filter direkt in der Kursverwaltung',
    description: 'Neuer Gürtel-Filter beim Check-in: Pro Kurs legst du „Gürtel von/bis" fest (aus den Graduierungen des Stils), und Mitglieder sehen beim Einchecken zuerst nur die zu ihrem Grad passenden Kurse. Über „🔎 Alle Kurse anzeigen" können sie jederzeit trotzdem jeden anderen Kurs wählen (und mit „← Nur passende Kurse" wieder einklappen). Alle drei Filter (Stil/Alter/Gürtel) lassen sich jetzt auch direkt in der Kursverwaltung ein-/ausschalten, zusätzlich zu Einstellungen → Check-in.',
    highlights: [
      '🎗️ Check-in Gürtel-Filter (pro Kurs Gürtel von/bis)',
      '🔎 „Alle Kurse anzeigen" — trotz Filter jeden Kurs wählbar',
      '🎛️ Stil-/Alter-/Gürtel-Schalter direkt in der Kursverwaltung',
    ],
    details: 'Migration 224 (kurse.min/max_graduierung_id, checkin_einstellungen.guertel_filter_aktiv). kurse.js, checkin.js (courses-today Grad-Stufen + member-graduierungen), checkin-einstellungen (3 Flags), Kurse.jsx (Belt-Dropdowns aus /stile-Graduierungen + 3 Toggles), CheckinEinstellungen.jsx (3. Toggle), MemberCheckin.jsx (Gürtel-Filter via member-graduierungen).',
    files: ['backend/routes/kurse.js', 'backend/routes/checkin.js', 'backend/routes/checkin-einstellungen.js', 'frontend/src/components/Kurse.jsx', 'frontend/src/components/CheckinEinstellungen.jsx', 'frontend/src/components/MemberCheckin.jsx'],
  },
  {
    version: '3.0.141',
    date: '2026-07-09',
    type: 'improvement',
    zielgruppe: 'allgemein',
    title: 'Kursverwaltung: Alters-Filter-Schalter direkt dort',
    description: 'Der Check-in-Alters-Filter lässt sich jetzt auch direkt in der Kursverwaltung ein-/ausschalten (oben rechts, als Kopie des Schalters aus Einstellungen → Check-in) — praktisch, weil man dort auch das Min-/Max-Alter je Kurs pflegt. Die Alters-Felder (ab/bis) sind beim Anlegen und Bearbeiten eines Kurses vorhanden.',
    highlights: ['🎂 Alters-Filter-Schalter direkt in der Kursverwaltung'],
    details: 'Kurse.jsx: Toggle lädt/speichert /api/checkin-einstellungen (beide Flags), oben rechts im Kurse-Tab.',
    files: ['frontend/src/components/Kurse.jsx'],
  },
  {
    version: '3.0.140',
    date: '2026-07-08',
    type: 'feature',
    zielgruppe: 'allgemein',
    title: 'Check-in: optionaler Alters-Filter (pro Dojo)',
    description: 'Neu unter Einstellungen → Check-in: Wenn aktiviert, sieht ein Mitglied beim Einchecken zuerst nur Kurse, deren Altersbereich zu seinem Alter passt — kombinierbar mit dem Stil-Filter, plus „Weitere Kurse anzeigen". Das Min-/Max-Alter legst du je Kurs in der Kursverwaltung fest; Kurse ohne Altersangabe gelten für alle.',
    highlights: [
      '🎂 Check-in zeigt zuerst nur alterspassende Kurse (optional)',
      '🎛️ Kombinierbar mit dem Stil-Filter',
      '⚙️ Min-/Max-Alter je Kurs in der Kursverwaltung',
    ],
    details: 'Migration 222 (kurse.min_alter/max_alter) + 223 (checkin_einstellungen.alter_filter_aktiv). kurse.js create/update/GET, checkin.js courses-today, checkin-einstellungen route (beide Toggles), Kurse.jsx (Alters-Felder), CheckinEinstellungen.jsx (2. Toggle), MemberCheckin.jsx (Alter aus geburtsdatum, kombinierter Filter).',
    files: ['backend/routes/kurse.js', 'backend/routes/checkin.js', 'backend/routes/checkin-einstellungen.js', 'frontend/src/components/Kurse.jsx', 'frontend/src/components/CheckinEinstellungen.jsx', 'frontend/src/components/MemberCheckin.jsx'],
  },
  {
    version: '3.0.139',
    date: '2026-07-08',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Alle Mitglieder-App-Popups liegen jetzt über der Navileiste',
    description: 'Nach dem Check-in-Fix (v3.0.138) wurden vorsorglich alle übrigen Popups/Modals der Mitglieder-App auf dieselbe Technik umgestellt. Vorher konnten auch sie am unteren Rand von der Navigationsleiste verdeckt werden. Betroffen waren u.a. News-Popup, Umfrage-Popup, Stil-Auswahl, Event- und Push-Benachrichtigungen, Prüfungseinladung/-anmeldung sowie der Protokoll-Viewer.',
    highlights: ['🔝 11 Popups/Modals via Portal über der Navileiste', '📲 Buttons am unteren Rand überall erreichbar', '🧹 Einheitliche Modal-Technik (createPortal an document.body)'],
    details: 'Stacking-Context-Falle systematisch beseitigt: alle Vollbild-Overlays der Mitglieder-App (MemberDashboard-Baum) via ReactDOM.createPortal(..., document.body) gerendert. Umgestellt: 7 Komponenten (NewsPopup, UmfragePopup [beide Return-Zweige], StilAuswahlModal, EventNotificationPopup, PushNotificationPopup, PruefungsEinladungPopup, MemberNewsWidget→MemberNewsModal) + 4 inline in MemberDashboard.jsx (App-Onboarding, „Weiterlesen"-Notif, Prüfungsanmeldung, Protokoll-Viewer). MemberCheckin war bereits umgestellt (v3.0.138). Alle Overlay-z-index (2000–10000) > .mobile-bottom-nav (1000) → Portal genügt.',
    files: ['frontend/src/components/NewsPopup.jsx', 'frontend/src/components/UmfragePopup.jsx', 'frontend/src/components/StilAuswahlModal.jsx', 'frontend/src/components/EventNotificationPopup.jsx', 'frontend/src/components/PushNotificationPopup.jsx', 'frontend/src/components/PruefungsEinladungPopup.jsx', 'frontend/src/components/MemberNewsWidget.jsx', 'frontend/src/components/MemberDashboard.jsx'],
  },
  {
    version: '3.0.138',
    date: '2026-07-08',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Check-in am Handy: Anmelden-Button war hinter der Navileiste versteckt',
    description: 'Beim Check-in in der Mitglieder-App verdeckte die untere Navigationsleiste den unteren Teil des Fensters – der „Weiter/Anmelden"-Button und der letzte Kurs waren nicht erreichbar, das Fenster wirkte „nicht scrollbar". Ursache: Das Check-in-Fenster wurde im Seiten-Baum gerendert und saß dadurch trotz hohem z-index unter der fixierten Navileiste. Es wird jetzt per Portal ganz oben angezeigt und liegt sauber über der Navileiste.',
    highlights: ['📲 Anmelden-Button wieder erreichbar', '🧭 Check-in-Fenster liegt über der Navileiste', '🔝 Modal via createPortal an document.body'],
    details: 'MemberCheckin.jsx: beide Return-Zweige via ReactDOM.createPortal(..., document.body) gerendert. Vorher wurde das Modal inline in MemberDashboard (Zeile ~3094) gerendert → gefangen in einem Stacking-Context, dessen Paint-Reihenfolge unter .mobile-bottom-nav (z-index 1000) lag, obwohl das Overlay z-index 9999 hat (im Screenshot war die Navileiste als Einzige nicht abgedunkelt = Beweis). Portal hebt das Modal auf Body-Ebene → 9999 schlägt 1000.',
    files: ['frontend/src/components/MemberCheckin.jsx'],
  },
  {
    version: '3.0.137',
    date: '2026-07-08',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Chat: Eingabefeld-Text war je nach Theme unsichtbar',
    description: 'Im Chat konnten Mitglieder das Eingabefeld bzw. den getippten Text nicht sehen. Ursache: Feld-Hintergrund und Textfarbe kamen aus zwei unabhängigen Theme-Ebenen, die getrennt umgeschaltet werden – sie konnten kollidieren (z.B. dunkler Text auf dunklem Feld oder heller Text auf hellem Feld). Das Feld nutzt jetzt ein garantiert zusammenpassendes Farbpaar und ist in jedem Theme lesbar.',
    highlights: ['👀 Getippter Text ist wieder sichtbar', '🎨 Feld-Hintergrund + Textfarbe aus demselben ds-mode-Paar', '📱 iOS: kein Auto-Zoom mehr (16px), Cursor & Placeholder sichtbar'],
    details: 'Chat.css .chat-input: background von --bg-primary (Body-Ebene) → --ds-bg-input, color von --text-primary (Branding-Ebene) → --ds-text; beide Tokens werden pro data-ds-mode (dark/hell/washi) GEMEINSAM definiert und passen daher immer zusammen. Zusätzlich: -webkit-text-fill-color explizit gesetzt (iOS/Safari überschrieb color sonst teils mit transparent), caret-color, ::placeholder-Farbe (--ds-text-muted) und font-size 16px gegen iOS-Fokus-Zoom. Gilt für Admin-Messenger und Mitglieder-App.',
    files: ['frontend/src/styles/Chat.css'],
  },
  {
    version: '3.0.136',
    date: '2026-07-08',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Dojo-Einstellungen speichern wieder (Datums-Fehler behoben)',
    description: 'Beim Speichern der grundlegenden Dojo-Informationen brach der Vorgang mit einem roten „Serverfehler beim Aktualisieren: Incorrect datetime value" ab. Ursache: das automatisch verwaltete Registrierungsdatum wurde als ISO-Zeitstempel zurück an die Datenbank geschickt, die dieses Format ablehnt. Das Speichern funktioniert jetzt wieder normal.',
    highlights: ['💾 Dojo-Stammdaten lassen sich wieder speichern', '🐛 „Incorrect datetime value" bei registration_date behoben', '🔒 Read-only-Felder werden nicht mehr mitgeschickt'],
    details: 'EinstellungenDojo.handleSave sendete { ...dojo } inkl. registration_date als ISO-String (…T…Z) an PUT /api/dojo; MySQL DATETIME lehnt das T/Z-Format ab. Doppelt abgesichert: (1) Frontend filtert Read-only-/Auto-Felder (id, created_at, updated_at, aktualisiert_am, last_backup, registration_date, ist_aktiv, ist_hauptdojo) vor dem Senden raus. (2) Backend (einstellungendojo.js + dojos.js) normalisiert ISO-8601-Strings zu MySQL-Format (YYYY-MM-DD HH:MM:SS) vor dem UPDATE – deckt registration_date und jedes weitere Datumsfeld ab.',
    files: ['frontend/src/components/EinstellungenDojo.jsx', 'backend/routes/einstellungendojo.js', 'backend/routes/dojos.js'],
  },
  {
    version: '3.0.135',
    date: '2026-07-07',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'E-Mail-Archiv pro Kunde in der Lizenzverwaltung',
    description: 'Jede an einen Dojo-Kunden versendete E-Mail wird ab sofort automatisch als Kopie am Kundenaccount abgelegt und ist in der Lizenz-Detailansicht („Gesendete E-Mails") mit Vorschau einsehbar. Zusätzlich: Header aller System-Mails auf das Software-Layout vereinheitlicht und zwei stille Versand-Bugs (Zahlungserinnerung, Event-Anmeldung) behoben.',
    highlights: ['📧 Alle Kundenmails als Kopie am Account (mit HTML-Vorschau)', '🔧 Zahlungserinnerung & Event-Anmeldebestätigung: Versand-Bug behoben', '🎨 Einheitliche Mail-Header'],
    details: 'Neue Tabelle dojo_email_archive (Migration 217) + services/emailArchive.js; Hook in sendEmail/sendEmailForDojo (fire-and-forget, dojo_id via archiveDojoId oder Empfänger-Mail). Endpoints GET /admin/dojos/:id/emails(+/:emailId). UI-Sektion + iframe-Viewer in LizenzDetailsTab. sendPaymentReminderEmail/sendEventRegistrationEmail: invertierte sendEmailForDojo-Parameter korrigiert.',
    files: ['backend/services/emailArchive.js', 'backend/services/emailService.js', 'backend/services/emailTemplates.js', 'backend/routes/admin.js', 'backend/server.js', 'frontend/src/components/LizenzDetailsTab.jsx'],
  },
  {
    version: '3.0.134',
    date: '2026-07-07',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Lizenz-Details öffnen wieder (Crash behoben)',
    description: 'Beim Klick auf „Details" eines Dojos in der Lizenzverwaltung stürzte die Detail-Ansicht ab und warf einen auf die „Heute"-Seite. Ursache: fehlende Plan-Konstanten (PLAN_HIERARCHY/COLORS/NAMES/PRICES) in der ausgelagerten Detail-Komponente. Jetzt ergänzt – Plan-Wechsel-Ansicht öffnet wieder normal.',
    highlights: ['🐛 „Details" öffnet die Plan-Verwaltung statt zur Heute-Seite zu springen', '🔧 Fehlende Plan-Konstanten in LizenzDetailsTab ergänzt'],
    details: 'LizenzDetailsTab.jsx nutzte PLAN_HIERARCHY/COLORS/NAMES/PRICES ohne Import/Definition → Object.keys(undefined) crash → ErrorBoundary → /dashboard. Konstanten lokal definiert.',
    files: ['frontend/src/components/LizenzDetailsTab.jsx'],
  },
  {
    version: '3.0.133',
    date: '2026-07-06',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Lizenzverwaltung zeigt jetzt alle Kunden (auch mit eigenem Admin)',
    description: 'In der Super-Admin-Lizenzverwaltung fehlten selbstverwaltete Lizenz-Kunden (Dojos mit eigenem Admin, z.B. Trials), weil die Liste aus einem Endpoint kam, der diese bewusst ausblendet. Die Lizenzverwaltung lädt jetzt alle aktiven Dojos.',
    highlights: ['🥋 Alle Kunden-Dojos in der Lizenzverwaltung sichtbar', '🔧 Plan pro Kunde im Details-Tab umstellbar'],
    details: 'admin.js GET /admin/dojos: opt-in ?scope=all (nur Super-Admin) hebt den Lizenz-Kunden-Ausschluss auf. DojoLizenzverwaltung.loadDojos nutzt scope=all. Andere Consumer (Default) unverändert.',
    files: ['backend/routes/admin.js', 'frontend/src/components/DojoLizenzverwaltung.jsx'],
  },
  {
    version: '3.0.132',
    date: '2026-07-04',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Besucher-Chat-KI: keine erfundenen Tarife/Preise mehr',
    description: 'Die Chat-KI (Sensei Kenji) hatte eine nicht existierende Familienmitgliedschaft samt Preis und "ohne Laufzeit" angeboten. Der System-Prompt untersagt jetzt strikt jede Nennung von Tarifen, Preisen oder Laufzeiten, die nicht wörtlich in den hinterlegten Dojo-Tarifen stehen.',
    highlights: ['🔒 Nur real hinterlegte Preise pro Dojo', '🚫 Keine erfundene Familien-/Geschwister-Mitgliedschaft', '↪️ Individuelle Konditionen → Verweis ans Team', '🐞 Async-Fehler werden jetzt ans Backend gemeldet'],
    details: 'visitor-chat.js sendAIReply: Preis-Sektion des System-Prompts zu "STRIKTE REGELN" verschärft – nur wörtliche Tarife aus "## Mitgliedsbeiträge", kein Schätzen/Runden/Erfinden, keine "ohne Laufzeit"-Behauptung ohne Datengrundlage, im Zweifel ans Team verweisen. Tarife werden weiterhin dojo-spezifisch aus tarife (active=1, nicht archiviert) geladen; Familien-Tarife bleiben gefiltert. Zusätzlich: main.jsx globaler window.onerror + unhandledrejection-Catcher → /api/errors/report (gedrosselt), um bisher unsichtbare Async-Abstürze (z.B. schwarzer Bildschirm beim Senden im Chat) im Server-Log sichtbar zu machen.',
    files: ['backend/routes/visitor-chat.js', 'frontend/src/main.jsx'],
  },
  {
    version: '3.0.131',
    date: '2026-07-03',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Ruhepause: Vertragsende-Verlängerung auch beim direkten Vertrags-Edit',
    description: 'Die automatische Vertragsende-Verlängerung um die Pausendauer greift jetzt auch, wenn eine Ruhepause direkt im Vertrag (nicht über den Genehmigen-Weg) gesetzt wird – aber nur beim erstmaligen Setzen, nicht bei normalen Vertrags-Bearbeitungen.',
    highlights: ['📅 Verlängerung auch im generischen Vertrags-Editor', '🛡️ Kein Doppel-Verschieben bei normalen Edits'],
    details: 'vertraege/crud.js PUT /:id: erkennt erstmalige Ruhepause (vorher ruhepause_von NULL) → DATE_ADD(vertragsende, Dauer). Ergänzt vertrag-anpassungen /genehmigen aus v3.0.130.',
    files: ['backend/routes/vertraege/crud.js'],
  },
  {
    version: '3.0.130',
    date: '2026-07-03',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Ruhepause verlängert jetzt automatisch das Vertragsende',
    description: 'Beim Genehmigen einer Ruhepause wird das Vertragsende automatisch um die Pausendauer nach hinten geschoben (nur bei fixem Vertragsende, kein Doppel-Verschieben bei erneuter Genehmigung). Bestehende Ruhepause-Mitglieder wurden einmalig entsprechend nachgezogen.',
    highlights: ['📅 Vertragsende wird um die Pausendauer verlängert', '🔁 Automatisch beim Genehmigen der Ruhepause'],
    details: 'vertrag-anpassungen.js /:id/genehmigen (typ ruhepause): DATE_ADD(vertragsende, INTERVAL Pausendauer MONTH), Guard a.status<>genehmigt. Altbestand (Clara +6, Vlad +2, Franz +4, Stefanie +12, Sascha +2) auf DB nachgezogen.',
    files: ['backend/routes/vertrag-anpassungen.js'],
  },
  {
    version: '3.0.129',
    date: '2026-07-03',
    type: 'feature',
    zielgruppe: 'allgemein',
    title: 'Subdomain-Startseite: Besucher landen automatisch auf der Landingpage',
    description: 'Ruft ein nicht eingeloggter Besucher die Subdomain direkt auf (<dojo>.dojo.tda-intl.org), landet er automatisch auf der veröffentlichten Landingpage (/willkommen) — sofern eine existiert. Eingeloggte kommen wie gewohnt in die App; Dojos ohne Homepage bleiben unverändert. Mitglieder finden auf der Landingpage jetzt einen „Login"-Link.',
    highlights: [
      '🏠 Subdomain-Root zeigt Besuchern die Landingpage',
      '🔑 „Login"-Link auf der Landingpage für Mitglieder',
    ],
    details: 'App.jsx: Root-Weiche (nur "/", nicht eingeloggt, Subdomain, /api/homepage/has-published → /willkommen). homepage.js: has-published-Endpoint + Login-nav_item in renderBySubdomain.',
    files: ['frontend/src/App.jsx', 'backend/routes/homepage.js'],
  },
  {
    version: '3.0.128',
    date: '2026-07-03',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Starterpaket doppelt: Bestellung wird nicht mehr dupliziert',
    description: 'Bei manchen Mitgliedern war das Starterpaket 2× als Bestellung hinterlegt. Ursache: Die automatisch (bei Stil-Zuweisung) angelegte Bestellung und die explizite Bestellung mit Variantenauswahl haben sich nicht abgeglichen. Jetzt wird eine bereits offene Bestellung aktualisiert statt eine zweite anzulegen; die Auto-Anlage fügt zudem atomar ein (race-sicher).',
    highlights: ['🐛 Keine doppelten Starterpaket-Bestellungen mehr', '🧹 Bestehende Doppel (Mitglied 841/842) bereinigt'],
    details: 'starterpakete.js POST /:id/bestellen: offene Bestellung updaten statt Insert. mitglieder.js autoStarterpaketBestellung: INSERT ... WHERE NOT EXISTS. 2 Alt-Doppel (offen, ungezogen) gelöscht.',
    files: ['backend/routes/starterpakete.js', 'backend/routes/mitglieder.js'],
  },
  {
    version: '3.0.127',
    date: '2026-07-03',
    type: 'feature',
    zielgruppe: 'allgemein',
    title: 'Bankverbindung selbst in der App ändern (SEPA)',
    description: 'Mitglieder können ihre Bankverbindung für die SEPA-Lastschrift jetzt selbst in der App hinterlegen oder ändern — unter „Zahlungen → Zahlungsmethoden → Bankverbindung". IBAN + Kontoinhaber eingeben, SEPA-Mandat bestätigen, fertig. Weniger Rücklastschriften, kein IBAN-Hin-und-Her per Mail mehr.',
    highlights: ['🏦 IBAN-Self-Service für Mitglieder', '✅ Mit IBAN-Prüfung & SEPA-Mandat'],
    details: 'member-payments.js: GET/POST /bankverbindung (Mod-97-IBAN-Check, createSepaCustomer erzeugt neue Stripe-SEPA-PaymentMethod, aktualisiert sepa_mandate + mitglieder.iban; Reihenfolge Stripe-vor-DB, damit bei Stripe-Fehler nichts verändert wird). MemberPayments.jsx: neue Sektion „Bankverbindung (SEPA-Lastschrift)" im Zahlungsmethoden-Tab.',
    files: ['backend/routes/member-payments.js', 'frontend/src/components/MemberPayments.jsx'],
  },
  {
    version: '3.0.126',
    date: '2026-07-03',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Probetraining-Website: Plan-Gate auch in der Seite',
    description: 'Der Professional-Gate greift jetzt nicht nur bei der Karte, sondern auch direkt in der Seite — der direkte URL-Aufruf zeigt bei Plänen unter Professional eine „ab Professional"-Sperre statt der Werkzeuge.',
    highlights: ['🔒 Probetraining-Website auch per Direkt-URL gegated'],
    details: 'ProbetrainingIntegration.jsx: Plan-Gate (jwtDecode Super-Admin + subscription.plan_type ≥ professional) mit Upgrade-Hinweis.',
    files: ['frontend/src/components/ProbetrainingIntegration.jsx'],
  },
  {
    version: '3.0.125',
    date: '2026-07-03',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Probetraining-Link-Karte ab Professional',
    description: 'Die Karte „Probetraining-Link & Website" (Einstellungen) erscheint jetzt erst ab Plan Professional (bzw. Premium/Enterprise/Trial/Super-Admin) — über einen neuen Plan-Level-Check (minPlan).',
    highlights: ['🔒 Probetraining-Link-Karte ab Professional'],
    details: 'Dashboard.jsx: einstellungenCards-Filter um minPlan-Check (planRang, subscription.plan_type) erweitert; Karte minPlan: professional.',
    files: ['frontend/src/components/Dashboard.jsx'],
  },
  {
    version: '3.0.124',
    date: '2026-07-03',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Homepage-Builder als Premium/Enterprise gegated',
    description: 'Die Homepage-Builder-Karte in den Einstellungen erscheint jetzt nur für Dojos mit Premium/Enterprise (Feature homepage_builder) bzw. für Super-Admins. Der Backend-API war bereits gegated.',
    highlights: ['🔒 Homepage-Builder-Karte nur mit Premium/Enterprise'],
    details: 'Dashboard.jsx: einstellungenCards-Filter um feature-Check erweitert (isSuperAdmin || hasFeature(card.feature)); Homepage-Builder-Karte feature: homepage_builder.',
    files: ['frontend/src/components/Dashboard.jsx'],
  },
  {
    version: '3.0.123',
    date: '2026-07-03',
    type: 'feature',
    zielgruppe: 'allgemein',
    title: 'Eigene Dojo-Startseite unter /willkommen (Homepage-Builder)',
    description: 'Jedes Dojo kann jetzt eine eigene gebrandete Startseite bauen und unter <dojo>.dojo.tda-intl.org/willkommen veröffentlichen — mit Hero, Kampfkunststilen, Trainingszeiten, Werten und Probetraining-CTA. Editor unter Einstellungen → „Homepage-Builder". (Nebenbei zwei Bugs behoben, die Speichern & Rendern der Homepages bisher komplett verhinderten.)',
    highlights: [
      '🖥️ Eigene Startseite unter /willkommen pro Dojo',
      '🎨 Gebrandet + Probetraining-Buchung integriert',
      '⚙️ Editor jetzt auffindbar (Einstellungen → Homepage-Builder)',
    ],
    details: 'homepage.js: /willkommen (X-Tenant-Subdomain) + render-by-subdomain; Migration 221 (dojo_homepage.template_id — fehlte, blockierte Speichern) + template_id-Bug im render behoben; Default-CTAs → /probetraining. nginx wildcard: location = /willkommen → Backend. Dashboard.jsx: Homepage-Builder-Karte.',
    files: ['backend/routes/homepage.js', 'frontend/src/components/Dashboard.jsx'],
  },
  {
    version: '3.0.122',
    date: '2026-07-03',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Familienrabatt-Rundungsfehler (100-facher Beitrag) behoben',
    description: 'Beim Anlegen von Familienmitgliedern mit Prozent-Rabatt wurde der Monatsbeitrag 100-fach zu hoch berechnet (z.B. 24,50 € wurde 2450 €). Formel korrigiert. Zusätzlich zeigt der Familie-Tab jetzt den Tarif-Beitrag, wenn der Vertrag keinen expliziten Monatsbeitrag hat.',
    highlights: ['🐛 100-facher Familienbeitrag behoben (Rundungsfehler)', '💶 Tarif-Beitrag als Fallback im Familie-Tab'],
    details: 'mitglieder.js createFamilyMembers: Math.round(tarifPreis*(100-%))/100 statt *100. mitglieddetail.js /familie: COALESCE(..., t.price_cents/100). Altfall Vanessa Marx (Vertrag 244) + 13 offene Beiträge auf 24,50 € korrigiert (nichts war gezahlt).',
    files: ['backend/routes/mitglieder.js', 'backend/routes/mitglieddetail.js'],
  },
  {
    version: '3.0.121',
    date: '2026-07-03',
    type: 'improvement',
    zielgruppe: 'allgemein',
    title: 'Probetraining-Buchungsseite im Dojo-Design',
    description: 'Die öffentliche Probetraining-Buchungsseite übernimmt jetzt die Akzentfarbe des jeweiligen Dojos (statt fixem Rot) — passend zum Logo. Jedes Dojo/Subdomain erscheint im eigenen Look.',
    highlights: ['🎨 Buchungsseite in der Dojo-Farbe (White-Label)'],
    details: 'public-probetraining.js liefert theme_farbe; ProbetrainingBuchung.jsx setzt --primary/--ds-accent aus dojoData.farbe (color-mix für Erfolgs-Box).',
    files: ['backend/routes/public-probetraining.js', 'frontend/src/pages/ProbetrainingBuchung.jsx'],
  },
  {
    version: '3.0.120',
    date: '2026-07-03',
    type: 'feature',
    zielgruppe: 'allgemein',
    title: 'Probetraining für die eigene Homepage: Link, QR-Code & Embed',
    description: 'Neu unter Einstellungen → „Probetraining-Link & Website": fertiger gebrandeter Buchungs-Link zum Verlinken, ein QR-Code (für Flyer/Social) zum Download und ein Embed-Code (iframe) zum direkten Einbetten in die bestehende Homepage. Jede Buchung landet automatisch als Interessent im CRM. Ideal für Dojos, die schon eine eigene Website haben.',
    highlights: [
      '🔗 Fertiger Probetraining-Buchungslink pro Dojo',
      '📱 QR-Code zum Download',
      '🧩 Embed-Code für die eigene Homepage',
    ],
    details: 'ProbetrainingIntegration.jsx (qrcode.react) + Route /dashboard/einstellungen/probetraining-link + Einstellungen-Karte. Nutzt bestehende öffentliche Buchungsseite /probetraining (subdomain-aware) + public-probetraining Backend. Stufe 1+2 von 3 (Landingpage folgt).',
    files: ['frontend/src/components/ProbetrainingIntegration.jsx', 'frontend/src/App.jsx', 'frontend/src/components/Dashboard.jsx'],
  },
  {
    version: '3.0.119',
    date: '2026-07-01',
    type: 'improvement',
    zielgruppe: 'allgemein',
    title: 'Familie-Tab: Monatsbeitrag & Rabatt pro Mitglied nachträglich bearbeiten',
    description: 'Im Familie-Tab eines Mitglieds kann jetzt pro Familienmitglied der Monatsbeitrag und ein Rabatt direkt angepasst werden („✏️ Beitrag") – wirkt sofort auf den Vertrag und die offenen künftigen Beiträge. Der bisher verwirrende, informative Rabatt (der nichts abrechnete) wurde entfernt; angezeigt wird jetzt der echte Vertrags-Monatsbeitrag.',
    highlights: [
      '✏️ Beitrag/Rabatt je Familienmitglied direkt im Familie-Tab bearbeiten',
      '💶 Anzeige des echten Monatsbeitrags aus dem Vertrag',
      '🧹 Irreführenden Info-Rabatt entfernt'
    ],
    details: 'MemberFamilyTab.jsx: Inline-Editor pro Mitglied → PUT /mitglieder/:id/beitrag (jetzt auch rabatt_prozent + rabatt_grund am Vertrag). mitglieddetail.js /familie liefert vertraege.monatsbeitrag/rabatt statt mitglieder.rabatt. Block „Familienmanagement" → „Familien-Zuordnung".',
    files: ['frontend/src/components/mitglied-detail/tabs/MemberFamilyTab.jsx', 'backend/routes/mitglieder.js', 'backend/routes/mitglieddetail.js'],
  },
  {
    version: '3.0.118',
    date: '2026-07-01',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Verbands-Termine: vergangene ausgeblendet + nach Monaten gruppiert',
    description: 'Die Verbands-/Fremdtermine-Liste zeigt nur noch kommende Termine (vergangene werden ausgeblendet) und ist chronologisch nach Monaten gruppiert (mit Monats-Überschrift und Anzahl).',
    highlights: ['🙈 Vergangene Termine ausgeblendet', '🗓️ Gruppierung nach Monat mit Überschriften'],
    details: 'SuperAdminDashboard.jsx: Filter end_datum||start_datum >= heute, Sortierung nach start_datum, Gruppierung nach Jahr-Monat.',
    files: ['frontend/src/components/SuperAdminDashboard.jsx'],
  },
  {
    version: '3.0.117',
    date: '2026-07-01',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Verbands-Termine: übersichtlichere Karten + anklickbares Turnier',
    description: 'Die Liste der Verbands-/Fremdtermine (Super-Admin → Kalender) ist jetzt als übersichtliche Karten mit Datums-Chip aufbereitet, und der Turnier-Titel ist direkt anklickbar (öffnet die Turnier-/Quellseite). Der KI-Web-Sync liefert dafür bevorzugt den direkten Link zur Turnierseite.',
    highlights: ['🗂️ Karten-Darstellung mit Datums-Chip & Status-Farbe', '🔗 Turnier-Titel als Link zur Quelle anklickbar'],
    details: 'SuperAdminDashboard.jsx Kalender-Tab: Fremdtermine-Liste als Karten, Titel verlinkt quelle_url. super-admin-calendar.js: Sync-Prompt bevorzugt direkte Turnier-URL.',
    files: ['frontend/src/components/SuperAdminDashboard.jsx', 'backend/routes/super-admin-calendar.js'],
  },
  {
    version: '3.0.116',
    date: '2026-07-01',
    type: 'feature',
    zielgruppe: 'allgemein',
    title: 'Familienmitglieder: Sonderrabatt & individueller Preis in Schritt 4',
    description: 'Beim Anlegen von Familienmitgliedern (Admin) kann pro Person in Schritt 4 zusätzlich zur Tarif-Auswahl ein Sonderrabatt (%) oder ein individueller Monatsbeitrag (€) vergeben werden. Preisübersicht und Gesamtsumme berücksichtigen das direkt.',
    highlights: [
      '🏷️ Sonderrabatt (%) pro Familienmitglied (ersetzt den Familienrabatt)',
      '💶 Individueller Monatsbeitrag (€) – überschreibt Tarif + Rabatt',
      '🧮 Live-Preisberechnung + Gesamtsumme angepasst'
    ],
    details: 'NeuesMitgliedAnlegen.jsx Schritt 4 (nur !isRegistrationFlow): Felder rabatt_prozent + individueller_beitrag pro Familienmitglied, computeFamilyMemberPriceCents. Backend createFamilyMembers (mitglieder.js): individueller_beitrag als absoluter Vorrang-Override, rabatt_prozent bereits unterstützt.',
    files: ['frontend/src/components/NeuesMitgliedAnlegen.jsx', 'backend/routes/mitglieder.js'],
  },
  {
    version: '3.0.115',
    date: '2026-07-01',
    type: 'fix',
    zielgruppe: 'allgemein',
    title: 'Mitglieder-App: Karten unter dem Ausweis passen jetzt auf den Bildschirm',
    description: 'Die Karten unter dem Mitgliedsausweis standen zwar untereinander, ragten aber noch über den Bildschirmrand. Jetzt schrumpfen sie sauber auf die verfügbare Breite (kein horizontaler Überlauf mehr).',
    highlights: ['📱 Karten unter dem Ausweis passen sich der Bildschirmbreite an'],
    details: 'MemberDashboard.responsive.css: .md-stats-grid ≤767px auf minmax(0,1fr) + min-width:0/box-sizing/max-width auf Grid-Items (behebt Grid-Überlauf durch min-width:auto).',
    files: ['frontend/src/styles/MemberDashboard.responsive.css'],
  },
  {
    version: '3.0.113',
    date: '2026-07-01',
    type: 'improvement',
    zielgruppe: 'allgemein',
    title: 'Probetraining: direkte Buchung schon im Formular',
    description: 'Wählt der Interessent im Probetraining-Formular einen konkreten Termin (echte kommende Kurstermine), wird sofort verbindlich gebucht und er bekommt direkt die Terminbestätigung – kein zweiter Schritt nötig. Ohne Terminwahl bleibt es wie bisher eine Anfrage („wir melden uns").',
    highlights: ['📅 Konkrete Termin-Auswahl im Formular', '✅ Sofort verbindlich gebucht + Bestätigung', '🥋 Erscheint automatisch im Trainer-Check-in-Popup'],
    details: 'public-probetraining.js /buchen: Direkt-Buchung wenn gültiger Slot+Datum → status probetraining_vereinbart + sendProbetrainingTerminBestaetigung; gewuenschter_kurs_id jetzt echte kurs_id. ProbetrainingBuchung.jsx: Datums-Chips für den gewählten Slot.',
    files: ['backend/routes/public-probetraining.js', 'frontend/src/pages/ProbetrainingBuchung.jsx'],
  },
  {
    version: '3.0.112',
    date: '2026-07-01',
    type: 'feature',
    zielgruppe: 'allgemein',
    title: 'Probetraining: Selbst-Buchung, schönere Mail & Check-in-Hinweis',
    description: 'Nach einer Probetraining-Anfrage kann der Interessent seinen Termin jetzt selbst über einen Link in der Bestätigungsmail buchen – dann wird alles automatisch sauber verbucht (Status „Probetraining vereinbart"). Am Trainingstag sieht der Trainer beim Check-in ein Popup „Heute Probetraining: … kommt". Die Bestätigungsmails haben jetzt einen richtigen Hero-Header.',
    highlights: [
      '📅 Terminvorschläge + „Termin verbindlich buchen"-Button in der Bestätigungsmail',
      '✅ Selbst-Buchung über /probetraining/termin/<Link> → automatische Verbuchung + finale Bestätigung',
      '🥋 Check-in-Popup für den Trainer am Tag des Probetrainings',
      '✉️ Verbesserter Mail-Header (Hero) + Dojo-Markenfarbe Rot'
    ],
    details: 'Migration 216 (interessenten: bestaetigung_token, token_ablauf, probetraining_uhrzeit, probetraining_stundenplan_id). Backend: public-probetraining.js (Token in /buchen, GET/POST /termin/:token), emailService (Bestätigung mit CTA + neue sendProbetrainingTerminBestaetigung), emailLayout Hero-Header, checkin.js /probetrainings-today. Frontend: PublicProbetrainingTermin.jsx (+Route). Check-in-App: CheckinPage.jsx Popup/Banner. Dojo 3 theme_farbe → #e11d2a.',
    files: [
      'backend/server.js',
      'backend/routes/public-probetraining.js',
      'backend/routes/checkin.js',
      'backend/services/emailService.js',
      'backend/services/emailLayout.js',
      'frontend/src/pages/PublicProbetrainingTermin.jsx',
      'checkin-app/src/pages/CheckinPage.jsx',
    ],
  },
  {
    version: '3.0.111',
    date: '2026-06-30',
    type: 'fix',
    zielgruppe: 'allgemein',
    title: 'Check-in am Handy: Scrollen & „Weiter" repariert',
    description: 'Beim Einchecken konnte man auf dem Handy nicht bis zum „Weiter"-Button scrollen, weil das Fenster über den sichtbaren Bildschirm hinausragte. Das Fenster nutzt jetzt die dynamische Bildschirmhöhe (dvh), die Kursliste scrollt sauber, und die Buttons („Weiter"/„Bestätigen") sind als feste Fußleiste immer sichtbar.',
    highlights: [
      '📱 Check-in: Kursliste scrollt jetzt zuverlässig',
      '✅ „Weiter"/„Bestätigen" immer sichtbar (fixe Fußleiste)',
    ],
    details: 'MemberCheckin.jsx: modalStyle/overlay von vh→dvh (92dvh), action-buttons position:sticky Fußleiste.',
    files: ['frontend/src/components/MemberCheckin.jsx'],
  },
  {
    version: '3.0.110',
    date: '2026-06-29',
    type: 'feature',
    zielgruppe: 'allgemein',
    title: 'Check-in: optionaler Stil-Filter (pro Dojo einstellbar)',
    description: 'Neu unter Einstellungen → Check-in: Wenn aktiviert, sehen Mitglieder beim Einchecken zuerst nur die Kurse ihres eigenen Stils. Über „Weitere Kurse anzeigen" können sie weiterhin jede andere Stunde besuchen. Jedes Dojo (Subdomain) entscheidet selbst. Hat ein Mitglied keinen Stil hinterlegt, werden alle Kurse gezeigt.',
    highlights: [
      '🥋 Check-in zeigt zuerst nur Kurse des eigenen Stils (optional)',
      '➕ „Weitere Kurse anzeigen" für andere Stunden',
      '⚙️ Pro Dojo in den Einstellungen ein-/ausschaltbar',
    ],
    details: 'Migration 220 (checkin_einstellungen), routes/checkin-einstellungen.js (GET/PUT), CheckinEinstellungen.jsx + Route /dashboard/einstellungen/checkin + Karte, MemberCheckin.jsx Stil-Filter (Match über Stil-Name aus mitglied_stile) + „Weitere"-Button.',
    files: ['backend/routes/checkin-einstellungen.js', 'frontend/src/components/CheckinEinstellungen.jsx', 'frontend/src/components/MemberCheckin.jsx'],
  },
  {
    version: '3.0.109',
    date: '2026-06-29',
    type: 'feature',
    zielgruppe: 'allgemein',
    title: 'Werbe-/Info-Bildschirm für den 2. Monitor (Enterprise)',
    description: 'Neuer eigenständiger Vollbild-Bildschirm fürs Dojo (Fire-TV-Stick / Mini-PC): rotierende Werbung, Infos, Bilder, Videos und QR-Codes – plus automatische Inhalte wie heutiger Kursplan, kommende Events, Prüfungen, Geburtstage und Schnell-Ansagen. Verwaltung im Check-in-Tab unter „Werbe-Bildschirm".',
    highlights: [
      '🖥️ Eigene Anzeige-Adresse /public-display?dojo=… für den 2. Bildschirm',
      '🗂️ Eigene Slides: Bild, Text, Video, QR-Code – mit Reihenfolge & Zeitfenster',
      '🤖 Auto-Inhalte: Kursplan, Events, Prüfungen, Geburtstage, Schnell-Ansagen',
      '📱 Einrichtungs-QR + Kopier-Link im Check-in-Tab'
    ],
    details: 'Migration 215 (feature_display, display_config, display_slides). Backend: routes/display.js (Admin-CRUD + Upload, requireFeature(\'display\')) + routes/public-display.js (öffentlich, CORS, Auto-Slides). Frontend: PublicWerbeDisplay.jsx (Kiosk, Rotation) + DisplayVerwaltung.jsx (Check-in-Tab-Karte, hasFeature(\'display\')). Token-frei wie die Stundenplananzeige.',
    files: [
      'backend/server.js',
      'backend/routes/display.js',
      'backend/routes/public-display.js',
      'backend/middleware/featureAccess.js',
      'frontend/src/components/PublicWerbeDisplay.jsx',
      'frontend/src/components/DisplayVerwaltung.jsx',
      'frontend/src/components/Dashboard.jsx',
    ],
  },
  {
    version: '3.0.108',
    date: '2026-06-29',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Events-Tab: To-Do-Liste entfernt',
    description: 'Im Events-Tab wurde versehentlich die To-Do-Übersicht mit angezeigt. To-Do ist jetzt wieder nur im eigenen „To Do"-Tab.',
    highlights: ['🧹 Events-Tab zeigt keine To-Do-Liste mehr'],
    details: 'Dashboard.jsx: TodoPanel fixedKontext="events" aus dem Events-Tab entfernt.',
    files: ['frontend/src/components/Dashboard.jsx'],
  },
  {
    version: '3.0.107',
    date: '2026-06-28',
    type: 'improvement',
    zielgruppe: 'allgemein',
    title: 'Apps-Übersicht: Dojo-Admin-Portal, Schnell-Ansage & Cockpit ergänzt',
    description: 'In der Funktionsübersicht sind jetzt auch das Dojo-Admin-Portal, die Schnell-Ansage und das Cockpit/Lagezentrum gelistet. Apps ohne feste Adresse werden als Karte ohne Link dargestellt.',
    highlights: ['📲 Mehr Apps in der Übersicht (Admin-Portal, Schnell-Ansage, Cockpit)'],
    details: 'FunktionsUebersicht.jsx: 3 Apps ergänzt, optionale URL (Tag a/div).',
    files: ['frontend/src/components/FunktionsUebersicht.jsx'],
  },
  {
    version: '3.0.106',
    date: '2026-06-28',
    type: 'improvement',
    zielgruppe: 'allgemein',
    title: 'Funktionsübersicht als eigener Sidebar-Punkt + TDA Events ergänzt',
    description: '„🧭 Apps & Funktionen" ist jetzt ein eigener Punkt in der Seitenleiste (vorher nur im Hilfe-Center). In der App-Liste ist zusätzlich TDA Events aufgeführt; Begleit-Apps mit eigener Adresse sind klar markiert.',
    highlights: ['🧭 Eigener Sidebar-Punkt „Apps & Funktionen"'],
    details: 'Dashboard.jsx: Tab funktionen + Render FunktionsUebersicht. FunktionsUebersicht.jsx: TDA Events ergänzt, „Zusatzprodukt"-Badge.',
    files: ['frontend/src/components/Dashboard.jsx', 'frontend/src/components/FunktionsUebersicht.jsx'],
  },
  {
    version: '3.0.105',
    date: '2026-06-28',
    type: 'improvement',
    zielgruppe: 'allgemein',
    title: 'Funktionsübersicht: Apps-Sektion (Mitglieder-App, Check-in, Chat, Coach, Finanzen)',
    description: 'Die Funktionsübersicht zeigt jetzt oben auch die eigenständigen Apps mit eigener Adresse: Mitglieder-App, Check-in-App, Chat/Nachrichten, Coach-App (Trainer) und Finanzen-App (Beleg-Scanner) — mit Zweck, Zielgruppe, Plan-Badge und direktem Link.',
    highlights: ['📲 Übersicht aller Begleit-Apps mit Links & Plan-Zuordnung'],
    details: 'FunktionsUebersicht.jsx: APPS-Sektion (app.tda-vib.de, checkin., msg.dojo., coach., finanzen.).',
    files: ['frontend/src/components/FunktionsUebersicht.jsx'],
  },
  {
    version: '3.0.104',
    date: '2026-06-28',
    type: 'feature',
    zielgruppe: 'allgemein',
    title: 'Neue Funktionsübersicht — alle Funktionen mit Plan-Zuordnung',
    description: 'Neue Seite „Funktionsübersicht" (Dashboard → /funktionen, verlinkt aus dem Hilfe-Center): zeigt alle Funktionen der Software nach Bereichen gruppiert, jeweils mit Plan-Badge (Standard/Professional/Premium/Enterprise) und „enthalten ✓ / ab Plan 🔒" passend zum aktuellen Abo.',
    highlights: [
      '🧭 Vollständige Funktionsübersicht auf einer Seite',
      '🏷️ Plan-Zuordnung je Funktion (Standard → Enterprise)',
      '✓/🔒 zeigt, was im eigenen Plan enthalten ist',
    ],
    details: 'FunktionsUebersicht.jsx (Tiers aus plan_feature_mapping abgeleitet), Route /dashboard/funktionen, Button im Hilfe-Center.',
    files: ['frontend/src/components/FunktionsUebersicht.jsx', 'frontend/src/App.jsx', 'frontend/src/components/HilfeCenter.jsx'],
  },
  {
    version: '3.0.103',
    date: '2026-06-28',
    type: 'improvement',
    zielgruppe: 'allgemein',
    title: 'Hilfe-Center erweitert: Kommunikation/Chat + Coach-App',
    description: 'Neue Hilfe-Kategorien: „Kommunikation & Chat" (Chat-Grundlagen, jemandem schreiben via „Neues Gespräch", Messenger/WhatsApp) und „Coach-App (Trainer)" (Anmelden, Schnell-Ansage, Vertretung suchen inkl. Push).',
    highlights: ['📖 Hilfe: Chat & Coach-App-Anleitungen'],
    details: 'HilfeCenter.jsx: Kategorien kommunikation + coach_app ergänzt.',
    files: ['frontend/src/components/HilfeCenter.jsx'],
  },
  {
    version: '3.0.102',
    date: '2026-06-28',
    type: 'improvement',
    zielgruppe: 'allgemein',
    title: 'Hilfe-Center: komplette Anleitung zum Prüfungswesen + Urkunden-Editor',
    description: 'Das Hilfe-Center beschreibt jetzt den gesamten Prüfungsablauf (Überblick, Termin planen, Kandidaten/Zulassung inkl. „krank entfernen", Prüfung durchführen, Ergebnisse eintragen, Urkunden drucken) sowie eine Schritt-für-Schritt-Anleitung für den neuen visuellen Urkunden-Vorlagen-Editor.',
    highlights: [
      '📖 Vollständige Prüfungswesen-Anleitung im Hilfe-Center',
      '🎨 Anleitung „Eigene Urkunden-Vorlagen erstellen"',
    ],
    details: 'HilfeCenter.jsx: Kategorie „Prüfungswesen" um 7 Artikel erweitert (Überblick, planen, Kandidaten/Zulassung, durchführen, Ergebnisse, Urkunden drucken, Vorlagen-Editor).',
    files: ['frontend/src/components/HilfeCenter.jsx'],
  },
  {
    version: '3.0.101',
    date: '2026-06-28',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Urkunden-Vorlagen Etappe 3: eigene Vorlagen sind druckbar',
    description: 'Selbst im Editor erstellte Urkunden-Vorlagen erscheinen jetzt im Urkunden-Druck-Dialog (eigenes Dropdown-Thumbnail), mit Live-Vorschau und korrektem Druck (generisch aus den platzierten Feldern). Prüfer-Felder werden eingeblendet, wenn die Vorlage Prüfer-Felder hat. Die fest hinterlegten KSS-Vorlagen (Kickboxen/Aikido/BoB/ShieldX/Enso) bleiben unverändert (Hybrid).',
    highlights: [
      '🖨️ Im Editor erstellte Urkunden sind jetzt druckbar (Dropdown + Vorschau)',
      '🧩 Generisches Feld-Rendering aus der DB-Vorlage (Druck + Vorschau)',
    ],
    details: 'PruefungsVerwaltung.jsx: dbVorlagen laden (/api/urkunden-vorlagen, Enterprise), Modal-Dropdown um db_-Einträge erweitert; CertPreview + druckeUrkunden generischer DB-Zweig (feldWert/escHtml/seiteFromFormat); Register-Art „sonstiges" für DB-Vorlagen. KSS-Migration bewusst offen gelassen (Hardcode druckt exakt).',
    files: ['frontend/src/components/PruefungsVerwaltung.jsx'],
  },
  {
    version: '3.0.100',
    date: '2026-06-28',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Urkunden-Vorlagen-Editor (Enterprise) — Etappe 2: visueller Editor',
    description: 'Neuer Admin-Bereich „Urkunden-Vorlagen" (/dashboard/urkunden-vorlagen, Enterprise): eigenes Urkunden-Design hochladen, Felder (Name/Grad/Datum/Ort/Urkunden-Nr./Prüfer 1+2/Freitext) per Drag & Drop platzieren, Größe/Ausrichtung/Optionen einstellen, Live-Vorschau mit Beispieldaten, speichern. Erreichbar über „⚙ Eigene Vorlagen" im Urkunden-Druck-Dialog. Noch offen: Etappe 3 (Druck/Vorschau aus DB + KSS-Vorlagen migrieren).',
    highlights: [
      '🎨 Eigene Urkunden-Designs pro Dojo per Drag & Drop',
      '👁️ Live-Vorschau mit Beispieldaten',
      '🔒 Enterprise-Feature',
    ],
    details: 'UrkundenVorlagenEditor.jsx (Liste + Editor, Pointer-Drag, Upload, CRUD über /api/urkunden-vorlagen). App.jsx Route urkunden-vorlagen. PruefungsVerwaltung: gegateter Link im Druck-Modal (hasFeature urkunden_vorlagen).',
    files: ['frontend/src/components/UrkundenVorlagenEditor.jsx', 'frontend/src/App.jsx', 'frontend/src/components/PruefungsVerwaltung.jsx'],
  },
  {
    version: '3.0.99',
    date: '2026-06-28',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Enso-Urkunde: elegante Schrift (Shippori Mincho) + Druck wartet auf Font-Laden',
    description: 'Die Enso-Urkunde nutzt jetzt die japanische Mincho-Serife „Shippori Mincho" (sauberer Druck, edler Look) statt Georgia. Außerdem wartet der Urkunden-Druck bei Web-Schriften aufs Laden der Schrift, damit der erste Druck nicht in der Fallback-Schrift erscheint (gilt auch für Aikido/BoB).',
    highlights: ['🖌️ Enso-Urkunde in „Shippori Mincho" (japanisch angehaucht)', '🖨️ Druck wartet auf Web-Schrift → kein „ausgefranster" Erstdruck'],
    details: 'PruefungsVerwaltung.jsx: enso extraFonts (Google Fonts Shippori Mincho) + font-family in allen cert-* Feldern; buildAndPrint druckt erst nach win.document.fonts.ready (Fallback 2,5s) wenn cfg.extraFonts.',
    files: ['frontend/src/components/PruefungsVerwaltung.jsx'],
  },
  {
    version: '3.0.98',
    date: '2026-06-28',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Enso-Urkunde: Label „Urkunden-Nr." vor der Nummer',
    description: 'Vor der (automatischen DB-)Urkundennummer steht auf der Enso-Urkunde jetzt „Urkunden-Nr.: …".',
    highlights: ['🏷️ „Urkunden-Nr.:" vor der Nummer auf der Enso-Urkunde'],
    details: 'PruefungsVerwaltung.jsx: enso nummerPrefix in cert-nummer (Druck + Vorschau).',
    files: ['frontend/src/components/PruefungsVerwaltung.jsx'],
  },
  {
    version: '3.0.97',
    date: '2026-06-28',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Enso-Urkunde: Feinschliff (Grad, Urkundennummer zentriert, Prüfer, Datum)',
    description: 'Kyu-Grad sitzt jetzt sauber in der Lücke „der __ Kyu Grad", Urkundennummer ist zentriert, leere Prüfer („Nicht festgelegt") bleiben auf der Urkunde frei, und das Datum erscheint elegant ausgeschrieben (z.B. „28. Juni 2026").',
    highlights: ['🎯 Enso-Urkunde: Grad/Urkundennr. korrigiert, Datum ausgeschrieben, „Nicht festgelegt" wird nicht gedruckt'],
    details: 'PruefungsVerwaltung.jsx: enso cert-rank top/size, cert-nummer zentriert (full width), datumLang (long date) in druckeUrkunden+Vorschau, cleanPruefer („Nicht festgelegt"→leer) in Modal+druckeUrkunden.',
    files: ['frontend/src/components/PruefungsVerwaltung.jsx'],
  },
  {
    version: '3.0.96',
    date: '2026-06-28',
    type: 'feature',
    zielgruppe: 'allgemein',
    title: 'Neue Urkunden-Vorlage „Enso Karate" + Prüfer beim Drucken eintragbar',
    description: 'Die Enso-Karate-Urkunde ist jetzt als Vorlage in der Prüfungsverwaltung hinterlegt (A4 hoch) – mit Live-Vorschau; gedruckt werden nur die Daten auf das vorgedruckte Papier. Beim Drucken können zwei Prüfer eingetragen werden, die exakt auf der Urkunde erscheinen (links/rechts); der zweite Prüfer bleibt frei, wenn nicht ausgefüllt. Beim Enso-Grad wird automatisch nur die Kyu-Nummer eingesetzt (passend zum vorgedruckten „Kyu Grad verliehen").',
    highlights: [
      '🥋 Enso-Karate-Urkunde als Druck-Vorlage (mit Vorschau)',
      '✍️ Zwei Prüfer beim Drucken eintragbar → genau so auf der Urkunde',
      '🔢 Grad-Feld zeigt nur die Kyu-Nummer (z.B. „8.")',
    ],
    details: 'PruefungsVerwaltung.jsx: VORLAGEN_CONFIG.enso (A4 portrait, gemessene Positionen, gradTransform, renderOrt/renderPruefer); CertPreview + druckeUrkunden um cert-ort/cert-pruefer1/cert-pruefer2 erweitert; Prüfer-Eingabefelder im Druck-Modal. Asset urkunde_enso.jpg. Migration 218 (ENUM art += enso). VerbandUrkundenRegister: ARTEN.enso. Feinausrichtung gegen Test-Druck noch möglich.',
    files: ['frontend/src/components/PruefungsVerwaltung.jsx', 'frontend/public/assets/urkunde_enso.jpg', 'backend/migrations/218_verband_urkunden_enso.sql', 'frontend/src/components/VerbandUrkundenRegister.jsx'],
  },
  {
    version: '3.0.95',
    date: '2026-06-27',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Coach-App Vertretung: Push-Benachrichtigungen + freie Datumswahl',
    description: 'Vertretungs-Anfragen lösen jetzt zusätzlich zur E-Mail echte Push-Benachrichtigungen auf dem Handy aus (auch bei geschlossener App). Trainer aktivieren Push einmalig in der Coach-App. Außerdem lässt sich beim Stunden-Bezug ein beliebiges Datum wählen (Planung im Voraus, nicht nur heute/morgen).',
    highlights: [
      '🔔 Push aufs Handy bei neuer Vertretungs-Anfrage + bei Übernahme',
      '📅 Vertretung für jeden Tag im Voraus planbar (Datumswahl)',
    ],
    details: 'vertretungNotify.js: web-push an push_subscriptions der Trainer (user_id). coach.js: GET /vapid-key. schnellansage.js zielDatum akzeptiert YYYY-MM-DD. Coach-App: push.js (subscribe), public/push-sw.js (workbox importScripts), Enable-Button + Datumsfeld in VertretungSuchen. iOS: nur als installierte PWA.',
    files: ['backend/services/vertretungNotify.js', 'backend/routes/coach.js', 'backend/routes/schnellansage.js', 'dojo-coach/src/push.js', 'dojo-coach/public/push-sw.js'],
  },
  {
    version: '3.0.94',
    date: '2026-06-27',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Coach-App: Vertretung suchen (Anfrage an alle Trainer)',
    description: 'Trainer können in der Coach-App eine Vertretungs-Anfrage an alle Trainer des Dojos senden (Stunde aus „Meine Stunden" wählen oder frei eingeben + Notiz). Alle Trainer werden per E-Mail informiert und sehen die offenen Anfragen in der App. Wer zuerst „Ich übernehme" tippt, bekommt die Vertretung; der anfragende Trainer und die Admins werden automatisch benachrichtigt.',
    highlights: [
      '🆘 Vertretungs-Anfrage an alle Trainer aus der Coach-App',
      '⚡ „Ich übernehme" – wer zuerst zusagt, gewinnt (first-come)',
      '📧 E-Mail an alle Trainer + Bestätigung an Anfragenden & Admin',
    ],
    details: 'Migration 217 vertretungs_anfragen. coach.js: POST/GET /coach/vertretung, POST /:id/uebernehmen (atomar, status=offen→uebernommen), /:id/stornieren. services/vertretungNotify.js (sendEmailForDojo an Trainer/Admins). Coach-App (~/dojo-coach): modules/VertretungSuchen.jsx + Dashboard-Kachel.',
    files: ['backend/routes/coach.js', 'backend/services/vertretungNotify.js', 'backend/migrations/217_vertretungs_anfragen.sql', 'dojo-coach/src/modules/VertretungSuchen.jsx'],
  },
  {
    version: '3.0.93',
    date: '2026-06-27',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Zulassung entfernen: auch bei bereits bewerteten Prüfungen (mit Rückfrage)',
    description: 'Bisher konnte eine Zulassung nur entfernt werden, solange die Prüfung noch nicht bewertet war (sonst 404). Jetzt: Ist die Prüfung schon bewertet, kommt eine klare Rückfrage „Bereits bewertet – trotzdem entfernen?". Bestätigt man, wird die Prüfung gelöscht und eine evtl. vergebene Urkunde aus dem Verbandsregister mitentfernt.',
    highlights: [
      '✅ Kranke/abwesende Kandidaten auch nach versehentlicher Bewertung entfernbar',
      '🧹 Vergebene Urkundennummer wird beim Entfernen aus dem Register geräumt',
    ],
    details: 'kandidaten.js DELETE /:mitglied_id/zulassung/:pruefung_id: ohne ?force=true → 409 {already_graded} bei bewerteten; mit force → Löschung + DELETE verband_urkunden WHERE urkundennummer. PruefungsVerwaltung.jsx handleZulassungEntfernen: 409 → window.confirm → Retry mit force.',
    files: ['backend/routes/pruefungen/kandidaten.js', 'frontend/src/components/PruefungsVerwaltung.jsx'],
  },
  {
    version: '3.0.92',
    date: '2026-06-27',
    type: 'bugfix',
    zielgruppe: 'intern',
    title: 'Prüfung durchführen: 403/Absturz behoben (falscher Token-Key)',
    description: 'Die Prüfungs-Live-Ansicht konnte nicht starten: Stile/Prüfungen/Timer-Config gaben 403 und die Seite stürzte weiß ab. Ursache: PruefungDurchfuehren las den Auth-Token aus dem falschen localStorage-Key (token statt dojo_auth_token) → „Bearer null". Behoben + .map gegen leere Stile abgesichert.',
    highlights: ['🩹 „Prüfung durchführen" startet wieder (kein 403/Whitescreen mehr)'],
    details: 'PruefungDurchfuehren.jsx: 18× localStorage.getItem(\'token\') → (dojo_auth_token || authToken); stile.map mit Array-Guard.',
    files: ['frontend/src/components/PruefungDurchfuehren.jsx'],
  },
  {
    version: '3.0.91',
    date: '2026-06-27',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Pilot-Feedback-Umfragen im zentralen Layout mit eigenem Banner',
    description: 'Die Umfrage-Mails (Einrichtung/Erfahrung/laufend) nutzen jetzt das zentrale Mail-Layout mit eigenem „Euer Feedback zählt"-Banner (TDA-Header). Signatur von „TDA Systems" auf „TDA International" vereinheitlicht.',
    highlights: ['🎨 Umfrage-Mails mit TDA-Banner-Header statt schlichtem Text'],
    details: 'pilotFeedbackService.js sendUmfrageMail: renderEmail({ bannerUrl: mail-banner-pilot-umfrage.jpg }); Asset in frontend/public/assets.',
    files: ['backend/services/pilotFeedbackService.js', 'frontend/public/assets/mail-banner-pilot-umfrage.jpg'],
  },
  {
    version: '3.0.90',
    date: '2026-06-27',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Pilot-Partner: keine Status-Wechsel-Buttons mehr bei angenommenen Partnern',
    description: 'Bei einer bereits angenommenen Pilot-Bewerbung werden die Buttons „Neu / In Prüfung / Abgelehnt" ausgeblendet — so kann nicht versehentlich eine falsche Status-Mail (z. B. „Abgelehnt") an einen bereits gewonnenen Partner gehen. „Löschen" bleibt erhalten.',
    highlights: ['🔒 Angenommene Partner: keine versehentlichen Status-Wechsel/Mails mehr'],
    details: 'PilotBewerbungen.jsx: Status-Wechsel-Buttons nur noch wenn b.status !== "gewonnen".',
    files: ['frontend/src/components/PilotBewerbungen.jsx'],
  },
  {
    version: '3.0.89',
    date: '2026-06-27',
    type: 'bugfix',
    zielgruppe: 'intern',
    title: 'Pilot-Partner: Programm-Start-Button bei leerem Datum gesperrt',
    description: 'Im Pilot-Bereich konnte „Programm-Start speichern" ohne Datum geklickt werden → 400-Fehler. Der Button ist jetzt deaktiviert, solange kein Datum gewählt ist (zusätzlicher Guard in der Funktion).',
    highlights: ['🚫 „Programm-Start speichern" nur noch mit gültigem Datum klickbar'],
    details: 'PilotBewerbungen.jsx: saveProgrammStart(bewerbungId, datum) mit Leer-Guard; Speichern-Button disabled wenn kein effektives Datum.',
    files: ['frontend/src/components/PilotBewerbungen.jsx'],
  },
  {
    version: '3.0.88',
    date: '2026-06-26',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Pilot-Partner: Status „Gewonnen" heißt jetzt „Angenommen" + E-Mail-Versand repariert',
    description: 'Der Pilot-Bewerbungsstatus wird in der Verwaltung als „Angenommen" angezeigt (Wortlaut statt „Gewonnen"; interner Wert unverändert). Zusätzlich: Der globale E-Mail-Versand (u.a. Pilot-Statusmails) lief noch über die alte, geblockte alfahosting-Konfiguration in notification_settings und schlug fehl — jetzt auf Brevo (info@tda-intl.com) umgestellt.',
    highlights: [
      '🏷️ „Gewonnen" → „Angenommen" im Pilot-Bewerbungs-Status',
      '📧 Pilot-Status-Mails (und weitere globale Mails) gehen wieder raus (Brevo statt alfahosting)',
    ],
    details: 'PilotBewerbungen.jsx STATUS_META.gewonnen.label → „Angenommen" (Key bleibt „gewonnen"). DB-Fix: notification_settings.email_config (id=1) von alfa3085.alfahosting-server.de:465 auf smtp-relay.brevo.com:587 + default_from_email info@tda-intl.com umgestellt — getEmailSettings() nutzt diese Tabelle.',
    files: ['frontend/src/components/PilotBewerbungen.jsx'],
  },
  {
    version: '3.0.87',
    date: '2026-06-26',
    type: 'bugfix',
    zielgruppe: 'intern',
    title: 'Prüfungsergebnisse-Modal: Einstellungs-Eingabefelder ans Dark-Theme angepasst',
    description: 'Im Einstellungen-Panel des Batch-Modals waren die Eingabefelder (Bestanden ab, Max. Punkte pro Item, Punkteschritte) ungestylt und weiß. Sie haben jetzt dunklen Hintergrund, Rahmen und Fokus-Stil passend zum Rest.',
    highlights: ['🎨 Einstellungs-Inputs im Prüfungsergebnis-Modal nicht mehr weiß'],
    details: 'PruefungsVerwaltung.css: CSS für .pv3-bm-settings-panel/-grid/-label/-input/-select ergänzt (fehlte komplett → Browser-Defaults).',
    files: ['frontend/src/styles/PruefungsVerwaltung.css'],
  },
  {
    version: '3.0.86',
    date: '2026-06-26',
    type: 'bugfix',
    zielgruppe: 'intern',
    title: 'Prüfungsergebnisse-Modal: durchsichtiger Footer behoben',
    description: 'Im Batch-Modal „Prüfungsergebnisse eintragen" war die Fußleiste (Abbrechen/Speichern) fast durchsichtig, sodass die Teilnehmer-Karten (Punkt/Kommentar) durchschienen. Footer hat jetzt einen opaken Hintergrund.',
    highlights: ['🩹 Footer im Prüfungsergebnis-Modal nicht mehr durchsichtig'],
    details: 'PruefungsVerwaltung.css .pv3-bm-sticky-actions: background var(--surface-2) (≈transparent, ohne Fallback) → var(--surface-1, #12121e) wie der Modal-Hintergrund.',
    files: ['frontend/src/styles/PruefungsVerwaltung.css'],
  },
  {
    version: '3.0.85',
    date: '2026-06-26',
    type: 'improvement',
    zielgruppe: 'allgemein',
    title: 'Kündigungs-Datum sichtbar: Mitgliederliste, Monatsbericht & Detail',
    description: 'Gekündigte Mitglieder sind jetzt direkt in der Mitgliederliste mit Hinweis und Kündigungsdatum erkennbar (das repariert nebenbei den Vertrags-Filter „Gekündigt"). Der Monatsbericht in Beiträge funktioniert wieder und zeigt bei jeder Kündigung zusätzlich, wann sie eingegeben wurde. Im Mitglied-Detail (Reiter Mitgliedschaft) wird das Eingangsdatum wie gehabt angezeigt.',
    highlights: [
      '🚫 „Gekündigt"-Hinweis mit Datum direkt auf der Mitglieder-Karte',
      '🔧 Vertrags-Filter „Gekündigt/Beendet" funktioniert wieder',
      '📊 Monatsbericht (Beiträge) wieder funktionsfähig – inkl. „Eingegeben am" pro Kündigung',
    ],
    details: 'mitglieder.js /all: Korrelierte Subqueries liefern vertrag_status, vertrag_ende, kuendigung_eingegangen, kuendigungsdatum (relevanter Vertrag: aktiver bevorzugt, sonst neuester). MitgliederListe.jsx: Gekündigt-Badge mit Datum. Neuer Endpoint routes/monatsreport.js (war 404) liefert Umsätze (verkaeufe + bezahlte rechnungen), neue Verträge, Kündigungen (mit kuendigung_eingegangen) und Pausen für den aktuellen Monat. Beitraege.jsx zeigt „Eingegeben am".',
    files: ['backend/routes/monatsreport.js', 'backend/routes/mitglieder.js', 'frontend/src/components/MitgliederListe.jsx', 'frontend/src/components/Beitraege.jsx'],
  },
  {
    version: '3.0.84',
    date: '2026-06-26',
    type: 'feature',
    zielgruppe: 'allgemein',
    title: 'Neue Urkunden-Vorlage „ShieldX" in der Prüfungsverwaltung – mit Live-Vorschau',
    description: 'Beim Drucken der Urkunden kann jetzt die ShieldX-Vorlage gewählt werden. Im Druck-Dialog wird live angezeigt, wie die fertige Urkunde aussieht (Design mit Name, Rang, Urkundennummer, Datum und Prüfer an der richtigen Stelle). Gedruckt werden – wie bei den anderen Vorlagen – ausschließlich die Daten auf das vorgedruckte ShieldX-Papier. Nachdruck und Vorschau funktionieren auch im Verbands-Urkundenregister.',
    highlights: [
      '🛡️ ShieldX als zusätzliche Urkunden-Vorlage auswählbar',
      '👁️ Live-Vorschau zeigt den fertigen Druck (Design + Daten)',
      '🖨️ Druck nur der Daten auf vorgedrucktes Papier (wie gewohnt)',
      '📚 Anzeige & Nachdruck auch im Verbands-Urkundenregister',
    ],
    details: 'PruefungsVerwaltung.jsx: VORLAGEN_CONFIG auf Modul-Ebene gehoben + Vorlage „shieldx" (gemessene mm-Positionen) + neue Komponente CertPreview (rendert bgImage + Datenfelder per scoped CSS skaliert). buildAndPrint druckt cert-examiner (termin.pruefer_name) wenn renderExaminer. UrkundeDrucken.js: druckeShieldX (Overlay, nur Daten). VerbandUrkundenRegister.jsx: ARTEN + Print-Button + Vorschau-Branch + canPrint. Migration 216 erweitert ENUM verband_urkunden.art um „shieldx". Asset public/assets/urkunde_shieldx.jpg.',
    files: ['frontend/src/components/PruefungsVerwaltung.jsx', 'frontend/src/components/UrkundeDrucken.js', 'frontend/src/components/VerbandUrkundenRegister.jsx', 'backend/migrations/216_verband_urkunden_shieldx.sql', 'frontend/public/assets/urkunde_shieldx.jpg'],
  },
  {
    version: '3.0.83',
    date: '2026-06-25',
    type: 'feature',
    zielgruppe: 'allgemein',
    title: 'Trainer-Bereich: Trainer können eigene Stunden selbst absagen, verlegen oder ändern',
    description: 'Die Schnell-Ansage gibt es jetzt auch für Trainer – mit eigenem Login (ein Passwort für alle Apps). Trainer sehen ausschließlich ihre eigenen Stunden und zugewiesene Vertretungsstunden und können diese in Sekunden absagen oder verlegen; die Info erscheint sofort als Popup in der App und auf der Homepage und läuft automatisch ab. Bei jeder Änderung durch einen Trainer wird der Admin automatisch über drei Kanäle informiert: E-Mail, In-App-Benachrichtigung und eine interne Chat-Nachricht.',
    highlights: [
      '🥋 Eigener Trainer-Bereich mit Login (gewohnte Zugangsdaten)',
      '🔒 Trainer können nur ihre eigenen Stunden + Vertretungsstunden ändern',
      '📣 Absagen/Verlegen erscheint sofort in App & Homepage, läuft selbst ab',
      '🔔 Admin wird bei jeder Trainer-Änderung per E-Mail, Push & Chat informiert',
    ],
    details: 'routes/schnellansage.js: /trainer (Login-Seite + Kachel-Dashboard), GET /meine-stunden (serverseitig auf erlaubte Kurse/Vertretungen gefiltert), POST /veroeffentlichen (Trainer-Guard). services/trainerAnsageNotify.js: 3-Kanal-Admin-Benachrichtigung. auth.js: trainer_id in Login/JWT. Trainer↔Kurs-Auflösung über trainer_ids (JSON), Trainer-Login via Name/E-Mail aufgelöst (dojo-übergreifend).',
    files: ['backend/routes/schnellansage.js', 'backend/services/trainerAnsageNotify.js', 'backend/routes/auth.js'],
  },
  {
    version: '3.0.82',
    date: '2026-06-23',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'PWA aktualisiert sich automatisch (Service-Worker erzwingt Frisch-Laden)',
    description: 'Damit veraltete Home-Screen-Apps (PWA) nicht mehr hängenbleiben: Sobald eine neue Version aktiv wird, lädt der Service-Worker die offenen App-Fenster automatisch einmal neu (nur bei echtem Update, nicht beim Erst-Install). So greifen neue Versionen ohne manuelles Neu-Installieren. Zusammen mit dem Aktualisieren-Banner (v3.0.81) ist das Update-Problem damit grundlegend gelöst.',
    highlights: [
      '🔁 Service-Worker lädt App bei neuer Version automatisch frisch',
      '🚫 Kein manuelles Löschen/Neu-Installieren der PWA mehr nötig',
    ],
    details: 'public/sw.js: activate lädt offene Fenster via clients.navigate neu (Guard istUpdate verhindert Reload beim Erst-Install).',
    files: ['frontend/public/sw.js'],
  },
  {
    version: '3.0.81',
    date: '2026-06-23',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Zuverlässiger „Neue Version verfügbar"-Banner (auch in der App/PWA)',
    description: 'Der Aktualisieren-Banner erkennt neue Versionen jetzt zuverlässiger: Die Build-ID wird ins App-Bundle gebacken und beim Start sowie beim Wieder-Öffnen der App (Fokus) gegen den Server verglichen. So erscheint der Hinweis „Neue Version verfügbar – jetzt aktualisieren" auch bei veraltet gecachter Home-Screen-App, ohne dass man sie löschen/neu installieren muss. Beim Aktualisieren werden zusätzlich Caches geleert und der Service-Worker aktualisiert.',
    highlights: [
      '🔄 Banner erkennt veraltete App schon beim Öffnen',
      '👀 Erneute Prüfung beim Zurückkehren in die App (Fokus)',
      '🧹 „Aktualisieren" leert Cache + erzwingt Service-Worker-Update',
    ],
    details: 'deploy.sh backt VITE_BUILD_ID (Git-Hash) ins Bundle; UpdateBanner.jsx vergleicht BUILD_ID gegen /version.json (Fallback localStorage) + visibilitychange/focus-Listener + serviceWorker.update() im Update-Flow.',
    files: ['deploy.sh', 'frontend/src/components/UpdateBanner.jsx'],
  },
  {
    version: '3.0.80',
    date: '2026-06-23',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Chat: Datum lesbarer + Farb-Codierung (heute grün / neu rot) + hellere Namen',
    description: 'Chat-Lesbarkeit verbessert: Zeitstempel der Nachrichten deutlicher sichtbar (Datum + Uhrzeit), heutige Nachrichten in Grün hervorgehoben. In der Chat-Liste sind Räume mit neuen/ungelesenen Nachrichten jetzt rot, Räume mit heutiger Aktivität grün markiert (schneller Überblick). Teilnehmer-/Absendernamen etwas heller und klarer.',
    highlights: [
      '📅 Datum + Uhrzeit je Nachricht besser lesbar',
      '🟢 Heutige Nachrichten/Chats grün',
      '🔴 Neue/ungelesene Chats rot',
      '👤 Teilnehmer-Namen heller/klarer',
    ],
    details: 'Chat.css: chat-message-time Opacity↑, chat-message-time--today grün (#16a34a), chat-message-sender heller (#cbd5e1/600), chat-room-item-time--today grün + chat-room-item--unread rot; ChatRoomList.jsx setzt today-Klasse + Jahr im Datum.',
    files: ['frontend/src/styles/Chat.css', 'frontend/src/components/chat/ChatRoomList.jsx'],
  },
  {
    version: '3.0.79',
    date: '2026-06-23',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Chat/Messenger: Absturz beim Antworten, „immer neu"-Zähler & Push behoben',
    description: 'Mehrere Chat-Bugs behoben: (1) Schwarzer Bildschirm/App-Absturz beim Antworten — neue Chat-Error-Boundary fängt Render-Fehler ab (App muss nicht mehr neu gestartet werden) + content-Felder überall null-sicher. (2) „Zeigt alte Nachrichten immer wieder als neu" — der Ungelesen-Zähler zählte fälschlich eigene gesendete Nachrichten (und archivierte Räume) mit. (3) Push-Benachrichtigungen kamen unzuverlässig — null-content brach den Versand still ab; Ziel-Link jetzt rollenrichtig (Mitglied vs. Admin). Zudem werden eigene Live-Nachrichten korrekt rechts angezeigt.',
    highlights: [
      '🛡️ Chat-Error-Boundary: kein Komplett-Absturz mehr beim Antworten',
      '🔢 Ungelesen-Zähler ignoriert eigene & archivierte Nachrichten',
      '🔔 Push robuster (null-content abgefangen) + korrekter Ziel-Link',
      '➡️ Eigene Live-Nachrichten erscheinen wieder rechts',
    ],
    details: 'ChatErrorBoundary.jsx (um ChatWindow in ChatPage+AdminChatPage); ChatMessage/ChatContext/chatSocket content null-sicher; ChatPopup Route rollenabhängig; chat.js /unread-count schließt eigene + archivierte aus (+ dojo_id NULL für Super-Admin); ChatWindow berechnet is_own für Socket-Nachrichten.',
    files: ['frontend/src/components/chat/ChatErrorBoundary.jsx', 'frontend/src/components/chat/ChatWindow.jsx', 'frontend/src/components/chat/ChatMessage.jsx', 'frontend/src/components/chat/ChatPopup.jsx', 'frontend/src/context/ChatContext.jsx', 'backend/routes/chat.js', 'backend/socket/chatSocket.js'],
  },
  {
    version: '3.0.78',
    date: '2026-06-22',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Mitglieder-App Stil-Ansicht: allgemeiner Prüfungstermin ausgeblendet',
    description: 'Ergänzung zu v3.0.77: Auch in der Stil-Übersicht (MemberStyles) wurde „Nächste Prüfung" mit dem allgemeinen Vorlagen-Termin (auto_gefuellt aus pruefungstermin_vorlagen) angezeigt. Dieser wird jetzt ausgeblendet („Nicht geplant"), damit nur tatsächlich für das Mitglied gesetzte/zugelassene Termine erscheinen.',
    highlights: ['🎓 Auch in der Stil-Ansicht kein allgemeiner Vorlagen-Termin mehr'],
    details: 'MemberStyles.jsx: Anzeige nur wenn naechste_pruefung gesetzt UND nicht auto_gefuellt (Backend /mitglieder/:id/stil/:stilId/data setzt auto_gefuellt bei Vorlagen-Termin).',
    files: ['frontend/src/components/MemberStyles.jsx'],
  },
  {
    version: '3.0.77',
    date: '2026-06-22',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Mitglieder-App: „Nächste Prüfung" nur noch für zugelassene Mitglieder',
    description: 'Behebt Verwirrung: Bisher wurde „Nächste Prüfung am …" allen Mitgliedern eines Stils angezeigt (Datum kam aus der allgemeinen Prüfungstermin-Vorlage), wodurch Mitglieder dachten, sie dürften teilnehmen. Jetzt erscheinen Anzeige und Countdown nur noch, wenn das Mitglied tatsächlich zur Prüfung zugelassen/eingeteilt ist.',
    highlights: [
      '🎓 „Nächste Prüfung" + Countdown nur für zugelassene Teilnehmer',
      '🚫 Allgemeines Vorlagen-Datum wird nicht mehr angezeigt',
    ],
    details: "MemberDashboard.jsx: stats.naechstePruefung nicht mehr aus memberData.naechste_pruefung_datum (pruefungstermin_vorlagen), sondern ausschließlich aus loadApprovedExams() (/pruefungen?mitglied_id&status=geplant, backendseitig auf eigenes mitglied_id gefiltert).",
    files: ['frontend/src/components/MemberDashboard.jsx'],
  },
  {
    version: '3.0.76',
    date: '2026-06-19',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Businessplan unter Finanzen verlinkt (aus Sidebar entfernt)',
    description: 'Der Businessplan ist nicht mehr ein eigener Punkt in der Seitenleiste, sondern als Kachel im Finanzen-Bereich erreichbar (aufgeräumtere Navigation). Funktion unverändert.',
    highlights: ['📈 Businessplan jetzt als Kachel unter Finanzen', '🧹 Sidebar entschlackt'],
    details: "Dashboard.jsx: tabs-Eintrag businessplan entfernt; finanzenCards-Kachel mit action setActiveTab('businessplan'); Karten-onClick unterstützt jetzt action.",
    files: ['frontend/src/components/Dashboard.jsx'],
  },
  {
    version: '3.0.75',
    date: '2026-06-19',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Verbands-Termine im Super-Admin-Kalender (Überschneidungs-Schutz)',
    description: 'Neuer Bereich im Super-Admin-Kalender (System → Kalender): Turniertermine anderer Kampfsportverbände (DKV, WKU/WAKO, Taekwondo, BKO, WMAC, WOMAA …) können manuell gepflegt oder per KI-Web-Sync gefunden werden. Bestätigte Verbands-Termine fließen automatisch in den Konflikt-Check beim Anlegen eigener Events/Turniere ein, sodass Terminüberschneidungen vermieden werden. Per-Web-Sync gefundene Termine landen als „unbestätigt" und müssen manuell freigegeben werden.',
    highlights: [
      '🥋 Verbands-Termine manuell anlegen/bearbeiten/löschen',
      '🔄 Web-Sync: KI sucht kommende Turniere der Verbände (als unbestätigt)',
      '⚠️ Konflikt-Warnung beim Event-Anlegen prüft jetzt auch Verbands-Turniere',
      '✓ Manuelle Bestätigung schützt vor halluzinierten Treffern',
    ],
    details: 'Migration 209 (verbands_fremdtermine); super-admin-calendar.js erweitert (CRUD /fremdtermine, /fremdtermine/sync via @anthropic-ai/sdk web_search, check-conflict um Verbandstermine ergänzt); SuperAdminDashboard.jsx Kalender-Tab um Verbands-Termine-Sektion erweitert; Events.jsx Konflikt-Meldung generalisiert.',
    files: ['backend/routes/super-admin-calendar.js', 'backend/migrations/209_verbands_fremdtermine.sql', 'frontend/src/components/SuperAdminDashboard.jsx', 'frontend/src/components/Events.jsx'],
  },
  {
    version: '3.0.74',
    date: '2026-06-19',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Automatische AG-Monatsabrechnung (Karate AG an Schulen)',
    description: 'Neue Monatsend-Automatik für AG-Kurse: Das System ermittelt die Unterrichtstage (fester Wochentag minus bayerische Schulferien & Feiertage), erzeugt am Monatsanfang automatisch einen Entwurf für den Vormonat und – nach Bestätigung – eine Rechnung mit einer Position je Unterrichtstag (3 Std. × Stundensatz). Bedienung unter Rechnungen → Tab „AG-Abrechnung": Konfigurationen anlegen, Entwürfe prüfen/Tage abhaken, Rechnung erstellen. Optional vollautomatisch (auto_versand).',
    highlights: [
      '🥋 Unterrichtstage automatisch aus Wochentag − Schulferien (BY) − Feiertage',
      '🗓️ Monatsend-Cron erzeugt Entwurf für den Vormonat',
      '✅ Entwurf prüfen, Tage abhaken, Rechnung erstellen (im neuen Design + QR)',
      '⚙️ Konfiguration pro Schule/AG (Wochentag, Std./Tag, Preis, MwSt)',
    ],
    details: 'Migration 208 (ag_abrechnung_config, ag_abrechnung_lauf, schulferien BY); services/agAbrechnung.js; routes/ag-abrechnung.js; cron 1. d. Monats 06:30; Frontend AgAbrechnung.jsx als Tab in Rechnungsverwaltung.',
    files: ['backend/services/agAbrechnung.js', 'backend/routes/ag-abrechnung.js', 'backend/migrations/208_ag_abrechnung.sql', 'frontend/src/components/AgAbrechnung.jsx', 'frontend/src/components/Rechnungsverwaltung.jsx'],
  },
  {
    version: '3.0.73',
    date: '2026-06-17',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Rechnungspositionen: Beschreibung/Leistungszeitraum wird gespeichert & gedruckt',
    description: 'Bug behoben: Beim Erstellen/Bearbeiten einer Rechnung wurde der pro Position eingegebene Freitext (Leistungszeitraum/Monat) sowie das Leistungsdatum NICHT gespeichert (mappedPositionen ließ das Feld weg) → beschreibung landete als NULL in der DB. Zusätzlich druckten beide PDF-Templates die Positions-Beschreibung gar nicht. Jetzt wird der Freitext/Leistungsdatum gespeichert und unter der Bezeichnung jeder Position im PDF angezeigt.',
    highlights: [
      '💾 Positions-Freitext + Leistungsdatum werden jetzt gespeichert',
      '🧾 PDF zeigt die Beschreibung/den Zeitraum je Position an',
      '🔧 Betrifft Rechnung erstellen UND bearbeiten',
    ],
    details: 'RechnungErstellen.jsx mappedPositionen ergänzt beschreibung (Leistungsdatum · Freitext); pdf.js buildRechnungHTML + utils/invoicePdfTemplate.js rendern pos.beschreibung unter der Bezeichnung.',
    files: ['frontend/src/components/RechnungErstellen.jsx', 'backend/routes/rechnungen/pdf.js', 'backend/utils/invoicePdfTemplate.js'],
  },
  {
    version: '3.0.72',
    date: '2026-06-17',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Kündigungs-Banner verwaltbar im Mail-Banner-Dashboard',
    description: 'Der neue Anlass „Kündigung" lässt sich jetzt im Super-Admin-Mail-Banner-Dashboard pflegen – ausschließlich in der Dojo-Sektion (nicht HOF/Events/Verband, dort gibt es keine Kündigungsmails). Für die Kampfkunstschule Schreiner ist bereits ein eigener Kündigungs-Banner hinterlegt.',
    highlights: [
      '🖼️ Anlass „Kündigung" im Banner-Dashboard (nur Dojo-Sektion)',
      '🏫 Schreiner: eigener Kündigungs-Banner aktiv',
    ],
    details: 'mail-banners.js: UPLOAD_ANLAESSE inkl. kuendigung (Validierung); MailBannerVerwaltung.jsx: dojoAnlaesse-Reihe + Label. Banner dojo-kuendigung-d3.jpg hochgeladen + im Manifest.',
    files: ['backend/routes/mail-banners.js', 'frontend/src/components/MailBannerVerwaltung.jsx'],
  },
  {
    version: '3.0.71',
    date: '2026-06-17',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Kündigungs-Mails: freundlicheres Design + Banner-Layout + Fristhinweis',
    description: 'Die Kündigungs-Eingangsbestätigung und die Kündigungsbestätigung nutzen jetzt das zentrale White-Label-Mail-Layout (renderEmail, Anlass „kuendigung") statt eines eigenen Inline-Headers — inkl. Dojo-Banner-Slot. Der Ton ist deutlich wärmer/persönlicher und beide Mails enthalten einen freundlichen Hinweis, dass sich die 3-Monats-Frist immer auf das Vertragsende bezieht (nicht auf 3 Monate ab Kündigungsdatum). Die Eingangsbestätigung wird zudem jetzt ebenfalls rechtssicher im Mail-Archiv gespeichert.',
    highlights: [
      '🎨 Zentrales Banner-Layout statt Inline-Header (Anlass „kuendigung")',
      '💬 Wärmerer, persönlicher Ton',
      'ℹ️ Fristhinweis: 3 Monate immer zum Vertragsende',
      '⚖️ Eingangsbestätigung jetzt auch im Mail-Archiv gespeichert',
    ],
    details: 'vertrag-anpassungen.js: renderEmail/getDojoMailTheme importiert; Eingangs- und Bestätigungsmail auf zentrales Layout + .box-Hinweis umgestellt; logMitgliedMail auch für kuendigung_eingegangen. Banner „dojo-kuendigung-d<dojoId>“ erscheint automatisch, sobald hochgeladen (sonst Marken-Header-Fallback).',
    files: ['backend/routes/vertrag-anpassungen.js'],
  },
  {
    version: '3.0.70',
    date: '2026-06-17',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Online-Kündigung: festes Datum 3 Monate zum Vertragsende (keine vorzeitige Beendigung)',
    description: 'Die Online-Kündigung berechnet das Vertragsende jetzt zwingend serverseitig: immer zum nächstmöglichen regulären Vertragsende mit der Kündigungsfrist (Standard 3 Monate). Ein vom Mitglied gewünschtes früheres Datum ist nicht mehr möglich — eine vorzeitige Beendigung ist über die Selbstbedienung ausgeschlossen. Wird die Frist verpasst, greift die Kündigung automatisch zum darauffolgenden Vertragsende. Behebt einen Fall, in dem zum 30.09. statt korrekt zum 06.02. gekündigt worden wäre.',
    highlights: [
      '🔒 Kündigungsdatum serverseitig erzwungen — Client-Wunschtermin wird ignoriert',
      '📅 Immer 3 Monate (bzw. Vertragsfrist) zum Vertragsende — keine Ausnahmen',
      '🔁 Frist verpasst → automatisch zum nächsten Vertragsende',
      '📝 Kündigungsbestimmungen & Bestätigungstext im Mitgliederbereich angepasst',
    ],
    details: 'vertrag-anpassungen.js: neue Helper berechneKuendigungsdatum() (rollt bei verpasster Frist über autom. Verlängerung weiter); /beantragen und /kuendigung-info nutzen sie, Client-gueltig_bis bei Kündigung verworfen; MemberContractStatus.jsx Texte/Anzeige aktualisiert.',
    files: ['backend/routes/vertrag-anpassungen.js', 'frontend/src/components/MemberContractStatus.jsx'],
  },
  {
    version: '3.0.69',
    date: '2026-06-17',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Verband-Mails automatisiert + Kündigungs-Workflow + rechtssicheres Mail-Archiv',
    description: 'Verbands-Anmeldungen lösen automatisch eine Willkommensmail (mit Begrüßungs-Banner) aus; 2 Std. später folgt per Cron automatisch die Rechnung mit fortlaufender Nummer. Kündigungs-Anträge erscheinen jetzt mit korrekter Überschrift „Kündigung beantragt" und lassen sich im Popup UND im Mitglied-Detail bestätigen oder ablehnen (Ablehnung mit Grund, Bestätigung mit Vertragsende/Laufzeit). Alle versendeten Mails werden rechtssicher gespeichert und dem Mitglied/der Mitgliedschaft zugeordnet.',
    highlights: [
      '✉️ Auto-Willkommensmail direkt nach Verbands-Anmeldung',
      '🧾 Auto-Rechnung 2 Std. später (fortlaufende Rechnungsnummer)',
      '⚖️ Mail-Archiv: jede Mail gespeichert + dem Kunden zugeordnet',
      '✅/❌ Kündigung im Popup & Mitglied-Detail bestätigen/ablehnen (mit Mail)',
      '🏛️ Eigene „TDA Verband"-Banner-Reihe + Daily-Briefing-Vermerk',
    ],
    details: 'services/verbandMails.js (Willkommen/Rechnung + processFaelligeRechnungen Cron alle 15 Min); Tabellen verband_mail_log + mitglied_mail_log; vertrag-anpassungen.js genehmigen/ablehnen mit Kündigungs-Mails (Grund/Vertragsdaten) + Logging; AdminRegistrationPopup.jsx kuendigung_antrag-Block; MitgliedschaftTab Bestätigen/Ablehnen; mail-banners dojo_id 2 (Verband-Reihe).',
    files: ['backend/services/verbandMails.js', 'backend/routes/vertrag-anpassungen.js', 'backend/routes/verbandsmitgliedschaften/public.js', 'backend/cron-jobs.js', 'frontend/src/components/AdminRegistrationPopup.jsx', 'frontend/src/components/mitglied-detail/tabs/MitgliedschaftTab.jsx'],
  },
  {
    version: '3.0.68',
    date: '2026-06-15',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Businessplan: Betriebsmittelbedarf in der Mittelbilanz',
    description: 'Die Mittelbilanz (Investitions-/Finanzierungsplan) berücksichtigt jetzt den Betriebsmittelbedarf (Working Capital): Mittelverwendung = Investitionen + Betriebsmittel, geprüft gegen die Mittelherkunft. Neues Eingabefeld in den Stammdaten. Ein Auto-Tipp empfiehlt den Mindest-Betriebsmittelbedarf anhand des tiefsten Liquiditätsengpasses. Auch im PDF als eigene Position der Mittelverwendung.',
    highlights: [
      '💶 Mittelverwendung = Investitionen + Betriebsmittelbedarf',
      '💡 Auto-Tipp: empfohlener Betriebsmittelbedarf = tiefster Liquiditätsengpass',
      '📄 Betriebsmittel-Zeile auch im Businessplan-PDF',
    ],
    details: 'businessplan.js: mittelbilanz um betriebsmittel/investitionen/betriebsmittelEmpfehlung erweitert (annahmen.betriebsmittelbedarf). Frontend: Stammdaten-Feld + Mittelbilanz-Anzeige. PDF-Template: Betriebsmittel-Position.',
    files: ['backend/routes/businessplan.js', 'backend/utils/businessplanPdfTemplate.js', 'frontend/src/components/BusinessplanDashboard.jsx'],
  },
  {
    version: '3.0.67',
    date: '2026-06-15',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'BWA-Report: beleg-genaue Periodenabgrenzung',
    description: 'Die BWA (Buchhaltung → Auswertung) rechnet jetzt periodengerecht: Belege mit Leistungszeitraum werden pro rata über die Monate verteilt (z. B. eine im Januar bezahlte Jahresmiete erscheint als 1/12 pro Monat statt als Klotz im Januar), Bank-/Kassen-Ausgaben nach Buchungsmonat, AfA gleichmäßig über 12 Monate. Gilt für laufendes Jahr und Vorjahresvergleich. Jahressummen bleiben unverändert, nur die monatliche Verteilung ist realistischer.',
    highlights: [
      '🗓️ Belege mit Leistungszeitraum werden in der BWA periodengerecht verteilt',
      '📉 AfA gleichmäßig über 12 Monate statt komplett im Januar',
      '↔️ Auch im Vorjahresvergleich konsistent',
    ],
    details: 'buchhaltung.js: neuer Helfer bwaAusgabenAbgegrenzt (Belege pro rata über leistung_von/bis, sonst Belegdatum; Bank/Kasse nach Buchungsmonat; AfA /12). BWA-Endpunkt nutzt ihn für currentYear + vorjahr.',
    files: ['backend/routes/buchhaltung.js'],
  },
  {
    version: '3.0.66',
    date: '2026-06-15',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Belege: Leistungszeitraum + beleg-genaue Periodenabgrenzung im Businessplan',
    description: 'Belege können jetzt einen Leistungszeitraum (von–bis) bekommen — z. B. eine Jahrespolice 01.01.–31.12. Im Beleg-Formular gibt es dafür zwei Datumsfelder mit Schnellwahl (12 Monate / Quartal). Der Businessplan grenzt die Kosten damit periodengerecht ab: Im BWA-Modus wird jeder Beleg pro rata über seinen Leistungszeitraum auf die Monate verteilt (statt grober Glättung), im EÜR-Modus bleibt es beim tatsächlichen Zahlungsmonat. Gleicher Jahreswert, aber realistische Monatsverteilung.',
    highlights: [
      '🧾 Beleg-Formular: Leistungszeitraum (von–bis) mit Schnellwahl „12 Monate" / „Quartal"',
      '🗓️ BWA verteilt Belege pro rata über den Leistungszeitraum (z. B. Jahrespolice → 1/12 pro Monat)',
      '📒 EÜR weiterhin nach Zahlungsmonat (Zufluss)',
    ],
    details: 'Migration 200 (leistung_von/leistung_bis an buchhaltung_belege). buchhaltung.js: Beleg POST/PUT übernehmen die Felder. businessplan.js: pullBwaKostenByKat verteilt Belege beleg-genau über die Monate.',
    files: [
      'backend/migrations/200_beleg_leistungszeitraum.sql',
      'backend/routes/buchhaltung.js',
      'backend/routes/businessplan.js',
      'frontend/src/components/BuchhaltungTab.jsx',
    ],
  },
  {
    version: '3.0.65',
    date: '2026-06-15',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Businessplan: Kosten-Abgrenzung bei EÜR vs BWA',
    description: 'Die Datenquelle wirkt sich jetzt auch auf die Ausgaben aus: Bei EÜR werden die Kosten wie tatsächlich bezahlt (monatsgenau, mit Zahlungszeitpunkten) übernommen; bei BWA periodengerecht geglättet (Jahreswert ÷ 12 gleichmäßig je Monat). Das macht den Liquiditätsplan bei EÜR realistisch schwankend und das BWA-Ergebnis periodengerecht.',
    highlights: [
      '📒 EÜR: Ausgaben wie bezahlt (monatsgenaue Zahlungszeitpunkte)',
      '🗓️ BWA: Ausgaben periodengerecht geglättet (Jahr ÷ 12)',
    ],
    details: 'businessplan.js: pullBuchhaltung verzweigt die Kosten-Monatswerte je Quelle (EÜR=Ist-Profil, BWA=null→konstanter Monatswert).',
    files: ['backend/routes/businessplan.js', 'frontend/src/components/BusinessplanDashboard.jsx'],
  },
  {
    version: '3.0.64',
    date: '2026-06-15',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'WhatsApp-Integration im Chat-Dashboard (Enterprise) — Code fertig, Meta-Setup ausstehend',
    description: 'Neben dem Facebook Messenger gibt es jetzt auch einen WhatsApp-Kanal: eingehende WhatsApp-Nachrichten (Meta WhatsApp Business Cloud API) landen als Konversationen im Chat-Dashboard und können direkt beantwortet werden — inkl. 24-Stunden-Kundendienstfenster-Logik. Neuer Tab „💬 WhatsApp" im Admin-Chat, Konfiguration unter Einstellungen → Integrationen bzw. Dojo bearbeiten → Digital & Komm. → WhatsApp. Enterprise-Feature (feature_whatsapp). Geht erst live, wenn das Meta-Setup (WhatsApp Business Account + Token + Webhook) hinterlegt ist.',
    highlights: [
      '💬 WhatsApp-Konversationen direkt im Chat-Dashboard beantworten',
      '🔒 24-Stunden-Fenster: außerhalb sind nur genehmigte Vorlagen erlaubt',
      '🏢 Enterprise-Feature — Konfiguration pro Dojo (Phone-Number-ID, Token, App Secret)',
    ],
    details: 'Backend: routes/whatsapp.js (Auto-Loader → /api/whatsapp): Webhook GET/POST (whatsapp_business_account-Struktur, HMAC via req.rawBody), config GET/PUT, conversations, send (Cloud API, Bearer-Token, 24h-Guard), test-token. Migrationen: 203 (chat_messages.sender_type + chat_rooms.source ENUMs um whatsapp_* erweitert), 204 (dojo_whatsapp_config + whatsapp_conversations), 205 (feature_whatsapp in dojo_subscriptions + plan_features/plan_feature_mapping → Enterprise). Frontend: AdminChatPage WhatsApp-Tab, WhatsAppConversationList.jsx, ChatWindow generalisiert (Messenger+WhatsApp = externe Kanäle), WhatsAppKonfiguration.jsx in IntegrationsEinstellungen + DojoEdit. featureAccess.js + subscription.js + SubscriptionContext.jsx um whatsapp ergänzt.',
    files: ['backend/routes/whatsapp.js', 'backend/migrations/205_whatsapp_feature_flag.sql', 'backend/middleware/featureAccess.js', 'backend/routes/subscription.js', 'frontend/src/components/chat/AdminChatPage.jsx', 'frontend/src/components/chat/WhatsAppConversationList.jsx', 'frontend/src/components/chat/ChatWindow.jsx', 'frontend/src/components/WhatsAppKonfiguration.jsx', 'frontend/src/components/IntegrationsEinstellungen.jsx', 'frontend/src/components/DojoEdit.jsx'],
  },
  {
    version: '3.0.63',
    date: '2026-06-15',
    type: 'bugfix',
    zielgruppe: 'intern',
    title: 'Gürtelprüfungs-Popup im Mitglieder-Dashboard erschien nicht (Crash behoben)',
    description: 'Im Mitglieder-Dashboard konnte das Prüfungs-Einladungs-Popup ausbleiben und die Prüfungs-Kachel verschwinden: Der Setter setApprovedExams unterstützte keine funktionalen Updates, wurde aber so aufgerufen (prev => prev.map) → approved wurde zur Funktion statt Array → „approvedExams.map is not a function" beim Render. Jetzt functional-update-fähig + Array-Sicherheitsgurt.',
    highlights: [
      '🥋 Prüfungs-Einladung wird wieder zuverlässig als Popup angezeigt (für gemeldete Mitglieder)',
    ],
    details: 'MemberDashboard.jsx: setApprovedExams unterstützt nun typeof val === "function" (functional update gegen prev.approved); approvedExams = Array.isArray(examData.approved) ? … : []. Crash war in der md-exam-card-purple-Render-Liste (app.tda-vib.de/member/dashboard).',
    files: ['frontend/src/components/MemberDashboard.jsx'],
  },
  {
    version: '3.0.62',
    date: '2026-06-15',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Einheitliches E-Mail-Design + zentrale Banner-Verwaltung (HOF, Dojo, Events)',
    description: 'Alle drei Systeme (Hall of Fame, Dojosoftware, TDA Events) haben jetzt ein einheitliches, Outlook-robustes (tabellen-basiertes) E-Mail-Layout über einen zentralen renderEmail(). HOF/Events zweisprachig (DE/EN), Dojosoftware deutsch mit White-Label pro Dojo (Logo/Farbe). Neu im Super-Admin (System → E-Mail): zentrale Mail-Banner-Verwaltung — pro App und Anlass (Einladung/Begrüßung/Rechnung/Allgemein) ein Banner hochladen; eigene Banner pro Dojo sind ein Enterprise-Feature. Versand läuft über Brevo (info@tda-intl.com).',
    highlights: [
      '✉️ Einheitliches, Outlook-festes Mail-Design in allen Apps (Banner-Kopf je Anlass)',
      '🖼️ Banner zentral verwaltbar (Super-Admin → System → E-Mail)',
      '🏢 Eigene Mail-Banner pro Dojo = Enterprise-Feature (sonst TDA-Standard)',
    ],
    details: 'Neuer services/emailLayout.js (renderEmail + getDojoMailTheme, White-Label aus dojo-Tabelle) in Dojo + HOF; TDA Events: renderEmail/bilingual in emailService.js, baseHtml als Kompat-Wrapper. Alle Sendestellen + emailTemplates.js/eventEmailService.js umgestellt. routes/mail-banners.js (Auto-Loader → /api/mail-banners, Super-Admin-only): Tabelle mail_banner (app, anlass, dojo_id), Upload nach uploads/mail-banners/ → zentrale URL, manifest.json von allen App-Renderern gelesen (60s-Cache). dojo_id>0 nur Enterprise/Trial (dojoMayBrand). Text-Header wird bei vorhandenem Banner ausgeblendet.',
    files: ['backend/routes/mail-banners.js', 'backend/services/emailLayout.js', 'backend/services/emailService.js', 'backend/services/emailTemplates.js', 'backend/services/eventEmailService.js', 'frontend/src/components/MailBannerVerwaltung.jsx', 'frontend/src/components/SuperAdminDashboard.jsx'],
  },
  {
    version: '3.0.61',
    date: '2026-06-13',
    type: 'improvement',
    zielgruppe: 'allgemein',
    title: 'Quittungen leichter auffindbar (eigene Kachel im Mitglieder-Dashboard)',
    description: 'Die Quittungs-Funktion war als 5. Tab unter „Meine Beiträge" versteckt — Mitglieder fanden sie nicht. Jetzt gibt es auf dem Mitglieder-Dashboard eine eigene Kachel „Quittungen", die direkt den Quittungen-Bereich öffnet (Deep-Link ?tab=quittungen).',
    highlights: [
      '🧾 Eigene „Quittungen"-Kachel auf dem Dashboard → direkt zum PDF-Quittungsbereich',
    ],
    details: 'MemberDashboard.jsx: neue CTA-Kachel (FileText) → /member/payments?tab=quittungen. MemberPayments.jsx: liest ?tab= (useSearchParams) und öffnet den passenden Tab. i18n navigation.myReceipts (de/en/it).',
    files: ['frontend/src/components/MemberDashboard.jsx', 'frontend/src/components/MemberPayments.jsx', 'frontend/src/locales/*/member.json'],
  },
  {
    version: '3.0.60',
    date: '2026-06-13',
    type: 'system',
    zielgruppe: 'intern',
    title: 'Passwort vergessen: auch für Admin-Accounts (admin_users)',
    description: 'Der Passwort-vergessen-Flow deckt jetzt auch die admin_users-Accounts ab (eigenes Login-System, hatte bisher gar keinen Reset). forgot-password prüft zuerst users, dann admin_users; reset-password-token erkennt admin_users-Tokens am Präfix „a_" und nutzt deren reset_token/reset_token_ablauf-Spalten. Tote/fehlerhafte api.js-Funktion resetPassword entfernt.',
    highlights: [
      '🔓 Admin-Accounts (admin_users) können ihr Passwort jetzt auch zurücksetzen (sobald Mailversand läuft)',
    ],
    details: 'auth.js: forgot-password + reset-password-token um admin_users-Zweig erweitert (Token-Präfix a_, argon2id). Greift voll, sobald der Mailversand (Brevo) wieder läuft.',
    files: ['backend/routes/auth.js', 'frontend/src/services/api.js'],
  },
  {
    version: '3.0.59',
    date: '2026-06-13',
    type: 'feature',
    zielgruppe: 'allgemein',
    title: 'Mitglieder können ihre Sicherheitsfrage selbst festlegen',
    description: 'In der Mitglieder-App unter Profil → Sicherheit kann nun jeder selbst eine Sicherheitsfrage hinterlegen (vorher nur durch den Admin). Damit wird der E-Mail-unabhängige Passwort-Reset für alle nutzbar. Ist noch keine Frage gesetzt, wird das deutlich angezeigt („Nicht gesetzt — Jetzt festlegen"). Außerdem: Passwort-Mindestlänge in der App auf 12 Zeichen korrigiert (passte vorher nicht zur Server-Vorgabe).',
    highlights: [
      '🔑 Sicherheitsfrage selbst setzen (Profil → Sicherheit) → Passwort-Reset ohne E-Mail möglich',
      '⚠️ Sichtbarer Hinweis, wenn keine Frage hinterlegt ist',
    ],
    details: 'MemberProfilePage.jsx: Sicherheitsfrage-Abschnitt (GET /auth/security/status, POST /auth/security), Passwort-Mindestlänge 8→12 angeglichen.',
    files: ['frontend/src/components/MemberProfilePage.jsx'],
  },
  {
    version: '3.0.58',
    date: '2026-06-13',
    type: 'feature',
    zielgruppe: 'allgemein',
    title: 'Passwort vergessen: zusätzlich per Sicherheitsfrage (ohne E-Mail)',
    description: 'Die Passwort-zurücksetzen-Seite bietet jetzt zwei Wege: per E-Mail-Link (wie bisher) ODER per Sicherheitsfrage — letzteres funktioniert komplett ohne E-Mail-Versand. So können Nutzer ihr Passwort auch dann zurücksetzen, wenn der Mailversand gestört ist. Voraussetzung: eine hinterlegte Sicherheitsfrage. (Hinweis: die meisten Nutzer haben noch keine gesetzt — das member-seitige Setzen + die Aufforderung dazu folgt als nächster Schritt.)',
    highlights: [
      '🔐 Passwort-Reset per Sicherheitsfrage als E-Mail-unabhängiger Notnagel',
      '🛡️ Enumeration-Schutz verbessert (generische Fehlermeldung bei falscher Antwort)',
    ],
    details: 'PasswordReset.jsx: Umschalter E-Mail/Sicherheitsfrage → /auth/reset-password (loginField + Frage + Antwort + neues Passwort). Backend: GET /auth/security/status (für künftige Aufforderung), /auth/reset-password gibt bei falscher Antwort jetzt generische Meldung.',
    files: ['frontend/src/components/PasswordReset.jsx', 'backend/routes/auth.js'],
  },
  {
    version: '3.0.57',
    date: '2026-06-12',
    type: 'system',
    zielgruppe: 'intern',
    title: 'Backend-Absturzsicherung + Member-App überbrückt Restarts',
    description: 'Maßnahmenpaket gegen die wiederkehrenden 502-Aussetzer („App geht nicht"). Ursache identifiziert: Der laufende Backend-Prozess lief OHNE die getunte ecosystem.config.js (kein V8-Heap-Limit, max_memory_restart auf 2 GB statt 1800M) → Speicher konnte unkontrolliert wachsen bis zum harten PM2-Restart, ohne Fehler-Log. Jetzt: Prozess läuft via ecosystem.config.js (Heap-Cap 1536M, Restart bei 1800M, Exp-Backoff), Crash-Diagnose schreibt Signal/Exit-Code/Speicher vor dem Sterben in dojosoftware-crash.log, Graceful Shutdown bei SIGTERM, Memory-Watchdog warnt ab 1400 MB. Frontend: Mitglieder-App überbrückt einen Backend-Neustart bei Ladevorgängen jetzt ~14s transparent (GET-Retry mit Backoff) statt sofort Fehler zu zeigen.',
    highlights: [
      '🛡️ Backend läuft endlich mit Heap-Limit + sauberem Memory-Restart (war nie aktiv)',
      '🔎 Crash-Diagnose-Log: Absturzursache wird belegt statt geraten',
      '🔁 Member-App überbrückt Deploy-/Restart-Blips ~14s transparent (kein „App geht nicht" mehr)',
    ],
    details: 'server.js: crashLine() → /var/log/pm2/dojosoftware-crash.log, gracefulShutdown (SIGTERM/SIGINT/SIGHUP), Memory-Watchdog 30s/1400M. PM2 via pm2 delete + start ecosystem.config.js + pm2 save (node_args --max-old-space-size=1536, max_memory_restart 1800M). fetchWithAuth.js: GET-Retry [600,1200,2500,4000,6000].',
    files: ['backend/server.js', 'backend/ecosystem.config.js', 'frontend/src/utils/fetchWithAuth.js'],
  },
  {
    version: '3.0.56',
    date: '2026-06-11',
    type: 'bugfix',
    zielgruppe: 'allgemein',
    title: 'Abwesenheit: Datum „Heute" wurde um einen Tag zurückgesetzt',
    description: 'Beim Abmelden (Abwesenheit/krank/Urlaub) wurde das Heute-Datum durch eine UTC-Umrechnung um einen Tag zu früh angezeigt bzw. gespeichert. Datumswerte werden jetzt durchgängig als lokale Tagesdaten behandelt (Backend liefert YYYY-MM-DD direkt), sodass „Heute" auch wirklich heute ist.',
    highlights: [
      '🗓️ Abwesenheit „Heute" zeigt/speichert jetzt das korrekte Datum (kein -1 Tag mehr)',
    ],
    details: 'Ursache: toISOString() (UTC) im Frontend + DATE-Spalte → UTC-Timestamp im JSON. Fix: routes/abwesenheiten.js liefert datum/datum_bis via DATE_FORMAT als YYYY-MM-DD; AbwesenheitWidget.jsx nutzt lokale Datums-Helper statt toISOString.',
    files: ['backend/routes/abwesenheiten.js', 'frontend/src/components/AbwesenheitWidget.jsx'],
  },
  {
    version: '3.0.55',
    date: '2026-06-11',
    type: 'feature',
    zielgruppe: 'allgemein',
    title: 'Mitglieder-App: Quittungen selbst als PDF ziehen',
    description: 'Mitglieder können sich für ihre bereits bezahlten Beiträge jederzeit selbst eine Quittung als PDF erstellen und herunterladen. Sie wählen dabei das Jahr und den Umfang (nur Monatsbeiträge oder alle bezahlten Posten) sowie eine Gesamtquittung oder eine Einzelquittung pro Zahlung. Die PDF wird live erzeugt und nicht bei uns gespeichert.',
    highlights: [
      '🧾 Self-Service-Quittung für bezahlte Beiträge – Jahr + Umfang frei wählbar',
      '📄 Gesamtquittung oder Einzelquittung je Zahlung',
      '🔒 On-the-fly erzeugt, nichts gespeichert; nur eigene Posten (Multi-Tenant-sicher)',
    ],
    details: 'Neuer Tab „Quittungen" unter Meine Beiträge & Zahlungen. Backend routes/quittungen.js (GET /api/quittungen/posten + /pdf, Puppeteer, authenticateToken → nur req.user.mitglied_id). Zeitzonen-sicher via DATE_FORMAT.',
    files: ['backend/routes/quittungen.js', 'frontend/src/components/MemberPayments.jsx'],
  },
  {
    version: '3.0.54',
    date: '2026-06-11',
    type: 'system',
    zielgruppe: 'intern',
    title: 'Member-App: Performance-Telemetrie (Diagnose langsamer Geräte)',
    description: 'Schlanker Beacon beim App-Start erfasst Ladezeit + Gerät (RAM/CPU) + Netzqualität (effectiveType/downlink/rtt) je Mitglied, um gezielt herauszufinden, welche Mitglieder/Geräte/Netze langsam sind („bei manchen langsam, bei mir nicht"). Fire-and-forget, beeinflusst die App nicht. Tabelle member_perf_log.',
    highlights: [
      '📊 Echte Lade-Messwerte pro Mitglied/Gerät/Netz → gezielte Optimierung statt raten',
    ],
    details: 'routes/perf.js (POST /api/perf/member-load), Migration 202 (member_perf_log), MemberDashboard.jsx Beacon nach memberData.',
    files: ['backend/routes/perf.js', 'backend/migrations/202_member_perf_log.sql', 'frontend/src/components/MemberDashboard.jsx'],
  },
  {
    version: '3.0.53',
    date: '2026-06-11',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Member-App robuster: Fetch-Timeout + Selbstheilung bei Crash',
    description: 'Zwei Stabilitäts-Maßnahmen, damit die App nicht mehr „hängt" oder weiß bleibt: (1) Jeder Request bekommt ein Timeout (Laden 15s, Uploads 60s) + Auto-Retry — hängende Requests frieren die App nicht mehr ein. (2) Stürzt eine Komponente ab, lädt die App automatisch EINMAL neu (mit Cache-Bust, Loop-geschützt) statt eine leere/weiße Seite zu zeigen.',
    highlights: [
      '⏱️ Fetch-Timeout (15s GET / 60s Upload) → kein endloses „lädt …" mehr',
      '🔁 Auto-Retry bei transienten Fehlern (Netzwerk/502/503)',
      '🛟 Selbstheilung: Auto-Reload bei Crash (Cache-Bust, max. 1×/60s)',
    ],
    details: 'utils/fetchWithAuth.js: AbortController-Timeout je Versuch; components/ErrorBoundary.jsx: einmaliger Auto-Reload (sessionStorage-Zeit-Guard) + ruhige Lade-Anzeige.',
    files: ['frontend/src/utils/fetchWithAuth.js', 'frontend/src/components/ErrorBoundary.jsx'],
  },
  {
    version: '3.0.52',
    date: '2026-06-11',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Kickboxanzug-Bestellvorlage + Bestellungen-Tab vereinheitlicht',
    description: 'Neue Bestellvorlage für Kickboxanzüge (analog zur Gi-Vorlage): Oberteil + Hose, Hersteller-Sizechart (A–E, 100–150 cm + S–XXL) vorbefüllt, Produktbild-Upload, Stickerei/Branding inkl. „Innenseite Jacke", Material inkl. Polyester (ohne Webart/Unzen). Der Bestelltab heißt jetzt allgemein „Dojo-Bestellungen" mit Spalte „Art" (Gi/T-Shirt/Kickbox).',
    highlights: [
      '🥊 „+ Neue Kickbox-Bestellung" mit 1:1-Sizechart, Produktbild-Upload & PDF',
      '📦 „Dojo-Bestellungen" (allgemein) + Spalte „Art" zeigt den Bestelltyp',
    ],
    details: 'KickboxBestellvorlage.jsx (neu, _typ:kickbox), BestellungenTab.jsx (Button/Overlay/Art-Spalte/Umbenennung), giBestellungen.js (bestell_typ kickbox/tshirt).',
    files: ['frontend/src/components/KickboxBestellvorlage.jsx', 'frontend/src/components/BestellungenTab.jsx', 'backend/routes/giBestellungen.js'],
  },
  {
    version: '3.0.51',
    date: '2026-06-11',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Auto-Retry bei kurzen Server-Blips (Deploy-Neustarts)',
    description: 'Wenn das Backend kurz nicht erreichbar ist (z. B. während eines Deploy-Neustarts), wiederholt die App fehlgeschlagene Requests automatisch (bis zu 2×, 600ms/1500ms Backoff), statt mit leeren Daten / „Server down" stehen zu bleiben. Greift nur bei transienten Fehlern (Netzwerkfehler / 502 / 503) — sicher auch für Schreib-Requests, da diese den Server gar nicht erst erreicht haben.',
    highlights: [
      '🔄 Lade-Fetches überstehen kurze Neustart-Fenster automatisch',
      '🛡️ Keine leere Member-App / kein „Server down" mehr bei Mini-Blips',
      '✅ Sicher: nur transiente Fehler, kein Doppel-Auslösen von Schreib-Aktionen',
    ],
    details: 'utils/fetchWithAuth.js: Retry-Schleife um den fetch (Netzwerkfehler/502/503).',
    files: ['frontend/src/utils/fetchWithAuth.js'],
  },
  {
    version: '3.0.50',
    date: '2026-06-10',
    type: 'bugfix',
    zielgruppe: 'intern',
    title: 'Member-App: Namensanzeige-Fallback sauber formatiert',
    description: 'Wenn der echte Mitgliedsname (Vorname/Nachname) gerade nicht geladen werden konnte (z. B. kurzer Server-Blip beim Deploy), wurde im Header/Dashboard der rohe Login-Username angezeigt (z. B. "sam.schreiner" → "Sam. Schreiner"). Der Fallback formatiert den Username jetzt sauber (Punkt/Unterstrich → Leerzeichen, großgeschrieben) → "Sam Schreiner".',
    highlights: [
      '👤 Sauberer Anzeigename auch im Fallback (keine "x.y"-Usernamen mehr)',
    ],
    details: 'MemberHeader.jsx: prettyName() für Username-Fallback; MemberDashboard.jsx: gleicher Fallback inline.',
    files: ['frontend/src/components/MemberHeader.jsx', 'frontend/src/components/MemberDashboard.jsx'],
  },
  {
    version: '3.0.49',
    date: '2026-06-10',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Prüfungskandidaten: Sortierung nach Status-Blöcken (A–Z innerhalb)',
    description: 'Die Kandidatenliste je Stil ist jetzt in drei Blöcke gegliedert — oben die Berechtigten, darunter die bereits Zugelassenen, ganz unten die noch nicht Berechtigten/Zugelassenen. Innerhalb jedes Blocks wird wie gewohnt alphabetisch (A–Z) sortiert; Spalten-Sortierung wirkt weiterhin innerhalb der Blöcke.',
    highlights: [
      '⬆️ Berechtigte oben, dann Zugelassene, dann der Rest',
      '🔤 Innerhalb jedes Blocks A–Z (Name)',
    ],
    details: 'PruefungsKandidatenTab.jsx: Standard-Sortierung A–Z (Name) wenn keine Spalte aktiv; stabile Block-Sortierung tierOf (berechtigt=0, zugelassen=1, sonst=2).',
    files: ['frontend/src/components/PruefungsKandidatenTab.jsx'],
  },
  {
    version: '3.0.48',
    date: '2026-06-10',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Prüfungsverwaltung: aufgeräumte, einheitliche Kopfleiste',
    description: 'Die Kopfleiste wurde vereinheitlicht: Titel links, alle Steuerungen (Stil-Filter, Aktualisieren, Gürtel-Statistik) rechts in einer Zeile gruppiert, darunter die Tabs als gleichmäßige Reihe statt umbrechend/verstreut.',
    highlights: [
      '🧭 Tabs in einer gleichmäßigen Reihe (kein Umbruch mehr)',
      '🎛️ Stil-Filter + Aktualisieren + Gürtel-Statistik einheitlich rechts gruppiert',
    ],
    details: 'PruefungsVerwaltung.jsx: Controls in die Titelzeile verschoben; PruefungsVerwaltung.css: pv3-top-bar vertikal, einheitliche pv3-toolbar-btn/-icon-btn, Tabs flex:1 nowrap.',
    files: ['frontend/src/components/PruefungsVerwaltung.jsx', 'frontend/src/styles/PruefungsVerwaltung.css'],
  },
  {
    version: '3.0.47',
    date: '2026-06-10',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Prüfungen: Zahlungsart vom Termin übernehmen + Lastschrift erst nach Zusage',
    description: 'Die bei der Termin-Erstellung gewählte Zahlungsart (Rechnung/Lastschrift) wird jetzt am Termin gespeichert und bei der Zulassung automatisch übernommen — der Zahlungsart-Schritt im Zulassungs-Modal entfällt, wenn der Termin sie schon kennt. Außerdem: Rechnung & SEPA-Lastschrift entstehen NICHT mehr schon bei der Zulassung, sondern erst wenn das Mitglied die Teilnahme mit „Ja, ich komme" bestätigt — so wird nie vor der Zusage abgebucht, und bei „komme nicht" entsteht keine Forderung.',
    highlights: [
      '💳 Zahlungsart wird am Prüfungstermin gespeichert & bei Zulassung übernommen (keine Doppel-Abfrage)',
      '🔒 Lastschrift/Rechnung erst nach Teilnahme-Zusage des Mitglieds — kein Einzug vor Bestätigung',
      '🧹 Bei „komme nicht" entsteht keine Prüfungsgebühr-Forderung mehr',
    ],
    details: 'Migration 201 (zahlungsart in pruefungstermin_vorlagen); termine.js create/update; kandidaten.js: createRechnungBeiZusage() idempotent im /antwort-Endpoint statt beim Zulassen; PruefungsVerwaltung.jsx: Modal überspringt Zahlungsart-Schritt.',
    files: ['backend/routes/pruefungen/kandidaten.js', 'backend/routes/pruefungen/termine.js', 'backend/migrations/201_pruefungstermin_zahlungsart.sql', 'frontend/src/components/PruefungsVerwaltung.jsx'],
  },
  {
    version: '3.0.46',
    date: '2026-06-10',
    type: 'bugfix',
    zielgruppe: 'intern',
    title: 'Prüfungen: Ausnahme-Zulassung findet den kommenden Termin wieder',
    description: 'Die Ausnahme-Zulassung (Kandidaten ohne zeitliche Voraussetzungen) brach beim Klick still ab, wenn man nicht vorher den Prüfungstermine-Tab geöffnet hatte. Ursache: openTerminAuswahl filterte nur die im Speicher gehaltene Termin-Liste, die im Kandidaten-Tab nicht geladen wird. Jetzt holt openTerminAuswahl die Termine — wie der normale Zulassungs-Weg — bei Bedarf frisch vom Server.',
    highlights: [
      '🛠️ Ausnahme-Zulassung öffnet das Termin-Modal wieder zuverlässig',
      '🔄 Termine werden im Kandidaten-Tab mitgeladen + bei Bedarf frisch per API geholt',
      '🧭 stil_id-Vergleich robust (Typ-tolerant)',
    ],
    details: 'PruefungsVerwaltung.jsx: openTerminAuswahl async + API-Fallback GET /pruefungen/termine?stil_id=&dojo_id=; Kandidaten-Tab lädt zusätzlich fetchPruefungstermine().',
    files: ['frontend/src/components/PruefungsVerwaltung.jsx'],
  },
  {
    version: '3.0.45',
    date: '2026-06-09',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Businessplan: Mitgliederentwicklung je Tarifgruppe + echte EÜR/BWA-Abgrenzung',
    description: 'Die Datenquelle EÜR und BWA unterscheiden sich jetzt fachlich korrekt: EÜR = Zufluss (tatsächlich gezahlte Beiträge je Zahlungsmonat, Kassensicht); BWA = periodengerecht (Soll-Mitgliederbestand je Tarifgruppe aus den Vertragslaufzeiten). In der Auswertung zeigt die Mitglieder-Karte zusätzlich die monatliche Entwicklung je Tarifgruppe (Schüler/Erwachsene/Kinder × Laufzeit) als Tabelle.',
    highlights: [
      '📈 Mitgliederentwicklung je Tarifgruppe als Monatsverlauf (Jan–Dez) in der Auswertung',
      '📒 EÜR = Zufluss/Ist (gezahlte Beiträge je Monat)',
      '🗓️ BWA = periodengerecht (Bestand aus Vertragslaufzeiten, unabhängig vom Zahlungseingang)',
    ],
    details: 'businessplan.js: pullBuchhaltung(quelle) verzweigt Beitrags-Quelle (vertraege-Laufzeiten vs beitraege-Zahlungen); computeAuswertung liefert mitgliederGruppen (Verlauf je Gruppe).',
    files: ['backend/routes/businessplan.js', 'frontend/src/components/BusinessplanDashboard.jsx'],
  },
  {
    version: '3.0.44',
    date: '2026-06-09',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Businessplan: geführter Wizard, monatsgenaue Eingabe & Buchhaltungs-Anbindung',
    description: 'Großer Ausbau des Businessplan-Moduls: kompletter Umbau zu einem geführten Schritt-für-Schritt-Wizard mit neuem Design und Diagrammen. Eingabe jetzt monatsgenau (12 Spalten je Position), Detailfelder für AfA (Satz/Restbuchwert), Personal (Art/Funktion, Sozialsätze je Gruppe) und Kapitaldienst (Auszahlmonat, tilgungsfreie Zeit). Beim Anlegen wählbar: Datenquelle EÜR/BWA + Organisation. Vorbefüllung übernimmt Einnahmen & Ausgaben (nach Kategorie) der letzten 12 Monate — Mitgliedsbeiträge aufgeschlüsselt nach Tarifgruppe (Schüler/Erwachsene/Kinder) × Laufzeit, plus Aufnahmegebühr und Startpaket-Platzhalter. Neuer „Aus Buchhaltung aktualisieren"-Button holt Daten nach, ohne manuelle Positionen zu überschreiben.',
    highlights: [
      '🧭 Geführter Wizard (9 Schritte) statt Tabs, neues Design + Liquiditäts-/Mitglieder-Diagramme',
      '📅 Eingabe pro Monat für Umsatz, Kosten, Personal, Privatentnahmen',
      '📒 Vorbefüllung aus EÜR/BWA inkl. Organisationswahl; Mitgliedsbeiträge nach Tarif (Alter × Laufzeit)',
      '🔄 „Aus Buchhaltung aktualisieren" — importierte Positionen werden neu gezogen, manuelle bleiben',
    ],
    details: 'Migrationen 198 (monatsgenaue JSON-Werte + AfA/Personal/Kapitaldienst-Felder) und 199 (aus_buchhaltung-Flag). businessplan.js: pro-Monat-Engine, pullBuchhaltung/importBuchhaltung aus v_euer-Views + vertraege/tarife, POST /plaene/:id/sync. Frontend BusinessplanDashboard.jsx als Wizard neu aufgebaut.',
    files: [
      'backend/migrations/198_businessplan_detail.sql',
      'backend/migrations/199_businessplan_quelle.sql',
      'backend/routes/businessplan.js',
      'backend/utils/businessplanPdfTemplate.js',
      'frontend/src/components/BusinessplanDashboard.jsx',
      'frontend/src/components/BusinessplanDashboard.css',
    ],
  },
  {
    version: '3.0.43',
    date: '2026-06-09',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Neues Enterprise-Modul: Businessplan & Finanzplanung',
    description: 'Vollständiges Businessplan-Modul mit klassischer Finanzplanung: Investitions-/Finanzierungsplan (mit Mittelbilanz-Check), Umsatz- und Kostenplanung, AfA, Kapitaldienst, Privatentnahmen, automatische Rentabilitätsvorschau, 3-Jahres-Planung und monatlicher Liquiditätsplan. Dazu ein generierbares Businessplan-PDF (für Bank/Förderung) und ein strategisches Ziele-Board mit KPIs. Beim Anlegen wählbar: aus vorhandenen Ist-Daten vorbefüllen oder komplett neu. Ein „Noch auszufüllen"-Hinweis zeigt leere Bereiche.',
    highlights: [
      '📈 Neuer Tab „Businessplan" (Enterprise) mit Übersicht, Finanzplanung, Dokument & Ziele-Board',
      '🧮 Engine: Rentabilität, 3-Jahres-Plan, Liquidität, Investitions-/Finanzierungs-Bilanz',
      '🗂️ Vorbefüllung aus Ist-Daten (aktive Mitglieder × Ø-Beitrag als Umsatzbasis)',
      '📄 PDF-Export des kompletten Businessplans',
    ],
    details: 'Migration 196 (feature_businessplan + Tabellen businessplan_plaene/investitionen/finanzierung/umsatz/kosten/privatentnahmen/ziele/meilensteine/dokumente). Backend: routes/businessplan.js (requireFeature(\'businessplan\'), getSecureDojoId, generisches Positions-CRUD, computeAuswertung), utils/businessplanPdfTemplate.js. Frontend: BusinessplanDashboard.jsx + .css, eingebunden in Dashboard.jsx. Feature-Gating in featureAccess.js + subscription.js.',
    files: [
      'backend/migrations/196_businessplan.sql',
      'backend/routes/businessplan.js',
      'backend/utils/businessplanPdfTemplate.js',
      'backend/server.js',
      'backend/middleware/featureAccess.js',
      'backend/routes/subscription.js',
      'frontend/src/components/BusinessplanDashboard.jsx',
      'frontend/src/components/BusinessplanDashboard.css',
      'frontend/src/components/Dashboard.jsx',
    ],
  },
  {
    version: '3.0.42',
    date: '2026-06-08',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Deploy: offene Tabs überleben Deploys (keine Stale-Chunk-404 mehr)',
    description: 'Bei jedem Deploy löschte rsync --delete alle alten Programm-Teile (Chunks) — offene Tabs/PWAs, die noch die alte Version geladen hatten, bekamen dann 404 („Failed to load resource") und stürzten ab. Jetzt bleiben die gehashten Chunks erhalten (alt + neu koexistieren kollisionsfrei), nur Chunks älter als 14 Tage werden aufgeräumt.',
    highlights: [
      '🗂️ assets/ wird ohne --delete deployed → bereits offene Sitzungen laden ihre Chunks weiter',
      '🧹 Automatische Aufräumung: Chunks > 14 Tage werden beim Deploy entfernt (kein unbegrenztes Wachstum)',
      '🔄 index.html/sw.js/version.json weiterhin mit --delete aktualisiert',
    ],
    details: 'deploy.sh: zweistufiges rsync (Root mit --delete --exclude assets/, dann assets/ ohne --delete) + find -mtime +14 -delete, für beide Webroots (dojo.tda-intl.org + app.tda-vib.de).',
    files: [
      'deploy.sh',
    ],
  },
  {
    version: '3.0.41',
    date: '2026-06-08',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Akquise: Telefonliste nach Bundesland (für Sparringstreff-Anrufe)',
    description: 'In der Kontakte-Übersicht gibt es jetzt einen „📞 Telefonliste"-Button: sortiert die Kontakte nach Bundesland (abgeleitet aus der PLZ), mit Bundesland-Gruppen-Überschriften und klickbaren Telefonnummern (tel:). Ideal zum strukturierten Abtelefonieren — z.B. Einladungen zum Sparringstreff.',
    highlights: [
      '📞 TELEFONLISTE-MODUS: Kontakte nach Bundesland gruppiert + sortiert (PLZ → Bundesland)',
      '☎️ Telefonnummern direkt anklickbar (tel:-Link) + PLZ/Ort in jeder Zeile',
      '🗂️ Bundesland-Überschriften mit Anzahl je Region',
    ],
    details: 'AkquiseDashboard.jsx: plzZuBundesland(plz)-Helper, sortByBundesland-State, Toggle in der Listen-Toolbar, Gruppen-Header bei Bundesland-Wechsel, Telefon in der Kontakt-Meta-Zeile.',
    files: [
      'frontend/src/components/AkquiseDashboard.jsx',
    ],
  },
  {
    version: '3.0.40',
    date: '2026-06-08',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Sicherheit: eingeloggte Nutzer werden nicht mehr automatisch IP-gesperrt',
    description: 'Beim heutigen App-Crash feuerte die Member-App eine Request-Flut, die der Security-Monitor als Angriff wertete (50 Alerts → IP-Block) — legitime Mitglieder wurden ausgesperrt und sahen „Ihre IP-Adresse wurde temporär blockiert". Jetzt sind eingeloggte Nutzer (gültiges Token) von der automatischen IP-Blockierung ausgenommen; der Schutz gilt weiter voll für anonyme Angreifer.',
    highlights: [
      '🔓 Gültiges Auth-Token → niemals automatischer IP-Block (verhindert Selbst-Aussperrung)',
      '🛡️ Brute-Force-/Angriffsschutz für anonyme Requests bleibt unverändert aktiv',
      '🧹 Heute fälschlich geblockte IP entsperrt + Alerts bereinigt',
    ],
    details: 'middleware/securityMonitor.js: hasValidToken(req) (jwt.verify) — bei gültigem Token wird die isIPBlocked-Prüfung übersprungen. SQLi/XSS-Erkennung bleibt für alle aktiv.',
    files: [
      'backend/middleware/securityMonitor.js',
    ],
  },
  {
    version: '3.0.39',
    date: '2026-06-08',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'KRITISCH: Mitglieder-App stürzte ab (Gürtel-Widget) — behoben',
    description: 'Die Mitglieder-App zeigte „Etwas ist schiefgelaufen / Can\'t find variable: i". Ursache: Im Gürtel-Widget des MemberDashboards nutzte ein .map()-Callback den Index i, ohne ihn als Parameter zu deklarieren — im minifizierten Prod-Build ein harter Crash. Der Bug war seit v3.0.17 (05.06.) latent und wurde durch den PWA-Cache der Mitglieder verdeckt; erst nach dem Cache-Reset heute trat er auf.',
    highlights: [
      '🐛 currentBelts.map((b)) → currentBelts.map((b, i)) — fehlender Index-Parameter ergänzt',
      '💥 Behebt den Totalausfall der Mitglieder-App (weißer Fehler-Screen)',
      '🔎 Diagnose über den echten Fehlertext + minifiziertes Bundle — kein Cache-Problem, echter Code-Bug',
    ],
    details: 'MemberDashboard.jsx Z.1709: map-Callback um Index i erweitert (genutzt in Z.1718 „i === 0" für die Nächste-Prüfung-Anzeige am obersten Gürtel).',
    files: [
      'frontend/src/components/MemberDashboard.jsx',
    ],
  },
  {
    version: '3.0.38',
    date: '2026-06-08',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Apps tolerieren kurze Backend-Neustarts — keine „Wartungs"-Meldung mehr bei Deploys',
    description: 'Ein einzelner fehlgeschlagener API-Call (z.B. während eines 2-3-Sek-Backend-Neustarts beim Deploy) löste sofort die Vollbild-Wartungsseite aus — Mitglieder sahen „Server im Kampf mit den Updates". Jetzt wird ein kurzer Ausfall toleriert: die Wartungsseite erscheint erst nach ~45 Sek anhaltendem Ausfall.',
    highlights: [
      '🛡️ Kurzer Backend-Neustart (Deploy) bleibt für Nutzer unsichtbar',
      '⏱ server:maintenance-Event löst keine Sofort-Wartung mehr aus, sondern erst einen Verify-Check (2,5 Sek)',
      '🔢 Offline-Schwelle: erst nach 3 aufeinanderfolgenden Fehlversuchen Wartungsseite (statt nach 1)',
    ],
    details: 'ApiHealthCheck.jsx: handleMaintenance triggert verzögerten checkHealth statt sofort offline (checkHealthRef gegen Stale-Closure); Offline-Schwelle consecutiveFailures >= 2.',
    files: [
      'frontend/src/components/ApiHealthCheck.jsx',
    ],
  },
  {
    version: '3.0.37',
    date: '2026-06-08',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Briefing-Popup erscheint wieder zuverlässig (einmal täglich)',
    description: 'Das „Dein Tag"-Popup kam nicht mehr, weil es seit v3.0.25 nur bei überfälligen To-Dos erschien — die importierten Aufgaben haben aber noch keine Fälligkeitsdaten. Jetzt erscheint es wieder einmal täglich beim ersten Login (mit KPIs, neuen Eingängen, To-Dos & Terminen).',
    highlights: [
      '☀️ Popup wieder zuverlässig 1× täglich (kein „nur bei überfällig"-Gate mehr)',
      '🔑 localStorage-Key gewechselt → erscheint sofort wieder, nicht erst morgen',
    ],
    details: 'SuperAdminDashboard.jsx: Inhalts-Gate entfernt, Key sa-briefing-date → sa-briefing-day.',
    files: [
      'frontend/src/components/SuperAdminDashboard.jsx',
    ],
  },
  {
    version: '3.0.36',
    date: '2026-06-07',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Heute-Tab: abgehakte To-Dos verschwinden sofort',
    description: 'Im ☀️ Heute-Tab bleibt eine abgehakte Aufgabe nicht mehr durchgestrichen stehen, sondern wird sofort ausgeblendet — der Tag wird kürzer, während du abarbeitest.',
    highlights: [
      '✅ Abhaken im Heute-Tab → Aufgabe verschwindet direkt aus der Liste',
    ],
    details: 'HeuteTab.jsx: ueberfaellige_todos/faellige_todos werden gegen das erledigt-Set gefiltert.',
    files: [
      'frontend/src/components/HeuteTab.jsx',
    ],
  },
  {
    version: '3.0.35',
    date: '2026-06-07',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'To-Do-Panel: Erledigte wandern nach unten, Sortierung nach Priorität',
    description: 'Im To-Do-Panel werden erledigte Aufgaben jetzt immer ans Listenende sortiert — auch direkt nach dem Abhaken (vorher blieben sie an Ort und Stelle bis zum Neuladen). Offene Aufgaben sortieren nach Priorität (dringend → niedrig), dann nach Fälligkeit.',
    highlights: [
      '✅ ERLEDIGTE immer ganz unten — sofort beim Abhaken (clientseitige Sortierung)',
      '🔢 OFFENE nach Priorität, dann Fälligkeit',
    ],
    details: 'TodoPanel.jsx: filtered-Liste mit .sort() — erledigt-Flag zuerst, dann PRIO_RANK, dann faellig_am.',
    files: [
      'frontend/src/components/TodoPanel.jsx',
    ],
  },
  {
    version: '3.0.34',
    date: '2026-06-07',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'To-Do-Liste aus Apple-Reminders importiert + thematische Bereiche',
    description: '100 persönliche Aufgaben aus den Apple-Reminders ins zentrale To-Do-System übernommen — eine Plattform statt zwei. Neue thematische Bereiche zum Filtern: Finanzen, Prüfungen, Training, Shop, Apps, Website, System, Mitglieder, Setup, HoF.',
    highlights: [
      '🍎 100 To-Dos importiert, nach Bereich + Priorität sortiert (WICHTIG-Block → hoch/dringend)',
      '🏷️ NEUE FILTER-BEREICHE im To-Do-Panel: 💰 Finanzen, 🥋 Prüfungen, 🏋️ Training, 🛒 Shop, 📱 Apps, 🌐 Website, ⚙️ System, 👥 Mitglieder, 🔧 Setup, 🌟 HoF',
      '📊 Verteilung: System 18 · Finanzen 17 · Apps 16 · Prüfungen 13 · Shop 12 · Mitglieder 7 · Website 7 …',
    ],
    details: 'TodoPanel.jsx: KONTEXT_LABELS um thematische Bereiche erweitert. Import per Bulk-INSERT (dojo_id NULL, erstellt_von admin). Tauchen automatisch im Heute-Tab + Briefing auf.',
    files: [
      'frontend/src/components/TodoPanel.jsx',
    ],
  },
  {
    version: '3.0.33',
    date: '2026-06-07',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'To-Do-Bereiche: freier Kontext + neuer Bereich „DojoSoftware"',
    description: 'Die kontext-Spalte war ein starres ENUM — die Event-Checklisten und der Quick-Add (Kontext „Event: …") wären daran gescheitert. Jetzt Freitext. Neuer Bereich „DojoSoftware" für die Aufgabenverwaltung; Vorbereitung für den Import der bisherigen Apple-Reminders.',
    highlights: [
      '🏷️ KONTEXT als Freitext (Migration 195) — behebt latenten Bug bei Auto-Checklisten & Quick-Add',
      '💻 NEUER BEREICH „DojoSoftware" neben Events / Hall of Fame',
      '🍎 VORBEREITUNG: Import der persönlichen To-Dos aus Apple-Reminders ins zentrale To-Do-System',
    ],
    details: 'Migration 195 (todos.kontext ENUM→VARCHAR(80)). TodoPanel.jsx: KONTEXT_LABELS um dojosoftware ergänzt, kontextLabel()-Fallback für freie Werte (z.B. „Event: …").',
    files: [
      'backend/migrations/195_todos_kontext_freitext.sql',
      'frontend/src/components/TodoPanel.jsx',
    ],
  },
  {
    version: '3.0.32',
    date: '2026-06-07',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Pilot rundum: Gewinn/Absage-Mails, Feedback-Auswertung, Akquise-Sync, Cron-Status & mehr',
    description: 'Sechs Verbesserungen rund um Pilot-Programm, Briefing und Betrieb: automatische Mails bei „Gewonnen"/„Abgelehnt", Zufriedenheits-Auswertung im Pilot-Tab, automatischer Akquise-Lead aus jeder Bewerbung, Event-Zuordnung beim Quick-Add, öffentliche Partner-Liste auf der Website und ein Cron-Status im System-Tab.',
    highlights: [
      '🏆 PILOT-MAILS: „Gewonnen" → Willkommen + nächste Schritte, „Abgelehnt" → freundliche Absage (nur bei echtem Statuswechsel)',
      '⭐ FEEDBACK-AUSWERTUNG im Pilot-Tab: Ø-Zufriedenheit, Antwortquote, Balken pro Frage',
      '🗂️ AKQUISE-SYNC: jede Bewerbung wird automatisch heißer Akquise-Kontakt (Tag pilot-beworben, Duplikat-Schutz)',
      '➕ QUICK-ADD: To-Do optional einem kommenden Event zuordnen',
      '🌟 WEBSITE: „Unsere Pilot-Partner" auf tda-intl.org/pilot-partner.html (anonymisiert, nur gewonnene)',
      '⏱ CRON-STATUS im System-Tab: sehen, ob Briefing- & Feedback-Jobs laufen (Ampel + letzter Lauf)',
    ],
    details: 'Migrationen 193 (quelle-enum +pilot) & 194 (cron_runs). pilot-bewerbungen.js (Status-Mails, legeAkquiseKontaktAn, /public/partner), pilot-feedback.js (/admin/auswertung), cron-jobs.js (recordCronRun), admin.js (/cron-status). Frontend: PilotBewerbungen (Auswertung), HeuteTab (Event-Quick-Add), CronStatus.jsx, pilot-partner.html (Partner-Grid).',
    files: [
      'backend/routes/pilot-bewerbungen.js',
      'backend/routes/pilot-feedback.js',
      'backend/cron-jobs.js',
      'backend/routes/admin.js',
      'frontend/src/components/CronStatus.jsx',
      'frontend/src/components/HeuteTab.jsx',
    ],
  },
  {
    version: '3.0.31',
    date: '2026-06-07',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Heute-Tab: 🌟 Kommende Highlights — große Events der nächsten 6 Monate',
    description: 'HoF-Events, Events und Turniere liegen meist außerhalb des 7-Tage-Fensters und waren im Heute-Tab unsichtbar. Neue Sektion „Kommende Highlights": die nächsten großen Termine (max. 5) der kommenden 6 Monate, klickbar verlinkt (HoF → hof.tda-intl.org, Events/Turniere → events.tda-intl.org). Auch in der Morgen-Mail enthalten.',
    highlights: [
      '🌟 HIGHLIGHTS-SEKTION im Heute-Tab: HoF/Events/Turniere bis 6 Monate voraus, mit Jahresangabe',
      '🔗 ALLE verlinkt — Klick öffnet die jeweilige Plattform',
      '📧 MORGEN-MAIL zeigt die Highlights ebenfalls',
    ],
    details: 'briefingService.js: Kalender-Abruf auf 180 Tage erweitert, Split in 7-Tage-Termine + Highlights (typ hof/event/turnier, max 5). HeuteTab.jsx: neue Sektion, TerminZeile mit mitJahr-Datum.',
    files: [
      'backend/services/briefingService.js',
      'frontend/src/components/HeuteTab.jsx',
    ],
  },
  {
    version: '3.0.30',
    date: '2026-06-07',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Termin-Klicks: Übersicht-Zeilen repariert + Demo-Termine verlinkt',
    description: 'Die Gürtelprüfungs- und HoF-Zeilen in der Plattform-Zentrale-Übersicht hatten eigene Markup-Blöcke und waren von v3.0.29 nicht abgedeckt — jetzt ebenfalls klickbar. Demo-Termine öffnen per Deep-Link (?pz=demo-termine) direkt den Demo-Termine-Tab — auch aus dem Heute-Tab heraus.',
    highlights: [
      '🥋 ÜBERSICHT: Gürtelprüfungs-Zeilen → Prüfungsverwaltung, HoF-Zeilen → hof.tda-intl.org',
      '🎯 DEMO-TERMINE: Klick öffnet Dashboard → Plattform-Zentrale → Demo-Termine (Deep-Link ?pz=<tab>)',
      '🔗 DEEP-LINKS: /dashboard?pz=demo-termine funktioniert auch als Lesezeichen — SuperAdminDashboard + PlattformZentrale werten den Parameter beim Laden aus',
    ],
    details: 'kalenderAggregation.js: demo.url=/dashboard?pz=demo-termine. SuperAdminDashboard.jsx + PlattformZentrale.jsx: activeTab-Initializer liest URLSearchParams pz. UebersichtView: Prüfungs-/HoF-Zeilen mit openEventUrl.',
    files: [
      'backend/services/kalenderAggregation.js',
      'frontend/src/components/PlattformZentrale.jsx',
      'frontend/src/components/SuperAdminDashboard.jsx',
    ],
  },
  {
    version: '3.0.29',
    date: '2026-06-07',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Termine im Dashboard & Heute-Tab sind jetzt klickbar',
    description: 'Klick auf einen Termin öffnet das Ziel: Gürtelprüfungen → Prüfungsverwaltung (/dashboard/stile/pruefungen), Turniere/Events → events.tda-intl.org, HoF → hof.tda-intl.org. Gilt für die Termin-Listen und den Kalender in der Plattform-Zentrale sowie die Termine im ☀️ Heute-Tab.',
    highlights: [
      '🥋 GÜRTELPRÜFUNG anklicken → Prüfungsverwaltung öffnet sich direkt',
      '🔗 INTERNE Ziele im selben Tab, externe Plattformen (Events/HoF) in neuem Tab',
      '🖱 Hover zeigt Cursor + „→" am Typ-Badge, wenn ein Termin verlinkt ist',
    ],
    details: 'kalenderAggregation.js: pruefung.url = /dashboard/stile/pruefungen. PlattformZentrale.jsx: EvRow + Kalender-Einträge mit openEventUrl (stopPropagation im Tageszellen-Klick). HeuteTab.jsx: TerminZeile klickbar.',
    files: [
      'backend/services/kalenderAggregation.js',
      'frontend/src/components/PlattformZentrale.jsx',
      'frontend/src/components/HeuteTab.jsx',
    ],
  },
  {
    version: '3.0.28',
    date: '2026-06-07',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Dashboard: Unter-Tab-Leiste stand beim Kommunikation-Tab unter dem Inhalt',
    description: 'Beim Wechsel auf Dashboard → Kommunikation rutschte die Unter-Tab-Leiste (Plattform-Zentrale / Kommunikation / Zugangsdaten) ans Seitenende — nicht erkennbar, dass man zurückschalten kann. Der Kommunikation-Block stand im Code vor dem Dashboard-Block; jetzt ist er korrekt verschachtelt, die Leiste bleibt oben.',
    highlights: [
      '🧭 UNTER-TABS IMMER OBEN: Kommunikation-Inhalt jetzt innerhalb des plattform-Blocks gerendert',
    ],
    details: 'SuperAdminDashboard.jsx: Kommunikation-JSX (140 Zeilen) in den plattform-Block nach renderSubTabs verschoben, Bedingung vereinfacht (subActiveTab statt activeTab+subActiveTab).',
    files: [
      'frontend/src/components/SuperAdminDashboard.jsx',
    ],
  },
  {
    version: '3.0.27',
    date: '2026-06-07',
    type: 'improvement',
    zielgruppe: 'intern',
    title: 'Menüleiste entschlackt: Kommunikation ist jetzt Unter-Tab im Dashboard',
    description: 'Die Haupt-Tab-Leiste war zu lang („System" rechts abgeschnitten). Der Kommunikation-Tab (Pushnachrichten/Meldungen, Chat-Zentrale, Support, Besucher-Chat, Kampagnen) ist jetzt ein Unter-Tab im 🌐 Dashboard. Der Ungelesen-Badge wandert mit auf den Dashboard-Tab.',
    highlights: [
      '📣 KOMMUNIKATION → Dashboard-Unter-Tab (zwischen Plattform-Zentrale und Zugangsdaten)',
      '🔴 BADGE: ungelesene Meldungen werden jetzt am Dashboard-Tab angezeigt',
      '🧭 NAVIGATION zentralisiert (navigateTab): Klicks aus Heute-Tab, Briefing-Popup, Cockpit-KPI und Command-Palette auf „Kommunikation" landen automatisch im richtigen Unter-Tab',
    ],
    details: 'SuperAdminDashboard.jsx: kommunikation aus tabs[] entfernt, Render-Bedingung des Blocks auf plattform+subTab umgestellt (Inhalt unverändert), useEffect-Deps um subActiveTab.plattform ergänzt, navigateTab()-Helper für alle onNavigate-Aufrufer.',
    files: [
      'frontend/src/components/SuperAdminDashboard.jsx',
    ],
  },
  {
    version: '3.0.26',
    date: '2026-06-07',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Heute-Tab: Quick-Add für To-Dos · Pilot: „In Prüfung"-Mail · Tab „Dashboard"',
    description: 'Drei Verbesserungen: ➕ Neues To-Do direkt aus dem Heute-Tab anlegen (Titel, Fälligkeit, Priorität — Enter zum Speichern). Pilot-Bewerber erhalten automatisch eine E-Mail, wenn ihre Bewerbung auf „In Prüfung" gesetzt wird (nur bei echtem Statuswechsel). Der Tab „Org-Kalender" heißt jetzt „Dashboard" und sitzt zwischen Heute und Cockpit.',
    highlights: [
      '➕ QUICK-ADD im Heute-Tab: Inline-Formular, POST /api/todos, danach Auto-Refresh der Tagesansicht',
      '🔍 IN-PRÜFUNG-MAIL: Bewerber weiß sofort, dass die Bewerbung angekommen ist — Guard gegen Doppel-Mails (alter Status wird geprüft)',
      '🌐 TAB UMBENANNT: „Org-Kalender" → „Dashboard" (PlattformZentrale: Kalender, News, Turniere, HoF, Umfragen, Demo-Termine, Pilot) — Position 2 nach Heute',
    ],
    details: 'HeuteTab.jsx (Quick-Add-Form + CSS), pilot-bewerbungen.js (Statuswechsel-Erkennung via SELECT vor UPDATE), SuperAdminDashboard.jsx (tabs-Array umsortiert, id plattform unverändert — Sub-Tabs und Navigation funktionieren weiter).',
    files: [
      'frontend/src/components/HeuteTab.jsx',
      'frontend/src/components/SuperAdminDashboard.jsx',
      'backend/routes/pilot-bewerbungen.js',
    ],
  },
  {
    version: '3.0.25',
    date: '2026-06-07',
    type: 'feature',
    zielgruppe: 'intern',
    title: '☀️ Heute-Tab: permanente Tagesansicht als Standard im Super-Admin-Dashboard',
    description: 'Neuer Tab „Heute" ganz links (Standard beim Öffnen): überfällige + fällige To-Dos direkt abhakbar, Termine aller Plattformen (7 Tage), Neues (Meldungen, Pilot-Bewerbungen, Feedback) mit Sprung zum passenden Tab. Das tägliche Briefing-Popup erscheint nur noch, wenn etwas ÜBERFÄLLIG ist.',
    highlights: [
      '☀️ HEUTE-TAB als Default — das Briefing als dauerhafte Seite statt flüchtigem Popup',
      '☑ TO-DOS DIREKT ABHAKBAR (optimistisch, mit Undo) — neuer Endpoint POST /api/briefing/todo/:id/status (PUT /todos/:id hätte alle Felder überschrieben)',
      '📅 TERMINE + 🔔 NEUES in zwei Spalten; „Neues"-Einträge springen per Klick zu Kommunikation/PlattformZentrale',
      '🔕 POPUP ENTSCHÄRFT: morgens nur noch bei überfälligen To-Dos — sonst landet man direkt im Heute-Tab',
    ],
    details: 'Frontend: HeuteTab.jsx + HeuteTab.css, SuperAdminDashboard.jsx (Tab vorne, Default heute, Popup-Gate via /briefing). Backend: routes/briefing.js POST /todo/:id/status (Status-only-Update). Changelog-Modal-Fix (Portal) aus demselben Tag inklusive.',
    files: [
      'frontend/src/components/HeuteTab.jsx',
      'frontend/src/components/SuperAdminDashboard.jsx',
      'backend/routes/briefing.js',
    ],
  },
  {
    version: '3.0.24',
    date: '2026-06-07',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Tägliches Briefing erweitert: Terminplaner, To-Dos & automatische Event-Checklisten',
    description: 'Das „Dein Tag"-Popup (1× täglich beim ersten Super-Admin-Login) zeigt jetzt zusätzlich: überfällige + diese Woche fällige To-Dos, alle Termine der nächsten 7 Tage (Turniere, Events, HoF, Prüfungen, Demos) und neue Pilot-Bewerbungen. Für kommende Events/HoF-Veranstaltungen werden automatisch Aufgaben-Checklisten angelegt. Dazu täglich 7:00 eine Briefing-Mail.',
    highlights: [
      '📋 TO-DOS IM BRIEFING: 🔥 überfällig (rot) + fällig in 7 Tagen (gelb) — Klick öffnet todo.tda-intl.org',
      '📅 TERMINPLANER: heute + nächste 7 Tage aus ALLEN Plattformen (Kalender-Aggregation wiederverwendet)',
      '✅ AUTO-CHECKLISTEN: pro kommendem Event/HoF-Termin 6 Aufgaben mit Fristen (Einladungen -42d … Nachbereitung +1d) — einmalig pro Event, gelöschte Aufgaben bleiben gelöscht (Log-Tabelle)',
      '📧 MORGEN-MAIL 7:00: dieselbe Übersicht als E-Mail an info@tda-intl.com (Cron)',
      '♻️ REFACTOR: Kalender-Aggregation aus plattform-zentrale.js nach services/kalenderAggregation.js extrahiert',
    ],
    details: 'Backend: services/briefingService.js (buildBriefing, syncEventChecklisten, sendBriefingMail), routes/briefing.js (GET /api/briefing, POST /sync-checklisten), Migration 192 (briefing_event_checklisten), Cron 07:00. Frontend: DailyBriefing.jsx lädt /api/briefing selbst dazu (Rest des Popups unverändert).',
    files: [
      'backend/services/briefingService.js',
      'backend/services/kalenderAggregation.js',
      'backend/routes/briefing.js',
      'backend/migrations/192_briefing_event_checklisten.sql',
      'backend/cron-jobs.js',
      'frontend/src/components/DailyBriefing.jsx',
    ],
  },
  {
    version: '3.0.23',
    date: '2026-06-07',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Pilot-Partner Feedback-System: zeitgesteuerte Fragebögen per E-Mail',
    description: 'Gewonnene Pilot-Partner bekommen automatisch Kurz-Fragebögen per E-Mail: Tag 14 „Wie war die Einrichtung?", Tag 28 „Erste Erfahrungen", danach alle 28 Tage „Wie läuft\'s?" — je 4–5 Sterne-Fragen + Kommentar, ohne Login beantwortbar. Antworten landen in den Meldungen und im Pilot-Programm-Tab.',
    highlights: [
      '📝 3 FRAGEBÖGEN (je ~2 Min): Einrichtung / Erste Erfahrungen / laufender 4-Wochen-Check — Fragenkatalog zentral in pilotFeedbackService.js',
      '⏰ CRON täglich 10:00: plant + versendet fällige Umfragen, einmalige Erinnerung nach 7 Tagen, Ende nach 12 Monaten',
      '🔗 ÖFFENTLICHE SEITE dojo.tda-intl.org/pilot-feedback/:token — Sterne-Rating, Auswahl-Chips, Kommentare, kein Login',
      '🔔 ANTWORTEN → Meldung (typ pilot_feedback) + Mail an info@; einsehbar im Pilot-Tab (PlattformZentrale) mit Sterne-Übersicht',
      '🏆 STATUS „GEWONNEN" setzt automatisch programm_start (editierbar) und plant die Umfragen; manueller Sofort-Versand möglich',
    ],
    details: 'Migration 191 (pilot_feedback_umfragen + pilot_bewerbungen.programm_start). Backend: services/pilotFeedbackService.js (Katalog, planeUmfragen, processPilotFeedback), routes/pilot-feedback.js (public GET/POST per Token-Regex, Admin-CRUD), Cron in cron-jobs.js. Frontend: pages/PilotFeedback.jsx (public Route), PilotBewerbungen.jsx Feedback-Sektion.',
    files: [
      'backend/migrations/191_pilot_feedback.sql',
      'backend/services/pilotFeedbackService.js',
      'backend/routes/pilot-feedback.js',
      'backend/cron-jobs.js',
      'frontend/src/pages/PilotFeedback.jsx',
      'frontend/src/components/PilotBewerbungen.jsx',
    ],
  },
  {
    version: '3.0.22',
    date: '2026-06-07',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Entwicklungs-Anfragen: Homepage/Software-Anfragen landen in den Meldungen',
    description: 'Neues öffentliches Formular auf tda-intl.org/homepage-erstellung.html (Homepage-Erstellung & Individualsoftware für Kampfsportschulen). Anfragen erscheinen als Meldung im SuperAdminDashboard (Kommunikation → Meldungen, Priorität wichtig) und gehen zusätzlich per E-Mail an info@tda-intl.com.',
    highlights: [
      '🛠️ NEUER ENDPOINT POST /api/entwicklungs-anfragen — öffentlich, mit Honeypot + Rate-Limit (3/Std/IP)',
      '🔔 MELDUNG im SuperAdminDashboard: typ entwicklungs_anfrage, Priorität „wichtig" — Name, Kontakt, Projekt-Typ und Beschreibung direkt in der Nachricht',
      '🌐 LANDING: dritte Produktkarte „Homepage & Individualentwicklung" auf tda-intl.org + eigene Seite mit Formular',
    ],
    details: 'Backend: routes/entwicklungs-anfragen.js — INSERT INTO super_admin_notifications (CREATE TABLE IF NOT EXISTS Guard identisch zu admin.js). Kein neues Frontend in der Dojosoftware nötig — Meldungen-Tab zeigt die Anfragen automatisch.',
    files: [
      'backend/routes/entwicklungs-anfragen.js',
      'backend/server.js',
      'version.js',
    ],
  },
  {
    version: '3.0.21',
    date: '2026-06-07',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Pilot-Partner-Programm: Bewerbungsverwaltung in der PlattformZentrale',
    description: 'Neues Akquise-Tool: Kampfsportschulen können sich auf tda-intl.com/pilot-partner als „Pilot-Partner des Monats" bewerben (12 Monate kostenlose Nutzung). Die Bewerbungen landen in einem neuen Tab 🏆 Pilot-Programm in der PlattformZentrale mit Status-Workflow und internen Notizen.',
    highlights: [
      '🏆 NEUER TAB „Pilot-Programm" in der PlattformZentrale: Bewerbungen sichten, Status setzen (Neu / In Prüfung / Gewonnen / Abgelehnt), interne Notizen',
      '📋 BEWERBUNGSFORMULAR auf tda-intl.com/pilot-partner — Schulname, Stilrichtungen, Mitgliederzahl, aktuelle Software, größte Herausforderung, Begründung (= Marktforschung inklusive)',
      '📧 E-MAILS: Benachrichtigung an info@tda-intl.com bei jeder Bewerbung + automatische Eingangsbestätigung an den Bewerber',
      '🛡️ SPAM-SCHUTZ: Honeypot-Feld, Rate-Limit (3/Stunde pro IP), Duplikat-Sperre (gleiche E-Mail, 30 Tage)',
    ],
    details: 'Backend: routes/pilot-bewerbungen.js (öffentl. POST + Admin-CRUD onlySuperAdmin), Migration 190_pilot_bewerbungen.sql (utf8mb4_unicode_ci). Frontend: PilotBewerbungen.jsx + PilotBewerbungen.css, Tab in PlattformZentrale.jsx. Website (tda-websites/tda-intl): Seite /pilot-partner + Popup auf Home.',
    files: [
      'backend/routes/pilot-bewerbungen.js',
      'backend/migrations/190_pilot_bewerbungen.sql',
      'frontend/src/components/PilotBewerbungen.jsx',
      'frontend/src/components/PlattformZentrale.jsx',
      'version.js',
    ],
  },
  {
    version: '3.0.20',
    date: '2026-06-05',
    type: 'feature',
    zielgruppe: 'intern',
    title: 'Gi-Bestellungen: echter PDF-Download (⬇️) neben der Vorschau (👁)',
    description: 'Neben dem Auge (Vorschau im neuen Tab, fürs Drucken) gibt es jetzt einen Download-Button, der die Bestellung als echtes PDF herunterlädt — serverseitig mit Puppeteer gerendert, inklusive aller eingebetteten Logos und dem Logo-&-Branding-Anhangsblatt.',
    highlights: [
      '⬇️ PDF-DOWNLOAD: Ein Klick lädt bestellung_<Nr>.pdf herunter — echtes PDF, kein HTML',
      '👁 VORSCHAU bleibt wie gehabt (neuer Tab, von dort drucken)',
      '♻️ Beide Buttons nutzen dieselbe HTML-Erzeugung (formdata + Logo-Einbettung) — keine Abweichungen zwischen Vorschau und Download',
    ],
    details: 'Backend giBestellungen.js: POST /html-pdf (vor den /:id-Routen) — Puppeteer setContent + page.pdf (A4, printBackground, preferCSSPageSize), Content-Disposition attachment. Frontend BestellungenTab: assembleBestellungHtml(b) als gemeinsame Basis für previewGiPdf + downloadGiPdf (responseType blob, Lade-Indikator ⏳, Blob-Fehlerauswertung).',
    files: [
      'backend/routes/giBestellungen.js',
      'frontend/src/components/BestellungenTab.jsx',
      'version.js',
    ],
  },
  {
    version: '3.0.19',
    date: '2026-06-05',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Gi-Bestellvorlage: gespeicherte Logos wurden nicht angezeigt (Super-Admin dojo_id-Bug)',
    description: 'Die in der Vorlage hochgeladenen Logos waren korrekt auf dem Server gespeichert, wurden aber beim Öffnen nicht geladen: Die Gi-Vorlage nutzte nur activeDojo.id als Dojo-Kontext — beim Super-Admin ist activeDojo aber der String „super-admin" (ohne .id), wodurch der Dateien-Load nie feuerte und Uploads still mit 400 scheiterten. Jetzt gilt dieselbe Fallback-Kette wie in der T-Shirt-Vorlage.',
    highlights: [
      '🖼️ LOGOS WIEDER DA: Fallback overrideDojoId → vorlage.dojo_id → activeDojo.id — Vorlagen-Dateien laden jetzt auch im Super-Admin-Kontext',
      '📄 PDF-VORSCHAU MIT LOGOS: Die 👁-Vorschau im Bestellungen-Tab übergab ein leeres Datei-Array → „kein Logo" an allen Positionen. Jetzt werden die Server-Logos der Vorlage wie im Druck-Pfad als Base64 eingebettet',
      '🔔 FEHLER SICHTBAR: Datei-Upload und Dateien-Load melden Fehler statt still zu scheitern (catch {} entfernt)',
    ],
    details: 'GiBestellvorlage.jsx Z.239: dojoId-Konstante um overrideDojoId + vorlage?.dojo_id erweitert (Muster aus TShirtBestellvorlage Z.202). uploadDatei: Fehler-Alert. Dateien-Effect: console.error. Die Logos lagen die ganze Zeit in vorlage_dateien (Server-Upload mit tag=Position funktionierte im Dojo-Kontext).',
    files: [
      'frontend/src/components/GiBestellvorlage.jsx',
      'version.js',
    ],
  },
  {
    version: '3.0.18',
    date: '2026-06-05',
    type: 'fix',
    zielgruppe: 'intern',
    title: 'Gi-Bestellung: PDF-Vorschau (Auge) funktioniert jetzt — Safari-Popup-Fix',
    description: 'Der 👁-Button bei Gi-/T-Shirt-Bestellungen tat nichts: window.open wurde erst NACH dem Daten-Nachladen aufgerufen — Safari blockiert Popups außerhalb des direkten Klick-Kontexts, und ein stiller catch verschluckte den Fehler. Jetzt öffnet das Fenster sofort beim Klick, das PDF wird hineingeschrieben, und Fehler werden sichtbar gemeldet. Zusätzlich 400er-Rauschen bei Acknowledge-Aufrufen ohne Dojo-Kontext beseitigt.',
    highlights: [
      '👁 PDF-VORSCHAU: Fenster öffnet synchron im Klick (Safari-sicher), HTML wird danach hineingeschrieben — gleiches Muster wie beim Druck in der Bestellvorlage',
      '🔔 FEHLER SICHTBAR: Statt catch {} gibt es jetzt eine klare Meldung, wenn die Vorschau scheitert',
      '🧹 400-RAUSCHEN WEG: Marketing-Acknowledge + Verträge-Acknowledge prüfen den Dojo-Kontext bzw. melden Fehler statt still zu scheitern',
    ],
    details: 'BestellungenTab.previewGiPdf: window.open("",_blank) vor dem await, win.document.write(html) statt Blob-URL-open; Fallback-Download bei geblocktem Popup; Fehler-Alert. MarketingArtikelTab + CockpitUebersicht (ArtikelBestellungenPopup, NeueVertraegePopup): activeDojo?.id-Guards + Fehler-Alerts.',
    files: [
      'frontend/src/components/BestellungenTab.jsx',
      'frontend/src/components/MarketingArtikelTab.jsx',
      'frontend/src/components/CockpitUebersicht.jsx',
      'version.js',
    ],
  },
  {
    version: '3.0.17',
    date: '2026-06-05',
    type: 'improvement',
    zielgruppe: 'intern', // Member-App Performance — nur intern
    title: 'Mitglieder-App: „Mehrfach klicken"-Ursachen behoben (Re-Render-Fixes)',
    description: 'Die Wurzeln des „man muss mehrfach klicken"-Problems in der Mitglieder-App (app.tda-vib.de) wurden gefunden und behoben: Das Prüfungseinladungs-Popup wurde bei jedem Dashboard-Render neu erzeugt (Eingaben gingen verloren), eine Race-Condition beim Stil-Laden erzeugte unkontrollierte Renders, und Umfrage-Buttons konnten doppelt feuern.',
    highlights: [
      '🥋 PRÜFUNGS-POPUP: Aus dem 3.200-Zeilen-Render in eigene memoized Komponente ausgelagert — Termin-Klicks re-rendern nicht mehr das ganze Dashboard, Popup bleibt bei Daten-Updates stabil offen (vorher: ersetzt/remountet → Eingaben weg)',
      '🏁 RACE-CONDITION: Stil-Daten laden jetzt parallel via Promise.all statt forEach(async) — keine zufällig getakteten Einzel-Renders mehr',
      '🛡️ DOPPEL-KLICK-SCHUTZ: Umfrage-Absenden ignoriert weitere Klicks während der Request läuft',
      '🧹 RENDER-PFAD: Debug-console.logs aus dem Render entfernt, Popup-Umfragen-Filter memoized, stabile Keys statt Array-Index bei Gürtel-Listen',
    ],
    details: 'PruefungsEinladungPopup.jsx (React.memo, eigener State für Nein-Flow + Terminauswahl — vorher IIFE mit Parent-State). MemberDashboard.jsx: useEffect approvedExams mit prev||-Guard (Popup wird nicht mehr ersetzt), loadMemberStyles Promise.all, submitUmfrageAntwort Guard, popupUmfragen useMemo, 2 Render-console.logs raus, currentBelts-Keys stilName-name. 3.210 → 3.096 Zeilen.',
    files: [
      'frontend/src/components/PruefungsEinladungPopup.jsx',
      'frontend/src/components/MemberDashboard.jsx',
      'version.js',
    ],
  },
  {
    version: '3.0.16',
    date: '2026-06-05',
    type: 'feature',
    zielgruppe: 'intern', // Super-Admin-Komfort — nur intern
    title: 'Cmd+K-Suche, Briefing-Vollausbau & schnellere Erstladung',
    description: 'Drei Komfort-Upgrades fürs Super-Admin-Dashboard: Eine globale Command-Palette (Cmd+K) durchsucht Dojos, Mitglieder, Kontakte und Verbandsmitglieder. Das Daily Briefing zeigt jetzt ALLE offenen Eingänge (auch Wiedervorlagen, Bestellungen, Rücklastschriften, Tickets). Und die Dashboard-Erstladung ist deutlich schneller, weil die Statistik-Queries jetzt parallel laufen.',
    highlights: [
      '⌨️ CMD+K: Globale Suche über Dojos, Mitglieder, Akquise-Kontakte und Verbandsmitglieder + Schnellaktionen für alle Tabs — mit Pfeiltasten/Enter bedienbar',
      '📨 BRIEFING KOMPLETT: Neu im täglichen Popup — überfällige Akquise-Wiedervorlagen, offene Shop-Bestellungen, fehlgeschlagene Lastschriften (letzte 7 Tage) und offene Support-Tickets; jeweils klickbar zum richtigen Tab',
      '⚡ SCHNELLER: global-stats (7 Queries), tda-stats (5) und overview-summary (6) laufen jetzt parallel statt nacheinander — Erstladung spürbar flotter',
    ],
    details: 'Backend admin.js: GET /admin/global-search (4 Entitäten je LIMIT 5, min. 2 Zeichen); overview-summary um neue_eingaenge.wiedervorlagen/bestellungen/ruecklastschriften/tickets erweitert (akquise_kontakte naechste_aktion<=CURDATE, shop_bestellungen status=offen, stripe_lastschrift_transaktion status=failed 7d, support_tickets status=offen); sequenzielle awaits in global-stats/tda-stats/overview-summary durch Promise.all ersetzt. Frontend: CommandPalette.jsx (Cmd+K/Ctrl+K, Debounce 250ms, opaker Modal-Hintergrund), DailyBriefing.jsx um 4 Eingangs-Typen erweitert.',
    files: [
      'backend/routes/admin.js',
      'frontend/src/components/CommandPalette.jsx',
      'frontend/src/components/DailyBriefing.jsx',
      'frontend/src/components/SuperAdminDashboard.jsx',
      'version.js',
    ],
  },
  {
    version: '3.0.15',
    date: '2026-06-05',
    type: 'feature',
    zielgruppe: 'intern', // Statistik-Hub — nur intern
    title: 'Statistik-Hub: Entwicklung-Tab mit „Wachstum & Prognose"-Charts',
    description: 'Der Entwicklung-Tab ist jetzt ein Hub mit zwei Untertabs: „Ziele & Planung" (5-Jahres-Planung wie bisher) und neu „Wachstum & Prognose" — Verlaufs-Charts der letzten 12 Monate plus 12-Monats-Prognose für Dojos, Verbandsmitglieder und Mitglieder, direkt aus der zentralen Prognose-Engine. Damit ist Paket C des Dashboard-Aufräumens abgeschlossen.',
    highlights: [
      '📈 NEU: Wachstum & Prognose — Bestands-Verlauf (12 Monate) + gestrichelte Prognose-Linie (12 Monate) pro Kennzahl, mit aktuell / +3 / +6 / +12 Monate',
      '🎯 Ziele & Planung unverändert als erster Untertab',
      '🧹 Tote Imports entfernt (FinanzenTab im SuperAdminDashboard)',
      '📋 BEWUSST NICHT GEMACHT: BuchhaltungTab/VerbandsMitglieder-Split — beide sind auf Tab-Ebene bereits componentized; die verbleibenden Inline-Modals haben 25+ Parent-Referenzen, Extraktion wäre Kosmetik mit Regressionsrisiko',
    ],
    details: 'WachstumPrognose.jsx: konsumiert /api/admin/prognose, rekonstruiert Bestands-Verlauf aus monatlichen Zugängen (aktuell minus künftige Deltas rückwärts), AreaChart mit Prognose-Fortschreibung (wachstum_monat). SuperAdminDashboard: entwicklung-Tab mit renderSubTabs (ziele|wachstum), subActiveTab.entwicklung default ziele.',
    files: [
      'frontend/src/components/WachstumPrognose.jsx',
      'frontend/src/components/SuperAdminDashboard.jsx',
      'version.js',
    ],
  },
  {
    version: '3.0.14',
    date: '2026-06-05',
    type: 'improvement',
    zielgruppe: 'intern', // Refactoring — nur intern
    title: 'SuperAdminDashboard entschlackt: -30% Code, Sektionen ausgelagert',
    description: 'Das SuperAdminDashboard war mit 3.420 Zeilen ein Monolith. Die Produkt-Sektionen (EventSoftware, Academy, Hall of Fame), das Daily Briefing und die Shop-Bestellungen sind jetzt eigene Komponenten; toter Code wurde entfernt. Reines Refactoring ohne Verhaltensänderung — vor dem Deploy wurden DB-Backups (dojo + tda) erstellt.',
    highlights: [
      '✂️ AUSGELAGERT: EventSoftwareSection, AcademySection, HofLiveSection, DailyBriefing, ShopBestellungen — je eine eigene Datei',
      '📉 3.420 → 2.426 Zeilen in SuperAdminDashboard.jsx (-29%)',
      '🗑️ TOTER CODE: StatisticsTab.jsx + StatisticsTab.css gelöscht (wurde nirgends mehr gerendert)',
      '💾 SICHERHEIT: DB-Backups vor dem Refactoring (/root/backups/dojo_pre_refactor_*, tda_pre_refactor_*)',
    ],
    details: 'Pure Code-Moves: EventSoftwareSection.jsx (275 Z., inkl. preloadedTurniere-Prop), AcademySection.jsx (170 Z.), HofLiveSection.jsx (121 Z.), DailyBriefing.jsx (Props: globalStats/overviewSummary/unreadCount/sslWarnings/onClose/onNavigate), ShopBestellungen.jsx (eigenständig mit eigenem State+Loadern, Prop: token). SuperAdminDashboard.jsx behält Orchestrierung, Tabs und Cockpit.',
    files: [
      'frontend/src/components/SuperAdminDashboard.jsx',
      'frontend/src/components/EventSoftwareSection.jsx',
      'frontend/src/components/AcademySection.jsx',
      'frontend/src/components/HofLiveSection.jsx',
      'frontend/src/components/DailyBriefing.jsx',
      'frontend/src/components/ShopBestellungen.jsx',
      'version.js',
    ],
  },
  {
    version: '3.0.13',
    date: '2026-06-05',
    type: 'improvement',
    zielgruppe: 'intern', // Dashboard-Aufräumen — nur intern
    title: 'Super-Admin-Dashboard aufgeräumt: EINE Prognose-Engine, Dubletten entfernt',
    description: 'Die Wachstums-/Finanzprognosen waren 4× unterschiedlich implementiert (lineare Regression, simples Ø, gewichtete Ziele) und lieferten je nach Stelle andere Zahlen. Jetzt gibt es eine zentrale Prognose-Engine (Ø-Wachstum mit Ausreißer-Filter), aus der alle Dashboards ziehen. Zusätzlich doppelte UI-Blöcke und API-Calls entfernt.',
    highlights: [
      '📈 EINE PROGNOSE-ENGINE: /api/admin/prognose (Ø-Wachstum letzte 12 Monate, Spike-Filter via Median) — Finanz-Chart, Lizenz-Statistik und Entwicklung zeigen jetzt konsistente Zahlen',
      '🎯 ENTWICKLUNG: 5-Jahres-Planung zeigt jetzt die echte Ist-Prognose direkt neben den Soll-Zielen („Ziel erreichbar ✓")',
      '🧹 DUBLETTEN WEG: SSL-Warnungen + Jahresziele je als EINE Komponente (vorher 2× inline kopiert); Akquise-Tab in der Lizenzverwaltung durch Verweis auf den Haupt-Tab Kontakte ersetzt',
      '⚡ WENIGER API-CALLS: Turnier-Liste wird nur noch 1× geladen; toter StatisticsTab-Import entfernt',
    ],
    details: 'Backend routes/admin.js: GET /admin/prognose (dojos/verbandsmitglieder/mitglieder, buildForecast mit Median-Spike-Filter). Frontend: utils/prognose.js (identische Methode für Zeitreihen), SuperAdminFinanzen nutzt appendPrognose statt eigener linearer Regression (Trend-Linie entfernt), LizenzStatisticsTab + ZieleEntwicklung konsumieren /admin/prognose. Neue Komponenten SslWarnungen.jsx + JahreszieleProgress.jsx (variant briefing/cockpit) ersetzen 4 Inline-Blöcke in SuperAdminDashboard.jsx. EventSoftwareSection erhält preloadedTurniere. DojoLizenzverwaltung: Akquise-Tab → sa-navigate CustomEvent zu Kontakte.',
    files: [
      'backend/routes/admin.js',
      'frontend/src/utils/prognose.js',
      'frontend/src/components/SslWarnungen.jsx',
      'frontend/src/components/JahreszieleProgress.jsx',
      'frontend/src/components/SuperAdminDashboard.jsx',
      'frontend/src/components/SuperAdminFinanzen.jsx',
      'frontend/src/components/LizenzStatisticsTab.jsx',
      'frontend/src/components/ZieleEntwicklung.jsx',
      'frontend/src/components/DojoLizenzverwaltung.jsx',
      'version.js',
    ],
  },
  {
    version: '3.0.12',
    date: '2026-06-05',
    type: 'feature',
    zielgruppe: 'intern', // Super-Admin-Kontaktdatenbank — nur intern
    title: 'Zentrale Kontaktdatenbank: eigener Haupt-Tab, Einsatzbereiche & System-Verknüpfungen',
    description: 'Die Akquise-Kontakte sind jetzt eine zentrale Kontaktdatenbank für alle Bereiche — nicht mehr nur Dojosoftware-Vertrieb. Jeder Kontakt kann für Dojosoftware, Events/Turniere, Verband und Veranstaltungen eingesetzt werden und ist über einen eigenen Haupt-Tab „🗂️ Kontakte" direkt erreichbar. Bestehende Verbandsmitgliedschaften und Software-Dojos werden automatisch verknüpft angezeigt.',
    highlights: [
      '🗂️ HAUPT-TAB: „Kontakte" direkt im Super-Admin-Dashboard (neben Verband) — keine 3 Klicks mehr über Software → Lizenzen → Akquise',
      '🎯 EINSATZBEREICHE: Jeder Kontakt für beliebige Bereiche nutzbar (💻 Dojosoftware, 🗓️ Events/Turniere, 🏆 Verband, 🎓 Veranstaltungen) — als Filter, im Formular als Chips, per Bulk-Aktion setzbar',
      '🔗 VERKNÜPFUNGEN: Kontakte mit passender E-Mail zeigen automatisch Badges „Verbandsmitglied" (inkl. Status) und „Dojo nutzt Software" — man sieht sofort, wer schon Kunde/Mitglied ist',
      '📥 BESTAND: Alle 215 vorhandenen Kontakte (Recherche + Turniersoftware) für alle 4 Bereiche freigeschaltet',
    ],
    details: 'Migration 189: akquise_kontakte.einsatzbereiche VARCHAR(255) DEFAULT dojosoftware, Bestand auf alle Bereiche gesetzt. Backend routes/admin/akquise.js: GET /kontakte mit einsatzbereich-Filter (FIND_IN_SET) + Verknüpfungs-Subselects (verbandsmitgliedschaften per person_email/dojo_email, dojo per email), POST/PUT/bulk-update um einsatzbereiche erweitert. Frontend AkquiseDashboard.jsx: EINSATZBEREICHE-Konstante, Filter-Select, Chip-Checkboxen im Formular, Badges in Liste, Bulk-Select. SuperAdminDashboard.jsx: neuer Top-Level-Tab kontakte (lazy AkquiseDashboard).',
    files: [
      'backend/migrations/189_akquise_einsatzbereiche.sql',
      'backend/routes/admin/akquise.js',
      'frontend/src/components/AkquiseDashboard.jsx',
      'frontend/src/components/SuperAdminDashboard.jsx',
      'version.js',
    ],
  },
  {
    version: '3.0.11',
    date: '2026-06-05',
    type: 'feature',
    zielgruppe: 'intern', // Super-Admin-Briefing + Akquise — nur intern
    title: 'Daily Briefing: Neue Eingänge — keine Registrierung mehr übersehen + 185 Akquise-Kontakte importiert',
    description: 'Das tägliche Briefing-Popup im Super-Admin-Dashboard zeigt jetzt prominent alle ausstehenden Verbands-Registrierungen und unbearbeiteten Kontaktanfragen — damit Eingänge wie neue Verbandsmitgliedschafts-Anträge nicht mehr untergehen. Zusätzlich wurden 185 recherchierte Kampfsportschulen-Kontakte (200 km um Vilsbiburg) ins Akquise-CRM importiert.',
    highlights: [
      '📨 NEUE EINGÄNGE: Eigene Sektion im Daily Briefing — ausstehende Verbands-Registrierungen (status „ausstehend") und unbearbeitete Kontaktanfragen, mit „seit X Tagen offen"-Anzeige',
      '🔴 ESKALATION: Einträge, die 3+ Tage offen sind, werden rot markiert; Klick auf eine Verbands-Registrierung springt direkt in den Verband-Tab',
      '🥋 AKQUISE-IMPORT: 185 Kampfsportschulen-Kontakte (dedupliziert) im Akquise-CRM — Tags „verifiziert" (78, echte Recherche), „unverifiziert" (14) und „domain-tot" (93, Domain existiert nicht, bei Bounce löschen)',
    ],
    details: 'Backend routes/admin.js /overview-summary: neue Response-Sektion neue_eingaenge (verbandsmitgliedschaften status=ausstehend + kontakt_anfragen bearbeitet=0, je max. 10, mit tage_offen via DATEDIFF). Frontend SuperAdminDashboard.jsx: Briefing-Sektion „📨 Neue Eingänge" nach dem KPI-Grid, nutzt sad-trial-item-Klassen. Import: 11 Excel-Rechercheblöcke geparst, DNS-Doppel-Check (94 von 109 Domains aus Block 2–11 nicht registriert = KI-Halluzination), per SQL in akquise_kontakte (quelle=internet, Tag kampfsport-recherche-2026).',
    files: [
      'backend/routes/admin.js',
      'frontend/src/components/SuperAdminDashboard.jsx',
      'version.js',
    ],
  },
  {
    version: '3.0.10',
    date: '2026-06-04',
    type: 'improvement',
    zielgruppe: 'intern', // Meta — nur Super-Admin
    title: 'Changelog-Zielgruppen: technische Einträge nur für Super-Admin',
    description: 'Changelog-Einträge können jetzt pro Eintrag eine Zielgruppe haben: „intern" (nur Super-Admin) oder „betreiber" (zusätzlich die Admins der Subdomain-Dojos). Technische Releases bleiben intern; allgemeine Feature-Neuerungen erreichen damit auch die Dojo-Admins. Mitglieder sehen weiterhin keine Changelogs.',
    highlights: [
      '🎯 ZIELGRUPPEN: Feld „zielgruppe" pro Eintrag — intern (Super-Admin) vs. betreiber (auch Dojo-Admins der Subdomains)',
      '🔒 Technische Releases (Erstattungen, Stripe-Webhooks, Buchhaltung) sind als intern markiert und für Dojo-Admins ausgeblendet',
      '👥 ChangelogPopup + volle Changelog-Ansicht filtern nach Rolle (Super-Admin sieht alles; Dojo-Admin nur betreiber-Einträge)',
    ],
    details: 'ChangelogPopup.jsx + SystemChangelog.jsx: Scope-Erkennung via JWT (dojo_id null/super-Rolle = Super-Admin). getNewEntries + displayedChangelog filtern Einträge mit zielgruppe===\'intern\' für Dojo-Admins aus. Neue technische Einträge bekommen zielgruppe: \'intern\'.',
    files: [
      'frontend/src/components/ChangelogPopup.jsx',
      'frontend/src/components/SystemChangelog.jsx',
      'version.js',
    ],
  },
  {
    version: '3.0.9',
    date: '2026-06-04',
    type: 'feature',
    zielgruppe: 'intern', // technisch — nur Super-Admin, nicht für Dojo-Admins der Subdomains
    title: 'Rückerstattungen durchgängig: zentrale Erfassung, Stripe-Sync & vollständige Buchhaltung (EÜR/USt)',
    description: 'Rückerstattungen werden jetzt zentral erfasst (manuell, über den Button und direkt in Stripe ausgelöste) und durchgängig berücksichtigt — im Mitglieder-Check ebenso wie in der gesamten Buchhaltung: EÜR, BWA-Summen, Umsatzsteuer-Voranmeldung und Kleinunternehmer-Umsatz.',
    highlights: [
      '🏦 ZENTRALE ERFASSUNG: Neue Tabelle für alle Erstattungen — manuell (von anderem Konto), über den „↩ Rückerstatten"-Button ausgelöste und direkt im Stripe-Dashboard gemachte. Eine einzige Quelle für Übersicht und Buchhaltung',
      '🔄 STRIPE-SYNC + WEBHOOK: Erstattungen aus Stripe werden automatisch übernommen — per Webhook (Echtzeit) und per Abgleich/Backfill (auch historische). Lechners 140 € wurde dabei nachgetragen',
      '🧾 EÜR / ÜBERSCHUSS: Erstattungen mindern die Einnahmen im Erstattungsmonat (§11 EStG). Eigene „Erstattungen"-Spalte in der EÜR-Tabelle, korrekt in Monats- und Jahressummen',
      '🧮 UMSATZSTEUER (UStVA): Erstattungen korrigieren Umsatz und Umsatzsteuer (§17 UStG) — Kz81/Kz35 werden sauber gemindert. Bei Kleinunternehmern (§19) wird der Bruttoumsatz automatisch reduziert',
      '🔍 CHECK: Bereits erstattete Auffälligkeiten werden im Mitglieder-Check als „erledigt" markiert; offene vs. erstattete Summe getrennt ausgewiesen',
      '⑤ ÜBERSICHT: Spalte „Rückerstattung" zeigt manuelle und Stripe-Erstattungen mit Status (auch „veranlasst", solange die SEPA-Gutschrift noch läuft)',
      '🪟 BEDIENUNG: Manuelle Erstattung jetzt als komfortables Modal (Betrag, Datum, Quelle/Konto, Bemerkungen) statt enger Inline-Eingabe',
    ],
    details: 'Migration 186: zentrale Tabelle `erstattungen` (Quellen manuell/stripe_button/stripe_sync/stripe_extern, dedup über stripe_refund_id, status erstattet/veranlasst). Migration 187: v_euer_einnahmen um Erstattungs-Branch (negativer betrag_brutto) erweitert → wirkt auf alle View-Konsumenten inkl. Kleinunternehmer-Bruttoumsatz. services/erstattungSync.js: Backfill/periodischer Stripe-Refund-Sync (ordnet Mitglied/Posten-Art zu). routes/stripe.js Webhook: charge.refunded + refund.created/updated. routes/finanzcockpit.js: /refund persistiert Button-Refunds, POST /erstattungen/sync, manuelle-erstattung + Check + mitglied-finanz auf erstattungen umgestellt. routes/euer.js: Erstattungs-Query (Dojo + TDA), Abzug + Jahressumme. routes/steuer.js: negative 19%-Erstattungszeilen in der UStVA-Pipeline. Frontend: MitgliedFinanzUebersicht.jsx (Modal, Spalte ⑤, Check-Badges), EuerUebersicht.jsx (Erstattungs-Spalte).',
    files: [
      'backend/migrations/186_erstattungen_zentral.sql, 187_euer_view_erstattungen.sql (neu)',
      'backend/scripts/run-migration-186.js (neu)',
      'backend/services/erstattungSync.js (neu)',
      'backend/routes/{finanzcockpit,stripe,euer,steuer}.js',
      'frontend/src/components/{MitgliedFinanzUebersicht,EuerUebersicht}.jsx',
      'version.js', 'SystemChangelog.jsx',
    ],
  },
  {
    version: '3.0.8',
    date: '2026-06-04',
    type: 'feature',
    zielgruppe: 'intern', // technisch — nur Super-Admin, nicht für Dojo-Admins der Subdomains
    title: 'Beitrags-Schutz (DB-Guard) & manuelle Erstattungen außerhalb Stripe',
    description: 'Zwei Sicherungen rund um Lastschriften: Ein Datenbank-Guard verhindert dauerhaft, dass Beiträge gelöscht werden, solange sie von einer laufenden oder abgeschlossenen Stripe-Lastschrift referenziert werden (Ursache der früheren „Datensatz erneuert/unbekannt"-Verweise). Zusätzlich lassen sich jetzt Erstattungen erfassen, die NICHT über Stripe, sondern manuell von einem anderen Konto erfolgt sind.',
    highlights: [
      '🛡 DB-GUARD: Ein Beitrag, der von einer Stripe-Lastschrift (processing oder succeeded) referenziert wird, kann nicht mehr gelöscht werden — dadurch entstehen keine verwaisten Verweise mehr. Ausnahme nur für die legitime Komplett-Archivierung eines Mitglieds',
      '🏦 MANUELLE ERSTATTUNG: Neuer Button „🏦 Manuell erstattet" pro Abbuchung in der Mitglieder-Finanzübersicht — für Beträge, die außerhalb Stripe (z. B. per Überweisung von einem anderen Konto) zurückerstattet wurden. Mit Betrag, Datum, Quelle/Konto und Bemerkungen',
      '⑤ ABGLEICH: Manuelle Erstattungen erscheinen in Spalte ⑤ „Rückerstattung" neben den Stripe-Refunds (eindeutig als „manuell" gekennzeichnet) und fließen in die „Summe erstattet" ein; einzeln wieder löschbar',
      '🔎 URSACHE GEKLÄRT: Die früheren verwaisten Beitrags-Verweise stammten aus einem einmaligen Vorfall (Frühjahr 2026), nicht aus einer laufenden Regenerierung. Der Guard schließt diese Lücke endgültig',
    ],
    details: 'Migration 184: BEFORE-DELETE-Trigger trg_beitraege_block_referenced_delete auf beitraege — prüft via JSON_CONTAINS gegen stripe_lastschrift_transaktion (status processing/succeeded), SIGNAL 45000 bei Verstoß; Bypass über Session-Var @allow_beitrag_delete=1 (in routes/mitglieder.js Archivierungs-Flows pollution-sicher gesetzt/zurückgesetzt). routes/beitraege.js DELETE liefert bei Guard-Treffer 409 mit Klartext. Migration 185: Tabelle manuelle_erstattungen (transaktion_id, mitglied_id, dojo_id, betrag, erstattet_am, quelle, bemerkung). finanzcockpit.js: mitglied-finanz lädt manuelle_erstattungen je Transaktion + Endpunkte POST/DELETE /manuelle-erstattung (dojo-isoliert). Frontend MitgliedFinanzUebersicht.jsx: Erfassungs-Formular in Spalte ②, Anzeige + Löschen in Spalte ⑤.',
    files: [
      'backend/migrations/184_beitraege_delete_guard.sql (neu)',
      'backend/migrations/185_manuelle_erstattungen.sql (neu)',
      'backend/scripts/run-migration-184.js, run-migration-185.js (neu)',
      'backend/routes/mitglieder.js (Guard-Bypass in Archivierung)',
      'backend/routes/beitraege.js (Guard-Fehlermeldung)',
      'backend/routes/finanzcockpit.js (manuelle-erstattung POST/DELETE + mitglied-finanz)',
      'frontend/src/components/MitgliedFinanzUebersicht.jsx',
      'version.js', 'SystemChangelog.jsx',
    ],
  },
  {
    version: '3.0.7',
    date: '2026-06-04',
    type: 'feature',
    title: 'Mitglieder-Finanzübersicht & Stripe-Abgleich: Fehler-Check, Stoppen & Rückerstatten',
    description: 'Eine vollständige, gezielte Finanzübersicht pro Mitglied (Auswertungen → Mitglieder → Finanzen sowie im Finanzcockpit): genaue Aufschlüsselung aller Abbuchungen, automatische Problemanalyse für Doppel-/Phantom-Buchungen, ein 5-stufiger Stripe-Abgleich (Soll → Geschickt → Bei Stripe → Zurück → Rückerstattung) und direkte Aktionen zum Stoppen oder (Teil-)Erstatten.',
    highlights: [
      '🔎 MITGLIEDER-FINANZÜBERSICHT: Mitglied suchen → alle Zahlungen auf einen Blick (Beiträge, Rechnungen, Verkäufe mit Einzel-Artikeln, Stripe-Lastschriften, Rücklastschriften) + KPIs (bezahlt / offen / in Einzug / nächste Fälligkeit). Verfügbar in „Auswertungen → Mitglieder → Finanzen" und im Finanzcockpit',
      '🔜 SOLL & ZUKUNFT: „Aktuell fällig – nächster Lastschriftlauf" und „Künftige Lastschrift-Läufe" (offene Beiträge nach Monat gruppiert) — du siehst, was kommt, ohne zwischen Mitgliedern zu wechseln',
      '🏦 STRIPE-ABGLEICH (pro Monat, 5 Stufen): ① Soll (was eingezogen werden sollte) → ② Geschickt (von uns an Stripe) → ③ Bei Stripe (Live-Status) → ④ Zurück (Ergebnis nach Abbuchung) → ⑤ Rückerstattung. Differenz-Anzeige (Δ) deckt Abweichungen sofort auf',
      '🔍 CHECK / PROBLEMANALYSE: erkennt automatisch Doppelbuchungen, Betrags-Abweichungen, Phantom-Abbuchungen, doppelte Monatsbeiträge und fehlende Beiträge (Ruhepausen ausgenommen) + Monatsvergleich „geschickt vs. erwartet"',
      '🚫 ABBUCHUNG STOPPEN: laufende (processing) Stripe-Einzüge direkt aus der Software stornieren — Beiträge werden wieder offen gestellt',
      '↩ RÜCKERSTATTEN: bereits eingezogene Abbuchungen komplett ODER pro Position (Teil-Rückerstattung) über Stripe erstatten; die Rückerstattung erscheint mit Stripe-Status-Abgleich in Spalte ⑤',
      '🧾 ARTIKEL-DETAILS: Verkäufe mit Einzelposten (welcher Artikel, Menge, Preis) + „Artikel-Übersicht" (wie oft welcher Artikel gekauft wurde)',
      '🛡 LASTSCHRIFT-SCHUTZ: Retry markiert Beiträge auch bei „in Verarbeitung"; Parallellauf-Schutz (kein zweiter gleichzeitiger Lauf für denselben Monat) — verhindert Doppelabbuchungen',
      '🔧 MITGLIEDER-HINWEIS: Wartungs-Banner in der Mitglieder-App (bei Wartungsfenstern, blendet sich automatisch wieder aus)',
    ],
    details: 'Backend (alles dojo-isoliert): /api/finanzcockpit/mitglied-suche, /mitglied-finanz/:id (inkl. magicline_description, verkauf_positionen, artikel_uebersicht, alle Stripe-Felder), /mitglied-check/:id (Findings + Monatsvergleich), /stripe-details/:pi (Live-PI/Charge/Refunds/Fehler via Provider, connected account), /refund/:txId (Voll-/Teil-Refund). /api/lastschriftlauf/zusammensetzung + /member-payments/naechste-abbuchung. Doppellauf-/Retry-Schutz in StripeConnectProvider + StripeDataevProvider + lastschriftlauf.js. Frontend: MitgliedFinanzUebersicht.jsx (5-Spalten-Abgleich, Check-Panel, Stop/Refund-Buttons), eingebunden in Auswertungen.jsx (Sub-Tab Finanzen) + Finanzcockpit.jsx; WartungsBanner.jsx in MemberDashboard; MemberPayments.jsx mit „Nächste Abbuchung".',
    files: [
      'backend/routes/finanzcockpit.js (mitglied-suche/-finanz/-check, refund, stripe-details)',
      'backend/routes/lastschriftlauf.js (zusammensetzung, Retry-/Storno-Pfad)',
      'backend/routes/member-payments.js (naechste-abbuchung)',
      'backend/services/{StripeConnectProvider,StripeDataevProvider}.js (Verwendungszweck, Parallellauf-Schutz)',
      'frontend/src/components/MitgliedFinanzUebersicht.jsx (neu)',
      'frontend/src/components/{Auswertungen,Finanzcockpit,MemberPayments,MemberDashboard}.jsx',
      'frontend/src/components/WartungsBanner.jsx (neu)',
      'version.js', 'SystemChangelog.jsx',
    ],
  },
  {
    version: '3.0.6',
    date: '2026-06-04',
    type: 'feature',
    title: 'Mitglieder-Finanzübersicht, Lastschrift-Schutz & Mitglieder-App-Performance',
    description: 'Neue Finanzübersicht pro Mitglied im Finanzcockpit (Suche + vollständige Aufschlüsselung aller Abbuchungen und offenen Posten), mehrere Schutzmechanismen gegen Lastschrift-Doppelabbuchungen sowie ein deutlich entlastetes, schnelleres Mitglieder-Dashboard.',
    highlights: [
      '🔎 FINANZCOCKPIT: Mitglieder-Finanzübersicht — Mitglied suchen → genaue Aufschlüsselung: was wann wie wo eingezogen wurde (Stripe-Lastschriften, Beiträge, Rechnungen, Verkäufe, Rücklastschriften) + was noch offen/in Einzug ist',
      '🏦 LASTSCHRIFT-SCHUTZ: Retry-Pfad markiert Beiträge auch bei „in Verarbeitung" (verhindert Doppelabbuchung); Parallellauf-Schutz (kein zweiter Lauf für denselben Monat während ein Lauf gerade läuft)',
      '⚡ PERFORMANCE: Mitglieder-Dashboard (app.tda-vib.de) deutlich entlastet — Shop-, News- & Vertragsstatus-Bereiche in eigene, memoizte Komponenten ausgelagert; nicht-kritische Ladevorgänge in den Leerlauf verschoben → flüssigere Bedienung, weniger „mehrfach klicken"',
      '🛠 STABILITÄT: Mitglied-Detail-Crash (fehlende Datumsfunktion) behoben; doppelte „Neue Version"-Banner auf einen konsolidiert; Server-Memory-Limit erhöht (keine kurzen Ausfälle mehr)',
    ],
    details: 'Backend: /api/finanzcockpit/mitglied-suche + /mitglied-finanz/:id (aggregiert beitraege, rechnungen, verkaeufe, stripe_lastschrift_transaktion, mitglied_ruecklastschriften je Mitglied, dojo-isoliert). Lastschrift: processLastschriftBatch (StripeConnect + StripeDataev) blockt parallele Läufe (status=processing, <30min); Retry markiert bei processing. Frontend: MitgliedFinanzUebersicht.jsx im Finanzcockpit; MemberDashboard in MemberShopWidgets/MemberNewsWidget/MemberContractStatus aufgeteilt (React.memo); deferIdle für unkritische Fetches; MemberDashboardMobile (toter Code) entfernt; WartungsBanner.jsx (auto-expiring Hinweis).',
    files: [
      'backend/routes/finanzcockpit.js (mitglied-suche, mitglied-finanz)',
      'backend/services/{StripeConnectProvider,StripeDataevProvider}.js (Parallellauf-Schutz)',
      'backend/routes/lastschriftlauf.js (Retry markiert bei processing)',
      'frontend/src/components/MitgliedFinanzUebersicht.jsx (neu)',
      'frontend/src/components/{MemberShopWidgets,MemberNewsWidget,MemberContractStatus,WartungsBanner}.jsx (neu)',
      'frontend/src/components/{Finanzcockpit,MemberDashboard}.jsx',
      'version.js', 'SystemChangelog.jsx',
    ],
  },
  {
    version: '3.0.5',
    date: '2026-06-03',
    type: 'feature',
    title: 'T-Shirt-Bestellvorlage, Finanzcockpit-Überarbeitung & großer Code-Cleanup',
    description: 'Neue eigenständige T-Shirt-Bestellvorlage (analog zur Gi-Vorlage) mit Schnitt-/Größen-/Veredelungs-Auswahl, Lieferant & Preisen, Datei-Upload und interaktiver Vorschau. Dazu das überarbeitete Finanzcockpit, korrigierte Auswertungen/Lohnabrechnung sowie ein umfangreicher technischer Cleanup (Aufteilung großer Komponenten, Entfernen alter Backup-Dateien).',
    highlights: [
      '👕 T-SHIRT-BESTELLVORLAGE: eigene Vorlage parallel zur Gi — Ausschnitt (Rundhals/V), Ärmel (kurz/lang/ärmellos), Passform; Größen Kinder & Erwachsene mit Mengen; Veredelung (Druck/Stickerei/Flex) je Position (Brust links/mittig, Rücken, Ärmel li/re) mit Maßen',
      '🖼 INTERAKTIVE VORSCHAU: parametrische T-Shirt-Skizze (Vorder-/Rückseite) — Logos werden an ihrer Position eingeblendet und können per Drag frei verschoben werden; eigene Vorlage (Photoshop/KI-Bild) als Hintergrund hochladbar',
      '📎 DATEI-UPLOAD: Designdateien/Logos je Position und allgemein — werden ins PDF eingebettet',
      '💶 LIEFERANT & PREISE: Lieferant aus Liste/Freitext, Stückpreise (Kinder/Erwachsene), Währung (EUR/USD/CHF) und automatischer Gesamtpreis — auch im PDF',
      '📊 FINANZCOCKPIT: elegantere KPI-Karten, klickbare Detail-Popups, aufgeräumte Anordnung (Karten → Übersicht → Grafiken), Zeitraum-Umschalter (Woche/Monat/Quartal/Jahr), echte Daten statt Platzhalter',
      '🧹 CODE-CLEANUP: große Komponenten (Buchhaltung, Prüfungen, Stilverwaltung, Dojo-Lizenzverwaltung) in fokussierte Tab-Komponenten aufgeteilt; ~62.000 Zeilen alter Backup-/Altdateien entfernt',
      '🛠 FIXES: Lohnabrechnung (Spalten-Mapping & Dojo-Filter), Jahresübersicht, Gi-Bestellung (mehrseitiger Druck, Vorschau, Datei-Löschen) korrigiert',
    ],
    details: 'Neu: frontend/src/components/TShirtBestellvorlage.jsx (+ buildTShirtPdf) + styles/TShirtBestellvorlage.css. Speicherung in gi_bestellungen mit formdata._typ=\'tshirt\' (kein DB-Schema-Change). Interaktive Vorschau als React-SVG mit Pointer-Drag (Position-Override pro Veredelung). Eigene Mockup-Bilder + Logos als Base64 im formdata, ins PDF eingebettet. BestellungenTab.jsx mit Button „+ Neue T-Shirt-Bestellung", typ-bewusster Vorschau/Bearbeiten. Cleanup: Extraktion von Buchhaltung*/Pruefungs*/Stil*/Lizenz*-Tab-Komponenten; Löschen von _backup_pre_refactor/, *.bak, *.old, *.backup-Dateien. Backend: lohnabrechnung.js (personal-Spalten personal_id/grundgehalt/status, dojo.dojoname), jahresuebersicht.js (Datumsquelle beitraege).',
    files: [
      'frontend/src/components/TShirtBestellvorlage.jsx (neu)',
      'frontend/src/styles/TShirtBestellvorlage.css (neu)',
      'frontend/src/components/BestellungenTab.jsx',
      'frontend/src/components/{Finanzcockpit,Auswertungen}.jsx',
      'frontend/src/components/{Buchhaltung,Pruefungs,Stil,Lizenz}*Tab.jsx (extrahiert)',
      'backend/routes/{auswertungen,finanzcockpit,jahresuebersicht,lohnabrechnung}.js',
      'version.js', 'SystemChangelog.jsx',
    ],
  },
  {
    version: '3.0.4',
    date: '2026-06-02',
    type: 'major',
    title: 'Großes Sammel-Release: Finanzen, Akquise/Marketing, White-Label-Design, Auswertungen & mehr',
    description: 'Kumulatives Release mit den Neuerungen aus rund zwei Monaten Entwicklung (seit 3.0.3). Schwerpunkte: ein neues White-Label Design-System, eine umfassende Akquise-/Marketing-Suite, viele Finanz- & Zahlungs-Verbesserungen (Kontoauszug-Import, Stripe-Retry, SEPA, Ratenzahlung), überarbeitete Auswertungen sowie zahlreiche UX-, Mobil- und Sicherheits-Updates. Nachfolgend nach Bereichen gruppiert.',
    highlights: [
      '🎨 DESIGN: White-Label „Design & Themes" (Enterprise) — Modus Dunkel/Hell/Washi, 7 Presets, freie Farben (Akzent/Button/Text), Header/Sidebar/Überschriften einstellbar, Schrift & Größen, Radius/Button-Form/Tab-Stil, Kanji-Wasserzeichen — pro Subdomain gespeichert, Branding schon vor dem Login',
      '🧭 NAVIGATION: Dashboard von Tab-Leiste auf einklappbare Sidebar umgestellt (überall sichtbar); kompaktere Karten; Mitglied-Detail mit horizontaler Tab-Leiste & neuem Header',
      '💳 FINANZEN: Kontoauszug-Import (Enterprise) + Bank-Abgleich, GuV/Bilanz, Cashflow-Charts; fehlgeschlagene Stripe-Einzüge mit Retry & Diagnose; echte Auswertung offener Zahlungen',
      '🏦 ZAHLUNGEN: Rechnungen überarbeitet (E-Mail/PDF/Bearbeiten/Vermerke, Extern-Rechnungen); SEPA-Mandate neu (rotes Design, 1 Seite); Ratenzahlungsplan; Lastschrift-Logik (gekündigt/Ruhepause/Trainer korrekt); Lastschrift-Einverständnis für Einkäufe',
      '🤝 AKQUISE/CRM: „Akquise & Partnerschaften" CRM (8 Features) + Trial-Lizenzen + Software-Präsentationsvorlagen + Akquise-Briefe; Demo-Termin-Buchungssystem mit Wochenplan-Wizard, Slot-Sperren & Social Proof',
      '📣 MARKETING: Marketing-Zentrale mit KI-Content, Newsletter, Jahresplan, Geburtstagen; Social Media (Facebook/Instagram OAuth) inkl. Direkt-Posting aus dem News-Editor (Enterprise)',
      '💬 BESUCHER-CHAT: Claude-KI-Antworten mit Abwesend/Verfügbar-Modus & Auto-Reply, wenn kein Staff online ist',
      '🎖 PRÜFUNGEN: Anmelde-/Bestätigungsstatus manuell setzbar, Gürtellänge, Prüfungshistorie; Textvorlagen für News (Prüfung/Turnier/Event)',
      '🪪 MITGLIEDER: Mitgliedsausweis neu (Dunkelrot/Washi, Admin + Member-App); mobiles Member-Dashboard mit Bottom-Nav & Widgets; Geburtstags-Popups, Neue-Verträge-Karte',
      '🏅 MODULE: Nationalkader-Modul (TDA-Events-Integration); Trainer/Personal-Lohnabrechnung & Vergütung; Trainervereinbarung; Backup-Verwaltung (Super-Admin); iPhone-Kalender-Sync; Kursmanagement-UX überarbeitet',
      '📊 AUSWERTUNGEN: jetzt theme-fähig (Charts/Achsen/Tooltips folgen Hell/Washi/Akzent); Daten-Korrektheit (echte freie Zeiten, echte Teilnehmerzahlen + Widget „Beliebteste Kurse", Anmeldungs-Quellen ohne Doppelzählung); Onboarding-Kohorten erklärt',
      '🥋 KURSNAMEN: Disziplin (z.B. „Enso Karate") als Titel, Altersgruppe klein darunter — durchgängig inkl. Check-in-App',
      '📷 CHECK-IN-APP: iPhone-Foto-Upload repariert (HEIC → JPEG), Fotos per Klick vergrößerbar, Altersgruppen sichtbar',
      '🔒 SICHERHEIT & TECHNIK: mehrere Multi-Tenant-/Security-Runden (Chat-Isolation, IBAN, Webhook, betrag-Validation); Login-Bypass im Prod-Build deaktiviert; git-basierter Deploy; SEO (Meta/JSON-LD); Performance-Optimierungen',
    ],
    details: 'Token-basiertes Design-System (CSS Custom Properties --ds-*) als zentrale Quelle; Laufzeit-Override via dsTheme.js, Persistenz pro Dojo über Tabelle dojo_theme (Migration 183) + Route /api/dojo-theme (GET/PUT/DELETE/public). Hunderte CSS-Dateien per Skript von hartkodierten Farben (Hintergründe, Text, Rahmen) auf Token gebrückt; globale Überschriften-Regel variablen-gesteuert. Auswertungen: recharts-Farben auf var(--ds-*), exklusive Quellen-Aggregation (EXISTS), Öffnungsfenster aus stundenplan MIN/MAX. Kursname: Anzeige auf k.stil umgestellt (gruppenname als Sub), Backend /trainer-stunden + Vergütung um stil ergänzt. Check-in-App (eigenständiges Projekt): clientseitige HEIC→JPEG-Umwandlung per Canvas, Backend-fileFilter akzeptiert HEIC/HEIF, Lightbox für Fotos. Login-Bypass an import.meta.env.DEV gebunden (im Prod-Build immer false).',
    files: [
      'frontend/src/design-system/* (ds-tokens.css, ds-components.css)',
      'frontend/src/utils/dsTheme.js, components/ThemeEinstellungen.jsx',
      'frontend/src/components/Auswertungen.jsx (+ Auswertungen-*.css)',
      'frontend/src/components/{CheckinSystem,Stundenplan,Kurse,Trainer*,Member*,RaumVerwaltung,NotificationSystem}.jsx',
      'backend/routes/{dojo-theme,auswertungen,trainer,trainerStunden,checkin}.js',
      'backend/migrations/183_dojo_theme.sql',
      'checkin-app: pages/{CheckinPage,Courses,SelbstCheckin}.jsx',
      'version.js', 'SystemChangelog.jsx',
    ],
  },
  {
    version: '3.0.3',
    date: '2026-03-31',
    type: 'feature',
    title: 'Prüfungsprotokoll ins Mitglieder-Dashboard + Trainingskonflikt-Warnung',
    description: 'Nach Abschluss einer Gürtelprüfung kann das Prüfungsprotokoll direkt ins Mitglieder-Dashboard des Prüflings gestellt werden. Das Protokoll wird serverseitig aus den Prüfungsdaten generiert (Mitglied, Stil, Graduierungen, Einzelbewertungen) und ist anschließend im MemberDashboard unter "Prüfungsergebnisse" abrufbar. Außerdem prüft das System beim Anlegen eines neuen Prüfungstermins automatisch, ob zur selben Zeit reguläres Training im Stundenplan steht — und bietet optional eine Push-Benachrichtigung an alle Mitglieder an.',
    highlights: [
      '📋 "Ins Mitglieder-Dashboard" Button in der Protokoll-Vorschau (PruefungsVerwaltung → Abgeschlossen)',
      '🖥 Backend generiert das Protokoll-HTML selbst aus DB-Daten (kein HTML-Transfer im Request)',
      '👤 Mitglied sieht das Protokoll im MemberDashboard unter "Prüfungsergebnisse" als aufrufbares Dokument',
      '⚠️ Beim Anlegen eines Prüfungstermins: automatischer Abgleich mit dem Stundenplan (Wochentag + Uhrzeit)',
      '📣 Konflikt-Dialog mit Checkbox: optionale Push-Benachrichtigung "Training entfällt wegen Gürtelprüfung" an alle aktiven Mitglieder',
    ],
    details: 'Neue DB-Tabelle pruefungs_protokolle (protokoll_id, pruefung_id UNIQUE, dojo_id, html_inhalt LONGTEXT, gesendet_am). Backend-Route: POST /api/pruefungen/:id/protokoll/ins-dashboard (generiert HTML aus pruefungen + mitglieder + stile + graduierungen + pruefung_bewertungen JOIN pruefungsinhalte). GET /api/pruefungen/mitglied/:mid/protokolle liefert alle Protokolle für das MemberDashboard. Konflikt-Check: GET /api/pruefungen/termine/stundenplan-konflikt?datum&zeit — nutzt ELT(DAYOFWEEK(?)) für den deutschen Wochentag-Abgleich. Push-Versand via sendTrainingsausfallPush() an alle mitglieder JOIN push_subscriptions WHERE dojo_id = ? AND status = aktiv.',
    files: [
      'backend/routes/pruefungen/protokoll.js (neu)',
      'backend/routes/pruefungen/index.js',
      'backend/routes/pruefungen/termine.js',
      'frontend/src/components/PruefungsVerwaltung.jsx',
      'frontend/src/components/MemberDashboard.jsx',
      'DB: pruefungs_protokolle, mitglied_stile.ist_hauptstil',
      'version.js', 'SystemChangelog.jsx',
    ],
  },
  {
    version: '3.0.2',
    date: '2026-03-26',
    type: 'feature',
    title: 'Stilverwaltung: Konfigurierbare Prüfungsinhalte-Kategorien & Beschreibungsfelder',
    description: 'Prüfungsinhalte-Kategorien (z.B. Kondition, Grundtechniken, Kata) sind jetzt pro Stil frei konfigurierbar: neue Kategorien anlegen, umbenennen, per Drag & Drop sortieren und für einzelne Graduierungen aktivieren/deaktivieren. Jeder Prüfungsinhalt kann zusätzlich ein optionales Beschreibungsfeld ("Zusatzinfo") erhalten.',
    highlights: [
      '⚙️ Einstellungen-Tab: Neue Sub-Tabs "📝 Inhalte" und "⚙️ Einstellungen" im Prüfungsinhalte-Bereich',
      '➕ Neue Kategorien anlegen: Name + Icon frei wählbar, erscheinen sofort im Inhalte-Tab',
      '✏️ Bestehende Kategorien umbenennen und Icon tauschen',
      '⠿ Drag & Drop Sortierung der Kategorien (Reihenfolge wird gespeichert)',
      '🎖️ Graduierungs-Zuweisung: Jede Kategorie kann auf bestimmte Graduierungen beschränkt werden (z.B. Theorie nur ab Braungurt)',
      '📝 Beschreibungsfeld: Jeder Prüfungsinhalt bekommt optional ein "Zusatzinfo"-Feld für Ausführungshinweise, Bewertungskriterien etc.',
      '🔄 Neue Stile erhalten automatisch die 5 Standard-Kategorien (Kondition, Grundtechniken, Kata, Kumite, Theorie)',
    ],
    details: 'Die Kategorien werden in der neuen DB-Tabelle pruefungsinhalte_kategorien gespeichert (Migration 059). Das Beschreibungsfeld nutzt die bereits vorhandene beschreibung-Spalte in pruefungsinhalte. Der Graduation-Filter nutzt JSON-Array aktive_graduierung_ids (NULL = alle aktiv). SortableKatItem ist außerhalb der Hauptkomponente definiert, um React-Remount bei State-Updates zu verhindern.',
    files: [
      'backend/routes/stile/pruefungsinhalte.js',
      'backend/migrations/059_pruefungsinhalte_kategorien.sql',
      'frontend/src/components/Stilverwaltung.jsx',
      'frontend/src/styles/StilVerwaltung.css',
      'version.js', 'SystemChangelog.jsx',
    ],
  },
  {
    version: '3.0.1',
    date: '2026-03-26',
    type: 'major',
    title: 'Homepage Builder — Kostenlose professionelle Website für Enterprise-Dojos',
    description: 'Enterprise-Kunden erhalten eine vollwertige, öffentlich erreichbare Homepage im japanischen Martial-Arts-Design (TDA-VIB-Template). Der integrierte Builder ermöglicht die Gestaltung per Drag & Drop direkt im Dashboard — ohne externe Tools, ohne Programmierkenntnisse. Die Homepage ist sofort unter einer eigenen URL erreichbar und kann per CNAME oder A-Record auf eine eigene Domain zeigen.',
    highlights: [
      '🌐 Split-Pane Builder: Einstellungsbereich links, Live-Vorschau rechts — sieht sofort, was gespeichert wird',
      '📸 Logo-Upload: Eigenes Bild hochladen (PNG, JPG, SVG, WebP, max. 5 MB) — ersetzt Kanji-Zeichen im Header und Hero',
      '👁 Vorschau ohne Publizieren: iframe-Vorschau lädt die aktuelle Konfiguration direkt — kein Veröffentlichen nötig',
      '⋮⋮ Drag & Drop: Sektionen per Maus in der Reihenfolge verschieben, ein/ausblenden',
      '🏯 Hero-Sektion: Schulname, Untertitel, Kanji-Logo, Tagline, 2 CTA-Buttons konfigurierbar',
      '🥋 Kampfkunststile: Beliebig viele Stile mit Icon, Name, Kanji-Zeichen und Farbe',
      '📅 Stundenplan-Vorschau: Zeigt die nächsten 3 Trainingstage live aus der Dojosoftware',
      '⛩️ Werte-Sektion: Kanji-Werte mit Reading, Namen und Beschreibungstext',
      '📣 Call-to-Action: Konfigurierbarer CTA-Bereich mit Titel, Text und Button',
      '⚙️ Navigation: Alle Menüpunkte (Label + Link) frei konfigurierbar',
      '🎨 Design: Primärfarbe und Goldton frei wählbar (Farbpicker)',
      '📧 Kontakt: Adresse, E-Mail, Telefonnummer im Footer',
      '🔗 URL-Tab: Eigener Slug-Name (z.B. /site/mein-dojo) mit Verfügbarkeitsprüfung',
      '🖥 Server-Tab: Öffentliche URL, Custom Domain, DNS-Anleitung (CNAME + A-Record mit Server-IP)',
      '🚀 Publizieren/Depublizieren per Klick — Status-Chip in der Toolbar',
      '🌙 Vollständige Dark-Mode-Unterstützung des Builders',
    ],
    details: 'Die Homepage wird als React SPA unter /site/:slug auf dojo.tda-intl.org ausgeliefert. Nginx serviert /site/-Routen mit X-Frame-Options: SAMEORIGIN, damit die Live-Vorschau im Builder-iframe funktioniert. Für die Vorschau ohne Publizieren gibt es einen auth-geschützten /api/homepage/preview Endpoint. Logo-Uploads landen in /uploads/logos/. Die Konfiguration wird als JSON in der dojo_homepage-Tabelle gespeichert (ein Eintrag pro Dojo). Custom-Domain-Konfiguration erfolgt über CNAME → dojo.tda-intl.org oder A-Record → 185.80.92.166; SSL via Let\'s Encrypt auf Anfrage.',
    files: [
      'backend/routes/homepage.js',
      'backend/migrations/059_homepage_builder.sql',
      'frontend/src/components/HomepageDashboard.jsx',
      'frontend/src/styles/HomepageDashboard.css',
      'frontend/src/components/DojoSite.jsx',
      'frontend/src/styles/DojoSite.css',
      'frontend/src/App.jsx',
      'frontend/src/components/Dashboard.jsx',
      'nginx: /etc/nginx/sites-available/dojo.tda-intl.org (/site/ Location Block)',
      'version.js', 'SystemChangelog.jsx',
    ],
  },
  {
    version: '3.0.0',
    date: '2026-03-20',
    type: 'feature',
    title: 'News-Editor: K2-ähnliches CMS-System',
    description: 'Der News-Editor wurde grundlegend überarbeitet und entspricht jetzt einem vollwertigen CMS-Modul (vergleichbar mit Joomla K2). WYSIWYG-Bearbeitung, Kategorien, Tags, geplante Veröffentlichung, Ablaufdatum, Featured-Markierung, SEO-Felder und Bildunterschriften — alles in einem modernen 2-Spalten-Layout mit dedizierter Sidebar.',
    highlights: [
      'WYSIWYG Rich-Text-Editor mit Formatierungsleiste (Fett, Kursiv, Unterstrichen, Durchgestrichen, H2–H4, Absatz, Aufzählung, Nummerierung, Zitat, Link, Trennlinie, Format entfernen)',
      'Kategorie-Dropdown: Allgemein, Turniere, Events, Prüfungen, Training, Verband',
      'Geplante Veröffentlichung: Status "🕐 Geplant" + Datum/Uhrzeit — Artikel geht automatisch online',
      'Ablaufdatum: Artikel wird nach dem eingestellten Zeitpunkt automatisch ausgeblendet',
      'Tags / Schlagwörter: Chip-basierte Eingabe mit Enter oder Komma-Taste',
      '⭐ Hervorgehoben (Featured): Toggle — markierter Artikel erscheint groß oben auf der News-Seite',
      'SEO-Sektion (ausklappbar): Meta-Titel (60 Z.) und Meta-Beschreibung (160 Z.) für Suchmaschinen',
      'Bildunterschriften: Caption-Feld unter jedem hochgeladenen Bild',
      '2-Spalten-Layout: Inhaltsbereich links, Publikations-Sidebar rechts mit Sticky-Verhalten',
      '"💾 Als Entwurf speichern" und "🚀 Jetzt veröffentlichen" als separate Buttons',
      'Listenansicht: neue Badges für ⭐ Featured, Kategorie, 🕐 Geplant sowie Ablauf-Warnung',
      'Filter "🕐 Geplant" in der News-Übersicht',
      'Datenbankschema erweitert: kategorie, tags, geplant_am, ablauf_am, featured, meta_titel, meta_beschreibung, bild_captions',
      'Backend: automatische Aktivierung geplanter Artikel (geplant_am ≤ NOW()) und Ablauf (ablauf_am > NOW()) in allen öffentlichen API-Endpunkten',
    ],
    details: 'Die Datenbankstruktur der news_articles-Tabelle wurde um 8 Spalten erweitert. Der Backend-Endpunkt /api/news/homepage und /api/news/public werten jetzt automatisch geplante Artikel aus (kein Cronjob nötig — der SQL-Check läuft bei jedem Request). Abgelaufene Artikel werden in denselben Queries herausgefiltert. Der WYSIWYG-Editor speichert HTML (nicht mehr Plaintext), was strukturierte Formatierung, Überschriften und Listen in Artikeln ermöglicht.',
    files: [
      'backend/routes/news.js',
      'frontend/src/components/NewsFormular.jsx',
      'frontend/src/components/NewsVerwaltung.jsx',
      'frontend/src/styles/News.css',
      'version.js', 'SystemChangelog.jsx',
    ],
  },
  {
    version: '2.9.9',
    date: '2026-03-20',
    type: 'feature',
    title: 'Prüfungsartikel automatisch vorbereiten',
    description: 'Nach bestandener Prüfung erscheint ein goldenes Banner mit "📰 Artikel vorbereiten". Ein Klick erstellt einen fertig vorausgefüllten News-Entwurf (Namen, neue Graduierungen, Datum) und öffnet den News-Editor — nur noch Foto hochladen und Veröffentlichungsort wählen.',
    highlights: [
      'Artikel-Banner nach Einzelspeicherung (bestanden)',
      'Artikel-Banner nach "Alle speichern" mit kompletter Prüflingsliste',
      'Artikel mit Titel, Kurzbeschreibung und HTML-Inhalt vorausgefüllt',
      'Status: Entwurf — muss bewusst veröffentlicht werden',
      'Direkter Redirect in den News-Editor'
    ]
  },
  {
    version: '2.9.8',
    date: '2026-03-20',
    type: 'feature',
    title: 'Prüfungsbewertung: 3-State, Punkte-Dropdown & Einstellungen',
    highlights: [
      '3-State-Bewertung: Items können jetzt "offen", "bestanden" oder "nicht bestanden" sein — klickbar zum Durchschalten',
      'Punkte als Dropdown: statt Zahlenfeld gibt es ein Auswahlmenü (ganze / halbe / Zehntel-Schritte einstellbar)',
      'Auto-bestanden: ab konfigurierbarer Punktzahl (Standard 5) wechselt ein Item automatisch auf "bestanden"',
      'Auto-Gesamturteil: wenn ≥ 50% der Gesamtpunkte erreicht sind, wird das Prüfungsurteil automatisch gesetzt',
      '"✓ Alle bestanden"-Button pro Kategorie-Sektion in den Prüfungsinhalten',
      '"Alle speichern"-Button speichert alle Prüflinge eines Termins auf einmal',
      'Bewertungs-Einstellungen: Schwellenwerte und Schrittweite zentral konfigurierbar (gilt für "Prüfung durchführen" und Batch-Modal)',
      'Toolbar oben modernisiert: kompakte Button-Gruppen, Trennlinien, einheitliches Layout',
    ],
    details: 'Die Prüfungsbewertung wurde grundlegend überarbeitet. Alle Prüfungsinhalte starten jetzt auf "offen" (grau, ○) statt direkt auf bestanden. Ein Klick auf den State-Button schaltet durch die drei Zustände. Wird eine Punktzahl gewählt, prüft das System automatisch ob die konfigurierte Schwelle (Standard: 5 Pkt) erreicht ist und setzt den State entsprechend. Gleichzeitig wird aus allen eingetragenen Punkten der Prozentwert berechnet — bei ≥ 50% kippt das Gesamturteil auf "bestanden". Alle Schwellenwerte sind in den Bewertungs-Einstellungen (⚙ oben in der Toolbar) anpassbar und werden in localStorage gespeichert. Die Einstellungen gelten sowohl für die Einzelansicht als auch für das Batch-Modal in der Prüfungsverwaltung.',
    files: [
      'PruefungDurchfuehren.jsx', 'PruefungDurchfuehren.css',
      'PruefungsVerwaltung.jsx', 'PruefungsVerwaltung.css',
      'version.js', 'SystemChangelog.jsx',
    ],
  },
  {
    version: '2.9.7',
    date: '2026-03-19',
    type: 'feature',
    title: 'Doppelprüfung & QR-Code Selbst-Checkin',
    highlights: [
      'Doppelprüfung: Kandidaten können eine Gurtstufe überspringen — bei Urkundendruck werden automatisch 2 Urkunden gedruckt (je eine für den Zwischengurt und den Zielgurt)',
      'Zwischengurt setzen: In der Kandidatenliste eines Prüfungstermins erscheint der "2×"-Button — Klick öffnet Dropdown mit möglichen Zwischengraden',
      'QR-Code Selbst-Checkin: Jeder Kurs hat jetzt einen eigenen QR-Code (🏷️-Button in der Kursübersicht)',
      'Mitglieder scannen den QR-Code am Trainingsraum und checken sich selbst ein — kein Trainer nötig',
      'Selbst-Checkin-Seite: Namenssuche → Einchecken-Button → sofortige Bestätigung',
    ],
    details: 'Wenn ein Prüfling eine Gurtstufe überspringt (z.B. von Weiß direkt zu Orange), wird in der Kandidatenzeile des Prüfungstermins der "2×"-Button sichtbar. Nach Auswahl des Zwischengurts (z.B. Gelb) erscheint ein grüner Badge. Beim Urkundendruck werden zwei Seiten erzeugt: erste Urkunde mit Zwischengurt, zweite mit Zielgurt — beide mit eigenen Urkundennummern und Verbandsregistereintrag. Der QR-Code Selbst-Checkin ermöglicht kursspezifisches Einchecken ohne Trainer-Aktion: QR pro Kurs aushängen, Mitglied scannt, sucht Namen, checkt ein.',
  },
  {
    version: '2.9.6',
    date: '2026-03-18',
    type: 'feature',
    title: 'Interner Chat — Status-Verwaltung (Aktiv / Archiviert / Geschlossen)',
    highlights: [
      'Chat-Räume können jetzt als Aktiv, Archiviert oder Geschlossen markiert werden',
      'Filter-Tabs in der Raumliste: Aktiv / Archiviert / Geschlossen — sofortiges Umschalten',
      'Direktchats: 3-Punkte-Menü mit Aktiv / Archivieren / Schließen und Löschen',
      'Gruppenräume: Status-Buttons im Einstellungs-Dialog (Settings-Tab)',
      'Farbcodierte Status-Punkte in der Raumliste (grün / orange / grau)',
      'TDA Intro-Animation: zeigt sich jetzt wieder einmalig pro Session beim ersten Besuch',
    ],
    details: 'Die interne Chat-Funktion wurde um ein vollständiges Status-System erweitert. Jeder Raum kann jetzt als "Aktiv" (normale Nutzung), "Archiviert" (inaktiv, lesbar) oder "Geschlossen" (abgeschlossen) markiert werden. In der Raumliste gibt es drei Tabs zum schnellen Filtern. Bei Direktchats erscheint ein 3-Punkte-Menü im Header mit allen Statusoptionen und Löschen. Bei Gruppenräumen befindet sich die Status-Auswahl im Einstellungs-Modal. DB-Änderung: status-Spalte in chat_rooms.',
    files: [
      'ChatRoomList.jsx', 'ChatRoomSettings.jsx', 'ChatWindow.jsx',
      'chat.js (Backend)', 'Chat.css',
      'LandingPage.jsx', 'TDAIntroPopup.jsx',
      'SystemChangelog.jsx',
    ],
  },
  {
    version: '2.9.5',
    date: '2026-03-15',
    type: 'feature',
    title: 'Kommunikation-Tab, News Multi-Tenant & TDA-Website-Integration',
    highlights: [
      'Neuer "Kommunikation & Marketing" Tab im Dashboard (News, Newsletter, Marketing)',
      'News-System Multi-Tenant: jeder Dojo-Admin verwaltet seine eigenen Artikel',
      'Öffentliche News-API mit JSON-Endpunkt, iFrame-Widget und RSS-Feed',
      'TDA-exklusive Option: News direkt auf tda-vib.de & tda-intl.com veröffentlichen',
      'tda-vib.de und tda-intl.com beziehen News jetzt live aus dem System',
      '"Website & Integration" Tab in Einstellungen mit Embed-Code und RSS-URL',
      '404-Fix: NewsVerwaltung und NewsFormular für alle Dojo-Admins zugänglich',
    ],
    details: 'Im Dashboard gibt es jetzt einen neuen Haupt-Tab "Kommunikation & Marketing" mit Karten für News & Beiträge, Newsletter & Benachrichtigungen sowie Marketing-Zentrale. Diese wurden aus dem Mitglieder-Tab ausgelagert. Das News-System wurde auf Multi-Tenant umgestellt: die news_articles-Tabelle hat jetzt eine dojo_id-Spalte — jeder Dojo-Admin sieht und verwaltet nur seine eigenen Artikel. Neue Backend-Datei public-news.js stellt drei öffentliche (CORS-enabled) Endpunkte bereit: /api/public/news?dojo_id=X (JSON), /api/public/news/widget?dojo_id=X (iframe-HTML mit Dark/Light Theme) und /api/public/news/feed.rss?dojo_id=X (RSS 2.0). Im NewsFormular ist die Zielgruppe "🌐 tda-vib.de & tda-intl.com" ausschließlich für den TDA-Account (dojo_id=2) sichtbar. Die öffentliche API liefert für TDA nur Artikel mit zielgruppe IN ("homepage", "alle_dojos"). tda-vib.de und tda-intl.com rufen jetzt live die API ab statt Mock-Daten/localStorage zu verwenden. In den Dojo-Einstellungen gibt es einen neuen Tab "Website & Integration" mit kopierbarem iFrame Embed-Code, RSS-URL und JSON-API-URL. Der isMainAdmin()-Check wurde aus NewsVerwaltung und NewsFormular entfernt — das Backend sichert die Autorisierung.',
    files: [
      'Dashboard.jsx',
      'NewsVerwaltung.jsx', 'NewsFormular.jsx',
      'news.js', 'public-news.js', 'server.js',
      'EinstellungenDojo.jsx',
      'tda-vib/News.jsx', 'tda-intl/News.jsx',
      'version.js', 'SystemChangelog.jsx',
    ],
  },
  {
    version: '2.9.4',
    date: '2026-03-14',
    type: 'feature',
    title: 'Prüfung Durchführen — Timer, Grid & Auto-Save',
    highlights: [
      'Prüfungs-Timer: Zwei Modi (Einfach & Blöcke) mit Prüfungsordnung-Presets',
      'Presets: Kyu (Boxen / Kicken / Kombitechniken) und Dan (Boxen / Fuß / Point / Continuous) — je 3×2 min, 1 min Pause',
      'Pro Block eigener ▶-Start — Sequenz ab beliebigem Block starten',
      'Timer-Konfiguration wird pro Dojo in der Datenbank gespeichert',
      'Prüflingskarten nebeneinander (Grid-Layout) für schnelleres Umschalten',
      'Bestanden-Button speichert sofort automatisch (kein Speichern-Klick nötig)',
      'Fußtechniken Ja/Nein-Toggle wird dauerhaft in DB gespeichert und wiederhergestellt',
    ],
    details: 'Der Prüfungs-Timer wurde grundlegend überarbeitet: (1) Zwei Modi — Einfach (einzelner Timer mit Runden/Rundenzeit/Pause) und Blöcke (mehrere sequentielle Blöcke mit individuellen Zeiten). (2) Zwei Prüfungsordnung-Presets sind hinterlegt: Kyu mit Boxen, Kicken und Kombitechniken sowie Dan mit Boxen, Fuß, Point und Continuous — jeweils 3 Runden à 2 Minuten mit 1 Minute Pause. Blöcke können manuell ergänzt oder jederzeit neu geladen werden. (3) Jeder Block hat einen eigenen ▶-Start-Button: Klick startet die Sequenz ab genau diesem Block. (4) Die komplette Timer-Konfiguration (Modus, Blöcke, Zeiten) wird per Dojo in der neuen Tabelle pruefungs_timer_config gespeichert und beim nächsten Öffnen automatisch wiederhergestellt. (5) Die Prüflingskarten werden jetzt im Grid nebeneinander dargestellt — das beschleunigt das Umschalten zwischen Kandidaten während der Prüfung. (6) Das Klicken auf "Bestanden" / "Nicht bestanden" löst jetzt einen direkten Auto-Save aus (800 ms Debounce, PUT /pruefungen/:id). (7) Der Fußtechniken Ja/Nein-Toggle wird in der neuen DB-Spalte mit_gesprungenen gespeichert und beim Laden der Prüfungen automatisch wiederhergestellt.',
    files: [
      'PruefungDurchfuehren.jsx', 'PruefungDurchfuehren.css',
      'pruefungen/crud.js', 'pruefungen/timer.js', 'pruefungen/index.js',
      'version.js', 'SystemChangelog.jsx',
    ],
  },
  {
    version: '2.9.3',
    date: '2026-03-13',
    type: 'feature',
    title: 'DokumentenZentrale — 7 Profi-Features',
    highlights: [
      'Vorschau mit echten Mitgliedsdaten — Mitglied-Picker direkt im Vorlagen-Editor',
      'Versandhistorie: Alle gesendeten E-Mails & PDFs im neuen Archiv-Tab',
      'Serienbrief / Massenversand an gefilterte Mitgliedergruppen',
      'Automatische Trigger: Geburtstag, Zahlungsverzug, Mitgliedschaft & Lizenzen',
      'Anhang-Bibliothek: Wiederkehrende Dateien hochladen und an E-Mails anhängen',
      'Geplanter Versand: E-Mails zeitgesteuert in die Warteschlange legen',
      'Vorlagen-Versionen: Änderungshistorie und Wiederherstellen älterer Versionen',
    ],
    details: 'Die DokumentenZentrale wurde um 7 professionelle Features erweitert. (1) Im Vorlagen-Editor kann jetzt ein echtes Mitglied für die Vorschau ausgewählt werden — statt Mustermann-Daten erscheinen die echten Platzhalter-Werte. (2) Alle versendeten E-Mails und PDFs werden in der Versandhistorie protokolliert (neuer "Versandarchiv"-Tab). (3) Der Serienbrief-Button sendet eine Vorlage an alle oder aktive Mitglieder mit E-Mail-Adresse — mit Schritt-für-Schritt-Assistent und Fortschrittsanzeige. (4) Automatische Trigger (täglicher Cron um 08:15 Uhr) versenden E-Mails zu Geburtstagen, Zahlungsverzug (7/14/30 Tage), ablaufenden Mitgliedschaften und Lizenzen. (5) Die Anhang-Bibliothek ermöglicht das Hochladen wiederkehrender Dateien (PDFs, Bilder) per Drag & Drop. (6) Im Senden-Modal gibt es eine "Zeitgesteuert"-Option mit Datum-/Uhrzeit-Picker — der Versand wird minütlich aus der Warteschlange verarbeitet. (7) Jede Speicherung im Vorlagen-Editor erstellt automatisch eine neue Version — ältere Versionen können jederzeit wiederhergestellt werden.',
    files: [
      'vorlagen.js', 'vorlage-trigger.js', 'dokument-anhaenge.js', 'cron-jobs.js',
      'VorlagenEditor.jsx', 'VorlagenEditor.css',
      'VorlagenVerwaltung.jsx', 'VorlagenSendenModal.jsx', 'VorlagenSendenModal.css',
      'DokumentenZentrale.jsx',
      'SerienBriefModal.jsx', 'SerienBriefModal.css',
      'AutomatisierungTab.jsx', 'AutomatisierungTab.css',
      'AnhangBibliothek.jsx', 'AnhangBibliothek.css',
    ]
  },
  {
    version: '2.9.2',
    date: '2026-03-12',
    type: 'feature',
    title: 'TDA Shop — Öffentlicher Dojo-Shop',
    highlights: [
      'Öffentlicher Onlineshop für jedes Dojo (kein Login nötig)',
      'TDA-Zentralshop für Pässe, Urkunden, Ausrüstung & Bekleidung',
      'Produkte direkt im Shop anlegen — mit "Im Dojo-Shop (Kasse)"-Option',
      'Warenkorb (localStorage), Guest-Checkout & Stripe-Zahlung',
      'Eigene Stripe-Keys pro Dojo in den Shop-Einstellungen',
      'Events-Button im Workspace-Switcher wieder verfügbar',
      'Bestellverwaltung mit Status-Workflow und Tracking-Nr.',
    ],
    details: 'Das neue Shop-Modul ist auf zwei Ebenen verfügbar: Der TDA-Zentralshop (Super-Admin) verkauft Pässe, Urkunden, Ausrüstung und Bekleidung — öffentlich unter /shop/tda erreichbar. Jedes Dojo kann seinen eigenen Shop aktivieren (Premium-Feature) unter /shop/:dojoId. Produkte werden direkt in der Shop-Verwaltung angelegt und können wahlweise auch im Dojo-internen Kassensystem erscheinen. Bestehende Artikel aus der Artikelverwaltung werden automatisch in den Shop übernommen. Der Guest-Checkout funktioniert ohne Login, Zahlung per Stripe (Kreditkarte) oder Rechnung. Jedes Dojo verwendet eigene Stripe-Keys die in den Shop-Einstellungen hinterlegt werden.',
    files: [
      'shop.js', 'ShopDashboard.jsx', 'ShopProduktVerwaltung.jsx',
      'ShopKategorienVerwaltung.jsx', 'ShopBestellungenVerwaltung.jsx',
      'ShopEinstellungen.jsx', 'PublicShop.jsx', 'PublicShopCheckout.jsx',
      'PublicShopWarenkorb.jsx', 'PublicShopBestaetigung.jsx',
      'Shop.css', 'PublicShop.css', 'DojoSwitcher.jsx', 'DojoContext.jsx',
      'migrations/070_shop_multitenant.sql', 'migrations/071_shop_artikel.sql'
    ]
  },
  {
    version: '2.9.1',
    date: '2026-03-11',
    type: 'feature',
    title: 'Kurs-Nachrichten & Vertretungsverbesserungen',
    highlights: [
      'Kurs-Nachricht direkt aus der Nachrichtenzentrale versenden',
      'Vertretungslehrer-Auswahl im Stundenplan vollständig überarbeitet',
      'Kursauswahl zeigt Stil-Zuordnung für bessere Übersicht',
    ],
    details: 'In der Nachrichtenzentrale steht jetzt ein eigener Tab „Kurs-Nachricht" bereit. Damit lassen sich gezielte Nachrichten an alle Teilnehmer eines bestimmten Kurses senden — direkt aus dem Benachrichtigungssystem ohne Umweg über den Stundenplan. Das Vertretungslehrer-Modal im Stundenplan wurde korrigiert: Originaltrainer und Vertretungslehrer werden nun korrekt aus der Trainerliste befüllt und vorausgewählt.',
    files: ['NotificationSystem.jsx', 'NotificationSystem.css', 'Stundenplan.jsx']
  },
  {
    version: '2.9.0',
    date: '2026-03-10',
    type: 'feature',
    title: 'Großes Feature-Update: 12 neue Module',
    highlights: [
      'Geburtstags- & Jubiläums-Erinnerungen für Admins und Trainer',
      'Kurs-Warteliste mit automatischer Nachrücker-Benachrichtigung',
      'Verletzungsprotokoll pro Mitglied mit Trainer-Sichtbarkeit',
      'Kurs-Auslastungsanzeige & Bulk-Nachricht an alle Kursteilnehmer',
      'Trainer-Stundennachweise & Monatsabrechnung',
      'Vertretungslehrer-System mit Push-Benachrichtigung',
      'Digitale Prüfungsbögen mit Einzelbewertungen pro Technik',
      'Automatische PDF-Prüfungszertifikate per E-Mail',
      'Eltern-Zugang für Kinder-Mitglieder (Lesezugriff)',
      'Turnierverwaltung & automatische HOF-Vorschläge',
      'Lernplattform: Technik-Videos und PDFs nach Graduierung',
      'Apple Wallet / Google Wallet QR-Pass für Mitglieder'
    ],
    details: 'Umfangreichstes Update seit Release. Geburtstage und Mitgliedschaftsjubiläen (1, 2, 3, 5, 10 Jahre) erscheinen automatisch in der Glocke. Volle Kurse zeigen Wartelisten-Funktion — bei Absage rückt der nächste automatisch nach. Das neue Verletzungsprotokoll warnt Trainer beim Check-in. Trainer können Stunden nach Kurs buchen und als Monatsabrechnung exportieren. Bei Ausfall schlägt das System qualifizierte Vertretungen vor. Prüfungen erhalten digitale Bögen mit Einzelbewertungen — bestandene Prüfungen generieren automatisch ein PDF-Zertifikat. Eltern erhalten Lesezugang für die Daten ihrer Kinder. Turnierergebnisse fließen in automatische HOF-Kandidaten-Vorschläge ein (dojo-übergreifend für Super-Admin). Eine Technik-Bibliothek mit Videos und PDFs ist nach Stil und Graduierung gefiltert. Der Mitglieds-QR-Code lässt sich als Wallet-Pass für Apple und Google Wallet exportieren — auch offline verfügbar.',
    files: [
      'cron-jobs.js', 'birthdayService.js', 'jubilaeumService.js',
      'Stundenplan.jsx', 'KursWarteliste.jsx', 'Verletzungsprotokoll.jsx',
      'TrainerStunden.jsx', 'Vertretungssystem.jsx',
      'PruefungsBogen.jsx', 'Zertifikat.jsx',
      'ElternPortal.jsx', 'TurnierVerwaltung.jsx',
      'Lernplattform.jsx', 'WalletPass.jsx'
    ]
  },
  {
    version: '2.8.1',
    date: '2026-03-10',
    type: 'feature',
    title: 'Chat-Überarbeitung & Verbesserungen',
    highlights: [
      'Gruppenchats mit Emoji-Avatar und Farbwahl',
      'Gruppeneinstellungen: Name, Avatar, Mitglieder verwalten',
      'Gruppe verlassen direkt im Chat',
      'Push-Vorlagen für Trainingsausfälle, Hallenänderung & mehr',
      'DojoSwitcher als zentriertes Modal mit Blur-Hintergrund',
      'SuperAdmin Chat-Zentrale mit eigenem Chat-Tab',
      'Sicherheit: Demo-Dojo aus Benachrichtigungen ausgeschlossen'
    ],
    details: 'Gruppenchats können jetzt mit einem individuellen Emoji-Avatar und Hintergrundfarbe erstellt werden. Gruppen-Owner und Admins können Einstellungen nachträglich ändern und Mitglieder verwalten. Für Push-Nachrichten gibt es 8 Schnellvorlagen für häufige Situationen im Dojoalltag. Der DojoSwitcher erscheint jetzt als elegantes zentriertes Modal. Der Super-Admin sieht in der Chat-Zentrale jetzt auch seinen eigenen Chat-Tab.',
    files: ['ChatNewRoom.jsx', 'ChatRoomList.jsx', 'ChatWindow.jsx', 'ChatRoomSettings.jsx', 'NotificationSystem.jsx', 'DojoSwitcher.jsx', 'SuperAdminDashboard.jsx', 'chat.js', 'Chat.css', 'DojoSwitcher.css']
  },
  {
    version: '2.8.0',
    date: '2026-03-02',
    type: 'feature',
    title: 'Integrierter Mitglieder-Chat',
    highlights: [
      'Echtzeit-Chat für alle Mitglieder',
      'Direktchats und Gruppenräume',
      'Emoji-Reaktionen auf Nachrichten',
      'In-App Benachrichtigungen bei neuen Nachrichten',
      'Ungelesen-Badge im Header',
      'Ankündigungs-Kanal für Admin-Nachrichten'
    ],
    details: 'Mitglieder können ab sofort direkt in der App miteinander chatten. Zu finden über das Chat-Icon im Header. Unterstützt werden Direktchats zwischen zwei Personen sowie Gruppenräume. Neue Nachrichten werden als Toast-Popup angezeigt und als Badge-Zahl im Header-Icon. Admins können Push-Nachrichten optional auch im Ankündigungs-Chat-Kanal veröffentlichen.',
    files: ['ChatPage.jsx', 'ChatRoomList.jsx', 'ChatWindow.jsx', 'ChatMessage.jsx', 'ChatNewRoom.jsx', 'ChatPopup.jsx', 'ChatContext.jsx', 'chat.js', 'chatSocket.js', 'MemberHeader.jsx', 'Chat.css']
  },
  {
    version: '2.7.0',
    date: '2026-02-17',
    type: 'feature',
    title: 'Freunde werben Freunde & Systemstabilität',
    highlights: [
      'Freunde werben Freunde - Empfehlungssystem',
      'Promo-Codes für Neuanmeldungen',
      'Prämien-Staffelung nach Vertragslaufzeit',
      'Automatische Wartungsmeldung bei Server-Ausfall',
      'Service Worker Auto-Update ohne Cache-Probleme'
    ],
    details: 'Neues Empfehlungssystem unter Buddy-Gruppen → Freunde werben. Mitglieder können Promo-Codes teilen und erhalten Prämien wenn geworbene Mitglieder Verträge abschließen. Außerdem: Bei Server-Wartung erscheint jetzt automatisch eine Hinweismeldung mit Countdown. Service Worker aktualisiert sich automatisch - kein manuelles Cache-Leeren mehr nötig.',
    files: ['FreundeWerbenFreunde.jsx', 'ApiHealthCheck.jsx', 'main.jsx', 'referral.js']
  },
  {
    version: '2.6.0',
    date: '2026-02-16',
    type: 'feature',
    title: 'Integriertes Hilfesystem',
    highlights: [
      'Neuer Hilfe-Tab im Dashboard',
      '15 Kategorien mit 30+ Artikeln',
      'Suchfunktion in der Hilfe',
      'Anleitungen zu allen Funktionsbereichen',
      'Tipps & Tricks für den Alltag'
    ],
    details: 'Umfangreiche Hilfe direkt in der Software. Zu finden unter dem neuen Tab "Hilfe" im Dashboard. Kategorien: Erste Schritte, Mitglieder, Check-In, Finanzen, Kurse, Events, Personal, Berichte, 10er-Karten, Buddy-System und mehr.',
    files: ['HilfeCenter.jsx', 'HilfeCenter.css', 'Dashboard.jsx']
  },
  {
    version: '2.5.0',
    date: '2026-01-28',
    type: 'feature',
    title: 'Integrationen & Kalender-Sync',
    highlights: [
      'Kalender-Synchronisation für Google, Outlook, Apple',
      'Webhook-System für Zapier & Automatisierungen',
      'PayPal Integration vorbereitet',
      'LexOffice Buchhaltungs-Anbindung',
      'DATEV Export für Steuerberater'
    ],
    details: 'Neue Integrations-Seite unter Einstellungen. Mitglieder können ihre Trainings direkt in ihren Kalender abonnieren.',
    files: ['KalenderAbo.jsx', 'WebhookVerwaltung.jsx', 'IntegrationsEinstellungen.jsx', 'DatevExport.jsx']
  },
  {
    version: '2.4.0',
    date: '2026-01-27',
    type: 'feature',
    title: 'Badge-System & Auszeichnungen',
    highlights: [
      'Badges für Mitglieder vergeben',
      'Automatische Badge-Vergabe (Anwesenheit, Jubiläum)',
      'Badge-Übersicht im Mitglieder-Profil',
      'Admin-Verwaltung für Badge-Typen'
    ],
    details: 'Motiviere deine Mitglieder mit Auszeichnungen! Unter Prüfungswesen → Auszeichnungen.',
    files: ['BadgeAdminOverview.jsx', 'MitgliedFortschritt.jsx']
  },
  {
    version: '2.3.0',
    date: '2026-01-26',
    type: 'feature',
    title: 'SEPA-Lastschrift System',
    highlights: [
      'SEPA-Mandate verwalten',
      'Lastschriftläufe erstellen',
      'SEPA-XML Export (PAIN.008)',
      'Rücklastschriften-Handling'
    ],
    details: 'Vollständiges SEPA-Lastschrift-Management unter Finanzen → Lastschriftlauf.',
    files: ['SepaMandateVerwaltung.jsx', 'LastschriftManagement.jsx']
  },
  {
    version: '2.2.0',
    date: '2026-01-25',
    type: 'feature',
    title: 'Prüfungswesen & Graduierungen',
    highlights: [
      'Prüfungstermine planen',
      'Live-Prüfungsansicht',
      'Graduierungen verwalten',
      'Prüfungsergebnisse dokumentieren'
    ],
    details: 'Komplettes Prüfungsmanagement unter Prüfungswesen → Prüfungen & Termine.',
    files: ['PruefungsVerwaltung.jsx', 'PruefungDurchfuehren.jsx', 'Stilverwaltung.jsx']
  },
  {
    version: '2.1.0',
    date: '2026-01-20',
    type: 'feature',
    title: 'Buddy-System & Freunde werben',
    highlights: [
      'Buddy-Gruppen erstellen',
      'Einladungslinks generieren',
      'Werber-Tracking',
      'Gruppen-Rabatte'
    ],
    details: 'Mitglieder können Freunde einladen unter Dashboard → Buddy-Gruppen.',
    files: ['BuddyVerwaltung.jsx', 'BuddyInviteRegistration.jsx']
  },
  {
    version: '2.0.0',
    date: '2026-01-15',
    type: 'major',
    title: 'Multi-Dojo & Steuer-Compliance',
    highlights: [
      'Multi-Dojo Unterstützung',
      'Dojo-Switcher im Header',
      'Steuerlich getrennte Buchhaltung',
      'Super-Admin Dashboard'
    ],
    details: 'Verwalte mehrere Dojos mit getrennter Buchhaltung aus einem Account.',
    files: ['DojoSwitcher.jsx', 'SuperAdminDashboard.jsx']
  },
  {
    version: '1.9.0',
    date: '2026-01-10',
    type: 'feature',
    title: 'Vertragsdokumente & AGB',
    highlights: [
      'AGB & Datenschutz verwalten',
      'Versionierung von Dokumenten',
      'Digitale Zustimmung',
      'DSGVO-konform'
    ],
    details: 'Unter Berichte → Vertragsdokumente können alle rechtlichen Dokumente verwaltet werden.',
    files: ['DokumenteVerwaltung.jsx', 'AgbConfirmationWrapper.jsx']
  },
  {
    version: '1.8.0',
    date: '2026-01-05',
    type: 'improvement',
    title: 'Finanzcockpit & Auswertungen',
    highlights: [
      'Finanz-Dashboard mit Grafiken',
      'Umsatz-Statistiken',
      'Zahlungsübersicht',
      'Mahnwesen-Integration'
    ],
    details: 'Umfassende Finanzübersicht unter Finanzen → Finanzcockpit.',
    files: ['Finanzcockpit.jsx', 'Auswertungen.jsx']
  }
];

// ============================================================================
// AKTUELLE VERSION - Wird automatisch aus dem ersten Changelog-Eintrag geholt
// ============================================================================
export const CURRENT_VERSION = CHANGELOG[0].version;
export const CURRENT_BUILD_DATE = CHANGELOG[0].date;

// Icon basierend auf Typ
const getTypeIcon = (type) => {
  switch (type) {
    case 'feature': return <Sparkles size={18} />;
    case 'major': return <Star size={18} />;
    case 'security': return <Shield size={18} />;
    case 'bugfix': return <Bug size={18} />;
    case 'improvement': return <Zap size={18} />;
    default: return <Settings size={18} />;
  }
};

// Farbe basierend auf Typ
const getTypeColor = (type) => {
  switch (type) {
    case 'feature': return '#ffd700';
    case 'major': return '#f59e0b';
    case 'security': return '#ef4444';
    case 'bugfix': return '#10b981';
    case 'improvement': return '#3b82f6';
    default: return '#888';
  }
};

// Label basierend auf Typ
const getTypeLabel = (type) => {
  switch (type) {
    case 'feature': return 'Neue Funktion';
    case 'major': return 'Major Update';
    case 'security': return 'Sicherheit';
    case 'bugfix': return 'Bugfix';
    case 'improvement': return 'Verbesserung';
    default: return 'Update';
  }
};

const SystemChangelog = ({ maxItems = 5, showAll = false, isAdmin = false }) => {
  const [expandedItems, setExpandedItems] = useState({});
  const [showAllItems, setShowAllItems] = useState(showAll);

  const toggleExpand = (version) => {
    setExpandedItems(prev => ({
      ...prev,
      [version]: !prev[version]
    }));
  };

  // Interne (technische) Einträge nur für Super-Admin; Dojo-Admins sehen sie nicht
  const isSuperAdmin = istSuperAdminScope();
  const sichtbaresChangelog = CHANGELOG.filter(e => isSuperAdmin || e.zielgruppe !== 'intern');
  const displayedChangelog = showAllItems ? sichtbaresChangelog : sichtbaresChangelog.slice(0, maxItems);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Sparkles size={24} color="#ffd700" />
        <div>
          <h3 style={styles.title}>Neuigkeiten & Updates</h3>
          <p style={styles.subtitle}>Aktuelle Änderungen im System</p>
        </div>
      </div>

      <div style={styles.changelogList}>
        {displayedChangelog.map((entry, index) => (
          <div
            key={entry.version}
            style={{
              ...styles.changelogItem,
              '--type-color': getTypeColor(entry.type),
              borderLeft: '3px solid var(--type-color)'
            }}
          >
            <div style={styles.itemHeader} onClick={() => toggleExpand(entry.version)}>
              <div style={styles.itemMeta}>
                <span style={{
                  ...styles.typeBadge,
                  '--type-color': getTypeColor(entry.type),
                  background: 'color-mix(in srgb, var(--type-color) 13%, transparent)',
                  color: 'var(--type-color)'
                }}>
                  {getTypeIcon(entry.type)}
                  {getTypeLabel(entry.type)}
                </span>
                <span style={styles.version}>v{entry.version}</span>
                <span style={styles.date}>
                  <Calendar size={12} />
                  {new Date(entry.date).toLocaleDateString('de-DE')}
                </span>
              </div>
              <div style={styles.itemTitleRow}>
                <h4 style={styles.itemTitle}>{entry.title}</h4>
                {expandedItems[entry.version] ?
                  <ChevronUp size={18} color="#888" /> :
                  <ChevronDown size={18} color="#888" />
                }
              </div>
            </div>

            {/* Highlights immer sichtbar */}
            <ul style={styles.highlights}>
              {(entry.highlights || []).map((highlight, i) => (
                <li key={i} style={styles.highlight}>
                  <span style={styles.bulletPoint}>•</span>
                  {highlight}
                </li>
              ))}
            </ul>

            {/* Details nur wenn expandiert */}
            {expandedItems[entry.version] && (
              <div style={styles.expandedContent}>
                {entry.details && (
                  <p style={styles.details}>{entry.details}</p>
                )}
                {isAdmin && entry.files && entry.files.length > 0 && (
                  <div style={styles.filesSection}>
                    <span style={styles.filesLabel}>Betroffene Dateien:</span>
                    <div style={styles.filesList}>
                      {entry.files.map((file, i) => (
                        <code key={i} style={styles.fileTag}>{file}</code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {!showAllItems && CHANGELOG.length > maxItems && (
        <button
          style={styles.showMoreButton}
          onClick={() => setShowAllItems(true)}
        >
          Alle {CHANGELOG.length} Updates anzeigen
          <ChevronDown size={16} />
        </button>
      )}

      {showAllItems && CHANGELOG.length > maxItems && (
        <button
          style={styles.showMoreButton}
          onClick={() => setShowAllItems(false)}
        >
          Weniger anzeigen
          <ChevronUp size={16} />
        </button>
      )}
    </div>
  );
};

const styles = {
  container: {
    background: 'var(--glass-bg, rgba(255, 255, 255, 0.05))',
    borderRadius: '16px',
    padding: '1.5rem',
    border: '1px solid var(--border-accent, rgba(255, 215, 0, 0.2))'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '1.5rem'
  },
  title: {
    color: 'var(--primary, #ffd700)',
    margin: 0,
    fontSize: '1.1rem'
  },
  subtitle: {
    color: 'var(--text-secondary, #888)',
    margin: '4px 0 0 0',
    fontSize: '0.85rem'
  },
  changelogList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  changelogItem: {
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '12px',
    padding: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  itemHeader: {
    marginBottom: '12px'
  },
  itemMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
    flexWrap: 'wrap'
  },
  typeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '600'
  },
  version: {
    color: 'var(--text-secondary, #888)',
    fontSize: '0.8rem',
    fontFamily: 'monospace'
  },
  date: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: 'var(--text-secondary, #888)',
    fontSize: '0.8rem'
  },
  itemTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  itemTitle: {
    color: 'var(--text-primary, #fff)',
    margin: 0,
    fontSize: '1rem',
    fontWeight: '600'
  },
  highlights: {
    margin: 0,
    padding: 0,
    listStyle: 'none'
  },
  highlight: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    color: 'var(--text-secondary, #aaa)',
    fontSize: '0.85rem',
    marginBottom: '4px'
  },
  bulletPoint: {
    color: 'var(--primary, #ffd700)',
    fontWeight: 'bold'
  },
  expandedContent: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)'
  },
  details: {
    color: 'var(--text-secondary, #aaa)',
    fontSize: '0.85rem',
    margin: '0 0 12px 0',
    lineHeight: 1.5
  },
  filesSection: {
    marginTop: '8px'
  },
  filesLabel: {
    color: 'var(--text-secondary, #666)',
    fontSize: '0.75rem',
    display: 'block',
    marginBottom: '6px'
  },
  filesList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px'
  },
  fileTag: {
    background: 'rgba(59, 130, 246, 0.2)',
    color: 'var(--color-info-400)',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.7rem'
  },
  showMoreButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    marginTop: '16px',
    padding: '12px',
    background: 'rgba(255, 215, 0, 0.1)',
    border: '1px solid rgba(255, 215, 0, 0.3)',
    borderRadius: '8px',
    color: 'var(--primary, #ffd700)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: 'all 0.2s'
  }
};

export default SystemChangelog;
