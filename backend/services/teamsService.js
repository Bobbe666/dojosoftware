// ============================================================================
// Microsoft Teams Meeting Service (Graph API)
// Erstellt Online-Meetings über die Microsoft Graph API.
//
// Benötigte .env-Variablen:
//   TEAMS_TENANT_ID       — Azure AD Tenant ID
//   TEAMS_CLIENT_ID       — App Registration Client ID
//   TEAMS_CLIENT_SECRET   — App Registration Client Secret
//   TEAMS_ORGANIZER_ID    — Object ID oder UPN des Teams-Nutzers, der die
//                           Meetings als Organisator anlegt (z.B. admin@domain.de)
//
// Azure-Setup:
//   1. portal.azure.com → Azure Active Directory → App registrations → Neu
//   2. Certificates & secrets → New client secret → Wert notieren
//   3. API permissions → Add → Microsoft Graph → Application permissions:
//      OnlineMeetings.ReadWrite.All → Adminzustimmung erteilen
// ============================================================================

const https = require('https');

const TENANT_ID    = process.env.TEAMS_TENANT_ID;
const CLIENT_ID    = process.env.TEAMS_CLIENT_ID;
const CLIENT_SECRET = process.env.TEAMS_CLIENT_SECRET;
const ORGANIZER_ID = process.env.TEAMS_ORGANIZER_ID; // UPN oder Object-ID

function isConfigured() {
  return !!(TENANT_ID && CLIENT_ID && CLIENT_SECRET && ORGANIZER_ID);
}

// OAuth2 Access Token per client_credentials holen
async function getAccessToken() {
  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope:         'https://graph.microsoft.com/.default'
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'login.microsoftonline.com',
      path:     `/${TENANT_ID}/oauth2/v2.0/token`,
      method:   'POST',
      headers: {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.access_token) resolve(parsed.access_token);
          else reject(new Error(parsed.error_description || 'Token-Anfrage fehlgeschlagen'));
        } catch { reject(new Error('Ungültige Token-Antwort')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Teams Online-Meeting erstellen
// Gibt { joinUrl, meetingId } zurück
async function createMeeting({ subject, startTime, endTime }) {
  if (!isConfigured()) {
    throw new Error('Teams-Integration nicht konfiguriert. TEAMS_* Variablen in .env setzen.');
  }

  const token = await getAccessToken();

  const meetingBody = JSON.stringify({
    subject,
    startDateTime: new Date(startTime).toISOString(),
    endDateTime:   new Date(endTime).toISOString()
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'graph.microsoft.com',
      path:     `/v1.0/users/${encodeURIComponent(ORGANIZER_ID)}/onlineMeetings`,
      method:   'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(meetingBody)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.joinWebUrl) {
            resolve({ joinUrl: parsed.joinWebUrl, meetingId: parsed.id });
          } else {
            const errMsg = parsed.error?.message || 'Meeting konnte nicht erstellt werden';
            reject(new Error(errMsg));
          }
        } catch { reject(new Error('Ungültige Graph-API-Antwort')); }
      });
    });
    req.on('error', reject);
    req.write(meetingBody);
    req.end();
  });
}

module.exports = { createMeeting, isConfigured };
