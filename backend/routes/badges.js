/**
 * BADGES & MANUELLE TRAININGSSTUNDEN ROUTES
 * ==========================================
 * Verwaltet Badges/Auszeichnungen und manuelle Trainingsstunden-Anpassungen
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendBadgeEmail } = require('../services/emailService');

// Debug: Log alle Badges-Requests
router.use((req, res, next) => {
  console.log('🏅 Badges Route:', req.method, req.path, { user: req.user?.id, role: req.user?.role });
  next();
});

// ============================================================================
// MANUELLE TRAININGSSTUNDEN
// ============================================================================

/**
 * GET /api/badges/training/:mitglied_id
 * Alle manuellen Trainingsstunden eines Mitglieds
 */
router.get('/training/:mitglied_id', (req, res) => {
  const { mitglied_id } = req.params;

  const query = `
    SELECT mt.*, s.name as stil_name
    FROM manuelle_trainingsstunden mt
    LEFT JOIN stile s ON mt.stil_id = s.stil_id
    WHERE mt.mitglied_id = ?
    ORDER BY mt.datum DESC
  `;

  db.query(query, [mitglied_id], (err, results) => {
    if (err) {
      console.error('Fehler beim Laden der manuellen Trainingsstunden:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
    res.json(results);
  });
});

/**
 * POST /api/badges/training/:mitglied_id
 * Manuelle Trainingsstunden hinzufuegen
 */
router.post('/training/:mitglied_id', (req, res) => {
  const { mitglied_id } = req.params;
  const { stunden, datum, grund, stil_id, erstellt_von_id, erstellt_von_name } = req.body;

  if (!stunden || !datum || !grund) {
    return res.status(400).json({ error: 'Stunden, Datum und Grund sind erforderlich' });
  }

  const query = `
    INSERT INTO manuelle_trainingsstunden
    (mitglied_id, stunden, datum, grund, stil_id, erstellt_von_id, erstellt_von_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(query, [mitglied_id, stunden, datum, grund, stil_id || null, erstellt_von_id || null, erstellt_von_name || null], (err, result) => {
    if (err) {
      console.error('Fehler beim Hinzufuegen der manuellen Trainingsstunden:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    // Pruefe auf automatische Badge-Vergabe
    checkAndAwardBadges(mitglied_id, 'training');

    res.status(201).json({
      success: true,
      id: result.insertId,
      message: 'Trainingsstunden erfolgreich hinzugefuegt'
    });
  });
});

/**
 * DELETE /api/badges/training/:id
 * Manuelle Trainingsstunden loeschen
 */
router.delete('/training/:id', (req, res) => {
  const { id } = req.params;

  db.query('DELETE FROM manuelle_trainingsstunden WHERE id = ?', [id], (err, result) => {
    if (err) {
      console.error('Fehler beim Loeschen der manuellen Trainingsstunden:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Eintrag nicht gefunden' });
    }

    res.json({ success: true, message: 'Eintrag geloescht' });
  });
});

// ============================================================================
// BADGES
// ============================================================================

/**
 * GET /api/badges
 * Alle verfuegbaren Badges
 */
router.get('/', (req, res) => {
  const { include_inactive } = req.query;
  const query = `
    SELECT * FROM badges
    ${include_inactive !== 'true' ? 'WHERE aktiv = TRUE' : ''}
    ORDER BY kategorie, COALESCE(kriterium_wert, 9999), name
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Fehler beim Laden der Badges:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
    res.json(results);
  });
});

/**
 * POST /api/badges
 * Neuen Badge erstellen
 */
router.post('/', (req, res) => {
  const { name, beschreibung, icon, farbe, kategorie, kriterium_typ, kriterium_wert, aktiv } = req.body;

  if (!name || !icon || !farbe || !kategorie) {
    return res.status(400).json({ error: 'Name, Icon, Farbe und Kategorie sind erforderlich' });
  }

  const query = `
    INSERT INTO badges (name, beschreibung, icon, farbe, kategorie, kriterium_typ, kriterium_wert, aktiv)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(query, [
    name,
    beschreibung || null,
    icon,
    farbe,
    kategorie,
    kriterium_typ || null,
    kriterium_wert || null,
    aktiv !== false ? 1 : 0
  ], (err, result) => {
    if (err) {
      console.error('Fehler beim Erstellen des Badges:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
    res.status(201).json({
      success: true,
      badge_id: result.insertId,
      message: 'Badge erfolgreich erstellt'
    });
  });
});

/**
 * PUT /api/badges/:badge_id
 * Badge bearbeiten
 */
router.put('/:badge_id', (req, res) => {
  const { badge_id } = req.params;
  const { name, beschreibung, icon, farbe, kategorie, kriterium_typ, kriterium_wert, aktiv } = req.body;

  if (!name || !icon || !farbe || !kategorie) {
    return res.status(400).json({ error: 'Name, Icon, Farbe und Kategorie sind erforderlich' });
  }

  const query = `
    UPDATE badges SET
      name = ?,
      beschreibung = ?,
      icon = ?,
      farbe = ?,
      kategorie = ?,
      kriterium_typ = ?,
      kriterium_wert = ?,
      aktiv = ?
    WHERE badge_id = ?
  `;

  db.query(query, [
    name,
    beschreibung || null,
    icon,
    farbe,
    kategorie,
    kriterium_typ || null,
    kriterium_wert || null,
    aktiv !== false ? 1 : 0,
    badge_id
  ], (err, result) => {
    if (err) {
      console.error('Fehler beim Aktualisieren des Badges:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Badge nicht gefunden' });
    }

    res.json({ success: true, message: 'Badge erfolgreich aktualisiert' });
  });
});

/**
 * DELETE /api/badges/:badge_id
 * Badge loeschen (oder deaktivieren)
 */
router.delete('/:badge_id', (req, res) => {
  const { badge_id } = req.params;
  const { permanent } = req.query;

  if (permanent === 'true') {
    // Permanentes Loeschen (vorsicht: loescht auch alle Zuweisungen)
    db.query('DELETE FROM mitglieder_badges WHERE badge_id = ?', [badge_id], (err) => {
      if (err) {
        console.error('Fehler beim Loeschen der Badge-Zuweisungen:', err);
        return res.status(500).json({ error: 'Datenbankfehler' });
      }

      db.query('DELETE FROM badges WHERE badge_id = ?', [badge_id], (err2, result) => {
        if (err2) {
          console.error('Fehler beim Loeschen des Badges:', err2);
          return res.status(500).json({ error: 'Datenbankfehler' });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Badge nicht gefunden' });
        }

        res.json({ success: true, message: 'Badge permanent geloescht' });
      });
    });
  } else {
    // Soft-Delete: nur deaktivieren
    db.query('UPDATE badges SET aktiv = FALSE WHERE badge_id = ?', [badge_id], (err, result) => {
      if (err) {
        console.error('Fehler beim Deaktivieren des Badges:', err);
        return res.status(500).json({ error: 'Datenbankfehler' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Badge nicht gefunden' });
      }

      res.json({ success: true, message: 'Badge deaktiviert' });
    });
  }
});

/**
 * GET /api/badges/mitglied/:mitglied_id
 * Badges eines Mitglieds
 */
router.get('/mitglied/:mitglied_id', (req, res) => {
  const { mitglied_id } = req.params;

  const query = `
    SELECT mb.*, b.name, b.beschreibung, b.icon, b.farbe, b.kategorie
    FROM mitglieder_badges mb
    JOIN badges b ON mb.badge_id = b.badge_id
    WHERE mb.mitglied_id = ?
    ORDER BY mb.verliehen_am DESC
  `;

  db.query(query, [mitglied_id], (err, results) => {
    if (err) {
      console.error('Fehler beim Laden der Mitglieder-Badges:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
    res.json(results);
  });
});

/**
 * POST /api/badges/mitglied/:mitglied_id/:badge_id
 * Badge an Mitglied verleihen
 */
router.post('/mitglied/:mitglied_id/:badge_id', (req, res) => {
  const { mitglied_id, badge_id } = req.params;
  const { verliehen_von_id, verliehen_von_name, kommentar, send_email } = req.body;

  const query = `
    INSERT INTO mitglieder_badges
    (mitglied_id, badge_id, verliehen_von_id, verliehen_von_name, kommentar)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      kommentar = VALUES(kommentar),
      verliehen_von_name = VALUES(verliehen_von_name)
  `;

  db.query(query, [mitglied_id, badge_id, verliehen_von_id || null, verliehen_von_name || null, kommentar || null], async (err, result) => {
    if (err) {
      console.error('Fehler beim Verleihen des Badges:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    // E-Mail-Benachrichtigung senden wenn gewuenscht
    if (send_email !== false) {
      try {
        await sendBadgeNotification(mitglied_id, badge_id);
      } catch (emailErr) {
        console.error('Fehler beim Senden der Badge-Benachrichtigung:', emailErr);
        // Fehler beim E-Mail-Versand soll den Badge-Vorgang nicht abbrechen
      }
    }

    res.status(201).json({
      success: true,
      message: 'Badge erfolgreich verliehen'
    });
  });
});

/**
 * DELETE /api/badges/mitglied/:mitglied_id/:badge_id
 * Badge von Mitglied entfernen
 */
router.delete('/mitglied/:mitglied_id/:badge_id', (req, res) => {
  const { mitglied_id, badge_id } = req.params;

  db.query(
    'DELETE FROM mitglieder_badges WHERE mitglied_id = ? AND badge_id = ?',
    [mitglied_id, badge_id],
    (err, result) => {
      if (err) {
        console.error('Fehler beim Entfernen des Badges:', err);
        return res.status(500).json({ error: 'Datenbankfehler' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Badge-Zuweisung nicht gefunden' });
      }

      res.json({ success: true, message: 'Badge entfernt' });
    }
  );
});

// ============================================================================
// ADMIN UEBERSICHT
// ============================================================================

/**
 * GET /api/badges/admin/overview
 * Uebersicht fuer Admins: Wer verdient welche Badges?
 */
router.get('/admin/overview', (req, res) => {
  console.log('📊 Badge Admin Overview aufgerufen', { user: req.user, query: req.query });
  const { dojo_id } = req.query;

  // Hole alle Mitglieder mit ihren Statistiken
  let memberQuery = `
    SELECT
      m.mitglied_id,
      m.vorname,
      m.nachname,
      m.email,
      COALESCE(anw.trainings_count, 0) + COALESCE(mt.manual_count, 0) as total_trainings,
      COALESCE(pruef.pruefungen_bestanden, 0) as pruefungen_bestanden,
      COALESCE(skills.gemeisterte_skills, 0) as gemeisterte_skills,
      (SELECT COUNT(*) FROM mitglieder_badges WHERE mitglied_id = m.mitglied_id) as badge_count
    FROM mitglieder m
    LEFT JOIN (
      SELECT mitglied_id, COUNT(*) as trainings_count
      FROM anwesenheit
      WHERE anwesend = 1
      GROUP BY mitglied_id
    ) anw ON m.mitglied_id = anw.mitglied_id
    LEFT JOIN (
      SELECT mitglied_id, SUM(stunden) as manual_count
      FROM manuelle_trainingsstunden
      GROUP BY mitglied_id
    ) mt ON m.mitglied_id = mt.mitglied_id
    LEFT JOIN (
      SELECT mitglied_id, COUNT(*) as pruefungen_bestanden
      FROM pruefungen
      WHERE bestanden = 1
      GROUP BY mitglied_id
    ) pruef ON m.mitglied_id = pruef.mitglied_id
    LEFT JOIN (
      SELECT mitglied_id, COUNT(*) as gemeisterte_skills
      FROM mitglieder_fortschritt
      WHERE status = 'gemeistert'
      GROUP BY mitglied_id
    ) skills ON m.mitglied_id = skills.mitglied_id
    WHERE m.aktiv = 1
  `;

  if (dojo_id) {
    memberQuery += ` AND m.dojo_id = ${parseInt(dojo_id)}`;
  }

  memberQuery += ` ORDER BY total_trainings DESC`;

  db.query(memberQuery, (err, members) => {
    if (err) {
      console.error('Fehler beim Laden der Uebersicht:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    // Hole alle Badges und deren Kriterien
    db.query('SELECT * FROM badges WHERE aktiv = TRUE ORDER BY kategorie, kriterium_wert', (err2, badges) => {
      if (err2) {
        console.error('Fehler beim Laden der Badges:', err2);
        return res.status(500).json({ error: 'Datenbankfehler' });
      }

      // Hole alle verliehenen Badges
      db.query('SELECT mitglied_id, badge_id FROM mitglieder_badges', (err3, awarded) => {
        if (err3) {
          console.error('Fehler beim Laden der verliehenen Badges:', err3);
          return res.status(500).json({ error: 'Datenbankfehler' });
        }

        // Erstelle Set der verliehenen Badges
        const awardedSet = new Set(awarded.map(a => `${a.mitglied_id}_${a.badge_id}`));

        // Pruefe fuer jedes Mitglied, welche Badges es verdient hat aber noch nicht bekommen hat
        const pendingAwards = [];

        members.forEach(member => {
          badges.forEach(badge => {
            const key = `${member.mitglied_id}_${badge.badge_id}`;

            // Ueberspringen wenn bereits verliehen
            if (awardedSet.has(key)) return;

            // Pruefe Kriterien
            let deserves = false;

            switch (badge.kriterium_typ) {
              case 'trainings_anzahl':
                deserves = member.total_trainings >= badge.kriterium_wert;
                break;
              case 'pruefung_bestanden':
                deserves = member.pruefungen_bestanden >= badge.kriterium_wert;
                break;
              case 'skill_gemeistert':
                deserves = member.gemeisterte_skills >= badge.kriterium_wert;
                break;
              // streak und manuell werden manuell vergeben
            }

            if (deserves) {
              pendingAwards.push({
                mitglied_id: member.mitglied_id,
                vorname: member.vorname,
                nachname: member.nachname,
                badge_id: badge.badge_id,
                badge_name: badge.name,
                badge_icon: badge.icon,
                badge_farbe: badge.farbe,
                badge_kategorie: badge.kategorie,
                kriterium: `${badge.kriterium_wert} ${badge.kriterium_typ.replace('_', ' ')}`,
                aktueller_wert: badge.kriterium_typ === 'trainings_anzahl' ? member.total_trainings :
                               badge.kriterium_typ === 'pruefung_bestanden' ? member.pruefungen_bestanden :
                               member.gemeisterte_skills
              });
            }
          });
        });

        res.json({
          members,
          badges,
          pendingAwards,
          summary: {
            total_members: members.length,
            pending_awards: pendingAwards.length
          }
        });
      });
    });
  });
});

/**
 * POST /api/badges/admin/award-pending
 * Alle ausstehenden Badges auf einmal verleihen
 */
router.post('/admin/award-pending', async (req, res) => {
  const { awards, verliehen_von_id, verliehen_von_name, send_emails } = req.body;

  if (!awards || !Array.isArray(awards) || awards.length === 0) {
    return res.status(400).json({ error: 'Keine Badges zum Verleihen angegeben' });
  }

  const values = awards.map(a => [
    a.mitglied_id,
    a.badge_id,
    verliehen_von_id || null,
    verliehen_von_name || null,
    'Automatisch verliehen'
  ]);

  const query = `
    INSERT INTO mitglieder_badges
    (mitglied_id, badge_id, verliehen_von_id, verliehen_von_name, kommentar)
    VALUES ?
    ON DUPLICATE KEY UPDATE badge_id = badge_id
  `;

  db.query(query, [values], async (err, result) => {
    if (err) {
      console.error('Fehler beim Verleihen der Badges:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    // E-Mail-Benachrichtigungen senden wenn gewuenscht
    let emailsSent = 0;
    if (send_emails !== false) {
      for (const award of awards) {
        try {
          await sendBadgeNotification(award.mitglied_id, award.badge_id);
          emailsSent++;
        } catch (emailErr) {
          console.error('Fehler beim Senden der Badge-Benachrichtigung:', emailErr);
        }
      }
    }

    res.json({
      success: true,
      message: `${result.affectedRows} Badges verliehen${send_emails !== false ? `, ${emailsSent} E-Mails gesendet` : ''}`,
      affectedRows: result.affectedRows,
      emailsSent
    });
  });
});

/**
 * POST /api/badges/admin/send-notifications
 * E-Mail-Benachrichtigungen fuer nicht benachrichtigte Badges senden
 */
router.post('/admin/send-notifications', async (req, res) => {
  // Finde alle Badges die noch nicht benachrichtigt wurden
  const query = `
    SELECT mb.mitglied_id, mb.badge_id
    FROM mitglieder_badges mb
    JOIN mitglieder m ON mb.mitglied_id = m.mitglied_id
    WHERE mb.benachrichtigt = FALSE
    AND m.email IS NOT NULL
    AND m.email != ''
    ORDER BY mb.verliehen_am DESC
    LIMIT 100
  `;

  db.query(query, async (err, results) => {
    if (err) {
      console.error('Fehler beim Laden der nicht benachrichtigten Badges:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    let emailsSent = 0;
    let errors = 0;

    for (const badge of results) {
      try {
        const result = await sendBadgeNotification(badge.mitglied_id, badge.badge_id);
        if (result.success) emailsSent++;
      } catch (emailErr) {
        console.error('Fehler beim Senden der Badge-Benachrichtigung:', emailErr);
        errors++;
      }
    }

    res.json({
      success: true,
      message: `${emailsSent} E-Mails gesendet, ${errors} Fehler`,
      total: results.length,
      emailsSent,
      errors
    });
  });
});

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

/**
 * Sendet eine E-Mail-Benachrichtigung wenn ein Badge verliehen wurde
 */
async function sendBadgeNotification(mitglied_id, badge_id) {
  return new Promise((resolve, reject) => {
    // Hole Mitglieds- und Badge-Daten
    const query = `
      SELECT
        m.vorname, m.nachname, m.email,
        b.name as badge_name, b.beschreibung as badge_beschreibung,
        b.icon as badge_icon, b.farbe as badge_farbe,
        d.name as dojo_name
      FROM mitglieder m
      JOIN badges b ON b.badge_id = ?
      LEFT JOIN dojos d ON m.dojo_id = d.dojo_id
      WHERE m.mitglied_id = ?
    `;

    db.query(query, [badge_id, mitglied_id], async (err, results) => {
      if (err) {
        console.error('Fehler beim Laden der Badge-Benachrichtigungsdaten:', err);
        return reject(err);
      }

      if (!results || results.length === 0 || !results[0].email) {
        console.log('Keine E-Mail-Adresse fuer Badge-Benachrichtigung gefunden');
        return resolve({ success: false, reason: 'Keine E-Mail-Adresse' });
      }

      const data = results[0];

      try {
        const result = await sendBadgeEmail({
          email: data.email,
          vorname: data.vorname,
          nachname: data.nachname,
          badgeName: data.badge_name,
          badgeBeschreibung: data.badge_beschreibung,
          badgeIcon: data.badge_icon,
          badgeFarbe: data.badge_farbe,
          dojoname: data.dojo_name
        });

        // Markiere Badge als benachrichtigt
        if (result.success) {
          db.query(
            'UPDATE mitglieder_badges SET benachrichtigt = TRUE WHERE mitglied_id = ? AND badge_id = ?',
            [mitglied_id, badge_id]
          );
        }

        resolve(result);
      } catch (emailErr) {
        console.error('Fehler beim Senden der Badge-E-Mail:', emailErr);
        reject(emailErr);
      }
    });
  });
}

/**
 * Prueft und vergibt automatisch verdiente Badges
 */
function checkAndAwardBadges(mitglied_id, trigger_type) {
  // Diese Funktion wird aufgerufen wenn sich relevante Daten aendern
  // Sie prueft ob das Mitglied neue Badges verdient hat

  const statsQuery = `
    SELECT
      COALESCE(anw.trainings_count, 0) + COALESCE(mt.manual_count, 0) as total_trainings,
      COALESCE(pruef.pruefungen_bestanden, 0) as pruefungen_bestanden,
      COALESCE(skills.gemeisterte_skills, 0) as gemeisterte_skills
    FROM mitglieder m
    LEFT JOIN (
      SELECT mitglied_id, COUNT(*) as trainings_count
      FROM anwesenheit WHERE anwesend = 1 AND mitglied_id = ?
      GROUP BY mitglied_id
    ) anw ON m.mitglied_id = anw.mitglied_id
    LEFT JOIN (
      SELECT mitglied_id, SUM(stunden) as manual_count
      FROM manuelle_trainingsstunden WHERE mitglied_id = ?
      GROUP BY mitglied_id
    ) mt ON m.mitglied_id = mt.mitglied_id
    LEFT JOIN (
      SELECT mitglied_id, COUNT(*) as pruefungen_bestanden
      FROM pruefungen WHERE bestanden = 1 AND mitglied_id = ?
      GROUP BY mitglied_id
    ) pruef ON m.mitglied_id = pruef.mitglied_id
    LEFT JOIN (
      SELECT mitglied_id, COUNT(*) as gemeisterte_skills
      FROM mitglieder_fortschritt WHERE status = 'gemeistert' AND mitglied_id = ?
      GROUP BY mitglied_id
    ) skills ON m.mitglied_id = skills.mitglied_id
    WHERE m.mitglied_id = ?
  `;

  db.query(statsQuery, [mitglied_id, mitglied_id, mitglied_id, mitglied_id, mitglied_id], (err, stats) => {
    if (err || !stats[0]) return;

    const memberStats = stats[0];

    // Hole Badges die automatisch vergeben werden koennen
    db.query(
      "SELECT * FROM badges WHERE aktiv = TRUE AND kriterium_typ IN ('trainings_anzahl', 'pruefung_bestanden', 'skill_gemeistert')",
      (err2, badges) => {
        if (err2) return;

        badges.forEach(badge => {
          let deserves = false;

          switch (badge.kriterium_typ) {
            case 'trainings_anzahl':
              deserves = memberStats.total_trainings >= badge.kriterium_wert;
              break;
            case 'pruefung_bestanden':
              deserves = memberStats.pruefungen_bestanden >= badge.kriterium_wert;
              break;
            case 'skill_gemeistert':
              deserves = memberStats.gemeisterte_skills >= badge.kriterium_wert;
              break;
          }

          if (deserves) {
            // Badge verleihen (falls noch nicht vorhanden)
            db.query(
              `INSERT IGNORE INTO mitglieder_badges (mitglied_id, badge_id, kommentar) VALUES (?, ?, 'Automatisch verliehen')`,
              [mitglied_id, badge.badge_id],
              (insertErr, insertResult) => {
                // Sende E-Mail-Benachrichtigung nur wenn Badge neu verliehen wurde
                if (!insertErr && insertResult.affectedRows > 0) {
                  sendBadgeNotification(mitglied_id, badge.badge_id).catch(err => {
                    console.error('Fehler beim Senden der automatischen Badge-Benachrichtigung:', err);
                  });
                }
              }
            );
          }
        });
      }
    );
  });
}

module.exports = router;
