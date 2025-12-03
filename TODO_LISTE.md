# 📋 DojoSoftware - Strukturierte TODO-Liste

📅 **Stand:** 30. November 2025

---

## ✅ BEREITS ERLEDIGT

### Infrastruktur & Basis
- ✅ Server eingerichtet (Debian 12, SSH, Firewall)
- ✅ MariaDB installiert und konfiguriert
- ✅ Backend deployed und läuft (PM2)
- ✅ Frontend deployed mit nginx + HTTPS
- ✅ Domain `dojo.tda-intl.org` aktiv
- ✅ Git Repository eingerichtet
- ✅ `.gitignore` und `.env.example` erstellt
- ✅ Alte Backups komprimiert (97 MB gespart)
- ✅ Datenbank auf 30 Tabellen erweitert

### Features (Kürzlich)
- ✅ **Vertragsfrei-Feature** (30.11.2025)
  - Checkbox im Vertrag-Tab
  - Grund-Eingabe (Ehrenmitglied, Familie, Sponsor)
  - DB-Spalten hinzugefügt
- ✅ **Mock-Daten System** für Development
- ✅ **API-Pfad Bugfixes** (30+ Komponenten)

### Design & UI
- ✅ Dashboard Animationen (fadeIn, fadeInUp, shimmer, spin)
- ✅ Glassmorphismus-Effekte
- ✅ Goldene Farbschema-Integration
- ✅ Zentrale CSS-Definitionen in `designsystem.css`
- ✅ Hover-Effekte und Tooltips

### Datenbank
- ✅ Tabellen: `vertraege`, `transaktionen`, `dokumente`, `nachrichten`
- ✅ Tabellen: `ereignisse`, `termine`, `termin_teilnehmer`, `inventar`
- ✅ Mitglieder-Tabelle erweitert (notizen, letzter_login, newsletter_abo, etc.)
- ✅ Charset auf utf8mb4_unicode_ci gesetzt

---

## 🔥 KRITISCHE PRIORITÄT (Muss gemacht werden)

### 1. Rechtliches & DSGVO (PFLICHT!)

#### AGB & Datenschutz
- [ ] AGB-Upload/Editor in `DojoEdit.jsx` implementieren
- [ ] Datenschutzerklärung hochladen/bearbeiten
- [ ] Version-Tracking für AGB/Datenschutz
- [ ] Automatische Benachrichtigung bei Änderungen an AGB
- [ ] Akzeptanz-Checkboxen bei Vertragserstellung
- [ ] Datenschutzbeauftragten in Einstellungen erfassen

#### SEPA & Verträge
- [ ] **SEPA-Mandat MUSS für Verträge vorhanden sein** (Pflichtfeld)
- [ ] Mandatsreferenz im Vertrag anzeigen
- [ ] IBAN-Prüfung implementieren
- [ ] SEPA-Daten automatisch bei Lastschrift erfassen

#### Kündigungen & Vertragsbedingungen
- [ ] Kündigungsfrist in Einstellungen erfassen
- [ ] Mindestlaufzeit in Einstellungen
- [ ] Automatische Vertragsverlängerung konfigurierbar
- [ ] Kündigungsbestätigung automatisch generieren
- [ ] Gekündigte Verträge ins Archiv verschieben
- [ ] Kündigungen archivieren (nicht löschen!)

#### Dokumentenverwaltung
- [ ] Uploads für AGB, Datenschutzerklärung, Formulare
- [ ] Standardformulare & Vorlagen erstellen
- [ ] Dokumente pro Dojo getrennt verwalten
- [ ] DSGVO-konforme Einverständniserklärungen
- [ ] Dokumenten-Archiv pro Mitglied

---

## 🚀 HOHE PRIORITÄT (Geschäftlich wichtig)

### 2. Vertragssystem vervollständigen

#### Vertragserstellung
- [ ] Vertragsnummer automatisch generieren
- [ ] Vertragsende automatisch berechnen
- [ ] Unterschriftenfeld einbauen
- [ ] Leistungsumfang definieren
- [ ] Startpaket erfassen
- [ ] Rabatt-System implementieren
- [ ] Familien-Verträge ermöglichen

#### Vertrags-PDFs
- [ ] Neue Komponente `VertragsPDFGenerator.jsx` erstellen
- [ ] Vollständiger Vertragstext als PDF
- [ ] Alle Anhänge (AGB, Datenschutz, etc.) einbinden
- [ ] Unterschriften im PDF
- [ ] Vertrag per E-Mail an Mitglied versenden
- [ ] Vertrag bei Dokumente hinterlegen

#### Vertragsmanagement
- [ ] Änderungsprotokoll / Historie
- [ ] Pausenverwaltung (Ruhepausen)
- [ ] Progressbar bei Vertragserstellung optimieren
- [ ] Abbrechen-Button verbessern

### 3. Finanzen & Automatisierung

#### Automatisiertes Billing
- [ ] **Automatische SEPA-Lastschrift** implementieren
- [ ] Automatisches Verbuchen von Rücklastschriften
- [ ] Erneutes Abbuchen bei Rücklastschrift
- [ ] Bei 2. fehlgeschlagener Abbuchung: Nachricht an Admin (Inkasso)
- [ ] Buchungsnummer mit Dojo-Zuweisung einbauen
- [ ] Payment Retry & Reminder-System

#### Mahnwesen
- [ ] Automatisierte Mahnungen mit konfigurierbaren Regeln
- [ ] Zahlungserinnerungen
- [ ] Mahnlauf-Details ausbauen
- [ ] Mahnungen als PDF

#### Rechnungen
- [ ] Rechnungs-PDF generieren
- [ ] Rechnungslauf implementieren
- [ ] Offene Beiträge anzeigen mit Filtern
- [ ] Bei Klick auf "Beiträge" in Finanzen → Offene Beiträge zeigen

#### Kassensystem
- [ ] Kassenbuch anlegen
- [ ] Barverkauf / e-Cashpoint (Kassensystem oben im Dashboard)
- [ ] Kartenzahlung SumUp integrieren
- [ ] PayPal-Integration

#### Zahlungsmethoden
- [ ] Zahlungsmethoden als Admin ändern/erfassen
- [ ] Jahresvorauszahlung mit Rabatt
- [ ] Prozente bei Jahresvorauszahlung anbieten

#### Finanzanalyse
- [ ] Beiträge im Profil monatlich einklappbar
- [ ] Verschiedene Ansichten (Monat, Quartal)
- [ ] Mehr Auswertungen für Beiträge/Zahlungen
- [ ] Beitragshöhe, Kündigungen analysieren
- [ ] Umsatz pro Monat/Quartal
- [ ] Breakeven-Analyse

### 4. Multi-Dojo Verwaltung

- [ ] **Dojo Switcher im Finanzcockpit funktioniert noch nicht** ⚠️
- [ ] Einstellungen für mehrere Dojos (Haupt-/Zweitdojo)
- [ ] Logo pro Dojo hochladen
- [ ] Dokumente: Option für beide Dojos ODER pro Dojo einzeln
- [ ] Bei Neuanlage: Dojo-Zuweisung wenn "Alle" ausgewählt
- [ ] Neuanlegen auf Dojo verweisen (wenn voll → anderes Dojo)
- [ ] Verkauf mit Multi-Dojo berücksichtigen
- [ ] 2. Dojo nur gegen Aufpreis

---

## 📱 MITTLERE PRIORITÄT (Komfort & Funktionalität)

### 5. Mitgliederverwaltung

#### Registrierung & Zugang
- [ ] Bei Registrierung nach Passwort fragen
- [ ] Passwort vergessen / Reset im Login einbauen
- [ ] Passwort ändern im Profil unter Sicherheit
- [ ] Sicherheitsfragen einbauen
- [ ] Login-Daten ins Profil einbauen

#### Benachrichtigungen & Kommunikation
- [ ] **Wenn Mitglied Daten ändert → Push-Nachricht an Admin** ⚠️
- [ ] Wenn Fortschritte erfasst werden → Push an Mitglied
- [ ] Wenn was für Mitglied angelegt wurde → Push
- [ ] Geburtstags-Glückwünsche beim Login
- [ ] Bei Geburtstag + Anwesenheit → Nachricht an Trainer
- [ ] Benachrichtigungen wieder einbauen
- [ ] Neueste Benachrichtigung als Pop-up beim Login
- [ ] Benachrichtigungszentrum im Profil

#### Profil & Dokumente
- [ ] Dokumente hochladen zur Person (Schülerausweis, etc.)
- [ ] Auszeichnungen und Trainerscheine aufnehmen
- [ ] Tabs im Profil überarbeiten (evtl. mehr Tabs)
- [ ] Stil-Übersicht: Bei allen aktuellen Gürteln oben anzeigen
- [ ] Zurück-Buttons fehlen oft noch

#### Family Management
- [ ] Familienrabatt einrichten
- [ ] Familienmitglieder zuordnen (Wer gehört dazu?)
- [ ] Familien-Verträge
- [ ] Gemeinsame Zahlungen für Familien

### 6. Anwesenheit & Check-in

#### Probleme beheben
- [ ] **Anwesenheit auch wenn kein Vertrag da ist** ⚠️
- [ ] Doppelte Check-ins verhindern
- [ ] Filter nach Stil korrigieren (Logik passt nicht)
- [ ] Check-in Admin überprüfen
- [ ] Check-in im Memberbereich überprüfen (2x einchecken möglich)
- [ ] Anzahl bei Anwesenheit checken (Admin vs. Member)
- [ ] Wenn aus Member und Admin ausgecheckt → auch aus Statistik
- [ ] Stil und Gurt funktioniert noch nicht

#### Check-in System
- [ ] Verkauf über Check-in: Automatisch Person anzeigen
- [ ] Bei Verkauf: Automatische Zuordnung zu Anwesenheit
- [ ] Gast einchecken erstellen
- [ ] QR-Code Check-in (Mobile)

### 7. Trainer & Personal

- [ ] **Festlegen: Trainer haben keinen Vertrag, aber überall eingebaut** ⚠️
- [ ] Trainerlogin für Anwesenheit
- [ ] Trainerbewertung (wie bei Kursen)
- [ ] Zugangsberechtigungen: Admin, Trainer, Tresen
- [ ] Trainer-App (Mobile)

### 8. Kurse & Stundenplan

#### Kurse
- [ ] Kurse nach Gurt und Alter filtern
- [ ] Filter im Stundenplan (nicht bei Stilen!)
- [ ] Kursräume hinzufügen und verwalten
- [ ] Schriftgröße und Farben in Cards anpassen

#### Stundenplan
- [ ] Akkordeon mit "Alles aufklappen"
- [ ] Löschen funktioniert noch nicht
- [ ] Bearbeiten macht noch keinen Sinn
- [ ] Logo als Wasserzeichen im Hintergrund
- [ ] Responsive Layout verbessern

---

## 🎯 NIEDRIGE PRIORITÄT (Verbesserungen)

### 9. Prüfungswesen

#### Prüfungsplanung
- [ ] "Neue Prüfung planen" bei Profil entfernen (nur über Prüfungstool)
- [ ] Prüfungsliste als PDF erstellen
- [ ] 2. Bildschirm für Prüfungsergebnisse
- [ ] Ergebnis-Modal überarbeiten
- [ ] Ergebnis für gesamte Prüfung eintragen (nicht nur einzeln)
- [ ] Prüfungskandidaten zulassen entfernen

#### Prüfungsinhalte
- [ ] Prüfungsinhalte als PDF generieren (aus Stilen)
- [ ] Einstellungen fürs Prüfungsmodal (sauberer Anzug, etc.)
- [ ] Prüfungsteilnahmebedingungen in Einstellungen
- [ ] Formular/Unterschrift für Prüfungsteilnahme

#### Punkte & Statistik
- [ ] Punkte bei Prüfungen vergeben
- [ ] Punkte in Stil-Statistik einbauen
- [ ] Prüfungs-Punkte in Statistik übernehmen
- [ ] Schülerverteilung von Stil-Statistiken in Prüfung einbauen
- [ ] Hochstufen auch in Stil-Statistik

#### Gurt-System
- [ ] Gurt-Buttons optisch verbessern
- [ ] Gurt höher/niedriger: Nur grau wenn nicht im Bearbeitungsmodus
- [ ] Buttons funktionieren noch nicht
- [ ] Beim Klick auf Gurt → Mitglieder als Dropdown anzeigen
- [ ] Graduierungen: Wo werden sie angelegt?

### 10. Statistiken & Fortschritt

- [ ] Trainingsstunden pro Monat unterschiedlich hoch (nach Wert)
- [ ] Trainingsstunden per Hand erhöhen
- [ ] Statistikkarten zentral mit gleichen Werten
- [ ] Skills und Techniken mit Badges (wenn Ziel erreicht)
- [ ] Übersicht für Admin zum Auszeichnen
- [ ] Per E-Mail benachrichtigen bei Skills

### 11. Design & UX

#### Login
- [ ] Tiger & Dragon in Kanji ganz oben einfügen
- [ ] Logo größer
- [ ] Schrift besser lesbar
- [ ] Testaccount ändern

#### Dashboard
- [ ] Statusleiste kleiner
- [ ] Aktivitäten: Schrift zu dunkel
- [ ] Neu-Button nach oben rechts + verkleinern

#### Allgemein
- [ ] Alle Modale prüfen und zentrale Designs anlegen
- [ ] Zurück-Buttons überall prüfen (Banken-Style mit Hover)
- [ ] Buttons alle gleich gestalten (bereits zentralisiert, nur prüfen)
- [ ] Responsive Design optimieren
- [ ] Symbole: Gelb weg, richtig darstellen
- [ ] Zentrale CSS für Überschriften checken
- [ ] CSS auslagern wenn noch vorhanden

### 12. Artikelverwaltung

- [ ] Sortierung nach Gruppen in Überschrift

### 13. Sonstiges

- [ ] Buddy-Karten (Freunde-Mitgliedschaftskarten) checken
- [ ] Newsletter-System (evtl. gegen Aufpreis)
- [ ] Newsletter Creator mit Vorlagen
- [ ] E-Mail-Implementierung
- [ ] Spond einbauen?
- [ ] Umlaute-Handling prüfen
- [ ] Wenn Betrag voll → Bei mir anlegen

---

## 🌟 OPTIONAL / ZUKUNFT

### 14. Mobile Apps

- [ ] **Mitglieder-App** (Kursbuchung, Statistik, Zahlungen)
- [ ] **Trainer-App** (Anwesenheit, Feedback, Prüfungsplanung)
- [ ] Mobile Check-in (QR-Code)
- [ ] Mobile Anamnese

### 15. Gamification & Motivation

- [ ] Trainingsstreak Counter
- [ ] Monatliche/Quartalsziele
- [ ] Achievement-Badges
- [ ] Trainingskalender (visuelle Tage)
- [ ] Wöchentliche Zusammenfassung
- [ ] Trainingszeiten-Analyse
- [ ] Kurs-Präferenzen
- [ ] Vergleich mit anderen (anonymisiert)
- [ ] Punkte-System
- [ ] Level-System
- [ ] Ranglisten (optional)
- [ ] Tägliche Challenges
- [ ] Belohnungen (Rabatte/Prämien)

### 16. Erweiterte Features

#### CRM & Leads
- [ ] Lead-Management (Interessenten)
- [ ] Probestunden-Verwaltung
- [ ] Follow-Up Automatisierung
- [ ] Conversion-Tracking

#### Events & Veranstaltungen
- [ ] Veranstaltungsübersicht
- [ ] Sync zur Turniersoftware
- [ ] Im Member-Dashboard anzeigen

#### Integrationen
- [ ] Stripe/PayPal
- [ ] DATEV/Lexoffice
- [ ] Google/Outlook Kalender-Sync
- [ ] Zapier & Webhooks

### 17. Backup & Wartung

- [ ] Datensicherung: Manuell + Automatisch
- [ ] Backup & Restore testen
- [ ] Ziele für Admin (z.B. 200 Mitglieder Ziel, Wachstumsanalyse)

### 18. Dokumentation & Testing

- [ ] Doku: Welche Funktionen auf welcher Seite + Dateien
- [ ] Kompletten Testlauf für Mitglied erstellen
- [ ] Code-Refactoring
- [ ] Alle IDs in Tabellen sauber aufstellen
- [ ] Final Review .env und .gitignore

---

## 🔗 PARALLEL-SYSTEME

### Turniersoftware
- [ ] Sortierung nach Alter
- [ ] Sortierung nach Gruppen
- [ ] Sortierung nach Stilen
- [ ] Sortierung Frei
- [ ] Sortierung nach Gürtel
- [ ] Sortierung nach Stufen (Advanced, etc.)
- [ ] Integration mit Dojo-Software (Teilnehmer, Events)

### Hall-of-Fame Software
- [ ] Automatische Präsentation auf Basis Nominierter
- [ ] Sync mit Dojo-System (Veranstaltungsdaten)

---

## 🎯 EMPFOHLENE ARBEITSREIHENFOLGE

### SOFORT (Kritisch)
1. AGB & Datenschutz (DSGVO-Pflicht!)
2. SEPA-Mandat Pflichtfeld
3. Kündigungsbedingungen
4. Vertragsfrei-Feature testen (wurde gerade deployed)

### DIESE WOCHE
5. Vertrags-PDF Generator
6. Automatisiertes Billing (SEPA-Lastschrift)
7. Dojo Switcher im Finanzcockpit fixen

### NÄCHSTE 2 WOCHEN
8. Mahnwesen
9. Anwesenheit ohne Vertrag ermöglichen
10. Multi-Dojo Verwaltung vervollständigen

### NÄCHSTER MONAT
11. Check-in Probleme beheben
12. Prüfungswesen vervollständigen
13. Mobile Apps planen

---

## ⚠️ BEKANNTE PROBLEME (PRIORITÄR FIXEN!)

1. ❌ **Dojo Switcher im Finanzcockpit funktioniert nicht**
2. ❌ **Wenn Mitglied Daten ändert → keine Push-Nachricht an Admin**
3. ❌ **Anwesenheit funktioniert nicht ohne Vertrag**
4. ❌ **Trainer haben keinen Vertrag, aber System erwartet einen**
5. ❌ **Doppelte Check-ins möglich**
6. ❌ **Filter nach Stil bei Anwesenheit funktioniert nicht**

---

## 📊 FORTSCHRITT

**Gesamt:** ~200 Aufgaben
**Erledigt:** ~50 (25%)
**Kritisch offen:** ~30 (15%)
**Optional:** ~120 (60%)

**Nächstes Milestone:** DSGVO-Konformität + Vertrags-PDF (Woche 1-2)
