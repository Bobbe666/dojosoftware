const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const logger = require('../utils/logger');

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/logos');

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    // logoType kommt aus URL-Parameter statt Body (weil multer body erst nach file-processing hat)
    const logoType = req.params.logoType || 'unknown';
    cb(null, `dojo-${req.params.id}-${logoType}-${uniqueSuffix}${ext}`);
  }
});

// File Filter - Only allow images
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Ungültiges Dateiformat: ${file.mimetype}. Erlaubt: PNG, JPG, SVG, WebP`), false);
  }
};

// Multer Configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2 MB
  }
});

// =============================================================================
// GET /api/dojos/:id/logos - Get all logos for a dojo
// =============================================================================
router.get('/:id/logos', (req, res) => {
  const dojoId = req.params.id;

  const query = `
    SELECT
      logo_id,
      dojo_id,
      logo_type,
      file_name,
      file_path,
      file_size,
      mime_type,
      uploaded_at,
      uploaded_by
    FROM dojo_logos
    WHERE dojo_id = ?
    ORDER BY
      FIELD(logo_type, 'haupt', 'alternativ', 'partner1', 'partner2', 'social')
  `;

  db.query(query, [dojoId], (error, results) => {
    if (error) {
      logger.error('Fehler beim Laden der Logos', {
        dojo_id: dojoId,
        error: error.message
      });
      return res.status(500).json({ error: 'Fehler beim Laden der Logos' });
    }

    // Add URL to each logo
    const logos = results.map(logo => ({
      ...logo,
      url: `/uploads/logos/${path.basename(logo.file_path)}`
    }));

    res.json(logos);
  });
});

// =============================================================================
// POST /api/dojos/:id/logos/:logoType - Upload a logo
// =============================================================================
router.post('/:id/logos/:logoType', upload.single('logo'), (req, res) => {
  const dojoId = req.params.id;
  const logoType = req.params.logoType; // Aus URL-Parameter statt Body
  const uploadedBy = req.body.uploadedBy || null;

  if (!req.file) {
    return res.status(400).json({ error: 'Keine Datei hochgeladen' });
  }

  if (!logoType) {
    return res.status(400).json({ error: 'Logo-Typ fehlt' });
  }

  const validTypes = ['haupt', 'alternativ', 'partner1', 'partner2', 'social'];
  if (!validTypes.includes(logoType)) {
    return res.status(400).json({ error: `Ungültiger Logo-Typ: ${logoType}` });
  }

  // Check if logo already exists for this type
  const checkQuery = 'SELECT logo_id, file_path FROM dojo_logos WHERE dojo_id = ? AND logo_type = ?';

  db.query(checkQuery, [dojoId, logoType], (checkError, checkResults) => {
    if (checkError) {
      logger.error('Fehler beim Prüfen bestehender Logos', {
        dojo_id: dojoId,
        logo_type: logoType,
        error: checkError.message
      });
      // Delete uploaded file on error
      fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: 'Fehler beim Prüfen bestehender Logos' });
    }

    // If logo exists, delete old file and update
    if (checkResults.length > 0) {
      const oldFilePath = checkResults[0].file_path;
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }

      const updateQuery = `
        UPDATE dojo_logos
        SET file_name = ?,
            file_path = ?,
            file_size = ?,
            mime_type = ?,
            uploaded_at = CURRENT_TIMESTAMP,
            uploaded_by = ?
        WHERE dojo_id = ? AND logo_type = ?
      `;

      const values = [
        req.file.originalname,
        req.file.path,
        req.file.size,
        req.file.mimetype,
        uploadedBy,
        dojoId,
        logoType
      ];

      db.query(updateQuery, values, (updateError, updateResult) => {
        if (updateError) {
          logger.error('Fehler beim Aktualisieren des Logos', {
            dojo_id: dojoId,
            logo_type: logoType,
            error: updateError.message
          });
          fs.unlinkSync(req.file.path);
          return res.status(500).json({ error: 'Fehler beim Aktualisieren des Logos' });
        }

        logger.success('Logo aktualisiert', {
          dojo_id: dojoId,
          logo_type: logoType,
          file_name: req.file.originalname,
          file_size: req.file.size
        });

        res.json({
          message: 'Logo erfolgreich aktualisiert',
          logo: {
            logo_id: checkResults[0].logo_id,
            dojo_id: dojoId,
            logo_type: logoType,
            file_name: req.file.originalname,
            file_size: req.file.size,
            mime_type: req.file.mimetype,
            url: `/uploads/logos/${req.file.filename}`
          }
        });
      });
    } else {
      // Insert new logo
      const insertQuery = `
        INSERT INTO dojo_logos
        (dojo_id, logo_type, file_name, file_path, file_size, mime_type, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        dojoId,
        logoType,
        req.file.originalname,
        req.file.path,
        req.file.size,
        req.file.mimetype,
        uploadedBy
      ];

      db.query(insertQuery, values, (insertError, insertResult) => {
        if (insertError) {
          logger.error('Fehler beim Hochladen des Logos', {
            dojo_id: dojoId,
            logo_type: logoType,
            error: insertError.message
          });
          fs.unlinkSync(req.file.path);
          return res.status(500).json({ error: 'Fehler beim Hochladen des Logos' });
        }

        logger.success('Logo hochgeladen', {
          dojo_id: dojoId,
          logo_type: logoType,
          file_name: req.file.originalname,
          file_size: req.file.size
        });

        res.json({
          message: 'Logo erfolgreich hochgeladen',
          logo: {
            logo_id: insertResult.insertId,
            dojo_id: dojoId,
            logo_type: logoType,
            file_name: req.file.originalname,
            file_size: req.file.size,
            mime_type: req.file.mimetype,
            url: `/uploads/logos/${req.file.filename}`
          }
        });
      });
    }
  });
});

// =============================================================================
// DELETE /api/dojos/:id/logos/:logoId - Delete a logo
// =============================================================================
router.delete('/:id/logos/:logoId', (req, res) => {
  const dojoId = req.params.id;
  const logoId = req.params.logoId;

  // Get file path before deleting
  const selectQuery = 'SELECT file_path FROM dojo_logos WHERE logo_id = ? AND dojo_id = ?';

  db.query(selectQuery, [logoId, dojoId], (selectError, selectResults) => {
    if (selectError) {
      logger.error('Fehler beim Abrufen des Logos', {
        logo_id: logoId,
        dojo_id: dojoId,
        error: selectError.message
      });
      return res.status(500).json({ error: 'Fehler beim Abrufen des Logos' });
    }

    if (selectResults.length === 0) {
      return res.status(404).json({ error: 'Logo nicht gefunden' });
    }

    const filePath = selectResults[0].file_path;

    // Delete from database
    const deleteQuery = 'DELETE FROM dojo_logos WHERE logo_id = ? AND dojo_id = ?';

    db.query(deleteQuery, [logoId, dojoId], (deleteError, deleteResult) => {
      if (deleteError) {
        logger.error('Fehler beim Löschen des Logos', {
          logo_id: logoId,
          dojo_id: dojoId,
          error: deleteError.message
        });
        return res.status(500).json({ error: 'Fehler beim Löschen des Logos' });
      }

      // Delete file from filesystem
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      logger.success('Logo gelöscht', {
        logo_id: logoId,
        dojo_id: dojoId
      });

      res.json({ message: 'Logo erfolgreich gelöscht' });
    });
  });
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Datei zu groß. Maximum: 2 MB' });
    }
    return res.status(400).json({ error: `Upload-Fehler: ${error.message}` });
  }

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  next();
});

module.exports = router;
