// =====================================================================================
// VERKAUFS-API ROUTES - DOJOSOFTWARE KASSENSYSTEM
// =====================================================================================
// Deutsche rechtliche Grundlagen für Barverkäufe (GoBD, KassenSichV)
// Vollständige Kassenbuchführung und Belegpflicht
// =====================================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateKassenbon, generateStornoBon } = require('../templates/kassenbon_template');
const { createRechnungForVerkauf } = require('../utils/rechnungAutomation');

// =====================================================================================
// HILFSFUNKTIONEN
// =====================================================================================

// Bonnummer generieren (fortlaufend, eindeutig)
const generateBonNumber = () => {
  return new Promise((resolve, reject) => {
    const heute = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    // Höchste Bonnummer des heutigen Tages finden
    const query = `
      SELECT bon_nummer 
      FROM verkaeufe 
      WHERE DATE(verkauf_datum) = CURDATE() 
      ORDER BY bon_nummer DESC 
      LIMIT 1
    `;
    
    db.query(query, (error, results) => {
      if (error) return reject(error);
      
      let bonNummer;
      if (results.length > 0) {
        // Nächste Nummer in Sequenz
        const letzteBonNummer = results[0].bon_nummer;
        const letzteNummer = parseInt(letzteBonNummer.slice(-6));
        bonNummer = `${heute}${(letzteNummer + 1).toString().padStart(6, '0')}`;
      } else {
        // Erste Bonnummer des Tages
        bonNummer = `${heute}000001`;
      }
      
      resolve(bonNummer);
    });
  });
};

// MwSt. berechnen
const calculateMwst = (nettoBetrag, mwstProzent) => {
  return Math.round(nettoBetrag * (mwstProzent / 100));
};

// Netto aus Brutto berechnen
const calculateNetto = (bruttoBetrag, mwstProzent) => {
  return Math.round(bruttoBetrag / (1 + (mwstProzent / 100)));
};

// Kassenstand abrufen
const getKassenstand = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT kassenstand_nachher_cent 
      FROM kassenbuch 
      WHERE geschaeft_datum = CURDATE() 
      ORDER BY eintrag_timestamp DESC 
      LIMIT 1
    `;
    
    db.query(query, (error, results) => {
      if (error) return reject(error);
      
      const kassenstand = results.length > 0 ? results[0].kassenstand_nachher_cent : 0;
      resolve(kassenstand);
    });
  });
};

// Kassenbuch-Eintrag erstellen
const createKassenbuchEintrag = (bewegungsart, betrag_cent, beschreibung, verkauf_id = null) => {
  return new Promise((resolve, reject) => {
    getKassenstand().then(kassenstandVorher => {
      const kassenstandNachher = bewegungsart === 'einnahme' ? 
        kassenstandVorher + betrag_cent : 
        kassenstandVorher - betrag_cent;
      
      const query = `
        INSERT INTO kassenbuch (
          geschaeft_datum, bewegungsart, betrag_cent, beschreibung,
          verkauf_id, kassenstand_vorher_cent, kassenstand_nachher_cent
        ) VALUES (CURDATE(), ?, ?, ?, ?, ?, ?)
      `;
      
      db.query(query, [
        bewegungsart, betrag_cent, beschreibung, verkauf_id,
        kassenstandVorher, kassenstandNachher
      ], (error, results) => {
        if (error) return reject(error);
        resolve({ kassenstand_vorher: kassenstandVorher, kassenstand_nachher: kassenstandNachher });
      });
    }).catch(reject);
  });
};

// =====================================================================================
// VERKAUF ERSTELLEN
// =====================================================================================

// POST /api/verkaeufe - Neuen Verkauf erfassen
router.post('/', async (req, res) => {
  const {
    mitglied_id,
    kunde_name,
    artikel, // Array: [{ artikel_id, menge, einzelpreis_cent? }]
    zahlungsart,
    gegeben_cent,
    bemerkung,
    verkauft_von_name
  } = req.body;
  
  // Validierung
  if (!artikel || artikel.length === 0) {
    return res.status(400).json({ error: 'Mindestens ein Artikel erforderlich' });
  }
  
  if (!zahlungsart) {
    return res.status(400).json({ error: 'Zahlungsart erforderlich' });
  }
  
  try {
    // Bonnummer generieren
    const bonNummer = await generateBonNumber();
    
    // Transaction starten
    await new Promise((resolve, reject) => {
      db.beginTransaction(error => error ? reject(error) : resolve());
    });
    
    try {
      // Artikel-Details abrufen und Verfügbarkeit prüfen
      const artikelDetails = [];
      for (const item of artikel) {
        const artikelQuery = `
          SELECT 
            artikel_id, name, artikel_nummer, verkaufspreis_cent, 
            mwst_prozent, lagerbestand, lager_tracking
          FROM artikel 
          WHERE artikel_id = ? AND aktiv = TRUE
        `;
        
        const artikelResult = await new Promise((resolve, reject) => {
          db.query(artikelQuery, [item.artikel_id], (error, results) => {
            if (error) return reject(error);
            resolve(results);
          });
        });
        
        if (artikelResult.length === 0) {
          throw new Error(`Artikel mit ID ${item.artikel_id} nicht gefunden`);
        }
        
        const artikelData = artikelResult[0];
        
        // Lagerbestand prüfen
        if (artikelData.lager_tracking && artikelData.lagerbestand < item.menge) {
          throw new Error(`Nicht genügend Lagerbestand für "${artikelData.name}" (verfügbar: ${artikelData.lagerbestand}, benötigt: ${item.menge})`);
        }
        
        // Preis übernehmen (aktueller Preis oder überschrieben)
        const einzelpreis_cent = item.einzelpreis_cent || artikelData.verkaufspreis_cent;
        
        // Beträge berechnen
        const brutto_cent = einzelpreis_cent * item.menge;
        const netto_cent = calculateNetto(brutto_cent, artikelData.mwst_prozent);
        const mwst_cent = brutto_cent - netto_cent;
        
        artikelDetails.push({
          ...item,
          ...artikelData,
          einzelpreis_cent,
          brutto_cent,
          netto_cent,
          mwst_cent
        });
      }
      
      // Gesamtbeträge berechnen
      const netto_gesamt_cent = artikelDetails.reduce((sum, item) => sum + item.netto_cent, 0);
      const mwst_gesamt_cent = artikelDetails.reduce((sum, item) => sum + item.mwst_cent, 0);
      const brutto_gesamt_cent = artikelDetails.reduce((sum, item) => sum + item.brutto_cent, 0);
      
      // Rückgeld berechnen (nur bei Barzahlung)
      let rueckgeld_cent = 0;
      if (zahlungsart === 'bar' && gegeben_cent) {
        rueckgeld_cent = gegeben_cent - brutto_gesamt_cent;
        if (rueckgeld_cent < 0) {
          throw new Error('Gegebener Betrag zu niedrig');
        }
      }
      
      // Verkauf in DB speichern
      const verkaufQuery = `
        INSERT INTO verkaeufe (
          bon_nummer, kassen_id, mitglied_id, kunde_name,
          verkauf_datum, verkauf_uhrzeit, verkauf_timestamp,
          netto_gesamt_cent, mwst_gesamt_cent, brutto_gesamt_cent,
          zahlungsart, gegeben_cent, rueckgeld_cent,
          verkauft_von_name, bemerkung
        ) VALUES (?, ?, ?, ?, CURDATE(), CURTIME(), NOW(), ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const verkaufResult = await new Promise((resolve, reject) => {
        db.query(verkaufQuery, [
          bonNummer, 'KASSE_01', mitglied_id || null, kunde_name || null,
          netto_gesamt_cent, mwst_gesamt_cent, brutto_gesamt_cent,
          zahlungsart, gegeben_cent || null, rueckgeld_cent,
          verkauft_von_name || 'System', bemerkung || null
        ], (error, results) => {
          if (error) return reject(error);
          resolve(results);
        });
      });
      
      const verkauf_id = verkaufResult.insertId;
      
      // Verkaufspositionen speichern
      for (let i = 0; i < artikelDetails.length; i++) {
        const item = artikelDetails[i];
        
        const positionQuery = `
          INSERT INTO verkauf_positionen (
            verkauf_id, artikel_id, artikel_name, artikel_nummer,
            menge, einzelpreis_cent, mwst_prozent,
            netto_cent, mwst_cent, brutto_cent, position_nummer
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await new Promise((resolve, reject) => {
          db.query(positionQuery, [
            verkauf_id, item.artikel_id, item.name, item.artikel_nummer,
            item.menge, item.einzelpreis_cent, item.mwst_prozent,
            item.netto_cent, item.mwst_cent, item.brutto_cent, i + 1
          ], (error, results) => {
            if (error) return reject(error);
            resolve(results);
          });
        });
      }
      
      // Kassenbuch-Eintrag (nur bei Barzahlung)
      if (zahlungsart === 'bar') {
        await createKassenbuchEintrag(
          'einnahme',
          brutto_gesamt_cent,
          `Verkauf - Bon: ${bonNummer}`,
          verkauf_id
        );
      }
      
      // Transaction bestätigen
      await new Promise((resolve, reject) => {
        db.commit(error => error ? reject(error) : resolve());
      });

      // ✅ AUTOMATISCHE RECHNUNGSERSTELLUNG FÜR VERKAUF
      let rechnungInfo = null;
      try {
        const verkaufData = {
          mitglied_id: mitglied_id || null,
          kunde_name: kunde_name || null,
          artikel: artikelDetails.map(item => ({
            name: item.name,
            menge: item.menge,
            einzelpreis_cent: item.einzelpreis_cent
          })),
          gesamt_betrag_cent: brutto_gesamt_cent,
          netto_gesamt_cent: netto_gesamt_cent,
          mwst_gesamt_cent: mwst_gesamt_cent,
          zahlungsart: zahlungsart
        };

        rechnungInfo = await createRechnungForVerkauf(verkauf_id, verkaufData);
        console.log(`✅ Rechnung ${rechnungInfo.rechnungsnummer} für Verkauf #${verkauf_id} erstellt`);
      } catch (rechnungError) {
        console.error('⚠️  Fehler bei automatischer Rechnungserstellung:', rechnungError);
        // Verkauf wird trotzdem durchgeführt, Rechnung kann manuell nachträglich erstellt werden
      }

      res.json({
        success: true,
        verkauf_id,
        bon_nummer: bonNummer,
        brutto_gesamt_cent,
        brutto_gesamt_euro: brutto_gesamt_cent / 100,
        rueckgeld_cent,
        rueckgeld_euro: rueckgeld_cent / 100,
        artikel_count: artikelDetails.length,
        rechnung: rechnungInfo,
        message: 'Verkauf erfolgreich erfasst' + (rechnungInfo ? ` (Rechnung ${rechnungInfo.rechnungsnummer} erstellt)` : '')
      });
      
    } catch (error) {
      // Rollback bei Fehlern
      await new Promise((resolve) => {
        db.rollback(() => resolve());
      });
      throw error;
    }
    
  } catch (error) {
    console.error('Fehler beim Verkauf:', error);
    res.status(400).json({ error: error.message });
  }
});

// =====================================================================================
// VERKÄUFE ABRUFEN
// =====================================================================================

// GET /api/verkaeufe - Alle Verkäufe abrufen (mit Filterung)
router.get('/', (req, res) => {
  const { 
    datum_von, datum_bis, mitglied_id, zahlungsart, 
    limit = 50, offset = 0 
  } = req.query;
  
  let query = `
    SELECT 
      v.*,
      m.vorname, m.nachname,
      COUNT(vp.position_id) as anzahl_positionen
    FROM verkaeufe v
    LEFT JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
    LEFT JOIN verkauf_positionen vp ON v.verkauf_id = vp.verkauf_id
    WHERE v.storniert = FALSE
  `;
  const params = [];
  
  if (datum_von) {
    query += ' AND v.verkauf_datum >= ?';
    params.push(datum_von);
  }
  
  if (datum_bis) {
    query += ' AND v.verkauf_datum <= ?';
    params.push(datum_bis);
  }
  
  if (mitglied_id) {
    query += ' AND v.mitglied_id = ?';
    params.push(mitglied_id);
  }
  
  if (zahlungsart) {
    query += ' AND v.zahlungsart = ?';
    params.push(zahlungsart);
  }
  
  query += `
    GROUP BY v.verkauf_id
    ORDER BY v.verkauf_timestamp DESC
    LIMIT ? OFFSET ?
  `;
  params.push(parseInt(limit), parseInt(offset));
  
  db.query(query, params, (error, results) => {
    if (error) {
      console.error('Fehler beim Abrufen der Verkäufe:', error);
      return res.status(500).json({ error: 'Fehler beim Abrufen der Verkäufe' });
    }
    
    const formattedResults = results.map(verkauf => ({
      ...verkauf,
      brutto_gesamt_euro: verkauf.brutto_gesamt_cent / 100,
      netto_gesamt_euro: verkauf.netto_gesamt_cent / 100,
      mwst_gesamt_euro: verkauf.mwst_gesamt_cent / 100,
      kunde_anzeige: verkauf.vorname ? 
        `${verkauf.vorname} ${verkauf.nachname}` : 
        verkauf.kunde_name || 'Laufkunde'
    }));
    res.json({ success: true, data: formattedResults });
  });
});

// GET /api/verkaeufe/:id - Einzelnen Verkauf mit Positionen abrufen
router.get('/:id', (req, res) => {
  // Verkaufs-Kopfdaten
  const verkaufQuery = `
    SELECT 
      v.*,
      m.vorname, m.nachname, m.mitgliedsnummer
    FROM verkaeufe v
    LEFT JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
    WHERE v.verkauf_id = ?
  `;
  
  // Verkaufs-Positionen
  const positionenQuery = `
    SELECT 
      vp.*,
      a.bild_url
    FROM verkauf_positionen vp
    LEFT JOIN artikel a ON vp.artikel_id = a.artikel_id
    WHERE vp.verkauf_id = ?
    ORDER BY vp.position_nummer ASC
  `;
  
  Promise.all([
    new Promise((resolve, reject) => {
      db.query(verkaufQuery, [req.params.id], (error, results) => {
        if (error) return reject(error);
        resolve(results);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(positionenQuery, [req.params.id], (error, results) => {
        if (error) return reject(error);
        resolve(results);
      });
    })
  ]).then(([verkaufResults, positionenResults]) => {
    if (verkaufResults.length === 0) {
      return res.status(404).json({ error: 'Verkauf nicht gefunden' });
    }
    
    const verkauf = verkaufResults[0];
    const positionen = positionenResults.map(pos => ({
      ...pos,
      einzelpreis_euro: pos.einzelpreis_cent / 100,
      netto_euro: pos.netto_cent / 100,
      mwst_euro: pos.mwst_cent / 100,
      brutto_euro: pos.brutto_cent / 100
    }));
    
    const result = {
      ...verkauf,
      brutto_gesamt_euro: verkauf.brutto_gesamt_cent / 100,
      netto_gesamt_euro: verkauf.netto_gesamt_cent / 100,
      mwst_gesamt_euro: verkauf.mwst_gesamt_cent / 100,
      rueckgeld_euro: verkauf.rueckgeld_cent / 100,
      gegeben_euro: verkauf.gegeben_cent ? verkauf.gegeben_cent / 100 : null,
      kunde_anzeige: verkauf.vorname ? 
        `${verkauf.vorname} ${verkauf.nachname}` : 
        verkauf.kunde_name || 'Laufkunde',
      positionen
    };
    res.json({ success: true, data: result });
    
  }).catch(error => {
    console.error('Fehler beim Abrufen des Verkaufs:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Verkaufs' });
  });
});

// =====================================================================================
// STORNIERUNG
// =====================================================================================

// POST /api/verkaeufe/:id/storno - Verkauf stornieren
router.post('/:id/storno', (req, res) => {
  const { storno_grund, storno_von } = req.body;
  
  if (!storno_grund) {
    return res.status(400).json({ error: 'Storno-Grund erforderlich' });
  }
  
  // Transaction für Stornierung
  db.beginTransaction((transError) => {
    if (transError) {
      console.error('Transaction-Fehler:', transError);
      return res.status(500).json({ error: 'Transaction-Fehler' });
    }
    
    // Verkauf als storniert markieren
    const stornoQuery = `
      UPDATE verkaeufe 
      SET storniert = TRUE, storno_grund = ?, storno_timestamp = NOW()
      WHERE verkauf_id = ? AND storniert = FALSE
    `;
    
    db.query(stornoQuery, [storno_grund, req.params.id], (error, results) => {
      if (error) {
        db.rollback();
        console.error('Fehler beim Stornieren:', error);
        return res.status(500).json({ error: 'Fehler beim Stornieren' });
      }
      
      if (results.affectedRows === 0) {
        db.rollback();
        return res.status(404).json({ error: 'Verkauf nicht gefunden oder bereits storniert' });
      }
      
      // Verkaufsdetails für Kassenbuch abrufen
      const detailQuery = `
        SELECT brutto_gesamt_cent, zahlungsart, bon_nummer
        FROM verkaeufe 
        WHERE verkauf_id = ?
      `;
      
      db.query(detailQuery, [req.params.id], (detailError, detailResults) => {
        if (detailError) {
          db.rollback();
          console.error('Fehler beim Abrufen der Verkaufsdetails:', detailError);
          return res.status(500).json({ error: 'Fehler beim Abrufen der Verkaufsdetails' });
        }
        
        const verkaufDetail = detailResults[0];
        
        // Kassenbuch-Eintrag für Stornierung (nur bei Barzahlung)
        if (verkaufDetail.zahlungsart === 'bar') {
          createKassenbuchEintrag(
            'ausgabe',
            verkaufDetail.brutto_gesamt_cent,
            `Stornierung - Bon: ${verkaufDetail.bon_nummer} - Grund: ${storno_grund}`,
            req.params.id
          ).then(() => {
            db.commit((commitError) => {
              if (commitError) {
                db.rollback();
                console.error('Commit-Fehler:', commitError);
                return res.status(500).json({ error: 'Commit-Fehler' });
              }
              res.json({ 
                success: true, 
                message: 'Verkauf erfolgreich storniert',
                storno_grund 
              });
            });
          }).catch(kassenbuchError => {
            db.rollback();
            console.error('Kassenbuch-Fehler bei Stornierung:', kassenbuchError);
            res.status(500).json({ error: 'Kassenbuch-Fehler bei Stornierung' });
          });
        } else {
          // Kein Kassenbuch-Eintrag bei Kartenzahlung
          db.commit((commitError) => {
            if (commitError) {
              db.rollback();
              console.error('Commit-Fehler:', commitError);
              return res.status(500).json({ error: 'Commit-Fehler' });
            }
            res.json({ 
              success: true, 
              message: 'Verkauf erfolgreich storniert',
              storno_grund 
            });
          });
        }
      });
    });
  });
});

// =====================================================================================
// STATISTIKEN & REPORTING
// =====================================================================================

// GET /api/verkaeufe/stats/tagesumsatz - Tagesumsatz-Statistiken
router.get('/stats/tagesumsatz', (req, res) => {
  const { datum = new Date().toISOString().slice(0, 10) } = req.query;
  
  const query = `
    SELECT 
      COUNT(*) as anzahl_verkaeufe,
      SUM(brutto_gesamt_cent) as umsatz_cent,
      SUM(CASE WHEN zahlungsart = 'bar' THEN brutto_gesamt_cent ELSE 0 END) as bar_umsatz_cent,
      SUM(CASE WHEN zahlungsart = 'karte' THEN brutto_gesamt_cent ELSE 0 END) as karte_umsatz_cent,
      SUM(CASE WHEN zahlungsart = 'digital' THEN brutto_gesamt_cent ELSE 0 END) as digital_umsatz_cent,
      AVG(brutto_gesamt_cent) as durchschnitt_cent
    FROM verkaeufe
    WHERE verkauf_datum = ? AND storniert = FALSE
  `;
  
  db.query(query, [datum], (error, results) => {
    if (error) {
      console.error('Fehler bei Tagesumsatz-Statistiken:', error);
      return res.status(500).json({ error: 'Fehler bei Tagesumsatz-Statistiken' });
    }
    
    const stats = results[0];
    const formattedStats = {
      datum,
      anzahl_verkaeufe: stats.anzahl_verkaeufe || 0,
      umsatz_cent: stats.umsatz_cent || 0,
      umsatz_euro: (stats.umsatz_cent || 0) / 100,
      bar_umsatz_euro: (stats.bar_umsatz_cent || 0) / 100,
      karte_umsatz_euro: (stats.karte_umsatz_cent || 0) / 100,
      digital_umsatz_euro: (stats.digital_umsatz_cent || 0) / 100,
      durchschnitt_euro: (stats.durchschnitt_cent || 0) / 100
    };
    res.json({ success: true, data: formattedStats });
  });
});

// GET /api/verkaeufe/stats/kassenstand - Aktueller Kassenstand
router.get('/stats/kassenstand', (req, res) => {
  getKassenstand().then(kassenstand => {
    res.json({ 
      success: true, 
      data: {
        kassenstand_cent: kassenstand,
        kassenstand_euro: kassenstand / 100,
        datum: new Date().toISOString().slice(0, 10)
      }
    });
  }).catch(error => {
    console.error('Fehler beim Abrufen des Kassenstands:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Kassenstands' });
  });
});

// GET /api/verkaeufe/:id/kassenbon - Kassenbon als Text abrufen
router.get('/:id/kassenbon', (req, res) => {
  // Verkaufs-Kopfdaten
  const verkaufQuery = `
    SELECT 
      v.*,
      m.vorname, m.nachname, m.mitgliedsnummer
    FROM verkaeufe v
    LEFT JOIN mitglieder m ON v.mitglied_id = m.mitglied_id
    WHERE v.verkauf_id = ?
  `;
  
  // Verkaufs-Positionen
  const positionenQuery = `
    SELECT 
      vp.*,
      a.bild_url
    FROM verkauf_positionen vp
    LEFT JOIN artikel a ON vp.artikel_id = a.artikel_id
    WHERE vp.verkauf_id = ?
    ORDER BY vp.position_nummer ASC
  `;
  
  Promise.all([
    new Promise((resolve, reject) => {
      db.query(verkaufQuery, [req.params.id], (error, results) => {
        if (error) return reject(error);
        resolve(results);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(positionenQuery, [req.params.id], (error, results) => {
        if (error) return reject(error);
        resolve(results);
      });
    })
  ]).then(([verkaufResults, positionenResults]) => {
    if (verkaufResults.length === 0) {
      return res.status(404).json({ error: 'Verkauf nicht gefunden' });
    }
    
    const verkauf = verkaufResults[0];
    const positionen = positionenResults.map(pos => ({
      ...pos,
      einzelpreis_euro: pos.einzelpreis_cent / 100,
      netto_euro: pos.netto_cent / 100,
      mwst_euro: pos.mwst_cent / 100,
      brutto_euro: pos.brutto_cent / 100
    }));
    
    // Kassenbon-Daten vorbereiten
    const kassenbonDaten = {
      bon_nummer: verkauf.bon_nummer,
      kassen_id: verkauf.kassen_id || 'KASSE_01',
      verkauf_datum: verkauf.verkauf_datum,
      verkauf_uhrzeit: verkauf.verkauf_uhrzeit,
      kunde_anzeige: verkauf.vorname ? 
        `${verkauf.vorname} ${verkauf.nachname} (${verkauf.mitgliedsnummer})` : 
        verkauf.kunde_name || 'Laufkunde',
      positionen,
      netto_gesamt_euro: verkauf.netto_gesamt_cent / 100,
      mwst_gesamt_euro: verkauf.mwst_gesamt_cent / 100,
      brutto_gesamt_euro: verkauf.brutto_gesamt_cent / 100,
      zahlungsart: verkauf.zahlungsart,
      gegeben_euro: verkauf.gegeben_cent ? verkauf.gegeben_cent / 100 : null,
      rueckgeld_euro: verkauf.rueckgeld_cent ? verkauf.rueckgeld_cent / 100 : null,
      verkauft_von_name: verkauf.verkauft_von_name,
      tse_signatur: verkauf.tse_signatur
    };
    
    // Kassenbon generieren
    const kassenbonText = generateKassenbon(kassenbonDaten);
    res.json({
      success: true,
      kassenbon: kassenbonText,
      verkauf_id: verkauf.verkauf_id,
      bon_nummer: verkauf.bon_nummer,
      brutto_gesamt_euro: kassenbonDaten.brutto_gesamt_euro
    });
    
  }).catch(error => {
    console.error('Fehler beim Generieren des Kassenbons:', error);
    res.status(500).json({ error: 'Fehler beim Generieren des Kassenbons' });
  });
});

module.exports = router;