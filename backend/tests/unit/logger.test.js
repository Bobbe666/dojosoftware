/**
 * Unit Tests für Logger Utility
 */

const logger = require('../../utils/logger');

describe('Logger Utility', () => {
  
  beforeEach(() => {
    // Reset console mocks vor jedem Test
    jest.clearAllMocks();
  });

  describe('logger.info', () => {
    it('sollte Info-Nachricht loggen', () => {
      logger.info('Test message');
      // Console-Aufrufe sind gemockt in setup.js
      expect(console.log).toHaveBeenCalled();
    });

    it('sollte Info-Nachricht mit Context loggen', () => {
      logger.info('Test message', { userId: 123, dojoId: 456 });
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('logger.error', () => {
    it('sollte Error-Nachricht loggen', () => {
      logger.error('Error occurred');
      expect(console.error).toHaveBeenCalled();
    });

    it('sollte Error mit Stack Trace loggen', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', { error: error.message, stack: error.stack });
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('logger.success', () => {
    it('sollte Success-Nachricht loggen', () => {
      logger.success('Operation successful');
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('logger.warn', () => {
    it('sollte Warning-Nachricht loggen', () => {
      logger.warn('Warning message');
      expect(console.warn).toHaveBeenCalled();
    });
  });
});
