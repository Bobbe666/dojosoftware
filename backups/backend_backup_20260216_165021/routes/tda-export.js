const express = require('express');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const db = require('../db');
const router = express.Router();

// JWT Secret aus zentraler auth.js (hat Startup-Check)
const { JWT_SECRET } = require('../middleware/auth');

// ===================================================================
// MIDDLEWARE: JWT Authentication
// ===================================================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
};

// ===================================================================
// AUTHENTICATION - Login for TDA Software
// ===================================================================

/**
 * POST /api/tda-export/auth/login
 * Login endpoint for TDA Software to authenticate
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password required'
      });
    }

    // Find user in users table
    const [users] = await db.promise().query(
      'SELECT * FROM users WHERE benutzername = ? LIMIT 1',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = users[0];

    // Verify password (assuming bcrypt)
    const bcrypt = require('bcryptjs');
    const isValidPassword = await bcrypt.compare(password, user.passwort);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        user_id: user.user_id,
        username: user.benutzername,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token: token,
      user: {
        user_id: user.user_id,
        username: user.benutzername,
        email: user.email
      }
    });

  } catch (error) {
    logger.error('TDA Export Auth Error:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Server error during authentication'
    });
  }
});

// ===================================================================
// DOJOS - Get all dojos for authenticated user
// ===================================================================

/**
 * GET /api/tda-export/dojos
 * Get all dojos associated with the authenticated user
 */
router.get('/dojos', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Get all dojos this user has access to
    // Assuming users table has a dojo_id column or there's a relation
    const [dojos] = await db.promise().query(`
      SELECT
        d.dojo_id,
        d.dojo_name as name,
        d.ansprechpartner,
        d.email,
        d.telefon,
        d.strasse,
        d.hausnummer,
        d.plz,
        d.ort,
        d.land,
        d.homepage,
        COUNT(DISTINCT m.mitglied_id) as mitglieder_count
      FROM dojo d
      LEFT JOIN mitglieder m ON d.dojo_id = m.dojo_id AND m.aktiv = 1
      WHERE d.user_id = ? OR ? IN (SELECT user_id FROM users WHERE rolle = 'Admin')
      GROUP BY d.dojo_id
    `, [userId, userId]);

    res.json({
      success: true,
      dojos: dojos
    });

  } catch (error) {
    logger.error('TDA Export Dojos Error:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Error fetching dojos'
    });
  }
});

// ===================================================================
// DOJO DETAILS - Get specific dojo details
// ===================================================================

/**
 * GET /api/tda-export/dojos/:dojo_id
 * Get details of a specific dojo
 */
router.get('/dojos/:dojo_id', authenticateToken, async (req, res) => {
  try {
    const { dojo_id } = req.params;
    const userId = req.user.user_id;

    // Verify access to this dojo
    const [dojos] = await db.promise().query(`
      SELECT
        d.dojo_id,
        d.dojo_name as name,
        d.ansprechpartner,
        d.email,
        d.telefon,
        d.strasse,
        d.hausnummer,
        d.plz,
        d.ort,
        d.land,
        d.homepage,
        d.logo_url
      FROM dojo d
      WHERE d.dojo_id = ? AND (d.user_id = ? OR ? IN (SELECT user_id FROM users WHERE rolle = 'Admin'))
    `, [dojo_id, userId, userId]);

    if (dojos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Dojo not found or access denied'
      });
    }

    res.json({
      success: true,
      dojo: dojos[0]
    });

  } catch (error) {
    logger.error('TDA Export Dojo Details Error:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Error fetching dojo details'
    });
  }
});

// ===================================================================
// WETTKAEMPFER - Get all wettkaempfer from specific dojo
// ===================================================================

/**
 * GET /api/tda-export/dojos/:dojo_id/wettkaempfer
 * Get all active members (wettkaempfer) from a specific dojo
 */
router.get('/dojos/:dojo_id/wettkaempfer', authenticateToken, async (req, res) => {
  try {
    const { dojo_id } = req.params;
    const userId = req.user.user_id;

    // Verify access to this dojo
    const [dojoCheck] = await db.promise().query(
      'SELECT dojo_id FROM dojo WHERE dojo_id = ? AND (user_id = ? OR ? IN (SELECT user_id FROM users WHERE rolle = ?))',
      [dojo_id, userId, userId, 'Admin']
    );

    if (dojoCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this dojo'
      });
    }

    // Get all active members
    const [wettkaempfer] = await db.promise().query(`
      SELECT
        m.mitglied_id as id,
        m.vorname,
        m.nachname,
        m.geburtsdatum,
        m.geschlecht,
        m.gewicht,
        m.groesse,
        m.gurtfarbe,
        m.email,
        m.telefon_mobil as handy,
        s.name as kampfstil,
        m.dojo_id
      FROM mitglieder m
      LEFT JOIN stile s ON m.stil_id = s.stil_id
      WHERE m.dojo_id = ? AND m.aktiv = 1
      ORDER BY m.nachname, m.vorname
    `, [dojo_id]);

    // Map geschlecht to TDA format
    const mappedWettkaempfer = wettkaempfer.map(wk => ({
      ...wk,
      geschlecht: wk.geschlecht === 'm' ? 'männlich' :
                  wk.geschlecht === 'w' ? 'weiblich' : 'divers'
    }));

    res.json({
      success: true,
      count: mappedWettkaempfer.length,
      wettkaempfer: mappedWettkaempfer
    });

  } catch (error) {
    logger.error('TDA Export Wettkaempfer Error:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Error fetching wettkaempfer'
    });
  }
});

// ===================================================================
// BULK EXPORT - Export multiple dojos at once
// ===================================================================

/**
 * POST /api/tda-export/bulk-export
 * Export data from multiple dojos at once
 */
router.post('/bulk-export', authenticateToken, async (req, res) => {
  try {
    const { dojo_ids } = req.body;
    const userId = req.user.user_id;

    if (!dojo_ids || !Array.isArray(dojo_ids) || dojo_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'dojo_ids array required'
      });
    }

    // Get all requested dojos (auth already verified via token)
    const placeholders = dojo_ids.map(() => '?').join(',');
    const [dojos] = await db.promise().query(`
      SELECT
        d.id as dojo_id,
        d.dojoname as name,
        d.inhaber as ansprechpartner,
        d.email,
        d.telefon,
        d.strasse,
        d.hausnummer,
        d.plz,
        d.ort,
        d.land,
        d.internet as homepage
      FROM dojo d
      WHERE d.id IN (${placeholders}) AND d.ist_aktiv = 1
    `, dojo_ids);

    if (dojos.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'No accessible dojos found with provided IDs'
      });
    }

    // Get all wettkaempfer from these dojos
    const [wettkaempfer] = await db.promise().query(`
      SELECT
        m.mitglied_id as id,
        m.vorname,
        m.nachname,
        m.geburtsdatum,
        m.geschlecht,
        m.gewicht,
        m.groesse,
        m.gurtfarbe,
        m.email,
        m.telefon_mobil as handy,
        s.name as kampfstil,
        m.dojo_id
      FROM mitglieder m
      LEFT JOIN stile s ON m.stil_id = s.stil_id
      WHERE m.dojo_id IN (${placeholders}) AND m.aktiv = 1
      ORDER BY m.dojo_id, m.nachname, m.vorname
    `, dojo_ids);

    // Map geschlecht
    const mappedWettkaempfer = wettkaempfer.map(wk => ({
      ...wk,
      geschlecht: wk.geschlecht === 'm' ? 'männlich' :
                  wk.geschlecht === 'w' ? 'weiblich' : 'divers'
    }));

    res.json({
      success: true,
      dojos: dojos,
      wettkaempfer_count: mappedWettkaempfer.length,
      wettkaempfer: mappedWettkaempfer
    });

  } catch (error) {
    logger.error('TDA Export Bulk Error:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Error during bulk export'
    });
  }
});

// ===================================================================
// HEALTH CHECK
// ===================================================================

router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'TDA Export API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      'POST /api/tda-export/auth/login': 'Authenticate for export',
      'GET /api/tda-export/dojos': 'Get all accessible dojos',
      'GET /api/tda-export/dojos/:id': 'Get specific dojo details',
      'GET /api/tda-export/dojos/:id/wettkaempfer': 'Get wettkaempfer from dojo',
      'POST /api/tda-export/bulk-export': 'Bulk export from multiple dojos'
    }
  });
});

module.exports = router;
