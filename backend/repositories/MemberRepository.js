/**
 * Member Repository
 * Spezifische Datenbank-Operationen für Mitglieder
 */

const BaseRepository = require('./BaseRepository');

class MemberRepository extends BaseRepository {
  constructor() {
    super('mitglieder');
  }

  /**
   * Find members with pagination and search
   */
  async findWithPagination(options = {}) {
    const {
      dojoId,
      page = 1,
      limit = 50,
      search = '',
      status = null,
      sortBy = 'nachname',
      sortOrder = 'ASC',
    } = options;

    const offset = (page - 1) * limit;
    const params = [];
    const whereClauses = ['dojo_id = ?'];
    params.push(dojoId);

    // Search filter
    if (search) {
      whereClauses.push('(vorname LIKE ? OR nachname LIKE ? OR email LIKE ? OR mitgliedsnummer LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Status filter
    if (status) {
      whereClauses.push('status = ?');
      params.push(status);
    }

    const whereClause = whereClauses.join(' AND ');

    // Count query
    const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName} WHERE ${whereClause}`;
    const countResults = await this.query(countQuery, params);
    const total = countResults[0].total;

    // Data query with pagination
    const dataQuery = `
      SELECT * FROM ${this.tableName} 
      WHERE ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const members = await this.query(dataQuery, params);

    return {
      data: members,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find member by email
   */
  async findByEmail(email, dojoId) {
    const query = 'SELECT * FROM mitglieder WHERE email = ? AND dojo_id = ?';
    const results = await this.query(query, [email, dojoId]);
    return results[0] || null;
  }

  /**
   * Find member with full details (including graduierung, vertraege, etc.)
   */
  async findByIdWithDetails(id, dojoId) {
    const query = `
      SELECT 
        m.*,
        s.name as stil_name,
        g.name as guertel_name,
        g.farbe as guertel_farbe
      FROM mitglieder m
      LEFT JOIN stile s ON m.stil_id = s.id
      LEFT JOIN guertel g ON m.graduierung_id = g.id
      WHERE m.id = ? AND m.dojo_id = ?
    `;

    const results = await this.query(query, [id, dojoId]);
    return results[0] || null;
  }

  /**
   * Get member statistics
   */
  async getStatistics(id, dojoId) {
    const queries = {
      anwesenheit: `
        SELECT COUNT(*) as total 
        FROM anwesenheit 
        WHERE mitglied_id = ? AND dojo_id = ?
      `,
      pruefungen: `
        SELECT COUNT(*) as total, SUM(bestanden) as bestanden 
        FROM pruefungen 
        WHERE mitglied_id = ? AND dojo_id = ?
      `,
      transaktionen: `
        SELECT COUNT(*) as total, SUM(betrag) as gesamt 
        FROM transaktionen 
        WHERE mitglied_id = ? AND dojo_id = ?
      `,
    };

    const params = [id, dojoId];

    const [anwesenheit, pruefungen, transaktionen] = await Promise.all([
      this.query(queries.anwesenheit, params),
      this.query(queries.pruefungen, params),
      this.query(queries.transaktionen, params),
    ]);

    return {
      anwesenheit: anwesenheit[0],
      pruefungen: pruefungen[0],
      transaktionen: transaktionen[0],
    };
  }

  /**
   * Search members by name or email
   */
  async search(searchTerm, dojoId) {
    const query = `
      SELECT id, vorname, nachname, email, mitgliedsnummer, status
      FROM mitglieder
      WHERE dojo_id = ?
        AND (
          vorname LIKE ? OR 
          nachname LIKE ? OR 
          email LIKE ? OR 
          mitgliedsnummer LIKE ?
        )
      LIMIT 20
    `;

    const term = `%${searchTerm}%`;
    return this.query(query, [dojoId, term, term, term, term]);
  }
}

module.exports = new MemberRepository();
