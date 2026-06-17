/**
 * VERTRAG-ANPASSUNGEN
 * Zeitlich begrenzte Tarifanpassungen (Schüler, Student, Azubi, etc.)
 * Auto-geladen als /api/vertrag-anpassungen
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const webpush = require('web-push');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const { authenticateToken } = require('../middleware/auth');
const { sendEmailForDojo } = require('../services/emailService');

const pool = db.promise();

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@dojo.tda-intl.org',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Hilfsfunktion: mitglied_id aus JWT ermitteln (direkt oder via users-Tabelle)
async function getMitgliedId(user) {
  if (user.mitglied_id) return user.mitglied_id;
  // Direkte ID-Suche (member JWT: users.id)
  if (user.id) {
    const [[row]] = await pool.query('SELECT mitglied_id FROM users WHERE id = ?', [user.id]);
    if (row && row.mitglied_id) return row.mitglied_id;
  }
  // Fallback per E-Mail (admin JWT: admin_users.id != users.id)
  if (user.email) {
    const [[row]] = await pool.query('SELECT mitglied_id FROM users WHERE email = ?', [user.email]);
    if (row && row.mitglied_id) return row.mitglied_id;
  }
  return null;
}

const TYP_LABELS = {
  schueler: 'Schüler', student: 'Student', azubi: 'Azubi',
  rentner: 'Rentner', sonstiges: 'Sonstiges', ruhepause: 'Ruhepause', kuendigung: 'Kündigung'
};

// Rechtssicheres Mail-Log für Mitglieder: jede gesendete Mail gespeichert + zugeordnet
async function logMitgliedMail({ mitglied_id, dojo_id, empfaenger, typ, betreff, html, text, status = 'gesendet' }) {
  try {
    await pool.query(
      `INSERT INTO mitglied_mail_log (mitglied_id, dojo_id, empfaenger, typ, betreff, html, text_inhalt, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [mitglied_id || null, dojo_id || null, empfaenger || null, typ, betreff || null, html || null, text || null, status]);
  } catch (e) { /* Logging darf den Flow nie blockieren */ }
}

async function sendMemberNotification(email, subject, message) {
  try {
    await pool.query(
      "INSERT INTO notifications (type, recipient, subject, message, status, created_at) VALUES ('push', ?, ?, ?, 'unread', NOW())",
      [email, subject, message]
    );
  } catch (e) {
    console.error('[vertrag-anpassungen] Notification-Fehler:', e.message);
  }
}

async function sendAdminPushNotifications(dojo_id, title, body, data) {
  try {
    const [subs] = await pool.query(
      `SELECT ps.endpoint, ps.p256dh_key, ps.auth_key
       FROM push_subscriptions ps
       JOIN admin_users au ON au.id = ps.user_id
       WHERE au.dojo_id = ? AND ps.is_active = TRUE`,
      [dojo_id]
    );
    const payload = JSON.stringify({
      title, body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: data || { url: '/dashboard/mitglieder' }
    });
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
          payload
        );
      } catch (e) {
        if (e.statusCode === 410 || e.statusCode === 404) {
          await pool.query('UPDATE push_subscriptions SET is_active = FALSE WHERE endpoint = ?', [sub.endpoint]);
        }
      }
    }
  } catch (e) {
    console.error('[vertrag-anpassungen] Push-Fehler:', e.message);
  }
}

async function applyBeitraege(mitglied_id, gueltig_von, gueltig_bis, betrag) {
  const [r] = await pool.query(
    `UPDATE beitraege SET betrag = ?
     WHERE mitglied_id = ? AND zahlungsdatum BETWEEN ? AND ? AND bezahlt = 0`,
    [betrag, mitglied_id, gueltig_von, gueltig_bis]
  );
  return r.affectedRows;
}

// Ordentliches Kündigungsdatum: IMMER zum Vertragsende mit Kündigungsfrist (Standard 3 Monate).
// Keine Ausnahmen — eine vorzeitige Beendigung ist über diesen Weg nicht möglich.
// Rückgabe: { datum: 'YYYY-MM-DD', frist, basis: 'vertragsende'|'monatsende' }
function berechneKuendigungsdatum(vertrag, heute = new Date()) {
  const frist = parseInt(vertrag?.kuendigungsfrist_monate) || 3;

  // Fester Vertrag mit Laufzeitende → zum (ggf. verlängerten) Vertragsende kündbar
  if (vertrag?.vertragsende) {
    let ende = new Date(vertrag.vertragsende);
    const verl = parseInt(vertrag.verlaengerung_monate) || 12;
    const autoVerl = vertrag.automatische_verlaengerung === null || vertrag.automatische_verlaengerung === undefined
      ? true : !!vertrag.automatische_verlaengerung;
    // Stichtag = frist Monate vor Vertragsende. Liegt er in der Vergangenheit, rollt der
    // Vertrag (bei autom. Verlängerung) jeweils um verl Monate weiter, bis er kündbar ist.
    const stichtag = (d) => { const s = new Date(d); s.setMonth(s.getMonth() - frist); return s; };
    let guard = 0;
    while (heute > stichtag(ende) && guard < 240) {
      if (!autoVerl) break; // ohne Verlängerung bleibt es beim regulären Ende
      ende.setMonth(ende.getMonth() + verl);
      guard++;
    }
    return { datum: ende.toISOString().slice(0, 10), frist, basis: 'vertragsende' };
  }

  // Offener Vertrag ohne Laufzeitende → frist Monate, zum Monatsende
  const ende = new Date(heute);
  ende.setMonth(ende.getMonth() + frist + 1);
  ende.setDate(0); // letzter Tag des Zielmonats
  return { datum: ende.toISOString().slice(0, 10), frist, basis: 'monatsende' };
}

// ── GET /mitglied/:id  (Admin: alle Anpassungen eines Mitglieds) ──────────
router.get('/mitglied/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM vertrag_anpassungen WHERE mitglied_id = ? ORDER BY erstellt_am DESC`,
      [parseInt(req.params.id)]
    );
    res.json({ success: true, anpassungen: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /mitglied/:id/mail-log  (Admin: gesendete Mails eines Mitglieds, rechtssicher) ──
router.get('/mitglied/:id/mail-log', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, typ, betreff, empfaenger, status, gesendet_am, html, text_inhalt
       FROM mitglied_mail_log WHERE mitglied_id = ? ORDER BY gesendet_am DESC`,
      [parseInt(req.params.id)]
    );
    res.json({ success: true, mails: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /  (Admin erstellt → sofort genehmigt) ──────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { mitglied_id, typ, alter_betrag, neuer_betrag, gueltig_von, gueltig_bis, grund } = req.body;
    const dojoId = getSecureDojoId(req);
    if (!dojoId && !(req.user?.rolle === 'super_admin' || req.user?.role === 'super_admin')) {
      return res.status(403).json({ success: false, error: 'Keine Dojo-Zuordnung' });
    }

    if (!mitglied_id || !typ || !neuer_betrag || !gueltig_von || !gueltig_bis) {
      return res.status(400).json({ success: false, error: 'Pflichtfelder fehlen' });
    }

    const [ins] = await pool.query(
      `INSERT INTO vertrag_anpassungen
       (mitglied_id, dojo_id, typ, alter_betrag, neuer_betrag, gueltig_von, gueltig_bis, status, grund, erstellt_von, genehmigt_am)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'genehmigt', ?, 'admin', NOW())`,
      [mitglied_id, dojoId, typ, alter_betrag || 0, neuer_betrag, gueltig_von, gueltig_bis, grund || null]
    );

    const affected = await applyBeitraege(mitglied_id, gueltig_von, gueltig_bis, neuer_betrag);
    await pool.query(`UPDATE mitglieder SET schueler_student = 1 WHERE mitglied_id = ?`, [mitglied_id]);

    const [[m]] = await pool.query(`SELECT email, vorname, nachname FROM mitglieder WHERE mitglied_id = ?`, [mitglied_id]);
    if (m?.email) {
      const lbl = TYP_LABELS[typ] || typ;
      const von = new Date(gueltig_von).toLocaleDateString('de-DE');
      const bis = new Date(gueltig_bis).toLocaleDateString('de-DE');
      await sendMemberNotification(
        m.email,
        `📋 Tarifänderung: ${lbl}-Tarif aktiviert`,
        `Dein Tarif wurde auf ${parseFloat(neuer_betrag).toFixed(2).replace('.', ',')} €/Monat angepasst (${lbl}). Gültig: ${von} – ${bis}.`
      );
    }

    res.json({ success: true, id: ins.insertId, angepasste_beitraege: affected });
  } catch (err) {
    console.error('[vertrag-anpassungen] POST error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /beantragen  (Mitglied stellt Antrag) ───────────────────────────
router.post('/beantragen', authenticateToken, async (req, res) => {
  try {
    const mitglied_id = await getMitgliedId(req.user);
    if (!mitglied_id) return res.status(403).json({ success: false, error: 'Kein Mitglied-Konto verknüpft.' });

    const { typ, gueltig_von, gueltig_bis, grund } = req.body;
    // Bei Kündigung wird das Datum serverseitig zwingend berechnet (kein Client-Wert nötig)
    if (!typ || (typ !== 'kuendigung' && (!gueltig_von || !gueltig_bis))) {
      return res.status(400).json({ success: false, error: 'Pflichtfelder fehlen' });
    }

    const [[lb]] = await pool.query(
      `SELECT betrag FROM beitraege WHERE mitglied_id = ? AND bezahlt = 0 ORDER BY zahlungsdatum ASC LIMIT 1`,
      [mitglied_id]
    );
    const [[mem]] = await pool.query(`SELECT m.dojo_id, d.ruhepause_max_monate FROM mitglieder m LEFT JOIN dojo d ON m.dojo_id = d.id WHERE m.mitglied_id = ?`, [mitglied_id]);
    if (!mem) return res.status(404).json({ success: false, error: 'Mitglied nicht gefunden.' });

    // Effektive Gültigkeit — bei Kündigung serverseitig erzwungen, sonst vom Mitglied
    let effektivVon = gueltig_von || new Date().toISOString().slice(0, 10);
    let effektivBis = gueltig_bis || null;

    if (typ === 'ruhepause') {
      const maxMonate = mem.ruhepause_max_monate || 3;
      const von = new Date(gueltig_von);
      const bis = new Date(gueltig_bis);
      const diffMonate = (bis.getFullYear() - von.getFullYear()) * 12 + (bis.getMonth() - von.getMonth()) + (bis.getDate() >= von.getDate() ? 0 : -1) + 1;
      if (diffMonate > maxMonate) {
        return res.status(400).json({ success: false, error: `Ruhepause darf maximal ${maxMonate} Monat${maxMonate !== 1 ? 'e' : ''} dauern.` });
      }
    }

    if (typ === 'kuendigung') {
      // Prüfe ob Online-Kündigung für dieses Dojo aktiviert ist
      const [[dojoSettings]] = await pool.query(
        'SELECT kuendigung_schriftlich FROM dojo WHERE id = ?', [mem.dojo_id]
      );
      if (dojoSettings?.kuendigung_schriftlich) {
        return res.status(403).json({ success: false, error: 'Online-Kündigung ist für dieses Dojo nicht aktiviert. Bitte wenden Sie sich direkt ans Dojo.' });
      }

      // Aktiven Vertrag laden um das ordentliche Kündigungsdatum zu berechnen
      const [[vertrag]] = await pool.query(
        `SELECT kuendigungsfrist_monate, kuendigungsdatum, vertragsende, verlaengerung_monate, automatische_verlaengerung
         FROM vertraege
         WHERE mitglied_id = ? AND status IN ('aktiv','ruhepause') ORDER BY vertragsbeginn DESC LIMIT 1`,
        [mitglied_id]
      );
      if (!vertrag) return res.status(400).json({ success: false, error: 'Kein aktiver Vertrag gefunden.' });
      if (vertrag.kuendigungsdatum) return res.status(400).json({ success: false, error: 'Eine Kündigung liegt bereits vor.' });

      // FESTE REGEL: Kündigung immer 3 Monate zum Vertragsende — keine Ausnahmen.
      // Das Datum wird serverseitig erzwungen; ein vom Client gesendeter Wunschtermin
      // wird bewusst ignoriert, eine vorzeitige Beendigung ist hier nicht möglich.
      const k = berechneKuendigungsdatum(vertrag);
      effektivVon = new Date().toISOString().slice(0, 10); // Kündigungseingang = heute
      effektivBis = k.datum;                                // ordentliches Vertragsende
    }

    const [ins] = await pool.query(
      `INSERT INTO vertrag_anpassungen
       (mitglied_id, dojo_id, typ, alter_betrag, neuer_betrag, gueltig_von, gueltig_bis, status, grund, erstellt_von)
       VALUES (?, ?, ?, ?, 0, ?, ?, 'beantragt', ?, 'mitglied')`,
      [mitglied_id, mem.dojo_id, typ, lb?.betrag || 0, effektivVon, effektivBis, grund || null]
    );

    // Admin-Benachrichtigung für Ruhepause- und Kündigungs-Anträge
    if ((typ === 'ruhepause' || typ === 'kuendigung') && mem.dojo_id) {
      try {
        const [[memInfo]] = await pool.query('SELECT vorname, nachname FROM mitglieder WHERE mitglied_id = ?', [mitglied_id]);
        const name = memInfo ? `${memInfo.vorname} ${memInfo.nachname}` : `Mitglied #${mitglied_id}`;
        const vonStr = new Date(effektivVon).toLocaleDateString('de-DE');
        const bisStr = new Date(effektivBis).toLocaleDateString('de-DE');

        const isKuendigung = typ === 'kuendigung';
        const notifSubject = isKuendigung ? 'Kündigung beantragt' : 'Ruhepause beantragt';
        const notifMsg = isKuendigung
          ? `${name} hat eine Kündigung beantragt${bisStr ? ' zum ' + bisStr : ''}.`
          : `${name} hat eine Ruhepause beantragt (${vonStr} – ${bisStr})`;
        const notifType = isKuendigung ? 'kuendigung_antrag' : 'ruhepause_antrag';

        await pool.query(
          `INSERT INTO notifications (type, recipient, subject, message, status, requires_confirmation, metadata, created_at)
           VALUES ('admin_alert', 'admin', ?, ?, 'unread', 1, ?, NOW())`,
          [
            notifSubject,
            notifMsg,
            JSON.stringify({
              type: notifType,
              antrag_id: ins.insertId,
              mitglied_id,
              dojo_id: mem.dojo_id,
              gueltig_von: effektivVon || null,
              gueltig_bis: effektivBis || null,
              vorname: memInfo?.vorname,
              nachname: memInfo?.nachname,
              grund: grund || null
            })
          ]
        );

        await sendAdminPushNotifications(
          mem.dojo_id,
          isKuendigung ? '❌ Kündigung beantragt' : '⏸️ Ruhepause beantragt',
          notifMsg,
          { url: '/dashboard/mitglieder' }
        );
      } catch (notifErr) {
        console.error('[vertrag-anpassungen] Admin-Notif-Fehler:', notifErr.message);
      }
    }

    // E-Mail-Bestätigung an Mitglied bei Kündigungs-Antrag
    if (typ === 'kuendigung') {
      try {
        const [[memMail]] = await pool.query(
          'SELECT m.email, m.vorname, m.nachname, d.dojoname FROM mitglieder m JOIN dojo d ON m.dojo_id = d.id WHERE m.mitglied_id = ?',
          [mitglied_id]
        );
        if (memMail?.email) {
          const bisStr = effektivBis ? new Date(effektivBis).toLocaleDateString('de-DE') : '—';
          await sendEmailForDojo({
            to: memMail.email,
            subject: `Kündigung eingegangen – ${memMail.dojoname}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
              <div style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:28px;border-radius:10px 10px 0 0;text-align:center">
                <h2 style="color:#FFD700;margin:0">Kündigung eingegangen</h2>
              </div>
              <div style="background:#fff;padding:28px;border-radius:0 0 10px 10px">
                <p>Sehr geehrte/r ${memMail.vorname} ${memMail.nachname},</p>
                <p>wir haben Ihren Kündigungsantrag erhalten. Die Kündigung wird durch den Administrator geprüft und bestätigt.</p>
                <p>Ihr Vertrag endet ordentlich zum nachstehenden Datum (Kündigungsfrist 3 Monate zum Vertragsende):</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0">
                  <tr><td style="padding:8px;color:#666;width:50%">Vertragsende:</td><td style="padding:8px;font-weight:600">${bisStr}</td></tr>
                </table>
                <p style="color:#555">Sie erhalten eine weitere E-Mail, sobald Ihre Kündigung bestätigt wurde.</p>
                <p>Mit freundlichen Grüßen<br><strong>${memMail.dojoname}</strong></p>
              </div>
            </div>`,
            text: `Kündigung eingegangen\n\nSehr geehrte/r ${memMail.vorname} ${memMail.nachname},\n\nwir haben Ihren Kündigungsantrag zum ${bisStr} erhalten. Die Kündigung wird durch den Administrator geprüft.\n\nMit freundlichen Grüßen\n${memMail.dojoname}`
          }, mem.dojo_id);
        }
      } catch (mailErr) {
        console.error('[vertrag-anpassungen] Kündigungs-Eingangsmail Fehler:', mailErr.message);
      }
    }

    res.json({ success: true, id: ins.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /meine  (Mitglied sieht eigene Anpassungen) ─────────────────────
router.get('/meine', authenticateToken, async (req, res) => {
  try {
    const mitglied_id = await getMitgliedId(req.user);
    if (!mitglied_id) return res.status(403).json({ success: false, error: 'Kein Mitglied-Konto.' });
    const [rows] = await pool.query(
      `SELECT * FROM vertrag_anpassungen WHERE mitglied_id = ? ORDER BY erstellt_am DESC LIMIT 10`,
      [mitglied_id]
    );
    res.json({ success: true, anpassungen: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PUT /:id  (Admin bearbeitet eine bestehende Anpassung) ──────────────
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { typ, neuer_betrag, gueltig_von, gueltig_bis, grund } = req.body;

    const [[a]] = await pool.query(`SELECT * FROM vertrag_anpassungen WHERE id = ?`, [id]);
    if (!a) return res.status(404).json({ success: false, error: 'Nicht gefunden' });

    const updTyp = typ || a.typ;
    const updBetrag = neuer_betrag != null ? parseFloat(neuer_betrag) : a.neuer_betrag;
    const updVon = gueltig_von || a.gueltig_von;
    const updBis = gueltig_bis || a.gueltig_bis;
    const updGrund = grund !== undefined ? grund : a.grund;

    await pool.query(
      `UPDATE vertrag_anpassungen SET typ=?, neuer_betrag=?, gueltig_von=?, gueltig_bis=?, grund=? WHERE id=?`,
      [updTyp, updBetrag, updVon, updBis, updGrund, id]
    );

    // Beiträge neu anwenden: altes Range zurücksetzen (alter_betrag), neuen Range setzen
    if (a.alter_betrag > 0) {
      await pool.query(
        `UPDATE beitraege SET betrag = ? WHERE mitglied_id = ? AND zahlungsdatum BETWEEN ? AND ? AND bezahlt = 0`,
        [a.alter_betrag, a.mitglied_id, a.gueltig_von, a.gueltig_bis]
      );
    }
    const affected = await applyBeitraege(a.mitglied_id, updVon, updBis, updBetrag);

    res.json({ success: true, angepasste_beitraege: affected });
  } catch (err) {
    console.error('[vertrag-anpassungen] PUT error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /:id/neu-anwenden  (Beiträge erneut mit Anpassung synchronisieren) ──
router.post('/:id/neu-anwenden', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [[a]] = await pool.query(`SELECT * FROM vertrag_anpassungen WHERE id = ?`, [id]);
    if (!a) return res.status(404).json({ success: false, error: 'Nicht gefunden' });
    if (a.status !== 'genehmigt') return res.status(400).json({ success: false, error: 'Nur genehmigte Anpassungen können angewendet werden.' });

    const affected = await applyBeitraege(a.mitglied_id, a.gueltig_von, a.gueltig_bis, a.neuer_betrag);
    res.json({ success: true, angepasste_beitraege: affected });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PUT /:id/genehmigen  (Admin genehmigt Mitglied-Antrag) ───────────────
router.put('/:id/genehmigen', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { neuer_betrag, anmerkung_admin } = req.body;

    const [[a]] = await pool.query(`SELECT * FROM vertrag_anpassungen WHERE id = ?`, [id]);
    if (!a) return res.status(404).json({ success: false, error: 'Nicht gefunden' });

    const betrag = neuer_betrag || a.neuer_betrag;
    await pool.query(
      `UPDATE vertrag_anpassungen SET status='genehmigt', neuer_betrag=?, anmerkung_admin=?, genehmigt_am=NOW() WHERE id=?`,
      [betrag, anmerkung_admin || null, id]
    );

    let affected = 0;
    if (a.typ === 'ruhepause') {
      await pool.query(
        `UPDATE vertraege SET ruhepause_von = ?, ruhepause_bis = ?,
          ruhepause_dauer_monate = GREATEST(1, PERIOD_DIFF(DATE_FORMAT(?, '%Y%m'), DATE_FORMAT(?, '%Y%m')) + 1)
         WHERE mitglied_id = ? AND status IN ('aktiv','ruhepause') ORDER BY vertragsbeginn DESC LIMIT 1`,
        [a.gueltig_von, a.gueltig_bis, a.gueltig_bis, a.gueltig_von, a.mitglied_id]
      );
      const today = new Date().toISOString().slice(0, 10);
      if (a.gueltig_von <= today) {
        await pool.query(
          `UPDATE vertraege SET status = 'ruhepause' WHERE mitglied_id = ? AND status = 'aktiv' ORDER BY vertragsbeginn DESC LIMIT 1`,
          [a.mitglied_id]
        );
      }
    } else if (a.typ === 'kuendigung') {
      const kuendigungsdatum = a.gueltig_bis || a.gueltig_von;
      await pool.query(
        `UPDATE vertraege SET status = 'gekuendigt', kuendigungsdatum = ?, vertragsende = ?, kuendigung_eingegangen = ?
         WHERE mitglied_id = ? AND status IN ('aktiv','ruhepause') ORDER BY vertragsbeginn DESC LIMIT 1`,
        [kuendigungsdatum, kuendigungsdatum, a.erstellt_am, a.mitglied_id]
      );
      await pool.query(
        `UPDATE mitglieder SET gekuendigt = 1, gekuendigt_am = ? WHERE mitglied_id = ?`,
        [kuendigungsdatum, a.mitglied_id]
      );
    } else {
      affected = await applyBeitraege(a.mitglied_id, a.gueltig_von, a.gueltig_bis, betrag);
      await pool.query(`UPDATE mitglieder SET schueler_student = 1 WHERE mitglied_id = ?`, [a.mitglied_id]);
    }

    // Ausstehende Admin-Notification für diesen Antrag als gelesen markieren
    await pool.query(
      `UPDATE notifications SET status='read' WHERE type='admin_alert' AND status='unread' AND metadata LIKE ?`,
      [`%"antrag_id":${id}%`]
    );

    const [[m]] = await pool.query(
      `SELECT m.email, m.vorname, m.nachname, d.dojoname FROM mitglieder m JOIN dojo d ON m.dojo_id = d.id WHERE m.mitglied_id = ?`,
      [a.mitglied_id]
    );
    if (m?.email) {
      if (a.typ === 'kuendigung') {
        const kuendigungsdatum = a.gueltig_bis || a.gueltig_von;
        const bisStr = kuendigungsdatum ? new Date(kuendigungsdatum).toLocaleDateString('de-DE') : '—';
        const vonStr = a.gueltig_von ? new Date(a.gueltig_von).toLocaleDateString('de-DE') : new Date().toLocaleDateString('de-DE');
        const kBetreff = `Kündigung bestätigt – ${m.dojoname}`;
        const kHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
              <div style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:28px;border-radius:10px 10px 0 0;text-align:center">
                <h2 style="color:#FFD700;margin:0">Kündigung bestätigt</h2>
              </div>
              <div style="background:#fff;padding:28px;border-radius:0 0 10px 10px">
                <p>Sehr geehrte/r ${m.vorname} ${m.nachname},</p>
                <p>hiermit bestätigen wir den Eingang und die Bearbeitung Ihrer Kündigung. Deine Mitgliedschaft endet wie folgt:</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f9fafb;border-radius:8px">
                  <tr><td style="padding:10px 16px;color:#666;width:55%">Kündigung eingegangen am:</td><td style="padding:10px 16px;font-weight:600">${vonStr}</td></tr>
                  <tr><td style="padding:10px 16px;color:#666">Vertrag läuft noch bis:</td><td style="padding:10px 16px;font-weight:600;font-size:16px;color:#dc2626">${bisStr}</td></tr>
                  <tr><td style="padding:10px 16px;color:#666">Offizielles Vertragsende:</td><td style="padding:10px 16px;font-weight:600">${bisStr}</td></tr>
                </table>
                <p style="color:#555">Bis zum ${bisStr} nimmst du weiterhin an allen Trainings und Veranstaltungen teil; bis dahin ist auch der reguläre Beitrag fällig.</p>
                ${anmerkung_admin ? `<div style="background:#f0f9ff;border-left:4px solid #3b82f6;padding:12px 16px;margin:16px 0"><p style="margin:0;color:#1e40af"><strong>Hinweis:</strong> ${anmerkung_admin}</p></div>` : ''}
                <p>Wir bedauern, dich als Mitglied zu verlieren, und würden uns freuen, dich zu einem späteren Zeitpunkt wieder bei uns begrüßen zu dürfen.</p>
                <p>Mit freundlichen Grüßen<br><strong>${m.dojoname}</strong></p>
              </div>
            </div>`;
        const kText = `Kündigung bestätigt\n\nSehr geehrte/r ${m.vorname} ${m.nachname},\n\nhiermit bestätigen wir Ihre Kündigung. Offizielles Vertragsende: ${bisStr}. Bis dahin bleibt die Mitgliedschaft aktiv.\n\nMit freundlichen Grüßen\n${m.dojoname}`;
        try {
          await sendEmailForDojo({ to: m.email, subject: kBetreff, html: kHtml, text: kText }, a.dojo_id);
          await logMitgliedMail({ mitglied_id: a.mitglied_id, dojo_id: a.dojo_id, empfaenger: m.email, typ: 'kuendigung_bestaetigt', betreff: kBetreff, html: kHtml, text: kText });
        } catch (mailErr) {
          console.error('[vertrag-anpassungen] Kündigungsbestätigung-Mail Fehler:', mailErr.message);
          await logMitgliedMail({ mitglied_id: a.mitglied_id, dojo_id: a.dojo_id, empfaenger: m.email, typ: 'kuendigung_bestaetigt', betreff: kBetreff, html: kHtml, text: kText, status: 'fehler' });
        }
      } else {
        const lbl = TYP_LABELS[a.typ] || a.typ;
        await sendMemberNotification(
          m.email,
          `✅ Tarifantrag genehmigt: ${lbl}-Tarif`,
          `Dein Antrag auf ${lbl}-Tarif wurde genehmigt! Neuer Beitrag: ${parseFloat(betrag).toFixed(2).replace('.', ',')} €/Monat. Gültig: ${new Date(a.gueltig_von).toLocaleDateString('de-DE')} – ${new Date(a.gueltig_bis).toLocaleDateString('de-DE')}.`
        );
      }
    }

    res.json({ success: true, angepasste_beitraege: affected });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PUT /:id/ablehnen  (Admin lehnt Antrag ab) ───────────────────────────
router.put('/:id/ablehnen', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { anmerkung_admin } = req.body;

    const [[a]] = await pool.query(`SELECT * FROM vertrag_anpassungen WHERE id = ?`, [id]);
    if (!a) return res.status(404).json({ success: false, error: 'Nicht gefunden' });

    await pool.query(
      `UPDATE vertrag_anpassungen SET status='abgelehnt', anmerkung_admin=? WHERE id=?`,
      [anmerkung_admin || null, id]
    );

    // Ausstehende Admin-Notification für diesen Antrag als gelesen markieren
    await pool.query(
      `UPDATE notifications SET status='read' WHERE type='admin_alert' AND status='unread' AND metadata LIKE ?`,
      [`%"antrag_id":${id}%`]
    );

    const [[m]] = await pool.query(`SELECT m.email, m.vorname, m.nachname, d.dojoname FROM mitglieder m JOIN dojo d ON m.dojo_id = d.id WHERE m.mitglied_id = ?`, [a.mitglied_id]);
    if (m?.email) {
      if (a.typ === 'kuendigung') {
        const betreff = `Deine Kündigung – Rückmeldung von ${m.dojoname}`;
        const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
              <div style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:28px;border-radius:10px 10px 0 0;text-align:center">
                <h2 style="color:#FFD700;margin:0">Rückmeldung zu deiner Kündigung</h2>
              </div>
              <div style="background:#fff;padding:28px;border-radius:0 0 10px 10px">
                <p>Sehr geehrte/r ${m.vorname} ${m.nachname},</p>
                <p>vielen Dank für deine eingereichte Kündigung. Leider können wir sie in der vorliegenden Form <strong>nicht annehmen</strong>.</p>
                ${anmerkung_admin ? `<div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;margin:16px 0"><p style="margin:0;color:#991b1b"><strong>Grund:</strong> ${anmerkung_admin}</p></div>` : ''}
                <p style="color:#555">Deine Mitgliedschaft läuft damit unverändert weiter. Bei Fragen oder für eine erneute Einreichung wende dich bitte direkt an uns.</p>
                <p>Mit freundlichen Grüßen<br><strong>${m.dojoname}</strong></p>
              </div>
            </div>`;
        const text = `Rückmeldung zu deiner Kündigung\n\nSehr geehrte/r ${m.vorname} ${m.nachname},\n\nleider können wir deine Kündigung nicht annehmen.${anmerkung_admin ? ' Grund: ' + anmerkung_admin : ''}\nDeine Mitgliedschaft läuft unverändert weiter.\n\nMit freundlichen Grüßen\n${m.dojoname}`;
        try {
          await sendEmailForDojo({ to: m.email, subject: betreff, html, text }, a.dojo_id);
          await logMitgliedMail({ mitglied_id: a.mitglied_id, dojo_id: a.dojo_id, empfaenger: m.email, typ: 'kuendigung_abgelehnt', betreff, html, text });
        } catch (mailErr) {
          console.error('[vertrag-anpassungen] Kündigungs-Ablehnung-Mail Fehler:', mailErr.message);
          await logMitgliedMail({ mitglied_id: a.mitglied_id, dojo_id: a.dojo_id, empfaenger: m.email, typ: 'kuendigung_abgelehnt', betreff, html, text, status: 'fehler' });
        }
      } else {
        const lbl = TYP_LABELS[a.typ] || a.typ;
        await sendMemberNotification(
          m.email,
          `❌ Tarifantrag abgelehnt`,
          `Dein Antrag auf ${lbl}-Tarif wurde leider abgelehnt.${anmerkung_admin ? ' Begründung: ' + anmerkung_admin : ''}`
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// GET /aktive-ruhepause  (Mitglied: aktive/geplante Ruhepause)
router.get('/aktive-ruhepause', authenticateToken, async (req, res) => {
  try {
    const mitglied_id = await getMitgliedId(req.user);
    if (!mitglied_id) return res.status(403).json({ success: false });
    const [vertraege] = await pool.query(
      `SELECT id, status, ruhepause_von, ruhepause_bis, ruhepause_dauer_monate
       FROM vertraege WHERE mitglied_id = ? AND (status IN ('aktiv','ruhepause') OR ruhepause_von IS NOT NULL)
       ORDER BY vertragsbeginn DESC LIMIT 1`,
      [mitglied_id]
    );
    const [pending] = await pool.query(
      `SELECT id, gueltig_von, gueltig_bis, grund, erstellt_am FROM vertrag_anpassungen
       WHERE mitglied_id = ? AND typ = 'ruhepause' AND status = 'beantragt' ORDER BY erstellt_am DESC LIMIT 1`,
      [mitglied_id]
    );
    const v = vertraege[0] || null;
    const today = new Date().toISOString().slice(0, 10);
    const hatRuhepause = v && v.ruhepause_von && (v.status === 'ruhepause' || (today >= v.ruhepause_von && today <= v.ruhepause_bis));
    const geplant = v && v.ruhepause_von && v.ruhepause_von > today;
    res.json({
      success: true, aktiv: !!hatRuhepause, geplant: !!geplant,
      ruhepause: v && v.ruhepause_von ? { von: v.ruhepause_von, bis: v.ruhepause_bis, dauer_monate: v.ruhepause_dauer_monate } : null,
      pending: pending[0] || null
    });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});


// GET /kuendigung-info  (Mitglied: Kündigungsfrist + frühestmögliches Datum)
router.get('/kuendigung-info', authenticateToken, async (req, res) => {
  try {
    const mitglied_id = await getMitgliedId(req.user);
    if (!mitglied_id) return res.status(403).json({ success: false });

    const [[vertrag]] = await pool.query(
      `SELECT kuendigungsfrist_monate, kuendigungsdatum, status, vertragsbeginn, vertragsende,
              mindestlaufzeit_monate, verlaengerung_monate, automatische_verlaengerung
       FROM vertraege WHERE mitglied_id = ? AND status IN ('aktiv','ruhepause','gekuendigt')
       ORDER BY vertragsbeginn DESC LIMIT 1`,
      [mitglied_id]
    );

    if (!vertrag) return res.json({ success: true, keinVertrag: true });

    // FESTE REGEL: ordentliche Kündigung immer zum Vertragsende mit Kündigungsfrist (Standard 3 Monate)
    const kInfo = berechneKuendigungsdatum(vertrag);
    const frist = kInfo.frist;
    const fruehestensStr = kInfo.datum;

    // Ist die Online-Kündigung für dieses Dojo aktiviert?
    const [[mem]] = await pool.query('SELECT dojo_id FROM mitglieder WHERE mitglied_id = ?', [mitglied_id]);
    const [[dojoSettings]] = mem ? await pool.query('SELECT kuendigung_schriftlich FROM dojo WHERE id = ?', [mem.dojo_id]) : [[null]];

    // Offener Antrag?
    const [[offenerAntrag]] = await pool.query(
      `SELECT id, gueltig_bis, erstellt_am FROM vertrag_anpassungen
       WHERE mitglied_id = ? AND typ = 'kuendigung' AND status = 'beantragt' ORDER BY erstellt_am DESC LIMIT 1`,
      [mitglied_id]
    );

    res.json({
      success: true,
      kuendigungsfrist_monate: frist,
      fruehestens_datum: fruehestensStr,
      bereits_gekuendigt: !!vertrag.kuendigungsdatum || vertrag.status === 'gekuendigt',
      kuendigungsdatum: vertrag.kuendigungsdatum || null,
      offener_antrag: offenerAntrag || null,
      // #kuendigung: Vertragsdaten + Online-Kündigung-Flag (für Mitglieder-Ansicht analog Admin)
      vertragsbeginn: vertrag.vertragsbeginn || null,
      vertragsende: vertrag.vertragsende || null,
      mindestlaufzeit_monate: vertrag.mindestlaufzeit_monate || null,
      online_kuendigung_aktiv: !dojoSettings?.kuendigung_schriftlich,
    });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /ruhepause-einstellungen  (Mitglied: max. Ruhepause-Dauer des Dojos)
router.get('/ruhepause-einstellungen', authenticateToken, async (req, res) => {
  try {
    const mitglied_id = await getMitgliedId(req.user);
    if (!mitglied_id) return res.status(403).json({ success: false });
    const [[row]] = await pool.query(
      'SELECT d.ruhepause_max_monate FROM mitglieder m JOIN dojo d ON m.dojo_id = d.id WHERE m.mitglied_id = ?',
      [mitglied_id]
    );
    res.json({ success: true, max_monate: row?.ruhepause_max_monate || 3 });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
