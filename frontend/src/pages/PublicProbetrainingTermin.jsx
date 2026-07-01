import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import config from '../config/config.js';
import '../styles/PublicProbetrainingTermin.css';

// Öffentliche Self-Service-Buchungsseite: Kunde wählt aus dem E-Mail-Link seinen Probetraining-Termin.
const PublicProbetrainingTermin = () => {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [auswahl, setAuswahl] = useState(null); // { stundenplan_id, datum }
  const [buchen, setBuchen] = useState(false);
  const [erfolg, setErfolg] = useState(null);

  const fmtDatum = (d) => new Date(d + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${config.apiBaseUrl}/public/probetraining/termin/${token}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.error || 'Dieser Link ist ungültig oder abgelaufen.');
        } else {
          setData(json.data);
        }
      } catch (e) {
        setError('Verbindungsfehler. Bitte später erneut versuchen.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleBuchen = async () => {
    if (!auswahl) return;
    setBuchen(true);
    setError(null);
    try {
      const res = await fetch(`${config.apiBaseUrl}/public/probetraining/termin/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auswahl)
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Buchung fehlgeschlagen.');
      } else {
        setErfolg(json.data);
      }
    } catch (e) {
      setError('Verbindungsfehler bei der Buchung.');
    } finally {
      setBuchen(false);
    }
  };

  if (loading) {
    return <div className="ppt-wrap"><div className="ppt-card"><div className="ppt-loading">Wird geladen …</div></div></div>;
  }

  if (erfolg) {
    return (
      <div className="ppt-wrap">
        <div className="ppt-card ppt-success">
          <div className="ppt-success-icon">🥋</div>
          <h1>Dein Termin ist gebucht!</h1>
          <div className="ppt-success-box">
            <div className="ppt-success-date">{new Date(erfolg.datum + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            <div className="ppt-success-time">{erfolg.uhrzeit} Uhr · {erfolg.kurs}</div>
            {erfolg.trainer && erfolg.trainer.trim() && <div className="ppt-success-trainer">Trainer: {erfolg.trainer}</div>}
          </div>
          <p>Du bekommst gleich eine Bestätigung per E-Mail. Wir freuen uns auf dich!</p>
          <p className="ppt-muted">{erfolg.dojo_name}</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="ppt-wrap">
        <div className="ppt-card ppt-error-card">
          <div className="ppt-success-icon">😕</div>
          <h1>Ups …</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ppt-wrap">
      <div className="ppt-card">
        <div className="ppt-header">
          <div className="ppt-badge">Probetraining</div>
          <h1>Hallo {data.interessent.vorname}! 👋</h1>
          <p>Wähle deinen Wunschtermin bei <strong>{data.dojo.name}</strong> – ein Klick genügt.</p>
        </div>

        {data.gebucht && (
          <div className="ppt-info">
            Aktuell gebucht: {new Date(data.gebucht.datum + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            {data.gebucht.uhrzeit ? ` um ${data.gebucht.uhrzeit} Uhr` : ''}. Du kannst unten einen anderen Termin wählen.
          </div>
        )}

        {error && <div className="ppt-inline-error">{error}</div>}

        {data.slots.length === 0 ? (
          <div className="ppt-empty">Aktuell sind keine Probetrainings-Termine online buchbar. Bitte melde dich direkt beim Dojo.</div>
        ) : (
          <div className="ppt-slots">
            {data.slots.map((s) => (
              <div key={s.stundenplan_id} className="ppt-slot">
                <div className="ppt-slot-head">
                  <span className="ppt-slot-name">{s.stil_name || s.kursname || 'Training'}</span>
                  {s.kursname && s.stil_name && <span className="ppt-slot-sub">{s.kursname}</span>}
                </div>
                <div className="ppt-slot-meta">
                  {s.wochentag}s · {s.uhrzeit_start}–{s.uhrzeit_ende}{s.trainer && s.trainer.trim() ? ` · ${s.trainer}` : ''}
                </div>
                <div className="ppt-dates">
                  {s.naechste_termine.map((d) => {
                    const sel = auswahl && auswahl.stundenplan_id === s.stundenplan_id && auswahl.datum === d;
                    return (
                      <button
                        key={d}
                        className={`ppt-date ${sel ? 'active' : ''}`}
                        onClick={() => setAuswahl({ stundenplan_id: s.stundenplan_id, datum: d })}
                      >
                        {fmtDatum(d)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {auswahl && (
        <div className="ppt-confirm-bar">
          <button className="ppt-confirm-btn" onClick={handleBuchen} disabled={buchen}>
            {buchen ? 'Wird gebucht …' : '✅ Termin verbindlich buchen'}
          </button>
        </div>
      )}
    </div>
  );
};

export default PublicProbetrainingTermin;
