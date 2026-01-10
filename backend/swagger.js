/**
 * Swagger/OpenAPI Configuration
 */

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DojoSoftware API',
      version: '1.0.0',
      description: 'Multi-Tenant SaaS Platform für Kampfsport-Schulen',
      contact: {
        name: 'DojoSoftware Support',
        email: 'support@dojosoftware.de',
      },
    },
    servers: [
      {
        url: 'http://localhost:5001/api',
        description: 'Development Server',
      },
      {
        url: 'https://api.dojosoftware.de/api',
        description: 'Production Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Authorization header using the Bearer scheme',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Error message',
            },
            statusCode: {
              type: 'integer',
              description: 'HTTP status code',
            },
          },
        },
        Mitglied: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Mitglied ID',
            },
            dojo_id: {
              type: 'integer',
              description: 'Dojo ID (Multi-Tenancy)',
            },
            vorname: {
              type: 'string',
              description: 'Vorname',
            },
            nachname: {
              type: 'string',
              description: 'Nachname',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email-Adresse',
            },
            mitgliedsnummer: {
              type: 'string',
              description: 'Eindeutige Mitgliedsnummer',
            },
            status: {
              type: 'string',
              enum: ['aktiv', 'inaktiv', 'geloescht'],
              description: 'Mitgliedsstatus',
            },
            graduierung_id: {
              type: 'integer',
              description: 'Aktuelle Graduierung (Gürtel) ID',
            },
            stil_id: {
              type: 'integer',
              description: 'Kampfkunst-Stil ID',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Erstellungsdatum',
            },
          },
          required: ['vorname', 'nachname', 'email'],
        },
        Vertrag: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            dojo_id: { type: 'integer' },
            mitglied_id: { type: 'integer' },
            vertragsbeginn: {
              type: 'string',
              format: 'date',
            },
            vertragsende: {
              type: 'string',
              format: 'date',
            },
            status: {
              type: 'string',
              enum: ['aktiv', 'gekuendigt', 'abgelaufen'],
            },
            monatsbeitrag: {
              type: 'number',
              format: 'float',
            },
          },
        },
        Pruefung: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            dojo_id: { type: 'integer' },
            mitglied_id: { type: 'integer' },
            stil_id: { type: 'integer' },
            pruefungsdatum: {
              type: 'string',
              format: 'date',
            },
            graduierung_nachher_id: {
              type: 'integer',
              description: 'Gürtel nach erfolgreicher Prüfung',
            },
            bestanden: {
              type: 'boolean',
            },
            gebuehr: {
              type: 'number',
              format: 'float',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js', './swagger.js'], // Path to API route files
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
