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
    console.error('Fehler bei der Initialisierung der dojo_banken Tabelle:', error);
  }
};

// Beim Laden initialisieren
initializeDojoBankenTable();

// GET /api/dojo-banken/:dojoId - Alle Banken eines Dojos
router.get('/:dojoId', async (req, res) => {
  try {
    const { dojoId } = req.params;
    
    const banken = await queryAsync(`
      SELECT * FROM dojo_banken 
      WHERE dojo_id = ? 
      ORDER BY sortierung ASC, created_at ASC
    `, [dojoId]);
    
    res.json(banken);
  } catch (error) {
    console.error('Fehler beim Laden der Banken:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Banken' });
  }
});

// GET /api/dojo-banken/:dojoId/:id - Einzelne Bank
router.get('/:dojoId/:id', async (req, res) => {
  try {
    const { dojoId, id } = req.params;
    
    const banken = await queryAsync(`
      SELECT * FROM dojo_banken 
      WHERE id = ? AND dojo_id = ?
    `, [id, dojoId]);
    
    if (banken.length === 0) {
      return res.status(404).json({ error: 'Bank nicht gefunden' });
    }
    
    res.json(banken[0]);
  } catch (error) {
    console.error('Fehler beim Laden der Bank:', error);
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
    console.error('Fehler beim Anlegen der Bank:', error);
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
    console.error('Fehler beim Aktualisieren der Bank:', error);
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
    console.error('Fehler beim Löschen der Bank:', error);
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
    console.error('Fehler beim Ändern der Reihenfolge:', error);
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
    console.error('Fehler beim Anlegen der Standard-Tabs:', error);
    res.status(500).json({ error: 'Fehler beim Anlegen der Standard-Tabs' });
  }
});

module.exports = router;

