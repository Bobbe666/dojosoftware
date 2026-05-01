import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import '../styles/TodoPanel.css';

const PRIO_LABELS  = { dringend: '🔴 Dringend', hoch: '🟠 Hoch', normal: 'Normal', niedrig: 'Niedrig' };
const STATUS_NEXT  = { offen: 'in_bearbeitung', in_bearbeitung: 'erledigt', erledigt: 'offen' };
const STATUS_LABEL = { offen: 'Offen', in_bearbeitung: 'In Bearbeitung', erledigt: 'Erledigt' };
const KONTEXT_LABELS = {
  allgemein: 'Allgemein', lizenzen: 'Lizenzen', verband: 'Verband', hof: 'Hall of Fame', events: 'Events',
};

const EMPTY_FORM = {
  titel: '', beschreibung: '', prioritaet: 'normal',
  status: 'offen', kontext: 'allgemein', faellig_am: '', zugewiesen_an: '',
};

function formatDate(d) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date)) return null;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function isOverdue(d) {
  if (!d) return false;
  return new Date(d) < new Date(new Date().toDateString());
}

export default function TodoPanel({ compact = false, fixedKontext = null }) {
  const [todos, setTodos]         = useState([]);
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setStatusFilter] = useState('aktiv'); // aktiv | alle | erledigt
  const [prioFilter, setPrioFilter]     = useState('alle');
  const [kontextFilter, setKontextFilter] = useState(fixedKontext || 'alle');
  const [showModal, setShowModal] = useState(false);
  const [editTodo, setEditTodo]   = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
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
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [kontextFilter, prioFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTodo(null);
    setForm({ ...EMPTY_FORM, kontext: fixedKontext || 'allgemein' });
    setShowModal(true);
  };

  const openEdit = (t) => {
    setEditTodo(t);
    setForm({
      titel: t.titel, beschreibung: t.beschreibung || '',
      prioritaet: t.prioritaet, status: t.status, kontext: t.kontext,
      faellig_am: t.faellig_am ? t.faellig_am.split('T')[0] : '',
      zugewiesen_an: t.zugewiesen_an || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.titel.trim()) return;
    setSaving(true);
    try {
      if (editTodo) {
        const res = await axios.put(`/todos/${editTodo.id}`, form);
        setTodos(prev => prev.map(t => t.id === editTodo.id ? res.data.todo : t));
      } else {
        const res = await axios.post('/todos', form);
        setTodos(prev => [res.data.todo, ...prev]);
      }
      setShowModal(false);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const cycleStatus = async (todo, newStatus) => {
    try {
      await axios.patch(`/todos/${todo.id}/status`, { status: newStatus });
      setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, status: newStatus } : t));
    } catch { /* ignore */ }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Todo löschen?')) return;
    try {
      await axios.delete(`/todos/${id}`);
      setTodos(prev => prev.filter(t => t.id !== id));
    } catch { /* ignore */ }
  };

  const filtered = todos.filter(t => {
    if (statusFilter === 'aktiv')    return t.status !== 'erledigt';
    if (statusFilter === 'erledigt') return t.status === 'erledigt';
    return true;
  });

  const openCount  = todos.filter(t => t.status === 'offen').length;
  const inProgCount = todos.filter(t => t.status === 'in_bearbeitung').length;

  return (
    <div className={`todo-panel${compact ? ' todo-panel--compact' : ''}`}>

      {/* Header */}
      <div className="todo-panel-header">
        <h2 className="todo-panel-title">
          ✅ To-Do
          {openCount > 0 && <span className="todo-count-badge">{openCount} offen{inProgCount > 0 ? ` · ${inProgCount} aktiv` : ''}</span>}
        </h2>
        <button className="todo-btn-new" onClick={openCreate}>+ Neues Todo</button>
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
      ) : filtered.length === 0 ? (
        <div className="todo-empty">
          {statusFilter === 'erledigt' ? '✓ Keine erledigten Todos.' : '🎉 Alles erledigt – keine offenen Todos!'}
        </div>
      ) : (
        <div className="todo-list">
          {filtered.map(t => (
            <div key={t.id} className={`todo-card todo-card--prio-${t.prioritaet}${t.status === 'erledigt' ? ' todo-card--erledigt' : ''}`}>

              {/* Status-Cycle */}
              <div className="todo-status-cycle">
                {['offen', 'in_bearbeitung', 'erledigt'].map(s => (
                  <button key={s} className={`todo-status-pill todo-status-pill--${s}${t.status === s ? ' active-status' : ''}`}
                    onClick={() => t.status !== s && cycleStatus(t, s)}
                    title={STATUS_LABEL[s]}
                  >
                    {s === 'offen' ? '○' : s === 'in_bearbeitung' ? '◐' : '●'}
                  </button>
                ))}
              </div>

              {/* Body */}
              <div className="todo-card-body" onClick={() => openEdit(t)} style={{ cursor: 'pointer' }}>
                <p className="todo-card-titel">{t.titel}</p>
                {!compact && t.beschreibung && (
                  <p className="todo-card-desc">{t.beschreibung.slice(0, 120)}{t.beschreibung.length > 120 ? '…' : ''}</p>
                )}
                <div className="todo-card-meta">
                  {t.prioritaet !== 'normal' && t.prioritaet !== 'niedrig' && (
                    <span className={`todo-badge todo-badge--${t.prioritaet}`}>{PRIO_LABELS[t.prioritaet]}</span>
                  )}
                  {!fixedKontext && t.kontext !== 'allgemein' && (
                    <span className="todo-badge todo-badge--kontext">{KONTEXT_LABELS[t.kontext]}</span>
                  )}
                  {t.faellig_am && (
                    <span className={`todo-badge ${isOverdue(t.faellig_am) && t.status !== 'erledigt' ? 'todo-badge--due-overdue' : 'todo-badge--due'}`}>
                      📅 {formatDate(t.faellig_am)}
                    </span>
                  )}
                  {t.zugewiesen_an && (
                    <span className="todo-badge todo-badge--assignee">👤 {t.zugewiesen_an}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="todo-card-actions">
                <button className="todo-action-btn" onClick={() => openEdit(t)} title="Bearbeiten">✎</button>
                <button className="todo-action-btn todo-action-btn--del" onClick={() => handleDelete(t.id)} title="Löschen">🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal — via Portal, bypasses parent stacking contexts */}
      {showModal && createPortal(
        <div className="todo-overlay" onClick={() => setShowModal(false)}>
          <div className="todo-modal" onClick={e => e.stopPropagation()}>
            <h3 className="todo-modal-title">{editTodo ? 'Todo bearbeiten' : 'Neues Todo'}</h3>

            <div className="todo-modal-grid">
              <div className="todo-modal-field todo-modal-field--full">
                <label>Titel *</label>
                <input className="todo-modal-input" type="text" maxLength={255}
                  placeholder="Was muss erledigt werden?" autoFocus
                  value={form.titel} onChange={e => setForm(f => ({ ...f, titel: e.target.value }))} />
              </div>

              <div className="todo-modal-field todo-modal-field--full">
                <label>Beschreibung</label>
                <textarea className="todo-modal-textarea" rows={3} placeholder="Optionale Details…"
                  value={form.beschreibung} onChange={e => setForm(f => ({ ...f, beschreibung: e.target.value }))} />
              </div>

              <div className="todo-modal-field">
                <label>Priorität</label>
                <select className="todo-modal-select" value={form.prioritaet}
                  onChange={e => setForm(f => ({ ...f, prioritaet: e.target.value }))}>
                  {Object.entries(PRIO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              <div className="todo-modal-field">
                <label>Status</label>
                <select className="todo-modal-select" value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              {!fixedKontext && (
                <div className="todo-modal-field">
                  <label>Bereich</label>
                  <select className="todo-modal-select" value={form.kontext}
                    onChange={e => setForm(f => ({ ...f, kontext: e.target.value }))}>
                    {Object.entries(KONTEXT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              )}

              <div className="todo-modal-field">
                <label>Fällig am</label>
                <input className="todo-modal-input" type="date"
                  value={form.faellig_am} onChange={e => setForm(f => ({ ...f, faellig_am: e.target.value }))} />
              </div>

              <div className="todo-modal-field todo-modal-field--full">
                <label>Zugewiesen an</label>
                <select className="todo-modal-select" value={form.zugewiesen_an}
                  onChange={e => setForm(f => ({ ...f, zugewiesen_an: e.target.value }))}>
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
              <button className="todo-btn-cancel" onClick={() => setShowModal(false)}>Abbrechen</button>
              <button className="todo-btn-save" onClick={handleSave} disabled={saving || !form.titel.trim()}>
                {saving ? 'Speichert…' : editTodo ? 'Speichern' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
