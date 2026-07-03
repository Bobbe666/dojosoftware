import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CreditCard, CheckCircle, AlertTriangle, Clock, Euro, FileText,
  Trash2, Plus, Loader2, Shield, History, AlertCircle, Download, Receipt
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config.js';
import MemberHeader from './MemberHeader.jsx';
import '../styles/components.css';
import '../styles/themes.css';
import '../styles/MemberPayments.css';

const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt) ? String(d).slice(0, 10) : dt.toLocaleDateString('de-DE');
};

const MemberPayments = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [vertraege, setVertraege] = useState([]);
  const [rechnungen, setRechnungen] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingPm, setDeletingPm] = useState(null);
  const [searchParams] = useSearchParams();
  const VALID_TABS = ['offen', 'vertraege', 'karten', 'historie', 'quittungen'];
  const initialTab = VALID_TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'offen';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [naechste, setNaechste] = useState(null); // Zusammensetzung nächste Abbuchung

  // --- Self-Service Bankverbindung (SEPA) ---
  const [bank, setBank] = useState(null);          // { hat_mandat, iban_masked, kontoinhaber, provider_supports_sepa }
  const [bankEditing, setBankEditing] = useState(false);
  const [bankForm, setBankForm] = useState({ iban: '', kontoinhaber: '', mandat: false });
  const [bankSaving, setBankSaving] = useState(false);
  const [bankMsg, setBankMsg] = useState(null);    // { type: 'success'|'error', text }

  // --- Quittungen (Self-Service-PDF, on-the-fly, nichts gespeichert) ---
  const [qJahr, setQJahr] = useState(new Date().getFullYear());
  const [qUmfang, setQUmfang] = useState('beitraege'); // 'beitraege' | 'alle'
  const [qJahre, setQJahre] = useState([]);
  const [qPosten, setQPosten] = useState([]);
  const [qSumme, setQSumme] = useState(0);
  const [qLoading, setQLoading] = useState(false);
  const [qDownloading, setQDownloading] = useState(null); // null | 'gesamt' | `${typ}-${id}`

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

  // Zusammensetzung der nächsten Abbuchung laden
  useEffect(() => {
    let aktiv = true;
    fetchWithAuth(`${config.apiBaseUrl}/member-payments/naechste-abbuchung`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (aktiv && d?.success) setNaechste(d); })
      .catch(() => {});
    return () => { aktiv = false; };
  }, []);
  useEffect(() => {
    if (activeTab === 'historie') loadHistory();
  }, [activeTab, loadHistory]);

  // Aktuelle Bankverbindung laden (für Zahlungsmethoden-Tab)
  const loadBank = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/member-payments/bankverbindung`);
      if (res.ok) {
        const d = await res.json();
        if (d?.success) {
          setBank(d);
          setBankForm(f => ({ ...f, kontoinhaber: d.kontoinhaber || '' }));
        }
      }
    } catch (e) { /* still */ }
  }, []);
  useEffect(() => {
    if (activeTab === 'karten' && !bank) loadBank();
  }, [activeTab, bank, loadBank]);

  const handleBankSubmit = async () => {
    setBankMsg(null);
    if (!bankForm.mandat) {
      setBankMsg({ type: 'error', text: 'Bitte bestätige das SEPA-Lastschriftmandat.' });
      return;
    }
    setBankSaving(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/member-payments/bankverbindung`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iban: bankForm.iban,
          kontoinhaber: bankForm.kontoinhaber,
          mandat_bestaetigt: true,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d?.success) {
        setBank(b => ({ ...(b || {}), hat_mandat: true, iban_masked: d.iban_masked, kontoinhaber: d.kontoinhaber }));
        setBankEditing(false);
        setBankForm({ iban: '', kontoinhaber: d.kontoinhaber || '', mandat: false });
        setBankMsg({ type: 'success', text: d.message || 'Bankverbindung aktualisiert.' });
      } else {
        setBankMsg({ type: 'error', text: d?.error || 'Die Bankverbindung konnte nicht gespeichert werden.' });
      }
    } catch (e) {
      setBankMsg({ type: 'error', text: 'Netzwerkfehler. Bitte versuche es erneut.' });
    } finally {
      setBankSaving(false);
    }
  };

  // Quittungs-Posten laden (eigene bezahlte Posten je Jahr + Umfang)
  const loadQuittungen = useCallback(async () => {
    if (!user?.mitglied_id) return;
    setQLoading(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/quittungen/posten?jahr=${qJahr}&umfang=${qUmfang}`);
      if (res.ok) {
        const d = await res.json();
        if (d?.success) {
          setQPosten(d.posten || []);
          setQSumme(d.summe || 0);
          if (Array.isArray(d.jahre) && d.jahre.length) {
            setQJahre(d.jahre);
            if (!d.jahre.includes(qJahr)) setQJahr(d.jahre[0]);
          }
        }
      }
    } catch (e) {
      console.error('Fehler beim Laden der Quittungs-Posten:', e);
    } finally {
      setQLoading(false);
    }
  }, [user?.mitglied_id, qJahr, qUmfang]);

  useEffect(() => {
    if (activeTab === 'quittungen') loadQuittungen();
  }, [activeTab, loadQuittungen]);

  // PDF on-the-fly holen (mit Auth) und als Download anstoßen — nichts wird gespeichert
  const downloadQuittung = async (params, kennung, dateiname) => {
    setQDownloading(kennung);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/quittungen/pdf?${params}`);
      if (!res.ok) {
        alert('Für den gewählten Zeitraum wurde keine bezahlte Position gefunden.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = dateiname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) {
      console.error('Quittung-Download fehlgeschlagen:', e);
      alert('Quittung konnte nicht erstellt werden. Bitte später erneut versuchen.');
    } finally {
      setQDownloading(null);
    }
  };

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

          {/* Nächste Abbuchung – Zusammensetzung */}
          {naechste && (naechste.posten.length > 0 || naechste.lastschriften.length > 0) && (
            <div style={{ background: 'var(--bg-card, #1a1a2e)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.1rem', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: 'var(--text-primary, #e2e8f0)' }}>💳 Nächste Abbuchung – Zusammensetzung</h3>
              {naechste.posten.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {naechste.posten.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.88rem', padding: '0.35rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ color: 'var(--text-primary, #e2e8f0)' }}>{p.label}{p.datum ? <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.78rem' }}> · fällig {fmtDate(p.datum)}</span> : ''}</span>
                      <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{formatCurrency(p.betrag)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, paddingTop: '0.5rem', fontSize: '0.95rem', color: 'var(--text-primary, #e2e8f0)' }}>
                    <span>Gesamt</span><span>{formatCurrency(naechste.gesamt)}</span>
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.86rem', margin: 0 }}>Aktuell keine offenen Posten für die nächste Abbuchung.</p>
              )}

              {naechste.lastschriften.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #94a3b8)', marginBottom: '0.4rem' }}>Letzte Abbuchungen</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {naechste.lastschriften.map((l, i) => {
                      const st = l.status === 'succeeded' ? { t: 'Eingezogen', c: '#22c55e' } : l.status === 'processing' ? { t: 'In Einzug', c: '#f59e0b' } : l.status === 'failed' ? { t: 'Fehlgeschlagen', c: '#ef4444' } : { t: l.status, c: '#94a3b8' };
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.84rem', padding: '0.25rem 0' }}>
                          <span style={{ color: 'var(--text-muted, #94a3b8)' }}>{fmtDate(l.datum)} · Lauf {l.monat}/{l.jahr}</span>
                          <span style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                            <span style={{ color: st.c, fontSize: '0.78rem', fontWeight: 600 }}>{st.t}</span>
                            <span style={{ fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--text-primary, #e2e8f0)' }}>{formatCurrency(l.betrag)}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
          <div className="mp-tabs">
            {[
              { key: 'offen', label: 'Offene Posten', badge: offeneRechnungen.length, warn: true },
              { key: 'vertraege', label: 'Verträge', badge: aktiveVertraege.length },
              { key: 'karten', label: 'Zahlungsmethoden', badge: null },
              { key: 'historie', label: 'Historie', badge: null },
              { key: 'quittungen', label: 'Quittungen', badge: null }
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
              {/* --- Self-Service Bankverbindung (SEPA) --- */}
              <div className="mp-bank-block" style={{ marginBottom: 28, padding: 20, border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 12 }}>
                <div className="mp-cards-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Euro size={18} />
                  <h2 className="mp-section-title" style={{ margin: 0 }}>Bankverbindung (SEPA-Lastschrift)</h2>
                </div>

                {bankMsg && (
                  <div className="mp-security-note" style={{ marginTop: 12, color: bankMsg.type === 'error' ? '#b91c1c' : '#15803d' }}>
                    {bankMsg.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
                    <span>{bankMsg.text}</span>
                  </div>
                )}

                {!bankEditing && (
                  <div style={{ marginTop: 14 }}>
                    {bank?.hat_mandat ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div className="mp-card-icon">🏦</div>
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <div className="mp-card-name">{bank.iban_masked || 'IBAN hinterlegt'}</div>
                          <div className="u-text-secondary" style={{ fontSize: 13 }}>
                            {bank.kontoinhaber ? `Kontoinhaber: ${bank.kontoinhaber}` : 'SEPA-Lastschriftmandat aktiv'}
                          </div>
                        </div>
                        <button className="mp-q-toggle-btn" onClick={() => { setBankMsg(null); setBankEditing(true); }}>
                          Bankverbindung ändern
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <p className="u-text-secondary" style={{ flex: 1, minWidth: 180, margin: 0 }}>
                          Hinterlege deine Bankverbindung, damit deine Beiträge bequem per SEPA-Lastschrift eingezogen werden können.
                        </p>
                        <button className="mp-q-toggle-btn is-active" onClick={() => { setBankMsg(null); setBankEditing(true); }}>
                          Bankverbindung hinterlegen
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {bankEditing && (
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="mp-q-field">
                      <label className="mp-stat-label" htmlFor="bank-iban">IBAN</label>
                      <input
                        id="bank-iban"
                        className="mp-q-select"
                        type="text"
                        inputMode="text"
                        autoComplete="off"
                        placeholder="DE00 0000 0000 0000 0000 00"
                        value={bankForm.iban}
                        onChange={(e) => setBankForm(f => ({ ...f, iban: e.target.value.toUpperCase() }))}
                      />
                    </div>
                    <div className="mp-q-field">
                      <label className="mp-stat-label" htmlFor="bank-inhaber">Kontoinhaber (Vor- und Nachname)</label>
                      <input
                        id="bank-inhaber"
                        className="mp-q-select"
                        type="text"
                        autoComplete="name"
                        placeholder="Max Mustermann"
                        value={bankForm.kontoinhaber}
                        onChange={(e) => setBankForm(f => ({ ...f, kontoinhaber: e.target.value }))}
                      />
                    </div>
                    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.5 }}>
                      <input
                        type="checkbox"
                        checked={bankForm.mandat}
                        onChange={(e) => setBankForm(f => ({ ...f, mandat: e.target.checked }))}
                        style={{ marginTop: 3 }}
                      />
                      <span className="u-text-secondary">
                        Ich ermächtige das Dojo, Zahlungen von meinem Konto per SEPA-Lastschrift einzuziehen, und weise mein
                        Kreditinstitut an, diese Lastschriften einzulösen (SEPA-Lastschriftmandat).
                      </span>
                    </label>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button
                        className="mp-q-toggle-btn is-active"
                        onClick={handleBankSubmit}
                        disabled={bankSaving}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                      >
                        {bankSaving && <Loader2 className="mp-spin" size={16} />}
                        {bankSaving ? 'Wird gespeichert…' : 'Speichern'}
                      </button>
                      <button
                        className="mp-q-toggle-btn"
                        onClick={() => { setBankEditing(false); setBankMsg(null); }}
                        disabled={bankSaving}
                      >
                        Abbrechen
                      </button>
                    </div>
                    <div className="mp-security-note" style={{ marginTop: 2 }}>
                      <Shield size={14} />
                      <span>Deine IBAN wird sicher über <strong>Stripe</strong> verarbeitet. Offene Beiträge werden anschließend automatisch über die neue Bankverbindung eingezogen.</span>
                    </div>
                  </div>
                )}
              </div>

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

          {/* Tab: Quittungen (Self-Service PDF) */}
          {activeTab === 'quittungen' && (
            <div className="mp-section">
              <h2 className="mp-section-title">Quittung erstellen</h2>
              <div className="mp-security-note">
                <Receipt size={14} />
                <span>
                  Erstelle dir jederzeit selbst eine Quittung über deine <strong>bereits bezahlten</strong> Beträge.
                  Die PDF wird live erzeugt und sofort heruntergeladen – es wird nichts gespeichert.
                </span>
              </div>

              {/* Auswahl: Jahr + Umfang */}
              <div className="mp-q-controls">
                <div className="mp-q-field">
                  <label className="mp-stat-label">Jahr</label>
                  <select
                    className="mp-q-select"
                    value={qJahr}
                    onChange={(e) => setQJahr(parseInt(e.target.value, 10))}
                  >
                    {(qJahre.length ? qJahre : [qJahr]).map(j => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                </div>
                <div className="mp-q-field">
                  <label className="mp-stat-label">Umfang</label>
                  <div className="mp-q-toggle">
                    <button
                      className={`mp-q-toggle-btn${qUmfang === 'beitraege' ? ' is-active' : ''}`}
                      onClick={() => setQUmfang('beitraege')}
                    >
                      Nur Monatsbeiträge
                    </button>
                    <button
                      className={`mp-q-toggle-btn${qUmfang === 'alle' ? ' is-active' : ''}`}
                      onClick={() => setQUmfang('alle')}
                    >
                      Alle bezahlten Posten
                    </button>
                  </div>
                </div>
              </div>

              {qLoading ? (
                <div className="mp-loading-wrapper"><Loader2 className="mp-spin" size={28} /><p>Lade bezahlte Posten…</p></div>
              ) : qPosten.length === 0 ? (
                <div className="mp-empty-state">
                  <Receipt size={48} className="mp-empty-icon" />
                  <h3>Keine bezahlten Posten</h3>
                  <p className="u-text-secondary">Für {qJahr} wurden keine bezahlten {qUmfang === 'alle' ? 'Posten' : 'Monatsbeiträge'} gefunden.</p>
                </div>
              ) : (
                <>
                  {/* Gesamtquittung */}
                  <div className="mp-q-summary">
                    <div>
                      <div className="mp-q-summary-label">Gesamtquittung {qJahr}</div>
                      <div className="mp-q-summary-sub">{qPosten.length} Position{qPosten.length === 1 ? '' : 'en'} · {formatCurrency(qSumme)}</div>
                    </div>
                    <button
                      className="mp-pay-btn"
                      disabled={qDownloading === 'gesamt'}
                      onClick={() => downloadQuittung(`jahr=${qJahr}&umfang=${qUmfang}`, 'gesamt', `Quittung_${qJahr}.pdf`)}
                    >
                      {qDownloading === 'gesamt' ? <Loader2 className="mp-spin" size={14} /> : <Download size={14} />}
                      Gesamtquittung PDF
                    </button>
                  </div>

                  {/* Einzelne Posten */}
                  <div className="mp-q-list">
                    {qPosten.map(p => {
                      const kennung = `${p.typ}-${p.id}`;
                      return (
                        <div key={kennung} className="mp-q-item">
                          <div className="mp-q-item-info">
                            <div className="mp-q-item-desc">{p.bezeichnung}</div>
                            <div className="mp-q-item-meta">{p.datum}{p.zahlungsart ? ` · ${p.zahlungsart}` : ''}</div>
                          </div>
                          <div className="mp-q-item-amount">{formatCurrency(p.betrag)}</div>
                          <button
                            className="mp-q-item-btn"
                            disabled={qDownloading === kennung}
                            title="Einzelquittung als PDF"
                            onClick={() => downloadQuittung(`typ=${p.typ}&id=${p.id}&umfang=${qUmfang}`, kennung, `Quittung_${p.datum.replace(/\./g, '-')}.pdf`)}
                          >
                            {qDownloading === kennung ? <Loader2 className="mp-spin" size={15} /> : <Download size={15} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
      <style>{`
        .mp-spin { animation: mpspin 1s linear infinite; }
        .mp-q-controls { display: flex; flex-wrap: wrap; gap: 1.25rem; margin: 1rem 0 1.25rem; }
        .mp-q-field { display: flex; flex-direction: column; gap: 0.4rem; }
        .mp-q-select { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: var(--text-primary, #e2e8f0); border-radius: 10px; padding: 0.55rem 0.9rem; font-size: 0.95rem; min-width: 110px; }
        .mp-q-toggle { display: inline-flex; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 3px; gap: 3px; }
        .mp-q-toggle-btn { background: transparent; border: none; color: var(--text-muted, #94a3b8); padding: 0.5rem 0.95rem; border-radius: 8px; font-size: 0.88rem; cursor: pointer; transition: all .15s; white-space: nowrap; }
        .mp-q-toggle-btn.is-active { background: var(--accent, #f97316); color: #fff; font-weight: 600; }
        .mp-q-summary { display: flex; justify-content: space-between; align-items: center; gap: 1rem; background: linear-gradient(135deg, rgba(249,115,22,0.14), rgba(249,115,22,0.05)); border: 1px solid rgba(249,115,22,0.25); border-radius: 14px; padding: 1rem 1.15rem; margin-bottom: 1rem; flex-wrap: wrap; }
        .mp-q-summary-label { font-weight: 700; font-size: 1.02rem; color: var(--text-primary, #e2e8f0); }
        .mp-q-summary-sub { font-size: 0.85rem; color: var(--text-muted, #94a3b8); margin-top: 2px; }
        .mp-q-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .mp-q-item { display: flex; align-items: center; gap: 0.85rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 0.7rem 0.9rem; }
        .mp-q-item-info { flex: 1; min-width: 0; }
        .mp-q-item-desc { font-weight: 600; font-size: 0.92rem; color: var(--text-primary, #e2e8f0); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mp-q-item-meta { font-size: 0.78rem; color: var(--text-muted, #94a3b8); margin-top: 2px; }
        .mp-q-item-amount { font-weight: 700; white-space: nowrap; color: var(--text-primary, #e2e8f0); }
        .mp-q-item-btn { background: rgba(249,115,22,0.15); border: 1px solid rgba(249,115,22,0.3); color: var(--accent, #f97316); border-radius: 9px; width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: all .15s; }
        .mp-q-item-btn:hover:not(:disabled) { background: rgba(249,115,22,0.28); }
        .mp-q-item-btn:disabled { opacity: 0.6; cursor: default; }
        @keyframes mpspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default MemberPayments;
