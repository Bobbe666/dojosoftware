import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';

const withDojo = (url, dojo) => dojo?.id ? `${url}${url.includes('?') ? '&' : '?'}dojo_id=${dojo.id}` : url;

const TYP_LABELS = {
  bestellung: { label: 'Bestellung', color: '#3b82f6' },
  vorverkauf: { label: 'Vorverkauf', color: '#f59e0b' },
  beides:     { label: 'Vorverkauf + Bestellung', color: '#22c55e' },
};

const EMPTY_FORM = {
  name: '', beschreibung: '', preis_cent: '', bild_url: '',
  typ: 'bestellung', vorverkauf_bis: '', lieferdatum: '', max_menge: '', sort_order: 0, aktiv: 1,
};

export default function MarketingArtikelTab() {
  const { activeDojo } = useDojoContext();
  const [artikel, setArtikel] = useState([]);
  const [bestellungen, setBestellungen] = useState([]);
  const [view, setView] = useState('artikel'); // 'artikel' | 'bestellungen'
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (!activeDojo?.id) return;
    try {
      const [aRes, bRes] = await Promise.all([
        axios.get(withDojo('/marketing-artikel', activeDojo)),
        axios.get(withDojo('/marketing-artikel/bestellungen', activeDojo)),
      ]);
      setArtikel(aRes.data.artikel || []);
      setBestellungen(bRes.data.bestellungen || []);
    } catch (e) {
      setError('Fehler beim Laden');
    }
  }, [activeDojo]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.name || !form.preis_cent) { setError('Name und Preis sind Pflichtfelder'); return; }
    setLoading(true); setError('');
    try {
      const payload = {
        ...form,
        preis_cent: Math.round(parseFloat(String(form.preis_cent).replace(',', '.')) * 100),
        max_menge: form.max_menge ? parseInt(form.max_menge) : null,
        vorverkauf_bis: form.vorverkauf_bis || null,
        lieferdatum: form.lieferdatum || null,
      };
      if (editId) {
        await axios.put(withDojo(`/marketing-artikel/${editId}`, activeDojo), payload);
      } else {
        await axios.post(withDojo('/marketing-artikel', activeDojo), payload);
      }
      setSuccess(editId ? 'Artikel gespeichert' : 'Artikel angelegt');
      setShowForm(false); setEditId(null); setForm(EMPTY_FORM);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Fehler beim Speichern');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Artikel wirklich löschen?')) return;
    try {
      await axios.delete(withDojo(`/marketing-artikel/${id}`, activeDojo));
      load();
    } catch (e) { setError('Löschen fehlgeschlagen'); }
  };

  const handleStornieren = async (id) => {
    if (!window.confirm('Bestellung stornieren?')) return;
    try {
      await axios.put(withDojo(`/marketing-artikel/bestellungen/${id}/stornieren`, activeDojo));
      load();
    } catch (e) { setError('Stornieren fehlgeschlagen'); }
  };

  const handleAcknowledge = async () => {
    if (!activeDojo?.id) return; // Super-Admin ohne Dojo-Kontext → Backend würde 400 liefern
    try {
      await axios.post(withDojo('/marketing-artikel/bestellungen/acknowledge', activeDojo));
      load();
    } catch (e) {
      console.error('Acknowledge fehlgeschlagen:', e);
    }
  };

  const openEdit = (a) => {
    setForm({
      name: a.name, beschreibung: a.beschreibung || '', preis_cent: (a.preis_cent / 100).toFixed(2),
      bild_url: a.bild_url || '', typ: a.typ || 'bestellung',
      vorverkauf_bis: a.vorverkauf_bis ? a.vorverkauf_bis.split('T')[0] : '',
      lieferdatum: a.lieferdatum ? a.lieferdatum.split('T')[0] : '',
      max_menge: a.max_menge || '', sort_order: a.sort_order || 0, aktiv: a.aktiv,
    });
    setEditId(a.id); setShowForm(true); setError('');
  };

  const ungelesen = bestellungen.filter(b => !b.admin_acknowledged_at).length;
  const statusColor = { offen: '#f59e0b', in_einzug: '#3b82f6', bezahlt: '#22c55e', storniert: '#6b7280' };

  if (!activeDojo?.id) return (
    <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted,#888)' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🏫</div>
      <div style={{ fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary,#fff)' }}>Kein Dojo ausgewählt</div>
      <div style={{ fontSize: '0.85rem' }}>Bitte wähle oben im Switcher ein Dojo aus, um Artikel zu verwalten.</div>
    </div>
  );

  return (
    <div style={{ padding: '0 0 2rem' }}>
      {/* View-Switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setView('artikel')}
          style={{
            padding: '0.4rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
            background: view === 'artikel' ? 'var(--color-primary, #d4af37)' : 'rgba(255,255,255,0.07)',
            color: view === 'artikel' ? '#000' : 'var(--text-primary, #fff)',
          }}>
          🛍️ Artikel verwalten
        </button>
        <button
          onClick={() => { setView('bestellungen'); handleAcknowledge(); }}
          style={{
            padding: '0.4rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
            background: view === 'bestellungen' ? 'var(--color-primary, #d4af37)' : 'rgba(255,255,255,0.07)',
            color: view === 'bestellungen' ? '#000' : 'var(--text-primary, #fff)',
            position: 'relative',
          }}>
          📦 Bestellungen
          {ungelesen > 0 && (
            <span style={{
              position: 'absolute', top: -6, right: -6,
              background: '#ef4444', color: 'var(--ds-text)', borderRadius: '50%',
              width: 18, height: 18, fontSize: '0.7rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{ungelesen}</span>
          )}
        </button>
        {view === 'artikel' && (
          <button
            onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); setError(''); }}
            style={{
              marginLeft: 'auto', padding: '0.4rem 1rem', borderRadius: 8, border: '1px solid #22c55e',
              background: 'rgba(34,197,94,0.1)', color: '#22c55e', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
            }}>
            + Neuer Artikel
          </button>
        )}
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', borderRadius: 8, padding: '0.6rem 1rem', marginBottom: '1rem', color: '#fca5a5', fontSize: '0.85rem' }}>{error}</div>}
      {success && <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid #22c55e', borderRadius: 8, padding: '0.6rem 1rem', marginBottom: '1rem', color: '#86efac', fontSize: '0.85rem' }}>{success}</div>}

      {/* Formular */}
      {showForm && view === 'artikel' && (
        <div style={{ background: 'rgba(26,26,46,0.98)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h4 style={{ margin: '0 0 1rem', color: 'var(--color-primary, #d4af37)', fontSize: '0.95rem' }}>
            {editId ? 'Artikel bearbeiten' : 'Neuer Artikel'}
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Name *</label>
              <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. TDA T-Shirt 2026" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Beschreibung</label>
              <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={form.beschreibung} onChange={e => setForm(f => ({ ...f, beschreibung: e.target.value }))} placeholder="Kurze Beschreibung für die Mitglieder…" />
            </div>
            <div>
              <label style={labelStyle}>Preis (€) *</label>
              <input style={inputStyle} type="number" step="0.01" min="0" value={form.preis_cent} onChange={e => setForm(f => ({ ...f, preis_cent: e.target.value }))} placeholder="29.90" />
            </div>
            <div>
              <label style={labelStyle}>Art</label>
              <select style={inputStyle} value={form.typ} onChange={e => setForm(f => ({ ...f, typ: e.target.value }))}>
                <option value="bestellung">Bestellung</option>
                <option value="vorverkauf">Vorverkauf</option>
                <option value="beides">Vorverkauf + Bestellung</option>
              </select>
            </div>
            {(form.typ === 'vorverkauf' || form.typ === 'beides') && (
              <div>
                <label style={labelStyle}>Vorverkauf bis</label>
                <input style={inputStyle} type="date" value={form.vorverkauf_bis} onChange={e => setForm(f => ({ ...f, vorverkauf_bis: e.target.value }))} />
              </div>
            )}
            <div>
              <label style={labelStyle}>Lieferdatum (optional)</label>
              <input style={inputStyle} type="date" value={form.lieferdatum} onChange={e => setForm(f => ({ ...f, lieferdatum: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Max. Stückzahl (optional)</label>
              <input style={inputStyle} type="number" min="1" value={form.max_menge} onChange={e => setForm(f => ({ ...f, max_menge: e.target.value }))} placeholder="Unbegrenzt" />
            </div>
            <div>
              <label style={labelStyle}>Sortiernummer</label>
              <input style={inputStyle} type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Bild-URL (optional)</label>
              <input style={inputStyle} value={form.bild_url} onChange={e => setForm(f => ({ ...f, bild_url: e.target.value }))} placeholder="https://…" />
            </div>
            {editId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ ...labelStyle, margin: 0 }}>Aktiv</label>
                <input type="checkbox" checked={form.aktiv == 1} onChange={e => setForm(f => ({ ...f, aktiv: e.target.checked ? 1 : 0 }))} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
            <button onClick={handleSave} disabled={loading} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: 'none', background: '#d4af37', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
              {loading ? 'Speichert…' : 'Speichern'}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); setError(''); }} style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'var(--text-muted, #888)', cursor: 'pointer', fontSize: '0.85rem' }}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Artikel-Liste */}
      {view === 'artikel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {artikel.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted, #888)', fontSize: '0.9rem' }}>
              Noch keine Artikel. Klicke auf „+ Neuer Artikel" um loszulegen.
            </div>
          ) : artikel.map(a => (
            <div key={a.id} style={{
              background: 'var(--bg-card, rgba(255,255,255,0.04))',
              border: `1px solid ${a.aktiv ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
              borderRadius: 10, padding: '0.9rem 1rem',
              display: 'flex', alignItems: 'center', gap: '1rem',
              opacity: a.aktiv ? 1 : 0.55,
            }}>
              {a.bild_url && <img src={a.bild_url} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary, #fff)' }}>{a.name}</span>
                  <span style={{ background: TYP_LABELS[a.typ]?.color || '#888', color: 'var(--ds-text)', borderRadius: 4, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 600 }}>
                    {TYP_LABELS[a.typ]?.label}
                  </span>
                  {!a.aktiv && <span style={{ background: '#374151', color: '#9ca3af', borderRadius: 4, padding: '1px 7px', fontSize: '0.7rem' }}>Inaktiv</span>}
                </div>
                {a.beschreibung && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.beschreibung}</div>}
                <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', color: '#d4af37', fontWeight: 700 }}>{(a.preis_cent / 100).toFixed(2)} €</span>
                  {a.vorverkauf_bis && <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>VVK bis {new Date(a.vorverkauf_bis).toLocaleDateString('de-DE')}</span>}
                  {a.lieferdatum && <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Lieferung {new Date(a.lieferdatum).toLocaleDateString('de-DE')}</span>}
                  {a.max_menge && <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Max. {a.max_menge} Stück</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => openEdit(a)} style={btnStyle('#3b82f6')}>Bearbeiten</button>
                <button onClick={() => handleDelete(a.id)} style={btnStyle('#ef4444')}>Löschen</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bestellungen-Liste */}
      {view === 'bestellungen' && (
        <div>
          {bestellungen.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted, #888)', fontSize: '0.9rem' }}>Noch keine Bestellungen.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  {['Mitglied', 'Artikel', 'Menge', 'Betrag', 'Status', 'Bestellt', ''].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--text-muted, #888)', fontWeight: 600, fontSize: '0.78rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bestellungen.map(b => (
                  <tr key={b.id} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: b.admin_acknowledged_at ? 'transparent' : 'rgba(212,175,55,0.04)',
                  }}>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-primary,#fff)' }}>
                      {b.vorname} {b.nachname}
                      {!b.admin_acknowledged_at && <span style={{ background: '#d4af37', color: '#000', borderRadius: 3, padding: '0 5px', fontSize: '0.65rem', fontWeight: 700, marginLeft: 6 }}>NEU</span>}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted,#888)' }}>{b.artikel_name}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>{b.menge}</td>
                    <td style={{ padding: '0.6rem 0.75rem', color: '#d4af37', fontWeight: 700 }}>{(b.preis_cent / 100).toFixed(2)} €</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <span style={{ background: statusColor[b.status] || '#888', color: 'var(--ds-text)', borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 }}>
                        {b.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted,#888)', fontSize: '0.78rem' }}>
                      {new Date(b.erstellt_am).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      {b.status === 'offen' && (
                        <button onClick={() => handleStornieren(b.id)} style={btnStyle('#ef4444')}>Stornieren</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '0.78rem', color: 'var(--text-muted,#888)', marginBottom: 4, fontWeight: 600 };
const inputStyle = {
  width: '100%', padding: '0.5rem 0.75rem', borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
  color: 'var(--text-primary,#fff)', fontSize: '0.85rem', boxSizing: 'border-box',
};
const btnStyle = (color) => ({
  padding: '0.3rem 0.65rem', borderRadius: 6, border: `1px solid ${color}`,
  background: `${color}20`, color: color, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
  whiteSpace: 'nowrap',
});
