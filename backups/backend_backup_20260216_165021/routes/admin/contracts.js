/**
 * Admin Contracts Routes
 * Vertrags-Übersicht für Super-Admin
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();
const { requireSuperAdmin } = require('./shared');

// GET /contracts - Vertrags-Übersicht
router.get('/contracts', requireSuperAdmin, async (req, res) => {
  const currentYear = new Date().getFullYear();

  try {
    // 1. Aktive Verträge
    const [activeContracts] = await db.promise().query(`
      SELECT d.id, d.dojoname, d.subscription_status, d.subscription_plan,
        d.subscription_started_at as subscription_start, d.subscription_ends_at as subscription_end,
        d.trial_ends_at as trial_end, NULL as custom_pricing, NULL as custom_notes,
        DATEDIFF(d.subscription_ends_at, CURDATE()) as tage_bis_ende,
        COUNT(DISTINCT m.mitglied_id) as mitglied_count
      FROM dojo d LEFT JOIN mitglieder m ON d.id = m.dojo_id AND m.aktiv = 1
      WHERE d.subscription_status IN ('trial', 'active')
      GROUP BY d.id ORDER BY d.subscription_ends_at ASC
    `);

    // 2. Bald ablaufende (30 Tage)
    const [upcomingRenewals30] = await db.promise().query(`
      SELECT d.id, d.dojoname, d.subscription_plan, d.subscription_ends_at as subscription_end,
        NULL as custom_pricing, DATEDIFF(d.subscription_ends_at, CURDATE()) as tage_bis_ende
      FROM dojo d WHERE d.subscription_status = 'active'
        AND d.subscription_ends_at BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
      ORDER BY d.subscription_ends_at ASC
    `);

    const [upcomingRenewals60] = await db.promise().query(`
      SELECT COUNT(*) as count FROM dojo
      WHERE subscription_status = 'active'
        AND subscription_ends_at BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
    `);

    const [upcomingRenewals90] = await db.promise().query(`
      SELECT COUNT(*) as count FROM dojo
      WHERE subscription_status = 'active'
        AND subscription_ends_at BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)
    `);

    // 3. Abgelaufene (letzten 90 Tage)
    const [expiredContracts] = await db.promise().query(`
      SELECT d.id, d.dojoname, d.subscription_plan, d.subscription_ends_at as subscription_end,
        d.subscription_status, ABS(DATEDIFF(CURDATE(), d.subscription_ends_at)) as tage_abgelaufen
      FROM dojo d WHERE d.subscription_status = 'expired'
        AND d.subscription_ends_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
      ORDER BY d.subscription_ends_at DESC
    `);

    // 4. Contract Stats
    const [contractStats] = await db.promise().query(`
      SELECT subscription_status, COUNT(*) as anzahl, 0 as custom_count
      FROM dojo GROUP BY subscription_status
    `);

    // 5. Trial Conversions
    const [trialConversions] = await db.promise().query(`
      SELECT d.id, d.dojoname, d.subscription_started_at as subscription_start,
        d.trial_ends_at as trial_end, DATEDIFF(d.subscription_started_at, d.created_at) as trial_dauer_tage
      FROM dojo d WHERE d.subscription_status = 'active'
        AND d.trial_ends_at IS NOT NULL
        AND d.subscription_started_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
      ORDER BY d.subscription_started_at DESC
    `);

    // 6. Durchschnittliche Vertragslaufzeit
    const [avgContractDuration] = await db.promise().query(`
      SELECT AVG(DATEDIFF(subscription_ends_at, subscription_started_at)) as avg_tage,
        MIN(DATEDIFF(subscription_ends_at, subscription_started_at)) as min_tage,
        MAX(DATEDIFF(subscription_ends_at, subscription_started_at)) as max_tage
      FROM dojo WHERE subscription_status IN ('active', 'expired')
        AND subscription_started_at IS NOT NULL AND subscription_ends_at IS NOT NULL
    `);

    // 7. Monatliche Vertragsabschlüsse
    const [monthlyContracts] = await db.promise().query(`
      SELECT MONTH(subscription_started_at) as monat, COUNT(*) as anzahl_vertraege,
        COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as aktiv,
        COUNT(CASE WHEN subscription_status = 'expired' THEN 1 END) as abgelaufen
      FROM dojo WHERE YEAR(subscription_started_at) = ? AND subscription_started_at IS NOT NULL
      GROUP BY MONTH(subscription_started_at) ORDER BY monat ASC
    `, [currentYear]);

    // 8. Renewal Rate
    const [renewalStats] = await db.promise().query(`
      SELECT COUNT(*) as total_expired,
        SUM(CASE WHEN subscription_status = 'active' AND subscription_ends_at < CURDATE() THEN 1 ELSE 0 END) as renewed
      FROM dojo WHERE subscription_ends_at IS NOT NULL
    `);

    const renewalRate = renewalStats[0].total_expired > 0
      ? Math.round((renewalStats[0].renewed / renewalStats[0].total_expired) * 100) : 0;

    res.json({
      success: true,
      contracts: {
        activeContracts, expiredContracts, trialConversions,
        upcomingRenewals: {
          next30Days: upcomingRenewals30,
          count60Days: parseInt(upcomingRenewals60[0].count),
          count90Days: parseInt(upcomingRenewals90[0].count)
        },
        contractStats: contractStats.reduce((acc, stat) => {
          acc[stat.subscription_status] = { anzahl: parseInt(stat.anzahl), custom_count: parseInt(stat.custom_count) };
          return acc;
        }, {}),
        avgContractDuration: {
          avg_tage: avgContractDuration[0].avg_tage ? Math.round(avgContractDuration[0].avg_tage) : 0,
          min_tage: avgContractDuration[0].min_tage || 0,
          max_tage: avgContractDuration[0].max_tage || 0
        },
        monthlyContracts: monthlyContracts.map(m => ({
          monat: parseInt(m.monat), anzahl_vertraege: parseInt(m.anzahl_vertraege),
          aktiv: parseInt(m.aktiv), abgelaufen: parseInt(m.abgelaufen)
        })),
        renewalRate
      }
    });
  } catch (err) {
    logger.error('Fehler beim Laden der Vertragsdaten:', err.message);
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Vertragsdaten', error: err.message });
  }
});

module.exports = router;
