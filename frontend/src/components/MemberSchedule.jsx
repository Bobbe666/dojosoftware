import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, User, AlertCircle, List, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config.js';
import MemberHeader from './MemberHeader.jsx';
import '../styles/components.css';
import '../styles/themes.css';
import '../styles/MemberSchedule.css';

const MemberSchedule = () => {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState([]);
  const [pastSchedule, setPastSchedule] = useState([]); // Vergangene Termine
  const [fullStundenplan, setFullStundenplan] = useState([]); // Kompletter Stundenplan für Kalenderansicht
  const [memberEvents, setMemberEvents] = useState([]); // Einmalige Events (Weißwurstfrühstück etc.)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' oder 'calendar'
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [memberData, setMemberData] = useState(null);
  const [calendarFilter, setCalendarFilter] = useState('all'); // 'all', 'my-courses', 'other-courses'

  useEffect(() => {
    if (user?.mitglied_id) {
      loadSchedule();
    }
  }, [user?.mitglied_id]);

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const mitgliedId = user.mitglied_id;
      const API_BASE = config.apiBaseUrl;

      // 1. Lade kommende Termine (Listenansicht)
      const termineResponse = await fetchWithAuth(`${API_BASE}/stundenplan/member/${mitgliedId}/termine`);
      if (termineResponse.ok) {
        const termineData = await termineResponse.json();
        setSchedule(termineData);
      }

      // 2. Lade kompletten Stundenplan (Kalenderansicht)
      const stundenplanResponse = await fetchWithAuth(`${API_BASE}/stundenplan`);
      let stundenplanData = [];
      if (stundenplanResponse.ok) {
        stundenplanData = await stundenplanResponse.json();
        setFullStundenplan(stundenplanData);
      }

      // 3. Lade einmalige Events (Weißwurstfrühstück, Turniere, etc.)
      const eventsResponse = await fetchWithAuth(`${API_BASE}/events/member/${mitgliedId}`);
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        setMemberEvents(eventsData.events || []);
      }

      // 4. Lade vergangene Anwesenheiten
      const anwesenheitResponse = await fetchWithAuth(`${API_BASE}/anwesenheit/${mitgliedId}`);

      // Konvertiere Anwesenheitsdaten zu Termin-Format (nur die letzten 20)
      const anwesenheitData = anwesenheitResponse.ok ? await anwesenheitResponse.json() : [];
      const pastTermine = (Array.isArray(anwesenheitData) ? anwesenheitData : [])
        .filter(a => a.anwesend === 1 || a.anwesend === true)
        .sort((a, b) => new Date(b.datum) - new Date(a.datum))
        .slice(0, 20)
        .map(a => {
          // Finde den zugehörigen Kurs im Stundenplan
          const kurs = stundenplanData.find(k => k.id === a.stundenplan_id);
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
      setError('⚔️ Der Stundenplan hat gerade einen Sparring-Zweikampf mit dem Server - wir schreiten ein!');
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

    // 5. Einmalige Events für diesen Tag
    const eventItems = memberEvents
      .filter(e => {
        if (!e.datum) return false;
        const eDatum = e.datum.substring(0, 10);
        return eDatum === dateString;
      })
      .map(e => ({
        id: `event-${e.event_id}`,
        title: e.titel,
        zeit: e.uhrzeit_beginn
          ? e.uhrzeit_beginn.slice(0, 5) + (e.uhrzeit_ende ? ` - ${e.uhrzeit_ende.slice(0, 5)}` : '')
          : '',
        raum: e.ort || '',
        typ: 'event',
        isMemberCourse: e.ist_angemeldet === 1,
        stil: e.event_typ || 'Event'
      }));

    return [...regularEvents, ...eventItems];
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
        <div className="dashboard-content">
          <div className="ms-loading-center">
            <div className="loading-spinner ms-spinner"></div>
            <p>Lade Termine...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-content">
          <div className="ms-error-box">
            <div className="ms-error-emoji">⚔️</div>
            <h3 className="ms-error-heading">{error}</h3>
            <button
              onClick={loadSchedule}
              className="ms-error-retry-btn"
            >
              🔄 Nochmal versuchen
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <MemberHeader />
      <div className="dashboard-content ms-content-wrapper">
        <div className="ms-inner">
          {/* Header */}
          <div className="ms-header-section">
            <div className="ms-header-row">
              <div className="u-flex-row-lg">
                <Calendar size={32} className="u-text-accent" />
                <h1 className="ms-heading-primary">Meine Termine</h1>
              </div>

              {/* View Toggle */}
              <div className="u-flex-gap-sm">
                <button
                  onClick={() => setViewMode('list')}
                  className={`ms-view-btn${viewMode === 'list' ? ' ms-view-btn--active' : ''}`}
                >
                  <List size={18} />
                  Liste
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`ms-view-btn${viewMode === 'calendar' ? ' ms-view-btn--active' : ''}`}
                >
                  <CalendarDays size={18} />
                  Kalender
                </button>
              </div>
            </div>
            <p className="ms-header-subtitle">
              Hier findest du alle deine geplanten Trainings und Prüfungen
            </p>
          </div>

          {/* Legende/Filter für Kalenderansicht */}
          {viewMode === 'calendar' && (
            <div className="ms-filter-bar">
              <div className="ms-filter-label">Filter:</div>

              {/* Alle Kurse */}
              <button
                onClick={() => setCalendarFilter('all')}
                className={`ms-filter-btn${calendarFilter === 'all' ? ' ms-filter-btn--active' : ''}`}
              >
                <div className="ms-swatch ms-swatch-all"></div>
                <span>Alle Kurse</span>
              </button>

              {/* Deine Kurse */}
              <button
                onClick={() => setCalendarFilter('my-courses')}
                className={`ms-filter-btn${calendarFilter === 'my-courses' ? ' ms-filter-btn--active' : ''}`}
              >
                <div className="ms-swatch ms-swatch-mine"></div>
                <span>✓ Deine Kurse</span>
              </button>

              {/* Andere Kurse */}
              <button
                onClick={() => setCalendarFilter('other-courses')}
                className={`ms-filter-btn${calendarFilter === 'other-courses' ? ' ms-filter-btn--active' : ''}`}
              >
                <div className="ms-swatch ms-swatch-other"></div>
                <span>• Andere Kurse</span>
              </button>
            </div>
          )}

          {/* Kalender oder Listen-Ansicht */}
          {viewMode === 'calendar' ? (
            renderCalendarView()
          ) : (
            <div className="ms-column-layout">

              {/* Einmalige Events (Turniere, Lehrgänge, etc.) */}
              {memberEvents.length > 0 && (
                <div className="ms-section-mb">
                  <h2 className="ms-section-heading">
                    <Calendar size={22} /> Besondere Events
                  </h2>
                  <div className="u-flex-col-md">
                    {memberEvents.map(event => {
                      const eventTypeIcons = { 'Turnier': '🏆', 'Lehrgang': '👥', 'Prüfung': '🥋', 'Seminar': '📚', 'Workshop': '🎯', 'Feier': '🎉', 'Sonstiges': '📅' };
                      const icon = eventTypeIcons[event.event_typ] || '📅';
                      return (
                        <div key={event.event_id} className={`ms-event-card${event.ist_angemeldet ? ' ms-event-card--angemeldet' : ''}`}>
                          <div className="ms-event-icon-box">
                            {icon}
                          </div>
                          <div className="u-flex-1">
                            <div className="ms-card-header-sm">
                              <h3 className="ms-card-title-sm">{event.titel}</h3>
                              {event.ist_angemeldet ? (
                                <span className="ms-badge-success">✓ Angemeldet</span>
                              ) : (
                                <span className="ms-badge-primary">Anmelden →</span>
                              )}
                            </div>
                            <div className="ms-meta-group">
                              <div className="ms-meta-row-sm">
                                <Calendar size={14} className="u-text-accent" />
                                {new Date(event.datum).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                              </div>
                              {event.uhrzeit_beginn && (
                                <div className="ms-meta-row-sm">
                                  <Clock size={14} className="u-text-accent" />
                                  {event.uhrzeit_beginn.slice(0, 5)}{event.uhrzeit_ende ? ` – ${event.uhrzeit_ende.slice(0, 5)}` : ''} Uhr
                                </div>
                              )}
                              {event.ort && (
                                <div className="ms-meta-row-sm">
                                  <MapPin size={14} className="u-text-accent" />
                                  {event.ort}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Reguläre Trainingstermine */}
              {schedule.length === 0 && memberEvents.length === 0 ? (
                <div className="ms-empty-state">
                  <AlertCircle size={48} className="ms-empty-icon" />
                  <h3 className="ms-empty-heading">Keine Termine gefunden</h3>
                  <p className="u-text-secondary">Du hast aktuell keine geplanten Termine.</p>
                </div>
              ) : schedule.length > 0 ? (
                <>
                  {memberEvents.length > 0 && <h2 className="ms-section-heading"><Calendar size={22} /> Reguläre Trainingstermine</h2>}
                  {schedule
                  .sort((a, b) => new Date(a.datum) - new Date(b.datum))
                  .map(termin => (
                    <div key={termin.id} className={`ms-training-card${termin.typ === 'prüfung' ? ' ms-training-card--pruefung' : ''}`}>
                      {/* Icon */}
                      <div className={`ms-training-icon-box${termin.typ === 'prüfung' ? ' ms-training-icon-box--pruefung' : ''}`}>
                        {termin.typ === 'prüfung' ? '🏆' : '🥋'}
                      </div>

                      {/* Content */}
                      <div className="u-flex-1">
                        <div className="ms-card-header">
                          <div>
                            <h3 className="ms-card-title">
                              {termin.title}
                            </h3>
                            <span className={`ms-status-badge${termin.status === 'bestätigt' ? ' ms-status-badge--bestaetigt' : ' ms-status-badge--angemeldet'}`}>
                              {termin.status === 'bestätigt' ? '✓ Bestätigt' : '⏳ Angemeldet'}
                            </span>
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="ms-details-grid">
                          <div className="ms-meta-row">
                            <Calendar size={16} className="u-text-accent" />
                            <span>{formatDate(termin.datum)}</span>
                          </div>
                          <div className="ms-meta-row">
                            <Clock size={16} className="u-text-accent" />
                            <span>{termin.zeit}</span>
                          </div>
                          <div className="ms-meta-row">
                            <MapPin size={16} className="u-text-accent" />
                            <span>{termin.raum}</span>
                          </div>
                          <div className="ms-meta-row">
                            <User size={16} className="u-text-accent" />
                            <span>{termin.trainer}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                  }
                </>
              ) : null}

              {/* Vergangene Termine - nur in Listenansicht */}
              {pastSchedule.length > 0 && (
                <div className="ms-past-section">
                  <div className="ms-past-header">
                    <Calendar size={28} className="ms-icon-primary-alpha" />
                    <h2 className="ms-heading-primary">Meine vergangenen Termine</h2>
                  </div>
                  <div className="u-flex-col-md">
                    {pastSchedule.map(termin => (
                      <div key={termin.id} className="ms-past-card"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0.8';
                        e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.15)';
                      }}>
                        {/* Kleines Icon */}
                        <div className="ms-past-icon-box">
                          ✓
                        </div>

                        {/* Content */}
                        <div className="u-flex-1">
                          <div className="ms-card-header-center">
                            <h4 className="ms-card-title-xs">
                              {termin.title}
                            </h4>
                            <span className="ms-badge-absolviert">
                              ✓ Absolviert
                            </span>
                          </div>

                          {/* Details */}
                          <div className="ms-past-details-row">
                            <div className="ms-meta-row-sm">
                              <Calendar size={14} className="ms-icon-primary-alpha" />
                              <span>{formatDate(termin.datum)}</span>
                            </div>
                            {termin.zeit && (
                              <div className="ms-meta-row-sm">
                                <Clock size={14} className="ms-icon-primary-alpha" />
                                <span>{termin.zeit}</span>
                              </div>
                            )}
                            <div className="ms-meta-row-sm">
                              <MapPin size={14} className="ms-icon-primary-alpha" />
                              <span>{termin.raum}</span>
                            </div>
                            <div className="ms-meta-row-sm">
                              <User size={14} className="ms-icon-primary-alpha" />
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
