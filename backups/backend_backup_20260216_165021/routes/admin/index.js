/**
 * Admin Routes - Haupt-Router
 * Kombiniert alle Sub-Router für Super-Admin Management
 */
const express = require('express');
const router = express.Router();

// Sub-Router importieren
const dojosRouter = require('./dojos');
const statsRouter = require('./stats');
const subscriptionsRouter = require('./subscriptions');
const financeRouter = require('./finance');
const contractsRouter = require('./contracts');
const usersRouter = require('./users');
const sepaRouter = require('./sepa');
const saasSettingsRouter = require('./saas-settings');
const comparisonRouter = require('./comparison');

// Sub-Router einbinden
// Reihenfolge: spezifischere Routen zuerst
router.use('/saas-settings', saasSettingsRouter); // /saas-settings
router.use('/comparison', comparisonRouter);      // /comparison
router.use('/', dojosRouter);           // /dojos, /dojos/:id
router.use('/', statsRouter);           // /global-stats, /tda-stats, /statistics
router.use('/', subscriptionsRouter);   // /dojos/:id/extend-trial, /subscription-plans
router.use('/', financeRouter);         // /finance
router.use('/', contractsRouter);       // /contracts
router.use('/', usersRouter);           // /users
router.use('/', sepaRouter);            // /sepa/*

module.exports = router;
