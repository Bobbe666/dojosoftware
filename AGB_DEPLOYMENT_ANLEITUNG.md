# 📋 AGB-Benachrichtigungssystem - Deployment-Anleitung

🎯 **Status:** Backend fertig, Migration vorbereitet

---

## ✅ WAS WURDE FERTIGGESTELLT

### 1. Backend-Implementierung ✅

**Neue Dateien:**
- ✅ `backend/routes/agb.js` - Vollständige API mit 4 Endpoints
- ✅ `backend/migrations/add_agb_versioning.sql` - Datenbank-Schema
- ✅ `backend/server.js` - Route eingebunden (Zeile 94-105)
- ✅ `AGB_BENACHRICHTIGUNG_FEATURE.md` - Vollständige Dokumentation

**Features:**
- ✅ Versionsverwaltung für AGB & Datenschutzerklärung
- ✅ Automatische E-Mail-Benachrichtigung an alle Mitglieder
- ✅ Tracking welches Mitglied welche Version akzeptiert hat
- ✅ Übersicht über Mitglieder die noch akzeptieren müssen
- ✅ Professionelle HTML-E-Mails mit Versionsinformationen
- ✅ DSGVO-konform mit Zeitstempeln

**API-Endpoints:**
```
GET    /api/agb/:dojoId                         - AGB & Datenschutz abrufen
PUT    /api/agb/:dojoId/update                  - Aktualisieren + E-Mail senden
GET    /api/agb/:dojoId/members-need-acceptance - Mitglieder ohne Akzeptanz
POST   /api/agb/member/:mitgliedId/accept       - Akzeptanz erfassen
```

---

## 🔧 WAS MUSS NOCH GEMACHT WERDEN

### FÜR LOKALE ENTWICKLUNG

#### 1. Migration in MySQL Workbench ausführen ⏳

**Schritte:**
1. Öffne MySQL Workbench
2. Verbinde dich mit deiner lokalen Datenbank
3. Öffne die Datei: `C:\dojosoftware\backend\migrations\add_agb_versioning.sql`
4. Führe das Script aus (Blitz-Symbol ⚡ oder Strg+Shift+Enter)

**Oder kopiere und führe diesen SQL-Code aus:**

```sql
USE dojo;

-- Füge Spalten zur dojo-Tabelle hinzu
ALTER TABLE dojo
ADD COLUMN agb_text TEXT DEFAULT NULL COMMENT 'Aktueller AGB-Text';

ALTER TABLE dojo
ADD COLUMN agb_version VARCHAR(50) DEFAULT '1.0' COMMENT 'AGB-Versionsnummer';

ALTER TABLE dojo
ADD COLUMN agb_letzte_aenderung DATETIME DEFAULT NULL COMMENT 'Zeitpunkt der letzten AGB-Änderung';

ALTER TABLE dojo
ADD COLUMN datenschutz_text TEXT DEFAULT NULL COMMENT 'Aktueller Datenschutzerklärungs-Text';

ALTER TABLE dojo
ADD COLUMN datenschutz_version VARCHAR(50) DEFAULT '1.0' COMMENT 'Datenschutz-Versionsnummer';

ALTER TABLE dojo
ADD COLUMN datenschutz_letzte_aenderung DATETIME DEFAULT NULL COMMENT 'Zeitpunkt der letzten Datenschutz-Änderung';

-- Füge Spalten zur mitglieder-Tabelle hinzu
ALTER TABLE mitglieder
ADD COLUMN agb_akzeptiert_version VARCHAR(50) DEFAULT NULL COMMENT 'Akzeptierte AGB-Version';

ALTER TABLE mitglieder
ADD COLUMN agb_akzeptiert_am DATETIME DEFAULT NULL COMMENT 'Zeitpunkt der AGB-Akzeptanz';

ALTER TABLE mitglieder
ADD COLUMN datenschutz_akzeptiert_version VARCHAR(50) DEFAULT NULL COMMENT 'Akzeptierte Datenschutz-Version';

ALTER TABLE mitglieder
ADD COLUMN datenschutz_akzeptiert_am DATETIME DEFAULT NULL COMMENT 'Zeitpunkt der Datenschutz-Akzeptanz';

-- Füge Indizes hinzu
ALTER TABLE mitglieder
ADD INDEX idx_agb_version (agb_akzeptiert_version);

ALTER TABLE mitglieder
ADD INDEX idx_datenschutz_version (datenschutz_akzeptiert_version);

SELECT 'Migration erfolgreich!' AS status;
```

**Erwartete Ausgabe:**
```
status
Migration erfolgreich!
```

---

### FÜR PRODUKTIVSYSTEM (SERVER)

#### 2. Code auf Server pushen ⏳

```bash
# Lokal - Code committen und pushen
cd C:\dojosoftware
git add .
git commit -m "Feature: AGB-Benachrichtigungssystem mit E-Mail-Versand

- Versionsverwaltung für AGB & Datenschutzerklärung
- Automatische E-Mail-Benachrichtigung an Mitglieder
- Tracking der Akzeptanz pro Mitglied
- API-Endpoints für CRUD-Operationen
- Migration für Datenbank-Schema"

git push
```

#### 3. Migration auf Server ausführen ⏳

**Option A - Via MySQL Workbench (empfohlen):**
1. Verbinde dich remote zu `dojo.tda-intl.org` Datenbank
2. Führe das gleiche SQL-Script aus wie lokal

**Option B - Via SSH:**
```bash
# Verbinde dich mit dem Server
ssh root@185.80.92.166

# Wechsle ins Projekt-Verzeichnis
cd /var/www/dojosoftware

# Hole die neuesten Änderungen
git pull

# Führe die Migration aus
mysql -u root -p dojo < backend/migrations/add_agb_versioning.sql
# Passwort eingeben: aaBobbe100aa$

# Prüfe ob die Spalten hinzugefügt wurden
mysql -u root -p -e "USE dojo; DESCRIBE dojo;" | grep agb
mysql -u root -p -e "USE dojo; DESCRIBE mitglieder;" | grep akzeptiert

# Backend neu starten
pm2 restart all
```

#### 4. E-Mail-Konfiguration prüfen ⏳

**In `.env` auf dem Server:**
```env
# E-Mail Konfiguration (für AGB-Benachrichtigungen)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=deine-email@gmail.com
EMAIL_PASS=dein-app-passwort
EMAIL_FROM=noreply@dojosoftware.com
```

**Falls noch nicht konfiguriert:**
1. Gmail: Erstelle ein App-Passwort unter https://myaccount.google.com/apppasswords
2. Oder nutze einen anderen SMTP-Server

**Test ob E-Mail funktioniert:**
```bash
# Auf dem Server
cd /var/www/dojosoftware/backend
node -e "
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransporter({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.sendMail({
  from: process.env.EMAIL_FROM,
  to: 'deine-test-email@example.com',
  subject: 'Test: AGB-Benachrichtigungssystem',
  text: 'Das E-Mail-System funktioniert!'
}, (err, info) => {
  if (err) console.error('❌ Fehler:', err);
  else console.log('✅ E-Mail gesendet:', info.messageId);
  process.exit(err ? 1 : 0);
});
"
```

---

### FÜR FRONTEND-ENTWICKLUNG

#### 5. AGB-Editor in DojoEdit.jsx implementieren ⏳

**Was muss gemacht werden:**

1. **State-Variablen hinzufügen:**
   ```javascript
   const [agbText, setAgbText] = useState('');
   const [agbVersion, setAgbVersion] = useState('1.0');
   const [agbLetzteAenderung, setAgbLetzteAenderung] = useState(null);
   const [datenschutzText, setDatenschutzText] = useState('');
   const [datenschutzVersion, setDatenschutzVersion] = useState('1.0');
   const [datenschutzLetzteAenderung, setDatenschutzLetzteAenderung] = useState(null);
   const [sendNotification, setSendNotification] = useState(true);
   const [membersNeedAcceptance, setMembersNeedAcceptance] = useState(0);
   ```

2. **AGB laden beim Component Mount:**
   ```javascript
   useEffect(() => {
     loadAGB();
   }, [dojoId]);

   const loadAGB = async () => {
     try {
       const response = await axios.get(`${config.apiBaseUrl}/agb/${dojoId}`);
       setAgbText(response.data.agb_text || '');
       setAgbVersion(response.data.agb_version || '1.0');
       setAgbLetzteAenderung(response.data.agb_letzte_aenderung);
       setDatenschutzText(response.data.datenschutz_text || '');
       setDatenschutzVersion(response.data.datenschutz_version || '1.0');
       setDatenschutzLetzteAenderung(response.data.datenschutz_letzte_aenderung);
     } catch (error) {
       console.error('Fehler beim Laden der AGB:', error);
     }
   };
   ```

3. **UI-Section hinzufügen** (siehe `AGB_BENACHRICHTIGUNG_FEATURE.md` für komplettes Beispiel)

4. **Speichern-Funktion:**
   ```javascript
   const saveAGB = async () => {
     try {
       const response = await axios.put(`${config.apiBaseUrl}/agb/${dojoId}/update`, {
         agb_text: agbText,
         agb_version: agbVersion,
         datenschutz_text: datenschutzText,
         datenschutz_version: datenschutzVersion,
         sendNotification: sendNotification
       });

       if (response.data.notifications) {
         alert(`✅ Gespeichert! E-Mails: ${response.data.notifications.sent}/${response.data.notifications.total} erfolgreich`);
       } else {
         alert('✅ Erfolgreich gespeichert!');
       }

       loadAGB(); // Neu laden
     } catch (error) {
       alert('❌ Fehler: ' + error.message);
     }
   };
   ```

**Geschätzte Arbeitszeit:** 2-3 Stunden

---

## 📊 DEPLOYMENT-CHECKLISTE

### Lokal (Development)
- ✅ Backend-Code erstellt
- ✅ Migration-Datei erstellt
- ⏳ Migration in MySQL Workbench ausführen
- ⏳ Backend testen mit curl/Postman
- ⏳ Frontend implementieren

### Server (Production)
- ⏳ Code auf GitHub pushen
- ⏳ Auf Server pullen (`git pull`)
- ⏳ Migration auf Server ausführen
- ⏳ E-Mail-Konfiguration prüfen/einrichten
- ⏳ Backend neu starten (`pm2 restart all`)
- ⏳ API testen
- ⏳ Frontend deployen

---

## 🧪 TESTING

### Backend-Tests (mit curl)

**1. AGB abrufen:**
```bash
curl http://localhost:3000/api/agb/1
```

**2. AGB aktualisieren (OHNE E-Mail):**
```bash
curl -X PUT http://localhost:3000/api/agb/1/update \
  -H "Content-Type: application/json" \
  -d '{
    "agb_text": "Test AGB Version 2.0...",
    "agb_version": "2.0",
    "sendNotification": false
  }'
```

**3. Mitglieder ohne Akzeptanz prüfen:**
```bash
curl http://localhost:3000/api/agb/1/members-need-acceptance
```

### E-Mail-Test

**WICHTIG:** Erst testen OHNE `sendNotification: true`, dann mit einer kleinen Test-Gruppe!

```bash
# Test mit 1 Mitglied
# 1. In DB ein Test-Mitglied anlegen mit deiner E-Mail
# 2. Dann curl mit sendNotification: true
```

---

## 🎯 ZUSAMMENFASSUNG

### ✅ FERTIG (Backend)
1. ✅ API-Routes implementiert (`backend/routes/agb.js`)
2. ✅ Route in server.js eingebunden
3. ✅ E-Mail-Versand-Logik fertig
4. ✅ Migration-Script erstellt
5. ✅ Dokumentation geschrieben

### ⏳ NOCH ZU TUN (Deployment)
1. ⏳ **Migration lokal ausführen** (MySQL Workbench)
2. ⏳ **Migration auf Server ausführen** (SSH oder MySQL Workbench)
3. ⏳ **E-Mail-Credentials konfigurieren** (`.env` auf Server)
4. ⏳ **Code auf Server deployen** (git push + pull)
5. ⏳ **Backend neu starten** (pm2 restart all)

### ⏳ NOCH ZU TUN (Frontend)
6. ⏳ **AGB-Editor in DojoEdit.jsx** (~2-3 Stunden)
7. ⏳ **Akzeptanz-Dialog im Mitglieder-Login** (~1-2 Stunden)

---

## 💡 NÄCHSTER SCHRITT

**JETZT SOFORT:**
1. Öffne MySQL Workbench
2. Verbinde dich mit der lokalen `dojo` Datenbank
3. Führe das SQL-Script aus (siehe oben)
4. Prüfe ob die Spalten da sind: `DESCRIBE dojo;` und `DESCRIBE mitglieder;`

**DANACH:**
5. Backend lokal testen mit curl
6. Wenn erfolgreich → auf Server deployen
7. Frontend implementieren

---

**Benötigst du Hilfe bei einem dieser Schritte?** Sag Bescheid! 🚀
