import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx'; // 🔒 TAX COMPLIANCE
import { X, Calendar, CheckCircle, Clock, QrCode } from 'lucide-react';
import config from '../config/config.js';
import QRCodeScanner from './QRCodeScanner.jsx';
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
  const [checkedInCourses, setCheckedInCourses] = useState([]); // Bereits eingecheckte Kurse
  const [showQRScanner, setShowQRScanner] = useState(false);

  const API_BASE = config.apiBaseUrl;

  // Lade Mitgliedsdaten und Kurse
  useEffect(() => {
    loadMemberAndCourses();
  }, []);

  const loadMemberAndCourses = async () => {
    try {
      setLoading(true);
      const userEmail = user?.email;
      if (!userEmail) {
        throw new Error('Keine Benutzer-E-Mail gefunden');
      }

      // Lade Mitgliedsdaten
      const memberResponse = await fetch(`/mitglieder/by-email/${encodeURIComponent(userEmail)}`);
      if (!memberResponse.ok) {
        throw new Error(`Mitgliedsdaten nicht gefunden: ${memberResponse.statusText}`);
      }
      const member = await memberResponse.json();
      setMemberData(member);

      // Lade heutige Kurse mit dojo_id Filter
      const dojoFilterParam = getDojoFilterParam();
      const coursesUrl = dojoFilterParam
        ? `${API_BASE}/checkin/courses-today?${dojoFilterParam}`
        : `${API_BASE}/checkin/courses-today`;
      console.log('🔍 Lade Kurse von:', coursesUrl);

      const coursesResponse = await fetch(coursesUrl);
      if (coursesResponse.ok) {
        const result = await coursesResponse.json();
        console.log('✅ Kurse geladen:', result.courses?.length || 0);
        if (result.success) {
          setCoursesToday(result.courses || []);
        }
      }

      // Lade bereits eingecheckte Kurse für dieses Mitglied (ALLE Check-ins, auch completed)
      const checkinsResponse = await fetch(`${API_BASE}/checkin/today-member/${member.mitglied_id}`);
      if (checkinsResponse.ok) {
        const checkinsResult = await checkinsResponse.json();
        if (checkinsResult.success) {
          const checkedInStundenplanIds = checkinsResult.stundenplan_ids || [];
          setCheckedInCourses(checkedInStundenplanIds);
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

      const response = await fetch(`${API_BASE}/checkin/multi-course`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
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
        const birthdayResponse = await fetch(`${API_BASE}/mitglieder/${memberData.mitglied_id}/birthday-check`);
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

  // QR Code Scan Handler
  const handleQRScan = async (memberId, rawQRData) => {
    console.log('QR Code gescannt:', { memberId, rawQRData });
    setShowQRScanner(false);

    // Prüfe ob gescannte Member-ID mit eingeloggtem Mitglied übereinstimmt
    if (memberData && memberId !== memberData.mitglied_id.toString()) {
      setError(`Ungültige QR-Code: Dieser Code gehört nicht zu deinem Account (ID: ${memberId} vs. ${memberData.mitglied_id})`);
      setTimeout(() => setError(''), 5000);
      return;
    }

    // Auto-check-in für alle verfügbaren Kurse heute
    if (coursesToday.length === 0) {
      setError('Keine Kurse heute verfügbar für QR Check-in');
      setTimeout(() => setError(''), 5000);
      return;
    }

    // Wähle alle noch nicht eingecheckten und verfügbaren Kurse aus
    const availableCourses = coursesToday.filter(
      course => !checkedInCourses.includes(course.stundenplan_id) && isCourseAvailable(course)
    );

    if (availableCourses.length === 0) {
      setError('Keine verfügbaren Kurse für QR Check-in (bereits eingecheckt oder nicht verfügbar)');
      setTimeout(() => setError(''), 5000);
      return;
    }

    // Setze die ausgewählten Kurse und führe Check-in aus
    setSelectedCourses(availableCourses);
    setSuccess(`QR-Code erkannt! Check-in für ${availableCourses.length} Kurs(e)...`);

    // Warte kurz, dann führe Check-in aus
    setTimeout(async () => {
      try {
        setLoading(true);
        const requestBody = {
          mitglied_id: memberData.mitglied_id,
          stundenplan_ids: availableCourses.map(course => course.stundenplan_id),
          checkin_method: 'qr'
        };

        const response = await fetch(`${API_BASE}/checkin/multi-course`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
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
        let successMessage = result.message || `QR Check-in erfolgreich für ${memberData.vorname} ${memberData.nachname}!`;

        // Prüfe ob Mitglied heute Geburtstag hat
        try {
          const birthdayResponse = await fetch(`${API_BASE}/mitglieder/${memberData.mitglied_id}/birthday-check`);
          const birthdayData = await birthdayResponse.json();

          if (birthdayData.hasBirthday) {
            successMessage = `🎉 ${successMessage}\n\n🎂 Herzlichen Glückwunsch zum ${birthdayData.mitglied.alter}. Geburtstag, ${memberData.vorname}! 🎉`;
          }
        } catch (birthdayError) {
          console.error('Fehler beim Geburtstags-Check:', birthdayError);
        }

        setSuccess(`✅ ${successMessage}`);

        // Nach 3 Sekunden schließen und neu laden
        setTimeout(() => {
          if (window.location.pathname.includes('/member')) {
            window.location.reload();
          }
          onClose();
        }, 3000);

      } catch (err) {
        console.error('QR Check-in Fehler:', err);
        setError('QR Check-in Fehler: ' + err.message);
        setSuccess('');
      } finally {
        setLoading(false);
      }
    }, 500);
  };

  if (!memberData) {
    return (
      <div className="modal-overlay">
        <div className="modal-content checkin-modal">
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
    <div className="modal-overlay member-checkin-modal">
      <div className="modal-content checkin-modal">
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

              {/* QR Code Scanner Button */}
              {coursesToday.filter(c => !checkedInCourses.includes(c.stundenplan_id)).length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={() => setShowQRScanner(true)}
                    className="btn btn-secondary"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      padding: '0.875rem 1rem',
                      background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 107, 53, 0.1))',
                      border: '2px solid #ffd700',
                      color: '#ffd700'
                    }}
                  >
                    <QrCode size={20} />
                    QR-Code scannen für schnellen Check-in
                  </button>
                </div>
              )}

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

                    // Bereits eingecheckte Kurse ausblenden
                    if (isAlreadyCheckedIn) {
                      return null;
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

      {/* QR Code Scanner Modal */}
      {showQRScanner && (
        <QRCodeScanner
          onScanSuccess={handleQRScan}
          onClose={() => setShowQRScanner(false)}
        />
      )}
    </div>
  );
};

export default MemberCheckin;
