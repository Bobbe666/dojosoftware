/**
 * Member Service
 * Business Logic für Mitglieder-Verwaltung
 */

const memberRepository = require('../repositories/MemberRepository');
const logger = require('../utils/logger');

class MemberService {
  /**
   * Get all members with filtering and pagination
   */
  async getAllMembers(dojoId, options = {}) {
    try {
      return await memberRepository.findWithPagination({
        dojoId,
        ...options,
      });
    } catch (error) {
      logger.error('Error in getAllMembers', {
        dojoId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get member by ID with full details
   */
  async getMemberById(id, dojoId) {
    try {
      const member = await memberRepository.findByIdWithDetails(id, dojoId);

      if (!member) {
        throw new Error('Member not found');
      }

      return member;
    } catch (error) {
      logger.error('Error in getMemberById', {
        id,
        dojoId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create new member
   */
  async createMember(data, dojoId) {
    try {
      // Validierung
      if (!data.vorname || !data.nachname || !data.email) {
        throw new Error('Vorname, Nachname und Email sind erforderlich');
      }

      // Prüfe ob Email bereits existiert
      const existingMember = await memberRepository.findByEmail(data.email, dojoId);
      if (existingMember) {
        throw new Error('Ein Mitglied mit dieser Email-Adresse existiert bereits');
      }

      // Erstelle Mitglied
      const member = await memberRepository.create({
        ...data,
        status: data.status || 'aktiv',
        created_at: new Date(),
      }, dojoId);

      logger.info('Member created', {
        memberId: member.id,
        dojoId,
        email: data.email,
      });

      return member;
    } catch (error) {
      logger.error('Error in createMember', {
        dojoId,
        error: error.message,
        data,
      });
      throw error;
    }
  }

  /**
   * Update member
   */
  async updateMember(id, data, dojoId) {
    try {
      // Prüfe ob Mitglied existiert
      const existingMember = await memberRepository.findById(id, dojoId);
      if (!existingMember) {
        throw new Error('Member not found or access denied');
      }

      // Prüfe Email-Eindeutigkeit (wenn Email geändert wird)
      if (data.email && data.email !== existingMember.email) {
        const memberWithEmail = await memberRepository.findByEmail(data.email, dojoId);
        if (memberWithEmail && memberWithEmail.id !== id) {
          throw new Error('Ein anderes Mitglied mit dieser Email-Adresse existiert bereits');
        }
      }

      // Update
      const updatedMember = await memberRepository.update(id, {
        ...data,
        updated_at: new Date(),
      }, dojoId);

      logger.info('Member updated', {
        memberId: id,
        dojoId,
      });

      return updatedMember;
    } catch (error) {
      logger.error('Error in updateMember', {
        id,
        dojoId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete member (soft delete - set status to 'geloescht')
   */
  async deleteMember(id, dojoId) {
    try {
      // Soft Delete
      await memberRepository.update(id, {
        status: 'geloescht',
        deleted_at: new Date(),
      }, dojoId);

      logger.info('Member deleted (soft)', {
        memberId: id,
        dojoId,
      });

      return true;
    } catch (error) {
      logger.error('Error in deleteMember', {
        id,
        dojoId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get member statistics
   */
  async getMemberStatistics(id, dojoId) {
    try {
      const member = await memberRepository.findById(id, dojoId);
      if (!member) {
        throw new Error('Member not found');
      }

      const statistics = await memberRepository.getStatistics(id, dojoId);

      return statistics;
    } catch (error) {
      logger.error('Error in getMemberStatistics', {
        id,
        dojoId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Search members
   */
  async searchMembers(searchTerm, dojoId) {
    try {
      if (!searchTerm || searchTerm.length < 2) {
        throw new Error('Search term must be at least 2 characters');
      }

      const results = await memberRepository.search(searchTerm, dojoId);

      return results;
    } catch (error) {
      logger.error('Error in searchMembers', {
        searchTerm,
        dojoId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get active members count
   */
  async getActiveMembersCount(dojoId) {
    try {
      const count = await memberRepository.count({ status: 'aktiv' }, dojoId);
      return count;
    } catch (error) {
      logger.error('Error in getActiveMembersCount', {
        dojoId,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = new MemberService();
