const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const PaymentProviderFactory = require('../services/PaymentProviderFactory');
const { authenticateToken } = require('../middleware/auth');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

// 🔒 SICHERHEIT: Alle 10er-Karten-Routen erfordern Login (dieser Router ist unter
// /api gemountet, daher Auth hier im Router statt am Mount, um andere Routen nicht
// zu treffen). Ohne diesen Guard waren Guthaben/Buchungen unauthentifiziert lesbar.
router.use(authenticateToken);

// Helper function to promisify db.query
const query = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) reject(error);
      else resolve(results);
    });
  });
};

// 🔒 Cross-Tenant-Schutz: gehört das Mitglied zum Dojo des eingeloggten Users?
// secureDojoId === null bedeutet Super-Admin (Zugriff auf alle Dojos).
async function mitgliedInDojo(mitgliedId, secureDojoId) {
  if (!secureDojoId) return true;
  const rows = await query('SELECT dojo_id FROM mitglieder WHERE mitglied_id = ?', [mitgliedId]);
  return rows.length > 0 && Number(rows[0].dojo_id) === Number(secureDojoId);
}

// 🔒 Cross-Tenant-Schutz: gehört die 10er-Karte (via Mitglied) zum Dojo des Users?
async function karteInDojo(karteId, secureDojoId) {
  if (!secureDojoId) return true;
  const rows = await query(
    'SELECT m.dojo_id FROM zehnerkarten z JOIN mitglieder m ON z.mitglied_id = m.mitglied_id WHERE z.id = ?',
    [karteId]
  );
  return rows.length > 0 && Number(rows[0].dojo_id) === Number(secureDojoId);
}

/**
 * Ruhepause-Verrechnung: bereits BEZAHLTE Mitgliedsbeiträge, deren Zahlungsdatum
 * in einen Ruhepause-Zeitraum des Mitglieds fällt, werden auf den 10er-Karten-Preis
 * angerechnet. Nur die Differenz wird per SEPA abgebucht; ein Überschuss wird als
 * Guthaben gutgeschrieben. Bereits angerechnete Beiträge (verrechnet_zehnerkarte_id
 * gesetzt) werden ausgeschlossen -> keine Doppel-Anrechnung.
 */
async function computeRuhepauseVerrechnung(mitgliedId, kartenpreisCents) {
  const beitraege = await query(
    `SELECT b.beitrag_id, b.betrag, b.zahlungsdatum
       FROM beitraege b
      WHERE b.mitglied_id = ?
        AND b.bezahlt = 1
        AND b.art = 'mitgliedsbeitrag'
        AND b.verrechnet_zehnerkarte_id IS NULL
        AND EXISTS (
          SELECT 1 FROM vertraege v
           WHERE v.mitglied_id = b.mitglied_id
             AND v.ruhepause_von IS NOT NULL AND v.ruhepause_bis IS NOT NULL
             AND b.zahlungsdatum BETWEEN v.ruhepause_von AND v.ruhepause_bis
        )
      ORDER BY b.zahlungsdatum ASC`,
    [mitgliedId]
  );
  let anrechenbarCents = 0;
  const items = beitraege.map(b => {
    const c = Math.round(parseFloat(b.betrag) * 100);
    anrechenbarCents += c;
    return { beitrag_id: b.beitrag_id, betrag_cents: c, zahlungsdatum: b.zahlungsdatum };
  });
  const differenzCents = (kartenpreisCents || 0) - anrechenbarCents;
  return {
    kartenpreis_cents: kartenpreisCents || 0,
    anrechenbar_cents: anrechenbarCents,
    beitraege: items,
    abbuchung_cents: differenzCents > 0 ? differenzCents : 0,
    guthaben_cents: differenzCents < 0 ? -differenzCents : 0,
  };
}

/**
 * GET /mitglieder/:mitgliedId/zehnerkarten
 * Alle 10er-Karten eines Mitglieds abrufen
 */
router.get('/mitglieder/:mitgliedId/zehnerkarten', async (req, res) => {
  try {
    const { mitgliedId } = req.params;
    const secureDojoId = getSecureDojoId(req);
    if (!await mitgliedInDojo(mitgliedId, secureDojoId)) {
      return res.status(404).json({ success: false, error: 'Mitglied nicht gefunden' });
    }

    const sql = `
      SELECT
        z.*,
        t.name as tarif_name,
        t.altersgruppe
      FROM zehnerkarten z
      LEFT JOIN tarife t ON z.tarif_id = t.id
      WHERE z.mitglied_id = ?
      ORDER BY z.gekauft_am DESC
    `;

    const zehnerkarten = await query(sql, [mitgliedId]);

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
        await query(
          'UPDATE zehnerkarten SET status = ? WHERE id = ?',
          [newStatus, karte.id]
        );
        karte.status = newStatus;
      }
    }

    res.json({ success: true, data: zehnerkarten });
  } catch (error) {
    logger.error('Fehler beim Abrufen der 10er-Karten:', { error: error });
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
    const secureDojoId = getSecureDojoId(req);
    if (!await mitgliedInDojo(mitgliedId, secureDojoId)) {
      return res.status(404).json({ success: false, error: 'Mitglied nicht gefunden' });
    }

    // Tarif-Details abrufen (dojo-gescoped: kein fremder Tarif)
    const tarife = secureDojoId
      ? await query('SELECT * FROM tarife WHERE id = ? AND dojo_id = ?', [tarif_id, secureDojoId])
      : await query('SELECT * FROM tarife WHERE id = ?', [tarif_id]);

    if (tarife.length === 0) {
      return res.status(404).json({ success: false, error: 'Tarif nicht gefunden' });
    }

    const tarif = tarife[0];

    // Gültigkeitsdatum berechnen (Tarif duration_months)
    const kaufdatum = new Date(gekauft_am || new Date());
    const gueltigBis = new Date(kaufdatum);
    gueltigBis.setMonth(gueltigBis.getMonth() + (tarif.duration_months || 6));

    // 10er-Karte erstellen
    const insertSql = `
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

    const result = await query(insertSql, [
      mitgliedId,
      tarif_id,
      kaufdatum,
      gueltigBis,
      einheiten_gesamt,
      einheiten_gesamt,
      tarif.price_cents
    ]);

    // Erstellte 10er-Karte abrufen
    const neueKarte = await query(
      `SELECT z.*, t.name as tarif_name
       FROM zehnerkarten z
       LEFT JOIN tarife t ON z.tarif_id = t.id
       WHERE z.id = ?`,
      [result.insertId]
    );

    res.json({ success: true, data: neueKarte[0] });
  } catch (error) {
    logger.error('Fehler beim Erstellen der 10er-Karte:', { error: error });
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
    if (!await karteInDojo(id, getSecureDojoId(req))) {
      return res.status(404).json({ success: false, error: '10er-Karte nicht gefunden' });
    }

    const sql = `
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

    const zehnerkarten = await query(sql, [id]);

    if (zehnerkarten.length === 0) {
      return res.status(404).json({ success: false, error: '10er-Karte nicht gefunden' });
    }

    res.json({ success: true, data: zehnerkarten[0] });
  } catch (error) {
    logger.error('Fehler beim Abrufen der 10er-Karte:', { error: error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /zehnerkarten/:id/checkin
 * Check-in durchführen (Einheit abbuchen)
 */
router.post('/zehnerkarten/:id/checkin', async (req, res) => {
  try {
    const { id } = req.params;
    const { buchungsdatum = new Date(), notiz = '' } = req.body;
    if (!await karteInDojo(id, getSecureDojoId(req))) {
      return res.status(404).json({ success: false, error: '10er-Karte nicht gefunden' });
    }

    // 10er-Karte abrufen
    const zehnerkarten = await query(
      'SELECT * FROM zehnerkarten WHERE id = ?',
      [id]
    );

    if (zehnerkarten.length === 0) {
      return res.status(404).json({ success: false, error: '10er-Karte nicht gefunden' });
    }

    const karte = zehnerkarten[0];

    // Validierungen
    if (karte.status !== 'aktiv') {
      return res.status(400).json({
        success: false,
        error: `10er-Karte ist ${karte.status}`
      });
    }

    if (karte.einheiten_verbleibend <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Keine Einheiten mehr verfügbar'
      });
    }

    if (new Date(karte.gueltig_bis) < new Date()) {
      return res.status(400).json({
        success: false,
        error: '10er-Karte ist abgelaufen'
      });
    }

    // Prüfen ob heute bereits eingecheckt
    const datum = new Date(buchungsdatum).toISOString().split('T')[0];
    const existingBooking = await query(
      'SELECT * FROM zehnerkarten_buchungen WHERE zehnerkarte_id = ? AND buchungsdatum = ?',
      [id, datum]
    );

    if (existingBooking.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Für dieses Datum wurde bereits ein Check-in durchgeführt'
      });
    }

    // Buchung erstellen
    await query(
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

    await query(
      'UPDATE zehnerkarten SET einheiten_verbleibend = ?, status = ? WHERE id = ?',
      [neueEinheiten, neuerStatus, id]
    );

    // Aktualisierte Karte abrufen
    const updatedKarte = await query(
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
      isLastUnit: neueEinheiten === 0
    });
  } catch (error) {
    logger.error('Fehler beim Check-in:', { error: error });

    // Spezielle Behandlung für Unique Constraint Error
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Für dieses Datum wurde bereits ein Check-in durchgeführt'
      });
    }

    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /zehnerkarten/:id/buchungen
 * Buchungshistorie einer 10er-Karte abrufen
 */
router.get('/zehnerkarten/:id/buchungen', async (req, res) => {
  try {
    const { id } = req.params;
    if (!await karteInDojo(id, getSecureDojoId(req))) {
      return res.status(404).json({ success: false, error: '10er-Karte nicht gefunden' });
    }

    const sql = `
      SELECT
        b.*,
        m.vorname,
        m.nachname
      FROM zehnerkarten_buchungen b
      LEFT JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
      WHERE b.zehnerkarte_id = ?
      ORDER BY b.buchungsdatum DESC
    `;

    const buchungen = await query(sql, [id]);

    res.json({ success: true, data: buchungen });
  } catch (error) {
    logger.error('Fehler beim Abrufen der Buchungen:', { error: error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /zehnerkarten/verrechnung-preview?mitglied_id=&tarif_id=
 * Vorschau: wie viel aus Ruhepause-Beiträgen angerechnet wird und was abgebucht/gutgeschrieben wird.
 */
router.get('/zehnerkarten/verrechnung-preview', async (req, res) => {
  try {
    const { mitglied_id, tarif_id } = req.query;
    if (!mitglied_id || !tarif_id) {
      return res.status(400).json({ success: false, error: 'mitglied_id und tarif_id erforderlich' });
    }
    const secureDojoId = getSecureDojoId(req);
    if (!await mitgliedInDojo(mitglied_id, secureDojoId)) {
      return res.status(404).json({ success: false, error: 'Mitglied nicht gefunden' });
    }
    const tarife = secureDojoId
      ? await query('SELECT price_cents FROM tarife WHERE id = ? AND dojo_id = ?', [tarif_id, secureDojoId])
      : await query('SELECT price_cents FROM tarife WHERE id = ?', [tarif_id]);
    if (tarife.length === 0) return res.status(404).json({ success: false, error: 'Tarif nicht gefunden' });
    const v = await computeRuhepauseVerrechnung(mitglied_id, tarife[0].price_cents);
    res.json({ success: true, ...v });
  } catch (error) {
    logger.error('Fehler bei Verrechnungs-Vorschau:', { error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /zehnerkarten/nachkauf
 * Neue 10er-Karte nach Ablauf der alten kaufen (mit Zahlungsauswahl)
 */
router.post('/zehnerkarten/nachkauf', async (req, res) => {
  try {
    const {
      mitglied_id,
      tarif_id,
      zahlungsart,
      einheiten_gesamt = 10
    } = req.body;

    // Validierung
    if (!mitglied_id || !tarif_id || !zahlungsart) {
      return res.status(400).json({
        success: false,
        error: 'Mitglied-ID, Tarif-ID und Zahlungsart sind erforderlich'
      });
    }

    if (!['bar', 'lastschrift', 'rechnung'].includes(zahlungsart)) {
      return res.status(400).json({
        success: false,
        error: 'Ungültige Zahlungsart. Erlaubt: bar, lastschrift, rechnung'
      });
    }

    const secureDojoId = getSecureDojoId(req);
    if (!await mitgliedInDojo(mitglied_id, secureDojoId)) {
      return res.status(404).json({ success: false, error: 'Mitglied nicht gefunden' });
    }

    // Doppelklick-/Doppel-Submit-Schutz: identische Lastschrift-Aufladung in den
    // letzten 90 Sekunden ablehnen (verhindert doppelte Karte + doppelte Abbuchung)
    if (zahlungsart === 'lastschrift') {
      const recent = await query(
        `SELECT op.id FROM offene_posten op
           JOIN zehnerkarten zk ON op.zehnerkarte_id = zk.id
          WHERE op.mitglied_id = ? AND zk.tarif_id = ? AND op.zahlungsart = 'lastschrift'
            AND op.created_at >= (NOW() - INTERVAL 90 SECOND)
          LIMIT 1`,
        [mitglied_id, tarif_id]
      );
      if (recent.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Identische Aufladung wurde gerade eben schon angelegt (Doppelklick-Schutz). Bitte einen Moment warten.'
        });
      }
    }

    // Mitglied-Daten abrufen
    const mitglieder = await query(
      'SELECT * FROM mitglieder WHERE mitglied_id = ?',
      [mitglied_id]
    );

    if (mitglieder.length === 0) {
      return res.status(404).json({ success: false, error: 'Mitglied nicht gefunden' });
    }

    const mitglied = mitglieder[0];

    // Tarif-Details abrufen (dojo-gescoped: kein fremder Tarif)
    const tarife = secureDojoId
      ? await query('SELECT * FROM tarife WHERE id = ? AND dojo_id = ?', [tarif_id, secureDojoId])
      : await query('SELECT * FROM tarife WHERE id = ?', [tarif_id]);

    if (tarife.length === 0) {
      return res.status(404).json({ success: false, error: 'Tarif nicht gefunden' });
    }

    const tarif = tarife[0];

    // Gültigkeitsdatum berechnen
    const heute = new Date();
    const gueltigBis = new Date(heute);
    gueltigBis.setMonth(gueltigBis.getMonth() + (tarif.duration_months || 6));

    // 10er-Karte erstellen
    const karteResult = await query(
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
      const admins = await query(
        'SELECT mitglied_id FROM mitglieder WHERE rolle = "admin" OR rolle = "trainer"'
      );

      const notificationText = `Barzahlung erforderlich: ${mitglied.vorname} ${mitglied.nachname} möchte eine ${tarif.name} für ${(tarif.price_cents / 100).toFixed(2)} EUR bar bezahlen.`;

      for (const admin of admins) {
        await query(
          `INSERT INTO benachrichtigungen (mitglied_id, nachricht, typ, erstellt_am)
           VALUES (?, ?, 'barzahlung', NOW())`,
          [admin.mitglied_id, notificationText]
        );
      }

      zusatzInfo.benachrichtigung = 'Admin wurde über Barzahlung informiert';
    } else if (zahlungsart === 'lastschrift') {
      const beschreibung = `10er-Karte: ${tarif.name}`;

      // Ruhepause-Verrechnung: bezahlte Pausen-Beiträge anrechnen
      const verr = await computeRuhepauseVerrechnung(mitglied_id, tarif.price_cents);
      const abbuchungCents = verr.abbuchung_cents;

      // Angerechnete Beiträge markieren (gegen Doppel-Anrechnung) + Vermerk
      for (const b of verr.beitraege) {
        await query(
          `UPDATE beitraege
              SET verrechnet_zehnerkarte_id = ?,
                  beschreibung = CONCAT(COALESCE(beschreibung, ''), ' | Angerechnet auf 10er-Karte #', ?)
            WHERE beitrag_id = ?`,
          [neueKarteId, neueKarteId, b.beitrag_id]
        );
      }

      // Offenen Posten mit der tatsächlichen Abbuchungssumme (Differenz) anlegen
      const opBeschreibung = verr.anrechenbar_cents > 0
        ? `${beschreibung} (abzgl. ${(verr.anrechenbar_cents / 100).toFixed(2)} € Pausenbeiträge)`
        : beschreibung;
      const opResult = await query(
        `INSERT INTO offene_posten (
          mitglied_id, zehnerkarte_id, betrag_cents, beschreibung, faellig_am, status, zahlungsart
        ) VALUES (?, ?, ?, ?, ?, 'offen', 'lastschrift')`,
        [mitglied_id, neueKarteId, abbuchungCents, opBeschreibung, heute]
      );
      const offenerPostenId = opResult.insertId;

      // Überschuss als Guthaben gutschreiben
      if (verr.guthaben_cents > 0) {
        await query(
          `INSERT INTO mitglied_gutschriften (mitglied_id, dojo_id, betrag, restbetrag, grund)
           VALUES (?, ?, ?, ?, ?)`,
          [mitglied_id, mitglied.dojo_id, verr.guthaben_cents / 100, verr.guthaben_cents / 100,
           `Überschuss aus Ruhepause-Beitragsverrechnung mit 10er-Karte #${neueKarteId}`]
        );
        zusatzInfo.guthaben_eur = verr.guthaben_cents / 100;
      }
      if (verr.anrechenbar_cents > 0) {
        zusatzInfo.verrechnung = {
          anrechenbar_eur: verr.anrechenbar_cents / 100,
          anzahl_beitraege: verr.beitraege.length,
          abbuchung_eur: abbuchungCents / 100,
          guthaben_eur: verr.guthaben_cents / 100
        };
      }

      // SEPA-Einzug nur über die Differenz (falls > 0)
      if (abbuchungCents > 0) {
        try {
          const provider = await PaymentProviderFactory.getProvider(mitglied.dojo_id);
          if (provider && typeof provider.chargeSepaDirectDebit === 'function') {
            const result = await provider.chargeSepaDirectDebit(mitglied_id, abbuchungCents / 100, beschreibung);
            if (result && (result.status === 'succeeded' || result.status === 'processing')) {
              await query(
                `UPDATE offene_posten SET status = 'gebucht', gebucht_am = NOW(), stripe_payment_intent_id = ? WHERE id = ?`,
                [result.payment_intent_id, offenerPostenId]
              );
              zusatzInfo.lastschrift = (verr.anrechenbar_cents > 0 ? `Differenz von ${(abbuchungCents / 100).toFixed(2)} € wird ` : 'Betrag wird ')
                + 'automatisch per SEPA-Lastschrift eingezogen';
              zusatzInfo.stripe_status = result.status;
            } else {
              zusatzInfo.lastschrift = 'Karte erstellt — SEPA-Einzug konnte nicht sofort bestätigt werden, Betrag bleibt offen.';
            }
          } else {
            zusatzInfo.lastschrift = 'Karte erstellt — kein Stripe-Einzug konfiguriert, Betrag bleibt offen.';
          }
        } catch (chargeErr) {
          logger.warn('10er-Karte Auto-SEPA fehlgeschlagen', { error: chargeErr.message, mitglied_id, offenerPostenId });
          zusatzInfo.lastschrift = 'Karte erstellt — automatischer Einzug fehlgeschlagen: '
            + (chargeErr.userMessage || chargeErr.message) + ' (Betrag bleibt offen).';
          zusatzInfo.lastschrift_fehler = true;
        }
      } else {
        // Nichts abzubuchen (komplett durch Pausenbeiträge gedeckt)
        await query(`UPDATE offene_posten SET status = 'gebucht', gebucht_am = NOW() WHERE id = ?`, [offenerPostenId]);
        zusatzInfo.lastschrift = verr.anrechenbar_cents > 0
          ? 'Vollständig mit Pausenbeiträgen verrechnet — kein Einzug nötig.'
          : 'Betrag 0 € — kein Einzug nötig.';
      }
    } else if (zahlungsart === 'rechnung') {
      // Rechnung erstellen
      const rechnungsnummer = await generateRechnungsnummer();

      const rechnungResult = await query(
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
      await query(
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

      zusatzInfo.rechnung = {
        rechnungsnummer,
        rechnungId,
        hinweis: 'Rechnung wird per E-Mail versendet'
      };
    }

    // Erstellte 10er-Karte abrufen
    const neueKarte = await query(
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
    logger.error('Fehler beim Nachkauf:', { error: error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Hilfsfunktion: Rechnungsnummer generieren
 */
async function generateRechnungsnummer() {
  const heute = new Date();
  const jahr = heute.getFullYear();
  const monat = String(heute.getMonth() + 1).padStart(2, '0');
  const tag = String(heute.getDate()).padStart(2, '0');

  // Format: YYYY/MM/DD-NNNN
  const prefix = `${jahr}/${monat}/${tag}`;

  // Letzte Rechnung des Tages suchen
  const rechnungen = await query(
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
    if (!await karteInDojo(id, getSecureDojoId(req))) {
      return res.status(404).json({ success: false, error: '10er-Karte nicht gefunden' });
    }

    // Prüfen ob Buchungen vorhanden
    const buchungen = await query(
      'SELECT COUNT(*) as count FROM zehnerkarten_buchungen WHERE zehnerkarte_id = ?',
      [id]
    );

    if (buchungen[0].count > 0) {
      return res.status(400).json({
        success: false,
        error: 'Kann 10er-Karte nicht löschen, da bereits Buchungen vorhanden sind'
      });
    }

    await query('DELETE FROM zehnerkarten WHERE id = ?', [id]);

    res.json({ success: true, message: '10er-Karte erfolgreich gelöscht' });
  } catch (error) {
    logger.error('Fehler beim Löschen der 10er-Karte:', { error: error });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
