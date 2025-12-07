import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, AlertCircle, CheckCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import axios from 'axios';
import MemberHeader from './MemberHeader.jsx';
import '../styles/components.css';
import '../styles/themes.css';

const MemberEvents = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [memberData, setMemberData] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // event_id während Anmeldung/Abmeldung

  useEffect(() => {
    if (user?.email) {
      loadMemberDataAndEvents();
    }
  }, [user?.email]);

  const loadMemberDataAndEvents = async () => {
    setLoading(true);
    try {
      // 1. Lade Mitgliedsdaten
      const memberResponse = await axios.get(`/mitglieder/by-email/${encodeURIComponent(user.email)}`);
      const memberData = memberResponse.data;
      setMemberData(memberData);

      // 2. Lade Events mit Anmeldestatus
      const eventsResponse = await axios.get(`/events/member/${memberData.mitglied_id}`);
      setEvents(eventsResponse.data.events || []);
    } catch (error) {
      console.error('Fehler beim Laden der Events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnmelden = async (eventId) => {
    if (!memberData) return;

    setActionLoading(eventId);
    try {
      const response = await axios.post(`/events/${eventId}/anmelden`, {
        mitglied_id: memberData.mitglied_id
      });

      if (response.data.success) {
        alert('✅ ' + response.data.message);
        loadMemberDataAndEvents(); // Neu laden um Status zu aktualisieren
      }
    } catch (error) {
      console.error('Fehler bei Event-Anmeldung:', error);
      alert('❌ ' + (error.response?.data?.error || 'Fehler bei der Anmeldung'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAbmelden = async (eventId) => {
    if (!memberData) return;

    if (!window.confirm('Möchten Sie sich wirklich von diesem Event abmelden?')) {
      return;
    }

    setActionLoading(eventId);
    try {
      const response = await axios.delete(`/events/${eventId}/anmelden`, {
        data: { mitglied_id: memberData.mitglied_id }
      });

      if (response.data.success) {
        alert('✅ ' + response.data.message);
        loadMemberDataAndEvents(); // Neu laden um Status zu aktualisieren
      }
    } catch (error) {
      console.error('Fehler bei Event-Abmeldung:', error);
      alert('❌ ' + (error.response?.data?.error || 'Fehler bei der Abmeldung'));
    } finally {
      setActionLoading(null);
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

  const formatTime = (timeString) => {
    if (!timeString) return '';
    return timeString.slice(0, 5); // HH:MM
  };

  const getEventTypeIcon = (typ) => {
    const icons = {
      'Seminar': '📚',
      'Wettkampf': '🏆',
      'Prüfung': '🥋',
      'Workshop': '🎯',
      'Lehrgang': '👥',
      'Sonstiges': '📅'
    };
    return icons[typ] || '📅';
  };

  const getEventTypeColor = (typ) => {
    const colors = {
      'Seminar': '#10B981',
      'Wettkampf': '#F59E0B',
      'Prüfung': '#8B5CF6',
      'Workshop': '#06B6D4',
      'Lehrgang': '#EF4444',
      'Sonstiges': '#6B7280'
    };
    return colors[typ] || '#6B7280';
  };

  if (loading) {
    return (
      <div className="member-page">
        <MemberHeader />
        <div className="page-content" style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Lade Events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="member-page">
      <MemberHeader />

      <div className="page-content" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div className="page-header" style={{ marginBottom: '2rem' }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#FFD700' }}>
            <Calendar size={32} />
            Veranstaltungen & Events
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)', marginTop: '0.5rem' }}>
            Melden Sie sich für kommende Events an
          </p>
        </div>

        {events.length === 0 ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 215, 0, 0.2)',
            borderRadius: '12px',
            padding: '3rem',
            textAlign: 'center'
          }}>
            <Calendar size={48} style={{ color: 'rgba(255, 215, 0, 0.5)', margin: '0 auto 1rem' }} />
            <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.1rem' }}>
              Derzeit sind keine Events geplant.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {events.map(event => (
              <div
                key={event.event_id}
                style={{
                  background: 'linear-gradient(135deg, rgba(30, 30, 40, 0.9) 0%, rgba(20, 20, 30, 0.9) 100%)',
                  border: `1px solid ${event.ist_angemeldet ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 215, 0, 0.2)'}`,
                  borderRadius: '16px',
                  padding: '1.5rem',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Event-Typ Badge */}
                <div style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: getEventTypeColor(event.event_typ),
                  color: '#fff',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span>{getEventTypeIcon(event.event_typ)}</span>
                  {event.event_typ}
                </div>

                {/* Event Titel */}
                <h3 style={{
                  color: '#FFD700',
                  fontSize: '1.5rem',
                  marginBottom: '1rem',
                  paddingRight: '150px'
                }}>
                  {event.titel}
                </h3>

                {/* Event Details Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Calendar size={18} style={{ color: '#FFD700' }} />
                    <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                      {formatDate(event.datum)}
                    </span>
                  </div>

                  {event.uhrzeit_beginn && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Clock size={18} style={{ color: '#FFD700' }} />
                      <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                        {formatTime(event.uhrzeit_beginn)} - {formatTime(event.uhrzeit_ende)}
                      </span>
                    </div>
                  )}

                  {event.ort && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <MapPin size={18} style={{ color: '#FFD700' }} />
                      <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                        {event.ort} {event.raum_name ? `(${event.raum_name})` : ''}
                      </span>
                    </div>
                  )}

                  {event.max_teilnehmer && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Users size={18} style={{ color: '#FFD700' }} />
                      <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                        {event.anzahl_anmeldungen || 0} / {event.max_teilnehmer} Teilnehmer
                      </span>
                    </div>
                  )}
                </div>

                {/* Beschreibung */}
                {event.beschreibung && (
                  <p style={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    marginBottom: '1.5rem',
                    lineHeight: '1.6'
                  }}>
                    {event.beschreibung}
                  </p>
                )}

                {/* Teilnahmegebühr */}
                {event.teilnahmegebuehr && parseFloat(event.teilnahmegebuehr) > 0 && (
                  <div style={{
                    background: 'rgba(255, 215, 0, 0.1)',
                    border: '1px solid rgba(255, 215, 0, 0.2)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    marginBottom: '1.5rem'
                  }}>
                    <strong style={{ color: '#FFD700' }}>Teilnahmegebühr:</strong>{' '}
                    <span style={{ color: '#fff' }}>{parseFloat(event.teilnahmegebuehr).toFixed(2)} €</span>
                  </div>
                )}

                {/* Anmeldestatus & Aktionen */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}>
                  {event.ist_angemeldet ? (
                    <>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '8px',
                        padding: '0.75rem 1rem',
                        color: '#10B981',
                        fontWeight: '600'
                      }}>
                        <CheckCircle size={18} />
                        Angemeldet
                      </div>
                      <button
                        onClick={() => handleAbmelden(event.event_id)}
                        disabled={actionLoading === event.event_id}
                        style={{
                          background: 'rgba(239, 68, 68, 0.2)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '8px',
                          padding: '0.75rem 1.5rem',
                          color: '#EF4444',
                          cursor: actionLoading === event.event_id ? 'not-allowed' : 'pointer',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (actionLoading !== event.event_id) {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                        }}
                      >
                        <X size={18} />
                        {actionLoading === event.event_id ? 'Wird abgemeldet...' : 'Abmelden'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleAnmelden(event.event_id)}
                      disabled={actionLoading === event.event_id || (event.max_teilnehmer && event.anzahl_anmeldungen >= event.max_teilnehmer)}
                      style={{
                        background: (event.max_teilnehmer && event.anzahl_anmeldungen >= event.max_teilnehmer)
                          ? 'rgba(107, 114, 128, 0.2)'
                          : 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.75rem 2rem',
                        color: (event.max_teilnehmer && event.anzahl_anmeldungen >= event.max_teilnehmer) ? '#9CA3AF' : '#000',
                        cursor: (actionLoading === event.event_id || (event.max_teilnehmer && event.anzahl_anmeldungen >= event.max_teilnehmer)) ? 'not-allowed' : 'pointer',
                        fontWeight: '700',
                        fontSize: '1rem',
                        transition: 'all 0.3s ease',
                        boxShadow: (event.max_teilnehmer && event.anzahl_anmeldungen >= event.max_teilnehmer) ? 'none' : '0 4px 12px rgba(255, 215, 0, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        if (actionLoading !== event.event_id && !(event.max_teilnehmer && event.anzahl_anmeldungen >= event.max_teilnehmer)) {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(255, 215, 0, 0.4)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 215, 0, 0.3)';
                      }}
                    >
                      {actionLoading === event.event_id
                        ? 'Wird angemeldet...'
                        : (event.max_teilnehmer && event.anzahl_anmeldungen >= event.max_teilnehmer)
                          ? 'Ausgebucht'
                          : 'Jetzt anmelden'}
                    </button>
                  )}

                  {/* Anmeldefrist Warnung */}
                  {event.anmeldefrist && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      color: 'rgba(255, 215, 0, 0.8)',
                      fontSize: '0.9rem'
                    }}>
                      <AlertCircle size={16} />
                      Anmeldefrist: {formatDate(event.anmeldefrist)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberEvents;
