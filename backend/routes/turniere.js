const express = require('express');
const router = express.Router();
const db = require('../db');
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const pool = db.promise();

// GET /turniere
router.get('/', async (req, res) => {
  const secureDojoId = getSecureDojoId(req);
  try {
    const where = secureDojoId ? 'WHERE t.dojo_id = ?' : '';
    const params = secureDojoId ? [secureDojoId] : [];
    const [rows] = await pool.query(
      `SELECT t.*, COUNT(tt.id) AS teilnehmer_count
       FROM turniere t
       LEFT JOIN turnier_teilnahmen tt ON t.id = tt.turnier_id
       ${where}
       GROUP BY t.id
       ORDER BY t.datum DESC`, params
    );
    res.json({ success: true, turniere: rows });
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

// POST /turniere
router.post('/', async (req, res) => {
  const { name, datum, ort, beschreibung, typ } = req.body;
  if (!name || !datum) return res.status(400).json({ error: 'Name und Datum erforderlich' });
  const secureDojoId = getSecureDojoId(req);
  if (!secureDojoId) return res.status(400).json({ error: 'Dojo-ID erforderlich' });
  try {
    const [r] = await pool.query(
      'INSERT INTO turniere (dojo_id, name, datum, ort, beschreibung, typ) VALUES (?, ?, ?, ?, ?, ?)',
      [secureDojoId, name, datum, ort || null, beschreibung || null, typ || 'vereinsintern']
    );
    res.json({ success: true, id: r.insertId });
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler', detail: err.message }); }
});

// PUT /turniere/:id
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, datum, ort, beschreibung, typ, aktiv } = req.body;
  const secureDojoId = getSecureDojoId(req);
  try {
    const dojoClause = secureDojoId ? ' AND dojo_id = ?' : '';
    await pool.query(
      `UPDATE turniere SET name=?, datum=?, ort=?, beschreibung=?, typ=?, aktiv=? WHERE id=?${dojoClause}`,
      [name, datum, ort || null, beschreibung || null, typ || 'vereinsintern', aktiv !== false ? 1 : 0, id, ...(secureDojoId ? [secureDojoId] : [])]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

// DELETE /turniere/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const secureDojoId = getSecureDojoId(req);
  try {
    const dojoClause = secureDojoId ? ' AND dojo_id = ?' : '';
    await pool.query(`DELETE FROM turniere WHERE id=?${dojoClause}`, [id, ...(secureDojoId ? [secureDojoId] : [])]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

// GET /turniere/:id/teilnahmen -- MUSS VOR /teilnahmen/:id stehen
router.get('/:id/teilnahmen', async (req, res) => {
  const turnierId = parseInt(req.params.id);
  const secureDojoId = getSecureDojoId(req);
  try {
    const dojoClause = secureDojoId ? ' AND tt.dojo_id = ?' : '';
    const [rows] = await pool.query(
      `SELECT tt.*, m.vorname, m.nachname, m.email
       FROM turnier_teilnahmen tt
       JOIN mitglieder m ON tt.mitglied_id = m.mitglied_id
       WHERE tt.turnier_id = ?${dojoClause}
       ORDER BY COALESCE(tt.platzierung, 9999) ASC`,
      [turnierId, ...(secureDojoId ? [secureDojoId] : [])]
    );
    res.json({ success: true, teilnahmen: rows });
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

// POST /turniere/:id/teilnahmen
router.post('/:id/teilnahmen', async (req, res) => {
  const turnierId = parseInt(req.params.id);
  const { mitglied_id, disziplin, gewichtsklasse, notizen } = req.body;
  if (!mitglied_id) return res.status(400).json({ error: 'mitglied_id erforderlich' });
  const secureDojoId = getSecureDojoId(req);
  try {
    const dojoId = secureDojoId || (await pool.query('SELECT dojo_id FROM mitglieder WHERE mitglied_id = ?', [mitglied_id]))[0][0]?.dojo_id;
    await pool.query(
      'INSERT INTO turnier_teilnahmen (turnier_id, mitglied_id, dojo_id, disziplin, gewichtsklasse, notizen, medaille) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [turnierId, mitglied_id, dojoId, disziplin || null, gewichtsklasse || null, notizen || null, 'keine']
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler', detail: err.message }); }
});

// PUT /turniere/teilnahmen/:id -- Ergebnis eintragen (MUSS VOR /:id stehen!)
router.put('/teilnahmen/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { platzierung, medaille, punkte, notizen, hof_vorschlag } = req.body;
  const secureDojoId = getSecureDojoId(req);
  try {
    const dojoClause = secureDojoId ? ' AND dojo_id = ?' : '';
    await pool.query(
      `UPDATE turnier_teilnahmen SET platzierung=?, medaille=?, punkte=?, notizen=?, hof_vorschlag=? WHERE id=?${dojoClause}`,
      [platzierung || null, medaille || 'keine', punkte || 0, notizen || null, hof_vorschlag ? 1 : 0, id, ...(secureDojoId ? [secureDojoId] : [])]
    );
    if (hof_vorschlag) {
      const [teilRow] = await pool.query(
        `SELECT m.email, m.vorname, m.nachname, t.name AS turnier_name
         FROM turnier_teilnahmen tt
         JOIN mitglieder m ON tt.mitglied_id = m.mitglied_id
         JOIN turniere t ON tt.turnier_id = t.id
         WHERE tt.id = ?`, [id]
      );
      if (teilRow[0]) {
        await pool.query(
          "INSERT INTO notifications (type, recipient, subject, message) VALUES ('admin_alert', ?, ?, ?)",
          [teilRow[0].email, `HOF-Vorschlag: ${teilRow[0].vorname} ${teilRow[0].nachname}`,
           `${teilRow[0].vorname} ${teilRow[0].nachname} wird aufgrund herausragender Leistungen beim Turnier "${teilRow[0].turnier_name}" (Platz ${platzierung}) fuer die Hall of Fame vorgeschlagen.`]
        ).catch(() => {});
      }
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

// DELETE /turniere/teilnahmen/:id
router.delete('/teilnahmen/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const secureDojoId = getSecureDojoId(req);
  try {
    const dojoClause = secureDojoId ? ' AND dojo_id = ?' : '';
    await pool.query(`DELETE FROM turnier_teilnahmen WHERE id=?${dojoClause}`, [id, ...(secureDojoId ? [secureDojoId] : [])]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Datenbankfehler' }); }
});

module.exports = router;
