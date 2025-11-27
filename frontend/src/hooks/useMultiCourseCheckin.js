// Frontend/src/hooks/useMultiCourseCheckin.js
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export const useMultiCourseCheckin = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkinHistory, setCheckinHistory] = useState([]);
  const [coursesToday, setCoursesToday] = useState([]);
  const [stats, setStats] = useState(null);

  // Verfügbare Kurse für heute laden
  const loadCoursesToday = useCallback(async () => {
    try {
      const response = await axios.get('/api/checkin/courses-today');
      setCoursesToday(response.data.courses);
      return response.data.courses;
    } catch (err) {
      setError('Fehler beim Laden der Kurse');
      return [];
    }
  }, []);

  // Heutige Check-ins laden
  const loadTodayCheckins = useCallback(async () => {
    try {
      const response = await axios.get('/api/checkin/today');
      
      // Gruppiere Check-ins nach Mitglied
      const groupedCheckins = response.data.checkins.reduce((acc, checkin) => {
        const key = checkin.mitglied_id;
        if (!acc[key]) {
          acc[key] = {
            memberId: checkin.mitglied_id,
            member: {
              id: checkin.mitglied_id,
              vorname: checkin.vorname,
              nachname: checkin.nachname,
              foto: checkin.foto_url || '👤',
              mitgliedsnummer: checkin.mitgliedsnummer
            },
            courses: [],
            checkinTime: new Date(checkin.checkin_time),
            method: checkin.checkin_method
          };
        }
        
        acc[key].courses.push({
          id: checkin.kurs_id,
          name: checkin.kurs_name,
          zeit: checkin.zeit,
          trainer: `${checkin.trainer_vorname} ${checkin.trainer_nachname}`,
          farbe: getRandomColor() // Hilfsfunktion
        });
        
        return acc;
      }, {});

      setCheckinHistory(Object.values(groupedCheckins));
      return Object.values(groupedCheckins);
    } catch (err) {
      setError('Fehler beim Laden der Check-ins');
      return [];
    }
  }, []);

  // Multi-Course Check-in durchführen
  const performMultiCourseCheckin = useCallback(async (memberData, selectedCourses, method = 'touch') => {
    if (!selectedCourses || selectedCourses.length === 0) {
      setError('Bitte wählen Sie mindestens einen Kurs aus');
      return { success: false, error: 'Keine Kurse ausgewählt' };
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/checkin/multi-course', {
        mitglied_id: memberData.id,
        kurs_ids: selectedCourses.map(c => c.id),
        checkin_method: method
      });

      // Erfolgreiche Anmeldung zu History hinzufügen
      const checkinData = {
        memberId: memberData.id,
        member: memberData,
        courses: selectedCourses,
        checkinTime: new Date(response.data.data.checkin_time),
        method: response.data.data.checkin_method,
        newCourses: response.data.data.registered_courses.length,
        alreadyRegistered: response.data.data.already_registered || []
      };

      setCheckinHistory(prev => {
        // Aktualisiere existierenden Eintrag oder füge neuen hinzu
        const existingIndex = prev.findIndex(c => c.memberId === memberData.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            courses: [...updated[existingIndex].courses, ...selectedCourses]
          };
          return updated;
        } else {
          return [checkinData, ...prev];
        }
      });

      return { 
        success: true, 
        data: response.data.data,
        message: response.data.message
      };

    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Check-in fehlgeschlagen';
      setError(errorMessage);
      
      return { 
        success: false, 
        error: errorMessage,
        details: err.response?.data
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Bereits angemeldete Kurse für Mitglied abrufen
  const getMemberRegisteredCourses = useCallback(async (memberId) => {
    try {
      const response = await axios.get(`/api/checkin/member-courses/${memberId}`);
      return response.data.registered_courses;
    } catch (err) {
      return [];
    }
  }, []);

  // Kurs-Anmeldung stornieren
  const cancelCourseRegistration = useCallback(async (checkinId) => {
    try {
      const response = await axios.delete(`/api/checkin/course/${checkinId}`);
      
      // Aktualisiere lokale History
      await loadTodayCheckins();
      
      return { success: true, message: response.data.message };
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Stornierung fehlgeschlagen';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [loadTodayCheckins]);

  // Tagesstatistiken laden
  const loadDayStats = useCallback(async () => {
    try {
      const response = await axios.get('/api/checkin/stats/today');
      setStats(response.data.stats);
      return response.data.stats;
    } catch (err) {
      setError('Fehler beim Laden der Statistiken');
      return null;
    }
  }, []);

  // QR-Code Check-in (erweitert für Multi-Course)
  const performQRCheckin = useCallback(async (qrData, selectedCourses) => {
    try {
      // Erst QR-Code validieren
      const [prefix, memberId, memberNumber] = qrData.split(':');
      
      if (prefix !== 'DOJO_MEMBER') {
        setError('Ungültiger QR-Code');
        return { success: false, error: 'Ungültiger QR-Code' };
      }

      // Mitglied-Daten abrufen
      const memberResponse = await axios.get(`/api/mitglieder/${memberId}`);
      const memberData = memberResponse.data;

      // Multi-Course Check-in durchführen
      return await performMultiCourseCheckin(memberData, selectedCourses, 'qr_code');

    } catch (err) {
      const errorMessage = err.response?.data?.error || 'QR-Check-in fehlgeschlagen';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [performMultiCourseCheckin]);

  const clearError = useCallback(() => {
    setError('');
  }, []);

  // Hilfsfunktionen
  const isAlreadyCheckedIn = useCallback((memberId) => {
    return checkinHistory.some(c => c.memberId === memberId);
  }, [checkinHistory]);

  const getMemberCheckins = useCallback((memberId) => {
    return checkinHistory.find(c => c.memberId === memberId);
  }, [checkinHistory]);

  // Auto-Load beim Mount
  useEffect(() => {
    loadCoursesToday();
    loadTodayCheckins();
    loadDayStats();
  }, [loadCoursesToday, loadTodayCheckins, loadDayStats]);

  return {
    // State
    loading,
    error,
    checkinHistory,
    coursesToday,
    stats,
    
    // Actions
    performMultiCourseCheckin,
    performQRCheckin,
    cancelCourseRegistration,
    
    // Data Loading
    loadCoursesToday,
    loadTodayCheckins,
    loadDayStats,
    getMemberRegisteredCourses,
    
    // Utilities
    clearError,
    isAlreadyCheckedIn,
    getMemberCheckins
  };
};

// Hilfsfunktion für zufällige Farben
const getRandomColor = () => {
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-red-500', 'bg-indigo-500'];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Frontend/src/components/MultiCourseCheckinSystem.jsx - Vollständige Integration
import React, { useState, useEffect } from 'react';
import { useMultiCourseCheckin } from '../hooks/useMultiCourseCheckin';
import { useQRScanner } from '../hooks/useQRScanner';

const MultiCourseCheckinSystem = () => {
  const [mode, setMode] = useState('touch');
  const [selectedMember, setSelectedMember] = useState(null);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Custom Hooks
  const {
    loading,
    error,
    checkinHistory,
    coursesToday,
    stats,
    performMultiCourseCheckin,
    performQRCheckin,
    loadCoursesToday,
    getMemberRegisteredCourses,
    clearError,
    isAlreadyCheckedIn
  } = useMultiCourseCheckin();

  const {
    isScanning,
    error: scanError,
    videoRef,
    canvasRef,
    startScanning,
    stopScanning,
    onQRDetected
  } = useQRScanner();

  // Mitglieder laden
  useEffect(() => {
    loadMitglieder();
  }, []);

  const loadMitglieder = async () => {
    try {
      const response = await axios.get('/api/mitglieder?status=aktiv');
      setMitglieder(response.data);
    } catch (err) {
      console.error('Failed to load members');
    }
  };

  // QR-Detection Handler
  useEffect(() => {
    onQRDetected(async (qrData) => {
      try {
        // QR-Code verarbeiten und Member-Modal öffnen
        const [prefix, memberId, memberNumber] = qrData.split(':');
        
        if (prefix !== 'DOJO_MEMBER') {
          setError('Ungültiger QR-Code');
          return;
        }

        const member = mitglieder.find(m => 
          m.mitglied_id === parseInt(memberId) && 
          m.mitgliedsnummer === memberNumber
        );
        
        if (!member) {
          setError('Mitglied nicht gefunden');
          return;
        }

        await selectMember(member);
        
      } catch (err) {
        console.error('QR processing error:', err);
      }
    });
  }, [onQRDetected, mitglieder]);

  const selectMember = async (member) => {
    setSelectedMember(member);
    setSelectedCourses([]);
    setShowCourseModal(true);
    clearError();

    // Bereits angemeldete Kurse laden
    try {
      const registeredCourses = await getMemberRegisteredCourses(member.mitglied_id);
      // Hier könntest du die bereits angemeldeten Kurse markieren
    } catch (err) {
      console.error('Failed to load member courses');
    }
  };

  const toggleCourseSelection = (course) => {
    setSelectedCourses(prev => {
      const isSelected = prev.some(c => c.id === course.kurs_id);
      if (isSelected) {
        return prev.filter(c => c.id !== course.kurs_id);
      } else {
        return [...prev, {
          id: course.kurs_id,
          name: course.name,
          zeit: course.zeit,
          trainer: course.trainer,
          farbe: course.farbe
        }];
      }
    });
  };

  const confirmCheckin = async () => {
    if (selectedCourses.length === 0) {
      setError('Bitte wählen Sie mindestens einen Kurs aus');
      return;
    }

    const result = await performMultiCourseCheckin(
      selectedMember, 
      selectedCourses, 
      mode === 'touch' ? 'touch' : 'qr_code'
    );

    if (result.success) {
      setShowCourseModal(false);
      setSelectedMember(null);
      setSelectedCourses([]);
      
      // Kurse neu laden (Teilnehmerzahlen aktualisieren)
      await loadCoursesToday();
      
      // Bei QR-Mode weiterscannen
      if (mode === 'qr' && isScanning) {
        setTimeout(() => {
          // Resume scanning logic here
        }, 1000);
      }
    }
  };

  // Gefilterte Mitglieder
  const filteredMitglieder = mitglieder.filter(mitglied => 
    mitglied.status === 'aktiv' && 
    (mitglied.vorname.toLowerCase().includes(searchTerm.toLowerCase()) ||
     mitglied.nachname.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const displayError = error || scanError;

  return (
    <div className="multi-course-checkin-system">
      {/* Dein existierendes JSX hier, aber jetzt mit echten API-Calls */}
      
      {/* Course Selection Modal mit echten Daten */}
      {showCourseModal && selectedMember && (
        <div className="course-selection-modal">
          {/* Modal Content mit coursesToday aus API */}
          {coursesToday.map(course => {
            const isSelected = selectedCourses.some(c => c.id === course.kurs_id);
            const isRegistered = isAlreadyCheckedIn(selectedMember.mitglied_id) && 
                                 getMemberCheckins(selectedMember.mitglied_id)?.courses.some(c => c.id === course.kurs_id);
            
            return (
              <div 
                key={course.kurs_id}
                onClick={() => !isRegistered && !course.is_full && toggleCourseSelection(course)}
                className={`course-option ${isSelected ? 'selected' : ''} ${isRegistered ? 'registered' : ''} ${course.is_full ? 'full' : ''}`}
              >
                <h4>{course.name}</h4>
                <p>{course.zeit} • {course.trainer}</p>
                <span>{course.aktuelle_teilnehmer}/{course.max_teilnehmer}</span>
              </div>
            );
          })}
          
          <button onClick={confirmCheckin} disabled={selectedCourses.length === 0 || loading}>
            {loading ? 'Anmelden...' : `Anmelden (${selectedCourses.length})`}
          </button>
        </div>
      )}

      {/* Stats Display */}
      {stats && (
        <div className="stats-display">
          <div>Gesamt: {stats.total_checkins}</div>
          <div>Einzigartige Mitglieder: {stats.unique_members}</div>
          <div>⌀ Kurse/Mitglied: {stats.avg_courses_per_member}</div>
        </div>
      )}
    </div>
  );
};

export default MultiCourseCheckinSystem;