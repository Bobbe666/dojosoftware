/**
 * FinanzenTab - Kombinierter Finanzen-Tab für Super Admin Dashboard
 *
 * Sub-Tabs:
 * 1. Übersicht - Finanzübersicht mit Charts/KPIs (SuperAdminFinanzen)
 * 2. Lastschrift - Kachel-basierte Ansicht für verschiedene Einzugs-Kategorien
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart3, CreditCard, Users, Euro, Plus, Download, CheckCircle, XCircle,
  Clock, FileText, RefreshCw, Calendar, DollarSign, AlertCircle, Eye,
  ChevronDown, ChevronRight, Zap, Settings, Loader, ArrowLeft, Building2, Globe
} from 'lucide-react';
import SuperAdminFinanzen from './SuperAdminFinanzen';

const FinanzenTab = ({ token }) => {
  const [activeSubTab, setActiveSubTab] = useState('uebersicht');

  const subTabs = [
    { id: 'uebersicht', label: 'Übersicht', icon: BarChart3 },
    { id: 'lastschrift', label: 'Lastschrift', icon: CreditCard }
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

      {activeSubTab === 'lastschrift' && (
        <LastschriftTab token={token} />
      )}
    </div>
  );
};

/**
 * LastschriftTab - Kachel-basierte Lastschrift-Verwaltung
 * Kategorien: Dojo-Mitglieder, Software-Kunden, Verbandsmitglieder, Gesamt
 */
const LastschriftTab = ({ token }) => {
  const TDA_DOJO_ID = 2;

  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);

  // Data for each category
  const [dojoMitgliederData, setDojoMitgliederData] = useState({ count: 0, amount: 0, items: [] });
  const [softwareKundenData, setSoftwareKundenData] = useState({ count: 0, amount: 0, items: [] });
  const [verbandData, setVerbandData] = useState({ count: 0, amount: 0, items: [] });

  // Shared state for detail view
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadAllData();
  }, [selectedMonth, selectedYear]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadDojoMitglieder(),
        loadSoftwareKunden(),
        loadVerbandMitglieder()
      ]);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDojoMitglieder = async () => {
    try {
      const response = await axios.get(
        `/lastschriftlauf/preview?monat=${selectedMonth}&jahr=${selectedYear}&dojo_id=${TDA_DOJO_ID}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data) {
        setDojoMitgliederData({
          count: response.data.count || 0,
          amount: parseFloat(response.data.total_amount) || 0,
          items: response.data.preview || []
        });
      }
    } catch (error) {
      console.error('Fehler beim Laden Dojo-Mitglieder:', error);
    }
  };

  const loadSoftwareKunden = async () => {
    try {
      const response = await axios.get('/admin/sepa/mandate', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const mandate = response.data.mandate || [];
      // Filter for software subscriptions (plan_type contains 'software' or is a paid plan)
      const softwareMandate = mandate.filter(m =>
        m.status === 'aktiv' &&
        (m.plan_type?.toLowerCase().includes('software') ||
         m.plan_type?.toLowerCase().includes('starter') ||
         m.plan_type?.toLowerCase().includes('professional') ||
         m.plan_type?.toLowerCase().includes('enterprise') ||
         parseFloat(m.monthly_price) > 0)
      );
      setSoftwareKundenData({
        count: softwareMandate.length,
        amount: softwareMandate.reduce((sum, m) => sum + parseFloat(m.monthly_price || 0), 0),
        items: softwareMandate
      });
    } catch (error) {
      console.error('Fehler beim Laden Software-Kunden:', error);
    }
  };

  const loadVerbandMitglieder = async () => {
    try {
      const response = await axios.get('/admin/sepa/mandate', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const mandate = response.data.mandate || [];
      // Filter for Verband memberships
      const verbandMandate = mandate.filter(m =>
        m.status === 'aktiv' &&
        (m.plan_type?.toLowerCase().includes('verband') ||
         m.plan_type?.toLowerCase().includes('mitglied'))
      );
      setVerbandData({
        count: verbandMandate.length,
        amount: verbandMandate.reduce((sum, m) => sum + parseFloat(m.monthly_price || 0), 0),
        items: verbandMandate
      });
    } catch (error) {
      console.error('Fehler beim Laden Verbandsmitglieder:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  };

  const getGesamtData = () => ({
    count: dojoMitgliederData.count + softwareKundenData.count + verbandData.count,
    amount: dojoMitgliederData.amount + softwareKundenData.amount + verbandData.amount
  });

  const categories = [
    {
      id: 'dojo-mitglieder',
      title: 'Dojo-Mitglieder',
      subtitle: 'Mitglieder von TDA International',
      icon: Users,
      color: '#10b981',
      bgColor: 'rgba(16, 185, 129, 0.15)',
      data: dojoMitgliederData
    },
    {
      id: 'software-kunden',
      title: 'Software-Kunden',
      subtitle: 'Dojos mit Software-Abo',
      icon: Building2,
      color: '#3b82f6',
      bgColor: 'rgba(59, 130, 246, 0.15)',
      data: softwareKundenData
    },
    {
      id: 'verband',
      title: 'Verbandsmitglieder',
      subtitle: 'TDA Verband Mitglieder',
      icon: Globe,
      color: '#8b5cf6',
      bgColor: 'rgba(139, 92, 246, 0.15)',
      data: verbandData
    },
    {
      id: 'gesamt',
      title: 'Gesamt',
      subtitle: 'Alle Lastschriften zusammen',
      icon: Euro,
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.15)',
      data: getGesamtData()
    }
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
        <Loader size={32} className="spin" />
        <span style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>Lade Lastschrift-Daten...</span>
      </div>
    );
  }

  // If a category is selected, show detail view
  if (activeCategory) {
    return (
      <CategoryDetailView
        category={categories.find(c => c.id === activeCategory)}
        token={token}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        setSelectedMonth={setSelectedMonth}
        setSelectedYear={setSelectedYear}
        onBack={() => setActiveCategory(null)}
        onRefresh={loadAllData}
        dojoMitgliederData={dojoMitgliederData}
        softwareKundenData={softwareKundenData}
        verbandData={verbandData}
      />
    );
  }

  // Card overview
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CreditCard size={24} /> Lastschrift-Verwaltung
        </h2>
        <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)' }}>
          Wähle eine Kategorie zum Einziehen
        </p>
      </div>

      {/* Month/Year Selection */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
        padding: '1rem',
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        border: '1px solid var(--border-default)',
        alignItems: 'center'
      }}>
        <Calendar size={20} color="var(--text-secondary)" />
        <span style={{ color: 'var(--text-secondary)' }}>Abrechnungsmonat:</span>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: '6px', color: 'var(--text-primary)' }}
        >
          {['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'].map((month, i) => (
            <option key={i + 1} value={i + 1}>{month}</option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: '6px', color: 'var(--text-primary)' }}
        >
          <option value={2024}>2024</option>
          <option value={2025}>2025</option>
          <option value={2026}>2026</option>
        </select>
        <button
          onClick={loadAllData}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 1rem', background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-default)', borderRadius: '6px',
            color: 'var(--text-primary)', cursor: 'pointer', marginLeft: 'auto'
          }}
        >
          <RefreshCw size={16} /> Aktualisieren
        </button>
      </div>

      {/* Category Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '1.5rem'
      }}>
        {categories.map(cat => {
          const Icon = cat.icon;
          return (
            <div
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)',
                borderRadius: '16px',
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = cat.color;
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = `0 8px 24px ${cat.bgColor}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Background accent */}
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '120px',
                height: '120px',
                background: cat.bgColor,
                borderRadius: '0 0 0 100%',
                opacity: 0.5
              }} />

              {/* Content */}
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{
                    background: cat.bgColor,
                    padding: '0.75rem',
                    borderRadius: '12px'
                  }}>
                    <Icon size={28} color={cat.color} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                      {cat.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {cat.subtitle}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      {cat.id === 'dojo-mitglieder' ? 'Mitglieder' : cat.id === 'gesamt' ? 'Einträge' : 'Dojos'}
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: cat.color }}>
                      {cat.data.count}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Fälliger Betrag
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>
                      {formatCurrency(cat.data.amount)}
                    </div>
                  </div>
                </div>

                <button
                  style={{
                    width: '100%',
                    marginTop: '1.25rem',
                    padding: '0.75rem',
                    background: cat.color,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Zap size={18} />
                  Einziehen
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * CategoryDetailView - Detail-Ansicht für eine Kategorie
 */
const CategoryDetailView = ({
  category,
  token,
  selectedMonth,
  selectedYear,
  setSelectedMonth,
  setSelectedYear,
  onBack,
  onRefresh,
  dojoMitgliederData,
  softwareKundenData,
  verbandData
}) => {
  const TDA_DOJO_ID = 2;
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [selectedFormat, setSelectedFormat] = useState('xml');
  const [availableBanks, setAvailableBanks] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null);
  const [stripeStatus, setStripeStatus] = useState(null);

  useEffect(() => {
    loadBanks();
    loadStripeStatus();
  }, []);

  const loadBanks = async () => {
    try {
      const response = await axios.get(
        `/lastschriftlauf/banken?dojo_id=${TDA_DOJO_ID}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data?.banken) {
        setAvailableBanks(response.data.banken);
        const standardBank = response.data.banken.find(b => b.ist_standard) || response.data.banken[0];
        if (standardBank) setSelectedBank(standardBank.id);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Banken:', error);
    }
  };

  const loadStripeStatus = async () => {
    try {
      const response = await axios.get(
        `/lastschriftlauf/stripe/status?dojo_id=${TDA_DOJO_ID}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStripeStatus(response.data);
    } catch (error) {
      console.error('Fehler beim Laden des Stripe-Status:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  };

  const getMonthName = (month) => {
    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    return months[month - 1];
  };

  const toggleRowExpanded = (id) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  // Get items based on category
  const getItems = () => {
    switch (category.id) {
      case 'dojo-mitglieder':
        return dojoMitgliederData.items;
      case 'software-kunden':
        return softwareKundenData.items;
      case 'verband':
        return verbandData.items;
      case 'gesamt':
        return [
          ...dojoMitgliederData.items.map(i => ({ ...i, _category: 'dojo-mitglieder' })),
          ...softwareKundenData.items.map(i => ({ ...i, _category: 'software-kunden' })),
          ...verbandData.items.map(i => ({ ...i, _category: 'verband' }))
        ];
      default:
        return [];
    }
  };

  const handleExport = () => {
    if (!selectedBank) {
      alert('Bitte wähle ein Bankkonto für den Einzug aus');
      return;
    }

    const exportUrl = selectedFormat === 'xml'
      ? `/lastschriftlauf/xml?monat=${selectedMonth}&jahr=${selectedYear}&bank_id=${selectedBank}&dojo_id=${TDA_DOJO_ID}`
      : `/lastschriftlauf?monat=${selectedMonth}&jahr=${selectedYear}&bank_id=${selectedBank}&dojo_id=${TDA_DOJO_ID}`;

    window.open(exportUrl, '_blank');
  };

  const handleStripeExecute = async () => {
    const items = getItems();
    if (items.length === 0) {
      alert('Keine Einträge zum Einziehen vorhanden');
      return;
    }

    if (!window.confirm(`Stripe SEPA Lastschrift für ${items.length} Einträge ausführen?\n\nGesamtbetrag: ${formatCurrency(category.data.amount)}`)) {
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      const response = await axios.post(
        `/lastschriftlauf/stripe/execute`,
        {
          dojo_id: TDA_DOJO_ID,
          monat: selectedMonth,
          jahr: selectedYear,
          mitglieder: items.filter(i => i.mitglied_id).map(m => ({
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
        setResult({
          status: 'success',
          message: `Erfolgreich: ${response.data.succeeded}, In Verarbeitung: ${response.data.processing || 0}, Fehlgeschlagen: ${response.data.failed}`
        });
        onRefresh();
      } else {
        setResult({ status: 'error', message: response.data.error });
      }
    } catch (error) {
      setResult({ status: 'error', message: error.response?.data?.error || error.message });
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateSepaBatch = async () => {
    const items = getItems();
    if (items.length === 0) {
      alert('Keine Einträge für den Batch vorhanden');
      return;
    }

    const batchDate = new Date();
    batchDate.setDate(batchDate.getDate() + 7); // 7 days in future
    const dateStr = batchDate.toISOString().split('T')[0];

    if (!window.confirm(`SEPA-Lastschrift-Batch erstellen?\n\nAusführungsdatum: ${batchDate.toLocaleDateString('de-DE')}\nAnzahl: ${items.length}\nBetrag: ${formatCurrency(category.data.amount)}`)) {
      return;
    }

    setProcessing(true);
    try {
      const response = await axios.post('/admin/sepa/batch/create', {
        ausfuehrungsdatum: dateStr
      }, { headers: { Authorization: `Bearer ${token}` } });

      setResult({
        status: 'success',
        message: `Batch erstellt: ${response.data.anzahl} Lastschriften, Gesamt: ${formatCurrency(response.data.gesamtbetrag)}`
      });
      onRefresh();
    } catch (error) {
      setResult({ status: 'error', message: error.response?.data?.error || error.message });
    } finally {
      setProcessing(false);
    }
  };

  const items = getItems();
  const Icon = category.icon;

  return (
    <div>
      {/* Header with back button */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            marginBottom: '1rem'
          }}
        >
          <ArrowLeft size={18} />
          Zurück zur Übersicht
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: category.bgColor, padding: '0.75rem', borderRadius: '12px' }}>
            <Icon size={28} color={category.color} />
          </div>
          <div>
            <h2 style={{ margin: 0, color: category.color }}>{category.title}</h2>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)' }}>{category.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Einträge</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: category.color }}>{category.data.count}</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Gesamtbetrag</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>{formatCurrency(category.data.amount)}</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Abrechnungsmonat</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fbbf24' }}>{getMonthName(selectedMonth)} {selectedYear}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        border: '1px solid var(--border-default)',
        padding: '1.25rem',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Aktionen</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          {/* Month/Year Selection */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Monat</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: '6px', color: 'var(--text-primary)' }}
            >
              {['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'].map((month, i) => (
                <option key={i + 1} value={i + 1}>{month}</option>
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

          {/* For dojo-mitglieder: Stripe + Export */}
          {(category.id === 'dojo-mitglieder' || category.id === 'gesamt') && (
            <>
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
                  style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: '6px', color: 'var(--text-primary)', minWidth: '180px' }}
                >
                  {availableBanks.length === 0 ? (
                    <option value="">Keine Bankkonten</option>
                  ) : (
                    availableBanks.map(bank => (
                      <option key={bank.id} value={bank.id}>
                        {bank.bank_name} {bank.ist_standard ? '★' : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <button
                onClick={handleExport}
                disabled={processing || items.length === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 1rem', background: 'rgba(59,130,246,0.2)',
                  border: '1px solid #3b82f6', borderRadius: '6px',
                  color: '#3b82f6', cursor: 'pointer'
                }}
              >
                <Download size={16} /> Export
              </button>

              {stripeStatus?.stripe_configured && (
                <button
                  onClick={handleStripeExecute}
                  disabled={processing || items.length === 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.5rem 1rem', background: category.color,
                    border: 'none', borderRadius: '6px',
                    color: '#fff', fontWeight: '600', cursor: 'pointer'
                  }}
                >
                  {processing ? <Loader size={16} /> : <Zap size={16} />}
                  Mit Stripe einziehen
                </button>
              )}
            </>
          )}

          {/* For software-kunden and verband: SEPA Batch */}
          {(category.id === 'software-kunden' || category.id === 'verband') && (
            <button
              onClick={handleCreateSepaBatch}
              disabled={processing || items.length === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 1rem', background: category.color,
                border: 'none', borderRadius: '6px',
                color: '#fff', fontWeight: '600', cursor: 'pointer'
              }}
            >
              {processing ? <Loader size={16} /> : <FileText size={16} />}
              SEPA-Batch erstellen
            </button>
          )}

          <button
            onClick={onRefresh}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 1rem', background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-default)', borderRadius: '6px',
              color: 'var(--text-primary)', cursor: 'pointer', marginLeft: 'auto'
            }}
          >
            <RefreshCw size={16} /> Aktualisieren
          </button>
        </div>

        {/* Result message */}
        {result && (
          <div style={{
            marginTop: '1rem', padding: '0.75rem', borderRadius: '8px',
            background: result.status === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${result.status === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {result.status === 'success' ? <CheckCircle size={16} color="#10b981" /> : <XCircle size={16} color="#ef4444" />}
              <span>{result.message}</span>
              <button onClick={() => setResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>×</button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        border: '1px solid var(--border-default)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-default)' }}>
          <h3 style={{ margin: 0 }}>Einträge ({items.length})</h3>
        </div>

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <Icon size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>Keine Einträge für diese Kategorie</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                {category.id === 'gesamt' && (
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Kategorie</th>
                )}
                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {category.id === 'dojo-mitglieder' ? 'Mitglied' : 'Dojo'}
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>IBAN</th>
                {category.id !== 'dojo-mitglieder' && (
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Plan</th>
                )}
                <th style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Betrag</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.mitglied_id || item.id || index} style={{ borderBottom: '1px solid var(--border-default)' }}>
                  {category.id === 'gesamt' && (
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        background: item._category === 'dojo-mitglieder' ? 'rgba(16,185,129,0.2)' :
                                   item._category === 'software-kunden' ? 'rgba(59,130,246,0.2)' : 'rgba(139,92,246,0.2)',
                        color: item._category === 'dojo-mitglieder' ? '#10b981' :
                               item._category === 'software-kunden' ? '#3b82f6' : '#8b5cf6'
                      }}>
                        {item._category === 'dojo-mitglieder' ? 'Mitglied' :
                         item._category === 'software-kunden' ? 'Software' : 'Verband'}
                      </span>
                    </td>
                  )}
                  <td style={{ padding: '0.75rem' }}>
                    <strong>{item.name || item.dojoname}</strong>
                    {item.mitglied_id && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ID: {item.mitglied_id}</div>}
                  </td>
                  <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {item.iban || '-'}
                  </td>
                  {category.id !== 'dojo-mitglieder' && (
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                      {item.plan_type || '-'}
                    </td>
                  )}
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: 'var(--primary)' }}>
                    {formatCurrency(item.betrag || item.monthly_price)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      background: (item.mandatsreferenz && item.mandatsreferenz !== 'KEIN MANDAT') || item.status === 'aktiv'
                        ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                      color: (item.mandatsreferenz && item.mandatsreferenz !== 'KEIN MANDAT') || item.status === 'aktiv'
                        ? '#10b981' : '#ef4444'
                    }}>
                      {item.mandatsreferenz || item.status || 'Bereit'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default FinanzenTab;
