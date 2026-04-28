import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useDojoContext } from '../context/DojoContext';
import { useSubscription } from '../context/SubscriptionContext';
import './TrainingDashboard.css';

const TRAINER_APP_URL = 'https://trainer.tda-intl.org';
const DOJO_API_BASE   = 'https://dojo.tda-intl.org';

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 8); }
function formatShort(s) {
  const m = Math.floor(s / 60), sec = s % 60;
  if (m > 0 && sec > 0) return `${m}'${sec}"`;
  if (m > 0) return `${m}'`;
  return `${sec}"`;
}

const CATEGORIES = [
  { id: 'kickboxen', label: 'Kickboxen', short: 'KB', color: '#d42b2b', dim: 'rgba(212,43,43,0.12)', border: 'rgba(212,43,43,0.3)' },
  { id: 'cardio',   label: 'Cardio',    short: 'CA', color: '#e0701a', dim: 'rgba(224,112,26,0.12)', border: 'rgba(224,112,26,0.3)' },
  { id: 'core',     label: 'Core',      short: 'CO', color: '#9333ea', dim: 'rgba(147,51,234,0.12)', border: 'rgba(147,51,234,0.3)' },
  { id: 'kraft',    label: 'Kraft',     short: 'KR', color: '#1a8a9a', dim: 'rgba(26,138,154,0.12)', border: 'rgba(26,138,154,0.3)' },
  { id: 'zirkel',  label: 'Zirkel',   short: 'ZK', color: '#3b82f6', dim: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)' },
];

const DEFAULT_PRESETS = {
  kickboxen: [
    { id: 'KB1', name: 'KB1', workTime: 120, restTime: 60,  rounds: 6  },
    { id: 'KB2', name: 'KB2', workTime: 180, restTime: 60,  rounds: 5  },
    { id: 'KB3', name: 'KB3', workTime: 90,  restTime: 45,  rounds: 8  },
    { id: 'KB4', name: 'KB4', workTime: 60,  restTime: 30,  rounds: 10 },
    { id: 'KB5', name: 'KB5', workTime: 300, restTime: 90,  rounds: 3  },
    { id: 'KB6', name: 'KB6', workTime: 45,  restTime: 15,  rounds: 12 },
  ],
  cardio: [
    { id: 'CA1', name: 'CA1', workTime: 60,  restTime: 20,  rounds: 10 },
    { id: 'CA2', name: 'CA2', workTime: 30,  restTime: 10,  rounds: 20 },
    { id: 'CA3', name: 'CA3', workTime: 40,  restTime: 20,  rounds: 15 },
    { id: 'CA4', name: 'CA4', workTime: 120, restTime: 30,  rounds: 5  },
    { id: 'CA5', name: 'CA5', workTime: 20,  restTime: 10,  rounds: 20 },
    { id: 'CA6', name: 'CA6', workTime: 45,  restTime: 15,  rounds: 8  },
  ],
  core: [
    { id: 'CO1', name: 'CO1', workTime: 40,  restTime: 20,  rounds: 8  },
    { id: 'CO2', name: 'CO2', workTime: 30,  restTime: 15,  rounds: 10 },
    { id: 'CO3', name: 'CO3', workTime: 60,  restTime: 30,  rounds: 6  },
    { id: 'CO4', name: 'CO4', workTime: 45,  restTime: 15,  rounds: 8  },
    { id: 'CO5', name: 'CO5', workTime: 20,  restTime: 10,  rounds: 15 },
    { id: 'CO6', name: 'CO6', workTime: 90,  restTime: 30,  rounds: 5  },
  ],
  kraft: [
    { id: 'KR1', name: 'KR1', workTime: 45,  restTime: 90,  rounds: 5  },
    { id: 'KR2', name: 'KR2', workTime: 60,  restTime: 120, rounds: 4  },
    { id: 'KR3', name: 'KR3', workTime: 30,  restTime: 60,  rounds: 6  },
    { id: 'KR4', name: 'KR4', workTime: 40,  restTime: 90,  rounds: 5  },
    { id: 'KR5', name: 'KR5', workTime: 20,  restTime: 60,  rounds: 8  },
    { id: 'KR6', name: 'KR6', workTime: 60,  restTime: 180, rounds: 3  },
  ],
  zirkel: [
    { id: 'ZK1', name: 'ZK1', type: 'zirkel', mode: 'sequence', participants: 6,
      exercises: [
        { id: uid(), name: 'Liegestütze', workTime: 60, restTime: 20 },
        { id: uid(), name: 'Situps',      workTime: 60, restTime: 20 },
        { id: uid(), name: 'Squats',      workTime: 60, restTime: 20 },
        { id: uid(), name: 'Burpees',     workTime: 45, restTime: 20 },
      ],
    },
    { id: 'ZK2', name: 'ZK2', type: 'zirkel', mode: 'circuit',
      participants: 6, workTime: 60, restTime: 15, rounds: 2,
      exercises: ['Liegestütze', 'Situps', 'Squats', 'Burpees', 'Plank', 'Seilspringen'],
    },
    { id: 'ZK3', name: 'ZK3', type: 'zirkel', mode: 'sequence', participants: 6,
      exercises: [
        { id: uid(), name: 'Plank',            workTime: 45, restTime: 15 },
        { id: uid(), name: 'Russian Twist',    workTime: 45, restTime: 15 },
        { id: uid(), name: 'Mountain Climber', workTime: 45, restTime: 15 },
        { id: uid(), name: 'Crunches',         workTime: 45, restTime: 15 },
      ],
    },
  ],
};

// ── Preset Card Info ──────────────────────────────────────────────────────────
function presetCardInfo(p) {
  if (p.type === 'zirkel') {
    if (p.mode === 'sequence') {
      const total = (p.exercises || []).reduce((s, e) => s + Number(e.workTime) + Number(e.restTime), 0);
      return { line1: `${p.participants || 1} TN · ${(p.exercises || []).length} Übungen`, line2: `~${Math.round(total / 60)} min` };
    }
    return {
      line1: `${(p.exercises || []).length} Stationen · ${formatShort(p.workTime)}/St.`,
      line2: `${p.rounds} Runden`,
    };
  }
  return {
    line1: `${formatShort(p.workTime)} Arbeit / ${p.rounds} Runden`,
    line2: `Pause: ${p.restTime > 0 ? formatShort(p.restTime) : '–'}`,
  };
}

// ── Edit-Modal: Reguläres Preset ──────────────────────────────────────────────
function EditRegularModal({ preset, accentColor, onSave, onDelete, onCancel }) {
  const [name, setName]         = useState(preset.name ?? '');
  const [workTime, setWorkTime] = useState(preset.workTime ?? 60);
  const [restTime, setRestTime] = useState(preset.restTime ?? 30);
  const [rounds, setRounds]     = useState(preset.rounds ?? 5);
  const [confirmDel, setConfirmDel] = useState(false);

  function save() {
    onSave({ ...preset, name: name.trim() || preset.id,
      workTime: Math.max(5, Number(workTime)),
      restTime: Math.max(0, Number(restTime)),
      rounds:   Math.max(1, Number(rounds)),
    });
  }

  return (
    <div className="td-overlay" onClick={onCancel}>
      <div className="td-modal" onClick={e => e.stopPropagation()}>
        <div className="td-modal-header">
          <span className="td-modal-id" style={{ color: accentColor }}>{preset.id}</span>
          <span className="td-modal-title">Preset bearbeiten</span>
        </div>
        <div className="td-modal-body">
          <div className="td-field">
            <span>Name</span>
            <input type="text" maxLength={12} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="td-field">
            <span>Arbeitszeit</span>
            <div className="td-time-row">
              <input type="number" min="5" max="600" step="5" value={workTime} onChange={e => setWorkTime(e.target.value)} />
              <span>Sekunden</span>
            </div>
          </div>
          <div className="td-field">
            <span>Pausenzeit</span>
            <div className="td-time-row">
              <input type="number" min="0" max="300" step="5" value={restTime} onChange={e => setRestTime(e.target.value)} />
              <span>Sekunden</span>
            </div>
          </div>
          <div className="td-field">
            <span>Runden</span>
            <div className="td-time-row">
              <input type="number" min="1" max="50" value={rounds} onChange={e => setRounds(e.target.value)} />
            </div>
          </div>
          <div className="td-summary">
            Gesamtzeit: ~{Math.round((Number(workTime) + Number(restTime)) * Number(rounds) / 60)} min
          </div>
        </div>
        <div className="td-modal-footer">
          <button className="td-btn-cancel" onClick={onCancel}>Abbrechen</button>
          <button className="td-btn-save" style={{ background: accentColor }} onClick={save}>Speichern</button>
        </div>
        {onDelete && (
          <div className="td-delete-row">
            {confirmDel ? (
              <>
                <span className="td-del-text">Löschen?</span>
                <button className="td-btn-del-confirm" onClick={onDelete}>Ja, löschen</button>
                <button className="td-btn-del" onClick={() => setConfirmDel(false)}>Nein</button>
              </>
            ) : (
              <button className="td-btn-del" onClick={() => setConfirmDel(true)}>🗑 Preset löschen</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Edit-Modal: Zirkel Preset ─────────────────────────────────────────────────
function EditZirkelModal({ preset, accentColor, onSave, onDelete, onCancel }) {
  const [mode, setMode]                 = useState(preset.mode ?? 'sequence');
  const [name, setName]                 = useState(preset.name ?? '');
  const [seqParticipants, setSeqParticipants] = useState(preset.participants ?? 6);
  const [exercises, setExercises]       = useState(
    (preset.exercises ?? []).map(e =>
      typeof e === 'string' ? { id: uid(), name: e, workTime: 60, restTime: 20 }
                            : { id: e.id ?? uid(), name: e.name, workTime: e.workTime, restTime: e.restTime }
    )
  );
  const [workTime, setWorkTime] = useState(preset.workTime ?? 60);
  const [restTime, setRestTime] = useState(preset.restTime ?? 15);
  const [rounds, setRounds]     = useState(preset.rounds ?? 2);
  const [stations, setStations] = useState(
    preset.mode === 'circuit' ? (preset.exercises ?? []) : Array.from({ length: preset.participants ?? 6 }, (_, i) => `Station ${i + 1}`)
  );
  const [confirmDel, setConfirmDel] = useState(false);

  function updateEx(id, field, val) { setExercises(ex => ex.map(e => e.id === id ? { ...e, [field]: val } : e)); }
  function addEx() { setExercises(ex => [...ex, { id: uid(), name: '', workTime: 60, restTime: 20 }]); }
  function removeEx(id) { setExercises(ex => ex.filter(e => e.id !== id)); }
  function updateStation(i, val) { setStations(s => { const a = [...s]; a[i] = val; return a; }); }
  function addStation() { setStations(s => [...s, `Station ${s.length + 1}`]); }
  function removeStation(i) { setStations(s => s.filter((_, j) => j !== i)); }

  const seqTotal   = exercises.reduce((s, e) => s + Number(e.workTime) + Number(e.restTime), 0);
  const circTotal  = stations.length * Number(rounds) * (Number(workTime) + Number(restTime));

  function save() {
    const trimName = name.trim() || preset.id;
    if (mode === 'sequence') {
      onSave({ ...preset, name: trimName, type: 'zirkel', mode: 'sequence',
        participants: Math.max(1, Number(seqParticipants)),
        exercises: exercises.map(e => ({
          id: e.id, name: e.name.trim() || 'Übung',
          workTime: Math.max(5, Number(e.workTime)),
          restTime: Math.max(0, Number(e.restTime)),
        })),
      });
    } else {
      onSave({ ...preset, name: trimName, type: 'zirkel', mode: 'circuit',
        participants: stations.length,
        workTime: Math.max(5, Number(workTime)),
        restTime: Math.max(0, Number(restTime)),
        rounds:   Math.max(1, Number(rounds)),
        exercises: stations.map(s => s.trim() || 'Station'),
      });
    }
  }

  return (
    <div className="td-overlay" onClick={onCancel}>
      <div className="td-modal" onClick={e => e.stopPropagation()}>
        <div className="td-modal-header">
          <span className="td-modal-id" style={{ color: accentColor }}>{preset.id}</span>
          <span className="td-modal-title">Zirkel bearbeiten</span>
        </div>
        <div className="td-modal-body">
          <div className="td-mode-row">
            <button className={`td-mode-btn ${mode === 'sequence' ? 'active' : ''}`} onClick={() => setMode('sequence')}>
              Sequenz
            </button>
            <button className={`td-mode-btn ${mode === 'circuit' ? 'active' : ''}`} onClick={() => setMode('circuit')}>
              Rotation
            </button>
          </div>

          <div className="td-field">
            <span>Name</span>
            <input type="text" maxLength={12} value={name} onChange={e => setName(e.target.value)} />
          </div>

          {mode === 'sequence' && (
            <>
              <div className="td-field">
                <span>Teilnehmer im Kreis</span>
                <div className="td-time-row">
                  <input type="number" min="1" max="20" value={seqParticipants} onChange={e => setSeqParticipants(e.target.value)} />
                  <span>Personen</span>
                </div>
              </div>
              <div className="td-section-label">Übungen</div>
              <div className="td-ex-list">
                {exercises.map((ex, i) => (
                  <div key={ex.id} className="td-ex-row">
                    <div className="td-ex-num" style={{ color: accentColor }}>{i + 1}</div>
                    <div className="td-ex-body">
                      <input type="text" className="td-ex-name" placeholder="Übungsname" maxLength={24}
                        value={ex.name} onChange={e => updateEx(ex.id, 'name', e.target.value)} />
                      <div className="td-ex-times">
                        <label><span>Arbeit</span>
                          <input type="number" min="5" max="600" step="5"
                            value={ex.workTime} onChange={e => updateEx(ex.id, 'workTime', e.target.value)} />
                        </label>
                        <label><span>Pause</span>
                          <input type="number" min="0" max="300" step="5"
                            value={ex.restTime} onChange={e => updateEx(ex.id, 'restTime', e.target.value)} />
                        </label>
                      </div>
                    </div>
                    <button className="td-ex-del" onClick={() => removeEx(ex.id)}>✕</button>
                  </div>
                ))}
              </div>
              <button className="td-add-ex" style={{ borderColor: accentColor, color: accentColor }} onClick={addEx}>
                + Übung
              </button>
              <div className="td-summary">
                {exercises.length} Übungen · ~{Math.round(seqTotal / 60)} min
              </div>
            </>
          )}

          {mode === 'circuit' && (
            <>
              <div className="td-field">
                <span>Arbeitszeit / Station</span>
                <div className="td-time-row">
                  <input type="number" min="5" max="600" step="5" value={workTime} onChange={e => setWorkTime(e.target.value)} />
                  <span>Sek</span>
                </div>
              </div>
              <div className="td-field">
                <span>Rotationspause</span>
                <div className="td-time-row">
                  <input type="number" min="0" max="120" step="5" value={restTime} onChange={e => setRestTime(e.target.value)} />
                  <span>Sek</span>
                </div>
              </div>
              <div className="td-field">
                <span>Runden</span>
                <div className="td-time-row">
                  <input type="number" min="1" max="10" value={rounds} onChange={e => setRounds(e.target.value)} />
                </div>
              </div>
              <div className="td-section-label">Stationen ({stations.length} Teilnehmer)</div>
              <div className="td-station-list">
                {stations.map((st, i) => (
                  <div key={i} className="td-station-row">
                    <span className="td-station-num" style={{ color: accentColor }}>{i + 1}</span>
                    <input type="text" className="td-station-name" placeholder={`Station ${i + 1}`} maxLength={20}
                      value={st} onChange={e => updateStation(i, e.target.value)} />
                    <button className="td-ex-del" onClick={() => removeStation(i)}>✕</button>
                  </div>
                ))}
              </div>
              <button className="td-add-ex" style={{ borderColor: accentColor, color: accentColor }} onClick={addStation}>
                + Station
              </button>
              <div className="td-summary">
                {stations.length} Stationen · {rounds} Runden · ~{Math.round(circTotal / 60)} min
              </div>
            </>
          )}
        </div>
        <div className="td-modal-footer">
          <button className="td-btn-cancel" onClick={onCancel}>Abbrechen</button>
          <button className="td-btn-save" style={{ background: accentColor }} onClick={save}>Speichern</button>
        </div>
        {onDelete && (
          <div className="td-delete-row">
            {confirmDel ? (
              <>
                <span className="td-del-text">Löschen?</span>
                <button className="td-btn-del-confirm" onClick={onDelete}>Ja, löschen</button>
                <button className="td-btn-del" onClick={() => setConfirmDel(false)}>Nein</button>
              </>
            ) : (
              <button className="td-btn-del" onClick={() => setConfirmDel(true)}>🗑 Zirkel löschen</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function TrainingDashboard() {
  const { token }       = useAuth();
  const { activeDojo }  = useDojoContext();
  const { hasFeature }  = useSubscription();

  const [loading, setLoading]           = useState(true);
  const [allPresets, setAllPresets]     = useState(DEFAULT_PRESETS);
  const [activeCategory, setActiveCat] = useState('kickboxen');
  const [editingPreset, setEditing]     = useState(null);
  const [syncToken, setSyncToken]       = useState(null);
  const [lastSynced, setLastSynced]     = useState(null);
  const [copied, setCopied]             = useState(false);
  const [saving, setSaving]             = useState(false);

  const withDojo = useCallback((url) =>
    activeDojo?.id ? `${url}?dojo_id=${activeDojo.id}` : url,
    [activeDojo]
  );

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // Load on mount / dojo change
  useEffect(() => {
    if (hasFeature('training')) loadData();
  }, [activeDojo]); // eslint-disable-line

  async function loadData() {
    setLoading(true);
    try {
      const [presetsRes, tokenRes] = await Promise.all([
        axios.get(withDojo('/training/presets'), authHeaders),
        axios.get(withDojo('/training/token'), authHeaders),
      ]);
      const fetched = presetsRes.data.presets || {};
      setAllPresets(Object.keys(fetched).length > 0 ? fetched : DEFAULT_PRESETS);
      setSyncToken(tokenRes.data.token);
      setLastSynced(tokenRes.data.lastSynced);
    } catch (err) {
      console.error('Training load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function persistPresets(newPresets) {
    setSaving(true);
    try {
      await axios.put(withDojo('/training/presets'), { presets: newPresets }, authHeaders);
      setAllPresets(newPresets);
    } catch (err) {
      console.error('Training save error:', err);
    } finally {
      setSaving(false);
    }
  }

  async function regenerateToken() {
    try {
      const res = await axios.post(withDojo('/training/token/regenerate'), {}, authHeaders);
      setSyncToken(res.data.token);
      setLastSynced(null);
    } catch (err) {
      console.error('Token regenerate error:', err);
    }
  }

  // ── Preset CRUD ──────────────────────────────────────────────────────────────
  function handleSave(updated) {
    const catId = Object.keys(allPresets).find(k => allPresets[k].some(p => p.id === updated.id)) ?? activeCategory;
    const existing = allPresets[catId]?.some(p => p.id === updated.id);
    const newList = existing
      ? allPresets[catId].map(p => p.id === updated.id ? updated : p)
      : [...(allPresets[catId] || []), updated];
    persistPresets({ ...allPresets, [catId]: newList });
    setEditing(null);
  }

  function handleDelete() {
    if (!editingPreset) return;
    const catId = Object.keys(allPresets).find(k => allPresets[k].some(p => p.id === editingPreset.id));
    if (!catId) return;
    persistPresets({ ...allPresets, [catId]: allPresets[catId].filter(p => p.id !== editingPreset.id) });
    setEditing(null);
  }

  function handleAdd() {
    const cat = CATEGORIES.find(c => c.id === activeCategory);
    const list = allPresets[activeCategory] || [];
    const newId = `${cat.short}${list.length + 1}`;
    if (activeCategory === 'zirkel') {
      setEditing({ id: newId, name: newId, type: 'zirkel', mode: 'sequence', participants: 6,
        exercises: [{ id: uid(), name: '', workTime: 60, restTime: 20 }] });
    } else {
      setEditing({ id: newId, name: newId, workTime: 60, restTime: 30, rounds: 5 });
    }
  }

  async function copyToken() {
    const url = `${TRAINER_APP_URL}/?token=${syncToken}`;
    try { await navigator.clipboard.writeText(url); } catch { /* fallback */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Enterprise Gate ──────────────────────────────────────────────────────────
  if (!hasFeature('training')) {
    const previewCat = CATEGORIES[0];
    return (
      <div className="td-preview-wrapper">
        {/* Blurred preview of the real UI */}
        <div className="td-preview-content" aria-hidden="true">
          <div className="td-header">
            <div className="td-header-left">
              <h2>⏱ Training Timer</h2>
              <p>Presets verwalten · Trainer App verbinden</p>
            </div>
          </div>
          <div className="td-body">
            <div className="td-cats">
              {CATEGORIES.map(c => (
                <div key={c.id}
                  className={`td-cat-btn ${c.id === 'kickboxen' ? 'active' : ''}`}
                  style={{ '--cat-color': c.color, '--cat-dim': c.dim, '--cat-border': c.border }}
                >
                  <span className="td-cat-dot" style={{ '--cat-color': c.color }} />
                  {c.label}
                  <span className="td-cat-count">6</span>
                </div>
              ))}
            </div>
            <div className="td-content">
              <div className="td-content-header">
                <span className="td-content-title">Kickboxen</span>
              </div>
              <div className="td-preset-grid">
                {DEFAULT_PRESETS.kickboxen.map(p => {
                  const info = presetCardInfo(p);
                  return (
                    <div key={p.id} className="td-preset-card"
                      style={{ borderLeftColor: previewCat.color, borderLeftWidth: 3 }}
                    >
                      <span className="td-preset-id" style={{ color: previewCat.color }}>{p.name || p.id}</span>
                      <span className="td-preset-info">{info.line1}</span>
                      <span className="td-preset-detail">{info.line2}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="td-sync">
            <span className="td-sync-title">Trainer App verbinden</span>
            <div className="td-sync-row">
              <div className="td-sync-token">https://trainer.tda-intl.org/?token=••••••••••••••••</div>
              <button className="td-sync-btn" disabled>URL kopieren</button>
              <button className="td-sync-btn" disabled>↺ Neu</button>
            </div>
          </div>
        </div>

        {/* Overlay CTA */}
        <div className="td-preview-overlay">
          <div className="td-preview-badge">Enterprise Feature</div>
          <div className="td-preview-title">⏱ Training Timer</div>
          <div className="td-preview-desc">
            Verwalte Interval-Timer-Presets für Kickboxen, Cardio, Core, Kraft und Zirkel.
            Verbinde die TDA Trainer App auf jedem Gerät mit einem einzigen Link.
          </div>
          <div className="td-preview-features">
            <span>✓ 5 Kategorien</span>
            <span>✓ Anpassbare Presets</span>
            <span>✓ Trainer App Sync</span>
            <span>✓ Zirkel &amp; Rotation</span>
          </div>
          <a
            className="td-preview-cta"
            href="mailto:info@tda-intl.com?subject=Enterprise%20Upgrade%20anfragen"
          >
            Enterprise anfragen →
          </a>
        </div>
      </div>
    );
  }

  if (loading) return <div className="td-loading">Training Timer lädt …</div>;

  const cat     = CATEGORIES.find(c => c.id === activeCategory);
  const presets = allPresets[activeCategory] || [];
  const isExisting = editingPreset && Object.keys(allPresets).some(k => allPresets[k].some(p => p.id === editingPreset.id));
  const trainerUrl = syncToken ? `${TRAINER_APP_URL}/?token=${syncToken}` : TRAINER_APP_URL;

  return (
    <div className="td-root">

      {/* ── Header ── */}
      <div className="td-header">
        <div className="td-header-left">
          <h2>⏱ Training Timer</h2>
          <p>Presets verwalten · Trainer App verbinden{saving ? ' · Speichert …' : ''}</p>
        </div>
        <div className="td-header-right">
          {syncToken && (
            <a className="td-btn-open" href={trainerUrl} target="_blank" rel="noreferrer">
              Trainer App öffnen →
            </a>
          )}
        </div>
      </div>

      {/* ── Body: categories + presets ── */}
      <div className="td-body">

        {/* Category sidebar */}
        <div className="td-cats">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              className={`td-cat-btn ${activeCategory === c.id ? 'active' : ''}`}
              style={{ '--cat-color': c.color, '--cat-dim': c.dim, '--cat-border': c.border }}
              onClick={() => setActiveCat(c.id)}
            >
              <span className="td-cat-dot" style={{ '--cat-color': c.color }} />
              {c.label}
              <span className="td-cat-count">{(allPresets[c.id] || []).length}</span>
            </button>
          ))}
        </div>

        {/* Preset content */}
        <div className="td-content">
          <div className="td-content-header">
            <span className="td-content-title">{cat?.label}</span>
            <button className="td-btn-add"
              style={{ borderColor: cat?.color, color: cat?.color }}
              onClick={handleAdd}
            >
              + Neu
            </button>
          </div>

          <div className="td-preset-grid">
            {presets.map(p => {
              const info = presetCardInfo(p);
              return (
                <div key={p.id} className="td-preset-card" style={{ borderLeftColor: cat?.color, borderLeftWidth: 3 }}>
                  <span className="td-preset-id" style={{ color: cat?.color }}>{p.name || p.id}</span>
                  <span className="td-preset-info">{info.line1}</span>
                  <span className="td-preset-detail">{info.line2}</span>
                  <button className="td-preset-edit" onClick={() => setEditing(p)}>✎</button>
                </div>
              );
            })}
            {presets.length === 0 && (
              <div style={{ color: '#405060', fontSize: '0.85rem', gridColumn: '1/-1', padding: '20px 0' }}>
                Noch keine Presets. Klick auf "+ Neu" um zu starten.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Sync Section ── */}
      <div className="td-sync">
        <span className="td-sync-title">Trainer App verbinden</span>
        <div className="td-sync-row">
          <div className="td-sync-token">
            {syncToken ? `${TRAINER_APP_URL}/?token=${syncToken.slice(0, 16)}…` : 'Wird geladen …'}
          </div>
          <button className={`td-sync-btn ${copied ? 'copied' : ''}`} onClick={copyToken}>
            {copied ? '✓ Kopiert' : 'URL kopieren'}
          </button>
          <button className="td-sync-btn" onClick={regenerateToken} title="Neuen Token generieren">
            ↺ Neu
          </button>
          {syncToken && (
            <a className="td-btn-open" href={trainerUrl} target="_blank" rel="noreferrer" style={{ padding: '7px 14px', fontSize: '0.8rem' }}>
              Öffnen →
            </a>
          )}
        </div>
        <span className="td-sync-info">
          Kopiere die URL und öffne sie auf dem Trainer-Gerät (Tablet / Phone) — die App verbindet sich automatisch.
          {lastSynced && ` · Zuletzt synchronisiert: ${new Date(lastSynced).toLocaleString('de-DE')}`}
        </span>
      </div>

      {/* ── Edit Modals — via Portal damit position:fixed den Dashboard-Container ignoriert ── */}
      {editingPreset && editingPreset.type !== 'zirkel' && createPortal(
        <EditRegularModal
          preset={editingPreset}
          accentColor={cat?.color ?? '#3b82f6'}
          onSave={handleSave}
          onDelete={isExisting ? handleDelete : null}
          onCancel={() => setEditing(null)}
        />,
        document.body
      )}
      {editingPreset && editingPreset.type === 'zirkel' && createPortal(
        <EditZirkelModal
          preset={editingPreset}
          accentColor={cat?.color ?? '#3b82f6'}
          onSave={handleSave}
          onDelete={isExisting ? handleDelete : null}
          onCancel={() => setEditing(null)}
        />,
        document.body
      )}
    </div>
  );
}
