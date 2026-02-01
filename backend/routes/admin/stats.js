/**
 * Admin Statistics Routes
 * Globale und TDA-spezifische Statistiken
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();
const { requireSuperAdmin } = require('./shared');

// GET /global-stats - Aggregierte Statistiken über alle Dojos
router.get('/global-stats', requireSuperAdmin, async (req, res) => {
  try {
    const stats = {};

    // 1. Dojo-Übersicht
    const [dojoStats] = await db.promise().query(`
      SELECT COUNT(*) as total_dojos, SUM(ist_aktiv) as active_dojos, SUM(mitgliederzahl_aktuell) as total_members_declared
      FROM dojo
    `);
    stats.dojos = dojoStats[0];

    // 2. Mitglieder (alle Dojos)
    const [memberStats] = await db.promise().query(`
      SELECT COUNT(*) as total_members,
        SUM(CASE WHEN aktiv = 1 THEN 1 ELSE 0 END) as active_members,
        COUNT(DISTINCT dojo_id) as dojos_with_members
      FROM mitglieder
    `);
    stats.members = memberStats[0];

    // 3. Kurse
    const [courseStats] = await db.promise().query(`SELECT COUNT(*) as total_courses, COUNT(DISTINCT dojo_id) as dojos_with_courses FROM kurse`);
    stats.courses = courseStats[0];

    // 4. Trainer
    const [trainerStats] = await db.promise().query(`SELECT COUNT(*) as total_trainers, COUNT(DISTINCT dojo_id) as dojos_with_trainers FROM trainer`);
    stats.trainers = trainerStats[0];

    // 5. Check-ins heute
    const [checkinStats] = await db.promise().query(`SELECT COUNT(*) as active_checkins_today FROM checkins WHERE DATE(checkin_time) = CURDATE() AND status = 'active'`);
    stats.checkins = checkinStats[0];

    // 6. Offene Beiträge
    const [beitraegeStats] = await db.promise().query(`SELECT COUNT(*) as open_payments, SUM(betrag) as open_amount FROM beitraege WHERE bezahlt = 0`);
    stats.payments = beitraegeStats[0];

    // 7. Top Dojos
    const [topDojos] = await db.promise().query(`
      SELECT d.id, d.dojoname, d.subdomain,
        COUNT(DISTINCT m.mitglied_id) as member_count,
        COUNT(DISTINCT k.kurs_id) as course_count,
        COUNT(DISTINCT t.trainer_id) as trainer_count
      FROM dojo d
      LEFT JOIN mitglieder m ON d.id = m.dojo_id AND m.aktiv = 1
      LEFT JOIN kurse k ON d.id = k.dojo_id
      LEFT JOIN trainer t ON d.id = t.dojo_id
      WHERE d.ist_aktiv = 1
      GROUP BY d.id ORDER BY member_count DESC LIMIT 10
    `);
    stats.top_dojos = topDojos;

    // 8. Server-Speicherplatz
    try {
      const checkDiskSpace = require('check-disk-space').default;
      const diskInfo = await checkDiskSpace('/');
      const totalBytes = diskInfo.size || 0;
      const freeBytes = diskInfo.free || 0;
      const usedBytes = totalBytes - freeBytes;
      stats.storage = {
        total_gb: (totalBytes / (1024 * 1024 * 1024)).toFixed(1),
        used_gb: (usedBytes / (1024 * 1024 * 1024)).toFixed(1),
        available_gb: (freeBytes / (1024 * 1024 * 1024)).toFixed(1),
        percent_used: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0
      };
    } catch (diskError) {
      stats.storage = { total_gb: '0', used_gb: '0', available_gb: '0', percent_used: 0 };
    }

    res.json({ success: true, stats, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Fehler beim Abrufen der globalen Statistiken:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken', details: error.message });
  }
});

// GET /tda-stats - Statistiken für TDA International (dojo_id=2)
router.get('/tda-stats', requireSuperAdmin, async (req, res) => {
  try {
    const TDA_DOJO_ID = 2;
    const stats = {};

    const [memberStats] = await db.promise().query(`
      SELECT COUNT(*) as total_members, SUM(CASE WHEN aktiv = 1 THEN 1 ELSE 0 END) as active_members
      FROM mitglieder WHERE dojo_id = ?
    `, [TDA_DOJO_ID]);
    stats.members = memberStats[0];

    const [courseStats] = await db.promise().query('SELECT COUNT(*) as total_courses FROM kurse WHERE dojo_id = ?', [TDA_DOJO_ID]);
    stats.courses = courseStats[0];

    const [trainerStats] = await db.promise().query('SELECT COUNT(*) as total_trainers FROM trainer WHERE dojo_id = ?', [TDA_DOJO_ID]);
    stats.trainers = trainerStats[0];

    const [checkinStats] = await db.promise().query(`
      SELECT COUNT(*) as active_checkins_today FROM checkins c
      JOIN mitglieder m ON c.mitglied_id = m.mitglied_id
      WHERE m.dojo_id = ? AND DATE(c.checkin_time) = CURDATE() AND c.status = 'active'
    `, [TDA_DOJO_ID]);
    stats.checkins = checkinStats[0];

    const [beitraegeStats] = await db.promise().query(`
      SELECT COUNT(*) as open_payments, SUM(betrag) as open_amount
      FROM beitraege WHERE dojo_id = ? AND bezahlt = 0
    `, [TDA_DOJO_ID]);
    stats.payments = beitraegeStats[0];

    res.json({
      success: true, dojo_id: TDA_DOJO_ID,
      dojo_name: 'Tiger & Dragon Association - International',
      stats, timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Fehler beim Abrufen der TDA Statistiken:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der TDA Statistiken', details: error.message });
  }
});

// GET /statistics - Erweiterte Statistiken für Charts
router.get('/statistics', requireSuperAdmin, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    // 1. Mitglieder-Entwicklung (letzte 12 Monate)
    const [memberTrend] = await db.promise().query(`
      SELECT DATE_FORMAT(beigetreten_am, '%Y-%m') as monat, COUNT(*) as neue_mitglieder
      FROM mitglieder WHERE beigetreten_am >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(beigetreten_am, '%Y-%m') ORDER BY monat ASC
    `);

    // 2. Umsatz pro Dojo
    const [revenuePerDojo] = await db.promise().query(`
      SELECT d.id, d.dojoname, d.jahresumsatz_aktuell as umsatz, d.steuer_status,
        COUNT(DISTINCT m.mitglied_id) as mitglieder_anzahl
      FROM dojo d LEFT JOIN mitglieder m ON d.id = m.dojo_id
      GROUP BY d.id ORDER BY d.jahresumsatz_aktuell DESC
    `);

    // 3. Subscription Status Verteilung
    const [subscriptionDistribution] = await db.promise().query(`
      SELECT subscription_status, COUNT(*) as anzahl FROM dojo GROUP BY subscription_status
    `);

    // 4. Umsatz-Entwicklung
    const [revenueTrend] = await db.promise().query(`
      SELECT MONTH(r.rechnungsdatum) as monat, SUM(r.gesamtsumme) as umsatz
      FROM rechnungen r WHERE YEAR(r.rechnungsdatum) = ?
      GROUP BY MONTH(r.rechnungsdatum) ORDER BY monat ASC
    `, [currentYear]);

    // 5. Top Dojos nach Mitgliedern
    const [topDojosByMembers] = await db.promise().query(`
      SELECT d.dojoname, COUNT(m.mitglied_id) as mitglieder_anzahl, d.jahresumsatz_aktuell as umsatz
      FROM dojo d LEFT JOIN mitglieder m ON d.id = m.dojo_id AND m.aktiv = 1
      GROUP BY d.id ORDER BY mitglieder_anzahl DESC LIMIT 10
    `);

    // 6. Aktiv vs. Inaktiv
    const [memberStatus] = await db.promise().query('SELECT aktiv, COUNT(*) as anzahl FROM mitglieder GROUP BY aktiv');

    // 7. Trial Conversion Rate
    const [trialStats] = await db.promise().query(`
      SELECT COUNT(CASE WHEN subscription_status = 'trial' THEN 1 END) as trial_count,
        COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as active_count,
        COUNT(CASE WHEN subscription_status = 'expired' THEN 1 END) as expired_count,
        COUNT(*) as total_count
      FROM dojo
    `);

    const stats = trialStats[0];
    const conversionRate = stats.total_count > 0
      ? ((stats.active_count / (stats.active_count + stats.expired_count)) * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      statistics: {
        memberTrend: memberTrend.map(row => ({ monat: row.monat, neue_mitglieder: parseInt(row.neue_mitglieder) })),
        revenuePerDojo: revenuePerDojo.map(row => ({
          dojoname: row.dojoname, umsatz: parseFloat(row.umsatz || 0),
          mitglieder: parseInt(row.mitglieder_anzahl || 0), steuer_status: row.steuer_status
        })),
        subscriptionDistribution: subscriptionDistribution.map(row => ({ status: row.subscription_status, anzahl: parseInt(row.anzahl) })),
        revenueTrend: revenueTrend.map(row => ({ monat: parseInt(row.monat), umsatz: parseFloat(row.umsatz || 0) })),
        topDojos: topDojosByMembers.map(row => ({
          dojoname: row.dojoname, mitglieder: parseInt(row.mitglieder_anzahl), umsatz: parseFloat(row.umsatz || 0)
        })),
        memberStatus: {
          aktiv: memberStatus.find(s => s.aktiv === 1)?.anzahl || 0,
          inaktiv: memberStatus.find(s => s.aktiv === 0)?.anzahl || 0
        },
        conversionRate: parseFloat(conversionRate),
        trialStats: { trial: stats.trial_count, active: stats.active_count, expired: stats.expired_count }
      }
    });
  } catch (error) {
    logger.error('Fehler beim Laden der Statistiken:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Statistiken', details: error.message });
  }
});

module.exports = router;
