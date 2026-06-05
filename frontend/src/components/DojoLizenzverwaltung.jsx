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
import LizenzStatisticsTab from './LizenzStatisticsTab';
import LizenzFeaturesTab from './LizenzFeaturesTab';
import LizenzVergleichTab from './LizenzVergleichTab';
import LizenzDetailsTab from './LizenzDetailsTab';
import LizenzOverviewTab from './LizenzOverviewTab';
import LizenzAblaufTab from './LizenzAblaufTab';
import LizenzListTab from './LizenzListTab';
import LizenzPlansTab from './LizenzPlansTab';
import LizenzTrialsTab from './LizenzTrialsTab';
import LizenzAuditTab from './LizenzAuditTab';
import LizenzSettingsTab from './LizenzSettingsTab';
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
  trial: ['mitgliederverwaltung', 'online_registrierung', 'mitglieder_portal', 'checkin', 'sepa', 'pruefungen', 'vertraege', 'familien', 'verkauf', 'dashboard', 'stundenplan', 'kommunikation', 'benachrichtigungen', 'dokumente', 'sicherheit', 'buchfuehrung', 'api', 'interessenten', 'probetraining', 'events', 'ruhepause', 'mahnwesen', 'auswertungen', 'wettbewerb', 'badges', 'wallet_pass', 'freunde_werben', 'chat', 'lernplattform', 'eltern_portal', 'trainer_stunden', 'marketing', 'ausruestung', 'kalender_abo', 'externe_chats', 'homepage_builder', 'gutscheine', 'ki_chat', 'kontoauszug', 'social_media', 'training'],
  basic: ['mitgliederverwaltung', 'checkin', 'dashboard', 'sicherheit'],
  free: ['mitgliederverwaltung', 'checkin', 'dashboard', 'sicherheit'],
  // Starter: Kern-Operations
  starter: ['mitgliederverwaltung', 'online_registrierung', 'mitglieder_portal', 'checkin', 'sepa', 'pruefungen', 'vertraege', 'dashboard', 'benachrichtigungen', 'sicherheit', 'interessenten', 'probetraining', 'mahnwesen', 'badges', 'wallet_pass', 'freunde_werben', 'stundenplan', 'kalender_abo'],
  // Professional: Wachstums-Tools
  professional: ['mitgliederverwaltung', 'online_registrierung', 'mitglieder_portal', 'checkin', 'sepa', 'pruefungen', 'vertraege', 'familien', 'verkauf', 'dashboard', 'stundenplan', 'kommunikation', 'benachrichtigungen', 'dokumente', 'sicherheit', 'interessenten', 'probetraining', 'events', 'ruhepause', 'mahnwesen', 'auswertungen', 'badges', 'wallet_pass', 'freunde_werben', 'chat', 'marketing', 'ausruestung', 'kalender_abo'],
  // Premium: Vollausstattung
  premium: ['mitgliederverwaltung', 'online_registrierung', 'mitglieder_portal', 'checkin', 'sepa', 'pruefungen', 'vertraege', 'familien', 'verkauf', 'dashboard', 'stundenplan', 'kommunikation', 'benachrichtigungen', 'dokumente', 'sicherheit', 'buchfuehrung', 'api', 'interessenten', 'probetraining', 'events', 'ruhepause', 'mahnwesen', 'auswertungen', 'wettbewerb', 'badges', 'wallet_pass', 'freunde_werben', 'chat', 'lernplattform', 'eltern_portal', 'trainer_stunden', 'marketing', 'ausruestung', 'kalender_abo', 'externe_chats'],
  // Enterprise: Franchise & Multi-Standort — alle Features inkl. exklusive Enterprise-Features
  enterprise: ['mitgliederverwaltung', 'online_registrierung', 'mitglieder_portal', 'checkin', 'sepa', 'pruefungen', 'vertraege', 'familien', 'verkauf', 'dashboard', 'stundenplan', 'kommunikation', 'benachrichtigungen', 'multidojo', 'dokumente', 'api', 'sicherheit', 'buchfuehrung', 'kontoauszug', 'interessenten', 'probetraining', 'events', 'ruhepause', 'mahnwesen', 'auswertungen', 'wettbewerb', 'whitelabel', 'badges', 'wallet_pass', 'freunde_werben', 'chat', 'lernplattform', 'eltern_portal', 'trainer_stunden', 'marketing', 'social_media', 'ausruestung', 'entwicklungsziele', 'kalender_abo', 'externe_chats', 'homepage_builder', 'gutscheine', 'ki_chat', 'training']
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
  {
    id: 'gutscheine',
    label: 'Gutschein-System',
    description: 'Gutscheine erstellen, an Mitglieder verknüpfen, direkt an der Kasse einlösen — inkl. Teileinlösung und Homepage-Widget',
    emoji: '🎁',
    files: ['GutscheineVerwaltung.jsx', 'VerkaufKasse.jsx', 'MemberDashboard.jsx', 'backend/routes/gutscheine.js']
  },
  {
    id: 'ki_chat',
    label: 'KI-Chat Widget',
    description: 'Intelligenter KI-Assistent für die eigene Homepage — kennt Tarife, Trainingszeiten und Kampfkünste, antwortet automatisch auf Besucher-Anfragen',
    emoji: '🤖',
    files: ['KiChatEinstellungen.jsx', 'backend/routes/visitor-chat.js']
  },
  {
    id: 'kontoauszug',
    label: 'Bank-Import & Kontoabgleich',
    description: 'Kontoauszüge importieren, Zahlungseingänge automatisch zuordnen, offene Posten abgleichen',
    emoji: '🏦',
    files: ['KontoauszugImport.jsx', 'backend/routes/kontoauszug.js']
  },
  {
    id: 'social_media',
    label: 'Social Media Hub',
    description: 'KI-generierte Posts für Instagram, Facebook & TikTok direkt aus der Software erstellen und planen',
    emoji: '📱',
    files: ['MarketingKiContent.jsx', 'MarketingHub.jsx', 'backend/routes/marketing.js']
  },
  {
    id: 'training',
    label: 'Trainings-Dashboard',
    description: 'Trainingseinheiten erfassen, Auslastung messen, Kurs-Statistiken und Anwesenheitsanalysen',
    emoji: '🥋',
    files: ['TrainingDashboard.jsx', 'backend/routes/training.js']
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

  // Bulk-Selektion
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDays, setBulkDays] = useState(14);

  // Ablauf-Übersicht
  const [ablaufData, setAblaufData] = useState({ trials: [], abos: [] });
  const [ablaufLoading, setAblaufLoading] = useState(false);
  const [ablaufDays, setAblaufDays] = useState(30);

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

  const handleBulkExtendTrial = async (days) => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Trial für ${selectedIds.size} Dojo(s) um ${days} Tage verlängern?`)) return;
    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/admin/dojos/bulk-extend-trial`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dojo_ids: Array.from(selectedIds), days })
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler');
      setMessage({ type: 'success', text: `${data.updated} Trial(s) um ${days} Tage verlängert` });
      setSelectedIds(new Set());
      loadDojos();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const loadAblauf = async (days = ablaufDays) => {
    setAblaufLoading(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/admin/subscriptions/ablauf?days=${days}`);
      const data = await res.json();
      setAblaufData({ trials: data.trials || [], abos: data.abos || [] });
    } catch (e) {
      setMessage({ type: 'error', text: 'Fehler beim Laden der Ablauf-Übersicht' });
    } finally {
      setAblaufLoading(false);
    }
  };

  const handleRenewSubscription = async (dojoId, dojoname) => {
    if (!confirm(`Abo von „${dojoname}" um ein Intervall verlängern?`)) return;
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/admin/dojos/${dojoId}/renew-subscription`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fehler');
      setMessage({ type: 'success', text: data.message });
      loadAblauf();
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
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
        <button className={`lnav-btn ${activeTab === 'ablauf' ? 'active' : ''}`} onClick={() => { setActiveTab('ablauf'); loadAblauf(); }}
          style={{ position: 'relative' }}>
          <Clock size={13} /> Ablauf
          {(ablaufData.trials.length + ablaufData.abos.length) > 0 && (
            <span className="lnav-count" style={{ background: '#ef4444' }}>{ablaufData.trials.length + ablaufData.abos.length}</span>
          )}
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
          <LizenzOverviewTab
            dojos={dojos}
            handleSelectDojo={handleSelectDojo}
            stats={stats}
            getPlanBadge={getPlanBadge}
            getStatusBadge={getStatusBadge}
          />
        )}

        {/* Ablauf Tab */}
        {activeTab === 'ablauf' && (
          <LizenzAblaufTab
            dojos={dojos}
            ablaufData={ablaufData}
            ablaufLoading={ablaufLoading}
            ablaufDays={ablaufDays}
            setAblaufDays={setAblaufDays}
            handleExtendTrial={handleExtendTrial}
            loadAblauf={loadAblauf}
            handleRenewSubscription={handleRenewSubscription}
          />
        )}

        {/* Statistics Tab */}
        {activeTab === 'statistics' && (
          <LizenzStatisticsTab
            dojos={dojos} message={message} stats={stats}
            dojosWithHealth={dojosWithHealth} healthOverview={healthOverview}
          />
        )}

        {/* List Tab */}
        {activeTab === 'list' && (
          <LizenzListTab
            dojos={dojos}
            loading={loading}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            bulkDays={bulkDays}
            setBulkDays={setBulkDays}
            handleSelectDojo={handleSelectDojo}
            handleExtendTrial={handleExtendTrial}
            handleBulkExtendTrial={handleBulkExtendTrial}
            handleExportCSV={handleExportCSV}
            filteredDojos={filteredDojos}
            getPlanBadge={getPlanBadge}
            getStatusBadge={getStatusBadge}
            formatDate={formatDate}
          />
        )}

        {/* Plans Tab - Kompakt mit allen 7 Plänen */}
        {activeTab === 'plans' && (
          <LizenzPlansTab
            message={message}
            setMessage={setMessage}
            allFeatures={allFeatures}
            planFeatures={planFeatures}
            setPlanFeatures={setPlanFeatures}
            subscriptionPlans={subscriptionPlans}
            editingPlanPrices={editingPlanPrices}
            setEditingPlanPrices={setEditingPlanPrices}
            activePlanTab={activePlanTab}
            setActivePlanTab={setActivePlanTab}
            featureStatusFilter={featureStatusFilter}
            setFeatureStatusFilter={setFeatureStatusFilter}
            savePlanPrices={savePlanPrices}
          />
        )}

        {/* Features Management Tab - Neu mit Plan-Tabs */}
        {activeTab === 'features' && (
          <LizenzFeaturesTab
            allFeatures={allFeatures}
            setAllFeatures={setAllFeatures}
            showAddFeature={showAddFeature}
            setShowAddFeature={setShowAddFeature}
            expandedFeatureId={expandedFeatureId}
            setExpandedFeatureId={setExpandedFeatureId}
            newFeature={newFeature}
            setNewFeature={setNewFeature}
            editingFeature={editingFeature}
            setEditingFeature={setEditingFeature}
            planFeatures={planFeatures}
            handleAddFeature={handleAddFeature}
            handleEditFeature={handleEditFeature}
            handleSaveEditFeature={handleSaveEditFeature}
          />
        )}

        {/* Vergleich (Comparison) Tab */}
        {activeTab === 'vergleich' && (
          <LizenzVergleichTab
            loading={loading}
            comparisonData={comparisonData}
            comparisonLoading={comparisonLoading}
            editingItemId={editingItemId}
            setEditingItemId={setEditingItemId}
            showAddCategory={showAddCategory}
            setShowAddCategory={setShowAddCategory}
            showAddCompetitor={showAddCompetitor}
            setShowAddCompetitor={setShowAddCompetitor}
            showAddItem={showAddItem}
            setShowAddItem={setShowAddItem}
            newCategory={newCategory}
            setNewCategory={setNewCategory}
            newCompetitor={newCompetitor}
            setNewCompetitor={setNewCompetitor}
            newItem={newItem}
            setNewItem={setNewItem}
            handleUpdateRating={handleUpdateRating}
            handleAddComparisonItem={handleAddComparisonItem}
            handleDeleteComparisonItem={handleDeleteComparisonItem}
            handleAddCategory={handleAddCategory}
            handleAddCompetitor={handleAddCompetitor}
            getRatingIcon={getRatingIcon}
          />
        )}

        {/* Details Tab */}
        {activeTab === 'details' && selectedDojo && (
          <LizenzDetailsTab
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            selectedDojo={selectedDojo}
            setSelectedDojo={setSelectedDojo}
            message={message}
            featureOverrides={featureOverrides}
            allFeatures={allFeatures}
            planFeatures={planFeatures}
            subscriptionPlans={subscriptionPlans}
            dojoVertraege={dojoVertraege}
            dojoVertraegeLoading={dojoVertraegeLoading}
            showPlanVergleich={showPlanVergleich}
            setShowPlanVergleich={setShowPlanVergleich}
            loadDojoVertraege={loadDojoVertraege}
            handleExtendTrial={handleExtendTrial}
            handleActivatePlan={handleActivatePlan}
            handleToggleDojoActive={handleToggleDojoActive}
            getPlanBadge={getPlanBadge}
            getStatusBadge={getStatusBadge}
            formatDate={formatDate}
            getRegistrationUrl={getRegistrationUrl}
          />
        )}

        {/* Feature-Trials Tab */}
        {activeTab === 'trials' && (
          <LizenzTrialsTab
            dojos={dojos}
            loading={loading}
            message={message}
            setMessage={setMessage}
            allFeatures={allFeatures}
            featureTrials={featureTrials}
            featureTrialsLoading={featureTrialsLoading}
            trialStats={trialStats}
            addonPrices={addonPrices}
            selectedTrialDojo={selectedTrialDojo}
            setSelectedTrialDojo={setSelectedTrialDojo}
            handleStartTrial={handleStartTrial}
            handleEndTrial={handleEndTrial}
            handleProcessExpiredTrials={handleProcessExpiredTrials}
            handleUpdateAddonPrice={handleUpdateAddonPrice}
            stats={stats}
          />
        )}

        {/* Audit-Log Tab */}
        {activeTab === 'audit' && (
          <LizenzAuditTab
            loading={loading}
            auditLogs={auditLogs}
            auditLogsLoading={auditLogsLoading}
            getPlanBadge={getPlanBadge}
          />
        )}

        {/* SaaS Settings Tab */}
        {activeTab === 'settings' && (
          <LizenzSettingsTab
            loading={loading}
            message={message}
            saasSettings={saasSettings}
            saasCategories={saasCategories}
            saasSettingsLoading={saasSettingsLoading}
            saasSettingsSaving={saasSettingsSaving}
            editedSettings={editedSettings}
            testResults={testResults}
            handleSettingChange={handleSettingChange}
            saveSaasSettings={saveSaasSettings}
            testStripeConnection={testStripeConnection}
            testEmailConnection={testEmailConnection}
            clearSettingsCache={clearSettingsCache}
            getCategoryLabel={getCategoryLabel}
            getCategoryIcon={getCategoryIcon}
          />
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

        {/* Akquise Tab — umgezogen in den Haupt-Tab „🗂️ Kontakte" (zentrale Kontaktdatenbank) */}
        {activeTab === 'akquise' && (
          <div className="tab-content">
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗂️</div>
              <h3 style={{ margin: '0 0 8px' }}>Die Akquise ist umgezogen</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 460, margin: '0 auto 18px' }}>
                Alle Kontakte (Akquise, Events, Verband, Veranstaltungen) findest du jetzt zentral
                im Haupt-Tab <strong>„Kontakte"</strong> des Super-Admin-Dashboards.
              </p>
              <button
                className="btn-primary"
                onClick={() => window.dispatchEvent(new CustomEvent('sa-navigate', { detail: { tab: 'kontakte' } }))}
              >
                Zu den Kontakten →
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default DojoLizenzverwaltung;
