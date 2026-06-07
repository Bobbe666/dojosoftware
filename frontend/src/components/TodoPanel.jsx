import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import '../styles/TodoPanel.css';

const PRIO_LABELS = {
  dringend: '🔴 Dringend', hoch: '🟠 Hoch', normal: 'Normal', niedrig: '⬇ Niedrig',
};
const STATUS_LABEL = { offen: 'Offen', in_bearbeitung: 'In Arbeit', erledigt: 'Erledigt' };
const KONTEXT_LABELS = {
  allgemein: 'Allgemein',
  finanzen: '💰 Finanzen', pruefungen: '🥋 Prüfungen', training: '🏋️ Training',
  shop: '🛒 Shop', apps: '📱 Apps', website: '🌐 Website', system: '⚙️ System',
  mitglieder: '👥 Mitglieder', setup: '🔧 Setup',
  events: '🎪 Events', hof: '🌟 Hall of Fame', verband: 'Verband', lizenzen: 'Lizenzen',
};
// Label für einen Kontext — freie Werte (z.B. "Event: Sommercamp") direkt anzeigen
const kontextLabel = (k) => KONTEXT_LABELS[k] || k;

const EMPTY_FORM = {
  titel: '', beschreibung: '', prioritaet: 'normal',
  status: 'offen', kontext: 'allgemein', faellig_am: '', zugewiesen_an: '',
};

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatDateTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function isOverdue(d) {
  if (!d) return false;
  return new Date(d) < new Date(new Date().toDateString());
}

// ── Ticket Detail Modal ───────────────────────────────────────────────────────
function TicketDetailModal({ todo, users, fixedKontext, onClose, onUpdate, onDelete }) {
  const [form, setForm] = useState({
    titel:        todo.titel,
    beschreibung: todo.beschreibung || '',
    prioritaet:   todo.prioritaet,
    status:       todo.status,
    kontext:      todo.kontext,
    faellig_am:   todo.faellig_am ? todo.faellig_am.split('T')[0] : '',
    zugewiesen_an: todo.zugewiesen_an || '',
  });
  const [dirty, setDirty]         = useState(false);
  const [saving, setSaving]       = useState(false);
  const [kommentare, setKommentare] = useState([]);
  const [komLoading, setKomLoading] = useState(true);
  const [newKom, setNewKom]       = useState('');
  const [komSaving, setKomSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const komListRef = useRef(null);

  const setField = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setDirty(true);
  };

  useEffect(() => {
    axios.get(`/todos/${todo.id}/kommentare`)
      .then(r => setKommentare(r.data.kommentare || []))
      .catch(() => {})
      .finally(() => setKomLoading(false));
  }, [todo.id]);

  // Scroll to bottom when new comment arrives
  useEffect(() => {
    if (komListRef.current && kommentare.length > 0) {
      komListRef.current.scrollTop = komListRef.current.scrollHeight;
    }
  }, [kommentare.length]);

  const handleSave = async () => {
    if (!form.titel.trim()) return;
    setSaving(true);
    try {
      const res = await axios.put(`/todos/${todo.id}`, form);
      onUpdate(res.data.todo);
      setDirty(false);
    } catch {}
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`/todos/${todo.id}`);
      onDelete(todo.id);
      onClose();
    } catch {}
  };

  const addKommentar = async () => {
    if (!newKom.trim()) return;
    setKomSaving(true);
    try {
      const res = await axios.post(`/todos/${todo.id}/kommentare`, { kommentar: newKom.trim() });
      setKommentare(prev => [...prev, res.data.kommentar]);
      setNewKom('');
    } catch {}
    finally { setKomSaving(false); }
  };

  const delKommentar = async (kid) => {
    try {
      await axios.delete(`/todos/${todo.id}/kommentare/${kid}`);
      setKommentare(prev => prev.filter(k => k.id !== kid));
    } catch {}
  };

  // Escape key closes modal
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  return createPortal(
    <div className="todo-overlay tdm-overlay" onClick={onClose}>
      <div className="tdm" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="tdm-header">
          <div className="tdm-header-left">
            <span className="tdm-ticket-nr">#{todo.id}</span>
            <div className="tdm-status-row">
              {['offen', 'in_bearbeitung', 'erledigt'].map(s => (
                <button key={s}
                  className={`tdm-status-pill tdm-sp--${s}${form.status === s ? ' tdm-sp--active' : ''}`}
                  onClick={() => setField('status', s)}>
                  {s === 'offen' ? '○ Offen' : s === 'in_bearbeitung' ? '◐ In Arbeit' : '● Erledigt'}
                </button>
              ))}
            </div>
          </div>
          <button className="tdm-close-btn" onClick={onClose} title="Schließen (Esc)">×</button>
        </div>

        {/* ── Two-column layout ── */}
        <div className="tdm-body">

          {/* Left: form */}
          <div className="tdm-left">
            <input
              className="tdm-title-input"
              value={form.titel}
              onChange={e => setField('titel', e.target.value)}
              placeholder="Titel…"
            />

            <div className="tdm-fields">
              <div className="tdm-field">
                <label>Priorität</label>
                <select className="tdm-select" value={form.prioritaet} onChange={e => setField('prioritaet', e.target.value)}>
                  {Object.entries(PRIO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              {!fixedKontext && (
                <div className="tdm-field">
                  <label>Bereich</label>
                  <select className="tdm-select" value={form.kontext} onChange={e => setField('kontext', e.target.value)}>
                    {Object.entries(KONTEXT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              )}

              <div className="tdm-field">
                <label>Fällig am</label>
                <input className="tdm-input" type="date" value={form.faellig_am}
                  onChange={e => setField('faellig_am', e.target.value)} />
              </div>

              <div className="tdm-field tdm-field--wide">
                <label>Zugewiesen an</label>
                <select className="tdm-select" value={form.zugewiesen_an} onChange={e => setField('zugewiesen_an', e.target.value)}>
                  <option value="">— Niemand —</option>
                  {users.map(u => (
                    <option key={u.id} value={`${u.vorname} ${u.nachname}`.trim()}>
                      {u.vorname} {u.nachname}
                    </option>
                  ))}
                </select>
              </div>

              {todo.erstellt_am && (
                <div className="tdm-field tdm-field--wide">
                  <label>Erstellt</label>
                  <span className="tdm-meta-val">
                    {formatDateTime(todo.erstellt_am)}
                    {(todo.vorname || todo.nachname) && ` · ${[todo.vorname, todo.nachname].filter(Boolean).join(' ')}`}
                  </span>
                </div>
              )}
            </div>

            <div className="tdm-desc-section">
              <label>Beschreibung / Bemerkungen</label>
              <textarea className="tdm-textarea" rows={5}
                placeholder="Details, Kontext, Anforderungen, Bemerkungen…"
                value={form.beschreibung}
                onChange={e => setField('beschreibung', e.target.value)}
              />
            </div>

            <div className="tdm-action-row">
              {confirmDel ? (
                <div className="tdm-confirm-del">
                  <span>Wirklich löschen?</span>
                  <button className="tdm-btn tdm-btn--danger" onClick={handleDelete}>Ja, löschen</button>
                  <button className="tdm-btn tdm-btn--ghost" onClick={() => setConfirmDel(false)}>Abbrechen</button>
                </div>
              ) : (
                <>
                  <button className="tdm-btn tdm-btn--del" onClick={() => setConfirmDel(true)}>🗑 Löschen</button>
                  <div style={{ flex: 1 }} />
                  <button
                    className={`tdm-btn tdm-btn--save${dirty ? ' tdm-btn--save-active' : ''}`}
                    onClick={handleSave}
                    disabled={saving || !form.titel.trim()}
                  >
                    {saving ? 'Speichert…' : dirty ? '💾 Speichern' : '✓ Gespeichert'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right: comments */}
          <div className="tdm-right">
            <div className="tdm-comments-header">
              💬 Kommentare
              {kommentare.length > 0 && <span className="tdm-kom-count">{kommentare.length}</span>}
            </div>

            <div className="tdm-kom-list" ref={komListRef}>
              {komLoading ? (
                <div className="tdm-kom-loading">Lädt…</div>
              ) : kommentare.length === 0 ? (
                <div className="tdm-kom-empty">Noch keine Kommentare.</div>
              ) : (
                kommentare.map(k => (
                  <div key={k.id} className="tdm-kom-item">
                    <div className="tdm-kom-meta">
                      <span className="tdm-kom-author">{k.autor_name || 'Unbekannt'}</span>
                      <span className="tdm-kom-date">{formatDateTime(k.erstellt_am)}</span>
                      <button className="tdm-kom-del" onClick={() => delKommentar(k.id)} title="Löschen">×</button>
                    </div>
                    <div className="tdm-kom-body">{k.kommentar}</div>
                  </div>
                ))
              )}
            </div>

            <div className="tdm-kom-add">
              <textarea
                className="tdm-textarea tdm-kom-textarea"
                rows={3}
                placeholder="Kommentar schreiben… (Strg+Enter senden)"
                value={newKom}
                onChange={e => setNewKom(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addKommentar(); }}
              />
              <button
                className="tdm-btn tdm-btn--send"
                onClick={addKommentar}
                disabled={komSaving || !newKom.trim()}
              >
                {komSaving ? '…' : '↑ Senden'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TodoPanel({ compact = false, fixedKontext = null }) {
  const [todos, setTodos]           = useState([]);
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState(null);
  const [statusFilter, setStatusFilter] = useState('aktiv');
  const [prioFilter, setPrioFilter]     = useState('alle');
  const [kontextFilter, setKontextFilter] = useState(fixedKontext || 'alle');
  const [detailTodo, setDetailTodo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [creating, setCreating]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = {};
      if (kontextFilter !== 'alle') params.kontext = kontextFilter;
      if (prioFilter    !== 'alle') params.prioritaet = prioFilter;
      const [todosRes, usersRes] = await Promise.all([
        axios.get('/todos', { params }),
        axios.get('/todos/users'),
      ]);
      setTodos(todosRes.data.todos || []);
      setUsers(usersRes.data.users || []);
    } catch (err) {
      setLoadError(err?.response?.data?.error || err?.message || 'Fehler beim Laden');
    }
    finally { setLoading(false); }
  }, [kontextFilter, prioFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setCreateForm({ ...EMPTY_FORM, kontext: fixedKontext || 'allgemein' });
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!createForm.titel.trim()) return;
    setCreating(true);
    try {
      const res = await axios.post('/todos', createForm);
      setTodos(prev => [res.data.todo, ...prev]);
      setShowCreate(false);
    } catch {}
    finally { setCreating(false); }
  };

  const handleUpdate = (updated) => {
    setTodos(prev => prev.map(t => t.id === updated.id ? updated : t));
    if (detailTodo?.id === updated.id) setDetailTodo(updated);
  };

  const handleDelete = (id) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    setDetailTodo(null);
  };

  const cycleStatus = async (todo, newStatus) => {
    try {
      await axios.patch(`/todos/${todo.id}/status`, { status: newStatus });
      setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, status: newStatus } : t));
    } catch {}
  };

  const filtered = todos.filter(t => {
    if (statusFilter === 'aktiv')    return t.status !== 'erledigt';
    if (statusFilter === 'erledigt') return t.status === 'erledigt';
    return true;
  });

  const openCount   = todos.filter(t => t.status === 'offen').length;
  const inProgCount = todos.filter(t => t.status === 'in_bearbeitung').length;

  return (
    <div className={`todo-panel${compact ? ' todo-panel--compact' : ''}`}>

      {/* Header */}
      <div className="todo-panel-header">
        <h2 className="todo-panel-title">
          <span className="todo-title-icon">✅</span> To-Do
          {openCount > 0 && (
            <span className="todo-count-badge">
              {openCount} offen{inProgCount > 0 ? ` · ${inProgCount} aktiv` : ''}
            </span>
          )}
        </h2>
        <button className="todo-btn-new" onClick={openCreate}>+ Neues Ticket</button>
      </div>

      {/* Filter */}
      <div className="todo-filters">
        <div className="todo-status-tabs">
          {[['aktiv', 'Aktiv'], ['alle', 'Alle'], ['erledigt', 'Erledigt']].map(([v, l]) => (
            <button key={v} className={`todo-status-tab${statusFilter === v ? ' active' : ''}`}
              onClick={() => setStatusFilter(v)}>{l}</button>
          ))}
        </div>
        <select className="todo-filter-select" value={prioFilter} onChange={e => setPrioFilter(e.target.value)}>
          <option value="alle">Alle Prioritäten</option>
          {Object.entries(PRIO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {!fixedKontext && (
          <select className="todo-filter-select" value={kontextFilter} onChange={e => setKontextFilter(e.target.value)}>
            <option value="alle">Alle Bereiche</option>
            {Object.entries(KONTEXT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Lädt…</div>
      ) : loadError ? (
        <div style={{ padding: '1.5rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)', borderRadius: 8, margin: '1rem 0' }}>
          ⚠️ Fehler beim Laden: {loadError}
          <button onClick={load} style={{ marginLeft: 12, color: '#ffd700', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Erneut versuchen
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="todo-empty">
          {statusFilter === 'erledigt'
            ? '✓ Keine erledigten Tickets.'
            : todos.length > 0
              ? '✓ Alle Tickets erledigt — super!'
              : '✅ Noch keine Tickets. Erstell das erste mit "+ Neues Ticket".'}
        </div>
      ) : (
        <div className="todo-list">
          {filtered.map(t => (
            <div
              key={t.id}
              className={`todo-card todo-card--prio-${t.prioritaet}${t.status === 'erledigt' ? ' todo-card--erledigt' : ''}`}
            >
              {/* Status-Cycle */}
              <div className="todo-status-cycle">
                {['offen', 'in_bearbeitung', 'erledigt'].map(s => (
                  <button key={s}
                    className={`todo-status-pill todo-status-pill--${s}${t.status === s ? ' active-status' : ''}`}
                    onClick={() => t.status !== s && cycleStatus(t, s)}
                    title={STATUS_LABEL[s]}>
                    {s === 'offen' ? '○' : s === 'in_bearbeitung' ? '◐' : '●'}
                  </button>
                ))}
              </div>

              {/* Body — click opens detail */}
              <div className="todo-card-body" onClick={() => setDetailTodo(t)} style={{ cursor: 'pointer' }}>
                <div className="todo-card-title-row">
                  <span className="todo-card-nr">#{t.id}</span>
                  <p className="todo-card-titel">{t.titel}</p>
                </div>
                {!compact && t.beschreibung && (
                  <p className="todo-card-desc">
                    {t.beschreibung.slice(0, 120)}{t.beschreibung.length > 120 ? '…' : ''}
                  </p>
                )}
                <div className="todo-card-meta">
                  {t.prioritaet !== 'normal' && t.prioritaet !== 'niedrig' && (
                    <span className={`todo-badge todo-badge--${t.prioritaet}`}>{PRIO_LABELS[t.prioritaet]}</span>
                  )}
                  {!fixedKontext && t.kontext !== 'allgemein' && (
                    <span className="todo-badge todo-badge--kontext">{kontextLabel(t.kontext)}</span>
                  )}
                  {t.faellig_am && (
                    <span className={`todo-badge ${isOverdue(t.faellig_am) && t.status !== 'erledigt' ? 'todo-badge--due-overdue' : 'todo-badge--due'}`}>
                      📅 {formatDate(t.faellig_am)}
                    </span>
                  )}
                  {t.zugewiesen_an && (
                    <span className="todo-badge todo-badge--assignee">👤 {t.zugewiesen_an}</span>
                  )}
                  {t.kommentar_count > 0 && (
                    <span className="todo-badge todo-badge--comments">💬 {t.kommentar_count}</span>
                  )}
                </div>
              </div>

              {/* Open detail button */}
              <div className="todo-card-actions">
                <button className="todo-action-btn" onClick={() => setDetailTodo(t)} title="Öffnen">↗</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ticket Detail Modal */}
      {detailTodo && (
        <TicketDetailModal
          todo={detailTodo}
          users={users}
          fixedKontext={fixedKontext}
          onClose={() => setDetailTodo(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}

      {/* Create Modal (simple, no comments) */}
      {showCreate && createPortal(
        <div className="todo-overlay" onClick={() => setShowCreate(false)}>
          <div className="todo-modal" onClick={e => e.stopPropagation()}>
            <h3 className="todo-modal-title">Neues Ticket erstellen</h3>

            <div className="todo-modal-grid">
              <div className="todo-modal-field todo-modal-field--full">
                <label>Titel *</label>
                <input className="todo-modal-input" type="text" maxLength={255}
                  placeholder="Was muss erledigt werden?" autoFocus
                  value={createForm.titel}
                  onChange={e => setCreateForm(f => ({ ...f, titel: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
              </div>

              <div className="todo-modal-field todo-modal-field--full">
                <label>Beschreibung / Bemerkungen</label>
                <textarea className="todo-modal-textarea" rows={3} placeholder="Optionale Details…"
                  value={createForm.beschreibung}
                  onChange={e => setCreateForm(f => ({ ...f, beschreibung: e.target.value }))}
                />
              </div>

              <div className="todo-modal-field">
                <label>Priorität</label>
                <select className="todo-modal-select" value={createForm.prioritaet}
                  onChange={e => setCreateForm(f => ({ ...f, prioritaet: e.target.value }))}>
                  {Object.entries(PRIO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              {!fixedKontext && (
                <div className="todo-modal-field">
                  <label>Bereich</label>
                  <select className="todo-modal-select" value={createForm.kontext}
                    onChange={e => setCreateForm(f => ({ ...f, kontext: e.target.value }))}>
                    {Object.entries(KONTEXT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              )}

              <div className="todo-modal-field">
                <label>Fällig am</label>
                <input className="todo-modal-input" type="date"
                  value={createForm.faellig_am}
                  onChange={e => setCreateForm(f => ({ ...f, faellig_am: e.target.value }))}
                />
              </div>

              <div className="todo-modal-field todo-modal-field--full">
                <label>Zugewiesen an</label>
                <select className="todo-modal-select" value={createForm.zugewiesen_an}
                  onChange={e => setCreateForm(f => ({ ...f, zugewiesen_an: e.target.value }))}>
                  <option value="">— Niemand —</option>
                  {users.map(u => (
                    <option key={u.id} value={`${u.vorname} ${u.nachname}`.trim()}>
                      {u.vorname} {u.nachname} ({u.rolle})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="todo-modal-footer">
              <button className="todo-btn-cancel" onClick={() => setShowCreate(false)}>Abbrechen</button>
              <button className="todo-btn-save" onClick={handleCreate}
                disabled={creating || !createForm.titel.trim()}>
                {creating ? 'Erstellt…' : '+ Ticket erstellen'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
