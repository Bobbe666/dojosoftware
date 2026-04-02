const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

const pool = db.promise();

const requireAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.role === 'eingeschraenkt')) {
    next();
  } else {
    res.status(403).json({ error: 'Keine Berechtigung' });
  }
};

// ==================== VERLETZUNGEN ====================

// GET /verletzungen/:mitgliedId — alle Verletzungen eines Mitglieds
router.get('/:mitgliedId', authenticateToken, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const mitgliedId = parseInt(req.params.mitgliedId);

    if (!mitgliedId) return res.status(400).json({ error: 'Ungültige Mitglied-ID' });

    // Tenant-Sicherheit: Mitglied muss zum Dojo gehören
    let query = `
      SELECT v.* FROM verletzungen v
      JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
      WHERE v.mitglied_id = ?
    `;
    const params = [mitgliedId];

    if (secureDojoId) {
      query += ' AND m.dojo_id = ?';
      params.push(secureDojoId);
    }

    query += ' ORDER BY v.datum DESC, v.erstellt_am DESC';

    const [rows] = await pool.query(query, params);
    res.json({ verletzungen: rows });
  } catch (err) {
    console.error('verletzungen GET error:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /verletzungen — neue Verletzung erfassen
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const { mitglied_id, datum, art, koerperregion, schwere, notizen, wieder_trainierbar_ab } = req.body;

    if (!mitglied_id || !art?.trim()) {
      return res.status(400).json({ error: 'mitglied_id und art sind Pflichtfelder' });
    }

    // Tenant-Check: Mitglied gehört zum Dojo
    if (secureDojoId) {
      const [check] = await pool.query(
        'SELECT mitglied_id FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?',
        [mitglied_id, secureDojoId]
      );
      if (check.length === 0) return res.status(403).json({ error: 'Mitglied nicht gefunden' });
    }

    // dojo_id aus mitglieder holen
    const [mitglied] = await pool.query(
      'SELECT dojo_id FROM mitglieder WHERE mitglied_id = ?',
      [mitglied_id]
    );
    const dojoId = mitglied[0]?.dojo_id;

    const [result] = await pool.query(
      `INSERT INTO verletzungen
        (mitglied_id, dojo_id, datum, art, koerperregion, schwere, notizen, wieder_trainierbar_ab)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mitglied_id,
        dojoId,
        datum || new Date().toISOString().split('T')[0],
        art.trim(),
        koerperregion || null,
        schwere || 'leicht',
        notizen || null,
        wieder_trainierbar_ab || null,
      ]
    );

    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('verletzungen POST error:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT /verletzungen/:id — Verletzung aktualisieren (z.B. als erholt markieren)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const id = parseInt(req.params.id);
    const { art, koerperregion, schwere, notizen, wieder_trainierbar_ab, vollstaendig_erholt } = req.body;

    if (!id) return res.status(400).json({ error: 'Ungültige ID' });

    // Tenant-Check
    let checkQuery = 'SELECT v.id FROM verletzungen v JOIN mitglieder m ON v.mitglied_id = m.mitglied_id WHERE v.id = ?';
    const checkParams = [id];
    if (secureDojoId) {
      checkQuery += ' AND m.dojo_id = ?';
      checkParams.push(secureDojoId);
    }
    const [check] = await pool.query(checkQuery, checkParams);
    if (check.length === 0) return res.status(404).json({ error: 'Verletzung nicht gefunden' });

    await pool.query(
      `UPDATE verletzungen SET
        art = ?, koerperregion = ?, schwere = ?, notizen = ?,
        wieder_trainierbar_ab = ?, vollstaendig_erholt = ?
       WHERE id = ?`,
      [
        art?.trim() || '',
        koerperregion || null,
        schwere || 'leicht',
        notizen || null,
        wieder_trainierbar_ab || null,
        vollstaendig_erholt ? 1 : 0,
        id,
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('verletzungen PUT error:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE /verletzungen/:id — Verletzung löschen
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const id = parseInt(req.params.id);

    if (!id) return res.status(400).json({ error: 'Ungültige ID' });

    // Tenant-Check
    let checkQuery = 'SELECT v.id FROM verletzungen v JOIN mitglieder m ON v.mitglied_id = m.mitglied_id WHERE v.id = ?';
    const checkParams = [id];
    if (secureDojoId) {
      checkQuery += ' AND m.dojo_id = ?';
      checkParams.push(secureDojoId);
    }
    const [check] = await pool.query(checkQuery, checkParams);
    if (check.length === 0) return res.status(404).json({ error: 'Verletzung nicht gefunden' });

    await pool.query('DELETE FROM verletzungen WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('verletzungen DELETE error:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;
