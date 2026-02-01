/**
 * Admin Shared Utilities
 * Middleware und Helper-Funktionen für Admin-Routes
 */
const logger = require('../../utils/logger');
const db = require('../../db');
const fs = require('fs').promises;
const path = require('path');

// Super-Admin Access Check Middleware
const requireSuperAdmin = (req, res, next) => {
  const { user } = req;

  if (!user) {
    return res.status(401).json({ error: 'Nicht authentifiziert' });
  }

  const isSuperAdmin = user.rolle === 'super_admin' || user.role === 'super_admin';
  const isAdminWithNullDojo = (user.rolle === 'admin' || user.role === 'admin') && user.dojo_id === null;
  const isTDAAdmin = user.dojo_id === 2 && (user.rolle === 'admin' || user.role === 'admin');

  if (isSuperAdmin || isAdminWithNullDojo || isTDAAdmin) {
    logger.info('Super-Admin Zugriff gewährt:', { details: {
      username: user.username,
      role: user.role || user.rolle,
      dojo_id: user.dojo_id
    } });
    next();
  } else {
    logger.debug('❌ Super-Admin Zugriff verweigert:', {
      username: user.username,
      role: user.role || user.rolle,
      dojo_id: user.dojo_id
    });
    return res.status(403).json({
      error: 'Zugriff verweigert',
      message: 'Nur für TDA International Administratoren'
    });
  }
};

// Berechne Speicherplatz für ein Dojo (in MB)
async function calculateDojoStorageUsage(dojoId) {
  try {
    const [documents] = await db.promise().query(
      'SELECT dateipfad FROM mitglied_dokumente WHERE dojo_id = ?',
      [dojoId]
    );

    let totalSizeBytes = 0;

    for (const doc of documents) {
      try {
        const fullPath = path.join(__dirname, '../..', doc.dateipfad);
        const stats = await fs.stat(fullPath);
        totalSizeBytes += stats.size;
      } catch (err) {
        continue;
      }
    }

    const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);
    return parseFloat(totalSizeMB);
  } catch (error) {
    logger.error('Fehler beim Berechnen des Speicherplatzes:', error);
    return 0;
  }
}

module.exports = {
  requireSuperAdmin,
  calculateDojoStorageUsage
};
