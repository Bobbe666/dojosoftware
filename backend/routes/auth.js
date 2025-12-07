const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db'); // Verwenden Sie Ihr bestehendes DB-System
const router = express.Router();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// ===================================================================
// 🧪 TEST-ROUTEN
// ===================================================================

// Health Check für Auth
router.get('/health', (req, res) => {

  res.json({
    status: 'OK',
    service: 'Auth Service',
    timestamp: new Date().toISOString(),
    database: 'connected via existing db.js',
    routes: {
      'POST /api/auth/login': 'Login with username or email',
      'GET /api/auth/health': 'Health check',
      'GET /api/auth/test': 'Test route'
    }
  });
});

// Test-Route
router.get('/test', (req, res) => {

  res.json({
    message: 'Auth route is working!',
    timestamp: new Date().toISOString(),
    dbSystem: 'Using existing db.js connection'
  });
});

// ===================================================================
// LOGIN-ROUTE
// ===================================================================

router.post('/login', async (req, res) => {

  const { email, password, username } = req.body;
  const loginField = email || username;
  
  if (!loginField || !password) {

    return res.status(400).json({ 
      login: false, 
      message: "Email/Username und Passwort sind erforderlich",
      received: { loginField: !!loginField, password: !!password }
    });
  }

  try {
    // Zuerst in users Tabelle suchen (Mitglieder)
    const userQuery = `
      SELECT id, username, email, password, role, mitglied_id, created_at
      FROM users
      WHERE email = ? OR username = ?
      LIMIT 1
    `;

    // Dann in admin_users Tabelle suchen (Admins/Trainer)
    const adminQuery = `
      SELECT id, username, email, password, rolle as role, vorname, nachname, berechtigungen, aktiv, created_at
      FROM admin_users
      WHERE email = ? OR username = ?
      LIMIT 1
    `;

    // Verwenden Sie Ihr bestehendes DB-System
    db.query(userQuery, [loginField, loginField], async (err, results) => {
      if (err) {
        console.error('💥 Database error:', err);
        return res.status(500).json({
          login: false,
          message: "Server-Fehler bei der Datenbankabfrage",
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }

      // Wenn nicht in users gefunden, in admin_users suchen
      if (results.length === 0) {
        db.query(adminQuery, [loginField, loginField], async (adminErr, adminResults) => {
          if (adminErr) {
            console.error('💥 Admin database error:', adminErr);
            return res.status(500).json({
              login: false,
              message: "Server-Fehler bei der Datenbankabfrage",
              error: process.env.NODE_ENV === 'development' ? adminErr.message : undefined
            });
          }

          if (adminResults.length === 0) {
            return res.status(401).json({
              login: false,
              message: "Benutzer nicht gefunden"
            });
          }

          // Admin/Trainer gefunden - verarbeite Login
          await processLogin(adminResults[0], password, res, true);
        });
        return;
      }

      // User gefunden - verarbeite Login
      await processLogin(results[0], password, res, false);
    });

    // Hilfsfunktion für Login-Verarbeitung
    async function processLogin(user, password, res, isAdmin) {

      try {
        // Password verification

        const match = await bcrypt.compare(password, user.password);

        if (!match) {

          return res.status(401).json({ 
            login: false, 
            message: "Ungültiges Passwort" 
          });
        }

        // Create JWT token
        const tokenPayload = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          rolle: user.role, // Für Kompatibilität
          mitglied_id: user.mitglied_id || null,
          vorname: user.vorname || null,
          nachname: user.nachname || null,
          berechtigungen: isAdmin ? (typeof user.berechtigungen === 'string' ? JSON.parse(user.berechtigungen) : user.berechtigungen) : null,
          iat: Math.floor(Date.now() / 1000)
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "8h" });

        // Prepare response
        const userResponse = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          rolle: user.role, // Für Kompatibilität
          mitglied_id: user.mitglied_id || null,
          vorname: user.vorname || null,
          nachname: user.nachname || null,
          berechtigungen: isAdmin ? (typeof user.berechtigungen === 'string' ? JSON.parse(user.berechtigungen) : user.berechtigungen) : null,
          loginTime: new Date().toISOString()
        };

        // Send response
        res.status(200).json({
          login: true,
          token,
          user: userResponse,
          message: `Willkommen zurück, ${user.username}!`
        });

      } catch (bcryptError) {
        console.error('💥 Bcrypt error:', bcryptError);
        return res.status(500).json({
          login: false,
          message: "Fehler bei der Passwort-Überprüfung"
        });
      }
    }
    
  } catch (error) {
    console.error('💥 Login error:', error);
    res.status(500).json({ 
      login: false, 
      message: "Server-Fehler beim Login",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ===================================================================
// 🛡️ JWT-MIDDLEWARE
// ===================================================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: "Kein Token vorhanden" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {

      return res.status(403).json({ message: "Token ungültig oder abgelaufen" });
    }
    
    req.user = decoded;
    next();
  });
};

// ===================================================================
// ZUSÄTZLICHE AUTH-ROUTEN
// ===================================================================

// Token validieren
router.get('/me', authenticateToken, (req, res) => {

  res.json({
    tokenValid: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
      tokenIssued: new Date(req.user.iat * 1000).toISOString()
    },
    serverTime: new Date().toISOString()
  });
});

// Logout
router.post('/logout', authenticateToken, (req, res) => {

  res.json({ 
    message: "Erfolgreich abgemeldet",
    user: req.user.username,
    timestamp: new Date().toISOString()
  });
});

// ===================================================================
// 🔒 PASSWORT ÄNDERN (eingeloggt)
// ===================================================================
router.post('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Aktuelles und neues Passwort sind erforderlich' });
  }
  // Policy: mind. 8 Zeichen, 1 Zahl, 1 Sonderzeichen
  const hasDigit = /\d/.test(newPassword);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_+\-=/\\\[\];'`~]/.test(newPassword);
  if (!(newPassword.length >= 8 && hasDigit && hasSpecial)) {
    return res.status(400).json({ message: 'Passwort zu schwach (8+, Zahl, Sonderzeichen)' });
  }

  try {
    const getQuery = 'SELECT id, password FROM users WHERE id = ? LIMIT 1';
    db.query(getQuery, [req.user.id], async (err, results) => {
      if (err) return res.status(500).json({ message: 'DB-Fehler', error: err.message });
      if (!results.length) return res.status(404).json({ message: 'User nicht gefunden' });

      const user = results[0];
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) return res.status(401).json({ message: 'Aktuelles Passwort falsch' });

      const hash = await bcrypt.hash(newPassword, 10);
      const upd = 'UPDATE users SET password = ? WHERE id = ?';
      db.query(upd, [hash, req.user.id], (uErr) => {
        if (uErr) return res.status(500).json({ message: 'Update fehlgeschlagen', error: uErr.message });
        res.json({ success: true, message: 'Passwort aktualisiert' });
      });
    });
  } catch (e) {
    res.status(500).json({ message: 'Serverfehler', error: e.message });
  }
});

// ===================================================================
// 🛡️ SICHERHEITSFRAGE SPEICHERN (eingeloggt)
// ===================================================================
router.post('/security', authenticateToken, async (req, res) => {
  const { securityQuestion, securityAnswer } = req.body;
  if (!securityQuestion || !securityAnswer) {
    return res.status(400).json({ message: 'Frage und Antwort sind erforderlich' });
  }
  try {
    const answerHash = await bcrypt.hash(securityAnswer.trim().toLowerCase(), 10);
    const upd = 'UPDATE users SET security_question = ?, security_answer_hash = ? WHERE id = ?';
    db.query(upd, [securityQuestion, answerHash, req.user.id], (err) => {
      if (err) return res.status(500).json({ message: 'Update fehlgeschlagen', error: err.message });
      res.json({ success: true, message: 'Sicherheitsfrage gespeichert' });
    });
  } catch (e) {
    res.status(500).json({ message: 'Serverfehler', error: e.message });
  }
});

// ===================================================================
// PASSWORT ZURÜCKSETZEN (öffentlich, mit Sicherheitsfrage)
// ===================================================================
router.post('/reset-password', async (req, res) => {
  const { loginField, securityQuestion, securityAnswer, newPassword } = req.body;
  if (!loginField || !securityQuestion || !securityAnswer || !newPassword) {
    return res.status(400).json({ message: 'Alle Felder sind erforderlich' });
  }
  const hasDigit = /\d/.test(newPassword);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_+\-=/\\\[\];'`~]/.test(newPassword);
  if (!(newPassword.length >= 8 && hasDigit && hasSpecial)) {
    return res.status(400).json({ message: 'Passwort zu schwach (8+, Zahl, Sonderzeichen)' });
  }

  const q = 'SELECT id, security_question, security_answer_hash FROM users WHERE email = ? OR username = ? LIMIT 1';
  db.query(q, [loginField, loginField], async (err, results) => {
    if (err) return res.status(500).json({ message: 'DB-Fehler', error: err.message });
    if (!results.length) return res.status(404).json({ message: 'Benutzer nicht gefunden' });
    const user = results[0];

    if (!user.security_question || !user.security_answer_hash) {
      return res.status(400).json({ message: 'Keine Sicherheitsfrage hinterlegt' });
    }
    if (user.security_question !== securityQuestion) {
      return res.status(401).json({ message: 'Sicherheitsfrage stimmt nicht' });
    }
    const answerMatch = await bcrypt.compare(securityAnswer.trim().toLowerCase(), user.security_answer_hash);
    if (!answerMatch) return res.status(401).json({ message: 'Sicherheitsantwort falsch' });

    const hash = await bcrypt.hash(newPassword, 10);
    const upd = 'UPDATE users SET password = ? WHERE id = ?';
    db.query(upd, [hash, user.id], (uErr) => {
      if (uErr) return res.status(500).json({ message: 'Update fehlgeschlagen', error: uErr.message });
      res.json({ success: true, message: 'Passwort wurde zurückgesetzt' });
    });
  });
});
// ===================================================================
// DEBUG-ROUTEN (nur in Development)
// ===================================================================

if (process.env.NODE_ENV === 'development') {
  // Alle User anzeigen
  router.get('/users', (req, res) => {

    const query = 'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC';
    
    db.query(query, (err, results) => {
      if (err) {
        console.error('💥 Error fetching users:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({
        users: results,
        count: results.length,
        timestamp: new Date().toISOString()
      });
    });
  });

  // Passwort-Hash testen
  router.post('/test-password', async (req, res) => {
    const { password, hash } = req.body;
    
    if (!password || !hash) {
      return res.status(400).json({ error: 'Password and hash required' });
    }
    
    try {
      const match = await bcrypt.compare(password, hash);
      res.json({
        password,
        hash,
        match,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Database connection test
  router.get('/db-test', (req, res) => {

    db.query('SELECT COUNT(*) as user_count FROM users', (err, results) => {
      if (err) {
        console.error('💥 Database test failed:', err);
        return res.status(500).json({ 
          error: 'Database connection failed',
          details: err.message 
        });
      }

      res.json({
        message: 'Database connection working',
        userCount: results[0].user_count,
        timestamp: new Date().toISOString()
      });
    });
  });
}

// ===================================================================
// ERROR HANDLING
// ===================================================================

// Catch-all für unbekannte Auth-Routen
router.use('*', (req, res) => {

  res.status(404).json({
    error: 'Auth route not found',
    method: req.method,
    url: req.originalUrl,
    availableRoutes: [
      'GET /api/auth/health',
      'GET /api/auth/test', 
      'POST /api/auth/login',
      'GET /api/auth/me',
      'POST /api/auth/logout',
      'GET /api/auth/users (dev only)',
      'GET /api/auth/db-test (dev only)'
    ]
  });
});

module.exports = router;