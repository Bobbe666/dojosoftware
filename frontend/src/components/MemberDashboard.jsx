import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx';
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
  Star,
  QrCode,
  Download,
  CalendarSync,
  Copy,
  Check,
  Gift
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import dojoLogo from '../assets/logo-kampfkunstschule-schreiner.png';
import '../styles/MitgliedDetail.css';
import MemberHeader from './MemberHeader.jsx';
import MemberCheckin from './MemberCheckin.jsx';
import MemberQRCode from './MemberQRCode.jsx';
import MotivationQuotes from './MotivationQuotes.jsx';
import TrainingReminders from './TrainingReminders.jsx';
import BuddyGruppenWidget from './BuddyGruppenWidget.jsx';
import '../styles/themes.css';
import '../styles/Dashboard.css';
import '../styles/DashboardStart.css';
import '../styles/MemberNavigation.css';
import '../styles/MotivationQuotes.css';
import '../styles/TrainingReminders.css';
import '../styles/MemberDashboard.responsive.css';
import '../styles/MemberDashboard.css';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import EventNotificationPopup from './EventNotificationPopup.jsx';
import ProfilWizard from './ProfilWizard.jsx';


const MemberDashboard = () => {
  const { t } = useTranslation('member');
  const { user } = useAuth();
  const { activeDojo } = useDojoContext();

  const navigate = useNavigate();

  // Haupt-Daten States
  const [stats, setStats] = useState({
    trainingsstunden: 0,
    anwesenheitAnwesend: 0,
    anwesenheitMoeglich: 0,
    anwesenheit: null,
    offeneBeitraege: 0,
    naechstePruefung: null
  });
  const [memberData, setMemberData] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [error, setError] = useState(null);

  // Konsolidierte Modal States (vorher 3 separate useState)
  const [modals, setModals] = useState({
    checkin: false,
    qrCode: false,
    examRegistration: false
  });

  // Konsolidierte Stil & Gurt Daten (vorher 5 separate useState)
  const [styleData, setStyleData] = useState({
    memberStile: [],
    styleSpecificData: {},
    stile: [],
    loading: false
  });

  // Konsolidierte Prüfungs-Daten (vorher 4 separate useState)
  const [examData, setExamData] = useState({
    nextExam: null,
    approved: [],
    results: [],
    selected: null,
    acceptedConditions: false
  });

  // Konsolidierte Benachrichtigungen (vorher 2 separate useState)
  const [notificationData, setNotificationData] = useState({
    list: [],
    unreadCount: 0
  });

  // Zahlungshinweise / Mahnungen aus mitglied_nachrichten
  const [zahlungsNachrichten, setZahlungsNachrichten] = useState([]);
  const [hatMahnung, setHatMahnung] = useState(false);

  // Referral / Freunde werben Freunde
  const [referralData, setReferralData] = useState(null);
  const [referralCopied, setReferralCopied] = useState(false);

  // ProfilWizard: beim ersten Login anzeigen
  const [showProfilWizard, setShowProfilWizard] = useState(false);

  // Event-Benachrichtigungs-Popup
  const [neueEvents, setNeueEvents] = useState([]);
  const [showEventPopup, setShowEventPopup] = useState(false);

  // Alle kommenden Events für Dashboard-Widget
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  // Abwärtskompatibilität: Destrukturierte Werte für bestehenden Code
  const showMemberCheckin = modals.checkin;
  const showQRCode = modals.qrCode;
  const showExamRegistrationModal = modals.examRegistration;
  const memberStile = styleData.memberStile;
  const styleSpecificData = styleData.styleSpecificData;
  const stile = styleData.stile;
  const stileLoading = styleData.loading;
  const nextExam = examData.nextExam;
  const approvedExams = examData.approved;
  const examResults = examData.results;
  const selectedExam = examData.selected;
  const acceptedConditions = examData.acceptedConditions;
  const notifications = notificationData.list;
  const unreadCount = notificationData.unreadCount;

  // Ref für Mitgliedsausweis-Download
  const ausweisRef = useRef(null);

  // Setter-Funktionen für Abwärtskompatibilität
  const setShowMemberCheckin = useCallback((val) => setModals(prev => ({ ...prev, checkin: val })), []);
  const setShowQRCode = useCallback((val) => setModals(prev => ({ ...prev, qrCode: val })), []);
  const setShowExamRegistrationModal = useCallback((val) => setModals(prev => ({ ...prev, examRegistration: val })), []);
  const setMemberStile = useCallback((val) => setStyleData(prev => ({ ...prev, memberStile: typeof val === 'function' ? val(prev.memberStile) : val })), []);
  const setStyleSpecificData = useCallback((val) => setStyleData(prev => ({ ...prev, styleSpecificData: typeof val === 'function' ? val(prev.styleSpecificData) : val })), []);
  const setStile = useCallback((val) => setStyleData(prev => ({ ...prev, stile: val })), []);
  const setStileLoading = useCallback((val) => setStyleData(prev => ({ ...prev, loading: val })), []);
  const setNextExam = useCallback((val) => setExamData(prev => ({ ...prev, nextExam: val })), []);
  const setApprovedExams = useCallback((val) => setExamData(prev => ({ ...prev, approved: val })), []);
  const setExamResults = useCallback((val) => setExamData(prev => ({ ...prev, results: val })), []);
  const setSelectedExam = useCallback((val) => setExamData(prev => ({ ...prev, selected: val })), []);
  const setAcceptedConditions = useCallback((val) => setExamData(prev => ({ ...prev, acceptedConditions: val })), []);
  const setNotifications = useCallback((val) => setNotificationData(prev => ({ ...prev, list: val })), []);
  const setUnreadCount = useCallback((val) => setNotificationData(prev => ({ ...prev, unreadCount: val })), []);

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


  // Lade neue Events für Popup-Benachrichtigung
  const loadNeueEvents = async (memberId) => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/events/member/${memberId}/neu`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.events?.length > 0) {
          setNeueEvents(data.events);
          setShowEventPopup(true);
        }
      }
    } catch (e) {
      // Event-Popup optional — kein Fehler anzeigen
    }
  };

  // Lade alle kommenden Events für Dashboard-Widget
  const loadUpcomingEvents = async (memberId) => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/events/member/${memberId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUpcomingEvents(data.events || []);
        }
      }
    } catch (e) {
      // optional — kein Fehler anzeigen
    }
  };

  const handleEventPopupAnmelden = async (event, bestellungen) => {
    try {
      await fetchWithAuth(`${config.apiBaseUrl}/events/${event.event_id}/anmelden`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitglied_id: memberData?.mitglied_id, bestellungen })
      });
      await fetchWithAuth(`${config.apiBaseUrl}/events/${event.event_id}/gesehen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitglied_id: memberData?.mitglied_id, aktion: 'angemeldet' })
      });
    } catch (e) { /* silent */ }
    const remaining = neueEvents.filter(e => e.event_id !== event.event_id);
    setNeueEvents(remaining);
    if (remaining.length === 0) setShowEventPopup(false);
  };

  const handleEventPopupAblehnen = async (event) => {
    try {
      await fetchWithAuth(`${config.apiBaseUrl}/events/${event.event_id}/gesehen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitglied_id: memberData?.mitglied_id, aktion: 'abgelehnt' })
      });
    } catch (e) { /* silent */ }
    const remaining = neueEvents.filter(e => e.event_id !== event.event_id);
    setNeueEvents(remaining);
    if (remaining.length === 0) setShowEventPopup(false);
  };

  const handleEventPopupSpaeter = async (event) => {
    // Nur als "gesehen" markieren — wird nicht mehr beim nächsten Login angezeigt
    try {
      await fetchWithAuth(`${config.apiBaseUrl}/events/${event.event_id}/gesehen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitglied_id: memberData?.mitglied_id, aktion: 'gesehen' })
      });
    } catch (e) { /* silent */ }
    const remaining = neueEvents.filter(e => e.event_id !== event.event_id);
    setNeueEvents(remaining);
    if (remaining.length === 0) setShowEventPopup(false);
  };

  // Lade Referral-Daten (Freunde werben Freunde)
  const loadReferralData = async (memberId) => {
    try {
      const [settingsRes, codesRes] = await Promise.all([
        fetchWithAuth(`${config.apiBaseUrl}/referral/settings`),
        fetchWithAuth(`${config.apiBaseUrl}/referral/codes?mitglied_id=${memberId}`)
      ]);

      // Settings laden (optional – falls nicht erreichbar trotzdem Code anzeigen)
      let settings = {};
      if (settingsRes.ok) {
        settings = await settingsRes.json();
      }

      // Code laden – anzeigen sobald ein Code vorhanden ist, unabhängig von aktiv-Flag
      if (!codesRes.ok) return;
      const codes = await codesRes.json();
      const activeCode = Array.isArray(codes) ? codes.find(c => c.aktiv) : null;
      if (!activeCode) return;

      setReferralData({ ...settings, code: activeCode.code });
    } catch (e) {
      // Referral optional – kein Fehler anzeigen
    }
  };

  // Lade Push-Benachrichtigungen für dieses Mitglied
  const loadNotifications = async (email) => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/notifications/member/${encodeURIComponent(email)}`);
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
      const response = await fetchWithAuth(`${config.apiBaseUrl}/notifications/confirm/${notificationId}`, {
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
      const response = await fetchWithAuth(`${config.apiBaseUrl}/pruefungen?mitglied_id=${memberId}&status=geplant`);
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
      const response = await fetchWithAuth(`${config.apiBaseUrl}/pruefungen/mitglied/${memberId}/historie`);
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

        const memberResponse = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${mitgliedId}`);

        if (!memberResponse.ok) {
          throw new Error(`HTTP ${memberResponse.status}: ${memberResponse.statusText}`);
        }

        const memberData = await memberResponse.json();
        console.log('✅ Mitgliedsdaten empfangen:', memberData);

        // ProfilWizard: Beim ersten Login anzeigen (fehlender Notfallkontakt)
        const wizardKey = `profil_wizard_done_${memberData.mitglied_id}`;
        if (!localStorage.getItem(wizardKey) && !memberData.notfallkontakt_name) {
          setShowProfilWizard(true);
        }

        // Anwesenheitsdaten laden (mit mitglied_id direkt)
        const attendanceResponse = await fetchWithAuth(`${config.apiBaseUrl}/anwesenheit/${memberData.mitglied_id}`);

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
        const vertraegeResponse = await fetchWithAuth(`${config.apiBaseUrl}/vertraege?mitglied_id=${memberData.mitglied_id}`);

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

        // Kurse des Mitglieds laden (für Stundenplan-basierte Anwesenheitsberechnung)
        let memberKurse = [];
        try {
          const kurseResponse = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${memberData.mitglied_id}/kurse`);
          if (kurseResponse.ok) {
            const kurseData = await kurseResponse.json();
            memberKurse = Array.isArray(kurseData) ? kurseData : (kurseData.kurse || []);
          }
        } catch (e) {
          console.warn('⚠️ Kurse für Anwesenheitsberechnung nicht ladbar:', e);
        }

        // Berechne Statistiken

        // Tatsächlich besuchte Trainings (anwesend=1)
        const totalAnwesend = Array.isArray(attendanceData)
          ? attendanceData.filter(a => a.anwesend === 1 || a.anwesend === true).length
          : 0;

        // Mögliche Trainings seit Eintrittsdatum berechnen (Stundenplan-basiert)
        const wochentagMap = {
          'Montag': 1, 'Dienstag': 2, 'Mittwoch': 3, 'Donnerstag': 4,
          'Freitag': 5, 'Samstag': 6, 'Sonntag': 0
        };

        const eintrittsdatum = memberData.eintrittsdatum ? new Date(memberData.eintrittsdatum) : null;
        const heute = new Date();
        heute.setHours(23, 59, 59, 0);

        let moeglich = 0;
        if (eintrittsdatum && memberKurse.length > 0) {
          memberKurse.forEach(kurs => {
            if (!kurs.wochentag) return;
            const zielTag = wochentagMap[kurs.wochentag];
            if (zielTag === undefined) return;

            // Ersten Trainingstag ab Eintrittsdatum finden
            const start = new Date(eintrittsdatum);
            start.setHours(0, 0, 0, 0);
            const tageOffset = (zielTag - start.getDay() + 7) % 7;
            start.setDate(start.getDate() + tageOffset);

            if (start <= heute) {
              const diffMs = heute - start;
              const diffTage = Math.floor(diffMs / (1000 * 60 * 60 * 24));
              moeglich += Math.floor(diffTage / 7) + 1;
            }
          });
        }

        const attendancePercentage = moeglich > 0
          ? Math.round((totalAnwesend / moeglich) * 100)
          : null;

        // Offene Beiträge zählen - ABER: Beitragsfreie Mitglieder haben immer 0
        // Gelöschte/archivierte Verträge (geloescht=true) ebenfalls ausschließen
        const openPayments = memberData.beitragsfrei === 1 || memberData.beitragsfrei === true
          ? 0
          : (Array.isArray(paymentsData)
              ? paymentsData.filter(v =>
                  !v.geloescht &&
                  v.status === 'aktiv' &&
                  (!v.lastschrift_status || v.lastschrift_status === 'ausstehend' || v.lastschrift_status === 'fehlgeschlagen')
                ).length
              : 0);

        const nextExam = memberData.naechste_pruefung_datum;

        setStats({
          trainingsstunden: totalAnwesend,
          anwesenheitAnwesend: totalAnwesend,
          anwesenheitMoeglich: moeglich,
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

        // Lade Referral-Daten
        await loadReferralData(memberData.mitglied_id);

        // Neue Events für Popup laden + alle kommenden Events für Widget
        await Promise.all([
          loadNeueEvents(memberData.mitglied_id),
          loadUpcomingEvents(memberData.mitglied_id)
        ]);

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
        const response = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${user.mitglied_id}/birthday-check`);
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

  // Zahlungshinweise / Mahnungen laden
  useEffect(() => {
    if (!user?.email) return;
    const loadNachrichten = async () => {
      try {
        const resp = await fetchWithAuth('/api/member/nachrichten');
        if (resp.ok) {
          const data = await resp.json();
          setZahlungsNachrichten(data.nachrichten || []);
          setHatMahnung(data.hatMahnung || false);
        }
      } catch (err) {
        // Fehler still ignorieren — Banner ist nicht kritisch
      }
    };
    loadNachrichten();
  }, [user?.email]);

  // Browser-Titel und URL dynamisch setzen
  useEffect(() => {
    if (memberData) {
      const name = `${memberData.vorname} ${memberData.nachname}`;
      const dojo = activeDojo?.dojoname || memberData.dojo_name || 'Dojosoftware';
      document.title = `${name} | ${dojo}`;
    }
    return () => { document.title = 'Dojosoftware'; };
  }, [memberData, activeDojo]);

  // Lade alle verfügbaren Stile
  const loadStile = async () => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/stile`);
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
      
      const response = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${memberId}/stile`);
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
      const response = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${memberId}/stil/${stilId}/data`);
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
      const response = await fetchWithAuth(`${config.apiBaseUrl}/pruefungen/${selectedExam.pruefung_id}/teilnahme-bestaetigen`, {
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

  // Berechne aktuelle Gürtelfarben aus memberStile
  const currentBelts = useMemo(() => {
    console.log('🎨 Berechne Gürtelfarben...', { memberStile, styleSpecificData });

    if (!memberStile || memberStile.length === 0) {
      console.log('⚠️ Keine Stile geladen - Fallback zu Weiß');
      return 'Weiß';
    }

    const belts = memberStile.map(stil => {
      const stilData = styleSpecificData[stil.stil_id];

      if (!stilData || !stilData.current_graduierung_id) {
        // Fallback: Nutze stil.current_gurtfarbe wenn vorhanden
        if (stil.current_gurtfarbe) {
          return stil.current_gurtfarbe;
        }

        // Fallback: Erste Graduierung (meistens Weißgurt)
        const firstGrad = stil.graduierungen?.[0]?.name;
        return firstGrad || 'Weiß';
      }

      const currentGrad = stil.graduierungen?.find(g => g.graduierung_id === stilData.current_graduierung_id);
      return currentGrad?.name || 'Weiß';
    }).filter(Boolean); // Entferne undefinierte Werte

    console.log('🎓 Finale Gürtel:', belts);

    // Falls mehrere Stile: alle Gürtel anzeigen
    return belts.length > 0 ? belts.join(', ') : 'Weiß';
  }, [memberStile, styleSpecificData]);

  // Debug: Log memberData status on render
  console.log('🎨 MemberDashboard Render - memberData:', memberData ? 'vorhanden' : 'nicht vorhanden', memberData);
  console.log('🎨 Aktuelle Gürtel:', currentBelts);

  return (
    <div className="dashboard-container">
      <MemberHeader />

      {/* ProfilWizard: Notfallkontakt beim ersten Login */}
      {showProfilWizard && memberData && (
        <ProfilWizard
          mitgliedId={memberData.mitglied_id}
          vorname={memberData.vorname}
          onClose={() => setShowProfilWizard(false)}
        />
      )}

      {/* Event-Benachrichtigungs-Popup */}
      {showEventPopup && neueEvents.length > 0 && (
        <EventNotificationPopup
          events={neueEvents}
          memberData={memberData}
          onAnmelden={handleEventPopupAnmelden}
          onAblehnen={handleEventPopupAblehnen}
          onSpaeter={handleEventPopupSpaeter}
          onClose={() => setShowEventPopup(false)}
        />
      )}

      {/* Zahlungshinweis-Banner */}
      {hatMahnung && zahlungsNachrichten.length > 0 && (
        <div className="member-alert-banner">
          <span className="member-alert-icon">⚠️</span>
          <div className="member-alert-content">
            <strong className="member-alert-title">Offene Zahlung auf Ihrem Konto</strong>
            <span className="member-alert-text">
              Es gibt eine ausstehende Zahlung. Bitte prüfen Sie Ihre Zahlungsdaten und kontaktieren Sie uns bei Fragen.
            </span>
          </div>
          <a href="/member/payments" className="member-alert-link">
            Zur Zahlungsübersicht
          </a>
        </div>
      )}

      <div className="dashboard-content">
        <div className="dashboard-start">
          {/* Header - Karate Design */}
          <div className="member-welcome-wrap">
            <div className="member-welcome-dojo">
              道場 — {activeDojo?.dojoname || 'Kampfkunstschule'}
            </div>
            <div className="member-welcome-row">
              <span className="member-welcome-kanji">歓迎</span>
              <h1 className="member-welcome-title">
                {memberData ? `${memberData.vorname} ${memberData.nachname}` : user?.username || 'Mitglied'}
              </h1>
              <span className="member-welcome-kanji">歓迎</span>
            </div>
            <div className="member-welcome-subtitle">
              心技体 — Shin · Gi · Tai
            </div>
          </div>

      {/* Ausweis + Stats: 2 Karten | Ausweis | 2 Karten */}
      {memberData && (
        <div className="member-stats-grid md-stats-grid">

          {/* Linke Spalte: Training + Anwesenheit */}
          <div className="member-stat-column">
            <div className="member-stat-card">
              <div className="member-stat-icon">🏃‍♂️</div>
              <h3 className="member-stat-label">{t('stats.trainingHours')}</h3>
              <div className="member-stat-value">{stats.trainingsstunden}</div>
            </div>
            <div className="member-stat-card">
              <div className="member-stat-icon">📊</div>
              <h3 className="member-stat-label">{t('stats.attendance')}</h3>
              <div className="member-stat-value">
                {stats.anwesenheit !== null ? `${stats.anwesenheit}%` : '—'}
              </div>
              {stats.anwesenheitMoeglich > 0 && (
                <div className="member-stat-sublabel">
                  {stats.anwesenheitAnwesend} / {stats.anwesenheitMoeglich}
                </div>
              )}
            </div>
          </div>

          {/* Mitte: Mitgliedsausweis */}
          <div className="mitgliedsausweis-container">
            <div className="mitgliedsausweis" ref={ausweisRef}>
              <div className="ausweis-title">
                <span className="title-jp">格闘技学校</span>
                <span className="title-de">Kampfkunstschule Schreiner</span>
              </div>
              <div className="ausweis-body">
                <div className="ausweis-left">
                  <img
                    src={dojoLogo}
                    alt="Kampfkunstschule Schreiner"
                    className="ausweis-logo"
                  />
                </div>
                <div className="ausweis-center">
                  <div className="ausweis-kanji">武道</div>
                  <div className="ausweis-name">
                    {memberData.vorname} · {memberData.nachname}
                  </div>
                  <div className="ausweis-info-list">
                    <div className="ausweis-info-row">
                      <span className="info-label">Mitglieds-Nr.</span>
                      <span className="info-value">{String(memberData.mitglied_id).padStart(5, '0')}</span>
                    </div>
                    <div className="ausweis-info-row">
                      <span className="info-label">Mitglied seit</span>
                      <span className="info-value">
                        {memberData.eintrittsdatum
                          ? new Date(memberData.eintrittsdatum).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' })
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="ausweis-right">
                  <div className="ausweis-foto">
                    {memberData.foto_pfad ? (
                      <img
                        src={`${config.apiBaseUrl.replace('/api', '')}/${memberData.foto_pfad}`}
                        alt={`${memberData.vorname} ${memberData.nachname}`}
                      />
                    ) : (
                      <div className="ausweis-foto-placeholder">
                        <span>写真</span>
                      </div>
                    )}
                  </div>
                  <div className="ausweis-qr">
                    <QRCodeSVG
                      value={`DOJO-CHECKIN:${memberData.dojo_id || '0'}:${memberData.mitglied_id || '0'}`}
                      size={70}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  </div>
                </div>
              </div>
              <div className="ausweis-footer">
                <div className="ausweis-motto">心技体 — Shin Gi Tai</div>
                <div className="ausweis-website">www.tda-vib.de</div>
              </div>
            </div>
          </div>

          {/* Rechte Spalte: Gurt + Beiträge */}
          <div className="member-stat-column">
            <div className="member-stat-card">
              <div className="member-stat-icon">🎓</div>
              <h3 className="member-stat-label">{t('stats.belt')}</h3>
              <div className="member-stat-value sm">{currentBelts}</div>
            </div>
            <div className="member-stat-card">
              <div className="member-stat-icon">💳</div>
              <h3 className="member-stat-label">{t('stats.openFees')}</h3>
              <div className={`member-stat-value${stats.offeneBeitraege > 0 ? ' md-stat-value--error' : ' md-stat-value--success'}`}>
                {stats.offeneBeitraege}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Hauptnavigation - alle 6 Karten in einer Reihe */}
      <div className="cta-grid member-navigation-grid md-navigation-grid">
        <div className="cta-tile cta-tile-nav" onClick={() => handleNavigation('/member/profile')}>
          <User size={24} />
          <span className="cta-tile-nav-label">{t('navigation.myData')}</span>
        </div>
        <div className="cta-tile cta-tile-nav" onClick={() => handleNavigation('/member/schedule')}>
          <Calendar size={24} />
          <span className="cta-tile-nav-label">{t('navigation.mySchedule')}</span>
        </div>
        <div className="cta-tile cta-tile-nav" onClick={() => handleNavigation('/member/payments')}>
          <CreditCard size={24} />
          <span className="cta-tile-nav-label">{t('navigation.myPayments')}</span>
        </div>
        <div className="cta-tile cta-tile-nav" onClick={() => handleNavigation('/member/stats')}>
          <BarChart3 size={24} />
          <span className="cta-tile-nav-label">{t('navigation.myStats')}</span>
        </div>
        <div className="cta-tile cta-tile-nav" onClick={() => handleNavigation('/member/styles')}>
          <Trophy size={24} />
          <span className="cta-tile-nav-label">{t('navigation.styleAndBelt')}</span>
        </div>
        <div className="cta-tile cta-tile-nav" onClick={() => handleNavigation('/member/equipment')}>
          <Package size={24} />
          <span className="cta-tile-nav-label">{t('navigation.equipment')}</span>
        </div>
        <div className="cta-tile cta-tile-nav" onClick={() => handleNavigation('/member/kalender')}>
          <CalendarSync size={24} />
          <span className="cta-tile-nav-label">{t('navigation.calendarSync')}</span>
        </div>
      </div>

      {/* Schnellzugriff - eine Zeile */}
      <div className="member-quick-actions-grid">
        <div className="cta-tile cta-tile-quick" onClick={() => handleQuickAction('checkin')}>
          <Clock size={20} />
          <span className="cta-tile-quick-label">{t('quickActions.checkin')}</span>
        </div>
        <div className="cta-tile cta-tile-quick cta-tile-qr" onClick={() => setShowQRCode(true)}>
          <QrCode size={20} />
          <span className="cta-tile-quick-label">{t('quickActions.myQrCode')}</span>
        </div>
        <div className="cta-tile cta-tile-quick cta-tile-install" onClick={() => navigate('/app-install')}>
          <Download size={20} />
          <span className="cta-tile-quick-label">{t('quickActions.installApp')}</span>
        </div>
        <div className="cta-tile cta-tile-quick" onClick={() => navigate('/member/events')}>
          <Calendar size={20} />
          <span className="cta-tile-quick-label">{t('quickActions.events')}</span>
        </div>
        <div className="cta-tile cta-tile-quick" onClick={() => handleQuickAction('notifications')}>
          <Bell size={20} />
          <span className="cta-tile-quick-label">{t('quickActions.notifications')}</span>
          {unreadCount > 0 && (
            <span className="member-notif-badge">{unreadCount}</span>
          )}
        </div>
      </div>

      {/* Kommende Events Widget */}
      {upcomingEvents.length > 0 && (
        <div className="member-events-wrap">
          <div className="member-events-header">
            <h3 className="member-events-title">
              <Calendar size={16} /> Kommende Events
            </h3>
            <span className="member-events-link" onClick={() => navigate('/member/events')}>
              Alle ansehen →
            </span>
          </div>
          <div className="member-event-list">
            {upcomingEvents.slice(0, 3).map(event => {
              const eventDate = new Date(event.datum).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' });
              return (
                <div
                  key={event.event_id}
                  onClick={() => navigate('/member/events')}
                  className={`md-event-card${event.ist_angemeldet ? ' md-event-card--registered' : ''}`}
                >
                  <div className="member-event-date">
                    <div className="member-event-weekday">{eventDate.split(' ')[0]}</div>
                    <div className="member-event-day">{eventDate.split(' ')[1]}</div>
                    <div className="member-event-month">{eventDate.split(' ')[2]}</div>
                  </div>
                  <div className="member-event-info">
                    <div className="member-event-name">{event.titel}</div>
                    {event.ort && <div className="member-event-location">{event.ort}</div>}
                  </div>
                  {event.ist_angemeldet ? (
                    <span className="member-event-badge registered">✓ Angemeldet</span>
                  ) : (
                    <span className="member-event-badge register">Anmelden</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Freunde werben Freunde – prominent nach den Quick Actions */}
      {referralData && (
        <div className="member-referral-wrap">
          {/* Titel */}
          <div className="member-referral-header">
            <span className="member-referral-icon">🤝</span>
            <div>
              <div className="member-referral-title">Freunde werben Freunde</div>
              <div className="member-referral-subtitle">
                Empfehle uns und kassiere{referralData.standard_praemie ? ` ${referralData.standard_praemie} €` : ' eine Prämie'}!
              </div>
            </div>
          </div>

          {/* Prämie prominent */}
          {referralData.standard_praemie && (
            <div className="md-referral-praemie">
              <span className="md-referral-praemie-icon">💶</span>
              <div>
                <div className="md-referral-praemie-amount">
                  {referralData.standard_praemie} € pro Mitglied
                </div>
                <div className="md-referral-praemie-sub">
                  Für jede erfolgreiche Empfehlung — unbegrenzt!
                </div>
              </div>
            </div>
          )}

          {/* Erklärung */}
          <div className="md-referral-explanation">
            Empfehle uns an Freunde oder Familie weiter. Für <strong className="u-text-primary">jedes neue Mitglied</strong>,
            das sich mit deinem persönlichen Code anmeldet, bekommst du{' '}
            <strong className="u-text-accent">
              {referralData.standard_praemie ? `${referralData.standard_praemie} €` : 'eine Prämie'}
              {referralData.max_kostenlos_monate > 0 ? ` oder bis zu ${referralData.max_kostenlos_monate} Gratismonate` : ''}
            </strong>.
            {' '}Je mehr du wirbst, desto mehr verdienst du!
          </div>

          {/* Code */}
          <div>
            <div className="md-referral-code-label">
              Dein persönlicher Empfehlungscode
            </div>
            <div className="md-referral-code-box">
              <span className="md-referral-code-value">
                {referralData.code}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(referralData.code);
                  setReferralCopied(true);
                  setTimeout(() => setReferralCopied(false), 2000);
                }}
                className={`md-referral-copy-btn${referralCopied ? ' md-referral-copy-btn--copied' : ''}`}
              >
                {referralCopied ? <><Check size={14} /> Kopiert!</> : <><Copy size={14} /> Kopieren</>}
              </button>
            </div>
          </div>

          {/* Anmelde-Link */}
          <div className="md-referral-link-wrap">
            <div className="md-referral-link-label">
              Anmeldeseite für deine Freunde:
            </div>
            <div className="md-referral-link-url">
              {window.location.origin}/mitglied-werden
            </div>
          </div>
        </div>
      )}

      {/* Persönliche Informationen - kompakter */}
      {memberData && (
        <div className="md-info-section">
          <h2 className="md-info-section-title">{t('info.title')}</h2>
          <div className="md-info-list">

            {/* Trainer-Empfehlung */}
            {memberData.trainer_empfehlung && (
              <div className="md-info-card">
                <div className="mb-icon-lg">👨‍🏫</div>
                <div>
                  <h4 className="mb-value-primary">Trainer-Empfehlung</h4>
                  <p className="mb-label-sm">{memberData.trainer_empfehlung}</p>
                </div>
              </div>
            )}

            {/* Medizinische Hinweise */}
            {memberData.medizinische_hinweise && memberData.medizinische_hinweise !== 'Keine besonderen Hinweise' && (
              <div className="md-info-card">
                <div className="mb-icon-lg">🏥</div>
                <div>
                  <h4 className="mb-value-primary">Medizinische Hinweise</h4>
                  <p className="mb-label-sm">{memberData.medizinische_hinweise}</p>
                </div>
              </div>
            )}

            {/* Prüfungs-Countdown */}
            {nextExam && (
              <div className="md-info-card">
                <div className="mb-icon-lg">🎓</div>
                <div className="u-flex-1">
                  <h4 className="mb-value-primary">Nächste Prüfung</h4>
                  <p className="md-exam-date-text">
                    {nextExam.stil} - {formatDate(nextExam.date)}
                  </p>
                  <div className="md-countdown-badge">
                    {getDaysUntilExam(nextExam.date)} Tage verbleiben
                  </div>
                </div>
              </div>
            )}

            {/* Trainingsstunden-Tracker */}
            {Object.values(styleSpecificData).some(data => data && data.stunden_seit_letzter_pruefung !== undefined) && (
              <div className="md-info-card">
                <div className="mb-icon-lg">🎯</div>
                <div className="u-flex-1">
                  <h4 className="mb-value-primary">Trainingsfortschritt</h4>
                  {Object.entries(styleSpecificData).map(([stilId, data]) => {
                    if (!data || !data.stunden_seit_letzter_pruefung) return null;
                    
                    const stil = memberStile.find(s => s.stil_id === parseInt(stilId));
                    if (!stil) return null;
                    
                    const nextGraduation = stil.graduierungen?.find(g => g.graduierung_id === data.current_graduierung_id);
                    const requiredHours = nextGraduation?.min_stunden || 0;
                    const hoursNeeded = Math.max(0, requiredHours - data.stunden_seit_letzter_pruefung);
                    
                    return (
                      <div key={stilId} className="md-progress-row">
                        <div className="md-progress-header">
                          <span className="md-progress-stil-name">
                            {stil.name}
                          </span>
                          {hoursNeeded > 0 ? (
                            <span className="md-hours-needed">
                              Noch {hoursNeeded}h
                            </span>
                          ) : (
                            <span className="md-hours-ready">
                              ✅ Bereit
                            </span>
                          )}
                        </div>
                        <div className="md-progress-track">
                          <div className="md-progress-fill" style={{
                            width: `${Math.min(100, (data.stunden_seit_letzter_pruefung / requiredHours) * 100)}%`
                          }}></div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="md-hint-text">
                    💡 Klicke auf "Stil & Gurt" für Details
                  </div>
                </div>
              </div>
            )}

            {/* Aktuelle Stile & Gürtel */}
            {memberStile.length > 0 && (
              <div className="md-info-card">
                <div className="mb-icon-lg">🥋</div>
                <div className="u-flex-1">
                  <h4 className="mb-value-primary">Meine Kampfkunst-Stile</h4>
                  {memberStile.map((stil, index) => {
                    const stilData = styleSpecificData[stil.stil_id];
                    const currentGraduation = stilData?.current_graduierung_id ? 
                      stil.graduierungen?.find(g => g.graduierung_id === stilData.current_graduierung_id) : 
                      stil.graduierungen?.[0];
                    
                    return (
                      <div key={stil.stil_id} className="md-stil-item">
                        <div className="md-stil-row-header">
                          <span className="md-stil-name">
                            {stil.name}
                          </span>
                          {currentGraduation && (
                            <span className="md-graduation-badge">
                              {currentGraduation.name}
                            </span>
                          )}
                        </div>
                        {stilData?.letzte_pruefung && (
                          <div className="md-last-exam-text">
                            Letzte Prüfung: {new Date(stilData.letzte_pruefung).toLocaleDateString('de-DE')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="md-hint-text">
                    💡 Klicke auf "Stil & Gurt" für Details
                  </div>
                </div>
              </div>
            )}

            {/* Familienrabatt */}
            {memberData.rabatt_prozent && memberData.rabatt_grund && (
              <div className="md-info-card">
                <div className="mb-icon-lg">👨‍👩‍👧‍👦</div>
                <div>
                  <h4 className="mb-value-primary">Familienrabatt</h4>
                  <p className="mb-label-sm">
                    Du erhältst {memberData.rabatt_prozent}% Rabatt ({memberData.rabatt_grund})
                  </p>
                </div>
              </div>
            )}

            {/* Buddy-Gruppen Widget */}
            <BuddyGruppenWidget compact={true} />


            {/* Trainings-Erinnerungen */}
            <TrainingReminders />

            {/* Motivationssprüche */}
            <MotivationQuotes compact={true} />

            {/* Zugelassene Prüfungen */}
            {approvedExams.length > 0 && (
              <div className="md-info-card-purple">
                <div className="mb-flex-center-gap">
                  <div className="mb-icon-lg">🎓</div>
                  <div className="u-flex-1">
                    <h4 className="md-section-heading-purple">
                      Zugelassene Prüfungen
                      <span className="md-count-badge-purple">
                        {approvedExams.length}
                      </span>
                    </h4>
                  </div>
                </div>

                <div className="u-flex-col-sm">
                  {approvedExams.map((exam, index) => (
                    <div
                      key={exam.pruefung_id}
                      className="md-exam-card-purple"
                    >
                      <div className="md-exam-card-header">
                        <div>
                          <div className="md-exam-name-purple">
                            {exam.stil_name}
                          </div>
                          <div className="md-exam-sub-text">
                            Prüfung zum {exam.graduierung_nachher}
                          </div>
                        </div>
                        {exam.graduierung_nachher && exam.farbe_nachher && (
                          <div
                            className="md-belt-dot md-belt-dot--sm"
                            style={{ '--belt-color': exam.farbe_nachher }}
                            title={exam.graduierung_nachher}
                          />
                        )}
                      </div>
                      <div className="md-exam-date-text-sm">
                        📅 {exam.pruefungsdatum ? new Date(exam.pruefungsdatum).toLocaleDateString('de-DE', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) : 'Termin wird noch bekanntgegeben'}
                      </div>
                      {exam.pruefungsdatum && getDaysUntilExam(exam.pruefungsdatum) > 0 && (
                        <div className="md-exam-countdown">
                          In {getDaysUntilExam(exam.pruefungsdatum)} Tagen
                        </div>
                      )}

                      {/* Anmelden Button */}
                      {!exam.teilnahme_bestaetigt ? (
                        <button
                          onClick={() => handleOpenExamRegistration(exam)}
                          className="md-exam-register-btn"
                          onMouseOver={(e) => e.target.style.transform = 'scale(1.02)'}
                          onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                        >
                          Jetzt Anmelden
                        </button>
                      ) : (
                        <div className="md-exam-confirmed-badge">
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
              <div className="md-info-card-col">
                <div className="mb-flex-center-gap">
                  <div className="mb-icon-lg">🏆</div>
                  <div className="u-flex-1">
                    <h4 className="md-section-heading-primary">
                      Prüfungsergebnisse
                    </h4>
                  </div>
                </div>

                <div className="u-flex-col-sm">
                  {examResults.slice(0, 3).map((result, index) => (
                    <div
                      key={result.pruefung_id}
                      className={`md-exam-result-card${result.bestanden ? ' md-exam-result-card--pass' : ' md-exam-result-card--fail'}`}
                    >
                      <div className="md-result-header">
                        <div>
                          <div className={`md-exam-result-stil${result.bestanden ? ' md-exam-result-stil--pass' : ' md-exam-result-stil--fail'}`}>
                            {result.stil_name}
                          </div>
                          <div className="md-result-sub-text">
                            {result.graduierung_nachher}
                          </div>
                        </div>
                        <div className="md-result-emoji">
                          {result.bestanden ? '✅' : '❌'}
                        </div>
                      </div>
                      <div className="md-result-date-text">
                        📅 {new Date(result.pruefungsdatum).toLocaleDateString('de-DE')}
                      </div>
                      {result.punktzahl && result.max_punktzahl && (
                        <div className="md-result-score-text">
                          Punktzahl: {result.punktzahl} / {result.max_punktzahl}
                        </div>
                      )}
                    </div>
                  ))}
                  {examResults.length > 3 && (
                    <div className="md-more-items-hint">
                      +{examResults.length - 3} weitere Prüfungen
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Push-Benachrichtigungen */}
            <div
              id="member-notifications"
              className="md-info-card-col"
            >
              <div className="mb-flex-center-gap">
                <div className="mb-icon-lg">📢</div>
                <div className="u-flex-1">
                  <h4 className="md-section-heading-primary">
                    {t('notifications.title')}
                    {unreadCount > 0 && (
                      <span className="md-count-badge-red">
                        {unreadCount}
                      </span>
                    )}
                  </h4>
                </div>
              </div>

              {notifications.length > 0 ? (
                <div className="u-flex-col-sm">
                  {notifications.slice(0, 3).map((notification, index) => (
                    <div
                      key={notification.id || index}
                      className={`md-notif-item${!notification.read ? ' md-notif-item--unread' : ''}`}
                    >
                      <div className={`md-notif-title${!notification.read ? ' md-notif-title--unread' : ''}`}>
                        {notification.subject || notification.title}
                      </div>
                      <div className="md-notif-message">
                        {notification.message}
                      </div>
                      <div className="md-notif-timestamp">
                        {notification.created_at ? new Date(notification.created_at).toLocaleString('de-DE') : 'Gerade eben'}
                      </div>
                      {notification.requires_confirmation && !notification.confirmed_at && (
                        <button
                          onClick={() => confirmNotification(notification.id)}
                          className="md-notif-confirm-btn"
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
                        <div className="md-notif-confirmed-badge">
                          ✓ Bestätigt am {new Date(notification.confirmed_at).toLocaleString('de-DE')}
                        </div>
                      )}
                    </div>
                  ))}
                  {notifications.length > 3 && (
                    <div className="md-more-items-hint">
                      +{notifications.length - 3} weitere Benachrichtigungen
                    </div>
                  )}
                </div>
              ) : (
                <p className="md-notif-empty">
                  📭 {t('notifications.noNotifications')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Prüfungsanmeldung Modal */}
      {showExamRegistrationModal && selectedExam && (
        <div className="md-modal-overlay">
          <div className="md-modal-box">
            {/* Header */}
            <div className="md-modal-header">
              <div className="mb-flex-center-gap">
                <div className="md-modal-icon">🎓</div>
                <div>
                  <h2 className="md-modal-title">
                    Prüfungsanmeldung
                  </h2>
                  <p className="md-modal-subtitle">
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
                className="md-modal-close-btn"
              >
                ×
              </button>
            </div>

            {/* Prüfungsdetails */}
            <div className="md-modal-details">
              {/* Stil & Graduierung */}
              <div className="md-modal-stil-card">
                <div className="md-modal-stil-inner">
                  <div>
                    <div className="md-modal-field-label">
                      Kampfkunst-Stil
                    </div>
                    <div className="md-modal-stil-name">
                      {selectedExam.stil_name}
                    </div>
                    <div className="md-modal-pruefung-label">
                      Prüfung zum
                    </div>
                    <div className="md-modal-pruefung-value">
                      {selectedExam.graduierung_nachher}
                    </div>
                  </div>
                  {selectedExam.farbe_nachher && (
                    <div
                      className="md-belt-dot md-belt-dot--lg"
                      style={{ '--belt-color': selectedExam.farbe_nachher }}
                      title={selectedExam.graduierung_nachher}
                    />
                  )}
                </div>
              </div>

              {/* Termin & Ort */}
              <div className="md-modal-termin-grid">
                {selectedExam.pruefungsdatum && (
                  <div className="md-modal-info-card">
                    <div className="mb-label-xs">
                      📅 Datum & Uhrzeit
                    </div>
                    <div className="md-modal-info-value">
                      {new Date(selectedExam.pruefungsdatum).toLocaleDateString('de-DE', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                    {selectedExam.pruefungszeit && (
                      <div className="md-modal-time-text">
                        Uhrzeit: {selectedExam.pruefungszeit} Uhr
                      </div>
                    )}
                  </div>
                )}

                {selectedExam.pruefungsort && (
                  <div className="md-modal-info-card">
                    <div className="mb-label-xs">
                      📍 Ort
                    </div>
                    <div className="md-modal-info-value-sm">
                      {selectedExam.pruefungsort}
                    </div>
                  </div>
                )}
              </div>

              {/* Gebühr & Anmeldefrist */}
              <div className="md-modal-fee-grid">
                {selectedExam.pruefungsgebuehr && (
                  <div className="md-modal-fee-card">
                    <div className="mb-label-xs">
                      💰 Prüfungsgebühr
                    </div>
                    <div className="md-modal-fee-value">
                      {parseFloat(selectedExam.pruefungsgebuehr).toFixed(2)} €
                    </div>
                  </div>
                )}

                {selectedExam.anmeldefrist && (
                  <div className="md-modal-frist-card">
                    <div className="mb-label-xs">
                      ⏰ Anmeldefrist
                    </div>
                    <div className="md-modal-frist-value">
                      {new Date(selectedExam.anmeldefrist).toLocaleDateString('de-DE')}
                    </div>
                  </div>
                )}
              </div>

              {/* Gurtlänge */}
              {selectedExam.gurtlaenge && (
                <div className="md-modal-belt-card">
                  <div className="mb-label-xs">
                    📏 Empfohlene Gurtlänge
                  </div>
                  <div className="md-modal-info-value-sm">
                    {selectedExam.gurtlaenge}
                  </div>
                </div>
              )}

              {/* Bemerkungen */}
              {selectedExam.bemerkungen && (
                <div className="md-modal-remarks-card">
                  <div className="mb-label-xs">
                    📝 Bemerkungen
                  </div>
                  <div className="md-modal-remarks-text">
                    {selectedExam.bemerkungen}
                  </div>
                </div>
              )}

              {/* Teilnahmebedingungen */}
              {selectedExam.teilnahmebedingungen && (
                <div className="md-modal-conditions-card">
                  <div className="md-modal-conditions-title">
                    📋 Teilnahmebedingungen
                  </div>
                  <div className="md-modal-conditions-text">
                    {selectedExam.teilnahmebedingungen}
                  </div>
                </div>
              )}
            </div>

            {/* Bestätigung */}
            <div className="md-modal-checkbox-wrap">
              <label className="md-modal-checkbox-label">
                <input
                  type="checkbox"
                  checked={acceptedConditions}
                  onChange={(e) => setAcceptedConditions(e.target.checked)}
                  className="md-modal-checkbox-input"
                />
                <span className="u-text-primary">
                  Ich bestätige hiermit meine Teilnahme an der Prüfung und akzeptiere die Teilnahmebedingungen.
                  Mir ist bewusst, dass die Prüfungsgebühr fällig wird.
                </span>
              </label>
            </div>

            {/* Aktionen */}
            <div className="md-modal-actions">
              <button
                onClick={() => {
                  setShowExamRegistrationModal(false);
                  setSelectedExam(null);
                  setAcceptedConditions(false);
                }}
                className="md-modal-cancel-btn"
                onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.15)'}
                onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
              >
                Abbrechen
              </button>
              <button
                onClick={handleExamRegistration}
                disabled={!acceptedConditions}
                className="md-exam-confirm-btn"
                onMouseOver={(e) => { if (acceptedConditions) e.target.style.transform = 'scale(1.02)'; }}
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

      {/* Member QR Code Modal */}
      {showQRCode && memberData && (
        <MemberQRCode
          memberData={memberData}
          onClose={() => setShowQRCode(false)}
        />
      )}
        </div>
      </div>
    </div>
  );
};

export default MemberDashboard;
