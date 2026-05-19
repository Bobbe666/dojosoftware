import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle, CreditCard, Building2, RefreshCw, Check, X,
  Mail, Eye, Filter, TrendingDown, Users, Clock, CheckCircle,
  XCircle, AlertCircle, Search, RotateCcw, TrendingUp, Euro,
  Activity, ArrowUpRight, Phone, Banknote, Calendar, ChevronDown,
  ChevronRight, ExternalLink, Zap, Info, Hash, User, BarChart2,
  Percent, Target, ShieldCheck, ShieldAlert
} from 'lucide-react';
import '../styles/OffeneZahlungen.css';

const fmt = (val) => parseFloat(val || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const maskIban = (iban) => iban ? iban.replace(/(.{4})(.+)(.{4})$/, (_, a, m, e) => a + m.replace(/./g, '·') + e) : '—';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '—';
const currentMonthLabel = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

const OffeneZahlungen = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [zahlungen, setZahlungen] = useState([]);
  const [stats, setStats] = useState({});
  const [disputes, setDisputes] = useState([]);
  const [mitgliederProbleme, setMitgliederProbleme] = useState([]);
  const [failedTransaktionen, setFailedTransaktionen] = useState([]);
  const [processingTransaktionen, setProcessingTransaktionen] = useState([]);
  const [ueberfaelligeMitglieder, setUeberfaelligeMitglieder] = useState([]);
  const [retryLoading, setRetryLoading] = useState({});
  const [retryAllLoading, setRetryAllLoading] = useState(false);
  const [auswertung, setAuswertung] = useState(null);
  const [filter, setFilter] = useState({ status: 'offen', typ: '', search: '' });
  const [activeTab, setActiveTab] = useState('ueberfaellig');
  const [selectedZahlung, setSelectedZahlung] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.typ) params.append('typ', filter.typ);

      const [zahlungenRes, disputesRes, mitgliederRes, failedRes, processingRes, ueberfaelligRes, auswertungRes] = await Promise.all([
        axios.get(`/admin/offene-zahlungen?${params}`, { headers }).catch(() => ({ data: { zahlungen: [], stats: {} } })),
        axios.get('/admin/stripe/disputes', { headers }).catch(() => ({ data: { disputes: [] } })),
        axios.get('/admin/mitglieder-mit-zahlungsproblemen', { headers }).catch(() => ({ data: { mitglieder: [] } })),
        axios.get('/lastschriftlauf/stripe/failed-transactions', { headers }).catch(() => ({ data: { transactions: [] } })),
        axios.get('/lastschriftlauf/stripe/processing-transactions', { headers }).catch(() => ({ data: { transactions: [] } })),
        axios.get('/lastschriftlauf/ueberfaellige-beitraege', { headers }).catch(() => ({ data: { mitglieder: [] } })),
        axios.get('/lastschriftlauf/zahlungsauswertung', { headers }).catch(() => ({ data: null }))
      ]);

      if (zahlungenRes.data.success) {
        setZahlungen(zahlungenRes.data.zahlungen || []);
        setStats(zahlungenRes.data.stats || {});
      }
      setDisputes(disputesRes.data.disputes || []);
      setMitgliederProbleme(mitgliederRes.data.mitglieder || []);
      setFailedTransaktionen(failedRes.data.transactions || []);
      setProcessingTransaktionen(processingRes.data.transactions || []);
      setUeberfaelligeMitglieder(ueberfaelligRes.data.mitglieder || []);
      if (auswertungRes.data?.success) setAuswertung(auswertungRes.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Fehler beim Laden:', err);
    } finally {
      setLoading(false);
    }
  }, [filter.status, filter.typ, token]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleStatusChange = async (id, newStatus) => {
    try {
      await axios.put(`/admin/offene-zahlungen/${id}`, { status: newStatus }, { headers });
      loadData();
    } catch { alert('Fehler beim Aktualisieren'); }
  };

  const handleRetry = async (trans) => {
    if (!window.confirm(`Einzug für ${trans.vorname} ${trans.nachname} (${fmt(trans.retry_betrag)}) erneut starten?`)) return;
    setRetryLoading(prev => ({ ...prev, [trans.id]: true }));
    try {
      const res = await axios.post('/lastschriftlauf/stripe/retry-single', {
        transaktion_id: trans.id, mitglied_id: trans.mitglied_id, monat: trans.monat, jahr: trans.jahr
      }, { headers });
      const { status: st, error_detail } = res.data;
      if (st === 'failed') {
        const isClosed = error_detail?.includes('geschlossen') || error_detail?.includes('gesperrt') || error_detail?.includes('account_closed');
        alert(isClosed
          ? `❌ Bankkonto geschlossen\n\n${trans.vorname} ${trans.nachname} hat ein geschlossenes Konto.\nBitte neues SEPA-Mandat einholen.`
          : `❌ Einzug fehlgeschlagen\n\n${error_detail || 'Unbekannter Fehler'}`);
      } else {
        alert(`✅ Einzug gestartet — ${st === 'processing' ? 'Im SEPA-Clearing' : st === 'succeeded' ? 'Sofort erfolgreich' : st}`);
      }
      loadData();
    } catch (err) {
      alert(`❌ Fehler: ${err.response?.data?.error || err.message}`);
    } finally {
      setRetryLoading(prev => ({ ...prev, [trans.id]: false }));
    }
  };

  const handleRetryAll = async () => {
    if (!window.confirm(`Alle ${failedTransaktionen.length} fehlgeschlagenen Einzüge erneut starten?`)) return;
    setRetryAllLoading(true);
    let ok = 0, fail = 0;
    for (const t of failedTransaktionen) {
      try {
        const res = await axios.post('/lastschriftlauf/stripe/retry-single', {
          transaktion_id: t.id, mitglied_id: t.mitglied_id, monat: t.monat, jahr: t.jahr
        }, { headers });
        if (res.data.status !== 'failed') ok++; else fail++;
      } catch { fail++; }
    }
    alert(`Ergebnis: ${ok} gestartet, ${fail} fehlgeschlagen`);
    setRetryAllLoading(false);
    loadData();
  };

  const handleMahnung = async (id) => {
    try {
      await axios.post(`/admin/offene-zahlungen/${id}/mahnung`, {}, { headers });
      alert('Mahnung vermerkt');
      loadData();
    } catch { console.error('Fehler'); }
  };

  const toggleRow = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

  const filteredZahlungen = zahlungen.filter(z => {
    if (!filter.search) return true;
    const q = filter.search.toLowerCase();
    return `${z.vorname} ${z.nachname}`.toLowerCase().includes(q) || (z.referenz || '').toLowerCase().includes(q);
  });

  const getTypBadge = (typ) => {
    const types = {
      ruecklastschrift: { label: 'Rücklastschrift', color: 'var(--error)', Icon: Building2 },
      chargeback: { label: 'Chargeback', color: 'var(--warning)', Icon: CreditCard },
      fehlgeschlagen: { label: 'Fehlgeschlagen', color: '#ef4444', Icon: XCircle },
      mahnung: { label: 'Mahnung', color: '#8b5cf6', Icon: Mail },
      sonstig: { label: 'Sonstig', color: 'var(--text-muted)', Icon: AlertCircle }
    };
    const t = types[typ] || types.sonstig;
    return <span className="typ-badge" style={{ '--typ-color': t.color }}><t.Icon size={12} />{t.label}</span>;
  };

  const getStatusBadge = (status) => {
    const s = { offen: ['Offen', 'var(--error)'], in_bearbeitung: ['In Bearbeitung', 'var(--warning)'], erledigt: ['Erledigt', 'var(--success)'], storniert: ['Storniert', 'var(--text-muted)'] };
    const [label, color] = s[status] || s.offen;
    return <span className="status-badge" style={{ '--status-color': color }}>{label}</span>;
  };

  // Computed stats
  const monatTotal = auswertung
    ? (auswertung.aktueller_monat.anzahl_bezahlt + auswertung.aktueller_monat.anzahl_offen)
    : 0;
  const einzugsquote = monatTotal > 0
    ? Math.round((auswertung.aktueller_monat.anzahl_bezahlt / monatTotal) * 100)
    : 0;
  const avgUeberfaelligTage = ueberfaelligeMitglieder.length > 0
    ? Math.round(ueberfaelligeMitglieder.reduce((s, m) => s + (parseInt(m.tage_ueberfaellig) || 0), 0) / ueberfaelligeMitglieder.length)
    : 0;
  const healthScore = auswertung
    ? Math.max(0, Math.min(100, Math.round(
        einzugsquote * 0.5
        - (auswertung.failed_stripe.anzahl * 3)
        - (auswertung.offene_beitraege.betroffene_mitglieder * 2)
        - (auswertung.ruecklastschriften.anzahl * 5)
        + 50
      )))
    : null;

  const tabs = [
    { key: 'ueberfaellig', label: 'Überfällig', icon: AlertTriangle, count: ueberfaelligeMitglieder.length, color: 'danger' },
    { key: 'fehlgeschlagen', label: 'Fehlgeschlagen', icon: XCircle, count: failedTransaktionen.length, color: 'danger' },
    { key: 'clearing', label: 'SEPA-Clearing', icon: Activity, count: processingTransaktionen.length, color: 'info' },
    { key: 'zahlungen', label: 'Rücklastschriften', icon: Building2, count: stats.offen || 0, color: 'warning' },
    { key: 'disputes', label: 'Disputes', icon: CreditCard, count: disputes.filter(d => d.status !== 'won' && d.status !== 'lost').length, color: 'warning' },
    { key: 'mitglieder', label: 'Problemmitglieder', icon: Users, count: mitgliederProbleme.length, color: 'neutral' },
  ];

  return (
    <div className="oz">

      {/* ════════════ HERO HEADER ════════════ */}
      <header className="oz-hero">
        <div className="oz-hero-left">
          <div className="oz-hero-icon">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h1 className="oz-hero-title">Offene Zahlungen</h1>
            <p className="oz-hero-sub">Finanzüberwachung · SEPA-Clearing · Rücklastschriften · Chargebacks</p>
          </div>
        </div>
        <div className="oz-hero-right">
          {lastUpdated && (
            <span className="oz-last-update">
              <Clock size={12} /> {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={loadData} className="oz-refresh-btn" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Aktualisieren
          </button>
        </div>
      </header>

      {/* ════════════ METRICS GRID ════════════ */}
      {auswertung && (
        <section className="oz-metrics">

          {/* 1 — Einzugsquote */}
          <div className="oz-metric oz-metric--primary">
            <div className="oz-metric-hd">
              <span className="oz-metric-lbl"><Percent size={11} /> Einzugsquote</span>
              <span className="oz-metric-period">{currentMonthLabel}</span>
            </div>
            <div className="oz-metric-num">{einzugsquote}<span className="oz-metric-unit">%</span></div>
            <div className="oz-metric-progress">
              <div
                className="oz-metric-progress-fill"
                style={{
                  width: `${einzugsquote}%`,
                  background: einzugsquote >= 90 ? '#22c55e' : einzugsquote >= 70 ? '#f59e0b' : '#ef4444'
                }}
              />
            </div>
            <div className="oz-metric-ft">
              {auswertung.aktueller_monat.anzahl_bezahlt} von {monatTotal} Beiträgen eingezogen
            </div>
          </div>

          {/* 2 — Eingezogen */}
          <div className="oz-metric oz-metric--success">
            <div className="oz-metric-hd">
              <span className="oz-metric-lbl"><TrendingUp size={11} /> Eingezogen</span>
              <span className="oz-metric-period">{currentMonthLabel}</span>
            </div>
            <div className="oz-metric-num oz-metric-num--money">{fmt(auswertung.aktueller_monat.eingezogen)}</div>
            <div className="oz-metric-ft oz-metric-ft--split">
              <span>{auswertung.aktueller_monat.anzahl_bezahlt} bezahlt</span>
              <span className="oz-ft-muted">noch offen: {fmt(auswertung.aktueller_monat.noch_offen)}</span>
            </div>
          </div>

          {/* 3 — Überfällig */}
          <div className="oz-metric oz-metric--danger oz-metric--link" onClick={() => setActiveTab('ueberfaellig')}>
            <div className="oz-metric-hd">
              <span className="oz-metric-lbl"><TrendingDown size={11} /> Überfällig gesamt</span>
              <ChevronRight size={13} className="oz-metric-arrow" />
            </div>
            <div className="oz-metric-num oz-metric-num--money">{fmt(auswertung.offene_beitraege.summe)}</div>
            <div className="oz-metric-ft oz-metric-ft--split">
              <span>{auswertung.offene_beitraege.betroffene_mitglieder} Mitgl. · {auswertung.offene_beitraege.anzahl} Beitr.</span>
              {avgUeberfaelligTage > 0 && (
                <span className={`oz-ft-pill ${avgUeberfaelligTage > 60 ? 'oz-ft-pill--red' : 'oz-ft-pill--amber'}`}>
                  Ø {avgUeberfaelligTage}d
                </span>
              )}
            </div>
          </div>

          {/* 4 — Fehlgeschlagen */}
          <div
            className={`oz-metric ${auswertung.failed_stripe.anzahl > 0 ? 'oz-metric--danger' : 'oz-metric--ok'} oz-metric--link`}
            onClick={() => setActiveTab('fehlgeschlagen')}
          >
            <div className="oz-metric-hd">
              <span className="oz-metric-lbl"><XCircle size={11} /> Fehlgesch. Einzüge</span>
              <ChevronRight size={13} className="oz-metric-arrow" />
            </div>
            <div className="oz-metric-num oz-metric-num--count">
              {auswertung.failed_stripe.anzahl}
              {auswertung.failed_stripe.summe > 0 && (
                <span className="oz-metric-aside">{fmt(auswertung.failed_stripe.summe)}</span>
              )}
            </div>
            <div className="oz-metric-ft">
              {auswertung.failed_stripe.anzahl > 0
                ? <span className="oz-ft-pill oz-ft-pill--red">→ Erneut einziehen</span>
                : <span className="oz-ft-pill oz-ft-pill--green">✓ Alle erfolgreich</span>
              }
            </div>
          </div>

          {/* 5 — SEPA-Clearing */}
          <div
            className={`oz-metric ${auswertung.processing_stripe.anzahl > 0 ? 'oz-metric--info' : 'oz-metric--ok'} oz-metric--link`}
            onClick={() => setActiveTab('clearing')}
          >
            <div className="oz-metric-hd">
              <span className="oz-metric-lbl"><Activity size={11} /> SEPA-Clearing</span>
              <ChevronRight size={13} className="oz-metric-arrow" />
            </div>
            <div className="oz-metric-num oz-metric-num--count">
              {auswertung.processing_stripe.anzahl}
              {auswertung.processing_stripe.summe > 0 && (
                <span className="oz-metric-aside">{fmt(auswertung.processing_stripe.summe)}</span>
              )}
            </div>
            <div className="oz-metric-ft">
              {auswertung.processing_stripe.anzahl > 0
                ? `${auswertung.processing_stripe.anzahl} Transaktionen im Clearing`
                : 'Keine laufenden Transaktionen'
              }
            </div>
          </div>

          {/* 6 — Rücklastschriften */}
          <div
            className={`oz-metric ${auswertung.ruecklastschriften.anzahl > 0 ? 'oz-metric--warning' : 'oz-metric--ok'} oz-metric--link`}
            onClick={() => setActiveTab('zahlungen')}
          >
            <div className="oz-metric-hd">
              <span className="oz-metric-lbl"><Building2 size={11} /> Rücklastschriften</span>
              <ChevronRight size={13} className="oz-metric-arrow" />
            </div>
            <div className="oz-metric-num oz-metric-num--count">
              {auswertung.ruecklastschriften.anzahl}
              {auswertung.ruecklastschriften.summe > 0 && (
                <span className="oz-metric-aside">{fmt(auswertung.ruecklastschriften.summe)}</span>
              )}
            </div>
            <div className="oz-metric-ft">
              {auswertung.ruecklastschriften.anzahl === 0
                ? <span className="oz-ft-pill oz-ft-pill--green">✓ Keine offenen</span>
                : <span className="oz-ft-pill oz-ft-pill--amber">{auswertung.ruecklastschriften.anzahl} offen</span>
              }
            </div>
          </div>

        </section>
      )}

      {/* ════════════ INSIGHTS ROW ════════════ */}
      {auswertung && (
        <section className="oz-insights">

          {/* Bar Chart */}
          {auswertung.monatsverlauf?.length > 0 && (
            <div className="oz-insight-card oz-insight-chart">
              <div className="oz-insight-hd">
                <span><BarChart2 size={14} /> Monatsverlauf</span>
                <span className="oz-insight-sub">{auswertung.monatsverlauf.length} Monate</span>
              </div>
              <div className="oz-barchart">
                {(() => {
                  const maxVal = Math.max(...auswertung.monatsverlauf.map(x => parseFloat(x.summe)));
                  const now = new Date();
                  return auswertung.monatsverlauf.map(m => {
                    const pct = maxVal > 0 ? (parseFloat(m.summe) / maxVal * 100) : 0;
                    const [yr, mo] = m.monat.split('-');
                    const isCurrent = parseInt(yr) === now.getFullYear() && parseInt(mo) === (now.getMonth() + 1);
                    return (
                      <div key={m.monat} className={`oz-bar ${isCurrent ? 'oz-bar--now' : ''}`} title={`${mo}/${yr}: ${fmt(m.summe)}`}>
                        <span className="oz-bar-val">{(parseFloat(m.summe)/1000).toFixed(1)}k</span>
                        <div className="oz-bar-track">
                          <div className="oz-bar-fill" style={{ height: `${Math.max(pct, 3)}%` }} />
                        </div>
                        <span className="oz-bar-lbl">{mo}/{yr.slice(2)}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Recent Payments */}
          {auswertung.letzte_erfolge?.length > 0 && (
            <div className="oz-insight-card oz-insight-recent">
              <div className="oz-insight-hd">
                <span><CheckCircle size={14} /> Letzte Einzüge</span>
                <span className="oz-insight-sub">{auswertung.letzte_erfolge.length} Einträge</span>
              </div>
              <div className="oz-recent-list">
                {auswertung.letzte_erfolge.slice(0, 7).map((e, i) => (
                  <div key={i} className="oz-recent-row">
                    <span className="oz-recent-name">{e.vorname} {e.nachname}</span>
                    <span className="oz-recent-mo">{String(e.monat).padStart(2, '0')}/{e.jahr}</span>
                    <span className="oz-recent-sum">{fmt(e.betrag)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Debtors */}
          {ueberfaelligeMitglieder.length > 0 ? (
            <div className="oz-insight-card oz-insight-debtors">
              <div className="oz-insight-hd">
                <span><AlertCircle size={14} /> Top Rückstände</span>
                <span className="oz-insight-sub">{ueberfaelligeMitglieder.length} Mitglieder</span>
              </div>
              <div className="oz-debtors-list">
                {ueberfaelligeMitglieder.slice(0, 5).map(m => (
                  <div
                    key={m.mitglied_id}
                    className="oz-debtor-row"
                    onClick={() => navigate(`/dashboard/mitglieder/${m.mitglied_id}`)}
                  >
                    <div className="oz-debtor-info">
                      <span className="oz-debtor-name">{m.vorname} {m.nachname}</span>
                      <span className="oz-debtor-meta">{m.anzahl_monate} Mo. · {m.tage_ueberfaellig}d überfällig</span>
                    </div>
                    <span className={`oz-debtor-amt ${m.tage_ueberfaellig > 60 ? 'oz-debtor-amt--red' : ''}`}>
                      {fmt(m.gesamtbetrag)}
                    </span>
                  </div>
                ))}
              </div>
              {ueberfaelligeMitglieder.length > 5 && (
                <button className="oz-show-all" onClick={() => setActiveTab('ueberfaellig')}>
                  +{ueberfaelligeMitglieder.length - 5} weitere anzeigen →
                </button>
              )}
            </div>
          ) : healthScore !== null && (
            <div className="oz-insight-card oz-insight-health">
              <div className="oz-insight-hd">
                <span>{healthScore >= 70 ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />} Zahlungsgesundheit</span>
              </div>
              <div className="oz-health-score">
                <div className={`oz-health-ring ${healthScore >= 70 ? 'oz-health-ring--good' : healthScore >= 40 ? 'oz-health-ring--warn' : 'oz-health-ring--bad'}`}>
                  <span className="oz-health-num">{healthScore}</span>
                  <span className="oz-health-unit">/ 100</span>
                </div>
                <p className="oz-health-label">
                  {healthScore >= 70 ? 'Sehr gut — alles im grünen Bereich' : healthScore >= 40 ? 'Handlungsbedarf bei einigen Positionen' : 'Kritisch — sofortige Maßnahmen nötig'}
                </p>
              </div>
            </div>
          )}

        </section>
      )}

      {/* ════════════ TAB NAVIGATION ════════════ */}
      <nav className="oz-tabs-nav">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`oz-tab-btn ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            <t.icon size={15} />
            <span className="oz-tab-label">{t.label}</span>
            {t.count > 0 && (
              <span className={`oz-tab-badge oz-tab-badge--${t.color}`}>{t.count}</span>
            )}
          </button>
        ))}
      </nav>

      {/* ════════════ TAB PANELS ════════════ */}
      <div className="oz-panel">

        {/* ── TAB: ÜBERFÄLLIGE BEITRÄGE ── */}
        {activeTab === 'ueberfaellig' && (
          <>
            <div className="oz-panel-hd">
              <div className="oz-panel-title">
                <AlertTriangle size={17} />
                Überfällige Beiträge
                <span className="oz-panel-count">{ueberfaelligeMitglieder.length} Mitglieder</span>
              </div>
              {ueberfaelligeMitglieder.length > 0 && (
                <span className="oz-panel-total">{fmt(ueberfaelligeMitglieder.reduce((s, m) => s + parseFloat(m.gesamtbetrag), 0))}</span>
              )}
            </div>
            <div className="oz-table-wrap">
              {ueberfaelligeMitglieder.length === 0 ? (
                <div className="oz-empty"><CheckCircle size={48} /><h3>Keine überfälligen Beiträge</h3><p>Alle Beiträge sind bezahlt.</p></div>
              ) : (
                <table className="oz-table">
                  <thead>
                    <tr>
                      <th>Mitglied</th>
                      <th>Kontakt</th>
                      <th>IBAN</th>
                      <th>Zahlungsmethode</th>
                      <th>Offene Monate</th>
                      <th>Ältester Rückstand</th>
                      <th>Tage überfällig</th>
                      <th className="oz-td-right">Betrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ueberfaelligeMitglieder.map(m => (
                      <tr key={m.mitglied_id} className={m.zahlungsproblem ? 'oz-tr--problem' : ''}>
                        <td>
                          <div className="oz-td-member">
                            <button className="oz-link" onClick={() => navigate(`/dashboard/mitglieder/${m.mitglied_id}`)}>
                              <strong>{m.vorname} {m.nachname}</strong>
                              <ExternalLink size={12} />
                            </button>
                            {m.zahlungsproblem === 1 && <span className="oz-problem-flag"><AlertCircle size={11} /> Problemflag</span>}
                          </div>
                        </td>
                        <td>
                          <div className="oz-td-contact">
                            {m.email && <span><Mail size={11} /> {m.email}</span>}
                            {m.telefon && <span><Phone size={11} /> {m.telefon}</span>}
                          </div>
                        </td>
                        <td><code className="oz-iban">{maskIban(m.iban)}</code></td>
                        <td><span className="oz-badge-neutral">{m.zahlungsmethode || '—'}</span></td>
                        <td>
                          <div className="oz-monate-list">
                            <span className="oz-badge-count">{m.anzahl_monate} Monate</span>
                            <span className="oz-monate-detail">{m.offene_monate}</span>
                          </div>
                        </td>
                        <td>{fmtDate(m.aeltestes_datum)}</td>
                        <td>
                          <span className={`oz-days ${m.tage_ueberfaellig > 60 ? 'oz-days--critical' : m.tage_ueberfaellig > 30 ? 'oz-days--warning' : 'oz-days--normal'}`}>
                            {m.tage_ueberfaellig} Tage
                          </span>
                        </td>
                        <td className="oz-td-right oz-td-bold oz-td-danger">{fmt(m.gesamtbetrag)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="oz-tfoot">
                      <td colSpan={7}><strong>Gesamt</strong></td>
                      <td className="oz-td-right oz-td-bold">{fmt(ueberfaelligeMitglieder.reduce((s, m) => s + parseFloat(m.gesamtbetrag), 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </>
        )}

        {/* ── TAB: FEHLGESCHLAGENE EINZÜGE ── */}
        {activeTab === 'fehlgeschlagen' && (
          <>
            <div className="oz-panel-hd">
              <div className="oz-panel-title">
                <XCircle size={17} />
                Fehlgeschlagene Stripe-Einzüge
                <span className="oz-panel-count">{failedTransaktionen.length} Einträge</span>
              </div>
              {failedTransaktionen.length > 1 && (
                <button className="oz-btn-action-primary" onClick={handleRetryAll} disabled={retryAllLoading}>
                  {retryAllLoading ? <RefreshCw size={14} className="spin" /> : <Zap size={14} />}
                  Alle erneut einziehen
                </button>
              )}
            </div>
            <div className="oz-table-wrap">
              {failedTransaktionen.length === 0 ? (
                <div className="oz-empty"><CheckCircle size={48} /><h3>Keine fehlgeschlagenen Einzüge</h3></div>
              ) : (
                <table className="oz-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}></th>
                      <th>Mitglied</th>
                      <th>Monat</th>
                      <th>IBAN</th>
                      <th>Fehlergrund</th>
                      <th>Datum</th>
                      <th>Batch</th>
                      <th className="oz-td-right">Betrag</th>
                      <th style={{ width: 48 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedTransaktionen.map(t => (
                      <React.Fragment key={t.id}>
                        <tr className="oz-tr--failed">
                          <td>
                            <button className="oz-expand-btn" onClick={() => toggleRow(t.id)}>
                              {expandedRows[t.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          </td>
                          <td>
                            <div className="oz-td-member">
                              <button className="oz-link" onClick={() => navigate(`/dashboard/mitglieder/${t.mitglied_id}`)}>
                                <strong>{t.vorname} {t.nachname}</strong>
                                <ExternalLink size={12} />
                              </button>
                              <span className="oz-td-email">{t.email}</span>
                            </div>
                          </td>
                          <td><span className="oz-badge-neutral">{String(t.monat).padStart(2, '0')}/{t.jahr}</span></td>
                          <td><code className="oz-iban">{maskIban(t.iban)}</code></td>
                          <td>
                            <span className="oz-error-msg">
                              {t.error_message
                                ? t.error_message.length > 60 ? t.error_message.slice(0, 60) + '…' : t.error_message
                                : <span className="oz-text-muted">—</span>}
                            </span>
                          </td>
                          <td className="oz-text-muted">{fmtDate(t.created_at)}</td>
                          <td><code className="oz-text-muted" style={{ fontSize: '0.72rem' }}>#{t.batch_id}</code></td>
                          <td className="oz-td-right oz-td-bold oz-td-danger">{fmt(t.retry_betrag || t.betrag)}</td>
                          <td>
                            {t.can_retry ? (
                              <button className="btn-action success" onClick={() => handleRetry(t)} disabled={retryLoading[t.id]} title="Erneut einziehen">
                                {retryLoading[t.id] ? <RefreshCw size={15} className="spin" /> : <RotateCcw size={15} />}
                              </button>
                            ) : (
                              <span title="Bereits bezahlt" style={{ color: 'var(--success)', padding: '0.25rem', display: 'flex' }}><CheckCircle size={15} /></span>
                            )}
                          </td>
                        </tr>
                        {expandedRows[t.id] && (
                          <tr className="oz-tr--expanded">
                            <td colSpan={9}>
                              <div className="oz-expanded-detail">
                                <div className="oz-detail-field">
                                  <span className="oz-detail-label"><Hash size={12} /> Stripe PI</span>
                                  <code>{t.stripe_payment_intent_id || '—'}</code>
                                </div>
                                <div className="oz-detail-field">
                                  <span className="oz-detail-label"><Info size={12} /> Vollständiger Fehler</span>
                                  <span>{t.error_message || '—'}</span>
                                </div>
                                <div className="oz-detail-field">
                                  <span className="oz-detail-label"><Banknote size={12} /> Beitrags-IDs</span>
                                  <span>{t.beitrag_ids || '—'}</span>
                                </div>
                                <div className="oz-detail-field">
                                  <span className="oz-detail-label"><User size={12} /> Mitglieds-ID</span>
                                  <span>#{t.mitglied_id}</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ── TAB: SEPA-CLEARING ── */}
        {activeTab === 'clearing' && (
          <>
            <div className="oz-panel-hd">
              <div className="oz-panel-title">
                <Activity size={17} />
                Im SEPA-Clearing
                <span className="oz-panel-count">{processingTransaktionen.length} Transaktionen</span>
              </div>
              {processingTransaktionen.length > 0 && (
                <span className="oz-panel-total">{fmt(processingTransaktionen.reduce((s, t) => s + parseFloat(t.betrag), 0))}</span>
              )}
            </div>
            <p className="oz-panel-hint">Eingereichte Lastschriften warten auf Bankbestätigung — typisch 2–5 Werktage.</p>
            <div className="oz-table-wrap">
              {processingTransaktionen.length === 0 ? (
                <div className="oz-empty"><CheckCircle size={48} /><h3>Keine laufenden Transaktionen</h3></div>
              ) : (
                <table className="oz-table">
                  <thead>
                    <tr>
                      <th>Mitglied</th>
                      <th>Monat</th>
                      <th>IBAN</th>
                      <th>Eingereicht am</th>
                      <th>Tage im Clearing</th>
                      <th>Stripe PI</th>
                      <th className="oz-td-right">Betrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processingTransaktionen.map(t => (
                      <tr key={t.id} className={t.tage_im_clearing > 5 ? 'oz-tr--warn' : ''}>
                        <td>
                          <div className="oz-td-member">
                            <button className="oz-link" onClick={() => navigate(`/dashboard/mitglieder/${t.mitglied_id}`)}>
                              <strong>{t.vorname} {t.nachname}</strong>
                              <ExternalLink size={12} />
                            </button>
                            <span className="oz-td-email">{t.email}</span>
                          </div>
                        </td>
                        <td><span className="oz-badge-neutral">{String(t.monat).padStart(2, '0')}/{t.jahr}</span></td>
                        <td><code className="oz-iban">{maskIban(t.iban)}</code></td>
                        <td className="oz-text-muted">{fmtDate(t.created_at)}</td>
                        <td>
                          <span className={`oz-days ${t.tage_im_clearing > 5 ? 'oz-days--warning' : 'oz-days--normal'}`}>
                            {t.tage_im_clearing} Tage
                            {t.tage_im_clearing > 5 && <AlertTriangle size={11} />}
                          </span>
                        </td>
                        <td><code className="oz-text-muted" style={{ fontSize: '0.72rem' }}>{t.stripe_payment_intent_id?.slice(-12) || '—'}</code></td>
                        <td className="oz-td-right oz-td-bold">{fmt(t.betrag)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ── TAB: RÜCKLASTSCHRIFTEN ── */}
        {activeTab === 'zahlungen' && (
          <>
            <div className="oz-panel-hd">
              <div className="oz-panel-title"><Building2 size={17} /> Rücklastschriften</div>
            </div>
            <div className="oz-filter-bar">
              <div className="filter-group">
                <Filter size={16} />
                <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
                  <option value="offen">Offen</option>
                  <option value="in_bearbeitung">In Bearbeitung</option>
                  <option value="erledigt">Erledigt</option>
                  <option value="alle">Alle</option>
                </select>
              </div>
              <div className="filter-group">
                <select value={filter.typ} onChange={e => setFilter({ ...filter, typ: e.target.value })}>
                  <option value="">Alle Typen</option>
                  <option value="ruecklastschrift">Rücklastschriften</option>
                  <option value="chargeback">Chargebacks</option>
                  <option value="fehlgeschlagen">Fehlgeschlagen</option>
                </select>
              </div>
              <div className="filter-group search">
                <Search size={16} />
                <input type="text" placeholder="Name oder Referenz..." value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} />
              </div>
            </div>
            <div className="oz-list">
              {loading ? (
                <div className="oz-loading"><RefreshCw size={32} className="spin" /><p>Lade Daten...</p></div>
              ) : filteredZahlungen.length === 0 ? (
                <div className="oz-empty"><CheckCircle size={48} /><h3>Keine Einträge</h3></div>
              ) : (
                filteredZahlungen.map(z => (
                  <div key={z.id} className={`oz-item ${z.status}`}>
                    <div className="oz-item-main">
                      <div className="oz-item-member">
                        <strong>{z.vorname} {z.nachname}</strong>
                        <span className="oz-item-email">{z.email}</span>
                        {z.dojoname && <span className="oz-item-dojo">{z.dojoname}</span>}
                      </div>
                      <div className="oz-item-details">{getTypBadge(z.typ)}{getStatusBadge(z.status)}</div>
                      <div className="oz-item-amount">
                        <strong>{fmt(z.betrag)}</strong>
                        <span className="oz-item-date"><Clock size={12} />{fmtDate(z.erstellt_am)}</span>
                      </div>
                      <div className="oz-item-actions">
                        {z.status === 'offen' && (
                          <>
                            <button className="btn-action success" onClick={() => handleStatusChange(z.id, 'erledigt')} title="Erledigt"><Check size={16} /></button>
                            <button className="btn-action warning" onClick={() => handleMahnung(z.id)} title="Mahnung"><Mail size={16} /></button>
                            <button className="btn-action danger" onClick={() => handleStatusChange(z.id, 'storniert')} title="Stornieren"><X size={16} /></button>
                          </>
                        )}
                        <button className="btn-action info" onClick={() => { setSelectedZahlung(z); setShowDetail(true); }} title="Details"><Eye size={16} /></button>
                      </div>
                    </div>
                    {z.beschreibung && <div className="oz-item-description">{z.beschreibung}</div>}
                    {z.mahnungen_gesendet > 0 && (
                      <div className="oz-item-mahnungen">
                        <Mail size={12} /> {z.mahnungen_gesendet} Mahnung(en){z.letzte_mahnung && ` — Letzte: ${fmtDate(z.letzte_mahnung)}`}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ── TAB: STRIPE DISPUTES ── */}
        {activeTab === 'disputes' && (
          <>
            <div className="oz-panel-hd">
              <div className="oz-panel-title">
                <CreditCard size={17} />
                Stripe Disputes
                <span className="oz-panel-count">{disputes.length} gesamt</span>
              </div>
            </div>
            <div className="oz-table-wrap">
              {disputes.length === 0 ? (
                <div className="oz-empty"><CheckCircle size={48} /><h3>Keine Stripe Disputes</h3></div>
              ) : (
                <table className="oz-table">
                  <thead>
                    <tr><th>Mitglied</th><th>Dispute-ID</th><th>Grund</th><th>Status</th><th>Frist</th><th className="oz-td-right">Betrag</th></tr>
                  </thead>
                  <tbody>
                    {disputes.map(d => (
                      <tr key={d.id} className={d.status === 'needs_response' ? 'oz-tr--warn' : ''}>
                        <td><strong>{d.vorname || 'Unbekannt'} {d.nachname || ''}</strong></td>
                        <td><code style={{ fontSize: '0.75rem' }}>{d.stripe_dispute_id}</code></td>
                        <td><span className="reason-badge">{d.reason || '—'}</span></td>
                        <td>
                          <span className={`status-badge ${d.status}`}>
                            {d.status === 'won' ? '✓ Gewonnen' : d.status === 'lost' ? '✗ Verloren' : d.status === 'needs_response' ? '⚠ Antwort nötig' : d.status}
                          </span>
                        </td>
                        <td>{d.evidence_due_by ? <span className="oz-days oz-days--warning"><AlertTriangle size={11} /> {fmtDate(d.evidence_due_by)}</span> : '—'}</td>
                        <td className="oz-td-right oz-td-bold">{fmt(d.amount / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ── TAB: PROBLEM-MITGLIEDER ── */}
        {activeTab === 'mitglieder' && (
          <>
            <div className="oz-panel-hd">
              <div className="oz-panel-title">
                <Users size={17} />
                Problem-Mitglieder
                <span className="oz-panel-count">{mitgliederProbleme.length} Mitglieder</span>
              </div>
            </div>
            <div className="oz-table-wrap">
              {mitgliederProbleme.length === 0 ? (
                <div className="oz-empty"><CheckCircle size={48} /><h3>Keine Problem-Mitglieder</h3></div>
              ) : (
                <table className="oz-table">
                  <thead>
                    <tr><th>Mitglied</th><th>Kontakt</th><th>Problem seit</th><th>Details</th><th className="oz-td-right">Offener Betrag</th></tr>
                  </thead>
                  <tbody>
                    {mitgliederProbleme.map(m => (
                      <tr key={m.mitglied_id}>
                        <td>
                          <div className="oz-td-member">
                            <button className="oz-link" onClick={() => navigate(`/dashboard/mitglieder/${m.mitglied_id}`)}>
                              <strong>{m.vorname} {m.nachname}</strong><ExternalLink size={12} />
                            </button>
                            {m.dojoname && <span className="oz-td-email">{m.dojoname}</span>}
                          </div>
                        </td>
                        <td><div className="oz-td-contact"><span><Mail size={11} /> {m.email}</span></div></td>
                        <td>{m.zahlungsproblem_datum ? fmtDate(m.zahlungsproblem_datum) : '—'}</td>
                        <td>{m.zahlungsproblem_details || '—'}</td>
                        <td className="oz-td-right oz-td-bold oz-td-danger">{fmt(m.summe_offen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

      </div>

      {/* ════════════ DETAIL MODAL ════════════ */}
      {showDetail && selectedZahlung && (
        <div className="oz-modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="oz-modal" onClick={e => e.stopPropagation()}>
            <div className="oz-modal-header">
              <h3>Zahlungsdetails</h3>
              <button onClick={() => setShowDetail(false)}><X size={20} /></button>
            </div>
            <div className="oz-modal-content">
              {[
                ['Mitglied', `${selectedZahlung.vorname} ${selectedZahlung.nachname}`, true],
                ['E-Mail', selectedZahlung.email],
                ['Dojo', selectedZahlung.dojoname],
                ['Betrag', fmt(selectedZahlung.betrag), true],
                ['Typ', getTypBadge(selectedZahlung.typ)],
                ['Status', getStatusBadge(selectedZahlung.status)],
                ['Erstellt', fmtDate(selectedZahlung.erstellt_am)],
                ['Referenz', selectedZahlung.referenz ? <code>{selectedZahlung.referenz}</code> : null],
              ].map(([label, val], i) => val ? (
                <div key={i} className="detail-row">
                  <span>{label}:</span>
                  {typeof val === 'string' ? (label === 'Betrag' || label === 'Mitglied' ? <strong>{val}</strong> : <span>{val}</span>) : val}
                </div>
              ) : null)}
              {selectedZahlung.beschreibung && <div className="detail-row full"><span>Beschreibung:</span><p>{selectedZahlung.beschreibung}</p></div>}
              {selectedZahlung.notizen && <div className="detail-row full"><span>Notizen:</span><p>{selectedZahlung.notizen}</p></div>}
            </div>
            <div className="oz-modal-footer">
              {selectedZahlung.status === 'offen' && (
                <>
                  <button className="btn success" onClick={() => { handleStatusChange(selectedZahlung.id, 'erledigt'); setShowDetail(false); }}><Check size={16} /> Erledigt</button>
                  <button className="btn warning" onClick={() => handleMahnung(selectedZahlung.id)}><Mail size={16} /> Mahnung</button>
                </>
              )}
              <button className="btn secondary" onClick={() => setShowDetail(false)}>Schließen</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default OffeneZahlungen;
