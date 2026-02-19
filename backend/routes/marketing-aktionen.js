// =============================================================================
// MARKETING-AKTIONEN API ROUTES
// =============================================================================
// Backend-API für Social Media Integration (Facebook/Instagram)
// =============================================================================

const express = require('express');
const router = express.Router();
const metaApiService = require('../services/metaApiService');
const logger = require('../utils/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getSecureDojoId } = require('../middleware/tenantSecurity');

// =============================================================================
// MULTER CONFIGURATION für Media Uploads
// =============================================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/marketing');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `marketing-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Ungültiges Dateiformat'), false);
    }
  }
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getDojoId = (req) => {
  // Nutze sichere Methode aus tenantSecurity, fallback auf alte Methode
  return getSecureDojoId(req) || req.user?.dojo_id || req.body?.dojo_id || req.query?.dojo_id;
};

// =============================================================================
// OAUTH ROUTES
// =============================================================================

/**
 * @route GET /api/marketing-aktionen/accounts/connect
 * @desc Startet den OAuth Flow für Facebook/Instagram
 */
router.get('/accounts/connect', async (req, res) => {
  try {
    const dojoId = getDojoId(req);
    const userId = req.user?.user_id;

    if (!dojoId) {
      return res.status(400).json({ error: 'Dojo ID erforderlich' });
    }

    if (!metaApiService.isConfigured()) {
      return res.status(500).json({
        error: 'Meta API nicht konfiguriert',
        message: 'Bitte META_APP_ID, META_APP_SECRET und META_REDIRECT_URI in .env setzen'
      });
    }

    // State Token generieren und speichern
    const state = metaApiService.generateStateToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 Minuten

    await req.db.query(
      `INSERT INTO marketing_oauth_states (state, dojo_id, user_id, platform, expires_at)
       VALUES (?, ?, ?, 'meta', ?)`,
      [state, dojoId, userId, expiresAt]
    );

    const authUrl = metaApiService.generateAuthUrl(state);

    res.json({ authUrl });
  } catch (error) {
    logger.error('Fehler beim Starten des OAuth Flows', { error: error.message });
    res.status(500).json({ error: 'OAuth Flow konnte nicht gestartet werden' });
  }
});

/**
 * @route GET /api/marketing-aktionen/accounts/callback
 * @desc OAuth Callback von Meta
 */
router.get('/accounts/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError, error_description } = req.query;

    if (oauthError) {
      logger.error('OAuth Fehler von Meta', { error: oauthError, description: error_description });
      return res.redirect(`${process.env.FRONTEND_URL}/admin/buddy?error=oauth_denied`);
    }

    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL}/admin/buddy?error=invalid_callback`);
    }

    // State validieren
    const [stateRows] = await req.db.query(
      `SELECT * FROM marketing_oauth_states
       WHERE state = ? AND expires_at > NOW()`,
      [state]
    );

    if (stateRows.length === 0) {
      return res.redirect(`${process.env.FRONTEND_URL}/admin/buddy?error=invalid_state`);
    }

    const { dojo_id, user_id } = stateRows[0];

    // State löschen (einmalig verwendbar)
    await req.db.query('DELETE FROM marketing_oauth_states WHERE state = ?', [state]);

    // Token austauschen
    const tokenResponse = await metaApiService.exchangeCodeForToken(code);
    const shortLivedToken = tokenResponse.access_token;

    // Long-Lived Token holen
    const longLivedResponse = await metaApiService.exchangeForLongLivedToken(shortLivedToken);
    const accessToken = longLivedResponse.access_token;
    const expiresIn = longLivedResponse.expires_in || 5184000; // 60 Tage default
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // User Info abrufen
    const userInfo = await metaApiService.getUserInfo(accessToken);

    // Pages abrufen
    const pages = await metaApiService.getPages(accessToken);

    // Für jede Page Account speichern
    for (const page of pages) {
      // Facebook Page speichern
      await req.db.query(
        `INSERT INTO marketing_social_accounts
         (dojo_id, platform, account_id, account_name, access_token, token_expires_at, page_id, page_name)
         VALUES (?, 'facebook', ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           access_token = VALUES(access_token),
           token_expires_at = VALUES(token_expires_at),
           account_name = VALUES(account_name),
           page_name = VALUES(page_name),
           is_active = true,
           updated_at = NOW()`,
        [dojo_id, page.id, userInfo.name, page.access_token, tokenExpiresAt, page.id, page.name]
      );

      // Instagram Account prüfen und speichern
      if (page.instagram_business_account) {
        const igAccount = await metaApiService.getInstagramAccount(page.id, page.access_token);
        if (igAccount) {
          await req.db.query(
            `INSERT INTO marketing_social_accounts
             (dojo_id, platform, account_id, account_name, access_token, token_expires_at, page_id, page_name, instagram_business_account_id)
             VALUES (?, 'instagram', ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               access_token = VALUES(access_token),
               token_expires_at = VALUES(token_expires_at),
               account_name = VALUES(account_name),
               is_active = true,
               updated_at = NOW()`,
            [dojo_id, igAccount.id, igAccount.username, page.access_token, tokenExpiresAt, page.id, page.name, igAccount.id]
          );
        }
      }
    }

    logger.info('Social Media Accounts erfolgreich verbunden', {
      dojoId: dojo_id,
      pagesCount: pages.length
    });

    res.redirect(`${process.env.FRONTEND_URL}/admin/buddy?tab=aktionen&success=connected`);
  } catch (error) {
    logger.error('OAuth Callback Fehler', { error: error.message, stack: error.stack });
    res.redirect(`${process.env.FRONTEND_URL}/admin/buddy?error=connection_failed`);
  }
});

// =============================================================================
// ACCOUNT MANAGEMENT ROUTES
// =============================================================================

/**
 * @route GET /api/marketing-aktionen/accounts
 * @desc Ruft alle verbundenen Social Media Accounts ab
 */
router.get('/accounts', async (req, res) => {
  try {
    const dojoId = getDojoId(req);

    if (!dojoId) {
      return res.status(400).json({ error: 'Dojo ID erforderlich' });
    }

    const [accounts] = await req.db.query(
      `SELECT id, platform, account_name, page_name, is_active,
              token_expires_at, created_at, updated_at
       FROM marketing_social_accounts
       WHERE dojo_id = ? AND is_active = true
       ORDER BY platform, account_name`,
      [dojoId]
    );

    // Token-Status prüfen
    const accountsWithStatus = accounts.map(acc => ({
      ...acc,
      token_valid: acc.token_expires_at ? new Date(acc.token_expires_at) > new Date() : false,
      token_expires_soon: acc.token_expires_at ?
        new Date(acc.token_expires_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : false
    }));

    res.json(accountsWithStatus);
  } catch (error) {
    logger.error('Fehler beim Abrufen der Accounts', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Abrufen der Accounts' });
  }
});

/**
 * @route DELETE /api/marketing-aktionen/accounts/:id
 * @desc Trennt einen Social Media Account
 */
router.delete('/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const dojoId = getDojoId(req);

    const [result] = await req.db.query(
      `UPDATE marketing_social_accounts
       SET is_active = false, updated_at = NOW()
       WHERE id = ? AND dojo_id = ?`,
      [id, dojoId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Account nicht gefunden' });
    }

    res.json({ message: 'Account erfolgreich getrennt' });
  } catch (error) {
    logger.error('Fehler beim Trennen des Accounts', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Trennen des Accounts' });
  }
});

/**
 * @route GET /api/marketing-aktionen/status
 * @desc Prüft ob Meta API konfiguriert ist
 */
router.get('/status', (req, res) => {
  res.json({
    configured: metaApiService.isConfigured(),
    message: metaApiService.isConfigured()
      ? 'Meta API ist konfiguriert'
      : 'Meta API Credentials fehlen. Bitte META_APP_ID, META_APP_SECRET und META_REDIRECT_URI setzen.'
  });
});

// =============================================================================
// POST MANAGEMENT ROUTES
// =============================================================================

/**
 * @route GET /api/marketing-aktionen/posts
 * @desc Ruft alle Posts ab
 */
router.get('/posts', async (req, res) => {
  try {
    const dojoId = getDojoId(req);
    const { status, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT p.*, a.platform, a.account_name, a.page_name
      FROM marketing_posts p
      JOIN marketing_social_accounts a ON p.social_account_id = a.id
      WHERE p.dojo_id = ?
    `;
    const params = [dojoId];

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [posts] = await req.db.query(query, params);

    res.json(posts);
  } catch (error) {
    logger.error('Fehler beim Abrufen der Posts', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Abrufen der Posts' });
  }
});

/**
 * @route POST /api/marketing-aktionen/posts
 * @desc Erstellt einen neuen Post
 */
router.post('/posts', upload.array('media', 10), async (req, res) => {
  try {
    const dojoId = getDojoId(req);
    const userId = req.user?.user_id;
    const { content, social_account_id, post_type = 'text', scheduled_at, campaign_id } = req.body;

    if (!content || !social_account_id) {
      return res.status(400).json({ error: 'Content und Account sind erforderlich' });
    }

    // Account prüfen
    const [accounts] = await req.db.query(
      'SELECT * FROM marketing_social_accounts WHERE id = ? AND dojo_id = ? AND is_active = true',
      [social_account_id, dojoId]
    );

    if (accounts.length === 0) {
      return res.status(404).json({ error: 'Account nicht gefunden' });
    }

    // Media URLs sammeln
    let mediaUrls = [];
    if (req.files && req.files.length > 0) {
      mediaUrls = req.files.map(f => `/uploads/marketing/${f.filename}`);
    }

    const status = scheduled_at ? 'scheduled' : 'draft';

    const [result] = await req.db.query(
      `INSERT INTO marketing_posts
       (dojo_id, social_account_id, content, media_urls, post_type, status, scheduled_at, campaign_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [dojoId, social_account_id, content, JSON.stringify(mediaUrls), post_type, status, scheduled_at || null, campaign_id || null, userId]
    );

    // Media-Dateien in separate Tabelle speichern
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        await req.db.query(
          `INSERT INTO marketing_post_media
           (post_id, media_type, file_path, file_name, file_size, mime_type, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [result.insertId, file.mimetype.startsWith('video') ? 'video' : 'image',
           `/uploads/marketing/${file.filename}`, file.originalname, file.size, file.mimetype, i]
        );
      }
    }

    res.status(201).json({
      message: 'Post erfolgreich erstellt',
      postId: result.insertId
    });
  } catch (error) {
    logger.error('Fehler beim Erstellen des Posts', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Erstellen des Posts' });
  }
});

/**
 * @route POST /api/marketing-aktionen/posts/:id/publish
 * @desc Veröffentlicht einen Post sofort
 */
router.post('/posts/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const dojoId = getDojoId(req);

    // Post und Account abrufen
    const [posts] = await req.db.query(
      `SELECT p.*, a.platform, a.access_token, a.page_id, a.instagram_business_account_id
       FROM marketing_posts p
       JOIN marketing_social_accounts a ON p.social_account_id = a.id
       WHERE p.id = ? AND p.dojo_id = ?`,
      [id, dojoId]
    );

    if (posts.length === 0) {
      return res.status(404).json({ error: 'Post nicht gefunden' });
    }

    const post = posts[0];

    if (post.status === 'published') {
      return res.status(400).json({ error: 'Post wurde bereits veröffentlicht' });
    }

    // Media abrufen
    const [mediaFiles] = await req.db.query(
      'SELECT * FROM marketing_post_media WHERE post_id = ? ORDER BY sort_order',
      [id]
    );

    const baseUrl = process.env.BACKEND_URL || 'https://dojo.tda-intl.org';
    const mediaUrls = mediaFiles.map(m => baseUrl + m.file_path);

    let externalPostId;
    let errorMessage = null;

    try {
      if (post.platform === 'facebook') {
        const result = await metaApiService.publishToFacebook(
          post.page_id,
          post.access_token,
          {
            message: post.content,
            mediaIds: mediaUrls.length > 0 ? mediaUrls : null
          }
        );
        externalPostId = result.id || result.post_id;
      } else if (post.platform === 'instagram') {
        if (mediaUrls.length === 0) {
          throw new Error('Instagram Posts benötigen mindestens ein Bild');
        }

        if (mediaUrls.length > 1) {
          const result = await metaApiService.publishInstagramCarousel(
            post.instagram_business_account_id,
            post.access_token,
            { caption: post.content, imageUrls: mediaUrls }
          );
          externalPostId = result.id;
        } else {
          const result = await metaApiService.publishToInstagram(
            post.instagram_business_account_id,
            post.access_token,
            { caption: post.content, imageUrl: mediaUrls[0] }
          );
          externalPostId = result.id;
        }
      }

      // Erfolg speichern
      await req.db.query(
        `UPDATE marketing_posts
         SET status = 'published', published_at = NOW(), external_post_id = ?
         WHERE id = ?`,
        [externalPostId, id]
      );

      logger.info('Post erfolgreich veröffentlicht', {
        postId: id,
        platform: post.platform,
        externalPostId
      });

      res.json({
        message: 'Post erfolgreich veröffentlicht',
        externalPostId
      });
    } catch (publishError) {
      errorMessage = publishError.message;

      // Fehler speichern
      await req.db.query(
        `UPDATE marketing_posts
         SET status = 'failed', error_message = ?
         WHERE id = ?`,
        [errorMessage, id]
      );

      logger.error('Post-Veröffentlichung fehlgeschlagen', {
        postId: id,
        error: errorMessage
      });

      res.status(500).json({
        error: 'Veröffentlichung fehlgeschlagen',
        details: errorMessage
      });
    }
  } catch (error) {
    logger.error('Fehler beim Veröffentlichen', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Veröffentlichen' });
  }
});

/**
 * @route DELETE /api/marketing-aktionen/posts/:id
 * @desc Löscht einen Post
 */
router.delete('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const dojoId = getDojoId(req);

    // Media-Dateien abrufen und löschen
    const [mediaFiles] = await req.db.query(
      'SELECT file_path FROM marketing_post_media WHERE post_id = ?',
      [id]
    );

    for (const media of mediaFiles) {
      const filePath = path.join(__dirname, '..', media.file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    const [result] = await req.db.query(
      'DELETE FROM marketing_posts WHERE id = ? AND dojo_id = ?',
      [id, dojoId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Post nicht gefunden' });
    }

    res.json({ message: 'Post erfolgreich gelöscht' });
  } catch (error) {
    logger.error('Fehler beim Löschen des Posts', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Löschen des Posts' });
  }
});

// =============================================================================
// CAMPAIGN ROUTES (Optional)
// =============================================================================

/**
 * @route GET /api/marketing-aktionen/campaigns
 * @desc Ruft alle Kampagnen ab
 */
router.get('/campaigns', async (req, res) => {
  try {
    const dojoId = getDojoId(req);

    const [campaigns] = await req.db.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM marketing_posts WHERE campaign_id = c.id) as post_count
       FROM marketing_campaigns c
       WHERE c.dojo_id = ?
       ORDER BY c.created_at DESC`,
      [dojoId]
    );

    res.json(campaigns);
  } catch (error) {
    logger.error('Fehler beim Abrufen der Kampagnen', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Abrufen der Kampagnen' });
  }
});

/**
 * @route POST /api/marketing-aktionen/campaigns
 * @desc Erstellt eine neue Kampagne
 */
router.post('/campaigns', async (req, res) => {
  try {
    const dojoId = getDojoId(req);
    const userId = req.user?.user_id;
    const { name, description, start_date, end_date } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name ist erforderlich' });
    }

    const [result] = await req.db.query(
      `INSERT INTO marketing_campaigns
       (dojo_id, name, description, start_date, end_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [dojoId, name, description, start_date || null, end_date || null, userId]
    );

    res.status(201).json({
      message: 'Kampagne erfolgreich erstellt',
      campaignId: result.insertId
    });
  } catch (error) {
    logger.error('Fehler beim Erstellen der Kampagne', { error: error.message });
    res.status(500).json({ error: 'Fehler beim Erstellen der Kampagne' });
  }
});

module.exports = router;
