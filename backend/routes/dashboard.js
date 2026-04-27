// Backend/routes/dashboard.js - Fixed für aktive Check-ins
const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

// GET /api/dashboard/batch - Optimized batch endpoint for all dashboard data
router.get('/batch', async (req, res) => {
  try {
    let { dojo_id, dojo_ids } = req.query;

    // 🔒 KRITISCH: Erzwinge Tenant-Isolation basierend auf req.user.dojo_id
    if (req.user && req.user.dojo_id) {
        dojo_id = req.user.dojo_id.toString();
        logger.debug('🔒 Tenant-Filter erzwungen:', { user_dojo_id: req.user.dojo_id, forced_dojo_id: dojo_id });
    } else if (!dojo_id && dojo_ids) {
        // Super-Admin mit mehreren Dojos (z.B. dojo_ids=2,3)
        dojo_id = dojo_ids;
    }

    logger.debug(`🚀 Dashboard-Batch-Endpoint wird geladen (dojo_id=${dojo_id || 'all'})...`);

    const [stats, activities, tarife, zahlungszyklen] = await Promise.all([
      getDashboardStats(dojo_id),
      getRecentActivities(dojo_id),
      getTarife(),
      getZahlungszyklen()
    ]);

    logger.info('Batch-Daten erfolgreich geladen', { dojo_id: dojo_id || 'all' });
    res.json({
      stats,
      activities,
      tarife,
      zahlungszyklen,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Batch-Endpoint Fehler:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions for batch endpoint
async function getDashboardStats(dojo_id) {
  // Original dashboard stats logic but optimized with dojo_id filtering
  const stats = {
    mitglieder: 0,
    kurse: 0,
    trainer: 0,
    anwesenheit: 0,
    beitraege: 0,
    checkins_heute: 0,
    stile: 0,
    buddy_gruppen: 0,
    tarife: 0,
    zahlungszyklen: 0,
    termine: 0,
    ehemalige: 0,
    interessenten: 0
  };

  try {
    // 🔒 KRITISCHER DOJO-FILTER: Baue WHERE-Clause für alle relevanten Tabellen
    // Wenn dojo_id === 'all', filtere nur zentral verwaltete Dojos (ohne separate Tenants)
    let dojoFilter = '';
    let dojoJoinFilter = '';

    if (dojo_id && dojo_id !== 'all' && String(dojo_id).includes(',')) {
      // Mehrere Dojos (dojo_ids=2,3)
      const dojoIds = String(dojo_id).split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      if (dojoIds.length > 0) {
        dojoFilter = ` AND dojo_id IN (${dojoIds.join(',')})`;
        dojoJoinFilter = ` AND m.dojo_id IN (${dojoIds.join(',')})`;
      }
    } else if (dojo_id && dojo_id !== 'all') {
      // Spezifisches Dojo
      dojoFilter = ` AND dojo_id = ${parseInt(dojo_id)}`;
      dojoJoinFilter = ` AND m.dojo_id = ${parseInt(dojo_id)}`;
    } else if (dojo_id === 'all') {
      // Alle zentral verwalteten Dojos (ohne separate Tenants wie Demo)
      dojoFilter = ` AND dojo_id NOT IN (
        SELECT DISTINCT dojo_id FROM admin_users WHERE dojo_id IS NOT NULL AND rolle NOT IN ('eingeschraenkt', 'trainer', 'checkin')
      )`;
      dojoJoinFilter = ` AND m.dojo_id NOT IN (
        SELECT DISTINCT dojo_id FROM admin_users WHERE dojo_id IS NOT NULL AND rolle NOT IN ('eingeschraenkt', 'trainer', 'checkin')
      )`;
    }
    // Wenn dojo_id === undefined/null, keine Filterung (sollte nicht vorkommen)

    // Debug: Log Anwesenheits-Query
    // Zähle EINDEUTIGE Personen, die heute da waren (nicht die Summe aller Anwesenheiten)
    const anwesenheitQuery = `SELECT COUNT(DISTINCT mitglied_id) as count FROM anwesenheit WHERE DATE(datum) = CURDATE() AND anwesend = 1${dojoFilter}`;
    logger.debug('Anwesenheits-Query:', anwesenheitQuery);

    const queries = await Promise.all([
      db.promise().query(`SELECT COUNT(*) as count FROM mitglieder WHERE aktiv = 1${dojoFilter}`).catch(() => [[]]),
      db.promise().query(`SELECT COUNT(*) as count FROM kurse WHERE 1=1${dojoFilter}`).catch(() => [[]]),
      db.promise().query(`SELECT COUNT(*) as count FROM trainer WHERE 1=1${dojoFilter}`).catch(() => [[]]),
      db.promise().query(anwesenheitQuery).catch((err) => { logger.error('Anwesenheits-Query Fehler:', err); return [[]]; }),
      db.promise().query(`SELECT COUNT(*) as count FROM beitraege WHERE bezahlt = 0${dojoFilter}`).catch(() => [[]]),
      // Checkins: JOIN mit mitglieder für dojo_id
      db.promise().query(`SELECT COUNT(*) as count FROM checkins c JOIN mitglieder m ON c.mitglied_id = m.mitglied_id WHERE DATE(c.checkin_time) = CURDATE() AND c.status = 'active'${dojoJoinFilter}`).catch(() => [[]]),
      db.promise().query('SELECT COUNT(*) as count FROM stile').catch(() => [[]]), // Global, kein Filter
      db.promise().query('SELECT COUNT(*) as count FROM tarife').catch(() => [[]]), // Global, kein Filter
      db.promise().query('SELECT COUNT(*) as count FROM zahlungszyklen').catch(() => [[]]), // Global, kein Filter
      db.promise().query(`SELECT COUNT(*) as count FROM pruefungstermin_vorlagen WHERE 1=1${dojoFilter}`).catch(() => [[]]), // Prüfungstermine
      db.promise().query(`SELECT COUNT(*) as count FROM ehemalige WHERE archiviert = FALSE${dojoFilter}`).catch(() => [[]]), // Ehemalige Mitglieder
      db.promise().query(`SELECT COUNT(*) as count FROM interessenten WHERE archiviert = FALSE${dojoFilter}`).catch(() => [[]]) // Interessenten
    ]);

    stats.mitglieder = queries[0][0][0]?.count || 0;
    stats.kurse = queries[1][0][0]?.count || 0;
    stats.trainer = queries[2][0][0]?.count || 0;
    stats.anwesenheit = queries[3][0][0]?.count || 0;
    logger.info('Anwesenheit gefunden:', { details: stats.anwesenheit });
    stats.beitraege = queries[4][0][0]?.count || 0;
    stats.checkins_heute = queries[5][0][0]?.count || 0;
    stats.stile = queries[6][0][0]?.count || 0;
    stats.tarife = queries[7][0][0]?.count || 0;
    stats.zahlungszyklen = queries[8][0][0]?.count || 0;
    stats.termine = queries[9][0][0]?.count || 0;
    stats.ehemalige = queries[10][0][0]?.count || 0;
    stats.interessenten = queries[11][0][0]?.count || 0;
  } catch (error) {
    logger.error('Stats Query Fehler:', error);
  }

  return stats;
}

async function getRecentActivities(dojo_id) {
  if (!dojo_id) return [];
  try {
    const [rows] = await db.promise().query(
      `SELECT
         m.vorname, m.nachname,
         c.checkin_time AS zeitpunkt,
         'checkin' AS typ
       FROM checkins c
       JOIN mitglieder m ON m.mitglied_id = c.mitglied_id
       WHERE m.dojo_id = ?
         AND c.checkin_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY c.checkin_time DESC
       LIMIT 10`,
      [dojo_id]
    );
    return rows.map(r => ({
      text: `${r.vorname} ${r.nachname} eingecheckt`,
      zeitpunkt: r.zeitpunkt,
      typ: r.typ
    }));
  } catch (error) {
    logger.error('getRecentActivities Fehler:', { error: error.message });
    return [];
  }
}

async function getTarife() {
  try {
    const [tarife] = await db.promise().query('SELECT * FROM tarife ORDER BY name ASC');
    return tarife;
  } catch (error) {
    logger.error('Tarife Query Fehler:', error);
    return [];
  }
}

async function getZahlungszyklen() {
  try {
    const [zyklen] = await db.promise().query('SELECT * FROM zahlungszyklen ORDER BY name ASC');
    return zyklen;
  } catch (error) {
    logger.error('Zahlungszyklen Query Fehler:', error);
    return [];
  }
}

// GET /api/dashboard - Hauptstatistiken mit korrigierten Queries
router.get('/', async (req, res) => {
  try {
    // 🔒 SICHER: Verwende getSecureDojoId statt req.query.dojo_id
    const secureDojoId = getSecureDojoId(req);
    logger.debug(`📊 Dashboard-Statistiken werden geladen (dojo_id=${secureDojoId || 'all'})...`);

    // 🔒 KRITISCHER DOJO-FILTER: Baue WHERE-Clause
    const dojoFilter = secureDojoId ? ` AND dojo_id = ${secureDojoId}` : '';

    const stats = {
      mitglieder: 0,
      kurse: 0,
      trainer: 0,
      anwesenheit: 0,
      beitraege: 0,
      checkins_heute: 0,
      stile: 0
    };

    // 1. MITGLIEDER - korrigiert mit aktiv = 1 + dojo_id Filter
    try {
      logger.debug('Teste Mitglieder-Queries...');

      try {
        const [mitgliederResult1] = await db.promise().query(
          `SELECT COUNT(*) as count FROM mitglieder WHERE aktiv = 1${dojoFilter}`
        );
        logger.debug('Mitglieder gezählt', { aktiv: true, dojo_id: dojo_id || 'all', count: mitgliederResult1[0]?.count });
        stats.mitglieder = mitgliederResult1[0]?.count || 0;
      } catch (e1) {
        logger.warn('⚠️ Mitglieder (aktiv = 1) failed, trying all:', e1.message);

        // Fallback: Alle Mitglieder
        try {
          const [mitgliederResult2] = await db.promise().query(
            `SELECT COUNT(*) as count FROM mitglieder WHERE 1=1${dojoFilter}`
          );
          logger.debug('Mitglieder (Fallback) gezählt', { count: mitgliederResult2[0]?.count });
          stats.mitglieder = mitgliederResult2[0]?.count || 0;
        } catch (e2) {
          logger.error('❌ Mitglieder-Tabelle existiert nicht:', e2.message);
        }
      }
    } catch (e) {
      logger.error('❌ Mitglieder Query komplett fehlgeschlagen:', e.message);
    }

    // 2. KURSE - korrigiert ohne status Filter + dojo_id Filter
    try {
      logger.debug('Teste Kurse-Queries...');

      try {
        const [kurseResult] = await db.promise().query(
          `SELECT COUNT(*) as count FROM kurse WHERE 1=1${dojoFilter}`
        );
        logger.debug('Kurse gezählt', { count: kurseResult[0]?.count });
        stats.kurse = kurseResult[0]?.count || 0;
      } catch (e) {
        logger.error('❌ Kurse-Tabelle Fehler:', e.message);
      }
    } catch (e) {
      logger.error('❌ Kurse Query komplett fehlgeschlagen:', e.message);
    }

    // 3. TRAINER - korrigiert ohne status Filter + dojo_id Filter
    try {
      logger.debug('Teste Trainer-Queries...');

      try {
        const [trainerResult] = await db.promise().query(
          `SELECT COUNT(*) as count FROM trainer WHERE 1=1${dojoFilter}`
        );
        logger.debug('Trainer gezählt', { count: trainerResult[0]?.count });
        stats.trainer = trainerResult[0]?.count || 0;
      } catch (e) {
        logger.error('❌ Trainer-Tabelle Fehler:', e.message);
      }
    } catch (e) {
      logger.error('❌ Trainer Query komplett fehlgeschlagen:', e.message);
    }

    // 4. ANWESENHEIT - korrigiert mit richtigen Spalten + dojo_id Filter
    try {
      logger.debug('Teste Anwesenheit-Queries...');

      try {
        const [anwesenheitResult] = await db.promise().query(
          `SELECT COUNT(*) as count FROM anwesenheit WHERE DATE(datum) = CURDATE() AND anwesend = 1${dojoFilter}`
        );
        logger.debug('Anwesenheit gezählt', { count: anwesenheitResult[0]?.count });
        stats.anwesenheit = anwesenheitResult[0]?.count || 0;
      } catch (e1) {
        logger.warn('⚠️ Anwesenheit (heute) failed, trying all:', e1.message);

        try {
          const [anwesenheitResult2] = await db.promise().query(
            `SELECT COUNT(*) as count FROM anwesenheit WHERE 1=1${dojoFilter}`
          );
          logger.debug('Anwesenheit (Fallback) gezählt', { count: anwesenheitResult2[0]?.count });
          stats.anwesenheit = anwesenheitResult2[0]?.count || 0;
        } catch (e2) {
          logger.error('❌ Anwesenheit-Tabelle existiert nicht:', e2.message);
        }
      }
    } catch (e) {
      logger.error('❌ Anwesenheit Query komplett fehlgeschlagen:', e.message);
    }

    // 5. BEITRÄGE - korrigiert ohne status Filter + dojo_id Filter
    try {
      logger.debug('Teste Beiträge-Queries...');

      try {
        const [beitraegeResult1] = await db.promise().query(
          `SELECT COUNT(*) as count FROM beitraege WHERE bezahlt = 0${dojoFilter}`
        );
        logger.debug('Beiträge gezählt', { count: beitraegeResult1[0]?.count });
        stats.beitraege = beitraegeResult1[0]?.count || 0;
      } catch (e1) {
        logger.warn('⚠️ Beiträge (unbezahlt) failed, trying all:', e1.message);

        try {
          const [beitraegeResult2] = await db.promise().query(
            `SELECT COUNT(*) as count FROM beitraege WHERE 1=1${dojoFilter}`
          );
          logger.debug('Beiträge (Fallback) gezählt', { count: beitraegeResult2[0]?.count });
          stats.beitraege = beitraegeResult2[0]?.count || 0;
        } catch (e2) {
          logger.error('❌ Beiträge-Tabelle existiert nicht:', e2.message);
        }
      }
    } catch (e) {
      logger.error('❌ Beiträge Query komplett fehlgeschlagen:', e.message);
    }

    // 6. CHECK-INS - GEÄNDERT: Nur aktive Check-ins von heute + JOIN mit mitglieder für dojo_id
    try {
      logger.debug('Teste Check-in-Queries...');

      try {
        // ✅ GEÄNDERT: Nur aktive Check-ins von heute + JOIN mit mitglieder für dojo_id Filter
        const dojoJoinFilter = (dojo_id && dojo_id !== 'all') ? ` AND m.dojo_id = ${parseInt(dojo_id)}` : '';
        const [checkinResult1] = await db.promise().query(
          `SELECT COUNT(*) as count FROM checkins c JOIN mitglieder m ON c.mitglied_id = m.mitglied_id WHERE DATE(c.checkin_time) = CURDATE() AND c.status = 'active'${dojoJoinFilter}`
        );
        logger.debug('Check-ins gezählt', { count: checkinResult1[0]?.count });
        stats.checkins_heute = checkinResult1[0]?.count || 0;
      } catch (e1) {
        logger.warn('⚠️ Check-ins (aktiv) failed, trying all:', e1.message);

        // Fallback: Alle Check-ins von heute
        try {
          const [checkinResult2] = await db.promise().query(
            `SELECT COUNT(*) as count FROM checkins WHERE DATE(checkin_time) = CURDATE()`
          );
          logger.debug('Check-ins (Fallback) gezählt', { count: checkinResult2[0]?.count });
          stats.checkins_heute = checkinResult2[0]?.count || 0;
        } catch (e2) {
          logger.error('❌ Checkins-Tabelle existiert nicht:', e2.message);
          stats.checkins_heute = 0;
        }
      }
    } catch (e) {
      logger.error('❌ Check-ins Query komplett fehlgeschlagen:', e.message);
    }

    // 7. STILE - Anzahl der Kampfkunst-Stile laden
    try {
      logger.debug('Teste Stile-Queries...');
      
      try {
        const [stileResult] = await db.promise().query(
          `SELECT COUNT(*) as count FROM stile`
        );
        logger.debug('Stile gezählt', { count: stileResult[0]?.count });
        stats.stile = stileResult[0]?.count || 0;
      } catch (e) {
        logger.error('❌ Stile-Tabelle Fehler:', e.message);
        stats.stile = 0;
      }
    } catch (e) {
      logger.error('❌ Stile Query komplett fehlgeschlagen:', e.message);
    }

    // 8. TABELLEN AUFLISTEN - Debug Info (behalten)
    try {
      logger.debug('Liste alle verfügbaren Tabellen...');
      const [tables] = await db.promise().query(`SHOW TABLES`);
      logger.debug('Verfügbare Tabellen:', { tables: tables.map(t => Object.values(t)[0]) });
    } catch (e) {
      logger.error('❌ Kann Tabellen nicht auflisten:', e.message);
    }

    logger.debug('Finale Dashboard-Statistiken:', { stats });
    res.json(stats);

  } catch (error) {
    logger.error('Kritischer Fehler beim Laden der Dashboard-Statistiken:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der Dashboard-Statistiken' });
  }
});

// GET /api/dashboard/recent - Recent Activities mit echten Check-ins
router.get('/recent', async (req, res) => {
  try {
    // 🔒 SICHER: Verwende getSecureDojoId statt req.query.dojo_id
    const secureDojoId = getSecureDojoId(req);
    logger.debug(`📋 Recent Activities werden geladen (dojo_id=${secureDojoId || 'all'})...`);

    const activities = [];

    // 🔒 KRITISCHER DOJO-FILTER
    const dojoFilter = secureDojoId ? ` AND m.dojo_id = ${secureDojoId}` : '';

    // 1. Echte Check-ins von heute laden - GEÄNDERT: Alle Check-ins anzeigen (aktiv + completed) + dojo_id Filter
    try {
      const [checkins] = await db.promise().query(`
        SELECT
          c.checkin_id,
          c.checkin_time,
          c.checkout_time,
          c.checkin_method,
          c.status,
          CONCAT(m.vorname, ' ', m.nachname) as member_name,
          k.gruppenname as kurs_name
        FROM checkins c
        JOIN mitglieder m ON c.mitglied_id = m.mitglied_id
        LEFT JOIN stundenplan s ON c.stundenplan_id = s.stundenplan_id
        LEFT JOIN kurse k ON s.kurs_id = k.kurs_id
        WHERE DATE(c.checkin_time) = CURDATE()${dojoFilter}
        ORDER BY c.checkin_time DESC
        LIMIT 10
      `);

      checkins.forEach(checkin => {
        const isActive = checkin.status === 'active';
        activities.push({
          id: `checkin_${checkin.checkin_id}`,
          type: isActive ? 'checkin' : 'checkout',
          member: checkin.member_name,
          title: checkin.member_name,
          subtitle: isActive ? `Check-in: ${checkin.kurs_name || 'Unbekannter Kurs'}` : `Check-out: ${checkin.kurs_name || 'Unbekannter Kurs'}`,
          description: isActive ? `Check-in via ${checkin.checkin_method}` : `Ausgecheckt um ${new Date(checkin.checkout_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`,
          timestamp: isActive ? checkin.checkin_time : checkin.checkout_time,
          date: new Date(checkin.checkin_time).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
        });
      });

      logger.info('${checkins.length} echte Check-ins/Checkouts geladen');
    } catch (e) {
      logger.warn('⚠️ Echte Check-ins konnten nicht geladen werden:', e.message);
    }

    // 2. Neue Mitglieder von heute laden + dojo_id Filter
    try {
      const [neueMitglieder] = await db.promise().query(`
        SELECT
          mitglied_id,
          CONCAT(vorname, ' ', nachname) as member_name,
          eintrittsdatum
        FROM mitglieder
        WHERE DATE(eintrittsdatum) = CURDATE()${dojoFilter}
        ORDER BY eintrittsdatum DESC
        LIMIT 5
      `);

      neueMitglieder.forEach(mitglied => {
        activities.push({
          id: `registration_${mitglied.mitglied_id}`,
          type: 'registration',
          member: mitglied.member_name,
          title: mitglied.member_name,
          subtitle: 'Neue Anmeldung',
          description: 'Neues Mitglied registriert',
          timestamp: mitglied.eintrittsdatum,
          date: new Date(mitglied.eintrittsdatum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
        });
      });

      logger.debug('Neue Mitglieder geladen', { count: neueMitglieder.length, dojo_id: dojo_id || 'all' });
    } catch (e) {
      logger.warn('⚠️ Neue Mitglieder konnten nicht geladen werden:', e.message);
    }

    // 3. Neueste Beiträge laden + dojo_id Filter
    try {
      const [beitraege] = await db.promise().query(`
        SELECT
          b.beitrag_id,
          CONCAT(m.vorname, ' ', m.nachname) as member_name,
          b.betrag,
          b.zahlungsdatum
        FROM beitraege b
        JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
        WHERE DATE(b.zahlungsdatum) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        AND b.bezahlt = 1${dojoFilter}
        ORDER BY b.zahlungsdatum DESC
        LIMIT 5
      `);

      beitraege.forEach(beitrag => {
        activities.push({
          id: `payment_${beitrag.beitrag_id}`,
          type: 'payment',
          member: beitrag.member_name,
          title: beitrag.member_name,
          subtitle: 'Beitrag bezahlt',
          description: `Beitrag bezahlt: €${beitrag.betrag}`,
          timestamp: beitrag.zahlungsdatum,
          date: new Date(beitrag.zahlungsdatum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
        });
      });

      logger.info('${beitraege.length} Beiträge geladen');
    } catch (e) {
      logger.warn('⚠️ Beiträge konnten nicht geladen werden:', e.message);
    }

    // Nach Zeitstempel sortieren
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    logger.debug('📋 ${activities.length} Recent Activities bereitgestellt');
    
    res.json({
      success: true,
      activities: activities.slice(0, 15), // Nur die neuesten 15
      total: activities.length
    });

  } catch (error) {
    logger.error('Fehler beim Laden der Recent Activities:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der Recent Activities' });
  }
});

// GET /api/dashboard/checkin/today - GEÄNDERT: Nur aktive Check-ins + dojo_id Filter
router.get('/checkin/today', async (req, res) => {
  try {
    // 🔒 SICHER: Verwende getSecureDojoId statt req.query.dojo_id
    const secureDojoId = getSecureDojoId(req);
    logger.debug('Check-in Daten werden geladen', { dojo_id: secureDojoId || 'all' });

    // 🔒 KRITISCHER DOJO-FILTER
    const dojoFilter = secureDojoId ? ` AND m.dojo_id = ${secureDojoId}` : '';

    // GEÄNDERT: Nur aktive Check-ins laden + dojo_id Filter
    const [checkins] = await db.promise().query(`
      SELECT
        c.checkin_id,
        c.checkin_time,
        c.checkin_method,
        c.status,
        CONCAT(m.vorname, ' ', m.nachname) as member_name,
        k.gruppenname as kurs_name,
        CONCAT(TIME_FORMAT(s.uhrzeit_start, '%H:%i'), '-', TIME_FORMAT(s.uhrzeit_ende, '%H:%i')) as zeit
      FROM checkins c
      JOIN mitglieder m ON c.mitglied_id = m.mitglied_id
      LEFT JOIN stundenplan s ON c.stundenplan_id = s.stundenplan_id
      LEFT JOIN kurse k ON s.kurs_id = k.kurs_id
      WHERE DATE(c.checkin_time) = CURDATE() AND c.status = 'active'${dojoFilter}
      ORDER BY c.checkin_time DESC
    `);

    const stats = {
      total_checkins: checkins.length,
      currently_training: checkins.length, // Alle sind aktiv
      completed_sessions: 0 // Keine completed hier
    };

    logger.info('${checkins.length} aktive Check-ins für heute geladen');

    res.json({
      success: true,
      checkins: checkins,
      stats: stats,
      date: new Date().toISOString().split('T')[0]
    });

  } catch (error) {
    logger.error('Fehler beim Laden der Check-in Daten:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der Check-in Daten' });
  }
});

// POST /api/dashboard/checkin - Weiterleitung an echte Check-in API
router.post('/checkin', (req, res) => {
  logger.debug('📱 Dashboard Check-in - Weiterleitung an /api/checkin/multi-course');
  
  res.status(301).json({
    error: 'Deprecated endpoint',
    message: 'Bitte verwenden Sie /api/checkin/multi-course',
    redirect: '/api/checkin/multi-course'
  });
});

// POST /api/dashboard/checkout - Weiterleitung an echte Check-in API
router.post('/checkout', (req, res) => {
  logger.debug('📱 Dashboard Check-out - Feature noch nicht implementiert');
  
  res.status(501).json({
    error: 'Check-out Feature noch nicht implementiert',
    message: 'Check-out wird in einer zukünftigen Version verfügbar sein'
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/cockpit-uebersicht
// Liefert kompakte Kennzahlen für das "Heute & diese Woche" Widget:
//   - Geburtstage heute / diese Woche
//   - Ablaufende Verträge (nächste 30 Tage)
//   - Offene Mahnungen (überfällige Rechnungen)
//   - Anstehende Lastschrift-Zeitpläne (nächste 7 Tage)
// ──────────────────────────────────────────────────────────────────────────────
router.get('/cockpit-uebersicht', async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const pool = db.promise();

    // Dojo-Filter für Tabellen mit direkter dojo_id-Spalte
    const dojoFilter     = secureDojoId ? ' AND dojo_id = ?' : '';
    const dojoFilterM    = secureDojoId ? ' AND m.dojo_id = ?' : '';
    const dojoParams     = secureDojoId ? [secureDojoId] : [];

    // ── 1. Geburtstage heute ────────────────────────────────────────────────
    const [[{ geburtstage_heute }]] = await pool.query(
      `SELECT COUNT(*) AS geburtstage_heute
       FROM mitglieder
       WHERE aktiv = 1
         AND geburtsdatum IS NOT NULL
         AND DAY(geburtsdatum)   = DAY(CURDATE())
         AND MONTH(geburtsdatum) = MONTH(CURDATE())
         ${dojoFilter}`,
      dojoParams
    );

    // ── 2. Geburtstage diese Woche (nächste 7 Tage inkl. heute) ────────────
    // Verwendet DAYOFYEAR mit Jahreswechsel-Handling via MOD
    const [[{ geburtstage_woche }]] = await pool.query(
      `SELECT COUNT(*) AS geburtstage_woche
       FROM mitglieder
       WHERE aktiv = 1
         AND geburtsdatum IS NOT NULL
         AND (
           MOD(DAYOFYEAR(DATE(CONCAT(YEAR(CURDATE()), '-', MONTH(geburtsdatum), '-', DAY(geburtsdatum)))) - DAYOFYEAR(CURDATE()) + 366, 366) < 7
         )
         ${dojoFilter}`,
      dojoParams
    );

    // ── 3. Ablaufende Verträge (nächste 30 Tage) ────────────────────────────
    const [[{ ablaufende_vertraege }]] = await pool.query(
      `SELECT COUNT(*) AS ablaufende_vertraege
       FROM vertraege v
       JOIN mitglieder m ON m.mitglied_id = v.mitglied_id
       WHERE v.status = 'aktiv'
         AND v.vertragsende IS NOT NULL
         AND v.vertragsende BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
         ${dojoFilterM}`,
      dojoParams
    );

    // ── 4. Offene Mahnungen (überfällige Rechnungen) ────────────────────────
    // Rechnungen ohne eigene dojo_id → JOIN über mitglieder
    const [[{ offene_mahnungen }]] = await pool.query(
      `SELECT COUNT(*) AS offene_mahnungen
       FROM rechnungen r
       JOIN mitglieder m ON m.mitglied_id = r.mitglied_id
       WHERE (r.status = 'ueberfaellig'
              OR (r.status = 'offen' AND r.faelligkeitsdatum < CURDATE()))
         ${dojoFilterM}`,
      dojoParams
    );

    // ── 5. Anstehende Lastschriften (Zeitpläne, deren Ausführungstag in den ──
    //       nächsten 7 Tagen liegt und die aktiv sind)
    let anstehende_lastschriften = 0;
    try {
      const [[{ ls_count }]] = await pool.query(
        `SELECT COUNT(*) AS ls_count
         FROM lastschrift_zeitplaene
         WHERE aktiv = 1
           AND ausfuehrungstag BETWEEN DAY(CURDATE()) AND DAY(DATE_ADD(CURDATE(), INTERVAL 7 DAY))
           ${dojoFilter}`,
        dojoParams
      );
      anstehende_lastschriften = ls_count;
    } catch (_) {
      // Tabelle existiert evtl. noch nicht in allen Dojos — ignorieren
    }

    logger.debug('CockpitUebersicht geladen', {
      dojo_id: secureDojoId,
      geburtstage_heute,
      geburtstage_woche,
      ablaufende_vertraege,
      offene_mahnungen,
      anstehende_lastschriften,
    });

    // ── 6. Neue Verträge (nicht zur Kenntnis genommen) ───────────────────────
    let neue_vertraege_unbestaetigt = 0;
    try {
      const [[{ nv_count }]] = await pool.query(
        `SELECT COUNT(*) AS nv_count
         FROM vertraege v
         JOIN mitglieder m ON m.mitglied_id = v.mitglied_id
         WHERE v.admin_acknowledged_at IS NULL
           ${dojoFilterM}`,
        dojoParams
      );
      neue_vertraege_unbestaetigt = Number(nv_count) || 0;
    } catch (_) { /* Spalte noch nicht migriert — ignorieren */ }

    // ── 7. Fehlgeschlagene Lastschriften (offene, nicht bereits bezahlt) ──────
    let fehlgeschlagene_lastschriften = 0;
    try {
      const [[{ fl_count }]] = await pool.query(
        `SELECT COUNT(DISTINCT slt.mitglied_id, slb.monat, slb.jahr) AS fl_count
         FROM stripe_lastschrift_transaktion slt
         JOIN stripe_lastschrift_batch slb ON slt.batch_id = slb.batch_id
         JOIN mitglieder m ON slt.mitglied_id = m.mitglied_id
         WHERE slt.status = 'failed'
           AND slt.id = (
             SELECT slt2.id FROM stripe_lastschrift_transaktion slt2
             JOIN stripe_lastschrift_batch slb2 ON slt2.batch_id = slb2.batch_id
             WHERE slt2.mitglied_id = slt.mitglied_id AND slt2.status = 'failed'
               AND slb2.monat = slb.monat AND slb2.jahr = slb.jahr
             ORDER BY slt2.created_at DESC LIMIT 1
           )
           AND NOT EXISTS (
             SELECT 1 FROM stripe_lastschrift_transaktion slt3
             JOIN stripe_lastschrift_batch slb3 ON slt3.batch_id = slb3.batch_id
             WHERE slt3.mitglied_id = slt.mitglied_id
               AND slt3.status IN ('succeeded','processing')
               AND slb3.monat = slb.monat AND slb3.jahr = slb.jahr
           )
           ${dojoFilterM}`,
        dojoParams
      );
      fehlgeschlagene_lastschriften = Number(fl_count) || 0;
    } catch (_) { /* Tabelle existiert evtl. noch nicht — ignorieren */ }

    res.json({
      geburtstage_heute:                Number(geburtstage_heute)             || 0,
      geburtstage_woche:                Number(geburtstage_woche)             || 0,
      ablaufende_vertraege:             Number(ablaufende_vertraege)          || 0,
      offene_mahnungen:                 Number(offene_mahnungen)              || 0,
      anstehende_lastschriften:         Number(anstehende_lastschriften)      || 0,
      neue_vertraege_unbestaetigt,
      fehlgeschlagene_lastschriften,
    });
  } catch (error) {
    logger.error('CockpitUebersicht Fehler:', error);
    res.status(500).json({ error: error.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/geburtstage-details?typ=heute|woche
// Liefert die Geburtstagsliste (heute oder nächste 7 Tage) mit Name, Datum, Alter
// ──────────────────────────────────────────────────────────────────────────────
router.get('/geburtstage-details', async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    const typ = req.query.typ === 'heute' ? 'heute' : 'woche';
    const pool = db.promise();
    const dojoFilter = secureDojoId ? ' AND dojo_id = ?' : '';
    const dojoParams = secureDojoId ? [secureDojoId] : [];

    const tagesBedingung = typ === 'heute'
      ? `DAY(geburtsdatum) = DAY(CURDATE()) AND MONTH(geburtsdatum) = MONTH(CURDATE())`
      : `MOD(DAYOFYEAR(DATE(CONCAT(YEAR(CURDATE()), '-', MONTH(geburtsdatum), '-', DAY(geburtsdatum)))) - DAYOFYEAR(CURDATE()) + 366, 366) < 7`;

    const [rows] = await pool.query(
      `SELECT
         vorname,
         nachname,
         geburtsdatum,
         YEAR(CURDATE()) - YEAR(geburtsdatum) AS wird_jahre,
         DATE(CONCAT(YEAR(CURDATE()), '-', LPAD(MONTH(geburtsdatum),2,'0'), '-', LPAD(DAY(geburtsdatum),2,'0'))) AS geburtstag_dieses_jahr,
         MOD(DAYOFYEAR(DATE(CONCAT(YEAR(CURDATE()), '-', MONTH(geburtsdatum), '-', DAY(geburtsdatum)))) - DAYOFYEAR(CURDATE()) + 366, 366) AS tage_bis
       FROM mitglieder
       WHERE aktiv = 1
         AND geburtsdatum IS NOT NULL
         AND (${tagesBedingung})
         ${dojoFilter}
       ORDER BY tage_bis ASC`,
      dojoParams
    );

    res.json(rows);
  } catch (error) {
    logger.error('Geburtstage-Details Fehler:', error);
    res.status(500).json({ error: error.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/dashboard/neue-vertraege-email
// Sendet eine E-Mail-Übersicht der neuen Verträge (heute oder diese Woche)
// ──────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/neue-vertraege-details
// Liefert unbestätigte neue Verträge mit Mitgliedname, Laufzeit, Beitrag,
// angelegtvon (created_by → users)
// ──────────────────────────────────────────────────────────────────────────────
router.get('/neue-vertraege-details', async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    if (!secureDojoId) return res.status(400).json({ error: 'Kein Dojo ausgewählt' });
    const pool = db.promise();

    const [rows] = await pool.query(
      `SELECT
         v.id,
         m.vorname, m.nachname,
         v.vertragsbeginn, v.vertragsende,
         COALESCE(v.monatlicher_beitrag, v.monatsbeitrag) AS beitrag_monatlich,
         v.mindestlaufzeit_monate,
         v.automatische_verlaengerung,
         v.created_at,
         u.username AS angelegt_von_username,
         CONCAT(mu.vorname, ' ', mu.nachname) AS angelegt_von_name
       FROM vertraege v
       JOIN mitglieder m ON m.mitglied_id = v.mitglied_id
       LEFT JOIN users u ON u.id = v.created_by
       LEFT JOIN mitglieder mu ON mu.mitglied_id = u.mitglied_id
       WHERE v.admin_acknowledged_at IS NULL
         AND m.dojo_id = ?
       ORDER BY v.created_at DESC`,
      [secureDojoId]
    );

    res.json(rows);
  } catch (error) {
    logger.error('Neue-Verträge-Details Fehler:', error);
    res.status(500).json({ error: error.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/dashboard/neue-vertraege-acknowledge
// Markiert alle unbestätigten Verträge als "zur Kenntnis genommen"
// ──────────────────────────────────────────────────────────────────────────────
router.post('/neue-vertraege-acknowledge', async (req, res) => {
  try {
    const secureDojoId = getSecureDojoId(req);
    if (!secureDojoId) return res.status(400).json({ error: 'Kein Dojo ausgewählt' });
    const pool = db.promise();

    const [result] = await pool.query(
      `UPDATE vertraege v
       JOIN mitglieder m ON m.mitglied_id = v.mitglied_id
       SET v.admin_acknowledged_at = NOW()
       WHERE v.admin_acknowledged_at IS NULL
         AND m.dojo_id = ?`,
      [secureDojoId]
    );

    res.json({ success: true, count: result.affectedRows });
  } catch (error) {
    logger.error('Neue-Verträge-Acknowledge Fehler:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;