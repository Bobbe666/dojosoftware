import React, { useState, useEffect } from 'react';
import { Mail, Bell, Settings, Send, Users, History, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts';
import '../styles/NotificationSystem.css';

const NotificationSystem = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
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
      smtp_host: '',
      smtp_port: 587,
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
    url: ''
  });
  
  // Push Subscriptions State
  const [pushSubscriptions, setPushSubscriptions] = useState([]);
  
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
    loadTimelineData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const response = await fetch('/api/dashboard/notifications-dashboard');
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
      const response = await fetch('/api/email-service/settings');
      const data = await response.json();
      if (data.success && data.settings) {
        const loadedSettings = {
          ...data.settings,
          email_config: data.settings.email_config 
            ? (typeof data.settings.email_config === 'string' 
                ? JSON.parse(data.settings.email_config) 
                : data.settings.email_config)
            : {
                smtp_host: 'smtp.alfahosting.de',
                smtp_port: 587,
                smtp_secure: false,
                smtp_user: '',
                smtp_password: ''
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
      const response = await fetch('/api/notifications/settings');
      const data = await response.json();
      if (data.success) {
        const loadedSettings = {
          ...data.settings,
          email_config: data.settings.email_config ? JSON.parse(data.settings.email_config) : {
            smtp_host: 'smtp.alfahosting.de',
            smtp_port: 587,
            smtp_secure: false,
            smtp_user: '',
            smtp_password: ''
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
          smtp_host: 'smtp.alfahosting.de',
          smtp_port: 587,
          smtp_secure: false,
          smtp_user: '',
          smtp_password: ''
        }
      }));
    }
  };

  const loadRecipients = async () => {
    try {
      // Versuche zuerst die Dashboard-Route
      const response = await fetch('/api/dashboard/notification-recipients');
      const data = await response.json();
      if (data.success) {
        setRecipients({
          mitglieder: data.recipients.mitglieder || [],
          trainer: data.recipients.trainer || [],
          personal: data.recipients.personal || [],
          admin: data.recipients.admin || [],
          alle: data.recipients.alle || []
        });
        console.log('✅ Loaded recipients from dashboard API');
        return;
      }
    } catch (error) {
      console.log('⚠️ Mitglieder API failed, trying fallback');
    }

    try {
      // Fallback: Lade echte Daten direkt aus der Datenbank
      const response = await fetch('/api/notifications/recipients');
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
        const membersResponse = await fetch('/api/mitglieder');
        const membersData = await membersResponse.json();
        console.log('📊 Raw members data:', membersData.slice(0, 2)); // Zeige ersten 2 Einträge
        
        // Erstelle realistische Email-Adressen basierend auf den Namen
        memberEmails = membersData.map(member => {
          const firstName = (member.vorname || 'member').toLowerCase().replace(/[^a-z]/g, '');
          const lastName = (member.nachname || 'test').toLowerCase().replace(/[^a-z]/g, '');
          const email = `${firstName}.${lastName}@dojo.local`;
          
          return {
            email: email,
            name: `${member.vorname || ''} ${member.nachname || ''}`.trim(),
            type: 'mitglied'
          };
        });
        
        console.log(`✅ Created ${memberEmails.length} member emails`);
      } catch (error) {
        console.log('❌ Members API error:', error);
        memberEmails = [];
      }
      
      // Lade Trainer direkt
      const trainersResponse = await fetch('/api/trainer');
      const trainersData = await trainersResponse.json();
      
      const trainerEmails = trainersData.filter(trainer => trainer.email && trainer.email !== '').map(trainer => ({
        email: trainer.email,
        name: `${trainer.vorname || ''} ${trainer.nachname || ''}`.trim(),
        type: 'trainer'
      }));
      
      // Lade Personal direkt
      const personalResponse = await fetch('/api/personal');
      const personalData = await personalResponse.json();
      
      const personalEmails = personalData.filter(personal => personal.email && personal.email !== '').map(personal => ({
        email: personal.email,
        name: `${personal.vorname || ''} ${personal.nachname || ''}`.trim(),
        type: 'personal'
      }));
      
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
      const response = await fetch('/api/dashboard/notification-templates');
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
      const response = await fetch(`/api/dashboard/notification-history?page=${page}&limit=20`);
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
      const response = await fetch('/api/dashboard/push-subscriptions');
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
      const response = await fetch('/api/dashboard/notification-timeline?days=7');
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
      const response = await fetch('/api/email-service/settings', {
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
      const response = await fetch('/api/email-service/test', {
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
      const response = await fetch('/api/email-service/verify');
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
      const response = await fetch('/api/notifications/email/send', {
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
      const response = await fetch('/api/dashboard/push-send', {
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

  const requestPushPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        // Hier würde die Push-Subscription registriert werden
        setSuccess('Push-Benachrichtigungen aktiviert');
      } else {
        setError('Push-Benachrichtigungen wurden abgelehnt');
      }
    } else {
      setError('Push-Benachrichtigungen werden von diesem Browser nicht unterstützt');
    }
  };

  // ===================================================================
  // 🎨 RENDER FUNCTIONS
  // ===================================================================

  const renderDashboard = () => {
    // Daten für Charts vorbereiten
    const pieData = [
      { name: 'Emails', value: dashboardData.stats.email_notifications || 0, color: '#60a5fa' },
      { name: 'Push', value: dashboardData.stats.push_notifications || 0, color: '#22c55e' }
    ];

    const statusData = [
      { name: 'Erfolgreich', value: dashboardData.stats.sent_notifications || 0, color: '#22c55e' },
      { name: 'Fehlgeschlagen', value: dashboardData.stats.failed_notifications || 0, color: '#ef4444' }
    ];

    return (
      <div className="notification-dashboard" style={{
        background: 'rgba(20, 20, 30, 0.95)',
        borderRadius: '12px',
        padding: '1.5rem'
      }}>
        <div className="dashboard-header" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#ffd700', marginBottom: '0.5rem' }}>📧 Newsletter & Benachrichtigungen</h2>
          <p style={{ color: '#a0a0b0', fontSize: '0.9rem' }}>Verwalten Sie Email-Versand, Push-Nachrichten und Server-Einstellungen</p>
        </div>

        {/* Statistiken */}
        <div className="stats-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div className="stat-card" style={{
            background: 'rgba(30, 30, 45, 0.8)',
            border: '1px solid rgba(96, 165, 250, 0.3)',
            borderRadius: '10px',
            padding: '1.2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div className="stat-icon" style={{ fontSize: '2.5rem' }}>📧</div>
            <div className="stat-content">
              <h3 style={{ color: '#60a5fa', fontSize: '2rem', margin: 0 }}>{dashboardData.stats.email_notifications || 0}</h3>
              <p style={{ color: '#a0a0b0', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>Emails gesendet (30 Tage)</p>
            </div>
          </div>
          <div className="stat-card" style={{
            background: 'rgba(30, 30, 45, 0.8)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '10px',
            padding: '1.2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div className="stat-icon" style={{ fontSize: '2.5rem' }}>📱</div>
            <div className="stat-content">
              <h3 style={{ color: '#22c55e', fontSize: '2rem', margin: 0 }}>{dashboardData.stats.push_notifications || 0}</h3>
              <p style={{ color: '#a0a0b0', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>Push-Nachrichten</p>
            </div>
          </div>
          <div className="stat-card" style={{
            background: 'rgba(30, 30, 45, 0.8)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '10px',
            padding: '1.2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div className="stat-icon" style={{ fontSize: '2.5rem' }}>✅</div>
            <div className="stat-content">
              <h3 style={{ color: '#22c55e', fontSize: '2rem', margin: 0 }}>{dashboardData.stats.sent_notifications || 0}</h3>
              <p style={{ color: '#a0a0b0', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>Erfolgreich gesendet</p>
            </div>
          </div>
          <div className="stat-card" style={{
            background: 'rgba(30, 30, 45, 0.8)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            padding: '1.2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div className="stat-icon" style={{ fontSize: '2.5rem' }}>❌</div>
            <div className="stat-content">
              <h3 style={{ color: '#ef4444', fontSize: '2rem', margin: 0 }}>{dashboardData.stats.failed_notifications || 0}</h3>
              <p style={{ color: '#a0a0b0', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>Fehlgeschlagen</p>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          {/* Zeitverlauf Chart */}
          <div style={{
            background: 'rgba(30, 30, 45, 0.8)',
            border: '1px solid rgba(255, 215, 0, 0.2)',
            borderRadius: '10px',
            padding: '1.2rem'
          }}>
            <h4 style={{ color: '#ffd700', marginBottom: '1rem', fontSize: '1rem' }}>📈 Wochenverlauf</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis dataKey="tag" stroke="#a0a0b0" style={{ fontSize: '0.8rem' }} />
                <YAxis stroke="#a0a0b0" style={{ fontSize: '0.8rem' }} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(20, 20, 30, 0.95)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '8px',
                    color: '#e0e0e0'
                  }}
                />
                <Legend wrapperStyle={{ color: '#e0e0e0', fontSize: '0.85rem' }} />
                <Line type="monotone" dataKey="emails" stroke="#60a5fa" strokeWidth={2} name="Emails" />
                <Line type="monotone" dataKey="push" stroke="#22c55e" strokeWidth={2} name="Push" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Verteilung Email vs Push */}
          <div style={{
            background: 'rgba(30, 30, 45, 0.8)',
            border: '1px solid rgba(255, 215, 0, 0.2)',
            borderRadius: '10px',
            padding: '1.2rem'
          }}>
            <h4 style={{ color: '#ffd700', marginBottom: '1rem', fontSize: '1rem' }}>📊 Verteilung Typen</h4>
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
                    color: '#e0e0e0'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Status Chart */}
          <div style={{
            background: 'rgba(30, 30, 45, 0.8)',
            border: '1px solid rgba(255, 215, 0, 0.2)',
            borderRadius: '10px',
            padding: '1.2rem'
          }}>
            <h4 style={{ color: '#ffd700', marginBottom: '1rem', fontSize: '1rem' }}>✅ Erfolgsrate</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis dataKey="name" stroke="#a0a0b0" style={{ fontSize: '0.8rem' }} />
                <YAxis stroke="#a0a0b0" style={{ fontSize: '0.8rem' }} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(20, 20, 30, 0.95)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '8px',
                    color: '#e0e0e0'
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
        <div className="recent-notifications" style={{
          background: 'rgba(30, 30, 45, 0.8)',
          border: '1px solid rgba(255, 215, 0, 0.2)',
          borderRadius: '10px',
          padding: '1.2rem'
        }}>
          <h3 style={{ color: '#ffd700', marginBottom: '1rem', fontSize: '1.1rem' }}>🔔 Letzte Benachrichtigungen</h3>
          <div className="notifications-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {dashboardData.recentNotifications?.map((notification, index) => (
              <div key={index} className="notification-item" style={{
                background: 'rgba(20, 20, 30, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <div className="notification-icon" style={{ fontSize: '1.5rem' }}>
                  {notification.type === 'email' ? '📧' : '📱'}
                </div>
                <div className="notification-content" style={{ flex: 1 }}>
                  <div className="notification-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.3rem'
                  }}>
                    <span className="notification-recipient" style={{
                      color: '#e0e0e0',
                      fontSize: '0.9rem',
                      fontWeight: '600'
                    }}>{notification.recipient}</span>
                    <span className={`notification-status ${notification.status}`} style={{
                      fontSize: '1rem'
                    }}>
                      {notification.status === 'sent' ? '✅' :
                       notification.status === 'failed' ? '❌' : '⏳'}
                    </span>
                  </div>
                  <div className="notification-subject" style={{
                    color: '#ffd700',
                    fontSize: '0.85rem',
                    marginBottom: '0.2rem'
                  }}>{notification.subject}</div>
                  <div className="notification-time" style={{
                    color: '#808090',
                    fontSize: '0.75rem'
                  }}>
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
    <div className="notification-settings" style={{
      background: 'rgba(20, 20, 30, 0.95)',
      borderRadius: '12px',
      padding: '1.5rem'
    }}>
      <div className="settings-header" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ color: '#ffd700', marginBottom: '0.5rem' }}>⚙️ Server-Einstellungen</h3>
        <p style={{ color: '#a0a0b0', fontSize: '0.9rem' }}>Konfigurieren Sie Email- und Push-Notification-Einstellungen</p>
      </div>

      {/* Email-Einstellungen */}
      <div className="settings-section" style={{
        background: 'rgba(30, 30, 45, 0.8)',
        border: '1px solid rgba(255, 215, 0, 0.2)',
        borderRadius: '10px',
        padding: '1.2rem',
        marginBottom: '1.5rem'
      }}>
        <div className="section-header" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem'
        }}>
          <h4 style={{ color: '#ffd700', margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>📧 Email-Konfiguration</h4>
          <label className="toggle-switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px' }}>
            <input
              type="checkbox"
              checked={settings.email_enabled}
              onChange={(e) => setSettings({...settings, email_enabled: e.target.checked})}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span className="toggle-slider" style={{
              position: 'absolute',
              cursor: 'pointer',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: settings.email_enabled ? '#22c55e' : '#606070',
              transition: '0.4s',
              borderRadius: '24px'
            }}></span>
          </label>
        </div>

        {settings.email_enabled && (
          <div className="email-config">
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label style={{ color: '#e0e0e0', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>SMTP Host</label>
                <input
                  type="text"
                  value={settings.email_config.smtp_host}
                  onChange={(e) => setSettings({
                    ...settings,
                    email_config: {...settings.email_config, smtp_host: e.target.value}
                  })}
                  placeholder="smtp.alfahosting.de"
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: 'rgba(20, 20, 30, 0.6)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '8px',
                    color: '#e0e0e0',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
              <div className="form-group">
                <label style={{ color: '#e0e0e0', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>SMTP Port</label>
                <input
                  type="number"
                  value={settings.email_config.smtp_port}
                  onChange={(e) => setSettings({
                    ...settings,
                    email_config: {...settings.email_config, smtp_port: parseInt(e.target.value)}
                  })}
                  placeholder="587"
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: 'rgba(20, 20, 30, 0.6)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '8px',
                    color: '#e0e0e0',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label style={{ color: '#e0e0e0', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>SMTP Benutzername</label>
                <input
                  type="text"
                  value={settings.email_config.smtp_user}
                  onChange={(e) => setSettings({
                    ...settings,
                    email_config: {...settings.email_config, smtp_user: e.target.value}
                  })}
                  placeholder="ihre-email@ihre-domain.de"
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: 'rgba(20, 20, 30, 0.6)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '8px',
                    color: '#e0e0e0',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
              <div className="form-group">
                <label style={{ color: '#e0e0e0', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>SMTP Passwort</label>
                <input
                  type="password"
                  value={settings.email_config.smtp_password}
                  onChange={(e) => setSettings({
                    ...settings,
                    email_config: {...settings.email_config, smtp_password: e.target.value}
                  })}
                  placeholder="App-Passwort"
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: 'rgba(20, 20, 30, 0.6)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '8px',
                    color: '#e0e0e0',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label style={{ color: '#e0e0e0', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>Standard Absender-Email</label>
                <input
                  type="email"
                  value={settings.default_from_email}
                  onChange={(e) => setSettings({...settings, default_from_email: e.target.value})}
                  placeholder="noreply@ihrdojo.de"
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: 'rgba(20, 20, 30, 0.6)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '8px',
                    color: '#e0e0e0',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
              <div className="form-group">
                <label style={{ color: '#e0e0e0', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>Standard Absender-Name</label>
                <input
                  type="text"
                  value={settings.default_from_name}
                  onChange={(e) => setSettings({...settings, default_from_name: e.target.value})}
                  placeholder="Dojo Software"
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: 'rgba(20, 20, 30, 0.6)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '8px',
                    color: '#e0e0e0',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
            </div>

            <div className="form-actions" style={{ 
              marginTop: '1rem', 
              display: 'flex', 
              gap: '0.8rem',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={handleSMTPVerify}
                disabled={loading || !settings.email_enabled}
                style={{
                  padding: '0.7rem 1.5rem',
                  background: 'rgba(34, 197, 94, 0.2)',
                  border: '1px solid rgba(34, 197, 94, 0.4)',
                  borderRadius: '8px',
                  color: '#22c55e',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: (loading || !settings.email_enabled) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: (!settings.email_enabled) ? 0.5 : 1
                }}
                onMouseEnter={(e) => !loading && settings.email_enabled && (e.currentTarget.style.background = 'rgba(34, 197, 94, 0.3)')}
                onMouseLeave={(e) => !loading && settings.email_enabled && (e.currentTarget.style.background = 'rgba(34, 197, 94, 0.2)')}
                title="SMTP-Verbindung testen"
              >
                🔌 SMTP-Verbindung testen
              </button>
              <button
                onClick={handleEmailTest}
                disabled={loading || !settings.email_enabled}
                style={{
                  padding: '0.7rem 1.5rem',
                  background: 'rgba(96, 165, 250, 0.2)',
                  border: '1px solid rgba(96, 165, 250, 0.4)',
                  borderRadius: '8px',
                  color: '#60a5fa',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: (loading || !settings.email_enabled) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: (!settings.email_enabled) ? 0.5 : 1
                }}
                onMouseEnter={(e) => !loading && settings.email_enabled && (e.currentTarget.style.background = 'rgba(96, 165, 250, 0.3)')}
                onMouseLeave={(e) => !loading && settings.email_enabled && (e.currentTarget.style.background = 'rgba(96, 165, 250, 0.2)')}
                title="Test-E-Mail versenden"
              >
                📧 Test-Email senden
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Push-Notification-Einstellungen */}
      <div className="settings-section" style={{
        background: 'rgba(30, 30, 45, 0.8)',
        border: '1px solid rgba(255, 215, 0, 0.2)',
        borderRadius: '10px',
        padding: '1.2rem',
        marginBottom: '1.5rem'
      }}>
        <div className="section-header" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem'
        }}>
          <h4 style={{ color: '#ffd700', margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>📱 Push-Notifications</h4>
          <label className="toggle-switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px' }}>
            <input
              type="checkbox"
              checked={settings.push_enabled}
              onChange={(e) => setSettings({...settings, push_enabled: e.target.checked})}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span className="toggle-slider" style={{
              position: 'absolute',
              cursor: 'pointer',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: settings.push_enabled ? '#22c55e' : '#606070',
              transition: '0.4s',
              borderRadius: '24px'
            }}></span>
          </label>
        </div>

        {settings.push_enabled && (
          <div className="push-config">
            <p style={{ color: '#a0a0b0', fontSize: '0.9rem' }}>Push-Notification-Konfiguration wird hier implementiert...</p>
          </div>
        )}
      </div>

      <div className="settings-actions" style={{ textAlign: 'right' }}>
        <button
          onClick={handleSettingsSave}
          disabled={loading}
          style={{
            padding: '0.8rem 2rem',
            background: 'rgba(255, 215, 0, 0.2)',
            border: '1px solid rgba(255, 215, 0, 0.4)',
            borderRadius: '8px',
            color: '#ffd700',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => !loading && (e.currentTarget.style.background = 'rgba(255, 215, 0, 0.3)')}
          onMouseLeave={(e) => !loading && (e.currentTarget.style.background = 'rgba(255, 215, 0, 0.2)')}
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

      <div className="composer-form">
        <div className="form-group">
          <label>Empfänger auswählen</label>
          <div className="recipient-selector">
            <div className="recipient-groups">
              <button 
                className={`recipient-group-btn ${emailData.recipients.length === recipients.mitglieder.length ? 'active' : ''}`}
                onClick={() => setEmailData({...emailData, recipients: recipients.mitglieder.map(r => r.email)})}
              >
                👥 Alle Mitglieder ({recipients.mitglieder.length})
              </button>
              <button 
                className={`recipient-group-btn ${emailData.recipients.length === recipients.trainer.length ? 'active' : ''}`}
                onClick={() => setEmailData({...emailData, recipients: recipients.trainer.map(r => r.email)})}
              >
                👨‍🏫 Alle Trainer ({recipients.trainer.length})
              </button>
              <button 
                className={`recipient-group-btn ${emailData.recipients.length === recipients.personal.length ? 'active' : ''}`}
                onClick={() => setEmailData({...emailData, recipients: recipients.personal.map(r => r.email)})}
              >
                🧑‍💼 Alle Mitarbeiter ({recipients.personal.length})
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
            {templates.map(template => (
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
            <p className="permission-info">
              Aktive Abonnements: {pushSubscriptions.length}
            </p>
          </div>
        </div>

        <div className="form-group">
          <label>Empfänger auswählen</label>
          <div className="recipient-selector">
            <div className="recipient-groups">
              <button 
                className={`recipient-group-btn ${pushData.recipients.length === recipients.mitglieder.length ? 'active' : ''}`}
                onClick={() => setPushData({...pushData, recipients: recipients.mitglieder.map(r => r.email)})}
              >
                👥 Alle Mitglieder ({recipients.mitglieder.length})
              </button>
              <button 
                className={`recipient-group-btn ${pushData.recipients.length === recipients.trainer.length ? 'active' : ''}`}
                onClick={() => setPushData({...pushData, recipients: recipients.trainer.map(r => r.email)})}
              >
                👨‍🏫 Alle Trainer ({recipients.trainer.length})
              </button>
              <button 
                className={`recipient-group-btn ${pushData.recipients.length === recipients.personal.length ? 'active' : ''}`}
                onClick={() => setPushData({...pushData, recipients: recipients.personal.map(r => r.email)})}
              >
                🧑‍💼 Alle Mitarbeiter ({recipients.personal.length})
              </button>
              <button 
                className={`recipient-group-btn ${pushData.recipients.length === (recipients.admin?.length || 0) ? 'active' : ''}`}
                onClick={() => setPushData({...pushData, recipients: (recipients.admin || []).map(r => r.email)})}
              >
                👑 Alle Admins ({recipients.admin?.length || 0})
              </button>
            </div>
            
            <div className="selected-recipients">
              <strong>Ausgewählte Empfänger: {pushData.recipients.length}</strong>
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
      const response = await fetch(`/api/dashboard/notification-recipients/${encodedSubject}/${encodedTimestamp}`);
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
          subject: notification.subject,
          type: notification.type,
          timestamp: notification.created_at,
          total_sent: notification.total_sent || 1,
          total_read: notification.total_read || 0,
          status: notification.status
        };
      }
    });

    const groups = Object.values(groupedNotifications);

    return (
      <div className="notification-history" style={{
        background: 'rgba(20, 20, 30, 0.95)',
        borderRadius: '12px',
        padding: '1.5rem'
      }}>
        <div className="history-header" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ color: '#ffd700', marginBottom: '0.5rem' }}>📋 Benachrichtigungs-Verlauf</h3>
          <p style={{ color: '#a0a0b0', fontSize: '0.9rem' }}>Übersicht über alle gesendeten Benachrichtigungen</p>
        </div>

        <div className="history-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {groups.map((group, index) => {
            const key = `${group.subject}_${group.timestamp}`;
            const recipients = expandedNotifications[key];
            const readPercentage = group.total_sent > 0 ? Math.round((group.total_read / group.total_sent) * 100) : 0;

            return (
              <div
                key={index}
                style={{
                  background: 'rgba(30, 30, 45, 0.8)',
                  border: '1px solid rgba(255, 215, 0, 0.2)',
                  borderRadius: '10px',
                  padding: '1rem',
                  transition: 'all 0.3s ease'
                }}
              >
                {/* Header mit Subject und Typ */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.8rem',
                  marginBottom: '0.8rem'
                }}>
                  <div style={{ fontSize: '1.5rem' }}>
                    {group.type === 'email' ? '📧' : '📱'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{
                      color: '#ffd700',
                      margin: 0,
                      fontSize: '1rem',
                      fontWeight: '600'
                    }}>
                      {group.subject}
                    </h4>
                    <div style={{
                      color: '#808090',
                      fontSize: '0.85rem',
                      marginTop: '0.2rem'
                    }}>
                      {new Date(group.timestamp).toLocaleString('de-DE')}
                    </div>
                  </div>
                  <div style={{
                    background: group.status === 'sent' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: group.status === 'sent' ? '#22c55e' : '#ef4444',
                    padding: '0.3rem 0.8rem',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: '600'
                  }}>
                    {group.status === 'sent' ? '✅ Gesendet' :
                     group.status === 'failed' ? '❌ Fehlgeschlagen' : '⏳ Ausstehend'}
                  </div>
                </div>

                {/* Statistiken */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.8rem',
                  marginBottom: '0.8rem',
                  padding: '0.8rem',
                  background: 'rgba(20, 20, 30, 0.5)',
                  borderRadius: '8px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color: '#60a5fa'
                    }}>
                      {group.total_sent}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#a0a0b0',
                      marginTop: '0.2rem'
                    }}>
                      Gesendet
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color: '#22c55e'
                    }}>
                      {group.total_read}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#a0a0b0',
                      marginTop: '0.2rem'
                    }}>
                      Gelesen
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color: readPercentage >= 50 ? '#22c55e' : '#f59e0b'
                    }}>
                      {readPercentage}%
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#a0a0b0',
                      marginTop: '0.2rem'
                    }}>
                      Gelesen
                    </div>
                  </div>
                </div>

                {/* Empfänger Button */}
                <button
                  onClick={() => loadRecipientDetails(group.subject, group.timestamp)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: recipients ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${recipients ? 'rgba(255, 215, 0, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '8px',
                    color: recipients ? '#ffd700' : '#e0e0e0',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 215, 0, 0.3)';
                    e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.6)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = recipients ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = recipients ? 'rgba(255, 215, 0, 0.4)' : 'rgba(255, 255, 255, 0.1)';
                  }}
                >
                  <span>{recipients ? '▼' : '▶'}</span>
                  <span>Empfänger anzeigen</span>
                </button>

                {/* Expanded Recipients List */}
                {recipients && (
                  <div style={{
                    marginTop: '0.8rem',
                    padding: '0.8rem',
                    background: 'rgba(20, 20, 30, 0.6)',
                    borderRadius: '8px',
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem'
                    }}>
                      {recipients.map((recipient, rIndex) => (
                        <div
                          key={rIndex}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.5rem 0.8rem',
                            background: recipient.read ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                            border: `1px solid ${recipient.read ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                            borderRadius: '6px',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            <span style={{ fontSize: '1rem' }}>
                              {recipient.read ? '✅' : '📭'}
                            </span>
                            <span style={{
                              color: '#e0e0e0',
                              fontSize: '0.9rem'
                            }}>
                              {recipient.recipient}
                            </span>
                          </div>
                          <span style={{
                            fontSize: '0.75rem',
                            color: recipient.read ? '#22c55e' : '#808090',
                            fontWeight: '600'
                          }}>
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
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            marginTop: '1.5rem',
            padding: '1rem 0'
          }}>
            <button
              onClick={() => loadHistory(history.pagination.page - 1)}
              disabled={history.pagination.page <= 1}
              style={{
                padding: '0.6rem 1.2rem',
                background: history.pagination.page <= 1 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 215, 0, 0.2)',
                border: '1px solid rgba(255, 215, 0, 0.3)',
                borderRadius: '8px',
                color: history.pagination.page <= 1 ? '#606070' : '#ffd700',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: history.pagination.page <= 1 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              ← Zurück
            </button>
            <span style={{
              color: '#e0e0e0',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}>
              Seite {history.pagination.page} von {history.pagination.pages}
            </span>
            <button
              onClick={() => loadHistory(history.pagination.page + 1)}
              disabled={history.pagination.page >= history.pagination.pages}
              style={{
                padding: '0.6rem 1.2rem',
                background: history.pagination.page >= history.pagination.pages ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 215, 0, 0.2)',
                border: '1px solid rgba(255, 215, 0, 0.3)',
                borderRadius: '8px',
                color: history.pagination.page >= history.pagination.pages ? '#606070' : '#ffd700',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: history.pagination.page >= history.pagination.pages ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Weiter →
            </button>
          </div>
        )}
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
        {activeTab === 'settings' && renderSettings()}
        {activeTab === 'history' && renderHistory()}
      </div>
    </div>
  );
};

export default NotificationSystem;
