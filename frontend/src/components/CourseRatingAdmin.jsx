import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, TrendingUp, Users, AlertCircle, CheckCircle } from 'lucide-react';
import '../styles/CourseRatingAdmin.css';

const CourseRatingAdmin = () => {
  const [ratings, setRatings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('recent');
  const [filterRating, setFilterRating] = useState('all');

  // Lade Bewertungen
  const loadRatings = async () => {
    try {
      const response = await fetch('/api/admin/course-ratings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRatings(data.ratings || []);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Bewertungen:', error);
    }
  };

  // Lade Statistiken
  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/rating-stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Statistiken:', error);
    }
  };

  useEffect(() => {
    loadRatings();
    loadStats();
    setLoading(false);
  }, []);

  // Filter Bewertungen
  const filteredRatings = ratings.filter(rating => {
    if (filterRating === 'all') return true;
    return rating.bewertung.toString() === filterRating;
  });

  // Render Sterne
  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={16}
        className={i < rating ? 'filled' : 'empty'}
        style={{
          color: i < rating ? '#ffd700' : 'rgba(255, 255, 255, 0.3)',
          fill: i < rating ? '#ffd700' : 'none'
        }}
      />
    ));
  };

  // Format Datum
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="course-rating-admin">
        <div className="loading-spinner"></div>
        <span>Lade Bewertungen...</span>
      </div>
    );
  }

  return (
    <div className="course-rating-admin">
      <div className="admin-header">
        <h1>
          <Star size={28} />
          Kurs-Bewertungen - Admin
        </h1>
        <p>Übersicht aller Kursbewertungen und Statistiken</p>
      </div>

      {/* Statistiken */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <Star size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-number">{stats.overall.total_ratings}</div>
              <div className="stat-label">Gesamtbewertungen</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <TrendingUp size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-number">{stats.overall.average_rating?.toFixed(1) || '0.0'}</div>
              <div className="stat-label">Durchschnittsbewertung</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <MessageSquare size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-number">{stats.overall.with_comments}</div>
              <div className="stat-label">Mit Kommentaren</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <Users size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-number">{stats.byCourse?.length || 0}</div>
              <div className="stat-label">Bewertete Kurse</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="admin-tabs">
        <button 
          className={`tab ${activeTab === 'recent' ? 'active' : ''}`}
          onClick={() => setActiveTab('recent')}
        >
          Neueste Bewertungen
        </button>
        <button 
          className={`tab ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('courses')}
        >
          Nach Kursen
        </button>
      </div>

      {/* Filter */}
      <div className="filter-section">
        <label>Bewertung filtern:</label>
        <select 
          value={filterRating} 
          onChange={(e) => setFilterRating(e.target.value)}
        >
          <option value="all">Alle Bewertungen</option>
          <option value="5">5 Sterne</option>
          <option value="4">4 Sterne</option>
          <option value="3">3 Sterne</option>
          <option value="2">2 Sterne</option>
          <option value="1">1 Stern</option>
        </select>
      </div>

      {/* Neueste Bewertungen */}
      {activeTab === 'recent' && (
        <div className="ratings-list">
          <h2>Neueste Bewertungen</h2>
          {filteredRatings.length > 0 ? (
            <div className="ratings-grid">
              {filteredRatings.map(rating => (
                <div key={rating.id} className="rating-card">
                  <div className="rating-header">
                    <div className="course-info">
                      <h3>{rating.kurs_name}</h3>
                      <span className="course-time">{rating.uhrzeit} • {rating.raum}</span>
                    </div>
                    <div className="rating-stars">
                      {renderStars(rating.bewertung)}
                    </div>
                  </div>
                  
                  <div className="rating-details">
                    <div className="member-info">
                      <strong>{rating.mitglied_vorname} {rating.mitglied_nachname}</strong>
                      <span>{formatDate(rating.erstellt_am)}</span>
                    </div>
                    
                    <div className="trainer-info">
                      <span>Trainer: {rating.trainer_vorname} {rating.trainer_nachname}</span>
                    </div>
                  </div>
                  
                  {rating.kommentar && (
                    <div className="rating-comment">
                      <MessageSquare size={16} />
                      <p>"{rating.kommentar}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="no-data">
              <AlertCircle size={48} />
              <p>Keine Bewertungen gefunden</p>
            </div>
          )}
        </div>
      )}

      {/* Nach Kursen */}
      {activeTab === 'courses' && stats && (
        <div className="courses-stats">
          <h2>Bewertungen nach Kursen</h2>
          <div className="courses-grid">
            {stats.byCourse.map(course => (
              <div key={course.kurs_name} className="course-stat-card">
                <div className="course-header">
                  <h3>{course.kurs_name}</h3>
                  <div className="course-rating">
                    {renderStars(Math.round(course.average_rating))}
                    <span className="rating-number">{course.average_rating?.toFixed(1)}</span>
                  </div>
                </div>
                <div className="course-stats">
                  <span>{course.rating_count} Bewertung{course.rating_count !== 1 ? 'en' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseRatingAdmin;
