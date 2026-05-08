const express = require('express');
const router = express.Router();
const FINANZAEMTER = require('../data/finanzaemter-data');

// GET /api/finanzaemter — full list or filtered by ?bundesland=Bayern&q=münchen
router.get('/', (req, res) => {
  let list = FINANZAEMTER;
  const { bundesland, q } = req.query;
  if (bundesland) list = list.filter(f => f.bundesland === bundesland);
  if (q) {
    const ql = q.toLowerCase();
    list = list.filter(f => f.name.toLowerCase().includes(ql) || f.ort.toLowerCase().includes(ql));
  }
  res.json(list);
});

// GET /api/finanzaemter/bundeslaender — sorted list of unique Bundesländer
router.get('/bundeslaender', (req, res) => {
  const bl = [...new Set(FINANZAEMTER.map(f => f.bundesland))].sort();
  res.json(bl);
});

module.exports = router;
