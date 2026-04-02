import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Mail, Bell, Settings, Send, Users, History, FileText, CheckCircle, XCircle, Clock, Newspaper, BookOpen } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts';
import '../styles/NotificationSystem.css';
import config from '../config/config.js';
import { useDojoContext } from '../context/DojoContext';
import { useAuth } from '../context/AuthContext.jsx';
import { jwtDecode } from 'jwt-decode';
import { createSafeHtml } from '../utils/sanitizer';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import NewsVerwaltung from './NewsVerwaltung';


const NotificationSystem = () => {
  const { activeDojo, filter, dojos } = useDojoContext();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Kurs-Nachricht State
  const [kurseList, setKurseList] = useState([]);
  const [kursDropdownOpen, setKursDropdownOpen] = useState(false);
  const [kursNachricht, setKursNachricht] = useState({ kursId: '', betreff: '', text: '' });
  const [kursNachrichtSending, setKursNachrichtSending] = useState(false);
  const [kursNachrichtResult, setKursNachrichtResult] = useState(null);

  // Prüfe ob User Haupt-Admin ist (für News-Feature)
  let isMainAdmin = false;
  try {
    if (token) {
      const decoded = jwtDecode(token);
      isMainAdmin = decoded.id === 1 || decoded.user_id === 1 || decoded.username === 'admin';
    }
  } catch (error) {
    console.error('Token decode error:', error);
  }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Dashboard State
  const [dashboardData, setDashboardData] = useState({
    stats: {},
    recentNotifications: [],
    settings: {}
  });
  
  // Settings State
  const [settings, setSettings] = useState({
    email_enabled: false,
    push_enabled: false,
    email_config: {
      protocol: 'smtp', // smtp, pop3, imap
      smtp_host: '', // Postausgangsserver
      smtp_port: 587,
      imap_host: '', // Posteingangsserver (IMAP)
      imap_port: 993,
      pop3_host: '', // Posteingangsserver (POP3)
      pop3_port: 995,
      smtp_secure: false,
      smtp_user: '',
      smtp_password: ''
    },
    push_config: {},
    default_from_email: '',
    default_from_name: 'Dojo Software'
  });
  
  // Email State
  const [emailData, setEmailData] = useState({
    recipients: [],
    subject: '',
    message: '',
    template_type: 'general'
  });
  
  // Push State
  const [pushData, setPushData] = useState({
    recipients: [],
    title: '',
    message: '',
    icon: '',
    badge: '',
    url: '',
    send_to_chat: false
  });
  
  // Push Subscriptions State
  const [pushSubscriptions, setPushSubscriptions] = useState([]);

  // Member Search State
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedIndividuals, setSelectedIndividuals] = useState([]);

  // Recipients State
  const [recipients, setRecipients] = useState({
    mitglieder: [],
    trainer: [],
    personal: [],
    admin: [],
    alle: []
  });
  
  // Templates State
  const [templates, setTemplates] = useState([]);
  
  // History State
  const [history, setHistory] = useState({
    notifications: [],
    pagination: {}
  });

  // Expanded recipients state
  const [expandedNotifications, setExpandedNotifications] = useState({});

  // Timeline data state
  const [timelineData, setTimelineData] = useState([]);

  // ===================================================================
  // 📊 DATA LOADING
  // ===================================================================

  useEffect(() => {
    loadDashboardData();
    loadSettings();
    loadRecipients();
    loadTemplates();
    loadHistory();
    loadPushSubscriptions();
    loadKurse();
    // loadTimelineData(); // TODO: Endpoint noch nicht implementiert
  }, []);

  // Lade Empfänger + Kurse neu, wenn sich der Dojo-Filter ändert
  useEffect(() => {
    if (activeDojo) {
      loadRecipients();
      loadKurse();
    }
  }, [filter, activeDojo]);

  const loadKurse = async () => {
    try {
      const params = {};
      if (activeDojo?.id) {
        params.dojo_id = activeDojo.id;
      }
      // Axios hat globalen Auth-Header + baseURL '/api' konfiguriert
      const res = await axios.get('/kurse', { params });
      const raw = Array.isArray(res.data) ? res.data : [];
      // Normalisiere Feldnamen: regulärer Endpunkt gibt gruppenname/stil,
      // include_schedule gibt name/stil_name → vereinheitlichen
      setKurseList(raw.map(k => ({
        ...k,
        name: k.name || k.gruppenname || '',
        stil_name: k.stil_name || k.stil || '',
      })));
    } catch (err) {
      console.error('Fehler beim Laden der Kurse:', err);
    }
  };

  const loadDashboardData = async () => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/notifications/dashboard`);
      const data = await response.json();
      if (data.success) {
        setDashboardData(data);
      }
    } catch (error) {
      console.error('❌ Dashboard Daten Fehler:', error);
    }
  };

  const loadSettings = async () => {
    try {
      // Versuche zuerst die neue E-Mail-Service API
      const response = await fetchWithAuth(`${config.apiBaseUrl}/email-service/settings`);
      const data = await response.json();
      if (data.success && data.settings) {
        const emailConfig = data.settings.email_config
          ? (typeof data.settings.email_config === 'string'
              ? JSON.parse(data.settings.email_config)
              : data.settings.email_config)
          : {};

        const loadedSettings = {
          ...data.settings,
          email_config: {
            protocol: emailConfig.protocol || 'smtp',
            smtp_host: emailConfig.smtp_host || 'smtp.alfahosting.de',
            smtp_port: emailConfig.smtp_port || 587,
            imap_host: emailConfig.imap_host || '',
            imap_port: emailConfig.imap_port || 993,
            pop3_host: emailConfig.pop3_host || '',
            pop3_port: emailConfig.pop3_port || 995,
            smtp_secure: emailConfig.smtp_secure || false,
            smtp_user: emailConfig.smtp_user || '',
            smtp_password: emailConfig.smtp_password || ''
          }
        };
        setSettings(loadedSettings);
        return;
      }
    } catch (error) {
      console.log('⚠️ Neue E-Mail-Service API nicht verfügbar, versuche Fallback');
    }

    // Fallback: Alte API
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/notifications/settings`);
      const data = await response.json();
      if (data.success) {
        const emailConfig = data.settings.email_config ? JSON.parse(data.settings.email_config) : {};

        const loadedSettings = {
          ...data.settings,
          email_config: {
            protocol: emailConfig.protocol || 'smtp',
            smtp_host: emailConfig.smtp_host || 'smtp.alfahosting.de',
            smtp_port: emailConfig.smtp_port || 587,
            imap_host: emailConfig.imap_host || '',
            imap_port: emailConfig.imap_port || 993,
            pop3_host: emailConfig.pop3_host || '',
            pop3_port: emailConfig.pop3_port || 995,
            smtp_secure: emailConfig.smtp_secure || false,
            smtp_user: emailConfig.smtp_user || '',
            smtp_password: emailConfig.smtp_password || ''
          }
        };
        setSettings(loadedSettings);
      }
    } catch (error) {
      console.error('❌ Settings Fehler:', error);
      // Setze Alfahosting-Standardwerte
      setSettings(prev => ({
        ...prev,
        email_config: {
          protocol: 'smtp',
          smtp_host: 'smtp.alfahosting.de',
          smtp_port: 587,
          imap_host: '',
          imap_port: 993,
          pop3_host: '',
          pop3_port: 995,
          smtp_secure: false,
          smtp_user: '',
          smtp_password: ''
        }
      }));
    }
  };

  const loadRecipients = async () => {
    try {
      // Bestimme dojo_id basierend auf Filter
      let dojoIdParam = '';
      if (filter === 'all') {
        dojoIdParam = 'dojo_id=all';
      } else if (filter === 'current' && activeDojo) {
        dojoIdParam = `dojo_id=${activeDojo.id}`;
      } else if (activeDojo) {
        // Fallback: Wenn kein Filter gesetzt ist, verwende aktivenDojo
        dojoIdParam = `dojo_id=${activeDojo.id}`;
      }

      // Versuche zuerst die Notifications-Route mit dojo_id Filter
      const url = dojoIdParam
        ? `${config.apiBaseUrl}/notifications/recipients?${dojoIdParam}`
        : `${config.apiBaseUrl}/notifications/recipients`;

      console.log('📧 Loading recipients with filter:', dojoIdParam || 'no filter');

      const response = await fetchWithAuth(url);
      const data = await response.json();
      if (data.success) {
        setRecipients({
          mitglieder: data.recipients.mitglieder || [],
          trainer: data.recipients.trainer || [],
          personal: data.recipients.personal || [],
          admin: data.recipients.admin || [],
          alle: data.recipients.alle || []
        });
        console.log('✅ Loaded recipients from dashboard API:', {
          mitglieder: data.recipients.mitglieder?.length || 0,
          trainer: data.recipients.trainer?.length || 0,
          personal: data.recipients.personal?.length || 0,
          filter: dojoIdParam || 'all'
        });
        return;
      }
    } catch (error) {
      console.log('⚠️ Mitglieder API failed, trying fallback');
    }

    try {
      // Fallback: Lade echte Daten direkt aus der Datenbank
      const response = await fetchWithAuth(`${config.apiBaseUrl}/notifications/recipients`);
      const data = await response.json();
      if (data.success) {
        setRecipients({
          mitglieder: data.recipients.mitglieder || [],
          trainer: data.recipients.trainer || [],
          personal: data.recipients.personal || [],
          admin: data.recipients.admin || [],
          alle: data.recipients.alle || []
        });
      } else {
        // Fallback: Lade Mitglieder direkt
        await loadMembersDirectly();
      }
    } catch (error) {
      console.error('❌ Recipients Fehler:', error);
      // Fallback: Lade Mitglieder direkt
      await loadMembersDirectly();
    }
  };

  const loadMembersDirectly = async () => {
    try {
      // Lade alle verfügbaren Daten und erstelle realistische Email-Adressen
      let memberEmails = [];
      
      // Versuche Mitglieder zu laden
      try {
        const membersResponse = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder`);
        const membersData = await membersResponse.json();
        console.log('📊 Raw members data:', Array.isArray(membersData) ? membersData.slice(0, 2) : membersData); // Zeige ersten 2 Einträge

        // Nur Mitglieder mit echter E-Mail-Adresse verwenden
        if (Array.isArray(membersData)) {
          memberEmails = membersData
            .filter(member => member.email && member.email.trim())
            .map(member => ({
              email: member.email.trim(),
              name: `${member.vorname || ''} ${member.nachname || ''}`.trim(),
              type: 'mitglied'
            }));
        } else {
          console.warn('⚠️ membersData is not an array:', membersData);
          memberEmails = [];
        }

        console.log(`✅ Created ${memberEmails.length} member emails`);
      } catch (error) {
        console.log('❌ Members API error:', error);
        memberEmails = [];
      }
      
      // Lade Trainer direkt
      const trainersResponse = await fetchWithAuth(`${config.apiBaseUrl}/trainer`);
      const trainersData = await trainersResponse.json();

      const trainerEmails = Array.isArray(trainersData)
        ? trainersData.filter(trainer => trainer.email && trainer.email !== '').map(trainer => ({
            email: trainer.email,
            name: `${trainer.vorname || ''} ${trainer.nachname || ''}`.trim(),
            type: 'trainer'
          }))
        : [];

      // Lade Personal direkt
      const personalResponse = await fetchWithAuth(`${config.apiBaseUrl}/personal`);
      const personalData = await personalResponse.json();

      const personalEmails = Array.isArray(personalData)
        ? personalData.filter(personal => personal.email && personal.email !== '').map(personal => ({
            email: personal.email,
            name: `${personal.vorname || ''} ${personal.nachname || ''}`.trim(),
            type: 'personal'
          }))
        : [];
      
      setRecipients({
        mitglieder: memberEmails,
        trainer: trainerEmails,
        personal: personalEmails,
        admin: [], // Admins werden separat geladen
        alle: [...memberEmails, ...trainerEmails, ...personalEmails]
      });
      
      console.log(`📊 Loaded directly: ${memberEmails.length} members, ${trainerEmails.length} trainers, ${personalEmails.length} personal`);
    } catch (error) {
      console.error('❌ Direct load error:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/notifications/templates`);
      const data = await response.json();
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('❌ Templates Fehler:', error);
    }
  };

  const loadHistory = async (page = 1) => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/notifications/history?page=${page}&limit=20`);
      const data = await response.json();
      if (data.success) {
        setHistory(data);
      }
    } catch (error) {
      console.error('❌ History Fehler:', error);
    }
  };

  const loadPushSubscriptions = async () => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/notifications/push/subscriptions`);
      const data = await response.json();
      if (data.success) {
        setPushSubscriptions(data.subscriptions);
      }
    } catch (error) {
      console.error('❌ Push Subscriptions Fehler:', error);
    }
  };

  const loadTimelineData = async () => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/dashboard/notification-timeline?days=7`);
      const data = await response.json();
      if (data.success && data.timeline) {
        setTimelineData(data.timeline);
        console.log('✅ Timeline-Daten geladen:', data.timeline);
      }
    } catch (error) {
      console.error('❌ Timeline Fehler:', error);
      setTimelineData([]);
    }
  };

  // ===================================================================
  // ⚙️ SETTINGS HANDLING
  // ===================================================================

  const handleSettingsSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Verwende die neue E-Mail-Service API
      const response = await fetchWithAuth(`${config.apiBaseUrl}/email-service/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_enabled: settings.email_enabled,
          email_config: settings.email_config,
          default_from_email: settings.default_from_email,
          default_from_name: settings.default_from_name
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('✅ E-Mail-Einstellungen erfolgreich gespeichert');
        await loadSettings();
        await loadDashboardData();
      } else {
        setError(data.message || 'Fehler beim Speichern der Einstellungen');
      }
    } catch (error) {
      console.error('❌ Settings Save Fehler:', error);
      setError('Fehler beim Speichern der Einstellungen: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailTest = async () => {
    const testEmail = prompt('Test-Email-Adresse eingeben:');
    if (!testEmail) return;

    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Verwende die neue E-Mail-Service API
      const response = await fetchWithAuth(`${config.apiBaseUrl}/email-service/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: testEmail,
          subject: 'Test-Email von Dojo Software',
          message: `
            <h2>Test-Email erfolgreich!</h2>
            <p>Diese E-Mail wurde erfolgreich über das Dojo Software E-Mail-System gesendet.</p>
            <p><strong>Zeitstempel:</strong> ${new Date().toLocaleString('de-DE')}</p>
            <p><strong>SMTP-Server:</strong> ${settings.email_config?.smtp_host || 'Nicht konfiguriert'}</p>
            <hr>
            <p><em>Dojo Software - E-Mail-Service</em></p>
          `
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(`✅ Test-Email erfolgreich an ${testEmail} gesendet!`);
        await loadDashboardData();
      } else {
        setError(data.message || data.error || 'Fehler beim Senden der Test-Email');
      }
    } catch (error) {
      console.error('❌ Email Test Fehler:', error);
      setError('Fehler beim Senden der Test-Email: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSMTPVerify = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/email-service/verify`);
      const data = await response.json();
      
      if (data.success) {
        setSuccess('✅ SMTP-Verbindung erfolgreich getestet!');
      } else {
        setError(data.message || data.error || 'SMTP-Verbindung fehlgeschlagen');
      }
    } catch (error) {
      console.error('❌ SMTP Verify Fehler:', error);
      setError('Fehler beim Testen der SMTP-Verbindung: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ===================================================================
  // 📧 EMAIL HANDLING
  // ===================================================================

  const handleEmailSend = async () => {
    if (!emailData.recipients.length || !emailData.subject || !emailData.message) {
      setError('Bitte füllen Sie alle Felder aus');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/notifications/email/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(data.message);
        setEmailData({ recipients: [], subject: '', message: '', template_type: 'general' });
        await loadDashboardData();
        await loadHistory();
      } else {
        setError(data.message || 'Fehler beim Senden der Emails');
      }
    } catch (error) {
      setError('Fehler beim Senden der Emails');
    } finally {
      setLoading(false);
    }
  };

  // ===================================================================
  // 📱 PUSH NOTIFICATION HANDLING
  // ===================================================================

  const handlePushSend = async () => {
    if (!pushData.title || !pushData.message) {
      setError('Bitte füllen Sie Titel und Nachricht aus');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/notifications/push/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pushData),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(data.message);

        // Browser-Benachrichtigung für Admin anzeigen
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`✅ ${pushData.title}`, {
            body: `${pushData.message}\n\n${data.message}`,
            icon: '/favicon.ico',
            tag: 'push-sent-confirmation',
            requireInteraction: true,  // Popup bleibt offen bis der User es schließt
            silent: false
          });
        } else if ('Notification' in window && Notification.permission !== 'denied') {
          // Frage nach Berechtigung, wenn noch nicht gesetzt
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              new Notification(`✅ ${pushData.title}`, {
                body: `${pushData.message}\n\n${data.message}`,
                icon: '/favicon.ico',
                tag: 'push-sent-confirmation',
                requireInteraction: true,  // Popup bleibt offen bis der User es schließt
                silent: false
              });
            }
          });
        }

        setPushData({ recipients: [], title: '', message: '', icon: '', badge: '', url: '' });
        await loadDashboardData();
        await loadHistory();
      } else {
        setError(data.message || 'Fehler beim Senden der Push-Nachrichten');
      }
    } catch (error) {
      setError('Fehler beim Senden der Push-Nachrichten');
    } finally {
      setLoading(false);
    }
  };

  // Helper: URL-safe Base64 → Uint8Array (für VAPID Key)
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
  }

  const [pushStatus, setPushStatus] = useState(''); // inline Feedback neben dem Button

  const requestPushPermission = async () => {
    setPushStatus('⏳ Wird aktiviert…');
    if (!('Notification' in window)) {
      setPushStatus('❌ Browser unterstützt keine Push-Benachrichtigungen');
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('❌ Browser unterstützt keine Push-Benachrichtigungen');
      return;
    }
    // Aktuellen Permission-Status prüfen
    const currentPerm = Notification.permission;
    if (currentPerm === 'denied') {
      setPushStatus('❌ Benachrichtigungen blockiert! Safari: Einstellungen → Websites → Benachrichtigungen → dojo.tda-intl.org → Erlauben');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatus('❌ Benachrichtigung verweigert. Bitte im Browser erlauben.');
        return;
      }
      setPushStatus('⏳ Service Worker wird registriert…');
      // SW registrieren falls noch nicht vorhanden
      let registration = await navigator.serviceWorker.getRegistration('/');
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js');
      }
      // Warten bis SW aktiv ist (sw.js hat skipWaiting, geht schnell)
      if (!registration.active) {
        await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Service Worker konnte nicht aktiviert werden')), 8000))
        ]);
        registration = await navigator.serviceWorker.getRegistration('/');
      }
      setPushStatus('⏳ Abonnement wird erstellt…');
      // VAPID Public Key (muss mit Backend übereinstimmen)
      const vapidPublicKey = 'BKzKRA_Tojs8YsxKH5yR2oToWDm5uI8QvMjZNLCP6hSMBxyA3pwOIk2rc80a8kyd04T4stIUIrLXMj2O_CMCnfc';
      const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
      // Bestehende Subscription holen oder neue erstellen
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey
        });
      }
      // Subscription ans Backend senden
      const subJson = subscription.toJSON();
      setPushStatus('⏳ Wird gespeichert…');
      const response = await fetchWithAuth(`${config.apiBaseUrl}/notifications/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
          userAgent: navigator.userAgent
        })
      });
      const data = await response.json();
      if (data.success) {
        setPushStatus('✅ Push-Benachrichtigungen aktiviert!');
        setSuccess('Push-Benachrichtigungen aktiviert ✓');
        await loadDashboardData();
        await loadPushSubscriptions();
      } else {
        setPushStatus('❌ Fehler: ' + (data.message || 'Unbekannter Fehler'));
        setError(data.message || 'Fehler beim Aktivieren');
      }
    } catch (err) {
      console.error('Push-Subscription Fehler:', err);
      setPushStatus('❌ Fehler: ' + err.message);
      setError('Fehler beim Aktivieren: ' + err.message);
    }
  };

  const deleteNotification = async (id) => {
    if (!window.confirm('Möchten Sie diese Benachrichtigung wirklich löschen?')) {
      return;
    }

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/notifications/history/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Benachrichtigung erfolgreich gelöscht');
        // History neu laden
        await loadHistory();
      } else {
        setError(data.message || 'Fehler beim Löschen der Benachrichtigung');
      }
    } catch (error) {
      setError('Fehler beim Löschen der Benachrichtigung');
    }
  };

  const deleteBulkNotification = async (id) => {
    if (!window.confirm('⚠️ ACHTUNG: Diese Aktion löscht die Benachrichtigung für ALLE Empfänger!\n\nMöchten Sie wirklich fortfahren?')) {
      return;
    }

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/notifications/history/bulk/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(`${data.deletedCount} Benachrichtigung(en) erfolgreich gelöscht`);
        // History neu laden
        await loadHistory();
      } else {
        setError(data.message || 'Fehler beim Löschen der Benachrichtigungen');
      }
    } catch (error) {
      setError('Fehler beim Löschen der Benachrichtigungen');
    }
  };

  // ===================================================================
  // 🎨 RENDER FUNCTIONS
  // ===================================================================

  const renderDashboard = () => {
    // Daten für Charts vorbereiten
    const pieData = [
      { name: 'Emails', value: dashboardData.stats.email_notifications || 0, color: 'var(--color-info-400)' },
      { name: 'Push', value: dashboardData.stats.push_notifications || 0, color: 'var(--success)' }
    ];

    const statusData = [
      { name: 'Erfolgreich', value: dashboardData.stats.sent_notifications || 0, color: 'var(--success)' },
      { name: 'Fehlgeschlagen', value: dashboardData.stats.failed_notifications || 0, color: 'var(--error)' }
    ];

    return (
      <div className="notification-dashboard ns-dashboard-inner">
        <div className="dashboard-header">
          <div className="ns-header-row">
            <span className="ns-header-icon-lg">📧</span>
            <h2 className="ns-heading-h2">Newsletter & Benachrichtigungen</h2>
          </div>
          <p className="ns-subtitle">Verwalten Sie Email-Versand, Push-Nachrichten und Server-Einstellungen</p>
        </div>

        {/* Statistiken */}
        <div className="stats-grid">
          <div className="stat-card ns-stat-card-email">
            <div className="stat-icon">📧</div>
            <div className="stat-content">
              <h3 className="ns-stat-h3-email">{dashboardData.stats.email_notifications || 0}</h3>
              <p>Emails gesendet (30 Tage)</p>
            </div>
          </div>
          <div className="stat-card ns-stat-card-green">
            <div className="stat-icon">📱</div>
            <div className="stat-content">
              <h3 className="ns-heading-success">{dashboardData.stats.push_notifications || 0}</h3>
              <p>Push-Nachrichten</p>
            </div>
          </div>
          <div className="stat-card ns-stat-card-green">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <h3 className="ns-heading-success">{dashboardData.stats.sent_notifications || 0}</h3>
              <p>Erfolgreich gesendet</p>
            </div>
          </div>
          <div className="stat-card ns-stat-card-red">
            <div className="stat-icon">❌</div>
            <div className="stat-content">
              <h3 className="ns-stat-h3-error">{dashboardData.stats.failed_notifications || 0}</h3>
              <p>Fehlgeschlagen</p>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="ns-charts-grid">
          {/* Zeitverlauf Chart */}
          <div className="ns-chart-card">
            <h4 className="ns-chart-title">📈 Wochenverlauf</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis dataKey="tag" stroke="#a0a0b0" className="ns-text-xs" />
                <YAxis stroke="#a0a0b0" className="ns-text-xs" />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(20, 20, 30, 0.95)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }}
                />
                <Legend wrapperStyle={{ color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                <Line type="monotone" dataKey="emails" stroke="#60a5fa" strokeWidth={2} name="Emails" />
                <Line type="monotone" dataKey="push" stroke="#22c55e" strokeWidth={2} name="Push" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Verteilung Email vs Push */}
          <div className="ns-chart-card">
            <h4 className="ns-chart-title">📊 Verteilung Typen</h4>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={70}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'rgba(20, 20, 30, 0.95)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Status Chart */}
          <div className="ns-chart-card">
            <h4 className="ns-chart-title">✅ Erfolgsrate</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis dataKey="name" stroke="#a0a0b0" className="ns-text-xs" />
                <YAxis stroke="#a0a0b0" className="ns-text-xs" />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(20, 20, 30, 0.95)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Letzte Benachrichtigungen */}
        <div className="recent-notifications ns-recent-inner">
          <h3 className="ns-chart-title">🔔 Letzte Benachrichtigungen</h3>
          <div className="notifications-list ns-flex-col">
            {dashboardData.recentNotifications?.map((notification, index) => (
              <div key={index} className="notification-item ns-notification-item-compact">
                <div className="notification-icon ns-text-xl">
                  {notification.type === 'email' ? '📧' : '📱'}
                </div>
                <div className="notification-content u-flex-1">
                  <div className="notification-header ns-notif-header-row">
                    <span className="notification-recipient ns-notif-recipient">{notification.recipient}</span>
                    <span className={`notification-status ${notification.status} ns-notif-status`}>
                      {notification.status === 'sent' ? '✅' :
                       notification.status === 'failed' ? '❌' : '⏳'}
                    </span>
                  </div>
                  <div className="notification-subject ns-notif-subject">{notification.subject}</div>
                  <div className="notification-time ns-notif-time">
                    {new Date(notification.created_at).toLocaleString('de-DE')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderSettings = () => (
    <div className="notification-settings ns-settings-inner">
      <div className="settings-header">
        <div className="ns-header-row">
          <span className="ns-header-icon-lg">⚙️</span>
          <h3 className="ns-heading-h3">Server-Einstellungen</h3>
        </div>
        <p className="ns-subtitle">Konfigurieren Sie Email- und Push-Notification-Einstellungen</p>
      </div>

      {/* Email-Einstellungen */}
      <div className="settings-section ns-settings-section">
        <div className="section-header ns-section-header">
          <div className="u-flex-row-md">
            <span className="ns-header-icon-sm">📧</span>
            <h4 className="ns-heading-h4">Email-Konfiguration</h4>
          </div>
          <label className="toggle-switch ns-toggle-switch">
            <input
              type="checkbox"
              checked={settings.email_enabled}
              onChange={(e) => setSettings({...settings, email_enabled: e.target.checked})}
              className="ns-toggle-input"
            />
            <span className={`toggle-slider ns-toggle-slider-base ${settings.email_enabled ? 'ns-toggle-slider--on' : 'ns-toggle-slider--off'}`}></span>
          </label>
        </div>

        {settings.email_enabled && (
          <div className="email-config">
            {/* Protokoll-Auswahl */}
            <div className="form-row ns-mb-1">
              <div className="form-group">
                <label className="ns-form-label">E-Mail Protokoll</label>
                <select
                  value={settings.email_config.protocol || 'smtp'}
                  onChange={(e) => setSettings({
                    ...settings,
                    email_config: {...settings.email_config, protocol: e.target.value}
                  })}
                  className="ns-form-input"
                >
                  <option value="smtp">SMTP (Postausgang)</option>
                  <option value="pop3">POP3 (Posteingang)</option>
                  <option value="imap">IMAP (Posteingang)</option>
                </select>
              </div>
            </div>

            {/* Postausgangsserver (SMTP) */}
            <div className="form-row u-grid-2col">
              <div className="form-group">
                <label className="ns-form-label">Postausgangsserver (SMTP)</label>
                <input
                  type="text"
                  value={settings.email_config.smtp_host}
                  onChange={(e) => setSettings({
                    ...settings,
                    email_config: {...settings.email_config, smtp_host: e.target.value}
                  })}
                  placeholder="smtp.alfahosting.de"
                  className="ns-form-input"
                />
              </div>
              <div className="form-group">
                <label className="ns-form-label">Postausgangsserver Port</label>
                <input
                  type="number"
                  value={settings.email_config.smtp_port}
                  onChange={(e) => setSettings({
                    ...settings,
                    email_config: {...settings.email_config, smtp_port: parseInt(e.target.value)}
                  })}
                  placeholder="587"
                  className="ns-form-input"
                />
              </div>
            </div>

            {/* Posteingangsserver (IMAP/POP3) */}
            <div className="form-row u-grid-2col">
              <div className="form-group">
                <label className="ns-form-label">
                  Posteingangsserver ({settings.email_config.protocol === 'imap' ? 'IMAP' : settings.email_config.protocol === 'pop3' ? 'POP3' : 'IMAP/POP3'})
                </label>
                <input
                  type="text"
                  value={settings.email_config.protocol === 'imap' ? settings.email_config.imap_host : settings.email_config.pop3_host}
                  onChange={(e) => setSettings({
                    ...settings,
                    email_config: {
                      ...settings.email_config,
                      ...(settings.email_config.protocol === 'imap'
                        ? { imap_host: e.target.value }
                        : { pop3_host: e.target.value })
                    }
                  })}
                  placeholder={settings.email_config.protocol === 'imap' ? 'imap.alfahosting.de' : 'pop3.alfahosting.de'}
                  className="ns-form-input"
                />
              </div>
              <div className="form-group">
                <label className="ns-form-label">Posteingangsserver Port</label>
                <input
                  type="number"
                  value={settings.email_config.protocol === 'imap' ? settings.email_config.imap_port : settings.email_config.pop3_port}
                  onChange={(e) => setSettings({
                    ...settings,
                    email_config: {
                      ...settings.email_config,
                      ...(settings.email_config.protocol === 'imap'
                        ? { imap_port: parseInt(e.target.value) }
                        : { pop3_port: parseInt(e.target.value) })
                    }
                  })}
                  placeholder={settings.email_config.protocol === 'imap' ? '993' : '995'}
                  className="ns-form-input"
                />
              </div>
            </div>

            <div className="form-row u-grid-2col">
              <div className="form-group">
                <label className="ns-form-label">SMTP Benutzername</label>
                <input
                  type="text"
                  value={settings.email_config.smtp_user}
                  onChange={(e) => setSettings({
                    ...settings,
                    email_config: {...settings.email_config, smtp_user: e.target.value}
                  })}
                  placeholder="ihre-email@ihre-domain.de"
                  className="ns-form-input"
                />
              </div>
              <div className="form-group">
                <label className="ns-form-label">SMTP Passwort</label>
                <input
                  type="password"
                  value={settings.email_config.smtp_password}
                  onChange={(e) => setSettings({
                    ...settings,
                    email_config: {...settings.email_config, smtp_password: e.target.value}
                  })}
                  placeholder="App-Passwort"
                  className="ns-form-input"
                />
              </div>
            </div>

            <div className="form-row u-grid-2col">
              <div className="form-group">
                <label className="ns-form-label">Standard Absender-Email</label>
                <input
                  type="email"
                  value={settings.default_from_email}
                  onChange={(e) => setSettings({...settings, default_from_email: e.target.value})}
                  placeholder="noreply@ihrdojo.de"
                  className="ns-form-input"
                />
              </div>
              <div className="form-group">
                <label className="ns-form-label">Standard Absender-Name</label>
                <input
                  type="text"
                  value={settings.default_from_name}
                  onChange={(e) => setSettings({...settings, default_from_name: e.target.value})}
                  placeholder="Dojo Software"
                  className="ns-form-input"
                />
              </div>
            </div>

            <div className="form-actions ns-form-actions">
              <button
                onClick={handleSMTPVerify}
                disabled={loading || !settings.email_enabled}
                className="ns-btn-verify"
                title="SMTP-Verbindung testen"
              >
                🔌 SMTP-Verbindung testen
              </button>
              <button
                onClick={handleEmailTest}
                disabled={loading || !settings.email_enabled}
                className="ns-btn-test-email"
                title="Test-E-Mail versenden"
              >
                📧 Test-Email senden
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Push-Notification-Einstellungen */}
      <div className="settings-section ns-settings-section">
        <div className="section-header ns-section-header">
          <div className="u-flex-row-md">
            <span className="ns-header-icon-sm">📱</span>
            <h4 className="ns-heading-h4">Push-Notifications</h4>
          </div>
          <label className="toggle-switch ns-toggle-switch">
            <input
              type="checkbox"
              checked={settings.push_enabled}
              onChange={(e) => setSettings({...settings, push_enabled: e.target.checked})}
              className="ns-toggle-input"
            />
            <span className={`toggle-slider ns-toggle-slider-base ${settings.push_enabled ? 'ns-toggle-slider--on' : 'ns-toggle-slider--off'}`}></span>
          </label>
        </div>

        {!!settings.push_enabled && (
          <div className="push-config">
            <p className="ns-subtitle">Push-Notification-Konfiguration wird hier implementiert...</p>
          </div>
        )}
      </div>

      <div className="settings-actions ns-text-right">
        <button
          onClick={handleSettingsSave}
          disabled={loading}
          className="ns-btn-save"
        >
          {loading ? 'Speichern...' : '💾 Einstellungen speichern'}
        </button>
      </div>
    </div>
  );

  const renderEmailComposer = () => (
    <div className="email-composer">
      <div className="composer-header">
        <h3>📧 Email versenden</h3>
        <p>Erstellen und versenden Sie Emails an Ihre Mitglieder</p>
      </div>

      {/* Dojo-Filter Indikator */}
      {activeDojo && (
        <div
          className={`ns-dojo-filter-base ${filter === 'all' ? 'ns-dojo-filter--all' : ''}`}
          style={filter !== 'all' ? {
            '--ns-filter-bg': `linear-gradient(135deg, ${activeDojo.farbe}33 0%, ${activeDojo.farbe}11 100%)`,
            '--ns-filter-border': `${activeDojo.farbe}66`
          } : undefined}
        >
          <div
            className={`ns-dojo-filter-accent${filter !== 'all' ? ' ns-dojo-filter-accent--dojo' : ''}`}
            style={filter !== 'all' ? { '--ns-accent-color': activeDojo.farbe } : undefined}
          />
          <div className="u-flex-1">
            <div className="ns-dojo-filter-label">
              Empfänger-Filter aktiv
            </div>
            <div className="ns-dojo-filter-name">
              {filter === 'all' ? '🏯 Alle Dojos' : `🏯 ${activeDojo.dojoname}`}
            </div>
            <div className="ns-dojo-filter-count">
              Verfügbare Empfänger: {recipients.mitglieder.length} Mitglieder, {recipients.trainer.length} Trainer, {recipients.personal.length} Mitarbeiter
            </div>
          </div>
        </div>
      )}

      <div className="composer-form">
        <div className="form-group">
          <label>Empfänger auswählen</label>
          <div className="recipient-selector">
            <div className="recipient-groups">
              <button
                className={`recipient-group-btn ${emailData.recipients.length === (recipients.mitglieder?.length || 0) ? 'active' : ''}`}
                onClick={() => setEmailData({...emailData, recipients: (recipients.mitglieder || []).map(r => r.email)})}
              >
                👥 Alle Mitglieder ({recipients.mitglieder?.length || 0})
              </button>
              <button
                className={`recipient-group-btn ${emailData.recipients.length === (recipients.trainer?.length || 0) ? 'active' : ''}`}
                onClick={() => setEmailData({...emailData, recipients: (recipients.trainer || []).map(r => r.email)})}
              >
                👨‍🏫 Alle Trainer ({recipients.trainer?.length || 0})
              </button>
              <button
                className={`recipient-group-btn ${emailData.recipients.length === (recipients.personal?.length || 0) ? 'active' : ''}`}
                onClick={() => setEmailData({...emailData, recipients: (recipients.personal || []).map(r => r.email)})}
              >
                🧑‍💼 Alle Mitarbeiter ({recipients.personal?.length || 0})
              </button>
              <button 
                className={`recipient-group-btn ${emailData.recipients.length === (recipients.admin?.length || 0) ? 'active' : ''}`}
                onClick={() => setEmailData({...emailData, recipients: (recipients.admin || []).map(r => r.email)})}
              >
                👑 Alle Admins ({recipients.admin?.length || 0})
              </button>
            </div>
            
            <div className="selected-recipients">
              <strong>Ausgewählte Empfänger: {emailData.recipients.length}</strong>
              {emailData.recipients.length > 0 && (
                <div className="recipient-list">
                  {emailData.recipients.slice(0, 5).map((email, index) => (
                    <span key={index} className="recipient-tag">{email}</span>
                  ))}
                  {emailData.recipients.length > 5 && (
                    <span className="recipient-more">+{emailData.recipients.length - 5} weitere</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="form-group">
          <label>Betreff</label>
          <input
            type="text"
            value={emailData.subject}
            onChange={(e) => setEmailData({...emailData, subject: e.target.value})}
            placeholder="Betreff der Email..."
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>Nachricht</label>
          <textarea
            value={emailData.message}
            onChange={(e) => setEmailData({...emailData, message: e.target.value})}
            placeholder="Ihre Nachricht..."
            rows="10"
            className="form-textarea"
          />
        </div>

        <div className="form-group">
          <label>Template verwenden</label>
          <select
            value={emailData.template_type}
            onChange={(e) => {
              const template = templates.find(t => t.id == e.target.value);
              if (template) {
                setEmailData({
                  ...emailData,
                  subject: template.subject,
                  message: template.content,
                  template_type: e.target.value
                });
              }
            }}
            className="form-select"
          >
            <option value="">Kein Template</option>
            {Array.isArray(templates) && templates.map(template => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
        </div>

        <div className="form-actions">
          <button 
            onClick={handleEmailSend}
            className="btn btn-primary"
            disabled={loading || !emailData.recipients.length || !emailData.subject || !emailData.message}
          >
            {loading ? 'Senden...' : '📧 Email senden'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderPushComposer = () => (
    <div className="email-composer">
      <div className="composer-header">
        <h3>📱 Push-Nachrichten versenden</h3>
        <p>Erstellen und versenden Sie Push-Benachrichtigungen an Ihre Mitglieder</p>
      </div>

      {/* Dojo-Filter Indikator */}
      {activeDojo && (
        <div
          className={`ns-dojo-filter-base ${filter === 'all' ? 'ns-dojo-filter--all' : ''}`}
          style={filter !== 'all' ? {
            '--ns-filter-bg': `linear-gradient(135deg, ${activeDojo.farbe}33 0%, ${activeDojo.farbe}11 100%)`,
            '--ns-filter-border': `${activeDojo.farbe}66`
          } : undefined}
        >
          <div
            className={`ns-dojo-filter-accent${filter !== 'all' ? ' ns-dojo-filter-accent--dojo' : ''}`}
            style={filter !== 'all' ? { '--ns-accent-color': activeDojo.farbe } : undefined}
          />
          <div className="u-flex-1">
            <div className="ns-dojo-filter-label">
              Empfänger-Filter aktiv
            </div>
            <div className="ns-dojo-filter-name">
              {filter === 'all' ? '🏯 Alle Dojos' : `🏯 ${activeDojo.dojoname}`}
            </div>
            <div className="ns-dojo-filter-count">
              Verfügbare Empfänger: {recipients.mitglieder.length} Mitglieder, {recipients.trainer.length} Trainer, {recipients.personal.length} Mitarbeiter
            </div>
          </div>
        </div>
      )}

      <div className="composer-form">
        <div className="form-group">
          <label>Push-Berechtigung aktivieren</label>
          <div className="push-permission-section">
            <button
              onClick={requestPushPermission}
              className="btn btn-secondary"
            >
              🔔 Push-Benachrichtigungen aktivieren
            </button>
            {pushStatus && (
              <p style={{ marginTop: '8px', padding: '8px 12px', background: pushStatus.startsWith('✅') ? '#f0fff4' : pushStatus.startsWith('❌') ? '#fff5f5' : '#fffbeb', border: '1px solid', borderColor: pushStatus.startsWith('✅') ? '#68d391' : pushStatus.startsWith('❌') ? '#fc8181' : '#f6e05e', borderRadius: '6px', fontSize: '13px', lineHeight: '1.4' }}>
                {pushStatus}
              </p>
            )}
            <p className="permission-info">
              Aktive Abonnements: {pushSubscriptions.length} | Browser: {typeof Notification !== 'undefined' ? Notification.permission : 'n/a'}
            </p>
          </div>
        </div>

        <div className="form-group">
          <label>Empfänger auswählen</label>
          <div className="recipient-selector">
            <div className="recipient-groups">
              <button
                className={`recipient-group-btn ${pushData.recipients.length === (recipients.mitglieder?.length || 0) ? 'active' : ''}`}
                onClick={() => {
                  setSelectedIndividuals([]);
                  setPushData({...pushData, recipients: (recipients.mitglieder || []).map(r => r.email)});
                }}
              >
                👥 Alle Mitglieder ({recipients.mitglieder?.length || 0})
              </button>
              <button
                className={`recipient-group-btn ${pushData.recipients.length === (recipients.trainer?.length || 0) ? 'active' : ''}`}
                onClick={() => {
                  setSelectedIndividuals([]);
                  setPushData({...pushData, recipients: (recipients.trainer || []).map(r => r.email)});
                }}
              >
                👨‍🏫 Alle Trainer ({recipients.trainer?.length || 0})
              </button>
              <button
                className={`recipient-group-btn ${pushData.recipients.length === (recipients.personal?.length || 0) ? 'active' : ''}`}
                onClick={() => {
                  setSelectedIndividuals([]);
                  setPushData({...pushData, recipients: (recipients.personal || []).map(r => r.email)});
                }}
              >
                🧑‍💼 Alle Mitarbeiter ({recipients.personal?.length || 0})
              </button>
              <button
                className={`recipient-group-btn ${pushData.recipients.length === (recipients.admin?.length || 0) ? 'active' : ''}`}
                onClick={() => {
                  setSelectedIndividuals([]);
                  setPushData({...pushData, recipients: (recipients.admin || []).map(r => r.email)});
                }}
              >
                👑 Alle Admins ({recipients.admin?.length || 0})
              </button>
            </div>

            <div className="individual-selection ns-mt-lg">
              <label className="ns-label-bold">
                🔍 Einzelne Mitglieder auswählen
              </label>
              <div className="ns-relative">
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Nach Name oder Email suchen..."
                  className="form-input u-w-full ns-mb-sm"
                />

                {memberSearch.length > 0 && (
                  <div className="ns-search-dropdown">
                    {recipients.alle
                      .filter(r =>
                        r.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                        r.email.toLowerCase().includes(memberSearch.toLowerCase())
                      )
                      .slice(0, 10)
                      .map((member, index) => (
                        <div
                          key={index}
                          onClick={() => {
                            if (!selectedIndividuals.find(m => m.email === member.email)) {
                              setSelectedIndividuals([...selectedIndividuals, member]);
                              setPushData({
                                ...pushData,
                                recipients: [...new Set([...pushData.recipients, member.email])]
                              });
                            }
                            setMemberSearch('');
                          }}
                          className="ns-search-item"
                        >
                          <div className="ns-item-title">
                            {member.name}
                          </div>
                          <div className="ns-item-subtitle">
                            {member.email}
                            <span className="ns-type-badge">
                              {member.type}
                            </span>
                          </div>
                        </div>
                      ))}

                    {recipients.alle.filter(r =>
                      r.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                      r.email.toLowerCase().includes(memberSearch.toLowerCase())
                    ).length === 0 && (
                      <div className="ns-empty-text">
                        Keine Ergebnisse gefunden
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedIndividuals.length > 0 && (
                <div className="ns-mt-1">
                  <strong className="ns-label">
                    Ausgewählte einzelne Empfänger ({selectedIndividuals.length}):
                  </strong>
                  <div className="u-flex-wrap-sm">
                    {selectedIndividuals.map((member, index) => (
                      <span
                        key={index}
                        className="ns-selected-chip"
                      >
                        {member.name} ({member.email})
                        <button
                          onClick={() => {
                            setSelectedIndividuals(selectedIndividuals.filter(m => m.email !== member.email));
                            setPushData({
                              ...pushData,
                              recipients: pushData.recipients.filter(e => e !== member.email)
                            });
                          }}
                          className="ns-chip-remove-btn"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="selected-recipients ns-mt-lg">
              <strong>Gesamt ausgewählte Empfänger: {pushData.recipients.length}</strong>
              {pushData.recipients.length > 0 && (
                <div className="recipient-list">
                  {pushData.recipients.slice(0, 5).map((email, index) => (
                    <span key={index} className="recipient-tag">{email}</span>
                  ))}
                  {pushData.recipients.length > 5 && (
                    <span className="recipient-more">+{pushData.recipients.length - 5} weitere</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Schnellvorlagen */}
        <div className="form-group">
          <label>Schnellvorlage wählen</label>
          <div className="ns-push-templates">
            {[
              { label: '🤒 Ausfall – Krankheit', title: '⚠️ Training heute abgesagt', message: 'Das heutige Training muss leider kurzfristig wegen Krankheit des Trainers ausfallen. Wir bitten um Entschuldigung und melden uns sobald wie möglich.' },
              { label: '⚠️ Ausfall – allgemein', title: '⚠️ Training heute abgesagt', message: 'Das heutige Training muss leider kurzfristig ausfallen. Wir bitten um Verständnis und informieren euch über den nächsten Termin.' },
              { label: '📍 Hallenänderung', title: '📍 Hallenänderung heute', message: 'Das Training findet heute ausnahmsweise in einer anderen Halle statt. Bitte informiert euch rechtzeitig und gebt die Info weiter.' },
              { label: '🥋 Prüfungserinnerung', title: '🥋 Gürtelprüfung – Erinnerung', message: 'Denkt an die bevorstehende Gürtelprüfung! Seid rechtzeitig vor Ort, bringt alle erforderlichen Unterlagen mit und kommt gut vorbereitet.' },
              { label: '🏆 Lehrgang', title: '🏆 Lehrgang-Einladung', message: 'Ihr seid herzlich zum kommenden Lehrgang eingeladen! Anmeldung bitte bis zum angegebenen Datum. Weitere Details erhaltet ihr in Kürze.' },
              { label: '📅 Terminänderung', title: '📅 Wichtige Terminänderung', message: 'Es gibt eine Änderung bei einem Termin. Bitte prüft euren Trainingsplan und tragt den neuen Termin in euren Kalender ein.' },
              { label: '💳 Beitragsinfo', title: '💳 Wichtige Beitragsinfo', message: 'Bitte stellt sicher, dass eure Zahlungsdaten aktuell sind und der Monatsbeitrag pünktlich eingezogen werden kann. Bei Fragen meldet euch.' },
              { label: '📢 Ankündigung', title: '📢 Wichtige Mitteilung', message: 'Bitte beachtet folgende wichtige Mitteilung vom Dojo-Team. Weitere Details folgen in Kürze oder könnt ihr direkt erfragen.' },
            ].map((tpl) => (
              <button
                key={tpl.label}
                type="button"
                className="ns-template-btn"
                onClick={() => setPushData({ ...pushData, title: tpl.title, message: tpl.message })}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Titel</label>
          <input
            type="text"
            value={pushData.title}
            onChange={(e) => setPushData({...pushData, title: e.target.value})}
            placeholder="Titel der Push-Nachricht..."
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>Nachricht</label>
          <textarea
            value={pushData.message}
            onChange={(e) => setPushData({...pushData, message: e.target.value})}
            placeholder="Ihre Push-Nachricht..."
            rows="4"
            className="form-textarea"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Icon URL (optional)</label>
            <input
              type="url"
              value={pushData.icon}
              onChange={(e) => setPushData({...pushData, icon: e.target.value})}
              placeholder="https://example.com/icon.png"
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label>Link URL (optional)</label>
            <input
              type="url"
              value={pushData.url}
              onChange={(e) => setPushData({...pushData, url: e.target.value})}
              placeholder="https://example.com"
              className="form-input"
            />
          </div>
        </div>

        {/* Im Chat anzeigen Option */}
        <div className="form-group ns-mt-sm">
          <label className="ns-label-row">
            <input
              type="checkbox"
              checked={pushData.send_to_chat}
              onChange={(e) => setPushData({...pushData, send_to_chat: e.target.checked})}
              className="ns-checkbox"
            />
            <span>📣 Im Ankündigungs-Chat anzeigen</span>
          </label>
          {pushData.send_to_chat && (
            <div className="ns-help-text">
              Die Nachricht erscheint auch als Chat-Nachricht im Ankündigungen-Kanal der Mitglieder-App.
            </div>
          )}
        </div>

        <div className="form-actions">
          <button
            onClick={handlePushSend}
            className="btn btn-primary"
            disabled={loading || !pushData.title || !pushData.message}
          >
            {loading ? 'Senden...' : '📱 Push-Nachricht senden'}
          </button>
        </div>
      </div>
    </div>
  );

  // Funktion zum Laden der Empfänger-Details
  const loadRecipientDetails = async (subject, timestamp) => {
    const key = `${subject}_${timestamp}`;

    // Wenn bereits expanded, dann collapse
    if (expandedNotifications[key]) {
      setExpandedNotifications({
        ...expandedNotifications,
        [key]: null
      });
      return;
    }

    try {
      const encodedSubject = encodeURIComponent(subject);
      const encodedTimestamp = encodeURIComponent(timestamp);
      const response = await fetchWithAuth(`/dashboard/notification-recipients/${encodedSubject}/${encodedTimestamp}`);
      const data = await response.json();

      if (data.success) {
        setExpandedNotifications({
          ...expandedNotifications,
          [key]: data.recipients
        });
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der Empfänger:', error);
    }
  };

  const renderHistory = () => {
    // Gruppiere Benachrichtigungen nach Subject + Timestamp
    const groupedNotifications = {};

    history.notifications?.forEach(notification => {
      const key = `${notification.subject}_${notification.created_at}`;
      if (!groupedNotifications[key]) {
        groupedNotifications[key] = {
          id: notification.id,
          subject: notification.subject,
          type: notification.type,
          timestamp: notification.created_at,
          message: notification.message,
          recipient: notification.recipient,
          total_sent: notification.total_sent || 1,
          total_read: notification.total_read || 0,
          status: notification.status
        };
      }
    });

    const groups = Object.values(groupedNotifications);

    return (
      <div className="notification-history ns-history-inner">
        <div className="history-header">
          <h3 className="ns-primary-mb">📋 Benachrichtigungs-Verlauf</h3>
          <p className="ns-subtitle">Übersicht über alle gesendeten Benachrichtigungen</p>
        </div>

        <div className="history-list u-flex-col-sm">
          {Array.isArray(groups) && groups.map((group, index) => {
            const key = `${group.subject}_${group.timestamp}`;
            const recipients = expandedNotifications[key];
            const readPercentage = group.total_sent > 0 ? Math.round((group.total_read / group.total_sent) * 100) : 0;

            return (
              <div
                key={index}
                className="ns-history-card"
              >
                {/* Header mit Subject und Typ */}
                <div className="ns-history-card-header">
                  <div className="ns-text-xl">
                    {group.type === 'email' ? '📧' : '📱'}
                  </div>
                  <div className="u-flex-1">
                    <h4 className="ns-history-title">
                      {group.subject}
                    </h4>
                    <div className="ns-history-time">
                      {new Date(group.timestamp).toLocaleString('de-DE')}
                    </div>
                  </div>
                  <div className={`ns-status-badge ${group.status === 'sent' ? 'ns-status-badge--sent' : 'ns-status-badge--failed'}`}>
                    {group.status === 'sent' ? '✅ Gesendet' :
                     group.status === 'failed' ? '❌ Fehlgeschlagen' : '⏳ Ausstehend'}
                  </div>
                  <button
                    onClick={() => deleteNotification(group.id)}
                    className="ns-btn-delete-single"
                    title="Nur diesen Empfänger löschen"
                  >
                    🗑️
                  </button>
                  <button
                    onClick={() => deleteBulkNotification(group.id)}
                    className="ns-btn-delete-bulk"
                    title="⚠️ Für ALLE Empfänger löschen"
                  >
                    <span>🗑️🗑️</span>
                    <span className="ns-text-2xs">Alle</span>
                  </button>
                </div>

                {/* Nachrichteninhalt */}
                {group.message && (
                  <div className="ns-message-preview">
                    <div className="ns-message-label">
                      Nachricht
                    </div>
                    <div
                      className="ns-message-content"
                      dangerouslySetInnerHTML={createSafeHtml(group.message)}
                    />
                  </div>
                )}

                {/* Empfänger anzeigen */}
                {group.recipient && (
                  <div className="ns-recipient-row">
                    <span className="ns-text-base">👤</span>
                    <span className="ns-recipient-label">
                      Empfänger:
                    </span>
                    <span className="ns-recipient-value">
                      {group.recipient}
                    </span>
                  </div>
                )}

                {/* Statistiken */}
                <div className="ns-stats-row">
                  <div className="ns-text-center">
                    <div className="ns-stat-num-sent">
                      {group.total_sent}
                    </div>
                    <div className="ns-stat-caption">
                      Gesendet
                    </div>
                  </div>

                  <div className="ns-text-center">
                    <div className="ns-stat-num-read">
                      {group.total_read}
                    </div>
                    <div className="ns-stat-caption">
                      Gelesen
                    </div>
                  </div>

                  <div className="ns-text-center">
                    <div className={`ns-stat-pct ${readPercentage >= 50 ? 'ns-stat-pct--good' : 'ns-stat-pct--warning'}`}>
                      {readPercentage}%
                    </div>
                    <div className="ns-stat-caption">
                      Gelesen
                    </div>
                  </div>
                </div>

                {/* Empfänger Button */}
                <button
                  onClick={() => loadRecipientDetails(group.subject, group.timestamp)}
                  className={`ns-btn-recipients ${recipients ? 'ns-btn-recipients--active' : ''}`}
                >
                  <span>{recipients ? '▼' : '▶'}</span>
                  <span>Empfänger anzeigen</span>
                </button>

                {/* Expanded Recipients List */}
                {recipients && (
                  <div className="ns-recipients-expanded">
                    <div className="ns-recipients-col">
                      {recipients.map((recipient, rIndex) => (
                        <div
                          key={rIndex}
                          className={`ns-recipient-expanded-row ${recipient.read ? 'ns-recipient-expanded-row--read' : ''}`}
                        >
                          <div className="ns-recipient-name-row">
                            <span className="ns-text-base">
                              {recipient.read ? '✅' : '📭'}
                            </span>
                            <span className="ns-recipient-name">
                              {recipient.recipient}
                            </span>
                          </div>
                          <span className={recipient.read ? 'ns-recipient-status--read' : 'ns-recipient-status--unread'}>
                            {recipient.read ? 'Gelesen' : 'Ungelesen'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {history.pagination && (
          <div className="ns-pagination">
            <button
              onClick={() => loadHistory(history.pagination.page - 1)}
              disabled={history.pagination.page <= 1}
              className="ns-btn-page"
            >
              ← Zurück
            </button>
            <span className="ns-page-indicator">
              Seite {history.pagination.page} von {history.pagination.pages}
            </span>
            <button
              onClick={() => loadHistory(history.pagination.page + 1)}
              disabled={history.pagination.page >= history.pagination.pages}
              className="ns-btn-page"
            >
              Weiter →
            </button>
          </div>
        )}
      </div>
    );
  };

  // ===================================================================
  // 📚 KURS-NACHRICHT
  // ===================================================================

  const sendKursNachricht = async () => {
    if (!kursNachricht.kursId || !kursNachricht.betreff || !kursNachricht.text) return;
    setKursNachrichtSending(true);
    setKursNachrichtResult(null);
    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/kurse/${kursNachricht.kursId}/bulk-nachricht`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ betreff: kursNachricht.betreff, nachricht: kursNachricht.text })
        }
      );
      const data = await response.json();
      if (data.success) {
        setKursNachrichtResult({ ok: true, msg: data.message || `Nachricht an ${data.count || ''} Mitglieder gesendet.` });
        setKursNachricht(prev => ({ ...prev, betreff: '', text: '' }));
      } else {
        setKursNachrichtResult({ ok: false, msg: data.error || 'Fehler beim Senden.' });
      }
    } catch (err) {
      setKursNachrichtResult({ ok: false, msg: 'Netzwerkfehler beim Senden.' });
    } finally {
      setKursNachrichtSending(false);
    }
  };

  const renderKursNachricht = () => {
    const selectedKurs = kurseList.find(k => String(k.kurs_id) === String(kursNachricht.kursId));
    return (
      <div className="email-composer">
        <div className="composer-header">
          <h3>📚 Kurs-Nachricht versenden</h3>
          <p>Nachricht an alle aktiven Mitglieder eines Kurses senden (letzte 30 Tage)</p>
        </div>

        <div className="composer-form">
          <div className="form-group">
            <label>Kurs auswählen</label>
            <select
              className="form-select"
              value={kursNachricht.kursId}
              onChange={e => { setKursNachricht(prev => ({ ...prev, kursId: e.target.value })); setKursNachrichtResult(null); }}
              style={{ background: '#2d2d4a', color: '#e2e8f0', border: '1px solid rgba(255,200,0,0.35)', padding: '10px 12px', borderRadius: '8px', width: '100%', fontSize: '14px' }}
            >
              <option value="">— Kurs wählen —</option>
              {kurseList.map(k => (
                <option key={k.kurs_id} value={k.kurs_id}>
                  {k.name}{k.stil_name ? ` (${k.stil_name})` : ''}
                </option>
              ))}
            </select>
            {selectedKurs && (
              <div className="ns-kurs-info">
                Empfänger: alle Mitglieder, die in den letzten 30 Tagen an <strong>{selectedKurs.name}</strong> teilgenommen haben
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Betreff</label>
            <input
              type="text"
              className="form-input"
              placeholder="Betreff der Nachricht..."
              value={kursNachricht.betreff}
              onChange={e => setKursNachricht(prev => ({ ...prev, betreff: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label>Nachricht</label>
            <textarea
              className="form-textarea"
              rows={6}
              placeholder="Nachricht eingeben..."
              value={kursNachricht.text}
              onChange={e => setKursNachricht(prev => ({ ...prev, text: e.target.value }))}
            />
          </div>

          {kursNachrichtResult && (
            <div className={`alert ${kursNachrichtResult.ok ? 'alert-success' : 'alert-error'}`}>
              {kursNachrichtResult.ok ? <CheckCircle size={20} /> : <XCircle size={20} />}
              {kursNachrichtResult.msg}
            </div>
          )}

          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={sendKursNachricht}
              disabled={kursNachrichtSending || !kursNachricht.kursId || !kursNachricht.betreff || !kursNachricht.text}
            >
              {kursNachrichtSending ? (
                <><Clock size={18} /> Wird gesendet...</>
              ) : (
                <><Send size={18} /> Kurs-Nachricht senden</>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ===================================================================
  // 🎨 MAIN RENDER
  // ===================================================================

  return (
    <div className="notification-system">
      {/* Navigation Tabs */}
      <div className="notification-tabs">
        <button 
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <CheckCircle size={20} />
          Dashboard
        </button>
        <button 
          className={`tab-btn ${activeTab === 'email' ? 'active' : ''}`}
          onClick={() => setActiveTab('email')}
        >
          <Mail size={20} />
          Email versenden
        </button>
        <button 
          className={`tab-btn ${activeTab === 'push' ? 'active' : ''}`}
          onClick={() => setActiveTab('push')}
        >
          <Bell size={20} />
          Push-Nachrichten
        </button>
        <button
          className={`tab-btn ${activeTab === 'kurs' ? 'active' : ''}`}
          onClick={() => setActiveTab('kurs')}
        >
          <BookOpen size={20} />
          Kurs-Nachricht
        </button>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={20} />
          Einstellungen
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={20} />
          Verlauf
        </button>
        {/* News Tab - Nur für Haupt-Admin */}
        {isMainAdmin && (
          <button
            className={`tab-btn ${activeTab === 'news' ? 'active' : ''}`}
            onClick={() => setActiveTab('news')}
          >
            <Newspaper size={20} />
            News verwalten
          </button>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="alert alert-error">
          <XCircle size={20} />
          {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success">
          <CheckCircle size={20} />
          {success}
        </div>
      )}

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'email' && renderEmailComposer()}
        {activeTab === 'push' && renderPushComposer()}
        {activeTab === 'kurs' && renderKursNachricht()}
        {activeTab === 'settings' && renderSettings()}
        {activeTab === 'history' && renderHistory()}
        {activeTab === 'news' && isMainAdmin && <NewsVerwaltung embedded={true} />}
      </div>
    </div>
  );
};

export default NotificationSystem;
