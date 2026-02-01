/**
 * Rechnungen Routes - Hauptmodul
 * Kombiniert alle Sub-Router mit Auth-Middleware und Feature Protection
 */
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const { requireFeature } = require('../../middleware/featureAccess');

// Feature Protection: Buchführung & Rechnungswesen
// Alle Rechnungs-Routes erfordern das 'buchfuehrung' Feature (ab Premium Plan)
router.use(authenticateToken);
router.use(requireFeature('buchfuehrung'));

// Sub-Router importieren
const crudRouter = require('./crud');
const zahlungenRouter = require('./zahlungen');
const pdfRouter = require('./pdf');
const automationRouter = require('./automation');

// Automation-Routes (MUSS VOR CRUD wegen /generate-monthly, /auto-create)
router.use('/', automationRouter);

// CRUD-Router (enthält /, /naechste-nummer, /statistiken, /:id)
router.use('/', crudRouter);

// Zahlungen-Router (/:id/zahlung)
router.use('/', zahlungenRouter);

// PDF-Router (/:id/vorschau, /:id/pdf)
router.use('/', pdfRouter);

module.exports = router;
