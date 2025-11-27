import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/PublicCheckinDisplay.css';

const PublicCheckinDisplay = () => {
  const [checkins, setCheckins] = useState([]);
  const [stats, setStats] = useState({ total: 0, today: 0 });
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Automatisches Refresh alle 3 Sekunden für Live-Updates
  useEffect(() => {
    const fetchCheckins = async () => {
      try {
        setLoading(true);
        const today = new Date().toISOString().split('T')[0];

        // Check-ins für heute laden
        const response = await axios.get(`/checkin/today`, { params: { datum: today } });
        const data = response.data;
        
        if (data.success) {
          setCheckins(data.checkins || []);
          setStats({
            total: data.checkins?.length || 0,
            today: data.checkins?.filter(c => c.status === 'active').length || 0
          });
        }
      } catch (error) {
        console.error('❌ Fehler beim Laden der Check-ins:', error);
      } finally {
        setLoading(false);
      }
    };

    // Erste Ladung
    fetchCheckins();
    
    // Auto-Refresh alle 3 Sekunden
    const interval = setInterval(fetchCheckins, 3000);
    
    // Uhrzeit-Update jede Sekunde
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
    };
  }, []);

  const formatTime = (timeString) => {
    if (!timeString) return '';
    return new Date(timeString).toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
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

  // Nur eingecheckte Mitglieder anzeigen
  const activeCheckins = checkins.filter(checkin => checkin.status === 'active');

  return (
    <div className="public-checkin-display">
      {/* Header */}
      <div className="public-header">
        <div className="dojo-logo">
          <h1>🥋 DOJO CHECK-IN</h1>
          <p className="welcome-text">Willkommen im Training!</p>
        </div>
        <div className="current-time">
          <div className="time">{formatCurrentTime()}</div>
          <div className="date">{formatCurrentDate()}</div>
        </div>
      </div>

      {/* Statistiken */}
      <div className="public-stats">
        <div className="stat-item">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-number">{stats.today}</div>
            <div className="stat-label">Heute Eingecheckt</div>
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <div className="stat-number">{stats.total}</div>
            <div className="stat-label">Check-ins Gesamt</div>
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-icon">🔄</div>
          <div className="stat-content">
            <div className="stat-number">LIVE</div>
            <div className="stat-label">Updates alle 3s</div>
          </div>
        </div>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <span>Aktualisiere...</span>
        </div>
      )}

      {/* Check-ins Liste */}
      <div className="checkins-section">
        <div className="section-header">
          <h2>🟢 Aktuell Eingecheckt ({activeCheckins.length})</h2>
        </div>
        
        {activeCheckins.length === 0 ? (
          <div className="no-checkins">
            <div className="no-checkins-icon">📅</div>
            <h3>Noch keine Check-ins heute</h3>
            <p>Sobald sich Mitglieder einchecken, erscheinen sie hier automatisch.</p>
          </div>
        ) : (
          <div className="checkins-grid">
            {activeCheckins.map((checkin, index) => (
              <div 
                key={`${checkin.mitglied_id}-${checkin.checkin_time}`}
                className="checkin-item"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="checkin-avatar">
                  <img 
                    src={checkin.profilbild || '/default-user.png'} 
                    alt="Profil"
                    onError={(e) => { e.target.src = '/default-user.png'; }}
                  />
                </div>
                <div className="checkin-info">
                  <div className="member-name">
                    {checkin.vorname} {checkin.nachname}
                  </div>
                  <div className="checkin-details">
                    <span className="checkin-time">
                      🕐 {formatTime(checkin.checkin_time)}
                    </span>
                    {checkin.gurtfarbe && (
                      <span className="belt-info">
                        🥋 {checkin.gurtfarbe}
                      </span>
                    )}
                  </div>
                  {checkin.kurse && checkin.kurse.length > 0 && (
                    <div className="member-courses">
                      {checkin.kurse.slice(0, 2).map((kurs, idx) => (
                        <span key={idx} className="course-tag">
                          {kurs}
                        </span>
                      ))}
                      {checkin.kurse.length > 2 && (
                        <span className="course-tag more">
                          +{checkin.kurse.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="checkin-status">
                  <div className="status-indicator active"></div>
                  <span className="status-text">AKTIV</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="public-footer">
        <p>💡 Diese Anzeige aktualisiert sich automatisch alle 3 Sekunden</p>
        <p>🏆 Viel Erfolg beim Training!</p>
      </div>
    </div>
  );
};

export default PublicCheckinDisplay;