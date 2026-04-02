import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import '../styles/GuertelMassenzuweisung.css';

function GuertelMassenzuweisung() {
  const navigate = useNavigate();
  const { activeDojo } = useDojoContext();

  const [stile, setStile] = useState([]);
  const [selectedStilId, setSelectedStilId] = useState('');
  const [graduierungen, setGraduierungen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [pendingChanges, setPendingChanges] = useState({});
  const [viewMode, setViewMode] = useState('tabelle'); // 'tabelle' | 'karten'
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'unassigned' | 'assigned'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [error, setError] = useState('');
  const [sortField, setSortField] = useState('nachname');
  const [sortDir, setSortDir] = useState('asc');

  // Drag & Drop state
  const draggedMemberRef = useRef(null);
  const [dragOverColId, setDragOverColId] = useState(null); // null | 'unassigned' | graduierung_id

  const withDojo = useCallback((url) => {
    if (!activeDojo) return url;
    if (typeof activeDojo === 'string') return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}dojo_id=${activeDojo.id}`;
  }, [activeDojo]);

  // Stile laden (aus Gürtel-Übersicht)
  useEffect(() => {
    axios.get(withDojo('/stile/auswertungen/guertel-uebersicht'))
      .then(res => {
        if (res.data?.stile) {
          setStile(res.data.stile);
          if (res.data.stile.length > 0) {
            setSelectedStilId(String(res.data.stile[0].stil_id));
          }
        }
      })
      .catch(() => setError('Stile konnten nicht geladen werden.'));
  }, [withDojo]);

  // Graduierungen aus gewähltem Stil
  useEffect(() => {
    if (!selectedStilId) return;
    const stil = stile.find(s => String(s.stil_id) === selectedStilId);
    if (stil) setGraduierungen(stil.guertel || []);
  }, [selectedStilId, stile]);

  // Mitglieder für gewählten Stil laden
  useEffect(() => {
    if (!selectedStilId) return;
    setLoading(true);
    setError('');
    setPendingChanges({});
    axios.get(withDojo(`/mitglieder/zuweisung/stil/${selectedStilId}`))
      .then(res => {
        if (res.data?.mitglieder) setMitglieder(res.data.mitglieder);
        else setMitglieder([]);
      })
      .catch(() => setError('Mitglieder konnten nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, [selectedStilId, withDojo]);

  // Gefilterte + durchsuchte Mitglieder
  const filteredMitglieder = mitglieder.filter(m => {
    const fullName = `${m.vorname} ${m.nachname}`.toLowerCase();
    if (searchQuery && !fullName.includes(searchQuery.toLowerCase())) return false;
    if (filterMode === 'unassigned') return !m.current_graduierung_id && !pendingChanges[m.mitglied_id];
    if (filterMode === 'assigned') return !!(m.current_graduierung_id || pendingChanges[m.mitglied_id]);
    return true;
  });

  const pendingCount = Object.keys(pendingChanges).length;

  const handleGraduierungChange = (mitgliedId, graduierungId) => {
    setPendingChanges(prev => {
      const updated = { ...prev };
      // Wenn neue Wahl = aktueller Wert → Änderung aufheben
      const member = mitglieder.find(m => m.mitglied_id === mitgliedId);
      if (member && String(member.current_graduierung_id) === String(graduierungId)) {
        delete updated[mitgliedId];
      } else {
        updated[mitgliedId] = parseInt(graduierungId, 10);
      }
      return updated;
    });
  };

  const handleSave = async () => {
    if (pendingCount === 0) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const assignments = Object.entries(pendingChanges).map(([mitgliedId, graduierungId]) => ({
        mitglied_id: parseInt(mitgliedId, 10),
        graduierung_id: graduierungId,
      }));
      const res = await axios.post(withDojo('/mitglieder/bulk-graduierung'), {
        stil_id: parseInt(selectedStilId, 10),
        assignments,
      });
      if (res.data?.success) {
        setSaveMsg(`✓ ${res.data.total} Zuweisungen gespeichert`);
        // Mitglieder local updaten
        setMitglieder(prev => prev.map(m => {
          if (pendingChanges[m.mitglied_id]) {
            const grad = graduierungen.find(g => g.graduierung_id === pendingChanges[m.mitglied_id]);
            return {
              ...m,
              current_graduierung_id: pendingChanges[m.mitglied_id],
              graduierung_name: grad?.gurt_name || '',
              farbe_hex: grad?.farbe_hex || null,
            };
          }
          return m;
        }));
        setPendingChanges({});
        setTimeout(() => setSaveMsg(''), 4000);
      }
    } catch {
      setError('Fehler beim Speichern. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  };

  // ── DRAG & DROP HANDLER ──────────────────────────────────────────────────────

  const handleDragStart = (e, mitgliedId) => {
    draggedMemberRef.current = mitgliedId;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColId(colId);
  };

  const handleDragLeave = (e) => {
    // nur zurücksetzen wenn wir wirklich die Spalte verlassen (nicht nur ein Kind-Element)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverColId(null);
    }
  };

  const handleDrop = (e, graduierungId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColId(null);
    const mitgliedId = draggedMemberRef.current;
    if (!mitgliedId) return;
    handleGraduierungChange(mitgliedId, graduierungId);
    draggedMemberRef.current = null;
  };

  const handleDropUnassigned = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColId(null);
    const mitgliedId = draggedMemberRef.current;
    if (!mitgliedId) return;
    // "Kein Gürtel" → Änderung aufheben (zurück zu Original)
    setPendingChanges(prev => {
      const updated = { ...prev };
      delete updated[mitgliedId];
      return updated;
    });
    draggedMemberRef.current = null;
  };

  // Effektiver Gürtel eines Mitglieds (pending oder aktuell)
  const getEffectiveGraduierungId = (m) =>
    pendingChanges[m.mitglied_id] !== undefined
      ? pendingChanges[m.mitglied_id]
      : m.current_graduierung_id;

  const getGradInfo = (graduierungId) =>
    graduierungen.find(g => g.graduierung_id === graduierungId);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedMitglieder = [...filteredMitglieder].sort((a, b) => {
    let aVal, bVal;
    if (sortField === 'nachname') {
      aVal = `${a.nachname} ${a.vorname}`.toLowerCase();
      bVal = `${b.nachname} ${b.vorname}`.toLowerCase();
    } else if (sortField === 'vorname') {
      aVal = `${a.vorname} ${a.nachname}`.toLowerCase();
      bVal = `${b.vorname} ${b.nachname}`.toLowerCase();
    } else if (sortField === 'guertel') {
      aVal = getEffectiveGraduierungId(a) ? (getGradInfo(getEffectiveGraduierungId(a))?.reihenfolge ?? 9999) : 9999;
      bVal = getEffectiveGraduierungId(b) ? (getGradInfo(getEffectiveGraduierungId(b))?.reihenfolge ?? 9999) : 9999;
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    } else if (sortField === 'status') {
      aVal = pendingChanges[a.mitglied_id] !== undefined ? 2 : a.current_graduierung_id ? 1 : 0;
      bVal = pendingChanges[b.mitglied_id] !== undefined ? 2 : b.current_graduierung_id ? 1 : 0;
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    } else {
      return 0;
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const SortArrow = ({ field }) => {
    if (sortField !== field) return <span className="gm-sort-arrow gm-sort-arrow--inactive">↕</span>;
    return <span className="gm-sort-arrow">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  // ── KANBAN (DRAG & DROP) LAYOUT ─────────────────────────────────────────────

  const unassignedMembers = filteredMitglieder.filter(
    m => !getEffectiveGraduierungId(m)
  );

  // ── RENDER ───────────────────────────────────────────────────────────────────

  return (
    <div className="gm-container">
      {/* Header */}
      <div className="gm-page-header">
        <button className="gm-back-btn" onClick={() => navigate('/dashboard/auswertungen')}>
          ← Zurück
        </button>
        <h1 className="gm-title">⚡ Gürtel Massenzuweisung</h1>
        <p className="gm-subtitle">
          Weise allen Mitgliedern auf einmal die richtigen Gürtelgrade zu
        </p>
      </div>

      {/* Controls */}
      <div className="gm-controls">
        <div className="gm-control-row">
          <div className="gm-field">
            <label className="gm-label">Kampfstil</label>
            <select
              className="gm-select"
              value={selectedStilId}
              onChange={e => setSelectedStilId(e.target.value)}
            >
              {stile.map(s => (
                <option key={s.stil_id} value={s.stil_id}>{s.stil_name}</option>
              ))}
            </select>
          </div>

          <div className="gm-field">
            <label className="gm-label">Ansicht</label>
            <div className="gm-view-toggle">
              <button
                className={`gm-view-btn${viewMode === 'tabelle' ? ' active' : ''}`}
                onClick={() => setViewMode('tabelle')}
              >
                📋 Tabelle
              </button>
              <button
                className={`gm-view-btn${viewMode === 'karten' ? ' active' : ''}`}
                onClick={() => setViewMode('karten')}
              >
                🃏 Drag & Drop
              </button>
            </div>
          </div>

          <div className="gm-field">
            <label className="gm-label">Filter</label>
            <div className="gm-filter-toggle">
              <button className={`gm-filter-btn${filterMode === 'all' ? ' active' : ''}`} onClick={() => setFilterMode('all')}>Alle</button>
              <button className={`gm-filter-btn${filterMode === 'unassigned' ? ' active' : ''}`} onClick={() => setFilterMode('unassigned')}>Ohne Gürtel</button>
              <button className={`gm-filter-btn${filterMode === 'assigned' ? ' active' : ''}`} onClick={() => setFilterMode('assigned')}>Mit Gürtel</button>
            </div>
          </div>

          <div className="gm-field gm-search-field">
            <label className="gm-label">Suche</label>
            <input
              className="gm-input"
              type="text"
              placeholder="Name suchen..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Status-Bar */}
      {(pendingCount > 0 || saveMsg || error) && (
        <div className={`gm-status-bar${error ? ' gm-status-bar--error' : ''}`}>
          {error ? (
            <span>{error}</span>
          ) : saveMsg ? (
            <span className="gm-save-msg">{saveMsg}</span>
          ) : (
            <span>{pendingCount} Änderung{pendingCount !== 1 ? 'en' : ''} ausstehend</span>
          )}
          {pendingCount > 0 && !error && (
            <button className="gm-save-btn" onClick={handleSave} disabled={saving}>
              {saving ? '⏳ Speichern...' : `💾 ${pendingCount} speichern`}
            </button>
          )}
          {error && (
            <button className="gm-dismiss-btn" onClick={() => setError('')}>✕</button>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="gm-loading">
          <div className="gm-spinner" />
          <span>Mitglieder werden geladen...</span>
        </div>
      ) : filteredMitglieder.length === 0 ? (
        <div className="gm-empty">
          <span className="gm-empty-icon">👤</span>
          <p>Keine Mitglieder gefunden</p>
          <small>Bitte Stil oder Filter anpassen.</small>
        </div>
      ) : viewMode === 'tabelle' ? (
        // ── TABELLEN-ANSICHT ──────────────────────────────────────────────────
        <div className="gm-table-wrap">
          <table className="gm-table">
            <thead>
              <tr>
                <th className="gm-th-sortable" onClick={() => handleSort('nachname')}>
                  Name <SortArrow field="nachname" />
                </th>
                <th className="gm-th-sortable" onClick={() => handleSort('guertel')}>
                  Aktueller Gürtel <SortArrow field="guertel" />
                </th>
                <th>Neuer Gürtel</th>
                <th className="gm-th-sortable" onClick={() => handleSort('status')}>
                  Status <SortArrow field="status" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedMitglieder.map(m => {
                const hasPending = pendingChanges[m.mitglied_id] !== undefined;
                const effectiveId = getEffectiveGraduierungId(m);
                const gradInfo = getGradInfo(effectiveId);
                return (
                  <tr key={m.mitglied_id} className={hasPending ? 'gm-row--pending' : ''}>
                    <td className="gm-cell-name">
                      {m.nachname}, {m.vorname}
                    </td>
                    <td className="gm-cell-current">
                      {m.current_graduierung_id ? (
                        <div className="gm-belt-display">
                          {m.farbe_hex && (
                            <span
                              className="gm-belt-dot"
                              style={{ background: m.farbe_hex }}
                            />
                          )}
                          <span>{m.graduierung_name || '—'}</span>
                        </div>
                      ) : (
                        <span className="gm-no-belt">Kein Gürtel</span>
                      )}
                    </td>
                    <td className="gm-cell-select">
                      <select
                        className={`gm-grad-select${hasPending ? ' gm-grad-select--changed' : ''}`}
                        value={effectiveId || ''}
                        onChange={e => handleGraduierungChange(m.mitglied_id, e.target.value)}
                      >
                        <option value="">— kein Gürtel —</option>
                        {graduierungen.map(g => (
                          <option key={g.graduierung_id} value={g.graduierung_id}>
                            {g.gurt_name}{g.dan_grad ? ` (${g.dan_grad}. Dan)` : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="gm-cell-status">
                      {hasPending ? (
                        <span className="gm-badge gm-badge--changed">
                          ✎ Geändert
                        </span>
                      ) : m.current_graduierung_id ? (
                        <span className="gm-badge gm-badge--ok">✓ Zugewiesen</span>
                      ) : (
                        <span className="gm-badge gm-badge--missing">○ Offen</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        // ── DRAG & DROP KANBAN ANSICHT ────────────────────────────────────────
        <div className="gm-kanban">
          {/* Spalte: Nicht zugewiesen */}
          <div
            className={`gm-kanban-col gm-kanban-col--unassigned${dragOverColId === 'unassigned' ? ' drag-over' : ''}`}
            onDragOver={e => handleDragOver(e, 'unassigned')}
            onDragLeave={handleDragLeave}
            onDrop={handleDropUnassigned}
          >
            <div className="gm-kanban-col-header">
              <span className="gm-kanban-dot gm-kanban-dot--empty" />
              <span className="gm-kanban-col-title">Kein Gürtel</span>
              <span className="gm-kanban-count">{unassignedMembers.length}</span>
            </div>
            <div
              className="gm-kanban-cards"
              onDragOver={e => handleDragOver(e, 'unassigned')}
            >
              {unassignedMembers.map(m => (
                <div
                  key={m.mitglied_id}
                  className={`gm-member-card${pendingChanges[m.mitglied_id] !== undefined ? ' gm-member-card--pending' : ''}`}
                  draggable
                  onDragStart={e => handleDragStart(e, m.mitglied_id)}
                  onDragOver={e => handleDragOver(e, 'unassigned')}
                >
                  <span className="gm-card-name">{m.vorname} {m.nachname}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Gürtel-Spalten */}
          {graduierungen.map(g => {
            const membersInCol = filteredMitglieder.filter(
              m => getEffectiveGraduierungId(m) === g.graduierung_id
            );
            return (
              <div
                key={g.graduierung_id}
                className={`gm-kanban-col${dragOverColId === g.graduierung_id ? ' drag-over' : ''}`}
                onDragOver={e => handleDragOver(e, g.graduierung_id)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, g.graduierung_id)}
              >
                <div className="gm-kanban-col-header">
                  <span
                    className="gm-kanban-dot"
                    style={{ background: g.farbe_hex || '#6b7280' }}
                  />
                  <span className="gm-kanban-col-title">
                    {g.gurt_name}
                    {g.dan_grad ? <small> {g.dan_grad}. Dan</small> : null}
                  </span>
                  <span className="gm-kanban-count">{membersInCol.length}</span>
                </div>
                <div
                  className="gm-kanban-cards"
                  onDragOver={e => handleDragOver(e, g.graduierung_id)}
                >
                  {membersInCol.map(m => (
                    <div
                      key={m.mitglied_id}
                      className={`gm-member-card${pendingChanges[m.mitglied_id] !== undefined ? ' gm-member-card--pending' : ''}`}
                      draggable
                      onDragStart={e => handleDragStart(e, m.mitglied_id)}
                      onDragOver={e => handleDragOver(e, g.graduierung_id)}
                    >
                      <span className="gm-card-name">{m.vorname} {m.nachname}</span>
                      {pendingChanges[m.mitglied_id] !== undefined && (
                        <span className="gm-card-changed">✎</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Save Button wenn Änderungen vorhanden */}
      {pendingCount > 0 && (
        <div className="gm-floating-save">
          <button className="gm-floating-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? '⏳' : '💾'} {pendingCount} Änderung{pendingCount !== 1 ? 'en' : ''} speichern
          </button>
        </div>
      )}
    </div>
  );
}

export default GuertelMassenzuweisung;
