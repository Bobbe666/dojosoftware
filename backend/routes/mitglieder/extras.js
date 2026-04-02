/**
 * Extras Routes für Mitglieder
 * Mitgliedsausweis, Kurse, Beitrag
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const MitgliedsausweisGenerator = require('../../utils/mitgliedsausweisGenerator');
const { validateId } = require('../../middleware/validation');
const { getSecureDojoId } = require('../../middleware/tenantSecurity');
const router = express.Router();

router.post("/:id/mitgliedsausweis", async (req, res) => {
  const mitglied_id = parseInt(req.params.id, 10);

  if (isNaN(mitglied_id)) {
    logger.error('[Mitgliedsausweis] Ungültige Mitglieds-ID:', { error: req.params.id });
    return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
  }

  logger.debug('[Mitgliedsausweis] Generiere PDF für Mitglied ${mitglied_id}');

  try {
    // 1. Mitgliedsdaten abrufen
    const mitgliedQuery = `
      SELECT
        m.mitglied_id,
        m.vorname,
        m.nachname,
        m.geburtsdatum,
        m.dojo_id,
        GROUP_CONCAT(DISTINCT s.name ORDER BY s.name SEPARATOR ', ') AS stil,
        g.name AS graduierung
      FROM mitglieder m
      LEFT JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
      LEFT JOIN stile s ON ms.stil = s.name
      LEFT JOIN graduierungen g ON m.graduierung_id = g.id
      WHERE m.mitglied_id = ?
      GROUP BY m.mitglied_id
    `;

    db.query(mitgliedQuery, [mitglied_id], async (err, results) => {
      if (err) {
        logger.error('[Mitgliedsausweis] Datenbankfehler beim Laden des Mitglieds:', { error: err });
        return res.status(500).json({ error: "Fehler beim Laden der Mitgliedsdaten" });
      }

      if (results.length === 0) {
        logger.error('[Mitgliedsausweis] Mitglied nicht gefunden:', { error: mitglied_id });
        return res.status(404).json({ error: "Mitglied nicht gefunden" });
      }

      const mitglied = results[0];
      logger.debug("[Mitgliedsausweis] Mitglied gefunden:", mitglied);

      // 2. Dojo-Daten abrufen
      const dojoQuery = `SELECT dojoname as name, strasse, hausnummer, plz, ort FROM dojo WHERE id = ?`;

      db.query(dojoQuery, [mitglied.dojo_id], async (dojoErr, dojoResults) => {
        if (dojoErr) {
          logger.error('[Mitgliedsausweis] Fehler beim Laden der Dojo-Daten:', { error: dojoErr });
          return res.status(500).json({ error: "Fehler beim Laden der Dojo-Daten" });
        }

        const dojo = dojoResults.length > 0 ? dojoResults[0] : { name: "Dojo" };
        if (dojo.strasse && dojo.hausnummer && dojo.plz && dojo.ort) {
          dojo.adresse = `${dojo.strasse} ${dojo.hausnummer}, ${dojo.plz} ${dojo.ort}`;
        }
        logger.debug("[Mitgliedsausweis] Dojo gefunden:", dojo);

        // 3. PDF generieren
        try {
          const generator = new MitgliedsausweisGenerator();
          const pdfDoc = await generator.generateMitgliedsausweis(mitglied, dojo);

          logger.debug('[Mitgliedsausweis] PDF erfolgreich generiert');

          // 4. PDF an Client senden
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename=mitgliedsausweis_${mitglied_id}.pdf`);

          pdfDoc.pipe(res);
        } catch (pdfError) {
          logger.error('[Mitgliedsausweis] Fehler bei der PDF-Generierung:', { error: pdfError });
          return res.status(500).json({ error: "Fehler bei der PDF-Generierung", details: pdfError.message });
        }
      });
    });
  } catch (error) {
    logger.error('[Mitgliedsausweis] Unerwarteter Fehler:', { error: error });
    return res.status(500).json({ error: "Interner Serverfehler", details: error.message });
  }
});

/**
 * GET /mitglieder/:id/kurse
 * Gibt alle Kurse zurück, an denen ein Mitglied teilnimmt (basierend auf Stil-Zuordnung)
 */
router.get("/:id/kurse", (req, res) => {
  const mitgliedId = req.params.id;

  logger.debug('📅 Lade Kurse für Mitglied ID ${mitgliedId}');

  // Stil ENUM zu ID Mapping
  const stilMapping = {
    'ShieldX': { stil_id: 2, stil_name: 'ShieldX' },
    'BJJ': { stil_id: 3, stil_name: 'BJJ' },
    'Brazilian Jiu Jitsu': { stil_id: 3, stil_name: 'Brazilian Jiu Jitsu' },
    'Kickboxen': { stil_id: 4, stil_name: 'Kickboxen' },
    'Karate': { stil_id: 5, stil_name: 'Enso Karate' },
    'Enso Karate': { stil_id: 5, stil_name: 'Enso Karate' },
    'Taekwon-Do': { stil_id: 7, stil_name: 'Taekwon-Do' }
  };

  // Lade zuerst die Stile des Mitglieds
  const stileQuery = `
    SELECT DISTINCT ms.stil
    FROM mitglied_stile ms
    WHERE ms.mitglied_id = ?
  `;

  db.query(stileQuery, [mitgliedId], (err, stileResults) => {
    if (err) {
      logger.error('Fehler beim Laden der Mitglieds-Stile:', err);
      return res.status(500).json({ error: "Fehler beim Laden der Stile" });
    }

    if (!stileResults || stileResults.length === 0) {
      logger.debug('⚠️ Mitglied hat keine Stile - keine Kurse vorhanden');
      return res.json([]);
    }

    // Map ENUM stil values to stil_ids
    const stilIds = stileResults
      .map(s => {
        const stilInfo = stilMapping[s.stil];
        if (!stilInfo) {
          logger.warn('Stil nicht im Mapping gefunden', { stil: s.stil });
          return null;
        }
        return stilInfo.stil_id;
      })
      .filter(Boolean);

    logger.info('Mitglied hat Stile', { enums: stileResults.map(s => s.stil), ids: stilIds });

    if (stilIds.length === 0) {
      logger.debug('⚠️ Keine Stil-IDs gefunden - keine Kurse vorhanden');
      return res.json([]);
    }

    // Lade Kurse die zu den Stilen passen
    // WICHTIG: kurse.stil ist VARCHAR, nicht stil_id
    const stilEnums = stileResults.map(s => s.stil);
    logger.info('Mitglied hat Stil-ENUMs für Kurse:', { details: stilEnums });

    const kurseQuery = `
      SELECT DISTINCT
        k.kurs_id,
        k.gruppenname as name,
        sp.tag as wochentag,
        sp.uhrzeit_start as uhrzeit,
        TIMESTAMPDIFF(MINUTE, sp.uhrzeit_start, sp.uhrzeit_ende) as dauer,
        r.name as raum,
        k.stil as stil_name,
        k.trainer_ids,
        k.trainer_id
      FROM kurse k
      LEFT JOIN stundenplan sp ON k.kurs_id = sp.kurs_id
      LEFT JOIN raeume r ON sp.raum_id = r.id
      WHERE k.stil IN (?)
      ORDER BY
        FIELD(sp.tag, 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'),
        sp.uhrzeit_start,
        k.gruppenname
    `;

    db.query(kurseQuery, [stilEnums], async (err, kurseResults) => {
      if (err) {
        logger.error('Fehler beim Laden der Kurse:', err);
        return res.status(500).json({ error: "Fehler beim Laden der Kurse" });
      }

      logger.info('${kurseResults.length} Kurs-Einträge für Mitglied ${mitgliedId} gefunden');

      if (kurseResults.length === 0) {
        return res.json([]);
      }

      // Sammle alle Trainer-IDs aus allen Kursen
      const allTrainerIds = new Set();
      kurseResults.forEach(kurs => {
        // Parse trainer_ids JSON array
        let trainerIds = [];
        if (kurs.trainer_ids && typeof kurs.trainer_ids === 'string') {
          try {
            trainerIds = JSON.parse(kurs.trainer_ids);
          } catch (e) {
            logger.warn('Konnte trainer_ids nicht parsen für Kurs ${kurs.kurs_id}:', e);
          }
        } else if (Array.isArray(kurs.trainer_ids)) {
          trainerIds = kurs.trainer_ids;
        } else if (kurs.trainer_id) {
          // Fallback auf altes trainer_id Feld
          trainerIds = [kurs.trainer_id];
        }

        trainerIds.forEach(id => allTrainerIds.add(id));
      });

      if (allTrainerIds.size === 0) {
        // Keine Trainer zugeordnet - gebe Kurse ohne Trainer-Namen zurück
        logger.debug('⚠️ Keine Trainer-IDs gefunden');
        return res.json(kurseResults.map(k => ({
          ...k,
          trainer_vorname: null,
          trainer_nachname: null,
          trainer_name: 'TBA'
        })));
      }

      // Lade alle Trainer auf einmal
      const trainerQuery = `
        SELECT trainer_id, vorname, nachname
        FROM trainer
        WHERE trainer_id IN (?)
      `;

      db.query(trainerQuery, [Array.from(allTrainerIds)], (err, trainerResults) => {
        if (err) {
          logger.error('Fehler beim Laden der Trainer:', err);
          return res.status(500).json({ error: "Fehler beim Laden der Trainer" });
        }

        // Erstelle Trainer-Lookup-Map
        const trainerMap = {};
        trainerResults.forEach(trainer => {
          trainerMap[trainer.trainer_id] = trainer;
        });

        // Füge Trainer-Namen zu jedem Kurs hinzu
        const enrichedKurse = kurseResults.map(kurs => {
          // Parse trainer_ids
          let trainerIds = [];
          if (kurs.trainer_ids && typeof kurs.trainer_ids === 'string') {
            try {
              trainerIds = JSON.parse(kurs.trainer_ids);
            } catch (e) {
              logger.warn('Konnte trainer_ids nicht parsen für Kurs ${kurs.kurs_id}');
            }
          } else if (Array.isArray(kurs.trainer_ids)) {
            trainerIds = kurs.trainer_ids;
          } else if (kurs.trainer_id) {
            trainerIds = [kurs.trainer_id];
          }

          // Hole ersten Trainer (für Kompatibilität)
          const firstTrainerId = trainerIds[0];
          const firstTrainer = trainerMap[firstTrainerId];

          return {
            kurs_id: kurs.kurs_id,
            name: kurs.name,
            wochentag: kurs.wochentag,
            uhrzeit: kurs.uhrzeit,
            dauer: kurs.dauer,
            raum: kurs.raum,
            stil_name: kurs.stil_name,
            trainer_vorname: firstTrainer?.vorname || null,
            trainer_nachname: firstTrainer?.nachname || null,
            trainer_name: firstTrainer ? `${firstTrainer.vorname} ${firstTrainer.nachname}` : 'TBA'
          };
        });

        logger.info('${enrichedKurse.length} Kurse mit Trainer-Namen angereichert');
        res.json(enrichedKurse);
      });
    });
  });
});

/**
 * PUT /mitglieder/:id/beitrag
 * Aktualisiert den Monatsbeitrag eines Mitglieds
 */
router.put("/:id/beitrag", validateId('id'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { monatsbeitrag } = req.body;
  const secureDojoId = getSecureDojoId(req);

  // Validierung
  if (monatsbeitrag == null || isNaN(parseFloat(monatsbeitrag))) {
    return res.status(400).json({ error: "Ungültiger Monatsbeitrag" });
  }

  const beitrag = parseFloat(monatsbeitrag);

  // SQL Query mit Multi-Tenancy
  let whereConditions = ['mitglied_id = ?'];
  const values = [beitrag, id];

  if (secureDojoId) {
    whereConditions.push('dojo_id = ?');
    values.push(secureDojoId);
  }

  const query = `
    UPDATE mitglieder
    SET monatsbeitrag = ?
    WHERE ${whereConditions.join(' AND ')}
  `;

  db.query(query, values, (error, results) => {
    if (error) {
      logger.error('Datenbankfehler beim Beitrag-Update:', error);
      return res.status(500).json({
        error: 'Datenbankfehler beim Aktualisieren des Beitrags',
        details: error.message
      });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden oder keine Berechtigung' });
    }

    logger.info(`Monatsbeitrag aktualisiert für Mitglied ${id} auf ${beitrag}€`);
    res.json({ message: 'Beitrag erfolgreich aktualisiert', monatsbeitrag: beitrag });
  });
});

module.exports = router;
