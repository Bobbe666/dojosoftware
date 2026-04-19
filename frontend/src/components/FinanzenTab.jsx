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
import AutoLastschriftTab from './AutoLastschriftTab';
import '../styles/FinanzenTab.css';

const FinanzenTab = ({ token }) => {
  const [activeSubTab, setActiveSubTab] = useState('uebersicht');

  const subTabs = [
    { id: 'uebersicht', label: 'Übersicht', icon: BarChart3 },
    { id: 'lastschrift', label: 'Lastschrift', icon: CreditCard },
    { id: 'automatisch', label: 'Automatische Einzüge', icon: Calendar },
    { id: 'fehlende-mandate', label: 'Fehlende Mandate', icon: AlertCircle }
  ];

  return (
    <div className="finanzen-tab">
      {/* Sub-Tab Navigation */}
      <div className="fzt-subnav">
        {subTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`fzt-subtab-btn${activeSubTab === tab.id ? ' fzt-subtab-btn--active' : ''}`}
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

      {activeSubTab === 'automatisch' && (
        <AutoLastschriftTab embedded={true} dojoIdOverride={2} />
      )}

      {activeSubTab === 'fehlende-mandate' && (
        <FehlendeMandateTab token={token} />
      )}
    </div>
  );
};

/**
 * FehlendeMandateTab - Übersicht aller fehlenden SEPA-Mandate
 */
const FehlendeMandateTab = ({ token }) => {
  const TDA_DOJO_ID = 2;
  const [loading, setLoading] = useState(true);
  const [missingMitglieder, setMissingMitglieder] = useState([]);
  const [missingDojos, setMissingDojos] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mitgliederRes, dojosRes] = await Promise.all([
        axios.get(`/lastschriftlauf/missing-mandates?dojo_id=${TDA_DOJO_ID}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('/admin/sepa/dojos-without-mandate', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setMissingMitglieder(mitgliederRes.data?.members || []);
      setMissingDojos(dojosRes.data?.dojos || []);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="ft-loading-center">
        <Loader size={32} className="spin" />
        <span className="ft-loading-label">Lade fehlende Mandate...</span>
      </div>
    );
  }

  const totalMissing = missingMitglieder.length + missingDojos.length;

  return (
    <div>
      {/* Header */}
      <div className="ft-mb">
        <h2 className="ft-h2-gold">
          <AlertCircle size={24} /> Fehlende SEPA-Mandate
        </h2>
        <p className="ft-subtitle">
          Mitglieder und Dojos ohne aktives SEPA-Mandat
        </p>
      </div>

      {/* Stats */}
      <div className="ft-stats-grid">
        <div className="ft-card">
          <div className="u-flex-row-md">
            <div className="fzt-icon-gold">
              <AlertCircle size={20} color="#fbbf24" />
            </div>
            <div>
              <div className="u-text-secondary-sm">Gesamt fehlend</div>
              <div className="ft-stat-value-gold">{totalMissing}</div>
            </div>
          </div>
        </div>
        <div className="ft-card">
          <div className="u-flex-row-md">
            <div className="fzt-icon-green">
              <Users size={20} color="#10b981" />
            </div>
            <div>
              <div className="u-text-secondary-sm">Mitglieder</div>
              <div className="ft-stat-value-success">{missingMitglieder.length}</div>
            </div>
          </div>
        </div>
        <div className="ft-card">
          <div className="u-flex-row-md">
            <div className="fzt-icon-blue">
              <Building2 size={20} color="#3b82f6" />
            </div>
            <div>
              <div className="u-text-secondary-sm">Dojos</div>
              <div className="ft-stat-value-info">{missingDojos.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="ft-mb">
        <button
          onClick={loadData}
          className="fzt-btn-refresh"
        >
          <RefreshCw size={16} /> Aktualisieren
        </button>
      </div>

      {totalMissing === 0 ? (
        <div className="fzt-all-good-box">
          <CheckCircle size={48} color="#10b981" className="ft-icon-plain" />
          <p className="ft-success-text">Alle Mandate vorhanden!</p>
          <p className="u-text-secondary">Es gibt keine fehlenden SEPA-Mandate.</p>
        </div>
      ) : (
        <>
          {/* Mitglieder ohne Mandat */}
          {missingMitglieder.length > 0 && (
            <div className="ft-section-mb2">
              <h3 className="ft-h3-success">
                <Users size={20} /> Mitglieder ohne SEPA-Mandat ({missingMitglieder.length})
              </h3>
              <div className="fzt-table-wrapper">
                <table className="ft-table">
                  <thead>
                    <tr className="ft-border-bottom">
                      <th className="u-td-secondary">Name</th>
                      <th className="u-td-secondary">E-Mail</th>
                      <th className="u-td-secondary">Telefon</th>
                      <th className="ft-td-center-muted-sm">Verträge</th>
                      <th className="ft-td-center-muted-sm">Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingMitglieder.map((member, idx) => (
                      <tr key={member.mitglied_id} className={idx < missingMitglieder.length - 1 ? 'ft-border-bottom' : ''}>
                        <td className="ft-td">
                          <strong>{member.vorname} {member.nachname}</strong>
                          <div className="ft-text-muted-sm">ID: {member.mitglied_id}</div>
                        </td>
                        <td className="ft-td-muted">{member.email || '-'}</td>
                        <td className="ft-td-muted">{member.telefon || '-'}</td>
                        <td className="ft-td-center">
                          <span className="fzt-badge-gold">
                            {member.anzahl_vertraege} Vertrag{member.anzahl_vertraege !== 1 ? 'e' : ''}
                          </span>
                          {member.vertrag_namen && (
                            <div className="ft-text-muted-sm">
                              {member.vertrag_namen}
                            </div>
                          )}
                        </td>
                        <td className="ft-td-center">
                          <a
                            href={`/dashboard/mitglieder/${member.mitglied_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="fzt-link-btn-primary"
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

          {/* Dojos ohne Mandat */}
          {missingDojos.length > 0 && (
            <div>
              <h3 className="ft-h3-info">
                <Building2 size={20} /> Dojos ohne SEPA-Mandat ({missingDojos.length})
              </h3>
              <div className="fzt-table-wrapper">
                <table className="ft-table">
                  <thead>
                    <tr className="ft-border-bottom">
                      <th className="u-td-secondary">Dojo</th>
                      <th className="u-td-secondary">Plan</th>
                      <th className="ft-th-right">Monatsbeitrag</th>
                      <th className="ft-td-center-muted-sm">Zahlungsart</th>
                      <th className="ft-td-center-muted-sm">Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingDojos.map((dojo, idx) => (
                      <tr key={dojo.id} className={idx < missingDojos.length - 1 ? 'ft-border-bottom' : ''}>
                        <td className="ft-td">
                          <strong>{dojo.dojoname}</strong>
                          <div className="ft-text-muted-sm">ID: {dojo.id}</div>
                        </td>
                        <td className="ft-td-muted">{dojo.plan_type || '-'}</td>
                        <td className="ft-td-amount">
                          {formatCurrency(dojo.monthly_price)}
                        </td>
                        <td className="ft-td-center">
                          <span className="fzt-badge-secondary">
                            {dojo.zahlungsart || 'Nicht festgelegt'}
                          </span>
                        </td>
                        <td className="ft-td-center">
                          <a
                            href={`/dashboard/dojos/${dojo.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="fzt-link-btn-info"
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
        </>
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
      color: 'var(--success)',
      bgColor: 'rgba(16, 185, 129, 0.15)',
      data: dojoMitgliederData
    },
    {
      id: 'software-kunden',
      title: 'Software-Kunden',
      subtitle: 'Dojos mit Software-Abo',
      icon: Building2,
      color: 'var(--info)',
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
      color: 'var(--warning)',
      bgColor: 'rgba(245, 158, 11, 0.15)',
      data: getGesamtData()
    }
  ];

  if (loading) {
    return (
      <div className="ft-loading-center">
        <Loader size={32} className="spin" />
        <span className="ft-loading-label">Lade Lastschrift-Daten...</span>
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
      <div className="ft-mb">
        <h2 className="ft-h2-primary">
          <CreditCard size={24} /> Lastschrift-Verwaltung
        </h2>
        <p className="ft-subtitle">
          Wähle eine Kategorie zum Einziehen
        </p>
      </div>

      {/* Month/Year Selection */}
      <div className="ft-month-panel">
        <Calendar size={20} color="var(--text-secondary)" />
        <span className="u-text-secondary">Abrechnungsmonat:</span>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          className="ft-input"
        >
          {['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'].map((month, i) => (
            <option key={i + 1} value={i + 1}>{month}</option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="ft-input"
        >
          <option value={2024}>2024</option>
          <option value={2025}>2025</option>
          <option value={2026}>2026</option>
        </select>
        <button
          onClick={loadAllData}
          className="fzt-btn-refresh-auto"
        >
          <RefreshCw size={16} /> Aktualisieren
        </button>
      </div>

      {/* Category Cards Grid */}
      <div className="ft-cat-grid">
        {categories.map(cat => {
          const Icon = cat.icon;
          return (
            <div
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="fzt-cat-card"
              style={{ '--cat-color': cat.color, '--cat-bgcolor': cat.bgColor }}
            >
              <div className="fzt-cat-header">
                <div className="fzt-cat-icon-box">
                  <Icon size={22} color={cat.color} />
                </div>
                <div className="fzt-cat-titles">
                  <h3 className="fzt-cat-title">{cat.title}</h3>
                  <p className="fzt-cat-subtitle">{cat.subtitle}</p>
                </div>
              </div>

              <div className="fzt-cat-metrics">
                <div className="fzt-cat-metric">
                  <div className="fzt-cat-metric-label">
                    {cat.id === 'dojo-mitglieder' ? 'Mitglieder' : cat.id === 'gesamt' ? 'Einträge' : 'Dojos'}
                  </div>
                  <div className="fzt-cat-count">{cat.data.count}</div>
                </div>
                <div className="fzt-cat-metric fzt-cat-metric--right">
                  <div className="fzt-cat-metric-label">Fälliger Betrag</div>
                  <div className="fzt-cat-amount">{formatCurrency(cat.data.amount)}</div>
                </div>
              </div>

              <div className="fzt-cat-action-btn">
                <Zap size={14} />
                Einziehen
                <ChevronRight size={14} className="fzt-cat-arrow" />
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
            offene_monate: m.offene_monate,
            ratenplan_id: m.ratenplan_id || null,
            ratenplan_aufschlag: m.ratenplan_aufschlag || 0,
            raten_ausstehend: m.raten_ausstehend || 0
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
    <div style={{ '--cat-color': category.color, '--cat-bgcolor': category.bgColor }}>
      {/* Header with back button */}
      <div className="ft-mb">
        <button
          onClick={onBack}
          className="fzt-btn-back"
        >
          <ArrowLeft size={18} />
          Zurück zur Übersicht
        </button>

        <div className="u-flex-row-lg">
          <div className="fzt-cat-icon-box">
            <Icon size={28} color={category.color} />
          </div>
          <div>
            <h2 className="fzt-cat-detail-title">{category.title}</h2>
            <p className="ft-subtitle-small">{category.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="ft-stats-grid">
        <div className="ft-card">
          <div className="u-text-secondary-sm">Einträge</div>
          <div className="fzt-cat-detail-count">{category.data.count}</div>
        </div>
        <div className="ft-card">
          <div className="u-text-secondary-sm">Gesamtbetrag</div>
          <div className="ft-stat-value-primary">{formatCurrency(category.data.amount)}</div>
        </div>
        <div className="ft-card">
          <div className="u-text-secondary-sm">Abrechnungsmonat</div>
          <div className="ft-stat-value-gold">{getMonthName(selectedMonth)} {selectedYear}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="fzt-actions-panel">
        <div className="fzt-actions-panel-title">
          <Settings size={15} /> Einzug konfigurieren
        </div>
        <div className="fzt-actions-fields">
          <div className="fzt-field">
            <label className="ft-label">Monat</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="ft-input">
              {['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'].map((m, i) => (
                <option key={i+1} value={i+1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="fzt-field">
            <label className="ft-label">Jahr</label>
            <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="ft-input">
              <option value={2024}>2024</option>
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
            </select>
          </div>

          {(category.id === 'dojo-mitglieder' || category.id === 'gesamt') && (
            <>
              <div className="fzt-field">
                <label className="ft-label">Format</label>
                <select value={selectedFormat} onChange={(e) => setSelectedFormat(e.target.value)} className="ft-input">
                  <option value="xml">SEPA XML</option>
                  <option value="csv">CSV</option>
                </select>
              </div>
              <div className="fzt-field fzt-field--wide">
                <label className="ft-label">Einzugsbank</label>
                <select value={selectedBank || ''} onChange={(e) => setSelectedBank(parseInt(e.target.value))} className="ft-input">
                  {availableBanks.length === 0
                    ? <option value="">Keine Bankkonten</option>
                    : availableBanks.map(bank => (
                        <option key={bank.id} value={bank.id}>{bank.bank_name}{bank.ist_standard ? ' ★' : ''}</option>
                      ))
                  }
                </select>
              </div>
            </>
          )}
        </div>

        <div className="fzt-actions-btns">
          {(category.id === 'dojo-mitglieder' || category.id === 'gesamt') && (
            <button onClick={handleExport} disabled={processing || items.length === 0} className="fzt-btn-export">
              <Download size={15} /> Export
            </button>
          )}
          {(category.id === 'dojo-mitglieder' || category.id === 'gesamt') && stripeStatus?.stripe_configured && (
            <button onClick={handleStripeExecute} disabled={processing || items.length === 0} className="fzt-action-btn">
              {processing ? <Loader size={15} /> : <Zap size={15} />}
              Stripe einziehen
            </button>
          )}
          {(category.id === 'software-kunden' || category.id === 'verband') && (
            <button onClick={handleCreateSepaBatch} disabled={processing || items.length === 0} className="fzt-action-btn">
              {processing ? <Loader size={15} /> : <FileText size={15} />}
              SEPA-Batch erstellen
            </button>
          )}
          <button onClick={onRefresh} className="fzt-btn-refresh-auto">
            <RefreshCw size={15} /> Aktualisieren
          </button>
        </div>

        {result && (
          <div className={`fzt-result-box fzt-result-box--${result.status}`}>
            {result.status === 'success' ? <CheckCircle size={15} color="#10b981" /> : <XCircle size={15} color="#ef4444" />}
            <span>{result.message}</span>
            <button onClick={() => setResult(null)} className="ft-btn-dismiss">×</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="ft-card-section">
        <div className="ft-table-header">
          <h3 className="fzt-h3-no-margin">Einträge ({items.length})</h3>
        </div>

        {items.length === 0 ? (
          <div className="ft-table-empty">
            <Icon size={48} className="ft-icon-mb" />
            <p>Keine Einträge für diese Kategorie</p>
          </div>
        ) : (
          <table className="ft-table">
            <thead>
              <tr className="ft-border-bottom">
                {category.id === 'gesamt' && (
                  <th className="u-td-secondary">Kategorie</th>
                )}
                <th className="u-td-secondary">
                  {category.id === 'dojo-mitglieder' ? 'Mitglied' : 'Dojo'}
                </th>
                <th className="u-td-secondary">IBAN</th>
                {category.id !== 'dojo-mitglieder' && (
                  <th className="u-td-secondary">Plan</th>
                )}
                <th className="ft-th-right">Betrag</th>
                <th className="ft-td-center-muted-sm">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.mitglied_id || item.id || index} className="ft-border-bottom">
                  {category.id === 'gesamt' && (
                    <td className="ft-td">
                      <span className={`fzt-category-badge fzt-category-badge--${item._category === 'dojo-mitglieder' ? 'dojo' : item._category === 'software-kunden' ? 'software' : 'verband'}`}>
                        {item._category === 'dojo-mitglieder' ? 'Mitglied' :
                         item._category === 'software-kunden' ? 'Software' : 'Verband'}
                      </span>
                    </td>
                  )}
                  <td className="ft-td">
                    <strong>{item.name || item.dojoname}</strong>
                    {item.mitglied_id && <div className="ft-text-muted-sm">ID: {item.mitglied_id}</div>}
                  </td>
                  <td className="ft-td-iban">
                    {item.iban || '-'}
                  </td>
                  {category.id !== 'dojo-mitglieder' && (
                    <td className="ft-td-muted">
                      {item.plan_type || '-'}
                    </td>
                  )}
                  <td className="ft-td-amount">
                    {formatCurrency(item.betrag || item.monthly_price)}
                  </td>
                  <td className="ft-td-center">
                    <span className={`fzt-mandate-badge${((item.mandatsreferenz && item.mandatsreferenz !== 'KEIN MANDAT') || item.status === 'aktiv') ? ' fzt-mandate-badge--ok' : ' fzt-mandate-badge--error'}`}>
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
