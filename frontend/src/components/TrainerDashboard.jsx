import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Calendar, Users, CheckCircle, Clock, Search, X } from 'lucide-react';
import axios from 'axios';
import '../styles/components.css';
import '../styles/themes.css';

const TrainerDashboard = () => {
  const { user, logout } = useAuth();
  const [todayCourses, setTodayCourses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState({});

  useEffect(() => {
    loadTodayCourses();
  }, []);

  const loadTodayCourses = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/checkin/courses-today');
      if (response.data.success) {
        setTodayCourses(response.data.courses || []);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Kurse:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMembersForCourse = async (course) => {
    setSelectedCourse(course);
    setLoading(true);
    try {
      // Lade alle Mitglieder
      const membersResponse = await axios.get('/mitglieder');
      const allMembers = membersResponse.data;

      // Lade heutige Anwesenheit für diesen Kurs
      const today = new Date().toISOString().split('T')[0];
      const attendanceResponse = await axios.get(`/anwesenheit?datum=${today}&stundenplan_id=${course.stundenplan_id}`);

      const attendance = {};
      if (attendanceResponse.data && Array.isArray(attendanceResponse.data)) {
        attendanceResponse.data.forEach(record => {
          attendance[record.mitglied_id] = record.anwesend;
        });
      }

      setMembers(allMembers);
      setAttendanceData(attendance);
    } catch (error) {
      console.error('Fehler beim Laden der Mitglieder:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAttendance = async (mitgliedId) => {
    if (!selectedCourse) return;

    const currentStatus = attendanceData[mitgliedId] || 0;
    const newStatus = currentStatus === 1 ? 0 : 1;

    try {
      const today = new Date().toISOString().split('T')[0];

      await axios.post('/anwesenheit', {
        mitglied_id: mitgliedId,
        stundenplan_id: selectedCourse.stundenplan_id,
        datum: today,
        anwesend: newStatus,
        checkin_methode: 'trainer'
      });

      setAttendanceData(prev => ({
        ...prev,
        [mitgliedId]: newStatus
      }));
    } catch (error) {
      console.error('Fehler beim Speichern der Anwesenheit:', error);
      alert('Fehler beim Speichern der Anwesenheit');
    }
  };

  const filterMembers = () => {
    if (!searchTerm) return members;
    const term = searchTerm.toLowerCase();
    return members.filter(m =>
      `${m.vorname} ${m.nachname}`.toLowerCase().includes(term) ||
      m.mitglied_id.toString().includes(term)
    );
  };

  const formatTime = (time) => {
    if (!time) return '';
    return time.substring(0, 5);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      padding: '2rem'
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 215, 0, 0.2)',
        borderRadius: '16px',
        padding: '1.5rem',
        marginBottom: '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ color: '#FFD700', marginBottom: '0.5rem', fontSize: '2rem' }}>
            Trainer Dashboard
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Willkommen, {user?.vorname || 'Trainer'}!
          </p>
        </div>
        <button
          onClick={() => logout()}
          style={{
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '0.75rem 1.5rem',
            color: '#EF4444',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Abmelden
        </button>
      </div>

      {!selectedCourse ? (
        // Kursauswahl
        <div>
          <h2 style={{ color: '#FFD700', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Calendar size={24} />
            Heutige Kurse
          </h2>

          {loading ? (
            <div style={{ textAlign: 'center', color: '#fff', padding: '3rem' }}>
              Lade Kurse...
            </div>
          ) : todayCourses.length === 0 ? (
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 215, 0, 0.2)',
              borderRadius: '12px',
              padding: '3rem',
              textAlign: 'center'
            }}>
              <Calendar size={48} style={{ color: 'rgba(255, 215, 0, 0.5)', margin: '0 auto 1rem' }} />
              <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.1rem' }}>
                Heute sind keine Kurse geplant.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {todayCourses.map(course => (
                <div
                  key={course.stundenplan_id}
                  onClick={() => loadMembersForCourse(course)}
                  style={{
                    background: 'linear-gradient(135deg, rgba(30, 30, 40, 0.9) 0%, rgba(20, 20, 30, 0.9) 100%)',
                    border: '1px solid rgba(255, 215, 0, 0.2)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#FFD700';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.2)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <h3 style={{ color: '#FFD700', marginBottom: '0.75rem', fontSize: '1.3rem' }}>
                    {course.kurs_name || course.gruppenname}
                  </h3>
                  <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', color: 'rgba(255, 255, 255, 0.9)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Clock size={18} style={{ color: '#FFD700' }} />
                      <span>{formatTime(course.uhrzeit_start)} - {formatTime(course.uhrzeit_ende)}</span>
                    </div>
                    {course.trainer && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Users size={18} style={{ color: '#FFD700' }} />
                        <span>{course.trainer}</span>
                      </div>
                    )}
                    {course.stil && (
                      <div>
                        🥋 {course.stil}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Anwesenheitsliste
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ color: '#FFD700', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Users size={24} />
              Anwesenheit: {selectedCourse.kurs_name || selectedCourse.gruppenname}
            </h2>
            <button
              onClick={() => {
                setSelectedCourse(null);
                setMembers([]);
                setAttendanceData({});
              }}
              style={{
                background: 'rgba(107, 114, 128, 0.2)',
                border: '1px solid rgba(107, 114, 128, 0.3)',
                borderRadius: '8px',
                padding: '0.75rem 1.5rem',
                color: '#9CA3AF',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Zurück zu Kursen
            </button>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#FFD700' }} />
              <input
                type="text"
                placeholder="Mitglied suchen (Name oder ID)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem 0.75rem 3rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 215, 0, 0.2)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '1rem'
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#9CA3AF',
                    cursor: 'pointer'
                  }}
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', color: '#fff', padding: '3rem' }}>
              Lade Mitglieder...
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {filterMembers().map(member => {
                const isPresent = attendanceData[member.mitglied_id] === 1;
                return (
                  <div
                    key={member.mitglied_id}
                    onClick={() => toggleAttendance(member.mitglied_id)}
                    style={{
                      background: isPresent
                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%)'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${isPresent ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 215, 0, 0.2)'}`,
                      borderRadius: '8px',
                      padding: '1rem 1.5rem',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: isPresent ? '#10B981' : '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem'
                      }}>
                        {isPresent ? '✓' : '?'}
                      </div>
                      <div>
                        <div style={{ color: '#fff', fontWeight: '600', fontSize: '1.1rem' }}>
                          {member.vorname} {member.nachname}
                        </div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem' }}>
                          ID: {member.mitglied_id} {member.gurtfarbe && `• ${member.gurtfarbe}`}
                        </div>
                      </div>
                    </div>
                    {isPresent && (
                      <CheckCircle size={24} style={{ color: '#10B981' }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TrainerDashboard;
