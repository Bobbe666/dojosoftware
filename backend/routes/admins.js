// routes/admins.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

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
  logger.debug(' GET /api/admins aufgerufen');

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
      logger.error(' Fehler beim Laden der Admins:', err);
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
        logger.warn('Fehler beim Parsen der Berechtigungen für Admin:', admin.id);
        return admin;
      }
    });

    logger.info(` ${admins.length} Admins geladen`);
    res.json(admins);
  });
});

// ===================================================================
// 📋 GET /api/admins/:id - Einzelnen Admin abrufen
// ===================================================================
router.get('/:id', (req, res) => {
  const { id } = req.params;
  logger.debug(`GET /api/admins/${id}`);

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
      logger.error(' Fehler beim Laden des Admins:', err);
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

    logger.info(` Admin ${admin.username} geladen`);
    res.json(admin);
  });
});

// ===================================================================
// ✏️ POST /api/admins - Neuen Admin erstellen
// ===================================================================
router.post('/', async (req, res) => {
  logger.debug(' POST /api/admins aufgerufen');

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
        logger.error(' Fehler bei der Duplikat-Prüfung:', checkErr);
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
          logger.error(' Fehler beim Erstellen des Admins:', err);
          return res.status(500).json({ error: 'Serverfehler beim Erstellen' });
        }

        logger.info(` Admin ${username} erfolgreich erstellt (ID: ${result.insertId})`);

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
          } catch (e) {}

          res.status(201).json(newAdmin);
        });
      });
    });

  } catch (error) {
    logger.error(' Fehler beim Passwort-Hashing:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ===================================================================
// 🔄 PUT /api/admins/:id - Admin aktualisieren
// ===================================================================
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  logger.debug(`PUT /api/admins/${id}`);

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
          logger.error(' Fehler beim Aktualisieren:', err);
          return res.status(500).json({ error: 'Serverfehler beim Aktualisieren' });
        }

        logger.info(` Admin ${id} erfolgreich aktualisiert`);

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
          } catch (e) {}

          res.json(updatedAdmin);
        });
      });
    });

  } catch (error) {
    logger.error(' Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ===================================================================
// 🗑️ DELETE /api/admins/:id - Admin löschen
// ===================================================================
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  logger.debug(`DELETE /api/admins/${id}`);

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
          logger.error(' Fehler beim Löschen:', err);
          return res.status(500).json({ error: 'Serverfehler beim Löschen' });
        }

        logger.info(` Admin ${admin.username} erfolgreich gelöscht`);
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

  logger.debug(`POST /api/admins/${id}/password`);

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
          logger.error(' Fehler beim Aktualisieren des Passworts:', updateErr);
          return res.status(500).json({ error: 'Serverfehler' });
        }

        logger.info(` Passwort für Admin ${id} erfolgreich geändert`);
        res.json({ success: true, message: 'Passwort erfolgreich geändert' });
      });
    });

  } catch (error) {
    logger.error(' Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ===================================================================
// 📊 GET /api/admins/activity-log - Activity Log abrufen
// ===================================================================
router.get('/activity/log', (req, res) => {
  logger.debug(' GET /api/admins/activity/log aufgerufen');

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
      logger.error(' Fehler beim Laden des Activity Logs:', err);
      return res.status(500).json({ error: 'Serverfehler' });
    }

    res.json(results);
  });
});

// ===================================================================
// 🔐 PASSWORT-VERWALTUNG (Super Admin)
// ===================================================================

// GET alle Software-Benutzer (admin_users)
router.get('/password-management/software', async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT id, username, email, vorname, nachname, rolle, aktiv, erstellt_am,
             CASE WHEN password IS NOT NULL AND password != '' THEN 1 ELSE 0 END as has_password
      FROM admin_users
      ORDER BY username
    `);
    // Convert has_password to boolean
    const users = rows.map(u => ({ ...u, has_password: Boolean(Number(u.has_password)) }));
    res.json({ success: true, users });
  } catch (error) {
    console.error('Fehler beim Laden der Software-Benutzer:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Benutzer' });
  }
});

// GET alle Verbandsmitglieder
router.get('/password-management/verband', async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT id, benutzername, person_email as email,
             COALESCE(dojo_name, CONCAT(person_vorname, ' ', person_nachname)) as name,
             typ, status, created_at,
             passwort_hash IS NOT NULL as has_password
      FROM verbandsmitgliedschaften
      ORDER BY COALESCE(dojo_name, person_nachname)
    `);
    // Convert has_password to boolean
    const users = rows.map(u => ({ ...u, has_password: Boolean(Number(u.has_password)) }));
    res.json({ success: true, users });
  } catch (error) {
    console.error('Fehler beim Laden der Verbandsmitglieder:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Benutzer' });
  }
});

// GET alle Dojo-Benutzer (users)
router.get('/password-management/dojo', async (req, res) => {
  try {
    const userRole = req.user?.rolle || req.user?.role;
    const isSuperAdmin = userRole === 'super_admin' || (userRole === 'admin' && !req.user?.dojo_id);
    let dojoId = isSuperAdmin ? (req.query.dojo_id ? parseInt(req.query.dojo_id, 10) : null) : (req.user.dojo_id || null);
    const params = [];
    let dojoFilter = '';
    if (dojoId) {
      dojoFilter = 'WHERE m.dojo_id = ?';
      params.push(dojoId);
    }
    const [rows] = await db.promise().query(`
      SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_login_at,
             CASE WHEN u.password IS NOT NULL AND u.password != '' THEN 1 ELSE 0 END as has_password,
             m.vorname, m.nachname, m.geburtsdatum,
             d.dojoname as dojo_name
      FROM users u
      LEFT JOIN mitglieder m ON u.mitglied_id = m.mitglied_id
      LEFT JOIN dojo d ON m.dojo_id = d.id
      ${dojoFilter}
      ORDER BY u.username
    `, params);
    const users = rows.map(u => ({ ...u, has_password: Boolean(Number(u.has_password)) }));
    res.json({ success: true, users });
  } catch (error) {
    console.error('Fehler beim Laden der Dojo-Benutzer:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Benutzer' });
  }
});

// GET Mitglieder ohne Login-Account
router.get('/password-management/dojo-ohne-login', async (req, res) => {
  try {
    const userRole = req.user?.rolle || req.user?.role;
    const isSuperAdmin = userRole === 'super_admin' || (userRole === 'admin' && !req.user?.dojo_id);
    let dojoId = isSuperAdmin ? (req.query.dojo_id ? parseInt(req.query.dojo_id, 10) : null) : (req.user.dojo_id || null);
    const params = [];
    let dojoFilter = '';
    if (dojoId) {
      dojoFilter = 'AND m.dojo_id = ?';
      params.push(dojoId);
    }
    const [rows] = await db.promise().query(`
      SELECT m.mitglied_id, m.vorname, m.nachname, m.email, m.geburtsdatum,
             d.dojoname as dojo_name, d.id as dojo_id
      FROM mitglieder m
      LEFT JOIN dojo d ON m.dojo_id = d.id
      LEFT JOIN users u ON m.mitglied_id = u.mitglied_id
      WHERE u.id IS NULL
        AND m.aktiv = 1
        ${dojoFilter}
      ORDER BY d.dojoname, m.nachname, m.vorname
    `, params);
    res.json({ success: true, members: rows });
  } catch (error) {
    console.error('Fehler beim Laden der Mitglieder ohne Login:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Mitglieder' });
  }
});

// POST Alle fehlenden Accounts automatisch anlegen (Bulk)
router.post('/password-management/dojo/bulk-create', async (req, res) => {
  try {
    const userRole = req.user?.rolle || req.user?.role;
    const isSuperAdmin = userRole === 'super_admin' || (userRole === 'admin' && !req.user?.dojo_id);
    let dojoId = isSuperAdmin ? (req.body.dojo_id ? parseInt(req.body.dojo_id, 10) : null) : (req.user.dojo_id || null);
    const params = [];
    let dojoFilter = '';
    if (dojoId) {
      dojoFilter = 'AND m.dojo_id = ?';
      params.push(dojoId);
    }
    const [members] = await db.promise().query(`
      SELECT m.mitglied_id, m.vorname, m.nachname, m.email, m.geburtsdatum
      FROM mitglieder m
      LEFT JOIN users u ON m.mitglied_id = u.mitglied_id
      WHERE u.id IS NULL AND m.aktiv = 1 ${dojoFilter}
    `, params);

    if (members.length === 0) {
      return res.json({ success: true, created: 0, message: 'Alle Mitglieder haben bereits einen Account' });
    }

    const clean = s => (s || '').trim().toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/\s+/g, '');

    const formatPw = geb => {
      if (!geb) return null;
      const d = new Date(geb);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    let created = 0;
    const results = [];

    for (const m of members) {
      const baseUsername = clean(m.vorname) + '.' + clean(m.nachname);
      const password = formatPw(m.geburtsdatum);
      if (!password) continue;

      // Eindeutigen Benutzernamen finden
      let username = baseUsername;
      let counter = 1;
      while (true) {
        const [ex] = await db.promise().query('SELECT id FROM users WHERE username = ?', [username]);
        if (ex.length === 0) break;
        username = `${baseUsername}${counter}`;
        counter++;
      }

      const hash = await bcrypt.hash(password, 10);
      await db.promise().query(
        `INSERT IGNORE INTO users (username, email, password, mitglied_id, role, created_at) VALUES (?, ?, ?, ?, 'member', NOW())`,
        [username, m.email || null, hash, m.mitglied_id]
      );
      created++;
      results.push({ username, mitglied_id: m.mitglied_id });
    }

    res.json({ success: true, created, total: members.length, results });
  } catch (error) {
    console.error('Fehler beim Bulk-Erstellen:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Accounts' });
  }
});

// POST Passwort auf Standard (Geburtsdatum) zurücksetzen
router.post('/password-management/dojo/:id/reset-to-default', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.promise().query(
      'SELECT m.geburtsdatum, u.username FROM users u LEFT JOIN mitglieder m ON u.mitglied_id = m.mitglied_id WHERE u.id = ?',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Benutzer nicht gefunden' });

    const geb = rows[0].geburtsdatum;
    if (!geb) return res.status(400).json({ error: 'Kein Geburtsdatum hinterlegt' });

    const d = new Date(geb);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const defaultPassword = `${dd}/${mm}/${yyyy}`;

    const hash = await bcrypt.hash(defaultPassword, 10);
    await db.promise().query('UPDATE users SET password = ? WHERE id = ?', [hash, id]);

    res.json({ success: true, message: `Passwort auf ${defaultPassword} zurückgesetzt`, defaultPassword });
  } catch (error) {
    console.error('Fehler beim Standard-Reset:', error);
    res.status(500).json({ error: 'Fehler beim Zurücksetzen' });
  }
});

// POST Login-Account für Mitglied erstellen
router.post('/password-management/dojo/create', async (req, res) => {
  try {
    const { mitglied_id, password } = req.body;

    if (!mitglied_id) {
      return res.status(400).json({ error: 'Mitglied-ID erforderlich' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen haben' });
    }

    // Prüfe ob Mitglied existiert
    const [mitglied] = await db.promise().query(
      'SELECT mitglied_id, vorname, nachname, email, dojo_id FROM mitglieder WHERE mitglied_id = ?',
      [mitglied_id]
    );

    if (mitglied.length === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    // Prüfe ob bereits ein Account existiert
    const [existing] = await db.promise().query(
      'SELECT id FROM users WHERE mitglied_id = ?',
      [mitglied_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Mitglied hat bereits einen Login-Account' });
    }

    const member = mitglied[0];

    // Generiere Username aus Vorname.Nachname
    let baseUsername = `${member.vorname.toLowerCase()}.${member.nachname.toLowerCase()}`
      .replace(/[äÄ]/g, 'ae')
      .replace(/[öÖ]/g, 'oe')
      .replace(/[üÜ]/g, 'ue')
      .replace(/[ß]/g, 'ss')
      .replace(/[^a-z0-9.]/g, '');

    // Prüfe ob Username bereits existiert
    let username = baseUsername;
    let counter = 1;
    while (true) {
      const [existingUser] = await db.promise().query(
        'SELECT id FROM users WHERE username = ?',
        [username]
      );
      if (existingUser.length === 0) break;
      username = `${baseUsername}${counter}`;
      counter++;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Erstelle den Account
    const [result] = await db.promise().query(
      `INSERT INTO users (username, email, password, mitglied_id, role, created_at)
       VALUES (?, ?, ?, ?, 'member', NOW())`,
      [username, member.email || '', hashedPassword, mitglied_id]
    );

    res.json({
      success: true,
      message: 'Login-Account erfolgreich erstellt',
      username: username,
      user_id: result.insertId
    });
  } catch (error) {
    console.error('Fehler beim Erstellen des Login-Accounts:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Accounts: ' + error.message });
  }
});

// POST Passwort zurücksetzen - Software
router.post('/password-management/software/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen haben' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.promise().query('UPDATE admin_users SET password = ? WHERE id = ?', [hashedPassword, id]);

    res.json({ success: true, message: 'Passwort erfolgreich zurückgesetzt' });
  } catch (error) {
    console.error('Fehler beim Zurücksetzen des Passworts:', error);
    res.status(500).json({ error: 'Fehler beim Zurücksetzen des Passworts' });
  }
});

// POST Passwort zurücksetzen - Verband
router.post('/password-management/verband/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen haben' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await db.promise().query('UPDATE verbandsmitgliedschaften SET passwort_hash = ? WHERE id = ?', [hashedPassword, id]);

    res.json({ success: true, message: 'Passwort erfolgreich zurückgesetzt' });
  } catch (error) {
    console.error('Fehler beim Zurücksetzen des Passworts:', error);
    res.status(500).json({ error: 'Fehler beim Zurücksetzen des Passworts' });
  }
});

// POST Passwort zurücksetzen - Dojo
router.post('/password-management/dojo/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen haben' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.promise().query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);

    res.json({ success: true, message: 'Passwort erfolgreich zurückgesetzt' });
  } catch (error) {
    console.error('Fehler beim Zurücksetzen des Passworts:', error);
    res.status(500).json({ error: 'Fehler beim Zurücksetzen des Passworts' });
  }
});

module.exports = router;
