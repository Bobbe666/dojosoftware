const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db'); // Verwenden Sie Ihr bestehendes DB-System
const router = express.Router();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'DojoSoftware2024SecretKeyChangeThis!';

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
      SELECT id, username, email, password, rolle as role, dojo_id, vorname, nachname, berechtigungen, aktiv, erstellt_am
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

        // 🔒 TENANT ISOLATION: Prüfe ob User zur Subdomain gehört
        const subdomain = req.headers['x-tenant-subdomain'];
        if (subdomain && subdomain !== '') {
          // Subdomain-Login → User muss zu diesem Dojo gehören
          if (!user.dojo_id) {
            // User hat keine dojo_id (super_admin) → darf überall einloggen (OK)
          } else {
            // User hat dojo_id → muss zur Subdomain passen
            const [dojos] = await db.promise().query(
              'SELECT id FROM dojo WHERE subdomain = ? LIMIT 1',
              [subdomain]
            );

            if (dojos.length === 0) {
              return res.status(403).json({
                login: false,
                message: 'Ungültige Subdomain'
              });
            }

            if (user.dojo_id !== dojos[0].id) {
              return res.status(403).json({
                login: false,
                message: 'Sie haben keine Berechtigung, sich bei diesem Dojo anzumelden'
              });
            }
          }
        }

        // Create JWT token
        const tokenPayload = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          rolle: user.role, // Für Kompatibilität
          dojo_id: user.dojo_id || null,
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
          dojo_id: user.dojo_id || null,
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
// USER MANAGEMENT (Production)
// ===================================================================

// Get all users (for admin panel)
router.get('/users', (req, res) => {
  const query = 'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC';

  db.query(query, (err, results) => {
    if (err) {
      console.error('💥 Error fetching users:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Return array directly for frontend compatibility
    res.json(results);
  });
});

// Update user (username, email, role)
router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, email, role } = req.body;

  // Validation
  if (!username || !email || !role) {
    return res.status(400).json({ error: 'Username, Email und Rolle sind erforderlich' });
  }

  if (!['admin', 'supervisor', 'trainer', 'verkauf', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Ungültige Rolle' });
  }

  try {
    const updateQuery = 'UPDATE users SET username = ?, email = ?, role = ? WHERE id = ?';
    db.query(updateQuery, [username, email, role, id], (err, result) => {
      if (err) {
        console.error('💥 Error updating user:', err);
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: 'Benutzername oder E-Mail bereits vergeben' });
        }
        return res.status(500).json({ error: 'Fehler beim Aktualisieren' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }

      res.json({ success: true, message: 'Benutzer erfolgreich aktualisiert' });
    });
  } catch (error) {
    console.error('💥 Error updating user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset user password
router.put('/users/:id/password', async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updateQuery = 'UPDATE users SET password = ? WHERE id = ?';

    db.query(updateQuery, [hashedPassword, id], (err, result) => {
      if (err) {
        console.error('💥 Error resetting password:', err);
        return res.status(500).json({ error: 'Fehler beim Zurücksetzen des Passworts' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }

      res.json({ success: true, message: 'Passwort erfolgreich zurückgesetzt' });
    });
  } catch (error) {
    console.error('💥 Error resetting password:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete user
router.delete('/users/:id', (req, res) => {
  const { id } = req.params;

  // Prevent deleting user with ID 1 (super admin)
  if (id === '1') {
    return res.status(403).json({ error: 'Super-Admin kann nicht gelöscht werden' });
  }

  const deleteQuery = 'DELETE FROM users WHERE id = ?';

  db.query(deleteQuery, [id], (err, result) => {
    if (err) {
      console.error('💥 Error deleting user:', err);
      return res.status(500).json({ error: 'Fehler beim Löschen' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    res.json({ success: true, message: 'Benutzer erfolgreich gelöscht' });
  });
});

// ===================================================================
// TOKEN-BASED AUTHENTICATION (for TDA Integration)
// ===================================================================

/**
 * POST /api/auth/token-login
 * Authenticate using Dojo API Token
 * Used by TDA Tournament Software for secure integration
 */
router.post('/token-login', async (req, res) => {
  const { api_token } = req.body;

  if (!api_token) {
    return res.status(400).json({
      success: false,
      login: false,
      message: "API-Token ist erforderlich"
    });
  }

  try {
    // Query to find dojo by API token
    const dojoQuery = `
      SELECT
        id,
        dojoname,
        email,
        api_token,
        api_token_created_at,
        ist_aktiv
      FROM dojo
      WHERE api_token = ?
      AND ist_aktiv = TRUE
      LIMIT 1
    `;

    db.query(dojoQuery, [api_token], async (err, results) => {
      if (err) {
        console.error('💥 Database error during token authentication:', err);
        return res.status(500).json({
          success: false,
          login: false,
          message: "Server-Fehler bei der Token-Validierung",
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }

      if (results.length === 0) {
        return res.status(401).json({
          success: false,
          login: false,
          message: "Ungültiger API-Token oder Dojo nicht aktiv"
        });
      }

      const dojo = results[0];

      // Update last_used timestamp
      const updateQuery = `
        UPDATE dojo
        SET api_token_last_used = NOW()
        WHERE id = ?
      `;

      db.query(updateQuery, [dojo.id], (updateErr) => {
        if (updateErr) {
          console.error('Warning: Failed to update token last_used:', updateErr);
        }
      });

      // Create JWT token for session
      const jwtToken = jwt.sign(
        {
          id: dojo.id,
          dojoname: dojo.dojoname,
          email: dojo.email,
          role: 'dojo',
          auth_type: 'api_token'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        success: true,
        login: true,
        message: "Token-Authentifizierung erfolgreich",
        token: jwtToken,
        dojo: {
          id: dojo.id,
          dojoname: dojo.dojoname,
          email: dojo.email,
          role: 'dojo'
        }
      });
    });

  } catch (error) {
    console.error('💥 Error in token-login:', error);
    res.status(500).json({
      success: false,
      login: false,
      message: "Server-Fehler beim Token-Login",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

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
      'POST /api/auth/token-login',
      'GET /api/auth/me',
      'POST /api/auth/logout',
      'GET /api/auth/users (dev only)',
      'GET /api/auth/db-test (dev only)'
    ]
  });
});

module.exports = router;