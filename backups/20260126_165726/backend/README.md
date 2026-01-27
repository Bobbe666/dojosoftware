# DojoSoftware Backend

Node.js/Express Backend-Server für die DojoSoftware Mitgliederverwaltung.

## Überblick

Das Backend bietet eine RESTful API für die Verwaltung von Dojos, Mitgliedern, Verträgen, SEPA-Mandaten, Kursen, Check-Ins und mehr. Es verwendet MySQL als Datenbank und JWT für Authentifizierung.

## Technologie-Stack

- **Node.js** (v16+)
- **Express.js** - Web-Framework
- **MySQL** - Datenbank
- **JWT** - Authentifizierung
- **bcrypt** - Passwort-Hashing
- **Multer** - Datei-Upload-Middleware
- **Puppeteer** - PDF-Generierung
- **CORS** - Cross-Origin Resource Sharing

## Installation

```bash
npm install
```

## Konfiguration

Erstellen Sie eine `.env` Datei im Backend-Verzeichnis:

```env
# Datenbankverbindung
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=IhrPasswort
DB_NAME=dojo

# Server-Konfiguration
PORT=3002
NODE_ENV=development

# JWT-Konfiguration
JWT_SECRET=IhrSicheresSecretMindestens32Zeichen
JWT_EXPIRES_IN=24h

# Gläubiger-ID für SEPA
GLAEUBIGER_ID=DE98ZZZ09999999999

# CORS-Konfiguration
CORS_ORIGIN=http://localhost:5173
```

## Datenbank-Setup

```bash
# MySQL-Datenbank erstellen
mysql -u root -p
CREATE DATABASE dojo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit;

# Schema und Migrationen importieren
mysql -u root -p dojo < database/migrations/create_all_tables.sql
```

## Server starten

```bash
# Entwicklungsmodus
node server.js

# oder mit npm
npm start

# Produktionsmodus
NODE_ENV=production node server.js
```

Der Server läuft standardmäßig auf `http://localhost:3002`.

## Projektstruktur

```
Backend/
├── config/
│   └── db.js                   # Datenbankkonfiguration
├── database/
│   └── migrations/             # SQL-Migrationen
│       ├── create_all_tables.sql
│       └── ...
├── middleware/
│   ├── auth.js                 # JWT-Authentifizierung
│   └── upload.js               # Multer Upload-Config
├── routes/
│   ├── auth.js                 # Login/Logout
│   ├── mitglieder.js           # Mitgliederverwaltung
│   ├── mitgliederDokumente.js  # Dokumentenverwaltung
│   ├── vertraege.js            # Vertragsverwaltung
│   ├── sepaMandate.js          # SEPA-Mandate
│   ├── kurse.js                # Kursverwaltung
│   ├── rechnungen.js           # Rechnungsverwaltung
│   ├── zahlungen.js            # Zahlungsverwaltung
│   ├── dashboard.js            # Dashboard-Statistiken
│   ├── dojo.js                 # Dojo-Verwaltung
│   └── ...
├── services/
│   ├── pdfGenerator.js         # PDF-Generierung (Puppeteer)
│   ├── sepaXmlGenerator.js     # SEPA XML-Generierung
│   └── vertragPdfGeneratorExtended.js
├── utils/
│   └── helpers.js              # Hilfsfunktionen
├── generated_documents/        # Generierte PDFs
├── uploads/                    # Hochgeladene Dateien
├── .env                        # Umgebungsvariablen
├── server.js                   # Express Server Entry Point
└── README.md                   # Diese Datei
```

## API-Dokumentation

### Basis-URL

```
http://localhost:3002/api
```

### Authentifizierung

Alle API-Endpunkte (außer `/api/auth/login`) erfordern einen gültigen JWT-Token im Authorization-Header:

```
Authorization: Bearer <token>
```

---

## API-Endpunkte

### Authentifizierung

#### POST `/api/auth/login`

Login für Benutzer.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": 1,
    "email": "user@example.com",
    "rolle": "admin",
    "dojo_id": 1
  }
}
```

#### POST `/api/auth/logout`

Logout (Client-seitig).

---

### Mitglieder

#### GET `/api/mitglieder`

Alle Mitglieder abrufen.

**Query Parameters:**
- `dojo_id` (optional) - Filter nach Dojo

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "mitglied_id": 1,
      "vorname": "Max",
      "nachname": "Mustermann",
      "email": "max@example.com",
      "status": "aktiv",
      "dojo_id": 1
    }
  ]
}
```

#### GET `/api/mitglieder/:id`

Einzelnes Mitglied mit allen Details abrufen.

**Response:**
```json
{
  "success": true,
  "data": {
    "mitglied_id": 1,
    "vorname": "Max",
    "nachname": "Mustermann",
    "email": "max@example.com",
    "telefon": "+49123456789",
    "geburtsdatum": "1990-01-01",
    "strasse": "Musterstraße 1",
    "plz": "12345",
    "ort": "Musterstadt",
    "status": "aktiv",
    "eintrittsdatum": "2024-01-01",
    "austrittsdatum": null,
    "foto_pfad": "/uploads/fotos/1.jpg",
    "nfc_id": "ABC123",
    "hausordnung_akzeptiert": 1,
    "ersthelfer_zustimmung": 1,
    "fotoerlaubnis_training": 1,
    "dojo_id": 1
  }
}
```

#### POST `/api/mitglieder`

Neues Mitglied erstellen.

**Request Body:**
```json
{
  "vorname": "Max",
  "nachname": "Mustermann",
  "email": "max@example.com",
  "telefon": "+49123456789",
  "geburtsdatum": "1990-01-01",
  "strasse": "Musterstraße 1",
  "plz": "12345",
  "ort": "Musterstadt",
  "dojo_id": 1,
  "eintrittsdatum": "2024-01-01"
}
```

**Response:**
```json
{
  "success": true,
  "mitglied_id": 1,
  "message": "Mitglied erfolgreich erstellt"
}
```

#### PUT `/api/mitglieder/:id`

Mitglied aktualisieren.

**Request Body:** Gleiche Struktur wie POST

#### DELETE `/api/mitglieder/:id`

Mitglied löschen (Soft Delete durch Status-Änderung).

---

### Mitglieder-Dokumente

#### GET `/api/mitglieder/:id/dokumente`

Alle Dokumente eines Mitglieds abrufen.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "dokumentname": "Mitgliedsantrag_Max_Mustermann.pdf",
      "dateipfad": "/generated_documents/...",
      "erstellt_am": "2024-01-01T10:00:00.000Z",
      "vorlage_id": 1
    }
  ]
}
```

#### POST `/api/mitglieder/:id/dokumente/generate`

PDF aus Vorlage generieren.

**Request Body:**
```json
{
  "vorlage_id": 1,
  "vertrag_id": 1
}
```

**Response:**
```json
{
  "success": true,
  "dokument_id": 1,
  "message": "Dokument erfolgreich generiert"
}
```

#### GET `/api/mitglieder/:id/dokumente/:dokumentId/download`

Dokument herunterladen.

**Response:** PDF-Datei

#### DELETE `/api/mitglieder/:id/dokumente/:dokumentId`

Dokument löschen.

---

### Verträge

#### GET `/api/vertraege`

Alle Verträge abrufen.

**Query Parameters:**
- `mitglied_id` (optional)
- `dojo_id` (optional)

#### GET `/api/vertraege/:id`

Einzelnen Vertrag abrufen.

#### POST `/api/vertraege`

Neuen Vertrag erstellen.

**Request Body:**
```json
{
  "mitglied_id": 1,
  "vorlage_id": 1,
  "startdatum": "2024-01-01",
  "monatsbeitrag": 50.00,
  "zahlungsintervall": "monatlich"
}
```

#### PUT `/api/vertraege/:id`

Vertrag aktualisieren.

#### DELETE `/api/vertraege/:id`

Vertrag löschen.

#### GET `/api/vertraege/:id/pdf`

Vertrags-PDF generieren und herunterladen.

---

### SEPA-Mandate

#### GET `/api/sepa/mitglied/:id`

Aktuelles SEPA-Mandat eines Mitglieds abrufen.

**Response:**
```json
{
  "success": true,
  "data": {
    "mandat_id": 1,
    "mandatsreferenz": "MAND-2024-001",
    "mitglied_id": 1,
    "kontoinhaber": "Max Mustermann",
    "iban": "DE89370400440532013000",
    "bic": "COBADEFFXXX",
    "erstellungsdatum": "2024-01-01",
    "glaeubiger_id": "DE98ZZZ09999999999",
    "status": "aktiv"
  }
}
```

#### GET `/api/sepa/mitglied/:id/archiviert`

Archivierte SEPA-Mandate eines Mitglieds.

#### POST `/api/sepa`

Neues SEPA-Mandat erstellen.

**Request Body:**
```json
{
  "mitglied_id": 1,
  "kontoinhaber": "Max Mustermann",
  "iban": "DE89370400440532013000",
  "bic": "COBADEFFXXX"
}
```

#### PUT `/api/sepa/:id/widerrufen`

SEPA-Mandat widerrufen.

#### GET `/api/sepa/:id/pdf`

SEPA-Mandat als PDF herunterladen.

#### POST `/api/sepa/xml/generate`

SEPA-XML-Datei für Lastschriften generieren.

**Request Body:**
```json
{
  "dojo_id": 1,
  "faellige_rechnungen": [1, 2, 3]
}
```

**Response:** SEPA XML-Datei

---

### Kurse

#### GET `/api/kurse`

Alle Kurse abrufen.

**Query Parameters:**
- `dojo_id` (optional)

#### GET `/api/kurse/:id`

Einzelnen Kurs mit Teilnehmern abrufen.

#### POST `/api/kurse`

Neuen Kurs erstellen.

**Request Body:**
```json
{
  "kursname": "Anfängerkurs Karate",
  "beschreibung": "Kurs für Anfänger",
  "trainer_id": 1,
  "dojo_id": 1,
  "max_teilnehmer": 20,
  "mindestalter": 6,
  "startdatum": "2024-01-01",
  "enddatum": "2024-12-31"
}
```

#### PUT `/api/kurse/:id`

Kurs aktualisieren.

#### DELETE `/api/kurse/:id`

Kurs löschen.

#### POST `/api/kurse/:id/teilnehmer`

Mitglied zu Kurs hinzufügen.

**Request Body:**
```json
{
  "mitglied_id": 1
}
```

#### DELETE `/api/kurse/:id/teilnehmer/:mitgliedId`

Mitglied aus Kurs entfernen.

#### POST `/api/kurse/:id/bewertung`

Kursbewertung abgeben.

---

### Check-In-System

#### POST `/api/checkin`

Check-In für Mitglied erstellen.

**Request Body:**
```json
{
  "nfc_id": "ABC123",
  "dojo_id": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "vorname": "Max",
    "nachname": "Mustermann",
    "foto_pfad": "/uploads/fotos/1.jpg",
    "checkin_zeit": "2024-01-01T10:00:00.000Z"
  },
  "message": "Check-In erfolgreich"
}
```

#### GET `/api/checkin/history`

Check-In-Historie abrufen.

**Query Parameters:**
- `dojo_id` (required)
- `date` (optional) - Format: YYYY-MM-DD
- `mitglied_id` (optional)

#### GET `/api/checkin/stats`

Check-In-Statistiken abrufen.

---

### Rechnungen

#### GET `/api/rechnungen`

Alle Rechnungen abrufen.

**Query Parameters:**
- `mitglied_id` (optional)
- `status` (optional): offen, bezahlt, überfällig

#### GET `/api/rechnungen/:id`

Einzelne Rechnung abrufen.

#### POST `/api/rechnungen`

Neue Rechnung erstellen.

**Request Body:**
```json
{
  "mitglied_id": 1,
  "vertrag_id": 1,
  "betrag": 50.00,
  "faelligkeitsdatum": "2024-02-01",
  "beschreibung": "Mitgliedsbeitrag Januar 2024"
}
```

#### PUT `/api/rechnungen/:id`

Rechnung aktualisieren.

#### POST `/api/rechnungen/:id/bezahlt`

Rechnung als bezahlt markieren.

#### GET `/api/rechnungen/:id/pdf`

Rechnung als PDF herunterladen.

#### POST `/api/rechnungen/generate-monthly`

Monatliche Rechnungen automatisch generieren.

---

### Zahlungen

#### GET `/api/zahlungen`

Alle Zahlungen abrufen.

**Query Parameters:**
- `mitglied_id` (optional)
- `rechnung_id` (optional)

#### POST `/api/zahlungen`

Neue Zahlung erfassen.

**Request Body:**
```json
{
  "rechnung_id": 1,
  "betrag": 50.00,
  "zahlungsdatum": "2024-01-15",
  "zahlungsmethode": "Lastschrift"
}
```

---

### Dashboard

#### GET `/api/dashboard/stats`

Dashboard-Statistiken abrufen.

**Query Parameters:**
- `dojo_id` (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "mitglieder_gesamt": 150,
    "mitglieder_aktiv": 142,
    "mitglieder_inaktiv": 8,
    "neue_mitglieder_monat": 5,
    "kurse_aktiv": 8,
    "offene_rechnungen": 12,
    "offener_betrag": 600.00,
    "checkins_heute": 45,
    "umsatz_monat": 7500.00
  }
}
```

---

### Dojo-Verwaltung

#### GET `/api/dojo`

Alle Dojos abrufen.

#### GET `/api/dojo/:id`

Einzelnes Dojo mit Einstellungen abrufen.

#### PUT `/api/dojo/:id`

Dojo-Einstellungen aktualisieren.

**Request Body:**
```json
{
  "name": "Karate Dojo Berlin",
  "hauptfarbe": "#FFD700",
  "akzentfarbe": "#FF6B35",
  "strasse": "Hauptstraße 1",
  "plz": "10115",
  "ort": "Berlin",
  "telefon": "+4930123456",
  "email": "info@dojo-berlin.de"
}
```

---

## Middleware

### Authentication Middleware (`middleware/auth.js`)

Schützt Routen durch JWT-Validierung:

```javascript
const authMiddleware = require('./middleware/auth');
router.get('/protected', authMiddleware, (req, res) => {
  // req.user enthält die dekodierten Token-Daten
});
```

### Upload Middleware (`middleware/upload.js`)

Konfiguriert Multer für Datei-Uploads:

```javascript
const upload = require('./middleware/upload');
router.post('/upload', upload.single('file'), (req, res) => {
  // req.file enthält die hochgeladene Datei
});
```

---

## Services

### PDF-Generierung (`services/pdfGenerator.js`)

Verwendet Puppeteer für PDF-Generierung aus HTML-Vorlagen mit Platzhalterersetzung.

**Platzhalter:**
- `{{vorname}}`, `{{nachname}}`
- `{{strasse}}`, `{{plz}}`, `{{ort}}`
- `{{geburtsdatum}}`, `{{eintrittsdatum}}`
- `{{monatsbeitrag}}`, `{{zahlungsintervall}}`
- etc.

### SEPA XML-Generierung (`services/sepaXmlGenerator.js`)

Erstellt SEPA-XML-Dateien für Lastschriften nach SEPA-Standard.

---

## Fehlerbehandlung

Alle API-Endpunkte verwenden ein einheitliches Fehlerformat:

```json
{
  "success": false,
  "error": "Fehlermeldung hier"
}
```

**HTTP-Status-Codes:**
- `200` - Erfolg
- `201` - Erfolgreich erstellt
- `400` - Bad Request (ungültige Eingabe)
- `401` - Unauthorized (fehlende/ungültige Authentifizierung)
- `403` - Forbidden (keine Berechtigung)
- `404` - Not Found
- `500` - Internal Server Error

---

## Sicherheit

- **JWT-Authentifizierung**: Alle geschützten Routen erfordern gültigen Token
- **Passwort-Hashing**: bcrypt mit Salt Rounds
- **SQL-Injection-Schutz**: Prepared Statements
- **CORS**: Konfiguriert für sichere Cross-Origin-Requests
- **Input-Validierung**: Validierung aller Eingabedaten

### Empfohlene Sicherheitsmaßnahmen für Produktion:

- Rate Limiting implementieren
- HTTPS verwenden
- Starke JWT-Secrets verwenden
- Regelmäßige Security-Updates
- Datenbank-Benutzer mit minimalen Rechten
- Input-Sanitization verbessern

---

## Logging

Aktuell werden Logs in der Konsole ausgegeben. Für Produktion wird empfohlen:

- **winston** oder **pino** für strukturiertes Logging
- Log-Rotation
- Error-Tracking (z.B. Sentry)

---

## Performance

### Empfohlene Optimierungen:

- Datenbank-Indizes auf häufig abgefragte Felder
- Query-Caching für häufige Abfragen
- Pagination bei großen Datenmengen
- Connection Pooling für Datenbank
- Redis für Session-/Cache-Management

---

## Testing

```bash
# Unit Tests
npm test

# Integration Tests
npm run test:integration
```

---

## Troubleshooting

### Häufige Probleme:

**Port bereits belegt:**
```bash
# Windows
netstat -ano | findstr :3002
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3002
kill -9 <PID>
```

**Datenbankverbindung fehlgeschlagen:**
- Überprüfen Sie DB-Credentials in `.env`
- Stellen Sie sicher, dass MySQL läuft
- Überprüfen Sie Firewall-Einstellungen

**JWT-Token ungültig:**
- Überprüfen Sie JWT_SECRET in `.env`
- Token könnte abgelaufen sein (siehe JWT_EXPIRES_IN)

---

## Weitere Dokumentation

- [Hauptprojekt README](../README.md)
- [Frontend README](../Frontend/README.md)
- [Datenbank-Schema](database/migrations/)

---

Letzte Aktualisierung: Oktober 2025
