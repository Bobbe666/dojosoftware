import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, CheckCircle, User, X, Calendar, ArrowRight, Plus, Check, Star, Clock, ShoppingCart
} from 'lucide-react';
import { useMitgliederUpdate } from '../context/MitgliederUpdateContext.jsx';
import VerkaufKasse from './VerkaufKasse';
import config from '../config/config.js';
import "../styles/themes.css";       // Centralized theme system
import "../styles/components.css";   // Universal component styles
import '../styles/CheckinSystem.css';

const aggregateCheckinsByMember = (checkins = []) => {
  const map = new Map();

  checkins.forEach((entry) => {
    if (!entry) return;
    const key = entry.mitglied_id || `${entry.vorname || ""}-${entry.nachname || ""}-${entry.checkin_id}`;

    if (!map.has(key)) {
      map.set(key, {
        mitglied_id: entry.mitglied_id,
        vorname: entry.vorname,
        nachname: entry.nachname,
        full_name:
          entry.full_name ||
          `${entry.vorname || ""} ${entry.nachname || ""}`.trim(),
        mitgliedsnummer: entry.mitgliedsnummer,
        foto_pfad: entry.foto_pfad,
        gurtfarbe: entry.gurtfarbe,
        kurse: [],
        checkins: [],
        primaryCheckin: entry,
      });
    }

    const aggregiert = map.get(key);
    aggregiert.kurse.push({
      kurs_name: entry.kurs_name,
      stundenplan_id: entry.stundenplan_id,
      checkin_id: entry.checkin_id,
      checkin_time: entry.checkin_time,
      minutes_since_checkin: entry.minutes_since_checkin,
      status: entry.status,
    });
    aggregiert.checkins.push(entry);

    if (
      entry.checkin_time &&
      (!aggregiert.primaryCheckin?.checkin_time ||
        new Date(entry.checkin_time) <
          new Date(aggregiert.primaryCheckin.checkin_time))
    ) {
      aggregiert.primaryCheckin = entry;
    }
  });

  return Array.from(map.values()).map((person) => ({
    ...person,
    minutes_since_checkin: person.primaryCheckin?.minutes_since_checkin,
  }));
};

const CheckinSystem = () => {
  // Refs für automatische Fokussierung
  const searchInputRef = useRef(null);
  const { updateTrigger } = useMitgliederUpdate(); // 🔄 Automatische Updates nach Mitgliedsanlage

  // State Management
  const [members, setMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [coursesToday, setCoursesToday] = useState([]);
  const [todayCheckins, setTodayCheckins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Multi-step workflow
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [step, setStep] = useState(1); // 1: Member Selection, 2: Course Selection, 3: Confirmation
  const [memberCheckedInCourses, setMemberCheckedInCourses] = useState([]); // Stundenplan IDs für die das Mitglied heute schon eingecheckt ist

  // Modal State
  const [showCheckinModal, setShowCheckinModal] = useState(false);

  // Verkauf State
  const [showVerkauf, setShowVerkauf] = useState(false);
  const [verkaufKunde, setVerkaufKunde] = useState(null);

  // API Configuration
  const API_BASE = config.apiBaseUrl;

  // Initialize data
  useEffect(() => {
    loadInitialData();
    // 🔄 AUTOMATISCHES UPDATE: Lädt neu wenn sich Mitglieder ändern
  }, [updateTrigger]);

  // Automatische Fokussierung des Suchfeldes beim Laden der Komponente
  useEffect(() => {
    if (searchInputRef.current && !loading) {
      searchInputRef.current.focus();
    }
  }, [loading]);

  // Automatische Fokussierung nach Reset des Workflows
  useEffect(() => {
    if (step === 1 && searchInputRef.current && !showCheckinModal) {
      // Kleine Verzögerung damit das Modal vollständig geschlossen ist
      setTimeout(() => {
        searchInputRef.current.focus();
      }, 100);
    }
  }, [step, showCheckinModal]);

  const loadInitialData = async () => {
    try {
      await Promise.all([
        loadMembers(),
        loadCoursesToday(),
        loadTodayCheckins()
      ]);
    } catch (err) {
      console.error('Fehler beim Laden der Daten:', err);
    }
  };

  const loadMembers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/mitglieder`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const membersList = Array.isArray(data) ? data : (data.data || []);
      setMembers(membersList);
    } catch (err) {
      console.error('Fehler beim Laden der Mitglieder:', err);
      setMembers([]);
    }
  };

  const loadCoursesToday = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/checkin/courses-today`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const coursesList = data.courses || [];
      setCoursesToday(coursesList);
    } catch (err) {
      console.error('Fehler beim Laden der Kurse:', err);
      setError(`Kurse konnten nicht geladen werden: ${err.message}`);
      setCoursesToday([]);
    }
  };

  const loadTodayCheckins = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/checkin/today`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const checkinsList = data.checkins || [];
      setTodayCheckins(checkinsList);
    } catch (err) {
      console.error('Fehler beim Laden der Check-ins:', err);
      setTodayCheckins([]);
    }
  };

  const aggregatedTodayCheckins = useMemo(
    () => aggregateCheckinsByMember(todayCheckins),
    [todayCheckins]
  );

  const loadMemberCheckins = async (mitgliedId) => {
    try {
      const response = await fetch(`${API_BASE}/api/checkin/today-member/${mitgliedId}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const stundenplanIds = data.stundenplan_ids || [];
      setMemberCheckedInCourses(stundenplanIds);
      return stundenplanIds;
    } catch (err) {
      console.error('Fehler beim Laden der Mitglieder Check-ins:', err);
      setMemberCheckedInCourses([]);
      return [];
    }
  };

  // Filter members based on search - nur für Suche, nicht für Klick
  const filteredMembers = members.filter(member => 
    member.vorname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.nachname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check if member is already checked in
  const isCheckedIn = (memberId) => {
    return todayCheckins.some(checkin => 
      checkin.mitglied_id === memberId && 
      (checkin.status === 'active' || checkin.status === 'completed')
    );
  };

  // Member selection - Check-in oder Verkauf je nach Status
  const selectMemberFromSearch = async (member) => {
    const checkedIn = isCheckedIn(member.mitglied_id);

    if (checkedIn) {
      // Bereits eingechecktes Mitglied → Verkauf öffnen
      startVerkauf(member);
    } else {
      // Nicht eingechecktes Mitglied → normaler Check-in Prozess
      setSelectedMember(member);
      setSelectedCourses([]);
      setStep(2);
      setError('');
      setSuccess('');
      setSearchTerm(''); // Suche zurücksetzen nach Auswahl

      // Lade bereits eingecheckte Kurse für dieses Mitglied
      await loadMemberCheckins(member.mitglied_id);

      setShowCheckinModal(true); // Modal öffnen

      // Nach oben scrollen wenn Modal öffnet
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
    }
  };

  // Verkauf starten
  const startVerkauf = (member) => {
    setVerkaufKunde(member);
    setShowVerkauf(true);
  };

  // Verkauf schließen
  const closeVerkauf = () => {
    setShowVerkauf(false);
    setVerkaufKunde(null);
    
    // Fokussiere das Suchfeld nach dem Schließen des Verkaufs
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 100);
  };

  // Course selection toggle
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

  // Proceed to confirmation
  const proceedToConfirmation = () => {
    if (selectedCourses.length === 0) {
      setError('Bitte mindestens einen Kurs auswählen');
      return;
    }
    setStep(3);
    setError('');
  };

  // Execute check-out all
  const executeCheckoutAll = async () => {
    if (todayCheckins.length === 0) return;
    
    setLoading(true);
    
    try {
      // Alle Check-ins parallel auschecken
      const checkoutPromises = todayCheckins.map(checkin =>
        fetch(`${API_BASE}/api/checkin/checkout`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ checkin_id: checkin.checkin_id })
        })
      );

      const responses = await Promise.all(checkoutPromises);
      
      // Prüfen ob alle erfolgreich waren
      const failedCheckouts = responses.filter(response => !response.ok);
      
      if (failedCheckouts.length > 0) {
        throw new Error(`${failedCheckouts.length} Check-outs fehlgeschlagen`);
      }
      
      const personenCount = aggregateCheckinsByMember(todayCheckins).length;
      setSuccess(`✅ Alle ${personenCount} Personen erfolgreich ausgecheckt!`);
      
      // Daten neu laden
      setTimeout(async () => {
        try {
          await loadTodayCheckins();
          setSuccess('');
        } catch (err) {
          console.error('Fehler beim Neuladen der Check-ins:', err);
        }
      }, 2000);
      
    } catch (err) {
      console.error('Checkout All Fehler:', err);
      setError('Fehler beim Auschecken aller Personen: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Execute check-out
  const executeCheckout = async (checkinId, memberName) => {
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE}/api/checkin/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ checkin_id: checkinId })
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
      setSuccess(`✅ ${memberName} erfolgreich ausgecheckt!`);
      
      // Daten neu laden
      setTimeout(async () => {
        try {
          await loadTodayCheckins();
          setSuccess('');
        } catch (err) {
          console.error('Fehler beim Neuladen der Check-ins:', err);
        }
      }, 2000);
      
    } catch (err) {
      console.error('Checkout Fehler:', err);
      setError('Checkout Fehler: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Execute check-in
  const executeCheckin = async () => {
    setLoading(true);
    setError('');
    
    try {
      const requestBody = {
        mitglied_id: selectedMember.mitglied_id,
        stundenplan_ids: selectedCourses.map(c => c.stundenplan_id),
        checkin_method: 'touch'
      };

      const response = await fetch(`${API_BASE}/api/checkin/multi-course`, {
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
      const successMessage = result.message || `Check-in erfolgreich für ${selectedMember.vorname} ${selectedMember.nachname}!`;
      setSuccess(`✅ ${successMessage}`);

      // Modal sofort schließen und Workflow zurücksetzen
      resetWorkflow();
      
      // Daten im Hintergrund neu laden für Statistik-Update
      setTimeout(async () => {
        try {
          await Promise.all([
            loadTodayCheckins(),
            loadCoursesToday()
          ]);
          setSuccess('');
        } catch (err) {
          console.error('Fehler beim Neuladen der Daten:', err);
        }
      }, 1000);
      
    } catch (err) {
      console.error('Check-in Fehler:', err);
      setError('Check-in Fehler: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset workflow
  const resetWorkflow = () => {
    setStep(1);
    setSelectedMember(null);
    setSelectedCourses([]);
    setMemberCheckedInCourses([]); // Eingecheckte Kurse zurücksetzen
    setError('');
    setSuccess('');
    setSearchTerm('');
    setShowCheckinModal(false); // Modal schließen
    
    // Fokussiere das Suchfeld nach dem Reset
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 150);
  };

  // Modal schließen
  const closeCheckinModal = () => {
    setShowCheckinModal(false);
    resetWorkflow();
  };

  // Get belt color CSS class
  const getBeltColorClass = (gurtfarbe) => {
    const colors = {
      'Weiß': 'belt-weiss',
      'Gelb': 'belt-gelb',
      'Orange': 'belt-orange',
      'Grün': 'belt-gruen',
      'Blau': 'belt-blau',
      'Braun': 'belt-braun',
      'Schwarz': 'belt-schwarz',
      'Rot': 'belt-rot'
    };
    return colors[gurtfarbe] || 'belt-weiss';
  };

  if (loading && members.length === 0) {
    return (
      <div className="checkin-system">
        <div className="loading-container">
          <div className="loading-spinner-large"></div>
          <p>Lade Check-in System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="checkin-system">
      {/* Header */}
      <div className="checkin-header">
        <div className="checkin-header-content">
          <div className="step-header">
            <div className="checkin-logo">
              <CheckCircle size={24} />
            </div>
            <div>
              <h1 className="checkin-title">Check-in Terminal</h1>
              <div className="checkin-subtitle">
                <span>Schritt {step} von 3</span>
                <span>•</span>
                <span>{new Date().toLocaleDateString('de-DE', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</span>
              </div>
            </div>
          </div>
          
          <div className="header-actions">
            {/* Progress Indicator */}
            <div className="progress-indicator">
              {[1, 2, 3].map(num => (
                <div key={num}>
                  <div className={`progress-step ${
                    step > num ? 'completed' : step === num ? 'active' : 'inactive'
                  }`}>
                    {step > num ? <Check size={16} /> : num}
                  </div>
                  {num < 3 && <div className={`progress-line ${step > num ? 'completed' : 'inactive'}`} />}
                </div>
              ))}
            </div>
            
            {/* Reset Button */}
            {step > 1 && (
              <button onClick={resetWorkflow} className="btn btn-secondary">
                ← Zurück zum Start
              </button>
            )}
          </div>
        </div>
        
        {/* Today's Stats im Header - Dashboard-Style */}
        <div className="stats-container">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-content">
                <span className="stat-icon">👥</span>
                <span className="stat-value">{members.length}</span>
              </div>
              <div className="stat-label">Mitglieder</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-content">
                <CheckCircle size={18} className="stat-icon-lucide" />
                <span className="stat-value">{todayCheckins.length}</span>
              </div>
              <div className="stat-label">Check-ins heute</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-content">
                <Calendar size={18} className="stat-icon-lucide" />
                <span className="stat-value">{coursesToday.length}</span>
              </div>
              <div className="stat-label">Kurse heute</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-content">
                <Clock size={18} className="stat-icon-lucide" />
                <span className="stat-value">
                  {new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="stat-label">Uhrzeit</div>
            </div>
          </div>
        </div>
      </div>

      <div className="checkin-container compact">
        {/* Success/Error Messages */}
        {success && (
          <div className="message success">
            <CheckCircle size={24} />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="message error">
            <X size={24} />
            <span>{error}</span>
          </div>
        )}

        {/* 2-Spalten Layout */}
        <div className="checkin-main-layout">
          {/* Linke Spalte: Suche + Mitglieder */}
          <div className="checkin-left-column">
            {/* Step 1: Member Selection via Search - immer sichtbar */}
          <div className="fade-in">
            {/* Search */}
            <div className="search-container compact">
              <Search className="search-icon" size={24} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Mitglied suchen und auswählen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              {searchTerm && (
                <X 
                  className="search-clear" 
                  size={24}
                  onClick={() => setSearchTerm('')}
                />
              )}
            </div>

            {/* Search Results - nur wenn gesucht wird */}
            {searchTerm && (
              <div className="search-results">
                <h3>
                  <Search size={20} />
                  Suchergebnisse für "{searchTerm}" ({filteredMembers.length})
                </h3>
                
                <div className="member-grid">
                  {filteredMembers.map(member => {
                    const checkedIn = isCheckedIn(member.mitglied_id);
                    
                    return (
                      <div
                        key={member.mitglied_id}
                        onClick={() => selectMemberFromSearch(member)}
                        className={`member-card clickable ${checkedIn ? 'checked-in' : ''}`}
                      >
                        <div className="member-card-content">
                          {/* Avatar: Foto oder Initialen */}
                          {member.foto_pfad ? (
                            <img
                              src={`http://localhost:3002/${member.foto_pfad}`}
                              alt={`${member.vorname} ${member.nachname}`}
                              className="member-avatar"
                              style={{ borderRadius: '0.5rem', objectFit: 'cover' }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="member-avatar">
                              {member.vorname?.charAt(0)}{member.nachname?.charAt(0)}
                            </div>
                          )}
                          
                          {/* Name */}
                          <h3 className="member-name">{member.vorname}</h3>
                          <p className="member-surname">{member.nachname}</p>
                          
                          {/* Belt */}
                          {member.gurtfarbe && (
                            <div className={`member-belt ${getBeltColorClass(member.gurtfarbe)}`}>
                              {member.gurtfarbe}
                            </div>
                          )}
                          
                          {/* Status */}
                          <div className={`member-status ${checkedIn ? 'checked-in' : 'available'}`}>
                            {checkedIn ? (
                              <>
                                <CheckCircle size={20} />
                                <span>Bereits angemeldet</span>
                              </>
                            ) : (
                              <>
                                <ArrowRight size={20} />
                                <span>Auswählen</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredMembers.length === 0 && (
                  <div className="empty-state">
                    <User className="empty-state-icon" size={80} />
                    <h3>Kein Mitglied gefunden</h3>
                    <p>Versuchen Sie einen anderen Suchbegriff</p>
                  </div>
                )}
              </div>
            )}
          </div>
          </div>

          {/* Rechte Spalte: Heutige Check-ins */}
          <div className="checkin-right-column">
            {/* Today's Check-ins - Smaller Cards */}
            {aggregatedTodayCheckins.length > 0 && (
          <div className="checkins-list-container">
            <div className="checkins-header">
              <h3>
                <CheckCircle size={24} />
                Heute eingecheckt ({aggregatedTodayCheckins.length})
              </h3>
              <button
                onClick={executeCheckoutAll}
                disabled={loading}
                className="checkout-all-btn"
                title="Alle Personen auschecken"
              >
                <X size={16} />
                Alle Auschecken
              </button>
            </div>

            {/* Kleinere Card Grid für eingecheckte Personen */}
            <div className="member-grid compact">
              {aggregatedTodayCheckins.map((checkin) => {
                const primaryCheckin = checkin.primaryCheckin || checkin.checkins?.[0];
                const checkoutTargetId = primaryCheckin?.checkin_id;
                const checkoutName = checkin.full_name || `${checkin.vorname || ""} ${checkin.nachname || ""}`.trim();
                return (
                  <div 
                  key={checkin.mitglied_id || checkoutTargetId} 
                  className="member-card checked-in-card compact clickable"
                  onClick={() => startVerkauf({
                    mitglied_id: checkin.mitglied_id,
                    vorname: checkin.vorname,
                    nachname: checkin.nachname,
                    mitgliedsnummer: checkin.mitgliedsnummer
                  })}
                >
                  <div className="member-card-content">
                    {/* Avatar kleiner: Foto oder Initialen */}
                    {checkin.foto_pfad ? (
                      <img
                        src={`http://localhost:3002/${checkin.foto_pfad}`}
                        alt={`${checkin.vorname} ${checkin.nachname}`}
                        className="member-avatar small"
                        style={{ borderRadius: '0.5rem', objectFit: 'cover' }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="member-avatar small">
                        {checkin.vorname?.charAt(0)}{checkin.nachname?.charAt(0)}
                      </div>
                    )}
                    
                    {/* Name nebeneinander */}
                    <div className="member-name-row">
                      <span className="member-firstname">{checkin.vorname} </span>
                      <span className="member-lastname">{checkin.nachname}</span>
                    </div>
                    
                    {/* Belt kompakter */}
                    {checkin.gurtfarbe && (
                      <div className={`member-belt compact ${getBeltColorClass(checkin.gurtfarbe)}`}>
                        {checkin.gurtfarbe}
                      </div>
                    )}
                    
                    {/* Kursliste */}
                    {checkin.kurse?.length > 0 && (
                      <div className="checkin-course-tags">
                        {checkin.kurse.map((kurs) => (
                          <span key={kurs.checkin_id} className="checkin-course-tag">
                            <span className="name">{kurs.kurs_name || 'Kurs'}</span>
                            {kurs.checkin_time && (
                              <span className="zeit">
                                {new Date(kurs.checkin_time).toLocaleTimeString('de-DE', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Check-in Info kompakter */}
                    <div className="checkin-info-card compact">
                      <div className="checkin-time-display compact">
                        <Clock size={14} />
                        <span>
                          {primaryCheckin?.checkin_time
                            ? new Date(primaryCheckin.checkin_time).toLocaleTimeString('de-DE', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : '--:--'}
                        </span>
                      </div>
                      <div className="checkin-duration-display compact">
                        {primaryCheckin?.minutes_since_checkin != null
                          ? `vor ${primaryCheckin.minutes_since_checkin} Min.`
                          : ''}
                      </div>
                    </div>
                    
                    {/* Status & Actions kompakter */}
                    <div className="member-actions compact">
                      <div className="member-status checked-in compact">
                        <CheckCircle size={16} />
                        <span>
                          {checkin.kurse?.length || 0} Kurs
                          {checkin.kurse?.length === 1 ? '' : 'e'}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (checkoutTargetId) {
                            executeCheckout(checkoutTargetId, checkoutName);
                          }
                        }}
                        disabled={loading || !checkoutTargetId}
                        className="member-status checkout-status compact"
                        title="Auschecken"
                      >
                        <X size={16} />
                        <span>Auschecken</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
      
      {/* Check-in Modal (Steps 2 & 3) */}
      {showCheckinModal && selectedMember && (
        <div className="checkin-modal-overlay" onClick={closeCheckinModal}>
          <div className="checkin-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="checkin-modal-header">
              <div className="checkin-modal-title">
                <User size={24} />
                Check-in für {selectedMember.vorname} {selectedMember.nachname}
              </div>
              <button className="checkin-modal-close" onClick={closeCheckinModal}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="checkin-modal-body">
              {/* Step 2: Course Selection */}
              {step === 2 && (
                <div>
                  <h3>
                    <Calendar size={20} />
                    Verfügbare Kurse heute
                  </h3>

                  {coursesToday.filter(course => !memberCheckedInCourses.includes(course.stundenplan_id)).length === 0 ? (
                    <div className="empty-state">
                      <CheckCircle className="empty-state-icon" size={80} />
                      <h3>Bereits für alle Kurse eingecheckt</h3>
                      <p>Sie sind heute bereits für alle verfügbaren Kurse eingecheckt.</p>
                    </div>
                  ) : (
                    <div className="course-grid">
                      {coursesToday
                        .filter(course => !memberCheckedInCourses.includes(course.stundenplan_id))
                        .map(course => {
                          const isSelected = selectedCourses.some(c => c.stundenplan_id === course.stundenplan_id);
                          const isFull = course.is_full;

                          return (
                            <div
                              key={course.stundenplan_id}
                              onClick={() => !isFull && toggleCourse(course)}
                              className={`course-card ${isSelected ? 'selected' : isFull ? 'full' : ''}`}
                            >
                              <div className="course-card-header">
                                <div className="course-info">
                                  <h4 className="course-name">{course.kurs_name}</h4>
                                  <div className="course-details">
                                    <span className="course-time">
                                      <Clock size={14} />
                                      {course.zeit}
                                    </span>
                                    <span>•</span>
                                    <span>{course.stil}</span>
                                  </div>
                                </div>

                                <div className={`selection-indicator ${isFull ? 'full' : isSelected ? 'selected' : 'unselected'}`}>
                                  {isFull ? <X size={18} /> : isSelected ? <Check size={18} /> : <Plus size={18} />}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  <div className="action-buttons" style={{marginTop: '1rem'}}>
                    <button onClick={closeCheckinModal} className="btn btn-secondary">
                      Abbrechen
                    </button>
                    <button onClick={() => setStep(3)} disabled={selectedCourses.length === 0} className="btn btn-primary">
                      Weiter →
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Confirmation */}
              {step === 3 && (
                <div className="confirmation-container">
                  <div className="confirmation-title">Check-in bestätigen</div>
                  <div className="confirmation-subtitle">
                    {selectedCourses.length} Kurs{selectedCourses.length !== 1 ? 'e' : ''} ausgewählt
                  </div>

                  <div className="course-summary">
                    {selectedCourses.map((course, index) => (
                      <div key={index} className="course-summary-item">
                        <span>{course.kurs_name}</span>
                        <span>{course.zeit}</span>
                      </div>
                    ))}
                  </div>

                  <div className="action-buttons">
                    <button onClick={() => setStep(2)} className="btn btn-secondary">
                      ← Zurück
                    </button>
                    <button onClick={executeCheckin} disabled={loading} className="btn btn-success btn-large">
                      {loading ? 'Lädt...' : 'Jetzt anmelden!'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Verkauf Modal */}
      {showVerkauf && verkaufKunde && (
        <VerkaufKasse
          kunde={verkaufKunde}
          onClose={closeVerkauf}
        />
      )}
    </div>
  );
};

export default CheckinSystem;