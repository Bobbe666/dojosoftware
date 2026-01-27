import React, { useState, useEffect } from 'react';
import { Bell, Clock, Calendar, X, Settings, CheckCircle, List } from 'lucide-react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { useAuth } from '../context/AuthContext.jsx';

const TrainingReminders = () => {
  const { user } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showAllCourses, setShowAllCourses] = useState(true); // Toggle zwischen "Meine Kurse" und "Alle Kurse" - DEFAULT: ALLE
  const [reminderSettings, setReminderSettings] = useState({
    enabled: true,
    advanceMinutes: 30,
    soundEnabled: true,
    emailReminders: false
  });

  // Lade kommende Kurse und erstelle Erinnerungen
  const loadUpcomingCourses = async () => {
    if (!user?.mitglied_id) {
      console.warn('⚠️ Keine mitglied_id - Kurse können nicht geladen werden');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log('📅 Lade Kurse... (showAllCourses:', showAllCourses, ')');

      // Lade entweder "Meine Kurse" oder "Alle Kurse"
      const endpoint = showAllCourses
        ? `${config.apiBaseUrl}/kurse?include_schedule=true`
        : `${config.apiBaseUrl}/mitglieder/${user.mitglied_id}/kurse`;

      const response = await fetchWithAuth(endpoint);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📅 Kurse geladen:', data);

      // Konvertiere Kurse zu Erinnerungen mit Datum/Zeit
      const upcomingCourses = (Array.isArray(data) ? data : data.kurse || [])
        .map(kurs => {
          // Prüfe ob Kurs einen Stundenplan hat
          if (!kurs.wochentag || !kurs.uhrzeit) {
            console.log(`⚠️ Kurs "${kurs.name}" hat keinen Stundenplan - überspringe`);
            return null;
          }

          // Kombiniere wochentag mit aktueller Woche für nächstes Vorkommnis
          const today = new Date();
          const currentDay = today.getDay(); // 0 = Sonntag, 1 = Montag, ...

          // Wochentag-Mapping (Montag=1, Dienstag=2, ... Sonntag=0)
          const wochentagMap = {
            'Montag': 1, 'Dienstag': 2, 'Mittwoch': 3, 'Donnerstag': 4,
            'Freifag': 5, 'Freitag': 5, 'Samstag': 6, 'Sonntag': 0
          };

          const targetDay = wochentagMap[kurs.wochentag] || 1;
          let daysUntil = targetDay - currentDay;

          // Parse Uhrzeit (Format: "18:00:00" oder "18:00")
          const [hours, minutes] = (kurs.uhrzeit || '18:00').split(':').map(Number);

          // Berechne nächstes Vorkommnis
          const nextOccurrence = new Date(today);

          if (daysUntil === 0) {
            // Heute - prüfe ob Uhrzeit noch in der Zukunft liegt
            nextOccurrence.setHours(hours || 18, minutes || 0, 0, 0);

            if (nextOccurrence <= new Date()) {
              // Uhrzeit ist vorbei - nächste Woche
              daysUntil = 7;
              nextOccurrence.setDate(today.getDate() + 7);
            }
          } else {
            // Nicht heute
            if (daysUntil < 0) daysUntil += 7; // Nächste Woche
            nextOccurrence.setDate(today.getDate() + daysUntil);
            nextOccurrence.setHours(hours || 18, minutes || 0, 0, 0);
          }

          // Parse Dauer (Format: "01:30:00" oder Minuten)
          let duration = 90; // Default
          if (kurs.dauer) {
            if (typeof kurs.dauer === 'string' && kurs.dauer.includes(':')) {
              const [h, m] = kurs.dauer.split(':').map(Number);
              duration = (h || 0) * 60 + (m || 0);
            } else {
              duration = parseInt(kurs.dauer) || 90;
            }
          }

          return {
            id: kurs.kurs_id || kurs.id,
            kurs_name: kurs.name || kurs.kurs_name,
            trainer_name: kurs.trainer_vorname && kurs.trainer_nachname
              ? `${kurs.trainer_vorname} ${kurs.trainer_nachname}`
              : kurs.trainer_name || 'TBA',
            datum: nextOccurrence,
            uhrzeit: kurs.uhrzeit,
            raum: kurs.raum || 'Hauptdojo',
            duration,
            stil_name: kurs.stil_name,
            wochentag: kurs.wochentag
          };
        })
        .filter(course => course !== null && course.datum > new Date()); // Nur zukünftige Kurse mit Stundenplan

      // Sortiere nach Datum (nächster zuerst)
      upcomingCourses.sort((a, b) => a.datum - b.datum);

      // Erstelle Erinnerungen basierend auf Einstellungen
      const generatedReminders = upcomingCourses.map(course => {
        const reminderTime = new Date(course.datum.getTime() - (reminderSettings.advanceMinutes * 60 * 1000));
        return {
          ...course,
          reminderTime,
          dismissed: false,
          reminderSent: reminderTime <= new Date()
        };
      });

      console.log('✅ Erinnerungen erstellt:', generatedReminders.length);
      setReminders(generatedReminders);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Kurse:', error);
      setReminders([]);
    } finally {
      setLoading(false);
    }
  };

  // Dismiss reminder
  const dismissReminder = (reminderId) => {
    setReminders(prev => 
      prev.map(reminder => 
        reminder.id === reminderId 
          ? { ...reminder, dismissed: true }
          : reminder
      )
    );
  };

  // Berechne Zeit bis zum Kurs
  const getTimeUntilCourse = (courseDate) => {
    const now = new Date();
    const diff = courseDate - now;
    
    if (diff <= 0) return 'Jetzt';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Format Zeit
  const formatTime = (date) => {
    return date.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Format Datum
  const formatDate = (date) => {
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Heute';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Morgen';
    } else {
      return date.toLocaleDateString('de-DE', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short' 
      });
    }
  };

  useEffect(() => {
    if (user?.mitglied_id) {
      loadUpcomingCourses();
    }

    // Aktualisiere alle 30 Sekunden
    const interval = setInterval(() => {
      if (user?.mitglied_id) {
        loadUpcomingCourses();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [reminderSettings.advanceMinutes, showAllCourses, user?.mitglied_id]);

  if (loading) {
    return (
      <div className="training-reminders">
        <div className="reminders-loading">
          <div className="loading-spinner"></div>
          <span>Lade Erinnerungen...</span>
        </div>
      </div>
    );
  }

  const activeReminders = reminders.filter(r => !r.dismissed && r.reminderTime <= new Date());

  return (
    <div className="training-reminders">
      <div className="reminders-header">
        <div className="reminders-title">
          <Bell size={20} />
          <h3>Trainings-Erinnerungen</h3>
          {activeReminders.length > 0 && (
            <span className="reminders-badge">{activeReminders.length}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="settings-button"
            onClick={() => setShowAllCourses(!showAllCourses)}
            title={showAllCourses ? 'Nur meine Kurse' : 'Alle Kurse anzeigen'}
            style={{
              background: showAllCourses ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)',
              border: showAllCourses ? '1px solid rgba(255, 215, 0, 0.5)' : '1px solid rgba(255, 255, 255, 0.2)',
              color: showAllCourses ? '#ffd700' : 'rgba(255, 255, 255, 0.7)'
            }}
          >
            <List size={16} />
          </button>
          <button
            className="settings-button"
            onClick={() => setShowSettings(!showSettings)}
            title="Einstellungen"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Einstellungen */}
      {showSettings && (
        <div className="reminder-settings">
          <h4>Erinnerungseinstellungen</h4>
          <div className="setting-item">
            <label>
              <input 
                type="checkbox" 
                checked={reminderSettings.enabled}
                onChange={(e) => setReminderSettings(prev => ({
                  ...prev, enabled: e.target.checked
                }))}
              />
              Erinnerungen aktiviert
            </label>
          </div>
          <div className="setting-item">
            <label>
              Erinnerung {reminderSettings.advanceMinutes} Minuten vorher
              <input 
                type="range" 
                min="15" 
                max="120" 
                step="15"
                value={reminderSettings.advanceMinutes}
                onChange={(e) => setReminderSettings(prev => ({
                  ...prev, advanceMinutes: parseInt(e.target.value)
                }))}
              />
            </label>
          </div>
          <div className="setting-item">
            <label>
              <input 
                type="checkbox" 
                checked={reminderSettings.soundEnabled}
                onChange={(e) => setReminderSettings(prev => ({
                  ...prev, soundEnabled: e.target.checked
                }))}
              />
              Sound-Benachrichtigungen
            </label>
          </div>
        </div>
      )}

      {/* Aktive Erinnerungen */}
      {activeReminders.length > 0 ? (
        <div className="active-reminders">
          {activeReminders.map(reminder => (
            <div key={reminder.id} className="reminder-card active">
              <div className="reminder-icon">
                <Bell size={20} />
              </div>
              <div className="reminder-content">
                <div className="reminder-course">
                  <h4>{reminder.kurs_name}</h4>
                  <span className="reminder-trainer">{reminder.trainer_name}</span>
                </div>
                <div className="reminder-time">
                  <Clock size={14} />
                  <span>{formatDate(reminder.datum)} - {formatTime(reminder.datum)}</span>
                  <span className="time-until">in {getTimeUntilCourse(reminder.datum)}</span>
                </div>
                <div className="reminder-details">
                  <Calendar size={14} />
                  <span>{reminder.raum} • {reminder.duration} Min</span>
                </div>
              </div>
              <button 
                className="dismiss-button"
                onClick={() => dismissReminder(reminder.id)}
                title="Schließen"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-reminders">
          <CheckCircle size={32} />
          <p>Keine aktiven Erinnerungen</p>
          <span>Du bist bereit für dein Training!</span>
        </div>
      )}

      {/* Kommende Kurse */}
      <div className="upcoming-courses">
        <h4>Kommende Kurse</h4>
        {reminders.filter(r => !r.dismissed && r.reminderTime > new Date()).map(course => (
          <div key={course.id} className="course-preview">
            <div className="course-info">
              <span className="course-name" style={{ fontWeight: "bold", fontSize: "0.95rem", color: "rgba(255, 255, 255, 0.95)" }}>{course.kurs_name}</span>
              <span className="course-time">{formatDate(course.datum)} - {formatTime(course.datum)}</span>
              <div className="course-details" style={{
                display: 'flex',
                gap: '0.75rem',
                fontSize: '0.85rem',
                color: 'rgba(255, 255, 255, 0.6)',
                marginTop: '0.25rem'
              }}>
                {course.trainer_name && (
                  <span>👨‍🏫 {course.trainer_name}</span>
                )}
                {course.raum && (
                  <span>📍 {course.raum}</span>
                )}
                {course.stil_name && (
                  <span>🥋 {course.stil_name}</span>
                )}
              </div>
            </div>
            <span className="time-until">in {getTimeUntilCourse(course.datum)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrainingReminders;
