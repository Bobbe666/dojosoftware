// ============================================================================
// PILOT-PARTNER FEEDBACK — Fragebögen
// Öffentlich:  GET/POST /api/pilot-feedback/:token   (Umfrage-Seite, kein Auth)
// Admin:       /api/pilot-feedback/admin/...          (Super-Admin)
// Zeitplan + Versand: services/pilotFeedbackService.js (täglicher Cron)
// ============================================================================
const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');
const { FRAGEBOEGEN, umfrageTitel, planeUmfragen, sendUmfrageMail } = require('../services/pilotFeedbackService');

const pool = db.promise();

// Super-Admin Guard (wie demo-termine.js)
function onlySuperAdmin(req, res, next) {
  const role = req.user?.rolle;
  const isSuperAdmin = role === 'super_admin' || (!req.user?.dojo_id && role === 'admin');
  if (!isSuperAdmin) return res.status(403).json({ success: false, error: 'Nur Super-Admin' });
  next();
}

const esc = (s) => String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ─────────────────────────────────────────────────────────────────────────────
// ÖFFENTLICHE ROUTEN (Token-basiert, kein Auth)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/pilot-feedback/:token — Fragebogen-Definition für die öffentliche Seite
router.get('/:token([a-f0-9]{48})', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.typ, u.runde, u.beantwortet_am, b.schulname
      FROM pilot_feedback_umfragen u
      JOIN pilot_bewerbungen b ON b.id = u.bewerbung_id
      WHERE u.token = ? LIMIT 1
    `, [req.params.token]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Diese Umfrage existiert nicht.' });
    }
    const u = rows[0];
    if (u.beantwortet_am) {
      return res.json({ success: true, beantwortet: true, schulname: u.schulname });
    }

    const bogen = FRAGEBOEGEN[u.typ];
    res.json({
      success: true,
      beantwortet: false,
      schulname: u.schulname,
      titel: umfrageTitel(u.typ, u.runde),
      intro: bogen.intro,
      fragen: bogen.fragen,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Umfrage konnte nicht geladen werden.' });
  }
});

// POST /api/pilot-feedback/:token — Antworten speichern
router.post('/:token([a-f0-9]{48})', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.*, b.schulname, b.ansprechpartner
      FROM pilot_feedback_umfragen u
      JOIN pilot_bewerbungen b ON b.id = u.bewerbung_id
      WHERE u.token = ? LIMIT 1
    `, [req.params.token]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Diese Umfrage existiert nicht.' });
    }
    const u = rows[0];
    if (u.beantwortet_am) {
      return res.status(409).json({ success: false, error: 'Diese Umfrage wurde bereits beantwortet — vielen Dank!' });
    }

    // Antworten gegen den Fragenkatalog validieren
    const bogen = FRAGEBOEGEN[u.typ];
    const eingehend = req.body?.antworten || {};
    const antworten = {};
    for (const frage of bogen.fragen) {
      const wert = eingehend[frage.key];
      if (frage.typ === 'rating') {
        const n = parseInt(wert, 10);
        if (!Number.isInteger(n) || n < 1 || n > 5) {
          return res.status(400).json({ success: false, error: `Bitte beantworte: „${frage.text}"` });
        }
        antworten[frage.key] = n;
      } else if (frage.typ === 'choice') {
        const arr = Array.isArray(wert) ? wert.filter(v => frage.optionen.includes(v)) : [];
        antworten[frage.key] = arr;
      } else { // text
        antworten[frage.key] = wert ? String(wert).trim().slice(0, 5000) : '';
      }
    }

    await pool.query(
      'UPDATE pilot_feedback_umfragen SET beantwortet_am = NOW(), antworten = ? WHERE id = ?',
      [JSON.stringify(antworten), u.id]
    );

    // Zusammenfassung für Meldung + Mail
    const titel = umfrageTitel(u.typ, u.runde);
    const zeilen = bogen.fragen.map(f => {
      const w = antworten[f.key];
      if (f.typ === 'rating') return `${f.text} → ${'★'.repeat(w)}${'☆'.repeat(5 - w)} (${w}/5)`;
      if (f.typ === 'choice') return `${f.text} → ${w.length ? w.join(', ') : '–'}`;
      return `${f.text}\n${w || '–'}`;
    });
    const nachricht = `📝 ${titel}\nSchule: ${u.schulname}\n\n${zeilen.join('\n\n')}`;

    // Meldung im SuperAdminDashboard (Kommunikation → Meldungen)
    await pool.query(`
      INSERT INTO super_admin_notifications (typ, titel, nachricht, prioritaet)
      VALUES ('pilot_feedback', ?, ?, 'normal')
    `, [`📝 Pilot-Feedback: ${u.schulname} — ${titel}`, nachricht]);

    // Mail an Admin (asynchron)
    const html =
      `<h2>📝 Pilot-Feedback: ${esc(u.schulname)}</h2>` +
      `<p><strong>${esc(titel)}</strong></p>` +
      bogen.fragen.map(f => {
        const w = antworten[f.key];
        if (f.typ === 'rating') {
          return `<p style="margin:10px 0"><span style="color:#666">${esc(f.text)}</span><br><strong style="color:#d9aa43;font-size:16px">${'★'.repeat(w)}${'☆'.repeat(5 - w)}</strong> (${w}/5)</p>`;
        }
        if (f.typ === 'choice') {
          return `<p style="margin:10px 0"><span style="color:#666">${esc(f.text)}</span><br><strong>${w.length ? esc(w.join(', ')) : '–'}</strong></p>`;
        }
        return `<p style="margin:10px 0"><span style="color:#666">${esc(f.text)}</span></p>` +
          `<div style="padding:10px 14px;background:#f8fafc;border-left:3px solid #d9aa43;border-radius:4px;white-space:pre-wrap">${esc(w || '–')}</div>`;
      }).join('') +
      `<p style="margin-top:16px;color:#666">Auch im SuperAdmin-Dashboard unter Meldungen und im Pilot-Programm-Tab.</p>`;

    sendEmail({
      to: 'info@tda-intl.com',
      subject: `📝 Pilot-Feedback: ${u.schulname} — ${titel}`,
      text: nachricht,
      html
    }).catch(err => console.error('[Pilot-Feedback] Mail-Fehler:', err.message));

    res.json({ success: true, message: 'Vielen Dank für euer Feedback!' });
  } catch (err) {
    console.error('[Pilot-Feedback] Fehler:', err.message);
    res.status(500).json({ success: false, error: 'Antworten konnten nicht gespeichert werden.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN-ROUTEN (Super-Admin)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/pilot-feedback/admin/:bewerbungId — alle Umfragen eines Partners
router.get('/admin/:bewerbungId(\\d+)', authenticateToken, onlySuperAdmin, async (req, res) => {
  try {
    const [umfragen] = await pool.query(`
      SELECT id, typ, runde, faellig_am, gesendet_am, erinnert_am, beantwortet_am, antworten, token
      FROM pilot_feedback_umfragen
      WHERE bewerbung_id = ?
      ORDER BY faellig_am ASC
    `, [req.params.bewerbungId]);

    res.json({
      success: true,
      umfragen: umfragen.map(u => ({
        ...u,
        titel: umfrageTitel(u.typ, u.runde),
        antworten: u.antworten ? JSON.parse(u.antworten) : null,
        fragen: FRAGEBOEGEN[u.typ].fragen,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/pilot-feedback/admin/programm-start/:bewerbungId — Programm-Start setzen/ändern
router.put('/admin/programm-start/:bewerbungId(\\d+)', authenticateToken, onlySuperAdmin, async (req, res) => {
  try {
    const { programm_start } = req.body;
    if (!programm_start || !/^\d{4}-\d{2}-\d{2}$/.test(programm_start)) {
      return res.status(400).json({ success: false, error: 'Ungültiges Datum (YYYY-MM-DD)' });
    }
    const [result] = await pool.query(
      `UPDATE pilot_bewerbungen SET programm_start = ? WHERE id = ? AND status = 'gewonnen'`,
      [programm_start, req.params.bewerbungId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Partner nicht gefunden oder nicht im Status „gewonnen"' });
    }
    // Noch nicht versendete Umfragen auf den neuen Start umplanen
    await pool.query(
      'DELETE FROM pilot_feedback_umfragen WHERE bewerbung_id = ? AND gesendet_am IS NULL',
      [req.params.bewerbungId]
    );
    const [[partner]] = await pool.query(
      'SELECT id, schulname, ansprechpartner, email, programm_start FROM pilot_bewerbungen WHERE id = ?',
      [req.params.bewerbungId]
    );
    await planeUmfragen(partner);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/pilot-feedback/admin/:id/senden — Umfrage sofort (erneut) senden
router.post('/admin/:id(\\d+)/senden', authenticateToken, onlySuperAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.*, b.schulname, b.ansprechpartner, b.email
      FROM pilot_feedback_umfragen u
      JOIN pilot_bewerbungen b ON b.id = u.bewerbung_id
      WHERE u.id = ? LIMIT 1
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Umfrage nicht gefunden' });
    if (rows[0].beantwortet_am) return res.status(409).json({ success: false, error: 'Bereits beantwortet' });

    await sendUmfrageMail(rows[0], rows[0], !!rows[0].gesendet_am);
    await pool.query('UPDATE pilot_feedback_umfragen SET gesendet_am = COALESCE(gesendet_am, NOW()) WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
