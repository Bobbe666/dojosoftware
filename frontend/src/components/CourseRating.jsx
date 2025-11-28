import React, { useState, useEffect } from 'react';
import { Star, Send, CheckCircle, MessageSquare, Calendar, Clock, User } from 'lucide-react';
import MemberHeader from './MemberHeader.jsx';
import '../styles/CourseRating.css';

const CourseRating = () => {
  const [ratableCourses, setRatableCourses] = useState([]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Keine Mock-Daten mehr - verwende echte API-Daten

  // Lade bewertbare Kurse
  const loadRatableCourses = async () => {
    setLoading(true);
    try {
      const response = await fetch('/mitglieder/ratable-courses', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRatableCourses(data.courses || []);
      } else {
        console.error('Fehler beim Laden der bewertbaren Kurse:', response.statusText);
        setRatableCourses([]);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Kurse:', error);
      setRatableCourses([]);
    } finally {
      setLoading(false);
    }
  };

  // Bewertung absenden
  const submitRating = async (courseId) => {
    if (rating === 0) {
      alert('Bitte wähle eine Bewertung aus!');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/mitglieder/submit-rating', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          courseId: courseId,
          rating: rating,
          comment: comment.trim()
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Aktualisiere lokalen State
        setRatableCourses(prev => 
          prev.map(course => 
            course.id === courseId 
              ? { ...course, rated: true }
              : course
          )
        );
        
        setSubmitted(true);
        setRating(0);
        setComment('');
        
        // Reset nach 3 Sekunden
        setTimeout(() => setSubmitted(false), 3000);
        
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Fehler beim Speichern der Bewertung');
      }
    } catch (error) {
      console.error('Fehler beim Absenden der Bewertung:', error);
      alert(`Fehler beim Absenden der Bewertung: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Format Datum
  const formatDate = (date) => {
    // Konvertiere String zu Date-Objekt falls nötig
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    if (dateObj.toDateString() === today.toDateString()) {
      return 'Heute';
    } else if (dateObj.toDateString() === yesterday.toDateString()) {
      return 'Gestern';
    } else {
      return dateObj.toLocaleDateString('de-DE', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short' 
      });
    }
  };

  // Format Zeit
  const formatTime = (date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  useEffect(() => {
    loadRatableCourses();
  }, []);

  if (loading) {
    return (
      <div className="dashboard-container">
        <MemberHeader />
        <div className="dashboard-content">
          <div className="course-rating-loading">
            <div className="loading-spinner"></div>
            <span>Lade bewertbare Kurse...</span>
          </div>
        </div>
      </div>
    );
  }

  const unratedCourses = ratableCourses.filter(course => !course.rated);
  const ratedCourses = ratableCourses.filter(course => course.rated);

  return (
    <div className="dashboard-container">
      <MemberHeader />
      <div className="dashboard-content">
        <div className="course-rating">
          {/* Header */}
          <div className="rating-header">
            <div className="header-content">
              <Star size={24} />
              <h1>Kurs-Bewertung</h1>
              <p>Wie war dein Training? Teile deine Erfahrung mit uns!</p>
            </div>
          </div>

          {/* Success Message */}
          {submitted && (
            <div className="success-message">
              <CheckCircle size={20} />
              <span>Vielen Dank für deine Bewertung! 🎉</span>
            </div>
          )}

          {/* Bewertbare Kurse */}
          {unratedCourses.length > 0 ? (
            <div className="ratable-courses">
              <h2>
                <Calendar size={20} />
                Bewerte deine Kurse
              </h2>
              <div className="courses-list">
                {unratedCourses.map(course => (
                  <div key={course.id} className="course-card">
                    <div className="course-info">
                      <div className="course-header">
                        <h3>{course.kurs_name}</h3>
                        <span className="course-date">{formatDate(course.datum)}</span>
                      </div>
                      <div className="course-details">
                        <div className="detail-item">
                          <User size={16} />
                          <span>{course.trainer_name}</span>
                        </div>
                        <div className="detail-item">
                          <Clock size={16} />
                          <span>{course.uhrzeit} • {course.duration} Min</span>
                        </div>
                        <div className="detail-item">
                          <MessageSquare size={16} />
                          <span>{course.raum}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rating-section">
                      <div className="rating-stars">
                        <label>Wie war das Training?</label>
                        <div className="stars">
                          {[1, 2, 3, 4, 5].map(star => (
                            <button
                              key={star}
                              className={`star ${star <= rating ? 'filled' : ''}`}
                              onClick={() => setRating(star)}
                            >
                              <Star size={24} />
                            </button>
                          ))}
                        </div>
                        <div className="rating-text">
                          {rating === 0 && 'Bewertung wählen'}
                          {rating === 1 && '😞 Sehr schlecht'}
                          {rating === 2 && '😕 Schlecht'}
                          {rating === 3 && '😐 Okay'}
                          {rating === 4 && '😊 Gut'}
                          {rating === 5 && '🤩 Sehr gut!'}
                        </div>
                      </div>

                      <div className="comment-section">
                        <label>Optional: Kommentar hinzufügen</label>
                        <textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Wie war der Trainer? Was hat dir besonders gefallen? Verbesserungsvorschläge?"
                          rows="3"
                          maxLength="500"
                        />
                        <div className="comment-counter">
                          {comment.length}/500 Zeichen
                        </div>
                      </div>

                      <button
                        className="submit-button"
                        onClick={() => submitRating(course.id)}
                        disabled={rating === 0 || submitting}
                      >
                        {submitting ? (
                          <>
                            <div className="loading-spinner small"></div>
                            Wird gesendet...
                          </>
                        ) : (
                          <>
                            <Send size={16} />
                            Bewertung absenden
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="no-ratable-courses">
              <Star size={48} />
              <h3>Keine Kurse zu bewerten</h3>
              <p>Du hast momentan keine Kurse, die bewertet werden können.</p>
            </div>
          )}

          {/* Bereits bewertete Kurse */}
          {ratedCourses.length > 0 && (
            <div className="rated-courses">
              <h2>
                <CheckCircle size={20} />
                Bereits bewertete Kurse
              </h2>
              <div className="rated-list">
                {ratedCourses.map(course => (
                  <div key={course.id} className="rated-card">
                    <div className="rated-info">
                      <h4>{course.kurs_name}</h4>
                      <div className="rated-details">
                        <span>{course.trainer_name}</span>
                        <span>{formatDate(course.datum)}</span>
                      </div>
                    </div>
                    <div className="rated-status">
                      <CheckCircle size={16} />
                      <span>Bewertet</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tipps */}
          <div className="rating-tips">
            <h3>💡 Tipps für deine Bewertung</h3>
            <ul>
              <li>Deine Bewertung hilft uns, die Kurse zu verbessern</li>
              <li>Konstruktive Kritik ist immer willkommen</li>
              <li>Alle Bewertungen werden anonym an die Trainer weitergegeben</li>
              <li>Du kannst nur Kurse bewerten, die du besucht hast</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseRating;
