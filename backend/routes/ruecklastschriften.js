/**
 * Rücklastschrift-Verwaltung
 * ===========================
 * Vollständiger Workflow für zurückgegebene Lastschriften:
 * - Erfassen (manuell oder via Kontoauszug-Import)
 * - Mahnung 1 & 2 (erscheint im Memberboard + Email)
 * - Nach 2 Mahnungen: Rechnung stellen (Restlaufzeit) + Mahnbescheid-PDF
 * - Nochmal abbuchen (neuer Lastschriftversuch)
 */

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');

router.use(authenticateToken);

const pool = db.promise();

// ── SEPA-Rückgabecodes ────────────────────────────────────────────────────────
const SEPA_CODES = {
  AC01: 'IBAN ungültig', AC04: 'Konto geschlossen', AC06: 'Konto gesperrt',
  AM04: 'Deckung nicht ausreichend', MD01: 'Kein gültiges Mandat',
  MD06: 'Rückgabe durch Zahler (Widerspruch)', MS02: 'Unbekannter Grund',
  DUPL: 'Doppelte Zahlung', FRAD: 'Betrugsverdacht', TECH: 'Technischer Fehler'
};

// ── Helper ────────────────────────────────────────────────────────────────────
function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatCurrency(amount) {
  return parseFloat(amount || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

async function getDojoById(dojoId) {
  const [[dojo]] = await pool.query('SELECT * FROM dojo WHERE id = ? LIMIT 1', [dojoId]);
  return dojo || {};
}

async function getMailTransporter() {
  const [[settings]] = await pool.query('SELECT * FROM email_einstellungen LIMIT 1');
  if (!settings) throw new Error('E-Mail-Einstellungen fehlen');
  const transporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port,
    secure: settings.smtp_port === 465,
    auth: { user: settings.smtp_user, pass: settings.smtp_password }
  });
  return { transporter, from: settings.smtp_from || settings.smtp_user };
}

// ── GET / — Liste aller Rücklastschriften für das Dojo ──────────────────────
router.get('/', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { status = '', limit = 100 } = req.query;

  try {
    let where = 'oz.dojo_id = ? AND oz.typ = \'ruecklastschrift\'';
    const params = [dojoId];

    if (status) {
      where += ' AND oz.status = ?';
      params.push(status);
    }

    const [rows] = await pool.query(`
      SELECT
        oz.*,
        m.vorname, m.nachname, m.email,
        m.strasse, m.hausnummer, m.plz, m.ort,
        CASE
          WHEN oz.mahnbescheid_datum IS NOT NULL THEN 'mahnbescheid'
          WHEN oz.mahnung_2_datum IS NOT NULL THEN 'mahnung_2'
          WHEN oz.mahnung_1_datum IS NOT NULL THEN 'mahnung_1'
          ELSE 'offen'
        END AS mahnstufe
      FROM offene_zahlungen oz
      LEFT JOIN mitglieder m ON oz.mitglied_id = m.mitglied_id
      WHERE ${where}
      ORDER BY oz.erstellt_am DESC
      LIMIT ?
    `, [...params, parseInt(limit)]);

    // Stats
    const [[stats]] = await pool.query(`
      SELECT
        COUNT(*) as gesamt,
        SUM(CASE WHEN status = 'offen' OR status = 'in_bearbeitung' THEN 1 ELSE 0 END) as offen,
        SUM(CASE WHEN status = 'offen' OR status = 'in_bearbeitung' THEN betrag ELSE 0 END) as offener_betrag,
        MIN(CASE WHEN status = 'offen' THEN erstellt_am ELSE NULL END) as aelteste
      FROM offene_zahlungen
      WHERE dojo_id = ? AND typ = 'ruecklastschrift'
    `, [dojoId]);

    res.json({ success: true, ruecklastschriften: rows, stats });

  } catch (err) {
    logger.error('Rücklastschriften laden:', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// ── POST / — Neue Rücklastschrift manuell anlegen ────────────────────────────
router.post('/', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { mitglied_id, betrag, beschreibung, rueckgabe_code, datum } = req.body;

  if (!betrag || !beschreibung) {
    return res.status(400).json({ error: 'Betrag und Beschreibung sind Pflichtfelder' });
  }

  try {
    const rueckgabeBeschreibung = `SEPA Rücklastschrift: ${SEPA_CODES[rueckgabe_code] || rueckgabe_code || 'Unbekannter Grund'} — ${beschreibung}`;

    const [result] = await pool.query(`
      INSERT INTO offene_zahlungen (mitglied_id, dojo_id, betrag, typ, status, beschreibung, rueckgabe_code, referenz)
      VALUES (?, ?, ?, 'ruecklastschrift', 'offen', ?, ?, ?)
    `, [mitglied_id || null, dojoId, betrag, rueckgabeBeschreibung, rueckgabe_code || null, datum || null]);

    // Mitglied als zahlungsproblematisch markieren
    if (mitglied_id) {
      await pool.query(`
        UPDATE mitglieder
        SET zahlungsproblem = 1, zahlungsproblem_details = ?, zahlungsproblem_datum = NOW()
        WHERE mitglied_id = ?
      `, [rueckgabeBeschreibung, mitglied_id]).catch(() => {});
    }

    res.json({ success: true, id: result.insertId, message: 'Rücklastschrift erfasst' });

  } catch (err) {
    logger.error('Rücklastschrift anlegen:', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Anlegen' });
  }
});

// ── POST /:id/mahnung — Mahnung 1 oder 2 senden ──────────────────────────────
router.post('/:id/mahnung', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { id } = req.params;

  try {
    const [[oz]] = await pool.query(
      'SELECT oz.*, m.vorname, m.nachname, m.email, m.mitglied_id FROM offene_zahlungen oz LEFT JOIN mitglieder m ON oz.mitglied_id = m.mitglied_id WHERE oz.id = ? AND oz.dojo_id = ?',
      [id, dojoId]
    );

    if (!oz) return res.status(404).json({ error: 'Rücklastschrift nicht gefunden' });
    if (oz.mahnung_2_datum) return res.status(400).json({ error: 'Bereits 2 Mahnungen gesendet — Mahnbescheid verfügbar' });

    const stufe = oz.mahnung_1_datum ? 2 : 1;
    const column = stufe === 1 ? 'mahnung_1_datum' : 'mahnung_2_datum';
    const heute = new Date().toISOString().slice(0, 10);

    // Datum setzen
    await pool.query(`UPDATE offene_zahlungen SET ${column} = ?, status = 'in_bearbeitung' WHERE id = ?`, [heute, id]);

    // Mitglied-Nachricht im Memberboard
    if (oz.mitglied_id) {
      const titel = stufe === 1
        ? 'Zahlungserinnerung: Rücklastschrift'
        : 'Letzte Mahnung vor Mahnbescheid';
      const nachricht = stufe === 1
        ? `Eine Lastschrift über ${formatCurrency(oz.betrag)} wurde zurückgegeben. Bitte sorge für ausreichende Kontodeckung oder melde dich im Studio.`
        : `Dies ist die letzte Mahnung für den offenen Betrag von ${formatCurrency(oz.betrag)}. Bei ausbleibender Zahlung wird ein formelles Mahnschreiben eingeleitet.`;

      await pool.query(`
        INSERT INTO mitglied_nachrichten (mitglied_id, dojo_id, typ, titel, nachricht, referenz_id)
        VALUES (?, ?, 'mahnung', ?, ?, ?)
      `, [oz.mitglied_id, dojoId, titel, nachricht, id]);
    }

    // Email senden (optional, Fehler ignorieren)
    if (oz.email) {
      try {
        const dojo = await getDojoById(dojoId);
        const { transporter, from } = await getMailTransporter();

        const betreff = stufe === 1
          ? `Zahlungserinnerung — ${dojo.dojoname || 'Dojo'}`
          : `2. Mahnung — ${dojo.dojoname || 'Dojo'}`;

        const text = stufe === 1
          ? `Sehr geehrte/r ${oz.vorname} ${oz.nachname},\n\nleider wurde eine Lastschrift über ${formatCurrency(oz.betrag)} zurückgegeben.\n\nBitte sorgen Sie für ausreichende Kontodeckung oder kontaktieren Sie uns.\n\nMit freundlichen Grüßen,\n${dojo.dojoname || 'Ihr Dojo'}`
          : `Sehr geehrte/r ${oz.vorname} ${oz.nachname},\n\nTrotz unserer ersten Mahnung ist der Betrag von ${formatCurrency(oz.betrag)} noch offen.\n\nBitte begleichen Sie diesen Betrag sofort, um weitere Schritte zu vermeiden.\n\nMit freundlichen Grüßen,\n${dojo.dojoname || 'Ihr Dojo'}`;

        await transporter.sendMail({ from, to: oz.email, subject: betreff, text });
      } catch (mailErr) {
        logger.warn('Rücklastschrift-Email Fehler (ignoriert):', { error: mailErr.message });
      }
    }

    res.json({
      success: true,
      stufe,
      message: `Mahnung ${stufe} wurde gesendet${oz.email ? ' (Email verschickt)' : ''}`,
      mahnbescheid_verfuegbar: stufe === 2
    });

  } catch (err) {
    logger.error('Mahnung senden:', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Senden der Mahnung' });
  }
});

// ── POST /:id/nochmal-abbuchen — Neuen Beitrag für erneuten Einzug ──────────
router.post('/:id/nochmal-abbuchen', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { id } = req.params;

  try {
    const [[oz]] = await pool.query(
      'SELECT * FROM offene_zahlungen WHERE id = ? AND dojo_id = ?',
      [id, dojoId]
    );
    if (!oz) return res.status(404).json({ error: 'Nicht gefunden' });
    if (!oz.mitglied_id) return res.status(400).json({ error: 'Kein Mitglied zugeordnet — Abbuchung nicht möglich' });

    // Neuen Beitrag anlegen
    const faellig = new Date().toISOString().slice(0, 10);
    const [result] = await pool.query(`
      INSERT INTO beitraege (mitglied_id, betrag, beschreibung, zahlungsdatum, bezahlt, erstellt_am)
      VALUES (?, ?, ?, ?, 0, NOW())
    `, [oz.mitglied_id, oz.betrag, `Nachberechnung Rücklastschrift — ${oz.beschreibung}`, faellig]);

    // Massnahme vermerken
    await pool.query('UPDATE offene_zahlungen SET massnahme = \'nochmal_abbuchen\' WHERE id = ?', [id]);

    res.json({
      success: true,
      beitrag_id: result.insertId,
      message: 'Neuer Beitrag angelegt — erscheint im nächsten Lastschriftlauf'
    });

  } catch (err) {
    logger.error('Nochmal abbuchen:', { error: err.message });
    res.status(500).json({ error: 'Fehler' });
  }
});

// ── POST /:id/rechnung-stellen — Restlaufzeit in Rechnung stellen ─────────────
// Nur nach 2 Mahnungen verfügbar
router.post('/:id/rechnung-stellen', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { id } = req.params;

  try {
    const [[oz]] = await pool.query(
      'SELECT * FROM offene_zahlungen WHERE id = ? AND dojo_id = ?',
      [id, dojoId]
    );
    if (!oz) return res.status(404).json({ error: 'Nicht gefunden' });
    if (!oz.mahnung_2_datum) return res.status(403).json({ error: 'Erst nach 2 Mahnungen möglich' });
    if (!oz.mitglied_id) return res.status(400).json({ error: 'Kein Mitglied zugeordnet' });

    // Aktiven Vertrag des Mitglieds lesen
    const [[vertrag]] = await pool.query(`
      SELECT v.*, t.preis as monatsbeitrag, t.laufzeit_monate
      FROM vertraege v
      LEFT JOIN tarife t ON v.tarif_id = t.tarif_id
      WHERE v.mitglied_id = ? AND v.status = 'aktiv'
      LIMIT 1
    `, [oz.mitglied_id]);

    if (!vertrag) {
      return res.status(404).json({ error: 'Kein aktiver Vertrag gefunden — Rechnung manuell erstellen' });
    }

    // Verbleibende Monate berechnen
    const heute = new Date();
    const vertragsende = vertrag.enddatum ? new Date(vertrag.enddatum) : null;
    let restmonate = 1;
    let restbetrag = parseFloat(oz.betrag);
    let beschreibung = `Rücklastschrift-Forderung — ${oz.beschreibung}`;

    if (vertragsende && vertragsende > heute) {
      restmonate = Math.ceil((vertragsende - heute) / (1000 * 60 * 60 * 24 * 30));
      const monatsbeitrag = parseFloat(vertrag.monatsbeitrag || 0);
      restbetrag = monatsbeitrag > 0 ? monatsbeitrag * restmonate : parseFloat(oz.betrag);
      beschreibung = `Forderung Restlaufzeit (${restmonate} Monate): ${vertrag.bezeichnung || 'Mitgliedschaft'}`;
    }

    const faellig = new Date();
    faellig.setDate(faellig.getDate() + 14);
    const faelligStr = faellig.toISOString().slice(0, 10);

    // Rechnung anlegen
    const rechnungsnummer = `RL-${dojoId}-${Date.now()}`;
    const [result] = await pool.query(`
      INSERT INTO rechnungen (
        rechnungsnummer, mitglied_id, datum, faelligkeitsdatum,
        betrag, netto_betrag, brutto_betrag,
        status, zahlungsart, art, beschreibung
      ) VALUES (?, ?, CURDATE(), ?, ?, ?, ?, 'offen', 'ueberweisung', 'sonstiges', ?)
    `, [
      rechnungsnummer, oz.mitglied_id, faelligStr,
      restbetrag, restbetrag, restbetrag,
      beschreibung
    ]);

    await pool.query('UPDATE offene_zahlungen SET massnahme = \'rechnung_gestellt\', original_rechnung_id = ? WHERE id = ?', [result.insertId, id]);

    res.json({
      success: true,
      rechnung_id: result.insertId,
      rechnungsnummer,
      betrag: restbetrag,
      restmonate,
      faellig: faelligStr,
      message: 'Rechnung erfolgreich erstellt'
    });

  } catch (err) {
    logger.error('Rechnung stellen:', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Erstellen der Rechnung' });
  }
});

// ── GET /:id/mahnbescheid-pdf — Inkassoschreiben als PDF ─────────────────────
// Nur nach 2 Mahnungen verfügbar
router.get('/:id/mahnbescheid-pdf', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { id } = req.params;

  try {
    const [[oz]] = await pool.query(`
      SELECT oz.*, m.vorname, m.nachname, m.anrede, m.email,
             m.strasse, m.hausnummer, m.plz, m.ort
      FROM offene_zahlungen oz
      LEFT JOIN mitglieder m ON oz.mitglied_id = m.mitglied_id
      WHERE oz.id = ? AND oz.dojo_id = ?
    `, [id, dojoId]);

    if (!oz) return res.status(404).json({ error: 'Nicht gefunden' });
    if (!oz.mahnung_2_datum) return res.status(403).json({ error: 'Mahnbescheid erst nach 2 Mahnungen verfügbar' });

    const dojo = await getDojoById(dojoId);
    const heute = new Date();
    const frist = new Date(heute);
    frist.setDate(frist.getDate() + 14);

    // PDF generieren
    const pdfBuffer = await new Promise((resolve, reject) => {
      const chunks = [];
      const doc = new PDFDocument({ size: 'A4', margin: 60, info: { Title: 'Inkassoschreiben' } });

      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const dojoname = dojo.dojoname || 'Kampfsportschule';
      const pageW = doc.page.width;
      const margin = 60;

      // ── Absenderzeile ────────────────────────────────────────────────────
      doc.fontSize(8).fillColor('#666666')
        .text(`${dojoname} · ${dojo.strasse || ''} ${dojo.hausnummer || ''} · ${dojo.plz || ''} ${dojo.ort || ''}`, margin, 60);

      // ── Empfänger ────────────────────────────────────────────────────────
      doc.moveDown(0.5).fontSize(11).fillColor('#1a1a1a');
      if (oz.anrede) doc.text(oz.anrede);
      doc.text(`${oz.vorname || ''} ${oz.nachname || ''}`);
      if (oz.strasse) doc.text(`${oz.strasse} ${oz.hausnummer || ''}`);
      if (oz.plz) doc.text(`${oz.plz} ${oz.ort || ''}`);

      // ── Datum & Ort ──────────────────────────────────────────────────────
      doc.moveDown(1.5)
        .fontSize(10).fillColor('#444444')
        .text(`${dojo.ort || ''}, den ${formatDate(heute)}`, { align: 'right' });

      // ── Betreff ──────────────────────────────────────────────────────────
      doc.moveDown(1).fontSize(13).fillColor('#8B0000').font('Helvetica-Bold')
        .text('Letztes Zahlungsaufforderungsschreiben', margin);

      doc.moveDown(0.3).fontSize(11).fillColor('#1a1a1a').font('Helvetica')
        .text(`Rücklastschrift — Offene Forderung ${formatCurrency(oz.betrag)}`);

      // ── Horizontale Linie ─────────────────────────────────────────────────
      doc.moveDown(0.5)
        .moveTo(margin, doc.y).lineTo(pageW - margin, doc.y)
        .strokeColor('#cccccc').stroke();
      doc.moveDown(0.5);

      // ── Anrede & Text ─────────────────────────────────────────────────────
      const anrede = oz.anrede || 'Sehr geehrte/r';
      doc.fontSize(11).fillColor('#1a1a1a')
        .text(`${anrede} ${oz.nachname || 'Mitglied'},`, margin)
        .moveDown(0.5);

      doc.text(
        `trotz unserer bisherigen Zahlungserinnerungen vom ${formatDate(oz.mahnung_1_datum)} und ${formatDate(oz.mahnung_2_datum)} ist der nachstehende Betrag auf unserem Konto noch nicht eingegangen.`,
        { lineGap: 4 }
      );

      doc.moveDown(0.5).text(
        `Ursache ist eine zurückgegebene Lastschrift. Der Rückgabegrund lautete: ${SEPA_CODES[oz.rueckgabe_code] || oz.rueckgabe_code || 'unbekannt'}.`,
        { lineGap: 4 }
      );

      // ── Forderungs-Box ───────────────────────────────────────────────────
      doc.moveDown(0.8);
      const boxY = doc.y;
      const boxH = 80;
      doc.rect(margin, boxY, pageW - margin * 2, boxH).fillColor('#fff9f0').fill();
      doc.rect(margin, boxY, pageW - margin * 2, boxH).strokeColor('#f59e0b').stroke();

      doc.fontSize(10).fillColor('#444444')
        .text('Offener Betrag:', margin + 14, boxY + 14);
      doc.fontSize(18).fillColor('#8B0000').font('Helvetica-Bold')
        .text(formatCurrency(oz.betrag), margin + 14, boxY + 28);

      if (oz.mitgliedsnummer) {
        doc.fontSize(9).fillColor('#666666').font('Helvetica')
          .text(`Mitglied-Nr.: ${oz.mitgliedsnummer}`, margin + 14, boxY + 54);
      }

      doc.fontSize(10).fillColor('#444444')
        .text(`Zahlungsfrist: ${formatDate(frist)}`, pageW - margin - 160, boxY + 28);

      doc.moveDown(boxH / 12 + 1);

      // ── Zahlungsdaten ─────────────────────────────────────────────────────
      doc.fontSize(11).fillColor('#1a1a1a').font('Helvetica')
        .text('Bitte überweisen Sie den Betrag auf folgendes Konto:', margin, doc.y + 10)
        .moveDown(0.4);

      if (dojo.iban) {
        doc.text(`IBAN: ${dojo.iban}`, margin + 10);
      }
      if (dojo.bic) doc.text(`BIC: ${dojo.bic}`, margin + 10);
      doc.text(`Verwendungszweck: Rücklastschrift ${oz.mitgliedsnummer ? oz.mitgliedsnummer : oz.id}`, margin + 10);

      // ── Hinweis auf weitere Schritte ─────────────────────────────────────
      doc.moveDown(1).fontSize(11).fillColor('#1a1a1a')
        .text(
          `Sollte bis zum ${formatDate(frist)} keine Zahlung eingehen, behalten wir uns vor, die Forderung an ein Inkassounternehmen zu übergeben und rechtliche Schritte einzuleiten. Dies würde zu weiteren Kosten zu Ihren Lasten führen.`,
          { lineGap: 4 }
        );

      doc.moveDown(0.8)
        .text('Bitte kommen Sie dieser letzten Aufforderung nach, um weitere Konsequenzen zu vermeiden.', { lineGap: 4 });

      doc.moveDown(0.8)
        .text('Wir bitten Sie, sich bei Fragen oder Unklarheiten umgehend mit uns in Verbindung zu setzen.');

      // ── Grußformel ───────────────────────────────────────────────────────
      doc.moveDown(1.5).text(`Mit freundlichen Grüßen,\n${dojoname}`);

      if (dojo.email) doc.moveDown(0.5).fontSize(9).fillColor('#666666').text(dojo.email);
      if (dojo.telefon) doc.text(dojo.telefon);

      // Mahnbescheid-Datum setzen
      pool.query('UPDATE offene_zahlungen SET mahnbescheid_datum = CURDATE(), massnahme = \'mahnbescheid\' WHERE id = ?', [id]).catch(() => {});

      doc.end();
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Inkassoschreiben_${oz.nachname || id}.pdf"`);
    res.send(pdfBuffer);

  } catch (err) {
    logger.error('Mahnbescheid PDF:', { error: err.message });
    res.status(500).json({ error: 'Fehler bei der PDF-Generierung' });
  }
});

// ── PUT /:id/status — Status setzen ─────────────────────────────────────────
router.put('/:id/status', async (req, res) => {
  const dojoId = getSecureDojoId(req);
  if (!dojoId) return res.status(400).json({ error: 'Keine Berechtigung' });

  const { id } = req.params;
  const { status, notizen } = req.body;

  const erlaubteStatus = ['offen', 'in_bearbeitung', 'erledigt', 'storniert'];
  if (!erlaubteStatus.includes(status)) {
    return res.status(400).json({ error: 'Ungültiger Status' });
  }

  try {
    await pool.query(`
      UPDATE offene_zahlungen SET status = ?, notizen = ?, bearbeitet_am = NOW()
      WHERE id = ? AND dojo_id = ?
    `, [status, notizen || null, id, dojoId]);

    // Zahlungsproblem-Flag zurücksetzen wenn erledigt
    if (status === 'erledigt' || status === 'storniert') {
      const [[oz]] = await pool.query('SELECT mitglied_id FROM offene_zahlungen WHERE id = ?', [id]);
      if (oz?.mitglied_id) {
        // Prüfen ob noch andere offene Probleme
        const [[andere]] = await pool.query(
          'SELECT COUNT(*) as cnt FROM offene_zahlungen WHERE mitglied_id = ? AND status IN (\'offen\', \'in_bearbeitung\')',
          [oz.mitglied_id]
        );
        if (andere.cnt === 0) {
          await pool.query('UPDATE mitglieder SET zahlungsproblem = 0 WHERE mitglied_id = ?', [oz.mitglied_id]).catch(() => {});
        }
      }
    }

    res.json({ success: true, message: 'Status aktualisiert' });

  } catch (err) {
    logger.error('Status setzen:', { error: err.message });
    res.status(500).json({ error: 'Fehler' });
  }
});

module.exports = router;
