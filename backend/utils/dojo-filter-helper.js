/**
 * dojo-filter-helper.js
 * Alte API-Kompatibilitaet fuer Routen die buildDojoWhereClause(id, alias, paramsArray) verwenden
 */
const { getSecureDojoId: _getSecureDojoId } = require('../middleware/tenantSecurity');

function getSecureDojoId(req) {
  return _getSecureDojoId(req);
}

/**
 * Alte API: buildDojoWhereClause(secureDojoId, tableAlias, queryParams)
 * Gibt SQL-Fragment zurueck und pusht Wert in queryParams-Array
 */
function buildDojoWhereClause(secureDojoId, tableAlias, queryParams) {
  if (!secureDojoId) return '';
  const column = tableAlias ? tableAlias + '.dojo_id' : 'dojo_id';
  if (Array.isArray(queryParams)) {
    queryParams.push(secureDojoId);
    return column + ' = ?';
  }
  return column + ' = ' + parseInt(secureDojoId);
}

module.exports = { getSecureDojoId, buildDojoWhereClause };
