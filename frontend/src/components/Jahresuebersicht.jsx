/**
 * Jahresübersicht
 * ================
 * Einnahmen vs. Ausgaben nach Monat — EÜR-Jahresübersicht
 */

import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight,
  Upload, BarChart2, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDojoContext } from '../context/DojoContext.jsx';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import '../styles/themes.css';
import '../styles/Jahresuebersicht.css';
import '../styles/components.css';

// ── Konstanten ────────────────────────────────────────────────────────────────

const MONATSNAMEN = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONATSNAMEN_LANG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const KATEGORIE_LABELS = {
  miete: 'Miete & Nebenkosten', personal: 'Personalkosten',
  material: 'Material & Ausstattung', marketing: 'Marketing & Werbung',
  versicherung: 'Versicherungen', gebuehren: 'Gebühren & Beiträge',
  fahrtkosten: 'Fahrtkosten', telefon: 'Telefon & Internet',
  software: 'Software & Lizenzen', fortbildung: 'Fortbildung & Seminare',
  reparatur: 'Reparaturen & Wartung', buero: 'Büromaterial',
  sonstiges: 'Sonstige Ausgaben'
};

function formatEur(value) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0);
}

function formatEurExact(value) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

function Delta({ current, previous, label }) {
  if (!previous || previous === 0) return null;
  const diff = current - previous;
  const pct = Math.round((diff / Math.abs(previous)) * 100);
  const isPos = diff > 0;
  return (
    <span className={`ju-delta-span${isPos ? ' ju-delta-span--pos' : ' ju-delta-span--neg'}`}>
      {isPos ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(pct)}% ggü. Vorjahr
    </span>
  );
}

function KpiCard({ label, value, sub, color, delta, prev }) {
  return (
    <div className="ju-kpi-card">
      <div className="ju-kpi-sub">
        {label}
      </div>
      <div className="ju-kpi-value" style={{ '--kpi-color': color || 'var(--text-primary)' }}>
        {formatEurExact(value)}
      </div>
      {sub && (
        <div className="ju-kpi-value-sub">{sub}</div>
      )}
      {delta !== undefined && prev !== undefined && (
        <div className="ju-mt05">
          <Delta current={delta} previous={prev} />
        </div>
      )}
    </div>
  );
}

// Custom Tooltip für den BarChart
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const einnahmen = payload.find(p => p.dataKey === 'einnahmen')?.value || 0;
  const ausgaben = payload.find(p => p.dataKey === 'ausgaben')?.value || 0;
  const gewinn = einnahmen - ausgaben;
  return (
    <div className="ju-tooltip-box">
      <div className="ju-bold-heading">
        {MONATSNAMEN_LANG[parseInt(label) - 1]}
      </div>
      <div className="ju-tooltip-row">
        <span className="u-text-success">Einnahmen</span>
        <span className="ju-tooltip-val-income">{formatEur(einnahmen)}</span>
      </div>
      <div className="ju-tooltip-row-expense">
        <span className="u-text-error">Ausgaben</span>
        <span className="ju-tooltip-val-expense">{formatEur(ausgaben)}</span>
      </div>
      <div className="ju-tooltip-divider-row">
        <span className="u-text-muted">Ergebnis</span>
        <span className={`ju-tooltip-gewinn${gewinn >= 0 ? ' ju-tooltip-gewinn--pos' : ' ju-tooltip-gewinn--neg'}`}>
          {gewinn >= 0 ? '+' : ''}{formatEur(gewinn)}
        </span>
      </div>
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function Jahresuebersicht() {
  const { activeDojo } = useDojoContext();
  const navigate = useNavigate();
  const [jahr, setJahr] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const withDojo = (url) => {
    const id = typeof activeDojo === 'object' ? activeDojo?.id : null;
    if (!id) return url;
    return `${url}${url.includes('?') ? '&' : '?'}dojo_id=${id}`;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchWithAuth(withDojo(`/api/jahresuebersicht?jahr=${jahr}`))
      .then(r => r.json())
      .then(json => {
        if (!cancelled) setData(json);
      })
      .catch(err => {
        if (!cancelled) setError('Fehler beim Laden: ' + err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jahr, activeDojo]);

  // Chartdaten aufbauen
  const chartData = data?.monate?.map(m => ({
    name: m.monat.toString(),
    einnahmen: m.einnahmen,
    ausgaben: m.ausgaben,
    gewinn: m.gewinn
  })) || [];

  const { jahrestotal, vorjahr, ausgabenNachKategorie } = data || {};

  // Beste und schlechteste Monate
  const besterMonat = data?.monate?.length
    ? data.monate.reduce((best, m) => m.gewinn > best.gewinn ? m : best, data.monate[0])
    : null;

  return (
    <div className="ju-page">

      {/* Header */}
      <div className="ju-header-row">
        <div className="u-flex-1">
          <h1 className="ju-title">
            Jahresübersicht
          </h1>
          <p className="ju-subtitle">
            Einnahmen & Ausgaben im Jahresvergleich
          </p>
        </div>

        {/* Jahr-Wähler */}
        <div className="u-flex-row-sm">
          <button
            onClick={() => setJahr(j => j - 1)}
            className="ju-btn-year-nav"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="ju-year-display">
            {jahr}
          </span>
          <button
            onClick={() => setJahr(j => j + 1)}
            disabled={jahr >= new Date().getFullYear()}
            className="ju-btn-year-nav"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Aktion: Import */}
        <button
          onClick={() => navigate('/dashboard/kontoauszug-import')}
          className="ju-btn-import"
        >
          <Upload size={14} />
          Kontoauszug importieren
        </button>
      </div>

      {/* Fehler / Laden */}
      {error && (
        <div className="ju-error-box">
          {error}
        </div>
      )}

      {loading && (
        <div className="ju-empty">
          Lade Daten…
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI-Karten */}
          <div className="ju-kpi-grid">
            <KpiCard
              label="Gesamteinnahmen"
              value={jahrestotal?.einnahmen}
              color="#10b981"
              delta={jahrestotal?.einnahmen}
              prev={vorjahr?.einnahmen}
            />
            <KpiCard
              label="Gesamtausgaben"
              value={jahrestotal?.ausgaben}
              color="#ef4444"
              delta={jahrestotal?.ausgaben}
              prev={vorjahr?.ausgaben}
            />
            <KpiCard
              label="Jahresergebnis"
              value={jahrestotal?.gewinn}
              color={jahrestotal?.gewinn >= 0 ? '#10b981' : '#ef4444'}
              sub={jahrestotal?.gewinn >= 0 ? 'Überschuss' : 'Verlust'}
              delta={jahrestotal?.gewinn}
              prev={vorjahr?.gewinn}
            />
            {besterMonat && (
              <KpiCard
                label="Bester Monat"
                value={besterMonat.gewinn}
                color="#6366f1"
                sub={MONATSNAMEN_LANG[besterMonat.monat - 1]}
              />
            )}
          </div>

          {/* Balkendiagramm */}
          <div className="ju-chart-card">
            <h3 className="ju-section-title">
              Monatlicher Verlauf — {jahr}
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #333)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickFormatter={v => MONATSNAMEN[parseInt(v) - 1]}
                  tick={{ fill: 'var(--text-muted, #999)', fontSize: 12 }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                  tick={{ fill: 'var(--text-muted, #999)', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                  width={45}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Legend formatter={v => v === 'einnahmen' ? 'Einnahmen' : 'Ausgaben'} />
                <ReferenceLine y={0} stroke="var(--border-color, #444)" />
                <Bar dataKey="einnahmen" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="ausgaben" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Untere Zeile: Monatstabelle + Kategorie-Aufstellung */}
          <div className="ju-two-col">

            {/* Monatstabelle */}
            <div className="ju-table-card">
              <div className="ju-card-section-header">
                Monatliche Aufteilung
              </div>
              <table className="ju-table">
                <thead>
                  <tr className="ju-tr-header">
                    <th className="ju-th-left">Monat</th>
                    <th className="ju-th-right">Einnahmen</th>
                    <th className="ju-th-right">Ausgaben</th>
                    <th className="ju-th-result">Ergebnis</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monate.map(m => (
                    <tr key={m.monat} className={`ju-tr-data${m.einnahmen === 0 && m.ausgaben === 0 ? ' ju-tr-data--empty' : ''}`}>
                      <td className="ju-td-month">
                        {MONATSNAMEN_LANG[m.monat - 1]}
                      </td>
                      <td className="ju-td-income">
                        {m.einnahmen > 0 ? formatEur(m.einnahmen) : '—'}
                      </td>
                      <td className="ju-td-expense">
                        {m.ausgaben > 0 ? formatEur(m.ausgaben) : '—'}
                      </td>
                      <td className={`ju-td-result${m.gewinn >= 0 ? ' ju-td-result--pos' : ' ju-td-result--neg'}`}>
                        {(m.einnahmen > 0 || m.ausgaben > 0) ? (
                          <>{m.gewinn >= 0 ? '+' : ''}{formatEur(m.gewinn)}</>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                  {/* Summenzeile */}
                  <tr className="ju-tr-total">
                    <td className="ju-td-total-label">Gesamt</td>
                    <td className="ju-td-total-income">{formatEur(jahrestotal?.einnahmen)}</td>
                    <td className="ju-td-total-expense">{formatEur(jahrestotal?.ausgaben)}</td>
                    <td className={`ju-td-total-result${(jahrestotal?.gewinn ?? 0) >= 0 ? ' ju-td-total-result--pos' : ' ju-td-total-result--neg'}`}>
                      {jahrestotal?.gewinn >= 0 ? '+' : ''}{formatEur(jahrestotal?.gewinn)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Ausgaben nach Kategorie */}
            <div className="ju-table-card">
              <div className="ju-card-section-header">
                Ausgaben nach Kategorie
              </div>
              {ausgabenNachKategorie && ausgabenNachKategorie.length > 0 ? (
                <div className="ju-pad075">
                  {ausgabenNachKategorie.map(k => {
                    const pct = jahrestotal?.ausgaben > 0 ? Math.round((k.summe / jahrestotal.ausgaben) * 100) : 0;
                    return (
                      <div key={k.kategorie} className="ju-mb075">
                        <div className="ju-kategorie-row">
                          <span className="u-text-secondary">
                            {KATEGORIE_LABELS[k.kategorie] || k.kategorie}
                          </span>
                          <span className="ju-kategorie-value">
                            {formatEur(k.summe)} <span className="ju-kategorie-pct">({pct}%)</span>
                          </span>
                        </div>
                        <div className="ju-bar-track">
                          <div className="ju-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="ju-empty-sm">
                  Keine Ausgaben für {jahr} gefunden
                </div>
              )}
            </div>
          </div>

          {/* Vorjahr-Vergleich */}
          {(vorjahr?.einnahmen > 0 || vorjahr?.ausgaben > 0) && (
            <div className="ju-vorjahr-card">
              <div className="ju-compare-label">
                Vorjahr {jahr - 1}
              </div>
              <div className="ju-text-sm">
                Einnahmen: <strong className="u-text-success">{formatEurExact(vorjahr.einnahmen)}</strong>
              </div>
              <div className="ju-text-sm">
                Ausgaben: <strong className="u-text-error">{formatEurExact(vorjahr.ausgaben)}</strong>
              </div>
              <div className="ju-text-sm">
                Ergebnis: <strong className={`ju-gewinn-strong${vorjahr.gewinn >= 0 ? ' ju-gewinn-strong--pos' : ' ju-gewinn-strong--neg'}`}>
                  {vorjahr.gewinn >= 0 ? '+' : ''}{formatEurExact(vorjahr.gewinn)}
                </strong>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
