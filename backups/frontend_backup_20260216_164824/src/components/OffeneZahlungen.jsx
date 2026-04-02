// ============================================================================
// OFFENE ZAHLUNGEN - Verwaltung von Rücklastschriften & Chargebacks
// ============================================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle, CreditCard, Building2, RefreshCw, Check, X,
  Mail, Eye, Filter, TrendingDown, Users, Clock, CheckCircle,
  XCircle, AlertCircle, ChevronDown, ChevronUp, Search
} from 'lucide-react';
import '../styles/OffeneZahlungen.css';

const OffeneZahlungen = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [zahlungen, setZahlungen] = useState([]);
  const [stats, setStats] = useState({});
  const [disputes, setDisputes] = useState([]);
  const [mitgliederProbleme, setMitgliederProbleme] = useState([]);

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

      const [zahlungenRes, disputesRes, mitgliederRes] = await Promise.all([
        axios.get(`/admin/offene-zahlungen?${params}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('/admin/stripe/disputes', {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { disputes: [] } })),
        axios.get('/admin/mitglieder-mit-zahlungsproblemen', {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { mitglieder: [] } }))
      ]);

      if (zahlungenRes.data.success) {
        setZahlungen(zahlungenRes.data.zahlungen || []);
        setStats(zahlungenRes.data.stats || {});
      }

      setDisputes(disputesRes.data.disputes || []);
      setMitgliederProbleme(mitgliederRes.data.mitglieder || []);

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
      'ruecklastschrift': { label: 'Rücklastschrift', color: '#ef4444', icon: Building2 },
      'chargeback': { label: 'Chargeback', color: '#f59e0b', icon: CreditCard },
      'fehlgeschlagen': { label: 'Fehlgeschlagen', color: '#6366f1', icon: XCircle },
      'mahnung': { label: 'Mahnung', color: '#8b5cf6', icon: Mail },
      'sonstig': { label: 'Sonstig', color: '#64748b', icon: AlertCircle }
    };
    const t = types[typ] || types.sonstig;
    const Icon = t.icon;
    return (
      <span className="typ-badge" style={{ backgroundColor: `${t.color}20`, color: t.color, borderColor: t.color }}>
        <Icon size={12} />
        {t.label}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const statuses = {
      'offen': { label: 'Offen', color: '#ef4444' },
      'in_bearbeitung': { label: 'In Bearbeitung', color: '#f59e0b' },
      'erledigt': { label: 'Erledigt', color: '#22c55e' },
      'storniert': { label: 'Storniert', color: '#64748b' }
    };
    const s = statuses[status] || statuses.offen;
    return (
      <span className="status-badge" style={{ backgroundColor: `${s.color}20`, color: s.color }}>
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

      {/* Stats */}
      <div className="oz-stats">
        <div className="stat-card warning">
          <div className="stat-icon"><AlertTriangle size={24} /></div>
          <div className="stat-content">
            <span className="stat-value">{stats.offen || 0}</span>
            <span className="stat-label">Offen</span>
          </div>
        </div>
        <div className="stat-card danger">
          <div className="stat-icon"><TrendingDown size={24} /></div>
          <div className="stat-content">
            <span className="stat-value">{parseFloat(stats.summe_offen || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
            <span className="stat-label">Offener Betrag</span>
          </div>
        </div>
        <div className="stat-card info">
          <div className="stat-icon"><Building2 size={24} /></div>
          <div className="stat-content">
            <span className="stat-value">{stats.ruecklastschriften || 0}</span>
            <span className="stat-label">Rücklastschriften</span>
          </div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon"><CreditCard size={24} /></div>
          <div className="stat-content">
            <span className="stat-value">{stats.chargebacks || 0}</span>
            <span className="stat-label">Chargebacks</span>
          </div>
        </div>
      </div>

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
