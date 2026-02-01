/**
 * Pruefungen Shared Utilities
 * Helper-Funktionen für Prüfungs-Routes
 */
const logger = require('../../utils/logger');

/**
 * Validiert Prüfungsdaten
 */
function validatePruefungData(data) {
  const errors = [];
  if (!data.mitglied_id) errors.push('mitglied_id ist erforderlich');
  if (!data.stil_id) errors.push('stil_id ist erforderlich');
  if (!data.dojo_id) errors.push('dojo_id ist erforderlich');
  if (!data.graduierung_nachher_id) errors.push('graduierung_nachher_id ist erforderlich');
  if (!data.pruefungsdatum) errors.push('pruefungsdatum ist erforderlich');
  return errors;
}

/**
 * Formatiert DATE-Felder um Zeitzonen-Probleme zu vermeiden
 */
function formatDate(dateValue) {
  if (!dateValue) return null;

  if (dateValue instanceof Date) {
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  if (typeof dateValue === 'string') {
    return dateValue.split('T')[0];
  }

  return null;
}

module.exports = {
  validatePruefungData,
  formatDate
};
