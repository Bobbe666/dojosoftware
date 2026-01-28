# Dojo Software - Funktionen & Seiten Dokumentation

**Version:** 2.5.0
**Stand:** 28.01.2026

---

## Übersicht Navigationsstruktur

### Admin Dashboard (`/dashboard`)

| Tab | Beschreibung |
|-----|-------------|
| Check-in | Schneller Mitglieder-Check-in |
| Navigation | Alle Admin-Bereiche |
| Statistiken | KPIs und Schnellaktionen |
| Info | System-Status, Changelog, Einstellungen |

### Mitglieder Dashboard (`/member`)

| Bereich | Beschreibung |
|---------|-------------|
| Mein Profil | Persönliche Daten, Vertrag, Ausrüstung |
| Trainingsübersicht | Anwesenheit, Fortschritt |
| Kalender-Sync | iCal-Abonnement für Trainings |

---

## Funktionen nach Kategorie

### 1. Mitgliederverwaltung

| Funktion | Route | Datei(en) |
|----------|-------|-----------|
| Mitglieder-Liste | `/dashboard/mitglieder` | `MitgliederListe.jsx` |
| Mitglied anlegen | `/dashboard/mitglied/neu` | `MitgliedForm.jsx`, `MitgliedFormPages/*.jsx` |
| Mitglied bearbeiten | `/dashboard/mitglied/:id` | `MitgliedForm.jsx` |
| Mitglieder-Profil | `/dashboard/mitglied/:id/profil` | `MitgliedFortschritt.jsx` |
| Kontaktpersonen | `/dashboard/kontaktpersonen` | `Kontaktpersonen.jsx` |
| Buddy-System | `/dashboard/buddy-verwaltung` | `BuddyVerwaltung.jsx` |
| Buddy-Einladung | `/register/buddy/:token` | `BuddyInviteRegistration.jsx` |

**Backend:** `routes/mitglieder.js`, `routes/buddy.js`

---

### 2. Kurse & Training

| Funktion | Route | Datei(en) |
|----------|-------|-----------|
| Kursliste | `/dashboard/kurse` | `Kursliste.jsx` |
| Kurs erstellen/bearbeiten | `/dashboard/kurs/neu`, `/kurs/:id` | `KursBearbeiten.jsx` |
| Stundenplan | `/dashboard/stundenplan` | `Stundenplan.jsx` |
| Anwesenheitsliste | `/dashboard/anwesenheit` | `AnwesenheitsListe.jsx` |
| Check-in QR | `/dashboard/checkin/:id?` | `CheckIn.jsx` |

**Backend:** `routes/kurse.js`, `routes/anwesenheit.js`

---

### 3. Prüfungswesen & Graduierungen

| Funktion | Route | Datei(en) |
|----------|-------|-----------|
| Prüfungstermine | `/dashboard/pruefungen` | `PruefungsVerwaltung.jsx` |
| Prüfung durchführen | `/dashboard/pruefung/:id` | `PruefungDurchfuehren.jsx` |
| Graduierungen | `/dashboard/graduierungen` | `GraduierungsVerwaltung.jsx` |
| Stilverwaltung | `/dashboard/stile` | `Stilverwaltung.jsx` |
| Badge-System | `/dashboard/badge-admin` | `BadgeAdminOverview.jsx` |

**Backend:** `routes/pruefungen.js`, `routes/graduierungen.js`, `routes/stile.js`, `routes/badges.js`

---

### 4. Finanzen & Abrechnung

| Funktion | Route | Datei(en) |
|----------|-------|-----------|
| Finanzcockpit | `/dashboard/finanzcockpit` | `Finanzcockpit.jsx` |
| Rechnungen | `/dashboard/rechnungen` | `RechnungsVerwaltung.jsx` |
| Tarife | `/dashboard/tarife` | `TarifVerwaltung.jsx` |
| Zahlungszyklen | `/dashboard/zahlungszyklen` | `ZahlungszyklusVerwaltung.jsx` |
| Offene Posten | `/dashboard/offene-posten` | `OffenePosten.jsx` |
| Mahnwesen | `/dashboard/mahnwesen` | `Mahnwesen.jsx` |
| SEPA-Mandate | `/dashboard/sepa-mandate` | `SepaMandateVerwaltung.jsx` |
| Lastschriftlauf | `/dashboard/lastschriftlauf` | `LastschriftManagement.jsx` |
| DATEV Export | `/dashboard/datev-export` | `DatevExport.jsx` |
| Auswertungen | `/dashboard/auswertungen` | `Auswertungen.jsx` |

**Backend:** `routes/rechnungen.js`, `routes/tarife.js`, `routes/sepa-mandate.js`, `routes/lastschriftlauf.js`, `routes/datev-export.js`

---

### 5. Verträge & Dokumente

| Funktion | Route | Datei(en) |
|----------|-------|-----------|
| Vertragsübersicht | `/dashboard/vertraege` | `VertragsVerwaltung.jsx` |
| Vertrag erstellen | Im Mitglied-Formular | `MitgliedFormPages/VertragSeite.jsx` |
| AGB & Datenschutz | `/dashboard/vertragsdokumente` | `DokumenteVerwaltung.jsx` |
| AGB-Zustimmung (Mitglied) | Automatisch bei Login | `AgbConfirmationWrapper.jsx` |
| Vertrags-PDF | API-Download | `utils/vertragsPdfGenerator.js` |

**Backend:** `routes/vertraege.js`, `routes/dokumente.js`

---

### 6. Personal & Trainer

| Funktion | Route | Datei(en) |
|----------|-------|-----------|
| Personal-Liste | `/dashboard/personal` | `PersonalVerwaltung.jsx` |
| Trainer-Zuweisung | Im Personal-Detail | `PersonalVerwaltung.jsx` |
| Arbeitszeiterfassung | `/dashboard/arbeitszeiten` | `ArbeitszeitErfassung.jsx` |

**Backend:** `routes/personal.js`, `routes/arbeitszeiten.js`

---

### 7. Integrationen & Automatisierung

| Funktion | Route | Datei(en) |
|----------|-------|-----------|
| Kalender-Sync (Admin) | `/dashboard/kalender-sync` | `KalenderAbo.jsx` |
| Kalender-Sync (Mitglied) | `/member/kalender` | `KalenderAbo.jsx` |
| Webhooks & Zapier | `/dashboard/webhooks` | `WebhookVerwaltung.jsx` |
| Integrationen (PayPal, LexOffice) | `/dashboard/integrationen` | `IntegrationsEinstellungen.jsx` |

**Backend:** `routes/ical.js`, `routes/webhooks.js`, `routes/integrations.js`

---

### 8. Einstellungen & System

| Funktion | Route | Datei(en) |
|----------|-------|-----------|
| Dojo-Einstellungen | `/dashboard/einstellungen` | `DojoEinstellungen.jsx` |
| Standorte | `/dashboard/standorte` | `StandortVerwaltung.jsx` |
| Benutzer-Verwaltung | `/dashboard/benutzer` | `BenutzerVerwaltung.jsx` |
| Audit-Log | `/dashboard/audit-log` | `AuditLog.jsx` |
| E-Mail Templates | `/dashboard/email-templates` | `EmailTemplates.jsx` |
| Super-Admin Dashboard | `/super-admin` | `SuperAdminDashboard.jsx` |

**Backend:** `routes/einstellungen.js`, `routes/benutzer.js`, `routes/audit.js`

---

### 9. Multi-Dojo & Steuertrennung

| Funktion | Komponente | Beschreibung |
|----------|------------|--------------|
| Dojo-Switcher | `DojoSwitcher.jsx` | Wechsel zwischen Dojos |
| Standort-Switcher | `StandortSwitcher.jsx` | Wechsel zwischen Standorten |
| Dojo-Context | `DojoContext.jsx` | Globaler Dojo-Filter für alle API-Calls |

**Backend:** `routes/dojo.js`, `middleware/dojoFilter.js`

---

## Backend API Struktur

### Haupt-Routes (`/backend/routes/`)

| Datei | Endpunkt | Beschreibung |
|-------|----------|--------------|
| `mitglieder.js` | `/api/mitglieder` | Mitgliederverwaltung |
| `kurse.js` | `/api/kurse` | Kursverwaltung |
| `anwesenheit.js` | `/api/anwesenheit` | Check-in/Anwesenheit |
| `rechnungen.js` | `/api/rechnungen` | Rechnungen & Zahlungen |
| `tarife.js` | `/api/tarife` | Tarifverwaltung |
| `sepa-mandate.js` | `/api/sepa-mandate` | SEPA-Mandate |
| `lastschriftlauf.js` | `/api/lastschriftlauf` | Lastschriften |
| `pruefungen.js` | `/api/pruefungen` | Prüfungen |
| `graduierungen.js` | `/api/graduierungen` | Graduierungen |
| `stile.js` | `/api/stile` | Kampfkunst-Stile |
| `badges.js` | `/api/badges` | Badge-System |
| `vertraege.js` | `/api/vertraege` | Verträge |
| `dokumente.js` | `/api/dokumente` | AGB/Datenschutz |
| `personal.js` | `/api/personal` | Personal |
| `buddy.js` | `/api/buddy` | Buddy-System |
| `ical.js` | `/api/ical` | Kalender-Export |
| `webhooks.js` | `/api/webhooks` | Webhook-System |
| `integrations.js` | `/api/integrations` | PayPal/LexOffice |
| `datev-export.js` | `/api/datev` | DATEV-Export |

---

## Datenbank-Struktur (Wichtigste Tabellen)

| Tabelle | Beschreibung |
|---------|--------------|
| `mitglieder` | Alle Mitgliederdaten |
| `vertraege` | Verträge mit Laufzeiten |
| `kurse` | Kursdefinitionen |
| `stundenplan` | Wöchentlicher Stundenplan |
| `anwesenheit` | Check-in Records |
| `rechnungen` | Rechnungen |
| `zahlungen` | Zahlungseingänge |
| `sepa_mandate` | SEPA-Mandate |
| `lastschriftlaeufe` | Lastschrift-Batches |
| `lastschrift_positionen` | Einzelne Lastschriften |
| `pruefungen` | Prüfungstermine |
| `graduierungen` | Erreichte Graduierungen |
| `stile` | Kampfkunst-Stile |
| `guertel` | Gürtel/Ränge pro Stil |
| `badges` | Badge-Definitionen |
| `mitglieder_badges` | Vergebene Badges |
| `buddy_gruppen` | Buddy-Gruppen |
| `dokumente` | AGB/Datenschutz-Versionen |
| `dojo` | Multi-Dojo Daten |
| `standorte` | Standorte pro Dojo |
| `webhooks` | Webhook-Konfigurationen |
| `webhook_logs` | Webhook-Ausführungen |
| `integration_settings` | PayPal/LexOffice-Config |
| `kalender_tokens` | iCal-Tokens |

---

## Context Provider (Frontend)

| Context | Datei | Beschreibung |
|---------|-------|--------------|
| AuthContext | `AuthContext.jsx` | Login/Logout, JWT-Token |
| DojoContext | `DojoContext.jsx` | Aktuelles Dojo, Multi-Dojo Filter |
| StandortContext | `StandortContext.jsx` | Aktueller Standort |
| ThemeContext | `ThemeContext.jsx` | Dark/Light Mode, Theme Selection |
| MitgliederUpdateContext | `MitgliederUpdateContext.jsx` | Trigger für Mitglieder-Refresh |

---

## Wichtige Utility-Dateien

### Backend (`/backend/utils/`)

| Datei | Beschreibung |
|-------|--------------|
| `vertragsPdfGenerator.js` | Generiert Vertrags-PDFs |
| `sepaPdfGenerator.js` | Generiert SEPA-Mandat PDFs |
| `sepaXmlGenerator.js` | PAIN.008 XML für Banken |
| `datevExporter.js` | DATEV EXTF Export |
| `mailer.js` | E-Mail Versand |
| `webhookTrigger.js` | Webhook-Auslösung |

### Frontend (`/frontend/src/utils/`)

| Datei | Beschreibung |
|-------|--------------|
| `apiCache.js` | API-Caching für Dashboard |
| `formatters.js` | Datum/Währungs-Formatierung |

---

## Changelog-System

Der SystemChangelog (`SystemChangelog.jsx`) zeigt automatisch wichtige Updates im Info-Tab des Dashboards an. Um neue Einträge hinzuzufügen:

```javascript
// In SystemChangelog.jsx, CHANGELOG Array erweitern:
{
  version: '2.6.0',
  date: '2026-02-XX',
  type: 'feature', // feature, major, security, bugfix, improvement
  title: 'Titel des Updates',
  highlights: [
    'Highlight 1',
    'Highlight 2'
  ],
  details: 'Ausführliche Beschreibung...',
  files: ['NeueDatei.jsx', 'GeänderteDatei.jsx']
}
```

---

## Deployment

**Server:** dojo.tda-intl.org
**Pfad:** `/var/www/dojosoftware/`

```bash
# Deployment-Schritte:
cd /var/www/dojosoftware
git pull  # oder rsync
cd frontend && npm run build
pm2 restart dojo-backend
```
