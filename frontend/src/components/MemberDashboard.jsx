import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  User,
  Calendar,
  CreditCard,
  BarChart3,
  Clock,
  Award,
  Settings,
  Bell,
  Trophy,
  Package,
  Star
} from 'lucide-react';
import MemberHeader from './MemberHeader.jsx';
import MemberCheckin from './MemberCheckin.jsx';
import MotivationQuotes from './MotivationQuotes.jsx';
import WeatherWidget from './WeatherWidget.jsx';
import TrainingReminders from './TrainingReminders.jsx';
import '../styles/themes.css';
import '../styles/Dashboard.css';
import '../styles/DashboardStart.css';
import '../styles/MemberNavigation.css';
import '../styles/MotivationQuotes.css';
import '../styles/WeatherWidget.css';
import '../styles/TrainingReminders.css';
import config from '../config/config.js';

const MemberDashboard = () => {
  const { user } = useAuth();
  
  // Cache-Breaking für bessere Debugging
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    trainingsstunden: 0,
    anwesenheit: 0,
    offeneBeitraege: 0,
    naechstePruefung: null
  });
  const [memberData, setMemberData] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [showMemberCheckin, setShowMemberCheckin] = useState(false);
  
  // Stil & Gurt Daten
  const [memberStile, setMemberStile] = useState([]);
  const [styleSpecificData, setStyleSpecificData] = useState({});
  const [stileLoading, setStileLoading] = useState(false);
  const [nextExam, setNextExam] = useState(null);
  const [stile, setStile] = useState([]);

  // Push-Benachrichtigungen
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Prüfungstermine
  const [approvedExams, setApprovedExams] = useState([]);
  const [examResults, setExamResults] = useState([]);

  // Fehlerhandling
  const [error, setError] = useState(null);

  // Prüfungsanmeldung Modal
  const [showExamRegistrationModal, setShowExamRegistrationModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [acceptedConditions, setAcceptedConditions] = useState(false);

  // Quick Action Handler
  const handleQuickAction = (action) => {
    switch (action) {
      case 'checkin':
        setShowMemberCheckin(true);
        break;
      case 'notifications':
        // Scrolle zu den Benachrichtigungen
        const notificationsElement = document.getElementById('member-notifications');
        if (notificationsElement) {
          notificationsElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        break;
      default:
        break;
    }
  };


  // Lade Push-Benachrichtigungen für dieses Mitglied
  const loadNotifications = async (email) => {
    try {
      const response = await fetch(`/notifications/member/${encodeURIComponent(email)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setNotifications(data.notifications || []);
          setUnreadCount(data.notifications?.filter(n => !n.read).length || 0);
        }
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der Benachrichtigungen:', error);
    }
  };

  // Bestätige eine Benachrichtigung
  const confirmNotification = async (notificationId) => {
    try {
      const response = await fetch(`/notifications/confirm/${notificationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mitglied_id: memberData.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert('✅ Benachrichtigung bestätigt!');
          // Benachrichtigungen neu laden
          await loadNotifications(memberData.email || user?.email);
        }
      } else {
        const error = await response.json();
        alert('❌ Fehler: ' + (error.error || 'Konnte nicht bestätigt werden'));
      }
    } catch (error) {
      console.error('❌ Fehler beim Bestätigen der Benachrichtigung:', error);
      alert('❌ Fehler beim Bestätigen der Benachrichtigung');
    }
  };

  // Lade zugelassene Prüfungen für dieses Mitglied
  const loadApprovedExams = async (memberId) => {
    try {
      const response = await fetch(`/pruefungen?mitglied_id=${memberId}&status=geplant`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.pruefungen) {
          setApprovedExams(data.pruefungen);

          // Setze nächste Prüfung wenn vorhanden
          if (data.pruefungen.length > 0) {
            const nextExamData = data.pruefungen[0]; // Erste Prüfung (nach Datum sortiert)
            setNextExam({
              date: nextExamData.pruefungsdatum,
              stil: nextExamData.stil_name,
              stilId: nextExamData.stil_id,
              graduierung: nextExamData.graduierung_nachher
            });
          }
        }
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der Prüfungstermine:', error);
    }
  };

  // Lade abgeschlossene Prüfungen (Ergebnisse)
  const loadExamResults = async (memberId) => {
    try {
      const response = await fetch(`/pruefungen/mitglied/${memberId}/historie`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.historie) {
          setExamResults(data.historie);
        }
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der Prüfungsergebnisse:', error);
    }
  };

  // Echte Daten für das eingeloggte Mitglied laden
  useEffect(() => {
    const loadMemberData = async () => {
      try {
        // 🔐 WICHTIG: Verwende mitglied_id aus JWT-Token (nicht E-Mail!)
        const mitgliedId = user?.mitglied_id;

        if (!mitgliedId) {
          console.error('❌ Keine mitglied_id im User-Token gefunden!', user);
          setError('Kein Mitgliedsprofil gefunden. Bitte kontaktieren Sie den Administrator.');
          return;
        }

        console.log('🔍 Lade Mitgliedsdaten für ID:', mitgliedId);

        const memberResponse = await fetch(`/mitglieder/${mitgliedId}`);

        if (!memberResponse.ok) {
          throw new Error(`HTTP ${memberResponse.status}: ${memberResponse.statusText}`);
        }

        const memberData = await memberResponse.json();
        console.log('✅ Mitgliedsdaten empfangen:', memberData);

        // Anwesenheitsdaten laden (mit mitglied_id direkt)
        const attendanceResponse = await fetch(`/anwesenheit/${memberData.mitglied_id}`);

        let attendanceData = [];
        if (attendanceResponse.ok) {
          try {
            attendanceData = await attendanceResponse.json();
          } catch (e) {
            console.error('❌ Fehler beim Parsen der Anwesenheitsdaten:', e);
          }
        } else if (attendanceResponse.status === 404) {
          // 404 bedeutet keine Anwesenheitsdaten vorhanden - das ist ok
        } else {
          console.error('❌ Fehler beim Laden der Anwesenheitsdaten:', attendanceResponse.statusText);
        }

        // Beitragsdaten laden - verwende den Mitgliederdetail-Endpoint
        // Da es keinen spezifischen Beitrags-Endpoint gibt, müssen wir diese Daten anders laden
        // Lass uns erstmal nur die Verträge des Mitglieds prüfen
        const vertraegeResponse = await fetch(`/vertraege?mitglied_id=${memberData.mitglied_id}`);

        let vertraegeData = [];
        if (vertraegeResponse.ok) {
          try {
            vertraegeData = await vertraegeResponse.json();
          } catch (e) {
            console.error('❌ Fehler beim Parsen der Vertragsdaten:', e);
          }
        } else if (vertraegeResponse.status === 404) {
        } else {
          console.error('❌ Fehler beim Laden der Vertragsdaten:', vertraegeResponse.statusText);
        }

        // Berechne offene Beiträge aus Verträgen
        // WICHTIG: API gibt alle Verträge zurück, nicht gefiltert - wir müssen selbst filtern!
        const memberVertraege = Array.isArray(vertraegeData?.data)
          ? vertraegeData.data.filter(v => v.mitglied_id === memberData.mitglied_id)
          : Array.isArray(vertraegeData)
            ? vertraegeData.filter(v => v.mitglied_id === memberData.mitglied_id)
            : [];

        const paymentsData = memberVertraege;
        
        // Berechne Statistiken

        // Gesamtanzahl der Trainingsstunden
        const totalAttendance = Array.isArray(attendanceData) ? attendanceData.length : 0;

        // Berechne Anwesenheitsquote wie im Detail-View
        // = (Anwesende Trainings / Alle Trainingseinträge) * 100
        const totalAnwesend = Array.isArray(attendanceData)
          ? attendanceData.filter(a => a.anwesend === 1 || a.anwesend === true).length
          : 0;

        const attendancePercentage = totalAttendance > 0
          ? Math.round((totalAnwesend / totalAttendance) * 100)
          : 0;

        // Offene Beiträge zählen - basierend auf aktiven Verträgen ohne Lastschrift
        const openPayments = Array.isArray(paymentsData)
          ? paymentsData.filter(v =>
              v.status === 'aktiv' &&
              (!v.lastschrift_status || v.lastschrift_status === 'ausstehend' || v.lastschrift_status === 'fehlgeschlagen')
            ).length
          : 0;

        const nextExam = memberData.naechste_pruefung_datum;

        setStats({
          trainingsstunden: totalAttendance,
          anwesenheit: attendancePercentage,
          offeneBeitraege: openPayments,
          naechstePruefung: nextExam
        });
        
        // Speichere Mitgliederdaten für weitere Verwendung
        setMemberData(memberData);
        console.log('✅ memberData State gesetzt für:', memberData.vorname, memberData.nachname);
        setAttendanceHistory(attendanceData);
        setPaymentHistory(paymentsData);

        // Lade Stil & Gurt Daten
        await loadMemberStyles(memberData.mitglied_id);

        // Lade Push-Benachrichtigungen
        await loadNotifications(memberData.email || user?.email);

        // Lade Prüfungstermine
        await loadApprovedExams(memberData.mitglied_id);

        // Lade Prüfungsergebnisse
        await loadExamResults(memberData.mitglied_id);

        
      } catch (error) {
        console.error('❌ Fehler beim Laden der Mitgliederdaten:', error);
        // Fallback auf Mock-Daten
        setStats({
          trainingsstunden: 156,
          anwesenheit: 89,
          offeneBeitraege: 2,
          naechstePruefung: '2024-02-15'
        });
      }
    };

    // Geburtstags-Prüfung
    const checkBirthday = async () => {
      if (!user?.mitglied_id) return;

      try {
        const response = await fetch(`${config.apiBaseUrl}/mitglieder/${user.mitglied_id}/birthday-check`);
        const data = await response.json();

        if (data.hasBirthday) {
          // Füge Geburtstags-Benachrichtigung hinzu
          const birthdayNotification = {
            id: `birthday-${Date.now()}`,
            type: 'birthday',
            title: '🎉 Herzlichen Glückwunsch!',
            message: `Alles Gute zum ${data.mitglied.alter}. Geburtstag! Wir wünschen dir einen wundervollen Tag! 🎂`,
            timestamp: new Date().toISOString(),
            read: false,
            priority: 'high'
          };

          setNotifications(prev => [birthdayNotification, ...prev]);
          setUnreadCount(prev => prev + 1);

          console.log(`🎂 Geburtstag erkannt: ${data.mitglied.vorname} wird ${data.mitglied.alter} Jahre alt!`);
        }
      } catch (error) {
        console.error('Fehler beim Geburtstags-Check:', error);
      }
    };

    if (user?.email) {
      loadMemberData();
      checkBirthday();
    }
  }, [user?.email, user?.mitglied_id]);

  // Lade alle verfügbaren Stile
  const loadStile = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/stile`);
      if (response.ok) {
        const data = await response.json();
        setStile(data);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Stile:', error);
    }
  };

  // Lade Stil & Gurt Daten
  const loadMemberStyles = async (memberId) => {
    setStileLoading(true);
    try {
      // Lade zuerst alle Stile
      await loadStile();
      
      const response = await fetch(`/mitglieder/${memberId}/stile`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.stile) {
          setMemberStile(result.stile);
          
          // Lade stilspezifische Daten für jeden Stil
          result.stile.forEach(async (stil) => {
            await loadStyleSpecificData(memberId, stil.stil_id);
          });
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Mitglied-Stile:', error);
    } finally {
      setStileLoading(false);
    }
  };

  // Lade stilspezifische Daten
  const loadStyleSpecificData = async (memberId, stilId) => {
    try {
      const response = await fetch(`/mitglieder/${memberId}/stil/${stilId}/data`);
      if (response.ok) {
        const result = await response.json();
        setStyleSpecificData(prev => ({
          ...prev,
          [stilId]: result.data
        }));

        // Prüfe auf nächste Prüfung
        if (result.data?.naechste_pruefung) {
          const examDate = new Date(result.data.naechste_pruefung);
          const today = new Date();
          if (examDate > today) {
            const stilData = stile.find(s => s.stil_id === stilId);
            setNextExam({
              date: examDate,
              stil: stilData?.name || 'Unbekannt',
              stilId: stilId
            });
          }
        }
      }
    } catch (error) {
      console.error(`Fehler beim Laden stilspezifischer Daten für Stil ${stilId}:`, error);
    }
  };

  // Prüfungsanmeldung Handler
  const handleOpenExamRegistration = (exam) => {
    setSelectedExam(exam);
    setAcceptedConditions(false);
    setShowExamRegistrationModal(true);
  };

  const handleExamRegistration = async () => {
    if (!selectedExam || !acceptedConditions) {
      alert('Bitte akzeptiere die Teilnahmebedingungen.');
      return;
    }

    try {
      const response = await fetch(`/pruefungen/${selectedExam.pruefung_id}/teilnahme-bestaetigen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mitglied_id: memberData.mitglied_id
        })
      });

      if (response.ok) {
        const result = await response.json();

        // Reload exams to reflect the new confirmation status
        await loadApprovedExams(memberData.mitglied_id);

        // Close modal and reset state
        setShowExamRegistrationModal(false);
        setSelectedExam(null);
        setAcceptedConditions(false);

        // Show success message
        alert('✅ Deine Teilnahme wurde erfolgreich bestätigt!');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fehler bei der Anmeldung');
      }
    } catch (error) {
      console.error('❌ Fehler bei Prüfungsanmeldung:', error);
      alert(`Fehler bei der Anmeldung: ${error.message}`);
    }
  };

  const handleNavigation = (path) => {
    navigate(path);
  };

  // Berechne Tage bis zur Prüfung
  const getDaysUntilExam = (examDate) => {
    const today = new Date();
    const exam = new Date(examDate);
    const diffTime = exam - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Keine geplant';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  // Debug: Log memberData status on render
  console.log('🎨 MemberDashboard Render - memberData:', memberData ? 'vorhanden' : 'nicht vorhanden', memberData);

  return (
    <div className="dashboard-container">
      <MemberHeader />

      <div className="dashboard-content">
        <div className="dashboard-start">
          {/* Header - wie beim Admin Dashboard */}
          <h1 style={{ marginBottom: '0.5rem' }}>Willkommen zurück, {memberData ? `${memberData.vorname} ${memberData.nachname}` : user?.username || 'Mitglied'}! <span style={{ marginLeft: '0.5rem' }}>👋</span></h1>
          <p className="slogan" style={{ marginBottom: '1.5rem' }}>Deine persönliche Trainingsübersicht</p>

      {/* Statistiken-Bereich */}
      {memberData && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: '0.8rem', 
          marginBottom: '1.5rem' 
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 215, 0, 0.2)',
            borderRadius: '12px',
            padding: '1rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', color: '#ffd700', marginBottom: '0.3rem' }}>🏃‍♂️</div>
            <h3 style={{ color: '#ffffff', marginBottom: '0.3rem', fontSize: '0.9rem' }}>Trainingsstunden</h3>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ffd700' }}>{stats.trainingsstunden}</div>
          </div>
          
          <div style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 215, 0, 0.2)',
            borderRadius: '12px',
            padding: '1rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', color: '#ffd700', marginBottom: '0.3rem' }}>📊</div>
            <h3 style={{ color: '#ffffff', marginBottom: '0.3rem', fontSize: '0.9rem' }}>Anwesenheit</h3>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ffd700' }}>{stats.anwesenheit}%</div>
          </div>
          
          <div style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 215, 0, 0.2)',
            borderRadius: '12px',
            padding: '1rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', color: '#ffd700', marginBottom: '0.3rem' }}>🎓</div>
            <h3 style={{ color: '#ffffff', marginBottom: '0.3rem', fontSize: '0.9rem' }}>Gürtel</h3>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ffd700' }}>{memberData.gurtfarbe || 'Weiß'}</div>
          </div>
          
          <div style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 215, 0, 0.2)',
            borderRadius: '12px',
            padding: '1rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', color: '#ffd700', marginBottom: '0.3rem' }}>💳</div>
            <h3 style={{ color: '#ffffff', marginBottom: '0.3rem', fontSize: '0.9rem' }}>Offene Beiträge</h3>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: stats.offeneBeitraege > 0 ? '#ef4444' : '#10b981' }}>
              {stats.offeneBeitraege}
            </div>
          </div>
        </div>
      )}

      {/* Hauptnavigation - alle 6 Karten in einer Reihe */}
      <div className="cta-grid member-navigation-grid" style={{
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '0.8rem',
        marginBottom: '1.2rem'
      }}>
        <div className="cta-tile" onClick={() => handleNavigation('/member/profile')} style={{ padding: '1rem', minHeight: '80px' }}>
          <User size={24} />
          <span style={{ fontSize: '0.9rem' }}>Meine Daten</span>
        </div>
        <div className="cta-tile" onClick={() => handleNavigation('/member/schedule')} style={{ padding: '1rem', minHeight: '80px' }}>
          <Calendar size={24} />
          <span style={{ fontSize: '0.9rem' }}>Meine Termine</span>
        </div>
        <div className="cta-tile" onClick={() => handleNavigation('/member/payments')} style={{ padding: '1rem', minHeight: '80px' }}>
          <CreditCard size={24} />
          <span style={{ fontSize: '0.9rem' }}>Meine Beiträge</span>
        </div>
        <div className="cta-tile" onClick={() => handleNavigation('/member/stats')} style={{ padding: '1rem', minHeight: '80px' }}>
          <BarChart3 size={24} />
          <span style={{ fontSize: '0.9rem' }}>Meine Statistiken</span>
        </div>
        <div className="cta-tile" onClick={() => handleNavigation('/member/styles')} style={{ padding: '1rem', minHeight: '80px' }}>
          <Trophy size={24} />
          <span style={{ fontSize: '0.9rem' }}>Stil & Gurt</span>
        </div>
        <div className="cta-tile" onClick={() => handleNavigation('/member/equipment')} style={{ padding: '1rem', minHeight: '80px' }}>
          <Package size={24} />
          <span style={{ fontSize: '0.9rem' }}>Equipment</span>
        </div>
      </div>

      {/* Schnellzugriff - kompakter */}
      <div style={{ marginTop: '1rem' }}>
        <div className="cta-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.8rem' }}>
          <div className="cta-tile" onClick={() => handleQuickAction('checkin')} style={{ cursor: 'pointer', padding: '0.8rem', minHeight: '60px', position: 'relative' }}>
            <Clock size={20} />
            <span style={{ fontSize: '0.85rem' }}>Check-in</span>
          </div>
          <div className="cta-tile" onClick={() => navigate('/member/events')} style={{ cursor: 'pointer', padding: '0.8rem', minHeight: '60px', position: 'relative' }}>
            <Calendar size={20} />
            <span style={{ fontSize: '0.85rem' }}>Events</span>
          </div>
          <div className="cta-tile" onClick={() => handleQuickAction('notifications')} style={{ cursor: 'pointer', padding: '0.8rem', minHeight: '60px', position: 'relative' }}>
            <Bell size={20} />
            <span style={{ fontSize: '0.85rem' }}>Benachrichtigungen</span>
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
                background: '#ef4444',
                color: 'white',
                padding: '0.1rem 0.4rem',
                borderRadius: '10px',
                fontSize: '0.7rem',
                fontWeight: 'bold'
              }}>
                {unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Persönliche Informationen - kompakter */}
      {memberData && (
        <div style={{ marginTop: '1.5rem' }}>
          <h2 style={{ marginBottom: '0.8rem', color: '#ffd700', fontSize: '1.2rem' }}>Deine Informationen</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            
            {/* Trainer-Empfehlung */}
            {memberData.trainer_empfehlung && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                gap: '0.8rem'
              }}>
                <div style={{ fontSize: '1.5rem' }}>👨‍🏫</div>
                <div>
                  <h4 style={{ color: '#ffd700', marginBottom: '0.3rem', fontSize: '0.9rem' }}>Trainer-Empfehlung</h4>
                  <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '0.3rem', fontSize: '0.85rem' }}>{memberData.trainer_empfehlung}</p>
                </div>
              </div>
            )}

            {/* Medizinische Hinweise */}
            {memberData.medizinische_hinweise && memberData.medizinische_hinweise !== 'Keine besonderen Hinweise' && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                gap: '0.8rem'
              }}>
                <div style={{ fontSize: '1.5rem' }}>🏥</div>
                <div>
                  <h4 style={{ color: '#ffd700', marginBottom: '0.3rem', fontSize: '0.9rem' }}>Medizinische Hinweise</h4>
                  <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '0.3rem', fontSize: '0.85rem' }}>{memberData.medizinische_hinweise}</p>
                </div>
              </div>
            )}

            {/* Prüfungs-Countdown */}
            {nextExam && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                gap: '0.8rem'
              }}>
                <div style={{ fontSize: '1.5rem' }}>🎓</div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ color: '#ffd700', marginBottom: '0.3rem', fontSize: '0.9rem' }}>Nächste Prüfung</h4>
                  <p style={{ color: 'rgba(255, 255, 255, 0.9)', marginBottom: '0.2rem', fontSize: '0.85rem', fontWeight: '500' }}>
                    {nextExam.stil} - {formatDate(nextExam.date)}
                  </p>
                  <div style={{ 
                    color: '#10B981', 
                    fontSize: '0.8rem', 
                    fontWeight: '600',
                    background: 'rgba(16, 185, 129, 0.1)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    display: 'inline-block'
                  }}>
                    {getDaysUntilExam(nextExam.date)} Tage verbleiben
                  </div>
                </div>
              </div>
            )}

            {/* Trainingsstunden-Tracker */}
            {Object.values(styleSpecificData).some(data => data && data.stunden_seit_letzter_pruefung !== undefined) && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                gap: '0.8rem'
              }}>
                <div style={{ fontSize: '1.5rem' }}>🎯</div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ color: '#ffd700', marginBottom: '0.3rem', fontSize: '0.9rem' }}>Trainingsfortschritt</h4>
                  {Object.entries(styleSpecificData).map(([stilId, data]) => {
                    if (!data || !data.stunden_seit_letzter_pruefung) return null;
                    
                    const stil = memberStile.find(s => s.stil_id === parseInt(stilId));
                    if (!stil) return null;
                    
                    const nextGraduation = stil.graduierungen?.find(g => g.graduierung_id === data.current_graduierung_id);
                    const requiredHours = nextGraduation?.min_stunden || 0;
                    const hoursNeeded = Math.max(0, requiredHours - data.stunden_seit_letzter_pruefung);
                    
                    return (
                      <div key={stilId} style={{ 
                        marginBottom: '0.5rem',
                        paddingBottom: '0.5rem',
                        borderBottom: '1px solid rgba(255, 215, 0, 0.1)'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          fontSize: '0.85rem',
                          marginBottom: '0.2rem'
                        }}>
                          <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>
                            {stil.name}
                          </span>
                          {hoursNeeded > 0 ? (
                            <span style={{ 
                              color: '#ff6b35', 
                              fontSize: '0.8rem',
                              fontWeight: '600'
                            }}>
                              Noch {hoursNeeded}h
                            </span>
                          ) : (
                            <span style={{ 
                              color: '#10B981', 
                              fontSize: '0.8rem',
                              fontWeight: '600'
                            }}>
                              ✅ Bereit
                            </span>
                          )}
                        </div>
                        <div style={{
                          width: '100%',
                          height: '4px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: '2px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${Math.min(100, (data.stunden_seit_letzter_pruefung / requiredHours) * 100)}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #ffd700, #ff6b35)',
                            borderRadius: '2px',
                            transition: 'width 0.5s ease'
                          }}></div>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ 
                    marginTop: '0.5rem', 
                    fontSize: '0.75rem', 
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontStyle: 'italic'
                  }}>
                    💡 Klicke auf "Stil & Gurt" für Details
                  </div>
                </div>
              </div>
            )}

            {/* Aktuelle Stile & Gürtel */}
            {memberStile.length > 0 && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                gap: '0.8rem'
              }}>
                <div style={{ fontSize: '1.5rem' }}>🥋</div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ color: '#ffd700', marginBottom: '0.3rem', fontSize: '0.9rem' }}>Meine Kampfkunst-Stile</h4>
                  {memberStile.map((stil, index) => {
                    const stilData = styleSpecificData[stil.stil_id];
                    const currentGraduation = stilData?.current_graduierung_id ? 
                      stil.graduierungen?.find(g => g.graduierung_id === stilData.current_graduierung_id) : 
                      stil.graduierungen?.[0];
                    
                    return (
                      <div key={stil.stil_id} style={{ 
                        marginBottom: index < memberStile.length - 1 ? '0.5rem' : '0',
                        paddingBottom: index < memberStile.length - 1 ? '0.5rem' : '0',
                        borderBottom: index < memberStile.length - 1 ? '1px solid rgba(255, 215, 0, 0.1)' : 'none'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          fontSize: '0.85rem'
                        }}>
                          <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>
                            {stil.name}
                          </span>
                          {currentGraduation && (
                            <span style={{ 
                              color: '#ffd700', 
                              fontWeight: '600',
                              background: 'rgba(255, 215, 0, 0.1)',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '6px',
                              fontSize: '0.8rem'
                            }}>
                              {currentGraduation.name}
                            </span>
                          )}
                        </div>
                        {stilData?.letzte_pruefung && (
                          <div style={{ 
                            fontSize: '0.75rem', 
                            color: 'rgba(255, 255, 255, 0.6)',
                            marginTop: '0.2rem'
                          }}>
                            Letzte Prüfung: {new Date(stilData.letzte_pruefung).toLocaleDateString('de-DE')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ 
                    marginTop: '0.5rem', 
                    fontSize: '0.75rem', 
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontStyle: 'italic'
                  }}>
                    💡 Klicke auf "Stil & Gurt" für Details
                  </div>
                </div>
              </div>
            )}

            {/* Familienrabatt */}
            {memberData.rabatt_prozent && memberData.rabatt_grund && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                gap: '0.8rem'
              }}>
                <div style={{ fontSize: '1.5rem' }}>👨‍👩‍👧‍👦</div>
                <div>
                  <h4 style={{ color: '#ffd700', marginBottom: '0.3rem', fontSize: '0.9rem' }}>Familienrabatt</h4>
                  <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '0.3rem', fontSize: '0.85rem' }}>
                    Du erhältst {memberData.rabatt_prozent}% Rabatt ({memberData.rabatt_grund})
                  </p>
                </div>
              </div>
            )}

            {/* Wetter-Integration */}
            <WeatherWidget compact={true} />

            {/* Trainings-Erinnerungen */}
            <TrainingReminders />

            {/* Motivationssprüche */}
            <MotivationQuotes compact={true} />

            {/* Zugelassene Prüfungen */}
            {approvedExams.length > 0 && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.8rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <div style={{ fontSize: '1.5rem' }}>🎓</div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ color: '#8b5cf6', marginBottom: '0.2rem', fontSize: '0.9rem' }}>
                      Zugelassene Prüfungen
                      <span style={{
                        marginLeft: '0.5rem',
                        background: '#8b5cf6',
                        color: 'white',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '10px',
                        fontSize: '0.7rem',
                        fontWeight: 'bold'
                      }}>
                        {approvedExams.length}
                      </span>
                    </h4>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {approvedExams.map((exam, index) => (
                    <div
                      key={exam.pruefung_id}
                      style={{
                        background: 'rgba(139, 92, 246, 0.1)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: '8px',
                        padding: '0.6rem',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '0.3rem'
                      }}>
                        <div>
                          <div style={{
                            fontWeight: 'bold',
                            color: '#8b5cf6',
                            fontSize: '0.85rem',
                            marginBottom: '0.2rem'
                          }}>
                            {exam.stil_name}
                          </div>
                          <div style={{
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontSize: '0.8rem'
                          }}>
                            Prüfung zum {exam.graduierung_nachher}
                          </div>
                        </div>
                        {exam.graduierung_nachher && exam.farbe_nachher && (
                          <div
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              backgroundColor: exam.farbe_nachher,
                              border: '2px solid rgba(255, 255, 255, 0.3)',
                              flexShrink: 0
                            }}
                            title={exam.graduierung_nachher}
                          />
                        )}
                      </div>
                      <div style={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '0.75rem',
                        marginBottom: '0.2rem'
                      }}>
                        📅 {exam.pruefungsdatum ? new Date(exam.pruefungsdatum).toLocaleDateString('de-DE', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) : 'Termin wird noch bekanntgegeben'}
                      </div>
                      {exam.pruefungsdatum && getDaysUntilExam(exam.pruefungsdatum) > 0 && (
                        <div style={{
                          color: '#10B981',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          background: 'rgba(16, 185, 129, 0.1)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          display: 'inline-block',
                          marginTop: '0.3rem'
                        }}>
                          In {getDaysUntilExam(exam.pruefungsdatum)} Tagen
                        </div>
                      )}

                      {/* Anmelden Button */}
                      {!exam.teilnahme_bestaetigt ? (
                        <button
                          onClick={() => handleOpenExamRegistration(exam)}
                          style={{
                            marginTop: '0.5rem',
                            width: '100%',
                            padding: '0.5rem',
                            background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseOver={(e) => e.target.style.transform = 'scale(1.02)'}
                          onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                        >
                          Jetzt Anmelden
                        </button>
                      ) : (
                        <div style={{
                          marginTop: '0.5rem',
                          width: '100%',
                          padding: '0.5rem',
                          background: 'rgba(16, 185, 129, 0.2)',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          color: '#10B981',
                          textAlign: 'center'
                        }}>
                          ✅ Teilnahme bestätigt
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prüfungsergebnisse */}
            {examResults.length > 0 && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.8rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <div style={{ fontSize: '1.5rem' }}>🏆</div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ color: '#ffd700', marginBottom: '0.2rem', fontSize: '0.9rem' }}>
                      Prüfungsergebnisse
                    </h4>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {examResults.slice(0, 3).map((result, index) => (
                    <div
                      key={result.pruefung_id}
                      style={{
                        background: result.bestanden ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: result.bestanden ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        padding: '0.6rem',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '0.3rem'
                      }}>
                        <div>
                          <div style={{
                            fontWeight: 'bold',
                            color: result.bestanden ? '#10b981' : '#ef4444',
                            fontSize: '0.85rem',
                            marginBottom: '0.2rem'
                          }}>
                            {result.stil_name}
                          </div>
                          <div style={{
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontSize: '0.8rem'
                          }}>
                            {result.graduierung_nachher}
                          </div>
                        </div>
                        <div style={{
                          fontSize: '1.2rem'
                        }}>
                          {result.bestanden ? '✅' : '❌'}
                        </div>
                      </div>
                      <div style={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '0.75rem'
                      }}>
                        📅 {new Date(result.pruefungsdatum).toLocaleDateString('de-DE')}
                      </div>
                      {result.punktzahl && result.max_punktzahl && (
                        <div style={{
                          color: 'rgba(255, 255, 255, 0.6)',
                          fontSize: '0.75rem',
                          marginTop: '0.2rem'
                        }}>
                          Punktzahl: {result.punktzahl} / {result.max_punktzahl}
                        </div>
                      )}
                    </div>
                  ))}
                  {examResults.length > 3 && (
                    <div style={{
                      textAlign: 'center',
                      color: 'rgba(255, 255, 255, 0.6)',
                      fontSize: '0.75rem',
                      fontStyle: 'italic',
                      marginTop: '0.2rem'
                    }}>
                      +{examResults.length - 3} weitere Prüfungen
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Push-Benachrichtigungen */}
            <div
              id="member-notifications"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.8rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <div style={{ fontSize: '1.5rem' }}>📢</div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ color: '#ffd700', marginBottom: '0.2rem', fontSize: '0.9rem' }}>
                    Push-Benachrichtigungen
                    {unreadCount > 0 && (
                      <span style={{
                        marginLeft: '0.5rem',
                        background: '#ef4444',
                        color: 'white',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '10px',
                        fontSize: '0.7rem',
                        fontWeight: 'bold'
                      }}>
                        {unreadCount}
                      </span>
                    )}
                  </h4>
                </div>
              </div>

              {notifications.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {notifications.slice(0, 3).map((notification, index) => (
                    <div
                      key={notification.id || index}
                      style={{
                        background: notification.read ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 215, 0, 0.1)',
                        border: notification.read ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 215, 0, 0.3)',
                        borderRadius: '8px',
                        padding: '0.6rem',
                      }}
                    >
                      <div style={{
                        fontWeight: notification.read ? 'normal' : 'bold',
                        color: notification.read ? 'rgba(255, 255, 255, 0.8)' : '#ffd700',
                        fontSize: '0.85rem',
                        marginBottom: '0.2rem'
                      }}>
                        {notification.subject || notification.title}
                      </div>
                      <div style={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '0.8rem',
                        marginBottom: '0.3rem'
                      }}>
                        {notification.message}
                      </div>
                      <div style={{
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontSize: '0.7rem'
                      }}>
                        {notification.created_at ? new Date(notification.created_at).toLocaleString('de-DE') : 'Gerade eben'}
                      </div>
                      {notification.requires_confirmation && !notification.confirmed_at && (
                        <button
                          onClick={() => confirmNotification(notification.id)}
                          style={{
                            marginTop: '0.5rem',
                            padding: '0.4rem 0.8rem',
                            background: 'linear-gradient(135deg, #22c55e, #10b981)',
                            border: 'none',
                            borderRadius: '6px',
                            color: 'white',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)'
                          }}
                          onMouseOver={(e) => {
                            e.target.style.transform = 'translateY(-1px)';
                            e.target.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.4)';
                          }}
                          onMouseOut={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 2px 8px rgba(34, 197, 94, 0.3)';
                          }}
                        >
                          ✓ Bestätigen
                        </button>
                      )}
                      {notification.requires_confirmation && notification.confirmed_at && (
                        <div style={{
                          marginTop: '0.5rem',
                          padding: '0.4rem 0.8rem',
                          background: 'rgba(34, 197, 94, 0.2)',
                          border: '1px solid rgba(34, 197, 94, 0.3)',
                          borderRadius: '6px',
                          color: '#22c55e',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          display: 'inline-block'
                        }}>
                          ✓ Bestätigt am {new Date(notification.confirmed_at).toLocaleString('de-DE')}
                        </div>
                      )}
                    </div>
                  ))}
                  {notifications.length > 3 && (
                    <div style={{
                      textAlign: 'center',
                      color: 'rgba(255, 255, 255, 0.6)',
                      fontSize: '0.75rem',
                      fontStyle: 'italic',
                      marginTop: '0.2rem'
                    }}>
                      +{notifications.length - 3} weitere Benachrichtigungen
                    </div>
                  )}
                </div>
              ) : (
                <p style={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '0.85rem',
                  fontStyle: 'italic',
                  margin: 0
                }}>
                  📭 Keine neuen Benachrichtigungen
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Prüfungsanmeldung Modal */}
      {showExamRegistrationModal && selectedExam && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem'
        }}>
          <div style={{
            background: '#1a1a2e',
            border: '2px solid rgba(139, 92, 246, 0.4)',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            color: 'white'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
              paddingBottom: '1rem',
              borderBottom: '2px solid rgba(139, 92, 246, 0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <div style={{ fontSize: '2rem' }}>🎓</div>
                <div>
                  <h2 style={{ margin: 0, color: '#8b5cf6', fontSize: '1.5rem' }}>
                    Prüfungsanmeldung
                  </h2>
                  <p style={{ margin: '0.2rem 0 0 0', color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem' }}>
                    Bestätige deine Teilnahme
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowExamRegistrationModal(false);
                  setSelectedExam(null);
                  setAcceptedConditions(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.2rem',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            {/* Prüfungsdetails */}
            <div style={{ marginBottom: '1.5rem' }}>
              {/* Stil & Graduierung */}
              <div style={{
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.3rem' }}>
                      Kampfkunst-Stil
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#8b5cf6', marginBottom: '0.5rem' }}>
                      {selectedExam.stil_name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.2rem' }}>
                      Prüfung zum
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: '600', color: '#ffd700' }}>
                      {selectedExam.graduierung_nachher}
                    </div>
                  </div>
                  {selectedExam.farbe_nachher && (
                    <div
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '50%',
                        backgroundColor: selectedExam.farbe_nachher,
                        border: '3px solid rgba(255, 255, 255, 0.3)',
                        flexShrink: 0
                      }}
                      title={selectedExam.graduierung_nachher}
                    />
                  )}
                </div>
              </div>

              {/* Termin & Ort */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '0.8rem',
                marginBottom: '1rem'
              }}>
                {selectedExam.pruefungsdatum && (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    padding: '0.8rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.3rem' }}>
                      📅 Datum & Uhrzeit
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: '600', color: 'white' }}>
                      {new Date(selectedExam.pruefungsdatum).toLocaleDateString('de-DE', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                    {selectedExam.pruefungszeit && (
                      <div style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.8)', marginTop: '0.2rem' }}>
                        Uhrzeit: {selectedExam.pruefungszeit} Uhr
                      </div>
                    )}
                  </div>
                )}

                {selectedExam.pruefungsort && (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    padding: '0.8rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.3rem' }}>
                      📍 Ort
                    </div>
                    <div style={{ fontSize: '0.95rem', color: 'white' }}>
                      {selectedExam.pruefungsort}
                    </div>
                  </div>
                )}
              </div>

              {/* Gebühr & Anmeldefrist */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.8rem',
                marginBottom: '1rem'
              }}>
                {selectedExam.pruefungsgebuehr && (
                  <div style={{
                    background: 'rgba(255, 215, 0, 0.1)',
                    borderRadius: '8px',
                    padding: '0.8rem',
                    border: '1px solid rgba(255, 215, 0, 0.2)'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.3rem' }}>
                      💰 Prüfungsgebühr
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ffd700' }}>
                      {parseFloat(selectedExam.pruefungsgebuehr).toFixed(2)} €
                    </div>
                  </div>
                )}

                {selectedExam.anmeldefrist && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '8px',
                    padding: '0.8rem',
                    border: '1px solid rgba(239, 68, 68, 0.2)'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.3rem' }}>
                      ⏰ Anmeldefrist
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#ef4444' }}>
                      {new Date(selectedExam.anmeldefrist).toLocaleDateString('de-DE')}
                    </div>
                  </div>
                )}
              </div>

              {/* Gurtlänge */}
              {selectedExam.gurtlaenge && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  padding: '0.8rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  marginBottom: '1rem'
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.3rem' }}>
                    📏 Empfohlene Gurtlänge
                  </div>
                  <div style={{ fontSize: '0.95rem', color: 'white' }}>
                    {selectedExam.gurtlaenge}
                  </div>
                </div>
              )}

              {/* Bemerkungen */}
              {selectedExam.bemerkungen && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  padding: '0.8rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  marginBottom: '1rem'
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.3rem' }}>
                    📝 Bemerkungen
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.8)', whiteSpace: 'pre-line' }}>
                    {selectedExam.bemerkungen}
                  </div>
                </div>
              )}

              {/* Teilnahmebedingungen */}
              {selectedExam.teilnahmebedingungen && (
                <div style={{
                  background: 'rgba(99, 102, 241, 0.1)',
                  borderRadius: '8px',
                  padding: '1rem',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  marginBottom: '1rem'
                }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#6366f1', marginBottom: '0.5rem' }}>
                    📋 Teilnahmebedingungen
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.9)', whiteSpace: 'pre-line' }}>
                    {selectedExam.teilnahmebedingungen}
                  </div>
                </div>
              )}
            </div>

            {/* Bestätigung */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.8rem',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}>
                <input
                  type="checkbox"
                  checked={acceptedConditions}
                  onChange={(e) => setAcceptedConditions(e.target.checked)}
                  style={{
                    marginTop: '0.2rem',
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                />
                <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                  Ich bestätige hiermit meine Teilnahme an der Prüfung und akzeptiere die Teilnahmebedingungen.
                  Mir ist bewusst, dass die Prüfungsgebühr fällig wird.
                </span>
              </label>
            </div>

            {/* Aktionen */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => {
                  setShowExamRegistrationModal(false);
                  setSelectedExam(null);
                  setAcceptedConditions(false);
                }}
                style={{
                  flex: 1,
                  padding: '0.8rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.15)'}
                onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
              >
                Abbrechen
              </button>
              <button
                onClick={handleExamRegistration}
                disabled={!acceptedConditions}
                style={{
                  flex: 1,
                  padding: '0.8rem',
                  background: acceptedConditions
                    ? 'linear-gradient(135deg, #8b5cf6, #6366f1)'
                    : 'rgba(139, 92, 246, 0.3)',
                  border: 'none',
                  borderRadius: '8px',
                  color: acceptedConditions ? 'white' : 'rgba(255, 255, 255, 0.4)',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: acceptedConditions ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  if (acceptedConditions) {
                    e.target.style.transform = 'scale(1.02)';
                  }
                }}
                onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
              >
                ✅ Teilnahme bestätigen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Check-in Modal */}
      {showMemberCheckin && (
        <MemberCheckin onClose={() => setShowMemberCheckin(false)} />
      )}
        </div>
      </div>
    </div>
  );
};

export default MemberDashboard;
