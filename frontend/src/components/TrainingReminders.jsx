import React, { useState, useEffect } from 'react';
import { Bell, Clock, Calendar, X, Settings, CheckCircle } from 'lucide-react';
import config from '../config/config.js';

const TrainingReminders = () => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [reminderSettings, setReminderSettings] = useState({
    enabled: true,
    advanceMinutes: 30,
    soundEnabled: true,
    emailReminders: false
  });

  // Mock-Daten für kommende Kurse
  const mockUpcomingCourses = [
    {
      id: 1,
      kurs_name: 'Karate Grundkurs',
      trainer_name: 'Meister Schmidt',
      datum: new Date(Date.now() + 45 * 60 * 1000), // 45 Minuten
      uhrzeit: '18:00',
      raum: 'Dojo A',
      duration: 90
    },
    {
      id: 2,
      kurs_name: 'Selbstverteidigung',
      trainer_name: 'Frau Müller',
      datum: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 Stunden
      uhrzeit: '19:30',
      raum: 'Dojo B',
      duration: 60
    },
    {
      id: 3,
      kurs_name: 'Kickboxen',
      trainer_name: 'Trainer Weber',
      datum: new Date(Date.now() + 24 * 60 * 60 * 1000), // Morgen
      uhrzeit: '17:00',
      raum: 'Dojo A',
      duration: 75
    }
  ];

  // Lade kommende Kurse und erstelle Erinnerungen
  const loadUpcomingCourses = async () => {
    setLoading(true);
    try {
      // Hier würde normalerweise die API aufgerufen werden
      // const response = await fetch(`${config.apiBaseUrl}/mitglieder/upcoming-courses`);
      
      // Simuliere API-Aufruf
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const upcomingCourses = mockUpcomingCourses.filter(course => 
        course.datum > new Date()
      );

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

      setReminders(generatedReminders);
    } catch (error) {
      console.error('Fehler beim Laden der Kurse:', error);
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
    loadUpcomingCourses();
    
    // Aktualisiere alle 30 Sekunden
    const interval = setInterval(loadUpcomingCourses, 30000);
    return () => clearInterval(interval);
  }, [reminderSettings.advanceMinutes]);

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
        <button 
          className="settings-button"
          onClick={() => setShowSettings(!showSettings)}
          title="Einstellungen"
        >
          <Settings size={16} />
        </button>
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
              <span className="course-name">{course.kurs_name}</span>
              <span className="course-time">{formatDate(course.datum)} - {formatTime(course.datum)}</span>
            </div>
            <span className="time-until">in {getTimeUntilCourse(course.datum)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrainingReminders;
