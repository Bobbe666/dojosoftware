/**
 * Verbandsmitgliedschaften Routes - Hauptmodul
 * Kombiniert alle Sub-Router mit Auth-Middleware
 */
const express = require('express');
const logger = require('../../utils/logger');
const { authenticateToken } = require('../../middleware/auth');
const router = express.Router();

// Debug-Logging
router.use((req, res, next) => {
  logger.debug('Verbandsmitgliedschaften Route:', req.method, req.path);
  next();
});

// Sub-Router importieren
const publicRouter = require('./public');
const einstellungenRouter = require('./einstellungen');
const crudRouter = require('./crud');

// Public routes ZUERST (keine Authentifizierung)
router.use('/', publicRouter);

// Auth-Middleware für alle nicht-öffentlichen Routes
router.use((req, res, next) => {
  if (req.path.startsWith('/public')) return next();
  authenticateToken(req, res, next);
});

// Einstellungen-Router (MUSS VOR CRUD wegen /einstellungen Pfad)
router.use('/', einstellungenRouter);

// CRUD-Router (enthält /:id Routen)
router.use('/', crudRouter);

module.exports = router;
