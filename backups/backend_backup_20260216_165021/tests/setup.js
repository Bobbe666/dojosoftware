/**
 * Jest Setup File
 * Wird vor allen Tests ausgeführt
 */

// Lade Environment Variables für Tests
require('dotenv').config({ path: '.env.test' });

// Mock console für saubere Test-Ausgabe
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Globale Test-Utilities
global.testHelpers = {
  generateToken: (payload) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret');
  },
  
  createTestUser: () => ({
    id: 1,
    email: 'test@example.com',
    dojo_id: 1,
    role: 'admin'
  }),
  
  createTestMember: () => ({
    id: 1,
    vorname: 'Max',
    nachname: 'Mustermann',
    email: 'max@example.com',
    dojo_id: 1,
    status: 'aktiv'
  })
};
