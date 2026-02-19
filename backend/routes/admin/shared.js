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

// Berechne Speicherplatz für ein Dojo (in KB)
// Basiert auf Datensatz-Anzahl in verschiedenen Tabellen
// Gibt detaillierte Aufschlüsselung zurück
async function calculateDojoStorageUsage(dojoId) {
  try {
    const details = {};
    let totalSizeKB = 0;

    // Geschätzte Größen pro Datensatz (in KB)
    const SIZES = {
      mitglieder: 2.5,      // Viele Felder, Adressen, Notizen etc.
      kurse: 1.0,           // Kursdetails
      trainer: 1.5,         // Trainerdaten
      beitraege: 0.5,       // Zahlungsdaten
      vertraege: 1.5,       // Vertragsdetails
      checkins: 0.2,        // Einfache Datensätze
      verkaeufe: 0.8,       // Verkaufsdaten
      events: 1.5,          // Eventdetails
      pruefungen: 1.0,      // Prüfungsdaten
      artikel: 0.8,         // Artikeldaten
      dokumente: 50.0       // Dokumente sind größer (geschätzt)
    };

    // 1. Mitglieder
    const [members] = await db.promise().query(
      'SELECT COUNT(*) as cnt FROM mitglieder WHERE dojo_id = ?', [dojoId]
    );
    details.mitglieder = { count: members[0]?.cnt || 0, size_kb: (members[0]?.cnt || 0) * SIZES.mitglieder };
    totalSizeKB += details.mitglieder.size_kb;

    // 2. Kurse
    const [courses] = await db.promise().query(
      'SELECT COUNT(*) as cnt FROM kurse WHERE dojo_id = ?', [dojoId]
    );
    details.kurse = { count: courses[0]?.cnt || 0, size_kb: (courses[0]?.cnt || 0) * SIZES.kurse };
    totalSizeKB += details.kurse.size_kb;

    // 3. Trainer
    const [trainers] = await db.promise().query(
      'SELECT COUNT(*) as cnt FROM trainer WHERE dojo_id = ?', [dojoId]
    );
    details.trainer = { count: trainers[0]?.cnt || 0, size_kb: (trainers[0]?.cnt || 0) * SIZES.trainer };
    totalSizeKB += details.trainer.size_kb;

    // 4. Beiträge
    try {
      const [contributions] = await db.promise().query(
        'SELECT COUNT(*) as cnt FROM beitraege WHERE dojo_id = ?', [dojoId]
      );
      details.beitraege = { count: contributions[0]?.cnt || 0, size_kb: (contributions[0]?.cnt || 0) * SIZES.beitraege };
      totalSizeKB += details.beitraege.size_kb;
    } catch (e) { details.beitraege = { count: 0, size_kb: 0 }; }

    // 5. Verträge
    try {
      const [contracts] = await db.promise().query(
        `SELECT COUNT(*) as cnt FROM mitglied_vertraege mv
         JOIN mitglieder m ON mv.mitglied_id = m.mitglied_id
         WHERE m.dojo_id = ?`, [dojoId]
      );
      details.vertraege = { count: contracts[0]?.cnt || 0, size_kb: (contracts[0]?.cnt || 0) * SIZES.vertraege };
      totalSizeKB += details.vertraege.size_kb;
    } catch (e) { details.vertraege = { count: 0, size_kb: 0 }; }

    // 6. Verkäufe
    try {
      const [sales] = await db.promise().query(
        'SELECT COUNT(*) as cnt FROM verkaeufe WHERE dojo_id = ?', [dojoId]
      );
      details.verkaeufe = { count: sales[0]?.cnt || 0, size_kb: (sales[0]?.cnt || 0) * SIZES.verkaeufe };
      totalSizeKB += details.verkaeufe.size_kb;
    } catch (e) { details.verkaeufe = { count: 0, size_kb: 0 }; }

    // 7. Events
    try {
      const [events] = await db.promise().query(
        'SELECT COUNT(*) as cnt FROM events WHERE dojo_id = ?', [dojoId]
      );
      details.events = { count: events[0]?.cnt || 0, size_kb: (events[0]?.cnt || 0) * SIZES.events };
      totalSizeKB += details.events.size_kb;
    } catch (e) { details.events = { count: 0, size_kb: 0 }; }

    // 8. Prüfungen (über Mitglieder)
    try {
      const [exams] = await db.promise().query(
        `SELECT COUNT(*) as cnt FROM mitglied_pruefungen mp
         JOIN mitglieder m ON mp.mitglied_id = m.mitglied_id
         WHERE m.dojo_id = ?`, [dojoId]
      );
      details.pruefungen = { count: exams[0]?.cnt || 0, size_kb: (exams[0]?.cnt || 0) * SIZES.pruefungen };
      totalSizeKB += details.pruefungen.size_kb;
    } catch (e) { details.pruefungen = { count: 0, size_kb: 0 }; }

    // 9. Artikel
    try {
      const [articles] = await db.promise().query(
        'SELECT COUNT(*) as cnt FROM artikel WHERE dojo_id = ?', [dojoId]
      );
      details.artikel = { count: articles[0]?.cnt || 0, size_kb: (articles[0]?.cnt || 0) * SIZES.artikel };
      totalSizeKB += details.artikel.size_kb;
    } catch (e) { details.artikel = { count: 0, size_kb: 0 }; }

    // 10. Dokumente
    try {
      const [docs] = await db.promise().query(
        'SELECT COUNT(*) as cnt FROM mitglied_dokumente WHERE dojo_id = ?', [dojoId]
      );
      details.dokumente = { count: docs[0]?.cnt || 0, size_kb: (docs[0]?.cnt || 0) * SIZES.dokumente };
      totalSizeKB += details.dokumente.size_kb;
    } catch (e) { details.dokumente = { count: 0, size_kb: 0 }; }

    // Rückgabe: MB für Kompatibilität, aber auch Details
    const totalSizeMB = totalSizeKB / 1024;

    logger.debug(`[STORAGE] Dojo ${dojoId}: ${totalSizeKB} KB (${totalSizeMB.toFixed(2)} MB)`, JSON.stringify(details));

    return {
      total_mb: parseFloat(totalSizeMB.toFixed(2)),
      total_kb: Math.round(totalSizeKB),
      details
    };
  } catch (error) {
    logger.error('Fehler beim Berechnen des Speicherplatzes:', error);
    return { total_mb: 0, total_kb: 0, details: {} };
  }
}

module.exports = {
  requireSuperAdmin,
  calculateDojoStorageUsage
};
