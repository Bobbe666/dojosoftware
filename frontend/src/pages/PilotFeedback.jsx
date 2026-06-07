/**
 * PILOT-PARTNER FEEDBACK — Öffentliche Umfrage-Seite (Token-basiert, kein Login)
 * Aufruf: dojo.tda-intl.org/pilot-feedback/:token (Link aus der E-Mail)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './PilotFeedback.css';

const RATING_LABELS = ['', 'Schlecht', 'Geht so', 'Okay', 'Gut', 'Top!'];

export default function PilotFeedback() {
  const { token } = useParams();
  const [umfrage, setUmfrage] = useState(null);
  const [antworten, setAntworten] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await axios.get(`/pilot-feedback/${token}`);
      if (r.data.beantwortet) {
        setDone(true);
        setUmfrage({ schulname: r.data.schulname });
      } else {
        setUmfrage(r.data);
      }
    } catch (err) {
      const m = err.response?.data?.error || 'Umfrage konnte nicht geladen werden.';
      setError(typeof m === 'string' ? m : JSON.stringify(m));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const setAntwort = (key, wert) => {
    setAntworten(prev => ({ ...prev, [key]: wert }));
    setError('');
  };

  const toggleChoice = (key, option) => {
    setAntworten(prev => {
      const arr = prev[key] || [];
      return { ...prev, [key]: arr.includes(option) ? arr.filter(o => o !== option) : [...arr, option] };
    });
  };

  const submit = async () => {
    // Alle Pflicht-Ratings beantwortet?
    const offen = umfrage.fragen.find(f => f.typ === 'rating' && !antworten[f.key]);
    if (offen) {
      setError(`Bitte beantworte noch: „${offen.text}"`);
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`/pilot-feedback/${token}`, { antworten });
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const m = err.response?.data?.error || 'Antworten konnten nicht gespeichert werden.';
      setError(typeof m === 'string' ? m : JSON.stringify(m));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="pf-page"><div className="pf-card pf-center">⏳ Lade Umfrage…</div></div>;
  }

  if (error && !umfrage) {
    return (
      <div className="pf-page">
        <div className="pf-card pf-center">
          <span className="pf-big">🤔</span>
          <h2>{error}</h2>
          <p>Falls du denkst, dass das ein Fehler ist, melde dich bei <a href="mailto:info@tda-intl.com">info@tda-intl.com</a>.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="pf-page">
        <div className="pf-card pf-center">
          <span className="pf-big">🙏</span>
          <h2>Vielen Dank{umfrage?.schulname ? `, ${umfrage.schulname}` : ''}!</h2>
          <p>Euer Feedback ist angekommen und fließt direkt in die Entwicklung ein.</p>
          <p className="pf-muted">Ihr könnt dieses Fenster jetzt schließen. Osu! 🥋</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pf-page">
      <div className="pf-card">
        <div className="pf-head">
          <span className="pf-badge">🏆 Pilot-Partner-Programm</span>
          <h1>{umfrage.titel}</h1>
          <p className="pf-intro">Hallo {umfrage.schulname}! {umfrage.intro}</p>
        </div>

        {umfrage.fragen.map((f, i) => (
          <div className="pf-frage" key={f.key}>
            <label className="pf-frage-text">
              <span className="pf-nr">{i + 1}</span>
              {f.text}
              {f.optional && <span className="pf-optional"> (optional)</span>}
            </label>

            {f.typ === 'rating' && (
              <div className="pf-rating">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`pf-star ${antworten[f.key] >= n ? 'active' : ''}`}
                    onClick={() => setAntwort(f.key, n)}
                    aria-label={`${n} von 5`}
                  >
                    ★
                  </button>
                ))}
                <span className="pf-rating-label">
                  {antworten[f.key] ? RATING_LABELS[antworten[f.key]] : ''}
                </span>
              </div>
            )}

            {f.typ === 'choice' && (
              <div className="pf-chips">
                {f.optionen.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    className={`pf-chip ${(antworten[f.key] || []).includes(opt) ? 'active' : ''}`}
                    onClick={() => toggleChoice(f.key, opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {f.typ === 'text' && (
              <textarea
                rows={3}
                value={antworten[f.key] || ''}
                onChange={e => setAntwort(f.key, e.target.value)}
                placeholder="Eure Antwort…"
              />
            )}
          </div>
        ))}

        {error && <div className="pf-error">{error}</div>}

        <button className="pf-submit" onClick={submit} disabled={submitting}>
          {submitting ? 'Wird gesendet…' : 'Feedback absenden'}
        </button>
        <p className="pf-muted pf-center-text">Kein Login nötig · Dauert keine 2 Minuten</p>
      </div>
    </div>
  );
}
