/**
 * Verband-Mails (TDA International, dojo_id 2)
 * - Willkommensmail (direkt nach Anmeldung)
 * - Rechnungsmail (automatisch 2 Std. nach Willkommensmail, via Cron) mit fortlaufender Nummer
 * Eine Quelle für Anmeldungs-Flow, Cron und manuelle Auslösung.
 */
const { sendEmailForDojo } = require('./emailService');
const { renderEmail, getDojoMailTheme } = require('./emailLayout');

const VERBAND_DOJO_ID = 2;
const VERBAND_DOJONAME = 'Tiger & Dragon Association - International';
const KONTOINHABER = 'Tiger & Dragon Association';

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
async function sendRechnung(pool, m) {
  const { email, name } = empfaengerVon(m);
  if (!email) return false;
  const theme = await getDojoMailTheme({ dojoname: VERBAND_DOJONAME });
  const rechnungsnummer = m.rechnungsnummer || await naechsteRechnungsnummer(pool);
  const heute = new Date().toLocaleDateString('de-DE');
  const ziel = new Date(Date.now() + 14 * 864e5).toLocaleDateString('de-DE');
  const typLabel = m.typ === 'dojo' ? 'Dojo-Mitgliedschaft' : 'Einzelmitgliedschaft';

  let zahlungsteil;
  if (m.zahlungsart === 'lastschrift') {
    zahlungsteil = `<p style="margin:0 0 4px;">Der Betrag wird per <strong style="color:#1e293b;">SEPA-Lastschrift</strong> von deinem Konto eingezogen. Du musst nichts weiter tun.</p>`;
  } else {
    const bank = await getStandardBank(pool);
    const iban = bank?.iban ? bank.iban.replace(/(.{4})/g, '$1 ').trim() : '—';
    const bic = bank?.bic || '—';
    zahlungsteil = `
      <p style="margin:0 0 4px;">Bitte &uuml;berweise den Betrag bis zum <strong style="color:#1e293b;">${ziel}</strong> auf folgendes Konto:</p>
      <div class="box">
        <p><strong style="color:#1e293b;">Kontoinhaber:</strong> ${KONTOINHABER}</p>
        <p><strong style="color:#1e293b;">IBAN:</strong> ${iban}</p>
        <p><strong style="color:#1e293b;">BIC:</strong> ${bic}</p>
        <p><strong style="color:#1e293b;">Verwendungszweck:</strong> ${m.mitgliedsnummer || rechnungsnummer}</p>
      </div>`;
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
  const betreff = 'Deine Rechnung – TDA Verband (Mitgliedsbeitrag)';
  const text = `Rechnung ${rechnungsnummer} – Jahresbeitrag ${fmtBetrag(m.jahresbeitrag)}, Mitgliedsnummer ${m.mitgliedsnummer}.`;
  const r = await sendEmailForDojo({ to: email, subject: betreff, html, text }, VERBAND_DOJO_ID);
  await logMail(pool, { mitgliedschaftId: m.id, empfaenger: email, typ: `rechnung ${rechnungsnummer}`, betreff, html, text, result: r });
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

module.exports = { sendWillkommen, sendRechnung, processFaelligeRechnungen, naechsteRechnungsnummer };
