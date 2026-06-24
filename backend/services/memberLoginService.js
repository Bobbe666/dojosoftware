// ============================================================================
// MEMBER-LOGIN-SERVICE
// Legt für aktive Mitglieder OHNE Login-Account automatisch einen an
// (Username: vorname.nachname, Passwort: Geburtsdatum dd/mm/yyyy) — identisch
// zur manuellen „Alle anlegen"-Funktion (admins.js bulk-create).
// Wird per Cron regelmäßig ausgeführt, damit neue Mitglieder sich sofort
// einloggen können, ohne dass jemand manuell Accounts erstellt.
// ============================================================================
const db = require('../db');
const logger = require('../utils/logger');
const { hashPassword } = require('./passwordService');
const { sendEmailForDojo } = require('./emailService');
const { renderEmail, getDojoMailTheme } = require('./emailLayout');

const MEMBER_APP_URL = 'https://app.tda-vib.de';

// Willkommens-/Onboarding-Mail an ein Mitglied mit Zugangsdaten + Anleitung zur Dojo-App.
async function sendMemberWelcome(pool, m, { username, passwort }) {
  const email = m.email;
  if (!email) return false;
  let dojoname = 'deinem Dojo';
  try {
    const [[d]] = await pool.query('SELECT dojoname FROM dojo WHERE id = ?', [m.dojo_id]);
    if (d?.dojoname) dojoname = d.dojoname;
  } catch (_) {}
  const theme = await getDojoMailTheme({ dojoId: m.dojo_id });
  const bodyHtml = `
    <p style="font-size:16px;margin:0 0 14px;color:#1e293b;">Hallo ${m.vorname || ''},</p>
    <p style="margin:0 0 14px;">ab sofort kannst du die <strong style="color:#1e293b;">Dojo-App</strong> nutzen – dort siehst du deine Trainingszeiten, Prüfungen, Beiträge, Nachrichten und mehr. Hier sind deine Zugangsdaten:</p>
    <div class="box">
      <p><strong style="color:#1e293b;">App-Adresse:</strong> <a href="${MEMBER_APP_URL}" style="color:${theme.primary};">${MEMBER_APP_URL}</a></p>
      <p><strong style="color:#1e293b;">Benutzername:</strong> ${username}${email ? ` (oder deine E-Mail ${email})` : ''}</p>
      <p><strong style="color:#1e293b;">Passwort:</strong> <span style="font-family:monospace;background:#eef2f7;padding:2px 6px;border-radius:4px;">${passwort}</span> <span style="color:#64748b;font-size:13px;">(dein Geburtsdatum)</span></p>
    </div>
    <p style="margin:14px 0 6px;"><strong style="color:#1e293b;">So geht's:</strong></p>
    <ol style="margin:0 0 14px;padding-left:20px;color:#334155;line-height:1.7;">
      <li><a href="${MEMBER_APP_URL}" style="color:${theme.primary};">${MEMBER_APP_URL}</a> im Browser öffnen (am Handy: Safari/Chrome).</li>
      <li>Mit Benutzername und Passwort anmelden.</li>
      <li><strong>Tipp:</strong> „Zum Home-Bildschirm hinzufügen" – dann hast du die App wie eine echte App auf dem Handy.</li>
      <li>Im Profil das Passwort ändern.</li>
    </ol>
    <p style="margin:14px 0 0;">Bei Fragen melde dich einfach bei uns.</p>
    <p style="margin:12px 0 0;">Sportliche Grüße<br><strong style="color:#1e293b;">${dojoname}</strong></p>`;
  const html = renderEmail({ theme, anlass: 'begruessung', titel: 'Willkommen in der Dojo-App', bodyHtml });
  const text = `Hallo ${m.vorname || ''},\n\ndu kannst jetzt die Dojo-App nutzen:\n${MEMBER_APP_URL}\n\nBenutzername: ${username}${email ? ` (oder E-Mail ${email})` : ''}\nPasswort: ${passwort} (dein Geburtsdatum)\n\nÖffne die Seite, melde dich an und füge sie ggf. zum Home-Bildschirm hinzu. Bitte ändere danach dein Passwort.\n\nSportliche Grüße\n${dojoname}`;
  try {
    await sendEmailForDojo({ to: email, subject: `Willkommen in der Dojo-App – deine Zugangsdaten`, html, text }, m.dojo_id);
    return true;
  } catch (e) {
    logger.warn?.('[memberLogin] Willkommensmail fehlgeschlagen', { mitglied_id: m.mitglied_id, error: e.message });
    return false;
  }
}

const clean = s => (s || '').trim().toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/\s+/g, '');

const formatPw = geb => {
  if (!geb) return null;
  const d = new Date(geb);
  if (isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};

// Erstellt fehlende Logins. dojoId optional (null = alle Dojos).
async function ensureMemberLogins(dojoId = null) {
  const pool = db.promise();
  const params = [];
  // Alle Dojos (inkl. Subdomains) — überall sollen Logins automatisch entstehen.
  let dojoFilter = '';
  if (dojoId) { dojoFilter = 'AND m.dojo_id = ?'; params.push(dojoId); }

  const [members] = await pool.query(`
    SELECT m.mitglied_id, m.vorname, m.nachname, m.email, m.geburtsdatum, m.dojo_id, m.eintrittsdatum
    FROM mitglieder m
    LEFT JOIN users u ON m.mitglied_id = u.mitglied_id
    WHERE u.id IS NULL AND m.aktiv = 1 AND COALESCE(m.gekuendigt,0) = 0 ${dojoFilter}
  `, params);

  // Neu = vor max. 14 Tagen eingetreten → bekommt die Willkommens-Mail.
  // So werden bei der ersten Ausführung NICHT alle Bestandsmitglieder angemailt,
  // nur tatsächlich neue. (Jedes Mitglied wird genau einmal verarbeitet — danach hat es ein Login.)
  const NEU_TAGE = 14;
  const istNeu = (eintritt) => {
    if (!eintritt) return false;
    const diffTage = (Date.now() - new Date(eintritt).getTime()) / 86400000;
    return diffTage >= 0 && diffTage <= NEU_TAGE;
  };

  let created = 0, uebersprungen = 0, mails = 0;
  for (const m of members) {
    const password = formatPw(m.geburtsdatum);
    if (!password) { uebersprungen++; continue; } // ohne Geburtsdatum kein Standard-Passwort

    const baseUsername = clean(m.vorname) + '.' + clean(m.nachname);
    let username = baseUsername, counter = 1;
    while (true) {
      const [ex] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
      if (ex.length === 0) break;
      username = `${baseUsername}${counter++}`;
    }

    try {
      const hash = await hashPassword(password);
      await pool.query(
        `INSERT IGNORE INTO users (username, email, password, mitglied_id, dojo_id, role, created_at)
         VALUES (?, ?, ?, ?, ?, 'member', NOW())`,
        [username, m.email || null, hash, m.mitglied_id, m.dojo_id || null]
      );
      created++;
      // Willkommens-Mail mit App-Anleitung nur an neue Mitglieder mit E-Mail
      if (m.email && istNeu(m.eintrittsdatum)) {
        if (await sendMemberWelcome(pool, m, { username, passwort: password })) mails++;
      }
    } catch (e) {
      logger.warn?.('[memberLogin] Account-Anlage fehlgeschlagen', { mitglied_id: m.mitglied_id, error: e.message });
    }
  }
  return { gefunden: members.length, created, uebersprungen, mails };
}

module.exports = { ensureMemberLogins };
