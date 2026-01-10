/**
 * Base Repository Pattern
 * Abstrahiert Datenbank-Operationen
 */

const db = require('../db');
const logger = require('../utils/logger');

class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
    this.db = db;
  }

  /**
   * Find all records with optional filters
   */
  async findAll(filters = {}, dojoId = null) {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM ${this.tableName}`;
      const params = [];
      const whereClauses = [];

      // Multi-Tenancy: Immer dojo_id filtern
      if (dojoId) {
        whereClauses.push('dojo_id = ?');
        params.push(dojoId);
      }

      // Zusätzliche Filter
      Object.entries(filters).forEach(([key, value]) => {
        whereClauses.push(`${key} = ?`);
        params.push(value);
      });

      if (whereClauses.length > 0) {
        query += ' WHERE ' + whereClauses.join(' AND ');
      }

      this.db.query(query, params, (error, results) => {
        if (error) {
          logger.error('Database error in findAll', {
            table: this.tableName,
            error: error.message,
            filters,
          });
          return reject(error);
        }
        resolve(results);
      });
    });
  }

  /**
   * Find single record by ID
   */
  async findById(id, dojoId = null) {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM ${this.tableName} WHERE id = ?`;
      const params = [id];

      // Multi-Tenancy Check
      if (dojoId) {
        query += ' AND dojo_id = ?';
        params.push(dojoId);
      }

      this.db.query(query, params, (error, results) => {
        if (error) {
          logger.error('Database error in findById', {
            table: this.tableName,
            id,
            error: error.message,
          });
          return reject(error);
        }
        resolve(results[0] || null);
      });
    });
  }

  /**
   * Create new record
   */
  async create(data, dojoId = null) {
    return new Promise((resolve, reject) => {
      // Multi-Tenancy: Füge dojo_id automatisch hinzu
      if (dojoId && !data.dojo_id) {
        data.dojo_id = dojoId;
      }

      const query = `INSERT INTO ${this.tableName} SET ?`;

      this.db.query(query, data, (error, results) => {
        if (error) {
          logger.error('Database error in create', {
            table: this.tableName,
            error: error.message,
            data,
          });
          return reject(error);
        }
        resolve({ id: results.insertId, ...data });
      });
    });
  }

  /**
   * Update record by ID
   */
  async update(id, data, dojoId = null) {
    return new Promise((resolve, reject) => {
      let query = `UPDATE ${this.tableName} SET ? WHERE id = ?`;
      const params = [data, id];

      // Multi-Tenancy Check
      if (dojoId) {
        query += ' AND dojo_id = ?';
        params.push(dojoId);
      }

      this.db.query(query, params, (error, results) => {
        if (error) {
          logger.error('Database error in update', {
            table: this.tableName,
            id,
            error: error.message,
          });
          return reject(error);
        }

        if (results.affectedRows === 0) {
          return reject(new Error('Record not found or access denied'));
        }

        resolve({ id, ...data });
      });
    });
  }

  /**
   * Delete record by ID
   */
  async delete(id, dojoId = null) {
    return new Promise((resolve, reject) => {
      let query = `DELETE FROM ${this.tableName} WHERE id = ?`;
      const params = [id];

      // Multi-Tenancy Check
      if (dojoId) {
        query += ' AND dojo_id = ?';
        params.push(dojoId);
      }

      this.db.query(query, params, (error, results) => {
        if (error) {
          logger.error('Database error in delete', {
            table: this.tableName,
            id,
            error: error.message,
          });
          return reject(error);
        }

        if (results.affectedRows === 0) {
          return reject(new Error('Record not found or access denied'));
        }

        resolve(true);
      });
    });
  }

  /**
   * Count records with optional filters
   */
  async count(filters = {}, dojoId = null) {
    return new Promise((resolve, reject) => {
      let query = `SELECT COUNT(*) as total FROM ${this.tableName}`;
      const params = [];
      const whereClauses = [];

      if (dojoId) {
        whereClauses.push('dojo_id = ?');
        params.push(dojoId);
      }

      Object.entries(filters).forEach(([key, value]) => {
        whereClauses.push(`${key} = ?`);
        params.push(value);
      });

      if (whereClauses.length > 0) {
        query += ' WHERE ' + whereClauses.join(' AND ');
      }

      this.db.query(query, params, (error, results) => {
        if (error) {
          logger.error('Database error in count', {
            table: this.tableName,
            error: error.message,
          });
          return reject(error);
        }
        resolve(results[0].total);
      });
    });
  }

  /**
   * Execute custom query
   */
  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.query(sql, params, (error, results) => {
        if (error) {
          logger.error('Database error in custom query', {
            error: error.message,
            sql,
          });
          return reject(error);
        }
        resolve(results);
      });
    });
  }
}

module.exports = BaseRepository;
