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
  rentner: 'Rentner', sonstiges: 'Sonstiges', ruhepause: 'Ruhepause'
};

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

// ── POST /  (Admin erstellt → sofort genehmigt) ──────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { mitglied_id, typ, alter_betrag, neuer_betrag, gueltig_von, gueltig_bis, grund } = req.body;
    const dojoId = getSecureDojoId(req) || req.body.dojo_id;

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
    if (!typ || !gueltig_von || !gueltig_bis) {
      return res.status(400).json({ success: false, error: 'Pflichtfelder fehlen' });
    }

    const [[lb]] = await pool.query(
      `SELECT betrag FROM beitraege WHERE mitglied_id = ? AND bezahlt = 0 ORDER BY zahlungsdatum ASC LIMIT 1`,
      [mitglied_id]
    );
    const [[mem]] = await pool.query(`SELECT m.dojo_id, d.ruhepause_max_monate FROM mitglieder m LEFT JOIN dojo d ON m.dojo_id = d.id WHERE m.mitglied_id = ?`, [mitglied_id]);
    if (!mem) return res.status(404).json({ success: false, error: 'Mitglied nicht gefunden.' });

    if (typ === 'ruhepause') {
      const maxMonate = mem.ruhepause_max_monate || 3;
      const von = new Date(gueltig_von);
      const bis = new Date(gueltig_bis);
      const diffMonate = (bis.getFullYear() - von.getFullYear()) * 12 + (bis.getMonth() - von.getMonth()) + (bis.getDate() >= von.getDate() ? 0 : -1) + 1;
      if (diffMonate > maxMonate) {
        return res.status(400).json({ success: false, error: `Ruhepause darf maximal ${maxMonate} Monat${maxMonate !== 1 ? 'e' : ''} dauern.` });
      }
    }

    const [ins] = await pool.query(
      `INSERT INTO vertrag_anpassungen
       (mitglied_id, dojo_id, typ, alter_betrag, neuer_betrag, gueltig_von, gueltig_bis, status, grund, erstellt_von)
       VALUES (?, ?, ?, ?, 0, ?, ?, 'beantragt', ?, 'mitglied')`,
      [mitglied_id, mem.dojo_id, typ, lb?.betrag || 0, gueltig_von, gueltig_bis, grund || null]
    );

    // Admin-Benachrichtigung für Ruhepause-Anträge
    if (typ === 'ruhepause' && mem.dojo_id) {
      try {
        const [[memInfo]] = await pool.query('SELECT vorname, nachname FROM mitglieder WHERE mitglied_id = ?', [mitglied_id]);
        const name = memInfo ? `${memInfo.vorname} ${memInfo.nachname}` : `Mitglied #${mitglied_id}`;
        const vonStr = new Date(gueltig_von).toLocaleDateString('de-DE');
        const bisStr = new Date(gueltig_bis).toLocaleDateString('de-DE');

        await pool.query(
          `INSERT INTO notifications (type, recipient, subject, message, status, requires_confirmation, metadata, created_at)
           VALUES ('admin_alert', 'admin', 'Ruhepause beantragt', ?, 'unread', 1, ?, NOW())`,
          [
            `${name} hat eine Ruhepause beantragt (${vonStr} – ${bisStr})`,
            JSON.stringify({
              type: 'ruhepause_antrag',
              antrag_id: ins.insertId,
              mitglied_id,
              dojo_id: mem.dojo_id,
              gueltig_von,
              gueltig_bis,
              vorname: memInfo?.vorname,
              nachname: memInfo?.nachname,
              grund: grund || null
            })
          ]
        );

        await sendAdminPushNotifications(
          mem.dojo_id,
          '⏸️ Ruhepause beantragt',
          `${name} hat eine Ruhepause für ${vonStr} – ${bisStr} beantragt.`,
          { url: '/dashboard/mitglieder' }
        );
      } catch (notifErr) {
        console.error('[vertrag-anpassungen] Admin-Notif-Fehler:', notifErr.message);
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
    } else {
      affected = await applyBeitraege(a.mitglied_id, a.gueltig_von, a.gueltig_bis, betrag);
      await pool.query(`UPDATE mitglieder SET schueler_student = 1 WHERE mitglied_id = ?`, [a.mitglied_id]);
    }

    // Ausstehende Admin-Notification für diesen Antrag als gelesen markieren
    await pool.query(
      `UPDATE notifications SET status='read' WHERE type='admin_alert' AND status='unread' AND metadata LIKE ?`,
      [`%"antrag_id":${id}%`]
    );

    const [[m]] = await pool.query(`SELECT email FROM mitglieder WHERE mitglied_id = ?`, [a.mitglied_id]);
    if (m?.email) {
      const lbl = TYP_LABELS[a.typ] || a.typ;
      await sendMemberNotification(
        m.email,
        `✅ Tarifantrag genehmigt: ${lbl}-Tarif`,
        `Dein Antrag auf ${lbl}-Tarif wurde genehmigt! Neuer Beitrag: ${parseFloat(betrag).toFixed(2).replace('.', ',')} €/Monat. Gültig: ${new Date(a.gueltig_von).toLocaleDateString('de-DE')} – ${new Date(a.gueltig_bis).toLocaleDateString('de-DE')}.`
      );
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

    const [[m]] = await pool.query(`SELECT email FROM mitglieder WHERE mitglied_id = ?`, [a.mitglied_id]);
    if (m?.email) {
      const lbl = TYP_LABELS[a.typ] || a.typ;
      await sendMemberNotification(
        m.email,
        `❌ Tarifantrag abgelehnt`,
        `Dein Antrag auf ${lbl}-Tarif wurde leider abgelehnt.${anmerkung_admin ? ' Begründung: ' + anmerkung_admin : ''}`
      );
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
