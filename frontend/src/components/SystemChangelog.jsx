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
