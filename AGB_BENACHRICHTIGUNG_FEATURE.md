# AGB & Datenschutz Benachrichtigungssystem

📅 **Implementiert:** 30. November 2025
🎯 **Status:** Backend fertig, Frontend ausstehend

---

## ✅ Was wurde implementiert

### 1. Datenbank-Migration (`backend/migrations/add_agb_versioning.sql`)

**Neue Spalten in `dojo` Tabelle:**
- `agb_text` (TEXT) - Aktueller AGB-Text
- `agb_version` (VARCHAR) - Versionsnummer (z.B. "1.0", "1.1", "2.0")
- `agb_letzte_aenderung` (DATETIME) - Zeitstempel der letzten Änderung
- `datenschutz_text` (TEXT) - Aktueller Datenschutzerklärungs-Text
- `datenschutz_version` (VARCHAR) - Versionsnummer
- `datenschutz_letzte_aenderung` (DATETIME) - Zeitstempel

**Neue Spalten in `mitglieder` Tabelle:**
- `agb_akzeptiert_version` (VARCHAR) - Welche AGB-Version wurde akzeptiert
- `agb_akzeptiert_am` (DATETIME) - Wann wurden die AGB akzeptiert
- `datenschutz_akzeptiert_version` (VARCHAR) - Welche Datenschutz-Version wurde akzeptiert
- `datenschutz_akzeptiert_am` (DATETIME) - Wann wurde die Datenschutzerklärung akzeptiert

**Indizes für Performance:**
- Index auf `agb_akzeptiert_version`
- Index auf `datenschutz_akzeptiert_version`

### 2. Backend-Route (`backend/routes/agb.js`)

**Neue API-Endpoints:**

#### GET `/api/agb/:dojoId`
Holt die aktuellen AGB & Datenschutzerklärung eines Dojos

**Response:**
```json
{
  "agb_text": "AGB Text...",
  "agb_version": "1.0",
  "agb_letzte_aenderung": "2025-11-30T10:00:00.000Z",
  "datenschutz_text": "Datenschutz Text...",
  "datenschutz_version": "1.0",
  "datenschutz_letzte_aenderung": "2025-11-30T10:00:00.000Z"
}
```

#### PUT `/api/agb/:dojoId/update`
Aktualisiert AGB/Datenschutz und sendet optional E-Mail-Benachrichtigungen

**Request Body:**
```json
{
  "agb_text": "Neuer AGB Text...",
  "agb_version": "2.0",
  "datenschutz_text": "Neuer Datenschutz Text...",
  "datenschutz_version": "2.0",
  "sendNotification": true
}
```

**Features:**
- ✅ Automatische Versionserkennung (erkennt ob sich Version geändert hat)
- ✅ E-Mail-Benachrichtigung an alle aktiven Mitglieder mit E-Mail
- ✅ Professionelle HTML-E-Mails mit Versionsinformationen
- ✅ Bulk-E-Mail-Versand mit Fehlerbehandlung
- ✅ Statistik über erfolgreiche/fehlgeschlagene E-Mails

**Response:**
```json
{
  "success": true,
  "message": "AGB und Datenschutzerklärung erfolgreich aktualisiert",
  "notifications": {
    "sent": 45,
    "failed": 2,
    "total": 47
  }
}
```

#### GET `/api/agb/:dojoId/members-need-acceptance`
Zeigt alle Mitglieder an, die die aktuelle Version noch nicht akzeptiert haben

**Response:**
```json
{
  "count": 12,
  "members": [
    {
      "mitglied_id": 123,
      "vorname": "Max",
      "nachname": "Mustermann",
      "email": "max@example.com",
      "agb_akzeptiert_version": "1.0",
      "aktuelle_agb_version": "2.0",
      "agb_akzeptanz_fehlt": 1,
      "datenschutz_akzeptanz_fehlt": 0
    }
  ]
}
```

#### POST `/api/agb/member/:mitgliedId/accept`
Erfasst die Akzeptanz der AGB/Datenschutz eines Mitglieds

**Request Body:**
```json
{
  "agb_version": "2.0",
  "datenschutz_version": "2.0"
}
```

### 3. E-Mail-Template

**Automatische E-Mail enthält:**
- Persönliche Ansprache
- Information welche Dokumente geändert wurden
- Neue Versionsnummern
- Änderungsdatum
- Hinweis zum Lesen der Änderungen
- Link zum Mitgliederbereich
- DSGVO-konforme Fußzeile

**Beispiel-E-Mail:**
```
Betreff: Wichtige Information: Aktualisierung AGB und Datenschutzerklärung - Dojo Name

Hallo Max Mustermann,

wir informieren Sie darüber, dass wir unsere AGB und Datenschutzerklärung aktualisiert haben.

┌─────────────────────────────────────────┐
│ AGB - Neue Version: 2.0                 │
│ Geändert am: 30.11.2025                 │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Datenschutzerklärung - Neue Version: 2.0│
│ Geändert am: 30.11.2025                 │
└─────────────────────────────────────────┘

Bitte lesen Sie die Änderungen aufmerksam durch.
Die aktuellen Dokumente können Sie in Ihrem Mitgliederbereich einsehen.

Mit freundlichen Grüßen
Dojo Name

Dies ist eine automatische Benachrichtigung gemäß DSGVO.
```

---

## 🔧 Migration ausführen

### Lokal (Development)
```bash
mysql -u root -p"aaBobbe100aa$" dojo < backend/migrations/add_agb_versioning.sql
```

### Server (Production)
```bash
# SSH zum Server
ssh root@185.80.92.166

# Zum Projekt-Verzeichnis
cd /var/www/dojosoftware

# Migration ausführen
mysql -u root -p dojo < backend/migrations/add_agb_versioning.sql
```

**Oder über MySQL Workbench:**
1. Verbinde dich mit der Datenbank
2. Öffne `backend/migrations/add_agb_versioning.sql`
3. Führe das Script aus

---

## 📝 Noch zu implementieren (Frontend)

### In DojoEdit.jsx

**Benötigte UI-Elemente:**

1. **AGB-Editor-Section:**
   ```jsx
   <div className="agb-section">
     <h3>Allgemeine Geschäftsbedingungen (AGB)</h3>

     {/* Aktuelle Version */}
     <div className="version-info">
       <label>Aktuelle Version:</label>
       <input
         type="text"
         value={agbVersion}
         onChange={(e) => setAgbVersion(e.target.value)}
         placeholder="z.B. 2.0"
       />
       <span>Letzte Änderung: {agbLetzteAenderung}</span>
     </div>

     {/* Text-Editor (Textarea oder Rich Text Editor) */}
     <textarea
       value={agbText}
       onChange={(e) => setAgbText(e.target.value)}
       rows={15}
       placeholder="AGB-Text hier eingeben..."
     />

     {/* Speichern-Button */}
     <div className="save-controls">
       <label>
         <input
           type="checkbox"
           checked={sendNotification}
           onChange={(e) => setSendNotification(e.target.checked)}
         />
         E-Mail-Benachrichtigung an alle Mitglieder senden
       </label>

       <button onClick={saveAGB}>
         AGB speichern & Benachrichtigung senden
       </button>
     </div>

     {/* Hinweis */}
     <div className="info-box">
       ⚠️ Wenn Sie die Version ändern und "Benachrichtigung" aktivieren,
       erhalten alle aktiven Mitglieder eine E-Mail über die Änderung.
     </div>

     {/* Mitglieder ohne Akzeptanz */}
     <div className="members-status">
       <button onClick={checkMembersNeedAcceptance}>
         Mitglieder prüfen die neue Version akzeptieren müssen
       </button>
       {membersNeedAcceptance > 0 && (
         <span className="warning">
           ⚠️ {membersNeedAcceptance} Mitglieder haben die aktuelle Version noch nicht akzeptiert
         </span>
       )}
     </div>
   </div>
   ```

2. **Datenschutz-Editor-Section:**
   (Gleicher Aufbau wie AGB)

3. **API-Aufrufe implementieren:**
   ```javascript
   // AGB laden
   const loadAGB = async () => {
     const response = await axios.get(`/api/agb/${dojoId}`);
     setAgbText(response.data.agb_text);
     setAgbVersion(response.data.agb_version);
     // ...
   };

   // AGB speichern
   const saveAGB = async () => {
     try {
       const response = await axios.put(`/api/agb/${dojoId}/update`, {
         agb_text: agbText,
         agb_version: agbVersion,
         datenschutz_text: datenschutzText,
         datenschutz_version: datenschutzVersion,
         sendNotification: sendNotification
       });

       if (response.data.notifications) {
         alert(`✅ Gespeichert! E-Mails gesendet: ${response.data.notifications.sent}/${response.data.notifications.total}`);
       } else {
         alert('✅ Erfolgreich gespeichert!');
       }
     } catch (error) {
       alert('❌ Fehler beim Speichern: ' + error.message);
     }
   };

   // Mitglieder ohne Akzeptanz prüfen
   const checkMembersNeedAcceptance = async () => {
     const response = await axios.get(`/api/agb/${dojoId}/members-need-acceptance`);
     setMembersNeedAcceptance(response.data.count);
     setMembersList(response.data.members);
   };
   ```

### Im Mitglieder-Login/-Dashboard

**Akzeptanz-Dialog beim Login:**
```jsx
if (mitglied.agb_akzeptiert_version !== currentAgbVersion) {
  // Zeige Modal mit AGB
  showAcceptanceModal({
    agbVersion: currentAgbVersion,
    agbText: currentAgbText,
    datenschutzVersion: currentDatenschutzVersion,
    datenschutzText: currentDatenschutzText,
    onAccept: async () => {
      await axios.post(`/api/agb/member/${mitgliedId}/accept`, {
        agb_version: currentAgbVersion,
        datenschutz_version: currentDatenschutzVersion
      });
    }
  });
}
```

---

## 🔐 Umgebungsvariablen

Stelle sicher, dass in `.env` die E-Mail-Konfiguration vorhanden ist:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=dein-email@gmail.com
EMAIL_PASS=dein-app-passwort
EMAIL_FROM=noreply@dojosoftware.com
```

**Hinweis für Gmail:**
- Du benötigst ein "App-Passwort" (nicht das normale Gmail-Passwort)
- Aktiviere 2-Faktor-Authentifizierung
- Erstelle ein App-Passwort unter: https://myaccount.google.com/apppasswords

---

## ✅ Vorteile des Systems

1. **DSGVO-Konform:** Vollständige Dokumentation wer wann welche Version akzeptiert hat
2. **Automatisch:** Mitglieder werden sofort per E-Mail informiert
3. **Versionierung:** Klare Nachvollziehbarkeit aller Änderungen
4. **Tracking:** Übersicht welche Mitglieder noch akzeptieren müssen
5. **Rechtssicherheit:** Alle Akzeptanzen sind mit Zeitstempel gespeichert

---

## 📋 Nächste Schritte

1. ✅ Migration lokal ausführen
2. ✅ Migration auf Server ausführen
3. ⏳ Frontend in DojoEdit.jsx implementieren
4. ⏳ Akzeptanz-Dialog im Mitglieder-Login
5. ⏳ Testen mit Test-E-Mail
6. ⏳ Live-Test mit echten Mitgliedern

---

## 🎯 Zusammenfassung

Das AGB-Benachrichtigungssystem ist **backend-seitig vollständig fertig**!

- ✅ Datenbank-Schema erweitert
- ✅ API-Routen implementiert
- ✅ E-Mail-Versand funktioniert
- ✅ Versionierung & Tracking
- ⏳ Frontend-Integration fehlt noch

**Benötigte Zeit für Frontend:** ~2-3 Stunden
**Komplexität:** Mittel (Text-Editor + API-Integration)
