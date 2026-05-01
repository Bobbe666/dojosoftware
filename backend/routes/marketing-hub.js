/**
 * marketing-hub.js
 * Zentraler Marketing Hub — aggregiert TDA-eigene + Dojo-Social-Accounts,
 * ermöglicht plattformweites Posting auf beliebige Kanäle.
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');
const metaApiService = require('../services/metaApiService');

const pool = db.promise();

// ── Auth ──────────────────────────────────────────────────────────────────────

function requireSuperAdmin(req, res, next) {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Kein Token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(403).json({ error: 'Token ungültig' });
  }
  const role = req.user.rolle || req.user.role;
  const isSA = role === 'super_admin' || (role === 'admin' && !req.user.dojo_id);
  if (!isSA) return res.status(403).json({ error: 'Super-Admin erforderlich' });
  next();
}

// ── GET /accounts — alle Kanäle (TDA + Dojos) ────────────────────────────────

router.get('/accounts', requireSuperAdmin, async (req, res) => {
  try {
    const [hubAccounts] = await pool.query(
      `SELECT id, label, platform, page_id, page_name, instagram_business_account_id,
              token_expires_at, is_active, 'hub' AS account_type
       FROM hub_social_accounts ORDER BY label`
    );
    const [dojoAccounts] = await pool.query(
      `SELECT msa.id, d.dojoname AS label, msa.platform, msa.page_id, msa.page_name,
              msa.instagram_business_account_id, msa.token_expires_at, msa.is_active,
              'dojo' AS account_type, msa.dojo_id
       FROM marketing_social_accounts msa
       LEFT JOIN dojo d ON d.id = msa.dojo_id
       WHERE msa.is_active = 1
       ORDER BY d.dojoname`
    );
    res.json({ success: true, hubAccounts, dojoAccounts });
  } catch (err) {
    res.status(500).json({ error: 'DB-Fehler: ' + err.message });
  }
});

// ── POST /accounts/hub — TDA-Konto manuell hinzufügen (Page Token) ────────────

router.post('/accounts/hub', requireSuperAdmin, async (req, res) => {
  const { label, platform, page_id, page_name, instagram_business_account_id, access_token, token_expires_at } = req.body;
  if (!label || !platform || !page_id || !access_token) {
    return res.status(400).json({ error: 'label, platform, page_id, access_token erforderlich' });
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO hub_social_accounts (label, platform, page_id, page_name, instagram_business_account_id, access_token, token_expires_at)
       VALUES (?,?,?,?,?,?,?)`,
      [label, platform, page_id, page_name || null, instagram_business_account_id || null, access_token, token_expires_at || null]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'DB-Fehler: ' + err.message });
  }
});

// ── PUT /accounts/hub/:id — TDA-Konto bearbeiten ─────────────────────────────

router.put('/accounts/hub/:id', requireSuperAdmin, async (req, res) => {
  const { label, page_name, instagram_business_account_id, access_token, token_expires_at, is_active } = req.body;
  try {
    await pool.query(
      `UPDATE hub_social_accounts SET label=?, page_name=?, instagram_business_account_id=?,
       access_token=COALESCE(NULLIF(?,\\'\\'),access_token), token_expires_at=?, is_active=?
       WHERE id=?`,
      [label, page_name || null, instagram_business_account_id || null, access_token, token_expires_at || null, is_active ? 1 : 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'DB-Fehler: ' + err.message });
  }
});

// ── DELETE /accounts/hub/:id ──────────────────────────────────────────────────

router.delete('/accounts/hub/:id', requireSuperAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM hub_social_accounts WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'DB-Fehler: ' + err.message });
  }
});

// ── GET /posts — alle Hub-Posts ───────────────────────────────────────────────

router.get('/posts', requireSuperAdmin, async (req, res) => {
  try {
    const [posts] = await pool.query(
      `SELECT p.*,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT(
          'id', c.id, 'account_type', c.account_type,
          'hub_account_id', c.hub_account_id, 'dojo_account_id', c.dojo_account_id,
          'platform', c.platform, 'status', c.status, 'published_at', c.published_at,
          'error_message', c.error_message
        )) FROM hub_post_channels c WHERE c.hub_post_id = p.id) AS channels
       FROM hub_posts p ORDER BY p.created_at DESC LIMIT 100`
    );
    res.json({ success: true, posts });
  } catch (err) {
    res.status(500).json({ error: 'DB-Fehler: ' + err.message });
  }
});

// ── POST /posts — Post erstellen ──────────────────────────────────────────────

router.post('/posts', requireSuperAdmin, async (req, res) => {
  const { content, channels, scheduled_at } = req.body;
  // channels: [{ account_type: 'hub'|'dojo', account_id: number, platform: 'facebook'|'instagram' }]
  if (!content || !channels?.length) {
    return res.status(400).json({ error: 'content und channels erforderlich' });
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO hub_posts (content, status, scheduled_at, created_by)
       VALUES (?, ?, ?, ?)`,
      [content, scheduled_at ? 'scheduled' : 'draft', scheduled_at || null, req.user.email || 'super_admin']
    );
    const postId = result.insertId;
    for (const ch of channels) {
      await pool.query(
        `INSERT INTO hub_post_channels (hub_post_id, account_type, hub_account_id, dojo_account_id, platform)
         VALUES (?, ?, ?, ?, ?)`,
        [postId, ch.account_type, ch.account_type === 'hub' ? ch.account_id : null, ch.account_type === 'dojo' ? ch.account_id : null, ch.platform]
      );
    }
    res.json({ success: true, id: postId });
  } catch (err) {
    res.status(500).json({ error: 'DB-Fehler: ' + err.message });
  }
});

// ── POST /posts/:id/publish — sofort veröffentlichen ─────────────────────────

router.post('/posts/:id/publish', requireSuperAdmin, async (req, res) => {
  try {
    const [[post]] = await pool.query('SELECT * FROM hub_posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post nicht gefunden' });

    const [channels] = await pool.query('SELECT * FROM hub_post_channels WHERE hub_post_id = ?', [req.params.id]);
    const results = [];

    for (const ch of channels) {
      try {
        let token, pageId, igAccountId;

        if (ch.account_type === 'hub') {
          const [[acc]] = await pool.query('SELECT * FROM hub_social_accounts WHERE id = ?', [ch.hub_account_id]);
          if (!acc) throw new Error('Konto nicht gefunden');
          token = acc.access_token;
          pageId = acc.page_id;
          igAccountId = acc.instagram_business_account_id;
        } else {
          const [[acc]] = await pool.query('SELECT * FROM marketing_social_accounts WHERE id = ?', [ch.dojo_account_id]);
          if (!acc) throw new Error('Dojo-Konto nicht gefunden');
          token = acc.access_token;
          pageId = acc.page_id;
          igAccountId = acc.instagram_business_account_id;
        }

        let platformPostId;
        if (ch.platform === 'facebook') {
          const fbResult = await metaApiService.publishToFacebook(pageId, token, { message: post.content });
          platformPostId = fbResult.id;
        } else if (ch.platform === 'instagram' && igAccountId) {
          const igResult = await metaApiService.publishToInstagram(igAccountId, token, { caption: post.content });
          platformPostId = igResult.id;
        }

        await pool.query(
          `UPDATE hub_post_channels SET status='published', platform_post_id=?, published_at=NOW() WHERE id=?`,
          [platformPostId, ch.id]
        );
        results.push({ channel_id: ch.id, status: 'published', platformPostId });
      } catch (chErr) {
        await pool.query(
          `UPDATE hub_post_channels SET status='failed', error_message=? WHERE id=?`,
          [chErr.message, ch.id]
        );
        results.push({ channel_id: ch.id, status: 'failed', error: chErr.message });
      }
    }

    const allOk = results.every(r => r.status === 'published');
    const anyOk = results.some(r => r.status === 'published');
    await pool.query(
      `UPDATE hub_posts SET status=?, published_at=NOW() WHERE id=?`,
      [allOk ? 'published' : anyOk ? 'published' : 'failed', req.params.id]
    );

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: 'Fehler: ' + err.message });
  }
});

// ── DELETE /posts/:id ─────────────────────────────────────────────────────────

router.delete('/posts/:id', requireSuperAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM hub_posts WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'DB-Fehler: ' + err.message });
  }
});

module.exports = router;
