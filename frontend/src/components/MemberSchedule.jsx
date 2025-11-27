import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, User, AlertCircle, List, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import axios from 'axios';
import MemberHeader from './MemberHeader.jsx';
import '../styles/components.css';
import '../styles/themes.css';

const MemberSchedule = () => {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState([]);
  const [pastSchedule, setPastSchedule] = useState([]); // Vergangene Termine
  const [fullStundenplan, setFullStundenplan] = useState([]); // Kompletter Stundenplan für Kalenderansicht
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' oder 'calendar'
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [memberData, setMemberData] = useState(null);
  const [calendarFilter, setCalendarFilter] = useState('all'); // 'all', 'my-courses', 'other-courses'

  useEffect(() => {
    if (user?.email) {
      loadSchedule();
    }
  }, [user?.email]);

  const loadSchedule = async () => {
    setLoading(true);
    try {
      // 1. Lade Mitgliedsdaten über Email
      const userEmail = user?.email || 'tom@example.com';
      console.log('Lade Mitgliedsdaten für Email:', userEmail);

      const memberResponse = await fetch(`/api/mitglieder/by-email/${encodeURIComponent(userEmail)}`);

      if (!memberResponse.ok) {
        throw new Error(`HTTP ${memberResponse.status}: ${memberResponse.statusText}`);
      }

      const memberData = await memberResponse.json();
      console.log('Mitgliedsdaten geladen:', memberData);
      setMemberData(memberData);

      // 2. Lade kommende Termine basierend auf Anwesenheitshistorie und Stundenplan (für Listenansicht)
      const termineResponse = await axios.get(`/stundenplan/member/${memberData.mitglied_id}/termine`);
      console.log('Termine geladen:', termineResponse.data);
      setSchedule(termineResponse.data);

      // 3. Lade kompletten Stundenplan (für Kalenderansicht)
      const stundenplanResponse = await axios.get('/stundenplan');
      console.log('Kompletter Stundenplan geladen:', stundenplanResponse.data);
      setFullStundenplan(stundenplanResponse.data);

      // 4. Lade vergangene Anwesenheiten
      const anwesenheitResponse = await axios.get(`/anwesenheit/${memberData.mitglied_id}`);
      console.log('Anwesenheitsdaten geladen:', anwesenheitResponse.data);

      // Konvertiere Anwesenheitsdaten zu Termin-Format (nur die letzten 20)
      const pastTermine = anwesenheitResponse.data
        .filter(a => a.anwesend === 1 || a.anwesend === true)
        .sort((a, b) => new Date(b.datum) - new Date(a.datum))
        .slice(0, 20)
        .map(a => {
          // Finde den zugehörigen Kurs im Stundenplan
          const kurs = stundenplanResponse.data.find(k => k.id === a.stundenplan_id);
          return {
            id: a.id,
            title: kurs?.kursname || 'Training',
            trainer: kurs ? `${kurs.trainer_vorname || ''} ${kurs.trainer_nachname || ''}`.trim() : 'Unbekannt',
            zeit: kurs ? `${kurs.uhrzeit_start} - ${kurs.uhrzeit_ende}` : '',
            datum: a.datum,
            raum: kurs?.raumname || 'Dojo',
            typ: 'training',
            status: 'abgeschlossen'
          };
        });

      setPastSchedule(pastTermine);
      console.log('Vergangene Termine erstellt:', pastTermine);
    } catch (error) {
      console.error('Fehler beim Laden des Stundenplans:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getEventsForDay = (day) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const date = new Date(year, month, day);
    const dayName = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'][date.getDay()];
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // 1. Filtere Stundenplan nach Wochentag - diese laufen regelmäßig
    const dayEvents = fullStundenplan.filter(kurs => kurs.tag === dayName);

    // 2. Prüfe, ob das Mitglied an diesem Kurs teilnimmt
    const memberStundenplanIds = [...new Set(schedule.map(s => s.stundenplan_id))];

    // 3. Konvertiere Stundenplan zu Event-Format
    let regularEvents = dayEvents.map(kurs => ({
      id: `stundenplan-${kurs.id}`,
      title: kurs.kursname || 'Kurs',
      trainer: `${kurs.trainer_vorname || ''} ${kurs.trainer_nachname || ''}`.trim() || 'Kein Trainer',
      zeit: `${kurs.uhrzeit_start} - ${kurs.uhrzeit_ende}`,
      raum: kurs.raumname || 'Kein Raum',
      typ: 'training',
      isMemberCourse: memberStundenplanIds.includes(kurs.id), // Markiere ob Mitglied teilnimmt
      stil: kurs.stil
    }));

    // 4. Wende Filter an
    if (calendarFilter === 'my-courses') {
      regularEvents = regularEvents.filter(event => event.isMemberCourse);
    } else if (calendarFilter === 'other-courses') {
      regularEvents = regularEvents.filter(event => !event.isMemberCourse);
    }
    // Wenn 'all', werden alle Events angezeigt

    return regularEvents;
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentMonth(newDate);
  };

  const renderCalendarView = () => {
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
    const days = [];
    const weekDays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

    // Leere Zellen vor dem ersten Tag
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Tage des Monats
    for (let day = 1; day <= daysInMonth; day++) {
      const events = getEventsForDay(day);
      const isToday =
        day === new Date().getDate() &&
        month === new Date().getMonth() &&
        year === new Date().getFullYear();

      days.push(
        <div key={day} className={`calendar-day ${isToday ? 'today' : ''} ${events.length > 0 ? 'has-events' : ''}`}>
          <div className="day-number">{day}</div>
          {events.length > 0 && (
            <div className="day-events-list">
              {events.map(event => (
                <div
                  key={event.id}
                  className={`calendar-event ${event.isMemberCourse ? 'member-course' : 'other-course'}`}
                  title={`${event.title}\n${event.trainer}\n${event.zeit}\n${event.raum}`}
                >
                  <div className="event-icon">{event.isMemberCourse ? '✓' : '•'}</div>
                  <div className="event-details">
                    <div className="event-name">{event.title}</div>
                    <div className="event-time">{event.zeit}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="calendar-view">
        <div className="calendar-header">
          <button onClick={() => navigateMonth(-1)} className="month-nav-btn">
            <ChevronLeft size={20} />
          </button>
          <h2>
            {currentMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
          </h2>
          <button onClick={() => navigateMonth(1)} className="month-nav-btn">
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="calendar-weekdays">
          {weekDays.map(day => (
            <div key={day} className="weekday-label">{day}</div>
          ))}
        </div>
        <div className="calendar-grid">
          {days}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <MemberHeader />
        <div className="dashboard-content">
          <div style={{ textAlign: 'center', padding: '3rem', color: '#ffd700' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 1rem', border: '3px solid rgba(255, 215, 0, 0.3)', borderTopColor: '#ffd700', width: '40px', height: '40px' }}></div>
            <p>Lade Termine...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <MemberHeader />

      <div className="dashboard-content" style={{ padding: '2rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Calendar size={32} style={{ color: '#ffd700' }} />
                <h1 style={{ color: '#ffd700', margin: 0 }}>Meine Termine</h1>
              </div>

              {/* View Toggle */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setViewMode('list')}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: viewMode === 'list' ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${viewMode === 'list' ? '#ffd700' : 'rgba(255, 215, 0, 0.2)'}`,
                    borderRadius: '8px',
                    color: viewMode === 'list' ? '#ffd700' : 'rgba(255, 255, 255, 0.7)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <List size={18} />
                  Liste
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: viewMode === 'calendar' ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${viewMode === 'calendar' ? '#ffd700' : 'rgba(255, 215, 0, 0.2)'}`,
                    borderRadius: '8px',
                    color: viewMode === 'calendar' ? '#ffd700' : 'rgba(255, 255, 255, 0.7)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <CalendarDays size={18} />
                  Kalender
                </button>
              </div>
            </div>
            <p style={{ color: 'rgba(255, 255, 255, 0.7)', margin: 0 }}>
              Hier findest du alle deine geplanten Trainings und Prüfungen
            </p>
          </div>

          {/* Legende/Filter für Kalenderansicht */}
          {viewMode === 'calendar' && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 215, 0, 0.2)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1rem',
              display: 'flex',
              gap: '1rem',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontWeight: '500' }}>Filter:</div>

              {/* Alle Kurse */}
              <button
                onClick={() => setCalendarFilter('all')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  background: calendarFilter === 'all' ? 'rgba(255, 215, 0, 0.2)' : 'transparent',
                  border: `1.5px solid ${calendarFilter === 'all' ? '#ffd700' : 'rgba(255, 215, 0, 0.2)'}`,
                  borderRadius: '8px',
                  color: calendarFilter === 'all' ? '#ffd700' : 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  fontSize: '0.9rem',
                  fontWeight: calendarFilter === 'all' ? '600' : '400'
                }}
                onMouseEnter={(e) => {
                  if (calendarFilter !== 'all') {
                    e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.4)';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (calendarFilter !== 'all') {
                    e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.2)';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                  }
                }}
              >
                <div style={{
                  width: '16px',
                  height: '16px',
                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 50%, rgba(255, 255, 255, 0.05) 50%)',
                  border: '2px solid rgba(255, 215, 0, 0.5)',
                  borderRadius: '4px'
                }}></div>
                <span>Alle Kurse</span>
              </button>

              {/* Deine Kurse */}
              <button
                onClick={() => setCalendarFilter('my-courses')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  background: calendarFilter === 'my-courses' ? 'rgba(255, 215, 0, 0.2)' : 'transparent',
                  border: `1.5px solid ${calendarFilter === 'my-courses' ? '#ffd700' : 'rgba(255, 215, 0, 0.2)'}`,
                  borderRadius: '8px',
                  color: calendarFilter === 'my-courses' ? '#ffd700' : 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  fontSize: '0.9rem',
                  fontWeight: calendarFilter === 'my-courses' ? '600' : '400'
                }}
                onMouseEnter={(e) => {
                  if (calendarFilter !== 'my-courses') {
                    e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.4)';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (calendarFilter !== 'my-courses') {
                    e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.2)';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                  }
                }}
              >
                <div style={{
                  width: '16px',
                  height: '16px',
                  background: 'rgba(255, 215, 0, 0.2)',
                  border: '2px solid #ffd700',
                  borderRadius: '4px'
                }}></div>
                <span>✓ Deine Kurse</span>
              </button>

              {/* Andere Kurse */}
              <button
                onClick={() => setCalendarFilter('other-courses')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  background: calendarFilter === 'other-courses' ? 'rgba(255, 215, 0, 0.2)' : 'transparent',
                  border: `1.5px solid ${calendarFilter === 'other-courses' ? '#ffd700' : 'rgba(255, 215, 0, 0.2)'}`,
                  borderRadius: '8px',
                  color: calendarFilter === 'other-courses' ? '#ffd700' : 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  fontSize: '0.9rem',
                  fontWeight: calendarFilter === 'other-courses' ? '600' : '400'
                }}
                onMouseEnter={(e) => {
                  if (calendarFilter !== 'other-courses') {
                    e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.4)';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (calendarFilter !== 'other-courses') {
                    e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.2)';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                  }
                }}
              >
                <div style={{
                  width: '16px',
                  height: '16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '2px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px'
                }}></div>
                <span>• Andere Kurse</span>
              </button>
            </div>
          )}

          {/* Kalender oder Listen-Ansicht */}
          {viewMode === 'calendar' ? (
            renderCalendarView()
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {schedule.length === 0 ? (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 215, 0, 0.2)',
                  borderRadius: '16px',
                  padding: '3rem',
                  textAlign: 'center'
                }}>
                  <AlertCircle size={48} style={{ color: '#ffd700', margin: '0 auto 1rem' }} />
                  <h3 style={{ color: '#ffd700', marginBottom: '0.5rem' }}>Keine Termine gefunden</h3>
                  <p style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Du hast aktuell keine geplanten Termine.</p>
                </div>
              ) : (
                schedule
                  .sort((a, b) => new Date(a.datum) - new Date(b.datum))
                  .map(termin => (
                    <div key={termin.id} style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${termin.typ === 'prüfung' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 215, 0, 0.2)'}`,
                      borderRadius: '16px',
                      padding: '1.5rem',
                      display: 'flex',
                      gap: '1.5rem',
                      alignItems: 'flex-start',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.borderColor = termin.typ === 'prüfung' ? '#ef4444' : '#ffd700';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = termin.typ === 'prüfung' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 215, 0, 0.2)';
                    }}>
                      {/* Icon */}
                      <div style={{
                        fontSize: '3rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '80px',
                        height: '80px',
                        background: termin.typ === 'prüfung' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 215, 0, 0.1)',
                        borderRadius: '12px'
                      }}>
                        {termin.typ === 'prüfung' ? '🏆' : '🥋'}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                          <div>
                            <h3 style={{ color: '#ffd700', margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>
                              {termin.title}
                            </h3>
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              background: termin.status === 'bestätigt' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                              color: termin.status === 'bestätigt' ? '#10b981' : '#3b82f6',
                              borderRadius: '6px',
                              fontSize: '0.85rem',
                              fontWeight: '500'
                            }}>
                              {termin.status === 'bestätigt' ? '✓ Bestätigt' : '⏳ Angemeldet'}
                            </span>
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '1rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                            <Calendar size={16} style={{ color: '#ffd700' }} />
                            <span>{formatDate(termin.datum)}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                            <Clock size={16} style={{ color: '#ffd700' }} />
                            <span>{termin.zeit}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                            <MapPin size={16} style={{ color: '#ffd700' }} />
                            <span>{termin.raum}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                            <User size={16} style={{ color: '#ffd700' }} />
                            <span>{termin.trainer}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
              )}

              {/* Vergangene Termine - nur in Listenansicht */}
              {pastSchedule.length > 0 && (
                <div style={{ marginTop: '3rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <Calendar size={28} style={{ color: 'rgba(255, 215, 0, 0.7)' }} />
                    <h2 style={{ color: 'rgba(255, 215, 0, 0.9)', margin: 0 }}>Meine vergangenen Termine</h2>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {pastSchedule.map(termin => (
                      <div key={termin.id} style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 215, 0, 0.15)',
                        borderRadius: '12px',
                        padding: '1rem',
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'center',
                        opacity: 0.8,
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0.8';
                        e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.15)';
                      }}>
                        {/* Kleines Icon */}
                        <div style={{
                          fontSize: '2rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '50px',
                          height: '50px',
                          background: 'rgba(255, 215, 0, 0.05)',
                          borderRadius: '8px'
                        }}>
                          ✓
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <h4 style={{ color: 'rgba(255, 215, 0, 0.9)', margin: 0, fontSize: '1rem' }}>
                              {termin.title}
                            </h4>
                            <span style={{
                              padding: '0.2rem 0.6rem',
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: 'rgba(16, 185, 129, 0.9)',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: '500'
                            }}>
                              ✓ Absolviert
                            </span>
                          </div>

                          {/* Details */}
                          <div style={{
                            display: 'flex',
                            gap: '1.5rem',
                            flexWrap: 'wrap',
                            fontSize: '0.85rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                              <Calendar size={14} style={{ color: 'rgba(255, 215, 0, 0.6)' }} />
                              <span>{formatDate(termin.datum)}</span>
                            </div>
                            {termin.zeit && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                                <Clock size={14} style={{ color: 'rgba(255, 215, 0, 0.6)' }} />
                                <span>{termin.zeit}</span>
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                              <MapPin size={14} style={{ color: 'rgba(255, 215, 0, 0.6)' }} />
                              <span>{termin.raum}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                              <User size={14} style={{ color: 'rgba(255, 215, 0, 0.6)' }} />
                              <span>{termin.trainer}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .loading-spinner {
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-top: 3px solid #ffd700;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .calendar-view {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          borderRadius: 16px;
          padding: 2rem;
        }

        .calendar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2rem;
        }

        .calendar-header h2 {
          color: #ffd700;
          margin: 0;
          font-size: 1.5rem;
        }

        .month-nav-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 8px;
          padding: 0.5rem;
          color: #ffd700;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: all 0.3s ease;
        }

        .month-nav-btn:hover {
          background: rgba(255, 215, 0, 0.1);
          border-color: #ffd700;
        }

        .calendar-weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .weekday-label {
          text-align: center;
          color: #ffd700;
          font-weight: 600;
          padding: 0.5rem;
        }

        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 0.5rem;
        }

        .calendar-day {
          min-height: 120px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 215, 0, 0.1);
          border-radius: 8px;
          padding: 0.5rem;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          transition: all 0.3s ease;
          overflow-y: auto;
        }

        .calendar-day.empty {
          background: transparent;
          border: none;
          min-height: 0;
        }

        .calendar-day.today {
          background: rgba(255, 215, 0, 0.1);
          border-color: #ffd700;
        }

        .calendar-day.has-events {
          cursor: default;
        }

        .day-number {
          color: rgba(255, 255, 255, 0.9);
          font-weight: 600;
          margin-bottom: 0.5rem;
          text-align: center;
          font-size: 0.9rem;
        }

        .day-events-list {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          width: 100%;
        }

        .calendar-event {
          display: flex;
          align-items: flex-start;
          gap: 0.25rem;
          padding: 0.25rem;
          border-radius: 4px;
          font-size: 0.7rem;
          transition: all 0.2s ease;
        }

        .calendar-event.member-course {
          background: rgba(255, 215, 0, 0.2);
          border-left: 2px solid #ffd700;
        }

        .calendar-event.other-course {
          background: rgba(255, 255, 255, 0.05);
          border-left: 2px solid rgba(255, 255, 255, 0.2);
        }

        .calendar-event:hover {
          transform: scale(1.02);
          z-index: 10;
        }

        .calendar-event.member-course:hover {
          background: rgba(255, 215, 0, 0.3);
        }

        .calendar-event.other-course:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .event-icon {
          color: #ffd700;
          font-weight: bold;
          font-size: 0.8rem;
          flex-shrink: 0;
        }

        .event-details {
          flex: 1;
          overflow: hidden;
        }

        .event-name {
          color: rgba(255, 255, 255, 0.9);
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .event-time {
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.65rem;
          margin-top: 0.1rem;
        }

        @media (max-width: 768px) {
          .calendar-grid {
            gap: 0.25rem;
          }

          .calendar-day {
            padding: 0.25rem;
          }

          .day-number {
            font-size: 0.85rem;
          }

          .event-dot {
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default MemberSchedule;
