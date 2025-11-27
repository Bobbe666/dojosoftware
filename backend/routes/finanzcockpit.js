const express = require('express');
const router = express.Router();
const db = require('../db');

// ===== FINANZCOCKPIT STATISTIKEN =====
// GET /api/finanzcockpit/stats - Hauptstatistiken
router.get('/stats', (req, res) => {
  const { period = 'month', start_date, end_date, dojo_id } = req.query;
  
  // Datumsbereich berechnen
  let dateStart, dateEnd;
  const now = new Date();
  
  if (start_date && end_date) {
    dateStart = start_date;
    dateEnd = end_date;
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

  // Dojo-Filter aufbauen
  let dojoFilter = '';
  let dojoParams = [];
  if (dojo_id && dojo_id !== 'all') {
    dojoFilter = 'AND m.dojo_id = ?';
    dojoParams = [parseInt(dojo_id)];
  }

  // Alle Statistiken parallel abrufen
  Promise.all([
    // Einnahmen aus Verträgen (aktive Verträge)
    new Promise((resolve, reject) => {
      let whereClause = "WHERE v.status = 'aktiv'";
      let queryParams = [];
      
      if (dojo_id && dojo_id !== 'all') {
        whereClause += ' AND v.dojo_id = ?';
        queryParams.push(parseInt(dojo_id));
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
    
    // Einnahmen aus Verkäufen
    new Promise((resolve, reject) => {
      let whereConditions = ['v.verkauf_datum >= ?', 'v.verkauf_datum <= ?', 'v.storniert = FALSE'];
      let queryParams = [dateStart, dateEnd];
      
      if (dojo_id && dojo_id !== 'all') {
        // Bei dojo_id Filter: Laufkunden (mitglied_id IS NULL) ausschließen, nur Mitglieder des Dojos einbeziehen
        whereConditions.push('(v.mitglied_id IS NOT NULL AND m.dojo_id = ?)');
        queryParams.push(parseInt(dojo_id));
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
          console.error('Fehler bei Verkäufe-Query:', err);
          return reject(err);
        }
        resolve(results[0] || { anzahl_verkaeufe: 0, umsatz_cent: 0, bar_umsatz_cent: 0, karte_umsatz_cent: 0, digital_umsatz_cent: 0 });
      });
    }),
    
    // Einnahmen aus Verkäufen (Vorperiode für Trend)
    new Promise((resolve, reject) => {
      let whereConditions = ['v.verkauf_datum >= ?', 'v.verkauf_datum <= ?', 'v.storniert = FALSE'];
      let queryParams = [prevDateStart, prevDateEnd];
      
      if (dojo_id && dojo_id !== 'all') {
        // Bei dojo_id Filter: Laufkunden (mitglied_id IS NULL) ausschließen, nur Mitglieder des Dojos einbeziehen
        whereConditions.push('(v.mitglied_id IS NOT NULL AND m.dojo_id = ?)');
        queryParams.push(parseInt(dojo_id));
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
          console.error('Fehler bei Verkäufe-Vorperiode-Query:', err);
          return reject(err);
        }
        resolve(results[0] || { umsatz_cent: 0 });
      });
    }),
    
    // Rechnungsstatistiken
    new Promise((resolve, reject) => {
      let whereConditions = ['r.archiviert = 0'];
      let queryParams = [];
      
      if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('m.dojo_id = ?');
        queryParams.push(parseInt(dojo_id));
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
          console.error('Fehler bei Rechnungen-Query:', err);
          return reject(err);
        }
        resolve(results[0] || { gesamt_rechnungen: 0, offene_rechnungen: 0, bezahlte_rechnungen: 0, ueberfaellige_rechnungen: 0, offene_summe: 0, bezahlte_summe_periode: 0 });
      });
    }),
    
    // Zahlläufe-Statistiken
    // Hinweis: Zahlläufe haben keine direkte mitglied_id, daher kein Dojo-Filter möglich
    new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as gesamt_zahllaeufe,
          COUNT(CASE WHEN status = 'abgeschlossen' THEN 1 END) as abgeschlossene_zahllaeufe,
          COALESCE(SUM(CASE WHEN status = 'abgeschlossen' THEN betrag ELSE 0 END), 0) as abgeschlossene_summe
        FROM zahllaeufe
        WHERE geplanter_einzug >= ? AND geplanter_einzug <= ?
      `;
      db.query(query, [dateStart, dateEnd], (err, results) => {
        if (err) return reject(err);
        resolve(results[0] || { gesamt_zahllaeufe: 0, abgeschlossene_zahllaeufe: 0, abgeschlossene_summe: 0 });
      });
    }),
    
    // Zahlungen (Lastschriften) - über Rechnungen zu Mitgliedern
    new Promise((resolve, reject) => {
      let whereConditions = ['z.zahlungsdatum >= ?', 'z.zahlungsdatum <= ?'];
      let queryParams = [dateStart, dateEnd];
      
      if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('m.dojo_id = ?');
        queryParams.push(parseInt(dojo_id));
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
          console.error('Fehler bei Zahlungen-Query:', err);
          return reject(err);
        }
        resolve(results[0] || { anzahl_zahlungen: 0, zahlungen_summe: 0 });
      });
    }),
    
    // Ausgaben aus Kassenbuch
    new Promise((resolve, reject) => {
      let whereConditions = ['kb.geschaeft_datum >= ?', 'kb.geschaeft_datum <= ?', "kb.bewegungsart = 'ausgabe'"];
      let queryParams = [dateStart, dateEnd];
      
      // Kassenbuch hat keine direkte dojo_id, daher kein Filter möglich
      // TODO: Wenn Kassenbuch dojo_id bekommt, hier Filter hinzufügen
      
      const query = `
        SELECT 
          COUNT(*) as anzahl_ausgaben,
          COALESCE(SUM(kb.betrag_cent), 0) as ausgaben_cent
        FROM kassenbuch kb
        WHERE ${whereConditions.join(' AND ')}
      `;
      db.query(query, queryParams, (err, results) => {
        if (err) {
          console.error('Fehler bei Ausgaben-Query:', err);
          // Wenn Tabelle nicht existiert, 0 zurückgeben
          if (err.code === 'ER_NO_SUCH_TABLE') {
            return resolve({ anzahl_ausgaben: 0, ausgaben_cent: 0 });
          }
          return reject(err);
        }
        resolve(results[0] || { anzahl_ausgaben: 0, ausgaben_cent: 0 });
      });
    })
  ]).then(([
    vertraegeStats,
    verkaeufeStats,
    verkaeufePrevStats,
    rechnungenStats,
    zahllaeufeStats,
    zahlungenStats,
    ausgabenStats
  ]) => {
    // Berechne Gesamteinnahmen
    const monatlicheEinnahmen = parseFloat(vertraegeStats.monatliche_einnahmen) || 0;
    const verkaeufeEinnahmen = (parseFloat(verkaeufeStats.umsatz_cent) || 0) / 100;
    const rechnungenEinnahmen = parseFloat(rechnungenStats.bezahlte_summe_periode) || 0;
    const zahlungenEinnahmen = parseFloat(zahlungenStats.zahlungen_summe) || 0;
    const zahllaeufeEinnahmen = parseFloat(zahllaeufeStats.abgeschlossene_summe) || 0;
    
    // Berechne Gesamteinnahmen basierend auf Periode
    let gesamteinnahmen = 0;
    if (period === 'month') {
      gesamteinnahmen = monatlicheEinnahmen + verkaeufeEinnahmen + rechnungenEinnahmen + zahlungenEinnahmen + zahllaeufeEinnahmen;
    } else if (period === 'quarter') {
      gesamteinnahmen = (monatlicheEinnahmen * 3) + verkaeufeEinnahmen + rechnungenEinnahmen + zahlungenEinnahmen + zahllaeufeEinnahmen;
    } else {
      gesamteinnahmen = (monatlicheEinnahmen * 12) + verkaeufeEinnahmen + rechnungenEinnahmen + zahlungenEinnahmen + zahllaeufeEinnahmen;
    }
    
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
    // TODO: Ausgaben-Vorperiode berechnen wenn benötigt
    const ausgabenTrend = 0; // Wird später implementiert wenn Vorperiode benötigt
    
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
      // Zahlungsarten
      barEinnahmen: (parseFloat(verkaeufeStats.bar_umsatz_cent) || 0) / 100,
      kartenEinnahmen: (parseFloat(verkaeufeStats.karte_umsatz_cent) || 0) / 100,
      lastschriftEinnahmen: zahlungenEinnahmen + zahllaeufeEinnahmen,
      // Offene Posten
      offeneRechnungen: parseInt(rechnungenStats.offene_rechnungen) || 0,
      offeneRechnungenBetrag: parseFloat(rechnungenStats.offene_summe) || 0,
      ueberfaelligeRechnungen: parseInt(rechnungenStats.ueberfaellige_rechnungen) || 0,
      ausstehendeZahlungen: parseInt(vertraegeStats.anzahl_vertraege) || 0,
      ausstehendeZahlungenBetrag: monatlicheEinnahmen,
      // Details
      anzahlVertraege: parseInt(vertraegeStats.anzahl_vertraege) || 0,
      anzahlVerkaeufe: parseInt(verkaeufeStats.anzahl_verkaeufe) || 0,
      anzahlZahllaeufe: parseInt(zahllaeufeStats.gesamt_zahllaeufe) || 0,
      anzahlZahlungen: parseInt(zahlungenStats.anzahl_zahlungen) || 0
    };
    
    res.json({ success: true, data: stats });
  }).catch(err => {
    console.error('Fehler beim Berechnen der Finanzstatistiken:', err);
    res.status(500).json({ success: false, error: err.message });
  });
});

// GET /api/finanzcockpit/timeline - Zeitreihen-Daten für Charts
router.get('/timeline', (req, res) => {
  const { period = 'month', days = 30, dojo_id } = req.query;
  
  const daysNum = parseInt(days) || 30;
  const data = [];
  
  // Generiere Datumsliste
  for (let i = daysNum - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
    });
  }
  
  // Hole Daten für jeden Tag
  Promise.all(
    data.map(item => 
      new Promise((resolve, reject) => {
        let whereConditions = ['v.verkauf_datum = ?', 'v.storniert = FALSE'];
        let queryParams = [item.date];
        
        if (dojo_id && dojo_id !== 'all') {
          // Bei dojo_id Filter: Laufkunden (mitglied_id IS NULL) ausschließen, nur Mitglieder des Dojos einbeziehen
          whereConditions.push('(v.mitglied_id IS NOT NULL AND m.dojo_id = ?)');
          queryParams.push(parseInt(dojo_id));
        }
        
        const query = `
          SELECT 
            COALESCE(SUM(v.brutto_gesamt_cent), 0) as umsatz_cent,
            COUNT(*) as anzahl_verkaeufe
          FROM verkaeufe v
          LEFT JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
          WHERE ${whereConditions.join(' AND ')}
        `;
        db.query(query, queryParams, (err, results) => {
          if (err) {
            console.error('Fehler bei Timeline-Query:', err);
            return reject(err);
          }
          const stats = results[0] || { umsatz_cent: 0, anzahl_verkaeufe: 0 };
          resolve({
            ...item,
            umsatz: (parseFloat(stats.umsatz_cent) || 0) / 100,
            anzahlVerkaeufe: parseInt(stats.anzahl_verkaeufe) || 0
          });
        });
      })
    )
  ).then(timelineData => {
    res.json({ success: true, data: timelineData });
  }).catch(err => {
    console.error('Fehler beim Abrufen der Timeline-Daten:', err);
    res.status(500).json({ success: false, error: err.message });
  });
});

module.exports = router;

