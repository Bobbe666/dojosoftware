// ============================================================================
// CHECK-IN-EINSTELLUNGEN (pro Dojo)
// Toggle: Stil-Filter beim Check-in (Mitglieder sehen zuerst nur eigene-Stil-Kurse)
// ============================================================================
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}` });

export default function CheckinEinstellungen() {
  const { activeDojo } = useDojoContext();
  const dojoParam = activeDojo?.id ? `?dojo_id=${activeDojo.id}` : '';
  const [stil, setStil] = useState(false);
  const [alter, setAlter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    axios.get(`/checkin-einstellungen${dojoParam}`, { headers: authHeader() })
      .then(r => { setStil(!!r.data?.stil_filter_aktiv); setAlter(!!r.data?.alter_filter_aktiv); })
      .catch(() => { setStil(false); setAlter(false); })
      .finally(() => setLoading(false));
  }, [dojoParam]);

  useEffect(() => { load(); }, [load]);

  const speichern = async (nextStil, nextAlter) => {
    setBusy(true); setMsg('');
    try {
      await axios.put(`/checkin-einstellungen${dojoParam}`,
        { stil_filter_aktiv: nextStil, alter_filter_aktiv: nextAlter }, { headers: authHeader() });
      setStil(nextStil); setAlter(nextAlter);
      setMsg('Gespeichert ✅');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setMsg(e.response?.data?.error || 'Speichern fehlgeschlagen.');
    } finally { setBusy(false); }
  };
  const Toggle = ({ on, onToggle }) => (
    <button onClick={() => !busy && !loading && onToggle()} disabled={busy || loading} aria-pressed={on}
      style={{ flex: '0 0 auto', width: 58, height: 32, borderRadius: 999, border: 'none', cursor: busy || loading ? 'default' : 'pointer',
        background: on ? '#22c55e' : 'rgba(255,255,255,0.2)', position: 'relative', transition: 'background .2s', opacity: loading ? 0.5 : 1 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 29 : 3, width: 26, height: 26, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
    </button>
  );

  return (
    <div style={{ padding: 24, color: 'var(--ds-text, #e2e8f0)', maxWidth: 760, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 22 }}>✅ Check-in-Einstellungen</h1>
      <p style={{ opacity: 0.7, marginTop: 0 }}>Steuere, wie Mitglieder beim Einchecken die Kurse sehen.</p>

      {msg && <div style={{ margin: '12px 0', padding: '10px 14px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 8 }}>{msg}</div>}

      {/* Stil-Filter */}
      <div style={{ marginTop: 16, padding: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🥋 Nur Kurse des eigenen Stils anzeigen</div>
          <div style={{ fontSize: 13.5, opacity: 0.72, lineHeight: 1.5 }}>
            Wenn aktiviert, sieht ein Mitglied beim Check-in zuerst nur die Kurse, die zu seinem Stil passen.
            Über <strong>„Weitere Kurse anzeigen"</strong> kann es trotzdem jede andere Stunde besuchen.
            <br /><span style={{ opacity: 0.6 }}>Ohne hinterlegten Stil werden alle Kurse gezeigt.</span>
          </div>
        </div>
        <Toggle on={stil} onToggle={() => speichern(!stil, alter)} />
      </div>

      {/* Alters-Filter */}
      <div style={{ marginTop: 12, padding: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🎂 Nur alterspassende Kurse anzeigen</div>
          <div style={{ fontSize: 13.5, opacity: 0.72, lineHeight: 1.5 }}>
            Wenn aktiviert, sieht ein Mitglied beim Check-in zuerst nur Kurse, deren Altersbereich zu seinem Alter passt.
            Über <strong>„Weitere Kurse anzeigen"</strong> bleiben alle Stunden wählbar.
            <br /><span style={{ opacity: 0.6 }}>Das Min-/Max-Alter legst du je Kurs in der Kursverwaltung fest. Kurse ohne Altersangabe gelten für alle.</span>
          </div>
        </div>
        <Toggle on={alter} onToggle={() => speichern(stil, !alter)} />
      </div>

      <p style={{ marginTop: 16, fontSize: 12, opacity: 0.5 }}>
        {loading ? 'lädt…' : `Stil-Filter: ${stil ? 'an' : 'aus'} · Alters-Filter: ${alter ? 'an' : 'aus'}`}
      </p>
    </div>
  );
}
