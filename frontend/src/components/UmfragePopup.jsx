import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './UmfragePopup.css';

export default function UmfragePopup() {
  const { token } = useAuth();
  const [umfragen, setUmfragen] = useState([]);
  const [idx, setIdx] = useState(0);
  const [antwort, setAntwort] = useState(null);
  const [kommentar, setKommentar] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    axios.get('/umfragen/pending', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setUmfragen(r.data.umfragen || []))
      .catch(() => {});
  }, [token]);

  if (!umfragen.length || done) return null;

  const umfrage = umfragen[idx];
  const hatJaNein = umfrage.typ === 'ja_nein' || umfrage.typ === 'beides';
  const hatKommentar = umfrage.typ === 'kommentar' || umfrage.typ === 'beides';
  const kannAbsenden = hatJaNein ? antwort !== null : kommentar.trim().length > 0;

  const absenden = async () => {
    setSending(true);
    try {
      await axios.post(`/umfragen/${umfrage.id}/antwort`,
        { antwort: hatJaNein ? antwort : null, kommentar: hatKommentar ? kommentar : null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAntwort(null);
      setKommentar('');
      if (idx + 1 >= umfragen.length) {
        setDone(true);
      } else {
        setIdx(i => i + 1);
      }
    } catch (e) {
      // ignore — silently skip on error
      setDone(true);
    } finally {
      setSending(false);
    }
  };

  const ueberspringen = () => {
    // Nur in dieser Session überspringen — NICHT in DB speichern,
    // damit die Umfrage beim nächsten Login wieder erscheint
    if (idx + 1 >= umfragen.length) setDone(true);
    else setIdx(i => i + 1);
  };

  return (
    <div className="ufp-overlay">
      <div className="ufp-box">
        {umfragen.length > 1 && (
          <div className="ufp-progress">
            Umfrage {idx + 1} von {umfragen.length}
          </div>
        )}
        <div className="ufp-icon">📋</div>
        <h2 className="ufp-titel">{umfrage.titel}</h2>
        {umfrage.beschreibung && (
          <p className="ufp-beschreibung">{umfrage.beschreibung}</p>
        )}

        {hatJaNein && (
          <div className="ufp-ja-nein">
            <button
              className={`ufp-btn-jn ufp-btn-ja ${antwort === 'ja' ? 'aktiv' : ''}`}
              onClick={() => setAntwort(antwort === 'ja' ? null : 'ja')}>
              ✓ Ja
            </button>
            <button
              className={`ufp-btn-jn ufp-btn-nein ${antwort === 'nein' ? 'aktiv' : ''}`}
              onClick={() => setAntwort(antwort === 'nein' ? null : 'nein')}>
              ✗ Nein
            </button>
          </div>
        )}

        {hatKommentar && (
          <textarea
            className="ufp-kommentar"
            placeholder="Dein Kommentar (optional)…"
            value={kommentar}
            onChange={e => setKommentar(e.target.value)}
            rows={3}
          />
        )}

        <div className="ufp-footer">
          <button className="ufp-btn-skip" onClick={ueberspringen}>
            Überspringen
          </button>
          <button
            className="ufp-btn-absenden"
            onClick={absenden}
            disabled={!kannAbsenden || sending}>
            {sending ? 'Wird gesendet…' : 'Absenden'}
          </button>
        </div>
      </div>
    </div>
  );
}
