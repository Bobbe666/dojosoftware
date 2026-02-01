// Backend/routes/checkin.js - Fixed: Nur aktive Check-ins anzeigen + Re-Check-in möglich + Tresen-Route
const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const QRCode = require('qrcode');

// ============================================
// HELPER FUNCTIONS
// ============================================

// Promise-Wrapper für db.query
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

// Generate QR Code data
const generateQRData = (memberId) => {
  const timestamp = Date.now().toString(36);
  return `DOJO_MEMBER:${memberId}:${timestamp}`;
};

// ============================================
// HELPER FUNCTION: Multi-Course Check-in Logic (extracted)
// ============================================

const performMultiCourseCheckin = async (mitglied_id, stundenplan_ids, checkin_method) => {

  // 1. Verify member exists
  const members = await queryAsync(
    'SELECT mitglied_id, vorname, nachname, aktiv FROM mitglieder WHERE mitglied_id = ?',
    [mitglied_id]
  );

  if (members.length === 0) {
    throw new Error('Mitglied nicht gefunden');
  }
  
  if (members[0].aktiv !== 1) {
    throw new Error('Mitglied ist nicht aktiv');
  }
  
  const member = members[0];
  
  // 2. Check if checkins table exists
  try {
    await queryAsync('SELECT 1 FROM checkins LIMIT 1');
  } catch (err) {
    throw new Error('checkins Tabelle nicht verfügbar - Bitte Check-in System Setup durchführen');
  }
  
  // 3. Create check-ins
  const checkinTime = new Date();
  const checkinResults = [];
  
  for (const stundenplan_id of stundenplan_ids) {
    try {
      // Prüfe nur auf AKTIVE Check-ins heute
      const existing = await queryAsync(
        'SELECT checkin_id, status FROM checkins WHERE mitglied_id = ? AND stundenplan_id = ? AND DATE(checkin_time) = CURDATE() AND status = "active"',
        [mitglied_id, stundenplan_id]
      );

      if (existing.length > 0) {
        // Bereits eingecheckt - gebe vorhandenen Check-in zurück
        checkinResults.push({
          checkin_id: existing[0].checkin_id,
          stundenplan_id: stundenplan_id,
          status: 'bereits_angemeldet'
        });
        continue; // Nächsten Kurs verarbeiten
      }
      
      // Create new check-in (auch wenn bereits heute completed war)

      const result = await queryAsync(
        `INSERT INTO checkins 
         (mitglied_id, stundenplan_id, checkin_time, checkin_method, status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, 'active', NOW(), NOW())`,
        [mitglied_id, stundenplan_id, checkinTime, checkin_method || 'touch']
      );

      checkinResults.push({
        checkin_id: result.insertId,
        stundenplan_id: stundenplan_id,
        status: 'erfolg'
      });
      
      // Update anwesenheit if table exists
      try {
        await queryAsync(
          `INSERT INTO anwesenheit (mitglied_id, stundenplan_id, datum, anwesend, erstellt_am)
           VALUES (?, ?, CURDATE(), 1, NOW())
           ON DUPLICATE KEY UPDATE anwesend = 1, erstellt_am = NOW()`,
          [mitglied_id, stundenplan_id]
        );

      } catch (anwErr) {

        // Silent fail - anwesenheit table optional
      }
      
      // Update anwesenheit_protokoll if table exists
      try {
        await queryAsync(
          `INSERT INTO anwesenheit_protokoll (mitglied_id, stundenplan_id, datum, status, bemerkung)
           VALUES (?, ?, CURDATE(), 'anwesend', CONCAT('Check-in via ', ?, ' um ', TIME_FORMAT(NOW(), '%H:%i')))
           ON DUPLICATE KEY UPDATE 
             status = 'anwesend',
             bemerkung = CONCAT('Check-in via ', ?, ' um ', TIME_FORMAT(NOW(), '%H:%i'))`,
          [mitglied_id, stundenplan_id, checkin_method || 'touch', checkin_method || 'touch']
        );
      } catch (protErr) {
        // Silent fail - anwesenheit_protokoll table optional
      }
      
      // Update Trainingsstunden in mitglieder Tabelle
      try {
        // Hole die Kursdauer aus dem Stundenplan
        const courseInfo = await queryAsync(
          'SELECT TIMESTAMPDIFF(MINUTE, uhrzeit_start, uhrzeit_ende) as duration FROM stundenplan WHERE stundenplan_id = ?',
          [stundenplan_id]
        );
        
        if (courseInfo.length > 0 && courseInfo[0].duration) {
          const durationInHours = courseInfo[0].duration / 60; // Konvertiere Minuten zu Stunden
          
          // Erhöhe die Trainingsstunden
          await queryAsync(
            'UPDATE mitglieder SET trainingsstunden = COALESCE(trainingsstunden, 0) + ? WHERE mitglied_id = ?',
            [durationInHours, mitglied_id]
          );

        }
      } catch (hoursErr) {

        // Silent fail - Trainingsstunden Update optional
      }
      
    } catch (err) {
      checkinResults.push({
        stundenplan_id: stundenplan_id,
        status: 'fehler',
        error: err.message
      });
    }
  }
  
  return {
    member,
    checkinTime,
    checkinResults
  };
};

// ============================================
// ROUTES
// ============================================

// Health Check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Check-in API healthy',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /health',
      'GET /courses-today',
      'POST /',
      'POST /multi-course',
      'POST /guest',
      'GET /today',
      'POST /checkout',
      'GET /qr/:id',
      'GET /tresen/:datum'
    ]
  });
});

// 🆕 NEU: Einfacher Check-in für Frontend (verwendet Multi-Course-Logik)
router.post('/', async (req, res) => {
  try {
    const { mitglied_id, stundenplan_id, datum, checkin_type } = req.body;

    // Basic validation
    if (!mitglied_id || !stundenplan_id) {
      return res.status(400).json({
        success: false,
        error: 'mitglied_id und stundenplan_id sind erforderlich'
      });
    }
    
    // Vorhandene Multi-Course-Logik wiederverwenden
    const result = await performMultiCourseCheckin(
      mitglied_id, 
      [stundenplan_id],  // Array mit einem Element
      checkin_type || 'manual'
    );
    
    const { member, checkinTime, checkinResults } = result;
    const mainResult = checkinResults[0]; // Nur ein Kurs
    
    if (mainResult.status === 'erfolg') {

      res.status(201).json({
        success: true,
        message: 'Check-in erfolgreich erstellt',
        checkin_id: mainResult.checkin_id,
        created: true,
        data: {
          member: {
            id: member.mitglied_id,
            name: `${member.vorname} ${member.nachname}`
          },
          checkin_time: checkinTime.toISOString(),
          stundenplan_id: stundenplan_id
        }
      });
      
    } else if (mainResult.status === 'bereits_angemeldet') {

      res.json({
        success: true,
        message: 'Check-in bereits vorhanden und aktiv',
        checkin_id: mainResult.checkin_id,
        updated: false,
        data: {
          member: {
            id: member.mitglied_id,
            name: `${member.vorname} ${member.nachname}`
          },
          stundenplan_id: stundenplan_id
        }
      });
      
    } else {
      throw new Error(mainResult.error || 'Unbekannter Fehler beim Check-in');
    }
    
  } catch (error) {
    logger.error('Fehler beim Check-in:', { error: error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get today's available courses
router.get('/courses-today', async (req, res) => {
  try {
    // Get current day name in German
    const today = new Date();
    const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const todayName = dayNames[today.getDay()];

    // 🔒 TAX COMPLIANCE: Dojo-Filter aus Query-Parameter
    const { dojo_id } = req.query;
    const dojoFilter = (dojo_id && dojo_id !== 'all') ? ` AND s.dojo_id = ${parseInt(dojo_id)}` : '';

    logger.debug('Lade Kurse', { tag: todayName, dojo_id: dojo_id || 'all' });

    // Datenbank verwenden
    const query = `
      SELECT
        s.stundenplan_id,
        s.tag as wochentag,
        s.uhrzeit_start,
        s.uhrzeit_ende,
        CONCAT(TIME_FORMAT(s.uhrzeit_start, '%H:%i'), '-', TIME_FORMAT(s.uhrzeit_ende, '%H:%i')) as zeit,
        s.kurs_id,
        COALESCE(k.gruppenname, 'Unbekannter Kurs') as kurs_name,
        COALESCE(k.stil, 'Unbekannt') as stil,
        s.trainer_id,
        COALESCE(CONCAT(t.vorname, ' ', t.nachname), 'Kein Trainer') as trainer,
        COALESCE(t.stil, 'Unbekannt') as trainer_stil,
        20 as max_teilnehmer,
        0 as aktuelle_teilnehmer,
        20 as verfuegbare_plaetze,
        0 as is_full
      FROM stundenplan s
      LEFT JOIN kurse k ON s.kurs_id = k.kurs_id
      LEFT JOIN trainer t ON s.trainer_id = t.trainer_id
      WHERE (LOWER(s.tag) = LOWER(?) OR s.tag = ?)${dojoFilter}
      ORDER BY s.uhrzeit_start
    `;

    const courses = await queryAsync(query, [todayName, todayName]);
    logger.info('${courses.length} Kurse gefunden für ${todayName}');

    res.json({
      success: true,
      date: today.toISOString().split('T')[0],
      weekday: todayName,
      courses: courses
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Fehler beim Laden der Kurse',
      details: error.message
    });
  }
});

// Multi-Course Check-in - GEÄNDERT: Re-Check-in nach Checkout möglich, Check-in ohne Kurs erlaubt
router.post('/multi-course', async (req, res) => {
  try {
    const { mitglied_id, stundenplan_ids, checkin_method } = req.body;

    // Basic validation
    if (!mitglied_id) {
      return res.status(400).json({
        success: false,
        error: 'Ungültige Anfrage: mitglied_id erforderlich'
      });
    }

    // Wenn keine Kurse ausgewählt wurden, erstelle Check-in ohne Kurs (Freies Training)
    if (!stundenplan_ids || !Array.isArray(stundenplan_ids) || stundenplan_ids.length === 0) {
      const checkinTime = new Date();

      // Hole Mitgliedsdaten
      const members = await queryAsync(
        'SELECT mitglied_id, vorname, nachname, aktiv FROM mitglieder WHERE mitglied_id = ?',
        [mitglied_id]
      );

      if (members.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Mitglied nicht gefunden'
        });
      }

      if (!members[0].aktiv) {
        return res.status(400).json({
          success: false,
          error: 'Mitglied ist nicht aktiv'
        });
      }

      const member = members[0];

      // Erstelle Check-in ohne Kurs (stundenplan_id = NULL, status = active)
      const insertResult = await queryAsync(
        `INSERT INTO checkins
         (mitglied_id, stundenplan_id, checkin_time, checkin_method, status, created_at, updated_at)
         VALUES (?, NULL, ?, ?, 'active', NOW(), NOW())`,
        [mitglied_id, checkinTime, checkin_method || 'manual']
      );

      return res.json({
        success: true,
        message: 'Check-in ohne Kurs erfolgreich (Freies Training)',
        data: {
          member: {
            id: member.mitglied_id,
            name: `${member.vorname} ${member.nachname}`
          },
          checkin_time: checkinTime.toISOString(),
          results: [{
            status: 'erfolg',
            checkin_id: insertResult.insertId,
            kurs_name: 'Freies Training',
            message: 'Check-in ohne Kurs erfolgreich'
          }]
        }
      });
    }

    const result = await performMultiCourseCheckin(mitglied_id, stundenplan_ids, checkin_method);
    const { member, checkinTime, checkinResults } = result;

    const successCount = checkinResults.filter(r => r.status === 'erfolg').length;
    const alreadyCount = checkinResults.filter(r => r.status === 'bereits_angemeldet').length;

    res.json({
      success: true,
      message: `${successCount} neue Check-ins, ${alreadyCount} bereits angemeldet`,
      data: {
        member: {
          id: member.mitglied_id,
          name: `${member.vorname} ${member.nachname}`
        },
        checkin_time: checkinTime.toISOString(),
        results: checkinResults
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🆕 NEU: Gast Check-in (Probetraining, Besucher, etc.)
router.post('/guest', async (req, res) => {
  try {
    const {
      gast_vorname,
      gast_nachname,
      gast_email,
      gast_telefon,
      gast_grund,
      stundenplan_id,
      checkin_method
    } = req.body;

    // Pflichtfelder validieren
    if (!gast_vorname || !gast_nachname) {
      return res.status(400).json({
        success: false,
        error: 'Vorname und Nachname sind erforderlich'
      });
    }

    // Gültiger Grund?
    const validGruende = ['probetraining', 'besucher', 'einmalig', 'sonstiges'];
    const grund = validGruende.includes(gast_grund) ? gast_grund : 'probetraining';

    const checkinTime = new Date();

    // Gast-Check-in erstellen (mitglied_id = NULL)
    const result = await queryAsync(
      `INSERT INTO checkins
       (mitglied_id, stundenplan_id, checkin_time, checkin_method, status,
        ist_gast, gast_vorname, gast_nachname, gast_email, gast_telefon, gast_grund,
        created_at, updated_at)
       VALUES (NULL, ?, ?, ?, 'active', 1, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        stundenplan_id || null,
        checkinTime,
        checkin_method || 'manual',
        gast_vorname.trim(),
        gast_nachname.trim(),
        gast_email ? gast_email.trim() : null,
        gast_telefon ? gast_telefon.trim() : null,
        grund
      ]
    );

    // Kursinfo laden wenn vorhanden
    let kursName = 'Freies Training';
    if (stundenplan_id) {
      try {
        const kursInfo = await queryAsync(
          `SELECT k.gruppenname FROM stundenplan s
           LEFT JOIN kurse k ON s.kurs_id = k.kurs_id
           WHERE s.stundenplan_id = ?`,
          [stundenplan_id]
        );
        if (kursInfo.length > 0 && kursInfo[0].gruppenname) {
          kursName = kursInfo[0].gruppenname;
        }
      } catch (e) {
        // Silent fail
      }
    }

    const grundLabels = {
      'probetraining': 'Probetraining',
      'besucher': 'Besucher',
      'einmalig': 'Einmaliges Training',
      'sonstiges': 'Sonstiges'
    };

    logger.info('Gast Check-in: ${gast_vorname} ${gast_nachname} (${grundLabels[grund]})');

    res.status(201).json({
      success: true,
      message: `Gast ${gast_vorname} ${gast_nachname} erfolgreich eingecheckt`,
      data: {
        checkin_id: result.insertId,
        gast: {
          vorname: gast_vorname,
          nachname: gast_nachname,
          email: gast_email || null,
          telefon: gast_telefon || null,
          grund: grund,
          grund_label: grundLabels[grund]
        },
        checkin_time: checkinTime.toISOString(),
        kurs_name: kursName
      }
    });

  } catch (error) {
    logger.error('Fehler beim Gast Check-in:', { error: error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get today's check-ins - GEÄNDERT: Nur AKTIVE Check-ins anzeigen
router.get('/today', async (req, res) => {
  try {
    // Check if checkins table exists
    try {
      await queryAsync('SELECT 1 FROM checkins LIMIT 1');
    } catch (err) {
      return res.json({
        success: true,
        checkins: [],
        message: 'checkins Tabelle nicht verfügbar'
      });
    }

    const query = `
      SELECT
        c.checkin_id,
        c.mitglied_id,
        COALESCE(m.vorname, c.gast_vorname) as vorname,
        COALESCE(m.nachname, c.gast_nachname) as nachname,
        COALESCE(CONCAT(m.vorname, ' ', m.nachname), CONCAT(c.gast_vorname, ' ', c.gast_nachname)) as full_name,
        COALESCE(m.gurtfarbe, 'weiss') as gurtfarbe,
        m.foto_pfad,
        m.foto_pfad as profilbild,
        c.stundenplan_id,
        c.checkin_time,
        c.checkout_time,
        c.checkin_method,
        c.status,
        TIMESTAMPDIFF(MINUTE, c.checkin_time, NOW()) as minutes_since_checkin,
        COALESCE(k.gruppenname, 'Freies Training') as kurs_name,
        c.ist_gast,
        c.gast_vorname,
        c.gast_nachname,
        c.gast_email,
        c.gast_telefon,
        c.gast_grund
      FROM checkins c
      LEFT JOIN mitglieder m ON c.mitglied_id = m.mitglied_id
      LEFT JOIN stundenplan s ON c.stundenplan_id = s.stundenplan_id
      LEFT JOIN kurse k ON s.kurs_id = k.kurs_id
      WHERE DATE(c.checkin_time) = CURDATE()
        AND (m.aktiv = 1 OR c.ist_gast = 1)
        AND c.status = 'active'
      ORDER BY c.checkin_time DESC
    `;

    const checkins = await queryAsync(query);

    res.json({
      success: true,
      date: new Date().toISOString().split('T')[0],
      checkins: checkins
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Fehler beim Laden der Check-ins',
      details: error.message
    });
  }
});

// Get today's check-ins for a specific member (all statuses)
router.get('/today-member/:mitglied_id', async (req, res) => {
  try {
    const { mitglied_id } = req.params;

    const query = `
      SELECT
        c.checkin_id,
        c.stundenplan_id,
        c.checkin_time,
        c.checkout_time,
        c.status,
        s.kurs_id,
        k.gruppenname as kurs_name
      FROM checkins c
      LEFT JOIN stundenplan s ON c.stundenplan_id = s.stundenplan_id
      LEFT JOIN kurse k ON s.kurs_id = k.kurs_id
      WHERE c.mitglied_id = ?
        AND DATE(c.checkin_time) = CURDATE()
      ORDER BY c.checkin_time DESC
    `;

    const checkins = await queryAsync(query, [mitglied_id]);

    res.json({
      success: true,
      mitglied_id: parseInt(mitglied_id),
      date: new Date().toISOString().split('T')[0],
      checkins: checkins,
      stundenplan_ids: checkins.map(c => c.stundenplan_id)
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Fehler beim Laden der Mitglieder Check-ins',
      details: error.message
    });
  }
});

// 🆕 NEU: Check-in Übersicht für Tresen (eingecheckt + vom Trainer hinzugefügt)
router.get('/tresen/:datum', async (req, res) => {
    try {
        const datum = req.params.datum;
        const heute = new Date(datum);
        const wochentag = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'][heute.getDay()];
        logger.debug('📢 Tresen-Query für Datum: ${datum} (${wochentag})');
        
        // Sehr einfache Query: Finde ALLE aktiven Check-ins für heute
        logger.debug('Suche Check-ins für Datum: ${datum}');
        
        // Zuerst: Prüfe ob überhaupt Check-ins existieren
        const testQuery = `SELECT COUNT(*) as count FROM checkins WHERE DATE(checkin_time) = ? AND status = 'active'`;
        const testResult = await queryAsync(testQuery, [datum]);
        logger.debug('📊 Anzahl aktive Check-ins in DB: ${testResult[0]?.count || 0}');
        
        // Dann: Hole alle Check-ins mit Mitglied-Daten (inkl. Gäste)
        const checkinsQuery = `
            SELECT
                c.checkin_id,
                c.mitglied_id,
                c.stundenplan_id,
                c.checkin_time,
                c.checkout_time,
                c.status,
                COALESCE(m.vorname, c.gast_vorname) as vorname,
                COALESCE(m.nachname, c.gast_nachname) as nachname,
                COALESCE(CONCAT(m.vorname, ' ', m.nachname), CONCAT(c.gast_vorname, ' ', c.gast_nachname)) as full_name,
                COALESCE(m.gurtfarbe, 'weiss') as gurtfarbe,
                COALESCE(k.gruppenname, 'Freies Training') as kurs_name,
                CASE
                    WHEN s.uhrzeit_start IS NOT NULL AND s.uhrzeit_ende IS NOT NULL
                    THEN CONCAT(TIME_FORMAT(s.uhrzeit_start, '%H:%i'), '-', TIME_FORMAT(s.uhrzeit_ende, '%H:%i'))
                    ELSE NULL
                END as kurs_zeit,
                s.uhrzeit_start,
                s.uhrzeit_ende,
                COALESCE(c.ist_gast, 0) as ist_gast,
                c.gast_email,
                c.gast_telefon,
                c.gast_grund
            FROM checkins c
            LEFT JOIN mitglieder m ON c.mitglied_id = m.mitglied_id
            LEFT JOIN stundenplan s ON c.stundenplan_id = s.stundenplan_id
            LEFT JOIN kurse k ON s.kurs_id = k.kurs_id
            WHERE DATE(c.checkin_time) = ?
                AND c.status = 'active'
                AND (m.aktiv = 1 OR c.ist_gast = 1)
            ORDER BY c.checkin_time DESC
        `;
        
        logger.debug('Führe Query aus mit Datum: ${datum}');
        let checkins;
        try {
            checkins = await queryAsync(checkinsQuery, [datum]);
            logger.info('Query erfolgreich ausgeführt. Gefundene Check-ins nach JOIN: ${checkins.length}');
        } catch (queryError) {
            logger.error('Query-Fehler:', queryError);
            throw queryError;
        }
        
        if (checkins.length === 0) {
            logger.debug('⚠️ Keine Check-ins gefunden! Prüfe ob Check-ins für ${datum} existieren...');
            // Debug: Prüfe alle Check-ins heute
            const allCheckins = await queryAsync(
                `SELECT checkin_id, mitglied_id, checkin_time, status FROM checkins WHERE DATE(checkin_time) = ?`,
                [datum]
            );
            logger.debug('📋 Alle Check-ins für ${datum} (alle Status): ${allCheckins.length}');
            if (allCheckins.length > 0) {
                logger.debug(`📋 Check-ins Details:`, allCheckins);
                // Prüfe warum sie nicht gefunden werden
                const mitgliedIds = allCheckins.map(c => c.mitglied_id);
                const placeholders = mitgliedIds.map(() => '?').join(',');
                const members = await queryAsync(
                    `SELECT mitglied_id, vorname, nachname, aktiv FROM mitglieder WHERE mitglied_id IN (${placeholders})`,
                    mitgliedIds
                );
                logger.debug(`👥 Mitglieder-Daten:`, members);
            }
        } else {
            logger.debug(`📋 Erste 3 Check-ins:`, checkins.slice(0, 3).map(c => ({
                mitglied_id: c.mitglied_id,
                name: c.full_name,
                checkin_time: c.checkin_time,
                status: c.status,
                stundenplan_id: c.stundenplan_id,
                kurs_name: c.kurs_name
            })));
        }
        
        // Gruppiere nach Mitglied (nimm den neuesten Check-in pro Mitglied)
        const memberMap = new Map();
        checkins.forEach(c => {
            if (!memberMap.has(c.mitglied_id) || 
                new Date(c.checkin_time) > new Date(memberMap.get(c.mitglied_id).checkin_time)) {
                memberMap.set(c.mitglied_id, c);
            }
        });
        
        const results = Array.from(memberMap.values()).map(c => ({
            mitglied_id: c.mitglied_id,
            vorname: c.vorname,
            nachname: c.nachname,
            full_name: c.full_name,
            gurtfarbe: c.gurtfarbe,
            stundenplan_id: c.stundenplan_id,
            kurs_name: c.kurs_name || 'Freies Training',
            kurs_zeit: c.kurs_zeit,
            uhrzeit_start: c.uhrzeit_start,
            uhrzeit_ende: c.uhrzeit_ende,
            anwesenheits_typ: 'selbst_eingecheckt',
            selbst_checkin_time: c.checkin_time,
            checkout_time: c.checkout_time,
            checkin_status: c.status,
            anwesenheits_prioritaet: 1,
            ist_gast: c.ist_gast || 0,
            gast_email: c.gast_email,
            gast_telefon: c.gast_telefon,
            gast_grund: c.gast_grund
        }));
        
        logger.debug('📊 Gruppierte Ergebnisse: ${results.length} Mitglieder');
        if (results.length > 0) {
            logger.debug(`📋 Mitglieder:`, results.map(r => `${r.full_name} (ID: ${r.mitglied_id})`));
        }

        // Statistiken berechnen
        const stats = {
            total_anwesend: results.length,
            selbst_eingecheckt: results.filter(r => r.anwesenheits_typ === 'selbst_eingecheckt').length,
            trainer_hinzugefuegt: results.filter(r => r.anwesenheits_typ === 'trainer_hinzugefuegt').length,
            noch_aktiv: results.filter(r => r.checkin_status === 'active').length,
            brauchen_checkin: results.filter(r => r.anwesenheits_typ === 'trainer_hinzugefuegt').length,
            gaeste: results.filter(r => r.ist_gast === 1).length,
            mitglieder: results.filter(r => r.ist_gast !== 1).length
        };

        res.json({
            success: true,
            datum: datum,
            wochentag: wochentag,
            stats: stats,
            anwesende: results
        });

    } catch (error) {
        logger.error('Fehler beim Abrufen der Tresen-Übersicht:', { error: error });
        res.status(500).json({
            success: false,
            message: 'Fehler beim Abrufen der Tresen-Übersicht',
            error: error.message
        });
    }
});

// 🆕 NEU: Batch Check-in für Tresen (Mitglieder die vom Trainer hinzugefügt wurden nachträglich einchecken)
router.post('/tresen/batch-checkin', async (req, res) => {
    try {
        const { mitglieder_ids, datum } = req.body;

        if (!Array.isArray(mitglieder_ids) || mitglieder_ids.length === 0) {
            return res.status(400).json({ error: 'Keine Mitglied-IDs übermittelt' });
        }

        const results = [];
        const errors = [];

        // Für jedes Mitglied: Finde zugehörigen Stundenplan und checke ein
        for (const mitglied_id of mitglieder_ids) {
            try {
                // Stundenplan_id aus anwesenheit Tabelle holen
                const anwesenheitResult = await queryAsync(
                    'SELECT stundenplan_id FROM anwesenheit WHERE mitglied_id = ? AND datum = ? AND anwesend = 1',
                    [mitglied_id, datum]
                );

                if (anwesenheitResult.length === 0) {
                    errors.push({ mitglied_id, error: 'Keine Anwesenheit gefunden' });
                    continue;
                }

                const stundenplan_id = anwesenheitResult[0].stundenplan_id;
                const checkin_time = new Date();

                // Check-in Eintrag erstellen
                const insertResult = await queryAsync(
                    `INSERT INTO checkins (mitglied_id, stundenplan_id, checkin_time, status, created_at, updated_at) 
                     VALUES (?, ?, ?, 'active', NOW(), NOW())`,
                    [mitglied_id, stundenplan_id, checkin_time]
                );

                results.push({ 
                    mitglied_id, 
                    stundenplan_id, 
                    checkin_time: checkin_time.toISOString(),
                    status: 'success' 
                });

            } catch (memberError) {
                logger.error('Fehler beim Check-in für Mitglied ${mitglied_id}:', { error: memberError });
                errors.push({ mitglied_id, error: memberError.message });
            }
        }

        res.json({
            success: true,
            message: `${results.length} Mitglieder erfolgreich eingecheckt`,
            results: results,
            errors: errors
        });

    } catch (error) {
        logger.error('Fehler beim Batch Check-in:', { error: error });
        res.status(500).json({
            success: false,
            message: 'Fehler beim Batch Check-in',
            error: error.message
        });
    }
});

// Checkout for member - Trigger-sicher
router.post('/checkout', async (req, res) => {
  try {
    const { checkin_id } = req.body;
    
    if (!checkin_id) {
      return res.status(400).json({
        success: false,
        error: 'checkin_id erforderlich'
      });
    }
    
    // Get checkin info
    const checkins = await queryAsync(
      'SELECT c.*, m.vorname, m.nachname FROM checkins c JOIN mitglieder m ON c.mitglied_id = m.mitglied_id WHERE c.checkin_id = ?',
      [checkin_id]
    );
    
    if (checkins.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Check-in nicht gefunden'
      });
    }
    
    const checkin = checkins[0];
    
    if (checkin.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Bereits ausgecheckt'
      });
    }
    
    // TRIGGER-SICHER: Update ohne Trigger-Konflikt
    try {
      // Triggers temporär deaktivieren falls möglich
      await queryAsync('SET @TRIGGER_DISABLED = 1');
      
      // Update check-in to completed
      await queryAsync(
        'UPDATE checkins SET checkout_time = NOW(), status = ?, updated_at = NOW() WHERE checkin_id = ?',
        ['completed', checkin_id]
      );
      
      // Triggers wieder aktivieren
      await queryAsync('SET @TRIGGER_DISABLED = NULL');
      
    } catch (updateError) {
      // Falls Trigger-Problem weiterhin besteht, alternative Lösung

      // Direkte Lösung ohne UPDATE (INSERT mit DELETE)
      await queryAsync('START TRANSACTION');
      
      try {
        // Neue completed Version einfügen
        await queryAsync(
          `INSERT INTO checkins 
           (mitglied_id, stundenplan_id, checkin_time, checkout_time, checkin_method, status, created_at, updated_at)
           SELECT mitglied_id, stundenplan_id, checkin_time, NOW(), checkin_method, 'completed', created_at, NOW()
           FROM checkins WHERE checkin_id = ?`,
          [checkin_id]
        );
        
        // Alte Version löschen
        await queryAsync('DELETE FROM checkins WHERE checkin_id = ?', [checkin_id]);
        
        await queryAsync('COMMIT');
        
      } catch (altError) {
        await queryAsync('ROLLBACK');
        throw altError;
      }
    }
    
    // Try to update anwesenheit_protokoll (außerhalb Trigger)
    try {
      await queryAsync(
        `UPDATE anwesenheit_protokoll 
         SET status = 'abgebrochen', 
             bemerkung = CONCAT(COALESCE(bemerkung, ''), ' - Ausgecheckt um ', TIME_FORMAT(NOW(), '%H:%i'))
         WHERE mitglied_id = ? AND stundenplan_id = ? AND datum = CURDATE()`,
        [checkin.mitglied_id, checkin.stundenplan_id]
      );
    } catch (protErr) {
      // Silent fail - anwesenheit_protokoll table optional

    }
    
    res.json({
      success: true,
      message: `${checkin.vorname} ${checkin.nachname} erfolgreich ausgecheckt`,
      data: {
        checkin_id: checkin_id,
        member_name: `${checkin.vorname} ${checkin.nachname}`,
        checkout_time: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Checkout error:', { error: error });
    res.status(500).json({
      success: false,
      error: 'Checkout fehlgeschlagen: ' + error.message
    });
  }
});

// Generate QR Code for member
router.get('/qr/:id', async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const format = req.query.format || 'json'; // json, png, svg
    
    if (!memberId || memberId < 1) {
      return res.status(400).json({
        success: false,
        error: 'Gültige Mitglied-ID erforderlich'
      });
    }
    
    // Get member info
    const members = await queryAsync(
      'SELECT mitglied_id, vorname, nachname, email, gurtfarbe FROM mitglieder WHERE mitglied_id = ? AND aktiv = 1',
      [memberId]
    );
    
    if (members.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Mitglied nicht gefunden'
      });
    }
    
    const member = members[0];
    const qrData = generateQRData(memberId);
    
    if (format === 'png') {
      try {
        const qrBuffer = await QRCode.toBuffer(qrData, {
          type: 'png',
          width: 300,
          margin: 2
        });
        
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="qr_member_${memberId}.png"`);
        res.send(qrBuffer);
        
      } catch (qrErr) {
        return res.status(500).json({
          success: false,
          error: 'QR-Code PNG Generation fehlgeschlagen',
          details: qrErr.message
        });
      }
      
    } else if (format === 'svg') {
      try {
        const qrSvg = await QRCode.toString(qrData, {
          type: 'svg',
          width: 300,
          margin: 2
        });
        
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(qrSvg);
        
      } catch (qrErr) {
        return res.status(500).json({
          success: false,
          error: 'QR-Code SVG Generation fehlgeschlagen',
          details: qrErr.message
        });
      }
      
    } else {
      try {
        const qrDataUrl = await QRCode.toDataURL(qrData, {
          width: 300,
          margin: 2
        });
        
        res.json({
          success: true,
          member: {
            id: member.mitglied_id,
            name: `${member.vorname} ${member.nachname}`,
            gurtfarbe: member.gurtfarbe,
            email: member.email
          },
          qr_code: {
            data: qrData,
            data_url: qrDataUrl,
            png_url: `/api/checkin/qr/${memberId}?format=png`,
            svg_url: `/api/checkin/qr/${memberId}?format=svg`
          }
        });
        
      } catch (qrErr) {
        return res.status(500).json({
          success: false,
          error: 'QR-Code Generation fehlgeschlagen',
          details: qrErr.message
        });
      }
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Fehler bei QR-Code',
      details: error.message
    });
  }
});

module.exports = router;