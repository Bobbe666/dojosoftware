/**
 * Verband-Mails (TDA International, dojo_id 2)
 * - Willkommensmail (direkt nach Anmeldung)
 * - Rechnungsmail (automatisch 2 Std. nach Willkommensmail, via Cron) mit fortlaufender Nummer
 * Eine Quelle für Anmeldungs-Flow, Cron und manuelle Auslösung.
 */
const { sendEmailForDojo } = require('./emailService');
const { renderEmail, getDojoMailTheme } = require('./emailLayout');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const VERBAND_DOJO_ID = 2;
const VERBAND_DOJONAME = 'Tiger & Dragon Association - International';
const KONTOINHABER = 'Tiger & Dragon Association';
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://dojo.tda-intl.org';
const VERBAND_LOGIN_URL = 'https://tda-intl.com/login';
const QR_DIR = path.join(__dirname, '../uploads/verband-qr');

function q(pool, sql, params = []) { return pool.query(sql, params); }
const fmtD = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '–';
const fmtBetrag = (v) => (v != null && v !== '') ? Number(v).toFixed(2).replace('.', ',') + ' €' : '–';

function empfaengerVon(m) {
  const email = m.typ === 'dojo' ? (m.dojo_email || m.person_email) : (m.person_email || m.dojo_email);
  const name = m.typ === 'dojo'
    ? (m.dojo_name || m.dojo_inhaber || 'Mitglied')
    : (`${m.person_vorname || ''} ${m.person_nachname || ''}`.trim() || 'Mitglied');
  return { email, name };
}

// Rechtssicheres Mail-Log: jede gesendete Mail wird gespeichert + dem Mitglied zugeordnet
async function logMail(pool, { mitgliedschaftId, empfaenger, typ, betreff, html, text, result }) {
  try {
    await q(pool,
      `INSERT INTO verband_mail_log (mitgliedschaft_id, empfaenger, typ, betreff, html, text_inhalt, message_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [mitgliedschaftId || null, empfaenger || null, typ, betreff || null, html || null, text || null,
       result?.messageId || null, (result && result.success) ? 'gesendet' : 'fehler']);
  } catch (e) { /* Log darf den Versand nie blockieren */ }
}

// Standard-Bankverbindung des Verbands (dojo 2) für die Rechnung
async function getStandardBank(pool) {
  try {
    const [rows] = await q(pool,
      "SELECT iban, bic FROM dojo_banken WHERE dojo_id = ? AND iban IS NOT NULL AND iban <> '' AND ist_aktiv = 1 ORDER BY ist_standard DESC LIMIT 1",
      [VERBAND_DOJO_ID]);
    return rows[0] || null;
  } catch { return null; }
}

// ── EPC/GiroCode: QR-Code für SEPA-Überweisung (in Banking-Apps scannbar) ────
function epcPayload({ name, iban, bic, amount, ref }) {
  return [
    'BCD',
    '002',
    '1',                                   // Zeichensatz UTF-8
    'SCT',
    bic || '',
    (name || '').slice(0, 70),
    (iban || '').replace(/\s+/g, ''),
    'EUR' + Number(amount || 0).toFixed(2),
    '',                                    // Purpose-Code
    '',                                    // strukturierte Referenz
    (ref || '').slice(0, 140)              // Verwendungszweck
  ].join('\n');
}

// Erzeugt ein GiroCode-PNG und gibt die öffentliche URL zurück (null bei Fehler/ohne IBAN).
async function generateGiroCodeUrl({ iban, bic, amount, ref, dateiname }) {
  try {
    if (!iban) return null;
    fs.mkdirSync(QR_DIR, { recursive: true });
    const safe = String(dateiname || ref || 'qr').replace(/[^a-zA-Z0-9_-]/g, '_');
    const file = `giro-${safe}.png`;
    const payload = epcPayload({ name: KONTOINHABER, iban, bic, amount, ref });
    await QRCode.toFile(path.join(QR_DIR, file), payload, { errorCorrectionLevel: 'M', margin: 1, width: 320 });
    return `${PUBLIC_URL}/uploads/verband-qr/${file}`;
  } catch (e) { return null; }
}

// ── Willkommensmail ──────────────────────────────────────────────────────────
async function sendWillkommen(pool, m) {
  const { email, name } = empfaengerVon(m);
  if (!email) return false;
  const theme = await getDojoMailTheme({ dojoname: VERBAND_DOJONAME });
  const typLabel = m.typ === 'dojo' ? 'Dojo-Mitgliedschaft' : 'Einzelmitgliedschaft';
  const bodyHtml = `
    <p style="font-size:16px;margin:0 0 16px;color:#1e293b;">Hallo ${name},</p>
    <p style="margin:0 0 14px;">herzlich willkommen im <strong style="color:#1e293b;">Tiger &amp; Dragon Association Verband</strong> &ndash; sch&ouml;n, dass du dabei bist!</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;background:#ffffff;margin:18px 0;">
      <tr><td style="padding:20px 22px;">
        <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#94a3b8;margin-bottom:12px;font-weight:600;">Deine Mitgliedschaft auf einen Blick</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#64748b;line-height:1.9;">
          <tr><td>Mitgliedsnummer</td><td align="right" style="color:#1e293b;font-weight:600;">${m.mitgliedsnummer || '–'}</td></tr>
          <tr><td>Art</td><td align="right" style="color:#1e293b;">${typLabel}</td></tr>
          <tr><td>Laufzeit</td><td align="right" style="color:#1e293b;">${fmtD(m.gueltig_ab)} &ndash; ${fmtD(m.gueltig_bis)}</td></tr>
          <tr><td>Jahresbeitrag</td><td align="right" style="color:#1e293b;font-weight:600;">${fmtBetrag(m.jahresbeitrag)}</td></tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:14px 0;">Die Rechnung f&uuml;r deinen Jahresbeitrag erh&auml;ltst du in K&uuml;rze separat per E-Mail. Sobald die Zahlung bei uns eingegangen ist, ist deine Mitgliedschaft vollst&auml;ndig aktiv und du kannst alle Vorteile und Verg&uuml;nstigungen nutzen.</p>
    <p style="margin:14px 0 0;">Bei Fragen melde dich einfach direkt bei uns.</p>
    <p style="margin:14px 0 0;">Sportliche Gr&uuml;&szlig;e<br><strong style="color:#1e293b;">Tiger &amp; Dragon Association &ndash; International</strong></p>`;
  const html = renderEmail({ theme, anlass: 'begruessung', titel: 'Willkommen im TDA Verband', subtitel: 'Tiger & Dragon Association', bodyHtml });
  const betreff = 'Willkommen im TDA Verband!';
  const text = `Willkommen im TDA Verband! Deine Mitgliedsnummer: ${m.mitgliedsnummer}.`;
  const r = await sendEmailForDojo({ to: email, subject: betreff, html, text }, VERBAND_DOJO_ID);
  await logMail(pool, { mitgliedschaftId: m.id, empfaenger: email, typ: 'willkommen', betreff, html, text, result: r });
  if (r && r.success && m.id) {
    await q(pool, 'UPDATE verbandsmitgliedschaften SET willkommensmail_gesendet_am = NOW() WHERE id = ?', [m.id]);
  }
  return !!(r && r.success);
}

// ── Fortlaufende Rechnungsnummer (z.B. TDA-RE-2026-0001) ─────────────────────
async function naechsteRechnungsnummer(pool) {
  const jahr = new Date().getFullYear();
  const [[pre]] = await q(pool, "SELECT einstellung_value FROM verband_einstellungen WHERE einstellung_key='rechnungsnummer_prefix'");
  const prefix = (pre && pre.einstellung_value) ? pre.einstellung_value : 'TDA';
  const [[cnt]] = await q(pool, "SELECT einstellung_value FROM verband_einstellungen WHERE einstellung_key='naechste_rechnungsnummer'");
  const num = parseInt(cnt && cnt.einstellung_value, 10) || 1;
  await q(pool, "UPDATE verband_einstellungen SET einstellung_value=? WHERE einstellung_key='naechste_rechnungsnummer'", [num + 1]);
  return `${prefix}-RE-${jahr}-${String(num).padStart(4, '0')}`;
}

// ── Rechnungsmail ────────────────────────────────────────────────────────────
async function sendRechnung(pool, m, opts = {}) {
  const { email, name } = empfaengerVon(m);
  const to = opts.testTo || email;
  if (!to) return false;
  const theme = await getDojoMailTheme({ dojoname: VERBAND_DOJONAME });
  // Im Test-Modus keine fortlaufende Nummer ziehen (Zähler nicht verbrauchen)
  const rechnungsnummer = opts.testTo
    ? (m.rechnungsnummer || 'TDA-RE-VORSCHAU')
    : (m.rechnungsnummer || await naechsteRechnungsnummer(pool));
  const heute = new Date().toLocaleDateString('de-DE');
  const ziel = new Date(Date.now() + 14 * 864e5).toLocaleDateString('de-DE');
  const typLabel = m.typ === 'dojo' ? 'Dojo-Mitgliedschaft' : 'Einzelmitgliedschaft';

  let zahlungsteil;
  if (m.zahlungsart === 'lastschrift') {
    zahlungsteil = `<p style="margin:0 0 4px;">Der Betrag wird per <strong style="color:#1e293b;">SEPA-Lastschrift</strong> von deinem Konto eingezogen. Du musst nichts weiter tun.</p>`;
  } else {
    const bank = await getStandardBank(pool);
    const ibanRaw = bank?.iban ? bank.iban.replace(/\s+/g, '') : '';
    const iban = bank?.iban ? bank.iban.replace(/(.{4})/g, '$1 ').trim() : '—';
    const bic = bank?.bic || '—';
    const verwendungszweck = m.mitgliedsnummer || rechnungsnummer;
    const qrUrl = await generateGiroCodeUrl({
      iban: ibanRaw, bic: bank?.bic || '', amount: m.jahresbeitrag,
      ref: verwendungszweck, dateiname: `${verwendungszweck}-${rechnungsnummer}`
    });
    const qrBlock = qrUrl ? `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 2px;"><tr>
          <td style="vertical-align:middle;padding-right:14px;">
            <img src="${qrUrl}" width="120" height="120" alt="QR-Code zur &Uuml;berweisung" style="display:block;width:120px;height:120px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;" />
          </td>
          <td style="vertical-align:middle;font-size:13px;color:#475569;line-height:1.5;">
            <strong style="color:#1e293b;">Bequem per QR-Code zahlen</strong><br>
            Scanne den Code einfach mit deiner Banking-App &ndash; Betrag, IBAN und Verwendungszweck sind dann automatisch ausgef&uuml;llt.
          </td>
        </tr></table>` : '';
    zahlungsteil = `
      <p style="margin:0 0 4px;">Bitte &uuml;berweise den Betrag bis zum <strong style="color:#1e293b;">${ziel}</strong> auf folgendes Konto:</p>
      <div class="box">
        <p><strong style="color:#1e293b;">Kontoinhaber:</strong> ${KONTOINHABER}</p>
        <p><strong style="color:#1e293b;">IBAN:</strong> ${iban}</p>
        <p><strong style="color:#1e293b;">BIC:</strong> ${bic}</p>
        <p><strong style="color:#1e293b;">Verwendungszweck:</strong> ${verwendungszweck}</p>
      </div>
      ${qrBlock}`;
  }

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:16px;color:#1e293b;">Hallo ${name},</p>
    <p style="margin:0 0 6px;">vielen Dank f&uuml;r deine Mitgliedschaft im <strong style="color:#1e293b;">Tiger &amp; Dragon Association Verband</strong>. Anbei deine Rechnung f&uuml;r den Jahresbeitrag.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;background:#ffffff;margin:20px 0;">
      <tr><td style="padding:22px 24px;">
        <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#94a3b8;margin-bottom:14px;font-weight:600;">Rechnung</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#64748b;line-height:1.9;">
          <tr><td>Rechnungsnummer</td><td align="right" style="color:#1e293b;font-weight:600;">${rechnungsnummer}</td></tr>
          <tr><td>Rechnungsdatum</td><td align="right" style="color:#1e293b;">${heute}</td></tr>
          <tr><td>Mitgliedsnummer</td><td align="right" style="color:#1e293b;font-weight:600;">${m.mitgliedsnummer || '–'}</td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:18px;">
          <tr>
            <td style="padding:0 0 8px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;border-bottom:2px solid #e2e8f0;">Beschreibung</td>
            <td align="right" style="padding:0 0 8px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;border-bottom:2px solid #e2e8f0;white-space:nowrap;">Betrag</td>
          </tr>
          <tr>
            <td style="padding:13px 0;font-size:14px;color:#1e293b;border-bottom:1px solid #eef2f7;">Jahresbeitrag &middot; ${typLabel}<br><span style="color:#94a3b8;font-size:12px;">Mitgliedsjahr bis ${fmtD(m.gueltig_bis)}</span></td>
            <td align="right" valign="top" style="padding:13px 0;font-size:14px;color:#1e293b;border-bottom:1px solid #eef2f7;white-space:nowrap;">${fmtBetrag(m.jahresbeitrag)}</td>
          </tr>
          <tr>
            <td style="padding:16px 0 0;font-size:16px;font-weight:bold;color:#1e293b;">Gesamtbetrag</td>
            <td align="right" style="padding:16px 0 0;font-size:19px;font-weight:bold;color:${theme.primary};white-space:nowrap;">${fmtBetrag(m.jahresbeitrag)}</td>
          </tr>
        </table>
        <div style="margin-top:12px;font-size:11px;color:#94a3b8;">Mitgliedsbeitrag &ndash; kein gesonderter Ausweis von Umsatzsteuer.</div>
      </td></tr>
    </table>
    ${zahlungsteil}
    <p style="margin:16px 0 0;">Sobald die Zahlung bei uns eingegangen ist, ist deine Mitgliedschaft vollst&auml;ndig aktiv und du kannst alle Vorteile und Verg&uuml;nstigungen nutzen.</p>
    <p style="margin:16px 0 0;">Sportliche Gr&uuml;&szlig;e<br><strong style="color:#1e293b;">Tiger &amp; Dragon Association &ndash; International</strong></p>`;
  const html = renderEmail({ theme, anlass: 'rechnung', titel: 'Rechnung Mitgliedsbeitrag', subtitel: 'TDA International · Verband', bodyHtml });
  const betreff = (opts.testTo ? '[TEST] ' : '') + 'Deine Rechnung – TDA Verband (Mitgliedsbeitrag)';
  const text = `Rechnung ${rechnungsnummer} – Jahresbeitrag ${fmtBetrag(m.jahresbeitrag)}, Mitgliedsnummer ${m.mitgliedsnummer}.`;
  const r = await sendEmailForDojo({ to, subject: betreff, html, text }, VERBAND_DOJO_ID);
  // Test-Modus: nichts loggen, Zähler/Status unverändert lassen
  if (opts.testTo) return !!(r && r.success);
  await logMail(pool, { mitgliedschaftId: m.id, empfaenger: to, typ: `rechnung ${rechnungsnummer}`, betreff, html, text, result: r });
  if (r && r.success && m.id) {
    await q(pool, 'UPDATE verbandsmitgliedschaften SET rechnungsmail_gesendet_am = NOW(), rechnungsnummer = ? WHERE id = ?', [rechnungsnummer, m.id]);
  }
  return !!(r && r.success);
}

// ── Cron-Worker: Rechnungen 2 Std. nach Willkommensmail versenden ────────────
async function processFaelligeRechnungen(pool) {
  const [rows] = await q(pool, `
    SELECT id, typ, person_vorname, person_nachname, person_email, dojo_name, dojo_inhaber, dojo_email,
           mitgliedsnummer, jahresbeitrag, zahlungsart, gueltig_ab, gueltig_bis, rechnungsnummer
    FROM verbandsmitgliedschaften
    WHERE willkommensmail_gesendet_am IS NOT NULL
      AND willkommensmail_gesendet_am <= DATE_SUB(NOW(), INTERVAL 2 HOUR)
      AND rechnungsmail_gesendet_am IS NULL
    LIMIT 50`);
  let gesendet = 0;
  for (const m of rows) {
    try { if (await sendRechnung(pool, m)) gesendet++; } catch (e) { /* nächster */ }
  }
  return { faellig: rows.length, gesendet };
}

// ── Übertragungs-Willkommensmail (Altvertrag ins neue System) ────────────────
// Enthält: Hinweis auf Übertragung, Zugangsdaten + Login-Anleitung, Zahlart-Frage.
// Setzt bewusst NICHT willkommensmail_gesendet_am → löst keine Auto-Rechnung (Cron) aus.
// opts: { loginEmail, passwort, testTo }
async function sendUebertragungWillkommen(pool, m, opts = {}) {
  const { email, name } = empfaengerVon(m);
  const to = opts.testTo || email;
  if (!to) return false;
  const theme = await getDojoMailTheme({ dojoname: VERBAND_DOJONAME });
  const loginEmail = opts.loginEmail || email;
  const passwort = opts.passwort || '(wird separat mitgeteilt)';
  const typLabel = m.typ === 'dojo' ? 'Dojo-Mitgliedschaft' : 'Einzelmitgliedschaft';
  const istLastschrift = m.zahlungsart === 'lastschrift';

  const bodyHtml = `
    <p style="font-size:16px;margin:0 0 16px;color:#1e293b;">Hallo ${name},</p>
    <p style="margin:0 0 14px;">wir haben unsere Verbandsverwaltung modernisiert und deine bestehende Mitgliedschaft in unser <strong style="color:#1e293b;">neues TDA-Verbandssystem</strong> übertragen. Für dich ändert sich nichts an deiner Mitgliedschaft – du hast ab sofort aber einen eigenen Online-Zugang.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;background:#ffffff;margin:18px 0;">
      <tr><td style="padding:20px 22px;">
        <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#94a3b8;margin-bottom:12px;font-weight:600;">Deine Mitgliedschaft auf einen Blick</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#64748b;line-height:1.9;">
          <tr><td>Mitgliedsnummer</td><td align="right" style="color:#1e293b;font-weight:600;">${m.mitgliedsnummer || '–'}</td></tr>
          <tr><td>Art</td><td align="right" style="color:#1e293b;">${typLabel}${m.dojo_name ? ' &middot; ' + m.dojo_name : ''}</td></tr>
          <tr><td>Laufzeit</td><td align="right" style="color:#1e293b;">${fmtD(m.gueltig_ab || m.gueltig_von)} &ndash; ${fmtD(m.gueltig_bis)}</td></tr>
          <tr><td>Jahresbeitrag</td><td align="right" style="color:#1e293b;font-weight:600;">${fmtBetrag(m.jahresbeitrag)}</td></tr>
        </table>
      </td></tr>
    </table>

    <h2 style="font-size:18px;color:#1e293b;margin:24px 0 8px;">Deine Zugangsdaten</h2>
    <p style="margin:0 0 12px;">Mit diesen Daten kannst du dich ab sofort in deinem Mitgliederbereich anmelden:</p>
    <div class="box">
      <p><strong style="color:#1e293b;">Login-Adresse:</strong> <a href="${VERBAND_LOGIN_URL}" style="color:${theme.primary};">${VERBAND_LOGIN_URL}</a></p>
      <p><strong style="color:#1e293b;">E-Mail (Benutzername):</strong> ${loginEmail}</p>
      <p><strong style="color:#1e293b;">Passwort:</strong> <span style="font-family:monospace;background:#eef2f7;padding:2px 6px;border-radius:4px;">${passwort}</span></p>
    </div>
    <p style="margin:12px 0;font-size:13px;color:#64748b;">So geht's: Seite öffnen &rarr; mit E-Mail und Passwort anmelden &rarr; im Profil das Passwort ändern. Dort siehst du jederzeit deine Mitgliedschaft, Rechnungen und Daten.</p>

    <h2 style="font-size:18px;color:#1e293b;margin:24px 0 8px;">Wie möchtest du künftig bezahlen?</h2>
    <p style="margin:0 0 10px;">Aktuell ist bei dir <strong style="color:#1e293b;">${istLastschrift ? 'SEPA-Lastschrift' : 'Zahlung per Rechnung/Überweisung'}</strong> hinterlegt.</p>
    ${istLastschrift ? `
      <p style="margin:0 0 6px;">Der Jahresbeitrag wird also bequem von deinem Konto eingezogen – du musst nichts weiter tun.</p>` : `
      <p style="margin:0 0 6px;">Wenn du es <strong style="color:#1e293b;">bequemer und stressfreier</strong> möchtest, kannst du jederzeit auf <strong style="color:#1e293b;">SEPA-Lastschrift</strong> umstellen – dann wird der Beitrag automatisch einmal jährlich eingezogen und du musst an nichts mehr denken.</p>
      <div class="box">
        <p style="margin:0;">👉 <strong style="color:#1e293b;">Lastschrift gewünscht?</strong> Antworte einfach auf diese E-Mail mit dem Wort <strong>„Lastschrift"</strong> und deiner <strong>IBAN</strong> – wir richten alles für dich ein. Oder du meldest dich im Portal an und hinterlegst deine Bankdaten selbst.</p>
      </div>
      <p style="margin:10px 0 0;">Möchtest du wie bisher <strong style="color:#1e293b;">per Rechnung</strong> zahlen, brauchst du nichts zu tun – du bekommst deine Rechnung wie gewohnt zugeschickt.</p>`}

    <p style="margin:18px 0 0;">Bei Fragen melde dich jederzeit gerne bei uns.</p>
    <p style="margin:14px 0 0;">Sportliche Grüße<br><strong style="color:#1e293b;">Tiger &amp; Dragon Association &ndash; International</strong></p>`;

  const html = renderEmail({
    theme, anlass: 'begruessung',
    titel: 'Willkommen im neuen TDA-Verbandssystem',
    bodyHtml,
    cta: { url: VERBAND_LOGIN_URL, label: 'Jetzt im Verband-Portal anmelden' }
  });
  const betreff = (opts.testTo ? '[TEST] ' : '') + 'Willkommen im neuen TDA-Verbandssystem – deine Zugangsdaten';
  const text = `Hallo ${name},\n\nwir haben deine Mitgliedschaft in unser neues TDA-Verbandssystem übertragen.\n\nZugangsdaten:\nLogin: ${VERBAND_LOGIN_URL}\nE-Mail: ${loginEmail}\nPasswort: ${passwort}\n\nBitte ändere dein Passwort nach dem ersten Login.\n\nZahlweise: Aktuell ${istLastschrift ? 'SEPA-Lastschrift' : 'Rechnung/Überweisung'}. Du kannst jederzeit auf bequeme SEPA-Lastschrift umstellen – antworte dazu einfach mit „Lastschrift" und deiner IBAN.\n\nSportliche Grüße\nTiger & Dragon Association – International`;

  const r = await sendEmailForDojo({ to, subject: betreff, html, text }, VERBAND_DOJO_ID);
  if (opts.testTo) return !!(r && r.success);
  await logMail(pool, { mitgliedschaftId: m.id, empfaenger: to, typ: 'willkommen_uebertragung', betreff, html, text, result: r });
  return !!(r && r.success);
}

// ── Kündigungs-Bestätigung (Verband, Mitglied-Selbstkündigung) ───────────────
// opts: { endeDatum, testTo }
async function sendKuendigungBestaetigung(pool, m, opts = {}) {
  const { email, name } = empfaengerVon(m);
  const to = opts.testTo || email;
  if (!to) return false;
  const theme = await getDojoMailTheme({ dojoname: VERBAND_DOJONAME });
  const endeStr = fmtD(opts.endeDatum || m.gueltig_bis);
  const bodyHtml = `
    <p style="font-size:16px;margin:0 0 16px;color:#1e293b;">Hallo ${name},</p>
    <p style="margin:0 0 14px;">wir bestätigen den Eingang deiner Kündigung. Schade, dass du uns verlässt – wir bedanken uns herzlich für deine Mitgliedschaft im <strong style="color:#1e293b;">Tiger &amp; Dragon Association Verband</strong>.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;background:#ffffff;margin:18px 0;">
      <tr><td style="padding:20px 22px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#64748b;line-height:1.9;">
          <tr><td>Mitgliedsnummer</td><td align="right" style="color:#1e293b;font-weight:600;">${m.mitgliedsnummer || '–'}</td></tr>
          <tr><td>Mitgliedschaft endet zum</td><td align="right" style="color:#1e293b;font-weight:700;">${endeStr}</td></tr>
        </table>
      </td></tr>
    </table>
    <div class="box">
      <p style="margin:0;"><strong style="color:#1e293b;">Gut zu wissen:</strong> Die Mitgliedschaft läuft jeweils bis zum 31.12. eines Jahres. Eine Kündigung bis zum 31.08. beendet sie zum 31.12. desselben Jahres – danach endet sie zum 31.12. des Folgejahres. Dein Vertragsende oben berücksichtigt das bereits.</p>
    </div>
    <p style="margin:14px 0;">Bis zum Vertragsende bleibst du vollwertiges Mitglied mit allen Vorteilen.</p>
    <p style="margin:14px 0 0;">Wir würden uns freuen, dich künftig wieder im Verband begrüßen zu dürfen. Alles Gute!</p>
    <p style="margin:14px 0 0;">Sportliche Grüße<br><strong style="color:#1e293b;">Tiger &amp; Dragon Association &ndash; International</strong></p>`;
  const html = renderEmail({ theme, anlass: 'allgemein', titel: 'Kündigung bestätigt', subtitel: 'TDA International · Verband', bodyHtml });
  const betreff = (opts.testTo ? '[TEST] ' : '') + 'Deine Kündigung ist bestätigt – TDA Verband';
  const text = `Hallo ${name},\n\nwir bestätigen deine Kündigung. Deine Mitgliedschaft (${m.mitgliedsnummer}) endet zum ${endeStr}.\n\nHinweis: Kündigung bis 31.08. beendet zum 31.12. desselben Jahres, danach zum 31.12. des Folgejahres.\n\nSportliche Grüße\nTiger & Dragon Association – International`;
  const r = await sendEmailForDojo({ to, subject: betreff, html, text }, VERBAND_DOJO_ID);
  if (opts.testTo) return !!(r && r.success);
  await logMail(pool, { mitgliedschaftId: m.id, empfaenger: to, typ: 'kuendigung_bestaetigt', betreff, html, text, result: r });
  return !!(r && r.success);
}

// ── Auto-Verlängerung: läuft die Mitgliedschaft ohne Kündigung aus, +1 Jahr ──
// Aktive Mitgliedschaften, deren gueltig_bis abgelaufen ist, werden um 1 Jahr verlängert
// und erhalten automatisch die neue Jahresrechnung (mit frischer Nummer) – auch bei Lastschrift.
async function processAutoVerlaengerung(pool) {
  const [rows] = await q(pool,
    `SELECT * FROM verbandsmitgliedschaften
     WHERE status = 'aktiv' AND gueltig_bis IS NOT NULL AND gueltig_bis < CURDATE() LIMIT 200`);
  let verlaengert = 0, berechnet = 0;
  for (const m of rows) {
    try {
      const altesEnde = new Date(m.gueltig_bis);
      const neuesEnde = new Date(altesEnde); neuesEnde.setFullYear(neuesEnde.getFullYear() + 1);
      const neuesEndeStr = neuesEnde.toISOString().slice(0, 10);
      await q(pool,
        `UPDATE verbandsmitgliedschaften
         SET gueltig_von = DATE_ADD(COALESCE(gueltig_von, gueltig_bis), INTERVAL 1 YEAR),
             gueltig_bis = DATE_ADD(gueltig_bis, INTERVAL 1 YEAR)
         WHERE id = ?`, [m.id]);
      await q(pool,
        `INSERT INTO verband_vertragshistorie (verbandsmitgliedschaft_id, aktion, beschreibung, durchgefuehrt_von)
         VALUES (?, 'verlaengert', ?, 'System (Auto-Verlängerung)')`,
        [m.id, `Mitgliedschaft automatisch um 1 Jahr verlängert (kein Kündigungseingang). Neues Ende: ${neuesEnde.toLocaleDateString('de-DE')}`]);
      verlaengert++;

      // Neue Jahresrechnung automatisch erzeugen + versenden (Überweisung MIT QR, Lastschrift als Einzugs-Info).
      // Frische Rechnungsnummer erzwingen (rechnungsnummer:null), neues Mitgliedsjahr im Beleg.
      if (!m.beitragsfrei && Number(m.jahresbeitrag) > 0) {
        const mNeu = { ...m, gueltig_von: neuesEndeStr, gueltig_ab: neuesEndeStr, gueltig_bis: neuesEndeStr, rechnungsnummer: null };
        try { if (await sendRechnung(pool, mNeu)) berechnet++; } catch (e) { /* Rechnung optional */ }
      }
    } catch (e) { /* nächster */ }
  }
  return { faellig: rows.length, verlaengert, berechnet };
}

module.exports = { sendWillkommen, sendRechnung, processFaelligeRechnungen, naechsteRechnungsnummer, sendUebertragungWillkommen, sendKuendigungBestaetigung, processAutoVerlaengerung };
