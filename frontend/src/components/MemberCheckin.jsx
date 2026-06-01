import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx';
import { X, CheckCircle, Clock } from 'lucide-react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/CheckinSystem.css';

const MemberCheckin = ({ onClose }) => {
  const { user } = useAuth();
  const { getDojoFilterParam } = useDojoContext();
  const overlayRef = useRef(null);

  const [memberData, setMemberData]                     = useState(null);
  const [coursesToday, setCoursesToday]                 = useState([]);
  const [selectedCourses, setSelectedCourses]           = useState([]);
  const [loading, setLoading]                           = useState(false);
  const [error, setError]                               = useState('');
  const [success, setSuccess]                           = useState('');
  const [step, setStep]                                 = useState(1);
  const [checkedInCourses, setCheckedInCourses]         = useState([]);
  const [trainerCheckedInCourses, setTrainerCheckedInCourses] = useState([]);

  const API_BASE = config.apiBaseUrl;

  // ── iOS Body-Scroll komplett einfrieren ─────────────────────────────────────
  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    body.style.position = 'fixed';
    body.style.top      = `-${scrollY}px`;
    body.style.left     = '0';
    body.style.right    = '0';
    body.style.overflow = 'hidden';
    return () => {
      body.style.position = '';
      body.style.top      = '';
      body.style.left     = '';
      body.style.right    = '';
      body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  // ── touchmove auf Overlay blockieren, im Scroll-Bereich erlauben ────────────
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const stop = (e) => {
      if (e.target.closest('[data-scrollable]')) return; // Modal-Body darf scrollen
      e.preventDefault();
    };
    el.addEventListener('touchmove', stop, { passive: false });
    return () => el.removeEventListener('touchmove', stop);
  }, []);

  useEffect(() => { loadMemberAndCourses(); }, []);

  const loadMemberAndCourses = async () => {
    try {
      setLoading(true);
      const mitgliedId = user?.mitglied_id;
      if (!mitgliedId) throw new Error('Keine Mitglieds-ID gefunden');

      const memberResponse = await fetchWithAuth(`${API_BASE}/mitglieder/${mitgliedId}`);
      if (!memberResponse.ok) throw new Error(`Mitgliedsdaten nicht gefunden`);
      setMemberData(await memberResponse.json());

      const coursesResponse = await fetchWithAuth(`${API_BASE}/checkin/courses-today`);
      if (coursesResponse.ok) {
        const result = await coursesResponse.json();
        if (result.success) setCoursesToday(result.courses || []);
      }

      const checkinsResponse = await fetchWithAuth(`${API_BASE}/checkin/today-member/${mitgliedId}`);
      if (checkinsResponse.ok) {
        const r = await checkinsResponse.json();
        if (r.success) {
          setCheckedInCourses(r.stundenplan_ids || []);
          setTrainerCheckedInCourses(
            (r.checkins || [])
              .filter(c => c.status === 'completed' && c.checkin_method === 'manual')
              .map(c => c.stundenplan_id)
          );
        }
      }
    } catch (err) {
      setError('Fehler beim Laden: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCourse = (course) => {
    setSelectedCourses(prev => {
      const sel = prev.some(c => c.stundenplan_id === course.stundenplan_id);
      return sel ? prev.filter(c => c.stundenplan_id !== course.stundenplan_id) : [...prev, course];
    });
  };

  const executeCheckin = async () => {
    if (!memberData || selectedCourses.length === 0) {
      setError('Bitte mindestens einen Kurs auswählen');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetchWithAuth(`${API_BASE}/checkin/multi-course`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mitglied_id: memberData.mitglied_id,
          stundenplan_ids: selectedCourses.map(c => c.stundenplan_id),
          checkin_method: 'touch',
        }),
      });
      if (!response.ok) {
        const t = await response.text();
        let msg;
        try { msg = JSON.parse(t).error || JSON.parse(t).message; } catch { msg = t; }
        throw new Error(msg || `HTTP ${response.status}`);
      }
      const result = await response.json();
      let msg = result.message || `Check-in erfolgreich!`;
      try {
        const b = await fetchWithAuth(`${API_BASE}/mitglieder/${memberData.mitglied_id}/birthday-check`);
        const bd = await b.json();
        if (bd.hasBirthday)
          msg += `\n\n🎂 Herzlichen Glückwunsch zum ${bd.mitglied.alter}. Geburtstag, ${memberData.vorname}!`;
      } catch (_) {}
      setSuccess(`✅ ${msg}`);
      setTimeout(() => { if (window.location.pathname.includes('/member')) window.location.reload(); onClose(); }, 3000);
    } catch (err) {
      setError('Fehler: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const isCourseAvailable = (course) => {
    const now   = new Date();
    const today = new Date().toISOString().split('T')[0];
    const start = new Date(`${today}T${course.uhrzeit_start}`);
    const end   = new Date(`${today}T${course.uhrzeit_ende}`);
    return now < start || (now >= start && now <= end);
  };

  const fmt = (t) => t?.substring(0, 5) ?? '';

  // ── Styles ──────────────────────────────────────────────────────────────────
  const S = {
    overlay: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.78)',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      zIndex: 9999,
      overflow: 'hidden',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '3vh 0.75rem 0',
    },
    modal: {
      maxWidth: '440px', width: '100%',
      height: '94vh',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      borderRadius: '16px',
      position: 'relative',
      background: 'var(--bg-gradient)',
      border: '1.5px solid var(--primary-alpha-30)',
      boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
    },
    header: {
      flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.75rem 0.9rem 0.6rem',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(10px)',
    },
    body: {
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      touchAction: 'pan-y',
      overscrollBehavior: 'contain',
      padding: '0.75rem',
    },
    sectionTitle: {
      fontSize: '0.72rem',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--text-secondary)',
      marginBottom: '0.5rem',
    },
    courseItem: (selected, available) => ({
      display: 'flex', alignItems: 'center', gap: '0.7rem',
      padding: '0.7rem 0.85rem',
      background: selected ? 'rgba(255,215,0,0.09)' : 'rgba(255,255,255,0.035)',
      border: `1px solid ${selected ? 'rgba(255,215,0,0.35)' : 'rgba(255,255,255,0.08)'}`,
      borderLeft: `3px solid ${selected ? '#ffd700' : 'transparent'}`,
      borderRadius: '10px',
      marginBottom: '0.35rem',
      cursor: available ? 'pointer' : 'default',
      opacity: available ? 1 : 0.5,
      transition: 'all 0.15s',
    }),
    checkbox: (selected) => ({
      width: '18px', height: '18px', flexShrink: 0,
      border: `2px solid ${selected ? '#ffd700' : 'rgba(255,255,255,0.25)'}`,
      borderRadius: '5px',
      background: selected ? '#ffd700' : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#1a1a1a',
    }),
    courseName: {
      fontSize: '0.9rem', fontWeight: 700,
      color: 'var(--text-primary)',
      lineHeight: 1.2, marginBottom: '0.15rem',
    },
    courseGroup: {
      fontSize: '0.72rem', fontWeight: 500,
      color: 'rgba(255,255,255,0.45)',
      marginBottom: '0.1rem',
    },
    courseTime: {
      fontSize: '0.7rem', fontWeight: 600,
      color: 'rgba(255,215,0,0.6)',
      display: 'flex', alignItems: 'center', gap: '3px',
    },
    closeBtn: {
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '8px', color: 'var(--text-primary)',
      cursor: 'pointer', padding: '0.35rem',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    actionRow: {
      display: 'flex', gap: '0.5rem',
      justifyContent: 'flex-end',
      marginTop: '0.75rem',
      paddingTop: '0.5rem',
      borderTop: '1px solid rgba(255,255,255,0.07)',
    },
  };

  const headerTitle = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.02em' }}>
        Check-in
      </span>
      {memberData && (
        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {memberData.vorname} {memberData.nachname}
        </span>
      )}
    </div>
  );

  return (
    <div ref={overlayRef} style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>

        {/* Header mit X */}
        <div style={S.header}>
          {headerTitle}
          <button style={S.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {/* Scrollbarer Body */}
        <div style={S.body} data-scrollable="true">

          {error   && <div className="message error"   style={{ marginBottom: '0.5rem' }}>{error}</div>}
          {success && <div className="message success" style={{ marginBottom: '0.5rem' }}>{success}</div>}

          {/* ── Schritt 1: Kursauswahl ── */}
          {step === 1 && !success && (
            <>
              <div style={S.sectionTitle}>Heute verfügbare Kurse</div>

              {loading ? (
                <div className="loading">Lade Kurse…</div>
              ) : coursesToday.length === 0 ? (
                <div className="no-courses">
                  <div className="no-courses-icon">📅</div>
                  <h4>Keine Kurse heute</h4>
                </div>
              ) : coursesToday.filter(c => !checkedInCourses.includes(c.stundenplan_id)).length === 0 ? (
                <div className="no-courses">
                  <div className="no-courses-icon">✅</div>
                  <h4>Bereits für alle Kurse eingecheckt</h4>
                </div>
              ) : (
                <div>
                  {coursesToday.map((course) => {
                    if (checkedInCourses.includes(course.stundenplan_id)) return null;

                    // Vom Trainer eingecheckt
                    if (trainerCheckedInCourses.includes(course.stundenplan_id)) {
                      return (
                        <div key={course.stundenplan_id} style={{ ...S.courseItem(false, false), opacity: 0.7 }}>
                          <div style={{ width: 18, height: 18, flexShrink: 0, color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={S.courseName}>{course.kurs_name || course.gruppenname}</div>
                            {course.gruppenname && course.gruppenname !== course.kurs_name && (
                              <div style={S.courseGroup}>{course.gruppenname}</div>
                            )}
                            <div style={S.courseTime}><Clock size={11} />{fmt(course.uhrzeit_start)} – {fmt(course.uhrzeit_ende)}</div>
                          </div>
                          <div style={{ fontSize: '0.65rem', color: '#16a34a', fontWeight: 600, whiteSpace: 'nowrap' }}>Trainer ✓</div>
                        </div>
                      );
                    }

                    const available = isCourseAvailable(course);
                    const selected  = selectedCourses.some(c => c.stundenplan_id === course.stundenplan_id);
                    return (
                      <div
                        key={course.stundenplan_id}
                        style={S.courseItem(selected, available)}
                        onClick={() => available && toggleCourse(course)}
                      >
                        <div style={S.checkbox(selected)}>
                          {selected && <CheckCircle size={12} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={S.courseName}>{course.kurs_name || course.gruppenname}</div>
                          {course.gruppenname && course.gruppenname !== course.kurs_name && (
                            <div style={S.courseGroup}>{course.gruppenname}</div>
                          )}
                          <div style={S.courseTime}>
                            <Clock size={11} />
                            {fmt(course.uhrzeit_start)} – {fmt(course.uhrzeit_ende)}
                            {course.trainer && <span style={{ marginLeft: 6, opacity: 0.6 }}>· {course.trainer}</span>}
                          </div>
                        </div>
                        {!available && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                            {new Date(`${new Date().toISOString().split('T')[0]}T${course.uhrzeit_start}`) > new Date() ? 'Bald' : 'Beendet'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={S.actionRow}>
                <button onClick={onClose} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem' }}>
                  Abbrechen
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={selectedCourses.length === 0}
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem' }}
                >
                  Weiter ({selectedCourses.length}) →
                </button>
              </div>
            </>
          )}

          {/* ── Schritt 2: Bestätigung ── */}
          {step === 2 && !success && (
            <>
              <div style={S.sectionTitle}>Check-in bestätigen</div>
              <div style={{ marginBottom: '0.75rem' }}>
                {selectedCourses.map((course) => (
                  <div key={course.stundenplan_id} style={{ ...S.courseItem(true, true), cursor: 'default' }}>
                    <CheckCircle size={16} style={{ color: '#ffd700', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.courseName}>{course.kurs_name || course.gruppenname}</div>
                      {course.gruppenname && course.gruppenname !== course.kurs_name && (
                        <div style={S.courseGroup}>{course.gruppenname}</div>
                      )}
                      <div style={S.courseTime}><Clock size={11} />{fmt(course.uhrzeit_start)} – {fmt(course.uhrzeit_ende)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={S.actionRow}>
                <button onClick={() => setStep(1)} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem' }}>
                  ← Zurück
                </button>
                <button
                  onClick={executeCheckin}
                  disabled={loading}
                  className="btn btn-success"
                  style={{ fontSize: '0.85rem', padding: '0.55rem 1.1rem', fontWeight: 700 }}
                >
                  {loading ? 'Wird eingecheckt…' : '✓ Jetzt einchecken'}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default MemberCheckin;
