/**
 * Vertraege Routes - Hauptmodul
 * Kombiniert alle Vertrags-bezogenen Sub-Router
 */
const express = require('express');
const router = express.Router();

// Sub-Router importieren
const crudRouter = require('./crud');
const pdfRouter = require('./pdf');
const dokumenteRouter = require('./dokumente');
const historieRouter = require('./historie');

// Sub-Router einbinden - Reihenfolge wichtig!
// CRUD Router zuerst (enthält /, /stats und /:id Routen)
router.use('/', crudRouter);

// Dokumente-Routen (MUSS VOR PDF-Router kommen wegen /dokumente/:dojo_id)
router.use('/', dokumenteRouter);

// PDF-Routen (/:id/pdf, /:id/kuendigungsbestaetigung)
router.use('/', pdfRouter);

// Historie-Routen (/:id/historie)
router.use('/', historieRouter);

module.exports = router;
