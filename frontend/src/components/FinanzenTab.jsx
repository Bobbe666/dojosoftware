/**
 * FinanzenTab - Kombinierter Finanzen-Tab für Super Admin Dashboard
 *
 * Sub-Tabs:
 * 1. Übersicht - Finanzübersicht mit Charts/KPIs (SuperAdminFinanzen)
 * 2. Mitglieder-Lastschrift - Lastschriftlauf für TDA International Mitglieder
 * 3. Dojo-SEPA - SEPA-Mandate für Dojo Software-Abos
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart3, CreditCard, Users, Euro, Plus, Download, CheckCircle, XCircle,
  Clock, FileText, RefreshCw, Calendar, DollarSign, AlertCircle, Eye,
  ChevronDown, ChevronRight, Zap, Settings, Loader
} from 'lucide-react';
import SuperAdminFinanzen from './SuperAdminFinanzen';

const FinanzenTab = ({ token }) => {
  const [activeSubTab, setActiveSubTab] = useState('uebersicht');

  const subTabs = [
    { id: 'uebersicht', label: 'Übersicht', icon: BarChart3 },
    { id: 'mitglieder-lastschrift', label: 'Mitglieder-Lastschrift', icon: Users },
    { id: 'dojo-sepa', label: 'Dojo-SEPA', icon: CreditCard }
  ];

  return (
    <div className="finanzen-tab">
      {/* Sub-Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid var(--border-default)',
        paddingBottom: '1rem'
      }}>
        {subTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.25rem',
                background: activeSubTab === tab.id ? 'var(--primary)' : 'var(--bg-secondary)',
                color: activeSubTab === tab.id ? '#000' : 'var(--text-primary)',
                border: activeSubTab === tab.id ? 'none' : '1px solid var(--border-default)',
                borderRadius: '8px',
                fontWeight: activeSubTab === tab.id ? '600' : '400',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Sub-Tab Content */}
      {activeSubTab === 'uebersicht' && (
        <SuperAdminFinanzen />
      )}

      {activeSubTab === 'mitglieder-lastschrift' && (
        <MitgliederLastschrift token={token} />
      )}

      {activeSubTab === 'dojo-sepa' && (
        <DojoSepaTab token={token} />
      )}
    </div>
  );
};

/**
 * MitgliederLastschrift - Lastschriftlauf für TDA International Mitglieder
 * Verwendet Stripe Connect für die Zahlungsabwicklung
 */
const MitgliederLastschrift = ({ token }) => {
  const TDA_DOJO_ID = 2; // TDA International

  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [missingMandates, setMissingMandates] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState('xml');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableBanks, setAvailableBanks] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Stripe Connect State
  const [stripeStatus, setStripeStatus] = useState(null);
  const [stripeProcessing, setStripeProcessing] = useState(false);
  const [stripeSetupProgress, setStripeSetupProgress] = useState(null);
  const [stripeBatchResult, setStripeBatchResult] = useState(null);

  const toggleRowExpanded = (mitgliedId) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(mitgliedId)) {
        newSet.delete(mitgliedId);
      } else {
        newSet.add(mitgliedId);
      }
      return newSet;
    });
  };

  const loadPreview = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `/lastschriftlauf/preview?monat=${selectedMonth}&jahr=${selectedYear}&dojo_id=${TDA_DOJO_ID}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success !== false) {
        setPreview(response.data);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Vorschau:', error);
      alert('Fehler beim Laden der Vorschau: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const loadMissingMandates = async () => {
    try {
      const response = await axios.get(
        `/lastschriftlauf/missing-mandates?dojo_id=${TDA_DOJO_ID}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data) {
        setMissingMandates(response.data.members || []);
      }
    } catch (error) {
      console.error('Fehler beim Laden fehlender Mandate:', error);
    }
  };

  const loadBanks = async () => {
    try {
      const response = await axios.get(
        `/lastschriftlauf/banken?dojo_id=${TDA_DOJO_ID}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data) {
        const banken = response.data.banken || [];
        setAvailableBanks(banken);
        const standardBank = banken.find(b => b.ist_standard) || banken[0];
        if (standardBank && !selectedBank) {
          setSelectedBank(standardBank.id);
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Bankkonten:', error);
    }
  };

  const loadStripeStatus = async () => {
    try {
      const response = await axios.get(
        `/lastschriftlauf/stripe/status?dojo_id=${TDA_DOJO_ID}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data) {
        setStripeStatus(response.data);
      }
    } catch (error) {
      console.error('Fehler beim Laden des Stripe-Status:', error);
    }
  };

  const handleStripeSetupAll = async () => {
    if (!window.confirm('Stripe SEPA Setup für alle TDA Mitglieder ohne Setup durchführen?\n\nDies erstellt Stripe Customers und SEPA PaymentMethods.')) {
      return;
    }

    setStripeProcessing(true);
    setStripeSetupProgress({ status: 'running', message: 'Setup wird durchgeführt...' });

    try {
      const response = await axios.post(
        `/lastschriftlauf/stripe/setup-all`,
        { dojo_id: TDA_DOJO_ID },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setStripeSetupProgress({
          status: 'completed',
          message: `Setup abgeschlossen: ${response.data.succeeded} erfolgreich, ${response.data.failed} fehlgeschlagen`
        });
        await loadStripeStatus();
      } else {
        setStripeSetupProgress({
          status: 'error',
          message: response.data.error || 'Setup fehlgeschlagen'
        });
      }
    } catch (error) {
      setStripeSetupProgress({
        status: 'error',
        message: 'Fehler: ' + (error.response?.data?.error || error.message)
      });
    } finally {
      setStripeProcessing(false);
    }
  };

  const handleStripeExecute = async () => {
    if (!preview || !preview.preview || preview.preview.length === 0) {
      alert('Keine Mitglieder für den Lastschriftlauf vorhanden');
      return;
    }

    const confirmMessage = `Stripe SEPA Lastschriftlauf für TDA International ausführen?\n\n` +
      `Monat: ${selectedMonth}/${selectedYear}\n` +
      `Anzahl Mitglieder: ${preview.count}\n` +
      `Gesamtbetrag: €${preview.total_amount}\n\n` +
      `Die Lastschriften werden über Stripe Connect eingezogen.\n` +
      `ACHTUNG: Dies kann nicht rückgängig gemacht werden!`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setStripeProcessing(true);
    setStripeBatchResult(null);

    try {
      const response = await axios.post(
        `/lastschriftlauf/stripe/execute`,
        {
          dojo_id: TDA_DOJO_ID,
          monat: selectedMonth,
          jahr: selectedYear,
          mitglieder: preview.preview.map(m => ({
            mitglied_id: m.mitglied_id,
            name: m.name,
            betrag: m.betrag,
            beitraege: m.beitraege,
            offene_monate: m.offene_monate
          }))
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setStripeBatchResult({
          status: 'completed',
          batch_id: response.data.batch_id,
          total: response.data.total,
          succeeded: response.data.succeeded,
          processing: response.data.processing,
          failed: response.data.failed
        });
        await loadPreview();
      } else {
        setStripeBatchResult({
          status: 'error',
          message: response.data.error || 'Lastschriftlauf fehlgeschlagen'
        });
      }
    } catch (error) {
      setStripeBatchResult({
        status: 'error',
        message: 'Fehler: ' + (error.response?.data?.error || error.message)
      });
    } finally {
      setStripeProcessing(false);
    }
  };

  const handleExport = () => {
    if (!preview || preview.count === 0) {
      alert('Keine Lastschriften zum Exportieren vorhanden');
      return;
    }

    if (!selectedBank) {
      alert('Bitte wählen Sie ein Bankkonto für den Einzug aus');
      return;
    }

    const bankInfo = availableBanks.find(b => b.id === selectedBank);
    const bankName = bankInfo ? bankInfo.bank_name : 'Unbekannt';

    const confirmMessage = `SEPA-Lastschriftlauf exportieren?\n\n` +
      `Format: ${selectedFormat.toUpperCase()}\n` +
      `Monat: ${selectedMonth}/${selectedYear}\n` +
      `Einzugsbank: ${bankName}\n` +
      `Anzahl Mandate: ${preview.count}\n` +
      `Gesamtbetrag: €${preview.total_amount}`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    const exportUrl = selectedFormat === 'xml'
      ? `/lastschriftlauf/xml?monat=${selectedMonth}&jahr=${selectedYear}&bank_id=${selectedBank}&dojo_id=${TDA_DOJO_ID}`
      : `/lastschriftlauf?monat=${selectedMonth}&jahr=${selectedYear}&bank_id=${selectedBank}&dojo_id=${TDA_DOJO_ID}`;

    window.open(exportUrl, '_blank');
  };

  useEffect(() => {
    loadBanks();
    loadMissingMandates();
    loadStripeStatus();
  }, []);

  useEffect(() => {
    loadPreview();
  }, [selectedMonth, selectedYear]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  };

  const getMonthName = (month) => {
    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    return months[month - 1];
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={24} /> Mitglieder-Lastschrift (TDA International)
        </h2>
        <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)' }}>
          SEPA-Lastschriften für Verbandsmitglieder über Stripe Connect
        </p>
      </div>

      {/* Statistik-Karten */}
      {preview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(16,185,129,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                <Users size={20} color="#10b981" />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Aktive Mandate</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>{preview.count || 0}</div>
              </div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(59,130,246,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                <Euro size={20} color="#3b82f6" />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Gesamtbetrag</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#3b82f6' }}>{formatCurrency(preview.total_amount)}</div>
              </div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(251,191,36,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                <Calendar size={20} color="#fbbf24" />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Abrechnungsmonat</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fbbf24' }}>{getMonthName(selectedMonth)}</div>
              </div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: stripeStatus?.stripe_configured ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                <Zap size={20} color={stripeStatus?.stripe_configured ? '#10b981' : '#ef4444'} />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Stripe Connect</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: stripeStatus?.stripe_configured ? '#10b981' : '#ef4444' }}>
                  {stripeStatus?.stripe_configured ? 'Aktiv' : 'Nicht konfiguriert'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warnung: Fehlende Mandate mit Details */}
      {missingMandates.length > 0 && (
        <div style={{
          background: 'rgba(251,191,36,0.1)',
          border: '1px solid rgba(251,191,36,0.3)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <AlertCircle size={20} color="#fbbf24" />
            <strong style={{ color: '#fbbf24' }}>Fehlende SEPA-Mandate ({missingMandates.length})</strong>
          </div>
          <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Diese Mitglieder haben Verträge mit Lastschrift aber kein aktives SEPA-Mandat.
          </p>
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)' }}>Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)' }}>E-Mail</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)' }}>Verträge</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600', color: 'var(--text-secondary)' }}>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {missingMandates.map((member, idx) => (
                  <tr key={member.mitglied_id} style={{
                    borderBottom: idx < missingMandates.length - 1 ? '1px solid var(--border-default)' : 'none'
                  }}>
                    <td style={{ padding: '0.75rem' }}>
                      <strong>{member.vorname} {member.nachname}</strong>
                      {member.telefon && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{member.telefon}</div>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                      {member.email || '-'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        background: 'var(--bg-secondary)',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem'
                      }}>
                        {member.anzahl_vertraege} Vertrag{member.anzahl_vertraege !== 1 ? 'e' : ''}
                      </span>
                      {member.vertrag_namen && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          {member.vertrag_namen}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <a
                        href={`/dashboard/mitglieder/${member.mitglied_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.35rem 0.75rem',
                          background: 'var(--primary)',
                          color: '#000',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: '500',
                          textDecoration: 'none'
                        }}
                      >
                        <Eye size={14} />
                        Details
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Export Konfiguration */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        border: '1px solid var(--border-default)',
        padding: '1.25rem',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Export & Einzug</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Monat</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: '6px', color: 'var(--text-primary)' }}
            >
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Jahr</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: '6px', color: 'var(--text-primary)' }}
            >
              <option value={2024}>2024</option>
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Format</label>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: '6px', color: 'var(--text-primary)' }}
            >
              <option value="xml">SEPA XML</option>
              <option value="csv">CSV</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Einzugsbank</label>
            <select
              value={selectedBank || ''}
              onChange={(e) => setSelectedBank(parseInt(e.target.value))}
              style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: '6px', color: 'var(--text-primary)', minWidth: '200px' }}
            >
              {availableBanks.length === 0 ? (
                <option value="">Keine Bankkonten</option>
              ) : (
                availableBanks.map(bank => (
                  <option key={bank.id} value={bank.id}>
                    {bank.bank_name} {bank.iban_masked} {bank.ist_standard ? '★' : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            onClick={loadPreview}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 1rem', background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-default)', borderRadius: '6px',
              color: 'var(--text-primary)', cursor: 'pointer'
            }}
          >
            <RefreshCw size={16} /> {loading ? 'Lädt...' : 'Aktualisieren'}
          </button>

          <button
            onClick={handleExport}
            disabled={loading || !preview || preview.count === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 1rem', background: 'rgba(59,130,246,0.2)',
              border: '1px solid #3b82f6', borderRadius: '6px',
              color: '#3b82f6', cursor: 'pointer'
            }}
          >
            <Download size={16} /> Export
          </button>

          {/* Stripe Buttons */}
          {stripeStatus?.stripe_configured && (
            <>
              {stripeStatus.needs_setup > 0 && (
                <button
                  onClick={handleStripeSetupAll}
                  disabled={stripeProcessing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.5rem 1rem', background: 'rgba(139,92,246,0.2)',
                    border: '1px solid #8b5cf6', borderRadius: '6px',
                    color: '#8b5cf6', cursor: 'pointer'
                  }}
                >
                  {stripeProcessing ? <Loader size={16} /> : <Settings size={16} />}
                  Setup ({stripeStatus.needs_setup})
                </button>
              )}
              <button
                onClick={handleStripeExecute}
                disabled={stripeProcessing || !preview || preview.count === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 1rem', background: 'var(--primary)',
                  border: 'none', borderRadius: '6px',
                  color: '#000', fontWeight: '600', cursor: 'pointer'
                }}
              >
                {stripeProcessing ? <Loader size={16} /> : <Zap size={16} />}
                Mit Stripe einziehen
              </button>
            </>
          )}
        </div>

        {/* Stripe Status Messages */}
        {stripeSetupProgress && (
          <div style={{
            marginTop: '1rem', padding: '0.75rem', borderRadius: '8px',
            background: stripeSetupProgress.status === 'error' ? 'rgba(239,68,68,0.1)' :
                        stripeSetupProgress.status === 'completed' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
            border: `1px solid ${stripeSetupProgress.status === 'error' ? 'rgba(239,68,68,0.3)' :
                                 stripeSetupProgress.status === 'completed' ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)'}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {stripeSetupProgress.status === 'completed' && <CheckCircle size={16} color="#10b981" />}
              {stripeSetupProgress.status === 'error' && <XCircle size={16} color="#ef4444" />}
              {stripeSetupProgress.status === 'running' && <Loader size={16} />}
              <span>{stripeSetupProgress.message}</span>
              {stripeSetupProgress.status !== 'running' && (
                <button onClick={() => setStripeSetupProgress(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>×</button>
              )}
            </div>
          </div>
        )}

        {stripeBatchResult && (
          <div style={{
            marginTop: '1rem', padding: '0.75rem', borderRadius: '8px',
            background: stripeBatchResult.status === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
            border: `1px solid ${stripeBatchResult.status === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {stripeBatchResult.status === 'error' ? <XCircle size={16} color="#ef4444" /> : <CheckCircle size={16} color="#10b981" />}
              <span>
                {stripeBatchResult.status === 'error' ? stripeBatchResult.message :
                  `Lastschriftlauf abgeschlossen: ${stripeBatchResult.succeeded} erfolgreich, ${stripeBatchResult.processing || 0} in Verarbeitung, ${stripeBatchResult.failed} fehlgeschlagen`}
              </span>
              <button onClick={() => setStripeBatchResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>×</button>
            </div>
          </div>
        )}
      </div>

      {/* Vorschau Tabelle */}
      {preview && preview.preview && preview.preview.length > 0 && (
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--border-default)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-default)' }}>
            <h3 style={{ margin: 0 }}>Vorschau ({preview.count} Einträge) - {formatCurrency(preview.total_amount)}</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', width: '30px' }}></th>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Mitglied</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>IBAN</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Offene Monate</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Betrag</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Mandatsreferenz</th>
              </tr>
            </thead>
            <tbody>
              {preview.preview.map((item, index) => (
                <React.Fragment key={index}>
                  <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <td style={{ padding: '0.75rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => toggleRowExpanded(item.mitglied_id)}>
                      {expandedRows.has(item.mitglied_id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <strong>{item.name}</strong>
                      <br /><small style={{ color: 'var(--text-secondary)' }}>ID: {item.mitglied_id}</small>
                    </td>
                    <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>{item.iban}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ padding: '0.25rem 0.5rem', background: 'rgba(251,191,36,0.2)', color: '#fbbf24', borderRadius: '4px', fontSize: '0.8rem' }}>
                        {item.anzahl_monate} {item.anzahl_monate === 1 ? 'Monat' : 'Monate'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: item.anzahl_monate > 1 ? '#f59e0b' : '#10b981' }}>
                      {formatCurrency(item.betrag)}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {item.mandatsreferenz === 'KEIN MANDAT' ? (
                        <span style={{ padding: '0.25rem 0.5rem', background: 'rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '4px', fontSize: '0.8rem' }}>{item.mandatsreferenz}</span>
                      ) : (
                        <span style={{ padding: '0.25rem 0.5rem', background: 'rgba(16,185,129,0.2)', color: '#10b981', borderRadius: '4px', fontSize: '0.8rem' }}>{item.mandatsreferenz}</span>
                      )}
                    </td>
                  </tr>
                  {expandedRows.has(item.mitglied_id) && item.beitraege && item.beitraege.length > 0 && (
                    <tr>
                      <td></td>
                      <td colSpan={5} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)' }}>
                        <strong style={{ fontSize: '0.85rem' }}>Einzelne Beiträge:</strong>
                        <table style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ color: 'var(--text-secondary)' }}>
                              <th style={{ textAlign: 'left', padding: '0.25rem' }}>Monat</th>
                              <th style={{ textAlign: 'left', padding: '0.25rem' }}>Datum</th>
                              <th style={{ textAlign: 'right', padding: '0.25rem' }}>Betrag</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.beitraege.map((beitrag, bIdx) => (
                              <tr key={bIdx}>
                                <td style={{ padding: '0.25rem' }}>{beitrag.monat}</td>
                                <td style={{ padding: '0.25rem' }}>{beitrag.datum}</td>
                                <td style={{ padding: '0.25rem', textAlign: 'right' }}>{formatCurrency(beitrag.betrag)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && preview.preview && preview.preview.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <Users size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p>Keine Lastschriften für diesen Monat vorhanden</p>
        </div>
      )}
    </div>
  );
};

/**
 * DojoSepaTab - SEPA-Mandate für Dojo Software-Abos
 * (Ursprüngliche SepaTab Funktionalität)
 */
const DojoSepaTab = ({ token }) => {
  const [mandate, setMandate] = useState([]);
  const [batches, setBatches] = useState([]);
  const [dojosOhneMandat, setDojosOhneMandat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewMandatModal, setShowNewMandatModal] = useState(false);
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);
  const [selectedDojo, setSelectedDojo] = useState(null);
  const [newMandat, setNewMandat] = useState({ kontoinhaber: '', iban: '', bic: '', mandats_datum: new Date().toISOString().split('T')[0] });
  const [batchDate, setBatchDate] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mandateRes, batchesRes, dojosRes] = await Promise.all([
        axios.get('/admin/sepa/mandate', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/admin/sepa/batches', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/admin/sepa/dojos-without-mandate', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setMandate(mandateRes.data.mandate || []);
      setBatches(batchesRes.data.batches || []);
      setDojosOhneMandat(dojosRes.data.dojos || []);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMandat = async () => {
    if (!selectedDojo || !newMandat.kontoinhaber || !newMandat.iban) {
      alert('Bitte alle Pflichtfelder ausfüllen');
      return;
    }
    try {
      await axios.post('/admin/sepa/mandate', {
        dojo_id: selectedDojo.id,
        ...newMandat
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert('SEPA-Mandat erfolgreich erstellt');
      setShowNewMandatModal(false);
      setNewMandat({ kontoinhaber: '', iban: '', bic: '', mandats_datum: new Date().toISOString().split('T')[0] });
      setSelectedDojo(null);
      loadData();
    } catch (error) {
      alert('Fehler: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCreateBatch = async () => {
    if (!batchDate) {
      alert('Bitte Ausführungsdatum wählen');
      return;
    }
    try {
      const response = await axios.post('/admin/sepa/batch/create', {
        ausfuehrungsdatum: batchDate
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert(`Batch erstellt: ${response.data.anzahl} Lastschriften, Gesamt: ${response.data.gesamtbetrag.toFixed(2)} EUR`);
      setShowNewBatchModal(false);
      loadData();
    } catch (error) {
      alert('Fehler: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDownloadXml = async (batchId) => {
    try {
      const response = await axios.get(`/admin/sepa/batch/${batchId}/xml`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `SEPA-Lastschrift-${batchId}.xml`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      loadData();
    } catch (error) {
      alert('Fehler beim Download');
    }
  };

  const handleUpdateMandatStatus = async (id, status) => {
    try {
      await axios.put(`/admin/sepa/mandate/${id}`, { status }, { headers: { Authorization: `Bearer ${token}` } });
      loadData();
    } catch (error) {
      alert('Fehler beim Aktualisieren');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      aktiv: { bg: 'rgba(16,185,129,0.2)', color: '#10b981' },
      pausiert: { bg: 'rgba(251,191,36,0.2)', color: '#fbbf24' },
      widerrufen: { bg: 'rgba(239,68,68,0.2)', color: '#ef4444' },
      erstellt: { bg: 'rgba(59,130,246,0.2)', color: '#3b82f6' },
      exportiert: { bg: 'rgba(16,185,129,0.2)', color: '#10b981' },
      eingereicht: { bg: 'rgba(139,92,246,0.2)', color: '#8b5cf6' },
      ausgefuehrt: { bg: 'rgba(16,185,129,0.3)', color: '#10b981' }
    };
    const s = styles[status] || { bg: 'rgba(156,163,175,0.2)', color: '#9ca3af' };
    return (
      <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', background: s.bg, color: s.color }}>
        {status}
      </span>
    );
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Lade SEPA-Daten...</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CreditCard size={24} /> Dojo-SEPA (Software-Abos)
        </h2>
        <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)' }}>
          SEPA-Mandate für Dojo Software-Subscriptions verwalten
        </p>
      </div>

      {/* Statistik-Karten */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(16,185,129,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
              <Users size={20} color="#10b981" />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Aktive Mandate</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>{mandate.filter(m => m.status === 'aktiv').length}</div>
            </div>
          </div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(251,191,36,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
              <Clock size={20} color="#fbbf24" />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Ohne Mandat</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fbbf24' }}>{dojosOhneMandat.length}</div>
            </div>
          </div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(59,130,246,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
              <FileText size={20} color="#3b82f6" />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Batches</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#3b82f6' }}>{batches.length}</div>
            </div>
          </div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(16,185,129,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
              <Euro size={20} color="#10b981" />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>MRR (SEPA)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>
                {mandate.filter(m => m.status === 'aktiv').reduce((sum, m) => sum + parseFloat(m.monthly_price || 0), 0).toFixed(0)} €
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Aktionen */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => setShowNewMandatModal(true)} style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 1.25rem', background: 'var(--primary)', color: '#000',
          border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer'
        }}>
          <Plus size={18} /> Neues Mandat
        </button>
        <button onClick={() => setShowNewBatchModal(true)} style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 1.25rem', background: 'rgba(59,130,246,0.2)', color: '#3b82f6',
          border: '1px solid #3b82f6', borderRadius: '8px', fontWeight: '600', cursor: 'pointer'
        }}>
          <FileText size={18} /> Lastschrift-Batch erstellen
        </button>
      </div>

      {/* Mandate Liste */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CreditCard size={20} /> SEPA-Mandate
        </h3>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Dojo</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Kontoinhaber</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>IBAN</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Plan</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Betrag</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Status</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {mandate.length === 0 ? (
                <tr><td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Keine Mandate vorhanden</td></tr>
              ) : mandate.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <td style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>{m.dojoname}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>{m.kontoinhaber}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.85rem' }}>{m.iban}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{m.plan_type}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--primary)', fontWeight: '600' }}>{parseFloat(m.monthly_price || 0).toFixed(2)} €</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>{getStatusBadge(m.status)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    {m.status === 'aktiv' ? (
                      <button onClick={() => handleUpdateMandatStatus(m.id, 'pausiert')} style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Pausieren</button>
                    ) : m.status === 'pausiert' ? (
                      <button onClick={() => handleUpdateMandatStatus(m.id, 'aktiv')} style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>Aktivieren</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dojos ohne Mandat - Detailliste */}
      {dojosOhneMandat.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={20} /> Dojos ohne SEPA-Mandat ({dojosOhneMandat.length})
          </h3>
          <div style={{
            background: 'rgba(251,191,36,0.1)',
            border: '1px solid rgba(251,191,36,0.3)',
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(251,191,36,0.1)' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: '#fbbf24', fontSize: '0.85rem', fontWeight: '600' }}>Dojo</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: '#fbbf24', fontSize: '0.85rem', fontWeight: '600' }}>Jahresbeitrag</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#fbbf24', fontSize: '0.85rem', fontWeight: '600' }}>Aktuelle Zahlungsart</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: '#fbbf24', fontSize: '0.85rem', fontWeight: '600' }}>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {dojosOhneMandat.map((dojo, idx) => (
                  <tr key={dojo.id} style={{
                    borderBottom: idx < dojosOhneMandat.length - 1 ? '1px solid rgba(251,191,36,0.2)' : 'none'
                  }}>
                    <td style={{ padding: '0.75rem' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{dojo.dojoname}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ID: {dojo.id}</div>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--primary)', fontWeight: '600' }}>
                      {parseFloat(dojo.monthly_price || 0).toFixed(2)} €
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)'
                      }}>
                        {dojo.zahlungsart || 'Nicht festgelegt'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <button
                        onClick={() => {
                          setSelectedDojo(dojo);
                          setShowNewMandatModal(true);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.35rem 0.75rem',
                          background: 'var(--primary)',
                          color: '#000',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        <Plus size={14} />
                        Mandat erstellen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Batches Liste */}
      <div>
        <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={20} /> Lastschrift-Batches
        </h3>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Referenz</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Erstellt</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Ausführung</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Transaktionen</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Betrag</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Status</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>XML</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr><td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Keine Batches vorhanden</td></tr>
              ) : batches.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <td style={{ padding: '0.75rem', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.85rem' }}>{b.batch_referenz}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(b.erstelldatum).toLocaleDateString('de-DE')}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>{new Date(b.ausfuehrungsdatum).toLocaleDateString('de-DE')}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-primary)' }}>{b.anzahl_transaktionen}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--primary)', fontWeight: '600' }}>{parseFloat(b.gesamtbetrag).toFixed(2)} €</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>{getStatusBadge(b.status)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <button onClick={() => handleDownloadXml(b.id)} style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', margin: '0 auto' }}>
                      <Download size={14} /> XML
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Neues Mandat */}
      {showNewMandatModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowNewMandatModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-primary)', borderRadius: '16px', width: '90%', maxWidth: '500px', border: '1px solid var(--border-default)' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--primary)' }}>Neues SEPA-Mandat</h3>
              <button onClick={() => setShowNewMandatModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Dojo auswählen *</label>
                <select value={selectedDojo?.id || ''} onChange={e => setSelectedDojo(dojosOhneMandat.find(d => d.id === parseInt(e.target.value)))} style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }}>
                  <option value="">-- Dojo wählen --</option>
                  {dojosOhneMandat.map(d => (
                    <option key={d.id} value={d.id}>{d.dojoname} ({d.plan_type} - {d.monthly_price} €)</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Kontoinhaber *</label>
                <input type="text" value={newMandat.kontoinhaber} onChange={e => setNewMandat({...newMandat, kontoinhaber: e.target.value})} style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>IBAN *</label>
                <input type="text" value={newMandat.iban} onChange={e => setNewMandat({...newMandat, iban: e.target.value})} placeholder="DE89 3704 0044 0532 0130 00" style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontFamily: 'monospace' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>BIC</label>
                <input type="text" value={newMandat.bic} onChange={e => setNewMandat({...newMandat, bic: e.target.value})} style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Mandatsdatum</label>
                <input type="date" value={newMandat.mandats_datum} onChange={e => setNewMandat({...newMandat, mandats_datum: e.target.value})} style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button onClick={() => setShowNewMandatModal(false)} style={{ padding: '0.75rem 1.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={handleCreateMandat} style={{ padding: '0.75rem 1.5rem', background: 'var(--primary)', border: 'none', borderRadius: '8px', color: '#000', fontWeight: '600', cursor: 'pointer' }}>Mandat erstellen</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Neuer Batch */}
      {showNewBatchModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowNewBatchModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-primary)', borderRadius: '16px', width: '90%', maxWidth: '450px', border: '1px solid var(--border-default)' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--primary)' }}>Lastschrift-Batch erstellen</h3>
              <button onClick={() => setShowNewBatchModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Es werden alle aktiven Mandate mit laufenden Subscriptions einbezogen.
              </p>
              <p style={{ color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
                <strong>{mandate.filter(m => m.status === 'aktiv').length}</strong> Mandate aktiv
              </p>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Gewünschtes Einzugsdatum *</label>
                <input type="date" value={batchDate} onChange={e => setBatchDate(e.target.value)} min={new Date(Date.now() + 5*24*60*60*1000).toISOString().split('T')[0]} style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                <small style={{ color: 'var(--text-secondary)' }}>Mind. 5 Werktage in der Zukunft</small>
              </div>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button onClick={() => setShowNewBatchModal(false)} style={{ padding: '0.75rem 1.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={handleCreateBatch} style={{ padding: '0.75rem 1.5rem', background: '#3b82f6', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', cursor: 'pointer' }}>Batch erstellen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanzenTab;
