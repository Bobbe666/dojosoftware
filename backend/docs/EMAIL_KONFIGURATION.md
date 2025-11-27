# 📧 E-Mail-Konfiguration für DojoSoftware

## Übersicht

Das DojoSoftware-System unterstützt den Versand von E-Mails über SMTP. Der E-Mail-Server ist bei **Alfahosting** gehostet.

## Was ist bereits implementiert?

### ✅ Backend-Services
- **`Backend/services/emailService.js`** - Zentraler E-Mail-Service mit folgenden Funktionen:
  - `sendEmail()` - Allgemeine E-Mail-Versand-Funktion
  - `sendVertragEmail()` - Spezielle Funktion für Vertragsversand mit PDF-Anhang
  - `createEmailTransporter()` - Erstellt und testet SMTP-Verbindung
  - `getEmailSettings()` - Lädt E-Mail-Einstellungen aus Datenbank oder Umgebungsvariablen

### ✅ API-Routen
- **`Backend/routes/emailService.js`** - API-Endpunkte für E-Mail-Verwaltung:
  - `GET /api/email-service/settings` - Einstellungen abrufen
  - `PUT /api/email-service/settings` - Einstellungen speichern
  - `POST /api/email-service/test` - Test-E-Mail versenden
  - `POST /api/email-service/send` - E-Mail versenden
  - `GET /api/email-service/verify` - SMTP-Verbindung testen

- **`Backend/routes/notifications.js`** - Erweiterte Benachrichtigungsfunktionen

### ✅ Datenbank
- Tabelle `notification_settings` für E-Mail-Konfiguration
- Tabelle `notifications` für Versandhistorie
- Tabelle `email_templates` für E-Mail-Vorlagen

### ✅ Dependencies
- `nodemailer` (v7.0.9) - E-Mail-Versand-Bibliothek

## Alfahosting SMTP-Konfiguration

### Standard-Einstellungen

Die Standard-Konfiguration ist bereits auf Alfahosting eingestellt:

```javascript
{
  smtp_host: 'smtp.alfahosting.de',
  smtp_port: 587,
  smtp_secure: false,  // STARTTLS wird verwendet
  smtp_user: 'ihre-email@ihre-domain.de',
  smtp_password: 'ihr-passwort'
}
```

### Alternative Ports

Falls Port 587 nicht funktioniert, können Sie auch folgende Ports verwenden:

- **Port 587** (STARTTLS) - Empfohlen, Standard
- **Port 465** (SSL/TLS) - Setzen Sie `smtp_secure: true`
- **Port 25** - Nur für lokale Verbindungen, nicht empfohlen

### Konfiguration über Umgebungsvariablen

Erstellen Sie eine `.env` Datei im `Backend`-Verzeichnis:

```env
# E-Mail-Konfiguration für Alfahosting
EMAIL_HOST=smtp.alfahosting.de
EMAIL_PORT=587
EMAIL_USER=ihre-email@ihre-domain.de
EMAIL_PASS=ihr-passwort
EMAIL_FROM=noreply@ihre-domain.de
```

### Konfiguration über Datenbank

Die E-Mail-Einstellungen können auch in der Datenbank gespeichert werden:

```sql
UPDATE notification_settings 
SET 
  email_enabled = TRUE,
  email_config = JSON_OBJECT(
    'smtp_host', 'smtp.alfahosting.de',
    'smtp_port', 587,
    'smtp_secure', false,
    'smtp_user', 'ihre-email@ihre-domain.de',
    'smtp_password', 'ihr-passwort'
  ),
  default_from_email = 'noreply@ihre-domain.de',
  default_from_name = 'Ihr Dojo Name'
WHERE id = 1;
```

## Verwendung

### E-Mail-Einstellungen konfigurieren

1. **Über API:**
```bash
PUT /api/email-service/settings
Content-Type: application/json

{
  "email_enabled": true,
  "email_config": {
    "smtp_host": "smtp.alfahosting.de",
    "smtp_port": 587,
    "smtp_secure": false,
    "smtp_user": "ihre-email@ihre-domain.de",
    "smtp_password": "ihr-passwort"
  },
  "default_from_email": "noreply@ihre-domain.de",
  "default_from_name": "Ihr Dojo Name"
}
```

2. **Test-E-Mail versenden:**
```bash
POST /api/email-service/test
Content-Type: application/json

{
  "to": "test@example.com",
  "subject": "Test-E-Mail",
  "message": "Dies ist eine Test-E-Mail"
}
```

3. **SMTP-Verbindung testen:**
```bash
GET /api/email-service/verify
```

### Im Code verwenden

```javascript
const emailService = require('./services/emailService');

// Einfache E-Mail versenden
const result = await emailService.sendEmail({
  to: 'mitglied@example.com',
  subject: 'Willkommen im Dojo!',
  html: '<h1>Willkommen!</h1><p>Vielen Dank für Ihre Anmeldung.</p>',
  text: 'Willkommen! Vielen Dank für Ihre Anmeldung.'
});

// Vertrags-E-Mail mit PDF versenden
const result = await emailService.sendVertragEmail({
  email: 'mitglied@example.com',
  vorname: 'Max',
  nachname: 'Mustermann',
  vertragsnummer: 'V-2025-001',
  pdfBuffer: pdfBuffer, // PDF als Buffer
  dojoname: 'Mein Dojo'
});
```

## Wichtige Hinweise für Alfahosting

### Versandlimits
- Alfahosting setzt je nach Tarif stündliche Versandlimits
- Beispiel: Multi L v2 = 150 E-Mails pro Stunde
- Überschreitungen führen zur Ablehnung weiterer E-Mails

### E-Mail-Größe
- Maximale E-Mail-Größe: **100 MB** (inklusive Anhänge)
- Größere E-Mails können nicht versendet werden

### Authentifizierung
- **Wichtig:** Die Authentifizierung muss aktiviert sein
- Benutzername: Vollständige E-Mail-Adresse
- Passwort: Das Passwort des E-Mail-Postfachs

### SSL/TLS-Verschlüsselung
- Port 587 verwendet STARTTLS (smtp_secure: false)
- Port 465 verwendet SSL/TLS (smtp_secure: true)
- `rejectUnauthorized: false` ist gesetzt für selbstsignierte Zertifikate

## Fehlerbehebung

### E-Mail wird nicht versendet

1. **SMTP-Verbindung testen:**
   ```bash
   GET /api/email-service/verify
   ```

2. **Logs prüfen:**
   - Backend-Logs: `Backend/logs/`
   - Suche nach "E-Mail" oder "SMTP"

3. **Häufige Probleme:**
   - Falsche Anmeldedaten
   - Port blockiert (Firewall)
   - Versandlimit erreicht
   - E-Mail-Adresse nicht in Alfahosting eingerichtet

### "E-Mail-Transporter konnte nicht erstellt werden"

- Prüfen Sie, ob `email_enabled` auf `true` gesetzt ist
- Prüfen Sie die SMTP-Konfiguration
- Prüfen Sie die Umgebungsvariablen

### "SMTP-Verbindung fehlgeschlagen"

- Prüfen Sie Host, Port und Anmeldedaten
- Prüfen Sie, ob der Port nicht blockiert ist
- Versuchen Sie alternativ Port 465 mit `smtp_secure: true`

## Nächste Schritte

### Was noch fehlt / zu implementieren:

1. **UI-Komponente für E-Mail-Einstellungen**
   - Frontend-Komponente zur Konfiguration der SMTP-Einstellungen
   - Integration in Einstellungen oder Admin-Bereich

2. **E-Mail-Templates-Verwaltung**
   - UI zur Verwaltung von E-Mail-Vorlagen
   - Template-Editor mit Variablen

3. **E-Mail-Versandhistorie**
   - UI zur Anzeige versendeter E-Mails
   - Status-Tracking (gesendet, fehlgeschlagen, zugestellt)

4. **Automatische E-Mails**
   - Willkommens-E-Mails bei neuer Registrierung
   - Beitragserinnerungen
   - Kursabsagen
   - Prüfungsbenachrichtigungen

5. **E-Mail-Queue**
   - Warteschlange für geplante E-Mails
   - Retry-Mechanismus bei Fehlern

## Support & Hilfe

- **Alfahosting Hilfe:** https://hilfe.alfahosting.de
- **SMTP-Server-Info:** Im Alfahosting Kundencenter unter "Meine Verträge" > "Server-Info"
- **Nodemailer Dokumentation:** https://nodemailer.com/



