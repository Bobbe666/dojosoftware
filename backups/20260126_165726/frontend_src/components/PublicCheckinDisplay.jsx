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
          const checkinsData = data.checkins || [];
          // Stabilisiere die Check-ins: Nur aktualisieren wenn sich wirklich etwas geändert hat
          setCheckins(prevCheckins => {
            // Prüfe ob sich die Anzahl oder IDs geändert haben
            if (prevCheckins.length === 0) {
              return checkinsData; // Erste Ladung
            }
            
            const prevIds = new Set(prevCheckins.map(c => `${c.mitglied_id}-${c.checkin_id || c.checkin_time}`));
            const newIds = new Set(checkinsData.map(c => `${c.mitglied_id}-${c.checkin_id || c.checkin_time}`));
            
            // Nur aktualisieren wenn sich etwas geändert hat
            if (prevIds.size !== newIds.size || 
                ![...prevIds].every(id => newIds.has(id)) ||
                ![...newIds].every(id => prevIds.has(id))) {
              return checkinsData;
            }
            return prevCheckins; // Behalte alte Daten um Blinken zu vermeiden
          });
          setStats({
            total: checkinsData.length || 0,
            today: checkinsData.filter(c => c.status === 'active').length || 0
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
      {/* Header mit Logo, Titel, Datum und Stats */}
      <div className="public-header-compact">
        <div className="header-left">
          <div className="dojo-logo-compact">
            <h1>DOJO CHECK-IN</h1>
            <p className="welcome-text">Willkommen im Training!</p>
          </div>
        </div>
        
        {/* Statistiken im Header mit Uhrzeit oben rechts */}
        <div className="header-right-section">
          <div className="current-time-compact">
            <div className="time">{formatCurrentTime()}</div>
            <div className="date">{formatCurrentDate()}</div>
          </div>
          <div className="public-stats-compact">
            <div className="stat-item-compact">
              <div className="stat-icon">👥</div>
              <div className="stat-content">
                <div className="stat-number">{stats.today}</div>
                <div className="stat-label">Heute Eingecheckt</div>
              </div>
            </div>
            <div className="stat-item-compact">
              <div className="stat-icon">📅</div>
              <div className="stat-content">
                <div className="stat-number">{stats.total}</div>
                <div className="stat-label">Check-ins Gesamt</div>
              </div>
            </div>
            <div className="stat-item-compact">
              <div className="stat-icon">🔄</div>
              <div className="stat-content">
                <div className="stat-number">LIVE</div>
                <div className="stat-label">Updates alle 3s</div>
              </div>
            </div>
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
                key={`${checkin.mitglied_id}-${checkin.checkin_id || checkin.checkin_time}`}
                className="checkin-item"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="checkin-avatar">
                  {(checkin.foto_pfad || checkin.profilbild) ? (
                    <img 
                      key={`img-${checkin.mitglied_id}-${checkin.checkin_id || checkin.checkin_time}`}
                      src={`http://localhost:3000/${(checkin.foto_pfad || checkin.profilbild).startsWith('/') ? (checkin.foto_pfad || checkin.profilbild).slice(1) : (checkin.foto_pfad || checkin.profilbild)}`}
                      alt={`${checkin.vorname} ${checkin.nachname}`}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const placeholder = e.currentTarget.nextSibling;
                        if (placeholder) placeholder.style.display = 'flex';
                      }}
                      onLoad={(e) => {
                        const placeholder = e.currentTarget.nextSibling;
                        if (placeholder) placeholder.style.display = 'none';
                      }}
                      style={{ display: 'block' }}
                    />
                  ) : null}
                  <div className="avatar-placeholder" style={{ display: (checkin.foto_pfad || checkin.profilbild) ? 'none' : 'flex' }}>
                    {checkin.vorname?.charAt(0)}{checkin.nachname?.charAt(0)}
                  </div>
                </div>
                <div className="checkin-info">
                  <div className="member-name">
                    {checkin.vorname} {checkin.nachname}
                  </div>
                  <div className="checkin-details">
                    <span className="checkin-time">
                      🕐 {formatTime(checkin.checkin_time)}
                    </span>
                    {checkin.gurtfarbe && checkin.gurtfarbe !== 'Unbekannt' && checkin.gurtfarbe.trim() !== '' && (
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