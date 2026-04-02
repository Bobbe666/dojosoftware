// ============================================================================
// SYSTEM CHANGELOG
// Frontend/src/components/SystemChangelog.jsx
// Zeigt wichtige System-Updates und Änderungen an
// ============================================================================

import React, { useState } from 'react';
import {
  Sparkles, Calendar, Zap, Shield, CreditCard, Users,
  Settings, Bug, Star, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';

// ============================================================================
// CHANGELOG DATEN - Hier neue Einträge hinzufügen!
// Der ERSTE Eintrag ist immer die AKTUELLE VERSION!
// ============================================================================
export const CHANGELOG = [
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

  const displayedChangelog = showAllItems ? CHANGELOG : CHANGELOG.slice(0, maxItems);

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
