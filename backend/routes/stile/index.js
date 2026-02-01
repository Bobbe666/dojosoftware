/**
 * Stile Routes - Hauptmodul
 * Kombiniert alle Stil-bezogenen Sub-Router
 */
const express = require('express');
const router = express.Router();

// Sub-Router importieren
const stileRouter = require('./stile');
const graduierungenRouter = require('./graduierungen');
const statistikenRouter = require('./statistiken');
const pruefungsinhalteRouter = require('./pruefungsinhalte');

// Sub-Router einbinden
router.use('/', stileRouter);
router.use('/', graduierungenRouter);
router.use('/', statistikenRouter);
router.use('/', pruefungsinhalteRouter);

module.exports = router;
