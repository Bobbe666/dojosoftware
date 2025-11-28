import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/PublicTimetableDisplay.css';

const PublicTimetableDisplay = () => {
  const [timetableData, setTimetableData] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentView, setCurrentView] = useState(0); // 0 = heute, 1 = nächste Stunde, 2 = Wochenübersicht
  const [loading, setLoading] = useState(false);

  const viewNames = ['Heute', 'Nächste Stunde', 'Wochenübersicht'];
  const viewDuration = 10000; // 10 Sekunden pro Ansicht

  // Automatisches Refresh alle 30 Sekunden für Live-Updates
  useEffect(() => {
    const fetchTimetable = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/stundenplan');
        const data = response.data;
        // Handle both array and object responses
        setTimetableData(Array.isArray(data) ? data : (data.stundenplan || []));
      } catch (error) {
        console.error('❌ Fehler beim Laden des Stundenplans:', error);
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
  }, []);

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
    if (nextToday) return nextToday;

    // Wenn keine Klasse mehr heute, finde erste Klasse morgen
    const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    let dayIndex = (currentTime.getDay() + 1) % 7;
    
    for (let i = 0; i < 7; i++) {
      const nextDay = days[dayIndex];
      const nextDayClasses = timetableData.filter(item => item.tag === nextDay);
      if (nextDayClasses.length > 0) {
        return { ...nextDayClasses[0], isNextDay: true };
      }
      dayIndex = (dayIndex + 1) % 7;
    }
    
    return null;
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
        <h2 className="view-title">📅 Heute - {getCurrentDay()}</h2>
        
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
                  <div className="class-name">{item.kursname}</div>
                  <div className="class-style">🥋 {item.stil}</div>
                  <div className="class-trainer">
                    👨‍🏫 {item.trainer_vorname} {item.trainer_nachname}
                  </div>
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

  const renderNextClassView = () => {
    const nextClass = getNextClass();
    
    return (
      <div className="view-content next-class-view">
        <h2 className="view-title">⏰ Nächste Stunde</h2>
        
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
                {nextClass.isNextDay ? `Morgen - ${nextClass.tag}` : 'Heute'}
              </div>
            </div>
            
            <div className="next-class-time">
              <span className="big-time">{formatTime(nextClass.uhrzeit_start)}</span>
              <span className="time-separator">-</span>
              <span className="big-time">{formatTime(nextClass.uhrzeit_ende)}</span>
            </div>
            
            <div className="next-class-details">
              <div className="next-class-name">{nextClass.kursname}</div>
              <div className="next-class-style">🥋 {nextClass.stil}</div>
              <div className="next-class-trainer">
                👨‍🏫 {nextClass.trainer_vorname} {nextClass.trainer_nachname}
              </div>
            </div>
            
            <div className="countdown-section">
              <div className="countdown-label">Beginnt in</div>
              <div className="countdown-timer">⏱️ Berechnung läuft...</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderWeeklyView = () => {
    const weeklyOverview = getWeeklyOverview();
    
    return (
      <div className="view-content weekly-view">
        <h2 className="view-title">📊 Wochenübersicht</h2>
        
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
                      <div className="mini-name">{item.kursname}</div>
                      <div className="mini-style">{item.stil}</div>
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

      {/* Main Content */}
      <div className="main-content">
        {renderCurrentView()}
      </div>
    </div>
  );
};

export default PublicTimetableDisplay;