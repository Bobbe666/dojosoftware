import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './UmfragePopup.css';

const WDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
function fmtDatum(str) {
  const d = new Date(str + 'T00:00:00');
  return `${WDAYS[d.getDay()]}, ${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
}

export default function UmfragePopup() {
  const { token } = useAuth();
  const [umfragen, setUmfragen] = useState([]);
  const [idx, setIdx] = useState(0);
  const [antwort, setAntwort] = useState(null);
  const [kommentar, setKommentar] = useState('');
  const [datumAntworten, setDatumAntworten] = useState({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    axios.get('/umfragen/pending', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setUmfragen((r.data.umfragen || []).filter(u => u.als_popup)))
      .catch(() => {});
  }, [token]);

  const weiter = () => {
    setAntwort(null);
    setKommentar('');
    setDatumAntworten({});
    if (idx + 1 >= umfragen.length) setDone(true);
    else setIdx(i => i + 1);
  };

  if (!umfragen.length || done) return null;

  const umfrage = umfragen[idx];
  const isDatum    = umfrage.typ === 'datum_auswahl';
  const hatJaNein  = !isDatum && (umfrage.typ === 'ja_nein' || umfrage.typ === 'beides');
  const hatKomm    = !isDatum && (umfrage.typ === 'kommentar' || umfrage.typ === 'beides');
  const daten      = isDatum ? (Array.isArray(umfrage.daten) ? umfrage.daten : []) : [];

  const kannAbsenden = isDatum
    ? daten.length > 0
    : hatJaNein ? antwort !== null : kommentar.trim().length > 0;

  const absenden = async () => {
    setSending(true);
    try {
      if (isDatum) {
        const payload = daten.map(d => ({
          datum: d,
          kommt: datumAntworten[d] !== false,
        }));
        await axios.post(`/umfragen/${umfrage.id}/datum-antwort`,
          { daten: payload },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.post(`/umfragen/${umfrage.id}/antwort`,
          { antwort: hatJaNein ? antwort : null, kommentar: hatKomm ? kommentar : null },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      weiter();
    } catch (e) {
      setDone(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ufp-overlay">
      <div className="ufp-box">
        {umfragen.length > 1 && (
          <div className="ufp-progress">Umfrage {idx + 1} von {umfragen.length}</div>
        )}
        <div className="ufp-icon">{isDatum ? '📅' : '📋'}</div>
        <h2 className="ufp-titel">{umfrage.titel}</h2>
        {umfrage.beschreibung && (
          <p className="ufp-beschreibung">{umfrage.beschreibung}</p>
        )}
        {umfrage.bild_url && (
          <img
            src={umfrage.bild_url}
            alt="Umfragebild"
            className="ufp-bild"
          />
        )}

        {isDatum && (
          <div className="ufp-datum-list">
            {daten.map(d => {
              const kommt = datumAntworten[d] !== false;
              return (
                <div key={d} className="ufp-datum-row">
                  <span className="ufp-datum-label">{fmtDatum(d)}</span>
                  <div className="ufp-datum-toggle">
                    <button
                      className={`ufp-btn-jn ufp-btn-ja ${kommt ? 'aktiv' : ''}`}
                      onClick={() => setDatumAntworten(p => ({ ...p, [d]: true }))}>
                      ✓ Ja
                    </button>
                    <button
                      className={`ufp-btn-jn ufp-btn-nein ${!kommt ? 'aktiv' : ''}`}
                      onClick={() => setDatumAntworten(p => ({ ...p, [d]: false }))}>
                      ✗ Nein
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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

        {hatKomm && (
          <textarea
            className="ufp-kommentar"
            placeholder="Dein Kommentar (optional)…"
            value={kommentar}
            onChange={e => setKommentar(e.target.value)}
            rows={3}
          />
        )}

        <div className="ufp-footer">
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
