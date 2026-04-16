import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2, Search, Shield, Clock, CheckCircle, XCircle, Check,
  ChevronRight, Settings, Zap, Users, Calendar, CreditCard,
  TrendingUp, AlertTriangle, RefreshCw, Plus, Trash2, Edit, Globe, Link,
  BarChart3, PieChart, MapPin, TrendingDown, ArrowUpRight, ArrowDownRight,
  Activity, Target, DollarSign, UserPlus, UserMinus,
  HardDrive, AlertCircle, CheckCircle2, Info, Flag, Heart, Server,
  Download, Power, PowerOff, FileText, X
} from 'lucide-react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import LizenzDokumente from './LizenzDokumente';
import DemoTermine from './DemoTermine';
import AkquiseDashboard from './AkquiseDashboard';
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
  // Trial: Alle Features außer Multi-Dojo + White-Label (volle 14-Tage-Erfahrung)
  trial: ['mitgliederverwaltung', 'online_registrierung', 'mitglieder_portal', 'checkin', 'sepa', 'pruefungen', 'vertraege', 'familien', 'verkauf', 'dashboard', 'stundenplan', 'kommunikation', 'benachrichtigungen', 'dokumente', 'sicherheit', 'buchfuehrung', 'api', 'interessenten', 'probetraining', 'events', 'ruhepause', 'mahnwesen', 'auswertungen', 'wettbewerb', 'badges', 'wallet_pass', 'freunde_werben', 'chat', 'lernplattform', 'eltern_portal', 'trainer_stunden', 'marketing', 'ausruestung', 'entwicklungsziele', 'kalender_abo', 'externe_chats', 'homepage_builder'],
  basic: ['mitgliederverwaltung', 'checkin', 'dashboard', 'sicherheit'],
  free: ['mitgliederverwaltung', 'checkin', 'dashboard', 'sicherheit'],
  // Starter: Kern-Operations — alles was ein kleines Dojo von Tag 1 braucht inkl. Stundenplan
  starter: ['mitgliederverwaltung', 'online_registrierung', 'mitglieder_portal', 'checkin', 'sepa', 'pruefungen', 'vertraege', 'dashboard', 'benachrichtigungen', 'sicherheit', 'interessenten', 'probetraining', 'mahnwesen', 'badges', 'wallet_pass', 'freunde_werben', 'stundenplan', 'kalender_abo'],
  // Professional: Wachstums-Tools — Kommunikation, Events, Familie, Verkauf; ohne Spezialfeatures
  professional: ['mitgliederverwaltung', 'online_registrierung', 'mitglieder_portal', 'checkin', 'sepa', 'pruefungen', 'vertraege', 'familien', 'verkauf', 'dashboard', 'stundenplan', 'kommunikation', 'benachrichtigungen', 'dokumente', 'sicherheit', 'interessenten', 'probetraining', 'events', 'ruhepause', 'mahnwesen', 'auswertungen', 'badges', 'wallet_pass', 'freunde_werben', 'chat', 'marketing', 'ausruestung', 'entwicklungsziele', 'kalender_abo'],
  // Premium: Vollausstattung — inkl. Lernplattform, Eltern-Portal, Trainer-Stunden, externe Chats
  premium: ['mitgliederverwaltung', 'online_registrierung', 'mitglieder_portal', 'checkin', 'sepa', 'pruefungen', 'vertraege', 'familien', 'verkauf', 'dashboard', 'stundenplan', 'kommunikation', 'benachrichtigungen', 'dokumente', 'sicherheit', 'buchfuehrung', 'api', 'interessenten', 'probetraining', 'events', 'ruhepause', 'mahnwesen', 'auswertungen', 'wettbewerb', 'badges', 'wallet_pass', 'freunde_werben', 'chat', 'lernplattform', 'eltern_portal', 'trainer_stunden', 'marketing', 'ausruestung', 'entwicklungsziele', 'kalender_abo', 'externe_chats'],
  // Enterprise: Franchise & Multi-Standort — alles inkl. Multi-Dojo, White-Label, Homepage Builder, externe Chats
  enterprise: ['mitgliederverwaltung', 'online_registrierung', 'mitglieder_portal', 'checkin', 'sepa', 'pruefungen', 'vertraege', 'familien', 'verkauf', 'dashboard', 'stundenplan', 'kommunikation', 'benachrichtigungen', 'multidojo', 'dokumente', 'api', 'sicherheit', 'buchfuehrung', 'interessenten', 'probetraining', 'events', 'ruhepause', 'mahnwesen', 'auswertungen', 'wettbewerb', 'whitelabel', 'badges', 'wallet_pass', 'freunde_werben', 'chat', 'lernplattform', 'eltern_portal', 'trainer_stunden', 'marketing', 'ausruestung', 'entwicklungsziele', 'kalender_abo', 'externe_chats', 'homepage_builder']
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
    emoji: '👥',
    files: ['MitgliedDetail.jsx', 'MitgliedDetailShared.jsx', 'MitgliederListe.jsx', 'MitgliederFilter.jsx', 'MitgliedsAusweis.jsx', 'Personal.jsx', 'backend/routes/mitglieder/']
  },
  {
    id: 'online_registrierung',
    label: 'Online-Registrierung',
    description: 'Selbstständige Anmeldung mit automatischer Vertragserstellung',
    emoji: '🌐',
    files: ['PublicRegistration.jsx', 'BuddyInviteRegistration.jsx', 'backend/routes/registrierung.js']
  },
  {
    id: 'mitglieder_portal',
    label: 'Mitglieder-Portal',
    description: 'Self-Service: Adressänderung, Kündigung, Ruhepause - ohne deinen Aufwand',
    emoji: '👤',
    files: ['MemberDashboard.jsx', 'MemberHeader.jsx', 'MemberPayments.jsx', 'MemberProfilePage.jsx', 'MemberStats.jsx', 'MemberSchedule.jsx', 'MemberCheckin.jsx']
  },
  {
    id: 'checkin',
    label: 'Check-In System',
    description: 'QR-Code basiertes Check-In mit Live-Display für dein Dojo',
    emoji: '✅',
    files: ['CheckinSystem.jsx', 'PersonalCheckin.jsx', 'PublicCheckinDisplay.jsx', 'QRScanner.jsx', 'MemberCheckin.jsx', 'backend/routes/checkin.js']
  },
  {
    id: 'sepa',
    label: 'SEPA & Finanzen',
    description: 'Automatische Lastschriften, Rabattsystem, Mahnwesen',
    emoji: '🏦',
    files: ['SepaMandateVerwaltung.jsx', 'SepaTab.jsx', 'LastschriftManagement.jsx', 'Lastschriftlauf.jsx', 'AutoLastschriftTab.jsx', 'RuecklastschriftVerwaltung.jsx', 'Zahllaeufe.jsx', 'backend/routes/sepa.js']
  },
  {
    id: 'pruefungen',
    label: 'Prüfungswesen',
    description: 'Gürtelprüfungen, historische Prüfungen, Lehrgänge & Ehrungen',
    emoji: '🥋',
    files: ['PruefungsVerwaltung.jsx', 'PruefungDurchfuehren.jsx', 'PruefungsStatus.jsx', 'GuertelMassenzuweisung.jsx', 'GurtStatistikDropdown.jsx', 'backend/routes/pruefungen.js']
  },
  {
    id: 'vertraege',
    label: 'Vertragsverwaltung',
    description: 'Automatische Verlängerung, Tarifwechsel, Rabatte, PDF-Export',
    emoji: '📄',
    files: ['ContractsTab.jsx', 'VertragFormular.jsx', 'backend/routes/vertraege.js']
  },
  {
    id: 'familien',
    label: 'Familienverwaltung',
    description: 'Familienrabatte, Erziehungsberechtigte, verknüpfte Konten',
    emoji: '👨‍👩‍👧‍👦',
    files: ['MemberFamilyTab.jsx', 'backend/routes/familien.js']
  },
  {
    id: 'verkauf',
    label: 'Verkauf & Lager',
    description: 'Artikel, Kassensystem, Bestandsverwaltung, Verkaufsstatistik',
    emoji: '🛒',
    files: ['ArtikelVerwaltung.jsx', 'ArtikelFormular.jsx', 'VerkaufKasse.jsx', 'TresenUebersicht.jsx', 'BestellungenTab.jsx', 'ZehnerkartenVerwaltung.jsx', 'ArtikelgruppenVerwaltung.jsx', 'backend/routes/verkauf.js']
  },
  {
    id: 'dashboard',
    label: 'Dashboard & Statistiken',
    description: 'Echtzeit-Auswertungen, Einnahmen, Austritte, Anwesenheit',
    emoji: '📊',
    files: ['Dashboard.jsx', 'DashboardStart.jsx', 'AnwesenheitDashboard.jsx', 'AnwesenheitStatistik.jsx', 'StatisticsTab.jsx', 'backend/routes/statistiken.js']
  },
  {
    id: 'stundenplan',
    label: 'Stundenplan & Kurse',
    description: 'Trainingszeiten, Kursbuchung, Wartelisten, Trainer-Zuordnung',
    emoji: '📅',
    files: ['Stundenplan.jsx', 'Stundenplan.css', 'Kurse.jsx', 'PublicTimetableDisplay.jsx', 'CourseSelectionModal.jsx', 'MemberSchedule.jsx', 'GruppenStilverwaltung.jsx', 'backend/routes/stundenplan.js', 'backend/routes/kurse.js']
  },
  {
    id: 'kommunikation',
    label: 'Kommunikation',
    description: 'E-Mail-Versand, Newsletter, Vorlagen, Massen-Mails',
    emoji: '📧',
    files: ['NotificationSystem.jsx', 'NewsVerwaltung.jsx', 'VorlagenVerwaltung.jsx', 'VorlagenEditor.jsx', 'TemplateEditor.jsx', 'TrainingReminders.jsx', 'backend/routes/email-service.js']
  },
  {
    id: 'benachrichtigungen',
    label: 'Benachrichtigungen',
    description: 'Automatische Erinnerungen, Zahlungseingänge, Kündigungen',
    emoji: '🔔',
    files: ['NotificationSystem.jsx', 'EventNotificationPopup.jsx', 'backend/routes/notifications.js', 'backend/routes/trainer.js (Push)']
  },
  {
    id: 'multidojo',
    label: 'Multi-Dojo',
    description: 'Mehrere Standorte zentral verwalten mit einem Account',
    emoji: '🏢',
    files: ['DojosVerwaltung.jsx', 'DojoEdit.jsx', 'DojoSwitcher.jsx', 'SuperAdminDashboard.jsx', 'StandortVerwaltung.jsx', 'context/DojoContext.jsx', 'backend/routes/dojos.js']
  },
  {
    id: 'dokumente',
    label: 'Dokumentenverwaltung',
    description: 'Upload, Speicherung und Verwaltung aller Dokumente',
    emoji: '📁',
    files: ['DokumentenZentrale.jsx', 'DokumenteVerwaltung.jsx', 'BerichteDokumente.jsx', 'backend/routes/dokumente.js']
  },
  {
    id: 'api',
    label: 'API-Zugang',
    description: 'Externe Integrationen, Webhooks, Zapier-Anbindung',
    emoji: '🔌',
    files: ['WebhookVerwaltung.jsx', 'IntegrationsEinstellungen.jsx', 'backend/routes/webhooks.js']
  },
  {
    id: 'sicherheit',
    label: 'Sicherheit & DSGVO',
    description: 'Verschlüsselte Daten, deutsche Server, 100% DSGVO-konform',
    emoji: '🔒',
    files: ['MemberSecurityTab.jsx', 'PasswortVerwaltung.jsx', 'AuditLog.jsx', 'SecurityDashboard.jsx', 'backend/middleware/auth.js', 'backend/middleware/tenantSecurity.js']
  },
  {
    id: 'buchfuehrung',
    label: 'Buchführung & EÜR',
    description: 'Einnahmen-Überschuss-Rechnung, DATEV-Export, Steuervorbereitung',
    emoji: '📒',
    files: ['BuchhaltungTab.jsx', 'DatevExport.jsx', 'EuerUebersicht.jsx', 'Jahresuebersicht.jsx', 'AusgabenVerwaltung.jsx', 'FinanzenTab.jsx', 'Finanzcockpit.jsx', 'backend/routes/buchfuehrung.js']
  },
  {
    id: 'wettbewerb',
    label: 'Wettbewerbssystem',
    description: 'Turnierverwaltung, Sportler, Nominierungen, Hall-of-Fame, Medaillen',
    emoji: '🏆',
    files: ['Turnierverwaltung.jsx', 'TdaTurniereList.jsx', 'backend/routes/wettbewerb.js']
  },
  {
    id: 'interessenten',
    label: 'Interessenten & Leads',
    description: 'Probetraining-Anfragen, Lead-Verwaltung, Conversion-Tracking',
    emoji: '🎯',
    files: ['InterestentenListe.jsx', 'backend/routes/interessenten.js']
  },
  {
    id: 'probetraining',
    label: 'Probetraining',
    description: 'Online-Buchung, Terminverwaltung, automatische Erinnerungen',
    emoji: '🥊',
    files: ['InterestentenListe.jsx', 'backend/routes/interessenten.js (probetraining-Endpunkte)']
  },
  {
    id: 'events',
    label: 'Events & Lehrgänge',
    description: 'Veranstaltungen, Seminare, Lehrgänge, Online-Anmeldung',
    emoji: '🎪',
    files: ['Events.jsx', 'EventsDashboard.jsx', 'EventGastAnmeldung.jsx', 'MeineEvents.jsx', 'EventPaymentCheckout.jsx', 'backend/routes/events.js']
  },
  {
    id: 'ruhepause',
    label: 'Ruhepause & Pausieren',
    description: 'Mitgliedschaft pausieren, automatische Reaktivierung',
    emoji: '⏸️',
    files: ['MemberDashboard.jsx (Ruhepause-Sektion)', 'backend/routes/mitglieder/crud.js (ruhepause-Endpunkte)']
  },
  {
    id: 'mahnwesen',
    label: 'Mahnwesen',
    description: 'Automatische Mahnungen, Mahnstufen, Zahlungserinnerungen',
    emoji: '⚠️',
    files: ['Mahnwesen.jsx', 'MahnstufenEinstellungen.jsx', 'OffeneZahlungen.jsx', 'backend/routes/mahnwesen.js']
  },
  {
    id: 'auswertungen',
    label: 'Berichte & Auswertungen',
    description: 'Detaillierte Reports, Export-Funktionen, grafische Analysen',
    emoji: '📈',
    files: ['Auswertungen.jsx', 'StatisticsTab.jsx', 'AnwesenheitStatistik.jsx', 'Jahresuebersicht.jsx', 'AnwesenheitExport.jsx', 'backend/routes/auswertungen.js']
  },
  {
    id: 'whitelabel',
    label: 'White-Label',
    description: 'Eigenes Branding, Custom Domain, individuelles Design',
    emoji: '🎨',
    files: ['EinstellungenDojo.jsx', 'DojoLogos.jsx', 'backend/routes/dojos.js (branding-Endpunkte)']
  },
  // ===== FEATURES AUS 2.8/2.9 =====
  {
    id: 'chat',
    label: 'Mitglieder-Chat',
    description: 'Echtzeit-Chat zwischen Mitgliedern, Direktchats, Gruppenräume & Ankündigungs-Kanal',
    emoji: '💬',
    files: ['chat/ChatPage.jsx', 'chat/ChatRoomList.jsx', 'chat/ChatWindow.jsx', 'chat/ChatNewRoom.jsx', 'chat/ChatRoomSettings.jsx', 'chat/AdminChatPage.jsx', 'chat/ChatPopup.jsx', 'chat/ChatMessage.jsx', 'context/ChatContext.jsx', 'backend/routes/chat.js', 'backend/chatSocket.js']
  },
  {
    id: 'lernplattform',
    label: 'Lernplattform',
    description: 'Technik-Videos und PDFs nach Stil und Graduierung gefiltert',
    emoji: '🎓',
    files: ['Lernplattform.jsx', 'backend/routes/lernplattform.js']
  },
  {
    id: 'badges',
    label: 'Badges & Auszeichnungen',
    description: 'Digitale Abzeichen vergeben, im Mitglieder-Portal sichtbar, mit Benachrichtigung',
    emoji: '🏅',
    files: ['BadgeDisplay.jsx', 'BadgeAdminOverview.jsx', 'MemberDashboard.jsx (Badge-Sektion)', 'backend/routes/badges.js']
  },
  {
    id: 'eltern_portal',
    label: 'Eltern-Portal',
    description: 'Lesezugang für Erziehungsberechtigte auf die Daten ihrer Kinder',
    emoji: '👨‍👩‍👧',
    files: ['ElternPortal.jsx', 'ElternZugaenge.jsx', 'backend/routes/eltern.js']
  },
  {
    id: 'trainer_stunden',
    label: 'Trainer-Stundennachweise',
    description: 'Stunden nach Kurs buchen, Monatsabrechnung erstellen und exportieren',
    emoji: '⏱️',
    files: ['TrainerStunden.jsx', 'TrainerDashboard.jsx', 'backend/routes/trainer.js (stunden-Endpunkte)']
  },
  {
    id: 'freunde_werben',
    label: 'Freunde werben',
    description: 'Referral-System: Mitglieder werben Mitglieder mit individuellen Einladungscodes',
    emoji: '🤝',
    files: ['FreundeWerbenFreunde.jsx', 'ReferralCodeVerwaltung.jsx', 'BuddyVerwaltung.jsx', 'BuddyInviteRegistration.jsx', 'backend/routes/referral.js']
  },
  {
    id: 'marketing',
    label: 'Marketing & Aktionen',
    description: 'Marketingaktionen, Jahresplan, Rabattaktionen und Kampagnen verwalten',
    emoji: '📣',
    files: ['MarketingAktionen.jsx', 'MarketingJahresplan.jsx', 'Rabattsystem.jsx', 'backend/routes/marketing.js']
  },
  {
    id: 'ausruestung',
    label: 'Ausrüstungsverwaltung',
    description: 'Ausrüstungsgegenstände erfassen, Checklisten für Mitglieder und Kurse',
    emoji: '🛡️',
    files: ['EquipmentManagement.jsx', 'EquipmentChecklist.jsx', 'backend/routes/ausruestung.js']
  },
  {
    id: 'wallet_pass',
    label: 'Digitaler Mitgliedsausweis',
    description: 'QR-Code-Ausweis als Apple Wallet / Google Wallet Pass exportierbar',
    emoji: '📱',
    files: ['MemberQRCode.jsx', 'MitgliedsAusweis.jsx', 'AppInstallQRCode.jsx', 'backend/routes/wallet.js']
  },
  {
    id: 'entwicklungsziele',
    label: 'Entwicklungsziele',
    description: 'Persönliche Trainingsziele, Fortschrittserfassung und Entwicklungsberichte',
    emoji: '🎯',
    files: ['ZieleEntwicklung.jsx', 'MitgliedFortschritt.jsx', 'backend/routes/entwicklungsziele.js']
  },
  {
    id: 'kalender_abo',
    label: 'Kalender-Abo',
    description: 'Stundenplan als iCal-Abo in Kalender-Apps einbinden (Google, Apple, Outlook)',
    emoji: '📆',
    files: ['KalenderAbo.jsx', 'backend/routes/kalender.js']
  },
  {
    id: 'externe_chats',
    label: 'Externe Chat-Integrationen',
    description: 'Facebook Messenger, WhatsApp Business und weitere externe Messaging-Kanäle direkt im Dashboard empfangen und beantworten',
    emoji: '📲',
    files: ['chat/BesucherChat.jsx', 'backend/routes/visitor-chat.js', 'backend/routes/messenger.js']
  },
  {
    id: 'homepage_builder',
    label: 'Homepage Builder',
    description: 'Kostenlose professionelle Homepage im japanischen Martial-Arts-Design — Drag & Drop Editor mit Live-Vorschau, Logo-Upload, Custom Domain möglich',
    emoji: '🌐',
    files: ['HomepageDashboard.jsx', 'DojoSite.jsx', 'backend/routes/homepage.js']
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
  const [expandedFeatureId, setExpandedFeatureId] = useState(null);
  const [newFeature, setNewFeature] = useState({ id: '', label: '', description: '', emoji: '⭐', plans: [] });
  const [editingFeature, setEditingFeature] = useState(null);

  // Plan-Feature Management
  const [planFeatures, setPlanFeatures] = useState(DEFAULT_PLAN_FEATURES);
  const [editingPlan, setEditingPlan] = useState(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [editingPlanPrices, setEditingPlanPrices] = useState({});
  const [activePlanTab, setActivePlanTab] = useState('starter'); // Für Features-Tab Sub-Navigation
  const [featureStatusFilter, setFeatureStatusFilter] = useState('all'); // Filter: 'all', 'active', 'inactive'

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

  // Lizenzverträge pro Dojo
  const [dojoVertraege, setDojoVertraege] = useState([]);
  const [dojoVertraegeLoading, setDojoVertraegeLoading] = useState(false);
  const [showPlanVergleich, setShowPlanVergleich] = useState(false);

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
      // Auto-Sync: DEFAULT_FEATURES + DEFAULT_PLAN_FEATURES → DB (plan_features, feature_addon_prices, plan_feature_mapping)
      await fetchWithAuth(`${config.apiBaseUrl}/admin/sync-features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          features: DEFAULT_FEATURES.map(f => ({ id: f.id, label: f.label, emoji: f.emoji })),
          planFeatures: DEFAULT_PLAN_FEATURES
        })
      });

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

  const loadDojoVertraege = async (dojoId) => {
    setDojoVertraegeLoading(true);
    try {
      const r = await fetchWithAuth(`${config.apiBaseUrl}/admin/lizenzvertrag/dojo/${dojoId}`);
      const data = await r.json();
      if (data.success) setDojoVertraege(data.vertraege);
    } catch {}
    finally { setDojoVertraegeLoading(false); }
  };

  const handleSelectDojo = (dojo) => {
    setSelectedDojo(dojo);
    setActiveTab('details');
    loadDojoVertraege(dojo.id);

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

    // Plan-Zuordnung: Feature zu ausgewählten Plänen hinzufügen
    if (newFeature.plans.length > 0) {
      const updatedPlanFeatures = { ...planFeatures };
      newFeature.plans.forEach(plan => {
        if (!(updatedPlanFeatures[plan] || []).includes(featureId)) {
          updatedPlanFeatures[plan] = [...(updatedPlanFeatures[plan] || []), featureId];
        }
      });
      setPlanFeatures(updatedPlanFeatures);

      // Plan-Features für jeden betroffenen Plan in der DB speichern
      for (const plan of newFeature.plans) {
        try {
          await fetchWithAuth(
            `${config.apiBaseUrl}/admin/subscription-plans/${plan}/features`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ features: updatedPlanFeatures[plan] })
            }
          );
        } catch (e) {
          console.log(`Plan-Features für ${plan} lokal gesetzt`);
        }
      }
    }

    setNewFeature({ id: '', label: '', description: '', emoji: '⭐', plans: [] });
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
    return (
      <span className={`plan-badge plan-badge--${plan || 'trial'}`}>
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
      {/* Topbar: single row — title · pills · refresh */}
      <div className="lizenz-topbar">
        <div className="lizenz-topbar-title">
          <Shield size={16} />
          <span>Lizenzverwaltung</span>
        </div>
        <span className="lizenz-topbar-divider" />
        <div className="lizenz-kpi-row">
          <span className="lizenz-kpi-pill kpi-total" title="Dojos gesamt">
            <Building2 size={11} /> {stats.total} Dojos
          </span>
          <span className="lizenz-kpi-pill kpi-active" title="Aktive Lizenzen">
            <CheckCircle size={11} /> {stats.active} Aktiv
          </span>
          <span className="lizenz-kpi-pill kpi-trial" title="Trial-Accounts">
            <Clock size={11} /> {stats.trials} Trial
          </span>
          <span className="lizenz-kpi-pill kpi-revenue" title="Potenzielle MRR">
            <DollarSign size={11} /> €{stats.potentialMrr.toLocaleString('de-DE')} MRR
          </span>
          {stats.expiringTrials > 0 && (
            <span className="lizenz-kpi-pill kpi-warning" title={`${stats.expiringTrials} Trials laufen bald ab`}>
              <AlertTriangle size={11} /> {stats.expiringTrials} läuft ab
            </span>
          )}
        </div>
        <button className="btn-refresh" onClick={loadDojos} disabled={loading} title="Daten neu laden">
          <RefreshCw size={14} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`message-banner ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Tabs — single scrollable row */}
      <div className="lizenz-nav-tabs">
        <button className={`lnav-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          <BarChart3 size={13} /> Übersicht
        </button>
        <button className={`lnav-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
          <Building2 size={13} /> Dojos <span className="lnav-count">{dojos.length}</span>
        </button>
        <button className={`lnav-btn ${activeTab === 'statistics' ? 'active' : ''}`} onClick={() => setActiveTab('statistics')}>
          <TrendingUp size={13} /> Statistiken
        </button>
        <button className={`lnav-btn ${activeTab === 'plans' ? 'active' : ''}`} onClick={() => setActiveTab('plans')}>
          <CreditCard size={13} /> Pläne
        </button>
        <button className={`lnav-btn ${activeTab === 'features' ? 'active' : ''}`} onClick={() => setActiveTab('features')}>
          <Zap size={13} /> Features <span className="lnav-count">{allFeatures.length}</span>
        </button>
        <button className={`lnav-btn ${activeTab === 'buchungen' ? 'active' : ''}`} onClick={() => setActiveTab('buchungen')}>
          <Calendar size={13} /> Demo-Buchungen
        </button>
        <button className={`lnav-btn ${activeTab === 'dokumente' ? 'active' : ''}`} onClick={() => setActiveTab('dokumente')}>
          <FileText size={13} /> Dokumente
        </button>
        <button className={`lnav-btn ${activeTab === 'akquise' ? 'active' : ''}`} onClick={() => setActiveTab('akquise')}>
          <Target size={13} /> Akquise
        </button>
        <span className="lnav-sep" />
        <button className={`lnav-btn lnav-btn--dim ${activeTab === 'vergleich' ? 'active' : ''}`} onClick={() => { setActiveTab('vergleich'); loadComparisonData(); }}>
          Vergleich
        </button>
        <button className={`lnav-btn lnav-btn--dim ${activeTab === 'trials' ? 'active' : ''}`} onClick={() => { setActiveTab('trials'); loadFeatureTrials(); }}>
          Feature-Trials
        </button>
        <button className={`lnav-btn lnav-btn--dim ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => { setActiveTab('audit'); loadAuditLogs(); }}>
          Audit-Log
        </button>
        <button className={`lnav-btn lnav-btn--dim ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => { setActiveTab('settings'); loadSaasSettings(); }}>
          <Settings size={13} /> Einstellungen
        </button>
        {selectedDojo && (
          <>
            <span className="lnav-sep" />
            <button className={`lnav-btn lnav-btn--dojo ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>
              <ChevronRight size={13} /> {selectedDojo.dojoname}
            </button>
          </>
        )}
      </div>

      {/* Content */}
      <div className="lizenz-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-tab">
            {/* Compact metrics bar */}
            <div className="lm-bar">
              <div className="lm-item">
                <span className="lm-val">{stats.total}</span>
                <span className="lm-lbl"><Building2 size={11} /> Dojos gesamt</span>
              </div>
              <div className="lm-sep" />
              <div className="lm-item lm-item--green">
                <span className="lm-val">{stats.active}</span>
                <span className="lm-lbl"><CheckCircle size={11} /> Aktiv</span>
              </div>
              <div className="lm-sep" />
              <div className="lm-item lm-item--yellow">
                <span className="lm-val">{stats.trials}</span>
                <span className="lm-lbl"><Clock size={11} /> Trial</span>
              </div>
              <div className="lm-sep" />
              <div className="lm-item">
                <span className="lm-val">{stats.free}</span>
                <span className="lm-lbl">Free</span>
              </div>
              <div className="lm-sep" />
              <div className="lm-item lm-item--blue">
                <span className="lm-val">{stats.paid}</span>
                <span className="lm-lbl"><CreditCard size={11} /> Zahlend</span>
              </div>
              <div className="lm-sep" />
              <div className="lm-item">
                <span className="lm-val">{stats.totalMembers.toLocaleString('de-DE')}</span>
                <span className="lm-lbl"><Users size={11} /> Mitglieder</span>
              </div>
              <div className="lm-sep" />
              <div
                className="lm-item lm-item--gold lm-item--tooltip"
                title={`Potenzielle MRR = Ziel bei 100% Konvertierung. Aktuell: €${stats.mrr.toLocaleString('de-DE')}`}
              >
                <span className="lm-val">€{stats.potentialMrr.toLocaleString('de-DE')}</span>
                <span className="lm-lbl"><DollarSign size={11} /> pot. MRR <Info size={10} /></span>
              </div>
              {stats.mrr > 0 && stats.mrr !== stats.potentialMrr && (
                <>
                  <div className="lm-sep" />
                  <div className="lm-item lm-item--gold">
                    <span className="lm-val">€{stats.mrr.toLocaleString('de-DE')}</span>
                    <span className="lm-lbl">Akt. MRR</span>
                  </div>
                </>
              )}
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
          <div className="st-dashboard">

            {/* ── Row 1: KPI strip ─────────────────────────────────────────── */}
            <div className="st-full">
              <div className="st-kpi-row">
                <div className="st-kpi-item">
                  <span className="st-kpi-val">{stats.total}</span>
                  <span className="st-kpi-lbl">Dojos</span>
                </div>
                <div className="st-kpi-sep" />
                <div className="st-kpi-item">
                  <span className="st-kpi-val st-kpi-val--green">{stats.active}</span>
                  <span className="st-kpi-lbl">Aktiv</span>
                </div>
                <div className="st-kpi-sep" />
                <div className="st-kpi-item">
                  <span className="st-kpi-val st-kpi-val--yellow">{stats.trials}</span>
                  <span className="st-kpi-lbl">Trial</span>
                </div>
                <div className="st-kpi-sep" />
                <div className="st-kpi-item">
                  <span className="st-kpi-val st-kpi-val--blue">{stats.paid}</span>
                  <span className="st-kpi-lbl">Zahlend</span>
                </div>
                <div className="st-kpi-sep" />
                <div className="st-kpi-item">
                  <span className="st-kpi-val">{stats.free}</span>
                  <span className="st-kpi-lbl">Free</span>
                </div>
                <div className="st-kpi-sep" />
                <div className="st-kpi-item">
                  <span className="st-kpi-val">{stats.totalMembers.toLocaleString('de-DE')}</span>
                  <span className="st-kpi-lbl">Mitglieder</span>
                </div>
                <div className="st-kpi-sep" />
                <div className="st-kpi-item">
                  <span className="st-kpi-val st-kpi-val--gold">€{stats.potentialMrr.toLocaleString('de-DE')}</span>
                  <span className="st-kpi-lbl">pot. MRR</span>
                </div>
                <div className="st-kpi-sep" />
                <div className="st-kpi-item">
                  <span className="st-kpi-val st-kpi-val--gold">€{(stats.potentialMrr * 12).toLocaleString('de-DE')}</span>
                  <span className="st-kpi-lbl">ARR</span>
                </div>
                <div className="st-kpi-sep" />
                <div className="st-kpi-item">
                  <span className={`st-kpi-val ${Number(stats.conversionRate) > 0 ? 'st-kpi-val--green' : ''}`} style={Number(stats.conversionRate) === 0 ? { color: 'rgba(255,255,255,0.3)' } : {}}>
                    {stats.conversionRate}%
                  </span>
                  <span className="st-kpi-lbl">Conversion</span>
                </div>
                <div className="st-kpi-sep" />
                <div className="st-kpi-item">
                  <span className={`st-kpi-val ${Number(stats.growthRate) >= 0 ? 'st-kpi-val--pos' : 'st-kpi-val--neg'}`}>
                    {Number(stats.growthRate) >= 0 ? '+' : ''}{stats.growthRate}%
                  </span>
                  <span className="st-kpi-lbl">MoM</span>
                </div>
              </div>
            </div>

            {/* ── Row 2: Growth chart + Plan distribution ───────────────────── */}
            <div className="st-card">
              <div className="st-card-title">
                <Activity size={13} />
                Wachstum – letzte 12 Monate
              </div>
              <div className="st-barchart">
                {(() => {
                  const maxCount = Math.max(...stats.monthlyGrowth.map(m => m.count), 1);
                  return stats.monthlyGrowth.map((month, idx) => {
                    const heightPct = Math.max((month.count / maxCount) * 72, month.count > 0 ? 3 : 0);
                    return (
                      <div key={idx} className="st-bar-wrap">
                        {month.new > 0 && <span className="st-bar-new">+{month.new}</span>}
                        <div
                          className="st-bar"
                          style={{ height: `${heightPct}px` }}
                          title={`${month.month}: ${month.count} Dojos${month.new > 0 ? ` (+${month.new} neu)` : ''}`}
                        />
                        <span className="st-bar-lbl">{month.month}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="st-card">
              <div className="st-card-title">
                <PieChart size={13} />
                Plan-Verteilung
              </div>
              {Object.entries(PLAN_NAMES).map(([plan, label]) => {
                const count = stats.planDistribution?.[plan] || 0;
                if (count === 0 && (plan === 'trial' || plan === 'basic' || plan === 'free')) return null;
                const percent = stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) : 0;
                return (
                  <div key={plan} className="st-plan-row">
                    <span className={`plan-badge-mini plan-badge-mini--${plan}`} style={{ minWidth: 72, fontSize: '0.68rem' }}>{label}</span>
                    <span className="st-plan-count">{count}</span>
                    <div className="st-plan-bar-track">
                      <div className="st-plan-bar-fill" style={{ width: `${percent}%`, background: PLAN_COLORS?.[plan] || 'rgba(255,255,255,0.3)' }} />
                    </div>
                    <span className="st-plan-pct">{percent}%</span>
                  </div>
                );
              })}
              <div className="st-subsection-title">Einnahmen pro Plan</div>
              {Object.entries(PLAN_NAMES).map(([plan]) => {
                const count = stats.planDistribution?.[plan] || 0;
                const price = PLAN_PRICE_VALUES?.[plan] || 0;
                if (count === 0 || price === 0) return null;
                return (
                  <div key={plan} className="st-revenue-row">
                    <span className="st-revenue-plan">{PLAN_NAMES[plan]}</span>
                    <span className="st-revenue-calc">{count} × €{price}</span>
                    <span className="st-revenue-total">€{(count * price).toLocaleString('de-DE')}</span>
                  </div>
                );
              })}
            </div>

            {/* ── Row 3: Trial status + Registration cohort ─────────────────── */}
            <div className="st-card">
              <div className="st-card-title">
                <Clock size={13} />
                Trial-Status
              </div>
              <div className="st-trial-row">
                <span className="st-dot st-dot--green" />
                <span className="st-trial-label">Aktiv (&gt;7 Tage)</span>
                <span className="st-trial-val">{stats.activeTrials}</span>
              </div>
              <div className="st-trial-row">
                <span className="st-dot" style={{ background: '#fb923c' }} />
                <span className="st-trial-label">Bald ablaufend (≤7 Tage)</span>
                <span className="st-trial-val">{stats.expiringTrials}</span>
              </div>
              <div className="st-trial-row">
                <span className="st-dot st-dot--red" />
                <span className="st-trial-label">Abgelaufen</span>
                <span className="st-trial-val">{stats.expiredTrials}</span>
              </div>
              <div className="st-trial-row">
                <span className="st-dot st-dot--blue" />
                <span className="st-trial-label">Zahlend</span>
                <span className="st-trial-val">{stats.paid}</span>
              </div>
              <div className="st-trial-row" style={{ marginTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.4rem' }}>
                <span className="st-trial-label" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>Ø Trial-Dauer</span>
                <span className="st-trial-val" style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>–</span>
              </div>
            </div>

            <div className="st-card">
              <div className="st-card-title">
                <CreditCard size={13} />
                Neue Registrierungen
              </div>
              {(() => {
                const now = Date.now();
                const days = [7, 30, 60, 90, 180, 365];
                const labels = ['Letzte 7 Tage', '30 Tage', '60 Tage', '90 Tage', '180 Tage', '365 Tage'];
                const counts = days.map(d => dojos.filter(dj => dj.created_at && (now - new Date(dj.created_at).getTime()) <= d * 86400000).length);
                const maxC = Math.max(...counts, 1);
                const avgPerMonth = ((stats.newThisMonth || 0) + (stats.newLastMonth || 0)) / 2;
                return (
                  <>
                    {days.map((d, i) => (
                      <div key={d} className="st-cohort-row">
                        <span className="st-cohort-lbl">{labels[i]}</span>
                        <div className="st-cohort-bar">
                          <div className="st-cohort-bar-fill" style={{ width: `${(counts[i] / maxC) * 100}%` }} />
                        </div>
                        <span className="st-cohort-val">{counts[i]}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>
                      Ø pro Monat: <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>{avgPerMonth.toFixed(1)}</span>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* ── Row 4: MRR Aufschlüsselung (full width) ──────────────────── */}
            <div className="st-card st-full">
              <div className="st-card-title">
                <DollarSign size={13} />
                MRR &amp; Revenue
              </div>
              <div className="st-mini-metrics">
                <div className="st-mini-metric">
                  <span className="st-mini-val" style={{ color: '#ffd700' }}>€{stats.potentialMrr.toLocaleString('de-DE')}</span>
                  <span className="st-mini-lbl">pot. MRR</span>
                </div>
                <div className="st-mini-metric">
                  <span className="st-mini-val" style={{ color: '#86efac' }}>€{(stats.mrr || 0).toLocaleString('de-DE')}</span>
                  <span className="st-mini-lbl">akt. MRR</span>
                </div>
                <div className="st-mini-metric">
                  <span className="st-mini-val" style={{ color: '#ffd700' }}>€{(stats.potentialMrr * 12).toLocaleString('de-DE')}</span>
                  <span className="st-mini-lbl">ARR</span>
                </div>
                <div className="st-mini-metric">
                  <span className="st-mini-val">€{(stats.total - 1) > 0 ? (stats.potentialMrr / (stats.total - 1)).toFixed(0) : '0'}</span>
                  <span className="st-mini-lbl">Ø pro Dojo</span>
                </div>
              </div>
              {stats.mrrDetails.length > 0 ? (
                <table className="st-mrr-table">
                  <thead>
                    <tr>
                      <th>Dojo</th>
                      <th>Plan</th>
                      <th style={{ textAlign: 'right' }}>MRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.mrrDetails.map(d => (
                      <tr key={d.id}>
                        <td>{d.name}</td>
                        <td><span className={`plan-badge-mini plan-badge-mini--${d.plan}`}>{d.plan.toUpperCase()}</span></td>
                        <td>€{d.contribution.toLocaleString('de-DE')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="st-mrr-empty">Aktuell keine zahlenden Dojos.</div>
              )}
            </div>

            {/* ── Row 5: Top Dojos + Geographic ────────────────────────────── */}
            <div className="st-card">
              <div className="st-card-title">
                <Users size={13} />
                Top Dojos nach Mitglieder
              </div>
              {(() => {
                const sorted = [...dojos].sort((a, b) => (b.mitglieder_count || 0) - (a.mitglieder_count || 0)).slice(0, 5);
                const maxCount = sorted[0]?.mitglieder_count || 1;
                return sorted.map((d, i) => (
                  <div key={d.id} className="st-top-row">
                    <span className="st-top-rank">{String(i + 1).padStart(2, '0')}</span>
                    <span className="st-top-name">{d.dojoname}</span>
                    <span className={`plan-badge-mini plan-badge-mini--${d.plan || 'free'}`} style={{ fontSize: '0.62rem' }}>{(d.plan || 'free').toUpperCase()}</span>
                    <div className="st-top-bar">
                      <div className="st-top-bar-fill" style={{ width: `${((d.mitglieder_count || 0) / maxCount) * 100}%` }} />
                    </div>
                    <span className="st-top-val">{d.mitglieder_count || 0}</span>
                  </div>
                ));
              })()}
            </div>

            <div className="st-card">
              <div className="st-card-title">
                <MapPin size={13} />
                Geografisch
              </div>
              {(() => {
                const flagMap = { 'Deutschland': '🇩🇪', 'Österreich': '🇦🇹', 'Schweiz': '🇨🇭', 'Italien': '🇮🇹', 'USA': '🇺🇸', 'Frankreich': '🇫🇷', 'Spanien': '🇪🇸', 'Niederlande': '🇳🇱', 'Belgien': '🇧🇪', 'Polen': '🇵🇱' };
                const countries = Object.entries(stats.countryDistribution || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
                const maxC = countries[0]?.[1] || 1;
                return countries.map(([country, count]) => {
                  const pct = stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) : 0;
                  return (
                    <div key={country} className="st-geo-row">
                      <span className="st-geo-flag">{flagMap[country] || '🌍'}</span>
                      <span className="st-geo-name">{country}</span>
                      <div className="st-geo-bar"><div className="st-geo-fill" style={{ width: `${(count / maxC) * 100}%` }} /></div>
                      <span className="st-geo-cnt">{count}</span>
                      <span className="st-geo-pct">{pct}%</span>
                    </div>
                  );
                });
              })()}
              {(() => {
                const regions = Object.entries(stats.regionDistribution || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
                if (!regions.length) return null;
                return (
                  <>
                    <div className="st-subsection-title">Top Regionen</div>
                    {regions.map(([region, count]) => (
                      <div key={region} className="st-geo-row" style={{ fontSize: '0.72rem' }}>
                        <span className="st-geo-flag" style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>•</span>
                        <span className="st-geo-name">{region}</span>
                        <span className="st-geo-cnt">{count}</span>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>

            {/* ── Row 6: Health + Forecast ──────────────────────────────────── */}
            <div className="st-card">
              <div className="st-card-title">
                <Heart size={13} />
                System-Gesundheit
              </div>
              <div className="st-health-grid">
                <div className="st-health-tile healthy">
                  <div>
                    <div className="st-health-tile-val">{healthOverview.healthy}</div>
                    <div className="st-health-tile-lbl">Gesund</div>
                  </div>
                </div>
                <div className="st-health-tile warning">
                  <div>
                    <div className="st-health-tile-val">{healthOverview.warning}</div>
                    <div className="st-health-tile-lbl">Warnungen</div>
                  </div>
                </div>
                <div className="st-health-tile critical">
                  <div>
                    <div className="st-health-tile-val">{healthOverview.critical}</div>
                    <div className="st-health-tile-lbl">Kritisch</div>
                  </div>
                </div>
                <div className="st-health-tile score">
                  <div>
                    <div className="st-health-tile-val">{healthOverview.avgScore.toFixed(0)}%</div>
                    <div className="st-health-tile-lbl">Ø Score</div>
                  </div>
                </div>
              </div>
              {(healthOverview.critical > 0 || healthOverview.warning > 0) && (
                <>
                  <div className="st-subsection-title">Problematische Dojos</div>
                  {dojosWithHealth
                    .filter(d => d.health.status !== 'healthy')
                    .sort((a, b) => a.health.score - b.health.score)
                    .slice(0, 5)
                    .map(d => (
                      <div key={d.id} className="st-health-issue">
                        <span className="st-health-issue-name">{d.dojoname}</span>
                        <span className={`st-score-badge ${d.health.status}`}>{d.health.score}%</span>
                        <span className="st-health-msg">{d.health.allProblems?.[0]?.message || ''}</span>
                      </div>
                    ))}
                </>
              )}
            </div>

            <div className="st-card">
              <div className="st-card-title">
                <TrendingUp size={13} />
                Prognose 6 Monate
              </div>
              {[1, 2, 3, 4, 5, 6].map(month => {
                const avgGrowth = stats.avgMonthlyGrowth || stats.newThisMonth || 0.5;
                const projected = Math.round(stats.total + avgGrowth * month);
                const avgMrrPerDojo = (stats.total - 1) > 0 ? stats.potentialMrr / (stats.total - 1) : 49;
                const projectedMrr = Math.round(stats.potentialMrr + Math.round(avgGrowth * month) * avgMrrPerDojo);
                const monthName = new Date(new Date().setMonth(new Date().getMonth() + month)).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
                return (
                  <div key={month} className="st-forecast-row">
                    <span className="st-forecast-month">{monthName}</span>
                    <span className="st-forecast-dojos">{projected} Dojos</span>
                    <span className="st-forecast-mrr">€{projectedMrr.toLocaleString('de-DE')}</span>
                  </div>
                );
              })}
            </div>

            {/* ── Row 7: Goal + Storage ─────────────────────────────────────── */}
            <div className="st-card">
              <div className="st-card-title">
                <Flag size={13} />
                Ziel: {stats.goalDojos} Dojos
              </div>
              <div className="st-goal-nums">
                <span className="st-goal-cur">{stats.total}</span>
                <span className="st-goal-sep">/</span>
                <span className="st-goal-target">{stats.goalDojos}</span>
              </div>
              <div className="st-goal-bar">
                <div className="st-goal-fill" style={{ width: `${Math.min(stats.goalProgress, 100)}%` }} />
              </div>
              <div className="st-goal-meta">
                <span>{stats.goalProgress}% erreicht</span>
                <span>Noch {stats.dojosToGoal} Dojos</span>
              </div>
              <div className="st-goal-eta">
                {stats.monthsToGoal ? (
                  <>
                    ETA: <strong>{stats.estimatedGoalDate?.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</strong>
                    {' '}(~{stats.monthsToGoal} Mo. bei Ø {stats.avgMonthlyGrowth?.toFixed(1)}/Mo.)
                  </>
                ) : (
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>Kein Wachstum – ETA nicht berechenbar</span>
                )}
              </div>
            </div>

            <div className="st-card">
              <div className="st-card-title">
                <HardDrive size={13} />
                Speicherplatz
              </div>
              <div className="st-storage-summary">
                <div className="st-storage-tile">
                  <div className="st-storage-val">{stats.totalStorageMB.toFixed(1)} MB</div>
                  <div className="st-storage-lbl">Gesamt</div>
                </div>
                <div className="st-storage-tile">
                  <div className="st-storage-val">{stats.avgStorageMB.toFixed(1)} MB</div>
                  <div className="st-storage-lbl">Ø pro Dojo</div>
                </div>
                <div className="st-storage-tile">
                  <div className="st-storage-val">{parseFloat(stats.maxStorageDojo?.storage_mb || 0).toFixed(1)} MB</div>
                  <div className="st-storage-lbl">{stats.maxStorageDojo?.dojoname || '–'}</div>
                </div>
              </div>
              {[...dojos]
                .sort((a, b) => (parseFloat(b.storage_mb) || 0) - (parseFloat(a.storage_mb) || 0))
                .slice(0, 8)
                .map(d => {
                  const mb = parseFloat(d.storage_mb) || 0;
                  const kb = d.storage_kb || 0;
                  const maxMb = parseFloat(stats.maxStorageDojo?.storage_mb) || 1;
                  const pct = (mb / Math.max(maxMb, 1)) * 100;
                  const fillClass = mb > 500 ? 'warn' : mb > 100 ? 'med' : '';
                  return (
                    <div key={d.id} className="st-storage-row">
                      <span className="st-storage-name">{d.dojoname}</span>
                      <div className="st-storage-track">
                        <div className={`st-storage-fill ${fillClass}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="st-storage-size">{kb >= 1024 ? `${mb.toFixed(1)} MB` : `${kb} KB`}</span>
                    </div>
                  );
                })}
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
                              className="btn btn-sm btn-ghost"
                              onClick={() => handleSelectDojo(dojo)}
                            >
                              Details
                            </button>
                            {isTrial && (
                              <button
                                className="btn btn-sm btn-success"
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

            {/* Plan Settings Card */}
            {(() => {
              const dbPlan = subscriptionPlans.find(p => p.plan_name === activePlanTab);
              const currentPrices = editingPlanPrices[activePlanTab] || {
                price_monthly: dbPlan?.price_monthly || 0,
                price_yearly: dbPlan?.price_yearly || 0,
                max_members: dbPlan?.max_members || null,
                is_visible: dbPlan?.is_visible ?? true
              };
              const planIcons = { trial: '🎁', basic: '📦', free: '🆓', starter: '🚀', professional: '💼', premium: '⭐', enterprise: '🏢' };

              return (
                <div className="plan-settings-card">
                  {/* Zeile 1: Plan-Name + Sichtbarkeit + Speichern */}
                  <div className="psc-header">
                    <div className="psc-plan-name">
                      <span className="psc-icon">{planIcons[activePlanTab]}</span>
                      <span className="psc-title">{PLAN_NAMES[activePlanTab]}</span>
                      <span className="psc-feature-count">
                        {(planFeatures[activePlanTab] || []).length} / {allFeatures.length} Features
                      </span>
                    </div>
                    <div className="psc-actions">
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
                          <Check size={14} /> Preise speichern
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Zeile 2: Preisfelder + Filter */}
                  <div className="psc-body">
                    <div className="psc-price-fields">
                      <div className="psc-field">
                        <label>Monatspreis</label>
                        <div className="psc-input-wrap">
                          <input
                            type="number"
                            min="0"
                            value={currentPrices.price_monthly}
                            onChange={(e) => setEditingPlanPrices(prev => ({
                              ...prev,
                              [activePlanTab]: { ...currentPrices, price_monthly: parseFloat(e.target.value) || 0 }
                            }))}
                          />
                          <span className="psc-unit">€</span>
                        </div>
                      </div>
                      <div className="psc-field">
                        <label>Jahrespreis</label>
                        <div className="psc-input-wrap">
                          <input
                            type="number"
                            min="0"
                            value={currentPrices.price_yearly}
                            onChange={(e) => setEditingPlanPrices(prev => ({
                              ...prev,
                              [activePlanTab]: { ...currentPrices, price_yearly: parseFloat(e.target.value) || 0 }
                            }))}
                          />
                          <span className="psc-unit">€</span>
                        </div>
                      </div>
                      <div className="psc-field">
                        <label>Max. Mitglieder</label>
                        <div className="psc-input-wrap">
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
                    <div className="psc-filters">
                      <span className="psc-filter-label">Anzeigen:</span>
                      <button onClick={() => setFeatureStatusFilter('all')} className={`psb-filter ${featureStatusFilter === 'all' ? 'active' : ''}`}>Alle</button>
                      <button onClick={() => setFeatureStatusFilter('active')} className={`psb-filter ${featureStatusFilter === 'active' ? 'active' : ''}`}>✓ Aktiv</button>
                      <button onClick={() => setFeatureStatusFilter('inactive')} className={`psb-filter ${featureStatusFilter === 'inactive' ? 'active' : ''}`}>✕ Inaktiv</button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Features Grid - 2-3 pro Zeile */}
            <div className="features-grid-compact">
              {(() => {
                // Sortiere Features: Aktivierte zuerst
                const sortedFeatures = [...allFeatures].sort((a, b) => {
                  const aIncluded = (planFeatures[activePlanTab] || []).includes(a.id);
                  const bIncluded = (planFeatures[activePlanTab] || []).includes(b.id);
                  if (aIncluded && !bIncluded) return -1;
                  if (!aIncluded && bIncluded) return 1;
                  return 0;
                });

                // Filtere Features basierend auf Status
                const filteredFeatures = sortedFeatures.filter(feature => {
                  const isIncluded = (planFeatures[activePlanTab] || []).includes(feature.id);
                  if (featureStatusFilter === 'active') return isIncluded;
                  if (featureStatusFilter === 'inactive') return !isIncluded;
                  return true; // 'all'
                });

                return filteredFeatures.map(feature => {
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
                });
              })()}
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
                  <div className="form-group full-width">
                    <label>📋 In welchen Plänen soll das Feature verfügbar sein?</label>
                    <div className="plan-checkboxes">
                      {[
                        { key: 'trial', icon: '🎁' },
                        { key: 'basic', icon: '📦' },
                        { key: 'free', icon: '🆓' },
                        { key: 'starter', icon: '🚀' },
                        { key: 'professional', icon: '💼' },
                        { key: 'premium', icon: '⭐' },
                        { key: 'enterprise', icon: '🏢' },
                      ].map(({ key, icon }) => (
                        <label key={key} className={`plan-checkbox-label ${newFeature.plans.includes(key) ? 'checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={newFeature.plans.includes(key)}
                            onChange={(e) => setNewFeature(prev => ({
                              ...prev,
                              plans: e.target.checked
                                ? [...prev.plans, key]
                                : prev.plans.filter(p => p !== key)
                            }))}
                          />
                          {icon} {PLAN_NAMES[key]}
                          <span className="pcl-price">{PLAN_PRICES[key]}</span>
                        </label>
                      ))}
                    </div>
                    {newFeature.plans.length === 0 && (
                      <p className="plan-warning">⚠️ Kein Plan ausgewählt — Feature ist für niemanden sichtbar!</p>
                    )}
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
                const isExpanded = expandedFeatureId === feature.id;
                return (
                  <div
                    key={feature.id}
                    className={`feature-card-mini ${isExpanded ? 'fcm-expanded' : ''}`}
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
                      {feature.files && feature.files.length > 0 && (
                        <button
                          className={`fcm-files-btn ${isExpanded ? 'active' : ''}`}
                          onClick={() => setExpandedFeatureId(isExpanded ? null : feature.id)}
                          title="Beteiligte Dateien anzeigen"
                        >
                          <FileText size={12} />
                          Dateien
                        </button>
                      )}
                      <button
                        className={`fcm-public-btn ${isPublic ? 'visible' : 'hidden'}`}
                        onClick={async () => {
                          const newIsPublic = !isPublic;
                          setAllFeatures(prev => prev.map(f =>
                            f.id === feature.id ? { ...f, is_public: newIsPublic } : f
                          ));
                          try {
                            await fetchWithAuth(`${config.apiBaseUrl}/admin/features/${feature.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ is_public: newIsPublic })
                            });
                          } catch (e) {
                            console.error('is_public speichern fehlgeschlagen:', e);
                          }
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
                            fetchWithAuth(`${config.apiBaseUrl}/admin/features/${feature.id}`, { method: 'DELETE' })
                              .catch(e => console.error('Feature löschen fehlgeschlagen:', e));
                          }
                        }}
                        title="Löschen"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {isExpanded && feature.files && (
                      <div className="fcm-files-panel">
                        <div className="fcm-files-title">📂 Beteiligte Dateien</div>
                        <div className="fcm-files-list">
                          {feature.files.map((file, i) => {
                            const isBackend = file.startsWith('backend/');
                            return (
                              <span key={i} className={`fcm-file-tag ${isBackend ? 'fcm-file-tag--backend' : 'fcm-file-tag--frontend'}`}>
                                {isBackend ? '⚙️' : '⚛️'} {file}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
                className="logout-button"
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
                          className={`btn-plan btn-plan--${plan}`}
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

            {/* Plan Comparison */}
            {(() => {
              const PAID_PLANS = ['starter', 'professional', 'premium', 'enterprise'];
              const currentPlan = selectedDojo.subscription_plan || selectedDojo.plan_type || 'trial';
              return (
                <div className="pct-wrap">
                  <h4
                    style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom: showPlanVergleich ? '0.75rem' : 0, cursor:'pointer', userSelect:'none' }}
                    onClick={() => setShowPlanVergleich(v => !v)}
                  >
                    <TrendingUp size={16} /> Plan-Vergleich & Upgrade
                    <span style={{ marginLeft:'auto', fontSize:'0.75rem', color:'var(--text-secondary,#9ca3af)', fontWeight:400 }}>
                      {showPlanVergleich ? '▲ Einklappen' : '▼ Ausklappen'}
                    </span>
                  </h4>

                  {showPlanVergleich && (
                    <>
                      {/* Plan-Header-Karten */}
                      <div className="pct-header-row">
                        <div className="pct-feature-col" />
                        {PAID_PLANS.map(plan => {
                          const isCurrent = plan === currentPlan;
                          const dbPlan = subscriptionPlans.find(p => p.plan_name === plan);
                          const price = dbPlan?.price_monthly ? `${dbPlan.price_monthly}€` : PLAN_PRICES[plan]?.replace('/Monat','') || '–';
                          return (
                            <div key={plan} className={`pct-plan-col ${isCurrent ? 'pct-current' : ''}`}>
                              <div className="pct-plan-name" style={{ color: PLAN_COLORS[plan] }}>{PLAN_NAMES[plan]}</div>
                              <div className="pct-plan-price">{price}<span>/Mo</span></div>
                              {isCurrent
                                ? <span className="pct-badge-current">Aktiv</span>
                                : <button className="pct-btn-upgrade" style={{ borderColor: PLAN_COLORS[plan], color: PLAN_COLORS[plan] }} onClick={() => handleActivatePlan(selectedDojo.id, plan)}>Wechseln</button>
                              }
                            </div>
                          );
                        })}
                      </div>

                      {/* Feature-Zeilen */}
                      <div className="pct-body">
                        {allFeatures.map((feature, idx) => (
                          <div key={feature.id} className={`pct-row ${idx % 2 === 0 ? 'pct-row-even' : ''}`}>
                            <div className="pct-feature-col">
                              <span className="pct-feature-icon">{feature.emoji}</span>
                              <span className="pct-feature-name">{feature.label}</span>
                              {featureOverrides[feature.id] && <span className="pct-active-dot" title="Für dieses Dojo aktiv" />}
                            </div>
                            {PAID_PLANS.map(plan => {
                              const ok = (planFeatures[plan] || []).includes(feature.id);
                              const isCurrent = plan === currentPlan;
                              return (
                                <div key={plan} className={`pct-cell ${isCurrent ? 'pct-cell-current' : ''}`}>
                                  {ok
                                    ? <CheckCircle size={15} style={{ color:'#4ade80' }} />
                                    : <XCircle size={15} style={{ color:'rgba(255,255,255,0.15)' }} />
                                  }
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Lizenzverträge */}
            <div className="pct-wrap" style={{ marginTop:'1rem' }}>
              <h4 style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.75rem', justifyContent:'space-between' }}>
                <span style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>📄 Unterzeichnete Lizenzverträge</span>
                <button
                  className="pct-btn-upgrade"
                  onClick={() => loadDojoVertraege(selectedDojo.id)}
                  style={{ fontSize:'0.72rem', padding:'0.15rem 0.5rem' }}
                >Aktualisieren</button>
              </h4>
              {dojoVertraegeLoading ? (
                <div style={{ padding:'1rem 0', fontSize:'0.85rem', color:'var(--text-secondary,#9ca3af)', textAlign:'center' }}>Lädt...</div>
              ) : dojoVertraege.length === 0 ? (
                <p style={{ fontSize:'0.85rem', margin:'0.5rem 0', color:'var(--text-secondary,#9ca3af)', fontStyle:'italic' }}>Noch keine signierten Verträge für dieses Dojo.</p>
              ) : (
                <table className="lv-sig-table" style={{ width:'100%' }}>
                  <thead>
                    <tr>
                      <th>Datum</th>
                      <th>Unterzeichner</th>
                      <th>Plan</th>
                      <th>Abrechnung</th>
                      <th>IP-Adresse</th>
                      <th>Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dojoVertraege.map(v => (
                      <tr key={v.id}>
                        <td style={{ fontSize:'0.8rem' }}>{new Date(v.signed_at).toLocaleString('de-DE')}</td>
                        <td style={{ fontSize:'0.8rem' }}>{v.signed_by || '–'}</td>
                        <td><span className={`plan-badge plan-badge--${v.plan}`}>{v.plan}</span></td>
                        <td style={{ fontSize:'0.8rem' }}>{v.interval_type}</td>
                        <td className="lv-sig-ip">{v.ip_address}</td>
                        <td>
                          {v.has_file ? (
                            <button
                              className="pct-btn-upgrade"
                              style={{ fontSize:'0.72rem', padding:'0.15rem 0.5rem', display:'inline-flex', alignItems:'center', gap:'0.25rem' }}
                              onClick={async () => {
                                try {
                                  const r = await fetchWithAuth(`${config.apiBaseUrl}/admin/lizenzvertrag/download/${v.id}`);
                                  const blob = await r.blob();
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = v.pdf_filename || `Lizenzvertrag_${v.id}.pdf`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                } catch (e) {
                                  alert('Download fehlgeschlagen: ' + e.message);
                                }
                              }}
                            >⬇ PDF</button>
                          ) : (
                            <span style={{ fontSize:'0.75rem', color:'#555' }}>–</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
                  <table className="addon-prices-table">
                    <thead>
                      <tr>
                        <th>Feature</th>
                        <th>Monat €</th>
                        <th>Jahr €</th>
                        <th>Trial-Tage</th>
                        <th>Trial</th>
                        <th>Addon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {addonPrices.map(price => (
                        <tr key={price.feature_id}>
                          <td className="apt-feature">
                            <span className="apt-icon">{price.feature_icon}</span>
                            <span className="apt-name">{price.feature_name}</span>
                          </td>
                          <td>
                            <input
                              type="number"
                              className="apt-input"
                              defaultValue={price.monthly_price}
                              min="0"
                              step="0.01"
                              onBlur={(e) => handleUpdateAddonPrice(price.feature_id, {
                                ...price,
                                monthly_price: parseFloat(e.target.value)
                              })}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="apt-input"
                              defaultValue={price.yearly_price}
                              min="0"
                              step="0.01"
                              onBlur={(e) => handleUpdateAddonPrice(price.feature_id, {
                                ...price,
                                yearly_price: parseFloat(e.target.value)
                              })}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="apt-input apt-input--small"
                              defaultValue={price.trial_days}
                              min="0"
                              max="30"
                              onBlur={(e) => handleUpdateAddonPrice(price.feature_id, {
                                ...price,
                                trial_days: parseInt(e.target.value)
                              })}
                            />
                          </td>
                          <td className="apt-toggle-cell">
                            <input
                              type="checkbox"
                              defaultChecked={price.trial_enabled}
                              onChange={(e) => handleUpdateAddonPrice(price.feature_id, {
                                ...price,
                                trial_enabled: e.target.checked
                              })}
                            />
                          </td>
                          <td className="apt-toggle-cell">
                            <input
                              type="checkbox"
                              defaultChecked={price.addon_enabled}
                              onChange={(e) => handleUpdateAddonPrice(price.feature_id, {
                                ...price,
                                addon_enabled: e.target.checked
                              })}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
        {/* Demo-Buchungen Tab */}
        {activeTab === 'buchungen' && (
          <div className="tab-content">
            <DemoTermine />
          </div>
        )}

        {/* Dokumente Tab */}
        {activeTab === 'dokumente' && (
          <div className="tab-content">
            <LizenzDokumente dojos={dojos} />
          </div>
        )}

        {/* Akquise Tab */}
        {activeTab === 'akquise' && (
          <div className="tab-content">
            <AkquiseDashboard />
          </div>
        )}

      </div>
    </div>
  );
};

export default DojoLizenzverwaltung;
