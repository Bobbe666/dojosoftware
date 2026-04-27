// ============================================================================
// OFFENE ZAHLUNGEN - Verwaltung von Rücklastschriften & Chargebacks
// ============================================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle, CreditCard, Building2, RefreshCw, Check, X,
  Mail, Eye, Filter, TrendingDown, Users, Clock, CheckCircle,
  XCircle, AlertCircle, Search, RotateCcw, TrendingUp, Euro,
  Activity, ArrowUpRight
} from 'lucide-react';
import '../styles/OffeneZahlungen.css';

const OffeneZahlungen = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [zahlungen, setZahlungen] = useState([]);
  const [stats, setStats] = useState({});
  const [disputes, setDisputes] = useState([]);
  const [mitgliederProbleme, setMitgliederProbleme] = useState([]);
  const [failedTransaktionen, setFailedTransaktionen] = useState([]);
  const [retryLoading, setRetryLoading] = useState({});
  const [auswertung, setAuswertung] = useState(null);

  // Filter
  const [filter, setFilter] = useState({
    status: 'offen',
    typ: '',
    search: ''
  });

  // UI State
  const [activeTab, setActiveTab] = useState('zahlungen');
  const [selectedZahlung, setSelectedZahlung] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    loadData();
  }, [filter.status, filter.typ]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.typ) params.append('typ', filter.typ);

      const [zahlungenRes, disputesRes, mitgliederRes, failedRes, auswertungRes] = await Promise.all([
        axios.get(`/admin/offene-zahlungen?${params}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('/admin/stripe/disputes', {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { disputes: [] } })),
        axios.get('/admin/mitglieder-mit-zahlungsproblemen', {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { mitglieder: [] } })),
        axios.get('/lastschriftlauf/stripe/failed-transactions', {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { transactions: [] } })),
        axios.get('/lastschriftlauf/zahlungsauswertung', {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: null }))
      ]);

      if (zahlungenRes.data.success) {
        setZahlungen(zahlungenRes.data.zahlungen || []);
        setStats(zahlungenRes.data.stats || {});
      }

      setDisputes(disputesRes.data.disputes || []);
      setMitgliederProbleme(mitgliederRes.data.mitglieder || []);
      setFailedTransaktionen(failedRes.data.transactions || []);
      if (auswertungRes.data?.success) setAuswertung(auswertungRes.data);

    } catch (err) {
      console.error('Fehler beim Laden:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await axios.put(`/admin/offene-zahlungen/${id}`, {
        status: newStatus
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadData();
    } catch (err) {
      console.error('Fehler:', err);
      alert('Fehler beim Aktualisieren');
    }
  };

  const handleRetry = async (trans) => {
    if (!window.confirm(`Einzug für ${trans.vorname} ${trans.nachname} (${trans.retry_betrag?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}) erneut starten?`)) return;
    setRetryLoading(prev => ({ ...prev, [trans.id]: true }));
    try {
      const res = await axios.post('/lastschriftlauf/stripe/retry-single', {
        transaktion_id: trans.id,
        mitglied_id: trans.mitglied_id,
        monat: trans.monat,
        jahr: trans.jahr
      }, { headers: { Authorization: `Bearer ${token}` } });
      const st = res.data.status;
      alert(`✅ Einzug gestartet — Status: ${st === 'processing' ? 'In Bearbeitung (SEPA-Clearing läuft)' : st === 'succeeded' ? 'Sofort erfolgreich' : st}`);
      loadData();
    } catch (err) {
      alert(`❌ Fehler: ${err.response?.data?.error || err.message}`);
    } finally {
      setRetryLoading(prev => ({ ...prev, [trans.id]: false }));
    }
  };

  const handleMahnung = async (id) => {
    try {
      await axios.post(`/admin/offene-zahlungen/${id}/mahnung`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Mahnung vermerkt');
      loadData();
    } catch (err) {
      console.error('Fehler:', err);
    }
  };

  const getTypBadge = (typ) => {
    const types = {
      'ruecklastschrift': { label: 'Rücklastschrift', color: 'var(--error)', icon: Building2 },
      'chargeback': { label: 'Chargeback', color: 'var(--warning)', icon: CreditCard },
      'fehlgeschlagen': { label: 'Fehlgeschlagen', color: 'var(--color-midnight-500)', icon: XCircle },
      'mahnung': { label: 'Mahnung', color: '#8b5cf6', icon: Mail },
      'sonstig': { label: 'Sonstig', color: 'var(--text-muted)', icon: AlertCircle }
    };
    const t = types[typ] || types.sonstig;
    const Icon = t.icon;
    return (
      <span className="typ-badge" style={{ '--typ-color': t.color }}>
        <Icon size={12} />
        {t.label}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const statuses = {
      'offen': { label: 'Offen', color: 'var(--error)' },
      'in_bearbeitung': { label: 'In Bearbeitung', color: 'var(--warning)' },
      'erledigt': { label: 'Erledigt', color: 'var(--success)' },
      'storniert': { label: 'Storniert', color: 'var(--text-muted)' }
    };
    const s = statuses[status] || statuses.offen;
    return (
      <span className="status-badge" style={{ '--status-color': s.color }}>
        {s.label}
      </span>
    );
  };

  const filteredZahlungen = zahlungen.filter(z => {
    if (filter.search) {
      const search = filter.search.toLowerCase();
      const name = `${z.vorname || ''} ${z.nachname || ''}`.toLowerCase();
      const ref = (z.referenz || '').toLowerCase();
      if (!name.includes(search) && !ref.includes(search)) return false;
    }
    return true;
  });

  return (
    <div className="offene-zahlungen">
      {/* Header */}
      <div className="oz-header">
        <div className="oz-header-info">
          <h1>
            <AlertTriangle size={28} />
            Offene Zahlungen & Rücklastschriften
          </h1>
          <p>Verwalten Sie fehlgeschlagene Zahlungen, Chargebacks und Rücklastschriften</p>
        </div>
        <button onClick={loadData} className="btn-refresh" disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          Aktualisieren
        </button>
      </div>

      {/* Auswertung */}
      {auswertung && (
        <div className="oz-auswertung">
          {/* Zeile 1: Hauptkennzahlen */}
          <div className="oz-kpi-grid">
            <div className="oz-kpi oz-kpi--danger">
              <div className="oz-kpi-icon"><TrendingDown size={20} /></div>
              <div className="oz-kpi-body">
                <span className="oz-kpi-value">
                  {auswertung.offene_beitraege.summe.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </span>
                <span className="oz-kpi-label">Überfällig gesamt</span>
                <span className="oz-kpi-sub">{auswertung.offene_beitraege.anzahl} Beiträge · {auswertung.offene_beitraege.betroffene_mitglieder} Mitglieder</span>
              </div>
            </div>

            <div className="oz-kpi oz-kpi--success">
              <div className="oz-kpi-icon"><TrendingUp size={20} /></div>
              <div className="oz-kpi-body">
                <span className="oz-kpi-value">
                  {auswertung.aktueller_monat.eingezogen.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </span>
                <span className="oz-kpi-label">Dieser Monat eingezogen</span>
                <span className="oz-kpi-sub">{auswertung.aktueller_monat.anzahl_bezahlt} von {auswertung.aktueller_monat.anzahl_bezahlt + auswertung.aktueller_monat.anzahl_offen} Beiträgen</span>
              </div>
            </div>

            <div className="oz-kpi oz-kpi--warning">
              <div className="oz-kpi-icon"><Euro size={20} /></div>
              <div className="oz-kpi-body">
                <span className="oz-kpi-value">
                  {auswertung.aktueller_monat.noch_offen.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </span>
                <span className="oz-kpi-label">Dieser Monat noch offen</span>
                <span className="oz-kpi-sub">{auswertung.aktueller_monat.anzahl_offen} ausstehende Beiträge</span>
              </div>
            </div>

            <div className={`oz-kpi ${auswertung.failed_stripe.anzahl > 0 ? 'oz-kpi--danger' : 'oz-kpi--neutral'}`}>
              <div className="oz-kpi-icon"><XCircle size={20} /></div>
              <div className="oz-kpi-body">
                <span className="oz-kpi-value">{auswertung.failed_stripe.anzahl}</span>
                <span className="oz-kpi-label">Fehlgeschlagene Einzüge</span>
                <span className="oz-kpi-sub">
                  {auswertung.failed_stripe.summe > 0
                    ? auswertung.failed_stripe.summe.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
                    : 'Alle erledigt'}
                </span>
              </div>
            </div>

            <div className={`oz-kpi ${auswertung.processing_stripe.anzahl > 0 ? 'oz-kpi--info' : 'oz-kpi--neutral'}`}>
              <div className="oz-kpi-icon"><Activity size={20} /></div>
              <div className="oz-kpi-body">
                <span className="oz-kpi-value">{auswertung.processing_stripe.anzahl}</span>
                <span className="oz-kpi-label">Im SEPA-Clearing</span>
                <span className="oz-kpi-sub">
                  {auswertung.processing_stripe.summe > 0
                    ? auswertung.processing_stripe.summe.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
                    : 'Keine laufenden'}
                </span>
              </div>
            </div>

            <div className={`oz-kpi ${auswertung.ruecklastschriften.anzahl > 0 ? 'oz-kpi--warning' : 'oz-kpi--neutral'}`}>
              <div className="oz-kpi-icon"><Building2 size={20} /></div>
              <div className="oz-kpi-body">
                <span className="oz-kpi-value">{auswertung.ruecklastschriften.anzahl}</span>
                <span className="oz-kpi-label">Rücklastschriften offen</span>
                <span className="oz-kpi-sub">
                  {auswertung.ruecklastschriften.summe > 0
                    ? auswertung.ruecklastschriften.summe.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
                    : 'Keine offenen'}
                </span>
              </div>
            </div>
          </div>

          {/* Zeile 2: Monatsverlauf + letzte Erfolge */}
          <div className="oz-detail-grid">
            {auswertung.monatsverlauf?.length > 0 && (
              <div className="oz-detail-card">
                <h3><ArrowUpRight size={16} /> Monatsverlauf (letzte 6 Monate)</h3>
                <div className="oz-monatsverlauf">
                  {auswertung.monatsverlauf.map(m => {
                    const maxVal = Math.max(...auswertung.monatsverlauf.map(x => parseFloat(x.summe)));
                    const pct = maxVal > 0 ? (parseFloat(m.summe) / maxVal * 100) : 0;
                    const [yr, mo] = m.monat.split('-');
                    return (
                      <div key={m.monat} className="oz-bar-item">
                        <div className="oz-bar-fill" style={{ height: `${Math.max(pct, 4)}%` }} title={parseFloat(m.summe).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} />
                        <span className="oz-bar-label">{mo}/{yr.slice(2)}</span>
                        <span className="oz-bar-val">{(parseFloat(m.summe)/1000).toFixed(1)}k</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {auswertung.letzte_erfolge?.length > 0 && (
              <div className="oz-detail-card">
                <h3><CheckCircle size={16} /> Letzte erfolgreiche Einzüge</h3>
                <div className="oz-erfolge-list">
                  {auswertung.letzte_erfolge.map((e, i) => (
                    <div key={i} className="oz-erfolg-item">
                      <span className="oz-erfolg-name">{e.vorname} {e.nachname}</span>
                      <span className="oz-erfolg-monat">{String(e.monat).padStart(2,'0')}/{e.jahr}</span>
                      <span className="oz-erfolg-betrag">{parseFloat(e.betrag).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {auswertung.mitglieder_mit_problem > 0 && (
              <div className="oz-detail-card oz-detail-card--alert">
                <h3><Users size={16} /> Zahlungsprobleme</h3>
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--error)' }}>{auswertung.mitglieder_mit_problem}</span>
                  <p style={{ margin: '0.5rem 0 0', color: 'var(--text-2)', fontSize: '0.9rem' }}>Mitglieder mit aktivem Zahlungsproblem-Flag</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="oz-tabs">
        <button
          className={`oz-tab ${activeTab === 'zahlungen' ? 'active' : ''}`}
          onClick={() => setActiveTab('zahlungen')}
        >
          <AlertTriangle size={16} />
          Offene Zahlungen
          {stats.offen > 0 && <span className="tab-count">{stats.offen}</span>}
        </button>
        <button
          className={`oz-tab ${activeTab === 'disputes' ? 'active' : ''}`}
          onClick={() => setActiveTab('disputes')}
        >
          <CreditCard size={16} />
          Stripe Disputes
          {disputes.filter(d => d.status !== 'won' && d.status !== 'lost').length > 0 && (
            <span className="tab-count">{disputes.filter(d => d.status !== 'won' && d.status !== 'lost').length}</span>
          )}
        </button>
        <button
          className={`oz-tab ${activeTab === 'mitglieder' ? 'active' : ''}`}
          onClick={() => setActiveTab('mitglieder')}
        >
          <Users size={16} />
          Problem-Mitglieder
          {mitgliederProbleme.length > 0 && <span className="tab-count">{mitgliederProbleme.length}</span>}
        </button>
        <button
          className={`oz-tab ${activeTab === 'fehlgeschlagen' ? 'active' : ''}`}
          onClick={() => setActiveTab('fehlgeschlagen')}
        >
          <XCircle size={16} />
          Fehlgeschlagene Einzüge
          {failedTransaktionen.length > 0 && <span className="tab-count">{failedTransaktionen.length}</span>}
        </button>
      </div>

      {/* Content */}
      <div className="oz-content">
        {/* Offene Zahlungen Tab */}
        {activeTab === 'zahlungen' && (
          <>
            {/* Filter */}
            <div className="oz-filter-bar">
              <div className="filter-group">
                <Filter size={16} />
                <select
                  value={filter.status}
                  onChange={e => setFilter({ ...filter, status: e.target.value })}
                >
                  <option value="offen">Offen</option>
                  <option value="in_bearbeitung">In Bearbeitung</option>
                  <option value="erledigt">Erledigt</option>
                  <option value="alle">Alle</option>
                </select>
              </div>
              <div className="filter-group">
                <select
                  value={filter.typ}
                  onChange={e => setFilter({ ...filter, typ: e.target.value })}
                >
                  <option value="">Alle Typen</option>
                  <option value="ruecklastschrift">Rücklastschriften</option>
                  <option value="chargeback">Chargebacks</option>
                  <option value="fehlgeschlagen">Fehlgeschlagen</option>
                </select>
              </div>
              <div className="filter-group search">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Name oder Referenz suchen..."
                  value={filter.search}
                  onChange={e => setFilter({ ...filter, search: e.target.value })}
                />
              </div>
            </div>

            {/* Liste */}
            <div className="oz-list">
              {loading ? (
                <div className="oz-loading">
                  <RefreshCw size={32} className="spin" />
                  <p>Lade Daten...</p>
                </div>
              ) : filteredZahlungen.length === 0 ? (
                <div className="oz-empty">
                  <CheckCircle size={48} />
                  <h3>Keine offenen Zahlungen</h3>
                  <p>Aktuell gibt es keine {filter.status === 'offen' ? 'offenen' : ''} Zahlungsprobleme.</p>
                </div>
              ) : (
                filteredZahlungen.map(z => (
                  <div key={z.id} className={`oz-item ${z.status}`}>
                    <div className="oz-item-main">
                      <div className="oz-item-member">
                        <strong>{z.vorname} {z.nachname}</strong>
                        <span className="oz-item-email">{z.email}</span>
                        {z.dojoname && <span className="oz-item-dojo">{z.dojoname}</span>}
                      </div>
                      <div className="oz-item-details">
                        {getTypBadge(z.typ)}
                        {getStatusBadge(z.status)}
                      </div>
                      <div className="oz-item-amount">
                        <strong>{parseFloat(z.betrag).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</strong>
                        <span className="oz-item-date">
                          <Clock size={12} />
                          {new Date(z.erstellt_am).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                      <div className="oz-item-actions">
                        {z.status === 'offen' && (
                          <>
                            <button
                              className="btn-action success"
                              onClick={() => handleStatusChange(z.id, 'erledigt')}
                              title="Als erledigt markieren"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              className="btn-action warning"
                              onClick={() => handleMahnung(z.id)}
                              title="Mahnung senden"
                            >
                              <Mail size={16} />
                            </button>
                            <button
                              className="btn-action danger"
                              onClick={() => handleStatusChange(z.id, 'storniert')}
                              title="Stornieren"
                            >
                              <X size={16} />
                            </button>
                          </>
                        )}
                        <button
                          className="btn-action info"
                          onClick={() => { setSelectedZahlung(z); setShowDetail(true); }}
                          title="Details anzeigen"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </div>
                    {z.beschreibung && (
                      <div className="oz-item-description">
                        {z.beschreibung}
                      </div>
                    )}
                    {z.mahnungen_gesendet > 0 && (
                      <div className="oz-item-mahnungen">
                        <Mail size={12} />
                        {z.mahnungen_gesendet} Mahnung(en) gesendet
                        {z.letzte_mahnung && ` - Letzte: ${new Date(z.letzte_mahnung).toLocaleDateString('de-DE')}`}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Stripe Disputes Tab */}
        {activeTab === 'disputes' && (
          <div className="oz-list">
            {disputes.length === 0 ? (
              <div className="oz-empty">
                <CheckCircle size={48} />
                <h3>Keine Stripe Disputes</h3>
                <p>Es gibt keine aktiven Chargebacks.</p>
              </div>
            ) : (
              disputes.map(d => (
                <div key={d.id} className={`oz-item dispute ${d.status}`}>
                  <div className="oz-item-main">
                    <div className="oz-item-member">
                      <strong>{d.vorname || 'Unbekannt'} {d.nachname || ''}</strong>
                      <span className="dispute-id">{d.stripe_dispute_id}</span>
                    </div>
                    <div className="oz-item-details">
                      <span className="reason-badge">{d.reason || 'Unbekannt'}</span>
                      <span className={`status-badge ${d.status}`}>
                        {d.status === 'won' ? 'Gewonnen' :
                         d.status === 'lost' ? 'Verloren' :
                         d.status === 'needs_response' ? 'Antwort nötig' :
                         d.status}
                      </span>
                    </div>
                    <div className="oz-item-amount">
                      <strong>{(d.amount / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</strong>
                      {d.evidence_due_by && (
                        <span className="due-date">
                          <AlertTriangle size={12} />
                          Frist: {new Date(d.evidence_due_by).toLocaleDateString('de-DE')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Fehlgeschlagene Stripe-Einzüge Tab */}
        {activeTab === 'fehlgeschlagen' && (
          <div className="oz-list">
            {failedTransaktionen.length === 0 ? (
              <div className="oz-empty">
                <CheckCircle size={48} />
                <h3>Keine fehlgeschlagenen Einzüge</h3>
                <p>Alle Stripe-Lastschriften wurden erfolgreich verarbeitet.</p>
              </div>
            ) : (
              failedTransaktionen.map(t => (
                <div key={t.id} className="oz-item failed-trans">
                  <div className="oz-item-main">
                    <div className="oz-item-member">
                      <strong>{t.vorname} {t.nachname}</strong>
                      <span className="oz-item-email">{t.email}</span>
                      <span className="oz-item-dojo" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Batch: {t.batch_id}
                      </span>
                    </div>
                    <div className="oz-item-details">
                      <span className="typ-badge" style={{ '--typ-color': 'var(--error)' }}>
                        <XCircle size={12} />
                        Fehlgeschlagen
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {String(t.monat).padStart(2,'0')}/{t.jahr}
                      </span>
                    </div>
                    <div className="oz-item-amount">
                      <strong>{parseFloat(t.retry_betrag || t.betrag).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</strong>
                      <span className="oz-item-date">
                        <Clock size={12} />
                        {new Date(t.created_at).toLocaleDateString('de-DE')}
                      </span>
                    </div>
                    <div className="oz-item-actions">
                      {t.can_retry ? (
                        <button
                          className="btn-action success"
                          onClick={() => handleRetry(t)}
                          disabled={retryLoading[t.id]}
                          title="Erneut einziehen"
                        >
                          {retryLoading[t.id]
                            ? <RefreshCw size={16} className="spin" />
                            : <RotateCcw size={16} />}
                        </button>
                      ) : (
                        <span title="Beitrag bereits bezahlt" style={{ padding: '0.25rem', color: 'var(--success)' }}>
                          <CheckCircle size={16} />
                        </span>
                      )}
                    </div>
                  </div>
                  {t.error_message && (
                    <div className="oz-item-description" style={{ color: 'var(--error)', fontSize: '0.8rem' }}>
                      {t.error_message}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Problem-Mitglieder Tab */}
        {activeTab === 'mitglieder' && (
          <div className="oz-list">
            {mitgliederProbleme.length === 0 ? (
              <div className="oz-empty">
                <CheckCircle size={48} />
                <h3>Keine Problem-Mitglieder</h3>
                <p>Es gibt keine Mitglieder mit Zahlungsproblemen.</p>
              </div>
            ) : (
              mitgliederProbleme.map(m => (
                <div key={m.mitglied_id} className="oz-item mitglied">
                  <div className="oz-item-main">
                    <div className="oz-item-member">
                      <strong>{m.vorname} {m.nachname}</strong>
                      <span className="oz-item-email">{m.email}</span>
                      {m.dojoname && <span className="oz-item-dojo">{m.dojoname}</span>}
                    </div>
                    <div className="oz-item-details">
                      <span className="problem-badge">
                        <AlertTriangle size={12} />
                        Zahlungsproblem
                      </span>
                      {m.zahlungsproblem_datum && (
                        <span className="problem-date">
                          seit {new Date(m.zahlungsproblem_datum).toLocaleDateString('de-DE')}
                        </span>
                      )}
                    </div>
                    <div className="oz-item-amount">
                      <strong>{m.offene_zahlungen || 0} offen</strong>
                      <span>{parseFloat(m.summe_offen || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                    </div>
                  </div>
                  {m.zahlungsproblem_details && (
                    <div className="oz-item-description">
                      {m.zahlungsproblem_details}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetail && selectedZahlung && (
        <div className="oz-modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="oz-modal" onClick={e => e.stopPropagation()}>
            <div className="oz-modal-header">
              <h3>Zahlungsdetails</h3>
              <button onClick={() => setShowDetail(false)}><X size={20} /></button>
            </div>
            <div className="oz-modal-content">
              <div className="detail-row">
                <span>Mitglied:</span>
                <strong>{selectedZahlung.vorname} {selectedZahlung.nachname}</strong>
              </div>
              <div className="detail-row">
                <span>E-Mail:</span>
                <span>{selectedZahlung.email}</span>
              </div>
              <div className="detail-row">
                <span>Dojo:</span>
                <span>{selectedZahlung.dojoname}</span>
              </div>
              <div className="detail-row">
                <span>Betrag:</span>
                <strong className="amount">{parseFloat(selectedZahlung.betrag).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</strong>
              </div>
              <div className="detail-row">
                <span>Typ:</span>
                {getTypBadge(selectedZahlung.typ)}
              </div>
              <div className="detail-row">
                <span>Status:</span>
                {getStatusBadge(selectedZahlung.status)}
              </div>
              <div className="detail-row">
                <span>Erstellt:</span>
                <span>{new Date(selectedZahlung.erstellt_am).toLocaleString('de-DE')}</span>
              </div>
              {selectedZahlung.referenz && (
                <div className="detail-row">
                  <span>Referenz:</span>
                  <code>{selectedZahlung.referenz}</code>
                </div>
              )}
              {selectedZahlung.beschreibung && (
                <div className="detail-row full">
                  <span>Beschreibung:</span>
                  <p>{selectedZahlung.beschreibung}</p>
                </div>
              )}
              {selectedZahlung.notizen && (
                <div className="detail-row full">
                  <span>Notizen:</span>
                  <p>{selectedZahlung.notizen}</p>
                </div>
              )}
            </div>
            <div className="oz-modal-footer">
              {selectedZahlung.status === 'offen' && (
                <>
                  <button className="btn success" onClick={() => { handleStatusChange(selectedZahlung.id, 'erledigt'); setShowDetail(false); }}>
                    <Check size={16} /> Als erledigt markieren
                  </button>
                  <button className="btn warning" onClick={() => { handleMahnung(selectedZahlung.id); }}>
                    <Mail size={16} /> Mahnung senden
                  </button>
                </>
              )}
              <button className="btn secondary" onClick={() => setShowDetail(false)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OffeneZahlungen;
