/**
 * Integration Tests für Auth Routes
 */

const request = require('supertest');
const express = require('express');
const authRoutes = require('../../routes/auth');

// Erstelle Test-App
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes Integration Tests', () => {
  
  describe('GET /api/auth/health', () => {
    it('sollte Gesundheitsstatus zurückgeben', async () => {
      const response = await request(app)
        .get('/api/auth/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('service', 'Auth Service');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/auth/test', () => {
    it('sollte Test-Nachricht zurückgeben', async () => {
      const response = await request(app)
        .get('/api/auth/test')
        .expect(200);
      
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('working');
    });
  });

  describe('POST /api/auth/login', () => {
    it('sollte 400 zurückgeben wenn keine Credentials übergeben werden', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);
      
      expect(response.body).toHaveProperty('message');
    });

    it('sollte 400 zurückgeben wenn Passwort fehlt', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' })
        .expect(400);
      
      expect(response.body.message).toContain('Passwort');
    });

    // HINWEIS: Für echte Login-Tests muss eine Test-Datenbank mit Fixtures verwendet werden
    // Siehe tests/fixtures/ für Test-Daten
  });

  describe('POST /api/auth/token-login', () => {
    it('sollte 401 zurückgeben wenn kein Token übergeben wird', async () => {
      const response = await request(app)
        .post('/api/auth/token-login')
        .send({})
        .expect(401);
      
      expect(response.body).toHaveProperty('message');
    });
  });
});
