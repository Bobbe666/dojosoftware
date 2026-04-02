/**
 * Mitglieder Routes - Haupt-Router
 * Kombiniert alle Sub-Router für Mitglieder-Management
 */
const express = require('express');
const router = express.Router();

// Sub-Router importieren
const filterRouter = require('./filter');
const sepaRouter = require('./sepa');
const stileRouter = require('./stile');
const crudRouter = require('./crud');
const medicalRouter = require('./medical');
const archivRouter = require('./archiv');

// Sub-Router einbinden
// WICHTIG: Reihenfolge beachten!
// 1. Statische Pfade zuerst (/archiv, /filter-options, /compliance/missing, etc.)
// 2. Parametrisierte Routen danach (/:id)
router.use('/', filterRouter);      // /filter-options/*, /filter/*
router.use('/', sepaRouter);        // /:id/sepa-mandate
router.use('/', stileRouter);       // /:id/stile, /:id/graduierung
router.use('/', archivRouter);      // /archiv, /archiv/:archivId, /:id/archivieren (MUSS VOR crud!)
router.use('/', medicalRouter);     // /compliance/missing, /pruefung/kandidaten, /:id/medizinisch
router.use('/', crudRouter);        // /, /all, /:id (MUSS ZULETZT!)

module.exports = router;
