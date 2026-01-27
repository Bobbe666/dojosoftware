# SEPA-Mandate Verwaltung - Dokumentation

## Übersicht

Dieses Dokument beschreibt die SEPA-Mandate Verwaltung und den Lastschriftlauf im DojoSoftware System.

---

## 🎯 Funktionen

### 1. SEPA-Mandate Verwaltung
- **Übersicht** aller SEPA-Mandate mit Filterung nach Status
- **Suche** nach Name, IBAN oder Mandatsreferenz
- **Statistiken** (Aktiv, Widerrufen, Abgelaufen)
- **Aktionen**: Anzeigen, Bearbeiten, Löschen

**Zugriff:** Dashboard → Beiträge → SEPA-Mandate

### 2. Lastschriftlauf
- **Automatische Erkennung** aller Mitglieder mit aktivem SEPA-Mandat
- **Vorschau** mit Gesamtsumme und Einzelpositionen
- **Export** als CSV (Deutsche Bank / Sparkasse) oder SEPA XML (pain.008)
- **Warnung** für Mitglieder mit Lastschrift ohne SEPA-Mandat

**Zugriff:** Dashboard → Beiträge → Lastschriften → Lastschriftlauf

---

## 📋 Voraussetzungen für Lastschriften

Ein Mitglied kann nur per Lastschrift eingezogen werden, wenn **alle** folgenden Bedingungen erfüllt sind:

1. ✅ **Aktiver Vertrag** (`vertraege.status = 'aktiv'`)
2. ✅ **Zahlungsmethode Lastschrift** (`mitglieder.zahlungsmethode = 'Lastschrift'` oder `'SEPA-Lastschrift'`)
3. ✅ **Aktives SEPA-Mandat** (`sepa_mandate.status = 'aktiv'`)
4. ✅ **Mandatsreferenz vorhanden** (`sepa_mandate.mandatsreferenz IS NOT NULL`)

---

## 🛠️ Testskript: SEPA-Mandate generieren

### Verwendung

Das Skript `generate-test-sepa-mandates.js` erstellt automatisch Test-SEPA-Mandate für alle Mitglieder mit Lastschrift-Verträgen, die noch kein aktives SEPA-Mandat haben.

```bash
cd C:\dojosoftware\Backend
node scripts/generate-test-sepa-mandates.js
```

### Was macht das Skript?

1. **Analysiert** alle aktiven Verträge mit Zahlungsmethode "Lastschrift"
2. **Prüft** welche Mitglieder noch kein aktives SEPA-Mandat haben
3. **Generiert** für jedes Mitglied:
   - Test-IBAN (deutsches Format)
   - Test-BIC (echte deutsche Banken)
   - Mandatsreferenz (`DOJO-{mitglied_id}-{timestamp}`)
   - Gläubiger-ID (`DE98ZZZ09999999999`)
4. **Erstellt** die SEPA-Mandate in der Datenbank
5. **Zeigt** Statistik der erstellten Mandate

### Beispiel-Output

```
🚀 SEPA-Mandate Generator für Testdaten
📊 Database: dojo

✅ Mit Datenbank verbunden

📋 Gefunden: 12 Mitglieder ohne SEPA-Mandat:

   1. Anna Beispiel (ID: 2) - 1 Vertrag
   2. Lena Berger (ID: 37) - 1 Vertrag
   ...

🔄 Erstelle SEPA-Mandate...

   ✅ Anna Beispiel: SEPA-Mandat erstellt (DOJO-2-1762449649795)
      IBAN: DE8918552056990000000000 | BIC: COBADEFFXXX | Bank: Commerzbank
   ✅ Lena Berger: SEPA-Mandat erstellt (DOJO-37-1762449649796)
      IBAN: DE8808577196240000000001 | BIC: DEUTDEFFXXX | Bank: Deutsche Bank
   ...

======================================================================
✅ Fertig! 12 von 12 SEPA-Mandaten erfolgreich erstellt
======================================================================

📊 Aktuelle SEPA-Mandate Statistik:
   Gesamt: 18
   Aktiv: 13
   Widerrufen: 5
   Abgelaufen: 0

🎉 Skript erfolgreich beendet!
```

---

## 🔍 API-Endpunkte

### SEPA-Mandate

| Endpunkt | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/sepa-mandate` | GET | Alle SEPA-Mandate abrufen |
| `/api/sepa-mandate/:mitglied_id/sepa-mandate` | GET | Mandate eines Mitglieds |
| `/api/sepa-mandate/:mitglied_id/sepa-mandate` | POST | Neues Mandat erstellen |
| `/api/sepa-mandate/:mitglied_id/sepa-mandate/:mandat_id` | PUT | Mandat aktualisieren |
| `/api/sepa-mandate/:mandat_id` | DELETE | Mandat löschen |

### Lastschriftlauf

| Endpunkt | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/lastschriftlauf` | GET | CSV-Datei generieren und herunterladen |
| `/api/lastschriftlauf/preview` | GET | JSON-Vorschau aller Lastschriften |
| `/api/lastschriftlauf/missing-mandates` | GET | Mitglieder mit Lastschrift ohne Mandat |

---

## 📊 Datenbank-Struktur

### Tabelle: `sepa_mandate`

```sql
CREATE TABLE sepa_mandate (
    mandat_id INT AUTO_INCREMENT PRIMARY KEY,
    mitglied_id INT NOT NULL,
    iban VARCHAR(34) NOT NULL,
    bic VARCHAR(11),
    bankname VARCHAR(100),
    kontoinhaber VARCHAR(100),
    mandatsreferenz VARCHAR(35) UNIQUE,
    glaeubiger_id VARCHAR(35),
    status ENUM('aktiv','widerrufen','abgelaufen'),
    mandat_typ ENUM('CORE','COR1','B2B'),
    sequenz ENUM('FRST','RCUR','OOFF','FNAL'),
    erstellungsdatum DATETIME,
    letzte_nutzung DATETIME,
    archiviert TINYINT(1) DEFAULT 0,
    provider ENUM('manual_sepa','stripe_datev'),
    FOREIGN KEY (mitglied_id) REFERENCES mitglieder(mitglied_id)
);
```

---

## ⚠️ Wichtige Hinweise

### Produktivbetrieb

⚠️ **WICHTIG:** Die generierten Test-IBANs und Test-BICs sind **NICHT für den Produktivbetrieb** geeignet!

Für den Produktivbetrieb müssen:
- ✅ Echte IBAN und BIC vom Mitglied eingegeben werden
- ✅ SEPA-Mandate rechtsgültig unterschrieben werden
- ✅ Gläubiger-ID bei der Bundesbank beantragt werden
- ✅ SEPA-Lastschriftverfahren mit der Bank abgestimmt werden

### Rechtliche Anforderungen

Ein SEPA-Mandat ist nur gültig wenn:
1. Es vom Kontoinhaber **unterschrieben** wurde
2. Es eine **eindeutige Mandatsreferenz** hat
3. Es die **Gläubiger-ID** enthält
4. Es dem Kontoinhaber **vor dem ersten Einzug** vorliegt

---

## 🎨 UI-Features

### Warnung für fehlende SEPA-Mandate

Wenn Mitglieder Lastschrift-Verträge haben, aber kein aktives SEPA-Mandat, wird im Lastschriftlauf eine **orangefarbene Warnbox** angezeigt mit:
- ⚠️ Anzahl betroffener Mitglieder
- 📋 Liste der ersten 5 Mitglieder (mit Vertragsanzahl)
- 🔗 Button "SEPA-Mandate verwalten" zur Verwaltungsseite

### Statistik-Dashboard

Der Lastschriftlauf zeigt folgende Statistiken:
- 👥 **Aktive Mandate**: Anzahl der Mitglieder mit Lastschrift
- 💶 **Gesamtbetrag**: Summe aller monatlichen Beiträge
- 📅 **Monat/Jahr**: Ausgewählter Abrechnungsmonat
- ✅ **Status**: Bereit oder fehlende Mandate

---

## 🚀 Workflow

### Neues Mitglied mit Lastschrift anlegen

1. **Mitglied erstellen** mit Zahlungsmethode "Lastschrift"
2. **Vertrag erstellen** (wird automatisch verknüpft)
3. **SEPA-Mandat anlegen**:
   - Manuell über "SEPA-Mandate verwalten"
   - Oder automatisch via Testskript (nur für Tests!)
4. **Lastschriftlauf prüfen**: Mitglied sollte jetzt in der Vorschau erscheinen
5. **CSV exportieren** und bei Bank einreichen

### Monatlicher Lastschriftlauf

1. **Dashboard → Beiträge → Lastschriften**
2. **Monat/Jahr auswählen**
3. **Vorschau prüfen**: Anzahl Mandate und Gesamtbetrag
4. **Warnung prüfen**: Fehlende Mandate nachpflegen falls nötig
5. **Format auswählen**: CSV oder XML
6. **Exportieren**: Datei herunterladen
7. **Bei Bank einreichen**: Via Online-Banking oder EBICS

---

## 📞 Support

Bei Fragen oder Problemen:
- 📧 Backend-Logs prüfen: `C:\dojosoftware\Backend\logs\`
- 🐛 Browser-Konsole prüfen (F12)
- 📊 Datenbank prüfen: MySQL Workbench oder phpMyAdmin

---

**Version:** 1.0
**Datum:** 2025-01-06
**Autor:** DojoSoftware Team
