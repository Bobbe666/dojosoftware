/**
 * Admin Finance Routes
 * Finanz-Übersicht und Analysen
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();
const { requireSuperAdmin } = require('./shared');

// GET /finance - Finanz-Übersicht
router.get('/finance', requireSuperAdmin, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    // 1. Gesamt-Umsatz und KPIs
    const [overallStats] = await db.promise().query(`
      SELECT SUM(gesamtsumme) as gesamt_umsatz, COUNT(*) as anzahl_rechnungen, AVG(gesamtsumme) as durchschnitt_rechnung,
        SUM(CASE WHEN status = 'bezahlt' THEN gesamtsumme ELSE 0 END) as bezahlt_summe,
        SUM(CASE WHEN status = 'offen' THEN gesamtsumme ELSE 0 END) as offen_summe,
        COUNT(CASE WHEN status = 'bezahlt' THEN 1 END) as bezahlt_anzahl,
        COUNT(CASE WHEN status = 'offen' THEN 1 END) as offen_anzahl
      FROM rechnungen WHERE YEAR(rechnungsdatum) = ?
    `, [currentYear]);

    // 2. Monatliche Einnahmen
    const [monthlyRevenue] = await db.promise().query(`
      SELECT MONTH(rechnungsdatum) as monat, SUM(gesamtsumme) as umsatz, COUNT(*) as anzahl_rechnungen,
        SUM(CASE WHEN status = 'bezahlt' THEN gesamtsumme ELSE 0 END) as bezahlt,
        SUM(CASE WHEN status = 'offen' THEN gesamtsumme ELSE 0 END) as offen
      FROM rechnungen WHERE YEAR(rechnungsdatum) = ?
      GROUP BY MONTH(rechnungsdatum) ORDER BY monat ASC
    `, [currentYear]);

    // 3. Umsatz pro Dojo
    const [revenuePerDojo] = await db.promise().query(`
      SELECT d.id, d.dojoname, COALESCE(SUM(r.gesamtsumme), 0) as umsatz, COUNT(r.rechnung_id) as anzahl_rechnungen,
        COALESCE(SUM(CASE WHEN r.status = 'bezahlt' THEN r.gesamtsumme ELSE 0 END), 0) as bezahlt,
        COALESCE(SUM(CASE WHEN r.status = 'offen' THEN r.gesamtsumme ELSE 0 END), 0) as offen
      FROM dojo d LEFT JOIN rechnungen r ON d.id = r.dojo_id AND YEAR(r.rechnungsdatum) = ?
      GROUP BY d.id ORDER BY umsatz DESC
    `, [currentYear]);

    // 4. Subscription Revenue
    const [subscriptionRevenue] = await db.promise().query(`
      SELECT d.subscription_plan, d.payment_interval, COUNT(*) as anzahl,
        CASE WHEN d.subscription_plan = 'free' THEN 0
             WHEN d.subscription_plan = 'basic' THEN 29
             WHEN d.subscription_plan = 'premium' THEN 49
             WHEN d.subscription_plan = 'enterprise' THEN 99 ELSE 0 END as preis_monatlich
      FROM dojo d WHERE subscription_status = 'active'
      GROUP BY d.subscription_plan, d.payment_interval
    `);

    let monthlyRecurringRevenue = 0;
    subscriptionRevenue.forEach(row => { monthlyRecurringRevenue += parseFloat(row.preis_monatlich) * parseInt(row.anzahl); });

    // 5. Offene Rechnungen (Top 10)
    const [openInvoices] = await db.promise().query(`
      SELECT r.rechnung_id, r.rechnungsnummer, r.rechnungsdatum, r.faelligkeitsdatum, r.gesamtsumme,
        d.dojoname, m.vorname, m.nachname, DATEDIFF(NOW(), r.faelligkeitsdatum) as tage_ueberfaellig
      FROM rechnungen r JOIN dojo d ON r.dojo_id = d.id
      LEFT JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
      WHERE r.status = 'offen' ORDER BY r.faelligkeitsdatum ASC LIMIT 10
    `);

    // 6. Zahlungsmoral
    const [paymentBehavior] = await db.promise().query(`
      SELECT COUNT(*) as gesamt,
        COUNT(CASE WHEN status = 'bezahlt' AND bezahlt_am <= faelligkeitsdatum THEN 1 END) as puenktlich,
        COUNT(CASE WHEN status = 'bezahlt' AND bezahlt_am > faelligkeitsdatum THEN 1 END) as verspaetet,
        COUNT(CASE WHEN status = 'offen' AND faelligkeitsdatum < NOW() THEN 1 END) as ueberfaellig
      FROM rechnungen WHERE YEAR(rechnungsdatum) = ?
    `, [currentYear]);

    const paymentStats = paymentBehavior[0];
    const puenktlichRate = paymentStats.gesamt > 0 ? ((paymentStats.puenktlich / paymentStats.gesamt) * 100).toFixed(1) : 0;

    // 7. Durchschnitt pro Mitglied
    const [avgRevenuePerMemberTotal] = await db.promise().query(`
      SELECT COUNT(DISTINCT m.mitglied_id) as anzahl_mitglieder, COALESCE(SUM(r.gesamtsumme), 0) as gesamt_umsatz
      FROM mitglieder m LEFT JOIN rechnungen r ON m.mitglied_id = r.mitglied_id AND YEAR(r.rechnungsdatum) = ?
      WHERE m.aktiv = 1
    `, [currentYear]);

    const avgPerMemberTotal = avgRevenuePerMemberTotal[0].anzahl_mitglieder > 0
      ? (avgRevenuePerMemberTotal[0].gesamt_umsatz / avgRevenuePerMemberTotal[0].anzahl_mitglieder).toFixed(2) : 0;

    // 8. Durchschnitt pro Dojo
    const [avgRevenuePerMember] = await db.promise().query(`
      SELECT d.id, d.dojoname, COUNT(DISTINCT m.mitglied_id) as anzahl_mitglieder,
        COALESCE(SUM(r.gesamtsumme), 0) as gesamt_umsatz,
        CASE WHEN COUNT(DISTINCT m.mitglied_id) > 0
          THEN COALESCE(SUM(r.gesamtsumme), 0) / COUNT(DISTINCT m.mitglied_id) ELSE 0 END as avg_umsatz_pro_mitglied
      FROM dojo d LEFT JOIN mitglieder m ON d.id = m.dojo_id AND m.aktiv = 1
      LEFT JOIN rechnungen r ON m.mitglied_id = r.mitglied_id AND YEAR(r.rechnungsdatum) = ?
      GROUP BY d.id ORDER BY avg_umsatz_pro_mitglied DESC
    `, [currentYear]);

    // 9. VERBAND: Mitgliedschaften Statistiken
    const [verbandStats] = await db.promise().query(`
      SELECT
        COUNT(*) as gesamt,
        COUNT(CASE WHEN status = 'aktiv' THEN 1 END) as aktiv,
        COUNT(CASE WHEN status = 'ausstehend' THEN 1 END) as ausstehend,
        COUNT(CASE WHEN status = 'abgelaufen' THEN 1 END) as abgelaufen,
        COUNT(CASE WHEN typ = 'dojo' THEN 1 END) as dojos,
        COUNT(CASE WHEN typ = 'einzelperson' THEN 1 END) as einzelpersonen,
        COALESCE(SUM(CASE WHEN status = 'aktiv' THEN jahresbeitrag ELSE 0 END), 0) as jahresbeitrag_aktiv,
        COALESCE(SUM(jahresbeitrag), 0) as jahresbeitrag_gesamt
      FROM verbandsmitgliedschaften
    `);

    // 10. VERBAND: Zahlungen
    const [verbandZahlungen] = await db.promise().query(`
      SELECT
        COUNT(*) as anzahl,
        COALESCE(SUM(CASE WHEN status = 'bezahlt' THEN betrag_brutto ELSE 0 END), 0) as bezahlt_summe,
        COALESCE(SUM(CASE WHEN status = 'offen' THEN betrag_brutto ELSE 0 END), 0) as offen_summe,
        COALESCE(SUM(CASE WHEN status = 'offen' AND faellig_am < CURDATE() THEN betrag_brutto ELSE 0 END), 0) as ueberfaellig_summe
      FROM verbandsmitgliedschaft_zahlungen
      WHERE YEAR(rechnungsdatum) = ?
    `, [currentYear]);

    // 11. VERBAND: Breakdown nach Typ
    const [verbandBreakdown] = await db.promise().query(`
      SELECT
        typ,
        COUNT(*) as anzahl,
        COALESCE(SUM(jahresbeitrag), 0) as jahresbeitrag_summe,
        AVG(jahresbeitrag) as durchschnitt_beitrag
      FROM verbandsmitgliedschaften
      WHERE status = 'aktiv'
      GROUP BY typ
    `);

    res.json({
      success: true,
      finance: {
        overview: {
          gesamt_umsatz: parseFloat(overallStats[0].gesamt_umsatz || 0),
          anzahl_rechnungen: parseInt(overallStats[0].anzahl_rechnungen || 0),
          durchschnitt_rechnung: parseFloat(overallStats[0].durchschnitt_rechnung || 0),
          bezahlt_summe: parseFloat(overallStats[0].bezahlt_summe || 0),
          offen_summe: parseFloat(overallStats[0].offen_summe || 0),
          bezahlt_anzahl: parseInt(overallStats[0].bezahlt_anzahl || 0),
          offen_anzahl: parseInt(overallStats[0].offen_anzahl || 0)
        },
        monthlyRevenue: monthlyRevenue.map(row => ({
          monat: parseInt(row.monat), umsatz: parseFloat(row.umsatz || 0),
          anzahl: parseInt(row.anzahl_rechnungen || 0),
          bezahlt: parseFloat(row.bezahlt || 0), offen: parseFloat(row.offen || 0)
        })),
        revenuePerDojo: revenuePerDojo.map(row => ({
          dojoname: row.dojoname, umsatz: parseFloat(row.umsatz || 0),
          anzahl: parseInt(row.anzahl_rechnungen || 0),
          bezahlt: parseFloat(row.bezahlt || 0), offen: parseFloat(row.offen || 0)
        })),
        subscriptionRevenue: {
          mrr: parseFloat(monthlyRecurringRevenue.toFixed(2)),
          arr: parseFloat((monthlyRecurringRevenue * 12).toFixed(2)),
          breakdown: subscriptionRevenue.map(row => ({
            plan: row.subscription_plan, interval: row.payment_interval,
            anzahl: parseInt(row.anzahl), preis: parseFloat(row.preis_monatlich)
          }))
        },
        openInvoices: openInvoices.map(row => ({
          rechnung_id: row.rechnung_id, rechnungsnummer: row.rechnungsnummer,
          datum: row.rechnungsdatum, faelligkeit: row.faelligkeitsdatum,
          betrag: parseFloat(row.gesamtsumme), dojo: row.dojoname,
          kunde: row.vorname && row.nachname ? `${row.vorname} ${row.nachname}` : 'N/A',
          tage_ueberfaellig: parseInt(row.tage_ueberfaellig || 0)
        })),
        paymentBehavior: {
          gesamt: parseInt(paymentStats.gesamt), puenktlich: parseInt(paymentStats.puenktlich),
          verspaetet: parseInt(paymentStats.verspaetet), ueberfaellig: parseInt(paymentStats.ueberfaellig),
          puenktlich_rate: parseFloat(puenktlichRate)
        },
        avgRevenuePerMemberTotal: parseFloat(avgPerMemberTotal),
        avgRevenuePerMember: avgRevenuePerMember.map(row => ({
          dojoname: row.dojoname, anzahl_mitglieder: parseInt(row.anzahl_mitglieder),
          gesamt_umsatz: parseFloat(row.gesamt_umsatz),
          avg_umsatz_pro_mitglied: parseFloat(row.avg_umsatz_pro_mitglied)
        })),
        // VERBAND Daten
        verband: {
          mitglieder: {
            gesamt: parseInt(verbandStats[0]?.gesamt || 0),
            aktiv: parseInt(verbandStats[0]?.aktiv || 0),
            ausstehend: parseInt(verbandStats[0]?.ausstehend || 0),
            abgelaufen: parseInt(verbandStats[0]?.abgelaufen || 0),
            dojos: parseInt(verbandStats[0]?.dojos || 0),
            einzelpersonen: parseInt(verbandStats[0]?.einzelpersonen || 0)
          },
          einnahmen: {
            jahresbeitrag_erwartet: parseFloat(verbandStats[0]?.jahresbeitrag_aktiv || 0),
            jahresbeitrag_gesamt: parseFloat(verbandStats[0]?.jahresbeitrag_gesamt || 0),
            bezahlt: parseFloat(verbandZahlungen[0]?.bezahlt_summe || 0),
            offen: parseFloat(verbandZahlungen[0]?.offen_summe || 0),
            ueberfaellig: parseFloat(verbandZahlungen[0]?.ueberfaellig_summe || 0)
          },
          breakdown: verbandBreakdown.map(row => ({
            typ: row.typ,
            anzahl: parseInt(row.anzahl || 0),
            jahresbeitrag: parseFloat(row.jahresbeitrag_summe || 0),
            durchschnitt: parseFloat(row.durchschnitt_beitrag || 0)
          }))
        }
      }
    });
  } catch (error) {
    logger.error('Fehler beim Laden der Finanzdaten:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Finanzdaten', details: error.message });
  }
});

module.exports = router;
