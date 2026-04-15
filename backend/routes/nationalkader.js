// ============================================================================
// NATIONALKADER ROUTES
// Verwaltet Kader-Definitionen und Nominierungen.
// Kandidaten-Daten kommen live von der TDA-Events API (events.tda-intl.org).
// ============================================================================

const express = require('express');
const router = express.Router();
const https = require('https');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const pool = db.promise();
const EVENTS_API_BASE = 'https://events.tda-intl.org/api';

// ============================================================================
// HILFSFUNKTION: HTTP-GET von TDA-Events API
// ============================================================================
function fetchEventsApi(path) {
  return new Promise((resolve, reject) => {
    const url = `${EVENTS_API_BASE}${path}`;
    https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON-Parse-Fehler für ${url}: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

// Alle Auth-Routes brauchen Token
router.use(authenticateToken);

// ============================================================================
// KADER CRUD
// ============================================================================

// GET /api/nationalkader — Alle Kader
router.get('/', async (req, res) => {
  try {
    const [kader] = await pool.query(`
      SELECT k.*,
        COUNT(n.id) AS nominierungen_gesamt,
        SUM(n.status = 'aktiv') AS nominierungen_aktiv
      FROM nationalkader k
      LEFT JOIN nationalkader_nominierungen n ON n.kader_id = k.id
      GROUP BY k.id
      ORDER BY k.saison DESC, k.bezeichnung ASC
    `);
    res.json({ success: true, kader });
  } catch (err) {
    logger.error('[Nationalkader] GET / Fehler:', err);
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Kader' });
  }
});

// POST /api/nationalkader — Neuen Kader anlegen
router.post('/', async (req, res) => {
  const { bezeichnung, saison, sportart, beschreibung } = req.body;
  if (!bezeichnung || !saison) {
    return res.status(400).json({ success: false, message: 'Bezeichnung und Saison sind Pflichtfelder' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO nationalkader (bezeichnung, saison, sportart, beschreibung) VALUES (?, ?, ?, ?)',
      [bezeichnung, saison, sportart || null, beschreibung || null]
    );
    const [[kader]] = await pool.query('SELECT * FROM nationalkader WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, kader });
  } catch (err) {
    logger.error('[Nationalkader] POST / Fehler:', err);
    res.status(500).json({ success: false, message: 'Fehler beim Erstellen des Kaders' });
  }
});

// PUT /api/nationalkader/:id — Kader aktualisieren
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { bezeichnung, saison, sportart, beschreibung, aktiv } = req.body;
  try {
    await pool.query(
      'UPDATE nationalkader SET bezeichnung=?, saison=?, sportart=?, beschreibung=?, aktiv=? WHERE id=?',
      [bezeichnung, saison, sportart || null, beschreibung || null, aktiv !== undefined ? aktiv : 1, id]
    );
    const [[kader]] = await pool.query('SELECT * FROM nationalkader WHERE id = ?', [id]);
    if (!kader) return res.status(404).json({ success: false, message: 'Kader nicht gefunden' });
    res.json({ success: true, kader });
  } catch (err) {
    logger.error('[Nationalkader] PUT /:id Fehler:', err);
    res.status(500).json({ success: false, message: 'Fehler beim Speichern' });
  }
});

// DELETE /api/nationalkader/:id — Kader löschen (inkl. Nominierungen via CASCADE)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [[kader]] = await pool.query('SELECT id FROM nationalkader WHERE id = ?', [id]);
    if (!kader) return res.status(404).json({ success: false, message: 'Kader nicht gefunden' });
    await pool.query('DELETE FROM nationalkader WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    logger.error('[Nationalkader] DELETE /:id Fehler:', err);
    res.status(500).json({ success: false, message: 'Fehler beim Löschen' });
  }
});

// ============================================================================
// NOMINIERUNGEN
// ============================================================================

// GET /api/nationalkader/:id/nominierungen — Alle Nominierungen eines Kaders
router.get('/:id/nominierungen', async (req, res) => {
  const { id } = req.params;
  const { status } = req.query;
  try {
    let sql = 'SELECT * FROM nationalkader_nominierungen WHERE kader_id = ?';
    const params = [id];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY platzierung ASC, turnier_datum DESC, nachname ASC';
    const [nominierungen] = await pool.query(sql, params);
    res.json({ success: true, nominierungen });
  } catch (err) {
    logger.error('[Nationalkader] GET /:id/nominierungen Fehler:', err);
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Nominierungen' });
  }
});

// POST /api/nationalkader/:id/nominieren — Athleten manuell nominieren
router.post('/:id/nominieren', async (req, res) => {
  const { id } = req.params;
  const {
    events_wettkaempfer_id, vorname, nachname, geschlecht,
    geburtsdatum, verein_name, events_turnier_id, turnier_name,
    turnier_datum, division_name, division_code, platzierung, notiz
  } = req.body;

  if (!events_wettkaempfer_id || !vorname || !nachname) {
    return res.status(400).json({ success: false, message: 'Athlet-Daten unvollständig' });
  }
  try {
    const [[kader]] = await pool.query('SELECT id FROM nationalkader WHERE id = ?', [id]);
    if (!kader) return res.status(404).json({ success: false, message: 'Kader nicht gefunden' });

    const [result] = await pool.query(`
      INSERT INTO nationalkader_nominierungen
        (kader_id, events_wettkaempfer_id, vorname, nachname, geschlecht, geburtsdatum,
         verein_name, nominierungsart, nominiert_durch_user_id,
         events_turnier_id, turnier_name, turnier_datum,
         division_name, division_code, platzierung, notiz)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'manuell', ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        status = 'aktiv',
        nominierungsart = 'manuell',
        notiz = VALUES(notiz)
    `, [
      id, events_wettkaempfer_id, vorname, nachname, geschlecht || null,
      geburtsdatum || null, verein_name || null, req.user?.id || null,
      events_turnier_id || null, turnier_name || null, turnier_datum || null,
      division_name || null, division_code || null, platzierung || null, notiz || null
    ]);

    const [[nom]] = await pool.query(
      'SELECT * FROM nationalkader_nominierungen WHERE id = LAST_INSERT_ID()'
    );
    res.status(201).json({ success: true, nominierung: nom });
  } catch (err) {
    logger.error('[Nationalkader] POST /:id/nominieren Fehler:', err);
    res.status(500).json({ success: false, message: 'Fehler beim Nominieren' });
  }
});

// PUT /api/nationalkader/nominierungen/:nomId — Status/Notiz ändern
router.put('/nominierungen/:nomId', async (req, res) => {
  const { nomId } = req.params;
  const { status, notiz } = req.body;
  try {
    await pool.query(
      'UPDATE nationalkader_nominierungen SET status=?, notiz=? WHERE id=?',
      [status, notiz || null, nomId]
    );
    const [[nom]] = await pool.query('SELECT * FROM nationalkader_nominierungen WHERE id=?', [nomId]);
    if (!nom) return res.status(404).json({ success: false, message: 'Nominierung nicht gefunden' });
    res.json({ success: true, nominierung: nom });
  } catch (err) {
    logger.error('[Nationalkader] PUT /nominierungen/:id Fehler:', err);
    res.status(500).json({ success: false, message: 'Fehler beim Speichern' });
  }
});

// DELETE /api/nationalkader/nominierungen/:nomId — Nominierung entfernen
router.delete('/nominierungen/:nomId', async (req, res) => {
  const { nomId } = req.params;
  try {
    await pool.query('DELETE FROM nationalkader_nominierungen WHERE id = ?', [nomId]);
    res.json({ success: true });
  } catch (err) {
    logger.error('[Nationalkader] DELETE /nominierungen/:id Fehler:', err);
    res.status(500).json({ success: false, message: 'Fehler beim Löschen' });
  }
});

// ============================================================================
// KANDIDATEN & AUTO-SYNC von TDA-Events
// ============================================================================

// GET /api/nationalkader/kandidaten — Top-3-Athleten von allen TDA-Events-Turnieren
// Holt Daten live von events.tda-intl.org (öffentlich, kein Auth nötig)
router.get('/kandidaten', async (req, res) => {
  try {
    // 1. Alle abgeschlossenen Turniere von TDA-Events holen
    // Die public-Route liefert nur zukünftige Turniere → wir holen über siegerehrung direkt
    // Strategie: Turnier-IDs 1..N iterieren wäre ineffizient.
    // Besser: Eigene DB-Tabelle tda_turniere (032) nutzen falls vorhanden, sonst public API
    let turnierIds = [];

    try {
      // Versuche: lokale tda_turniere-Tabelle (wird manuell gepflegt)
      const [rows] = await pool.query(
        'SELECT events_turnier_id FROM tda_turniere WHERE events_turnier_id IS NOT NULL ORDER BY datum DESC LIMIT 50'
      );
      turnierIds = rows.map(r => r.events_turnier_id);
    } catch (_) {
      // Tabelle nicht vorhanden — fallback auf bekannte IDs via API
    }

    // Wenn keine lokalen IDs: hole über public API die letzten Turniere
    if (turnierIds.length === 0) {
      try {
        const publicData = await fetchEventsApi('/turniere/public');
        if (publicData.success && Array.isArray(publicData.data)) {
          turnierIds = publicData.data.map(t => t.turnier_id);
        }
      } catch (apiErr) {
        logger.warn('[Nationalkader] TDA-Events API nicht erreichbar:', apiErr.message);
      }
    }

    if (turnierIds.length === 0) {
      return res.json({ success: true, kandidaten: [], turniere: [], hinweis: 'Keine Turniere gefunden' });
    }

    // 2. Ergebnisse für jedes Turnier laden (nur Top 3)
    const kandidatenMap = new Map(); // key: wettkaempfer_id
    const turnierInfos = [];

    await Promise.allSettled(
      turnierIds.map(async (tid) => {
        try {
          const data = await fetchEventsApi(`/siegerehrung/turnier/${tid}/public`);
          if (!data.success || !Array.isArray(data.data)) return;

          turnierInfos.push({ turnier_id: tid, ...data.turnier });

          for (const kategorie of data.data) {
            for (const platz of kategorie.plaetze) {
              if (platz.platzierung > 3) continue;

              // Kandidaten zusammenführen (ein Athlet kann mehrere Ergebnisse haben)
              const key = `${platz.vorname}_${platz.nachname}_${platz.verein_name}`;
              if (!kandidatenMap.has(key)) {
                kandidatenMap.set(key, {
                  vorname: platz.vorname,
                  nachname: platz.nachname,
                  verein_name: platz.verein_name,
                  ergebnisse: []
                });
              }
              kandidatenMap.get(key).ergebnisse.push({
                turnier_id: tid,
                turnier_name: data.turnier?.name || `Turnier ${tid}`,
                turnier_datum: data.turnier?.datum || null,
                division_name: kategorie.kategorie_name,
                division_code: kategorie.division_code,
                division_type: kategorie.division_type,
                platzierung: platz.platzierung,
                punkte: platz.punkte || null
              });
            }
          }
        } catch (err) {
          logger.debug(`[Nationalkader] Turnier ${tid} Fehler:`, err.message);
        }
      })
    );

    const kandidaten = Array.from(kandidatenMap.values()).sort((a, b) => {
      const bestA = Math.min(...a.ergebnisse.map(e => e.platzierung));
      const bestB = Math.min(...b.ergebnisse.map(e => e.platzierung));
      return bestA - bestB || a.nachname.localeCompare(b.nachname);
    });

    res.json({ success: true, kandidaten, turniere: turnierInfos });
  } catch (err) {
    logger.error('[Nationalkader] GET /kandidaten Fehler:', err);
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Kandidaten' });
  }
});

// POST /api/nationalkader/:id/auto-sync — Top-3 von TDA-Events automatisch in Kader übernehmen
router.post('/:id/auto-sync', async (req, res) => {
  const { id } = req.params;
  try {
    const [[kader]] = await pool.query('SELECT id FROM nationalkader WHERE id = ?', [id]);
    if (!kader) return res.status(404).json({ success: false, message: 'Kader nicht gefunden' });

    // Kandidaten laden (gleiche Logik wie oben)
    let turnierIds = [];
    try {
      const [rows] = await pool.query(
        'SELECT events_turnier_id FROM tda_turniere WHERE events_turnier_id IS NOT NULL ORDER BY datum DESC LIMIT 50'
      );
      turnierIds = rows.map(r => r.events_turnier_id);
    } catch (_) {}

    if (turnierIds.length === 0) {
      try {
        const publicData = await fetchEventsApi('/turniere/public');
        if (publicData.success && Array.isArray(publicData.data)) {
          turnierIds = publicData.data.map(t => t.turnier_id);
        }
      } catch (apiErr) {
        return res.status(503).json({ success: false, message: 'TDA-Events API nicht erreichbar' });
      }
    }

    let neuNominiert = 0;
    let bereitsVorhanden = 0;
    const fehler = [];

    await Promise.allSettled(
      turnierIds.map(async (tid) => {
        try {
          const data = await fetchEventsApi(`/siegerehrung/turnier/${tid}/public`);
          if (!data.success || !Array.isArray(data.data)) return;

          for (const kategorie of data.data) {
            for (const platz of kategorie.plaetze) {
              if (platz.platzierung > 3) continue;

              // Wettkaempfer-ID über Name+Verein ableiten (beste Annäherung ohne Auth)
              // Wir verwenden einen stabilen Hash-Key aus Name+Verein als pseudo-ID
              // (in Realität würde hier der echte wettkaempfer_id aus der Events-DB kommen)
              const pseudoId = Math.abs(
                `${platz.vorname}${platz.nachname}${platz.verein_name}`.split('').reduce(
                  (h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0
                )
              );

              try {
                await pool.query(`
                  INSERT INTO nationalkader_nominierungen
                    (kader_id, events_wettkaempfer_id, vorname, nachname, verein_name,
                     nominierungsart, nominiert_durch_user_id,
                     events_turnier_id, turnier_name, turnier_datum,
                     division_name, division_code, platzierung)
                  VALUES (?, ?, ?, ?, ?, 'automatisch', ?, ?, ?, ?, ?, ?, ?)
                  ON DUPLICATE KEY UPDATE status = status
                `, [
                  id, pseudoId, platz.vorname, platz.nachname, platz.verein_name,
                  req.user?.id || null,
                  tid, data.turnier?.name || `Turnier ${tid}`, data.turnier?.datum || null,
                  kategorie.kategorie_name, kategorie.division_code || null, platz.platzierung
                ]);

                // Affected rows: 1 = neu, 0 = Duplikat
                neuNominiert++;
              } catch (dupErr) {
                if (dupErr.code === 'ER_DUP_ENTRY') {
                  bereitsVorhanden++;
                } else {
                  fehler.push(dupErr.message);
                }
              }
            }
          }
        } catch (err) {
          fehler.push(`Turnier ${tid}: ${err.message}`);
        }
      })
    );

    res.json({
      success: true,
      neuNominiert,
      bereitsVorhanden,
      fehler: fehler.slice(0, 5),
      message: `${neuNominiert} neue Athleten nominiert, ${bereitsVorhanden} bereits vorhanden`
    });
  } catch (err) {
    logger.error('[Nationalkader] POST /:id/auto-sync Fehler:', err);
    res.status(500).json({ success: false, message: 'Fehler beim Auto-Sync' });
  }
});

module.exports = router;
