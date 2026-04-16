// ============================================================================
// AKQUISE CRM ROUTES — Super-Admin
// Verwaltet Kontakte (Schulen/Verbände) für die Mitglieder-Akquise
// Protokolliert E-Mails, Briefe, Telefonate.
// Integriert mit TDA-Events (events.tda-intl.org) für Kontakt-Import.
// ============================================================================

const express = require('express');
const router = express.Router();
const https = require('https');
const db = require('../../db');
const logger = require('../../utils/logger');
const { requireSuperAdmin } = require('./shared');
const { sendEmailForDojo } = require('../../services/emailService');

const pool = db.promise();
const EVENTS_API_BASE = 'https://events.tda-intl.org/api';

// Alle Routen: Super-Admin only
router.use(requireSuperAdmin);

// ─── Helper: TDA-Events API ───────────────────────────────────────────────────
function fetchEventsApi(path) {
  return new Promise((resolve, reject) => {
    https.get(`${EVENTS_API_BASE}${path}`, { headers: { Accept: 'application/json' } }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse-Fehler: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

// ─── Platzhalter-Ersatz für E-Mail-Vorlagen ───────────────────────────────────
function ersetzePlatzhalter(text, kontakt, absender = {}) {
  if (!text) return text;
  const map = {
    '{{organisation}}':       kontakt.organisation || '',
    '{{ansprechpartner}}':    kontakt.ansprechpartner || '',
    '{{anrede}}':             kontakt.ansprechpartner ? `Sehr geehrte Damen und Herren` : 'Sehr geehrte Damen und Herren',
    '{{anrede_persoenlich}}': kontakt.ansprechpartner ? `Sehr geehrte/r ${kontakt.ansprechpartner}` : 'Sehr geehrte Damen und Herren',
    '{{email}}':              kontakt.email || '',
    '{{telefon}}':            kontakt.telefon || '',
    '{{strasse}}':            kontakt.strasse || '',
    '{{plz}}':                kontakt.plz || '',
    '{{ort}}':                kontakt.ort || '',
    '{{sportart}}':           kontakt.sportart || 'Kampfkunst',
    '{{absender_name}}':      absender.name || 'Tiger & Dragon Association - International',
    '{{absender_email}}':     absender.email || 'info@tda-intl.com',
    '{{absender_telefon}}':   absender.telefon || '',
    '{{absender_inhaber}}':   absender.inhaber || 'Sascha Schreiner',
    '{{absender_internet}}':  absender.internet || 'www.tda-intl.com',
    '{{datum}}':              new Date().toLocaleDateString('de-DE', { day:'2-digit', month:'long', year:'numeric' }),
  };
  return Object.entries(map).reduce((t, [k, v]) => t.replaceAll(k, v), text);
}

// ─── Standard-Vorlagen (werden beim ersten Aufruf angelegt) ──────────────────
const STANDARD_VORLAGEN = [
  {
    name: 'Erstanschreiben — Schulen/Vereine',
    typ: 'email',
    kategorie: 'erstanschreiben',
    betreff: 'Einladung zur Mitgliedschaft im TDA International Verband — {{organisation}}',
    html: `<p>{{anrede_persoenlich}},</p>
<p>mein Name ist {{absender_inhaber}}, und ich bin der Geschäftsführer des <strong>Tiger &amp; Dragon Association International (TDA-International)</strong> Verbands. Wir sind ein schnell wachsender Kampfkunst-Verband, der Schulen und Vereine dabei unterstützt, ihre Mitglieder optimal zu fördern, an nationalen Turnieren teilzunehmen und von einem starken Netzwerk zu profitieren.</p>
<p>Ich bin auf <strong>{{organisation}}</strong> aufmerksam geworden und würde mich sehr freuen, Ihnen die Vorteile einer Verbandsmitgliedschaft vorzustellen:</p>
<ul>
  <li>🏆 Teilnahme an offiziellen TDA-Turnieren mit Rangliste</li>
  <li>🥋 Zugang zum nationalen Prüfungssystem</li>
  <li>📚 Schulungen und Trainerausbildungen</li>
  <li>💻 Kostenlose Verwaltungssoftware für Ihre Schule</li>
  <li>🤝 Starkes Netzwerk von Schulen in ganz Deutschland</li>
</ul>
<p>Darf ich Ihnen in einem kurzen Gespräch mehr darüber erzählen? Ich freue mich auf Ihre Rückmeldung.</p>
<p>Mit freundlichen Grüßen,<br><strong>{{absender_inhaber}}</strong><br>{{absender_name}}<br>{{absender_email}} | {{absender_internet}}</p>`,
  },
  {
    name: 'Folgeanschreiben — Kein Kontakt',
    typ: 'email',
    kategorie: 'folgeanschreiben',
    betreff: 'Nochmals: TDA International Verband — {{organisation}}',
    html: `<p>{{anrede_persoenlich}},</p>
<p>ich hatte Ihnen vor einigen Wochen geschrieben und mich noch nicht bei Ihnen melden können. Ich möchte es daher nochmals versuchen und hoffe, dass meine Nachricht diesmal Ihren Weg findet.</p>
<p>Als <strong>{{organisation}}</strong> haben Sie sicher großes Potenzial — genau das macht Sie zu einem interessanten Partner für den TDA International Verband.</p>
<p>Falls Sie Fragen haben oder ein erstes Gespräch führen möchten, stehe ich gerne zur Verfügung.</p>
<p>Mit freundlichen Grüßen,<br><strong>{{absender_inhaber}}</strong><br>{{absender_name}}<br>{{absender_email}}</p>`,
  },
  {
    name: 'Angebot — Verbandsmitgliedschaft',
    typ: 'email',
    kategorie: 'angebot',
    betreff: 'Ihr persönliches Angebot — TDA Verbandsmitgliedschaft',
    html: `<p>{{anrede_persoenlich}},</p>
<p>vielen Dank für Ihr Interesse an einer Mitgliedschaft im TDA International Verband. Wie besprochen, sende ich Ihnen hiermit unser Angebot:</p>
<h3>Verbandsmitgliedschaft für Schulen/Vereine</h3>
<ul>
  <li><strong>Jahresbeitrag:</strong> 99 € pro Jahr</li>
  <li><strong>Inbegriffen:</strong> Turnier-Teilnahme, Verwaltungssoftware, Prüfungssystem, Trainernetzwerk</li>
  <li><strong>Startbonus:</strong> Erstes Jahr zum halben Preis (49 €) bei Anmeldung bis Ende des Monats</li>
</ul>
<p>Zur Anmeldung genügt ein kurzer Rückruf oder eine E-Mail — wir erledigen den Rest.</p>
<p>Mit freundlichen Grüßen,<br><strong>{{absender_inhaber}}</strong><br>{{absender_name}}<br>{{absender_email}}</p>`,
  },
  {
    name: 'Willkommen — Neues Verbandsmitglied',
    typ: 'email',
    kategorie: 'willkommen',
    betreff: 'Herzlich Willkommen im TDA International Verband! 🥋',
    html: `<p>{{anrede_persoenlich}},</p>
<p>herzlich willkommen in der TDA-Familie! Wir freuen uns sehr, <strong>{{organisation}}</strong> als neues Verbandsmitglied begrüßen zu dürfen.</p>
<p>In den nächsten Tagen erhalten Sie Ihren Zugang zur Verwaltungssoftware sowie alle Informationen zu unseren nächsten Turnieren und Veranstaltungen.</p>
<p>Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.</p>
<p>Auf eine erfolgreiche Zusammenarbeit!<br><strong>{{absender_inhaber}}</strong><br>{{absender_name}}</p>`,
  },
  {
    name: 'Erstanschreiben — Brief (Druck)',
    typ: 'brief',
    kategorie: 'erstanschreiben',
    betreff: 'Einladung zur Mitgliedschaft im TDA International Verband',
    html: `<p><strong>{{absender_name}}</strong><br>{{absender_inhaber}}<br>{{absender_email}}<br>{{absender_internet}}</p>
<br>
<p><strong>{{organisation}}</strong><br>z.H. {{ansprechpartner}}<br>{{strasse}}<br>{{plz}} {{ort}}</p>
<br>
<p>{{ort}}, den {{datum}}</p>
<br>
<p><strong>Betreff: Einladung zur Mitgliedschaft im TDA International Verband</strong></p>
<br>
<p>{{anrede_persoenlich}},</p>
<p>als einer der dynamisch wachsenden Kampfkunst-Verbände in Deutschland möchten wir Sie herzlich einladen, Teil des TDA International Verbands zu werden.</p>
<p>Die Vorteile einer Mitgliedschaft umfassen: offizielle Turnierteilnahme, Verwaltungssoftware, ein starkes Trainernetzwerk sowie Zugang zu Aus- und Weiterbildungsangeboten.</p>
<p>Wir würden uns sehr über eine positive Rückmeldung freuen und stehen für ein Gespräch jederzeit zur Verfügung.</p>
<p>Mit freundlichen Grüßen</p>
<br><br>
<p>{{absender_inhaber}}<br>{{absender_name}}</p>`,
  },
  {
    name: 'Software-Präsentation — Dojosoftware + TDA Events (E-Mail)',
    typ: 'email',
    kategorie: 'angebot',
    betreff: 'Komplettlösung für {{organisation}}: Vereinsverwaltung + Turniersoftware vom TDA International Verband',
    html: `<p>{{anrede_persoenlich}},</p>

<p>als Mitglied im <strong>Tiger &amp; Dragon Association International (TDA-International) Verband</strong> erhalten Sie nicht nur Zugang zu unserem Turniernetzwerk — wir stellen Ihnen auch eine leistungsstarke <strong>All-in-One-Verwaltungssoftware</strong> für Ihren Verein zur Verfügung, die speziell für Kampfkunstschulen und -vereine entwickelt wurde.</p>

<p>Im Folgenden möchte ich Ihnen einen Überblick geben, was <strong>{{organisation}}</strong> mit der TDA-Softwarelösung gewinnt:</p>

<hr style="border:none;border-top:2px solid #e5e7eb;margin:24px 0">

<h2 style="color:#1e3a5f;font-size:18px;margin-bottom:8px">🥋 Dojosoftware — Ihr Vereins-Management</h2>

<table style="width:100%;border-collapse:collapse;font-size:14px">
  <tr style="background:#f3f4f6">
    <td style="padding:8px 12px;font-weight:600;width:30%">Mitgliederverwaltung</td>
    <td style="padding:8px 12px">Vollständige Mitgliederdatenbank mit Profilen, Verlauf, CSV-Import, Interessenten-Tracking und Eltern-Portal für Minderjährige</td>
  </tr>
  <tr>
    <td style="padding:8px 12px;font-weight:600">Kurse &amp; Stundenplan</td>
    <td style="padding:8px 12px">Wöchentlicher Stundenplan für mehrere Standorte und Trainer — mit öffentlichem Aushang für Ihre Website</td>
  </tr>
  <tr style="background:#f3f4f6">
    <td style="padding:8px 12px;font-weight:600">Anwesenheit &amp; Check-In</td>
    <td style="padding:8px 12px">QR-Code-Scanner (Tablet/Handy), Echtzeit-Dashboard, Kalenderansicht und automatische Statistiken pro Mitglied</td>
  </tr>
  <tr>
    <td style="padding:8px 12px;font-weight:600">Prüfungen &amp; Graduierungen</td>
    <td style="padding:8px 12px">Prüfungsverwaltung, automatisches Gürtelgrad-Tracking, Entwicklungsziele, Badges und Leistungsmeilensteine</td>
  </tr>
  <tr style="background:#f3f4f6">
    <td style="padding:8px 12px;font-weight:600">Finanzen &amp; Rechnungen</td>
    <td style="padding:8px 12px">Flexible Tarifmodelle, automatische Rechnungen, SEPA-Lastschrift, Mahnwesen, EÜR-Generierung und DATEV-Export</td>
  </tr>
  <tr>
    <td style="padding:8px 12px;font-weight:600">Mitgliederbereich</td>
    <td style="padding:8px 12px">Persönliches Online-Portal mit Fortschrittsanzeige, Kalender-Sync (Google/Outlook) und mobiler PWA-App</td>
  </tr>
  <tr style="background:#f3f4f6">
    <td style="padding:8px 12px;font-weight:600">Kommunikation</td>
    <td style="padding:8px 12px">Internes Chat-System, Push-Benachrichtigungen und E-Mail-Kampagnen direkt aus der Software</td>
  </tr>
  <tr>
    <td style="padding:8px 12px;font-weight:600">Marketing</td>
    <td style="padding:8px 12px">Probe-Training-Buchung online, Buddy-/Referral-Programm, Rabattcodes und Kampagnenverwaltung</td>
  </tr>
  <tr style="background:#f3f4f6">
    <td style="padding:8px 12px;font-weight:600">Kasse &amp; Shop</td>
    <td style="padding:8px 12px">Point-of-Sale, Ausrüstungsverkauf, Zahlungsintegration (Stripe, PayPal, SumUp) und Gutscheinsystem</td>
  </tr>
</table>

<hr style="border:none;border-top:2px solid #e5e7eb;margin:24px 0">

<h2 style="color:#1e3a5f;font-size:18px;margin-bottom:8px">🏆 TDA Events — Professioneller Turnierbetrieb</h2>

<table style="width:100%;border-collapse:collapse;font-size:14px">
  <tr style="background:#f3f4f6">
    <td style="padding:8px 12px;font-weight:600;width:30%">Turnierverwaltung</td>
    <td style="padding:8px 12px">Komplette Turnier-Konfiguration (Kategorien, Divisionen, Preise), Frühbucherpreise, Kapazitätsgrenzen und Statusmanagement von der Planung bis zur Abrechnung</td>
  </tr>
  <tr>
    <td style="padding:8px 12px;font-weight:600">Anmeldung &amp; Registrierung</td>
    <td style="padding:8px 12px">Online-Anmeldung, Gewichtseintragung, ID-Card-Generierung (PDF), CSV-Massen-Upload und Wartelisten-Management</td>
  </tr>
  <tr style="background:#f3f4f6">
    <td style="padding:8px 12px;font-weight:600">Kampfverwaltung</td>
    <td style="padding:8px 12px">Automatische Bracket-Generierung (Single/Double Elimination), Echtzeit-Mattenplanung, Kampfrichter-Zuweisung und Live-Ergebniserfassung</td>
  </tr>
  <tr>
    <td style="padding:8px 12px;font-weight:600">Siegerehrung</td>
    <td style="padding:8px 12px">Platzierungs-Dashboard in Echtzeit, automatische Urkundengenerierung (PDF) und Podium-Anzeige</td>
  </tr>
  <tr style="background:#f3f4f6">
    <td style="padding:8px 12px;font-weight:600">Saison-Rangliste</td>
    <td style="padding:8px 12px">ELO-/Punktbasiertes Ranking pro Division, öffentliche Ranglisten-Seite einbettbar auf Ihrer Website, historisches Archiv</td>
  </tr>
  <tr>
    <td style="padding:8px 12px;font-weight:600">Live &amp; Publikum</td>
    <td style="padding:8px 12px">Live-Anzeige auf Arena-Bildschirmen, Zuschauer-Dashboard mit Echtzeitergebnissen und YouTube/Streaming-Integration</td>
  </tr>
</table>

<hr style="border:none;border-top:2px solid #e5e7eb;margin:24px 0">

<h2 style="color:#1e3a5f;font-size:18px;margin-bottom:8px">🔗 Integration beider Systeme</h2>

<table style="width:100%;border-collapse:collapse;font-size:14px">
  <tr style="background:#f3f4f6">
    <td style="padding:8px 12px;font-weight:600;width:35%">Wettkämpfer-Export</td>
    <td style="padding:8px 12px">Ihre Mitglieder direkt aus der Vereinsverwaltung als Turnierteilnehmer anmelden — kein doppeltes Erfassen</td>
  </tr>
  <tr>
    <td style="padding:8px 12px;font-weight:600">Turnierergebnisse im Profil</td>
    <td style="padding:8px 12px">Platzierungen werden automatisch im Mitgliederprofil sichtbar und fließen ins Kader-Tracking ein</td>
  </tr>
  <tr style="background:#f3f4f6">
    <td style="padding:8px 12px;font-weight:600">Club-Ranking</td>
    <td style="padding:8px 12px">Verbandsrangliste Ihres Vereins live im Club-Dashboard sichtbar</td>
  </tr>
  <tr>
    <td style="padding:8px 12px;font-weight:600">Startgebühren-Abrechnung</td>
    <td style="padding:8px 12px">Turnier-Startgebühren optional über das Dojo-Rechnungssystem abgewickelt — alles in einer Buchhaltung</td>
  </tr>
</table>

<hr style="border:none;border-top:2px solid #e5e7eb;margin:24px 0">

<p><strong>Besonders relevant für {{organisation}}:</strong><br>
Unsere Multi-Tenant-Architektur bedeutet: Ihr Verein bekommt eine eigene, vollständig isolierte Umgebung — inklusive eigener Subdomain und optionalem eigenem Branding. Alle Daten bleiben bei Ihnen.</p>

<p>Ich würde Ihnen gerne in einem persönlichen Demo-Gespräch zeigen, wie das System für <strong>{{sportart}}</strong> optimal konfiguriert werden kann. Dauert nicht länger als 30 Minuten — und Sie werden direkt sehen, was Sie gewinnen.</p>

<p>Wann hätten Sie kurz Zeit?</p>

<p>Mit freundlichen Grüßen,<br>
<strong>{{absender_inhaber}}</strong><br>
{{absender_name}}<br>
<a href="mailto:{{absender_email}}">{{absender_email}}</a> | <a href="https://{{absender_internet}}">{{absender_internet}}</a></p>`,
  },
  {
    name: 'Software-Präsentation — Dojosoftware + TDA Events (Brief)',
    typ: 'brief',
    kategorie: 'angebot',
    betreff: 'Komplettlösung für Kampfkunstvereine: Dojosoftware + TDA Events Turniersystem',
    html: `<div style="font-family:Arial,sans-serif;font-size:12pt;line-height:1.6;color:#111">

<table style="width:100%;margin-bottom:40px">
  <tr>
    <td style="vertical-align:top">
      <strong>{{absender_name}}</strong><br>
      {{absender_inhaber}}<br>
      {{absender_email}}<br>
      {{absender_internet}}
    </td>
  </tr>
</table>

<table style="width:100%;margin-bottom:32px">
  <tr>
    <td>
      <strong>{{organisation}}</strong><br>
      z. H. {{ansprechpartner}}<br>
      {{strasse}}<br>
      {{plz}} {{ort}}
    </td>
  </tr>
</table>

<p>{{ort}}, den {{datum}}</p>

<p><strong>Betreff: Komplettlösung für {{organisation}} — Dojosoftware + TDA Events Turniersystem</strong></p>

<p>{{anrede_persoenlich}},</p>

<p>als Teil des <strong>Tiger &amp; Dragon Association International (TDA-International) Verbands</strong> erhalten Sie Zugang zu zwei leistungsstarken Systemen, die speziell für Kampfkunstvereine entwickelt wurden und nahtlos ineinandergreifen.</p>

<p><strong>1. Dojosoftware — Vereinsverwaltung</strong></p>

<p>Die Dojosoftware deckt den gesamten Vereinsalltag von <strong>{{organisation}}</strong> ab:</p>

<ul>
  <li><strong>Mitglieder:</strong> Vollständige Datenbank, Interessenten-Tracking, Eltern-Portal, CSV-Import</li>
  <li><strong>Kurse &amp; Anwesenheit:</strong> Stundenplan für mehrere Standorte, QR-Code-Check-In, Statistiken</li>
  <li><strong>Prüfungen:</strong> Gürtelgrad-Tracking, Badges, Leistungsmeilensteine, Kader-Tracking</li>
  <li><strong>Finanzen:</strong> Automatische Rechnungen, SEPA-Lastschrift, Mahnwesen, DATEV-Export, EÜR</li>
  <li><strong>Mitgliederbereich:</strong> Online-Portal mit App (PWA), Kalender-Sync, eigene Subdomain</li>
  <li><strong>Kasse &amp; Shop:</strong> Point-of-Sale, Ausrüstungsverkauf, Stripe/PayPal/SumUp-Integration</li>
  <li><strong>Marketing:</strong> Probe-Training-Buchung, Referral-Programm, Kampagnenverwaltung</li>
  <li><strong>Datenschutz:</strong> DSGVO-konform, vollständige Datenisolierung, Audit-Log</li>
</ul>

<p><strong>2. TDA Events — Turnierbetrieb</strong></p>

<p>Für den Wettkampfbetrieb steht die TDA Events Plattform zur Verfügung:</p>

<ul>
  <li><strong>Turnierverwaltung:</strong> Komplette Konfiguration, Kategorien, Preise, Frühbucherangebote</li>
  <li><strong>Anmeldung:</strong> Online-Registrierung, ID-Cards, Gewichtseintragung, CSV-Upload</li>
  <li><strong>Kampfbetrieb:</strong> Automatische Brackets, Echtzeit-Mattenplanung, Live-Ergebniserfassung</li>
  <li><strong>Siegerehrung:</strong> Automatische Urkunden (PDF), Podium-Anzeige, Ergebnisarchiv</li>
  <li><strong>Rangliste:</strong> Saisonrangliste pro Division, einbettbar auf Ihrer Vereinswebsite</li>
</ul>

<p><strong>3. Verbindung beider Systeme</strong></p>

<p>Wettkämpfer aus der Vereinsverwaltung werden direkt als Turnierteilnehmer übernommen — ohne doppelte Dateneingabe. Turnierergebnisse fließen automatisch ins Mitgliederprofil ein. Startgebühren können über die Vereinsbuchhaltung abgerechnet werden.</p>

<p>Ich würde Ihnen das System gerne in einem persönlichen Gespräch vorstellen — ca. 30 Minuten, auf Wunsch auch als Video-Call. Bitte teilen Sie mir mit, wann es Ihnen passt.</p>

<p>Mit freundlichen Grüßen</p>

<br><br>

<p>{{absender_inhaber}}<br>
{{absender_name}}<br>
{{absender_email}} | {{absender_internet}}</p>

</div>`,
  },
];

// Vorlagen in DB anlegen — idempotent per Name, ergänzt fehlende Templates
async function ensureVorlagenExist() {
  try {
    const [existing] = await pool.query('SELECT name FROM akquise_vorlagen');
    const existingNames = new Set(existing.map(r => r.name));
    let added = 0;
    for (const v of STANDARD_VORLAGEN) {
      if (!existingNames.has(v.name)) {
        await pool.query(
          'INSERT INTO akquise_vorlagen (name, typ, kategorie, betreff, html) VALUES (?, ?, ?, ?, ?)',
          [v.name, v.typ, v.kategorie, v.betreff, v.html]
        );
        added++;
      }
    }
    if (added > 0) logger.info(`[Akquise] ${added} Standard-Vorlagen ergänzt`);
  } catch (err) {
    logger.debug('[Akquise] Vorlagen noch nicht anlegen (Tabelle fehlt?)');
  }
}

// ============================================================================
// VORLAGEN
// ============================================================================

router.get('/vorlagen', async (req, res) => {
  await ensureVorlagenExist();
  try {
    const [vorlagen] = await pool.query(
      'SELECT * FROM akquise_vorlagen ORDER BY kategorie, name'
    );
    res.json({ success: true, vorlagen });
  } catch (err) {
    // Tabelle fehlt → leere Liste
    res.json({ success: true, vorlagen: STANDARD_VORLAGEN.map((v, i) => ({ id: -(i+1), ...v })) });
  }
});

router.post('/vorlagen', async (req, res) => {
  const { name, typ, kategorie, betreff, html } = req.body;
  if (!name || !html) return res.status(400).json({ success: false, message: 'Name und Inhalt sind Pflichtfelder' });
  try {
    const [result] = await pool.query(
      'INSERT INTO akquise_vorlagen (name, typ, kategorie, betreff, html) VALUES (?, ?, ?, ?, ?)',
      [name, typ || 'email', kategorie || 'sonstiges', betreff || '', html]
    );
    const [[vorlage]] = await pool.query('SELECT * FROM akquise_vorlagen WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, vorlage });
  } catch (err) {
    logger.error('[Akquise] POST /vorlagen Fehler:', err);
    res.status(500).json({ success: false, message: 'Fehler beim Speichern' });
  }
});

router.put('/vorlagen/:id', async (req, res) => {
  const { name, typ, kategorie, betreff, html } = req.body;
  try {
    await pool.query(
      'UPDATE akquise_vorlagen SET name=?, typ=?, kategorie=?, betreff=?, html=? WHERE id=?',
      [name, typ || 'email', kategorie || 'sonstiges', betreff || '', html, req.params.id]
    );
    const [[vorlage]] = await pool.query('SELECT * FROM akquise_vorlagen WHERE id=?', [req.params.id]);
    res.json({ success: true, vorlage });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fehler beim Speichern' });
  }
});

router.delete('/vorlagen/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM akquise_vorlagen WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fehler beim Löschen' });
  }
});

// ============================================================================
// KONTAKTE — CRUD
// ============================================================================

// GET /api/admin/akquise/kontakte
router.get('/kontakte', async (req, res) => {
  const { status, typ, prioritaet, search, limit = 200 } = req.query;
  try {
    let sql = `
      SELECT k.*,
        (SELECT COUNT(*) FROM akquise_aktivitaeten a WHERE a.kontakt_id = k.id) AS aktivitaeten_count,
        (SELECT MAX(a.datum) FROM akquise_aktivitaeten a WHERE a.kontakt_id = k.id) AS letzte_aktivitaet
      FROM akquise_kontakte k WHERE 1=1
    `;
    const params = [];
    if (status)     { sql += ' AND k.status = ?';     params.push(status); }
    if (typ)        { sql += ' AND k.typ = ?';         params.push(typ); }
    if (prioritaet) { sql += ' AND k.prioritaet = ?';  params.push(prioritaet); }
    if (search) {
      sql += ' AND (k.organisation LIKE ? OR k.ansprechpartner LIKE ? OR k.ort LIKE ? OR k.email LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    sql += ' ORDER BY k.prioritaet ASC, k.aktualisiert_am DESC LIMIT ?';
    params.push(parseInt(limit));
    const [kontakte] = await pool.query(sql, params);
    res.json({ success: true, kontakte });
  } catch (err) {
    logger.error('[Akquise] GET /kontakte Fehler:', err);
    res.status(500).json({ success: false, message: 'Fehler beim Laden' });
  }
});

// GET /api/admin/akquise/stats — Pipeline-Statistiken
router.get('/stats', async (req, res) => {
  try {
    const [statusRows] = await pool.query(
      'SELECT status, COUNT(*) AS cnt FROM akquise_kontakte GROUP BY status'
    );
    const [aktRows] = await pool.query(
      `SELECT art, ergebnis, COUNT(*) AS cnt FROM akquise_aktivitaeten
       WHERE datum >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY art, ergebnis`
    );
    const [followUpRows] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM akquise_kontakte
       WHERE naechste_aktion IS NOT NULL AND naechste_aktion <= CURDATE()
       AND status NOT IN ('gewonnen','abgelehnt')`
    );
    const statusMap = {};
    statusRows.forEach(r => { statusMap[r.status] = r.cnt; });
    res.json({
      success: true,
      pipeline: statusMap,
      gesamt: statusRows.reduce((s, r) => s + r.cnt, 0),
      gewonnen: statusMap.gewonnen || 0,
      abgelehnt: statusMap.abgelehnt || 0,
      followUp_faellig: followUpRows[0].cnt,
      aktivitaeten_30d: aktRows,
    });
  } catch (err) {
    logger.error('[Akquise] GET /stats Fehler:', err);
    res.status(500).json({ success: false, message: 'Fehler beim Laden' });
  }
});

// GET /api/admin/akquise/kontakte/:id
router.get('/kontakte/:id', async (req, res) => {
  try {
    const [[kontakt]] = await pool.query('SELECT * FROM akquise_kontakte WHERE id=?', [req.params.id]);
    if (!kontakt) return res.status(404).json({ success: false, message: 'Nicht gefunden' });
    const [aktivitaeten] = await pool.query(
      'SELECT * FROM akquise_aktivitaeten WHERE kontakt_id=? ORDER BY datum DESC',
      [req.params.id]
    );
    res.json({ success: true, kontakt, aktivitaeten });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fehler beim Laden' });
  }
});

// POST /api/admin/akquise/kontakte
router.post('/kontakte', async (req, res) => {
  const { organisation, typ, ansprechpartner, position, email, telefon, webseite,
          strasse, plz, ort, land, sportart, mitglieder_anzahl, gegruendet_jahr,
          status, prioritaet, quelle, naechste_aktion, naechste_aktion_info, notiz,
          tags, tda_vereins_id } = req.body;
  if (!organisation) return res.status(400).json({ success: false, message: 'Organisation ist Pflichtfeld' });
  try {
    const [result] = await pool.query(`
      INSERT INTO akquise_kontakte
        (organisation, typ, ansprechpartner, position, email, telefon, webseite,
         strasse, plz, ort, land, sportart, mitglieder_anzahl, gegruendet_jahr,
         status, prioritaet, quelle, naechste_aktion, naechste_aktion_info, notiz,
         tags, tda_vereins_id, zustaendig_user_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [organisation, typ||'schule', ansprechpartner||null, position||null, email||null,
        telefon||null, webseite||null, strasse||null, plz||null, ort||null, land||'Deutschland',
        sportart||null, mitglieder_anzahl||null, gegruendet_jahr||null,
        status||'neu', prioritaet||'mittel', quelle||'manuell',
        naechste_aktion||null, naechste_aktion_info||null, notiz||null,
        tags ? JSON.stringify(tags) : null, tda_vereins_id||null, req.user?.id||null]);
    const [[kontakt]] = await pool.query('SELECT * FROM akquise_kontakte WHERE id=?', [result.insertId]);
    res.status(201).json({ success: true, kontakt });
  } catch (err) {
    logger.error('[Akquise] POST /kontakte Fehler:', err);
    res.status(500).json({ success: false, message: 'Fehler beim Anlegen' });
  }
});

// PUT /api/admin/akquise/kontakte/:id
router.put('/kontakte/:id', async (req, res) => {
  const { organisation, typ, ansprechpartner, position, email, telefon, webseite,
          strasse, plz, ort, land, sportart, mitglieder_anzahl, gegruendet_jahr,
          status, prioritaet, quelle, naechste_aktion, naechste_aktion_info,
          notiz, tags } = req.body;
  try {
    // Status-Änderung protokollieren
    const [[alt]] = await pool.query('SELECT status FROM akquise_kontakte WHERE id=?', [req.params.id]);
    await pool.query(`
      UPDATE akquise_kontakte SET
        organisation=?, typ=?, ansprechpartner=?, position=?, email=?, telefon=?,
        webseite=?, strasse=?, plz=?, ort=?, land=?, sportart=?, mitglieder_anzahl=?,
        gegruendet_jahr=?, status=?, prioritaet=?, quelle=?,
        naechste_aktion=?, naechste_aktion_info=?, notiz=?, tags=?
      WHERE id=?
    `, [organisation, typ||'schule', ansprechpartner||null, position||null, email||null,
        telefon||null, webseite||null, strasse||null, plz||null, ort||null, land||'Deutschland',
        sportart||null, mitglieder_anzahl||null, gegruendet_jahr||null,
        status||'neu', prioritaet||'mittel', quelle||'manuell',
        naechste_aktion||null, naechste_aktion_info||null, notiz||null,
        tags ? JSON.stringify(tags) : null, req.params.id]);
    // Status-Wechsel als Aktivität protokollieren
    if (alt && alt.status !== status) {
      await pool.query(`
        INSERT INTO akquise_aktivitaeten (kontakt_id, art, betreff, ergebnis, status_vorher, status_nachher, erstellt_von_user_id)
        VALUES (?, 'sonstiges', ?, 'positiv', ?, ?, ?)
      `, [req.params.id, `Status geändert: ${alt.status} → ${status}`, alt.status, status, req.user?.id||null]);
    }
    const [[kontakt]] = await pool.query('SELECT * FROM akquise_kontakte WHERE id=?', [req.params.id]);
    res.json({ success: true, kontakt });
  } catch (err) {
    logger.error('[Akquise] PUT /kontakte/:id Fehler:', err);
    res.status(500).json({ success: false, message: 'Fehler beim Speichern' });
  }
});

// DELETE /api/admin/akquise/kontakte/:id
router.delete('/kontakte/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM akquise_kontakte WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fehler beim Löschen' });
  }
});

// ============================================================================
// AKTIVITÄTEN
// ============================================================================

// GET /api/admin/akquise/kontakte/:id/aktivitaeten
router.get('/kontakte/:id/aktivitaeten', async (req, res) => {
  try {
    const [aktivitaeten] = await pool.query(
      'SELECT * FROM akquise_aktivitaeten WHERE kontakt_id=? ORDER BY datum DESC',
      [req.params.id]
    );
    res.json({ success: true, aktivitaeten });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fehler beim Laden' });
  }
});

// POST /api/admin/akquise/kontakte/:id/aktivitaet — Manuelle Aktivität loggen
router.post('/kontakte/:id/aktivitaet', async (req, res) => {
  const { art, betreff, inhalt, ergebnis, ergebnis_notiz, ergebnis_datum } = req.body;
  if (!art) return res.status(400).json({ success: false, message: 'Art ist Pflichtfeld' });
  try {
    const [[kontakt]] = await pool.query('SELECT id FROM akquise_kontakte WHERE id=?', [req.params.id]);
    if (!kontakt) return res.status(404).json({ success: false, message: 'Kontakt nicht gefunden' });
    await pool.query(`
      INSERT INTO akquise_aktivitaeten (kontakt_id, art, betreff, inhalt, ergebnis, ergebnis_datum, ergebnis_notiz, erstellt_von_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.params.id, art, betreff||null, inhalt||null,
        ergebnis||'ausstehend', ergebnis_datum||null, ergebnis_notiz||null, req.user?.id||null]);
    // Follow-up: letzten Kontakt aktualisieren
    await pool.query('UPDATE akquise_kontakte SET status=IF(status="neu","kontaktiert",status) WHERE id=? AND status="neu"', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    logger.error('[Akquise] POST aktivitaet Fehler:', err);
    res.status(500).json({ success: false, message: 'Fehler beim Protokollieren' });
  }
});

// PUT /api/admin/akquise/aktivitaeten/:id/ergebnis — Ergebnis aktualisieren
router.put('/aktivitaeten/:id/ergebnis', async (req, res) => {
  const { ergebnis, ergebnis_notiz, ergebnis_datum } = req.body;
  try {
    await pool.query(
      'UPDATE akquise_aktivitaeten SET ergebnis=?, ergebnis_notiz=?, ergebnis_datum=? WHERE id=?',
      [ergebnis, ergebnis_notiz||null, ergebnis_datum||null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fehler' });
  }
});

// ============================================================================
// E-MAIL VERSAND
// ============================================================================

// POST /api/admin/akquise/kontakte/:id/email
router.post('/kontakte/:id/email', async (req, res) => {
  const { betreff_raw, html_raw, vorlage_name } = req.body;
  try {
    const [[kontakt]] = await pool.query('SELECT * FROM akquise_kontakte WHERE id=?', [req.params.id]);
    if (!kontakt) return res.status(404).json({ success: false, message: 'Kontakt nicht gefunden' });
    if (!kontakt.email) return res.status(400).json({ success: false, message: 'Kontakt hat keine E-Mail-Adresse' });

    // Absender-Info laden (dojo_id = 2 = TDA International)
    const [[dojoInfo]] = await pool.query(
      'SELECT dojoname, email, inhaber, telefon, internet FROM dojo WHERE id = 2 LIMIT 1'
    ).catch(() => [[null]]);
    const absender = {
      name: dojoInfo?.dojoname || 'Tiger & Dragon Association - International',
      email: dojoInfo?.email || 'info@tda-intl.com',
      inhaber: dojoInfo?.inhaber || 'Sascha Schreiner',
      telefon: dojoInfo?.telefon || '',
      internet: dojoInfo?.internet || 'www.tda-intl.com',
    };

    const betreff = ersetzePlatzhalter(betreff_raw, kontakt, absender);
    const html    = ersetzePlatzhalter(html_raw, kontakt, absender);

    // E-Mail über TDA-International Dojo (id=2) senden
    await sendEmailForDojo({
      to: kontakt.email,
      subject: betreff,
      html,
      from: `"${absender.name}" <${absender.email}>`
    }, 2);

    // Aktivität protokollieren
    await pool.query(`
      INSERT INTO akquise_aktivitaeten (kontakt_id, art, betreff, inhalt, vorlage_name, ergebnis, status_vorher, status_nachher, erstellt_von_user_id)
      VALUES (?, 'email', ?, ?, ?, 'ausstehend', ?, IF(? = 'neu', 'kontaktiert', ?), ?)
    `, [req.params.id, betreff, html, vorlage_name||null,
        kontakt.status, kontakt.status, kontakt.status === 'neu' ? 'kontaktiert' : kontakt.status, req.user?.id||null]);

    // Status auf "kontaktiert" setzen wenn noch "neu"
    if (kontakt.status === 'neu') {
      await pool.query("UPDATE akquise_kontakte SET status='kontaktiert' WHERE id=?", [req.params.id]);
    }

    res.json({ success: true, message: `E-Mail an ${kontakt.email} gesendet` });
  } catch (err) {
    logger.error('[Akquise] E-Mail Fehler:', err);
    res.status(500).json({ success: false, message: `Fehler beim E-Mail-Versand: ${err.message}` });
  }
});

// POST /api/admin/akquise/kontakte/:id/brief — Brief-Vorschau (HTML zum Drucken)
router.post('/kontakte/:id/brief', async (req, res) => {
  const { html_raw, betreff_raw, vorlage_name } = req.body;
  try {
    const [[kontakt]] = await pool.query('SELECT * FROM akquise_kontakte WHERE id=?', [req.params.id]);
    if (!kontakt) return res.status(404).json({ success: false, message: 'Kontakt nicht gefunden' });
    const [[dojoInfo]] = await pool.query(
      'SELECT dojoname, email, inhaber, telefon, internet FROM dojo WHERE id = 2 LIMIT 1'
    ).catch(() => [[null]]);
    const absender = {
      name: dojoInfo?.dojoname || 'Tiger & Dragon Association - International',
      email: dojoInfo?.email || 'info@tda-intl.com',
      inhaber: dojoInfo?.inhaber || 'Sascha Schreiner',
      telefon: dojoInfo?.telefon || '',
      internet: dojoInfo?.internet || 'www.tda-intl.com',
    };
    const html = ersetzePlatzhalter(html_raw, kontakt, absender);

    // Aktivität protokollieren
    await pool.query(`
      INSERT INTO akquise_aktivitaeten (kontakt_id, art, betreff, inhalt, vorlage_name, ergebnis, erstellt_von_user_id)
      VALUES (?, 'brief', ?, ?, ?, 'ausstehend', ?)
    `, [req.params.id, ersetzePlatzhalter(betreff_raw, kontakt, absender), html, vorlage_name||null, req.user?.id||null]);

    if (kontakt.status === 'neu') {
      await pool.query("UPDATE akquise_kontakte SET status='kontaktiert' WHERE id=?", [req.params.id]);
    }

    res.json({ success: true, html, kontakt });
  } catch (err) {
    logger.error('[Akquise] Brief Fehler:', err);
    res.status(500).json({ success: false, message: 'Fehler beim Erstellen' });
  }
});

// ============================================================================
// TDA-EVENTS INTEGRATION
// ============================================================================

// GET /api/admin/akquise/tda-events/vereine — Vereine aus TDA-Events holen
router.get('/tda-events/vereine', async (req, res) => {
  try {
    // Öffentliche Turnier-Liste holen
    let turnierIds = [];
    try {
      const data = await fetchEventsApi('/turniere/public');
      if (data.success && Array.isArray(data.data)) {
        turnierIds = data.data.map(t => t.turnier_id);
      }
    } catch (apiErr) {
      return res.status(503).json({ success: false, message: 'TDA-Events API nicht erreichbar' });
    }

    // Vereine aus Ergebnissen extrahieren (über Siegerehrung-API)
    const vereineMap = new Map();
    await Promise.allSettled(
      turnierIds.slice(0, 20).map(async (tid) => {
        try {
          const data = await fetchEventsApi(`/siegerehrung/turnier/${tid}/public`);
          if (!data.success || !Array.isArray(data.data)) return;
          const turniername = data.turnier?.name || `Turnier ${tid}`;
          const datum = data.turnier?.datum || null;
          for (const kat of data.data) {
            for (const p of kat.plaetze) {
              if (!p.verein_name) continue;
              const key = p.verein_name.trim().toLowerCase();
              if (!vereineMap.has(key)) {
                vereineMap.set(key, { name: p.verein_name, turniere: [], teilnehmer: 0 });
              }
              const v = vereineMap.get(key);
              v.teilnehmer++;
              if (!v.turniere.some(t => t.id === tid)) {
                v.turniere.push({ id: tid, name: turniername, datum });
              }
            }
          }
        } catch (_) {}
      })
    );

    // Bereits importierte Kontakte markieren
    const [bereitsImportiert] = await pool.query(
      "SELECT organisation FROM akquise_kontakte WHERE quelle='tda_events'"
    );
    const importiertSet = new Set(bereitsImportiert.map(r => r.organisation.trim().toLowerCase()));

    const vereine = Array.from(vereineMap.values()).map(v => ({
      ...v,
      bereits_importiert: importiertSet.has(v.name.trim().toLowerCase()),
      turnier_anzahl: v.turniere.length,
    })).sort((a, b) => b.turnier_anzahl - a.turnier_anzahl);

    res.json({ success: true, vereine, turniere_gesamt: turnierIds.length });
  } catch (err) {
    logger.error('[Akquise] TDA-Events Vereine Fehler:', err);
    res.status(500).json({ success: false, message: 'Fehler beim Laden' });
  }
});

// POST /api/admin/akquise/tda-events/importieren — Vereine importieren
router.post('/tda-events/importieren', async (req, res) => {
  const { vereine } = req.body; // Array von { name, turniere }
  if (!Array.isArray(vereine) || vereine.length === 0) {
    return res.status(400).json({ success: false, message: 'Keine Vereine übergeben' });
  }
  let importiert = 0, duplikate = 0;
  for (const v of vereine) {
    try {
      await pool.query(`
        INSERT INTO akquise_kontakte (organisation, typ, quelle, status, prioritaet, notiz)
        VALUES (?, 'verein', 'tda_events', 'neu', 'mittel', ?)
      `, [v.name, `TDA-Events: ${v.turnier_anzahl} Turnier(e), ${v.teilnehmer} Teilnahmen`]);
      importiert++;
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') duplikate++;
    }
  }
  res.json({ success: true, importiert, duplikate, message: `${importiert} Vereine importiert` });
});

module.exports = router;
