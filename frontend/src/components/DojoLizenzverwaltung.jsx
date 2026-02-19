import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2, Search, Shield, Clock, CheckCircle, XCircle, Check,
  ChevronRight, Settings, Zap, Users, Calendar, CreditCard,
  TrendingUp, AlertTriangle, RefreshCw, Plus, Trash2, Edit, Globe, Link,
  BarChart3, PieChart, MapPin, TrendingDown, ArrowUpRight, ArrowDownRight,
  Activity, Target, DollarSign, UserPlus, UserMinus,
  HardDrive, AlertCircle, CheckCircle2, Info, Flag, Heart, Server,
  Download, Power, PowerOff
} from 'lucide-react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import '../styles/DojoLizenzverwaltung.css';

const PLAN_HIERARCHY = {
  'trial': 0,
  'basic': 1,
  'free': 2,
  'starter': 3,
  'professional': 4,
  'premium': 5,
  'enterprise': 6
};

const PLAN_COLORS = {
  trial: '#6b7280',
  basic: '#a3a3a3',
  free: '#9ca3af',
  starter: '#3b82f6',
  professional: '#8b5cf6',
  premium: '#d4af37',
  enterprise: '#ef4444'
};

// Kostenlose Pläne (zählen nicht als "zahlend")
const FREE_PLANS = ['trial', 'basic', 'free'];

// Default Plan-Feature Zuordnung
const DEFAULT_PLAN_FEATURES = {
  trial: ['mitgliederverwaltung', 'checkin', 'dashboard', 'sicherheit'],
  basic: ['mitgliederverwaltung', 'checkin', 'dashboard', 'sicherheit'],
  free: ['mitgliederverwaltung', 'checkin', 'dashboard', 'sicherheit'],
  starter: ['mitgliederverwaltung', 'online_registrierung', 'mitglieder_portal', 'checkin', 'sepa', 'pruefungen', 'vertraege', 'dashboard', 'benachrichtigungen', 'sicherheit', 'interessenten', 'probetraining', 'mahnwesen'],
  professional: ['mitgliederverwaltung', 'online_registrierung', 'mitglieder_portal', 'checkin', 'sepa', 'pruefungen', 'vertraege', 'familien', 'verkauf', 'dashboard', 'stundenplan', 'kommunikation', 'benachrichtigungen', 'dokumente', 'sicherheit', 'interessenten', 'probetraining', 'events', 'ruhepause', 'mahnwesen', 'auswertungen'],
  premium: ['mitgliederverwaltung', 'online_registrierung', 'mitglieder_portal', 'checkin', 'sepa', 'pruefungen', 'vertraege', 'familien', 'verkauf', 'dashboard', 'stundenplan', 'kommunikation', 'benachrichtigungen', 'dokumente', 'sicherheit', 'buchfuehrung', 'api', 'interessenten', 'probetraining', 'events', 'ruhepause', 'mahnwesen', 'auswertungen', 'wettbewerb'],
  enterprise: ['mitgliederverwaltung', 'online_registrierung', 'mitglieder_portal', 'checkin', 'sepa', 'pruefungen', 'vertraege', 'familien', 'verkauf', 'dashboard', 'stundenplan', 'kommunikation', 'benachrichtigungen', 'multidojo', 'dokumente', 'api', 'sicherheit', 'buchfuehrung', 'interessenten', 'probetraining', 'events', 'ruhepause', 'mahnwesen', 'auswertungen', 'wettbewerb', 'whitelabel']
};

const PLAN_NAMES = {
  trial: 'Trial',
  basic: 'Basic',
  free: 'Free',
  starter: 'Starter',
  professional: 'Professional',
  premium: 'Premium',
  enterprise: 'Enterprise'
};

const PLAN_PRICES = {
  trial: '0€',
  basic: '0€',
  free: '0€',
  starter: '49€/Monat',
  professional: '89€/Monat',
  premium: '149€/Monat',
  enterprise: '249€/Monat'
};

// Preise für MRR-Berechnung (nur numerisch) - basierend auf subscription_plans Tabelle
const PLAN_PRICE_VALUES = {
  trial: 0,
  basic: 0,
  free: 0,
  starter: 49,
  professional: 89,
  premium: 149,
  enterprise: 249
};

// Deutsche PLZ-Bereiche nach Bundesland
const PLZ_BUNDESLAND = [
  { start: '01', end: '09', name: 'Sachsen' },
  { start: '10', end: '14', name: 'Berlin' },
  { start: '15', end: '16', name: 'Brandenburg' },
  { start: '17', end: '19', name: 'Mecklenburg-Vorpommern' },
  { start: '20', end: '22', name: 'Hamburg' },
  { start: '23', end: '25', name: 'Schleswig-Holstein' },
  { start: '26', end: '27', name: 'Niedersachsen' },
  { start: '28', end: '28', name: 'Bremen' },
  { start: '29', end: '29', name: 'Niedersachsen' },
  { start: '30', end: '31', name: 'Niedersachsen' },
  { start: '32', end: '33', name: 'Nordrhein-Westfalen' },
  { start: '34', end: '34', name: 'Hessen' },
  { start: '35', end: '36', name: 'Hessen' },
  { start: '37', end: '37', name: 'Niedersachsen' },
  { start: '38', end: '39', name: 'Niedersachsen' },
  { start: '40', end: '41', name: 'Nordrhein-Westfalen' },
  { start: '42', end: '42', name: 'Nordrhein-Westfalen' },
  { start: '44', end: '48', name: 'Nordrhein-Westfalen' },
  { start: '49', end: '49', name: 'Niedersachsen' },
  { start: '50', end: '53', name: 'Nordrhein-Westfalen' },
  { start: '54', end: '56', name: 'Rheinland-Pfalz' },
  { start: '57', end: '57', name: 'Nordrhein-Westfalen' },
  { start: '58', end: '59', name: 'Nordrhein-Westfalen' },
  { start: '60', end: '63', name: 'Hessen' },
  { start: '64', end: '65', name: 'Hessen' },
  { start: '66', end: '66', name: 'Saarland' },
  { start: '67', end: '67', name: 'Rheinland-Pfalz' },
  { start: '68', end: '69', name: 'Baden-Württemberg' },
  { start: '70', end: '76', name: 'Baden-Württemberg' },
  { start: '77', end: '79', name: 'Baden-Württemberg' },
  { start: '80', end: '87', name: 'Bayern' },
  { start: '88', end: '89', name: 'Baden-Württemberg' },
  { start: '90', end: '96', name: 'Bayern' },
  { start: '97', end: '97', name: 'Bayern' },
  { start: '98', end: '99', name: 'Thüringen' },
];

// Funktion um Bundesland aus PLZ zu ermitteln
const getBundeslandFromPLZ = (plz) => {
  if (!plz) return 'Unbekannt';
  const plzStr = String(plz).padStart(5, '0').substring(0, 2);
  const match = PLZ_BUNDESLAND.find(
    p => plzStr >= p.start && plzStr <= p.end
  );
  return match ? match.name : 'Unbekannt';
};

// Default Features - können vom Admin erweitert werden
const DEFAULT_FEATURES = [
  {
    id: 'mitgliederverwaltung',
    label: 'Mitgliederverwaltung',
    description: 'Verträge, Kündigungen, Dokumente, Familienverbund - alles an einem Ort',
    emoji: '👥'
  },
  {
    id: 'online_registrierung',
    label: 'Online-Registrierung',
    description: 'Selbstständige Anmeldung mit automatischer Vertragserstellung',
    emoji: '🌐'
  },
  {
    id: 'mitglieder_portal',
    label: 'Mitglieder-Portal',
    description: 'Self-Service: Adressänderung, Kündigung, Ruhepause - ohne deinen Aufwand',
    emoji: '👤'
  },
  {
    id: 'checkin',
    label: 'Check-In System',
    description: 'QR-Code basiertes Check-In mit Live-Display für dein Dojo',
    emoji: '✅'
  },
  {
    id: 'sepa',
    label: 'SEPA & Finanzen',
    description: 'Automatische Lastschriften, Rabattsystem, Mahnwesen',
    emoji: '🏦'
  },
  {
    id: 'pruefungen',
    label: 'Prüfungswesen',
    description: 'Gürtelprüfungen, historische Prüfungen, Lehrgänge & Ehrungen',
    emoji: '🥋'
  },
  {
    id: 'vertraege',
    label: 'Vertragsverwaltung',
    description: 'Automatische Verlängerung, Tarifwechsel, Rabatte, PDF-Export',
    emoji: '📄'
  },
  {
    id: 'familien',
    label: 'Familienverwaltung',
    description: 'Familienrabatte, Erziehungsberechtigte, verknüpfte Konten',
    emoji: '👨‍👩‍👧‍👦'
  },
  {
    id: 'verkauf',
    label: 'Verkauf & Lager',
    description: 'Artikel, Kassensystem, Bestandsverwaltung, Verkaufsstatistik',
    emoji: '🛒'
  },
  {
    id: 'dashboard',
    label: 'Dashboard & Statistiken',
    description: 'Echtzeit-Auswertungen, Einnahmen, Austritte, Anwesenheit',
    emoji: '📊'
  },
  {
    id: 'stundenplan',
    label: 'Stundenplan & Kurse',
    description: 'Trainingszeiten, Kursbuchung, Wartelisten, Trainer-Zuordnung',
    emoji: '📅'
  },
  {
    id: 'kommunikation',
    label: 'Kommunikation',
    description: 'E-Mail-Versand, Newsletter, Vorlagen, Massen-Mails',
    emoji: '📧'
  },
  {
    id: 'benachrichtigungen',
    label: 'Benachrichtigungen',
    description: 'Automatische Erinnerungen, Zahlungseingänge, Kündigungen',
    emoji: '🔔'
  },
  {
    id: 'multidojo',
    label: 'Multi-Dojo',
    description: 'Mehrere Standorte zentral verwalten mit einem Account',
    emoji: '🏢'
  },
  {
    id: 'dokumente',
    label: 'Dokumentenverwaltung',
    description: 'Upload, Speicherung und Verwaltung aller Dokumente',
    emoji: '📁'
  },
  {
    id: 'api',
    label: 'API-Zugang',
    description: 'Externe Integrationen, Webhooks, Zapier-Anbindung',
    emoji: '🔌'
  },
  {
    id: 'sicherheit',
    label: 'Sicherheit & DSGVO',
    description: 'Verschlüsselte Daten, deutsche Server, 100% DSGVO-konform',
    emoji: '🔒'
  },
  {
    id: 'buchfuehrung',
    label: 'Buchführung & EÜR',
    description: 'Einnahmen-Überschuss-Rechnung, DATEV-Export, Steuervorbereitung',
    emoji: '📒'
  },
  // ===== NEUE FEATURES =====
  {
    id: 'wettbewerb',
    label: 'Wettbewerbssystem',
    description: 'Turnierverwaltung, Sportler, Nominierungen, Hall-of-Fame, Medaillen',
    emoji: '🏆'
  },
  {
    id: 'interessenten',
    label: 'Interessenten & Leads',
    description: 'Probetraining-Anfragen, Lead-Verwaltung, Conversion-Tracking',
    emoji: '🎯'
  },
  {
    id: 'probetraining',
    label: 'Probetraining',
    description: 'Online-Buchung, Terminverwaltung, automatische Erinnerungen',
    emoji: '🥊'
  },
  {
    id: 'events',
    label: 'Events & Lehrgänge',
    description: 'Veranstaltungen, Seminare, Lehrgänge, Online-Anmeldung',
    emoji: '🎪'
  },
  {
    id: 'ruhepause',
    label: 'Ruhepause & Pausieren',
    description: 'Mitgliedschaft pausieren, automatische Reaktivierung',
    emoji: '⏸️'
  },
  {
    id: 'mahnwesen',
    label: 'Mahnwesen',
    description: 'Automatische Mahnungen, Mahnstufen, Zahlungserinnerungen',
    emoji: '⚠️'
  },
  {
    id: 'auswertungen',
    label: 'Berichte & Auswertungen',
    description: 'Detaillierte Reports, Export-Funktionen, grafische Analysen',
    emoji: '📈'
  },
  {
    id: 'whitelabel',
    label: 'White-Label',
    description: 'Eigenes Branding, Custom Domain, individuelles Design',
    emoji: '🎨'
  },
];

const DojoLizenzverwaltung = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [dojos, setDojos] = useState([]);
  const [selectedDojo, setSelectedDojo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [featureOverrides, setFeatureOverrides] = useState({});

  // Features Management
  const [allFeatures, setAllFeatures] = useState(DEFAULT_FEATURES);
  const [showAddFeature, setShowAddFeature] = useState(false);
  const [newFeature, setNewFeature] = useState({ id: '', label: '', description: '', emoji: '⭐' });
  const [editingFeature, setEditingFeature] = useState(null);

  // Plan-Feature Management
  const [planFeatures, setPlanFeatures] = useState(DEFAULT_PLAN_FEATURES);
  const [editingPlan, setEditingPlan] = useState(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [editingPlanPrices, setEditingPlanPrices] = useState({});
  const [activePlanTab, setActivePlanTab] = useState('starter'); // Für Features-Tab Sub-Navigation

  // Statistiken
  const [statsLoading, setStatsLoading] = useState(false);
  const [detailedStats, setDetailedStats] = useState(null);

  // Audit-Log
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);

  // SaaS Settings
  const [saasSettings, setSaasSettings] = useState({});
  const [saasCategories, setSaasCategories] = useState([]);
  const [saasSettingsLoading, setSaasSettingsLoading] = useState(false);
  const [saasSettingsSaving, setSaasSettingsSaving] = useState(false);
  const [editedSettings, setEditedSettings] = useState({});
  const [testResults, setTestResults] = useState({});

  // Vergleich (Comparison) Management
  const [comparisonData, setComparisonData] = useState({ competitors: [], categories: [], items: [] });
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddCompetitor, setShowAddCompetitor] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', icon: '📋', is_highlight: false, highlight_note: '' });
  const [newCompetitor, setNewCompetitor] = useState({ name: '', short_name: '', website: '' });
  const [newItem, setNewItem] = useState({ category_id: '', feature_name: '' });

  // Feature Trials State
  const [featureTrials, setFeatureTrials] = useState([]);
  const [featureTrialsLoading, setFeatureTrialsLoading] = useState(false);
  const [trialStats, setTrialStats] = useState(null);
  const [addonPrices, setAddonPrices] = useState([]);
  const [selectedTrialDojo, setSelectedTrialDojo] = useState(null);
  const [showStartTrialModal, setShowStartTrialModal] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadAllData = async () => {
      await loadDojos();
      await loadFeatures();
      // Plan-Features separat laden mit Verzögerung um Abbruch zu vermeiden
      if (isMounted) {
        setTimeout(async () => {
          if (isMounted) {
            await loadPlanFeatures();
            await loadSubscriptionPlans();
          }
        }, 500);
      }
      if (isMounted) {
        await loadStatistics();
      }
    };

    loadAllData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadDojos = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/admin/dojos`);
      if (!response.ok) throw new Error('Fehler beim Laden');
      const data = await response.json();
      setDojos(data.dojos || data || []);
    } catch (error) {
      console.error('Fehler:', error);
      setMessage({ type: 'error', text: 'Fehler beim Laden der Dojos' });
    } finally {
      setLoading(false);
    }
  };

  const loadFeatures = async () => {
    // IMMER DEFAULT_FEATURES verwenden - diese sind vollständig mit Labels und Emojis
    // Die DB speichert nur die Plan-Feature-Zuordnungen, nicht die Feature-Definitionen
    console.log('Verwende DEFAULT_FEATURES:', DEFAULT_FEATURES.length);
    setAllFeatures(DEFAULT_FEATURES);
  };

  const loadPlanFeatures = async () => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/admin/plans/features`);
      if (response.ok) {
        const data = await response.json();
        if (data.planFeatures && Object.keys(data.planFeatures).length > 0) {
          // Ersetze komplett mit DB-Daten (nicht mergen mit Defaults)
          setPlanFeatures(data.planFeatures);
          console.log('Plan-Features aus DB geladen:', data.planFeatures);
        }
      }
    } catch (error) {
      console.log('Plan-Features API nicht verfügbar, nutze Defaults:', error);
    }
  };

  const loadSubscriptionPlans = async () => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/admin/subscription-plans`);
      if (response.ok) {
        const data = await response.json();
        if (data.plans) {
          setSubscriptionPlans(data.plans);
          console.log('Subscription-Plans geladen:', data.plans);
        }
      }
    } catch (error) {
      console.log('Subscription-Plans API nicht verfügbar:', error);
    }
  };

  const savePlanPrices = async (planId, planName, prices) => {
    try {
      setSaving(true);
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/admin/subscription-plans/${planId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prices)
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Speichern fehlgeschlagen');
      }
      setMessage({ type: 'success', text: `Preise für "${planName}" gespeichert!` });
      await loadSubscriptionPlans(); // Reload to get updated data
    } catch (error) {
      console.error('Fehler beim Speichern der Preise:', error);
      setMessage({ type: 'error', text: `Fehler: ${error.message}` });
    } finally {
      setSaving(false);
    }
  };

  const loadStatistics = async () => {
    setStatsLoading(true);
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/admin/dojos/statistics`);
      if (response.ok) {
        const data = await response.json();
        setDetailedStats(data);
      }
    } catch (error) {
      console.log('Statistiken API nicht verfügbar, berechne aus Dojos');
    } finally {
      setStatsLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    setAuditLogsLoading(true);
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/admin/subscription-audit-log?limit=100`);
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.logs || []);
      }
    } catch (error) {
      console.log('Audit-Log API nicht verfügbar');
    } finally {
      setAuditLogsLoading(false);
    }
  };

  // Feature Trials laden
  const loadFeatureTrials = async () => {
    setFeatureTrialsLoading(true);
    try {
      const [trialsRes, statsRes, pricesRes] = await Promise.all([
        fetchWithAuth(`${config.apiBaseUrl}/admin/feature-trials`),
        fetchWithAuth(`${config.apiBaseUrl}/admin/feature-trial-stats`),
        fetchWithAuth(`${config.apiBaseUrl}/admin/feature-addon-prices`)
      ]);

      if (trialsRes.ok) {
        const data = await trialsRes.json();
        setFeatureTrials(data.trials || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setTrialStats(data);
      }

      if (pricesRes.ok) {
        const data = await pricesRes.json();
        setAddonPrices(data.prices || []);
      }
    } catch (error) {
      console.log('Feature-Trials API nicht verfügbar:', error);
    } finally {
      setFeatureTrialsLoading(false);
    }
  };

  // Feature-Trial für ein Dojo starten
  const handleStartTrial = async (dojoId, featureId) => {
    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/admin/dojos/${dojoId}/feature-trial`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ featureId })
        }
      );

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message || 'Trial gestartet!' });
        setShowStartTrialModal(false);
        loadFeatureTrials();
      } else {
        setMessage({ type: 'error', text: data.error || 'Fehler beim Starten' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Fehler beim Starten des Trials' });
    }
  };

  // Feature-Trial beenden
  const handleEndTrial = async (trialId) => {
    if (!confirm('Trial wirklich beenden?')) return;

    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/admin/feature-trials/${trialId}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'cancelled' })
        }
      );

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Trial beendet' });
        loadFeatureTrials();
      } else {
        setMessage({ type: 'error', text: data.error || 'Fehler' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Fehler beim Beenden' });
    }
  };

  // Abgelaufene Trials verarbeiten
  const handleProcessExpiredTrials = async () => {
    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/admin/process-expired-trials`,
        { method: 'POST' }
      );

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: `${data.processed} abgelaufene Trials verarbeitet` });
        loadFeatureTrials();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Fehler beim Verarbeiten' });
    }
  };

  // Addon-Preis aktualisieren
  const handleUpdateAddonPrice = async (featureId, priceData) => {
    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/admin/feature-addon-prices/${featureId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(priceData)
        }
      );

      if (response.ok) {
        setMessage({ type: 'success', text: 'Preis aktualisiert' });
        loadFeatureTrials();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Fehler beim Aktualisieren' });
    }
  };

  const handleSelectDojo = (dojo) => {
    setSelectedDojo(dojo);
    setActiveTab('details');

    // Initialize feature overrides
    const plan = dojo.subscription_plan || dojo.plan_type || 'trial';
    const currentPlanFeatures = planFeatures[plan] || planFeatures.trial || [];

    const overrides = {};
    allFeatures.forEach(feature => {
      const featureKey = `feature_${feature.id}`;
      const isEnabled = dojo[featureKey] !== undefined
        ? dojo[featureKey]
        : currentPlanFeatures.includes(feature.id);
      overrides[feature.id] = isEnabled;
    });
    setFeatureOverrides(overrides);
  };

  const handleFeatureToggle = (featureId) => {
    setFeatureOverrides(prev => ({
      ...prev,
      [featureId]: !prev[featureId]
    }));
  };

  const handleSaveFeatures = async () => {
    if (!selectedDojo) return;
    setSaving(true);

    try {
      const featureData = {};
      allFeatures.forEach(f => {
        featureData[`feature_${f.id}`] = featureOverrides[f.id] || false;
      });

      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/admin/dojos/${selectedDojo.id}/features`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(featureData)
        }
      );

      if (!response.ok) throw new Error('Speichern fehlgeschlagen');

      setMessage({ type: 'success', text: 'Features gespeichert!' });

      // Update local data
      setDojos(prev => prev.map(d =>
        d.id === selectedDojo.id ? { ...d, ...featureData } : d
      ));
      setSelectedDojo(prev => ({ ...prev, ...featureData }));
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleExtendTrial = async (dojoId, days = 14) => {
    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/admin/dojos/${dojoId}/extend-trial`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ days })
        }
      );

      if (!response.ok) throw new Error('Verlängerung fehlgeschlagen');

      setMessage({ type: 'success', text: `Trial um ${days} Tage verlängert!` });
      loadDojos();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  // ============================================
  // SaaS Settings Functions
  // ============================================
  const loadSaasSettings = async () => {
    setSaasSettingsLoading(true);
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/admin/saas-settings`);
      if (!response.ok) throw new Error('Fehler beim Laden der Einstellungen');
      const data = await response.json();
      setSaasSettings(data.settings || {});
      setSaasCategories(data.categories || []);
      setEditedSettings({});
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaasSettingsLoading(false);
    }
  };

  const handleSettingChange = (key, value) => {
    setEditedSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSaasSettings = async () => {
    setSaasSettingsSaving(true);
    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/admin/saas-settings`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: editedSettings })
        }
      );

      if (!response.ok) throw new Error('Speichern fehlgeschlagen');

      const data = await response.json();
      setMessage({ type: 'success', text: data.message || 'Einstellungen gespeichert!' });
      loadSaasSettings();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaasSettingsSaving(false);
    }
  };

  const testStripeConnection = async () => {
    setTestResults(prev => ({ ...prev, stripe: { loading: true } }));
    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/admin/saas-settings/test-stripe`,
        { method: 'POST' }
      );
      const data = await response.json();
      setTestResults(prev => ({
        ...prev,
        stripe: { success: data.success, message: data.message, mode: data.mode, accountId: data.accountId }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        stripe: { success: false, message: error.message }
      }));
    }
  };

  const testEmailConnection = async () => {
    setTestResults(prev => ({ ...prev, email: { loading: true } }));
    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/admin/saas-settings/test-email`,
        { method: 'POST' }
      );
      const data = await response.json();
      setTestResults(prev => ({
        ...prev,
        email: { success: data.success, message: data.message }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        email: { success: false, message: error.message }
      }));
    }
  };

  const clearSettingsCache = async () => {
    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/admin/saas-settings/clear-cache`,
        { method: 'POST' }
      );
      const data = await response.json();
      setMessage({ type: 'success', text: data.message || 'Cache geleert!' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const getCategoryLabel = (category) => {
    const labels = {
      stripe: 'Stripe Zahlungen',
      trial: 'Trial-Einstellungen',
      email: 'E-Mail',
      branding: 'Branding',
      limits: 'Limits',
      pricing: 'Preise',
      general: 'Allgemein'
    };
    return labels[category] || category;
  };

  const getCategoryIcon = (category) => {
    const icons = {
      stripe: <CreditCard size={18} />,
      trial: <Clock size={18} />,
      email: <Globe size={18} />,
      branding: <Heart size={18} />,
      limits: <Target size={18} />,
      pricing: <DollarSign size={18} />,
      general: <Settings size={18} />
    };
    return icons[category] || <Settings size={18} />;
  };

  // ============================================
  // Comparison (Vergleich) Functions
  // ============================================
  const loadComparisonData = async () => {
    setComparisonLoading(true);
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/admin/comparison`);
      if (!response.ok) throw new Error('Fehler beim Laden der Vergleichsdaten');
      const data = await response.json();
      setComparisonData({
        competitors: data.competitors || [],
        categories: data.categories || [],
        items: data.items || []
      });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setComparisonLoading(false);
    }
  };

  const handleUpdateRating = async (itemId, ours, competitors) => {
    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/admin/comparison/item/${itemId}/rating`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ours, competitors })
        }
      );
      if (!response.ok) throw new Error('Speichern fehlgeschlagen');
      setMessage({ type: 'success', text: 'Bewertung gespeichert!' });
      loadComparisonData();
      setEditingItemId(null);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleAddComparisonItem = async () => {
    if (!newItem.category_id || !newItem.feature_name) {
      setMessage({ type: 'error', text: 'Kategorie und Feature-Name erforderlich' });
      return;
    }
    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/admin/comparison/item`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newItem)
        }
      );
      if (!response.ok) throw new Error('Hinzufügen fehlgeschlagen');
      setMessage({ type: 'success', text: 'Feature hinzugefügt!' });
      setNewItem({ category_id: '', feature_name: '' });
      setShowAddItem(false);
      loadComparisonData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleDeleteComparisonItem = async (itemId) => {
    if (!window.confirm('Feature wirklich löschen?')) return;
    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/admin/comparison/item/${itemId}`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Löschen fehlgeschlagen');
      setMessage({ type: 'success', text: 'Feature gelöscht!' });
      loadComparisonData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name) {
      setMessage({ type: 'error', text: 'Name erforderlich' });
      return;
    }
    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/admin/comparison/category`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newCategory)
        }
      );
      if (!response.ok) throw new Error('Hinzufügen fehlgeschlagen');
      setMessage({ type: 'success', text: 'Kategorie hinzugefügt!' });
      setNewCategory({ name: '', icon: '📋', is_highlight: false, highlight_note: '' });
      setShowAddCategory(false);
      loadComparisonData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleAddCompetitor = async () => {
    if (!newCompetitor.name || !newCompetitor.short_name) {
      setMessage({ type: 'error', text: 'Name und Kurzname erforderlich' });
      return;
    }
    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/admin/comparison/competitor`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newCompetitor)
        }
      );
      if (!response.ok) throw new Error('Hinzufügen fehlgeschlagen');
      setMessage({ type: 'success', text: 'Konkurrent hinzugefügt!' });
      setNewCompetitor({ name: '', short_name: '', website: '' });
      setShowAddCompetitor(false);
      loadComparisonData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const getRatingIcon = (rating) => {
    switch (rating) {
      case 'full': return <Check size={16} className="rating-full" />;
      case 'partial': return <span className="rating-partial">~</span>;
      default: return <X size={16} className="rating-none" />;
    }
  };

  const handleActivatePlan = async (dojoId, planType) => {
    if (!window.confirm(`Plan "${planType}" für dieses Dojo aktivieren?`)) return;

    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/admin/dojos/${dojoId}/activate-subscription`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan_type: planType })
        }
      );

      if (!response.ok) throw new Error('Aktivierung fehlgeschlagen');

      setMessage({ type: 'success', text: `Plan "${planType}" aktiviert!` });
      loadDojos();

      // Update selected dojo if viewing details
      if (selectedDojo?.id === dojoId) {
        const updated = dojos.find(d => d.id === dojoId);
        if (updated) handleSelectDojo({ ...updated, subscription_plan: planType });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleToggleDojoActive = async (dojoId, currentlyActive) => {
    const action = currentlyActive ? 'deaktivieren' : 'reaktivieren';
    if (!window.confirm(`Dojo wirklich ${action}? ${currentlyActive ? 'Der Zugang wird gesperrt.' : 'Der Zugang wird wiederhergestellt.'}`)) return;

    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/admin/dojos/${dojoId}/toggle-active`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ist_aktiv: !currentlyActive })
        }
      );

      if (!response.ok) throw new Error(`${action.charAt(0).toUpperCase() + action.slice(1)} fehlgeschlagen`);

      setMessage({ type: 'success', text: `Dojo erfolgreich ${currentlyActive ? 'deaktiviert' : 'reaktiviert'}!` });
      loadDojos();

      // Update selected dojo
      if (selectedDojo?.id === dojoId) {
        setSelectedDojo(prev => ({ ...prev, ist_aktiv: !currentlyActive }));
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'ID', 'Dojo-Name', 'Inhaber', 'E-Mail', 'Telefon',
      'Straße', 'PLZ', 'Ort', 'Land',
      'Plan', 'Status', 'Mitglieder', 'Speicher (KB)',
      'Erstellt', 'Trial endet', 'Monatl. Preis'
    ];

    const getPlan = (d) => d.ds_plan_type || d.subscription_plan || d.plan_type || 'trial';
    const getStatus = (d) => d.ds_status || d.subscription_status || (d.ist_aktiv ? 'active' : 'inactive');

    const rows = dojos.map(d => [
      d.id,
      d.dojoname || '',
      d.inhaber || '',
      d.email || '',
      d.telefon || '',
      d.strasse || '',
      d.plz || '',
      d.ort || '',
      d.land || 'Deutschland',
      getPlan(d),
      getStatus(d),
      d.mitglieder_count || 0,
      d.storage_kb || 0,
      d.created_at ? new Date(d.created_at).toLocaleDateString('de-DE') : '',
      d.trial_ends_at ? new Date(d.trial_ends_at).toLocaleDateString('de-DE') : '',
      d.monthly_price || 0
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dojos_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setMessage({ type: 'success', text: `${dojos.length} Dojos exportiert!` });
  };

  // Feature Management Functions
  const handleAddFeature = async () => {
    if (!newFeature.id || !newFeature.label) {
      setMessage({ type: 'error', text: 'ID und Name sind erforderlich' });
      return;
    }

    const featureId = newFeature.id.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    if (allFeatures.find(f => f.id === featureId)) {
      setMessage({ type: 'error', text: 'Feature-ID existiert bereits' });
      return;
    }

    const feature = {
      ...newFeature,
      id: featureId
    };

    // Try to save to backend
    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/admin/features`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(feature)
        }
      );

      if (response.ok) {
        setMessage({ type: 'success', text: 'Feature hinzugefügt!' });
      }
    } catch (error) {
      console.log('Feature lokal hinzugefügt (API nicht verfügbar)');
    }

    setAllFeatures(prev => [...prev, feature]);
    setNewFeature({ id: '', label: '', description: '', emoji: '⭐' });
    setShowAddFeature(false);
  };

  const handleDeleteFeature = async (featureId) => {
    if (!window.confirm('Feature wirklich löschen?')) return;

    try {
      await fetchWithAuth(
        `${config.apiBaseUrl}/admin/features/${featureId}`,
        { method: 'DELETE' }
      );
    } catch (error) {
      console.log('Feature lokal gelöscht');
    }

    setAllFeatures(prev => prev.filter(f => f.id !== featureId));
    setMessage({ type: 'success', text: 'Feature gelöscht' });
  };

  const handleEditFeature = (feature) => {
    setEditingFeature({ ...feature });
  };

  const handleSaveEditFeature = async () => {
    if (!editingFeature) return;

    try {
      await fetchWithAuth(
        `${config.apiBaseUrl}/admin/features/${editingFeature.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingFeature)
        }
      );
    } catch (error) {
      console.log('Feature lokal aktualisiert');
    }

    setAllFeatures(prev => prev.map(f => f.id === editingFeature.id ? editingFeature : f));
    setEditingFeature(null);
    setMessage({ type: 'success', text: 'Feature aktualisiert' });
  };

  // Berechnete Statistiken aus Dojos
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

    // Helper um den aktuellen Plan zu ermitteln (bevorzugt dojo_subscriptions)
    const getPlan = (d) => d.ds_plan_type || d.subscription_plan || d.plan_type || 'trial';
    const getStatus = (d) => d.ds_status || d.subscription_status;
    const getTrialEnd = (d) => d.ds_trial_ends_at || d.trial_ends_at;

    // Basis-Stats
    const total = dojos.length;
    const active = dojos.filter(d => getStatus(d) === 'active' || d.ist_aktiv).length;
    const trials = dojos.filter(d => getPlan(d) === 'trial').length;
    const free = dojos.filter(d => getPlan(d) === 'free').length;

    // Zahlende Kunden = alle die NICHT trial oder free sind UND (aktiv sind ODER monthly_price > 0)
    const paid = dojos.filter(d => {
      const plan = getPlan(d);
      // Kostenlose Pläne ausschließen
      if (FREE_PLANS.includes(plan)) return false;
      // Prüfen ob wirklich zahlend
      if (d.monthly_price && d.monthly_price > 0) return true;
      if (getStatus(d) === 'active') return true;
      // Fallback: Plan ist kostenpflichtig laut PLAN_PRICE_VALUES
      return PLAN_PRICE_VALUES[plan] > 0;
    }).length;

    // Mitglieder gesamt
    const totalMembers = dojos.reduce((sum, d) => sum + (d.mitglieder_count || 0), 0);

    // Neue Dojos diesen Monat
    const newThisMonth = dojos.filter(d => {
      if (!d.created_at) return false;
      const created = new Date(d.created_at);
      return created.getMonth() === thisMonth && created.getFullYear() === thisYear;
    }).length;

    // Neue Dojos letzten Monat
    const newLastMonth = dojos.filter(d => {
      if (!d.created_at) return false;
      const created = new Date(d.created_at);
      return created.getMonth() === lastMonth && created.getFullYear() === lastMonthYear;
    }).length;

    // Plan-Verteilung (mit Fallback auf trial wenn kein Plan gesetzt)
    const planDistribution = {};
    Object.keys(PLAN_HIERARCHY).forEach(plan => {
      planDistribution[plan] = dojos.filter(d => getPlan(d) === plan).length;
    });

    // Länder-Verteilung
    const countryDistribution = {};
    dojos.forEach(d => {
      const country = d.land || 'Deutschland';
      countryDistribution[country] = (countryDistribution[country] || 0) + 1;
    });

    // Bundesland/Region-Verteilung (aus PLZ ermittelt)
    const regionDistribution = {};
    dojos.forEach(d => {
      // Wenn Land nicht Deutschland ist, den Ort als Region verwenden
      const country = d.land || 'Deutschland';
      let region;
      if (country === 'Deutschland' && d.plz) {
        region = getBundeslandFromPLZ(d.plz);
      } else if (country !== 'Deutschland') {
        region = d.ort || country;
      } else {
        region = d.ort || 'Unbekannt';
      }
      regionDistribution[region] = (regionDistribution[region] || 0) + 1;
    });

    // Monatliche Entwicklung (letzte 12 Monate)
    const monthlyGrowth = [];
    for (let i = 11; i >= 0; i--) {
      const month = new Date(thisYear, thisMonth - i, 1);
      const monthDojos = dojos.filter(d => {
        if (!d.created_at) return false;
        const created = new Date(d.created_at);
        return created <= month;
      }).length;
      monthlyGrowth.push({
        month: month.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
        count: monthDojos,
        new: dojos.filter(d => {
          if (!d.created_at) return false;
          const created = new Date(d.created_at);
          return created.getMonth() === month.getMonth() && created.getFullYear() === month.getFullYear();
        }).length
      });
    }

    // Trial-Status
    const expiredTrials = dojos.filter(d => {
      const plan = getPlan(d);
      if (plan !== 'trial') return false;
      const trialEnd = getTrialEnd(d);
      if (!trialEnd) return false;
      return new Date(trialEnd) < now;
    }).length;

    const expiringTrials = dojos.filter(d => {
      const plan = getPlan(d);
      if (plan !== 'trial') return false;
      const trialEnd = getTrialEnd(d);
      if (!trialEnd) return false;
      const daysLeft = Math.ceil((new Date(trialEnd) - now) / (1000 * 60 * 60 * 24));
      return daysLeft > 0 && daysLeft <= 7;
    }).length;

    // Aktive Trials (nicht abgelaufen, nicht bald ablaufend)
    const activeTrials = dojos.filter(d => {
      const plan = getPlan(d);
      if (plan !== 'trial') return false;
      const trialEnd = getTrialEnd(d);
      if (!trialEnd) return true; // Kein Enddatum = aktiv
      const daysLeft = Math.ceil((new Date(trialEnd) - now) / (1000 * 60 * 60 * 24));
      return daysLeft > 7;
    }).length;

    // MRR (Monthly Recurring Revenue) - basierend auf tatsächlichen Preisen oder Plan-Defaults
    const mrr = dojos.reduce((sum, d) => {
      const plan = getPlan(d);
      // Wenn monthly_price gesetzt ist, diesen verwenden
      if (d.monthly_price && d.monthly_price > 0) {
        return sum + d.monthly_price;
      }
      // Sonst Plan-Default verwenden (nur für aktive/zahlende)
      if (!FREE_PLANS.includes(plan) && getStatus(d) === 'active') {
        return sum + (PLAN_PRICE_VALUES[plan] || 0);
      }
      return sum;
    }, 0);

    // Potenzielle MRR - was alle Dojos zahlen würden (inkl. Trial-Konvertierung)
    // Minimum 49€ pro Dojo (Starter-Plan), außer TDA International (Dojo ID 2)
    const potentialMrr = dojos.reduce((sum, d) => {
      // TDA International (ID 2) ist kostenlos
      if (d.id === 2) return sum;
      const plan = getPlan(d);
      // Wenn monthly_price gesetzt und > 0, diesen verwenden
      if (d.monthly_price && d.monthly_price > 0) {
        return sum + d.monthly_price;
      }
      // Sonst Plan-Preis oder Minimum (Starter = 49€)
      const planPrice = PLAN_PRICE_VALUES[plan] || 0;
      return sum + Math.max(planPrice, 49); // Minimum Starter-Preis
    }, 0);

    // Conversion Rate (Trial/Free zu Paid)
    const convertedTrials = dojos.filter(d => {
      const plan = getPlan(d);
      // Ist jetzt zahlend und war vorher Trial
      return plan && !FREE_PLANS.includes(plan) && d.was_trial;
    }).length;
    const totalTrialsEver = trials + convertedTrials;
    const conversionRate = totalTrialsEver > 0 ? (convertedTrials / totalTrialsEver * 100).toFixed(1) : 0;

    // Wachstumsrate
    const growthRate = newLastMonth > 0
      ? (((newThisMonth - newLastMonth) / newLastMonth) * 100).toFixed(1)
      : newThisMonth > 0 ? 100 : 0;

    // MRR Detail-Aufschlüsselung (für Debugging und Transparenz)
    const mrrDetails = dojos.map(d => {
      const plan = getPlan(d);
      let contribution = 0;
      let reason = '';

      if (d.monthly_price && d.monthly_price > 0) {
        contribution = d.monthly_price;
        reason = `monthly_price: €${d.monthly_price}`;
      } else if (!FREE_PLANS.includes(plan) && getStatus(d) === 'active') {
        contribution = PLAN_PRICE_VALUES[plan] || 0;
        reason = `Plan ${plan}: €${contribution}`;
      } else {
        reason = FREE_PLANS.includes(plan) ? `Kostenloser Plan (${plan})` : `Nicht aktiv (${getStatus(d) || 'kein Status'})`;
      }

      return {
        id: d.id,
        name: d.dojoname,
        plan,
        status: getStatus(d),
        monthly_price: d.monthly_price,
        contribution,
        reason
      };
    }).filter(d => d.contribution > 0);

    // Speicherplatz-Statistiken
    const totalStorageMB = dojos.reduce((sum, d) => sum + (parseFloat(d.storage_mb) || 0), 0);
    const avgStorageMB = total > 0 ? totalStorageMB / total : 0;
    const maxStorageDojo = dojos.reduce((max, d) =>
      (parseFloat(d.storage_mb) || 0) > (parseFloat(max.storage_mb) || 0) ? d : max
    , dojos[0] || {});

    // Ziel-Tracking: 100 Dojos
    const GOAL_DOJOS = 100;
    const goalProgress = (total / GOAL_DOJOS * 100).toFixed(1);
    const dojosToGoal = GOAL_DOJOS - total;

    // Durchschnittliches monatliches Wachstum berechnen
    // Zuerst: Wachstum der letzten 6 Monate
    const recentMonths = monthlyGrowth.slice(-6);
    let avgMonthlyGrowth = recentMonths.reduce((sum, m) => sum + m.new, 0) / recentMonths.length;

    // Fallback: Wenn kein Wachstum in den letzten 6 Monaten, berechne historisches Wachstum
    if (avgMonthlyGrowth === 0 && total > 0) {
      // Finde das älteste Dojo
      const oldestDojo = dojos.reduce((oldest, d) => {
        if (!d.created_at) return oldest;
        if (!oldest || new Date(d.created_at) < new Date(oldest.created_at)) return d;
        return oldest;
      }, null);

      if (oldestDojo && oldestDojo.created_at) {
        const firstDojoDate = new Date(oldestDojo.created_at);
        const monthsSinceFirst = Math.max(1, Math.ceil((now - firstDojoDate) / (1000 * 60 * 60 * 24 * 30)));
        avgMonthlyGrowth = total / monthsSinceFirst;
      }
    }

    // Geschätzte Monate bis zum Ziel
    const monthsToGoal = avgMonthlyGrowth > 0 ? Math.ceil(dojosToGoal / avgMonthlyGrowth) : null;
    const estimatedGoalDate = monthsToGoal
      ? new Date(now.getFullYear(), now.getMonth() + monthsToGoal, 1)
      : null;

    return {
      total,
      active,
      trials,
      free,
      paid,
      totalMembers,
      newThisMonth,
      newLastMonth,
      planDistribution,
      countryDistribution,
      regionDistribution,
      monthlyGrowth,
      expiredTrials,
      expiringTrials,
      activeTrials,
      mrr,
      potentialMrr,
      mrrDetails,
      conversionRate,
      growthRate,
      // Storage
      totalStorageMB,
      avgStorageMB,
      maxStorageDojo,
      // Goal Tracking
      goalDojos: GOAL_DOJOS,
      goalProgress,
      dojosToGoal,
      avgMonthlyGrowth,
      monthsToGoal,
      estimatedGoalDate
    };
  }, [dojos]);

  // Filter dojos
  const filteredDojos = dojos.filter(d => {
    const query = searchQuery.toLowerCase();
    return (
      (d.dojoname || '').toLowerCase().includes(query) ||
      (d.email || '').toLowerCase().includes(query) ||
      (d.inhaber || '').toLowerCase().includes(query) ||
      (d.subdomain || '').toLowerCase().includes(query)
    );
  });

  // Health Check / Fehleranalyse pro Dojo
  const getDojoHealthCheck = (dojo) => {
    const issues = [];
    const warnings = [];
    const info = [];

    // Kritische Fehler
    if (!dojo.email) issues.push({ type: 'error', message: 'Keine E-Mail-Adresse' });
    if (!dojo.inhaber) issues.push({ type: 'error', message: 'Kein Inhaber angegeben' });
    if (!dojo.subdomain) issues.push({ type: 'error', message: 'Keine Subdomain' });

    // Trial-Status prüfen
    const plan = dojo.ds_plan_type || dojo.subscription_plan || dojo.plan_type || 'trial';
    const trialEnd = dojo.ds_trial_ends_at || dojo.trial_ends_at;
    if (plan === 'trial' && trialEnd) {
      const daysLeft = Math.ceil((new Date(trialEnd) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) {
        issues.push({ type: 'error', message: `Trial abgelaufen seit ${Math.abs(daysLeft)} Tagen` });
      } else if (daysLeft <= 7) {
        warnings.push({ type: 'warning', message: `Trial endet in ${daysLeft} Tagen` });
      }
    }

    // Warnungen
    if ((dojo.mitglieder_count || 0) === 0) info.push({ type: 'info', message: 'Keine Mitglieder angelegt' });
    if (!dojo.plz && !dojo.ort) info.push({ type: 'info', message: 'Keine Adresse hinterlegt' });
    if (!dojo.telefon) info.push({ type: 'info', message: 'Keine Telefonnummer' });

    // Speicherplatz-Warnung (> 500 MB)
    const storageMB = parseFloat(dojo.storage_mb) || 0;
    if (storageMB > 500) {
      warnings.push({ type: 'warning', message: `Hoher Speicherverbrauch: ${storageMB.toFixed(0)} MB` });
    }

    // Status berechnen
    const status = issues.length > 0 ? 'critical' : warnings.length > 0 ? 'warning' : 'healthy';
    const score = Math.max(0, 100 - (issues.length * 30) - (warnings.length * 10) - (info.length * 2));

    return {
      status,
      score,
      issues,
      warnings,
      info,
      allProblems: [...issues, ...warnings, ...info]
    };
  };

  // Dojos mit Health-Status anreichern
  const dojosWithHealth = useMemo(() => {
    return dojos.map(d => ({
      ...d,
      health: getDojoHealthCheck(d)
    }));
  }, [dojos]);

  // Health-Übersicht für Statistiken
  const healthOverview = useMemo(() => {
    const healthy = dojosWithHealth.filter(d => d.health.status === 'healthy').length;
    const warning = dojosWithHealth.filter(d => d.health.status === 'warning').length;
    const critical = dojosWithHealth.filter(d => d.health.status === 'critical').length;
    const avgScore = dojosWithHealth.length > 0
      ? dojosWithHealth.reduce((sum, d) => sum + d.health.score, 0) / dojosWithHealth.length
      : 100;

    return { healthy, warning, critical, avgScore };
  }, [dojosWithHealth]);

  const getPlanBadge = (plan) => {
    const color = PLAN_COLORS[plan] || PLAN_COLORS.trial;
    return (
      <span className="plan-badge" style={{ backgroundColor: `${color}20`, color }}>
        {(plan || 'trial').toUpperCase()}
      </span>
    );
  };

  const getStatusBadge = (dojo) => {
    const plan = dojo.subscription_plan || dojo.plan_type || 'trial';
    const isTrial = plan === 'trial';
    const isActive = dojo.subscription_status === 'active' || dojo.ist_aktiv;

    if (isTrial) {
      const trialEnd = dojo.trial_ends_at;
      const daysLeft = trialEnd
        ? Math.ceil((new Date(trialEnd) - new Date()) / (1000 * 60 * 60 * 24))
        : 0;

      if (daysLeft <= 0) {
        return <span className="status-badge expired"><XCircle size={12} /> Abgelaufen</span>;
      }
      if (daysLeft <= 7) {
        return <span className="status-badge warning"><AlertTriangle size={12} /> {daysLeft}d</span>;
      }
      return <span className="status-badge trial"><Clock size={12} /> {daysLeft}d Trial</span>;
    }

    if (isActive) {
      return <span className="status-badge active"><CheckCircle size={12} /> Aktiv</span>;
    }

    return <span className="status-badge inactive"><XCircle size={12} /> Inaktiv</span>;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE');
  };

  const getRegistrationUrl = (dojo) => {
    const subdomain = dojo.subdomain || dojo.slug;
    if (!subdomain) return null;
    return `https://${subdomain}.dojo.tda-intl.org`;
  };

  return (
    <div className="dojo-lizenzverwaltung">
      {/* Header */}
      <div className="lizenz-header">
        <div className="header-content">
          <h1><Shield size={28} /> Software-Lizenzverwaltung</h1>
          <p>Verwalte DojoSoftware-Lizenzen, Pläne und Features</p>
        </div>
        <button className="btn-refresh" onClick={loadDojos} disabled={loading}>
          <RefreshCw size={18} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`message-banner ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="lizenz-tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Übersicht
        </button>
        <button
          className={`tab ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          Alle Dojos ({dojos.length})
        </button>
        <button
          className={`tab ${activeTab === 'plans' ? 'active' : ''}`}
          onClick={() => setActiveTab('plans')}
        >
          Pläne
        </button>
        <button
          className={`tab ${activeTab === 'statistics' ? 'active' : ''}`}
          onClick={() => setActiveTab('statistics')}
        >
          Statistiken
        </button>
        <button
          className={`tab ${activeTab === 'features' ? 'active' : ''}`}
          onClick={() => setActiveTab('features')}
        >
          Features ({allFeatures.length})
        </button>
        <button
          className={`tab ${activeTab === 'vergleich' ? 'active' : ''}`}
          onClick={() => { setActiveTab('vergleich'); loadComparisonData(); }}
        >
          Vergleich
        </button>
        <button
          className={`tab ${activeTab === 'trials' ? 'active' : ''}`}
          onClick={() => { setActiveTab('trials'); loadFeatureTrials(); }}
        >
          Feature-Trials
        </button>
        <button
          className={`tab ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => { setActiveTab('audit'); loadAuditLogs(); }}
        >
          Audit-Log
        </button>
        <button
          className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => { setActiveTab('settings'); loadSaasSettings(); }}
        >
          <Settings size={16} style={{ marginRight: 4 }} />
          Einstellungen
        </button>
        {selectedDojo && (
          <button
            className={`tab ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            {selectedDojo.dojoname}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="lizenz-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-tab">
            {/* Haupt-KPIs */}
            <div className="stats-grid stats-grid-6">
              <div className="stat-card">
                <div className="stat-icon"><Building2 size={24} /></div>
                <div className="stat-info">
                  <div className="stat-value">{stats.total}</div>
                  <div className="stat-label">Dojos gesamt</div>
                </div>
              </div>
              <div className="stat-card active">
                <div className="stat-icon"><CheckCircle size={24} /></div>
                <div className="stat-info">
                  <div className="stat-value">{stats.active}</div>
                  <div className="stat-label">Aktive Lizenzen</div>
                </div>
              </div>
              <div className="stat-card trial">
                <div className="stat-icon"><Clock size={24} /></div>
                <div className="stat-info">
                  <div className="stat-value">{stats.trials}</div>
                  <div className="stat-label">Trial-Accounts</div>
                </div>
              </div>
              <div className="stat-card free">
                <div className="stat-icon"><Users size={24} /></div>
                <div className="stat-info">
                  <div className="stat-value">{stats.free}</div>
                  <div className="stat-label">Free-Accounts</div>
                </div>
              </div>
              <div className="stat-card paid">
                <div className="stat-icon"><CreditCard size={24} /></div>
                <div className="stat-info">
                  <div className="stat-value">{stats.paid}</div>
                  <div className="stat-label">Zahlende Kunden</div>
                </div>
              </div>
              <div className="stat-card members">
                <div className="stat-icon"><Users size={24} /></div>
                <div className="stat-info">
                  <div className="stat-value">{stats.totalMembers.toLocaleString('de-DE')}</div>
                  <div className="stat-label">Mitglieder gesamt</div>
                </div>
              </div>
              <div className="stat-card revenue">
                <div className="stat-icon"><DollarSign size={24} /></div>
                <div className="stat-info">
                  <div className="stat-value">€{stats.potentialMrr.toLocaleString('de-DE')}</div>
                  <div className="stat-label">Potenzielle MRR</div>
                  {stats.mrr !== stats.potentialMrr && (
                    <div className="stat-sublabel">(Aktuell: €{stats.mrr.toLocaleString('de-DE')})</div>
                  )}
                </div>
              </div>
            </div>

            {/* Wachstum & Trends */}
            <div className="overview-row">
              <div className="overview-card growth-card">
                <h3><TrendingUp size={18} /> Wachstum</h3>
                <div className="growth-stats">
                  <div className="growth-item">
                    <div className="growth-value">
                      <UserPlus size={20} />
                      <span>{stats.newThisMonth}</span>
                    </div>
                    <div className="growth-label">Neue Dojos diesen Monat</div>
                  </div>
                  <div className="growth-item">
                    <div className="growth-value">
                      <Activity size={20} />
                      <span className={Number(stats.growthRate) >= 0 ? 'positive' : 'negative'}>
                        {Number(stats.growthRate) >= 0 ? '+' : ''}{stats.growthRate}%
                      </span>
                    </div>
                    <div className="growth-label">vs. Vormonat ({stats.newLastMonth})</div>
                  </div>
                  <div className="growth-item">
                    <div className="growth-value">
                      <Target size={20} />
                      <span>{stats.conversionRate}%</span>
                    </div>
                    <div className="growth-label">Trial → Paid Rate</div>
                  </div>
                </div>
              </div>

              <div className="overview-card alerts-card">
                <h3><AlertTriangle size={18} /> Handlungsbedarf</h3>
                <div className="alerts-list">
                  {stats.expiringTrials > 0 && (
                    <div className="alert-item warning">
                      <Clock size={16} />
                      <span>{stats.expiringTrials} Trial(s) laufen in 7 Tagen ab</span>
                    </div>
                  )}
                  {stats.expiredTrials > 0 && (
                    <div className="alert-item danger">
                      <XCircle size={16} />
                      <span>{stats.expiredTrials} Trial(s) bereits abgelaufen</span>
                    </div>
                  )}
                  {stats.expiringTrials === 0 && stats.expiredTrials === 0 && (
                    <div className="alert-item success">
                      <CheckCircle size={16} />
                      <span>Keine dringenden Aktionen erforderlich</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Neueste Dojos */}
            <div className="recent-section">
              <h3>Neueste Dojos</h3>
              <div className="recent-list">
                {dojos
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .slice(0, 5)
                  .map(dojo => (
                  <div
                    key={dojo.id}
                    className="recent-item"
                    onClick={() => handleSelectDojo(dojo)}
                  >
                    <div className="item-main">
                      <span className="item-name">{dojo.dojoname}</span>
                      <span className="item-info">
                        {dojo.subdomain && <><Globe size={12} /> {dojo.subdomain}.dojo.tda-intl.org • </>}
                        {dojo.mitglieder_count || 0} Mitglieder
                      </span>
                    </div>
                    <div className="item-badges">
                      {getPlanBadge(dojo.subscription_plan || dojo.plan_type)}
                      {getStatusBadge(dojo)}
                    </div>
                    <ChevronRight size={16} className="item-arrow" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === 'statistics' && (
          <div className="statistics-tab">
            {/* KPI Overview */}
            <div className="stats-section">
              <h3><BarChart3 size={20} /> Kennzahlen-Übersicht</h3>
              <div className="kpi-grid">
                <div className="kpi-card large">
                  <div className="kpi-header">
                    <span className="kpi-title">Dojos gesamt</span>
                    <Building2 size={24} className="kpi-icon" />
                  </div>
                  <div className="kpi-value">{stats.total}</div>
                  <div className="kpi-change positive">
                    <ArrowUpRight size={14} />
                    +{stats.newThisMonth} diesen Monat
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-header">
                    <span className="kpi-title">Mitglieder</span>
                    <Users size={20} className="kpi-icon" />
                  </div>
                  <div className="kpi-value">{stats.totalMembers.toLocaleString('de-DE')}</div>
                  <div className="kpi-subtitle">über alle Dojos</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-header">
                    <span className="kpi-title">Ø Mitglieder/Dojo</span>
                    <Users size={20} className="kpi-icon" />
                  </div>
                  <div className="kpi-value">
                    {stats.total > 0 ? Math.round(stats.totalMembers / stats.total) : 0}
                  </div>
                  <div className="kpi-subtitle">Durchschnitt</div>
                </div>

                <div className="kpi-card revenue">
                  <div className="kpi-header">
                    <span className="kpi-title">Potenzielle MRR</span>
                    <DollarSign size={20} className="kpi-icon" />
                  </div>
                  <div className="kpi-value">€{stats.potentialMrr.toLocaleString('de-DE')}</div>
                  <div className="kpi-subtitle">
                    {stats.mrr > 0 ? `Aktuell: €${stats.mrr}` : 'Nach Trial-Konvertierung'}
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-header">
                    <span className="kpi-title">ARR (Prognose)</span>
                    <TrendingUp size={20} className="kpi-icon" />
                  </div>
                  <div className="kpi-value">€{(stats.potentialMrr * 12).toLocaleString('de-DE')}</div>
                  <div className="kpi-subtitle">Annual Recurring Revenue</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-header">
                    <span className="kpi-title">Conversion Rate</span>
                    <Target size={20} className="kpi-icon" />
                  </div>
                  <div className="kpi-value">{stats.conversionRate}%</div>
                  <div className="kpi-subtitle">Trial → Paid</div>
                </div>
              </div>
            </div>

            {/* Entwicklung - Wachstumskurve */}
            <div className="stats-section">
              <h3><Activity size={20} /> Entwicklung (letzte 12 Monate)</h3>
              <div className="chart-container">
                <div className="bar-chart">
                  {stats.monthlyGrowth.map((month, idx) => {
                    const maxCount = Math.max(...stats.monthlyGrowth.map(m => m.count), 1);
                    const heightPercent = (month.count / maxCount) * 100;
                    return (
                      <div key={idx} className="bar-item">
                        <div className="bar-wrapper">
                          <div
                            className="bar"
                            style={{ height: `${heightPercent}%` }}
                          >
                            <span className="bar-value">{month.count}</span>
                          </div>
                          {month.new > 0 && (
                            <span className="bar-new">+{month.new}</span>
                          )}
                        </div>
                        <span className="bar-label">{month.month}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Plan-Verteilung */}
            <div className="stats-row">
              <div className="stats-section half">
                <h3><PieChart size={20} /> Plan-Verteilung</h3>
                <div className="plan-distribution">
                  {Object.entries(stats.planDistribution).map(([plan, count]) => {
                    const percent = stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) : 0;
                    return (
                      <div key={plan} className="distribution-item">
                        <div className="distribution-header">
                          <span className="distribution-label" style={{ color: PLAN_COLORS[plan] }}>
                            {PLAN_NAMES[plan]}
                          </span>
                          <span className="distribution-count">{count} ({percent}%)</span>
                        </div>
                        <div className="distribution-bar-bg">
                          <div
                            className="distribution-bar"
                            style={{
                              width: `${percent}%`,
                              backgroundColor: PLAN_COLORS[plan]
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="stats-section half">
                <h3><Target size={20} /> Trial-Status</h3>
                <div className="trial-stats">
                  <div className="trial-stat-item active">
                    <div className="trial-stat-icon"><Clock size={20} /></div>
                    <div className="trial-stat-info">
                      <span className="trial-stat-value">{stats.activeTrials}</span>
                      <span className="trial-stat-label">Aktive Trials (&gt;7 Tage)</span>
                    </div>
                  </div>
                  <div className="trial-stat-item warning">
                    <div className="trial-stat-icon"><AlertTriangle size={20} /></div>
                    <div className="trial-stat-info">
                      <span className="trial-stat-value">{stats.expiringTrials}</span>
                      <span className="trial-stat-label">Laufen bald ab (≤7 Tage)</span>
                    </div>
                  </div>
                  <div className="trial-stat-item danger">
                    <div className="trial-stat-icon"><XCircle size={20} /></div>
                    <div className="trial-stat-info">
                      <span className="trial-stat-value">{stats.expiredTrials}</span>
                      <span className="trial-stat-label">Abgelaufen</span>
                    </div>
                  </div>
                  <div className="trial-stat-item success">
                    <div className="trial-stat-icon"><CheckCircle size={20} /></div>
                    <div className="trial-stat-info">
                      <span className="trial-stat-value">{stats.paid}</span>
                      <span className="trial-stat-label">Zahlende Kunden</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Geografie - Länder & Regionen */}
            <div className="stats-section">
              <h3><MapPin size={20} /> Geografische Verteilung</h3>
              <div className="geo-grid">
                {/* Länder */}
                <div className="geo-card">
                  <h4><Globe size={16} /> Nach Land</h4>
                  <div className="geo-list">
                    {Object.entries(stats.countryDistribution)
                      .sort((a, b) => b[1] - a[1])
                      .map(([country, count]) => {
                        const percent = stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) : 0;
                        const flagEmoji = country === 'Deutschland' ? '🇩🇪' :
                                         country === 'Österreich' ? '🇦🇹' :
                                         country === 'Schweiz' ? '🇨🇭' :
                                         country === 'Italien' ? '🇮🇹' :
                                         country === 'USA' ? '🇺🇸' :
                                         country === 'Frankreich' ? '🇫🇷' :
                                         country === 'Spanien' ? '🇪🇸' :
                                         country === 'Niederlande' ? '🇳🇱' :
                                         country === 'Belgien' ? '🇧🇪' :
                                         country === 'Polen' ? '🇵🇱' : '🌍';
                        return (
                          <div key={country} className="geo-item">
                            <div className="geo-item-left">
                              <span className="geo-flag">{flagEmoji}</span>
                              <span className="geo-name">{country}</span>
                            </div>
                            <div className="geo-item-right">
                              <span className="geo-count">{count}</span>
                              <span className="geo-percent">{percent}%</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Regionen/Bundesländer */}
                <div className="geo-card">
                  <h4><MapPin size={16} /> Nach Region / Bundesland</h4>
                  <div className="geo-list scrollable">
                    {Object.entries(stats.regionDistribution)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 15)
                      .map(([region, count]) => {
                        const percent = stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) : 0;
                        return (
                          <div key={region} className="geo-item">
                            <div className="geo-item-left">
                              <span className="geo-name">{region}</span>
                            </div>
                            <div className="geo-item-right">
                              <div className="geo-bar-mini" style={{ width: `${Math.min(percent * 2, 100)}%` }} />
                              <span className="geo-count">{count}</span>
                              <span className="geo-percent">{percent}%</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>

            {/* Ziel-Tracking: 100 Dojos */}
            <div className="stats-section goal-section">
              <h3><Flag size={20} /> Ziel: {stats.goalDojos} Dojos</h3>
              <div className="goal-card">
                <div className="goal-progress-container">
                  <div className="goal-numbers">
                    <span className="goal-current">{stats.total}</span>
                    <span className="goal-separator">/</span>
                    <span className="goal-target">{stats.goalDojos}</span>
                  </div>
                  <div className="goal-progress-bar">
                    <div
                      className="goal-progress-fill"
                      style={{ width: `${Math.min(stats.goalProgress, 100)}%` }}
                    />
                  </div>
                  <div className="goal-progress-info">
                    <span className="goal-percent">{stats.goalProgress}%</span>
                    <span className="goal-remaining">Noch {stats.dojosToGoal} Dojos</span>
                  </div>
                </div>
                <div className="goal-eta">
                  {stats.monthsToGoal ? (
                    <>
                      <div className="eta-label">Geschätzte Erreichung:</div>
                      <div className="eta-value">
                        {stats.estimatedGoalDate?.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                      </div>
                      <div className="eta-detail">
                        (~{stats.monthsToGoal} Monate bei Ø {stats.avgMonthlyGrowth.toFixed(1)} Dojos/Monat)
                      </div>
                    </>
                  ) : (
                    <div className="eta-warning">
                      <AlertTriangle size={16} />
                      <span>Kein Wachstum erkennbar - ETA kann nicht berechnet werden</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* MRR Details */}
            <div className="stats-section">
              <h3><DollarSign size={20} /> MRR Aufschlüsselung</h3>
              {stats.mrrDetails.length > 0 ? (
                <div className="mrr-details">
                  <div className="mrr-summary">
                    <div className="mrr-total-card highlight">
                      <span className="mrr-total-value">€{stats.potentialMrr.toLocaleString('de-DE')}</span>
                      <span className="mrr-total-label">Potenzielle MRR</span>
                    </div>
                    <div className="mrr-total-card">
                      <span className="mrr-total-value">€{stats.mrr.toLocaleString('de-DE')}</span>
                      <span className="mrr-total-label">Aktuell zahlend</span>
                    </div>
                    <div className="mrr-count-card">
                      <span className="mrr-count-value">{stats.total - 1}</span>
                      <span className="mrr-count-label">Zahlungspfl. Dojos</span>
                    </div>
                    <div className="mrr-avg-card">
                      <span className="mrr-avg-value">
                        €{(stats.total - 1) > 0
                          ? (stats.potentialMrr / (stats.total - 1)).toFixed(0)
                          : '0'}
                      </span>
                      <span className="mrr-avg-label">Ø pro Dojo</span>
                    </div>
                  </div>
                  <div className="mrr-list">
                    <table className="mrr-table">
                      <thead>
                        <tr>
                          <th>Dojo</th>
                          <th>Plan</th>
                          <th>Beitrag</th>
                          <th>Quelle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.mrrDetails.map(d => (
                          <tr key={d.id}>
                            <td>{d.name}</td>
                            <td>
                              <span className="plan-badge-mini" style={{ backgroundColor: `${PLAN_COLORS[d.plan]}20`, color: PLAN_COLORS[d.plan] }}>
                                {d.plan.toUpperCase()}
                              </span>
                            </td>
                            <td className="mrr-amount">€{d.contribution.toLocaleString('de-DE')}</td>
                            <td className="mrr-reason">{d.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="mrr-empty">
                  <Info size={24} />
                  <p>Aktuell keine zahlenden Dojos.</p>
                  <p className="mrr-empty-hint">Alle Dojos sind auf kostenlosen Plänen (Trial, Basic, Free).</p>
                </div>
              )}
            </div>

            {/* Speicherplatz */}
            <div className="stats-section">
              <h3><HardDrive size={20} /> Speicherplatz-Nutzung</h3>
              <div className="storage-grid">
                <div className="storage-card total">
                  <Server size={24} />
                  <div className="storage-info">
                    <span className="storage-value">{stats.totalStorageMB.toFixed(2)} MB</span>
                    <span className="storage-label">Gesamt auf Server</span>
                  </div>
                </div>
                <div className="storage-card average">
                  <BarChart3 size={24} />
                  <div className="storage-info">
                    <span className="storage-value">{stats.avgStorageMB.toFixed(2)} MB</span>
                    <span className="storage-label">Durchschnitt pro Dojo</span>
                  </div>
                </div>
                <div className="storage-card max">
                  <TrendingUp size={24} />
                  <div className="storage-info">
                    <span className="storage-value">{parseFloat(stats.maxStorageDojo?.storage_mb || 0).toFixed(2)} MB</span>
                    <span className="storage-label">Größter Nutzer: {stats.maxStorageDojo?.dojoname || '-'}</span>
                  </div>
                </div>
              </div>
              <div className="storage-list">
                <h4>Speicherverbrauch pro Dojo (geschätzt basierend auf Datensätzen)</h4>
                <div className="storage-bars">
                  {[...dojos]
                    .sort((a, b) => (parseFloat(b.storage_mb) || 0) - (parseFloat(a.storage_mb) || 0))
                    .slice(0, 10)
                    .map(d => {
                      const storageMB = parseFloat(d.storage_mb) || 0;
                      const storageKB = d.storage_kb || 0;
                      const maxStorage = parseFloat(stats.maxStorageDojo?.storage_mb) || 1;
                      const percent = (storageMB / Math.max(maxStorage, 1)) * 100;
                      const details = d.storage_details || {};

                      // Tooltip-Inhalt für Aufschlüsselung
                      const tooltipLines = Object.entries(details)
                        .filter(([, v]) => v.count > 0)
                        .map(([key, v]) => `${key}: ${v.count} (${v.size_kb.toFixed(1)} KB)`)
                        .join('\n');

                      return (
                        <div key={d.id} className="storage-bar-item" title={tooltipLines || 'Keine Daten'}>
                          <span className="storage-bar-name">{d.dojoname}</span>
                          <div className="storage-bar-track">
                            <div
                              className={`storage-bar-fill ${storageMB > 500 ? 'warning' : storageMB > 100 ? 'medium' : ''}`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="storage-bar-value">
                            {storageKB >= 1024 ? `${storageMB.toFixed(1)} MB` : `${storageKB} KB`}
                          </span>
                          {details.mitglieder && (
                            <span className="storage-bar-details">
                              ({details.mitglieder?.count || 0} Mitgl.)
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Health / Fehleranalyse */}
            <div className="stats-section">
              <h3><Heart size={20} /> System-Gesundheit</h3>
              <div className="health-overview">
                <div className="health-card healthy">
                  <CheckCircle2 size={24} />
                  <div className="health-info">
                    <span className="health-value">{healthOverview.healthy}</span>
                    <span className="health-label">Gesund</span>
                  </div>
                </div>
                <div className="health-card warning">
                  <AlertTriangle size={24} />
                  <div className="health-info">
                    <span className="health-value">{healthOverview.warning}</span>
                    <span className="health-label">Warnungen</span>
                  </div>
                </div>
                <div className="health-card critical">
                  <AlertCircle size={24} />
                  <div className="health-info">
                    <span className="health-value">{healthOverview.critical}</span>
                    <span className="health-label">Kritisch</span>
                  </div>
                </div>
                <div className="health-card score">
                  <Activity size={24} />
                  <div className="health-info">
                    <span className="health-value">{healthOverview.avgScore.toFixed(0)}%</span>
                    <span className="health-label">Ø Score</span>
                  </div>
                </div>
              </div>

              {/* Problematische Dojos */}
              {(healthOverview.critical > 0 || healthOverview.warning > 0) && (
                <div className="health-issues">
                  <h4>Dojos mit Problemen</h4>
                  <div className="health-issues-list">
                    {dojosWithHealth
                      .filter(d => d.health.status !== 'healthy')
                      .sort((a, b) => a.health.score - b.health.score)
                      .slice(0, 10)
                      .map(d => (
                        <div key={d.id} className={`health-issue-item ${d.health.status}`}>
                          <div className="health-issue-header">
                            <span className="health-issue-name">{d.dojoname}</span>
                            <span className={`health-score-badge ${d.health.status}`}>
                              {d.health.score}%
                            </span>
                          </div>
                          <div className="health-issue-problems">
                            {d.health.allProblems.slice(0, 3).map((p, idx) => (
                              <span key={idx} className={`health-problem ${p.type}`}>
                                {p.type === 'error' && <XCircle size={12} />}
                                {p.type === 'warning' && <AlertTriangle size={12} />}
                                {p.type === 'info' && <Info size={12} />}
                                {p.message}
                              </span>
                            ))}
                            {d.health.allProblems.length > 3 && (
                              <span className="health-more">+{d.health.allProblems.length - 3} weitere</span>
                            )}
                          </div>
                          <button
                            className="btn-sm btn-view"
                            onClick={() => handleSelectDojo(d)}
                          >
                            Details
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Prognose */}
            <div className="stats-section">
              <h3><TrendingUp size={20} /> Prognose (nächste 6 Monate)</h3>
              <div className="forecast-grid">
                {[1, 2, 3, 4, 5, 6].map(month => {
                  // Wachstum: mindestens 0.5 Dojos/Monat wenn es Dojos gibt
                  const avgGrowth = stats.avgMonthlyGrowth || stats.newThisMonth || (stats.total > 0 ? 0.5 : 0);
                  const projected = Math.round(stats.total + (avgGrowth * month));
                  // MRR Prognose: Potenzielle MRR + neue Dojos * Durchschnittspreis
                  const avgMrrPerDojo = (stats.total - 1) > 0 ? stats.potentialMrr / (stats.total - 1) : 49;
                  const projectedNewPaid = Math.round(avgGrowth * month);
                  const projectedMrr = Math.round(stats.potentialMrr + (projectedNewPaid * avgMrrPerDojo));
                  const monthName = new Date(new Date().setMonth(new Date().getMonth() + month))
                    .toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });

                  return (
                    <div key={month} className="forecast-item">
                      <div className="forecast-month">{monthName}</div>
                      <div className="forecast-value">{projected} Dojos</div>
                      <div className="forecast-mrr">€{projectedMrr.toLocaleString('de-DE')} MRR</div>
                    </div>
                  );
                })}
              </div>
              <p className="forecast-note">
                * Basierend auf {stats.total} Dojos × Ø €{((stats.total - 1) > 0 ? stats.potentialMrr / (stats.total - 1) : 49).toFixed(0)}/Dojo
                {stats.avgMonthlyGrowth > 0 && ` + Wachstum ${stats.avgMonthlyGrowth.toFixed(1)} Dojos/Monat`}
              </p>
            </div>
          </div>
        )}

        {/* List Tab */}
        {activeTab === 'list' && (
          <div className="list-tab">
            <div className="list-header-row">
              <div className="search-bar">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Dojo, Subdomain oder E-Mail suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="btn-export" onClick={handleExportCSV}>
                <Download size={16} /> CSV Export
              </button>
            </div>

            {loading ? (
              <div className="loading-state">Laden...</div>
            ) : (
              <div className="dojos-table">
                <table>
                  <thead>
                    <tr>
                      <th>Dojo</th>
                      <th>Subdomain</th>
                      <th>Plan</th>
                      <th>Mitglieder</th>
                      <th>Status</th>
                      <th>Registriert</th>
                      <th>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDojos.map(dojo => {
                      const plan = dojo.subscription_plan || dojo.plan_type || 'trial';
                      const isTrial = plan === 'trial';

                      return (
                        <tr key={dojo.id}>
                          <td className="dojo-cell">
                            <strong>{dojo.dojoname}</strong>
                            <span className="dojo-email">{dojo.email}</span>
                          </td>
                          <td>
                            {dojo.subdomain ? (
                              <a
                                href={`https://${dojo.subdomain}.dojo.tda-intl.org`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="subdomain-link"
                              >
                                <Link size={12} /> {dojo.subdomain}
                              </a>
                            ) : '-'}
                          </td>
                          <td>{getPlanBadge(plan)}</td>
                          <td>{dojo.mitglieder_count || 0}</td>
                          <td>{getStatusBadge(dojo)}</td>
                          <td>{formatDate(dojo.created_at)}</td>
                          <td className="actions-cell">
                            <button
                              className="btn-sm btn-view"
                              onClick={() => handleSelectDojo(dojo)}
                            >
                              Details
                            </button>
                            {isTrial && (
                              <button
                                className="btn-sm btn-extend"
                                onClick={() => handleExtendTrial(dojo.id)}
                              >
                                +14d
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Plans Tab - Kompakt mit allen 7 Plänen */}
        {activeTab === 'plans' && (
          <div className="plans-tab">
            {/* Kompakte Plan-Tabs */}
            <div className="plan-tabs-compact">
              {[
                { key: 'trial', icon: '🎁', name: 'Trial' },
                { key: 'basic', icon: '📦', name: 'Basic' },
                { key: 'free', icon: '🆓', name: 'Free' },
                { key: 'starter', icon: '🚀', name: 'Starter' },
                { key: 'professional', icon: '💼', name: 'Pro' },
                { key: 'premium', icon: '⭐', name: 'Premium' },
                { key: 'enterprise', icon: '🏢', name: 'Enterprise' }
              ].map(plan => {
                const dbPlanInfo = subscriptionPlans.find(p => p.plan_name === plan.key);
                const featureCount = (planFeatures[plan.key] || []).length;
                return (
                  <button
                    key={plan.key}
                    className={`plan-tab-compact ${activePlanTab === plan.key ? 'active' : ''}`}
                    onClick={() => setActivePlanTab(plan.key)}
                    title={`${plan.name} - ${featureCount} Features`}
                  >
                    <span className="ptc-icon">{plan.icon}</span>
                    <span className="ptc-name">{plan.name}</span>
                    <span className="ptc-count">{featureCount}</span>
                  </button>
                );
              })}
            </div>

            {/* Plan Settings Bar */}
            {(() => {
              const dbPlan = subscriptionPlans.find(p => p.plan_name === activePlanTab);
              const currentPrices = editingPlanPrices[activePlanTab] || {
                price_monthly: dbPlan?.price_monthly || 0,
                price_yearly: dbPlan?.price_yearly || 0,
                max_members: dbPlan?.max_members || null,
                is_visible: dbPlan?.is_visible ?? true
              };

              return (
                <div className="plan-settings-bar">
                  <div className="psb-left">
                    <span className="psb-title">{PLAN_NAMES[activePlanTab]}</span>
                    <div className="psb-inputs">
                      <div className="psb-field">
                        <label>Monat</label>
                        <input
                          type="number"
                          min="0"
                          value={currentPrices.price_monthly}
                          onChange={(e) => setEditingPlanPrices(prev => ({
                            ...prev,
                            [activePlanTab]: { ...currentPrices, price_monthly: parseFloat(e.target.value) || 0 }
                          }))}
                        />
                        <span>€</span>
                      </div>
                      <div className="psb-field">
                        <label>Jahr</label>
                        <input
                          type="number"
                          min="0"
                          value={currentPrices.price_yearly}
                          onChange={(e) => setEditingPlanPrices(prev => ({
                            ...prev,
                            [activePlanTab]: { ...currentPrices, price_yearly: parseFloat(e.target.value) || 0 }
                          }))}
                        />
                        <span>€</span>
                      </div>
                      <div className="psb-field">
                        <label>Max</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="∞"
                          value={currentPrices.max_members || ''}
                          onChange={(e) => setEditingPlanPrices(prev => ({
                            ...prev,
                            [activePlanTab]: { ...currentPrices, max_members: e.target.value ? parseInt(e.target.value) : null }
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="psb-right">
                    <button
                      className={`psb-visibility ${currentPrices.is_visible ? 'visible' : 'hidden'}`}
                      onClick={() => setEditingPlanPrices(prev => ({
                        ...prev,
                        [activePlanTab]: { ...currentPrices, is_visible: !currentPrices.is_visible }
                      }))}
                      title={currentPrices.is_visible ? 'Plan ist öffentlich sichtbar' : 'Plan ist versteckt'}
                    >
                      {currentPrices.is_visible ? <Globe size={14} /> : <PowerOff size={14} />}
                      {currentPrices.is_visible ? 'Öffentlich' : 'Versteckt'}
                    </button>
                    {dbPlan && (
                      <button
                        className="psb-save"
                        onClick={() => savePlanPrices(dbPlan.plan_id, PLAN_NAMES[activePlanTab], currentPrices)}
                      >
                        <Check size={14} /> Speichern
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Features Grid - 2-3 pro Zeile */}
            <div className="features-grid-compact">
              {allFeatures.map(feature => {
                const isIncluded = (planFeatures[activePlanTab] || []).includes(feature.id);
                return (
                  <div
                    key={feature.id}
                    className={`feature-card-mini ${isIncluded ? 'included' : 'excluded'}`}
                    onClick={() => {
                      const currentFeatures = planFeatures[activePlanTab] || [];
                      const newFeatures = isIncluded
                        ? currentFeatures.filter(f => f !== feature.id)
                        : [...currentFeatures, feature.id];
                      setPlanFeatures(prev => ({
                        ...prev,
                        [activePlanTab]: newFeatures
                      }));
                    }}
                  >
                    <div className="fcm-header">
                      <span className="fcm-emoji">{feature.emoji}</span>
                      <span className="fcm-name">{feature.label}</span>
                      <span className={`fcm-status ${isIncluded ? 'on' : 'off'}`}>
                        {isIncluded ? <Check size={12} /> : <XCircle size={12} />}
                      </span>
                    </div>
                    <div className="fcm-desc">{feature.description}</div>
                  </div>
                );
              })}
            </div>

            {/* Save Button */}
            <div className="plan-save-bar">
              <span className="psb-info">
                {(planFeatures[activePlanTab] || []).length} von {allFeatures.length} Features aktiv
              </span>
              <button
                className="btn-save-features"
                onClick={async () => {
                  try {
                    const response = await fetchWithAuth(
                      `${config.apiBaseUrl}/admin/subscription-plans/${activePlanTab}/features`,
                      {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ features: planFeatures[activePlanTab] })
                      }
                    );
                    if (response.ok) {
                      setMessage({ type: 'success', text: `Features für ${PLAN_NAMES[activePlanTab]} gespeichert!` });
                    } else {
                      throw new Error('Speichern fehlgeschlagen');
                    }
                  } catch (error) {
                    setMessage({ type: 'error', text: error.message });
                  }
                }}
              >
                <Check size={16} /> Features speichern
              </button>
            </div>
          </div>
        )}

        {/* Features Management Tab - Neu mit Plan-Tabs */}
        {activeTab === 'features' && (
          <div className="features-management-tab">
            <div className="features-header">
              <h3><Settings size={20} /> Feature-Verwaltung</h3>
              <button
                className="btn-add-feature"
                onClick={() => setShowAddFeature(true)}
              >
                <Plus size={16} /> Feature hinzufügen
              </button>
            </div>

            {/* Add Feature Form */}
            {showAddFeature && (
              <div className="add-feature-form">
                <h4>Neues Feature hinzufügen</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Emoji</label>
                    <input
                      type="text"
                      value={newFeature.emoji}
                      onChange={(e) => setNewFeature(prev => ({ ...prev, emoji: e.target.value }))}
                      placeholder="⭐"
                      maxLength={2}
                    />
                  </div>
                  <div className="form-group">
                    <label>ID (eindeutig)</label>
                    <input
                      type="text"
                      value={newFeature.id}
                      onChange={(e) => setNewFeature(prev => ({ ...prev, id: e.target.value }))}
                      placeholder="z.B. whatsapp_integration"
                    />
                  </div>
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      value={newFeature.label}
                      onChange={(e) => setNewFeature(prev => ({ ...prev, label: e.target.value }))}
                      placeholder="z.B. WhatsApp Integration"
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Beschreibung</label>
                    <input
                      type="text"
                      value={newFeature.description}
                      onChange={(e) => setNewFeature(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Kurze Beschreibung des Features..."
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button className="btn-cancel" onClick={() => setShowAddFeature(false)}>Abbrechen</button>
                  <button className="btn-save" onClick={handleAddFeature}>Feature hinzufügen</button>
                </div>
              </div>
            )}

            {/* Edit Feature Form */}
            {editingFeature && (
              <div className="add-feature-form">
                <h4>Feature bearbeiten</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Emoji</label>
                    <input
                      type="text"
                      value={editingFeature.emoji}
                      onChange={(e) => setEditingFeature(prev => ({ ...prev, emoji: e.target.value }))}
                      maxLength={2}
                    />
                  </div>
                  <div className="form-group">
                    <label>ID</label>
                    <input
                      type="text"
                      value={editingFeature.id}
                      disabled
                    />
                  </div>
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      value={editingFeature.label}
                      onChange={(e) => setEditingFeature(prev => ({ ...prev, label: e.target.value }))}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Beschreibung</label>
                    <input
                      type="text"
                      value={editingFeature.description}
                      onChange={(e) => setEditingFeature(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button className="btn-cancel" onClick={() => setEditingFeature(null)}>Abbrechen</button>
                  <button className="btn-save" onClick={handleSaveEditFeature}>Speichern</button>
                </div>
              </div>
            )}

            {/* Feature-Liste - 3 pro Zeile */}
            <div className="features-grid-compact">
              {allFeatures.map(feature => {
                const isPublic = feature.is_public !== false;
                // Zähle in wie vielen Plänen dieses Feature aktiv ist
                const planCount = Object.values(planFeatures).filter(pf => pf.includes(feature.id)).length;
                return (
                  <div
                    key={feature.id}
                    className="feature-card-mini"
                  >
                    <div className="fcm-header">
                      <span className="fcm-emoji">{feature.emoji}</span>
                      <span className="fcm-name">{feature.label}</span>
                      <span className="fcm-plan-count" title={`In ${planCount} Plänen aktiv`}>
                        {planCount}
                      </span>
                    </div>
                    <div className="fcm-desc">{feature.description}</div>
                    <div className="fcm-id">{feature.id}</div>
                    <div className="fcm-actions">
                      <button
                        className={`fcm-public-btn ${isPublic ? 'visible' : 'hidden'}`}
                        onClick={async () => {
                          const newIsPublic = !isPublic;
                          setAllFeatures(prev => prev.map(f =>
                            f.id === feature.id ? { ...f, is_public: newIsPublic } : f
                          ));
                          // TODO: API-Call zum Speichern
                        }}
                        title={isPublic ? 'Öffentlich auf Landing Page' : 'Versteckt auf Landing Page'}
                      >
                        {isPublic ? <Globe size={12} /> : <PowerOff size={12} />}
                        {isPublic ? 'Öffentlich' : 'Versteckt'}
                      </button>
                      <button
                        className="fcm-edit"
                        onClick={() => handleEditFeature(feature)}
                        title="Bearbeiten"
                      >
                        <Edit size={12} />
                      </button>
                      <button
                        className="fcm-delete"
                        onClick={() => {
                          if (window.confirm(`Feature "${feature.label}" wirklich löschen?`)) {
                            setAllFeatures(prev => prev.filter(f => f.id !== feature.id));
                            // TODO: API-Call zum Löschen
                          }
                        }}
                        title="Löschen"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Vergleich (Comparison) Tab */}
        {activeTab === 'vergleich' && (
          <div className="comparison-management-tab">
            <div className="comparison-header">
              <h3><Target size={20} /> Konkurrenz-Vergleich verwalten</h3>
              <div className="comparison-actions">
                <button className="btn-secondary" onClick={() => setShowAddCompetitor(true)}>
                  <Plus size={16} /> Konkurrent
                </button>
                <button className="btn-secondary" onClick={() => setShowAddCategory(true)}>
                  <Plus size={16} /> Kategorie
                </button>
                <button className="btn-add-feature" onClick={() => setShowAddItem(true)}>
                  <Plus size={16} /> Feature
                </button>
              </div>
            </div>

            <p className="comparison-hint">
              Diese Daten werden auf der öffentlichen Landing Page im Vergleichsbereich angezeigt.
              <br />
              <strong>Bewertungen:</strong> ✓ = Voll unterstützt | ~ = Teilweise | ✗ = Nicht unterstützt
            </p>

            {comparisonLoading ? (
              <div className="loading-state">Lade Vergleichsdaten...</div>
            ) : (
              <>
                {/* Add Competitor Form */}
                {showAddCompetitor && (
                  <div className="add-feature-form">
                    <h4>Neuen Konkurrenten hinzufügen</h4>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Name</label>
                        <input
                          type="text"
                          value={newCompetitor.name}
                          onChange={(e) => setNewCompetitor(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="z.B. Gymdesk"
                        />
                      </div>
                      <div className="form-group">
                        <label>Kurzname</label>
                        <input
                          type="text"
                          value={newCompetitor.short_name}
                          onChange={(e) => setNewCompetitor(prev => ({ ...prev, short_name: e.target.value }))}
                          placeholder="z.B. GD"
                        />
                      </div>
                      <div className="form-group">
                        <label>Website</label>
                        <input
                          type="text"
                          value={newCompetitor.website}
                          onChange={(e) => setNewCompetitor(prev => ({ ...prev, website: e.target.value }))}
                          placeholder="https://gymdesk.com"
                        />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button className="btn-cancel" onClick={() => setShowAddCompetitor(false)}>Abbrechen</button>
                      <button className="btn-save" onClick={handleAddCompetitor}>Hinzufügen</button>
                    </div>
                  </div>
                )}

                {/* Add Category Form */}
                {showAddCategory && (
                  <div className="add-feature-form">
                    <h4>Neue Kategorie hinzufügen</h4>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Icon (Emoji)</label>
                        <input
                          type="text"
                          value={newCategory.icon}
                          onChange={(e) => setNewCategory(prev => ({ ...prev, icon: e.target.value }))}
                          maxLength={2}
                        />
                      </div>
                      <div className="form-group">
                        <label>Name</label>
                        <input
                          type="text"
                          value={newCategory.name}
                          onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="z.B. Finanzen"
                        />
                      </div>
                      <div className="form-group">
                        <label>
                          <input
                            type="checkbox"
                            checked={newCategory.is_highlight}
                            onChange={(e) => setNewCategory(prev => ({ ...prev, is_highlight: e.target.checked }))}
                          />
                          {' '}Highlight-Kategorie
                        </label>
                      </div>
                      {newCategory.is_highlight && (
                        <div className="form-group full-width">
                          <label>Highlight-Notiz</label>
                          <input
                            type="text"
                            value={newCategory.highlight_note}
                            onChange={(e) => setNewCategory(prev => ({ ...prev, highlight_note: e.target.value }))}
                            placeholder="z.B. Einzigartiges Feature!"
                          />
                        </div>
                      )}
                    </div>
                    <div className="form-actions">
                      <button className="btn-cancel" onClick={() => setShowAddCategory(false)}>Abbrechen</button>
                      <button className="btn-save" onClick={handleAddCategory}>Hinzufügen</button>
                    </div>
                  </div>
                )}

                {/* Add Item Form */}
                {showAddItem && (
                  <div className="add-feature-form">
                    <h4>Neues Feature hinzufügen</h4>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Kategorie</label>
                        <select
                          value={newItem.category_id}
                          onChange={(e) => setNewItem(prev => ({ ...prev, category_id: e.target.value }))}
                        >
                          <option value="">-- Kategorie wählen --</option>
                          {comparisonData.categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Feature-Name</label>
                        <input
                          type="text"
                          value={newItem.feature_name}
                          onChange={(e) => setNewItem(prev => ({ ...prev, feature_name: e.target.value }))}
                          placeholder="z.B. SEPA-Lastschrift"
                        />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button className="btn-cancel" onClick={() => setShowAddItem(false)}>Abbrechen</button>
                      <button className="btn-save" onClick={handleAddComparisonItem}>Hinzufügen</button>
                    </div>
                  </div>
                )}

                {/* Competitors Overview */}
                <div className="comparison-competitors">
                  <h4>Konkurrenten ({comparisonData.competitors.length})</h4>
                  <div className="competitors-row">
                    <div className="competitor-badge ours">
                      <strong>DojoSoftware</strong>
                      <span className="badge-us">Wir</span>
                    </div>
                    {comparisonData.competitors.map(comp => (
                      <div key={comp.id} className="competitor-badge">
                        <strong>{comp.name}</strong>
                        <small>{comp.short_name}</small>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Categories with Items */}
                {comparisonData.categories.map(category => {
                  const categoryItems = comparisonData.items.filter(item => item.category_id === category.id);
                  return (
                    <div key={category.id} className={`comparison-category ${category.is_highlight ? 'highlight' : ''}`}>
                      <div className="category-header">
                        <h4>
                          <span className="category-icon">{category.icon}</span>
                          {category.name}
                          {category.is_highlight && <span className="highlight-badge">★</span>}
                          <span className="item-count">({categoryItems.length} Features)</span>
                        </h4>
                        {category.highlight_note && (
                          <span className="highlight-note">{category.highlight_note}</span>
                        )}
                      </div>

                      <table className="comparison-table">
                        <thead>
                          <tr>
                            <th className="feature-col">Feature</th>
                            <th className="rating-col ours">DojoSoftware</th>
                            {comparisonData.competitors.map(comp => (
                              <th key={comp.id} className="rating-col">{comp.short_name}</th>
                            ))}
                            <th className="actions-col">Aktionen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryItems.map(item => (
                            <tr key={item.id}>
                              <td className="feature-col">{item.feature_name}</td>
                              <td className="rating-col ours">
                                {editingItemId === item.id ? (
                                  <select
                                    defaultValue={item.ours}
                                    id={`ours-${item.id}`}
                                    className="rating-select"
                                  >
                                    <option value="full">✓ Voll</option>
                                    <option value="partial">~ Teil</option>
                                    <option value="none">✗ Nein</option>
                                  </select>
                                ) : (
                                  getRatingIcon(item.ours)
                                )}
                              </td>
                              {comparisonData.competitors.map(comp => (
                                <td key={comp.id} className="rating-col">
                                  {editingItemId === item.id ? (
                                    <select
                                      defaultValue={item.competitors[comp.id] || 'none'}
                                      id={`comp-${item.id}-${comp.id}`}
                                      className="rating-select"
                                    >
                                      <option value="full">✓ Voll</option>
                                      <option value="partial">~ Teil</option>
                                      <option value="none">✗ Nein</option>
                                    </select>
                                  ) : (
                                    getRatingIcon(item.competitors[comp.id] || 'none')
                                  )}
                                </td>
                              ))}
                              <td className="actions-col">
                                {editingItemId === item.id ? (
                                  <>
                                    <button
                                      className="btn-icon success"
                                      onClick={() => {
                                        const ours = document.getElementById(`ours-${item.id}`).value;
                                        const competitors = {};
                                        comparisonData.competitors.forEach(comp => {
                                          competitors[comp.id] = document.getElementById(`comp-${item.id}-${comp.id}`).value;
                                        });
                                        handleUpdateRating(item.id, ours, competitors);
                                      }}
                                      title="Speichern"
                                    >
                                      <Check size={14} />
                                    </button>
                                    <button
                                      className="btn-icon"
                                      onClick={() => setEditingItemId(null)}
                                      title="Abbrechen"
                                    >
                                      <X size={14} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      className="btn-icon"
                                      onClick={() => setEditingItemId(item.id)}
                                      title="Bearbeiten"
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button
                                      className="btn-icon danger"
                                      onClick={() => handleDeleteComparisonItem(item.id)}
                                      title="Löschen"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}

                {comparisonData.categories.length === 0 && (
                  <div className="empty-state">
                    <p>Noch keine Vergleichsdaten vorhanden.</p>
                    <p>Füge zunächst Konkurrenten und Kategorien hinzu.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Details Tab */}
        {activeTab === 'details' && selectedDojo && (
          <div className="details-tab">
            <div className="details-header">
              <h2>{selectedDojo.dojoname}</h2>
              <button
                className="btn-back"
                onClick={() => { setSelectedDojo(null); setActiveTab('list'); }}
              >
                Zurück zur Liste
              </button>
            </div>

            <div className="details-grid">
              {/* Info Card */}
              <div className="detail-card">
                <h4><Building2 size={18} /> Dojo-Informationen</h4>
                <div className="info-rows">
                  <div className="info-row">
                    <span>Inhaber</span>
                    <strong>{selectedDojo.inhaber || '-'}</strong>
                  </div>
                  <div className="info-row">
                    <span>E-Mail</span>
                    <strong>{selectedDojo.email || '-'}</strong>
                  </div>
                  <div className="info-row">
                    <span>Mitglieder</span>
                    <strong>{selectedDojo.mitglieder_count || 0}</strong>
                  </div>
                  <div className="info-row">
                    <span>Registriert</span>
                    <strong>{formatDate(selectedDojo.created_at)}</strong>
                  </div>
                </div>
              </div>

              {/* Registration URL Card */}
              <div className="detail-card">
                <h4><Globe size={18} /> Registrierungs-URL</h4>
                <div className="info-rows">
                  <div className="info-row">
                    <span>Subdomain</span>
                    <strong>{selectedDojo.subdomain || selectedDojo.slug || '-'}</strong>
                  </div>
                  {getRegistrationUrl(selectedDojo) && (
                    <>
                      <div className="info-row">
                        <span>URL</span>
                        <strong>
                          <a
                            href={getRegistrationUrl(selectedDojo)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="url-link"
                          >
                            {getRegistrationUrl(selectedDojo)}
                          </a>
                        </strong>
                      </div>
                      <div className="info-row">
                        <span>Registrierung</span>
                        <strong>
                          <a
                            href={`${getRegistrationUrl(selectedDojo)}/registrierung`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="url-link"
                          >
                            /registrierung
                          </a>
                        </strong>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Subscription Card */}
              <div className="detail-card">
                <h4><CreditCard size={18} /> Abonnement</h4>
                <div className="info-rows">
                  <div className="info-row">
                    <span>Aktueller Plan</span>
                    <strong>{getPlanBadge(selectedDojo.subscription_plan || selectedDojo.plan_type)}</strong>
                  </div>
                  <div className="info-row">
                    <span>Status</span>
                    <strong>{getStatusBadge(selectedDojo)}</strong>
                  </div>
                  {(selectedDojo.subscription_plan || selectedDojo.plan_type) === 'trial' && (
                    <div className="info-row">
                      <span>Trial endet</span>
                      <strong>{formatDate(selectedDojo.trial_ends_at)}</strong>
                    </div>
                  )}
                  <div className="info-row">
                    <span>Monatl. Preis</span>
                    <strong>{selectedDojo.monthly_price ? `€${selectedDojo.monthly_price}` : '-'}</strong>
                  </div>
                </div>

                {/* Plan Upgrade Buttons */}
                <div className="plan-actions">
                  <span className="label">Plan ändern:</span>
                  <div className="plan-buttons">
                    {Object.keys(PLAN_HIERARCHY)
                      .filter(p => p !== 'trial')
                      .map(plan => (
                        <button
                          key={plan}
                          className="btn-plan"
                          style={{
                            backgroundColor: `${PLAN_COLORS[plan]}20`,
                            borderColor: PLAN_COLORS[plan],
                            color: PLAN_COLORS[plan]
                          }}
                          onClick={() => handleActivatePlan(selectedDojo.id, plan)}
                        >
                          {plan.charAt(0).toUpperCase() + plan.slice(1)}
                        </button>
                      ))
                    }
                  </div>
                </div>

                {(selectedDojo.subscription_plan || selectedDojo.plan_type) === 'trial' && (
                  <div className="trial-actions">
                    <button
                      className="btn-extend-trial"
                      onClick={() => handleExtendTrial(selectedDojo.id)}
                    >
                      <Clock size={16} /> Trial um 14 Tage verlängern
                    </button>
                  </div>
                )}

                {/* Dojo Aktivierung/Deaktivierung */}
                <div className="dojo-status-actions">
                  <span className="label">Dojo-Status:</span>
                  {selectedDojo.ist_aktiv !== false ? (
                    <button
                      className="btn-deactivate"
                      onClick={() => handleToggleDojoActive(selectedDojo.id, true)}
                    >
                      <PowerOff size={16} /> Dojo deaktivieren
                    </button>
                  ) : (
                    <button
                      className="btn-reactivate"
                      onClick={() => handleToggleDojoActive(selectedDojo.id, false)}
                    >
                      <Power size={16} /> Dojo reaktivieren
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Plan Comparison Matrix */}
            <div className="plan-comparison-section">
              <h4><TrendingUp size={18} /> Plan-Vergleich & Upgrade-Optionen</h4>
              <p className="hint">
                Vergleiche die verfügbaren Pläne. Der aktuelle Plan ist hervorgehoben. Klicke auf einen Plan um zu wechseln.
              </p>

              <div className="plan-comparison-matrix">
                {/* Plan Headers */}
                <div className="plan-headers">
                  <div className="matrix-feature-header">Feature</div>
                  {Object.keys(PLAN_HIERARCHY).map(plan => {
                    const currentPlan = selectedDojo.subscription_plan || selectedDojo.plan_type || 'trial';
                    const isCurrentPlan = plan === currentPlan;
                    const isUpgrade = PLAN_HIERARCHY[plan] > PLAN_HIERARCHY[currentPlan];

                    const dbPlan = subscriptionPlans.find(p => p.plan_name === plan);
                    const priceDisplay = dbPlan?.price_monthly
                      ? `${dbPlan.price_monthly}€/Monat`
                      : PLAN_PRICES[plan];

                    return (
                      <div
                        key={plan}
                        className={`plan-column-header ${isCurrentPlan ? 'current' : ''} ${isUpgrade ? 'upgrade' : ''}`}
                        style={{ borderColor: PLAN_COLORS[plan] }}
                      >
                        <span className="plan-name" style={{ color: PLAN_COLORS[plan] }}>
                          {PLAN_NAMES[plan]}
                        </span>
                        <span className="plan-price-small">{priceDisplay}</span>
                        {isCurrentPlan && <span className="current-badge">Aktuell</span>}
                        {isUpgrade && (
                          <button
                            className="btn-upgrade-small"
                            onClick={() => handleActivatePlan(selectedDojo.id, plan)}
                            style={{ backgroundColor: PLAN_COLORS[plan] }}
                          >
                            Upgrade
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Feature Rows */}
                <div className="plan-feature-rows">
                  {allFeatures.map(feature => {
                    const currentPlan = selectedDojo.subscription_plan || selectedDojo.plan_type || 'trial';
                    const isEnabledForDojo = featureOverrides[feature.id];

                    return (
                      <div key={feature.id} className="plan-feature-row">
                        <div className="feature-info-cell">
                          <span className="feature-emoji">{feature.emoji}</span>
                          <div className="feature-text">
                            <span className="feature-name">{feature.label}</span>
                            <span className="feature-desc">{feature.description}</span>
                          </div>
                          {isEnabledForDojo && (
                            <span className="feature-active-badge">Aktiv</span>
                          )}
                        </div>
                        {Object.keys(PLAN_HIERARCHY).map(plan => {
                          const isIncluded = (planFeatures[plan] || []).includes(feature.id);
                          const isCurrentPlan = plan === currentPlan;

                          return (
                            <div
                              key={plan}
                              className={`plan-cell ${isIncluded ? 'included' : 'not-included'} ${isCurrentPlan ? 'current-plan' : ''}`}
                            >
                              {isIncluded ? (
                                <CheckCircle size={20} style={{ color: PLAN_COLORS[plan] }} />
                              ) : (
                                <XCircle size={20} className="not-included-icon" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* Plan Selection Footer */}
                <div className="plan-selection-footer">
                  <div className="footer-label">Plan aktivieren:</div>
                  {Object.keys(PLAN_HIERARCHY).map(plan => {
                    const currentPlan = selectedDojo.subscription_plan || selectedDojo.plan_type || 'trial';
                    const isCurrentPlan = plan === currentPlan;

                    return (
                      <div key={plan} className="footer-cell">
                        <button
                          className={`btn-select-plan ${isCurrentPlan ? 'current' : ''}`}
                          style={{
                            backgroundColor: isCurrentPlan ? PLAN_COLORS[plan] : 'transparent',
                            borderColor: PLAN_COLORS[plan],
                            color: isCurrentPlan ? '#fff' : PLAN_COLORS[plan]
                          }}
                          onClick={() => !isCurrentPlan && handleActivatePlan(selectedDojo.id, plan)}
                          disabled={isCurrentPlan}
                        >
                          {isCurrentPlan ? 'Aktiv' : 'Auswählen'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feature-Trials Tab */}
        {activeTab === 'trials' && (
          <div className="trials-tab">
            {/* Header mit Stats */}
            <div className="trials-header">
              <h3><Clock size={20} /> Feature-Trials Verwaltung</h3>
              <div className="trials-actions">
                <button
                  className="btn-process"
                  onClick={handleProcessExpiredTrials}
                  disabled={featureTrialsLoading}
                >
                  <RefreshCw size={14} /> Abgelaufene verarbeiten
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            {trialStats && (
              <div className="trials-stats">
                <div className="trial-stat-card">
                  <div className="tsc-value">{trialStats.activeTrials || 0}</div>
                  <div className="tsc-label">Aktive Trials</div>
                </div>
                <div className="trial-stat-card warning">
                  <div className="tsc-value">{trialStats.expiringSoon || 0}</div>
                  <div className="tsc-label">Laufen bald ab</div>
                </div>
                <div className="trial-stat-card success">
                  <div className="tsc-value">{trialStats.conversionRate || 0}%</div>
                  <div className="tsc-label">Conversion Rate</div>
                </div>
                <div className="trial-stat-card">
                  <div className="tsc-value">{trialStats.topFeatures?.[0]?.feature_name || '-'}</div>
                  <div className="tsc-label">Top Feature</div>
                </div>
              </div>
            )}

            {featureTrialsLoading ? (
              <div className="loading-state">Laden...</div>
            ) : (
              <>
                {/* Aktive Trials Liste */}
                <div className="trials-section">
                  <h4>Aktive Feature-Trials ({featureTrials.filter(t => t.status === 'active').length})</h4>
                  {featureTrials.filter(t => t.status === 'active').length === 0 ? (
                    <div className="empty-hint">Keine aktiven Trials</div>
                  ) : (
                    <div className="trials-grid">
                      {featureTrials.filter(t => t.status === 'active').map(trial => (
                        <div key={trial.trial_id} className={`trial-card ${trial.days_remaining <= 3 ? 'expiring' : ''}`}>
                          <div className="tc-header">
                            <span className="tc-feature">
                              {trial.feature_icon} {trial.feature_name}
                            </span>
                            <span className={`tc-days ${trial.days_remaining <= 3 ? 'warning' : ''}`}>
                              {trial.days_remaining > 0 ? `${trial.days_remaining} Tage` : 'Abgelaufen'}
                            </span>
                          </div>
                          <div className="tc-dojo">
                            <Building2 size={12} />
                            <span>{trial.dojoname}</span>
                            {trial.subdomain && <span className="tc-subdomain">{trial.subdomain}</span>}
                          </div>
                          <div className="tc-dates">
                            <span>Start: {new Date(trial.started_at).toLocaleDateString('de-DE')}</span>
                            <span>Ende: {new Date(trial.expires_at).toLocaleDateString('de-DE')}</span>
                          </div>
                          <div className="tc-actions">
                            <button
                              className="btn-end-trial"
                              onClick={() => handleEndTrial(trial.trial_id)}
                            >
                              <XCircle size={12} /> Beenden
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Trial für Dojo starten */}
                <div className="trials-section">
                  <h4>Trial für Dojo starten</h4>
                  <div className="start-trial-form">
                    <select
                      value={selectedTrialDojo || ''}
                      onChange={(e) => setSelectedTrialDojo(e.target.value)}
                      className="trial-dojo-select"
                    >
                      <option value="">Dojo auswählen...</option>
                      {dojos.map(d => (
                        <option key={d.id} value={d.id}>{d.dojoname}</option>
                      ))}
                    </select>
                    {selectedTrialDojo && (
                      <div className="trial-features-grid">
                        {allFeatures.map(feature => (
                          <button
                            key={feature.id}
                            className="btn-start-feature-trial"
                            onClick={() => {
                              const featureObj = addonPrices.find(p => p.feature_key === feature.id);
                              if (featureObj) {
                                handleStartTrial(selectedTrialDojo, featureObj.feature_id);
                              } else {
                                setMessage({ type: 'error', text: 'Feature nicht gefunden' });
                              }
                            }}
                          >
                            <span className="sft-emoji">{feature.emoji}</span>
                            <span className="sft-name">{feature.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Addon-Preise */}
                <div className="trials-section">
                  <h4>Feature-Addon Preise</h4>
                  <div className="addon-prices-grid">
                    {addonPrices.map(price => (
                      <div key={price.feature_id} className="addon-price-card">
                        <div className="apc-header">
                          <span className="apc-icon">{price.feature_icon}</span>
                          <span className="apc-name">{price.feature_name}</span>
                        </div>
                        <div className="apc-prices">
                          <div className="apc-field">
                            <label>Monat</label>
                            <input
                              type="number"
                              defaultValue={price.monthly_price}
                              min="0"
                              step="0.01"
                              onBlur={(e) => handleUpdateAddonPrice(price.feature_id, {
                                ...price,
                                monthly_price: parseFloat(e.target.value)
                              })}
                            />
                            <span>€</span>
                          </div>
                          <div className="apc-field">
                            <label>Jahr</label>
                            <input
                              type="number"
                              defaultValue={price.yearly_price}
                              min="0"
                              step="0.01"
                              onBlur={(e) => handleUpdateAddonPrice(price.feature_id, {
                                ...price,
                                yearly_price: parseFloat(e.target.value)
                              })}
                            />
                            <span>€</span>
                          </div>
                          <div className="apc-field">
                            <label>Trial</label>
                            <input
                              type="number"
                              defaultValue={price.trial_days}
                              min="0"
                              max="30"
                              onBlur={(e) => handleUpdateAddonPrice(price.feature_id, {
                                ...price,
                                trial_days: parseInt(e.target.value)
                              })}
                            />
                            <span>T</span>
                          </div>
                        </div>
                        <div className="apc-toggles">
                          <label className="apc-toggle">
                            <input
                              type="checkbox"
                              defaultChecked={price.trial_enabled}
                              onChange={(e) => handleUpdateAddonPrice(price.feature_id, {
                                ...price,
                                trial_enabled: e.target.checked
                              })}
                            />
                            <span>Trial</span>
                          </label>
                          <label className="apc-toggle">
                            <input
                              type="checkbox"
                              defaultChecked={price.addon_enabled}
                              onChange={(e) => handleUpdateAddonPrice(price.feature_id, {
                                ...price,
                                addon_enabled: e.target.checked
                              })}
                            />
                            <span>Addon</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Audit-Log Tab */}
        {activeTab === 'audit' && (
          <div className="audit-tab">
            <div className="audit-header">
              <h3><Activity size={20} /> Subscription Audit-Log</h3>
              <p className="hint">Alle Änderungen an Subscriptions und Dojo-Status</p>
            </div>

            {auditLogsLoading ? (
              <div className="loading-state">Laden...</div>
            ) : auditLogs.length === 0 ? (
              <div className="empty-state">
                <Info size={48} />
                <p>Noch keine Audit-Log Einträge vorhanden</p>
              </div>
            ) : (
              <div className="audit-log-table">
                <table>
                  <thead>
                    <tr>
                      <th>Datum</th>
                      <th>Dojo</th>
                      <th>Aktion</th>
                      <th>Alter Plan</th>
                      <th>Neuer Plan</th>
                      <th>Admin</th>
                      <th>Grund</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log, idx) => (
                      <tr key={log.log_id || idx}>
                        <td className="date-cell">
                          {log.created_at ? new Date(log.created_at).toLocaleString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : '-'}
                        </td>
                        <td>
                          <strong>{log.dojoname || `Dojo #${log.dojo_id}`}</strong>
                        </td>
                        <td>
                          <span className={`action-badge ${log.action?.includes('deactivat') ? 'danger' : log.action?.includes('activat') ? 'success' : 'info'}`}>
                            {log.action || '-'}
                          </span>
                        </td>
                        <td>
                          {log.old_plan ? getPlanBadge(log.old_plan) : '-'}
                        </td>
                        <td>
                          {log.new_plan ? getPlanBadge(log.new_plan) : '-'}
                        </td>
                        <td>{log.admin_username || '-'}</td>
                        <td className="reason-cell">{log.reason || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SaaS Settings Tab */}
        {activeTab === 'settings' && (
          <div className="settings-tab">
            <div className="settings-header">
              <div>
                <h3><Settings size={20} /> SaaS-Einstellungen</h3>
                <p className="hint">Globale Konfiguration für das SaaS-System</p>
              </div>
              <div className="settings-actions">
                <button
                  className="btn btn-secondary"
                  onClick={clearSettingsCache}
                >
                  <RefreshCw size={16} /> Cache leeren
                </button>
                <button
                  className="btn btn-primary"
                  onClick={saveSaasSettings}
                  disabled={saasSettingsSaving || Object.keys(editedSettings).length === 0}
                >
                  {saasSettingsSaving ? 'Speichert...' : 'Änderungen speichern'}
                </button>
              </div>
            </div>

            {saasSettingsLoading ? (
              <div className="loading-state">Laden...</div>
            ) : (
              <div className="settings-categories">
                {saasCategories.map(category => (
                  <div key={category} className="settings-category">
                    <h4 className="category-header">
                      {getCategoryIcon(category)}
                      <span>{getCategoryLabel(category)}</span>
                    </h4>

                    {/* Test-Buttons für bestimmte Kategorien */}
                    {category === 'stripe' && (
                      <div className="category-actions">
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={testStripeConnection}
                          disabled={testResults.stripe?.loading}
                        >
                          <Zap size={14} />
                          {testResults.stripe?.loading ? 'Teste...' : 'Verbindung testen'}
                        </button>
                        {testResults.stripe && !testResults.stripe.loading && (
                          <span className={`test-result ${testResults.stripe.success ? 'success' : 'error'}`}>
                            {testResults.stripe.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                            {testResults.stripe.message}
                            {testResults.stripe.mode && ` (${testResults.stripe.mode})`}
                          </span>
                        )}
                      </div>
                    )}

                    {category === 'email' && (
                      <div className="category-actions">
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={testEmailConnection}
                          disabled={testResults.email?.loading}
                        >
                          <Globe size={14} />
                          {testResults.email?.loading ? 'Sende...' : 'Test-Email senden'}
                        </button>
                        {testResults.email && !testResults.email.loading && (
                          <span className={`test-result ${testResults.email.success ? 'success' : 'error'}`}>
                            {testResults.email.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                            {testResults.email.message}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="settings-grid">
                      {(saasSettings[category] || []).map(setting => (
                        <div key={setting.key} className="setting-item">
                          <div className="setting-header">
                            <label htmlFor={setting.key}>{setting.displayName || setting.key}</label>
                            {setting.isSecret && (
                              <span className="secret-badge">
                                <Shield size={12} /> Secret
                              </span>
                            )}
                          </div>

                          {setting.updatedAt && (
                            <span className="setting-updated">
                              {new Date(setting.updatedAt).toLocaleDateString('de-DE')}
                            </span>
                          )}

                          <p className="setting-description">{setting.description}</p>

                          <div className="setting-input-wrapper">
                            {setting.type === 'boolean' ? (
                              <label className="toggle-switch">
                                <input
                                  type="checkbox"
                                  id={setting.key}
                                  checked={
                                    editedSettings[setting.key] !== undefined
                                      ? editedSettings[setting.key]
                                      : setting.value === true || setting.value === 'true'
                                  }
                                  onChange={(e) => handleSettingChange(setting.key, e.target.checked)}
                                />
                                <span className="toggle-slider"></span>
                              </label>
                            ) : setting.type === 'number' ? (
                              <input
                                type="number"
                                id={setting.key}
                                className="setting-input"
                                value={
                                  editedSettings[setting.key] !== undefined
                                    ? editedSettings[setting.key]
                                    : setting.value ?? ''
                                }
                                onChange={(e) => handleSettingChange(setting.key, parseFloat(e.target.value) || 0)}
                                placeholder="Wert eingeben..."
                              />
                            ) : setting.type === 'json' ? (
                              <textarea
                                id={setting.key}
                                className="setting-input setting-textarea"
                                value={
                                  editedSettings[setting.key] !== undefined
                                    ? (typeof editedSettings[setting.key] === 'string'
                                        ? editedSettings[setting.key]
                                        : JSON.stringify(editedSettings[setting.key], null, 2))
                                    : (typeof setting.value === 'string'
                                        ? setting.value
                                        : JSON.stringify(setting.value, null, 2))
                                }
                                onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                                rows={4}
                                placeholder='{"key": "value"}'
                              />
                            ) : (
                              <input
                                type={setting.isSecret ? 'password' : 'text'}
                                id={setting.key}
                                className="setting-input"
                                value={
                                  editedSettings[setting.key] !== undefined
                                    ? editedSettings[setting.key]
                                    : setting.value || ''
                                }
                                onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                                placeholder={setting.isSecret ? '••••••••••••••••' : 'Wert eingeben...'}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {saasCategories.length === 0 && (
                  <div className="empty-state">
                    <Info size={48} />
                    <p>Keine SaaS-Einstellungen gefunden.</p>
                    <p className="hint">Bitte führe die Migration 062_create_saas_settings.sql aus.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DojoLizenzverwaltung;
