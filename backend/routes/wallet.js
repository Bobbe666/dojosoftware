const express = require('express');
const router = express.Router();
const db = require('../db');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const archiver = require('archiver');
const { JWT_SECRET } = require('../middleware/auth');

/**
 * Wallet Pass Generator für Apple Wallet und Google Wallet
 *
 * HINWEIS: Für Apple Wallet wird ein Apple Developer Zertifikat benötigt.
 * Für Google Wallet wird ein Google Cloud Account mit Wallet API benötigt.
 *
 * Diese Implementierung erstellt die Grundstruktur und kann später
 * mit echten Zertifikaten erweitert werden.
 */

// Helper: Mitglied-Daten laden
async function getMitgliedData(mitgliedId) {
  const [rows] = await db.promise().query(`
    SELECT
      m.mitglied_id,
      m.vorname,
      m.nachname,
      m.foto_pfad,
      m.status,
      m.eintrittsdatum,
      m.dojo_id,
      d.dojoname,
      GROUP_CONCAT(DISTINCT CONCAT(g.name, ' ', g.farbe) SEPARATOR ', ') as graduierungen
    FROM mitglieder m
    LEFT JOIN dojos d ON m.dojo_id = d.id
    LEFT JOIN mitglieder_graduierungen mg ON m.mitglied_id = mg.mitglied_id
    LEFT JOIN graduierungen g ON mg.graduierung_id = g.graduierung_id
    WHERE m.mitglied_id = ?
    GROUP BY m.mitglied_id
  `, [mitgliedId]);

  return rows[0];
}

// ==========================================
// APPLE WALLET (.pkpass)
// ==========================================

/**
 * Generiert einen Apple Wallet Pass
 *
 * Ein .pkpass ist ein ZIP-Archiv mit:
 * - pass.json (Pass-Daten)
 * - icon.png, icon@2x.png (Icons)
 * - logo.png, logo@2x.png (Logo)
 * - manifest.json (SHA1 Hashes aller Dateien)
 * - signature (PKCS7 Signatur - benötigt Apple Zertifikat)
 */
router.get('/apple/:mitglied_id', async (req, res) => {
  try {
    const { mitglied_id } = req.params;
    const mitglied = await getMitgliedData(mitglied_id);

    if (!mitglied) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    // Pass-Daten erstellen
    const passData = {
      formatVersion: 1,
      passTypeIdentifier: 'pass.de.kampfkunstschule-schreiner.mitglied',
      serialNumber: `DOJO-${mitglied.dojo_id}-${mitglied.mitglied_id}`,
      teamIdentifier: 'TEAM_ID', // Muss mit Apple Developer Account ersetzt werden
      organizationName: mitglied.dojoname || 'Kampfkunstschule Schreiner',
      description: 'Mitgliedsausweis',
      logoText: mitglied.dojoname || 'Kampfkunstschule Schreiner',
      foregroundColor: 'rgb(255, 255, 255)',
      backgroundColor: 'rgb(26, 26, 46)',
      labelColor: 'rgb(255, 215, 0)',

      // Barcode / QR-Code
      barcode: {
        format: 'PKBarcodeFormatQR',
        message: `DOJO-CHECKIN:${mitglied.dojo_id}:${mitglied.mitglied_id}`,
        messageEncoding: 'iso-8859-1'
      },

      // Generic Pass Style
      generic: {
        primaryFields: [
          {
            key: 'name',
            label: 'MITGLIED',
            value: `${mitglied.vorname} ${mitglied.nachname}`
          }
        ],
        secondaryFields: [
          {
            key: 'mitgliedsnummer',
            label: 'NR.',
            value: String(mitglied.mitglied_id).padStart(5, '0')
          },
          {
            key: 'graduierung',
            label: 'GRADUIERUNG',
            value: mitglied.graduierungen || '-'
          }
        ],
        auxiliaryFields: [
          {
            key: 'seit',
            label: 'MITGLIED SEIT',
            value: mitglied.eintrittsdatum
              ? new Date(mitglied.eintrittsdatum).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' })
              : '-'
          },
          {
            key: 'status',
            label: 'STATUS',
            value: mitglied.status === 'aktiv' ? 'Aktiv' : 'Inaktiv'
          }
        ],
        backFields: [
          {
            key: 'dojo',
            label: 'DOJO',
            value: mitglied.dojoname || 'Kampfkunstschule Schreiner'
          },
          {
            key: 'motto',
            label: 'MOTTO',
            value: '心技体 — Shin Gi Tai (Geist, Technik, Körper)'
          }
        ]
      }
    };

    // HINWEIS: Ohne Apple Developer Zertifikat kann der Pass nicht signiert werden.
    // Für eine vollständige Implementierung benötigt man:
    // 1. Apple Developer Account ($99/Jahr)
    // 2. Pass Type ID Certificate
    // 3. WWDR Intermediate Certificate
    //
    // Alternative: Dienste wie PassKit.com oder PassSlot.com nutzen

    // Temporär: JSON-Daten zurückgeben für Debugging
    // In Produktion würde hier ein signiertes .pkpass erstellt

    // Prüfen ob Zertifikate vorhanden sind
    const certPath = path.join(__dirname, '../certs/pass.p12');
    const wwdrPath = path.join(__dirname, '../certs/wwdr.pem');

    if (!fs.existsSync(certPath) || !fs.existsSync(wwdrPath)) {
      return res.status(501).json({
        error: 'Apple Wallet noch nicht konfiguriert',
        message: 'Apple Developer Zertifikate werden benötigt. Bitte kontaktiere den Administrator.',
        passData: passData // Für Debugging
      });
    }

    // Hier würde der signierte Pass erstellt werden
    // Für jetzt: Nicht implementiert
    res.status(501).json({
      error: 'Apple Wallet Signierung noch nicht implementiert',
      passData: passData
    });

  } catch (error) {
    console.error('Apple Wallet Error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Wallet-Passes' });
  }
});


// ==========================================
// GOOGLE WALLET
// ==========================================

/**
 * Generiert einen Google Wallet Pass Link
 *
 * Google Wallet verwendet JWT-basierte Passes.
 * Benötigt Google Cloud Console Setup mit Wallet API.
 */
router.get('/google/:mitglied_id', async (req, res) => {
  try {
    const { mitglied_id } = req.params;
    const mitglied = await getMitgliedData(mitglied_id);

    if (!mitglied) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    // Google Wallet Object Daten
    const walletObject = {
      id: `DOJO_${mitglied.dojo_id}_MEMBER_${mitglied.mitglied_id}`,
      classId: 'kampfkunstschule-schreiner.mitgliedsausweis',
      state: 'ACTIVE',

      heroImage: {
        sourceUri: {
          uri: 'https://dojo.tda-intl.org/logo.png'
        }
      },

      textModulesData: [
        {
          header: 'Mitglied',
          body: `${mitglied.vorname} ${mitglied.nachname}`
        },
        {
          header: 'Mitglieds-Nr.',
          body: String(mitglied.mitglied_id).padStart(5, '0')
        },
        {
          header: 'Graduierung',
          body: mitglied.graduierungen || '-'
        }
      ],

      barcode: {
        type: 'QR_CODE',
        value: `DOJO-CHECKIN:${mitglied.dojo_id}:${mitglied.mitglied_id}`,
        alternateText: `Mitglied ${mitglied.mitglied_id}`
      },

      // Hexfarben für Google Wallet
      hexBackgroundColor: '#1a1a2e'
    };

    // Prüfen ob Google Credentials vorhanden sind
    const googleCredsPath = path.join(__dirname, '../certs/google-wallet-credentials.json');

    if (!fs.existsSync(googleCredsPath)) {
      return res.status(501).json({
        error: 'Google Wallet noch nicht konfiguriert',
        message: 'Google Cloud Wallet API muss eingerichtet werden. Bitte kontaktiere den Administrator.',
        walletObject: walletObject // Für Debugging
      });
    }

    // Hier würde der JWT erstellt und der Save-Link generiert werden
    // Für jetzt: Nicht implementiert
    res.status(501).json({
      error: 'Google Wallet noch nicht implementiert',
      walletObject: walletObject
    });

  } catch (error) {
    console.error('Google Wallet Error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Wallet-Passes' });
  }
});


// ==========================================
// UNIVERSAL LINK / QR-CODE FÜR MOBILE
// ==========================================

/**
 * Generiert eine mobile-freundliche Ausweis-Seite
 * Die kann zum Home-Bildschirm hinzugefügt werden
 */
router.get('/mobile/:mitglied_id', async (req, res) => {
  try {
    const { mitglied_id } = req.params;
    const mitglied = await getMitgliedData(mitglied_id);

    if (!mitglied) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    // Token für sichere Mobile-Ansicht generieren
    const token = crypto
      .createHash('sha256')
      .update(`${mitglied_id}-${JWT_SECRET}`)
      .digest('hex')
      .substring(0, 16);

    res.json({
      success: true,
      mobileUrl: `https://dojo.tda-intl.org/ausweis/${mitglied_id}/${token}`,
      mitglied: {
        id: mitglied.mitglied_id,
        name: `${mitglied.vorname} ${mitglied.nachname}`,
        nummer: String(mitglied.mitglied_id).padStart(5, '0'),
        graduierung: mitglied.graduierungen || '-',
        dojo: mitglied.dojoname,
        status: mitglied.status,
        qrCode: `DOJO-CHECKIN:${mitglied.dojo_id}:${mitglied.mitglied_id}`
      }
    });

  } catch (error) {
    console.error('Mobile Ausweis Error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des mobilen Ausweises' });
  }
});

module.exports = router;
