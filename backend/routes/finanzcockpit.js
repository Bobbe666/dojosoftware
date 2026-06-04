const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const PaymentProviderFactory = require('../services/PaymentProviderFactory');

// ===== FINANZCOCKPIT STATISTIKEN =====
// GET /api/finanzcockpit/stats - Hauptstatistiken
router.get('/stats', (req, res) => {
  const { period = 'month', start_date, end_date, dojo_id, dojo_ids } = req.query;

  // 🔒 MULTI-DOJO SUPPORT: dojo_ids = "2,3" für mehrere Dojos
  let dojoIdList = [];
  if (dojo_ids) {
    dojoIdList = dojo_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
  } else if (dojo_id && dojo_id !== 'all') {
    const id = parseInt(dojo_id);
    if (!isNaN(id)) dojoIdList = [id];
  }
  // Bei dojo_id=all OHNE dojo_ids: Keine Filterung (Legacy-Verhalten)
  
  // Datumsbereich berechnen
  let dateStart, dateEnd;
  const now = new Date();
  
  if (start_date && end_date) {
    dateStart = start_date;
    dateEnd = end_date;
  } else if (period === 'week') {
    // Aktuelle Kalenderwoche (Montag–Sonntag)
    const day = now.getDay(); // 0=So .. 6=Sa
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    dateStart = monday.toISOString().slice(0, 10);
    dateEnd = sunday.toISOString().slice(0, 10);
  } else if (period === 'month') {
    dateStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    dateEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  } else if (period === 'quarter') {
    const quarter = Math.floor(now.getMonth() / 3);
    dateStart = new Date(now.getFullYear(), quarter * 3, 1).toISOString().slice(0, 10);
    dateEnd = new Date(now.getFullYear(), (quarter + 1) * 3, 0).toISOString().slice(0, 10);
  } else { // year
    dateStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    dateEnd = new Date(now.getFullYear(), 11, 31).toISOString().slice(0, 10);
  }

  // Vorperiode berechnen
  const startDateObj = new Date(dateStart);
  const endDateObj = new Date(dateEnd);
  const daysDiff = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1;
  
  const prevStartDateObj = new Date(startDateObj);
  prevStartDateObj.setDate(prevStartDateObj.getDate() - daysDiff);
  const prevEndDateObj = new Date(startDateObj);
  prevEndDateObj.setDate(prevEndDateObj.getDate() - 1);
  
  const prevDateStart = prevStartDateObj.toISOString().slice(0, 10);
  const prevDateEnd = prevEndDateObj.toISOString().slice(0, 10);

  // Dojo-Filter aufbauen (wird nicht mehr direkt verwendet, aber für Kompatibilität)
  let dojoFilter = '';
  let dojoParams = [];
  if (dojoIdList.length > 0) {
    dojoFilter = `AND m.dojo_id IN (${dojoIdList.map(() => '?').join(',')})`;
    dojoParams = [...dojoIdList];
  }

  // Alle Statistiken parallel abrufen
  Promise.all([
    // Einnahmen aus Verträgen (aktive Verträge)
    new Promise((resolve, reject) => {
      let whereClause = "WHERE v.status = 'aktiv'";
      let queryParams = [];

      if (dojoIdList.length > 0) {
        whereClause += ` AND v.dojo_id IN (${dojoIdList.map(() => '?').join(',')})`;
        queryParams.push(...dojoIdList);
      }

      const query = `
        SELECT
          COUNT(*) as anzahl_vertraege,
          COALESCE(SUM(
            CASE
              WHEN billing_cycle = 'monthly' THEN monatsbeitrag
              WHEN billing_cycle = 'quarterly' THEN monatsbeitrag * 3
              WHEN billing_cycle = 'yearly' THEN monatsbeitrag * 12
              WHEN billing_cycle = 'weekly' THEN monatsbeitrag * 4.33
              WHEN billing_cycle = 'daily' THEN monatsbeitrag * 30
              ELSE monatsbeitrag
            END
          ), 0) as monatliche_einnahmen
        FROM vertraege v
        ${whereClause}
      `;
      db.query(query, queryParams, (err, results) => {
        if (err) return reject(err);
        resolve(results[0] || { anzahl_vertraege: 0, monatliche_einnahmen: 0 });
      });
    }),

    // Einnahmen aus Verträgen nach Zahlungsmethode aufgeschlüsselt
    new Promise((resolve, reject) => {
      let whereConditions = ["v.status = 'aktiv'"];
      let queryParams = [];

      if (dojoIdList.length > 0) {
        whereConditions.push(`v.dojo_id IN (${dojoIdList.map(() => '?').join(',')})`);
        queryParams.push(...dojoIdList);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const query = `
        SELECT
          m.zahlungsmethode,
          COALESCE(SUM(v.monatsbeitrag), 0) as monatliche_einnahmen
        FROM vertraege v
        LEFT JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
        ${whereClause}
        GROUP BY m.zahlungsmethode
      `;
      db.query(query, queryParams, (err, results) => {
        if (err) return reject(err);

        // Initialisiere mit 0
        const breakdown = {
          bar: 0,
          karte: 0,
          lastschrift: 0,
          ueberweisung: 0,
          paypal: 0,
          sonstige: 0
        };

        // Mappe die Ergebnisse
        results.forEach(row => {
          const methode = (row.zahlungsmethode || '').toLowerCase();
          const betrag = parseFloat(row.monatliche_einnahmen) || 0;

          if (methode === 'bar') {
            breakdown.bar += betrag;
          } else if (methode === 'karte') {
            breakdown.karte += betrag;
          } else if (methode === 'lastschrift' || methode === 'sepa-lastschrift') {
            breakdown.lastschrift += betrag;
          } else if (methode === 'überweisung' || methode === 'ueberweisung') {
            breakdown.ueberweisung += betrag;
          } else if (methode === 'paypal') {
            breakdown.paypal += betrag;
          } else {
            breakdown.sonstige += betrag;
          }
        });

        resolve(breakdown);
      });
    }),
    
    // Einnahmen aus Verkäufen
    new Promise((resolve, reject) => {
      let whereConditions = ['v.verkauf_datum >= ?', 'v.verkauf_datum <= ?', 'v.storniert = FALSE'];
      let queryParams = [dateStart, dateEnd];
      
      if (dojoIdList.length > 0) {
        // Bei dojo_id Filter: Laufkunden (mitglied_id IS NULL) ausschließen, nur Mitglieder des Dojos einbeziehen
        whereConditions.push(`(v.mitglied_id IS NOT NULL AND m.dojo_id IN (${dojoIdList.map(() => '?').join(',')}))`);
        queryParams.push(...dojoIdList);
      }

      const query = `
        SELECT
          COUNT(*) as anzahl_verkaeufe,
          COALESCE(SUM(v.brutto_gesamt_cent), 0) as umsatz_cent,
          COALESCE(SUM(CASE WHEN v.zahlungsart = 'bar' THEN v.brutto_gesamt_cent ELSE 0 END), 0) as bar_umsatz_cent,
          COALESCE(SUM(CASE WHEN v.zahlungsart = 'karte' THEN v.brutto_gesamt_cent ELSE 0 END), 0) as karte_umsatz_cent,
          COALESCE(SUM(CASE WHEN v.zahlungsart = 'digital' THEN v.brutto_gesamt_cent ELSE 0 END), 0) as digital_umsatz_cent
        FROM verkaeufe v
        LEFT JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
        WHERE ${whereConditions.join(' AND ')}
      `;
      db.query(query, queryParams, (err, results) => {
        if (err) {
          logger.error('Fehler bei Verkäufe-Query:', { error: err });
          return reject(err);
        }
        resolve(results[0] || { anzahl_verkaeufe: 0, umsatz_cent: 0, bar_umsatz_cent: 0, karte_umsatz_cent: 0, digital_umsatz_cent: 0 });
      });
    }),
    
    // Einnahmen aus Verkäufen (Vorperiode für Trend)
    new Promise((resolve, reject) => {
      let whereConditions = ['v.verkauf_datum >= ?', 'v.verkauf_datum <= ?', 'v.storniert = FALSE'];
      let queryParams = [prevDateStart, prevDateEnd];
      
      if (dojoIdList.length > 0) {
        // Bei dojo_id Filter: Laufkunden (mitglied_id IS NULL) ausschließen, nur Mitglieder des Dojos einbeziehen
        whereConditions.push(`(v.mitglied_id IS NOT NULL AND m.dojo_id IN (${dojoIdList.map(() => '?').join(',')}))`);
        queryParams.push(...dojoIdList);
      }

      const query = `
        SELECT
          COALESCE(SUM(v.brutto_gesamt_cent), 0) as umsatz_cent
        FROM verkaeufe v
        LEFT JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
        WHERE ${whereConditions.join(' AND ')}
      `;
      db.query(query, queryParams, (err, results) => {
        if (err) {
          logger.error('Fehler bei Verkäufe-Vorperiode-Query:', { error: err });
          return reject(err);
        }
        resolve(results[0] || { umsatz_cent: 0 });
      });
    }),
    
    // Rechnungsstatistiken
    new Promise((resolve, reject) => {
      let whereConditions = ['r.archiviert = 0'];
      let queryParams = [];

      if (dojoIdList.length > 0) {
        whereConditions.push(`m.dojo_id IN (${dojoIdList.map(() => '?').join(',')})`);
        queryParams.push(...dojoIdList);
      }
      
      const query = `
        SELECT 
          COUNT(*) as gesamt_rechnungen,
          COUNT(CASE WHEN r.status = 'offen' THEN 1 END) as offene_rechnungen,
          COUNT(CASE WHEN r.status = 'bezahlt' THEN 1 END) as bezahlte_rechnungen,
          COUNT(CASE WHEN r.status = 'ueberfaellig' OR (r.faelligkeitsdatum < CURDATE() AND r.status = 'offen') THEN 1 END) as ueberfaellige_rechnungen,
          COALESCE(SUM(CASE WHEN r.status = 'offen' THEN r.betrag ELSE 0 END), 0) as offene_summe,
          COALESCE(SUM(CASE WHEN r.status = 'bezahlt' AND r.datum >= ? AND r.datum <= ? THEN r.betrag ELSE 0 END), 0) as bezahlte_summe_periode
        FROM rechnungen r
        LEFT JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
        WHERE ${whereConditions.join(' AND ')}
      `;
      db.query(query, [dateStart, dateEnd, ...queryParams], (err, results) => {
        if (err) {
          logger.error('Fehler bei Rechnungen-Query:', { error: err });
          return reject(err);
        }
        resolve(results[0] || { gesamt_rechnungen: 0, offene_rechnungen: 0, bezahlte_rechnungen: 0, ueberfaellige_rechnungen: 0, offene_summe: 0, bezahlte_summe_periode: 0 });
      });
    }),
    
    // Zahlläufe-Statistiken
    new Promise((resolve, reject) => {
      let whereConditions = ['geplanter_einzug >= ?', 'geplanter_einzug <= ?'];
      let queryParams = [dateStart, dateEnd];

      // 🔒 DOJO-FILTER: Zahlläufe jetzt mit dojo_id
      if (dojoIdList.length > 0) {
        whereConditions.push(`dojo_id IN (${dojoIdList.map(() => '?').join(',')})`);
        queryParams.push(...dojoIdList);
      }

      const query = `
        SELECT
          COUNT(*) as gesamt_zahllaeufe,
          COUNT(CASE WHEN status = 'abgeschlossen' THEN 1 END) as abgeschlossene_zahllaeufe,
          COALESCE(SUM(CASE WHEN status = 'abgeschlossen' THEN betrag ELSE 0 END), 0) as abgeschlossene_summe
        FROM zahllaeufe
        WHERE ${whereConditions.join(' AND ')}
      `;
      db.query(query, queryParams, (err, results) => {
        if (err) {
          logger.error('Fehler bei Zahlläufe-Query:', { error: err });
          // Wenn Spalte fehlt, 0 zurückgeben
          if (err.code === 'ER_BAD_FIELD_ERROR') {
            logger.warn('dojo_id-Spalte in zahllaeufe nicht gefunden. Migration ausführen!');
            return resolve({ gesamt_zahllaeufe: 0, abgeschlossene_zahllaeufe: 0, abgeschlossene_summe: 0 });
          }
          return reject(err);
        }
        resolve(results[0] || { gesamt_zahllaeufe: 0, abgeschlossene_zahllaeufe: 0, abgeschlossene_summe: 0 });
      });
    }),
    
    // Zahlungen (Lastschriften) - über Rechnungen zu Mitgliedern
    new Promise((resolve, reject) => {
      let whereConditions = ['z.zahlungsdatum >= ?', 'z.zahlungsdatum <= ?'];
      let queryParams = [dateStart, dateEnd];

      if (dojoIdList.length > 0) {
        whereConditions.push(`m.dojo_id IN (${dojoIdList.map(() => '?').join(',')})`);
        queryParams.push(...dojoIdList);
      }
      
      const query = `
        SELECT 
          COUNT(*) as anzahl_zahlungen,
          COALESCE(SUM(z.betrag), 0) as zahlungen_summe
        FROM zahlungen z
        LEFT JOIN rechnungen r ON z.rechnung_id = r.rechnung_id
        LEFT JOIN mitglieder m ON r.mitglied_id = m.mitglied_id
        WHERE ${whereConditions.join(' AND ')}
      `;
      db.query(query, queryParams, (err, results) => {
        if (err) {
          logger.error('Fehler bei Zahlungen-Query:', { error: err });
          return reject(err);
        }
        resolve(results[0] || { anzahl_zahlungen: 0, zahlungen_summe: 0 });
      });
    }),
    
    // Ausgaben aus Kassenbuch
    new Promise((resolve, reject) => {
      let whereConditions = ['kb.geschaeft_datum >= ?', 'kb.geschaeft_datum <= ?', "kb.bewegungsart = 'ausgabe'"];
      let queryParams = [dateStart, dateEnd];

      // 🔒 DOJO-FILTER: Kassenbuch jetzt mit dojo_id
      if (dojoIdList.length > 0) {
        whereConditions.push(`kb.dojo_id IN (${dojoIdList.map(() => '?').join(',')})`);
        queryParams.push(...dojoIdList);
      }

      const query = `
        SELECT
          COUNT(*) as anzahl_ausgaben,
          COALESCE(SUM(kb.betrag_cent), 0) as ausgaben_cent
        FROM kassenbuch kb
        WHERE ${whereConditions.join(' AND ')}
      `;
      db.query(query, queryParams, (err, results) => {
        if (err) {
          logger.error('Fehler bei Ausgaben-Query:', { error: err });
          // Wenn Tabelle nicht existiert oder Spalte fehlt, 0 zurückgeben
          if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR') {
            logger.warn('Kassenbuch-Tabelle oder dojo_id-Spalte nicht gefunden. Migration ausführen!');
            return resolve({ anzahl_ausgaben: 0, ausgaben_cent: 0 });
          }
          return reject(err);
        }
        resolve(results[0] || { anzahl_ausgaben: 0, ausgaben_cent: 0 });
      });
    }),

    // Ausgaben aus Kassenbuch (Vorperiode für Trend)
    new Promise((resolve, reject) => {
      let whereConditions = ['kb.geschaeft_datum >= ?', 'kb.geschaeft_datum <= ?', "kb.bewegungsart = 'ausgabe'"];
      let queryParams = [prevDateStart, prevDateEnd];

      // 🔒 DOJO-FILTER: Kassenbuch mit dojo_id
      if (dojoIdList.length > 0) {
        whereConditions.push(`kb.dojo_id IN (${dojoIdList.map(() => '?').join(',')})`);
        queryParams.push(...dojoIdList);
      }

      const query = `
        SELECT
          COALESCE(SUM(kb.betrag_cent), 0) as ausgaben_cent
        FROM kassenbuch kb
        WHERE ${whereConditions.join(' AND ')}
      `;
      db.query(query, queryParams, (err, results) => {
        if (err) {
          logger.error('Fehler bei Ausgaben-Vorperiode-Query:', { error: err });
          if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR') {
            return resolve({ ausgaben_cent: 0 });
          }
          return reject(err);
        }
        resolve(results[0] || { ausgaben_cent: 0 });
      });
    }),

    // Echte Mahnfälle (spiegelt mahnwesen.js /offene-beitraege Logik)
    // → Badge + "Ausstehende Beiträge" zeigen NUR wirklich mahnfähige Posten
    new Promise((resolve, reject) => {
      let dojoCond = '';
      let queryParams = [];
      if (dojoIdList.length > 0) {
        dojoCond = ` AND b.dojo_id IN (${dojoIdList.map(() => '?').join(',')})`;
        queryParams.push(...dojoIdList);
      }
      const query = `
        SELECT COUNT(*) AS anzahl, COALESCE(SUM(b.betrag), 0) AS summe
        FROM beitraege b
        JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
        WHERE b.bezahlt = 0
          ${dojoCond}
          AND LOWER(COALESCE(m.zahlungsmethode, '')) NOT LIKE '%stripe%'
          AND (
            (LOWER(COALESCE(m.zahlungsmethode, '')) IN ('sepa-lastschrift','lastschrift','sepa','direct_debit')
              AND (SELECT COUNT(*) FROM offene_zahlungen oz WHERE oz.mitglied_id = b.mitglied_id AND oz.typ = 'ruecklastschrift') >= 2)
            OR (LOWER(COALESCE(m.zahlungsmethode, '')) NOT IN ('sepa-lastschrift','lastschrift','sepa','direct_debit')
              AND DATEDIFF(CURDATE(), b.zahlungsdatum) >= 14)
            OR (SELECT COUNT(*) FROM mahnungen WHERE beitrag_id = b.beitrag_id) > 0
          )
      `;
      db.query(query, queryParams, (err, results) => {
        if (err) {
          logger.error('Fehler bei Mahnfälle-Query:', { error: err });
          // Tabelle/Spalte fehlt → 0 statt Absturz
          if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR') {
            return resolve({ anzahl: 0, summe: 0 });
          }
          return reject(err);
        }
        resolve(results[0] || { anzahl: 0, summe: 0 });
      });
    })
  ]).then(([
    vertraegeStats,
    vertraegePaymentBreakdown,
    verkaeufeStats,
    verkaeufePrevStats,
    rechnungenStats,
    zahllaeufeStats,
    zahlungenStats,
    ausgabenStats,
    ausgabenPrevStats,
    mahnfaelleStats
  ]) => {
    // Berechne Gesamteinnahmen
    const monatlicheEinnahmen = parseFloat(vertraegeStats.monatliche_einnahmen) || 0;
    const verkaeufeEinnahmen = (parseFloat(verkaeufeStats.umsatz_cent) || 0) / 100;
    const rechnungenEinnahmen = parseFloat(rechnungenStats.bezahlte_summe_periode) || 0;
    const zahlungenEinnahmen = parseFloat(zahlungenStats.zahlungen_summe) || 0;
    const zahllaeufeEinnahmen = parseFloat(zahllaeufeStats.abgeschlossene_summe) || 0;
    
    // Berechne Gesamteinnahmen basierend auf Periode
    // Wiederkehrende Vertragseinnahmen sind monatlich → Multiplikator je Periode
    const recurringMultiplier = period === 'quarter' ? 3 : period === 'year' ? 12 : 1; // week & month = 1
    const gesamteinnahmen = (monatlicheEinnahmen * recurringMultiplier)
      + verkaeufeEinnahmen + rechnungenEinnahmen + zahlungenEinnahmen + zahllaeufeEinnahmen;
    
    // Berechne Trends
    const verkaeufePrev = (parseFloat(verkaeufePrevStats.umsatz_cent) || 0) / 100;
    const einnahmenTrend = verkaeufePrev > 0 
      ? ((verkaeufeEinnahmen - verkaeufePrev) / verkaeufePrev) * 100 
      : 0;
    
    // Echte Ausgaben aus Kassenbuch (in Euro)
    const gesamteAusgaben = (parseFloat(ausgabenStats.ausgaben_cent) || 0) / 100;
    
    // Berechne Cashflow (Einnahmen - echte Ausgaben)
    const cashflow = gesamteinnahmen - gesamteAusgaben;
    const cashflowProzent = gesamteinnahmen > 0 ? (cashflow / gesamteinnahmen) * 100 : 0;
    
    // Ausgaben-Trend (Vorperiode)
    const ausgabenPrev = (parseFloat(ausgabenPrevStats.ausgaben_cent) || 0) / 100;
    const ausgabenTrend = ausgabenPrev > 0
      ? ((gesamteAusgaben - ausgabenPrev) / ausgabenPrev) * 100
      : 0;
    
    const stats = {
      period,
      dateStart,
      dateEnd,
      // Einnahmen
      gesamteinnahmen,
      monatlicheEinnahmen,
      quartalsEinnahmen: monatlicheEinnahmen * 3,
      jahresEinnahmen: monatlicheEinnahmen * 12,
      verkaeufeEinnahmen,
      rechnungenEinnahmen,
      zahlungenEinnahmen,
      zahllaeufeEinnahmen,
      // Ausgaben (echte Daten aus Kassenbuch)
      gesamteAusgaben,
      anzahlAusgaben: parseInt(ausgabenStats.anzahl_ausgaben) || 0,
      // Cashflow
      cashflow,
      cashflowProzent,
      // Trends
      einnahmenTrend,
      ausgabenTrend, // Echte Berechnung (später mit Vorperiode)
      // Zahlungsarten (Verkäufe + monatliche Vertragseinnahmen)
      barEinnahmen: ((parseFloat(verkaeufeStats.bar_umsatz_cent) || 0) / 100) + (vertraegePaymentBreakdown.bar || 0),
      kartenEinnahmen: ((parseFloat(verkaeufeStats.karte_umsatz_cent) || 0) / 100) + (vertraegePaymentBreakdown.karte || 0),
      lastschriftEinnahmen: zahlungenEinnahmen + zahllaeufeEinnahmen + (vertraegePaymentBreakdown.lastschrift || 0),
      ueberweisungEinnahmen: (vertraegePaymentBreakdown.ueberweisung || 0),
      paypalEinnahmen: (vertraegePaymentBreakdown.paypal || 0),
      sonstigeEinnahmen: (vertraegePaymentBreakdown.sonstige || 0),
      // Offene Posten
      offeneRechnungen: parseInt(rechnungenStats.offene_rechnungen) || 0,
      offeneRechnungenBetrag: parseFloat(rechnungenStats.offene_summe) || 0,
      ueberfaelligeRechnungen: parseInt(rechnungenStats.ueberfaellige_rechnungen) || 0,
      ausstehendeZahlungen: parseInt(mahnfaelleStats.anzahl) || 0,
      ausstehendeZahlungenBetrag: parseFloat(mahnfaelleStats.summe) || 0,
      // Details
      anzahlVertraege: parseInt(vertraegeStats.anzahl_vertraege) || 0,
      anzahlVerkaeufe: parseInt(verkaeufeStats.anzahl_verkaeufe) || 0,
      anzahlZahllaeufe: parseInt(zahllaeufeStats.gesamt_zahllaeufe) || 0,
      anzahlZahlungen: parseInt(zahlungenStats.anzahl_zahlungen) || 0
    };
    
    res.json({ success: true, data: stats });
  }).catch(err => {
    logger.error('Fehler beim Berechnen der Finanzstatistiken:', { error: err });
    res.status(500).json({ success: false, error: err.message });
  });
});

// GET /api/finanzcockpit/timeline - Zeitreihen-Daten für Charts
router.get('/timeline', (req, res) => {
  const { period = 'month', months = 12, dojo_id, dojo_ids } = req.query;

  // 🔒 MULTI-DOJO SUPPORT
  let dojoIdList = [];
  if (dojo_ids) {
    dojoIdList = dojo_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
  } else if (dojo_id && dojo_id !== 'all') {
    const id = parseInt(dojo_id);
    if (!isNaN(id)) dojoIdList = [id];
  }

  const monthsNum = parseInt(months) || 12;
  const data = [];

  // Generiere Monatsliste (letzte X Monate)
  for (let i = monthsNum - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    data.push({
      year_month: `${year}-${month}`,
      label: date.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })
    });
  }

  // Hole Daten für jeden Monat (monatliche Vertragseinnahmen)
  Promise.all(
    data.map(item =>
      new Promise((resolve, reject) => {
        // Berechne Monatsanfang und Monatsende für diesen Monat
        const [year, month] = item.year_month.split('-');
        const monthStart = `${year}-${month}-01`;
        const monthEnd = new Date(parseInt(year), parseInt(month), 0).toISOString().slice(0, 10);

        let whereConditions = [
          'v.status = "aktiv"',
          // Vertrag war in diesem Monat aktiv:
          // vertragsbeginn <= Monatsende UND (vertragsende IS NULL ODER vertragsende >= Monatsanfang)
          '(v.vertragsbeginn <= ? AND (v.vertragsende IS NULL OR v.vertragsende >= ?))'
        ];
        let queryParams = [monthEnd, monthStart];

        if (dojoIdList.length > 0) {
          whereConditions.push(`v.dojo_id IN (${dojoIdList.map(() => '?').join(',')})`);
          queryParams.push(...dojoIdList);
        }

        const query = `
          SELECT
            COUNT(*) as anzahl_vertraege,
            COALESCE(SUM(v.monatsbeitrag), 0) as monatliche_einnahmen
          FROM vertraege v
          WHERE ${whereConditions.join(' AND ')}
        `;
        db.query(query, queryParams, (err, results) => {
          if (err) {
            logger.error('Fehler bei Timeline-Query:', { error: err });
            return reject(err);
          }
          const stats = results[0] || { anzahl_vertraege: 0, monatliche_einnahmen: 0 };
          resolve({
            ...item,
            umsatz: parseFloat(stats.monatliche_einnahmen) || 0,
            anzahlVertraege: parseInt(stats.anzahl_vertraege) || 0
          });
        });
      })
    )
  ).then(timelineData => {
    res.json({ success: true, data: timelineData });
  }).catch(err => {
    logger.error('Fehler beim Abrufen der Timeline-Daten:', { error: err });
    res.status(500).json({ success: false, error: err.message });
  });
});

// GET /api/finanzcockpit/tarif-breakdown - Einnahmen nach Tarifen
router.get('/tarif-breakdown', (req, res) => {
  const { dojo_id, dojo_ids } = req.query;

  // 🔒 MULTI-DOJO SUPPORT
  let dojoIdList = [];
  if (dojo_ids) {
    dojoIdList = dojo_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
  } else if (dojo_id && dojo_id !== 'all') {
    const id = parseInt(dojo_id);
    if (!isNaN(id)) dojoIdList = [id];
  }

  let whereConditions = ['v.status = "aktiv"'];
  let queryParams = [];

  if (dojoIdList.length > 0) {
    whereConditions.push(`m.dojo_id IN (${dojoIdList.map(() => '?').join(',')})`);
    queryParams.push(...dojoIdList);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const query = `
    SELECT
      t.name as tarif_name,
      COUNT(v.id) as anzahl_vertraege,
      SUM(v.monatsbeitrag) as monatliche_einnahmen
    FROM vertraege v
    JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
    LEFT JOIN tarife t ON v.tarif_id = t.id
    ${whereClause}
    GROUP BY t.id, t.name
    ORDER BY monatliche_einnahmen DESC
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      logger.error('Fehler bei Tarif-Breakdown-Query:', { error: err });
      return res.status(500).json({ success: false, error: err.message });
    }

    const data = results.map(row => ({
      name: row.tarif_name || 'Kein Tarif',
      value: parseFloat(row.monatliche_einnahmen) || 0,
      count: parseInt(row.anzahl_vertraege) || 0
    })).filter(item => item.value > 0);

    res.json({ success: true, data });
  });
});


// GET /api/finanzcockpit/member-stats - Mitglieder-Kennzahlen
router.get('/member-stats', (req, res) => {
  const { period = 'month', start_date, end_date, dojo_id, dojo_ids } = req.query;
  let dojoIdList = [];
  if (dojo_ids) {
    dojoIdList = dojo_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
  } else if (dojo_id && dojo_id !== 'all') {
    const id = parseInt(dojo_id);
    if (!isNaN(id)) dojoIdList = [id];
  }
  let dateStart, dateEnd;
  const now = new Date();
  if (start_date && end_date) {
    dateStart = start_date; dateEnd = end_date;
  } else if (period === 'week') {
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    dateStart = monday.toISOString().slice(0, 10);
    dateEnd = sunday.toISOString().slice(0, 10);
  } else if (period === 'month') {
    dateStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    dateEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  } else if (period === 'quarter') {
    const quarter = Math.floor(now.getMonth() / 3);
    dateStart = new Date(now.getFullYear(), quarter * 3, 1).toISOString().slice(0, 10);
    dateEnd = new Date(now.getFullYear(), (quarter + 1) * 3, 0).toISOString().slice(0, 10);
  } else {
    dateStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    dateEnd = new Date(now.getFullYear(), 11, 31).toISOString().slice(0, 10);
  }
  const buildFilter = (alias) => dojoIdList.length === 0
    ? { clause: '', params: [] }
    : { clause: ' AND ' + alias + '.dojo_id IN (' + dojoIdList.map(() => '?').join(',') + ')', params: [...dojoIdList] };

  Promise.all([
    new Promise((resolve, reject) => {
      const { clause, params } = buildFilter('v');
      db.query(
        "SELECT AVG(v.monatsbeitrag) as avg_beitrag, COUNT(*) as total_vertraege, SUM(CASE WHEN LOWER(COALESCE(m.zahlungsmethode,'')) IN ('lastschrift','sepa-lastschrift','sepa') THEN 1 ELSE 0 END) as sepa_count FROM vertraege v LEFT JOIN mitglieder m ON v.mitglied_id = m.mitglied_id WHERE v.status = 'aktiv'" + clause,
        params, (err, r) => { if (err) return reject(err); resolve(r[0] || {}); }
      );
    }),
    new Promise((resolve, reject) => {
      const { clause, params } = buildFilter('m');
      db.query(
        "SELECT COUNT(*) as total, SUM(CASE WHEN r.status = 'bezahlt' THEN 1 ELSE 0 END) as bezahlt FROM rechnungen r LEFT JOIN mitglieder m ON r.mitglied_id = m.mitglied_id WHERE r.archiviert = 0 AND r.faelligkeitsdatum >= ? AND r.faelligkeitsdatum <= ? AND LOWER(COALESCE(m.zahlungsmethode, '')) NOT LIKE '%stripe%'" + clause,
        [dateStart, dateEnd, ...params], (err, r) => { if (err) return reject(err); resolve(r[0] || {}); }
      );
    }),
    new Promise((resolve, reject) => {
      const { clause, params } = buildFilter('v');
      db.query(
        "SELECT COUNT(*) as cnt FROM vertraege v WHERE v.vertragsbeginn >= ? AND v.vertragsbeginn <= ?" + clause,
        [dateStart, dateEnd, ...params], (err, r) => { if (err) return reject(err); resolve(parseInt(r[0]?.cnt) || 0); }
      );
    }),
    new Promise((resolve, reject) => {
      const { clause, params } = buildFilter('v');
      db.query(
        "SELECT COUNT(*) as cnt FROM vertraege v WHERE v.vertragsende >= ? AND v.vertragsende <= ?" + clause,
        [dateStart, dateEnd, ...params], (err, r) => { if (err) return reject(err); resolve(parseInt(r[0]?.cnt) || 0); }
      );
    })
  ]).then(([vs, is, neueV, verloreneV]) => {
    const total = parseInt(vs.total_vertraege) || 0;
    const sepaCount = parseInt(vs.sepa_count) || 0;
    const totalR = parseInt(is.total) || 0;
    const bezahlt = parseInt(is.bezahlt) || 0;
    res.json({ success: true, data: {
      avgMonatsbeitrag: parseFloat(vs.avg_beitrag) || 0,
      totalVertraege: total,
      sepaRate: total > 0 ? Math.round((sepaCount / total) * 100) : 0,
      sepaCount,
      inkassoQuote: totalR > 0 ? Math.round((bezahlt / totalR) * 100) : null,
      totalRechnungen: totalR,
      bezahltRechnungen: bezahlt,
      neueMitglieder: neueV,
      verloreneMitglieder: verloreneV,
      nettoWachstum: neueV - verloreneV
    }});
  }).catch(err => {
    logger.error('Fehler bei member-stats:', { error: err });
    res.status(500).json({ success: false, error: err.message });
  });
});

// =====================================================================
// MITGLIEDER-FINANZÜBERSICHT — Suche + vollständige Aufschlüsselung
// =====================================================================
const fcPool = db.promise();
const maskIban = (iban) => {
  if (!iban) return null;
  const s = String(iban).replace(/\s/g, '');
  return s.length > 8 ? `${s.slice(0, 4)} **** ${s.slice(-4)}` : s;
};

// GET /api/finanzcockpit/mitglied-suche?dojo_id=&q=
router.get('/mitglied-suche', async (req, res) => {
  try {
    const dojoId = parseInt(req.query.dojo_id);
    const q = (req.query.q || '').trim();
    if (!dojoId) return res.status(400).json({ success: false, error: 'dojo_id erforderlich' });
    if (q.length < 2) return res.json({ success: true, mitglieder: [] });
    const like = `%${q}%`;
    const [rows] = await fcPool.query(
      `SELECT mitglied_id, vorname, nachname, aktiv, gekuendigt
       FROM mitglieder
       WHERE dojo_id = ?
         AND (CONCAT(vorname, ' ', nachname) LIKE ? OR nachname LIKE ? OR vorname LIKE ?)
       ORDER BY nachname, vorname LIMIT 25`,
      [dojoId, like, like, like]
    );
    res.json({
      success: true,
      mitglieder: rows.map(r => ({
        mitglied_id: r.mitglied_id,
        name: `${r.vorname} ${r.nachname}`,
        aktiv: !!r.aktiv,
        gekuendigt: !!r.gekuendigt,
      })),
    });
  } catch (err) {
    logger.error('Fehler bei mitglied-suche:', { error: err });
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/finanzcockpit/mitglied-finanz/:id?dojo_id=
router.get('/mitglied-finanz/:id', async (req, res) => {
  try {
    const dojoId = parseInt(req.query.dojo_id);
    const mid = parseInt(req.params.id);
    if (!dojoId || !mid) return res.status(400).json({ success: false, error: 'dojo_id und id erforderlich' });

    // Mitglied (mit Dojo-Isolation)
    const [[m]] = await fcPool.query(
      `SELECT mitglied_id, vorname, nachname, zahlungsmethode, iban, kontoinhaber, bankname,
              stripe_customer_id, aktiv, gekuendigt, gekuendigt_am, vertragsfrei
       FROM mitglieder WHERE mitglied_id = ? AND dojo_id = ?`,
      [mid, dojoId]
    );
    if (!m) return res.status(404).json({ success: false, error: 'Mitglied nicht gefunden' });

    const [[vertrag]] = await fcPool.query(
      `SELECT status, COALESCE(monatlicher_beitrag, monatsbeitrag) AS monatsbeitrag, billing_cycle,
              vertragsbeginn, vertragsende, kuendigungsdatum, ruhepause_von, ruhepause_bis
       FROM vertraege WHERE mitglied_id = ?
       ORDER BY FIELD(status, 'aktiv', 'ruhepause') DESC, vertragsbeginn DESC LIMIT 1`,
      [mid]
    );

    const [[sepa]] = await fcPool.query(
      `SELECT status, mandatsreferenz, iban, provider, stripe_payment_method_id
       FROM sepa_mandate WHERE mitglied_id = ? AND archiviert = 0
       ORDER BY FIELD(status, 'aktiv') DESC, created_at DESC LIMIT 1`,
      [mid]
    );

    const [beitraege] = await fcPool.query(
      `SELECT beitrag_id, art, betrag, zahlungsdatum, bezahlt, bezahlt_am, zahlungsart, zahllauf_id,
              beschreibung, magicline_description, rechnung_id
       FROM beitraege WHERE mitglied_id = ? ORDER BY zahlungsdatum DESC, beitrag_id DESC LIMIT 300`,
      [mid]
    );

    const [rechnungen] = await fcPool.query(
      `SELECT rechnung_id, rechnungsnummer, COALESCE(gesamtsumme, betrag) AS betrag, status,
              COALESCE(rechnungsdatum, datum) AS datum, faelligkeitsdatum, bezahlt_am, zahlungsart, art, beschreibung
       FROM rechnungen WHERE mitglied_id = ? AND archiviert = 0
       ORDER BY COALESCE(rechnungsdatum, datum) DESC LIMIT 100`,
      [mid]
    );

    const [verkaeufe] = await fcPool.query(
      `SELECT verkauf_id, bon_nummer, brutto_gesamt_cent / 100 AS betrag, zahlungsart, zahlungsstatus, verkauf_datum, bemerkung
       FROM verkaeufe WHERE mitglied_id = ? AND (storniert = 0 OR storniert IS NULL)
       ORDER BY verkauf_datum DESC LIMIT 100`,
      [mid]
    );

    const [lastschriften] = await fcPool.query(
      `SELECT t.id, t.betrag, t.status, t.beitrag_ids, t.created_at, t.updated_at, t.processed_at,
              t.stripe_payment_intent_id, t.stripe_charge_id, t.error_code, t.error_message,
              t.batch_id, b.monat, b.jahr
       FROM stripe_lastschrift_transaktion t JOIN stripe_lastschrift_batch b ON t.batch_id = b.batch_id
       WHERE t.mitglied_id = ? ORDER BY t.created_at DESC LIMIT 100`,
      [mid]
    );

    // Verkauf-Positionen (welcher Artikel, wie oft) für alle Verkäufe des Mitglieds
    const verkaufIds = verkaeufe.map(v => v.verkauf_id);
    let positionen = [];
    if (verkaufIds.length > 0) {
      const ph = verkaufIds.map(() => '?').join(',');
      const [posRows] = await fcPool.query(
        `SELECT verkauf_id, artikel_id, artikel_name, artikel_nummer, menge, brutto_cent / 100 AS brutto, einzelpreis_cent / 100 AS einzelpreis
         FROM verkauf_positionen WHERE verkauf_id IN (${ph}) ORDER BY verkauf_id, position_nummer`,
        verkaufIds
      );
      positionen = posRows;
    }
    // Positionen den Verkäufen zuordnen
    const posByVerkauf = {};
    positionen.forEach(p => { (posByVerkauf[p.verkauf_id] = posByVerkauf[p.verkauf_id] || []).push(p); });
    verkaeufe.forEach(v => { v.positionen = posByVerkauf[v.verkauf_id] || []; });

    // Artikel-Übersicht: wie oft wurde welcher Artikel gekauft + Gesamtbetrag
    const artikelMap = {};
    positionen.forEach(p => {
      const key = p.artikel_name || `Artikel ${p.artikel_id}`;
      if (!artikelMap[key]) artikelMap[key] = { artikel_name: key, artikel_nummer: p.artikel_nummer, gekauft: 0, menge_gesamt: 0, summe: 0 };
      artikelMap[key].gekauft += 1;
      artikelMap[key].menge_gesamt += parseInt(p.menge) || 0;
      artikelMap[key].summe += parseFloat(p.brutto) || 0;
    });
    const artikelUebersicht = Object.values(artikelMap).sort((a, b) => b.menge_gesamt - a.menge_gesamt);

    const [ruecklastschriften] = await fcPool.query(
      `SELECT id, original_betrag AS betrag, rueckgabe_code, rueckgabe_grund, rueckgabe_datum, status
       FROM mitglied_ruecklastschriften WHERE mitglied_id = ? ORDER BY rueckgabe_datum DESC LIMIT 50`,
      [mid]
    );

    const num = (v) => parseFloat(v) || 0;
    const offeneBeitraege = beitraege.filter(b => !b.bezahlt);
    const bezahltGesamt = beitraege.filter(b => b.bezahlt).reduce((s, b) => s + num(b.betrag), 0);
    const offenGesamt =
      offeneBeitraege.reduce((s, b) => s + num(b.betrag), 0) +
      rechnungen.filter(r => ['offen', 'teilweise_bezahlt', 'ueberfaellig'].includes(r.status)).reduce((s, r) => s + num(r.betrag), 0) +
      verkaeufe.filter(v => v.zahlungsstatus === 'offen').reduce((s, v) => s + num(v.betrag), 0);
    const inEinzug = lastschriften.filter(l => l.status === 'processing').reduce((s, l) => s + num(l.betrag), 0);
    const naechste = offeneBeitraege
      .filter(b => b.zahlungsdatum)
      .sort((a, b) => String(a.zahlungsdatum).localeCompare(String(b.zahlungsdatum)))[0];

    res.json({
      success: true,
      mitglied: {
        mitglied_id: m.mitglied_id,
        name: `${m.vorname} ${m.nachname}`,
        zahlungsmethode: m.zahlungsmethode,
        iban_maskiert: maskIban(m.iban),
        kontoinhaber: m.kontoinhaber,
        bankname: m.bankname,
        stripe_customer_id: m.stripe_customer_id,
        aktiv: !!m.aktiv,
        gekuendigt: !!m.gekuendigt,
        gekuendigt_am: m.gekuendigt_am,
        vertragsfrei: !!m.vertragsfrei,
      },
      vertrag: vertrag || null,
      sepa: sepa ? { ...sepa, iban: maskIban(sepa.iban) } : null,
      zusammenfassung: {
        bezahlt_gesamt: bezahltGesamt,
        offen_gesamt: offenGesamt,
        in_einzug_gesamt: inEinzug,
        anzahl_offene_beitraege: offeneBeitraege.length,
        naechste_faelligkeit: naechste ? { betrag: num(naechste.betrag), faellig: naechste.zahlungsdatum, art: naechste.art } : null,
      },
      beitraege,
      rechnungen,
      verkaeufe,
      lastschriften,
      ruecklastschriften,
      artikel_uebersicht: artikelUebersicht,
    });
  } catch (err) {
    logger.error('Fehler bei mitglied-finanz:', { error: err });
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/finanzcockpit/mitglied-check/:id?dojo_id=
// Automatische Problemanalyse: Doppelbuchungen, Betrags-Abweichungen,
// Phantom-Abbuchungen + Monatsvergleich (geschickt vs. erwartet).
router.get('/mitglied-check/:id', async (req, res) => {
  try {
    const dojoId = parseInt(req.query.dojo_id);
    const mid = parseInt(req.params.id);
    if (!dojoId || !mid) return res.status(400).json({ success: false, error: 'dojo_id und id erforderlich' });

    const [[m]] = await fcPool.query(`SELECT vorname, nachname, dojo_id FROM mitglieder WHERE mitglied_id = ?`, [mid]);
    if (!m) return res.status(404).json({ success: false, error: 'Mitglied nicht gefunden' });
    if (m.dojo_id !== dojoId) return res.status(403).json({ success: false, error: 'Kein Zugriff' });

    const [txs] = await fcPool.query(
      `SELECT t.id, t.betrag, t.status, t.beitrag_ids, t.created_at, b.monat, b.jahr
       FROM stripe_lastschrift_transaktion t JOIN stripe_lastschrift_batch b ON t.batch_id = b.batch_id
       WHERE t.mitglied_id = ? ORDER BY t.created_at`, [mid]);
    const [beitraege] = await fcPool.query(`SELECT beitrag_id, art, betrag, zahlungsdatum FROM beitraege WHERE mitglied_id = ?`, [mid]);
    const [[vertrag]] = await fcPool.query(
      `SELECT ruhepause_von, ruhepause_bis FROM vertraege WHERE mitglied_id = ?
       ORDER BY FIELD(status, 'aktiv', 'ruhepause') DESC, vertragsbeginn DESC LIMIT 1`, [mid]);

    const ART = { mitgliedsbeitrag: 'Mitgliedsbeitrag', pruefungsgebuehr: 'Prüfungsgebühr', artikel: 'Artikel', aufnahmegebuehr: 'Aufnahmegebühr' };
    const MONATE_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const bById = {};
    beitraege.forEach(b => { bById[b.beitrag_id] = b; });
    const num = (v) => parseFloat(v) || 0;
    const parseIds = (s) => { try { return JSON.parse(s || '[]'); } catch { return []; } };
    const tag = (d) => { try { return new Date(d).toISOString().slice(0, 10); } catch { return String(d).slice(0, 10); } };
    const real = txs.filter(t => t.status === 'succeeded' || t.status === 'processing');

    const findings = [];
    let zuViel = 0;

    // 1) Doppelte Beiträge (gleiche beitrag_id in mehreren echten Transaktionen)
    const byBeitrag = {};
    real.forEach(t => parseIds(t.beitrag_ids).forEach(id => { (byBeitrag[id] = byBeitrag[id] || []).push(t); }));
    Object.entries(byBeitrag).forEach(([id, ts]) => {
      if (ts.length > 1) {
        const b = bById[id];
        const sorted = [...ts].sort((a, b2) => new Date(a.created_at) - new Date(b2.created_at));
        const extra = sorted.slice(1).reduce((s, t) => s + num(t.betrag), 0);
        zuViel += extra;
        findings.push({
          schwere: 'hoch', typ: 'doppelbuchung',
          titel: `Beitrag ${id} (${b ? (ART[b.art] || b.art) : '?'}${b ? `, ${num(b.betrag).toFixed(2)} €` : ''}) ${ts.length}× abgebucht`,
          detail: `${ts.map(t => `tx${t.id} (${num(t.betrag).toFixed(2)} €, ${tag(t.created_at)})`).join(' + ')} → ca. ${extra.toFixed(2)} € zu viel.`,
          betrag_zu_viel: extra, txs: ts.map(t => t.id),
        });
      }
    });

    // 2) Betrags-Abweichung (Transaktionsbetrag ≠ Summe der zugeordneten Beiträge)
    real.forEach(t => {
      const ids = parseIds(t.beitrag_ids);
      if (ids.length === 0) return;
      if (!ids.every(id => bById[id])) return; // Beiträge regeneriert/gelöscht → kein verlässlicher Soll-Vergleich
      const sum = ids.reduce((s, id) => s + (bById[id] ? num(bById[id].betrag) : 0), 0);
      const diff = num(t.betrag) - sum;
      if (Math.abs(diff) > 0.01) {
        if (diff > 0) zuViel += diff;
        findings.push({
          schwere: 'hoch', typ: 'betrags_abweichung',
          titel: `tx${t.id}: Betrag passt nicht zu den Posten`,
          detail: `Abgebucht ${num(t.betrag).toFixed(2)} €, die zugeordneten Beiträge (${ids.join(', ')}) ergeben aber ${sum.toFixed(2)} € — Differenz ${diff > 0 ? '+' : ''}${diff.toFixed(2)} €.`,
          betrag_zu_viel: diff > 0 ? diff : 0, txs: [t.id],
        });
      }
    });

    // 3) Phantom (echte Abbuchung ohne jede Zuordnung)
    real.forEach(t => {
      if (parseIds(t.beitrag_ids).length === 0 && num(t.betrag) > 0) {
        zuViel += num(t.betrag);
        findings.push({
          schwere: 'hoch', typ: 'phantom',
          titel: `tx${t.id}: ${num(t.betrag).toFixed(2)} € ohne Beitrags-Zuordnung`,
          detail: `Diese Abbuchung (Lauf ${t.monat}/${t.jahr}, Status ${t.status}, ${tag(t.created_at)}) hat keine zugeordneten Posten — nicht nachvollziehbar, möglicher Fehl-/Doppeleinzug.`,
          betrag_zu_viel: num(t.betrag), txs: [t.id],
        });
      }
    });

    // 4) Doppelter Monatsbeitrag (zwei mitgliedsbeitrag-Beiträge im selben Monat)
    const beitragMonat = {};
    beitraege.filter(b => b.art === 'mitgliedsbeitrag' && b.zahlungsdatum).forEach(b => {
      const d = new Date(b.zahlungsdatum);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      (beitragMonat[key] = beitragMonat[key] || []).push(b);
    });
    Object.entries(beitragMonat).forEach(([key, bs]) => {
      if (bs.length > 1) {
        const [jahr, monat] = key.split('-').map(Number);
        const summe = bs.reduce((s, b) => s + num(b.betrag), 0);
        const extra = summe - num(bs[0].betrag);
        zuViel += extra;
        findings.push({
          schwere: 'hoch', typ: 'doppelter_monatsbeitrag',
          titel: `Doppelter Monatsbeitrag für ${MONATE_DE[monat - 1]} ${jahr}`,
          detail: `${bs.length} Mitgliedsbeiträge im selben Monat (Beiträge ${bs.map(b => b.beitrag_id).join(', ')}), zusammen ${summe.toFixed(2)} € — ca. ${extra.toFixed(2)} € zu viel.`,
          betrag_zu_viel: extra,
        });
      }
    });

    // 5) Fehlender Monatsbeitrag (Lücke in der Sequenz; Ruhepause ausgenommen)
    const monthKeys = Object.keys(beitragMonat).sort();
    if (monthKeys.length >= 2) {
      const [y0, m0] = monthKeys[0].split('-').map(Number);
      const [y1, m1] = monthKeys[monthKeys.length - 1].split('-').map(Number);
      const ruheVon = vertrag && vertrag.ruhepause_von ? new Date(vertrag.ruhepause_von) : null;
      const ruheBis = vertrag && vertrag.ruhepause_bis ? new Date(vertrag.ruhepause_bis) : null;
      const fehlend = [];
      let cy = y0, cm = m0;
      while (cy < y1 || (cy === y1 && cm <= m1)) {
        const key = `${cy}-${String(cm).padStart(2, '0')}`;
        if (!beitragMonat[key]) {
          const monthDate = new Date(cy, cm - 1, 15);
          const inRuhe = ruheVon && ruheBis && monthDate >= ruheVon && monthDate <= ruheBis;
          if (!inRuhe) fehlend.push(`${MONATE_DE[cm - 1]} ${cy}`);
        }
        cm++; if (cm > 12) { cm = 1; cy++; }
      }
      if (fehlend.length > 0) {
        findings.push({
          schwere: 'mittel', typ: 'fehlender_beitrag',
          titel: `${fehlend.length} fehlende${fehlend.length === 1 ? 'r' : ''} Monatsbeitrag`,
          detail: `Kein Mitgliedsbeitrag vorhanden für: ${fehlend.join(', ')}. (Ruhepausen sind ausgenommen.)`,
          betrag_zu_viel: 0,
        });
      }
    }

    // 6) Monatsvergleich: geschickt vs. erwartet (Summe der DISTINCT zugeordneten Beiträge)
    const byMonth = {};
    real.forEach(t => {
      const key = `${t.jahr}-${String(t.monat).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = { monat: t.monat, jahr: t.jahr, geschickt: 0, anzahl_tx: 0, ids: new Set(), regeneriertBetrag: 0 };
      byMonth[key].geschickt += num(t.betrag);
      byMonth[key].anzahl_tx += 1;
      const ids = parseIds(t.beitrag_ids);
      if (ids.length === 0) {
        // Phantom (ohne Zuordnung) → trägt 0 zum „erwartet" bei → erscheint als Differenz
      } else if (ids.every(id => bById[id])) {
        ids.forEach(id => byMonth[key].ids.add(id)); // auflösbar → distinct (deckt Doppelbuchung als Differenz auf)
      } else {
        byMonth[key].regeneriertBetrag += num(t.betrag); // Beitrag regeneriert → abgebuchten Betrag als erwartet annehmen
      }
    });
    const monatsvergleich = Object.values(byMonth).map(v => {
      const erwartetResolved = [...v.ids].reduce((s, id) => s + (bById[id] ? num(bById[id].betrag) : 0), 0);
      const erwartet = erwartetResolved + v.regeneriertBetrag;
      return { monat: v.monat, jahr: v.jahr, geschickt: v.geschickt, erwartet, differenz: v.geschickt - erwartet, anzahl_tx: v.anzahl_tx, anzahl_beitraege: v.ids.size };
    }).sort((a, b) => (b.jahr - a.jahr) || (b.monat - a.monat));

    res.json({
      success: true,
      mitglied: `${m.vorname} ${m.nachname}`,
      alles_ok: findings.length === 0,
      summe_auffaellig: zuViel,
      findings: findings.sort((a, b) => (b.betrag_zu_viel || 0) - (a.betrag_zu_viel || 0)),
      monatsvergleich,
    });
  } catch (err) {
    logger.error('Fehler bei mitglied-check:', { error: err });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/finanzcockpit/refund/:txId?dojo_id=  Body: { betrag_cent?, grund? }
// Rückerstattung einer (bereits eingezogenen) Stripe-Lastschrift-Transaktion
router.post('/refund/:txId', async (req, res) => {
  try {
    const dojoId = parseInt(req.query.dojo_id);
    const txId = parseInt(req.params.txId);
    const { betrag_cent, grund } = req.body || {};
    if (!dojoId || !txId) return res.status(400).json({ success: false, error: 'dojo_id und txId erforderlich' });

    const [[tx]] = await fcPool.query(
      `SELECT t.id, t.betrag, t.status, t.stripe_payment_intent_id, m.dojo_id
       FROM stripe_lastschrift_transaktion t JOIN mitglieder m ON t.mitglied_id = m.mitglied_id WHERE t.id = ?`, [txId]);
    if (!tx) return res.status(404).json({ success: false, error: 'Transaktion nicht gefunden' });
    if (tx.dojo_id !== dojoId) return res.status(403).json({ success: false, error: 'Kein Zugriff' });
    if (!tx.stripe_payment_intent_id) return res.status(400).json({ success: false, error: 'Keine Stripe-Transaktion zum Erstatten' });

    const provider = await PaymentProviderFactory.getProvider(dojoId);
    if (!provider || !provider.stripe) return res.status(400).json({ success: false, error: 'Stripe nicht konfiguriert' });
    const opts = provider.connectedAccountId ? { stripeAccount: provider.connectedAccountId } : undefined;

    const params = { payment_intent: tx.stripe_payment_intent_id, reason: 'requested_by_customer' };
    if (betrag_cent && betrag_cent > 0) params.amount = Math.round(betrag_cent);

    const refund = await provider.stripe.refunds.create(params, opts);

    await fcPool.query(
      `UPDATE stripe_lastschrift_transaktion SET error_message = CONCAT(COALESCE(error_message, ''), ?), updated_at = NOW() WHERE id = ?`,
      [` | Rückerstattet ${(refund.amount / 100).toFixed(2)} € (${refund.id})${grund ? ': ' + grund : ''}`, txId]
    );

    logger.info(`💸 Refund tx${txId} (PI ${tx.stripe_payment_intent_id}): ${refund.amount / 100} € — ${refund.id}`);
    res.json({ success: true, refund_id: refund.id, betrag_erstattet: refund.amount / 100, status: refund.status });
  } catch (err) {
    logger.error('Fehler bei refund:', { error: err });
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/finanzcockpit/stripe-details/:pi?dojo_id=
// Live von Stripe: Status, Charge, Rückerstattungen, Fehlergrund zu einem Payment-Intent
router.get('/stripe-details/:pi', async (req, res) => {
  try {
    const dojoId = parseInt(req.query.dojo_id);
    const pi = req.params.pi;
    if (!dojoId || !pi) return res.status(400).json({ success: false, error: 'dojo_id und payment_intent erforderlich' });
    const provider = await PaymentProviderFactory.getProvider(dojoId);
    if (!provider || !provider.stripe) return res.status(400).json({ success: false, error: 'Stripe nicht konfiguriert' });
    const opts = provider.connectedAccountId ? { stripeAccount: provider.connectedAccountId } : undefined;

    const intent = await provider.stripe.paymentIntents.retrieve(pi, { expand: ['latest_charge'] }, opts);
    const charge = (intent.latest_charge && typeof intent.latest_charge === 'object') ? intent.latest_charge : null;

    let refunds = [];
    if (charge && charge.id) {
      try {
        const rf = await provider.stripe.refunds.list({ charge: charge.id, limit: 10 }, opts);
        refunds = (rf.data || []).map(r => ({ id: r.id, betrag: (r.amount || 0) / 100, status: r.status, grund: r.reason, erstellt: r.created }));
      } catch (_) { /* keine Refunds */ }
    }

    res.json({
      success: true,
      payment_intent: {
        id: intent.id,
        status: intent.status,
        betrag: (intent.amount || 0) / 100,
        waehrung: intent.currency,
        erstellt: intent.created,
        beschreibung: intent.description,
        fehler: intent.last_payment_error
          ? { code: intent.last_payment_error.code, message: intent.last_payment_error.message, decline_code: intent.last_payment_error.decline_code }
          : null,
      },
      charge: charge
        ? { id: charge.id, status: charge.status, bezahlt: !!charge.paid, erstattet: !!charge.refunded, betrag_erstattet: (charge.amount_refunded || 0) / 100, beschreibung: charge.description }
        : null,
      refunds,
    });
  } catch (err) {
    logger.error('Fehler bei stripe-details:', { error: err });
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
