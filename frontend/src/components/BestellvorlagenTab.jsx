import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import GiBestellvorlage from './GiBestellvorlage';
import '../styles/BestellvorlagenTab.css';

const EMPTY_FORM = {
  name: '',
  typ: 'karate_gi',
  lieferant_id: '',
  modell: '128',
  modell_name: '',
  artikel_nr_vorl: '',
  farbe: 'Weiß',
  wkf: false,
  stickerei_pos: [],
  stickerei_text: '',
  stickerei_farben: 'Gold, Schwarz',
  stickerei_datei: '',
  bemerkungen: '',
  artikel_ids: [],
};

const POSITIONEN = [
  'Linkes Revers', 'Rechtes Revers', 'Rücken oben', 'Rücken Mitte',
  'Linker Ärmel', 'Rechter Ärmel', 'Hosenbein', 'Kragen',
];

const TYP_LABELS = {
  karate_gi: 'Karate-Gi',
  allgemein: 'Allgemein',
};

export default function BestellvorlagenTab() {
  const { activeDojo } = useDojoContext();
  const dojoId = activeDojo?.id;

  const [mode, setMode] = useState('list'); // 'list' | 'edit' | 'new'
  const [vorlagen, setVorlagen] = useState([]);
  const [artikel, setArtikel] = useState([]);
  const [lieferanten, setLieferanten] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedId, setSelectedId] = useState(null);
  const [activeVorlage, setActiveVorlage] = useState(null); // für Bestellung aufgeben
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');

  // ── Laden ────────────────────────────────────────────────────────────────

  const loadVorlagen = useCallback(async () => {
    if (!dojoId) return;
    setLoading(true);
    try {
      const res = await axios.get(`/bestellvorlagen?dojo_id=${dojoId}`);
      setVorlagen(res.data?.data || []);
    } catch {
      setError('Vorlagen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [dojoId]);

  const loadArtikel = useCallback(async () => {
    if (!dojoId) return;
    try {
      const res = await axios.get(`/artikel?dojo_id=${dojoId}`);
      setArtikel(res.data?.data || []);
    } catch {}
  }, [dojoId]);

  const loadLieferanten = useCallback(async () => {
    if (!dojoId) return;
    try {
      const res = await axios.get(`/lieferanten?dojo_id=${dojoId}`);
      setLieferanten(res.data?.data || []);
    } catch {}
  }, [dojoId]);

  useEffect(() => { loadVorlagen(); }, [loadVorlagen]);
  useEffect(() => { loadArtikel(); loadLieferanten(); }, [loadArtikel, loadLieferanten]);

  // ── Formular-Hilfen ───────────────────────────────────────────────────────

  const f = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));
  const fb = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.checked }));

  const togglePos = (pos) => {
    setForm(prev => ({
      ...prev,
      stickerei_pos: prev.stickerei_pos.includes(pos)
        ? prev.stickerei_pos.filter(x => x !== pos)
        : [...prev.stickerei_pos, pos],
    }));
  };

  const toggleArtikel = (id) => {
    setForm(prev => ({
      ...prev,
      artikel_ids: prev.artikel_ids.includes(id)
        ? prev.artikel_ids.filter(x => x !== id)
        : [...prev.artikel_ids, id],
    }));
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const openNew = () => {
    setForm(EMPTY_FORM);
    setSelectedId(null);
    setMode('new');
    setError('');
  };

  const openEdit = async (v) => {
    setError('');
    try {
      const res = await axios.get(`/bestellvorlagen/${v.vorlage_id}?dojo_id=${dojoId}`);
      const data = res.data?.data || v;
      let pos = data.stickerei_pos;
      if (typeof pos === 'string') {
        try { pos = JSON.parse(pos); } catch { pos = []; }
      }
      setForm({
        name: data.name || '',
        typ: data.typ || 'karate_gi',
        lieferant_id: String(data.lieferant_id || ''),
        modell: data.modell || '128',
        modell_name: data.modell_name || '',
        artikel_nr_vorl: data.artikel_nr_vorl || '',
        farbe: data.farbe || 'Weiß',
        wkf: !!data.wkf,
        stickerei_pos: Array.isArray(pos) ? pos : [],
        stickerei_text: data.stickerei_text || '',
        stickerei_farben: data.stickerei_farben || 'Gold, Schwarz',
        stickerei_datei: data.stickerei_datei || '',
        bemerkungen: data.bemerkungen || '',
        artikel_ids: data.artikel_ids || [],
      });
      setSelectedId(v.vorlage_id);
      setMode('edit');
    } catch {
      setError('Vorlage konnte nicht geladen werden.');
    }
  };

  const cancel = () => { setMode('list'); setSelectedId(null); setError(''); };

  const save = async () => {
    if (!form.name.trim()) { setError('Name ist Pflichtfeld.'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        lieferant_id: form.lieferant_id ? Number(form.lieferant_id) : null,
        stickerei_pos: form.stickerei_pos,
        artikel_ids: form.artikel_ids,
      };
      if (mode === 'new') {
        await axios.post(`/bestellvorlagen?dojo_id=${dojoId}`, payload);
        setSuccess('Vorlage angelegt.');
      } else {
        await axios.put(`/bestellvorlagen/${selectedId}?dojo_id=${dojoId}`, payload);
        setSuccess('Gespeichert.');
      }
      await loadVorlagen();
      setMode('list');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.response?.data?.message || 'Fehler beim Speichern.');
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm('Vorlage wirklich deaktivieren?')) return;
    try {
      await axios.delete(`/bestellvorlagen/${id}?dojo_id=${dojoId}`);
      await loadVorlagen();
    } catch {
      setError('Fehler beim Löschen.');
    }
  };

  // ── Wenn "Bestellung aufgeben" geklickt wird ──────────────────────────────

  if (activeVorlage) {
    return (
      <div className="bvt-overlay">
        <GiBestellvorlage
          vorlage={activeVorlage}
          onClose={() => setActiveVorlage(null)}
        />
      </div>
    );
  }

  // ── Formular-Ansicht ──────────────────────────────────────────────────────

  if (mode === 'new' || mode === 'edit') {
    return (
      <div className="bvt-form-page">
        <div className="bvt-form-header">
          <div>
            <span className="bvt-form-title">
              {mode === 'new' ? 'Neue Bestellvorlage' : form.name}
            </span>
            <span className="bvt-form-sub">
              {mode === 'new' ? 'Vorlage erfassen' : 'Bearbeiten'}
            </span>
          </div>
          <div className="bvt-form-actions">
            <button className="bvt-btn bvt-btn--ghost" onClick={cancel}>Abbrechen</button>
            <button className="bvt-btn bvt-btn--primary" onClick={save} disabled={saving}>
              {saving ? 'Speichert…' : 'Speichern'}
            </button>
          </div>
        </div>

        {error && <div className="bvt-alert bvt-alert--err">{error}</div>}

        <div className="bvt-form-grid">
          {/* ── Spalte 1: Grunddaten ── */}
          <div className="bvt-form-col">
            <div className="bvt-section">
              <p className="bvt-section-label">Grunddaten</p>

              <div className="bvt-field">
                <label className="bvt-label">Name *</label>
                <input className="bvt-input" value={form.name} onChange={f('name')}
                  placeholder="z. B. Vereins-Gi Hayashi WKF" />
              </div>

              <div className="bvt-field">
                <label className="bvt-label">Typ</label>
                <select className="bvt-input" value={form.typ} onChange={f('typ')}>
                  <option value="karate_gi">Karate-Gi</option>
                  <option value="allgemein">Allgemein</option>
                </select>
              </div>

              <div className="bvt-field">
                <label className="bvt-label">Lieferant</label>
                <select className="bvt-input" value={form.lieferant_id} onChange={f('lieferant_id')}>
                  <option value="">— kein Lieferant —</option>
                  {lieferanten.map(l => (
                    <option key={l.lieferant_id} value={l.lieferant_id}>{l.firmenname}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bvt-section">
              <p className="bvt-section-label">Modell</p>
              <div className="bvt-model-row">
                <div
                  className={`bvt-model-card ${form.modell === '128' ? 'active' : ''}`}
                  onClick={() => setForm(p => ({ ...p, modell: '128' }))}
                >
                  <div className="bvt-model-card__name">Modell 128</div>
                  <div className="bvt-model-card__detail">11 Größen · 140–200 cm</div>
                </div>
                <div
                  className={`bvt-model-card ${form.modell === '188' ? 'active' : ''}`}
                  onClick={() => setForm(p => ({ ...p, modell: '188' }))}
                >
                  <div className="bvt-model-card__name">Modell 188</div>
                  <div className="bvt-model-card__detail">8 Größen · 130–200 cm</div>
                </div>
              </div>

              <div className="bvt-field">
                <label className="bvt-label">Modellbezeichnung</label>
                <input className="bvt-input" value={form.modell_name} onChange={f('modell_name')}
                  placeholder="z. B. Hayashi Tenno WKF Approved" />
              </div>

              <div className="bvt-field">
                <label className="bvt-label">Artikel-Nr.</label>
                <input className="bvt-input" value={form.artikel_nr_vorl} onChange={f('artikel_nr_vorl')}
                  placeholder="z. B. 0270" />
              </div>

              <div className="bvt-field">
                <label className="bvt-label">Farbe / Ausführung</label>
                <input className="bvt-input" value={form.farbe} onChange={f('farbe')} />
              </div>

              <label className="bvt-check-row">
                <input type="checkbox" checked={form.wkf} onChange={fb('wkf')} />
                WKF-zugelassen / WKF Approved
              </label>
            </div>
          </div>

          {/* ── Spalte 2: Stickerei + Artikel ── */}
          <div className="bvt-form-col">
            <div className="bvt-section">
              <p className="bvt-section-label">Stickerei</p>

              <div className="bvt-pos-grid" style={{ marginBottom: '0.65rem' }}>
                {POSITIONEN.map(pos => (
                  <label
                    key={pos}
                    className={`bvt-pos-item ${form.stickerei_pos.includes(pos) ? 'active' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={form.stickerei_pos.includes(pos)}
                      onChange={() => togglePos(pos)}
                      style={{ display: 'none' }}
                    />
                    {pos}
                  </label>
                ))}
              </div>

              <div className="bvt-field">
                <label className="bvt-label">Schriftzug / Text</label>
                <input className="bvt-input" value={form.stickerei_text} onChange={f('stickerei_text')}
                  placeholder="z. B. Kampfkunstschule Schreiner · TDA" />
              </div>

              <div className="bvt-field">
                <label className="bvt-label">Garnfarben</label>
                <input className="bvt-input" value={form.stickerei_farben} onChange={f('stickerei_farben')} />
              </div>

              <div className="bvt-field">
                <label className="bvt-label">Stickerei-Datei</label>
                <input className="bvt-input" value={form.stickerei_datei} onChange={f('stickerei_datei')}
                  placeholder="z. B. TDA_logo_v2.dst" />
              </div>

              <div className="bvt-field">
                <label className="bvt-label">Bemerkungen</label>
                <textarea className="bvt-textarea" rows="3" value={form.bemerkungen} onChange={f('bemerkungen')}
                  placeholder="Sonderwünsche, Verpackungsvorschriften …" />
              </div>
            </div>

            <div className="bvt-section">
              <p className="bvt-section-label">Artikel-Zuordnung</p>
              {artikel.length === 0 ? (
                <div className="bvt-empty" style={{ padding: '1rem' }}>Keine Artikel vorhanden.</div>
              ) : (
                <div className="bvt-artikel-grid">
                  {artikel.map(a => {
                    const selected = form.artikel_ids.includes(a.artikel_id);
                    return (
                      <label
                        key={a.artikel_id}
                        className={`bvt-artikel-item ${selected ? 'selected' : ''}`}
                        onClick={() => toggleArtikel(a.artikel_id)}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleArtikel(a.artikel_id)}
                          onClick={e => e.stopPropagation()}
                        />
                        <div>
                          <div className="bvt-artikel-name">{a.name}</div>
                          {a.artikel_nummer && (
                            <div className="bvt-artikel-nr">#{a.artikel_nummer}</div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Listen-Ansicht ────────────────────────────────────────────────────────

  const filtered = vorlagen.filter(v =>
    !search ||
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    (v.lieferant_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bvt-list-page">
      <div className="bvt-list-header">
        <input
          className="bvt-search"
          placeholder="Suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="bvt-btn bvt-btn--primary" onClick={openNew}>
          + Neue Bestellvorlage
        </button>
      </div>

      {error && <div className="bvt-alert bvt-alert--err">{error}</div>}
      {success && <div className="bvt-alert bvt-alert--ok">{success}</div>}

      {loading ? (
        <div className="bvt-loading">Lädt…</div>
      ) : filtered.length === 0 ? (
        <div className="bvt-empty">
          {vorlagen.length === 0
            ? 'Noch keine Bestellvorlagen erfasst.'
            : 'Keine Treffer.'}
        </div>
      ) : (
        <div className="bvt-cards">
          {filtered.map(v => (
            <div key={v.vorlage_id} className="bvt-card">
              <div className="bvt-card__main">
                <div className="bvt-card__name">{v.name}</div>
                <div className="bvt-card__sub">
                  {v.lieferant_name ? `Lieferant: ${v.lieferant_name}` : 'Kein Lieferant'}
                  {' · '}
                  {v.artikel_count === 1
                    ? '1 Artikel verknüpft'
                    : `${v.artikel_count || 0} Artikel verknüpft`}
                </div>
                <div className="bvt-card__meta">
                  <span className={`bvt-badge ${v.typ === 'karate_gi' ? 'bvt-badge--gold' : ''}`}>
                    {TYP_LABELS[v.typ] || v.typ}
                  </span>
                  {v.modell && <span className="bvt-badge">Modell {v.modell}</span>}
                  {v.wkf ? <span className="bvt-badge bvt-badge--gold">WKF</span> : null}
                </div>
              </div>
              <div className="bvt-card__actions">
                <button
                  className="bvt-btn bvt-btn--ghost bvt-btn--sm"
                  onClick={() => openEdit(v)}
                >
                  Bearbeiten
                </button>
                <button
                  className="bvt-btn-gold bvt-btn-gold--sm"
                  onClick={() => setActiveVorlage(v)}
                >
                  Bestellung aufgeben
                </button>
                <button
                  className="bvt-btn bvt-btn--danger bvt-btn--sm"
                  onClick={() => del(v.vorlage_id)}
                >
                  Entfernen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
