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
const { buildWelcomeContractMail } = require('../services/welcomeContractMail');

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

  const mail = await buildWelcomeContractMail({ mitglied: m, dojoName, korrigiert: true });
  await sendEmailForDojo({
    to: empfaenger,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    attachments: [{ filename: 'Mitgliedsvertrag.pdf', content: pdfBuffer, contentType: 'application/pdf' }],
  }, m.dojo_id);

  console.log('✓ Willkommensmail mit korrektem Vertrag gesendet an', empfaenger);
  process.exit(0);
})().catch((e) => { console.error('FEHLER:', e.message); process.exit(1); });
