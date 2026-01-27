import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Trophy, Award, Calendar, Clock, Target } from 'lucide-react';
import MemberHeader from './MemberHeader.jsx';
import '../styles/themes.css';
import '../styles/MemberStyles.css';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';


const MemberStyles = () => {
  const { user } = useAuth();
  const [memberStile, setMemberStile] = useState([]);
  const [styleSpecificData, setStyleSpecificData] = useState({});
  const [stile, setStile] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStyleTab, setActiveStyleTab] = useState(0);
  const [trainingHoursNeeded, setTrainingHoursNeeded] = useState({});

  useEffect(() => {
    if (user?.email) {
      loadMemberData();
    }
  }, [user?.email]);

  const loadMemberData = async () => {
    try {
      // Lade Mitgliedsdaten
      const memberResponse = await fetchWithAuth(`/mitglieder/by-email/${encodeURIComponent(user.email)}`);
      if (!memberResponse.ok) return;
      
      const memberData = await memberResponse.json();
      
      // Lade alle verfügbaren Stile
      await loadStile();
      
      // Lade Mitglied-Stile
      await loadMemberStyles(memberData.mitglied_id);
      
    } catch (error) {
      console.error('Fehler beim Laden der Mitgliedsdaten:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const loadMemberStyles = async (memberId) => {
    try {
      const response = await fetchWithAuth(`/mitglieder/${memberId}/stile`);
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
    }
  };

  const loadStyleSpecificData = async (memberId, stilId) => {
    try {
      const response = await fetchWithAuth(`/mitglieder/${memberId}/stil/${stilId}/data`);
      if (response.ok) {
        const result = await response.json();
        setStyleSpecificData(prev => ({
          ...prev,
          [stilId]: result.data
        }));
        
        // Berechne benötigte Trainingsstunden
        calculateTrainingHoursNeeded(stilId, result.data);
      }
    } catch (error) {
      console.error(`Fehler beim Laden stilspezifischer Daten für Stil ${stilId}:`, error);
    }
  };

  // Berechne benötigte Trainingsstunden bis zur nächsten Graduierung
  const calculateTrainingHoursNeeded = (stilId, stilData) => {
    const fullStilData = stile.find(s => s.stil_id === stilId);
    if (!fullStilData?.graduierungen || !stilData) return;

    const currentGraduationId = stilData.current_graduierung_id;
    const currentIndex = fullStilData.graduierungen.findIndex(g => g.graduierung_id === currentGraduationId);
    
    if (currentIndex === -1 || currentIndex >= fullStilData.graduierungen.length - 1) {
      // Keine nächste Graduierung verfügbar
      setTrainingHoursNeeded(prev => ({
        ...prev,
        [stilId]: null
      }));
      return;
    }

    const nextGraduation = fullStilData.graduierungen[currentIndex + 1];
    const hoursSinceLastExam = stilData.stunden_seit_letzter_pruefung || 0;
    const requiredHours = nextGraduation.min_stunden || 0;
    const hoursNeeded = Math.max(0, requiredHours - hoursSinceLastExam);

    setTrainingHoursNeeded(prev => ({
      ...prev,
      [stilId]: {
        hoursNeeded,
        hoursCompleted: hoursSinceLastExam,
        requiredHours,
        nextGraduation: nextGraduation.name,
        progress: Math.min(100, (hoursSinceLastExam / requiredHours) * 100)
      }
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Nicht angegeben';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <MemberHeader />
        <div className="dashboard-content">
          <div className="member-styles-loading">
            <div className="loading-spinner"></div>
            <p>Lade Stil & Gurt Daten...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <MemberHeader />
      <div className="dashboard-content">
        <div className="member-styles">
          {/* Header */}
          <div className="styles-header">
            <h1>
              <Trophy size={24} />
              Meine Kampfkunst-Stile
            </h1>
            <p>Verwalte deine Stile, Graduierungen und Prüfungen</p>
          </div>

          {/* Trainingsstunden-Tracker */}
          {Object.values(trainingHoursNeeded).some(tracker => tracker !== null) && (
            <div className="training-tracker-section">
              <h2>
                <Target size={20} />
                Trainingsstunden-Tracker
              </h2>
              <div className="tracker-grid">
                {Object.entries(trainingHoursNeeded).map(([stilId, tracker]) => {
                  if (!tracker) return null;
                  
                  const stilData = memberStile.find(s => s.stil_id === parseInt(stilId));
                  if (!stilData) return null;

                  return (
                    <div key={stilId} className="tracker-card">
                      <div className="tracker-header">
                        <h3>{stilData.name}</h3>
                        <div className="tracker-badge">
                          <span>🎯</span>
                          <span>{tracker.nextGraduation}</span>
                        </div>
                      </div>
                      
                      <div className="tracker-progress">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${tracker.progress}%` }}
                          ></div>
                        </div>
                        <div className="progress-info">
                          <span className="progress-text">
                            {tracker.hoursCompleted}h / {tracker.requiredHours}h
                          </span>
                          <span className="progress-percentage">
                            {Math.round(tracker.progress)}%
                          </span>
                        </div>
                      </div>
                      
                      <div className="tracker-details">
                        {tracker.hoursNeeded > 0 ? (
                          <div className="hours-needed">
                            <span className="hours-label">Noch benötigt:</span>
                            <span className="hours-value">{tracker.hoursNeeded} Stunden</span>
                          </div>
                        ) : (
                          <div className="hours-ready">
                            <span>✅ Bereit für Prüfung!</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {memberStile.length === 0 ? (
            <div className="no-styles">
              <Trophy size={48} />
              <h3>Noch keine Stile zugewiesen</h3>
              <p>Wende dich an deinen Trainer, um Stile zuzuweisen.</p>
            </div>
          ) : (
            <>
              {/* Stil-Tabs */}
              <div className="style-tabs">
                {memberStile.map((memberStil, index) => {
                  const fullStilData = stile.find(s => s.stil_id === memberStil.stil_id);
                  return (
                    <button
                      key={memberStil.stil_id}
                      className={`style-tab ${activeStyleTab === index ? 'active' : ''}`}
                      onClick={() => setActiveStyleTab(index)}
                    >
                      <Trophy size={16} />
                      {fullStilData?.name || memberStil.name}
                    </button>
                  );
                })}
              </div>

              {/* Stil-Inhalt */}
              {memberStile.map((memberStil, index) => {
                if (activeStyleTab !== index) return null;
                
                const fullStilData = stile.find(s => s.stil_id === memberStil.stil_id);
                const stilData = styleSpecificData[memberStil.stil_id];
                const currentGraduation = stilData?.current_graduierung_id ? 
                  fullStilData?.graduierungen?.find(g => g.graduierung_id === stilData.current_graduierung_id) : 
                  fullStilData?.graduierungen?.[0];

                return (
                  <div key={memberStil.stil_id} className="style-content">
                    {/* Stil-Header */}
                    <div className="style-header">
                      <div className="style-info">
                        <h2>
                          <Trophy size={20} />
                          {fullStilData?.name || memberStil.name}
                        </h2>
                        <p className="style-description">
                          {fullStilData?.beschreibung || 'Kampfkunst-Stil'}
                        </p>
                      </div>
                      <div className="current-graduation">
                        {currentGraduation && (
                          <div className="graduation-badge">
                            <Award size={16} />
                            <span>{currentGraduation.name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Graduierungen */}
                    {fullStilData?.graduierungen && fullStilData.graduierungen.length > 0 && (
                      <div className="graduations-section">
                        <h3>
                          <Award size={18} />
                          Graduierungen
                        </h3>
                        <div className="graduations-list">
                          {fullStilData.graduierungen.map((graduation, gradIndex) => (
                            <div 
                              key={graduation.graduierung_id}
                              className={`graduation-item ${
                                currentGraduation?.graduierung_id === graduation.graduierung_id ? 'current' : ''
                              }`}
                            >
                              <div className="graduation-rank">
                                {gradIndex + 1}.
                              </div>
                              <div className="graduation-info">
                                <span className="graduation-name">{graduation.name}</span>
                                {graduation.beschreibung && (
                                  <span className="graduation-description">{graduation.beschreibung}</span>
                                )}
                              </div>
                              {currentGraduation?.graduierung_id === graduation.graduierung_id && (
                                <div className="current-indicator">Aktuell</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Prüfungsdaten */}
                    <div className="exam-section">
                      <h3>
                        <Calendar size={18} />
                        Prüfungsdaten
                      </h3>
                      <div className="exam-details">
                        <div className="exam-item">
                          <label>Letzte Prüfung:</label>
                          <span>{formatDate(stilData?.letzte_pruefung)}</span>
                        </div>
                        <div className="exam-item">
                          <label>Nächste Prüfung:</label>
                          <span>{formatDate(stilData?.naechste_pruefung)}</span>
                        </div>
                        {stilData?.anmerkungen && (
                          <div className="exam-item">
                            <label>Anmerkungen:</label>
                            <span>{stilData.anmerkungen}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Trainingsstunden */}
                    <div className="training-section">
                      <h3>
                        <Clock size={18} />
                        Trainingsfortschritt
                      </h3>
                      <div className="training-stats">
                        <div className="stat-item">
                          <span className="stat-label">Trainingsstunden seit letzter Prüfung:</span>
                          <span className="stat-value">{stilData?.stunden_seit_letzter_pruefung || 0}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Empfohlene Stunden bis nächster Graduierung:</span>
                          <span className="stat-value">{currentGraduation?.min_stunden || 'Nicht definiert'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemberStyles;
