import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx'; // 🔒 TAX COMPLIANCE
import { X, Calendar, CheckCircle, Clock } from 'lucide-react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/CheckinSystem.css';

const MemberCheckin = ({ onClose }) => {
  const { user } = useAuth();
  const { getDojoFilterParam } = useDojoContext(); // 🔒 TAX COMPLIANCE
  const [memberData, setMemberData] = useState(null);
  const [coursesToday, setCoursesToday] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState(1); // 1: Course Selection, 2: Confirmation
  const [checkedInCourses, setCheckedInCourses] = useState([]); // Aktiv eingecheckte Kurse (status=active)
  const [trainerCheckedInCourses, setTrainerCheckedInCourses] = useState([]); // Vom Trainer eingecheckt (completed+manual)
  
  const API_BASE = config.apiBaseUrl;

  // Lade Mitgliedsdaten und Kurse
  useEffect(() => {
    loadMemberAndCourses();
  }, []);

  const loadMemberAndCourses = async () => {
    try {
      setLoading(true);
      const mitgliedId = user?.mitglied_id;
      if (!mitgliedId) {
        throw new Error('Keine Mitglieds-ID gefunden');
      }

      // Mitgliedsdaten direkt per ID laden (korrekt mit /api und fetchWithAuth)
      const memberResponse = await fetchWithAuth(`${API_BASE}/mitglieder/${mitgliedId}`);
      if (!memberResponse.ok) {
        throw new Error(`Mitgliedsdaten nicht gefunden: ${memberResponse.statusText}`);
      }
      const member = await memberResponse.json();
      setMemberData(member);

      // Heutige Kurse laden
      const coursesResponse = await fetchWithAuth(`${API_BASE}/checkin/courses-today`);
      if (coursesResponse.ok) {
        const result = await coursesResponse.json();
        console.log('✅ Kurse geladen:', result.courses?.length || 0);
        if (result.success) {
          setCoursesToday(result.courses || []);
        }
      }

      // Bereits eingecheckte Kurse laden
      const checkinsResponse = await fetchWithAuth(`${API_BASE}/checkin/today-member/${mitgliedId}`);
      if (checkinsResponse.ok) {
        const checkinsResult = await checkinsResponse.json();
        if (checkinsResult.success) {
          const checkedInStundenplanIds = checkinsResult.stundenplan_ids || [];
          setCheckedInCourses(checkedInStundenplanIds);
          // Trainer-eingecheckte Kurse: completed + manual (nicht selbst eingecheckt)
          const trainerIds = (checkinsResult.checkins || [])
            .filter(c => c.status === 'completed' && c.checkin_method === 'manual')
            .map(c => c.stundenplan_id);
          setTrainerCheckedInCourses(trainerIds);
        }
      }

    } catch (err) {
      console.error('Fehler beim Laden der Daten:', err);
      setError('Fehler beim Laden der Daten: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Kurs-Auswahl toggle
  const toggleCourse = (course) => {
    setSelectedCourses(prev => {
      const isSelected = prev.some(c => c.stundenplan_id === course.stundenplan_id);
      if (isSelected) {
        return prev.filter(c => c.stundenplan_id !== course.stundenplan_id);
      } else {
        return [...prev, course];
      }
    });
  };

  // Check-in ausführen
  const executeCheckin = async () => {
    if (!memberData || selectedCourses.length === 0) {
      setError('Bitte wählen Sie mindestens einen Kurs aus');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const requestBody = {
        mitglied_id: memberData.mitglied_id,
        stundenplan_ids: selectedCourses.map(course => course.stundenplan_id),
        checkin_method: 'touch'
      };

      const response = await fetchWithAuth(`${API_BASE}/checkin/multi-course`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
        } catch {
          errorMessage = `HTTP ${response.status}: ${errorText}`;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      let successMessage = result.message || `Check-in erfolgreich für ${memberData.vorname} ${memberData.nachname}!`;

      // Prüfe ob Mitglied heute Geburtstag hat
      try {
        const birthdayResponse = await fetchWithAuth(`${API_BASE}/mitglieder/${memberData.mitglied_id}/birthday-check`);
        const birthdayData = await birthdayResponse.json();

        if (birthdayData.hasBirthday) {
          successMessage = `🎉 ${successMessage}\n\n🎂 Herzlichen Glückwunsch zum ${birthdayData.mitglied.alter}. Geburtstag, ${memberData.vorname}! 🎉`;
        }
      } catch (birthdayError) {
        console.error('Fehler beim Geburtstags-Check:', birthdayError);
        // Fahre fort, auch wenn Geburtstags-Check fehlschlägt
      }

      setSuccess(`✅ ${successMessage}`);

      // Nach 3 Sekunden schließen und Parent neu laden
      setTimeout(() => {
        // Trigger Parent-Komponente zum Neu-Laden der Statistiken
        if (window.location.pathname.includes('/member')) {
          window.location.reload();
        }
        onClose();
      }, 3000);
      
    } catch (err) {
      console.error('Check-in Fehler:', err);
      setError('Check-in Fehler: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Prüfe ob Kurs bereits verfügbar ist
  const isCourseAvailable = (course) => {
    const now = new Date();
    const today = new Date().toISOString().split('T')[0];
    const courseTime = new Date(`${today}T${course.uhrzeit_start}`);
    const courseEnd = new Date(`${today}T${course.uhrzeit_ende}`);
    
    // Kurs muss in der Zukunft liegen und noch nicht beendet sein
    return now < courseTime || (now >= courseTime && now <= courseEnd);
  };

  // Format Zeit
  const formatTime = (timeString) => {
    return timeString.substring(0, 5); // HH:MM
  };

  if (!memberData) {
    return (
      <div className="modal-overlay member-checkin-modal" onClick={onClose}>
        <div className="modal-content checkin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Check-in</h2>
            <button onClick={onClose} className="close-button">
              <X size={24} />
            </button>
          </div>
          <div className="modal-body">
            {loading ? (
              <div className="loading">Lade Daten...</div>
            ) : (
              <div className="error-message">{error}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay member-checkin-modal" onClick={onClose}>
      <div className="modal-content checkin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Check-in für {memberData.vorname} {memberData.nachname}</h2>
          <button onClick={onClose} className="close-button">
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="message error">
              {error}
            </div>
          )}

          {success && (
            <div className="message success">
              {success}
            </div>
          )}

          {step === 1 && (
            <div className="course-selection-step">
              <div className="step-header">
                <div className="step-icon">
                  <Calendar size={24} />
                </div>
                <div>
                  <h3>Kurse für heute auswählen</h3>
                  <p>Wählen Sie die Kurse aus, für die Sie sich anmelden möchten:</p>
                </div>
              </div>

              {loading ? (
                <div className="loading">Lade Kurse...</div>
              ) : coursesToday.length === 0 ? (
                <div className="no-courses">
                  <div className="no-courses-icon">📅</div>
                  <h4>Keine Kurse heute</h4>
                  <p>Für heute sind keine Kurse geplant.</p>
                </div>
              ) : coursesToday.filter(c => !checkedInCourses.includes(c.stundenplan_id)).length === 0 ? (
                <div className="no-courses">
                  <div className="no-courses-icon">✅</div>
                  <h4>Bereits für alle Kurse eingecheckt</h4>
                  <p>Sie sind bereits für alle heutigen Kurse eingecheckt.</p>
                </div>
              ) : (
                <div className="courses-list">
                  {coursesToday.map((course) => {
                    const available = isCourseAvailable(course);
                    const isSelected = selectedCourses.some(c => c.stundenplan_id === course.stundenplan_id);
                    const isAlreadyCheckedIn = checkedInCourses.includes(course.stundenplan_id);
                    const isTrainerCheckedIn = trainerCheckedInCourses.includes(course.stundenplan_id);

                    // Aktiv selbst-eingecheckte Kurse ausblenden
                    if (isAlreadyCheckedIn) {
                      return null;
                    }

                    // Vom Trainer eingecheckt → anzeigen mit Hinweis
                    if (isTrainerCheckedIn) {
                      return (
                        <div key={course.stundenplan_id} className="course-item unavailable" style={{opacity:0.75}}>
                          <div className="course-checkbox" style={{color:'#16a34a',fontSize:'18px'}}>✓</div>
                          <div className="course-info">
                            <div className="course-name">{course.kurs_name || course.gruppenname}</div>
                            <div className="course-time"><Clock size={16} />{formatTime(course.uhrzeit_start)} - {formatTime(course.uhrzeit_ende)}</div>
                          </div>
                          <div style={{fontSize:'12px',color:'#16a34a',fontWeight:600,whiteSpace:'nowrap'}}>✅ bereits durch Trainer eingecheckt</div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={course.stundenplan_id}
                        className={`course-item ${isSelected ? 'selected' : ''} ${!available ? 'unavailable' : ''}`}
                        onClick={() => available && toggleCourse(course)}
                      >
                        <div className="course-checkbox">
                          {isSelected && <CheckCircle size={20} />}
                        </div>
                        <div className="course-info">
                          <div className="course-name">{course.kurs_name || course.gruppenname}</div>
                          <div className="course-time">
                            <Clock size={16} />
                            {formatTime(course.uhrzeit_start)} - {formatTime(course.uhrzeit_ende)}
                          </div>
                          {course.trainer && (
                            <div className="course-trainer">👨‍🏫 {course.trainer}</div>
                          )}
                          {course.stil && (
                            <div className="course-room">🥋 {course.stil}</div>
                          )}
                        </div>
                        {!available && (
                          <div className="course-status">
                            {new Date(`${new Date().toISOString().split('T')[0]}T${course.uhrzeit_start}`) > new Date() ? 'Zukünftig' : 'Beendet'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="action-buttons">
                <button onClick={onClose} className="btn btn-secondary">
                  Abbrechen
                </button>
                <button 
                  onClick={() => setStep(2)} 
                  disabled={selectedCourses.length === 0}
                  className="btn btn-primary"
                >
                  Weiter →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="confirmation-step">
              <div className="step-header">
                <div className="step-icon">
                  <CheckCircle size={24} />
                </div>
                <div>
                  <h3>Check-in bestätigen</h3>
                  <p>Möchten Sie sich für die folgenden Kurse anmelden?</p>
                </div>
              </div>

              <div className="selected-courses">
                {selectedCourses.map((course) => (
                  <div key={course.stundenplan_id} className="selected-course-item">
                    <div className="course-name">{course.kurs_name || course.gruppenname}</div>
                    <div className="course-time">
                      <Clock size={16} />
                      {formatTime(course.uhrzeit_start)} - {formatTime(course.uhrzeit_ende)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="action-buttons">
                <button onClick={() => setStep(1)} className="btn btn-secondary">
                  ← Zurück
                </button>
                <button 
                  onClick={executeCheckin} 
                  disabled={loading}
                  className="btn btn-success btn-large"
                >
                  {loading ? 'Lädt...' : 'Jetzt anmelden!'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemberCheckin;
