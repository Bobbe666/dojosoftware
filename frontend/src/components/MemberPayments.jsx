import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard, CheckCircle, AlertTriangle, Clock, Euro, FileText,
  Trash2, Plus, Loader2, Shield, History, AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config.js';
import MemberHeader from './MemberHeader.jsx';
import '../styles/components.css';
import '../styles/themes.css';
import '../styles/MemberPayments.css';

const MemberPayments = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [vertraege, setVertraege] = useState([]);
  const [rechnungen, setRechnungen] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingPm, setDeletingPm] = useState(null);
  const [activeTab, setActiveTab] = useState('offen');

  const loadData = useCallback(async () => {
    if (!user?.mitglied_id) return;
    setLoading(true);
    try {
      const [vertraegeRes, rechnungenRes, pmRes] = await Promise.all([
        fetchWithAuth(`${config.apiBaseUrl}/vertraege?mitglied_id=${user.mitglied_id}`),
        fetchWithAuth(`${config.apiBaseUrl}/member-payments/rechnungen`),
        fetchWithAuth(`${config.apiBaseUrl}/payment-provider/member/payment-methods`)
      ]);

      if (vertraegeRes.ok) {
        const d = await vertraegeRes.json();
        const all = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
        setVertraege(all.filter(v => v.mitglied_id === user.mitglied_id && !v.geloescht));
      }

      if (rechnungenRes.ok) {
        const d = await rechnungenRes.json();
        setRechnungen(d.rechnungen || []);
      }

      if (pmRes.ok) {
        const d = await pmRes.json();
        setPaymentMethods(d.payment_methods || []);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Zahlungsdaten:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.mitglied_id]);

  const loadHistory = useCallback(async () => {
    if (!user?.mitglied_id || paymentHistory.length > 0) return;
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/member-payments/history`);
      if (res.ok) {
        const d = await res.json();
        setPaymentHistory(d.payments || []);
      }
    } catch (e) {}
  }, [user?.mitglied_id, paymentHistory.length]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (activeTab === 'historie') loadHistory();
  }, [activeTab, loadHistory]);

  const handleDeleteCard = async (pmId) => {
    if (!window.confirm('Zahlungsmethode wirklich entfernen?')) return;
    setDeletingPm(pmId);
    try {
      const res = await fetchWithAuth(
        `${config.apiBaseUrl}/payment-provider/member/payment-methods/${pmId}`,
        { method: 'DELETE' }
      );
      if (res.ok) setPaymentMethods(prev => prev.filter(pm => pm.id !== pmId));
    } catch (e) {
      console.error('Fehler beim Entfernen:', e);
    } finally {
      setDeletingPm(null);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '—';
  const formatCurrency = (a) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(a || 0);
  const cardBrandName = (b) => ({ visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover' }[b] || b);

  const offeneRechnungen = rechnungen.filter(r => ['offen', 'teilweise_bezahlt', 'ueberfaellig'].includes(r.status));
  const offeneGesamt = offeneRechnungen.reduce((s, r) => s + parseFloat(r.gesamtsumme || r.betrag || 0), 0);
  const aktiveVertraege = vertraege.filter(v => v.status === 'aktiv');
  const totalMonatlich = aktiveVertraege.reduce((s, v) => s + parseFloat(v.monatlicher_betrag || 0), 0);

  if (loading) {
    return (
      <div className="dashboard-container">
        <MemberHeader />
        <div className="dashboard-content">
          <div className="mp-loading-wrapper">
            <Loader2 className="mp-spin" size={36} />
            <p>Lade Zahlungsdaten...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <MemberHeader />
      <div className="dashboard-content mp-content-padding">
        <div className="mp-content-wrapper">

          <div className="mp-page-header">
            <div className="mp-page-header-row">
              <CreditCard size={28} className="u-text-accent" />
              <h1 className="mp-page-title">Meine Beiträge & Zahlungen</h1>
            </div>
          </div>

          {/* Statistik-Kacheln */}
          <div className="mp-stats-grid">
            <div className="mp-stat-card">
              <div className="mp-stat-icon"><Euro size={36} /></div>
              <div className="mp-stat-value-lg">{formatCurrency(totalMonatlich)}</div>
              <h3 className="mp-card-title">Monatlich</h3>
            </div>
            <div className={`mp-stat-card${offeneGesamt > 0 ? ' mp-stat-card--warning' : ''}`}>
              <div className="mp-stat-icon">
                {offeneGesamt > 0 ? <AlertTriangle size={36} /> : <CheckCircle size={36} />}
              </div>
              <div className="mp-stat-value-lg" style={{ color: offeneGesamt > 0 ? '#f59e0b' : '#10b981' }}>
                {formatCurrency(offeneGesamt)}
              </div>
              <h3 className="mp-card-title">Offene Posten</h3>
            </div>
            <div className="mp-stat-card">
              <div className="mp-stat-icon"><FileText size={36} /></div>
              <div className="mp-stat-value-lg">{aktiveVertraege.length}</div>
              <h3 className="mp-card-title">Aktive Verträge</h3>
            </div>
            <div className="mp-stat-card">
              <div className="mp-stat-icon"><Shield size={36} /></div>
              <div className="mp-stat-value-lg">{paymentMethods.length}</div>
              <h3 className="mp-card-title">Gespeicherte Karten</h3>
            </div>
          </div>

          {/* Tabs */}
          <div className="mp-tabs">
            {[
              { key: 'offen', label: 'Offene Posten', badge: offeneRechnungen.length, warn: true },
              { key: 'vertraege', label: 'Verträge', badge: aktiveVertraege.length },
              { key: 'karten', label: 'Zahlungsmethoden', badge: null },
              { key: 'historie', label: 'Historie', badge: null }
            ].map(tab => (
              <button
                key={tab.key}
                className={`mp-tab-btn${activeTab === tab.key ? ' mp-tab-btn--active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {tab.badge != null && tab.badge > 0 && (
                  <span className={`mp-tab-badge${tab.warn ? ' mp-tab-badge--warn' : ''}`}>{tab.badge}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab: Offene Posten */}
          {activeTab === 'offen' && (
            <div className="mp-section">
              {offeneRechnungen.length === 0 ? (
                <div className="mp-empty-state">
                  <CheckCircle size={48} style={{ color: '#10b981' }} />
                  <h3>Alles bezahlt!</h3>
                  <p className="u-text-secondary">Du hast keine offenen Posten.</p>
                </div>
              ) : (
                <div className="mp-invoice-list">
                  {offeneRechnungen.map(r => {
                    const betrag = parseFloat(r.gesamtsumme || r.betrag || 0);
                    const isOverdue = r.status === 'ueberfaellig' || new Date(r.faelligkeitsdatum) < new Date();
                    return (
                      <div key={r.rechnung_id} className={`mp-invoice-card${isOverdue ? ' mp-invoice-card--overdue' : ''}`}>
                        <div className="mp-invoice-info">
                          <div className="mp-invoice-meta">
                            <span className="mp-invoice-nr">{r.rechnungsnummer}</span>
                            <span className={`mp-invoice-status mp-invoice-status--${r.status}`}>
                              {r.status === 'ueberfaellig' ? '⚠ Überfällig' :
                               r.status === 'offen' ? 'Offen' : 'Teilweise bezahlt'}
                            </span>
                          </div>
                          <div className="mp-invoice-desc">
                            {r.art === 'mitgliedsbeitrag' ? 'Mitgliedsbeitrag' :
                             r.art === 'pruefungsgebuehr' ? 'Prüfungsgebühr' :
                             r.art === 'kursgebuehr' ? 'Kursgebühr' :
                             r.beschreibung || r.art}
                          </div>
                          <div className="mp-invoice-due">
                            Fällig: <span className={isOverdue ? 'mp-text-red' : ''}>
                              {formatDate(r.faelligkeitsdatum)}
                            </span>
                          </div>
                        </div>
                        <div className="mp-invoice-actions">
                          <div className="mp-invoice-amount">{formatCurrency(betrag)}</div>
                          <button className="mp-pay-btn" onClick={() => navigate(`/member/zahlung/${r.rechnung_id}`)}>
                            <CreditCard size={14} />
                            Jetzt bezahlen
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab: Verträge */}
          {activeTab === 'vertraege' && (
            <div className="mp-section">
              {vertraege.length === 0 ? (
                <div className="mp-empty-state">
                  <AlertTriangle size={48} className="mp-empty-icon" />
                  <h3>Keine Verträge gefunden</h3>
                  <p className="u-text-secondary">Es wurden keine Vertragsdaten gefunden.</p>
                </div>
              ) : (
                <div className="mp-contract-list">
                  {vertraege.map(v => (
                    <div key={v.vertrag_id} className={`mp-contract-card${v.status === 'aktiv' ? ' mp-contract-card--aktiv' : ''}`}>
                      <div className="mp-contract-card-inner">
                        <div className="mp-contract-icon-box">📄</div>
                        <div className="u-flex-1">
                          <div className="mp-contract-header-row">
                            <div>
                              <h3 className="mp-contract-title">Vertrag #{v.vertrag_id}</h3>
                              <span className={`mp-contract-status-badge`} style={{
                                color: v.status === 'aktiv' ? '#10b981' : v.status === 'gekündigt' ? '#ef4444' : '#f59e0b'
                              }}>
                                {v.status === 'aktiv' ? '● Aktiv' : v.status === 'gekündigt' ? '✕ Gekündigt' : '⏸ Pausiert'}
                              </span>
                            </div>
                            <div className="mp-amount-block">
                              <div className="mp-amount-value">{formatCurrency(v.monatlicher_betrag)}</div>
                              <div className="mp-amount-label">/ Monat</div>
                            </div>
                          </div>
                          <div className="mp-details-grid">
                            <div><div className="mp-stat-label">Start</div><div className="mp-field-value">{formatDate(v.start_datum)}</div></div>
                            {v.ende_datum && <div><div className="mp-stat-label">Ende</div><div className="mp-field-value">{formatDate(v.ende_datum)}</div></div>}
                            {v.naechste_zahlung && <div><div className="mp-stat-label">Nächste Zahlung</div><div className="mp-next-payment-value">{formatDate(v.naechste_zahlung)}</div></div>}
                            <div><div className="mp-stat-label">Zahlungsart</div><div className="mp-zahlungsart-value">{v.zahlungsart || '—'}</div></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Zahlungsmethoden */}
          {activeTab === 'karten' && (
            <div className="mp-section">
              <div className="mp-cards-header">
                <h2 className="mp-section-title">Gespeicherte Karten</h2>
              </div>
              <div className="mp-security-note">
                <Shield size={14} />
                <span>
                  Deine Kartendaten werden ausschließlich bei <strong>Stripe</strong> gespeichert (PCI DSS Level 1).
                  Wir sehen nur Kartentyp, die letzten 4 Ziffern und das Ablaufdatum.
                </span>
              </div>
              {paymentMethods.length === 0 ? (
                <div className="mp-empty-state">
                  <CreditCard size={48} className="mp-empty-icon" />
                  <h3>Keine gespeicherten Karten</h3>
                  <p className="u-text-secondary">Speichere eine Karte beim nächsten Bezahlvorgang.</p>
                </div>
              ) : (
                <div className="mp-card-list">
                  {paymentMethods.map(pm => {
                    const isExpired = new Date(pm.exp_year, pm.exp_month - 1) < new Date();
                    return (
                      <div key={pm.id} className={`mp-card-item${isExpired ? ' mp-card-item--expired' : ''}`}>
                        <div className="mp-card-icon">💳</div>
                        <div className="mp-card-details">
                          <div className="mp-card-name">
                            {cardBrandName(pm.brand)} •••• {pm.last4}
                            {pm.wallet === 'apple_pay' && ' · Apple Pay'}
                            {pm.wallet === 'google_pay' && ' · Google Pay'}
                          </div>
                          <div className={`mp-card-expiry${isExpired ? ' mp-card-expiry--expired' : ''}`}>
                            Gültig bis {String(pm.exp_month).padStart(2, '0')}/{pm.exp_year}
                            {isExpired && ' (abgelaufen)'}
                          </div>
                        </div>
                        <button
                          className="mp-delete-card-btn"
                          onClick={() => handleDeleteCard(pm.id)}
                          disabled={deletingPm === pm.id}
                          title="Karte entfernen"
                        >
                          {deletingPm === pm.id ? <Loader2 className="mp-spin" size={16} /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mp-gdpr-info">
                <AlertCircle size={14} />
                <span>Du kannst gespeicherte Zahlungsmethoden jederzeit hier entfernen (DSGVO Art. 7).</span>
              </div>
            </div>
          )}

          {/* Tab: Zahlungshistorie */}
          {activeTab === 'historie' && (
            <div className="mp-section">
              <h2 className="mp-section-title">Zahlungshistorie</h2>
              {paymentHistory.length === 0 ? (
                <div className="mp-empty-state">
                  <History size={48} className="mp-empty-icon" />
                  <h3>Noch keine Zahlungen</h3>
                  <p className="u-text-secondary">Hier werden deine abgeschlossenen Zahlungen angezeigt.</p>
                </div>
              ) : (
                <div className="mp-history-list">
                  {paymentHistory.map((p, i) => (
                    <div key={p.stripe_payment_intent_id || i} className="mp-history-item">
                      <div className="mp-history-icon"><CheckCircle size={18} style={{ color: '#10b981' }} /></div>
                      <div className="mp-history-details">
                        <div className="mp-history-desc">{p.description || p.rechnungsnummer || 'Zahlung'}</div>
                        <div className="mp-history-date">{formatDate(p.created_at)}</div>
                      </div>
                      <div className="mp-history-amount">
                        {((p.amount || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
      <style>{`
        .mp-spin { animation: mpspin 1s linear infinite; }
        @keyframes mpspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default MemberPayments;
