import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X, BookOpen, ChevronDown, ChevronUp, Check } from 'lucide-react';

const fmt = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const daysSince = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / 86400000);
};

const StilZuweisungModal = ({ mitglied, dojoId, onDone, onClose }) => {
  const [stile, setStile] = useState([]);
  const [pakete, setPakete] = useState([]);
  const [selectedStile, setSelectedStile] = useState([]);
  const [selectedPaket, setSelectedPaket] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('dojo_auth_token');
    const dojoPart = dojoId && dojoId !== 'all' ? `?dojo_id=${dojoId}` : '';
    fetch(`/api/stile?aktiv=true`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setStile(Array.isArray(d) ? d : (d.stile || [])))
      .catch(() => {});
    fetch(`/api/starterpakete${dojoPart}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setPakete(Array.isArray(d) ? d.filter(p => p.aktiv) : []))
      .catch(() => {});
  }, [dojoId]);

  const toggleStil = (id) => {
    setSelectedStile(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const save = async () => {
    if (!selectedStile.length) { setError('Bitte mindestens einen Stil auswählen.'); return; }
    setSaving(true);
    setError('');
    const token = localStorage.getItem('dojo_auth_token');
    try {
      const r = await fetch(`/api/mitglieder/${mitglied.mitglied_id}/stile`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stile: selectedStile })
      });
      if (!r.ok) throw new Error();

      if (selectedPaket) {
        const dojoPart = dojoId && dojoId !== 'all' ? `?dojo_id=${dojoId}` : '';
        await fetch(`/api/starterpakete/${selectedPaket}/bestellen${dojoPart}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ mitglied_id: mitglied.mitglied_id })
        });
      }

      onDone();
    } catch {
      setError('Fehler beim Speichern. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onClose}>
      <div style={{
        background: 'rgba(26,26,46,0.99)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '12px', padding: '1.5rem', width: '420px', maxWidth: '94vw',
        maxHeight: '80vh', overflowY: 'auto'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: '#e0e0e0', fontSize: '1rem', fontWeight: 600 }}>
            Stil zuweisen — {mitglied.vorname} {mitglied.nachname}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '2px' }}>
            <X size={16} />
          </button>
        </div>

        <p style={{ margin: '0 0 1rem', color: '#aaa', fontSize: '0.8rem' }}>
          Mitglied seit {fmt(mitglied.eintrittsdatum)} · noch kein Stil zugewiesen
        </p>

        {stile.length > 0 ? (
          <>
            <div style={{ marginBottom: '0.5rem', color: '#ccc', fontSize: '0.8rem', fontWeight: 600 }}>Stil(e) auswählen:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1rem' }}>
              {stile.map(s => (
                <label key={s.stil_id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.7rem',
                  borderRadius: '7px', cursor: 'pointer',
                  background: selectedStile.includes(s.stil_id) ? 'rgba(124,106,247,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selectedStile.includes(s.stil_id) ? 'rgba(124,106,247,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  transition: 'all 0.15s'
                }}>
                  <input type="checkbox" checked={selectedStile.includes(s.stil_id)}
                    onChange={() => toggleStil(s.stil_id)}
                    style={{ accentColor: '#7c6af7', width: '14px', height: '14px', cursor: 'pointer' }} />
                  <span style={{ color: '#e0e0e0', fontSize: '0.85rem' }}>{s.name}</span>
                </label>
              ))}
            </div>
          </>
        ) : (
          <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '1rem' }}>Keine Stile konfiguriert.</p>
        )}

        {pakete.length > 0 && (
          <>
            <div style={{ marginBottom: '0.5rem', color: '#ccc', fontSize: '0.8rem', fontWeight: 600 }}>Starterpaket (optional):</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1rem' }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.7rem',
                borderRadius: '7px', cursor: 'pointer',
                background: !selectedPaket ? 'rgba(255,255,255,0.04)' : 'transparent',
                border: `1px solid ${!selectedPaket ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'}`,
              }}>
                <input type="radio" name="paket" checked={!selectedPaket} onChange={() => setSelectedPaket(null)}
                  style={{ accentColor: '#7c6af7', cursor: 'pointer' }} />
                <span style={{ color: '#aaa', fontSize: '0.85rem' }}>Kein Paket</span>
              </label>
              {pakete.map(p => (
                <label key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.7rem',
                  borderRadius: '7px', cursor: 'pointer',
                  background: selectedPaket === p.id ? 'rgba(124,106,247,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selectedPaket === p.id ? 'rgba(124,106,247,0.4)' : 'rgba(255,255,255,0.08)'}`,
                }}>
                  <input type="radio" name="paket" checked={selectedPaket === p.id} onChange={() => setSelectedPaket(p.id)}
                    style={{ accentColor: '#7c6af7', cursor: 'pointer' }} />
                  <span style={{ color: '#e0e0e0', fontSize: '0.85rem' }}>{p.name}</span>
                </label>
              ))}
            </div>
          </>
        )}

        {error && <p style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '0.4rem 0.9rem', borderRadius: '7px', fontSize: '0.82rem',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#aaa', cursor: 'pointer'
          }}>Abbrechen</button>
          <button onClick={save} disabled={saving || !selectedStile.length} style={{
            padding: '0.4rem 0.9rem', borderRadius: '7px', fontSize: '0.82rem', fontWeight: 600,
            background: saving || !selectedStile.length ? 'rgba(124,106,247,0.3)' : 'rgba(124,106,247,0.85)',
            border: '1px solid rgba(124,106,247,0.5)', color: '#fff', cursor: saving ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.3rem'
          }}>
            {saving ? '…' : <><Check size={12} /> Speichern</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const StilErinnerungBanner = ({ dojoId }) => {
  const [entries, setEntries] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [activeModal, setActiveModal] = useState(null);

  const load = useCallback(async () => {
    if (!dojoId) return;
    try {
      const token = localStorage.getItem('dojo_auth_token');
      const dojoPart = dojoId === 'all' ? '' : `?dojo_id=${dojoId}`;
      const r = await fetch(`/api/mitglieder/stil-erinnerungen${dojoPart}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await r.json();
      if (d.success) setEntries(d.entries || []);
    } catch {}
  }, [dojoId]);

  useEffect(() => { load(); }, [load]);

  const dismiss = async (id) => {
    try {
      const token = localStorage.getItem('dojo_auth_token');
      const dojoPart = dojoId && dojoId !== 'all' ? `?dojo_id=${dojoId}` : '';
      await fetch(`/api/mitglieder/${id}/stil-erinnerung-dismiss${dojoPart}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      setEntries(prev => prev.filter(e => e.mitglied_id !== id));
    } catch {}
  };

  if (!entries.length) return null;

  const visible = expanded ? entries : entries.slice(0, 3);
  const hasMore = entries.length > 3;

  return (
    <>
      {activeModal && (
        <StilZuweisungModal
          mitglied={entries.find(e => e.mitglied_id === activeModal)}
          dojoId={dojoId}
          onDone={() => { setActiveModal(null); dismiss(activeModal); }}
          onClose={() => setActiveModal(null)}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
        {visible.map(e => (
          <div key={e.mitglied_id} style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.55rem 0.9rem', borderRadius: '9px',
            border: '1px solid rgba(251,191,36,0.3)',
            background: 'rgba(251,191,36,0.06)',
            fontSize: '0.82rem'
          }}>
            <AlertTriangle size={15} color="#fbbf24" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0, color: '#e0e0e0' }}>
              <strong style={{ color: '#fbbf24' }}>
                {e.vorname} {e.nachname}{e.dojoname ? ` (${e.dojoname})` : ''}:
              </strong>{' '}
              Kein Stil zugewiesen · Mitglied seit {daysSince(e.eintrittsdatum)} Tagen
              {!e.last_login_at && <span style={{ color: '#f87171', marginLeft: '0.4rem' }}>· noch nie eingeloggt</span>}
            </div>
            <button onClick={() => setActiveModal(e.mitglied_id)} title="Stil zuweisen" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.22rem 0.55rem', borderRadius: '6px',
              background: 'rgba(124,106,247,0.1)', border: '1px solid rgba(124,106,247,0.3)',
              color: '#a78bfa', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0
            }}>
              <BookOpen size={11} /> Stil
            </button>
            <button onClick={() => dismiss(e.mitglied_id)} title="Ignorieren" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '22px', height: '22px', borderRadius: '5px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#888', cursor: 'pointer', flexShrink: 0
            }}>
              <X size={12} />
            </button>
          </div>
        ))}
        {hasMore && (
          <button onClick={() => setExpanded(e => !e)} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.3rem 0.8rem', borderRadius: '7px', alignSelf: 'flex-start',
            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
            color: '#fbbf24', fontSize: '0.78rem', cursor: 'pointer'
          }}>
            {expanded
              ? <><ChevronUp size={12} /> Weniger anzeigen</>
              : <><ChevronDown size={12} /> {entries.length - 3} weitere Mitglieder ohne Stil</>
            }
          </button>
        )}
      </div>
    </>
  );
};

export default StilErinnerungBanner;
