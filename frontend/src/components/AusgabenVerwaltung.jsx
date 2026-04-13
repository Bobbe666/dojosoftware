/**
 * Ausgaben-Verwaltung
 * ===================
 * Erfassen und Verwalten von Betriebsausgaben für die EÜR
 * Tabs: Auswertung | Einträge
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import {
  Plus, Trash2, Edit2, Save, X, Calendar, Receipt, TrendingDown,
  ChevronLeft, ChevronRight, BarChart2, List, Home, Users, Box,
  Megaphone, Shield, Car, Phone, Laptop, GraduationCap, Wrench,
  Paperclip, MoreHorizontal, TrendingUp, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { useDojoContext } from '../context/DojoContext.jsx';
import config from '../config/config';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/AusgabenVerwaltung.css';

// ── Konstanten ──────────────────────────────────────────────────────────────

const KATEGORIE_ICONS = {
  miete: Home, personal: Users, material: Box, marketing: Megaphone,
  versicherung: Shield, gebuehren: Receipt, fahrtkosten: Car,
  telefon: Phone, software: Laptop, fortbildung: GraduationCap,
  reparatur: Wrench, buero: Paperclip, sonstiges: MoreHorizontal
};

const KATEGORIE_LABELS = {
  miete: 'Miete & Nebenkosten', personal: 'Personalkosten',
  material: 'Material & Ausstattung', marketing: 'Marketing & Werbung',
  versicherung: 'Versicherungen', gebuehren: 'Gebühren & Beiträge',
  fahrtkosten: 'Fahrtkosten', telefon: 'Telefon & Internet',
  software: 'Software & Lizenzen', fortbildung: 'Fortbildung & Seminare',
  reparatur: 'Reparaturen & Wartung', buero: 'Büromaterial',
  sonstiges: 'Sonstige Ausgaben'
};

const KATEGORIE_COLORS = {
  miete: '#6366f1', personal: '#f59e0b', material: '#10b981',
  marketing: '#ec4899', versicherung: '#3b82f6', gebuehren: '#8b5cf6',
  fahrtkosten: '#14b8a6', telefon: '#f97316', software: '#06b6d4',
  fortbildung: '#84cc16', reparatur: '#ef4444', buero: '#a78bfa',
  sonstiges: '#6b7280'
};

const MONATE_KURZ = ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const MONATE_LANG = ['Alle Monate', 'Januar', 'Februar', 'März', 'April', 'Mai',
  'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

// ── Helper ───────────────────────────────────────────────────────────────────

const fmt = (val) => new Intl.NumberFormat('de-DE', {
  style: 'currency', currency: 'EUR'
}).format(val || 0);

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';

// ── Haupt-Komponente ─────────────────────────────────────────────────────────

const AusgabenVerwaltung = () => {
  const { activeDojo } = useDojoContext();

  // Shared state
  const [jahr, setJahr] = useState(new Date().getFullYear());
  const [aktiveTab, setAktiveTab] = useState('auswertung');

  // Auswertungs-State
  const [auswertung, setAuswertung] = useState(null);
  const [auswertungLoading, setAuswertungLoading] = useState(false);
  const [drillKategorie, setDrillKategorie] = useState(null); // für Kategorie-Detail

  // Einträge-State
  const [ausgaben, setAusgaben] = useState([]);
  const [summen, setSummen] = useState({ anzahl: 0, gesamt: 0 });
  const [eintraegeLoading, setEintraegeLoading] = useState(false);
  const [monat, setMonat] = useState(null);
  const [kategorieFilter, setKategorieFilter] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    datum: new Date().toISOString().split('T')[0],
    betrag: '', beschreibung: '', beleg_nummer: '', kategorie: 'sonstiges',
    mwst_satz: '', mwst_betrag: ''
  });

  // ── Daten laden ──────────────────────────────────────────────────────────

  const dojoId = activeDojo?.dojo_id || activeDojo?.id;

  const loadAuswertung = useCallback(async () => {
    if (!activeDojo) return;
    setAuswertungLoading(true);
    try {
      const url = `${config.apiBaseUrl}/ausgaben/summen?dojo_id=${dojoId}&jahr=${jahr}`;
      const res = await fetchWithAuth(url);
      const data = await res.json();
      if (data.success) setAuswertung(data);
    } catch (err) {
      console.error('Auswertung Ladefehler:', err);
    } finally {
      setAuswertungLoading(false);
    }
  }, [activeDojo, dojoId, jahr]);

  const loadAusgaben = useCallback(async () => {
    if (!activeDojo) return;
    setEintraegeLoading(true);
    try {
      let url = `${config.apiBaseUrl}/ausgaben?dojo_id=${dojoId}&jahr=${jahr}`;
      if (monat) url += `&monat=${monat}`;
      if (kategorieFilter) url += `&kategorie=${kategorieFilter}`;
      const res = await fetchWithAuth(url);
      const data = await res.json();
      if (data.success) { setAusgaben(data.ausgaben); setSummen(data.summen); }
    } catch (err) {
      console.error('Ausgaben Ladefehler:', err);
    } finally {
      setEintraegeLoading(false);
    }
  }, [activeDojo, dojoId, jahr, monat, kategorieFilter]);

  useEffect(() => { loadAuswertung(); }, [loadAuswertung]);
  useEffect(() => { loadAusgaben(); }, [loadAusgaben]);

  // ── Form-Handler ─────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormData({ datum: new Date().toISOString().split('T')[0], betrag: '', beschreibung: '', beleg_nummer: '', kategorie: 'sonstiges', mwst_satz: '', mwst_betrag: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.betrag || !formData.beschreibung) { alert('Bitte Betrag und Beschreibung eingeben'); return; }
    try {
      const url = editingId ? `${config.apiBaseUrl}/ausgaben/${editingId}` : `${config.apiBaseUrl}/ausgaben`;
      const res = await fetchWithAuth(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, dojo_id: dojoId })
      });
      const data = await res.json();
      if (data.success) { resetForm(); loadAusgaben(); loadAuswertung(); }
      else alert(data.error || 'Fehler beim Speichern');
    } catch (err) { alert('Fehler beim Speichern'); }
  };

  const handleEdit = (a) => {
    setFormData({ datum: a.datum?.split('T')[0] || '', betrag: a.betrag?.toString() || '', beschreibung: a.beschreibung || '', beleg_nummer: a.beleg_nummer || '', kategorie: a.kategorie || 'sonstiges', mwst_satz: a.mwst_satz?.toString() || '', mwst_betrag: a.mwst_betrag?.toString() || '' });
    setEditingId(a.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Ausgabe wirklich löschen?')) return;
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/ausgaben/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { loadAusgaben(); loadAuswertung(); }
    } catch (err) { alert('Fehler beim Löschen'); }
  };

  // ── Auswertungs-Berechnungen ─────────────────────────────────────────────

  const gesamtAusgaben = auswertung?.nachKategorie?.reduce((s, k) => s + (k.summe || 0), 0) || 0;
  const vorjahrGesamt = auswertung?.vorjahrGesamt || 0;
  const vorjahrDelta = vorjahrGesamt > 0 ? ((gesamtAusgaben - vorjahrGesamt) / vorjahrGesamt) * 100 : null;

  const monate12 = Array.from({ length: 12 }, (_, i) => {
    const found = auswertung?.monatlich?.find(m => m.monat === i + 1);
    return { monat: MONATE_KURZ[i + 1], summe: found?.summe || 0 };
  });

  const avgProMonat = (() => {
    const mMitDaten = monate12.filter(m => m.summe > 0);
    return mMitDaten.length > 0 ? mMitDaten.reduce((s, m) => s + m.summe, 0) / mMitDaten.length : 0;
  })();

  const groessteKat = auswertung?.nachKategorie?.[0] || null;

  // Pie-Daten
  const pieData = (auswertung?.nachKategorie || [])
    .filter(k => k.summe > 0)
    .map(k => ({
      name: KATEGORIE_LABELS[k.kategorie] || k.kategorie,
      value: k.summe,
      key: k.kategorie,
      color: KATEGORIE_COLORS[k.kategorie] || '#6b7280',
      prozent: gesamtAusgaben > 0 ? (k.summe / gesamtAusgaben) * 100 : 0
    }));

  // ── Render: Header ───────────────────────────────────────────────────────

  return (
    <div className="av-page">

      {/* Kopfzeile */}
      <div className="av-header">
        <div>
          <h2 className="av-page-title">
            <TrendingDown size={24} />
            Betriebsausgaben
          </h2>
          <p className="av-page-subtitle">
            EÜR-relevante Ausgaben verwalten und auswerten
          </p>
        </div>
        <div className="av-header-actions">
          {/* Jahresnavigation */}
          <div className="av-year-nav">
            <button onClick={() => setJahr(j => j - 1)} className="btn btn-icon av-btn-year">
              <ChevronLeft size={16} />
            </button>
            <span className="av-year-label">{jahr}</span>
            <button onClick={() => setJahr(j => j + 1)} className="btn btn-icon av-btn-year" disabled={jahr >= new Date().getFullYear()}>
              <ChevronRight size={16} />
            </button>
          </div>
          <button onClick={() => { setShowForm(true); resetForm(); setShowForm(true); }} className="btn btn-primary u-flex-row-sm">
            <Plus size={18} />
            Neue Ausgabe
          </button>
        </div>
      </div>

      {/* Tab-Navigation */}
      <div className="av-tab-nav">
        {[
          { key: 'auswertung', label: 'Auswertung', icon: BarChart2 },
          { key: 'eintraege', label: 'Einträge', icon: List }
        ].map(tab => {
          const Icon = tab.icon;
          const active = aktiveTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setAktiveTab(tab.key)} className={`av-tab-btn${active ? ' av-tab-btn--active' : ''}`}>
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB: AUSWERTUNG ─────────────────────────────────────────────── */}
      {aktiveTab === 'auswertung' && (
        <AuswertungTab
          auswertung={auswertung}
          loading={auswertungLoading}
          gesamtAusgaben={gesamtAusgaben}
          vorjahrGesamt={vorjahrGesamt}
          vorjahrDelta={vorjahrDelta}
          avgProMonat={avgProMonat}
          groessteKat={groessteKat}
          monate12={monate12}
          pieData={pieData}
          drillKategorie={drillKategorie}
          setDrillKategorie={(k) => {
            setDrillKategorie(k);
            setAktiveTab('eintraege');
            setKategorieFilter(k);
            setMonat(null);
          }}
          jahr={jahr}
        />
      )}

      {/* ── TAB: EINTRÄGE ───────────────────────────────────────────────── */}
      {aktiveTab === 'eintraege' && (
        <EintraegeTab
          ausgaben={ausgaben}
          summen={summen}
          loading={eintraegeLoading}
          monat={monat}
          setMonat={setMonat}
          kategorieFilter={kategorieFilter}
          setKategorieFilter={setKategorieFilter}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* ── Formular Modal ──────────────────────────────────────────────── */}
      {showForm && (
        <FormModal
          formData={formData}
          setFormData={setFormData}
          editingId={editingId}
          onSubmit={handleSubmit}
          onClose={resetForm}
        />
      )}
    </div>
  );
};

// ── Sub-Komponente: Auswertung ────────────────────────────────────────────────

const AuswertungTab = ({
  auswertung, loading, gesamtAusgaben, vorjahrGesamt, vorjahrDelta,
  avgProMonat, groessteKat, monate12, pieData, drillKategorie,
  setDrillKategorie, jahr
}) => {
  if (loading) return (
    <div className="av-empty-state">
      <div className="loading-spinner av-table-loading-spinner" />
      Lade Auswertung…
    </div>
  );

  if (!auswertung || gesamtAusgaben === 0) return (
    <div className="av-empty-state">
      <TrendingDown size={48} className="av-table-empty-icon" />
      <p className="av-empty-text-bold">Keine Ausgaben für {jahr}</p>
      <p className="av-empty-text-hint">Erfasse deine erste Ausgabe um die Auswertung zu sehen.</p>
    </div>
  );

  const card = {
    background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
    borderRadius: '12px', padding: '1.25rem'
  };

  return (
    <div className="av-kpi-col">

      {/* KPI-Karten */}
      <div className="av-kpi-grid">

        {/* Gesamt */}
        <div className="av-card-error-border">
          <div className="av-stat-label">
            Gesamt {jahr}
          </div>
          <div className="av-stat-value-error">
            {fmt(gesamtAusgaben)}
          </div>
          {vorjahrDelta !== null && (
            <div className={`av-delta-row${vorjahrDelta > 0 ? ' av-delta-row--neg' : ' av-delta-row--pos'}`}>
              {vorjahrDelta > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {Math.abs(vorjahrDelta).toFixed(1)}% vs. {jahr - 1}
            </div>
          )}
          {vorjahrGesamt > 0 && (
            <div className="av-stat-sub-sm">
              Vorjahr: {fmt(vorjahrGesamt)}
            </div>
          )}
        </div>

        {/* Ø pro Monat */}
        <div className="av-card">
          <div className="av-stat-label">
            Ø pro Monat
          </div>
          <div className="av-stat-value">
            {fmt(avgProMonat)}
          </div>
          <div className="av-stat-sub">
            {auswertung?.monatlich?.filter(m => m.summe > 0).length || 0} Monate mit Ausgaben
          </div>
        </div>

        {/* Größter Posten */}
        {groessteKat && (
          <div className="av-card">
            <div className="av-stat-label">
              Größter Posten
            </div>
            <div className="av-groesste-name" style={{ '--kat-color': KATEGORIE_COLORS[groessteKat.kategorie] }}>
              {KATEGORIE_LABELS[groessteKat.kategorie] || groessteKat.kategorie}
            </div>
            <div className="av-groesste-summe">
              {fmt(groessteKat.summe)}
            </div>
            <div className="av-stat-sub-sm">
              {gesamtAusgaben > 0 ? ((groessteKat.summe / gesamtAusgaben) * 100).toFixed(1) : 0}% des Gesamtbetrags
            </div>
          </div>
        )}

        {/* Anzahl Buchungen */}
        <div className="av-card">
          <div className="av-stat-label">
            Buchungen
          </div>
          <div className="av-stat-value">
            {auswertung?.nachKategorie?.reduce((s, k) => s + (k.anzahl || 0), 0) || 0}
          </div>
          <div className="av-stat-sub">
            in {auswertung?.nachKategorie?.length || 0} Kategorien
          </div>
        </div>
      </div>

      {/* Mitte: Pie + Kategorien-Liste */}
      <div className="av-charts-grid">

        {/* Donut Chart */}
        <div className="av-card">
          <div className="av-section-title">
            Ausgaben nach Kategorie
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="var(--bg-card)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [fmt(value), '']}
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '8px', fontSize: '0.82rem' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Kategorien-Tabelle */}
        <div className="av-card">
          <div className="av-section-title">
            Aufschlüsselung — klickbar zum Filtern
          </div>
          <div className="av-kat-list">
            {(auswertung?.nachKategorie || []).map(k => {
              const Icon = KATEGORIE_ICONS[k.kategorie] || MoreHorizontal;
              const color = KATEGORIE_COLORS[k.kategorie] || '#6b7280';
              const prozent = gesamtAusgaben > 0 ? (k.summe / gesamtAusgaben) * 100 : 0;
              return (
                <button
                  key={k.kategorie}
                  onClick={() => setDrillKategorie(k.kategorie)}
                  className="av-kat-btn"
                  style={{ '--kat-color': color }}
                >
                  <div className="av-kat-row">
                    <Icon size={14} className="av-kat-icon" />
                    <span className="av-kat-name">
                      {KATEGORIE_LABELS[k.kategorie] || k.kategorie}
                    </span>
                    <span className="av-kat-amount">
                      {fmt(k.summe)}
                    </span>
                    <span className="av-kat-pct">
                      {prozent.toFixed(0)}%
                    </span>
                  </div>
                  {/* Mini Balken */}
                  <div className="av-bar-track">
                    <div className="av-bar-fill" style={{ width: `${prozent}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Monatliche Entwicklung */}
      <div className="av-card">
        <div className="av-section-title">
          Monatliche Entwicklung {jahr}
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monate12} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary, rgba(255,255,255,0.06))" vertical={false} />
            <XAxis dataKey="monat" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
            <Tooltip
              formatter={(value) => [fmt(value), 'Ausgaben']}
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '8px', fontSize: '0.82rem' }}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            />
            <Bar dataKey="summe" radius={[4, 4, 0, 0]}>
              {monate12.map((entry, i) => (
                <Cell key={i} fill={entry.summe > 0 ? 'var(--error, #ef4444)' : 'var(--bg-secondary)'} fillOpacity={entry.summe > 0 ? 0.85 : 0.3} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
};

// ── Sub-Komponente: Einträge ──────────────────────────────────────────────────

const EintraegeTab = ({
  ausgaben, summen, loading, monat, setMonat, kategorieFilter, setKategorieFilter,
  onEdit, onDelete
}) => {
  const KatIcon = ({ kategorie }) => {
    const Icon = KATEGORIE_ICONS[kategorie] || MoreHorizontal;
    return <Icon size={15} />;
  };

  return (
    <div>
      {/* Filter-Leiste */}
      <div className="av-filter-row">
        <select
          value={monat || ''}
          onChange={e => setMonat(e.target.value ? parseInt(e.target.value) : null)}
className="form-select av-filter-select-monat"
        >
          {['Alle Monate', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'].map((name, idx) => (
            <option key={idx} value={idx === 0 ? '' : idx}>{name}</option>
          ))}
        </select>

        <select
          value={kategorieFilter || ''}
          onChange={e => setKategorieFilter(e.target.value || null)}
className="form-select av-filter-select-kat"
        >
          <option value="">Alle Kategorien</option>
          {Object.entries(KATEGORIE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        {(monat || kategorieFilter) && (
          <button onClick={() => { setMonat(null); setKategorieFilter(null); }}
className="btn btn-secondary av-filter-reset-btn">
            <X size={14} className="av-filter-reset-icon" />Filter zurücksetzen
          </button>
        )}

        <div className="av-summary-group">
          <div className="av-summary-item">
            <div className="av-text-muted-sm">Einträge</div>
            <div className="av-summary-count">{summen.anzahl}</div>
          </div>
          <div className="av-summary-item">
            <div className="av-text-muted-sm">Summe</div>
            <div className="av-summary-total">{fmt(summen.gesamt)}</div>
          </div>
        </div>
      </div>

      {/* Tabelle */}
      <div className="av-table-card">
        {loading ? (
          <div className="av-table-loading">
            <div className="loading-spinner av-table-loading-spinner" />
            Lade Einträge…
          </div>
        ) : ausgaben.length === 0 ? (
          <div className="av-empty-state">
            <TrendingDown size={40} className="av-table-empty-icon" />
            <p>Keine Ausgaben für den gewählten Zeitraum</p>
          </div>
        ) : (
          <div className="av-table-scroll">
            <table className="av-table">
              <thead>
                <tr className="av-thead-row">
                  {['Datum', 'Kategorie', 'Beschreibung', 'Beleg', 'Netto', 'MwSt', 'Brutto', ''].map(h => (
                    <th key={h} className={`av-th${['Netto','MwSt','Brutto'].includes(h) ? ' av-th--right' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ausgaben.map(a => (
                  <tr key={a.id} className="av-tbody-row">
                    <td className="av-td-date">{fmtDate(a.datum)}</td>
                    <td className="av-td-kat">
                      <span className="av-kat-cell" style={{ '--kat-color': KATEGORIE_COLORS[a.kategorie] }}>
                        <KatIcon kategorie={a.kategorie} />
                        <span className="av-kat-cell-label">
                          {KATEGORIE_LABELS[a.kategorie] || a.kategorie}
                        </span>
                      </span>
                    </td>
                    <td className="av-td-desc">{a.beschreibung}</td>
                    <td className="av-td-beleg">
                      {a.beleg_nummer || '—'}
                    </td>
                    <td className="av-td-betrag">
                      {a.mwst_satz > 0 ? fmt(a.betrag - (a.mwst_betrag || 0)) : fmt(a.betrag)}
                    </td>
                    <td className="av-td-betrag">
                      {a.mwst_satz > 0 ? `${fmt(a.mwst_betrag || 0)} (${a.mwst_satz}%)` : '—'}
                    </td>
                    <td className="av-td-betrag">
                      {fmt(a.betrag)}
                    </td>
                    <td className="av-td-actions">
                      <div className="av-actions-flex">
                        <button onClick={() => onEdit(a)} className="btn btn-icon" title="Bearbeiten">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => onDelete(a.id)} className="btn btn-icon av-btn-delete" title="Löschen">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Sub-Komponente: Formular Modal ────────────────────────────────────────────

const FormModal = ({ formData, setFormData, editingId, onSubmit, onClose }) => (
  <div className="av-modal-overlay">
    <div className="av-modal-content">
      <div className="av-modal-header">
        <h3 className="av-modal-title">{editingId ? 'Ausgabe bearbeiten' : 'Neue Ausgabe'}</h3>
        <button onClick={onClose} className="btn btn-icon"><X size={20} /></button>
      </div>

      <form onSubmit={onSubmit}>
        <div className="av-form-col">

          <div className="u-grid-2col">
            <div>
              <label className="av-form-label">Datum *</label>
              <input type="date" value={formData.datum} onChange={e => setFormData({ ...formData, datum: e.target.value })} className="form-input av-full-width" required />
            </div>
            <div>
              <label className="av-form-label">Betrag Brutto (EUR) *</label>
              <input type="number" step="0.01" min="0" value={formData.betrag} onChange={e => {
                const brutto = parseFloat(e.target.value) || 0;
                const satz = parseFloat(formData.mwst_satz) || 0;
                const mwst = satz > 0 ? Math.round(brutto / (1 + satz / 100) * satz / 100 * 100) / 100 : 0;
                setFormData({ ...formData, betrag: e.target.value, mwst_betrag: mwst > 0 ? mwst.toFixed(2) : '' });
              }} className="form-input av-full-width" placeholder="0,00" required />
            </div>
          </div>

          <div className="u-grid-2col">
            <div>
              <label className="av-form-label">MwSt-Satz (%)</label>
              <select value={formData.mwst_satz} onChange={e => {
                const satz = parseFloat(e.target.value) || 0;
                const brutto = parseFloat(formData.betrag) || 0;
                const mwst = satz > 0 ? Math.round(brutto / (1 + satz / 100) * satz / 100 * 100) / 100 : 0;
                setFormData({ ...formData, mwst_satz: e.target.value, mwst_betrag: mwst > 0 ? mwst.toFixed(2) : '' });
              }} className="form-select av-full-width">
                <option value="">Kein / Steuerfreie</option>
                <option value="19">19%</option>
                <option value="7">7%</option>
              </select>
            </div>
            <div>
              <label className="av-form-label">MwSt-Betrag (EUR)</label>
              <input type="number" step="0.01" min="0" value={formData.mwst_betrag} onChange={e => setFormData({ ...formData, mwst_betrag: e.target.value })} className="form-input av-full-width" placeholder="wird berechnet" />
            </div>
          </div>

          <div>
            <label className="av-form-label">Kategorie</label>
            <select value={formData.kategorie} onChange={e => setFormData({ ...formData, kategorie: e.target.value })} className="form-select av-full-width">
              {Object.entries(KATEGORIE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="av-form-label">Beschreibung *</label>
            <input type="text" value={formData.beschreibung} onChange={e => setFormData({ ...formData, beschreibung: e.target.value })} className="form-input av-full-width" placeholder="z.B. Miete März 2026" required />
          </div>

          <div>
            <label className="av-form-label">Belegnummer (optional)</label>
            <input type="text" value={formData.beleg_nummer} onChange={e => setFormData({ ...formData, beleg_nummer: e.target.value })} className="form-input av-full-width" placeholder="z.B. RE-2026-001" />
          </div>

          <div className="av-form-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary u-flex-1">Abbrechen</button>
            <button type="submit" className="btn btn-primary av-btn-submit">
              <Save size={17} />Speichern
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
);

export default AusgabenVerwaltung;
