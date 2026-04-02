// PlattformZugangsdaten.jsx — Zentrale Zugangsdaten-Verwaltung (Super-Admin)
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Copy, Plus, Edit2, Trash2, Check, X, ExternalLink, Save } from 'lucide-react';

const KATEGORIEN = [
  { id: 'server',    label: 'Server & Hosting',    icon: '🖥️' },
  { id: 'datenbank', label: 'Datenbanken',          icon: '🗄️' },
  { id: 'email',     label: 'E-Mail / SMTP',        icon: '✉️' },
  { id: 'plattform', label: 'Plattformen',          icon: '🌐' },
  { id: 'extern',    label: 'Externe Dienste',      icon: '🔗' },
  { id: 'sonstiges', label: 'Sonstiges',            icon: '📦' },
];

const KAT_COLORS = {
  server:    { bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.35)',  accent: '#818cf8' },
  datenbank: { bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.30)',   accent: '#4ade80' },
  email:     { bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.35)',  accent: '#fb923c' },
  plattform: { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)', accent: '#fbbf24' },
  extern:    { bg: 'rgba(236,72,153,0.10)',  border: 'rgba(236,72,153,0.30)',  accent: '#f472b6' },
  sonstiges: { bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.25)', accent: '#94a3b8' },
};

const EMPTY_FORM = { kategorie: 'plattform', name: '', url: '', benutzername: '', passwort: '', notizen: '' };

function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={copy} title="Kopieren" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: copied ? '#4ade80' : 'rgba(255,255,255,0.35)', transition: 'color .2s' }}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function MaskedField({ value, label }) {
  const [show, setShow] = useState(false);
  if (!value) return <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem' }}>—</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: show ? 'monospace' : 'inherit', fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)' }}>
      {show ? value : '••••••••••'}
      <button onClick={() => setShow(s => !s)} title={show ? 'Verbergen' : 'Anzeigen'}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'rgba(255,255,255,0.4)', lineHeight: 1 }}>
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      <CopyBtn value={value} />
    </span>
  );
}

function EntryCard({ entry, onEdit, onDelete }) {
  const col = KAT_COLORS[entry.kategorie] || KAT_COLORS.sonstiges;
  return (
    <div style={{ background: col.bg, border: `1px solid ${col.border}`, borderRadius: 10, padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>{entry.name}</span>
            {entry.url && (
              <a href={entry.url} target="_blank" rel="noreferrer" title={entry.url}
                style={{ color: col.accent, lineHeight: 1 }}>
                <ExternalLink size={13} />
              </a>
            )}
          </div>
          {entry.url && (
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: 2, wordBreak: 'break-all' }}>{entry.url}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={() => onEdit(entry)} title="Bearbeiten"
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}>
            <Edit2 size={13} />
          </button>
          <button onClick={() => onDelete(entry)} title="Löschen"
            style={{ background: 'rgba(248,113,113,0.12)', border: 'none', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', color: '#f87171' }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 8px', fontSize: '0.8rem', alignItems: 'center' }}>
        {entry.benutzername && (
          <>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Benutzer</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {entry.benutzername}
              <CopyBtn value={entry.benutzername} />
            </span>
          </>
        )}
        {entry.passwort && (
          <>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Passwort</span>
            <MaskedField value={entry.passwort} />
          </>
        )}
        {entry.notizen && (
          <>
            <span style={{ color: 'rgba(255,255,255,0.4)', alignSelf: 'flex-start', paddingTop: 2 }}>Notizen</span>
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', lineHeight: 1.4 }}>{entry.notizen}</span>
          </>
        )}
      </div>
    </div>
  );
}

function EditModal({ entry, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...entry });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const inp = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 7, padding: '0.5rem 0.75rem', color: '#fff', fontSize: '0.85rem',
    width: '100%', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
  };
  const lbl = { fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginBottom: 4, display: 'block' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#12121e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '1.5rem', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff', fontWeight: 700 }}>
            {entry?.id ? 'Zugangsdaten bearbeiten' : 'Neuer Eintrag'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {/* Kategorie */}
          <div>
            <label style={lbl}>Kategorie</label>
            <select value={form.kategorie} onChange={e => set('kategorie', e.target.value)}
              style={{ ...inp, cursor: 'pointer' }}>
              {KATEGORIEN.map(k => <option key={k.id} value={k.id}>{k.icon} {k.label}</option>)}
            </select>
          </div>

          {/* Name */}
          <div>
            <label style={lbl}>Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="z.B. SSH Server dojo.tda-intl.org" style={inp} />
          </div>

          {/* URL */}
          <div>
            <label style={lbl}>URL (optional)</label>
            <input value={form.url} onChange={e => set('url', e.target.value)} placeholder="https://..." style={inp} />
          </div>

          {/* Benutzername */}
          <div>
            <label style={lbl}>Benutzername / E-Mail</label>
            <input value={form.benutzername} onChange={e => set('benutzername', e.target.value)} placeholder="root, user@example.com ..." style={inp} />
          </div>

          {/* Passwort */}
          <div>
            <label style={lbl}>Passwort</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={form.passwort}
                onChange={e => set('passwort', e.target.value)}
                placeholder="Passwort eingeben..."
                style={{ ...inp, paddingRight: '2.5rem', fontFamily: showPw ? 'monospace' : 'inherit' }}
              />
              <button onClick={() => setShowPw(s => !s)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 2 }}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Notizen */}
          <div>
            <label style={lbl}>Notizen</label>
            <textarea value={form.notizen} onChange={e => set('notizen', e.target.value)}
              placeholder="Port, Hinweise, Ablaufdatum..."
              rows={3}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', cursor: 'pointer' }}>
            Abbrechen
          </button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            style={{ padding: '0.5rem 1.25rem', background: saving ? 'rgba(99,102,241,0.4)' : '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Save size={14} />
            {saving ? 'Speichert...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlattformZugangsdaten() {
  const { token } = useAuth();
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [editEntry, setEditEntry] = useState(null); // null = geschlossen, {} = neu, {id,...} = edit
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filterKat, setFilterKat] = useState('alle');
  const [search, setSearch]   = useState('');
  const [error, setError]     = useState(null);
  const [collapsedKats, setCollapsedKats] = useState(null); // null = noch nicht initialisiert

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/zugangsdaten', {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const d = await r.json();
      if (d.success) setData(d.data);
      else setError(d.message || 'Fehler beim Laden');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    const method = form.id ? 'PUT' : 'POST';
    const url    = form.id ? `/api/zugangsdaten/${form.id}` : '/api/zugangsdaten';
    try {
      const r = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (d.success) { setEditEntry(null); load(); }
      else alert('Fehler: ' + (d.message || d.error));
    } catch (e) { alert('Fehler: ' + e.message); }
  };

  const handleDelete = async (entry) => {
    try {
      const r = await fetch(`/api/zugangsdaten/${entry.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const d = await r.json();
      if (d.success) { setDeleteConfirm(null); load(); }
      else alert('Fehler: ' + d.error);
    } catch (e) { alert('Fehler: ' + e.message); }
  };

  const filtered = data.filter(e => {
    if (filterKat !== 'alle' && e.kategorie !== filterKat) return false;
    if (search) {
      const q = search.toLowerCase();
      return e.name.toLowerCase().includes(q) || (e.url || '').toLowerCase().includes(q) || (e.benutzername || '').toLowerCase().includes(q) || (e.notizen || '').toLowerCase().includes(q);
    }
    return true;
  });

  // Gruppiert nach Kategorie
  const grouped = KATEGORIEN.map(kat => ({
    ...kat,
    entries: filtered.filter(e => e.kategorie === kat.id),
  })).filter(g => g.entries.length > 0);

  // Beim ersten Laden: erste Gruppe aufgeklappt, Rest eingeklappt
  const effectiveCollapsed = collapsedKats ?? (
    grouped.length > 0
      ? new Set(grouped.slice(1).map(g => g.id))
      : new Set()
  );

  const toggleKat = (katId) => {
    const next = new Set(effectiveCollapsed);
    if (next.has(katId)) next.delete(katId); else next.add(katId);
    setCollapsedKats(next);
  };

  const totalEntries = data.length;

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>🔐 Zugangsdaten-Zentrale</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
            {totalEntries} Einträge · Passwörter AES-256 verschlüsselt · Nur Super-Admin
          </p>
        </div>
        <button onClick={() => setEditEntry(EMPTY_FORM)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.55rem 1.1rem', background: '#6366f1', border: 'none', borderRadius: 9, color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
          <Plus size={15} /> Neuer Eintrag
        </button>
      </div>

      {/* Filter-Leiste */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Suchen..."
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '0.45rem 0.75rem', color: '#fff', fontSize: '0.83rem', outline: 'none', width: 180 }}
        />
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {[{ id: 'alle', label: 'Alle', icon: '📋' }, ...KATEGORIEN].map(k => (
            <button key={k.id} onClick={() => setFilterKat(k.id)}
              style={{
                padding: '0.35rem 0.75rem', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: '1px solid',
                background: filterKat === k.id ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                borderColor: filterKat === k.id ? '#6366f1' : 'rgba(255,255,255,0.1)',
                color: filterKat === k.id ? '#a5b4fc' : 'rgba(255,255,255,0.5)',
              }}>
              {k.icon} {k.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inhalt */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 1rem' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          Lade Zugangsdaten...
        </div>
      ) : error ? (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '1rem 1.25rem', color: '#fca5a5', fontSize: '0.85rem' }}>
          ⚠️ {error}
        </div>
      ) : grouped.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.3)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔐</div>
          {data.length === 0
            ? <>Noch keine Zugangsdaten gespeichert.<br /><button onClick={() => setEditEntry(EMPTY_FORM)} style={{ marginTop: '0.75rem', padding: '0.5rem 1.25rem', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>Ersten Eintrag erstellen</button></>
            : 'Keine Einträge gefunden.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {grouped.map(group => {
            const isCollapsed = effectiveCollapsed.has(group.id);
            const accent = KAT_COLORS[group.id]?.accent || '#94a3b8';
            return (
              <div key={group.id} style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
                {/* Klickbarer Header */}
                <button
                  onClick={() => toggleKat(group.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.04)',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>{group.icon}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>{group.label}</span>
                  <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', padding: '1px 7px', borderRadius: 10, marginRight: '0.5rem' }}>{group.entries.length}</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', transition: 'transform .2s', display: 'inline-block', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>▼</span>
                </button>
                {/* Einträge */}
                {!isCollapsed && (
                  <div style={{ padding: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.75rem' }}>
                    {group.entries.map(entry => (
                      <EntryCard key={entry.id} entry={entry} onEdit={e => setEditEntry(e)} onDelete={e => setDeleteConfirm(e)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editEntry !== null && (
        <EditModal entry={editEntry} onSave={handleSave} onClose={() => setEditEntry(null)} />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={e => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div style={{ background: '#12121e', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 14, padding: '1.5rem', maxWidth: 380, width: '100%' }}>
            <h3 style={{ margin: '0 0 0.5rem', color: '#f87171', fontSize: '1rem' }}>Eintrag löschen</h3>
            <p style={{ margin: '0 0 1.25rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>
              <strong style={{ color: '#fff' }}>„{deleteConfirm.name}"</strong> wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ padding: '0.45rem 0.875rem', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', cursor: 'pointer' }}>
                Abbrechen
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                style={{ padding: '0.45rem 0.875rem', background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
