/**
 * HilfeCenter - Integriertes Hilfesystem für die Dojo-Software
 *
 * Bietet kategorisierte Anleitungen und Hilfestellungen für alle
 * Funktionsbereiche der Software.
 *
 * ERSTELLT: 2026-02-16
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './HilfeCenter.css';

// Hilfe-Inhalte strukturiert nach Kategorien
const hilfeInhalte = {
  ersteschritte: {
    icon: '🚀',
    titel: 'Erste Schritte',
    beschreibung: 'Grundlegende Einführung in die Dojo-Software',
    artikel: [
      {
        id: 'dashboard-uebersicht',
        titel: 'Dashboard-Übersicht',
        inhalt: `
## Das Dashboard

Das Dashboard ist Ihre zentrale Anlaufstelle für alle Funktionen der Dojo-Software.

### Navigation
- **Tabs oben**: Wechseln Sie zwischen den Hauptbereichen (Mitglieder, Finanzen, etc.)
- **Schnellaktionen**: Häufig genutzte Funktionen mit einem Klick erreichbar

### Wichtige Bereiche
1. **Check-In**: Anwesenheitserfassung für Trainings
2. **Mitglieder**: Verwaltung aller Dojo-Mitglieder
3. **Finanzen**: Rechnungen, Zahlungen, Buchhaltung
4. **Einstellungen**: Dojo-Konfiguration und Anpassungen
        `
      },
      {
        id: 'erste-einrichtung',
        titel: 'Erste Einrichtung des Dojos',
        inhalt: `
## Erste Einrichtung

Nach der Registrierung sollten Sie folgende Schritte durchführen:

### 1. Dojo-Daten vervollständigen
Gehen Sie zu **Einstellungen → Dojo-Einstellungen** und tragen Sie ein:
- Dojo-Name und Adresse
- Kontaktdaten
- Logo (optional)

### 2. Kampfkunststile anlegen
Unter **Verwaltung → Stile** legen Sie Ihre angebotenen Kampfkunststile an:
- Name des Stils
- Gürtelfarben und Reihenfolge
- Prüfungsanforderungen

### 3. Kurse/Trainingszeiten einrichten
Unter **Verwaltung → Kurse** definieren Sie:
- Kursname und Beschreibung
- Wochentag und Uhrzeit
- Zugeordneter Stil
- Trainer

### 4. Erstes Mitglied anlegen
Testen Sie das System mit einem Test-Mitglied oder Ihrem eigenen Profil.
        `
      }
    ]
  },
  mitglieder: {
    icon: '👥',
    titel: 'Mitgliederverwaltung',
    beschreibung: 'Mitglieder anlegen, bearbeiten und verwalten',
    artikel: [
      {
        id: 'mitglied-anlegen',
        titel: 'Neues Mitglied anlegen',
        inhalt: `
## Neues Mitglied anlegen

### Schnellweg
1. Klicken Sie auf **Schnellaktionen → Neues Mitglied**
2. Oder gehen Sie zu **Mitglieder → Mitglied hinzufügen**

### Pflichtfelder
- Vorname und Nachname
- E-Mail-Adresse (für Login und Kommunikation)
- Geburtsdatum

### Optionale Angaben
- Adresse und Telefon
- Notfallkontakt
- Bankverbindung (für SEPA)
- Foto

### Nach dem Anlegen
Das Mitglied erhält automatisch eine E-Mail mit:
- Zugangsdaten zum Mitgliederportal
- Link zur Passwort-Erstellung
        `
      },
      {
        id: 'vertrag-erstellen',
        titel: 'Vertrag erstellen',
        inhalt: `
## Vertrag für ein Mitglied erstellen

### Voraussetzungen
- Mitglied muss bereits angelegt sein
- Vertragsvorlage sollte konfiguriert sein

### Schritte
1. Öffnen Sie das **Mitgliederprofil**
2. Wechseln Sie zum Tab **Vertrag**
3. Klicken Sie auf **Neuer Vertrag**
4. Wählen Sie:
   - Vertragstyp (Monatsbeitrag, 10er-Karte, etc.)
   - Startdatum
   - Zahlungsintervall
   - Beitragshöhe

### Vertragsarten
- **Monatsbeitrag**: Laufender Vertrag mit regelmäßiger Zahlung
- **10er-Karte**: Prepaid-Karte für X Trainingseinheiten
- **Probetraining**: Kostenlose Schnupperphase
- **Familienmitgliedschaft**: Vergünstigte Konditionen für Familien
        `
      },
      {
        id: 'sepa-einrichten',
        titel: 'SEPA-Lastschrift einrichten',
        inhalt: `
## SEPA-Lastschrift einrichten

### Voraussetzungen
- Gültige Bankverbindung des Mitglieds
- Unterzeichnetes SEPA-Mandat

### SEPA-Mandat erstellen
1. Öffnen Sie das **Mitgliederprofil**
2. Tab **Finanzen** → **SEPA-Mandat**
3. Klicken Sie auf **Neues Mandat erstellen**
4. Bankdaten eingeben (IBAN wird validiert)
5. Mandat ausdrucken und unterschreiben lassen
6. Unterschriebenes Mandat als "Aktiv" markieren

### Lastschrift durchführen
- Lastschriften werden automatisch zum Fälligkeitsdatum erstellt
- Oder manuell unter **Finanzen → Lastschriften**
- Export als SEPA-XML für Ihre Bank
        `
      }
    ]
  },
  checkin: {
    icon: '📱',
    titel: 'Check-In System',
    beschreibung: 'Anwesenheitserfassung und Training-Tracking',
    artikel: [
      {
        id: 'checkin-basics',
        titel: 'Check-In Grundlagen',
        inhalt: `
## Check-In System

Das Check-In System erfasst die Anwesenheit Ihrer Mitglieder bei Trainings.

### Check-In Methoden
1. **QR-Code Scan**: Mitglieder scannen ihren persönlichen QR-Code
2. **Manuelle Eingabe**: Admin/Trainer trägt Anwesenheit ein
3. **Selbst-Check-In**: Mitglieder checken sich über das Portal ein

### QR-Code Terminal
- Stellen Sie ein Tablet am Eingang auf
- Öffnen Sie die Check-In Seite im Vollbildmodus
- Mitglieder scannen ihren QR-Code aus der App

### Anwesenheitsstatistik
- Jedes Mitglied hat eine persönliche Anwesenheitsquote
- Admins sehen die Gesamtübersicht unter **Berichte**
        `
      },
      {
        id: 'checkin-auswertung',
        titel: 'Anwesenheit auswerten',
        inhalt: `
## Anwesenheit auswerten

### Mitglieder-Ebene
Im Mitgliederprofil unter **Anwesenheit**:
- Gesamte Anwesenheiten
- Anwesenheitsquote in %
- Letzte Trainings
- Monatliche Übersicht
- Streak (aufeinanderfolgende Trainings)

### Dojo-Ebene
Unter **Berichte → Anwesenheit**:
- Durchschnittliche Teilnehmerzahl pro Kurs
- Auslastung nach Wochentag
- Trends über Zeit
- Export für weitere Analyse
        `
      }
    ]
  },
  pruefungen: {
    icon: '🏆',
    titel: 'Prüfungswesen',
    beschreibung: 'Gürtelprüfungen planen und verwalten',
    artikel: [
      {
        id: 'pruefung-ueberblick',
        titel: 'Überblick: So läuft eine Prüfung',
        inhalt: `
## Prüfungswesen — der komplette Ablauf

Das Prüfungswesen begleitet eine Gürtelprüfung von der Planung bis zur Urkunde. Du findest es unter **Prüfungswesen → Termine**. Die Verwaltung ist in Reiter (Tabs) gegliedert:

- **Prüfungstermine** — geplante & vergangene Termine, gruppiert nach Datum/Stil.
- **Kandidaten** — wer ist grundsätzlich prüfungsreif?
- **Zugelassene** — wer ist konkret für einen Termin zugelassen?
- **Abgeschlossen** — bereits bewertete Prüfungen + Urkunden/Protokolle.
- **Statistik** — Bestehensquoten u. a.

### Der typische Weg
1. **Termin planen** (Datum, Stil, Ort, Prüfer).
2. **Kandidaten zulassen** — das System prüft Voraussetzungen (Trainingsstunden, Wartezeit, aktueller Grad).
3. **Prüfung durchführen** (Live-Ansicht mit Timer & Bewertung) oder Ergebnisse direkt eintragen.
4. **Ergebnisse** eintragen (bestanden / nicht bestanden) — neue Grade werden automatisch gesetzt.
5. **Urkunden drucken** — auf die vorgedruckten Urkunden, mit Live-Vorschau.

Die folgenden Artikel beschreiben jeden Schritt im Detail.
        `
      },
      {
        id: 'pruefung-planen',
        titel: 'Prüfungstermin planen',
        inhalt: `
## Prüfungstermin anlegen

1. **Prüfungswesen → Termine → Neuer Termin**.
2. Festlegen:
   - **Datum & Uhrzeit**
   - **Stil** (z. B. Enso Karate, ShieldX, Aikido …)
   - **Ort** (erscheint später auf der Urkunde im Feld „Ort")
   - **Prüfer** (kann später beim Drucken noch überschrieben werden)
3. Speichern — der Termin erscheint unter **Prüfungstermine**, nach Datum gruppiert.

### Anmeldung
- Mitglieder können sich (wenn aktiviert) **selbst anmelden**, oder
- der Admin lädt Teilnehmer manuell zu.

> Tipp: Über die Termin-Liste kannst du je Termin direkt **Prüfung starten**, **Ergebnisse** eintragen und **Urkunden** drucken.
        `
      },
      {
        id: 'pruefung-kandidaten-zulassung',
        titel: 'Kandidaten & Zulassung',
        inhalt: `
## Kandidaten zulassen

Unter **Kandidaten** zeigt das System, wer prüfungsreif ist. Geprüft werden automatisch:
- **Mindest-Trainingseinheiten** seit der letzten Prüfung
- **Wartezeit** (je Stil/Grad hinterlegt)
- **Aktueller Gürtelgrad** (nächster Grad wird vorgeschlagen)

Mit **Zulassen** wird ein Mitglied dem Termin zugeordnet (Reiter **Zugelassene**).

### Doppelprüfung (Zwischengurt)
Steigt jemand zwei Grade auf, kann ein **Zwischengurt** gesetzt werden — dann werden beim Drucken automatisch **zwei Urkunden** erzeugt (bis Zwischengurt + Zielgurt).

### Zulassung entfernen (z. B. wenn jemand krank ist)
- Im Reiter **Zugelassene** beim Teilnehmer auf **„Kommt nicht — Zulassung entfernen"**.
- Stunden & Wartezeit laufen normal weiter.
- Ist die Prüfung **schon bewertet** (z. B. versehentlich über „Alle bestanden"), kommt eine Rückfrage **„Bereits bewertet — trotzdem entfernen?"**. Bestätigst du, wird die Prüfung gelöscht und eine evtl. vergebene Urkundennummer aus dem Verbandsregister entfernt.
        `
      },
      {
        id: 'pruefung-durchfuehren',
        titel: 'Prüfung durchführen (Live)',
        inhalt: `
## Prüfung durchführen

Über **Prüfung starten** öffnet sich die Live-Ansicht für den Prüfungstag.

- **Timer**: Runden/Pausen für die Prüfung (Einfach-Modus oder Blöcke).
- **Teilnehmerliste**: nach Stil filterbar.
- **Bewertung**: je Teilnehmer bestanden / nicht bestanden (+ optional Punkte/Kommentar).
- **Protokoll**: pro Prüfling kann ein Protokoll erstellt/gesendet werden.

> Hinweis: Falls die Seite nicht lädt und Fehler zeigt, kurz **abmelden und neu anmelden** (abgelaufene Sitzung) und mit **Cmd/Strg+Shift+R** neu laden.
        `
      },
      {
        id: 'pruefung-ergebnisse',
        titel: 'Ergebnisse eintragen',
        inhalt: `
## Ergebnisse eintragen

Du kannst einzeln oder gesammelt bewerten.

### Sammel-Eingabe (Batch)
Im Dialog **„Prüfungsergebnisse eintragen"**:
- **Schnellauswahl**: „Alle bestanden" / „Alle nicht bestanden" / „Alle zurücksetzen".
- Je Teilnehmer **offen / bestanden / nicht bestanden** (+ optional Punkt/Kommentar).
- Unter **Einstellungen**: Bestehens-Regeln (Punkte ab, Prozent ab, max. Punkte, Punkteschritte) — als Standard speicherbar.

### Nach dem Speichern
- Neue **Gürtelgrade** werden automatisch gesetzt.
- Die Prüfungen wandern in **Abgeschlossen**.
- Anschließend können **Urkunden gedruckt** werden.

> Achtung: „Alle bestanden" bewertet wirklich **alle** ausgewählten Teilnehmer. Wer nicht teilnimmt (z. B. krank), vorher über **Zulassung entfernen** rausnehmen.
        `
      },
      {
        id: 'urkunden-drucken',
        titel: 'Urkunden drucken',
        inhalt: `
## Urkunden drucken

Über **Urkunden** (bei einem Termin oder in „Abgeschlossen") öffnet sich der Druck-Dialog.

1. **Urkunden-Vorlage** wählen (z. B. Enso Karate, ShieldX, … oder eine **eigene Vorlage**).
2. **Live-Vorschau**: zeigt, wie der fertige Druck aussieht (Design + Daten an der richtigen Stelle).
3. Bei Vorlagen mit Prüfern: **Prüfer 1 (links)** und **Prüfer 2 (rechts, optional)** eintragen — genau diese stehen auf der Urkunde. Leere Felder bleiben frei.
4. Teilnehmer auswählen → **drucken**.

### Wichtig zum Druck
- **Gedruckt werden nur die Daten** (Name, Grad, Datum, Ort, Prüfer, Urkunden-Nr.) — der Hintergrund ist nur die Ansicht. **Lege das vorgedruckte Urkunden-Papier** in den Drucker.
- Die **Urkundennummer** wird automatisch fortlaufend vergeben und im **Verbandsregister** gespeichert.
- Mache idealerweise zuerst einen **Test-Druck auf ein leeres Blatt** und lege es aufs Original, um die Ausrichtung zu prüfen.
        `
      },
      {
        id: 'urkunden-vorlagen-editor',
        titel: 'Eigene Urkunden-Vorlagen (Editor)',
        inhalt: `
## Eigene Urkunden-Vorlagen erstellen (Enterprise)

Mit dem visuellen Editor hinterlegt jedes Dojo seine **eigenen Urkunden** — ganz ohne Programmierung.

**Öffnen:** Druck-Dialog → **„⚙ Eigene Vorlagen"**, oder direkt **Dashboard → /dashboard/urkunden-vorlagen**.

### Neue Vorlage anlegen
1. **„+ Neue Vorlage"** → **Name** vergeben und **Format** wählen (A4 hoch / A4 quer).
2. **Design hochladen** (JPG/PNG deiner vorgedruckten Urkunde) → erscheint als Hintergrund.
3. **Felder hinzufügen** (Buttons): Name, Grad, Datum, Ort, Urkunden-Nr., Prüfer 1, Prüfer 2, Freitext.
4. Felder **per Drag & Drop** an die richtige Stelle ziehen.
5. Pro Feld einstellbar: **Schriftgröße, Breite, Ausrichtung, fett**.
6. **Optionen**: Datum ausgeschrieben (z. B. „28. Juni 2026"), Grad nur als Kyu-Nummer („8."), Präfix vor der Urkunden-Nr. („Urkunden-Nr.: ").
7. **Live-Vorschau** mit Beispieldaten prüfen → **Speichern**.

### Verwenden
Die gespeicherte Vorlage erscheint anschließend **im Druck-Dialog im Dropdown** und wird wie jede andere gedruckt (nur die Daten aufs vorgedruckte Papier).

> Tipp: Lade das Design möglichst **gerade & randlos** hoch (genau das spätere Papier), dann passt die Vorschau 1:1. Feinjustierung am besten mit einem Test-Druck.
        `
      }
    ]
  },
  finanzen: {
    icon: '💰',
    titel: 'Finanzen & Buchhaltung',
    beschreibung: 'Rechnungen, Zahlungen und Buchführung',
    artikel: [
      {
        id: 'rechnung-erstellen',
        titel: 'Rechnung erstellen',
        inhalt: `
## Rechnung erstellen

### Einzelrechnung
1. **Finanzen → Rechnungen → Neue Rechnung**
2. Mitglied auswählen
3. Positionen hinzufügen:
   - Beschreibung
   - Menge
   - Einzelpreis
   - MwSt-Satz
4. Rechnung speichern und versenden

### Sammelrechnung (Monatsbeiträge)
1. **Finanzen → Monatsabrechnung**
2. Monat auswählen
3. System erstellt automatisch Rechnungen für alle fälligen Beiträge
4. Prüfen und freigeben
5. Per E-Mail versenden oder SEPA-Export

### Rechnungsnummern
- Werden automatisch fortlaufend vergeben
- Format: RE-JJJJ-NNNNN (z.B. RE-2026-00042)
        `
      },
      {
        id: 'zahlungen-verbuchen',
        titel: 'Zahlungen verbuchen',
        inhalt: `
## Zahlungen verbuchen

### Einzelne Zahlung
1. Offene Rechnung öffnen
2. **Zahlung hinzufügen**
3. Datum, Betrag, Zahlungsart eingeben
4. Rechnung wird als bezahlt markiert

### Bankimport
1. **Finanzen → Bankimport**
2. CSV/MT940 Datei von Ihrer Bank hochladen
3. System gleicht automatisch ab:
   - Verwendungszweck mit Rechnungsnummer
   - Betrag mit offenen Posten
4. Zuordnungen prüfen und bestätigen

### Mahnwesen
- Überfällige Rechnungen werden markiert
- Automatische Zahlungserinnerungen (wenn aktiviert)
- Mahnstufen konfigurierbar
        `
      }
    ]
  },
  einstellungen: {
    icon: '⚙️',
    titel: 'Einstellungen',
    beschreibung: 'Dojo und System konfigurieren',
    artikel: [
      {
        id: 'dojo-einstellungen',
        titel: 'Dojo-Einstellungen',
        inhalt: `
## Dojo-Einstellungen

Unter **Einstellungen → Dojo** konfigurieren Sie:

### Stammdaten
- Dojo-Name
- Adresse
- Kontaktdaten
- Steuer-ID / USt-IdNr

### Erscheinungsbild
- Logo hochladen
- Farbschema wählen
- E-Mail-Signatur anpassen

### Benachrichtigungen
- Automatische E-Mails aktivieren/deaktivieren
- E-Mail-Vorlagen bearbeiten
- Erinnerungen konfigurieren
        `
      },
      {
        id: 'benutzer-rechte',
        titel: 'Benutzer und Rechte',
        inhalt: `
## Benutzer und Rechte verwalten

### Rollen
- **Admin**: Vollzugriff auf alle Funktionen
- **Trainer**: Kann Check-Ins durchführen, Mitglieder einsehen
- **Mitglied**: Nur eigenes Profil und Check-In

### Neuen Admin hinzufügen
1. **Einstellungen → Benutzer**
2. **Admin hinzufügen**
3. E-Mail-Adresse eingeben
4. Berechtigungen festlegen
5. Einladung wird per E-Mail versendet

### Trainer-Zugang
Trainer erhalten eingeschränkten Zugang:
- Kursliste und Teilnehmer
- Check-In durchführen
- Keine Finanzdaten
        `
      }
    ]
  },
  kurse: {
    icon: '📅',
    titel: 'Kurse & Stundenplan',
    beschreibung: 'Kurse anlegen und Stundenplan verwalten',
    artikel: [
      {
        id: 'kurs-anlegen',
        titel: 'Neuen Kurs anlegen',
        inhalt: `
## Neuen Kurs anlegen

### Schritte
1. Gehen Sie zu **Verwaltung → Kurse**
2. Klicken Sie auf **Neuer Kurs**
3. Füllen Sie die Pflichtfelder aus:
   - Kursname (z.B. "Karate Anfänger")
   - Wochentag und Uhrzeit
   - Dauer in Minuten
   - Raum (falls mehrere vorhanden)

### Optionale Einstellungen
- **Stil zuordnen**: Für stilspezifische Kurse
- **Trainer zuweisen**: Wer leitet den Kurs
- **Teilnehmerlimit**: Maximale Anzahl
- **Altersgruppe**: Kinder, Jugendliche, Erwachsene
- **Beschreibung**: Wird im öffentlichen Stundenplan angezeigt

### Kurs-Typen
- **Regulärer Kurs**: Wöchentlich wiederkehrend
- **Sonderkurs**: Einmalige Veranstaltung
- **Privat**: Nicht öffentlich sichtbar
        `
      },
      {
        id: 'stundenplan',
        titel: 'Stundenplan verwalten',
        inhalt: `
## Stundenplan

### Ansichten
- **Wochenansicht**: Alle Kurse einer Woche
- **Tagesansicht**: Detaillierte Tagesübersicht
- **Listenansicht**: Tabellarische Darstellung

### Öffentlicher Stundenplan
Der Stundenplan kann öffentlich geteilt werden:
1. **Verwaltung → Stundenplan → Teilen**
2. Link kopieren oder QR-Code generieren
3. Auf Website einbetten oder als Poster ausdrucken

### Stundenplan-Display
Für einen zweiten Monitor im Dojo:
1. **Check-In → Stundenplan Anzeige**
2. Zeigt automatisch rotierend alle Kurse
3. Ideal für Wartebereich oder Eingang

### Kurs verschieben
- Per Drag & Drop im Kalender
- Oder Kurs bearbeiten und Zeit ändern
- Mitglieder werden optional benachrichtigt
        `
      },
      {
        id: 'kurs-teilnehmer',
        titel: 'Kursteilnehmer verwalten',
        inhalt: `
## Kursteilnehmer

### Teilnehmer zuweisen
1. Kurs öffnen → Tab **Teilnehmer**
2. **Teilnehmer hinzufügen**
3. Mitglied aus Liste wählen

### Automatische Zuweisung
Mitglieder können sich selbst zu Kursen anmelden:
- Im Mitgliederportal unter "Meine Kurse"
- Gilt nur für freigegebene Kurse

### Warteliste
Bei vollem Kurs:
- Mitglieder können sich auf Warteliste setzen
- Bei Abmeldung wird automatisch nachgerückt
- Admin wird benachrichtigt

### Anwesenheit im Kurs
- Check-In erfasst automatisch den aktuellen Kurs
- Manuelle Nacherfassung möglich
- Statistik pro Kurs einsehbar
        `
      }
    ]
  },
  artikel: {
    icon: '📦',
    titel: 'Artikelverwaltung & Verkauf',
    beschreibung: 'Produkte verwalten und verkaufen',
    artikel: [
      {
        id: 'artikel-anlegen',
        titel: 'Artikel anlegen',
        inhalt: `
## Artikel anlegen

### Artikeltypen
- **Verkaufsartikel**: Normale Produkte (Ausrüstung, Kleidung)
- **Dienstleistung**: Prüfungsgebühren, Lehrgänge
- **Mitgliedschaft**: Vertragsgebundene Beiträge

### Neuen Artikel erstellen
1. **Artikelverwaltung → Neuer Artikel**
2. Pflichtfelder:
   - Artikelname
   - Preis (Brutto oder Netto)
   - MwSt-Satz (19%, 7%, 0%)
   - Artikelgruppe

### Optionale Angaben
- **Artikelnummer/SKU**: Für Inventar
- **Bestand**: Lagerbestand verwalten
- **Bild**: Produktfoto hochladen
- **Beschreibung**: Details zum Artikel
- **Varianten**: Größen, Farben

### Artikelgruppen
Organisieren Sie Artikel in Gruppen:
- Bekleidung
- Ausrüstung
- Prüfungen
- Sonstiges
        `
      },
      {
        id: 'verkauf-kasse',
        titel: 'Barverkauf & Kasse',
        inhalt: `
## Barverkauf / Kassensystem

### Kasse öffnen
1. **Check-In → Barverkauf**
2. Oder direkt über Schnellaktionen

### Verkauf durchführen
1. Artikel antippen oder suchen
2. Menge anpassen (+ / -)
3. Optional: Mitglied zuordnen
4. Zahlungsart wählen:
   - Bar
   - Karte (SumUp)
   - Auf Rechnung
5. Verkauf abschließen

### Kassenabschluss
Am Ende des Tages:
1. **Kasse → Tagesabschluss**
2. Bargeld zählen und eingeben
3. Differenzen werden protokolliert
4. Bericht wird erstellt

### SumUp-Integration
Für Kartenzahlung:
1. SumUp-Konto verbinden (Einstellungen)
2. SumUp-Terminal koppeln
3. Bei Kartenzahlung wird Terminal aktiviert
        `
      },
      {
        id: 'bestand-inventur',
        titel: 'Bestand & Inventur',
        inhalt: `
## Bestandsverwaltung

### Bestand aktivieren
1. **Artikel bearbeiten → Bestand verwalten** aktivieren
2. Anfangsbestand eingeben

### Bestandsbewegungen
- **Verkauf**: Reduziert automatisch
- **Wareneingang**: Manuell buchen
- **Korrektur**: Bei Inventurdifferenzen

### Inventur durchführen
1. **Artikelverwaltung → Inventur**
2. Für jeden Artikel Ist-Bestand eingeben
3. Differenzen werden angezeigt
4. Bestand anpassen

### Mindestbestand
- Warnung bei Unterschreitung
- Automatische Benachrichtigung
- Bestellvorschläge
        `
      }
    ]
  },
  events: {
    icon: '🎉',
    titel: 'Events & Veranstaltungen',
    beschreibung: 'Lehrgänge, Turniere und Sonderveranstaltungen',
    artikel: [
      {
        id: 'event-erstellen',
        titel: 'Event erstellen',
        inhalt: `
## Event erstellen

### Event-Typen
- **Lehrgang**: Fortbildung mit externem Trainer
- **Turnier**: Wettkampfveranstaltung
- **Prüfung**: Gürtelprüfung (separat unter Prüfungswesen)
- **Feier**: Sommerfest, Weihnachtsfeier
- **Sonstiges**: Freie Kategorie

### Neues Event anlegen
1. **Events → Neues Event**
2. Grunddaten eingeben:
   - Titel und Beschreibung
   - Datum und Uhrzeit
   - Ort (intern oder extern)
   - Teilnehmergebühr

### Anmeldeoptionen
- **Öffentlich**: Jeder kann sich anmelden
- **Nur Mitglieder**: Login erforderlich
- **Einladung**: Nur eingeladene Personen
- **Warteliste**: Bei begrenzter Teilnehmerzahl

### Teilnehmergebühren
- Kostenlos oder kostenpflichtig
- Unterschiedliche Preise (Mitglieder/Externe)
- Online-Zahlung oder vor Ort
        `
      },
      {
        id: 'event-teilnehmer',
        titel: 'Event-Teilnehmer verwalten',
        inhalt: `
## Event-Teilnehmer

### Anmeldungen verwalten
1. Event öffnen → Tab **Teilnehmer**
2. Übersicht aller Anmeldungen
3. Status: Angemeldet, Bezahlt, Storniert

### Manuell hinzufügen
- **Teilnehmer hinzufügen** → Mitglied wählen
- Oder externe Person mit Kontaktdaten

### Teilnehmerliste exportieren
- PDF für Anwesenheitskontrolle
- Excel für weitere Verarbeitung
- E-Mail-Liste für Kommunikation

### Absagen verwalten
- Stornierung mit/ohne Gebühr
- Automatisches Nachrücken von Warteliste
- Benachrichtigung an Teilnehmer
        `
      }
    ]
  },
  personal: {
    icon: '👨‍🏫',
    titel: 'Personal & Trainer',
    beschreibung: 'Mitarbeiter und Trainer verwalten',
    artikel: [
      {
        id: 'trainer-anlegen',
        titel: 'Trainer anlegen',
        inhalt: `
## Trainer anlegen

### Neuen Trainer erstellen
1. **Personal → Neuer Trainer**
2. Persönliche Daten eingeben
3. Qualifikationen und Lizenzen hinterlegen
4. Kurse zuweisen

### Trainer-Qualifikationen
- Trainerlizenz (Stufe, Gültigkeit)
- Erste-Hilfe-Nachweis
- Führungszeugnis
- Stilspezifische Graduierung

### Trainer-Zugang
Trainer erhalten optional einen Login:
- Eigene Kurse einsehen
- Teilnehmerlisten verwalten
- Check-Ins durchführen
- Keine Admin-Funktionen

### Vertretung
- Vertretungsregelung pro Kurs
- Bei Abwesenheit automatisch benachrichtigen
        `
      },
      {
        id: 'personal-checkin',
        titel: 'Personal Check-In',
        inhalt: `
## Arbeitszeit erfassen

### Check-In für Personal
1. **Check-In → Personal Check-In**
2. Mitarbeiter wählt sich aus Liste
3. Kommen/Gehen buchen

### Arbeitszeiten auswerten
- **Personal → Arbeitszeiten**
- Übersicht pro Mitarbeiter und Monat
- Soll/Ist-Vergleich
- Export für Lohnbuchhaltung

### Stundenkonten
- Überstunden automatisch berechnen
- Urlaubstage verwalten
- Krankmeldungen erfassen
        `
      }
    ]
  },
  berichte: {
    icon: '📊',
    titel: 'Berichte & Auswertungen',
    beschreibung: 'Statistiken und Analysen',
    artikel: [
      {
        id: 'mitglieder-statistik',
        titel: 'Mitgliederstatistik',
        inhalt: `
## Mitgliederstatistik

### Übersicht
**Berichte → Mitglieder** zeigt:
- Gesamtzahl aktive Mitglieder
- Entwicklung über Zeit
- Altersverteilung
- Geschlechterverteilung

### Zu- und Abgänge
- Neue Mitglieder pro Monat
- Kündigungen und Gründe
- Netto-Entwicklung

### Stilverteilung
- Mitglieder pro Kampfkunststil
- Gürtelgrad-Verteilung
- Durchschnittliche Verweildauer

### Export
- PDF-Bericht generieren
- Excel für eigene Auswertungen
        `
      },
      {
        id: 'finanz-berichte',
        titel: 'Finanzberichte',
        inhalt: `
## Finanzberichte

### Umsatzübersicht
**Berichte → Finanzen**:
- Monatsumsatz
- Vergleich zum Vorjahr
- Umsatz nach Kategorie

### Offene Posten
- Unbezahlte Rechnungen
- Überfällige Zahlungen
- Mahnquote

### DATEV-Export
Für Ihren Steuerberater:
1. **Finanzen → DATEV-Export**
2. Zeitraum wählen
3. Export generieren
4. Datei an Steuerberater senden

### Buchführung
- Einnahmen/Ausgaben-Übersicht
- Kontenbewegungen
- Jahresabschluss-Vorbereitung
        `
      },
      {
        id: 'anwesenheit-berichte',
        titel: 'Anwesenheitsberichte',
        inhalt: `
## Anwesenheitsberichte

### Kursauslastung
- Durchschnittliche Teilnehmerzahl
- Auslastung in Prozent
- Trends über Zeit

### Mitglieder-Aktivität
- Aktivste Mitglieder
- Inaktive Mitglieder (Kündigungsrisiko)
- Trainingsfrequenz

### Zeitliche Auswertung
- Beliebteste Trainingszeiten
- Wochentags-Vergleich
- Saisonale Schwankungen

### Trainer-Statistik
- Kurse pro Trainer
- Teilnehmerzufriedenheit
- Vertretungshäufigkeit
        `
      }
    ]
  },
  vertraege: {
    icon: '📝',
    titel: 'Verträge & Vorlagen',
    beschreibung: 'Vertragsvorlagen und Dokumente',
    artikel: [
      {
        id: 'vertragsvorlagen',
        titel: 'Vertragsvorlagen erstellen',
        inhalt: `
## Vertragsvorlagen

### Vorlagen verwalten
**Einstellungen → Vertragsvorlagen**

### Vorlage erstellen
1. **Neue Vorlage**
2. Name vergeben (z.B. "Standardvertrag Erwachsene")
3. Vertragstext mit Platzhaltern erstellen

### Platzhalter
Werden automatisch ausgefüllt:
- **{vorname}** - Vorname des Mitglieds
- **{nachname}** - Nachname
- **{geburtsdatum}** - Geburtsdatum
- **{beitrag}** - Monatsbeitrag
- **{startdatum}** - Vertragsbeginn
- **{dojo_name}** - Name des Dojos

### Vertragstypen
- Monatsmitgliedschaft
- Jahresmitgliedschaft
- Familienmitgliedschaft
- Probetraining
- 10er-Karte
        `
      },
      {
        id: 'email-vorlagen',
        titel: 'E-Mail-Vorlagen',
        inhalt: `
## E-Mail-Vorlagen

### Automatische E-Mails
Das System versendet automatisch:
- Willkommens-E-Mail bei Registrierung
- Vertrag per E-Mail
- Rechnungen
- Zahlungserinnerungen
- Prüfungseinladungen

### Vorlagen bearbeiten
**Einstellungen → E-Mail-Vorlagen**:
1. Vorlage auswählen
2. Betreff und Text anpassen
3. Platzhalter nutzen
4. Speichern und testen

### Eigenes Design
- Logo einbinden
- Farben anpassen
- Signatur konfigurieren
        `
      },
      {
        id: 'agb-dsgvo',
        titel: 'AGB & Datenschutz',
        inhalt: `
## AGB & Datenschutzerklärung

### AGB bearbeiten
1. **Info → AGB Status** oder **Einstellungen**
2. AGB-Text bearbeiten
3. Version hochzählen
4. Mitglieder müssen neu zustimmen

### Datenschutzerklärung
- Eigene DSGVO-konforme Erklärung hinterlegen
- Wird bei Registrierung angezeigt
- Zustimmung wird protokolliert

### Einwilligungen
Das System protokolliert:
- Wann zugestimmt wurde
- Welche Version
- Widerruf möglich

### Export für Auskunft
Bei Anfrage eines Mitglieds:
- Alle gespeicherten Daten exportieren
- PDF-Bericht generieren
        `
      }
    ]
  },
  zehnerkarten: {
    icon: '🎟️',
    titel: '10er-Karten',
    beschreibung: 'Prepaid-Karten verwalten',
    artikel: [
      {
        id: 'zehnerkarte-erstellen',
        titel: '10er-Karte verkaufen',
        inhalt: `
## 10er-Karten

### Was sind 10er-Karten?
Prepaid-Karten für flexible Trainingsbesuche:
- Keine Vertragsbindung
- X Trainingseinheiten kaufen
- Bei Check-In wird abgebucht

### 10er-Karte anlegen
1. **Mitglied öffnen → Finanzen → 10er-Karten**
2. **Neue Karte**
3. Kartentyp wählen (5er, 10er, 20er)
4. Preis und Gültigkeit
5. Zahlung verbuchen

### Kartentypen einrichten
**Einstellungen → 10er-Karten**:
- Anzahl Einheiten
- Preis
- Gültigkeitsdauer
- Für welche Kurse gültig

### Automatische Buchung
Bei Check-In:
- System erkennt 10er-Karten-Mitglied
- Einheit wird automatisch abgebucht
- Restguthaben wird angezeigt
        `
      },
      {
        id: 'zehnerkarte-verwalten',
        titel: '10er-Karten verwalten',
        inhalt: `
## 10er-Karten Verwaltung

### Übersicht
**Mitglieder → 10er-Karten-Übersicht**:
- Alle aktiven Karten
- Restguthaben
- Ablaufende Karten

### Ablaufwarnung
- System warnt bei niedrigem Guthaben
- E-Mail an Mitglied (optional)
- Hinweis bei Check-In

### Karte verlängern
- Gültigkeitsdatum anpassen
- Einheiten hinzufügen (Aufladung)
- Neue Karte verkaufen

### Stornierung
- Nicht genutzte Einheiten erstatten
- Oder auf neue Karte übertragen
        `
      }
    ]
  },
  buddy: {
    icon: '🤝',
    titel: 'Buddy-System',
    beschreibung: 'Mitglieder werben Mitglieder',
    artikel: [
      {
        id: 'buddy-system',
        titel: 'Buddy-System Übersicht',
        inhalt: `
## Buddy-System

### Konzept
Mitglieder können neue Mitglieder werben:
- Werber erhält Prämie/Rabatt
- Geworbener erhält Willkommensbonus
- Win-Win für alle

### Buddy-Gruppen
Werber und Geworbene bilden eine Gruppe:
- Übersicht wer wen geworben hat
- Prämien werden automatisch berechnet
- Statistik über erfolgreiche Empfehlungen

### Referral-Codes
Jedes Mitglied hat einen persönlichen Code:
- Im Mitgliederportal sichtbar
- Per Link/QR-Code teilbar
- Bei Registrierung eingeben
        `
      },
      {
        id: 'buddy-praemien',
        titel: 'Prämien einrichten',
        inhalt: `
## Buddy-Prämien

### Prämienmodelle
**Verwaltung → Buddy-System → Prämien**:
- Einmalige Gutschrift
- Prozentuale Ermäßigung
- Freimonate
- Sachprämien

### Bedingungen
- Mindestlaufzeit des Geworbenen
- Maximale Prämien pro Jahr
- Staffelung (mehr Werbungen = höhere Prämie)

### Auszahlung
- Automatisch bei Vertragsabschluss
- Oder nach Probezeit
- Per Gutschrift oder Überweisung
        `
      }
    ]
  },
  tipps: {
    icon: '💡',
    titel: 'Tipps & Tricks',
    beschreibung: 'Nützliche Hinweise für den Alltag',
    artikel: [
      {
        id: 'tastaturkuerzel',
        titel: 'Tastaturkürzel',
        inhalt: `
## Tastaturkürzel

### Navigation
- **Strg + M**: Schnell zu Mitgliedern
- **Strg + K**: Suchfeld fokussieren
- **Escape**: Dialog schließen

### Im Mitglied
- **Tab**: Zwischen Feldern wechseln
- **Enter**: Speichern
- **Strg + S**: Speichern

### Tabellen
- **Pfeil hoch/runter**: Zeile wählen
- **Enter**: Zeile öffnen
- **Strg + F**: In Tabelle suchen
        `
      },
      {
        id: 'performance-tipps',
        titel: 'Performance-Tipps',
        inhalt: `
## Performance-Tipps

### Browser
- Chrome oder Firefox empfohlen
- Regelmäßig Cache leeren
- Aktuelle Browser-Version nutzen

### Bei vielen Mitgliedern
- Filter nutzen statt scrollen
- Paginierung beachten
- Export für große Datenmengen

### Mobile Nutzung
- Responsive Design auf Tablet
- Check-In optimiert für Touch
- PWA installieren für App-Gefühl
        `
      },
      {
        id: 'haeufige-fehler',
        titel: 'Häufige Fehler vermeiden',
        inhalt: `
## Häufige Fehler

### Mitgliederverwaltung
- **E-Mail doppelt**: Jede E-Mail nur einmal
- **Geburtsdatum leer**: Wichtig für Altersstatistik
- **Kein Stil zugewiesen**: Anwesenheit funktioniert nicht

### Finanzen
- **Rechnung ohne Mitglied**: Immer zuordnen
- **SEPA ohne Mandat**: Erst Mandat, dann Lastschrift
- **Falsche MwSt**: 19% Standard, 7% ermäßigt

### Check-In
- **Kein aktiver Kurs**: Check-In zur Kurszeit machen
- **QR-Code unscharf**: Bessere Kamera oder größerer Code

### Allgemein
- **Nicht gespeichert**: Immer auf Speichern achten
- **Browser zurück**: Besser Navigation nutzen
        `
      }
    ]
  },
  kommunikation: {
    icon: '💬',
    titel: 'Kommunikation & Chat',
    beschreibung: 'Nachrichten mit Team & Mitgliedern',
    artikel: [
      {
        id: 'chat-grundlagen',
        titel: 'Chat-Grundlagen',
        inhalt: `
## Chat im Dojo

Den Chat findest du unter **Kommunikation** im Dashboard bzw. als eigene Nachrichten-App unter **msg.dojo.tda-intl.org** (ein Login — öffnet sich mit deinem Account).

Oben gibt es (je nach Freischaltung) Reiter:
- **💬 Intern** — Chats mit Team & Mitgliedern.
- **📘 Messenger** / **💬 WhatsApp** — externe Kanäle (Enterprise, siehe eigener Artikel).

### Räume/Gespräche
- **Direktnachricht** (1:1) oder **Gruppe/Kurs-Chat**.
- **Ankündigung**: Kanal, in dem nur Admins schreiben (alle lesen).
        `
      },
      {
        id: 'neues-gespraech',
        titel: 'Jemandem schreiben (Neues Gespräch)',
        inhalt: `
## Eine neue Person anschreiben

**Wichtig:** Das **Suchfeld oben** durchsucht nur deine **bestehenden** Chats — damit findest du niemanden, mit dem du noch nicht geschrieben hast.

Um jemandem **ohne bestehenden Chat** zu schreiben:
1. Auf **„Neues Gespräch"** (➕ / ✏️) tippen.
2. **Direktnachricht** wählen.
3. Im Suchfeld dort den **Namen eintippen** (ab 2 Buchstaben) → Person auswählen → Gespräch starten.

So erreichst du jedes aktive Mitglied und jeden Trainer/Admin deines Dojos.
        `
      },
      {
        id: 'messenger-whatsapp',
        titel: 'Messenger & WhatsApp (Enterprise)',
        inhalt: `
## Externe Kanäle anbinden (Enterprise)

Im Chat können **Facebook Messenger** und **WhatsApp** als zusätzliche Kanäle laufen — Nachrichten von Besuchern/Mitgliedern landen direkt im Admin-Chat.

- Einrichtung unter **Einstellungen → Integrationen** (Seiten-/Phone-Number-ID, Token, App Secret, Webhook).
- **24-Stunden-Fenster**: Außerhalb des Meta-24h-Fensters ist das Antworten gesperrt (Meta-Vorgabe) — die Eingabe wird dann blockiert.
        `
      }
    ]
  },
  coach_app: {
    icon: '🧑‍🏫',
    titel: 'Coach-App (Trainer)',
    beschreibung: 'Die App für Trainer: Stunden, Ansagen, Vertretung',
    artikel: [
      {
        id: 'coach-login',
        titel: 'Coach-App öffnen & anmelden',
        inhalt: `
## Coach-App (Enterprise)

Die Coach-App ist die eigene App für Trainer: **coach.tda-intl.org** (am besten zum Home-Bildschirm hinzufügen → wie eine App).

- **Anmelden** mit den gewohnten Zugangsdaten.
- Ein Login öffnet auch **Check-in** und **Chat** ohne erneutes Anmelden.
- Wird je Dojo freigeschaltet (Enterprise).

Module: **Schnell-Ansage**, **Meine Stunden**, **Vertretung suchen**, **Check-in**, **Chat**.
        `
      },
      {
        id: 'coach-schnellansage',
        titel: 'Schnell-Ansage (Stunde absagen/ändern)',
        inhalt: `
## Stunde kurzfristig absagen oder verlegen

In der Coach-App → **Schnell-Ansage**:
1. Tag (Heute/Morgen) und betroffene **Stunde** wählen.
2. **Absagen**, **verlegen** oder kurze Info eingeben.
3. Veröffentlichen.

Die Info erscheint **sofort als Popup** in der Mitglieder-App und auf der Homepage und **läuft automatisch ab**. Bei jeder Änderung wird der **Admin automatisch informiert** (E-Mail, In-App, Chat).

Trainer sehen/ändern nur ihre **eigenen Stunden + zugewiesene Vertretungen**.
        `
      },
      {
        id: 'coach-vertretung',
        titel: 'Vertretung suchen',
        inhalt: `
## Vertretung suchen & übernehmen

In der Coach-App → **🆘 Vertretung suchen**:

### Anfrage stellen
1. **„Aus meinen Stunden"** (Datum wählen — auch im Voraus) und die Stunde auswählen, **oder** „Frei eingeben" (Kurs/Datum/Zeit) + optionale Notiz.
2. **„Anfrage an alle Trainer senden"** → alle Trainer bekommen eine **E-Mail** (und **Push**, falls aktiviert) und sehen die Anfrage in der App.

### Übernehmen
- Unter **„Offene Anfragen"** auf **„Ich übernehme"** — **wer zuerst zusagt, bekommt die Vertretung.**
- Der anfragende Trainer und der Admin werden automatisch informiert.

### Push aktivieren
Einmalig **„🔔 Push-Benachrichtigungen aktivieren"** tippen. Auf dem **iPhone** funktioniert Push nur, wenn die Coach-App vorher **zum Home-Bildschirm hinzugefügt** (installiert) wurde.
        `
      }
    ]
  }
};

const HilfeCenter = () => {
  const navigate = useNavigate();
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [selectedArtikel, setSelectedArtikel] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Kategorie ein-/ausklappen
  const toggleCategory = (categoryKey) => {
    if (expandedCategory === categoryKey) {
      setExpandedCategory(null);
      setSelectedArtikel(null);
    } else {
      setExpandedCategory(categoryKey);
      setSelectedArtikel(null);
    }
  };

  // Artikel auswählen
  const selectArtikel = (artikel) => {
    setSelectedArtikel(selectedArtikel?.id === artikel.id ? null : artikel);
  };

  // Einfache Markdown-ähnliche Formatierung
  const formatContent = (content) => {
    if (!content) return null;

    const lines = content.trim().split('\n');
    const elements = [];
    let listItems = [];
    let listType = null;

    const flushList = () => {
      if (listItems.length > 0) {
        if (listType === 'ol') {
          elements.push(<ol key={`ol-${elements.length}`}>{listItems}</ol>);
        } else {
          elements.push(<ul key={`ul-${elements.length}`}>{listItems}</ul>);
        }
        listItems = [];
        listType = null;
      }
    };

    lines.forEach((line, index) => {
      // Überschrift H2
      if (line.startsWith('## ')) {
        flushList();
        elements.push(<h2 key={index}>{line.substring(3)}</h2>);
      }
      // Überschrift H3
      else if (line.startsWith('### ')) {
        flushList();
        elements.push(<h3 key={index}>{line.substring(4)}</h3>);
      }
      // Nummerierte Liste
      else if (/^\d+\.\s/.test(line)) {
        if (listType !== 'ol') {
          flushList();
          listType = 'ol';
        }
        listItems.push(<li key={index}>{formatInlineText(line.replace(/^\d+\.\s/, ''))}</li>);
      }
      // Aufzählung
      else if (line.startsWith('- ')) {
        if (listType !== 'ul') {
          flushList();
          listType = 'ul';
        }
        listItems.push(<li key={index}>{formatInlineText(line.substring(2))}</li>);
      }
      // Normaler Absatz
      else if (line.trim()) {
        flushList();
        elements.push(<p key={index}>{formatInlineText(line)}</p>);
      }
    });

    flushList();
    return elements;
  };

  // Inline-Formatierung (fett, kursiv, Code)
  const formatInlineText = (text) => {
    // Bold **text**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  // Gefilterte Kategorien basierend auf Suchbegriff
  const getFilteredContent = () => {
    if (!searchTerm.trim()) return hilfeInhalte;

    const term = searchTerm.toLowerCase();
    const filtered = {};

    Object.entries(hilfeInhalte).forEach(([key, category]) => {
      const matchingArticles = category.artikel.filter(artikel =>
        artikel.titel.toLowerCase().includes(term) ||
        artikel.inhalt.toLowerCase().includes(term)
      );

      if (matchingArticles.length > 0 ||
          category.titel.toLowerCase().includes(term)) {
        filtered[key] = {
          ...category,
          artikel: matchingArticles.length > 0 ? matchingArticles : category.artikel
        };
      }
    });

    return filtered;
  };

  const filteredContent = getFilteredContent();

  return (
    <div className="hilfe-center">
      <div className="hilfe-header">
        <h2>Hilfe & Anleitungen</h2>
        <p>Finden Sie Antworten und Anleitungen zu allen Funktionen der Dojo-Software</p>

        <button
          onClick={() => navigate('/dashboard/funktionen')}
          style={{ marginTop: 4, padding: '9px 16px', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          🧭 Funktionsübersicht — alle Funktionen & Pläne
        </button>

        {/* Suchfeld */}
        <div className="hilfe-search">
          <input
            type="text"
            placeholder="Suche in der Hilfe..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              className="search-clear"
              onClick={() => setSearchTerm('')}
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="hilfe-content">
        {/* Kategorien-Liste */}
        <div className="hilfe-kategorien">
          {Object.entries(filteredContent).map(([key, category]) => (
            <div key={key} className="hilfe-kategorie">
              <button
                className={`kategorie-header ${expandedCategory === key ? 'expanded' : ''}`}
                onClick={() => toggleCategory(key)}
              >
                <span className="kategorie-icon">{category.icon}</span>
                <div className="kategorie-info">
                  <span className="kategorie-titel">{category.titel}</span>
                  <span className="kategorie-beschreibung">{category.beschreibung}</span>
                </div>
                <span className="kategorie-toggle">
                  {expandedCategory === key ? '▼' : '▶'}
                </span>
              </button>

              {expandedCategory === key && (
                <div className="kategorie-artikel">
                  {category.artikel.map((artikel) => (
                    <button
                      key={artikel.id}
                      className={`artikel-item ${selectedArtikel?.id === artikel.id ? 'selected' : ''}`}
                      onClick={() => selectArtikel(artikel)}
                    >
                      <span className="artikel-bullet">•</span>
                      <span className="artikel-titel">{artikel.titel}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {Object.keys(filteredContent).length === 0 && (
            <div className="hilfe-keine-ergebnisse">
              <span>Keine Ergebnisse für "{searchTerm}"</span>
            </div>
          )}
        </div>

        {/* Artikel-Inhalt */}
        {selectedArtikel && (
          <div className="hilfe-artikel-content">
            <div className="artikel-header">
              <h3>{selectedArtikel.titel}</h3>
              <button
                className="artikel-close"
                onClick={() => setSelectedArtikel(null)}
              >
                ×
              </button>
            </div>
            <div className="artikel-body">
              {formatContent(selectedArtikel.inhalt)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HilfeCenter;
