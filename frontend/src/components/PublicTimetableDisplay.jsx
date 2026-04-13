import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/PublicTimetableDisplay.css';

const PublicTimetableDisplay = () => {
  // Hole dojo_id aus URL-Parameter: /public-timetable?dojo=3
  const urlParams = new URLSearchParams(window.location.search);
  const dojoId = urlParams.get('dojo') || '3'; // Default zu 3 (Hauptdojo)

  const [timetableData, setTimetableData] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentView, setCurrentView] = useState(0); // 0 = heute, 1 = nächste Stunde, 2 = Wochenübersicht
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [error, setError] = useState(null);

  const viewNames = ['Heute', 'Nächste Stunde', 'Wochenübersicht'];
  const viewDuration = 10000; // 10 Sekunden pro Ansicht

  // Automatisches Refresh alle 30 Sekunden für Live-Updates
  useEffect(() => {
    const fetchTimetable = async () => {
      if (!dojoId) {
        console.log('⏳ Keine Dojo-ID in URL gefunden. Verwende ?dojo=1');
        return;
      }

      try {
        setLoading(true);
        setError(null);
        console.log('📡 Lade Stundenplan für Dojo:', dojoId);
        const response = await axios.get(`/public/stundenplan/${dojoId}`);
        const data = response.data;
        console.log('📦 Rohe API Response:', data);

        // Handle both array and object responses
        const extractedData = Array.isArray(data) ? data : (data.data || data.stundenplan || []);
        console.log('📊 Extrahierte Daten:', extractedData);
        console.log('📋 Anzahl Kurse:', extractedData.length);

        setTimetableData(extractedData);
        console.log('✅ Stundenplan geladen und gesetzt');
      } catch (error) {
        console.error('❌ Fehler beim Laden des Stundenplans:', error);
        console.error('❌ Error Details:', error.response || error.message);
        setError('⚔️ Der Stundenplan hat gerade einen Sparring-Zweikampf mit dem Server - wir schreiten ein!');
        setTimetableData([]);
      } finally {
        setLoading(false);
      }
    };

    // Erste Ladung
    fetchTimetable();
    
    // Auto-Refresh alle 30 Sekunden
    const dataInterval = setInterval(fetchTimetable, 30000);
    
    // Uhrzeit-Update jede Sekunde
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // View-Rotation alle 10 Sekunden
    const viewInterval = setInterval(() => {
      setCurrentView(prev => (prev + 1) % 3);
    }, viewDuration);

    return () => {
      clearInterval(dataInterval);
      clearInterval(timeInterval);
      clearInterval(viewInterval);
    };
  }, [dojoId]);

  // Separater useEffect für Countdown-Update
  useEffect(() => {
    const updateCountdown = () => {
      const nextClass = getNextClass();
      if (nextClass) {
        const countdownStr = calculateCountdown(nextClass);
        setCountdown(countdownStr);
      } else {
        setCountdown('');
      }
    };
    
    updateCountdown(); // Initial update
    const countdownInterval = setInterval(updateCountdown, 1000);
    
    return () => {
      clearInterval(countdownInterval);
    };
  }, [timetableData, currentTime]);

  const formatTime = (timeString) => {
    return timeString ? timeString.substring(0, 5) : '';
  };

  const formatCurrentTime = () => {
    return currentTime.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatCurrentDate = () => {
    return currentTime.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getCurrentDay = () => {
    const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    return days[currentTime.getDay()];
  };

  const getTodaysClasses = () => {
    const today = getCurrentDay();
    return timetableData.filter(item => item.tag === today);
  };

  const getNextClass = () => {
    const today = getCurrentDay();
    const currentTimeStr = formatCurrentTime().substring(0, 5); // HH:MM
    const todaysClasses = getTodaysClasses();
    
    // Finde nächste Klasse heute
    const nextToday = todaysClasses.find(item => item.uhrzeit_start > currentTimeStr);
    if (nextToday) {
      return { ...nextToday, isNextDay: false, tag: today };
    }

    // Wenn keine Klasse mehr heute, finde erste Klasse in den nächsten Tagen
    const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const currentDayIndex = currentTime.getDay();
    let dayIndex = (currentDayIndex + 1) % 7;
    
    // Suche die nächsten 7 Tage nach der ersten verfügbaren Klasse
    for (let i = 0; i < 7; i++) {
      const nextDay = days[dayIndex];
      const nextDayClasses = timetableData.filter(item => item.tag === nextDay);
      if (nextDayClasses.length > 0) {
        // Sortiere nach Uhrzeit und nimm die erste
        const sortedClasses = nextDayClasses.sort((a, b) => {
          const timeA = a.uhrzeit_start || '00:00';
          const timeB = b.uhrzeit_start || '00:00';
          return timeA.localeCompare(timeB);
        });
        const isTomorrow = (dayIndex === (currentDayIndex + 1) % 7);
        return { ...sortedClasses[0], isNextDay: isTomorrow, tag: nextDay };
      }
      dayIndex = (dayIndex + 1) % 7;
    }
    
    return null;
  };

  const calculateCountdown = (nextClass) => {
    if (!nextClass || !nextClass.uhrzeit_start || !nextClass.tag) return '';
    
    const now = new Date();
    const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const currentDayIndex = now.getDay();
    const targetDayIndex = days.indexOf(nextClass.tag);
    
    if (targetDayIndex === -1) return '';
    
    // Berechne die Anzahl der Tage bis zum Zieltag
    let daysUntilTarget = targetDayIndex - currentDayIndex;
    if (daysUntilTarget < 0) {
      daysUntilTarget += 7; // Nächste Woche
    }
    
    // Wenn es heute ist, prüfe ob die Zeit bereits vorbei ist
    if (daysUntilTarget === 0) {
      const [hours, minutes] = nextClass.uhrzeit_start.split(':');
      const targetTime = new Date(now);
      targetTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      
      if (targetTime < now) {
        // Zeit ist heute vorbei, nimm nächste Woche
        daysUntilTarget = 7;
      }
    }
    
    // Erstelle das Ziel-Datum
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + daysUntilTarget);
    
    // Setze die Uhrzeit
    const [hours, minutes] = nextClass.uhrzeit_start.split(':');
    targetDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    
    const diff = targetDate - now;
    
    if (diff <= 0) return 'Bereits gestartet';
    
    const daysRemaining = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hoursRemaining = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (daysRemaining > 0) {
      return `${daysRemaining} Tag${daysRemaining > 1 ? 'e' : ''}, ${hoursRemaining} Stunde${hoursRemaining !== 1 ? 'n' : ''}`;
    } else if (hoursRemaining > 0) {
      return `${hoursRemaining} Stunde${hoursRemaining !== 1 ? 'n' : ''}, ${mins} Minute${mins !== 1 ? 'n' : ''}`;
    } else {
      return `${mins} Minute${mins !== 1 ? 'n' : ''}`;
    }
  };

  const getWeeklyOverview = () => {
    const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    return days.map(day => ({
      day,
      classes: timetableData.filter(item => item.tag === day)
    }));
  };

  const renderTodayView = () => {
    const todaysClasses = getTodaysClasses();
    
    return (
      <div className="view-content today-view">
        {todaysClasses.length === 0 ? (
          <div className="no-classes">
            <div className="no-classes-icon">🏮</div>
            <h3>Heute keine Kurse</h3>
            <p>Genießt euren freien Tag!</p>
          </div>
        ) : (
          <div className="classes-grid">
            {todaysClasses.map((item, index) => (
              <div 
                key={`${item.id}-${index}`}
                className="class-card"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="class-time">
                  <span className="start-time">{formatTime(item.uhrzeit_start)}</span>
                  <span className="time-separator">-</span>
                  <span className="end-time">{formatTime(item.uhrzeit_ende)}</span>
                </div>
                <div className="class-info">
                  <div className="class-name">{item.stil || item.kursname}</div>
                  {item.gruppenname && <div className="class-group">{item.gruppenname}</div>}
                  {item.trainer && (
                    <div className="class-trainer">
                      👨‍🏫 {item.trainer}
                    </div>
                  )}
                </div>
                <div className="class-status">
                  <div className="status-indicator"></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };


  const renderWeeklyView = () => {
    const weeklyOverview = getWeeklyOverview();
    
    return (
      <div className="view-content weekly-view">
        <div className="weekly-grid">
          {weeklyOverview.map((dayData, dayIndex) => (
            <div 
              key={dayData.day}
              className={`day-column ${dayData.day === getCurrentDay() ? 'current-day' : ''}`}
              style={{ animationDelay: `${dayIndex * 0.1}s` }}
            >
              <div className="day-header">
                <div className="day-name">{dayData.day}</div>
                <div className="day-count">{dayData.classes.length} Kurse</div>
              </div>
              
              <div className="day-classes">
                {dayData.classes.length === 0 ? (
                  <div className="no-day-classes">Kein Kurs</div>
                ) : (
                  dayData.classes.map((item, index) => (
                    <div key={`${item.id}-${index}`} className="mini-class-card">
                      <div className="mini-time">
                        {formatTime(item.uhrzeit_start)} - {formatTime(item.uhrzeit_ende)}
                      </div>
                      <div className="mini-name">{item.stil || item.kursname}</div>
                      {item.gruppenname && <div className="mini-group">{item.gruppenname}</div>}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderNextClassView = () => {
    const nextClass = getNextClass();
    
    return (
      <div className="view-content next-class-view">
        {!nextClass ? (
          <div className="no-classes">
            <div className="no-classes-icon">📅</div>
            <h3>Keine weiteren Kurse geplant</h3>
            <p>Schaut später wieder vorbei!</p>
          </div>
        ) : (
          <div className="next-class-card">
            <div className="next-class-header">
              <div className="next-class-day">
                {nextClass.isNextDay ? `Morgen - ${nextClass.tag}` : nextClass.tag === getCurrentDay() ? `Heute - ${nextClass.tag}` : nextClass.tag}
              </div>
            </div>
            
            <div className="next-class-time">
              <span className="big-time">{formatTime(nextClass.uhrzeit_start)}</span>
              <span className="time-separator">-</span>
              <span className="big-time">{formatTime(nextClass.uhrzeit_ende)}</span>
            </div>
            
            <div className="next-class-details">
              <div className="next-class-name">{nextClass.stil || nextClass.kursname}</div>
              {nextClass.gruppenname && <div className="next-class-group">{nextClass.gruppenname}</div>}
              {nextClass.trainer && (
                <div className="next-class-trainer">
                  👨‍🏫 {nextClass.trainer}
                </div>
              )}
            </div>
            
            <div className="countdown-section">
              <div className="countdown-label">Beginnt in</div>
              <div className="countdown-timer">⏱️ {countdown || 'Berechnung läuft...'}</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCurrentView = () => {
    switch(currentView) {
      case 0: return renderTodayView();
      case 1: return renderNextClassView();
      case 2: return renderWeeklyView();
      default: return renderTodayView();
    }
  };

  return (
    <div className="public-timetable-display">
      {/* View Indicator with Time */}
      <div className="view-indicator">
        <div className="left-info">
          <span className="info-text">🔄 Wechsel alle 10s • 📡 Live Updates</span>
        </div>
        <div className="view-center">
          <div className="view-info">
            <span className="current-view-name">{viewNames[currentView]}</span>
            <span className="view-progress">({currentView + 1}/3)</span>
          </div>
          <div className="view-dots">
            {[0, 1, 2].map(index => (
              <div 
                key={index}
                className={`view-dot ${index === currentView ? 'active' : ''}`}
              />
            ))}
          </div>
        </div>
        <div className="current-time">
          <div className="time">{formatCurrentTime()}</div>
          <div className="date">{formatCurrentDate()}</div>
        </div>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <span>Aktualisiere...</span>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-display">
          <div className="error-display-icon">⚔️</div>
          <h2 className="error-display-title">{error}</h2>
          <p className="error-display-subtitle">Der Stundenplan wird automatisch alle 30 Sekunden aktualisiert.</p>
          <div className="error-display-hint">🔄 Nächste Aktualisierung läuft...</div>
        </div>
      )}

      {/* Main Content */}
      {!error && (
        <div className="main-content">
          {renderCurrentView()}
        </div>
      )}
    </div>
  );
};

export default PublicTimetableDisplay;