import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx';
import { X, Calendar, CheckCircle, Clock } from 'lucide-react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/CheckinSystem.css';

const MemberCheckin = ({ onClose }) => {
  const { user } = useAuth();
  const { getDojoFilterParam } = useDojoContext();
  const overlayRef = useRef(null);

  const [memberData, setMemberData]                           = useState(null);
  const [coursesToday, setCoursesToday]                       = useState([]);
  const [selectedCourses, setSelectedCourses]                 = useState([]);
  const [loading, setLoading]                                 = useState(false);
  const [error, setError]                                     = useState('');
  const [success, setSuccess]                                 = useState('');
  const [step, setStep]                                       = useState(1);
  const [checkedInCourses, setCheckedInCourses]               = useState([]); // stundenplan_ids (aktiv)
  const [activeCheckins, setActiveCheckins]                   = useState([]); // [{stundenplan_id, checkin_id, kurs_name, stil}]
  const [trainerCheckedInCourses, setTrainerCheckedInCourses] = useState([]);
  const [checkoutLoading, setCheckoutLoading]                 = useState(null); // checkin_id das gerade ausgecheckt wird
  const [stilFilterAktiv, setStilFilterAktiv]                 = useState(false); // Dojo-Einstellung
  const [alterFilterAktiv, setAlterFilterAktiv]              = useState(false); // Dojo-Einstellung
  const [guertelFilterAktiv, setGuertelFilterAktiv]         = useState(false); // Dojo-Einstellung
  const [memberGrades, setMemberGrades]                     = useState({});    // stil_name(lower) → stufe
  const [showAlleKurse, setShowAlleKurse]                     = useState(false); // „Weitere Kurse anzeigen"

  const API_BASE = config.apiBaseUrl;

  // ── iOS Body-Scroll einfrieren (position:fixed ist der einzig zuverlässige Weg) ──
  useEffect(() => {
    const scrollY = window.scrollY;
    const body    = document.body;
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

  // ── touchmove auf Overlay blockieren — nur [data-scrollable] darf scrollen ──
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const stop = (e) => {
      if (e.target.closest('[data-scrollable]')) return;
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

      const memberRes = await fetchWithAuth(`${API_BASE}/mitglieder/${mitgliedId}`);
      if (!memberRes.ok) throw new Error(`Mitgliedsdaten nicht gefunden: ${memberRes.statusText}`);
      setMemberData(await memberRes.json());

      const coursesRes = await fetchWithAuth(`${API_BASE}/checkin/courses-today`);
      if (coursesRes.ok) {
        const result = await coursesRes.json();
        if (result.success) setCoursesToday(result.courses || []);
      }

      // Dojo-Einstellung: Stil-Filter beim Check-in?
      try {
        const setRes = await fetchWithAuth(`${API_BASE}/checkin-einstellungen`);
        if (setRes.ok) {
          const s = await setRes.json();
          setStilFilterAktiv(!!s.stil_filter_aktiv);
          setAlterFilterAktiv(!!s.alter_filter_aktiv);
          setGuertelFilterAktiv(!!s.guertel_filter_aktiv);
        }
      } catch { /* Default: aus */ }

      // Aktuelle Grad-Stufe je Stil (für Gürtel-Filter)
      try {
        const gRes = await fetchWithAuth(`${API_BASE}/checkin/member-graduierungen/${mitgliedId}`);
        if (gRes.ok) {
          const gd = await gRes.json();
          const map = {};
          (gd.grades || []).forEach(g => { if (g.stil_name != null) map[String(g.stil_name).trim().toLowerCase()] = g.stufe; });
          setMemberGrades(map);
        }
      } catch { /* kein Grad → keine Gürtel-Einschränkung */ }

      const checkinsRes = await fetchWithAuth(`${API_BASE}/checkin/today-member/${mitgliedId}`);
      if (checkinsRes.ok) {
        const r = await checkinsRes.json();
        if (r.success) {
          const active = (r.checkins || []).filter(c => c.status === 'active');
          setCheckedInCourses(active.map(c => c.stundenplan_id));
          setActiveCheckins(active.map(c => ({
            stundenplan_id: c.stundenplan_id,
            checkin_id:     c.checkin_id,
            kurs_name:      c.kurs_name,
          })));
          setTrainerCheckedInCourses(
            (r.checkins || [])
              .filter(c => c.status === 'completed' && c.checkin_method === 'manual')
              .map(c => c.stundenplan_id)
          );
        }
      }
    } catch (err) {
      setError('Fehler beim Laden der Daten: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCourse = (course) => {
    setSelectedCourses(prev => {
      const sel = prev.some(c => c.stundenplan_id === course.stundenplan_id);
      return sel
        ? prev.filter(c => c.stundenplan_id !== course.stundenplan_id)
        : [...prev, course];
    });
  };

  const executeCheckin = async () => {
    if (!memberData || selectedCourses.length === 0) {
      setError('Bitte wählen Sie mindestens einen Kurs aus');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetchWithAuth(`${API_BASE}/checkin/multi-course`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mitglied_id:    memberData.mitglied_id,
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
      let successMsg = result.message || `Check-in erfolgreich für ${memberData.vorname} ${memberData.nachname}!`;
      try {
        const b  = await fetchWithAuth(`${API_BASE}/mitglieder/${memberData.mitglied_id}/birthday-check`);
        const bd = await b.json();
        if (bd.hasBirthday)
          successMsg = `🎉 ${successMsg}\n\n🎂 Herzlichen Glückwunsch zum ${bd.mitglied.alter}. Geburtstag, ${memberData.vorname}!`;
      } catch (_) {}
      setSuccess(`✅ ${successMsg}`);
      setTimeout(() => {
        if (window.location.pathname.includes('/member')) window.location.reload();
        onClose();
      }, 3000);
    } catch (err) {
      setError('Check-in Fehler: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const executeCheckout = async (checkinId) => {
    setCheckoutLoading(checkinId);
    try {
      const response = await fetchWithAuth(`${API_BASE}/checkin/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkin_id: checkinId }),
      });
      if (!response.ok) {
        const t = await response.text();
        let msg;
        try { msg = JSON.parse(t).error; } catch { msg = t; }
        throw new Error(msg || `HTTP ${response.status}`);
      }
      await loadMemberAndCourses();
    } catch (err) {
      setError('Abmelden fehlgeschlagen: ' + err.message);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const isCourseAvailable = (course) => {
    const now   = new Date();
    const today = new Date().toISOString().split('T')[0];
    const start = new Date(`${today}T${course.uhrzeit_start}`);
    const end   = new Date(`${today}T${course.uhrzeit_ende}`);
    return now < start || (now >= start && now <= end);
  };

  const formatTime = (t) => t?.substring(0, 5) ?? '';

  // stil = "Enzo Karate" / "Kickboxen"  →  Hauptname (groß)
  // kurs_name (gruppenname) = "Kinder 4-6 Jahre"  →  Untertitel (klein)
  const getCourseTitle    = (c) => c.stil && c.stil !== 'Unbekannt' ? c.stil : (c.kurs_name || c.gruppenname || '—');
  const getCourseSubtitle = (c) => {
    if (!c.stil || c.stil === 'Unbekannt') return null;
    const sub = c.kurs_name || c.gruppenname;
    return sub && sub !== c.stil ? sub : null;
  };

  // Overlay + Modal als Inline-Style — kein CSS kann diese überschreiben
  const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    zIndex: 9999,
    overflow: 'hidden',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    paddingTop: '4dvh', paddingLeft: '1rem', paddingRight: '1rem',
  };
  const modalStyle = {
    maxWidth: '450px', width: '100%',
    height: '92dvh', maxHeight: '92dvh',
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    borderRadius: '1rem',
  };
  const bodyStyle = {
    flex: 1, minHeight: 0,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    touchAction: 'pan-y',
    overscrollBehavior: 'contain',
    padding: '0.75rem',
  };
  // „Weiter"/Bestätigen als fixe Fußleiste — immer sichtbar, auch beim Scrollen
  const actionBarStyle = {
    position: 'sticky', bottom: '-0.75rem',
    marginLeft: '-0.75rem', marginRight: '-0.75rem', marginBottom: '-0.75rem',
    marginTop: '0.75rem', padding: '0.75rem',
    background: 'rgba(26,26,46,0.99)',
    borderTop: '1px solid rgba(255,255,255,0.12)',
    display: 'flex', gap: '0.5rem',
  };

  if (!memberData) {
    return createPortal(
      <div ref={overlayRef} className="modal-overlay member-checkin-modal" style={overlayStyle} onClick={onClose}>
        <div className="modal-content checkin-modal" style={modalStyle} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header" style={{ flexShrink: 0 }}>
            <h2>Check-in</h2>
            <button onClick={onClose} className="close-button"><X size={24} /></button>
          </div>
          <div className="modal-body" style={bodyStyle} data-scrollable="true">
            {loading
              ? <div className="loading">Lade Daten...</div>
              : <div className="error-message">{error}</div>
            }
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // ── Check-in-Filter (Dojo-Einstellung): Stil und/oder Alter ──
  const _md = memberData?.mitglied || memberData;
  const memberStyles = (_md?.stile || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const stilFilterEffektiv = stilFilterAktiv && memberStyles.length > 0;
  const courseMatchesStyle = (c) => memberStyles.includes((c.stil || '').trim().toLowerCase());

  // Alter des Mitglieds aus Geburtsdatum
  const memberAge = _md?.geburtsdatum
    ? Math.floor((Date.now() - new Date(_md.geburtsdatum).getTime()) / 31557600000)
    : null;
  const alterFilterEffektiv = alterFilterAktiv && memberAge != null;
  const courseMatchesAge = (c) => {
    const min = c.min_alter, max = c.max_alter;
    if ((min == null || min === '') && (max == null || max === '')) return true; // kein Bereich → für alle
    if (min != null && min !== '' && memberAge < Number(min)) return false;
    if (max != null && max !== '' && memberAge > Number(max)) return false;
    return true;
  };

  // Gürtel: aktuelle Grad-Stufe des Mitglieds für den Stil des Kurses vs. Kurs-Bereich
  const guertelFilterEffektiv = guertelFilterAktiv && Object.keys(memberGrades).length > 0;
  const courseMatchesBelt = (c) => {
    const min = c.min_grad_stufe, max = c.max_grad_stufe;
    if (min == null && max == null) return true; // kein Gürtel-Bereich → für alle
    const stufe = memberGrades[(c.stil || '').trim().toLowerCase()];
    if (stufe == null) return true; // kein Grad für diesen Stil → nicht einschränken
    if (min != null && stufe < Number(min)) return false;
    if (max != null && stufe > Number(max)) return false;
    return true;
  };

  const filterAktiv = stilFilterEffektiv || alterFilterEffektiv || guertelFilterEffektiv;
  const matchesAll = (c) => (!stilFilterEffektiv || courseMatchesStyle(c)) && (!alterFilterEffektiv || courseMatchesAge(c)) && (!guertelFilterEffektiv || courseMatchesBelt(c));
  const offeneKurse = coursesToday.filter(c => !checkedInCourses.includes(c.stundenplan_id));
  const passendeKurse = offeneKurse.filter(matchesAll);
  const versteckteAnzahl = offeneKurse.length - passendeKurse.length;
  const sichtbareKurse = (filterAktiv && !showAlleKurse) ? passendeKurse : offeneKurse;

  return createPortal(
    <div ref={overlayRef} className="modal-overlay member-checkin-modal" style={overlayStyle} onClick={onClose}>
      <div className="modal-content checkin-modal" style={modalStyle} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <h2>Check-in für {memberData.vorname} {memberData.nachname}</h2>
          <button onClick={onClose} className="close-button"><X size={24} /></button>
        </div>

        {/* Scrollbarer Body — data-scrollable erlaubt touch-scroll */}
        <div className="modal-body" style={bodyStyle} data-scrollable="true">
          {error   && <div className="message error">{error}</div>}
          {success && <div className="message success">{success}</div>}

          {/* ── Schritt 1: Kursauswahl ── */}
          {step === 1 && (
            <div className="course-selection-step">
              <div className="step-header">
                <div className="step-icon"><Calendar size={24} /></div>
                <div>
                  <h3>Kurse für heute auswählen</h3>
                  <p style={{ fontSize: '0.72rem', margin: 0, opacity: 0.7 }}>Wähle die Kurse aus, für die du dich anmelden möchtest</p>
                </div>
              </div>

              {/* ── Bereits angemeldete Kurse ── */}
              {activeCheckins.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#16a34a', marginBottom: '0.3rem' }}>
                    ✓ Bereits angemeldet
                  </div>
                  {activeCheckins.map(({ stundenplan_id, checkin_id, kurs_name }) => {
                    const course = coursesToday.find(c => c.stundenplan_id === stundenplan_id);
                    const title = course ? getCourseTitle(course) : (kurs_name || '—');
                    const subtitle = course ? getCourseSubtitle(course) : null;
                    return (
                      <div key={checkin_id} style={{
                        display: 'flex', alignItems: 'center', gap: '0.6rem',
                        padding: '0.6rem 0.85rem',
                        background: 'rgba(22,163,74,0.07)',
                        border: '1px solid rgba(22,163,74,0.25)',
                        borderLeft: '3px solid #16a34a',
                        borderRadius: '10px',
                        marginBottom: '0.3rem',
                      }}>
                        <div style={{ color: '#16a34a', fontSize: '1rem', flexShrink: 0 }}>✓</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{title}</div>
                          {subtitle && <div style={{ fontSize: '0.7rem', opacity: 0.65, marginTop: '0.1rem' }}>{subtitle}</div>}
                        </div>
                        <button
                          onClick={() => executeCheckout(checkin_id)}
                          disabled={checkoutLoading === checkin_id}
                          style={{
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: '7px',
                            color: '#ef4444',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.3rem 0.6rem',
                            cursor: 'pointer',
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {checkoutLoading === checkin_id ? '…' : 'Abmelden'}
                        </button>
                      </div>
                    );
                  })}
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
                  <p>Du bist bereits für alle heutigen Kurse eingecheckt.</p>
                </div>
              ) : (
                <>
                <div className="courses-list">
                  {sichtbareKurse.length === 0 && (
                    <div className="no-courses">
                      <div className="no-courses-icon">🥋</div>
                      <h4>Keine passenden Kurse heute</h4>
                      <p>Über „Weitere Kurse anzeigen" siehst du alle heutigen Stunden.</p>
                    </div>
                  )}
                  {sichtbareKurse.map((course) => {
                    if (checkedInCourses.includes(course.stundenplan_id)) return null;

                    const title    = getCourseTitle(course);
                    const subtitle = getCourseSubtitle(course);

                    // Trainer eingecheckt
                    if (trainerCheckedInCourses.includes(course.stundenplan_id)) {
                      return (
                        <div key={course.stundenplan_id} className="course-item unavailable" style={{ opacity: 0.75 }}>
                          <div className="course-checkbox" style={{ color: '#16a34a', fontSize: '18px' }}>✓</div>
                          <div className="course-info">
                            <div className="course-name">{title}</div>
                            {subtitle && <div className="course-trainer" style={{ fontSize: '0.72rem', opacity: 0.7 }}>{subtitle}</div>}
                            <div className="course-time"><Clock size={14} />{formatTime(course.uhrzeit_start)} – {formatTime(course.uhrzeit_ende)}</div>
                          </div>
                          <div style={{ fontSize: '0.65rem', color: '#16a34a', fontWeight: 600, whiteSpace: 'nowrap' }}>✅ Trainer</div>
                        </div>
                      );
                    }

                    const available = isCourseAvailable(course);
                    const selected  = selectedCourses.some(c => c.stundenplan_id === course.stundenplan_id);

                    return (
                      <div
                        key={course.stundenplan_id}
                        className={`course-item ${selected ? 'selected' : ''} ${!available ? 'unavailable' : ''}`}
                        onClick={() => available && toggleCourse(course)}
                      >
                        <div className="course-checkbox">
                          {selected && <CheckCircle size={20} />}
                        </div>
                        <div className="course-info">
                          {/* Hauptname groß: stil (z.B. "Enzo Karate") */}
                          <div className="course-name">{title}</div>
                          {/* Gruppe klein darunter (z.B. "Kinder 4-6 Jahre") */}
                          {subtitle && (
                            <div className="course-trainer" style={{ fontSize: '0.72rem', opacity: 0.75, marginBottom: '0.1rem' }}>
                              {subtitle}
                            </div>
                          )}
                          <div className="course-time">
                            <Clock size={14} />
                            {formatTime(course.uhrzeit_start)} – {formatTime(course.uhrzeit_ende)}
                            {course.trainer && course.trainer !== 'Kein Trainer' && (
                              <span style={{ marginLeft: '0.4rem', opacity: 0.6 }}>· {course.trainer}</span>
                            )}
                          </div>
                        </div>
                        {!available && (
                          <div className="course-status">
                            {new Date(`${new Date().toISOString().split('T')[0]}T${course.uhrzeit_start}`) > new Date() ? 'Bald' : 'Beendet'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {filterAktiv && versteckteAnzahl > 0 && !showAlleKurse && (
                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', marginTop: '0.5rem', fontWeight: 600 }}
                    onClick={() => setShowAlleKurse(true)}
                  >
                    🔎 Alle Kurse anzeigen ({versteckteAnzahl} weitere) →
                  </button>
                )}
                {filterAktiv && versteckteAnzahl > 0 && showAlleKurse && (
                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', marginTop: '0.5rem', opacity: 0.85 }}
                    onClick={() => setShowAlleKurse(false)}
                  >
                    ← Nur passende Kurse anzeigen
                  </button>
                )}
                </>
              )}

              <div className="action-buttons" style={actionBarStyle}>
                <button onClick={onClose} className="btn btn-secondary">Abbrechen</button>
                <button onClick={() => setStep(2)} disabled={selectedCourses.length === 0} className="btn btn-primary">
                  Weiter →
                </button>
              </div>
            </div>
          )}

          {/* ── Schritt 2: Bestätigung ── */}
          {step === 2 && (
            <div className="confirmation-step">
              <div className="step-header">
                <div className="step-icon"><CheckCircle size={24} /></div>
                <div>
                  <h3>Check-in bestätigen</h3>
                  <p style={{ fontSize: '0.72rem', margin: 0, opacity: 0.7 }}>Möchtest du dich für die folgenden Kurse anmelden?</p>
                </div>
              </div>

              <div className="selected-courses">
                {selectedCourses.map((course) => {
                  const title    = getCourseTitle(course);
                  const subtitle = getCourseSubtitle(course);
                  return (
                    <div key={course.stundenplan_id} className="selected-course-item">
                      <div>
                        <div className="course-name">{title}</div>
                        {subtitle && <div style={{ fontSize: '0.72rem', opacity: 0.7 }}>{subtitle}</div>}
                      </div>
                      <div className="course-time">
                        <Clock size={14} />
                        {formatTime(course.uhrzeit_start)} – {formatTime(course.uhrzeit_ende)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="action-buttons" style={actionBarStyle}>
                <button onClick={() => setStep(1)} className="btn btn-secondary">← Zurück</button>
                <button onClick={executeCheckin} disabled={loading} className="btn btn-success btn-large">
                  {loading ? 'Lädt...' : 'Jetzt anmelden!'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MemberCheckin;
