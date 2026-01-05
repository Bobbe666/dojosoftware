// =====================================================================================
// FRONTEND CONFIGURATION
// =====================================================================================
// Zentrale Konfiguration für DojoSoftware Frontend

const config = {
  // API Base URL - automatisch basierend auf Umgebung
  apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',

  // Feature Flags
  features: {
    enableRegistration: true,
    enablePublicPages: true,
    enableDarkMode: false
  },

  // App Metadata
  app: {
    name: 'DojoSoftware',
    version: '2.0.0',
    description: 'Die professionelle Lösung für Kampfsportschulen & Dojos'
  },

  // Subscription Plans Metadata
  plans: {
    starter: {
      name: 'Starter',
      maxMembers: 100,
      features: ['mitgliederverwaltung', 'sepa', 'checkin', 'pruefungen']
    },
    professional: {
      name: 'Professional',
      maxMembers: 300,
      features: ['mitgliederverwaltung', 'sepa', 'checkin', 'pruefungen', 'verkauf', 'events']
    },
    premium: {
      name: 'Premium',
      maxMembers: 999999,
      features: ['mitgliederverwaltung', 'sepa', 'checkin', 'pruefungen', 'verkauf', 'events', 'buchfuehrung', 'api']
    },
    enterprise: {
      name: 'Enterprise',
      maxMembers: 999999,
      features: ['mitgliederverwaltung', 'sepa', 'checkin', 'pruefungen', 'verkauf', 'events', 'buchfuehrung', 'api', 'multidojo']
    }
  }
};

export default config;
