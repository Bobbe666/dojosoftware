const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');

// Promise-wrapper für db.query
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
};

// Middleware für Authentifizierung
const authenticateMember = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Kein Token vorhanden' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Ungültiger Token' });
  }
};

// GET /api/member/profile - Profildaten abrufen
router.get('/profile', authenticateMember, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const memberData = await queryAsync(`
      SELECT 
        m.*,
        u.username,
        u.email,
        u.role
      FROM mitglieder m
      LEFT JOIN users u ON m.user_id = u.id
      WHERE m.user_id = ?
    `, [userId]);

    if (memberData.length === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    const member = memberData[0];
    
    // Sichere Daten zurückgeben (ohne sensible Informationen)
    const profileData = {
      id: member.id,
      username: member.username,
      email: member.email,
      vorname: member.vorname,
      nachname: member.nachname,
      telefon: member.telefon,
      geburtsdatum: member.geburtsdatum,
      adresse: member.adresse,
      plz: member.plz,
      ort: member.ort,
      bundesland: member.bundesland,
      notfallkontakt: member.notfallkontakt,
      notfalltelefon: member.notfalltelefon,
      allergien: member.allergien,
      medikamente: member.medikamente,
      bemerkungen: member.bemerkungen,
      created_at: member.created_at,
      updated_at: member.updated_at
    };

    res.json(profileData);
  } catch (error) {
    console.error('Fehler beim Laden der Profildaten:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Profildaten' });
  }
});

// PUT /api/member/profile - Profildaten aktualisieren
router.put('/profile', authenticateMember, async (req, res) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;

    // Erlaubte Felder für die Aktualisierung
    const allowedFields = [
      'vorname', 'nachname', 'telefon', 'geburtsdatum',
      'adresse', 'plz', 'ort', 'bundesland',
      'notfallkontakt', 'notfalltelefon', 'allergien',
      'medikamente', 'bemerkungen'
    ];

    // Filtere nur erlaubte Felder
    const filteredData = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredData[key] = updateData[key];
      }
    });

    if (Object.keys(filteredData).length === 0) {
      return res.status(400).json({ error: 'Keine gültigen Felder zum Aktualisieren' });
    }

    // Aktualisiere Mitgliederdaten
    const setClause = Object.keys(filteredData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(filteredData), userId];

    await queryAsync(`
      UPDATE mitglieder 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `, values);

    // Aktualisiere auch User-Daten falls vorhanden
    if (updateData.email) {
      await queryAsync(`
        UPDATE users 
        SET email = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [updateData.email, userId]);
    }

    res.json({ message: 'Profil erfolgreich aktualisiert', updatedFields: Object.keys(filteredData) });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Profildaten:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Profildaten' });
  }
});

// PUT /api/member/password - Passwort ändern
router.put('/password', authenticateMember, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Aktuelles und neues Passwort sind erforderlich' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Neues Passwort muss mindestens 6 Zeichen lang sein' });
    }

    // Hole aktuelles Passwort-Hash
    const userData = await queryAsync('SELECT password FROM users WHERE id = ?', [userId]);
    
    if (userData.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    // Prüfe aktuelles Passwort
    const bcrypt = require('bcrypt');
    const isValidPassword = await bcrypt.compare(currentPassword, userData[0].password);
    
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Aktuelles Passwort ist falsch' });
    }

    // Hash neues Passwort
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Aktualisiere Passwort
    await queryAsync(`
      UPDATE users 
      SET password = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [hashedPassword, userId]);

    res.json({ message: 'Passwort erfolgreich geändert' });
  } catch (error) {
    console.error('Fehler beim Ändern des Passworts:', error);
    res.status(500).json({ error: 'Fehler beim Ändern des Passworts' });
  }
});

// GET /api/member/schedule - Termine abrufen
router.get('/schedule', authenticateMember, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Hole Mitglieder-ID
    const memberData = await queryAsync('SELECT mitglied_id FROM mitglieder WHERE user_id = ?', [userId]);
    
    if (memberData.length === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    const memberId = memberData[0].mitglied_id;

    // Hole Termine (Kurse, Prüfungen, etc.)
    const schedule = await queryAsync(`
      SELECT 
        'training' as typ,
        k.name as title,
        t.vorname || ' ' || t.nachname as trainer,
        k.zeit_start as zeit_start,
        k.zeit_ende as zeit_ende,
        k.datum,
        k.raum,
        'bestätigt' as status
      FROM kurse k
      LEFT JOIN trainer t ON k.trainer_id = t.id
      LEFT JOIN kurse_mitglieder km ON k.id = km.kurs_id
      WHERE km.mitglied_id = ?
      
      UNION ALL
      
      SELECT 
        'prüfung' as typ,
        CONCAT('Gürtelprüfung - ', s.name) as title,
        t.vorname || ' ' || t.nachname as trainer,
        p.zeit_start as zeit_start,
        p.zeit_ende as zeit_ende,
        p.datum,
        p.raum,
        CASE 
          WHEN p.status = 'geplant' THEN 'angemeldet'
          WHEN p.status = 'abgeschlossen' THEN 'bestanden'
          ELSE p.status
        END as status
      FROM pruefungen p
      LEFT JOIN stile s ON p.stil_id = s.id
      LEFT JOIN trainer t ON p.trainer_id = t.id
      LEFT JOIN pruefungen_mitglieder pm ON p.id = pm.pruefung_id
      WHERE pm.mitglied_id = ?
      
      ORDER BY datum ASC, zeit_start ASC
    `, [memberId, memberId]);

    res.json(schedule);
  } catch (error) {
    console.error('Fehler beim Laden des Stundenplans:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Stundenplans' });
  }
});

// GET /api/member/payments - Zahlungen abrufen
router.get('/payments', authenticateMember, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Hole Mitglieder-ID
    const memberData = await queryAsync('SELECT mitglied_id FROM mitglieder WHERE user_id = ?', [userId]);
    
    if (memberData.length === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    const memberId = memberData[0].mitglied_id;

    // Hole Zahlungsdaten
    const payments = await queryAsync(`
      SELECT 
        b.id,
        b.betrag,
        b.faelligkeitsdatum,
        b.zahlungsdatum,
        CASE 
          WHEN b.zahlungsdatum IS NOT NULL THEN 'bezahlt'
          WHEN b.faelligkeitsdatum < CURDATE() THEN 'überfällig'
          ELSE 'offen'
        END as status,
        b.typ,
        b.beschreibung,
        b.created_at
      FROM beitraege b
      WHERE b.mitglied_id = ?
      ORDER BY b.faelligkeitsdatum DESC
    `, [memberId]);

    res.json(payments);
  } catch (error) {
    console.error('Fehler beim Laden der Zahlungen:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Zahlungen' });
  }
});

// GET /api/member/stats - Statistiken abrufen
router.get('/stats', authenticateMember, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Hole Mitglieder-ID
    const memberData = await queryAsync('SELECT mitglied_id FROM mitglieder WHERE user_id = ?', [userId]);
    
    if (memberData.length === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    const memberId = memberData[0].mitglied_id;

    // Berechne Statistiken
    const stats = await queryAsync(`
      SELECT 
        (SELECT COUNT(*) * 1.5 FROM anwesenheit WHERE mitglied_id = ?) as trainingsstunden,
        (SELECT ROUND((COUNT(*) * 100.0 / 30), 1) FROM anwesenheit WHERE mitglied_id = ? AND datum >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as anwesenheit,
        (SELECT COUNT(*) FROM anwesenheit WHERE mitglied_id = ? AND datum >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as aktuelle_woche,
        (SELECT MAX(graduierung) FROM mitglieder WHERE id = ?) as aktueller_gürtel,
        (SELECT COUNT(*) FROM pruefungen_mitglieder WHERE mitglied_id = ? AND status = 'bestanden') as bestandene_prüfungen
    `, [memberId, memberId, memberId, memberId, memberId]);

    // Hole Prüfungsverlauf
    const pruefungen = await queryAsync(`
      SELECT 
        p.datum,
        s.name as gürtel,
        p.status
      FROM pruefungen p
      LEFT JOIN stile s ON p.stil_id = s.id
      LEFT JOIN pruefungen_mitglieder pm ON p.id = pm.pruefung_id
      WHERE pm.mitglied_id = ?
      ORDER BY p.datum DESC
    `, [memberId]);

    // Hole monatliche Trainingsdaten
    const monatsDaten = await queryAsync(`
      SELECT 
        DATE_FORMAT(datum, '%b %Y') as monat,
        COUNT(*) * 1.5 as stunden
      FROM anwesenheit 
      WHERE mitglied_id = ? 
        AND datum >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(datum, '%Y-%m')
      ORDER BY DATE_FORMAT(datum, '%Y-%m') DESC
      LIMIT 6
    `, [memberId]);

    const result = {
      ...stats[0],
      prüfungen,
      monatsDaten
    };

    res.json(result);
  } catch (error) {
    console.error('Fehler beim Laden der Statistiken:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Statistiken' });
  }
});

module.exports = router;
