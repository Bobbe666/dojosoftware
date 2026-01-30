// ============================================================================
// SUPPORT-TICKETSYSTEM - API Routes
// ============================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Upload-Konfiguration
const uploadDir = '/var/www/dojosoftware/uploads/support';

// Sicherstellen, dass Upload-Verzeichnis existiert
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `ticket-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Dateityp nicht erlaubt'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilter
});

// ============================================================================
// HELPER FUNKTIONEN
// ============================================================================

// Nächste Ticket-Nummer generieren
const getNextTicketNummer = async () => {
  const jahr = new Date().getFullYear();

  return new Promise((resolve, reject) => {
    db.query(
      'INSERT INTO support_ticket_nummern (jahr, aktuelle_nummer) VALUES (?, 1) ON DUPLICATE KEY UPDATE aktuelle_nummer = aktuelle_nummer + 1',
      [jahr],
      (err) => {
        if (err) return reject(err);

        db.query(
          'SELECT aktuelle_nummer FROM support_ticket_nummern WHERE jahr = ?',
          [jahr],
          (err, results) => {
            if (err) return reject(err);
            const nummer = results[0].aktuelle_nummer;
            resolve(`TKT-${jahr}-${String(nummer).padStart(5, '0')}`);
          }
        );
      }
    );
  });
};

// Prüfen ob User Zugriff auf Ticket hat
const hatZugriff = (ticket, user) => {
  // SuperAdmin hat immer Zugriff
  if (user.role === 'super_admin' || user.username === 'admin') {
    return true;
  }

  // Ersteller hat Zugriff
  if (ticket.ersteller_id === user.user_id || ticket.ersteller_id === user.id) {
    return true;
  }

  // Admin im gleichen Dojo
  if (user.role === 'admin' && ticket.dojo_id === user.dojo_id) {
    return true;
  }

  // Zugewiesener Bearbeiter
  if (ticket.zugewiesen_an === user.user_id || ticket.zugewiesen_an === user.id) {
    return true;
  }

  return false;
};

// Ist Admin/Bearbeiter?
const istBearbeiter = (user) => {
  return user.role === 'admin' || user.role === 'super_admin' || user.username === 'admin';
};

// ============================================================================
// ROUTES
// ============================================================================

// GET /api/support-tickets - Tickets abrufen (gefiltert nach Rolle)
router.get('/', async (req, res) => {
  try {
    const { status, kategorie, bereich, prioritaet, zugewiesen, limit = 50, offset = 0 } = req.query;
    const user = req.user;

    let query = `
      SELECT t.*,
        (SELECT COUNT(*) FROM support_ticket_nachrichten WHERE ticket_id = t.id) as nachrichten_count,
        (SELECT COUNT(*) FROM support_ticket_anhaenge WHERE ticket_id = t.id) as anhaenge_count,
        u.vorname as zugewiesen_vorname, u.nachname as zugewiesen_nachname
      FROM support_tickets t
      LEFT JOIN users u ON t.zugewiesen_an = u.id
      WHERE 1=1
    `;
    const params = [];

    // Berechtigungs-Filter
    if (user.role === 'super_admin' || user.username === 'admin') {
      // SuperAdmin sieht alle Tickets
    } else if (user.role === 'admin') {
      // Admin sieht Tickets des eigenen Dojos + eigene
      query += ' AND (t.dojo_id = ? OR t.ersteller_id = ? OR t.zugewiesen_an = ?)';
      params.push(user.dojo_id, user.user_id || user.id, user.user_id || user.id);
    } else {
      // Normale User sehen nur eigene Tickets
      query += ' AND t.ersteller_id = ?';
      params.push(user.user_id || user.id);
    }

    // Filter
    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }
    if (kategorie) {
      query += ' AND t.kategorie = ?';
      params.push(kategorie);
    }
    if (bereich) {
      query += ' AND t.bereich = ?';
      params.push(bereich);
    }
    if (prioritaet) {
      query += ' AND t.prioritaet = ?';
      params.push(prioritaet);
    }
    if (zugewiesen === 'mir') {
      query += ' AND t.zugewiesen_an = ?';
      params.push(user.user_id || user.id);
    } else if (zugewiesen === 'niemand') {
      query += ' AND t.zugewiesen_an IS NULL';
    }

    query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    db.query(query, params, (err, tickets) => {
      if (err) {
        console.error('Fehler beim Laden der Tickets:', err);
        return res.status(500).json({ error: 'Datenbankfehler' });
      }

      // Zählung für Pagination
      let countQuery = 'SELECT COUNT(*) as total FROM support_tickets t WHERE 1=1';
      const countParams = [];

      if (user.role === 'super_admin' || user.username === 'admin') {
        // Alle
      } else if (user.role === 'admin') {
        countQuery += ' AND (t.dojo_id = ? OR t.ersteller_id = ? OR t.zugewiesen_an = ?)';
        countParams.push(user.dojo_id, user.user_id || user.id, user.user_id || user.id);
      } else {
        countQuery += ' AND t.ersteller_id = ?';
        countParams.push(user.user_id || user.id);
      }

      if (status) {
        countQuery += ' AND t.status = ?';
        countParams.push(status);
      }
      if (kategorie) {
        countQuery += ' AND t.kategorie = ?';
        countParams.push(kategorie);
      }
      if (bereich) {
        countQuery += ' AND t.bereich = ?';
        countParams.push(bereich);
      }

      db.query(countQuery, countParams, (err, countResult) => {
        res.json({
          tickets,
          total: countResult?.[0]?.total || tickets.length,
          limit: parseInt(limit),
          offset: parseInt(offset)
        });
      });
    });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/support-tickets/statistiken - Ticket-Statistiken
router.get('/statistiken', (req, res) => {
  const user = req.user;

  if (!istBearbeiter(user)) {
    return res.status(403).json({ error: 'Keine Berechtigung' });
  }

  let whereClause = '1=1';
  const params = [];

  if (user.role !== 'super_admin' && user.username !== 'admin') {
    whereClause = 'dojo_id = ?';
    params.push(user.dojo_id);
  }

  const query = `
    SELECT
      COUNT(*) as gesamt,
      SUM(CASE WHEN status = 'offen' THEN 1 ELSE 0 END) as offen,
      SUM(CASE WHEN status = 'in_bearbeitung' THEN 1 ELSE 0 END) as in_bearbeitung,
      SUM(CASE WHEN status = 'warten_auf_antwort' THEN 1 ELSE 0 END) as warten_auf_antwort,
      SUM(CASE WHEN status = 'erledigt' THEN 1 ELSE 0 END) as erledigt,
      SUM(CASE WHEN status = 'geschlossen' THEN 1 ELSE 0 END) as geschlossen,
      SUM(CASE WHEN bereich = 'dojo' THEN 1 ELSE 0 END) as dojo_tickets,
      SUM(CASE WHEN bereich = 'verband' THEN 1 ELSE 0 END) as verband_tickets,
      SUM(CASE WHEN bereich = 'org' THEN 1 ELSE 0 END) as org_tickets,
      SUM(CASE WHEN prioritaet = 'kritisch' AND status NOT IN ('erledigt', 'geschlossen') THEN 1 ELSE 0 END) as kritisch_offen
    FROM support_tickets
    WHERE ${whereClause}
  `;

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Fehler bei Statistiken:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
    res.json(results[0]);
  });
});

// GET /api/support-tickets/:id - Einzelnes Ticket mit Nachrichten
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const user = req.user;

  db.query('SELECT * FROM support_tickets WHERE id = ?', [id], (err, tickets) => {
    if (err) {
      console.error('Fehler:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    if (tickets.length === 0) {
      return res.status(404).json({ error: 'Ticket nicht gefunden' });
    }

    const ticket = tickets[0];

    if (!hatZugriff(ticket, user)) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    // Nachrichten laden
    let nachrichtenQuery = `
      SELECT * FROM support_ticket_nachrichten
      WHERE ticket_id = ?
    `;

    // Interne Nachrichten nur für Bearbeiter
    if (!istBearbeiter(user)) {
      nachrichtenQuery += ' AND ist_intern = 0';
    }

    nachrichtenQuery += ' ORDER BY created_at ASC';

    db.query(nachrichtenQuery, [id], (err, nachrichten) => {
      if (err) {
        console.error('Fehler bei Nachrichten:', err);
        return res.status(500).json({ error: 'Datenbankfehler' });
      }

      // Anhänge laden
      db.query(
        'SELECT * FROM support_ticket_anhaenge WHERE ticket_id = ? ORDER BY created_at ASC',
        [id],
        (err, anhaenge) => {
          if (err) {
            console.error('Fehler bei Anhängen:', err);
            return res.status(500).json({ error: 'Datenbankfehler' });
          }

          res.json({
            ...ticket,
            nachrichten,
            anhaenge
          });
        }
      );
    });
  });
});

// POST /api/support-tickets - Neues Ticket erstellen
router.post('/', async (req, res) => {
  try {
    const { kategorie, betreff, nachricht, prioritaet = 'mittel', bereich = 'dojo' } = req.body;
    const user = req.user;

    if (!kategorie || !betreff || !nachricht) {
      return res.status(400).json({ error: 'Kategorie, Betreff und Nachricht sind erforderlich' });
    }

    const ticketNummer = await getNextTicketNummer();

    // Ersteller-Info ermitteln
    const erstellerTyp = user.role === 'admin' || user.role === 'super_admin' ? 'admin' :
                         user.mitglied_id ? 'mitglied' : 'user';
    const erstellerName = user.vorname && user.nachname ?
                          `${user.vorname} ${user.nachname}` :
                          user.username || user.email;

    const insertQuery = `
      INSERT INTO support_tickets
      (ticket_nummer, ersteller_typ, ersteller_id, ersteller_name, ersteller_email,
       bereich, dojo_id, kategorie, betreff, prioritaet)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      ticketNummer,
      erstellerTyp,
      user.user_id || user.id,
      erstellerName,
      user.email,
      bereich,
      user.dojo_id || null,
      kategorie,
      betreff,
      prioritaet
    ];

    db.query(insertQuery, params, (err, result) => {
      if (err) {
        console.error('Fehler beim Erstellen:', err);
        return res.status(500).json({ error: 'Datenbankfehler' });
      }

      const ticketId = result.insertId;

      // Erste Nachricht hinzufügen
      db.query(
        `INSERT INTO support_ticket_nachrichten
         (ticket_id, absender_typ, absender_id, absender_name, nachricht)
         VALUES (?, 'ersteller', ?, ?, ?)`,
        [ticketId, user.user_id || user.id, erstellerName, nachricht],
        (err) => {
          if (err) {
            console.error('Fehler bei erster Nachricht:', err);
          }

          res.status(201).json({
            success: true,
            id: ticketId,
            ticket_nummer: ticketNummer,
            message: 'Ticket erfolgreich erstellt'
          });
        }
      );
    });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/support-tickets/:id/nachrichten - Nachricht hinzufügen
router.post('/:id/nachrichten', (req, res) => {
  const { id } = req.params;
  const { nachricht, ist_intern = false } = req.body;
  const user = req.user;

  if (!nachricht) {
    return res.status(400).json({ error: 'Nachricht erforderlich' });
  }

  // Ticket laden und Berechtigung prüfen
  db.query('SELECT * FROM support_tickets WHERE id = ?', [id], (err, tickets) => {
    if (err || tickets.length === 0) {
      return res.status(404).json({ error: 'Ticket nicht gefunden' });
    }

    const ticket = tickets[0];

    if (!hatZugriff(ticket, user)) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    // Nur Bearbeiter können interne Nachrichten schreiben
    const internFlag = ist_intern && istBearbeiter(user) ? 1 : 0;

    // Absender-Typ bestimmen
    const absenderTyp = (ticket.ersteller_id === (user.user_id || user.id)) ? 'ersteller' : 'bearbeiter';
    const absenderName = user.vorname && user.nachname ?
                         `${user.vorname} ${user.nachname}` :
                         user.username || user.email;

    db.query(
      `INSERT INTO support_ticket_nachrichten
       (ticket_id, absender_typ, absender_id, absender_name, nachricht, ist_intern)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, absenderTyp, user.user_id || user.id, absenderName, nachricht, internFlag],
      (err, result) => {
        if (err) {
          console.error('Fehler:', err);
          return res.status(500).json({ error: 'Datenbankfehler' });
        }

        // Status aktualisieren wenn Bearbeiter antwortet
        if (absenderTyp === 'bearbeiter' && ticket.status === 'offen') {
          db.query(
            "UPDATE support_tickets SET status = 'warten_auf_antwort', updated_at = NOW() WHERE id = ?",
            [id]
          );
        } else if (absenderTyp === 'ersteller' && ticket.status === 'warten_auf_antwort') {
          db.query(
            "UPDATE support_tickets SET status = 'in_bearbeitung', updated_at = NOW() WHERE id = ?",
            [id]
          );
        }

        res.status(201).json({
          success: true,
          id: result.insertId,
          message: 'Nachricht hinzugefügt'
        });
      }
    );
  });
});

// PUT /api/support-tickets/:id/status - Status ändern
router.put('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const user = req.user;

  if (!istBearbeiter(user)) {
    return res.status(403).json({ error: 'Keine Berechtigung' });
  }

  const validStatus = ['offen', 'in_bearbeitung', 'warten_auf_antwort', 'erledigt', 'geschlossen'];
  if (!validStatus.includes(status)) {
    return res.status(400).json({ error: 'Ungültiger Status' });
  }

  let updateQuery = 'UPDATE support_tickets SET status = ?, updated_at = NOW()';
  const params = [status];

  if (status === 'erledigt') {
    updateQuery += ', erledigt_am = NOW()';
  } else if (status === 'geschlossen') {
    updateQuery += ', geschlossen_am = NOW()';
  }

  updateQuery += ' WHERE id = ?';
  params.push(id);

  db.query(updateQuery, params, (err, result) => {
    if (err) {
      console.error('Fehler:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Ticket nicht gefunden' });
    }

    // System-Nachricht hinzufügen
    const statusLabels = {
      'offen': 'Offen',
      'in_bearbeitung': 'In Bearbeitung',
      'warten_auf_antwort': 'Warten auf Antwort',
      'erledigt': 'Erledigt',
      'geschlossen': 'Geschlossen'
    };

    db.query(
      `INSERT INTO support_ticket_nachrichten
       (ticket_id, absender_typ, absender_name, nachricht, ist_intern)
       VALUES (?, 'system', 'System', ?, 0)`,
      [id, `Status geändert zu: ${statusLabels[status]}`]
    );

    res.json({ success: true, message: 'Status aktualisiert' });
  });
});

// PUT /api/support-tickets/:id/zuweisen - Ticket zuweisen
router.put('/:id/zuweisen', (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;
  const user = req.user;

  if (!istBearbeiter(user)) {
    return res.status(403).json({ error: 'Keine Berechtigung' });
  }

  db.query(
    'UPDATE support_tickets SET zugewiesen_an = ?, zugewiesen_am = NOW(), updated_at = NOW() WHERE id = ?',
    [user_id || null, id],
    (err, result) => {
      if (err) {
        console.error('Fehler:', err);
        return res.status(500).json({ error: 'Datenbankfehler' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Ticket nicht gefunden' });
      }

      // Bei Zuweisung Status auf "In Bearbeitung" setzen
      if (user_id) {
        db.query(
          "UPDATE support_tickets SET status = 'in_bearbeitung' WHERE id = ? AND status = 'offen'",
          [id]
        );
      }

      res.json({ success: true, message: 'Ticket zugewiesen' });
    }
  );
});

// PUT /api/support-tickets/:id/prioritaet - Priorität ändern
router.put('/:id/prioritaet', (req, res) => {
  const { id } = req.params;
  const { prioritaet } = req.body;
  const user = req.user;

  if (!istBearbeiter(user)) {
    return res.status(403).json({ error: 'Keine Berechtigung' });
  }

  const validPrioritaet = ['niedrig', 'mittel', 'hoch', 'kritisch'];
  if (!validPrioritaet.includes(prioritaet)) {
    return res.status(400).json({ error: 'Ungültige Priorität' });
  }

  db.query(
    'UPDATE support_tickets SET prioritaet = ?, updated_at = NOW() WHERE id = ?',
    [prioritaet, id],
    (err, result) => {
      if (err) {
        console.error('Fehler:', err);
        return res.status(500).json({ error: 'Datenbankfehler' });
      }

      res.json({ success: true, message: 'Priorität aktualisiert' });
    }
  );
});

// POST /api/support-tickets/:id/anhaenge - Datei hochladen
router.post('/:id/anhaenge', upload.single('datei'), (req, res) => {
  const { id } = req.params;
  const { nachricht_id } = req.body;
  const user = req.user;

  if (!req.file) {
    return res.status(400).json({ error: 'Keine Datei hochgeladen' });
  }

  // Ticket-Zugriff prüfen
  db.query('SELECT * FROM support_tickets WHERE id = ?', [id], (err, tickets) => {
    if (err || tickets.length === 0) {
      // Datei löschen wenn Ticket nicht existiert
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Ticket nicht gefunden' });
    }

    if (!hatZugriff(tickets[0], user)) {
      fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    db.query(
      `INSERT INTO support_ticket_anhaenge
       (ticket_id, nachricht_id, dateiname, original_name, dateityp, dateigroesse, pfad, hochgeladen_von)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        nachricht_id || null,
        req.file.filename,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.file.path,
        user.user_id || user.id
      ],
      (err, result) => {
        if (err) {
          console.error('Fehler:', err);
          fs.unlink(req.file.path, () => {});
          return res.status(500).json({ error: 'Datenbankfehler' });
        }

        res.status(201).json({
          success: true,
          id: result.insertId,
          dateiname: req.file.filename,
          original_name: req.file.originalname
        });
      }
    );
  });
});

// GET /api/support-tickets/anhaenge/:id - Datei herunterladen
router.get('/anhaenge/:anhangId', (req, res) => {
  const { anhangId } = req.params;
  const user = req.user;

  db.query(
    `SELECT a.*, t.ersteller_id, t.dojo_id, t.zugewiesen_an
     FROM support_ticket_anhaenge a
     JOIN support_tickets t ON a.ticket_id = t.id
     WHERE a.id = ?`,
    [anhangId],
    (err, results) => {
      if (err || results.length === 0) {
        return res.status(404).json({ error: 'Anhang nicht gefunden' });
      }

      const anhang = results[0];

      if (!hatZugriff(anhang, user)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }

      res.download(anhang.pfad, anhang.original_name);
    }
  );
});

// GET /api/support-tickets/bearbeiter - Liste der möglichen Bearbeiter
router.get('/bearbeiter/liste', (req, res) => {
  const user = req.user;

  if (!istBearbeiter(user)) {
    return res.status(403).json({ error: 'Keine Berechtigung' });
  }

  // Admins und Super-Admins als mögliche Bearbeiter
  db.query(
    `SELECT id, vorname, nachname, email, role
     FROM users
     WHERE role IN ('admin', 'super_admin') AND aktiv = 1
     ORDER BY nachname, vorname`,
    (err, results) => {
      if (err) {
        console.error('Fehler:', err);
        return res.status(500).json({ error: 'Datenbankfehler' });
      }
      res.json(results);
    }
  );
});

module.exports = router;
