/**
 * Prüfungsprotokoll Routes
 * POST /:id/protokoll/ins-dashboard  – Protokoll aus DB-Daten generieren + im Dashboard ablegen
 * GET  /mitglied/:mid/protokolle     – Alle Protokolle eines Mitglieds (für MemberDashboard)
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const pool = db.promise();
const logger = require('../../utils/logger');
const { getSecureDojoId } = require('../../utils/dojo-filter-helper');

// ── POST /:id/protokoll/ins-dashboard ─────────────────────────────────────────
// Holt Prüfungsdaten aus DB, generiert HTML-Protokoll, speichert es für das Mitglied
router.post('/:id/protokoll/ins-dashboard', async (req, res) => {
  const pruefung_id = parseInt(req.params.id);
  if (!pruefung_id) return res.status(400).json({ error: 'Ungültige Prüfungs-ID' });

  const secureDojoId = getSecureDojoId(req);

  try {
    // Prüfungsdaten + Mitglied + Stile + Graduierungen
    const [[pruef]] = await pool.query(
      `SELECT p.*,
              m.vorname, m.nachname, m.email, m.geburtsdatum,
              s.name AS stil_name,
              gv.name AS grad_vorher, gv.farbe_hex AS farbe_vorher,
              gn.name AS grad_nachher, gn.farbe_hex AS farbe_nachher,
              d.dojoname
       FROM pruefungen p
       LEFT JOIN mitglieder m ON p.mitglied_id = m.mitglied_id
       LEFT JOIN stile s ON p.stil_id = s.stil_id
       LEFT JOIN graduierungen gv ON p.graduierung_vorher_id = gv.graduierung_id
       LEFT JOIN graduierungen gn ON p.graduierung_nachher_id = gn.graduierung_id
       LEFT JOIN dojo d ON p.dojo_id = d.id
       WHERE p.pruefung_id = ?
         ${secureDojoId ? 'AND p.dojo_id = ?' : ''}`,
      secureDojoId ? [pruefung_id, secureDojoId] : [pruefung_id]
    );

    if (!pruef) return res.status(404).json({ error: 'Prüfung nicht gefunden' });
    if (!pruef.mitglied_id) return res.status(400).json({ error: 'Kein Mitglied zur Prüfung (externer Teilnehmer)' });

    const dojoId = secureDojoId || pruef.dojo_id;

    // Einzelbewertungen laden
    const [bewertungen] = await pool.query(
      `SELECT pb.punktzahl, pb.max_punktzahl, pb.bestanden, pb.kommentar,
              pi2.titel, pi2.kategorie, pi2.ohne_punkte
       FROM pruefung_bewertungen pb
       LEFT JOIN pruefungsinhalte pi2 ON pb.inhalt_id = pi2.inhalt_id
       WHERE pb.pruefung_id = ?
       ORDER BY pi2.kategorie, pi2.reihenfolge`,
      [pruefung_id]
    );

    // ── HTML generieren ────────────────────────────────────────────────────────
    const datumLang = pruef.pruefungsdatum
      ? new Date(pruef.pruefungsdatum).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
      : '—';
    const datumKurz = pruef.pruefungsdatum
      ? new Date(pruef.pruefungsdatum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '—';

    const ergebnisHtml = pruef.bestanden
      ? '<span style="color:#16a34a;font-weight:700;font-size:17pt;">✓ BESTANDEN</span>'
      : '<span style="color:#dc2626;font-weight:700;font-size:17pt;">✗ NICHT BESTANDEN</span>';

    const punkteHtml = (pruef.punktzahl != null && pruef.max_punktzahl != null)
      ? `<div style="font-size:10pt;color:#555;margin-top:4px;">${pruef.punktzahl} / ${pruef.max_punktzahl} Punkte</div>`
      : '';

    const kommentarHtml = pruef.prueferkommentar
      ? `<div style="margin-bottom:16px;"><div style="font-size:7.5pt;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">Prüferkommentar</div><p style="margin:0;padding:10px;background:#f8f8f8;border-left:3px solid #c8a84b;font-style:italic;color:#333;font-size:9.5pt;">${pruef.prueferkommentar}</p></div>`
      : '';

    // Bewertungen nach Kategorie gruppieren
    let bewertungenHtml = '';
    if (bewertungen.length > 0) {
      const kategorieNamen = {
        kondition: 'Kondition / Warm Up', grundtechniken: 'Grundtechniken',
        fusstechniken: 'Fußtechniken', kata: 'Kata / Kombinationen',
        kumite: 'Kumite / Sparring', theorie: 'Theorie'
      };
      const grouped = {};
      bewertungen.forEach(b => {
        const k = b.kategorie || 'sonstige';
        if (!grouped[k]) grouped[k] = [];
        grouped[k].push(b);
      });
      const katBlöcke = Object.entries(grouped).map(([kat, items]) => {
        const rows = items.map(b => {
          const ok = b.bestanden === 1 ? '<span style="color:#16a34a;font-weight:700;">✓</span>'
            : b.bestanden === 0 ? '<span style="color:#dc2626;">✗</span>'
            : '<span style="color:#bbb;">—</span>';
          const pkt = !b.ohne_punkte && b.punktzahl != null
            ? `${b.punktzahl} / ${b.max_punktzahl || 10}` : '';
          return `<tr style="border-bottom:1px solid #f0f0f0;">
            <td style="padding:3px 6px;font-size:8pt;color:#333;">${b.titel || ''}</td>
            <td style="padding:3px 6px;text-align:center;font-size:9pt;width:36px;">${ok}</td>
            <td style="padding:3px 6px;text-align:center;font-size:8pt;color:#555;width:60px;">${pkt}</td>
          </tr>`;
        }).join('');
        return `<div style="margin-bottom:8px;">
          <div style="font-size:7.5pt;font-weight:700;color:#777;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e0e0e0;padding-bottom:2px;margin-bottom:3px;">${kategorieNamen[kat] || kat}</div>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="background:#f8f8f8;">
              <th style="padding:2px 5px;text-align:left;font-size:7pt;color:#999;font-weight:600;">Technik / Inhalt</th>
              <th style="padding:2px 5px;text-align:center;font-size:7pt;color:#999;font-weight:600;width:36px;">OK</th>
              <th style="padding:2px 5px;text-align:center;font-size:7pt;color:#999;font-weight:600;width:60px;">Punkte</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
      });
      bewertungenHtml = `<div style="margin-bottom:16px;border-top:1px solid #e0e0e0;padding-top:12px;">
        <div style="font-size:7.5pt;color:#888;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Prüfungsinhalte</div>
        <div style="column-count:2;column-gap:14px;">${katBlöcke.join('')}</div>
      </div>`;
    }

    const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:190mm;margin:0 auto;color:#1a1a1a;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #c8a84b;padding-bottom:8px;margin-bottom:10px;">
        <div>
          <img src="/tda-systems-logo.png" alt="TDA Logo" style="height:38px;object-fit:contain;display:block;" />
          <div style="font-size:7pt;color:#aaa;margin-top:1px;">Tiger &amp; Dragon Association – International</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12pt;font-weight:800;color:#1a1a1a;">Prüfungsprotokoll — ${pruef.stil_name || ''}</div>
          <div style="font-size:9pt;color:#555;margin-top:1px;">${pruef.dojoname || 'Kampfkunstschule Schreiner'} &nbsp;·&nbsp; ${datumLang}</div>
          ${pruef.pruefungsort ? `<div style="font-size:8.5pt;color:#888;">${pruef.pruefungsort}</div>` : ''}
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:12px;align-items:stretch;">
        <div style="flex:5;background:#f9f9f9;border-radius:6px;padding:10px 14px;">
          <div style="font-size:7pt;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Prüfling</div>
          <div style="font-size:16pt;font-weight:700;color:#1a1a1a;line-height:1.2;">${pruef.vorname} ${pruef.nachname}</div>
          ${pruef.geburtsdatum ? `<div style="font-size:9pt;color:#666;margin-top:2px;">Geb.: ${new Date(pruef.geburtsdatum).toLocaleDateString('de-DE')}</div>` : ''}
        </div>
        <div style="flex:4;display:flex;flex-direction:column;gap:5px;">
          <div style="flex:1;border:1px solid #e0e0e0;border-radius:6px;padding:7px 11px;">
            <div style="font-size:7pt;color:#888;margin-bottom:3px;">Aktueller Gurt</div>
            <div style="display:flex;align-items:center;gap:6px;">
              <div style="width:12px;height:12px;border-radius:50%;background:${pruef.farbe_vorher || '#6b7280'};border:1px solid rgba(0,0,0,0.15);flex-shrink:0;"></div>
              <span style="font-size:10pt;font-weight:600;">${pruef.grad_vorher || 'Kein Gurt'}</span>
            </div>
          </div>
          <div style="flex:1;border:2px solid ${pruef.farbe_nachher || '#EAB308'};border-radius:6px;padding:7px 11px;">
            <div style="font-size:7pt;color:#888;margin-bottom:3px;">Angestrebter Gurt</div>
            <div style="display:flex;align-items:center;gap:6px;">
              <div style="width:12px;height:12px;border-radius:50%;background:${pruef.farbe_nachher || '#EAB308'};border:1px solid rgba(0,0,0,0.15);flex-shrink:0;"></div>
              <span style="font-size:10pt;font-weight:700;color:${pruef.farbe_nachher || '#EAB308'};">${pruef.grad_nachher || '—'}</span>
            </div>
          </div>
        </div>
        <div style="flex:4;border:1px solid #e0e0e0;border-radius:6px;padding:10px 12px;text-align:center;display:flex;flex-direction:column;justify-content:center;align-items:center;">
          <div style="font-size:7pt;color:#888;margin-bottom:5px;">Prüfungsergebnis</div>
          ${ergebnisHtml}
          ${punkteHtml}
        </div>
      </div>

      ${kommentarHtml}
      ${bewertungenHtml}

      <div style="display:flex;gap:32px;margin-top:20px;">
        <div style="flex:1;border-top:1px solid #555;padding-top:8px;">
          <div style="font-size:9pt;color:#888;">Prüfer</div>
          <div style="margin-top:28px;border-top:1px solid #ccc;padding-top:4px;font-size:8pt;color:#aaa;">Unterschrift / Datum</div>
        </div>
        <div style="flex:1;border-top:1px solid #555;padding-top:8px;">
          <div style="font-size:9pt;color:#888;">Prüfling</div>
          <div style="font-size:10pt;font-weight:600;color:#333;margin-top:3px;">${pruef.vorname} ${pruef.nachname}</div>
          <div style="margin-top:28px;border-top:1px solid #ccc;padding-top:4px;font-size:8pt;color:#aaa;">Unterschrift / Datum</div>
        </div>
      </div>

      <div style="margin-top:16px;padding-top:8px;border-top:1px solid #e0e0e0;text-align:center;font-size:7pt;color:#bbb;">
        ${pruef.dojoname || 'Kampfkunstschule Schreiner'} · Mitglied der Tiger &amp; Dragon Association – International · Ausgestellt am ${datumKurz}
      </div>
    </div>`;

    // In pruefungs_protokolle speichern
    await pool.query(
      `INSERT INTO pruefungs_protokolle (pruefung_id, dojo_id, erstellt_von, html_inhalt, gesendet_am)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE html_inhalt = VALUES(html_inhalt), gesendet_am = NOW(), aktualisiert_am = NOW()`,
      [pruefung_id, dojoId, req.user?.id || null, html]
    );

    res.json({ success: true });
  } catch (err) {
    logger.error('Protokoll ins Dashboard Fehler', { error: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  }
});

// ── GET /mitglied/:mid/protokolle ─────────────────────────────────────────────
router.get('/mitglied/:mid/protokolle', async (req, res) => {
  const mitglied_id = parseInt(req.params.mid);
  const secureDojoId = getSecureDojoId(req);

  if (req.user?.mitglied_id && req.user.mitglied_id !== mitglied_id) {
    return res.status(403).json({ error: 'Keine Berechtigung' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT pp.protokoll_id, pp.pruefung_id, pp.html_inhalt, pp.gesendet_am, pp.erstellt_am,
              p.pruefungsdatum, p.bestanden, p.punktzahl, p.max_punktzahl,
              s.name AS stil_name,
              gn.name AS graduierung_nachher,
              gv.name AS graduierung_vorher
       FROM pruefungs_protokolle pp
       JOIN pruefungen p ON pp.pruefung_id = p.pruefung_id
       LEFT JOIN stile s ON p.stil_id = s.stil_id
       LEFT JOIN graduierungen gn ON p.graduierung_nachher_id = gn.graduierung_id
       LEFT JOIN graduierungen gv ON p.graduierung_vorher_id = gv.graduierung_id
       WHERE p.mitglied_id = ?
         AND pp.gesendet_am IS NOT NULL
         ${secureDojoId ? 'AND pp.dojo_id = ?' : ''}
       ORDER BY p.pruefungsdatum DESC`,
      secureDojoId ? [mitglied_id, secureDojoId] : [mitglied_id]
    );

    res.json({ success: true, protokolle: rows });
  } catch (err) {
    logger.error('Mitglied-Protokolle Fehler', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
