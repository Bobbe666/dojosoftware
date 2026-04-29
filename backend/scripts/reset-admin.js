// Einmalig: Super-Admin Passwort zurücksetzen
// Wird nach Ausführung automatisch gelöscht
require('dotenv').config({ path: __dirname + '/../.env' });
const db = require('../db');
const { hashPassword } = require('../services/passwordService');

const TEMP_PW = 'TDA-Admin-2026!';
const EMAIL   = 'info@tda-intl.com';

hashPassword(TEMP_PW).then(hash => {
  db.query(
    `UPDATE admin_users
     SET password = ?,
         password_algorithm = 'argon2id',
         failed_login_attempts = 0,
         locked_until = NULL
     WHERE email = ?
       AND rolle NOT IN ('eingeschraenkt', 'trainer', 'checkin')`,
    [hash, EMAIL],
    (err, result) => {
      if (err) {
        console.error('FEHLER beim Passwort-Reset:', err.message);
      } else {
        console.log('');
        console.log('✓ Admin-Passwort erfolgreich zurückgesetzt!');
        console.log('  E-Mail:      ' + EMAIL);
        console.log('  Temp-PW:     ' + TEMP_PW);
        console.log('  Zeilen:      ' + result.affectedRows);
        console.log('  -> Bitte nach dem Login sofort das Passwort ändern!');
        console.log('');
      }
      process.exit(0);
    }
  );
}).catch(err => {
  console.error('Hash-Fehler:', err.message);
  process.exit(1);
});
