import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config.js';
import '../styles/NextTrainingsWidget.css';

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const NextTrainingsWidget = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [termine, setTermine] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.mitglied_id) return;
    const load = async () => {
      try {
        const res = await fetchWithAuth(
          `${config.apiBaseUrl}/stundenplan/member/${user.mitglied_id}/termine`
        );
        if (res.ok) {
          const data = await res.json();
          setTermine((Array.isArray(data) ? data : []).slice(0, 3));
        }
      } catch (_) {}
      finally { setLoading(false); }
    };
    load();
  }, [user?.mitglied_id]);

  if (loading) {
    return (
      <div className="ntw-wrap">
        <div className="ntw-header">
          <span className="ntw-title">Nächste Trainings</span>
        </div>
        <div className="ntw-skeleton-list">
          {[1, 2, 3].map(i => <div key={i} className="ntw-skeleton" />)}
        </div>
      </div>
    );
  }

  if (termine.length === 0) {
    return (
      <div className="ntw-wrap">
        <div className="ntw-header">
          <span className="ntw-title">Nächste Trainings</span>
          <button className="ntw-link" onClick={() => navigate('/member/schedule')}>
            Stundenplan →
          </button>
        </div>
        <div className="ntw-empty">Keine kommenden Termine gefunden.</div>
      </div>
    );
  }

  return (
    <div className="ntw-wrap">
      <div className="ntw-header">
        <span className="ntw-title">Nächste Trainings</span>
        <button className="ntw-link" onClick={() => navigate('/member/schedule')}>
          Alle →
        </button>
      </div>
      <div className="ntw-list">
        {termine.map((t, i) => {
          const date = new Date(t.datum || t.date);
          const isToday = new Date().toDateString() === date.toDateString();
          const isTomorrow = new Date(Date.now() + 86400000).toDateString() === date.toDateString();
          const dayLabel = isToday ? 'Heute' : isTomorrow ? 'Morgen' : WOCHENTAGE[date.getDay()];
          const dayNum = date.getDate();
          const monthNum = date.getMonth() + 1;
          const timeStr = t.zeit || t.uhrzeit_start
            ? (t.zeit || `${t.uhrzeit_start}${t.uhrzeit_ende ? ` – ${t.uhrzeit_ende}` : ''}`)
            : '';
          const kursname = t.title || t.kursname || 'Training';
          const trainer = t.trainer
            ? (typeof t.trainer === 'string' ? t.trainer : `${t.trainer.vorname || ''} ${t.trainer.nachname || ''}`.trim())
            : (t.trainer_vorname ? `${t.trainer_vorname} ${t.trainer_nachname || ''}`.trim() : null);

          return (
            <div key={i} className={`ntw-card${isToday ? ' ntw-card--today' : ''}`}>
              <div className="ntw-date-col">
                <span className="ntw-day-name">{dayLabel}</span>
                <span className="ntw-day-num">{dayNum}.{monthNum < 10 ? '0' + monthNum : monthNum}</span>
              </div>
              <div className="ntw-divider" />
              <div className="ntw-info-col">
                <span className="ntw-kurs">{kursname}</span>
                <div className="ntw-meta">
                  {timeStr && <span className="ntw-time">🕐 {timeStr}</span>}
                  {trainer && <span className="ntw-trainer">👤 {trainer}</span>}
                </div>
              </div>
              {isToday && <span className="ntw-today-badge">Heute!</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NextTrainingsWidget;
