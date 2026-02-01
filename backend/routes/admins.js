// routes/admins.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');

// ===================================================================
// 🔐 HELPER FUNCTIONS
// ===================================================================

// Standard-Berechtigungen für verschiedene Rollen
const getRollenBerechtigungen = (rolle) => {
  switch (rolle) {
    case 'super_admin':
      return {
        mitglieder: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
        vertraege: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
        finanzen: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
        pruefungen: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
        stundenplan: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
        einstellungen: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
        admins: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
        dashboard: { lesen: true },
        berichte: { lesen: true, exportieren: true }
      };

    case 'admin':
      return {
        mitglieder: { lesen: true, erstellen: true, bearbeiten: true, loeschen: false },
        vertraege: { lesen: true, erstellen: true, bearbeiten: true, loeschen: false },
        finanzen: { lesen: true, erstellen: true, bearbeiten: true, loeschen: false },
        pruefungen: { lesen: true, erstellen: true, bearbeiten: true, loeschen: false },
        stundenplan: { lesen: true, erstellen: true, bearbeiten: true, loeschen: false },
        einstellungen: { lesen: true, erstellen: false, bearbeiten: true, loeschen: false },
        admins: { lesen: true, erstellen: false, bearbeiten: false, loeschen: false },
        dashboard: { lesen: true },
        berichte: { lesen: true, exportieren: true }
      };

    case 'mitarbeiter':
      return {
        mitglieder: { lesen: true, erstellen: true, bearbeiten: true, loeschen: false },
        vertraege: { lesen: true, erstellen: false, bearbeiten: false, loeschen: false },
        finanzen: { lesen: true, erstellen: false, bearbeiten: false, loeschen: false },
        pruefungen: { lesen: true, erstellen: true, bearbeiten: true, loeschen: false },
        stundenplan: { lesen: true, erstellen: true, bearbeiten: true, loeschen: false },
        einstellungen: { lesen: true, erstellen: false, bearbeiten: false, loeschen: false },
        admins: { lesen: false, erstellen: false, bearbeiten: false, loeschen: false },
        dashboard: { lesen: true },
        berichte: { lesen: true, exportieren: false }
      };

    case 'eingeschraenkt':
      return {
        mitglieder: { lesen: true, erstellen: false, bearbeiten: false, loeschen: false },
        vertraege: { lesen: true, erstellen: false, bearbeiten: false, loeschen: false },
        finanzen: { lesen: false, erstellen: false, bearbeiten: false, loeschen: false },
        pruefungen: { lesen: true, erstellen: false, bearbeiten: false, loeschen: false },
        stundenplan: { lesen: true, erstellen: false, bearbeiten: false, loeschen: false },
        einstellungen: { lesen: false, erstellen: false, bearbeiten: false, loeschen: false },
        admins: { lesen: false, erstellen: false, bearbeiten: false, loeschen: false },
        dashboard: { lesen: true },
        berichte: { lesen: false, exportieren: false }
      };

    default:
      return {
        mitglieder: { lesen: false, erstellen: false, bearbeiten: false, loeschen: false },
        vertraege: { lesen: false, erstellen: false, bearbeiten: false, loeschen: false },
        finanzen: { lesen: false, erstellen: false, bearbeiten: false, loeschen: false },
        pruefungen: { lesen: false, erstellen: false, bearbeiten: false, loeschen: false },
        stundenplan: { lesen: false, erstellen: false, bearbeiten: false, loeschen: false },
        einstellungen: { lesen: false, erstellen: false, bearbeiten: false, loeschen: false },
        admins: { lesen: false, erstellen: false, bearbeiten: false, loeschen: false },
        dashboard: { lesen: false },
        berichte: { lesen: false, exportieren: false }
      };
  }
};

// ===================================================================
// 📋 GET /api/admins - Alle Admins abrufen
// ===================================================================
router.get('/', (req, res) => {
  logger.debug('🔵 GET /api/admins aufgerufen');

  const sql = `
    SELECT
      id,
      username,
      email,
      vorname,
      nachname,
      rolle,
      berechtigungen,
      aktiv,
      email_verifiziert,
      letzter_login,
      login_versuche,
      gesperrt_bis,
      erstellt_am,
      aktualisiert_am
    FROM admin_users
    ORDER BY erstellt_am DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden der Admins:', err);
      return res.status(500).json({ error: 'Serverfehler beim Laden der Admins' });
    }

    // Berechtigungen von JSON-String zu Objekt parsen
    const admins = results.map(admin => {
      try {
        return {
          ...admin,
          berechtigungen: typeof admin.berechtigungen === 'string'
            ? JSON.parse(admin.berechtigungen)
            : admin.berechtigungen
        };
      } catch (e) {
        logger.warn('Fehler beim Parsen der Berechtigungen für Admin:', { details: admin.id });
        return admin;
      }
    });

    logger.info('${admins.length} Admins geladen');
    res.json(admins);
  });
});

// ===================================================================
// 📋 GET /api/admins/:id - Einzelnen Admin abrufen
// ===================================================================
router.get('/:id', (req, res) => {
  const { id } = req.params;
  logger.debug('🔵 GET /api/admins/${id} aufgerufen');

  const sql = `
    SELECT
      id,
      username,
      email,
      vorname,
      nachname,
      rolle,
      berechtigungen,
      aktiv,
      email_verifiziert,
      letzter_login,
      login_versuche,
      gesperrt_bis,
      erstellt_am,
      aktualisiert_am
    FROM admin_users
    WHERE id = ?
  `;

  db.query(sql, [id], (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden des Admins:', err);
      return res.status(500).json({ error: 'Serverfehler beim Laden des Admins' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Admin nicht gefunden' });
    }

    const admin = results[0];
    try {
      admin.berechtigungen = typeof admin.berechtigungen === 'string'
        ? JSON.parse(admin.berechtigungen)
        : admin.berechtigungen;
    } catch (e) {
      logger.warn('Fehler beim Parsen der Berechtigungen');
    }

    logger.info('Admin ${admin.username} geladen');
    res.json(admin);
  });
});

// ===================================================================
// ✏️ POST /api/admins - Neuen Admin erstellen
// ===================================================================
router.post('/', async (req, res) => {
  logger.debug('🟢 POST /api/admins aufgerufen');

  const {
    username,
    email,
    password,
    vorname,
    nachname,
    rolle,
    berechtigungen,
    aktiv
  } = req.body;

  // Validierung
  if (!username || !email || !password) {
    return res.status(400).json({
      error: 'Username, E-Mail und Passwort sind erforderlich'
    });
  }

  // ✅ SCHUTZ: "admin" Benutzername ist reserviert
  if (username.toLowerCase() === 'admin') {
    return res.status(400).json({
      error: 'Der Benutzername "admin" ist reserviert. Bitte wählen Sie einen anderen.'
    });
  }

  try {
    // Prüfen ob Username oder Email bereits existiert
    const checkSql = `
      SELECT id FROM admin_users
      WHERE username = ? OR email = ?
    `;

    db.query(checkSql, [username, email], async (checkErr, checkResults) => {
      if (checkErr) {
        logger.error('Fehler bei der Duplikat-Prüfung:', checkErr);
        return res.status(500).json({ error: 'Serverfehler' });
      }

      if (checkResults.length > 0) {
        return res.status(409).json({
          error: 'Username oder E-Mail bereits vergeben'
        });
      }

      // Passwort hashen
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Berechtigungen: Entweder custom oder basierend auf Rolle
      let finalBerechtigungen = berechtigungen || getRollenBerechtigungen(rolle || 'eingeschraenkt');

      const sql = `
        INSERT INTO admin_users (
          username,
          email,
          password,
          vorname,
          nachname,
          rolle,
          berechtigungen,
          aktiv,
          email_verifiziert
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        username,
        email,
        hashedPassword,
        vorname || '',
        nachname || '',
        rolle || 'eingeschraenkt',
        JSON.stringify(finalBerechtigungen),
        aktiv !== undefined ? aktiv : true,
        false
      ];

      db.query(sql, values, (err, result) => {
        if (err) {
          logger.error('Fehler beim Erstellen des Admins:', err);
          return res.status(500).json({ error: 'Serverfehler beim Erstellen' });
        }

        logger.info('Admin ${username} erfolgreich erstellt (ID: ${result.insertId})');

        // Neuen Admin zurückgeben (ohne Passwort)
        const selectSql = `
          SELECT
            id, username, email, vorname, nachname, rolle,
            berechtigungen, aktiv, email_verifiziert, erstellt_am
          FROM admin_users
          WHERE id = ?
        `;

        db.query(selectSql, [result.insertId], (selectErr, selectResults) => {
          if (selectErr) {
            return res.status(201).json({
              success: true,
              id: result.insertId
            });
          }

          const newAdmin = selectResults[0];
          try {
            newAdmin.berechtigungen = typeof newAdmin.berechtigungen === 'string'
              ? JSON.parse(newAdmin.berechtigungen)
              : newAdmin.berechtigungen;
          } catch (e) {
            // Ungültiges JSON in berechtigungen - behalte String
          }

          res.status(201).json(newAdmin);
        });
      });
    });

  } catch (error) {
    logger.error('Fehler beim Passwort-Hashing:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ===================================================================
// 🔄 PUT /api/admins/:id - Admin aktualisieren
// ===================================================================
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  logger.debug('🟡 PUT /api/admins/${id} aufgerufen');

  const {
    username,
    email,
    password,
    vorname,
    nachname,
    rolle,
    berechtigungen,
    aktiv
  } = req.body;

  try {
    // Prüfen ob Admin existiert
    const checkSql = `SELECT id FROM admin_users WHERE id = ?`;

    db.query(checkSql, [id], async (checkErr, checkResults) => {
      if (checkErr) {
        return res.status(500).json({ error: 'Serverfehler' });
      }

      if (checkResults.length === 0) {
        return res.status(404).json({ error: 'Admin nicht gefunden' });
      }

      // Felder zum Aktualisieren sammeln
      const updates = [];
      const values = [];

      if (username) {
        updates.push('username = ?');
        values.push(username);
      }

      if (email) {
        updates.push('email = ?');
        values.push(email);
      }

      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updates.push('password = ?');
        values.push(hashedPassword);
      }

      if (vorname !== undefined) {
        updates.push('vorname = ?');
        values.push(vorname);
      }

      if (nachname !== undefined) {
        updates.push('nachname = ?');
        values.push(nachname);
      }

      if (rolle) {
        updates.push('rolle = ?');
        values.push(rolle);

        // Wenn keine custom Berechtigungen mitgegeben wurden, Standardberechtigungen für Rolle setzen
        if (!berechtigungen) {
          updates.push('berechtigungen = ?');
          values.push(JSON.stringify(getRollenBerechtigungen(rolle)));
        }
      }

      if (berechtigungen) {
        updates.push('berechtigungen = ?');
        values.push(JSON.stringify(berechtigungen));
      }

      if (aktiv !== undefined) {
        updates.push('aktiv = ?');
        values.push(aktiv);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'Keine Änderungen angegeben' });
      }

      values.push(id);
      const sql = `UPDATE admin_users SET ${updates.join(', ')} WHERE id = ?`;

      db.query(sql, values, (err, result) => {
        if (err) {
          logger.error('Fehler beim Aktualisieren:', err);
          return res.status(500).json({ error: 'Serverfehler beim Aktualisieren' });
        }

        logger.info('Admin ${id} erfolgreich aktualisiert');

        // Aktualisierten Admin zurückgeben
        const selectSql = `
          SELECT
            id, username, email, vorname, nachname, rolle,
            berechtigungen, aktiv, email_verifiziert,
            letzter_login, aktualisiert_am
          FROM admin_users
          WHERE id = ?
        `;

        db.query(selectSql, [id], (selectErr, selectResults) => {
          if (selectErr) {
            return res.json({ success: true });
          }

          const updatedAdmin = selectResults[0];
          try {
            updatedAdmin.berechtigungen = typeof updatedAdmin.berechtigungen === 'string'
              ? JSON.parse(updatedAdmin.berechtigungen)
              : updatedAdmin.berechtigungen;
          } catch (e) {
            // Ungültiges JSON in berechtigungen - behalte String
          }

          res.json(updatedAdmin);
        });
      });
    });

  } catch (error) {
    logger.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ===================================================================
// 🗑️ DELETE /api/admins/:id - Admin löschen
// ===================================================================
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  logger.debug('🔴 DELETE /api/admins/${id} aufgerufen');

  // Prüfen ob Admin existiert
  const checkSql = `SELECT username, rolle FROM admin_users WHERE id = ?`;

  db.query(checkSql, [id], (checkErr, checkResults) => {
    if (checkErr) {
      return res.status(500).json({ error: 'Serverfehler' });
    }

    if (checkResults.length === 0) {
      return res.status(404).json({ error: 'Admin nicht gefunden' });
    }

    const admin = checkResults[0];

    // Sicherheitscheck: Letzten Super-Admin nicht löschen
    if (admin.rolle === 'super_admin') {
      const countSql = `SELECT COUNT(*) as count FROM admin_users WHERE rolle = 'super_admin'`;

      db.query(countSql, (countErr, countResults) => {
        if (countErr || countResults[0].count <= 1) {
          return res.status(403).json({
            error: 'Der letzte Super-Admin kann nicht gelöscht werden'
          });
        }

        // Admin löschen
        performDelete();
      });
    } else {
      // Admin löschen
      performDelete();
    }

    function performDelete() {
      const sql = `DELETE FROM admin_users WHERE id = ?`;

      db.query(sql, [id], (err, result) => {
        if (err) {
          logger.error('Fehler beim Löschen:', err);
          return res.status(500).json({ error: 'Serverfehler beim Löschen' });
        }

        logger.info('Admin ${admin.username} erfolgreich gelöscht');
        res.json({
          success: true,
          message: `Admin ${admin.username} wurde gelöscht`
        });
      });
    }
  });
});

// ===================================================================
// 🔐 POST /api/admins/:id/password - Passwort ändern
// ===================================================================
router.post('/:id/password', async (req, res) => {
  const { id } = req.params;
  const { newPassword, currentPassword } = req.body;

  logger.debug('🟡 POST /api/admins/${id}/password aufgerufen');

  if (!newPassword) {
    return res.status(400).json({ error: 'Neues Passwort erforderlich' });
  }

  try {
    // Admin laden
    const selectSql = `SELECT password FROM admin_users WHERE id = ?`;

    db.query(selectSql, [id], async (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Serverfehler' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'Admin nicht gefunden' });
      }

      // Optional: Aktuelles Passwort prüfen
      if (currentPassword) {
        const isValid = await bcrypt.compare(currentPassword, results[0].password);
        if (!isValid) {
          return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' });
        }
      }

      // Neues Passwort hashen
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const updateSql = `UPDATE admin_users SET password = ? WHERE id = ?`;

      db.query(updateSql, [hashedPassword, id], (updateErr) => {
        if (updateErr) {
          logger.error('Fehler beim Aktualisieren des Passworts:', updateErr);
          return res.status(500).json({ error: 'Serverfehler' });
        }

        logger.info('Passwort für Admin ${id} erfolgreich geändert');
        res.json({ success: true, message: 'Passwort erfolgreich geändert' });
      });
    });

  } catch (error) {
    logger.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ===================================================================
// 📊 GET /api/admins/activity-log - Activity Log abrufen
// ===================================================================
router.get('/activity/log', (req, res) => {
  logger.debug('🔵 GET /api/admins/activity/log aufgerufen');

  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;

  const sql = `
    SELECT
      l.*,
      a.username,
      a.vorname,
      a.nachname
    FROM admin_activity_log l
    LEFT JOIN admin_users a ON l.admin_id = a.id
    ORDER BY l.erstellt_am DESC
    LIMIT ? OFFSET ?
  `;

  db.query(sql, [limit, offset], (err, results) => {
    if (err) {
      logger.error('Fehler beim Laden des Activity Logs:', err);
      return res.status(500).json({ error: 'Serverfehler' });
    }

    res.json(results);
  });
});

module.exports = router;
