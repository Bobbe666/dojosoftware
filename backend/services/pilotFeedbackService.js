// ============================================================================
// PILOT-PARTNER FEEDBACK-SERVICE
// Fragenkatalog + Zeitplan + Versand der Feedback-Umfragen an Pilot-Partner.
//
// Zeitplan ab programm_start (gesetzt wenn Bewerbung → "gewonnen"):
//   Tag 14:  einrichtung   — "Wie war die Einrichtung?"
//   Tag 28:  erfahrung     — "Eure ersten Erfahrungen"
//   Tag 56, 84, 112, ...:  laufend (alle 28 Tage) — "Wie läuft's?"
//   Ende: 12 Monate nach programm_start
//
// processPilotFeedback() läuft täglich per Cron (cron-jobs.js):
//   1. Plant fällige Umfragen für alle gewonnenen Partner
//   2. Versendet fällige, ungesendete Umfragen per E-Mail (Token-Link)
//   3. Erinnert einmalig nach 7 Tagen ohne Antwort
// ============================================================================
const crypto = require('crypto');
const db = require('../db');
const { sendEmail } = require('./emailService');

const pool = db.promise();

const FEEDBACK_BASE_URL = 'https://dojo.tda-intl.org/pilot-feedback';
const PROGRAMM_DAUER_TAGE = 365;   // 12 Monate Pilot-Programm
const ERINNERUNG_NACH_TAGEN = 7;   // einmalige Erinnerung

// ─────────────────────────────────────────────────────────────────────────────
// FRAGENKATALOG — bewusst kurz: 4-5 Fragen + Kommentar, ~2 Minuten
// typ: 'rating' (1-5 Sterne) | 'choice' (Mehrfachauswahl) | 'text' (Kommentar)
// ─────────────────────────────────────────────────────────────────────────────
const FRAGEBOEGEN = {
  einrichtung: {
    titel: 'Wie war die Einrichtung?',
    intro: 'Ihr seid jetzt zwei Wochen dabei — wie ist es euch bei der Einrichtung ergangen? 5 kurze Fragen, keine 2 Minuten.',
    fragen: [
      { key: 'einfachheit',     typ: 'rating', text: 'Wie einfach war die Ersteinrichtung für euch?' },
      { key: 'unterstuetzung',  typ: 'rating', text: 'Wie zufrieden wart ihr mit unserer persönlichen Unterstützung?' },
      { key: 'datenuebernahme', typ: 'rating', text: 'Wie gut hat die Datenübernahme geklappt?' },
      { key: 'alltag',          typ: 'rating', text: 'Wie gut kommt ihr bisher im Alltag zurecht?' },
      { key: 'kommentar',       typ: 'text',   text: 'Was hat euch bei der Einrichtung gefehlt oder gestört?', optional: true },
    ],
  },
  erfahrung: {
    titel: 'Eure ersten Erfahrungen',
    intro: 'Einen Monat im Einsatz — wie schlägt sich die Software bei euch? 5 kurze Fragen, keine 2 Minuten.',
    fragen: [
      { key: 'gesamt',       typ: 'rating', text: 'Wie zufrieden seid ihr nach den ersten Wochen insgesamt?' },
      { key: 'trainer',      typ: 'rating', text: 'Wie kommen eure Trainer mit der Software zurecht?' },
      { key: 'mitglieder',   typ: 'rating', text: 'Wie kommen eure Mitglieder mit der App zurecht?' },
      { key: 'meistgenutzt', typ: 'choice', text: 'Welche Funktionen nutzt ihr am meisten?',
        optionen: ['Mitgliederverwaltung', 'Beiträge & SEPA', 'Check-in', 'Prüfungswesen', 'Mitglieder-App', 'Kommunikation'] },
      { key: 'fehlt',        typ: 'text',   text: 'Was fehlt euch aktuell am meisten?', optional: true },
    ],
  },
  laufend: {
    titel: 'Wie läuft’s?',
    intro: 'Unser regelmäßiger Kurz-Check — 5 Fragen, keine 2 Minuten. Euer Feedback fließt direkt in die Entwicklung ein.',
    fragen: [
      { key: 'gesamt',       typ: 'rating', text: 'Wie zufrieden seid ihr aktuell insgesamt?' },
      { key: 'stabilitaet',  typ: 'rating', text: 'Wie zuverlässig und schnell läuft die Software?' },
      { key: 'empfehlung',   typ: 'rating', text: 'Wie wahrscheinlich würdet ihr die Software einer anderen Schule empfehlen?' },
      { key: 'verbesserung', typ: 'text',   text: 'Was sollten wir als Nächstes verbessern?', optional: true },
      { key: 'highlight',    typ: 'text',   text: 'Was gefällt euch aktuell am besten?', optional: true },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function umfrageTitel(typ, runde) {
  const basis = FRAGEBOEGEN[typ].titel;
  return typ === 'laufend' ? `${basis} (Check ${runde})` : basis;
}

async function sendUmfrageMail(umfrage, partner, istErinnerung = false) {
  const link = `${FEEDBACK_BASE_URL}/${umfrage.token}`;
  const titel = umfrageTitel(umfrage.typ, umfrage.runde);
  const intro = FRAGEBOEGEN[umfrage.typ].intro;

  const betreff = istErinnerung
    ? `Kurze Erinnerung: ${titel} — euer Feedback als Pilot-Partner 🥋`
    : `${titel} — euer Feedback als Pilot-Partner 🥋`;

  const text =
    `Hallo ${partner.ansprechpartner},\n\n` +
    (istErinnerung ? `kleine Erinnerung — wir würden uns weiterhin über euer Feedback freuen:\n\n` : '') +
    `${intro}\n\n` +
    `Hier geht's zum Fragebogen (kein Login nötig):\n${link}\n\n` +
    `Vielen Dank, dass ihr als Pilot-Partner dabei seid!\n\n` +
    `Viele Grüße\nTDA Systems`;

  const html =
    `<p>Hallo <strong>${partner.ansprechpartner}</strong>,</p>` +
    (istErinnerung ? `<p>kleine Erinnerung — wir würden uns weiterhin über euer Feedback freuen:</p>` : '') +
    `<p>${intro}</p>` +
    `<p style="margin:24px 0"><a href="${link}" style="display:inline-block;padding:12px 26px;background:linear-gradient(135deg,#f7d98f,#d9aa43);color:#050608;border-radius:8px;text-decoration:none;font-weight:bold">📝 Zum Fragebogen (2 Minuten)</a></p>` +
    `<p style="color:#666;font-size:13px">Oder direkt im Browser öffnen: <a href="${link}">${link}</a> — kein Login nötig.</p>` +
    `<p>Vielen Dank, dass ihr als Pilot-Partner dabei seid!</p>` +
    `<p>Viele Grüße<br><strong>TDA Systems</strong></p>`;

  await sendEmail({
    to: partner.email,
    subject: betreff,
    text,
    html,
    replyTo: 'info@tda-intl.com',
    bcc: 'info@tda-intl.com'
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Zeitplan: stellt sicher, dass für einen Partner alle fälligen Umfragen
// als Datensätze existieren (einrichtung Tag 14, erfahrung Tag 28,
// laufend ab Tag 56 alle 28 Tage bis Programm-Ende)
// ─────────────────────────────────────────────────────────────────────────────
async function planeUmfragen(partner) {
  const heute = new Date().toISOString().slice(0, 10);
  const programmEnde = addDays(partner.programm_start, PROGRAMM_DAUER_TAGE);

  const geplant = [
    { typ: 'einrichtung', runde: 1, faellig_am: addDays(partner.programm_start, 14) },
    { typ: 'erfahrung',   runde: 1, faellig_am: addDays(partner.programm_start, 28) },
  ];
  // Laufende Checks: Tag 56, 84, 112, ... bis Programm-Ende
  let runde = 1;
  let tag = 56;
  while (addDays(partner.programm_start, tag) <= programmEnde) {
    geplant.push({ typ: 'laufend', runde, faellig_am: addDays(partner.programm_start, tag) });
    runde++;
    tag += 28;
  }

  for (const u of geplant) {
    // Nur anlegen, was fällig ist oder in den nächsten 7 Tagen fällig wird
    if (u.faellig_am > addDays(heute, 7)) continue;
    const token = crypto.randomBytes(24).toString('hex');
    await pool.query(`
      INSERT IGNORE INTO pilot_feedback_umfragen (bewerbung_id, typ, runde, faellig_am, token)
      VALUES (?, ?, ?, ?, ?)
    `, [partner.id, u.typ, u.runde, u.faellig_am, token]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Täglicher Cron-Lauf
// ─────────────────────────────────────────────────────────────────────────────
async function processPilotFeedback() {
  const ergebnis = { geplant: 0, gesendet: 0, erinnert: 0, fehler: 0 };

  // 1) Gewonnene Partner mit Programm-Start → Zeitplan sicherstellen
  const [partner] = await pool.query(`
    SELECT id, schulname, ansprechpartner, email, programm_start
    FROM pilot_bewerbungen
    WHERE status = 'gewonnen' AND programm_start IS NOT NULL
      AND programm_start > DATE_SUB(CURDATE(), INTERVAL ${PROGRAMM_DAUER_TAGE + 30} DAY)
  `);

  for (const p of partner) {
    try {
      await planeUmfragen(p);
    } catch (err) {
      console.error(`[Pilot-Feedback] Planung Fehler (Partner ${p.id}):`, err.message);
      ergebnis.fehler++;
    }
  }

  // 2) Fällige, ungesendete Umfragen versenden
  const [faellige] = await pool.query(`
    SELECT u.*, b.schulname, b.ansprechpartner, b.email
    FROM pilot_feedback_umfragen u
    JOIN pilot_bewerbungen b ON b.id = u.bewerbung_id
    WHERE u.gesendet_am IS NULL AND u.faellig_am <= CURDATE()
      AND b.status = 'gewonnen'
  `);

  for (const u of faellige) {
    try {
      await sendUmfrageMail(u, u);
      await pool.query('UPDATE pilot_feedback_umfragen SET gesendet_am = NOW() WHERE id = ?', [u.id]);
      ergebnis.gesendet++;
    } catch (err) {
      console.error(`[Pilot-Feedback] Versand Fehler (Umfrage ${u.id}):`, err.message);
      ergebnis.fehler++;
    }
  }

  // 3) Einmalige Erinnerung nach 7 Tagen ohne Antwort
  const [offene] = await pool.query(`
    SELECT u.*, b.schulname, b.ansprechpartner, b.email
    FROM pilot_feedback_umfragen u
    JOIN pilot_bewerbungen b ON b.id = u.bewerbung_id
    WHERE u.beantwortet_am IS NULL AND u.erinnert_am IS NULL
      AND u.gesendet_am IS NOT NULL
      AND u.gesendet_am < DATE_SUB(NOW(), INTERVAL ${ERINNERUNG_NACH_TAGEN} DAY)
      AND b.status = 'gewonnen'
  `);

  for (const u of offene) {
    try {
      await sendUmfrageMail(u, u, true);
      await pool.query('UPDATE pilot_feedback_umfragen SET erinnert_am = NOW() WHERE id = ?', [u.id]);
      ergebnis.erinnert++;
    } catch (err) {
      console.error(`[Pilot-Feedback] Erinnerung Fehler (Umfrage ${u.id}):`, err.message);
      ergebnis.fehler++;
    }
  }

  return ergebnis;
}

module.exports = {
  FRAGEBOEGEN,
  umfrageTitel,
  planeUmfragen,
  processPilotFeedback,
  sendUmfrageMail,
};
