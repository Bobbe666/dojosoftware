const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /mitglieder/:mitgliedId/zehnerkarten
 * Alle 10er-Karten eines Mitglieds abrufen
 */
router.get('/mitglieder/:mitgliedId/zehnerkarten', async (req, res) => {
  try {
    const { mitgliedId } = req.params;

    const query = `
      SELECT
        z.*,
        t.name as tarif_name,
        t.altersgruppe
      FROM zehnerkarten z
      LEFT JOIN tarife t ON z.tarif_id = t.id
      WHERE z.mitglied_id = ?
      ORDER BY z.gekauft_am DESC
    `;

    const [zehnerkarten] = await db.query(query, [mitgliedId]);

    // Status automatisch aktualisieren
    for (const karte of zehnerkarten) {
      let newStatus = karte.status;

      // Prüfe ob abgelaufen
      if (new Date(karte.gueltig_bis) < new Date() && karte.status === 'aktiv') {
        newStatus = 'abgelaufen';
      }

      // Prüfe ob aufgebraucht
      if (karte.einheiten_verbleibend <= 0 && karte.status === 'aktiv') {
        newStatus = 'aufgebraucht';
      }

      // Status aktualisieren falls geändert
      if (newStatus !== karte.status) {
        await db.query(
          'UPDATE zehnerkarten SET status = ? WHERE id = ?',
          [newStatus, karte.id]
        );
        karte.status = newStatus;
      }
    }

    res.json({ success: true, data: zehnerkarten });
  } catch (error) {
    console.error('Fehler beim Abrufen der 10er-Karten:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /mitglieder/:mitgliedId/zehnerkarten
 * Neue 10er-Karte erstellen
 */
router.post('/mitglieder/:mitgliedId/zehnerkarten', async (req, res) => {
  try {
    const { mitgliedId } = req.params;
    const { tarif_id, gekauft_am, einheiten_gesamt = 10 } = req.body;

    // Tarif-Details abrufen
    const [tarife] = await db.query('SELECT * FROM tarife WHERE id = ?', [tarif_id]);

    if (tarife.length === 0) {
      return res.status(404).json({ success: false, error: 'Tarif nicht gefunden' });
    }

    const tarif = tarife[0];

    // Gültigkeitsdatum berechnen (Tarif duration_months)
    const kaufdatum = new Date(gekauft_am || new Date());
    const gueltigBis = new Date(kaufdatum);
    gueltigBis.setMonth(gueltigBis.getMonth() + (tarif.duration_months || 6));

    // 10er-Karte erstellen
    const insertQuery = `
      INSERT INTO zehnerkarten (
        mitglied_id,
        tarif_id,
        gekauft_am,
        gueltig_bis,
        einheiten_gesamt,
        einheiten_verbleibend,
        status,
        preis_cents
      ) VALUES (?, ?, ?, ?, ?, ?, 'aktiv', ?)
    `;

    const [result] = await db.query(insertQuery, [
      mitgliedId,
      tarif_id,
      kaufdatum,
      gueltigBis,
      einheiten_gesamt,
      einheiten_gesamt,
      tarif.price_cents
    ]);

    // Erstellte 10er-Karte abrufen
    const [neueKarte] = await db.query(
      `SELECT z.*, t.name as tarif_name
       FROM zehnerkarten z
       LEFT JOIN tarife t ON z.tarif_id = t.id
       WHERE z.id = ?`,
      [result.insertId]
    );

    res.json({ success: true, data: neueKarte[0] });
  } catch (error) {
    console.error('Fehler beim Erstellen der 10er-Karte:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /zehnerkarten/:id
 * Details einer 10er-Karte abrufen
 */
router.get('/zehnerkarten/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        z.*,
        t.name as tarif_name,
        t.altersgruppe,
        m.vorname,
        m.nachname
      FROM zehnerkarten z
      LEFT JOIN tarife t ON z.tarif_id = t.id
      LEFT JOIN mitglieder m ON z.mitglied_id = m.mitglied_id
      WHERE z.id = ?
    `;

    const [zehnerkarten] = await db.query(query, [id]);

    if (zehnerkarten.length === 0) {
      return res.status(404).json({ success: false, error: '10er-Karte nicht gefunden' });
    }

    res.json({ success: true, data: zehnerkarten[0] });
  } catch (error) {
    console.error('Fehler beim Abrufen der 10er-Karte:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /zehnerkarten/:id/checkin
 * Check-in durchführen (Einheit abbuchen)
 */
router.post('/zehnerkarten/:id/checkin', async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { buchungsdatum = new Date(), notiz = '' } = req.body;

    // 10er-Karte abrufen
    const [zehnerkarten] = await connection.query(
      'SELECT * FROM zehnerkarten WHERE id = ?',
      [id]
    );

    if (zehnerkarten.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: '10er-Karte nicht gefunden' });
    }

    const karte = zehnerkarten[0];

    // Validierungen
    if (karte.status !== 'aktiv') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: `10er-Karte ist ${karte.status}`
      });
    }

    if (karte.einheiten_verbleibend <= 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: 'Keine Einheiten mehr verfügbar'
      });
    }

    if (new Date(karte.gueltig_bis) < new Date()) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: '10er-Karte ist abgelaufen'
      });
    }

    // Prüfen ob heute bereits eingecheckt
    const datum = new Date(buchungsdatum).toISOString().split('T')[0];
    const [existingBooking] = await connection.query(
      'SELECT * FROM zehnerkarten_buchungen WHERE zehnerkarte_id = ? AND buchungsdatum = ?',
      [id, datum]
    );

    if (existingBooking.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: 'Für dieses Datum wurde bereits ein Check-in durchgeführt'
      });
    }

    // Buchung erstellen
    await connection.query(
      `INSERT INTO zehnerkarten_buchungen
       (zehnerkarte_id, mitglied_id, buchungsdatum, buchungszeit, einheiten, notiz)
       VALUES (?, ?, ?, NOW(), 1, ?)`,
      [id, karte.mitglied_id, datum, notiz]
    );

    // Einheiten reduzieren
    const neueEinheiten = karte.einheiten_verbleibend - 1;
    let neuerStatus = karte.status;

    // Status auf "aufgebraucht" setzen wenn keine Einheiten mehr
    if (neueEinheiten <= 0) {
      neuerStatus = 'aufgebraucht';
    }

    await connection.query(
      'UPDATE zehnerkarten SET einheiten_verbleibend = ?, status = ? WHERE id = ?',
      [neueEinheiten, neuerStatus, id]
    );

    await connection.commit();

    // Aktualisierte Karte abrufen
    const [updatedKarte] = await connection.query(
      `SELECT z.*, t.name as tarif_name
       FROM zehnerkarten z
       LEFT JOIN tarife t ON z.tarif_id = t.id
       WHERE z.id = ?`,
      [id]
    );

    res.json({
      success: true,
      data: updatedKarte[0],
      message: `Check-in erfolgreich. ${neueEinheiten} Einheiten verbleibend.`,
      isLastUnit: neueEinheiten === 0 // Flag für letzte Einheit
    });
  } catch (error) {
    await connection.rollback();
    console.error('Fehler beim Check-in:', error);

    // Spezielle Behandlung für Unique Constraint Error
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Für dieses Datum wurde bereits ein Check-in durchgeführt'
      });
    }

    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

/**
 * GET /zehnerkarten/:id/buchungen
 * Buchungshistorie einer 10er-Karte abrufen
 */
router.get('/zehnerkarten/:id/buchungen', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        b.*,
        m.vorname,
        m.nachname
      FROM zehnerkarten_buchungen b
      LEFT JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
      WHERE b.zehnerkarte_id = ?
      ORDER BY b.buchungsdatum DESC
    `;

    const [buchungen] = await db.query(query, [id]);

    res.json({ success: true, data: buchungen });
  } catch (error) {
    console.error('Fehler beim Abrufen der Buchungen:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /zehnerkarten/nachkauf
 * Neue 10er-Karte nach Ablauf der alten kaufen (mit Zahlungsauswahl)
 */
router.post('/zehnerkarten/nachkauf', async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      mitglied_id,
      tarif_id,
      zahlungsart, // 'bar', 'lastschrift', 'rechnung'
      einheiten_gesamt = 10
    } = req.body;

    // Validierung
    if (!mitglied_id || !tarif_id || !zahlungsart) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: 'Mitglied-ID, Tarif-ID und Zahlungsart sind erforderlich'
      });
    }

    if (!['bar', 'lastschrift', 'rechnung'].includes(zahlungsart)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: 'Ungültige Zahlungsart. Erlaubt: bar, lastschrift, rechnung'
      });
    }

    // Mitglied-Daten abrufen
    const [mitglieder] = await connection.query(
      'SELECT * FROM mitglieder WHERE mitglied_id = ?',
      [mitglied_id]
    );

    if (mitglieder.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Mitglied nicht gefunden' });
    }

    const mitglied = mitglieder[0];

    // Tarif-Details abrufen
    const [tarife] = await connection.query('SELECT * FROM tarife WHERE id = ?', [tarif_id]);

    if (tarife.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Tarif nicht gefunden' });
    }

    const tarif = tarife[0];

    // Gültigkeitsdatum berechnen
    const heute = new Date();
    const gueltigBis = new Date(heute);
    gueltigBis.setMonth(gueltigBis.getMonth() + (tarif.duration_months || 6));

    // 10er-Karte erstellen
    const [karteResult] = await connection.query(
      `INSERT INTO zehnerkarten (
        mitglied_id,
        tarif_id,
        gekauft_am,
        gueltig_bis,
        einheiten_gesamt,
        einheiten_verbleibend,
        status,
        preis_cents
      ) VALUES (?, ?, ?, ?, ?, ?, 'aktiv', ?)`,
      [
        mitglied_id,
        tarif_id,
        heute,
        gueltigBis,
        einheiten_gesamt,
        einheiten_gesamt,
        tarif.price_cents
      ]
    );

    const neueKarteId = karteResult.insertId;

    // Je nach Zahlungsart unterschiedlich vorgehen
    let zusatzInfo = {};

    if (zahlungsart === 'bar') {
      // Admin-Benachrichtigung erstellen
      const [admins] = await connection.query(
        'SELECT mitglied_id FROM mitglieder WHERE rolle = "admin" OR rolle = "trainer"'
      );

      const notificationText = `💵 Barzahlung erforderlich: ${mitglied.vorname} ${mitglied.nachname} möchte eine ${tarif.name} für €${(tarif.price_cents / 100).toFixed(2)} bar bezahlen.`;

      for (const admin of admins) {
        await connection.query(
          `INSERT INTO benachrichtigungen (mitglied_id, nachricht, typ, erstellt_am)
           VALUES (?, ?, 'barzahlung', NOW())`,
          [admin.mitglied_id, notificationText]
        );
      }

      zusatzInfo.benachrichtigung = 'Admin wurde über Barzahlung informiert';
    } else if (zahlungsart === 'lastschrift') {
      // Offenen Posten für nächste SEPA-Buchung erstellen
      const beschreibung = `10er-Karte: ${tarif.name}`;

      await connection.query(
        `INSERT INTO offene_posten (
          mitglied_id,
          zehnerkarte_id,
          betrag_cents,
          beschreibung,
          faellig_am,
          status,
          zahlungsart
        ) VALUES (?, ?, ?, ?, ?, 'offen', 'lastschrift')`,
        [
          mitglied_id,
          neueKarteId,
          tarif.price_cents,
          beschreibung,
          heute
        ]
      );

      zusatzInfo.lastschrift = 'Betrag wird bei nächster SEPA-Buchung eingezogen';
    } else if (zahlungsart === 'rechnung') {
      // Rechnung erstellen
      const rechnungsnummer = await generateRechnungsnummer(connection);

      const [rechnungResult] = await connection.query(
        `INSERT INTO rechnungen (
          mitglied_id,
          rechnungsnummer,
          rechnungsdatum,
          faelligkeitsdatum,
          betrag_netto_cents,
          mwst_prozent,
          betrag_brutto_cents,
          status,
          zahlungsart
        ) VALUES (?, ?, ?, DATE_ADD(?, INTERVAL 14 DAY), ?, 0, ?, 'offen', 'rechnung')`,
        [
          mitglied_id,
          rechnungsnummer,
          heute,
          heute,
          tarif.price_cents,
          tarif.price_cents
        ]
      );

      const rechnungId = rechnungResult.insertId;

      // Rechnungsposition hinzufügen
      await connection.query(
        `INSERT INTO rechnungspositionen (
          rechnung_id,
          position,
          bezeichnung,
          menge,
          einzelpreis_cents,
          gesamtpreis_cents
        ) VALUES (?, 1, ?, 1, ?, ?)`,
        [
          rechnungId,
          `10er-Karte: ${tarif.name}`,
          tarif.price_cents,
          tarif.price_cents
        ]
      );

      // TODO: Rechnung per E-Mail versenden
      // Dies würde einen separaten E-Mail-Service aufrufen
      zusatzInfo.rechnung = {
        rechnungsnummer,
        rechnungId,
        hinweis: 'Rechnung wird per E-Mail versendet'
      };
    }

    await connection.commit();

    // Erstellte 10er-Karte abrufen
    const [neueKarte] = await connection.query(
      `SELECT z.*, t.name as tarif_name
       FROM zehnerkarten z
       LEFT JOIN tarife t ON z.tarif_id = t.id
       WHERE z.id = ?`,
      [neueKarteId]
    );

    res.json({
      success: true,
      data: neueKarte[0],
      zahlungsart,
      ...zusatzInfo,
      message: `10er-Karte erfolgreich erstellt (${zahlungsart})`
    });
  } catch (error) {
    await connection.rollback();
    console.error('Fehler beim Nachkauf:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

/**
 * Hilfsfunktion: Rechnungsnummer generieren
 */
async function generateRechnungsnummer(connection) {
  const heute = new Date();
  const jahr = heute.getFullYear();
  const monat = String(heute.getMonth() + 1).padStart(2, '0');
  const tag = String(heute.getDate()).padStart(2, '0');

  // Format: YYYY/MM/DD-NNNN
  const prefix = `${jahr}/${monat}/${tag}`;

  // Letzte Rechnung des Tages suchen
  const [rechnungen] = await connection.query(
    `SELECT rechnungsnummer FROM rechnungen
     WHERE rechnungsnummer LIKE ?
     ORDER BY rechnungsnummer DESC
     LIMIT 1`,
    [`${prefix}-%`]
  );

  let laufnummer = 1000;
  if (rechnungen.length > 0) {
    const lastNumber = rechnungen[0].rechnungsnummer.split('-')[1];
    laufnummer = parseInt(lastNumber) + 1;
  }

  return `${prefix}-${laufnummer}`;
}

/**
 * DELETE /zehnerkarten/:id
 * 10er-Karte löschen (nur wenn noch keine Buchungen vorhanden)
 */
router.delete('/zehnerkarten/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Prüfen ob Buchungen vorhanden
    const [buchungen] = await db.query(
      'SELECT COUNT(*) as count FROM zehnerkarten_buchungen WHERE zehnerkarte_id = ?',
      [id]
    );

    if (buchungen[0].count > 0) {
      return res.status(400).json({
        success: false,
        error: 'Kann 10er-Karte nicht löschen, da bereits Buchungen vorhanden sind'
      });
    }

    await db.query('DELETE FROM zehnerkarten WHERE id = ?', [id]);

    res.json({ success: true, message: '10er-Karte erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen der 10er-Karte:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
