// Backend/routes/dojo-banken.js - Mehrere Bankverbindungen pro Dojo
const express = require('express');
const router = express.Router();
const db = require('../db');

// Promise-Wrapper für db.query
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

// Initialisierung: Tabelle erstellen falls nicht vorhanden
const initializeDojoBankenTable = async () => {
  try {
    const tables = await queryAsync(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'dojo_banken'
    `);

    if (tables[0].count === 0) {
      await queryAsync(`
        CREATE TABLE dojo_banken (
          id INT AUTO_INCREMENT PRIMARY KEY,
          dojo_id INT NOT NULL,
          
          bank_name VARCHAR(100) NOT NULL,
          bank_typ ENUM('bank', 'stripe', 'paypal', 'sonstige') DEFAULT 'bank',
          ist_aktiv BOOLEAN DEFAULT TRUE,
          ist_standard BOOLEAN DEFAULT FALSE,
          
          iban VARCHAR(34) NULL,
          bic VARCHAR(11) NULL,
          kontoinhaber VARCHAR(200) NULL,
          sepa_glaeubiger_id VARCHAR(35) NULL,
          
          stripe_publishable_key VARCHAR(255) NULL,
          stripe_secret_key VARCHAR(255) NULL,
          stripe_account_id VARCHAR(100) NULL,
          
          paypal_email VARCHAR(255) NULL,
          paypal_client_id VARCHAR(255) NULL,
          paypal_client_secret VARCHAR(255) NULL,
          
          api_key VARCHAR(255) NULL,
          api_secret VARCHAR(255) NULL,
          merchant_id VARCHAR(100) NULL,
          
          notizen TEXT NULL,
          sortierung INT DEFAULT 0,
          
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          
          INDEX idx_dojo_id (dojo_id),
          INDEX idx_bank_typ (bank_typ),
          INDEX idx_ist_aktiv (ist_aktiv)
        )
      `);
    }
  } catch (error) {
    logger.error('Fehler bei der Initialisierung der dojo_banken Tabelle:', { error: error });
  }
};

// Beim Laden initialisieren
initializeDojoBankenTable();

// GET /api/dojo-banken/:dojoId - Alle Banken eines Dojos
// SECURITY: Secret Keys werden NICHT zurückgegeben, nur ob sie konfiguriert sind
router.get('/:dojoId', async (req, res) => {
  try {
    const { dojoId } = req.params;

    const banken = await queryAsync(`
      SELECT
        id, dojo_id, bank_name, bank_typ, ist_aktiv, ist_standard,
        iban, bic, kontoinhaber, sepa_glaeubiger_id,
        stripe_publishable_key, stripe_account_id,
        paypal_email, paypal_client_id,
        merchant_id, notizen, sortierung, created_at, updated_at,
        -- SECURITY: Nur Boolean-Flags für Secret Keys
        (stripe_secret_key IS NOT NULL AND stripe_secret_key != '') AS stripe_secret_configured,
        (paypal_client_secret IS NOT NULL AND paypal_client_secret != '') AS paypal_secret_configured,
        (api_secret IS NOT NULL AND api_secret != '') AS api_secret_configured,
        (api_key IS NOT NULL AND api_key != '') AS api_key_configured
      FROM dojo_banken
      WHERE dojo_id = ?
      ORDER BY sortierung ASC, created_at ASC
    `, [dojoId]);

    res.json(banken);
  } catch (error) {
    logger.error('Fehler beim Laden der Banken:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der Banken' });
  }
});

// GET /api/dojo-banken/:dojoId/:id - Einzelne Bank
// SECURITY: Secret Keys werden NICHT zurückgegeben
router.get('/:dojoId/:id', async (req, res) => {
  try {
    const { dojoId, id } = req.params;

    const banken = await queryAsync(`
      SELECT
        id, dojo_id, bank_name, bank_typ, ist_aktiv, ist_standard,
        iban, bic, kontoinhaber, sepa_glaeubiger_id,
        stripe_publishable_key, stripe_account_id,
        paypal_email, paypal_client_id,
        merchant_id, notizen, sortierung, created_at, updated_at,
        (stripe_secret_key IS NOT NULL AND stripe_secret_key != '') AS stripe_secret_configured,
        (paypal_client_secret IS NOT NULL AND paypal_client_secret != '') AS paypal_secret_configured,
        (api_secret IS NOT NULL AND api_secret != '') AS api_secret_configured,
        (api_key IS NOT NULL AND api_key != '') AS api_key_configured
      FROM dojo_banken
      WHERE id = ? AND dojo_id = ?
    `, [id, dojoId]);

    if (banken.length === 0) {
      return res.status(404).json({ error: 'Bank nicht gefunden' });
    }

    res.json(banken[0]);
  } catch (error) {
    logger.error('Fehler beim Laden der Bank:', { error: error });
    res.status(500).json({ error: 'Fehler beim Laden der Bank' });
  }
});

// POST /api/dojo-banken/:dojoId - Neue Bank hinzufügen
router.post('/:dojoId', async (req, res) => {
  try {
    const { dojoId } = req.params;
    const bankData = req.body;
    
    // Validierung
    if (!bankData.bank_name) {
      return res.status(400).json({ error: 'Bankname ist erforderlich' });
    }
    
    // Standard-Konto: Alle anderen auf false setzen
    if (bankData.ist_standard) {
      await queryAsync(`
        UPDATE dojo_banken 
        SET ist_standard = FALSE 
        WHERE dojo_id = ?
      `, [dojoId]);
    }
    
    // Sortierung: Höchste Zahl + 1
    const maxSort = await queryAsync(`
      SELECT COALESCE(MAX(sortierung), -1) as max_sort 
      FROM dojo_banken 
      WHERE dojo_id = ?
    `, [dojoId]);
    
    const sortierung = maxSort[0].max_sort + 1;
    
    const result = await queryAsync(`
      INSERT INTO dojo_banken (
        dojo_id, bank_name, bank_typ, ist_aktiv, ist_standard,
        iban, bic, kontoinhaber, sepa_glaeubiger_id,
        stripe_publishable_key, stripe_secret_key, stripe_account_id,
        paypal_email, paypal_client_id, paypal_client_secret,
        api_key, api_secret, merchant_id, notizen, sortierung
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      dojoId,
      bankData.bank_name,
      bankData.bank_typ || 'bank',
      bankData.ist_aktiv !== undefined ? bankData.ist_aktiv : true,
      bankData.ist_standard || false,
      bankData.iban || null,
      bankData.bic || null,
      bankData.kontoinhaber || null,
      bankData.sepa_glaeubiger_id || null,
      bankData.stripe_publishable_key || null,
      bankData.stripe_secret_key || null,
      bankData.stripe_account_id || null,
      bankData.paypal_email || null,
      bankData.paypal_client_id || null,
      bankData.paypal_client_secret || null,
      bankData.api_key || null,
      bankData.api_secret || null,
      bankData.merchant_id || null,
      bankData.notizen || null,
      sortierung
    ]);
    
    const newBank = await queryAsync(`
      SELECT * FROM dojo_banken WHERE id = ?
    `, [result.insertId]);
    
    res.status(201).json(newBank[0]);
  } catch (error) {
    logger.error('Fehler beim Anlegen der Bank:', { error: error });
    res.status(500).json({ error: 'Fehler beim Anlegen der Bank' });
  }
});

// PUT /api/dojo-banken/:dojoId/:id - Bank aktualisieren
router.put('/:dojoId/:id', async (req, res) => {
  try {
    const { dojoId, id } = req.params;
    const bankData = req.body;
    
    // Prüfen ob Bank existiert
    const existing = await queryAsync(`
      SELECT * FROM dojo_banken WHERE id = ? AND dojo_id = ?
    `, [id, dojoId]);
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Bank nicht gefunden' });
    }
    
    // Standard-Konto: Alle anderen auf false setzen
    if (bankData.ist_standard) {
      await queryAsync(`
        UPDATE dojo_banken 
        SET ist_standard = FALSE 
        WHERE dojo_id = ? AND id != ?
      `, [dojoId, id]);
    }
    
    await queryAsync(`
      UPDATE dojo_banken SET
        bank_name = ?,
        bank_typ = ?,
        ist_aktiv = ?,
        ist_standard = ?,
        iban = ?,
        bic = ?,
        kontoinhaber = ?,
        sepa_glaeubiger_id = ?,
        stripe_publishable_key = ?,
        stripe_secret_key = ?,
        stripe_account_id = ?,
        paypal_email = ?,
        paypal_client_id = ?,
        paypal_client_secret = ?,
        api_key = ?,
        api_secret = ?,
        merchant_id = ?,
        notizen = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND dojo_id = ?
    `, [
      bankData.bank_name,
      bankData.bank_typ || 'bank',
      bankData.ist_aktiv !== undefined ? bankData.ist_aktiv : true,
      bankData.ist_standard || false,
      bankData.iban || null,
      bankData.bic || null,
      bankData.kontoinhaber || null,
      bankData.sepa_glaeubiger_id || null,
      bankData.stripe_publishable_key || null,
      bankData.stripe_secret_key || null,
      bankData.stripe_account_id || null,
      bankData.paypal_email || null,
      bankData.paypal_client_id || null,
      bankData.paypal_client_secret || null,
      bankData.api_key || null,
      bankData.api_secret || null,
      bankData.merchant_id || null,
      bankData.notizen || null,
      id,
      dojoId
    ]);
    
    const updated = await queryAsync(`
      SELECT * FROM dojo_banken WHERE id = ?
    `, [id]);
    
    res.json(updated[0]);
  } catch (error) {
    logger.error('Fehler beim Aktualisieren der Bank:', { error: error });
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Bank' });
  }
});

// DELETE /api/dojo-banken/:dojoId/:id - Bank löschen
router.delete('/:dojoId/:id', async (req, res) => {
  try {
    const { dojoId, id } = req.params;
    
    // Prüfen ob Bank existiert
    const existing = await queryAsync(`
      SELECT * FROM dojo_banken WHERE id = ? AND dojo_id = ?
    `, [id, dojoId]);
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Bank nicht gefunden' });
    }
    
    await queryAsync(`
      DELETE FROM dojo_banken WHERE id = ? AND dojo_id = ?
    `, [id, dojoId]);
    
    res.json({ message: 'Bank erfolgreich gelöscht' });
  } catch (error) {
    logger.error('Fehler beim Löschen der Bank:', { error: error });
    res.status(500).json({ error: 'Fehler beim Löschen der Bank' });
  }
});

// POST /api/dojo-banken/:dojoId/reorder - Reihenfolge ändern
router.post('/:dojoId/reorder', async (req, res) => {
  try {
    const { dojoId } = req.params;
    const { order } = req.body; // Array von IDs in neuer Reihenfolge
    
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'order muss ein Array sein' });
    }
    
    // Update sortierung für jede Bank
    for (let i = 0; i < order.length; i++) {
      await queryAsync(`
        UPDATE dojo_banken 
        SET sortierung = ? 
        WHERE id = ? AND dojo_id = ?
      `, [i, order[i], dojoId]);
    }
    
    res.json({ message: 'Reihenfolge aktualisiert' });
  } catch (error) {
    logger.error('Fehler beim Ändern der Reihenfolge:', { error: error });
    res.status(500).json({ error: 'Fehler beim Ändern der Reihenfolge' });
  }
});

// POST /api/dojo-banken/:dojoId/init-defaults - Standard-Tabs anlegen (Stripe, PayPal)
router.post('/:dojoId/init-defaults', async (req, res) => {
  try {
    const { dojoId } = req.params;
    
    // Prüfen ob bereits Banken existieren
    const existing = await queryAsync(`
      SELECT COUNT(*) as count FROM dojo_banken WHERE dojo_id = ?
    `, [dojoId]);
    
    if (existing[0].count > 0) {
      return res.json({ message: 'Banken bereits vorhanden', created: false });
    }
    
    // Standard-Tabs anlegen
    const defaults = [
      {
        bank_name: 'Stripe',
        bank_typ: 'stripe',
        ist_aktiv: false,
        sortierung: 0
      },
      {
        bank_name: 'PayPal',
        bank_typ: 'paypal',
        ist_aktiv: false,
        sortierung: 1
      }
    ];
    
    for (const bank of defaults) {
      await queryAsync(`
        INSERT INTO dojo_banken (
          dojo_id, bank_name, bank_typ, ist_aktiv, sortierung
        ) VALUES (?, ?, ?, ?, ?)
      `, [dojoId, bank.bank_name, bank.bank_typ, bank.ist_aktiv, bank.sortierung]);
    }
    
    res.json({ message: 'Standard-Tabs angelegt', created: true });
  } catch (error) {
    logger.error('Fehler beim Anlegen der Standard-Tabs:', { error: error });
    res.status(500).json({ error: 'Fehler beim Anlegen der Standard-Tabs' });
  }
});

// POST /api/dojo-banken/migrate - Migriere Bankdaten von dojo Tabelle zu dojo_banken
router.post('/migrate', async (req, res) => {
  try {
    logger.debug('🔄 Starte Migration der Bankdaten...');
    
    // Prüfe und migriere Bankdaten für jedes Dojo
    const insertResult = await queryAsync(`
      INSERT INTO dojo_banken (
        dojo_id,
        bank_name,
        bank_typ,
        ist_aktiv,
        ist_standard,
        iban,
        bic,
        kontoinhaber,
        sepa_glaeubiger_id,
        sortierung,
        created_at,
        updated_at
      )
      SELECT 
        d.id AS dojo_id,
        COALESCE(d.bank, d.dojoname, 'Hauptkonto') AS bank_name,
        'bank' AS bank_typ,
        1 AS ist_aktiv,
        1 AS ist_standard,
        COALESCE(d.bank_iban, d.iban) AS iban,
        COALESCE(d.bank_bic, d.bic) AS bic,
        COALESCE(d.bank_inhaber, d.inhaber, d.dojoname) AS kontoinhaber,
        d.sepa_glaeubiger_id,
        0 AS sortierung,
        NOW() AS created_at,
        NOW() AS updated_at
      FROM dojo d
      WHERE 
        (COALESCE(d.bank_iban, d.iban) IS NOT NULL 
         AND COALESCE(d.bank_iban, d.iban) != '')
        AND (COALESCE(d.bank_bic, d.bic) IS NOT NULL 
             AND COALESCE(d.bank_bic, d.bic) != '')
        AND NOT EXISTS (
          SELECT 1 
          FROM dojo_banken db 
          WHERE db.dojo_id = d.id 
          AND db.bank_typ = 'bank'
          AND db.ist_aktiv = 1
        )
    `);
    
    logger.info('Insert-Ergebnis:', { details: insertResult });
    
    // Aktualisiere bestehende Einträge
    const updateResult = await queryAsync(`
      UPDATE dojo_banken db
      INNER JOIN dojo d ON db.dojo_id = d.id
      SET 
        db.iban = COALESCE(NULLIF(db.iban, ''), COALESCE(d.bank_iban, d.iban)),
        db.bic = COALESCE(NULLIF(db.bic, ''), COALESCE(d.bank_bic, d.bic)),
        db.kontoinhaber = COALESCE(NULLIF(db.kontoinhaber, ''), COALESCE(d.bank_inhaber, d.inhaber, d.dojoname)),
        db.sepa_glaeubiger_id = COALESCE(NULLIF(db.sepa_glaeubiger_id, ''), d.sepa_glaeubiger_id),
        db.updated_at = NOW()
      WHERE 
        db.bank_typ = 'bank'
        AND db.ist_aktiv = 1
        AND (
          db.iban IS NULL OR db.iban = '' OR
          db.bic IS NULL OR db.bic = '' OR
          db.kontoinhaber IS NULL OR db.kontoinhaber = ''
        )
        AND (
          (COALESCE(d.bank_iban, d.iban) IS NOT NULL AND COALESCE(d.bank_iban, d.iban) != '') OR
          (COALESCE(d.bank_bic, d.bic) IS NOT NULL AND COALESCE(d.bank_bic, d.bic) != '')
        )
    `);
    
    logger.info('Update-Ergebnis:', { details: updateResult });
    
    // Prüfe, welche Dojos Bankdaten haben
    const dojosMitBankdaten = await queryAsync(`
      SELECT 
        d.id,
        d.dojoname,
        COALESCE(d.bank_iban, d.iban) AS iban,
        COALESCE(d.bank_bic, d.bic) AS bic,
        COALESCE(d.bank_inhaber, d.inhaber, d.dojoname) AS kontoinhaber,
        (SELECT COUNT(*) FROM dojo_banken db WHERE db.dojo_id = d.id AND db.bank_typ = 'bank' AND db.ist_aktiv = 1) AS anzahl_banken
      FROM dojo d
      WHERE 
        (COALESCE(d.bank_iban, d.iban) IS NOT NULL 
         AND COALESCE(d.bank_iban, d.iban) != '')
        AND (COALESCE(d.bank_bic, d.bic) IS NOT NULL 
             AND COALESCE(d.bank_bic, d.bic) != '')
    `);
    
    res.json({
      success: true,
      message: 'Migration abgeschlossen',
      inserted: insertResult.affectedRows || 0,
      updated: updateResult.affectedRows || 0,
      dojosMitBankdaten: dojosMitBankdaten
    });
  } catch (error) {
    logger.error('Fehler bei der Migration:', error);
    res.status(500).json({ 
      success: false,
      error: 'Fehler bei der Migration',
      details: error.message 
    });
  }
});

module.exports = router;

