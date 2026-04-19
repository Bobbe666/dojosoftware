// ============================================================
// HOMEPAGE TEMPLATE REGISTRY
// ============================================================
// Alle verfügbaren Templates registriert.
// Jedes Template exportiert: { render(config, schedule), id, name, description }
// ============================================================

'use strict';

const traditional = require('./traditional');
const zen = require('./zen');
const combat = require('./combat');
const dynamic = require('./dynamic');

const TEMPLATES = {
  traditional,
  zen,
  combat,
  dynamic,
};

const DEFAULT_TEMPLATE = 'traditional';

/**
 * Rendert eine Homepage basierend auf template_id und config.
 * @param {string} templateId  - 'traditional' | 'zen' | 'combat' | 'dynamic'
 * @param {object} config      - Konfiguration aus dojo_homepage.config
 * @param {Array}  schedule    - Optionaler Stundenplan (Rows aus DB)
 * @returns {string}           - Vollständiges HTML
 */
function renderHomepage(templateId, config, schedule = []) {
  const tpl = TEMPLATES[templateId] || TEMPLATES[DEFAULT_TEMPLATE];
  return tpl.render(config, schedule);
}

/**
 * Gibt alle Template-Metadaten zurück (für Frontend-Auswahl)
 */
function getTemplateList() {
  return Object.values(TEMPLATES).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
  }));
}

module.exports = { renderHomepage, getTemplateList, TEMPLATES, DEFAULT_TEMPLATE };
