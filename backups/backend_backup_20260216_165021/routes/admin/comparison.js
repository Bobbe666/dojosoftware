/**
 * Admin Comparison Routes
 * Konkurrenz-Vergleich Verwaltung
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();
const { requireSuperAdmin } = require('./shared');

// GET /comparison - Alle Vergleichsdaten laden (für Admin)
router.get('/', requireSuperAdmin, async (req, res) => {
  try {
    // Konkurrenten laden
    const [competitors] = await db.promise().query(
      'SELECT * FROM comparison_competitors WHERE is_active = 1 ORDER BY sort_order'
    );

    // Kategorien laden
    const [categories] = await db.promise().query(
      'SELECT * FROM comparison_categories WHERE is_active = 1 ORDER BY sort_order'
    );

    // Features mit Bewertungen laden
    const [items] = await db.promise().query(`
      SELECT
        ci.id, ci.category_id, ci.feature_name, ci.sort_order,
        cc.name as category_name
      FROM comparison_items ci
      JOIN comparison_categories cc ON ci.category_id = cc.id
      WHERE ci.is_active = 1
      ORDER BY cc.sort_order, ci.sort_order
    `);

    // Bewertungen laden
    const [ratings] = await db.promise().query(`
      SELECT item_id, competitor_id, rating, is_ours
      FROM comparison_ratings
    `);

    // Bewertungen zu Items zuordnen
    const itemsWithRatings = items.map(item => {
      const itemRatings = ratings.filter(r => r.item_id === item.id);
      const oursRating = itemRatings.find(r => r.is_ours === 1);
      const competitorRatings = {};
      itemRatings.filter(r => !r.is_ours).forEach(r => {
        competitorRatings[r.competitor_id] = r.rating;
      });

      return {
        ...item,
        ours: oursRating?.rating || 'none',
        competitors: competitorRatings
      };
    });

    res.json({
      success: true,
      competitors,
      categories,
      items: itemsWithRatings
    });
  } catch (error) {
    logger.error('Fehler beim Laden der Vergleichsdaten:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Vergleichsdaten' });
  }
});

// GET /comparison/public - Öffentliche Vergleichsdaten (für Landing Page)
router.get('/public', async (req, res) => {
  try {
    await db.promise().query('SET NAMES utf8mb4');

    // Konkurrenten laden
    const [competitors] = await db.promise().query(
      'SELECT id, name, short_name FROM comparison_competitors WHERE is_active = 1 ORDER BY sort_order'
    );

    // Kategorien mit Features und Bewertungen laden
    const [categories] = await db.promise().query(`
      SELECT id, name, icon, is_highlight, highlight_note, sort_order
      FROM comparison_categories
      WHERE is_active = 1
      ORDER BY sort_order
    `);

    // Für jede Kategorie: Features mit Bewertungen
    const categoriesWithItems = await Promise.all(categories.map(async (cat) => {
      const [items] = await db.promise().query(`
        SELECT ci.id, ci.feature_name
        FROM comparison_items ci
        WHERE ci.category_id = ? AND ci.is_active = 1
        ORDER BY ci.sort_order
      `, [cat.id]);

      // Bewertungen für alle Items dieser Kategorie
      const itemIds = items.map(i => i.id);
      if (itemIds.length === 0) {
        return { ...cat, items: [] };
      }

      const [ratings] = await db.promise().query(`
        SELECT item_id, competitor_id, rating, is_ours
        FROM comparison_ratings
        WHERE item_id IN (?)
      `, [itemIds]);

      const itemsWithRatings = items.map(item => {
        const itemRatings = ratings.filter(r => r.item_id === item.id);
        const oursRating = itemRatings.find(r => r.is_ours === 1);
        const competitorRatings = {};
        itemRatings.filter(r => !r.is_ours).forEach(r => {
          competitorRatings[r.competitor_id] = r.rating;
        });

        return {
          name: item.feature_name,
          ours: oursRating?.rating || 'none',
          competitors: competitorRatings
        };
      });

      return {
        ...cat,
        items: itemsWithRatings
      };
    }));

    res.json({
      success: true,
      competitors,
      categories: categoriesWithItems
    });
  } catch (error) {
    logger.error('Fehler beim Laden der öffentlichen Vergleichsdaten:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Vergleichsdaten' });
  }
});

// PUT /comparison/item/:id/rating - Bewertung aktualisieren
router.put('/item/:id/rating', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { ours, competitors } = req.body;

    // Unsere Bewertung aktualisieren
    if (ours) {
      await db.promise().query(`
        INSERT INTO comparison_ratings (item_id, is_ours, rating)
        VALUES (?, 1, ?)
        ON DUPLICATE KEY UPDATE rating = ?
      `, [id, ours, ours]);
    }

    // Konkurrenten-Bewertungen aktualisieren
    if (competitors) {
      for (const [compId, rating] of Object.entries(competitors)) {
        await db.promise().query(`
          INSERT INTO comparison_ratings (item_id, competitor_id, rating)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE rating = ?
        `, [id, compId, rating, rating]);
      }
    }

    res.json({ success: true, message: 'Bewertung aktualisiert' });
  } catch (error) {
    logger.error('Fehler beim Aktualisieren der Bewertung:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

// POST /comparison/item - Neues Feature hinzufügen
router.post('/item', requireSuperAdmin, async (req, res) => {
  try {
    const { category_id, feature_name } = req.body;

    // Höchste sort_order in der Kategorie finden
    const [maxOrder] = await db.promise().query(
      'SELECT MAX(sort_order) as max_order FROM comparison_items WHERE category_id = ?',
      [category_id]
    );
    const sortOrder = (maxOrder[0].max_order || 0) + 1;

    const [result] = await db.promise().query(
      'INSERT INTO comparison_items (category_id, feature_name, sort_order) VALUES (?, ?, ?)',
      [category_id, feature_name, sortOrder]
    );

    // Standard-Bewertung für uns (full)
    await db.promise().query(
      'INSERT INTO comparison_ratings (item_id, is_ours, rating) VALUES (?, 1, ?)',
      [result.insertId, 'full']
    );

    // Standard-Bewertungen für Konkurrenten (none)
    const [competitors] = await db.promise().query('SELECT id FROM comparison_competitors');
    for (const comp of competitors) {
      await db.promise().query(
        'INSERT INTO comparison_ratings (item_id, competitor_id, rating) VALUES (?, ?, ?)',
        [result.insertId, comp.id, 'none']
      );
    }

    res.json({ success: true, id: result.insertId, message: 'Feature hinzugefügt' });
  } catch (error) {
    logger.error('Fehler beim Hinzufügen des Features:', error);
    res.status(500).json({ error: 'Fehler beim Hinzufügen' });
  }
});

// DELETE /comparison/item/:id - Feature löschen
router.delete('/item/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.promise().query('DELETE FROM comparison_items WHERE id = ?', [id]);
    res.json({ success: true, message: 'Feature gelöscht' });
  } catch (error) {
    logger.error('Fehler beim Löschen des Features:', error);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

// POST /comparison/category - Neue Kategorie hinzufügen
router.post('/category', requireSuperAdmin, async (req, res) => {
  try {
    const { name, icon, is_highlight, highlight_note } = req.body;

    const [maxOrder] = await db.promise().query(
      'SELECT MAX(sort_order) as max_order FROM comparison_categories'
    );
    const sortOrder = (maxOrder[0].max_order || 0) + 1;

    const [result] = await db.promise().query(
      'INSERT INTO comparison_categories (name, icon, is_highlight, highlight_note, sort_order) VALUES (?, ?, ?, ?, ?)',
      [name, icon || '📋', is_highlight || 0, highlight_note, sortOrder]
    );

    res.json({ success: true, id: result.insertId, message: 'Kategorie hinzugefügt' });
  } catch (error) {
    logger.error('Fehler beim Hinzufügen der Kategorie:', error);
    res.status(500).json({ error: 'Fehler beim Hinzufügen' });
  }
});

// PUT /comparison/category/:id - Kategorie aktualisieren
router.put('/category/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, is_highlight, highlight_note } = req.body;

    await db.promise().query(
      'UPDATE comparison_categories SET name = ?, icon = ?, is_highlight = ?, highlight_note = ? WHERE id = ?',
      [name, icon, is_highlight || 0, highlight_note, id]
    );

    res.json({ success: true, message: 'Kategorie aktualisiert' });
  } catch (error) {
    logger.error('Fehler beim Aktualisieren der Kategorie:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  }
});

// POST /comparison/competitor - Neuen Konkurrenten hinzufügen
router.post('/competitor', requireSuperAdmin, async (req, res) => {
  try {
    const { name, short_name, website } = req.body;

    const [maxOrder] = await db.promise().query(
      'SELECT MAX(sort_order) as max_order FROM comparison_competitors'
    );
    const sortOrder = (maxOrder[0].max_order || 0) + 1;

    const [result] = await db.promise().query(
      'INSERT INTO comparison_competitors (name, short_name, website, sort_order) VALUES (?, ?, ?, ?)',
      [name, short_name, website, sortOrder]
    );

    // Standard-Bewertungen für alle existierenden Items
    const [items] = await db.promise().query('SELECT id FROM comparison_items');
    for (const item of items) {
      await db.promise().query(
        'INSERT INTO comparison_ratings (item_id, competitor_id, rating) VALUES (?, ?, ?)',
        [item.id, result.insertId, 'none']
      );
    }

    res.json({ success: true, id: result.insertId, message: 'Konkurrent hinzugefügt' });
  } catch (error) {
    logger.error('Fehler beim Hinzufügen des Konkurrenten:', error);
    res.status(500).json({ error: 'Fehler beim Hinzufügen' });
  }
});

module.exports = router;
