// =====================================================================================
// Erzeugt den korrigierten Mitgliedsvertrag (mit echten Daten) neu und sendet die
// Willkommensmail mit korrektem PDF erneut.
//   node scripts/resend-vertrag.js <mitglied_id> [empfaenger_email]
// =====================================================================================
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const db = require('../db');
const { generateAndStoreContractPdf } = require('../routes/public-registration');
const { sendEmailForDojo } = require('../services/emailService');

const q = (sql, p = []) => new Promise((res, rej) => db.query(sql, p, (e, r) => e ? rej(e) : res(r)));

(async () => {
  const mitgliedId = parseInt(process.argv[2], 10);
  if (!mitgliedId) { console.error('Aufruf: node scripts/resend-vertrag.js <mitglied_id> [email]'); process.exit(1); }

  const [m] = await q('SELECT * FROM mitglieder WHERE mitglied_id = ?', [mitgliedId]);
  if (!m) { console.error('Mitglied nicht gefunden:', mitgliedId); process.exit(1); }

  const empfaenger = process.argv[3] || m.email;
  if (!empfaenger) { console.error('Keine Empfänger-E-Mail'); process.exit(1); }

  const vertraege = await q(
    "SELECT * FROM vertraege WHERE mitglied_id = ? ORDER BY (status='aktiv') DESC, id DESC LIMIT 1",
    [mitgliedId]
  );
  const vertragId = vertraege.length ? vertraege[0].id : null;

  const [dojo] = await q('SELECT dojoname FROM dojo WHERE id = ?', [m.dojo_id]);
  const dojoName = dojo?.dojoname || 'Ihr Dojo';

  console.log(`→ Erzeuge Vertrag: ${m.vorname} ${m.nachname} (id ${mitgliedId}), Vertrag ${vertragId}, Dojo ${m.dojo_id} → ${empfaenger}`);
  const pdfBuffer = await generateAndStoreContractPdf(mitgliedId, m.dojo_id, vertragId);
  if (!pdfBuffer) { console.error('PDF-Erzeugung fehlgeschlagen (keine aktive Vorlage oder Fehler)'); process.exit(1); }
  console.log(`  PDF erzeugt (${pdfBuffer.length} Bytes)`);

  await sendEmailForDojo({
    to: empfaenger,
    subject: `Willkommen bei ${dojoName} – Ihr Mitgliedsvertrag`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#1a1a2e;">Willkommen, ${m.vorname}!</h2>
      <p>Vielen Dank für Ihre Registrierung bei <strong>${dojoName}</strong>.</p>
      <p>Ihre Mitgliedsnummer lautet: <strong>${m.mitgliedsnummer || m.mitglied_id}</strong></p>
      <p>Im Anhang finden Sie Ihren Mitgliedsvertrag als PDF. Eine zuvor versandte Version enthielt
         versehentlich Platzhalter – bitte verwenden Sie diese korrigierte Fassung.</p>
      <p>Bei Fragen wenden Sie sich gerne an uns.</p>
      <p style="margin-top:2rem;">Mit freundlichen Grüßen,<br>${dojoName}</p>
    </div>`,
    text: `Willkommen ${m.vorname}! Ihre Mitgliedsnummer: ${m.mitgliedsnummer || m.mitglied_id}. Mitgliedsvertrag (korrigiert) im Anhang.`,
    attachments: [{ filename: 'Mitgliedsvertrag.pdf', content: pdfBuffer, contentType: 'application/pdf' }],
  }, m.dojo_id);

  console.log('✓ Willkommensmail mit korrektem Vertrag gesendet an', empfaenger);
  process.exit(0);
})().catch((e) => { console.error('FEHLER:', e.message); process.exit(1); });
