const express = require('express');
const router = express.Router();
const db = require('../db');
const pool = db.promise();

// GET /api/verband-kontakte — Liste mit Filter
router.get('/', async (req, res) => {
  try {
    const { status, bundesland, search, faellig } = req.query;
    let where = ['1=1'];
    const params = [];

    if (status) { where.push('k.status = ?'); params.push(status); }
    if (bundesland) { where.push('k.bundesland = ?'); params.push(bundesland); }
    if (search) {
      where.push('(k.name LIKE ? OR k.ort LIKE ? OR k.kontakt_person LIKE ? OR k.email LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (faellig === 'true') {
      where.push('k.naechste_aktion_datum IS NOT NULL AND k.naechste_aktion_datum <= CURDATE()');
    }

    const [rows] = await pool.query(
      `SELECT k.*,
        (SELECT COUNT(*) FROM verband_kontakt_aktivitaeten a WHERE a.kontakt_id = k.id) AS aktivitaeten_count,
        (SELECT MAX(a.datum) FROM verband_kontakt_aktivitaeten a WHERE a.kontakt_id = k.id) AS letzter_kontakt
       FROM verband_kontakte k
       WHERE ${where.join(' AND ')}
       ORDER BY FIELD(k.status,'neu','kontaktiert','interessiert','mitglied','kein_interesse','archiviert'),
                k.naechste_aktion_datum ASC, k.aktualisiert_am DESC`,
      params
    );
    res.json({ success: true, kontakte: rows });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler', detail: err.message });
  }
});

// GET /api/verband-kontakte/stats
router.get('/stats', async (req, res) => {
  try {
    const [[totals]] = await pool.query(`
      SELECT
        COUNT(*) AS gesamt,
        SUM(status = 'neu') AS neu,
        SUM(status = 'kontaktiert') AS kontaktiert,
        SUM(status = 'interessiert') AS interessiert,
        SUM(status = 'mitglied') AS mitglied,
        SUM(status = 'kein_interesse') AS kein_interesse,
        SUM(naechste_aktion_datum IS NOT NULL AND naechste_aktion_datum <= CURDATE()) AS faellig
      FROM verband_kontakte
      WHERE status NOT IN ('archiviert')
    `);
    res.json({ success: true, stats: totals });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler', detail: err.message });
  }
});

// GET /api/verband-kontakte/:id
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [[kontakt]] = await pool.query('SELECT * FROM verband_kontakte WHERE id = ?', [id]);
    if (!kontakt) return res.status(404).json({ error: 'Nicht gefunden' });

    const [aktivitaeten] = await pool.query(
      'SELECT * FROM verband_kontakt_aktivitaeten WHERE kontakt_id = ? ORDER BY datum DESC',
      [id]
    );

    res.json({ success: true, kontakt, aktivitaeten });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler', detail: err.message });
  }
});

// POST /api/verband-kontakte
router.post('/', async (req, res) => {
  try {
    const {
      name, adresse, plz, ort, bundesland, land,
      kontakt_person, email, telefon, website,
      kampfkunst, status, notizen,
      naechste_aktion_datum, naechste_aktion
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Name erforderlich' });

    const [r] = await pool.query(
      `INSERT INTO verband_kontakte
        (name, adresse, plz, ort, bundesland, land, kontakt_person, email, telefon, website,
         kampfkunst, status, notizen, naechste_aktion_datum, naechste_aktion)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        name, adresse || null, plz || null, ort || null, bundesland || null, land || 'Deutschland',
        kontakt_person || null, email || null, telefon || null, website || null,
        kampfkunst || null, status || 'neu', notizen || null,
        naechste_aktion_datum || null, naechste_aktion || null
      ]
    );
    res.json({ success: true, id: r.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler', detail: err.message });
  }
});

// PUT /api/verband-kontakte/:id
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      name, adresse, plz, ort, bundesland, land,
      kontakt_person, email, telefon, website,
      kampfkunst, status, notizen,
      naechste_aktion_datum, naechste_aktion
    } = req.body;

    await pool.query(
      `UPDATE verband_kontakte SET
        name=?, adresse=?, plz=?, ort=?, bundesland=?, land=?,
        kontakt_person=?, email=?, telefon=?, website=?,
        kampfkunst=?, status=?, notizen=?,
        naechste_aktion_datum=?, naechste_aktion=?
       WHERE id=?`,
      [
        name, adresse || null, plz || null, ort || null, bundesland || null, land || 'Deutschland',
        kontakt_person || null, email || null, telefon || null, website || null,
        kampfkunst || null, status || 'neu', notizen || null,
        naechste_aktion_datum || null, naechste_aktion || null,
        id
      ]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler', detail: err.message });
  }
});

// DELETE /api/verband-kontakte/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM verband_kontakte WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler', detail: err.message });
  }
});

// POST /api/verband-kontakte/:id/aktivitaeten
router.post('/:id/aktivitaeten', async (req, res) => {
  try {
    const kontakt_id = parseInt(req.params.id);
    const { typ, datum, betreff, notizen, ergebnis, naechste_aktion, naechste_aktion_datum } = req.body;
    const erstellt_von = req.user?.id || null;

    const [r] = await pool.query(
      `INSERT INTO verband_kontakt_aktivitaeten
        (kontakt_id, typ, datum, betreff, notizen, ergebnis, naechste_aktion, naechste_aktion_datum, erstellt_von)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        kontakt_id, typ || 'email', datum || new Date(),
        betreff || null, notizen || null, ergebnis || null,
        naechste_aktion || null, naechste_aktion_datum || null,
        erstellt_von
      ]
    );

    // Kontakt-Status und Folgetermin aktualisieren wenn angegeben
    if (naechste_aktion_datum || naechste_aktion) {
      await pool.query(
        `UPDATE verband_kontakte SET
          naechste_aktion_datum = COALESCE(?, naechste_aktion_datum),
          naechste_aktion = COALESCE(?, naechste_aktion)
         WHERE id = ?`,
        [naechste_aktion_datum || null, naechste_aktion || null, kontakt_id]
      );
    }

    res.json({ success: true, id: r.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler', detail: err.message });
  }
});

// DELETE /api/verband-kontakte/:id/aktivitaeten/:aktId
router.delete('/:id/aktivitaeten/:aktId', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM verband_kontakt_aktivitaeten WHERE id = ? AND kontakt_id = ?',
      [parseInt(req.params.aktId), parseInt(req.params.id)]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler', detail: err.message });
  }
});

module.exports = router;
