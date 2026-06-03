import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  Calendar,
  FileText,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  BarChart3,
  Wallet,
  Users,
  Receipt,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
  CalendarDays,
  AlertTriangle,
  ChevronRight,
  RotateCcw,
  Building2
} from "lucide-react";
import { useMitgliederUpdate } from '../context/MitgliederUpdateContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx'; // 🔒 TAX COMPLIANCE: Dojo-Filter
import config from "../config/config";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/Finanzcockpit.css";
import { fetchWithAuth } from '../utils/fetchWithAuth';


const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#f97316'];

const Finanzcockpit = ({ embed = false } = {}) => {
  const navigate = useNavigate();
  const { updateTrigger } = useMitgliederUpdate();
  const { getDojoFilterParam, activeDojo, filter, dojos, switchDojo, setFilter } = useDojoContext(); // 🔒 TAX COMPLIANCE: Dojo-Filter
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [memberStats, setMemberStats] = useState(null);

  // Dojo-Auswahl für schnelles Wechseln im Finanzcockpit
  const [selectedDojoId, setSelectedDojoId] = useState(filter === 'all' ? 'all' : (activeDojo?.id || 'all'));
  const [stats, setStats] = useState(null);
  const [timelineData, setTimelineData] = useState([]);
  const [tarifData, setTarifData] = useState([]);
  const [alerts, setAlerts] = useState({ ruecklastschriften: 0 });
  const [aktiverChartTab, setAktiverChartTab] = useState('zahlungsarten');
  const [openKpi, setOpenKpi] = useState(null); // KPI-Detail-Modal

  // Escape schließt das Detail-Modal
  useEffect(() => {
    if (!openKpi) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpenKpi(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openKpi]);

  useEffect(() => {
    loadFinanzStats();
    loadTimelineData();
    loadTarifData();
    loadAlerts();
    loadMemberStats();
  }, [updateTrigger, selectedPeriod, activeDojo, filter]); // 🔒 TAX COMPLIANCE: Neu laden wenn Dojo-Filter ändert

  // Sync selectedDojoId mit aktivem Dojo
  useEffect(() => {
    if (filter === 'all') {
      setSelectedDojoId('all');
    } else if (activeDojo && typeof activeDojo === 'object') {
      setSelectedDojoId(activeDojo.id);
    }
  }, [activeDojo, filter]);

  // Handler für Dojo-Wechsel im Finanzcockpit
  const handleDojoChange = (dojoId) => {
    setSelectedDojoId(dojoId);
    if (dojoId === 'all') {
      // Alle Dojos anzeigen
      if (dojos.length > 0) {
        const hauptDojo = dojos.find(d => d.ist_hauptdojo) || dojos[0];
        switchDojo(hauptDojo);
      }
      setFilter('all');
    } else {
      // Spezifisches Dojo auswählen
      const selectedDojo = dojos.find(d => d.id === parseInt(dojoId));
      if (selectedDojo) {
        switchDojo(selectedDojo);
        setFilter('current');
      }
    }
  };

  // Aktuell angezeigter Dojo-Name
  const getCurrentDojoLabel = () => {
    if (filter === 'all' || selectedDojoId === 'all') {
      return 'Alle Standorte';
    }
    if (activeDojo && typeof activeDojo === 'object') {
      return activeDojo.dojoname;
    }
    return 'Alle Standorte';
  };

  const loadFinanzStats = async () => {
    try {
      setLoading(true);
      
      const dojoFilterParam = getDojoFilterParam(); // 🔒 TAX COMPLIANCE: Dojo-Filter
      const separator = dojoFilterParam ? '&' : '';
      const response = await fetchWithAuth(`${config.apiBaseUrl}/finanzcockpit/stats?period=${selectedPeriod}${separator}${dojoFilterParam}`);
      
      if (!response.ok) {
        throw new Error('Fehler beim Laden der Finanzstatistiken');
      }

      const result = await response.json();
      
      if (result.success) {
        setStats(result.data);
      } else {
        throw new Error(result.error || 'Fehler beim Laden der Daten');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der Finanzstatistiken:', error);
      setStats(null);
      setLoading(false);
    }
  };

  const loadTimelineData = async () => {
    try {
      const dojoFilterParam = getDojoFilterParam(); // 🔒 TAX COMPLIANCE: Dojo-Filter
      const months = selectedPeriod === 'month' ? 3 : selectedPeriod === 'quarter' ? 6 : 12;
      const separator = dojoFilterParam ? '&' : '';
      const response = await fetchWithAuth(`${config.apiBaseUrl}/finanzcockpit/timeline?period=${selectedPeriod}&months=${months}${separator}${dojoFilterParam}`);

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Berechne Trendlinie (lineare Regression)
          const data = result.data || [];
          const n = data.length;

          if (n > 1) {
            let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
            data.forEach((point, index) => {
              sumX += index;
              sumY += point.umsatz || 0;
              sumXY += index * (point.umsatz || 0);
              sumX2 += index * index;
            });

            // Vermeide Division durch 0
            const denominator = (n * sumX2 - sumX * sumX);
            if (denominator !== 0) {
              const slope = (n * sumXY - sumX * sumY) / denominator;
              const intercept = (sumY - slope * sumX) / n;

              // Füge Trendwerte hinzu
              const dataWithTrend = data.map((point, index) => ({
                ...point,
                trend: slope * index + intercept
              }));
              setTimelineData(dataWithTrend);
            } else {
              // Wenn alle Werte gleich sind (z.B. alle 0), keine Trendlinie
              setTimelineData(data.map(point => ({ ...point, trend: point.umsatz || 0 })));
            }
          } else {
            setTimelineData(data);
          }
        } else {
          setTimelineData([]);
        }
      } else {
        setTimelineData([]);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Timeline-Daten:', error);
      setTimelineData([]);
    }
  };

  const loadTarifData = async () => {
    try {
      const dojoFilterParam = getDojoFilterParam(); // 🔒 TAX COMPLIANCE: Dojo-Filter
      const separator = dojoFilterParam ? '&' : '';
      const response = await fetchWithAuth(`${config.apiBaseUrl}/finanzcockpit/tarif-breakdown?${dojoFilterParam}`);

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setTarifData(result.data);
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Tarif-Daten:', error);
    }
  };

  const loadMemberStats = async () => {
    try {
      const dojoFilterParam = getDojoFilterParam();
      const separator = dojoFilterParam ? '&' : '';
      const response = await fetchWithAuth(`${config.apiBaseUrl}/finanzcockpit/member-stats?period=${selectedPeriod}${separator}${dojoFilterParam}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) setMemberStats(result.data);
      }
    } catch (_) {}
  };

  const loadAlerts = async () => {
    try {
      const dojoFilterParam = getDojoFilterParam();
      const rlRes = await fetchWithAuth(
        `${config.apiBaseUrl}/ruecklastschriften${dojoFilterParam ? '?' + dojoFilterParam : ''}`
      );
      if (rlRes.ok) {
        const rlData = await rlRes.json();
        const offen = (rlData.ruecklastschriften || []).filter(r => r.status === 'offen' || r.status === 'neu').length;
        setAlerts(prev => ({ ...prev, ruecklastschriften: offen }));
      }
    } catch (_) {
      // Alerts sind optional — Fehler still ignorieren
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  };

  const formatCurrencyCompact = (amount) => {
    try {
      return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 1,
        notation: 'compact'
      }).format(amount || 0).replace(/\u00a0/g, ' ');
    } catch (error) {
      const value = Math.abs(amount || 0);
      const suffix = value >= 1_000_000 ? ' Mio' : value >= 1_000 ? ' Tsd' : '';
      const divisor = value >= 1_000_000 ? 1_000_000 : value >= 1_000 ? 1_000 : 1;
      return `${formatCurrency((amount || 0) / divisor)}${suffix}`;
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('de-DE').format(num || 0);
  };

  const formatDate = (value) => {
    if (!value) return '-';
    try {
      return new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(new Date(value));
    } catch (error) {
      return value;
    }
  };

  const periodLabels = {
    month: 'Aktueller Monat',
    quarter: 'Aktuelles Quartal',
    year: 'Aktuelles Jahr'
  };

  const periodLabel = periodLabels[selectedPeriod] || 'Zeitraum';

  // Custom Tooltip für Einnahmen-Aufschlüsselung mit Tarif-Details
  const CustomIncomeTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="fc__tooltip">
          <p className="fc__tooltip-title">
            {label}: {formatCurrency(payload[0].value)}
          </p>

          {label === 'Verträge' && tarifData.length > 0 && (
            <div className="fc__tooltip-breakdown">
              <p className="fc__tooltip-breakdown-heading">
                Aufschlüsselung nach Tarifen:
              </p>
              {tarifData.map(tarif => (
                <div
                  key={tarif.name}
                  className="fc__tooltip-row"
                >
                  <span className="u-text-primary">
                    {tarif.name}
                  </span>
                  <span className="fc__tooltip-row-value">
                    {formatCurrency(tarif.value)} ({tarif.count})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Daten für Zahlungsarten-Chart
  const paymentMethodData = stats ? [
    { name: 'Bar', value: stats.barEinnahmen || 0 },
    { name: 'Karte', value: stats.kartenEinnahmen || 0 },
    { name: 'Lastschrift', value: stats.lastschriftEinnahmen || 0 }
  ].filter(item => item.value > 0) : [];

  // Daten für Einnahmen-Aufschlüsselung
  const incomeBreakdownData = stats ? [
    { name: 'Verträge', value: stats.monatlicheEinnahmen || 0 },
    { name: 'Verkäufe', value: stats.verkaeufeEinnahmen || 0 },
    { name: 'Rechnungen', value: stats.rechnungenEinnahmen || 0 },
    { name: 'Zahlungen', value: stats.zahlungenEinnahmen || 0 },
    { name: 'Zahlläufe', value: stats.zahllaeufeEinnahmen || 0 }
  ].filter(item => item.value > 0) : [];

  const averageSale = stats?.anzahlVerkaeufe > 0
    ? (stats.verkaeufeEinnahmen || 0) / stats.anzahlVerkaeufe
    : 0;

  // Detail-Inhalte für das KPI-Modal (mehr Details beim Klick auf eine Kennzahl)
  const periodRange = stats ? `${formatDate(stats.dateStart)} – ${formatDate(stats.dateEnd)}` : '';
  const kpiDetailDefs = stats ? {
    revenue: {
      title: 'Gesamteinnahmen', subtitle: `${periodLabel} · ${periodRange}`,
      hero: formatCurrency(stats.gesamteinnahmen),
      rows: [
        { label: 'Vertragseinnahmen (wiederkehrend)', value: formatCurrency(stats.monatlicheEinnahmen) },
        { label: 'Verkäufe', value: formatCurrency(stats.verkaeufeEinnahmen) },
        { label: 'Rechnungen (bezahlt)', value: formatCurrency(stats.rechnungenEinnahmen) },
        { label: 'Zahlungen', value: formatCurrency(stats.zahlungenEinnahmen) },
        { label: 'Zahlläufe', value: formatCurrency(stats.zahllaeufeEinnahmen) },
        { label: 'Trend vs. Vorperiode', value: `${stats.einnahmenTrend >= 0 ? '+' : ''}${(stats.einnahmenTrend ?? 0).toFixed(1)} %`, tone: stats.einnahmenTrend >= 0 ? 'positive' : 'negative' }
      ],
      route: '/dashboard/jahresuebersicht', routeLabel: 'Jahresübersicht öffnen'
    },
    expenses: {
      title: 'Gesamtausgaben', subtitle: `${periodLabel} · ${periodRange}`,
      hero: formatCurrency(stats.gesamteAusgaben),
      rows: [
        { label: 'Anzahl Buchungen', value: formatNumber(stats.anzahlAusgaben) },
        { label: 'Trend vs. Vorperiode', value: stats.ausgabenTrend !== 0 ? `${stats.ausgabenTrend > 0 ? '+' : ''}${(stats.ausgabenTrend ?? 0).toFixed(1)} %` : 'Keine Vergleichsdaten', tone: stats.ausgabenTrend > 0 ? 'negative' : 'positive' }
      ],
      route: '/dashboard/ausgaben', routeLabel: 'Ausgaben öffnen'
    },
    cashflow: {
      title: 'Cashflow', subtitle: `${periodLabel} · ${periodRange}`,
      hero: formatCurrency(stats.cashflow),
      rows: [
        { label: 'Einnahmen', value: formatCurrency(stats.gesamteinnahmen), tone: 'positive' },
        { label: 'Ausgaben', value: formatCurrency(stats.gesamteAusgaben), tone: 'negative' },
        { label: 'Marge', value: `${(stats.cashflowProzent ?? 0).toFixed(1)} %`, tone: stats.cashflow >= 0 ? 'positive' : 'negative' }
      ],
      route: '/dashboard/euer', routeLabel: 'EÜR öffnen'
    },
    'open-invoices': {
      title: 'Offene Rechnungen', subtitle: 'Aktueller Stand',
      hero: formatNumber(stats.offeneRechnungen),
      rows: [
        { label: 'Offener Betrag', value: formatCurrency(stats.offeneRechnungenBetrag), tone: stats.offeneRechnungenBetrag > 0 ? 'warning' : 'positive' },
        { label: 'Überfällige Rechnungen', value: formatNumber(stats.ueberfaelligeRechnungen), tone: stats.ueberfaelligeRechnungen > 0 ? 'negative' : 'positive' },
        { label: 'Mahnfähige Beiträge', value: `${formatNumber(stats.ausstehendeZahlungen)} · ${formatCurrency(stats.ausstehendeZahlungenBetrag)}`, tone: stats.ausstehendeZahlungen > 0 ? 'warning' : 'positive' }
      ],
      route: '/dashboard/rechnungen', routeLabel: 'Rechnungen öffnen'
    },
    contracts: {
      title: 'Aktive Verträge', subtitle: 'Wiederkehrende Einnahmen',
      hero: formatNumber(stats.anzahlVertraege),
      rows: [
        { label: 'Monatlich', value: formatCurrency(stats.monatlicheEinnahmen) },
        { label: 'Quartal (×3)', value: formatCurrency(stats.quartalsEinnahmen) },
        { label: 'Jahr (×12)', value: formatCurrency(stats.jahresEinnahmen) },
        { label: 'Ø Beitrag pro Vertrag', value: stats.anzahlVertraege > 0 ? formatCurrency(stats.monatlicheEinnahmen / stats.anzahlVertraege) : '–' }
      ],
      route: '/dashboard/beitraege', routeLabel: 'Beiträge verwalten'
    },
    sales: {
      title: 'Verkäufe', subtitle: `${periodLabel} · ${periodRange}`,
      hero: formatNumber(stats.anzahlVerkaeufe),
      rows: [
        { label: 'Umsatz', value: formatCurrency(stats.verkaeufeEinnahmen) },
        { label: 'Ø pro Verkauf', value: formatCurrency(averageSale) },
        { label: 'davon Bar', value: formatCurrency(stats.barEinnahmen) },
        { label: 'davon Karte', value: formatCurrency(stats.kartenEinnahmen) }
      ],
      route: '/dashboard/tresen', routeLabel: 'Tresen / Verkäufe öffnen'
    },
    // ── Übersichts-Karten (Klick auf Karte → Detail) ──
    income: {
      title: 'Einnahmen-Übersicht', subtitle: 'Wiederkehrende & variable Umsätze',
      hero: formatCurrency(stats.monatlicheEinnahmen),
      rows: [
        { label: 'Monatlich', value: formatCurrency(stats.monatlicheEinnahmen) },
        { label: 'Quartal (×3)', value: formatCurrency(stats.quartalsEinnahmen) },
        { label: 'Jahr (×12)', value: formatCurrency(stats.jahresEinnahmen) },
        { label: 'Verkäufe (Periode)', value: formatCurrency(stats.verkaeufeEinnahmen) },
        { label: 'Rechnungen (bezahlt)', value: formatCurrency(stats.rechnungenEinnahmen) },
        { label: 'Trend vs. Vorperiode', value: `${stats.einnahmenTrend >= 0 ? '+' : ''}${(stats.einnahmenTrend ?? 0).toFixed(1)} %`, tone: stats.einnahmenTrend >= 0 ? 'positive' : 'negative' }
      ],
      route: '/dashboard/jahresuebersicht', routeLabel: 'Jahresübersicht öffnen'
    },
    payments: {
      title: 'Zahlungsarten', subtitle: 'Verteilung nach Einnahmen',
      hero: formatCurrency(
        (stats.barEinnahmen || 0) + (stats.kartenEinnahmen || 0) + (stats.lastschriftEinnahmen || 0) +
        (stats.ueberweisungEinnahmen || 0) + (stats.paypalEinnahmen || 0) + (stats.sonstigeEinnahmen || 0)
      ),
      rows: [
        { label: 'Lastschrift / SEPA', value: formatCurrency(stats.lastschriftEinnahmen) },
        { label: 'Bar', value: formatCurrency(stats.barEinnahmen) },
        { label: 'Karte', value: formatCurrency(stats.kartenEinnahmen) },
        { label: 'Überweisung', value: formatCurrency(stats.ueberweisungEinnahmen) },
        { label: 'PayPal', value: formatCurrency(stats.paypalEinnahmen) },
        { label: 'Sonstige', value: formatCurrency(stats.sonstigeEinnahmen) }
      ].filter(r => r.value !== formatCurrency(0)),
      route: '/dashboard/tresen', routeLabel: 'Verkäufe / Kasse öffnen'
    },
    'open-posten': {
      title: 'Offene Posten', subtitle: 'Forderungen & offene Beiträge',
      hero: formatCurrency(stats.offeneRechnungenBetrag),
      rows: [
        { label: 'Offener Betrag', value: formatCurrency(stats.offeneRechnungenBetrag), tone: stats.offeneRechnungenBetrag > 0 ? 'warning' : 'positive' },
        { label: 'Offene Rechnungen', value: formatNumber(stats.offeneRechnungen) },
        { label: 'Überfällige Rechnungen', value: formatNumber(stats.ueberfaelligeRechnungen), tone: stats.ueberfaelligeRechnungen > 0 ? 'negative' : 'positive' },
        { label: 'Mahnfähige Beiträge', value: `${formatNumber(stats.ausstehendeZahlungen)} · ${formatCurrency(stats.ausstehendeZahlungenBetrag)}`, tone: stats.ausstehendeZahlungen > 0 ? 'warning' : 'positive' }
      ],
      route: '/dashboard/rechnungen', routeLabel: 'Rechnungen öffnen'
    }
  } : {};

  if (memberStats) {
    kpiDetailDefs['avg-beitrag'] = {
      title: 'Ø Monatsbeitrag', subtitle: 'Über alle aktiven Verträge',
      hero: formatCurrency(memberStats.avgMonatsbeitrag),
      rows: [
        { label: 'Aktive Verträge', value: formatNumber(memberStats.totalVertraege) },
        { label: 'Monatsvolumen gesamt', value: formatCurrency((memberStats.avgMonatsbeitrag || 0) * (memberStats.totalVertraege || 0)) }
      ],
      route: '/dashboard/beitraege', routeLabel: 'Beiträge verwalten'
    };
    kpiDetailDefs['sepa-rate'] = {
      title: 'SEPA-Quote', subtitle: 'Anteil Lastschrift-Zahler',
      hero: `${memberStats.sepaRate} %`,
      rows: [
        { label: 'Mit SEPA-Mandat', value: formatNumber(memberStats.sepaCount), tone: 'positive' },
        { label: 'Ohne SEPA-Mandat', value: formatNumber((memberStats.totalVertraege || 0) - (memberStats.sepaCount || 0)), tone: 'warning' },
        { label: 'Verträge gesamt', value: formatNumber(memberStats.totalVertraege) }
      ],
      route: '/dashboard/mitglieder-filter/ohne-sepa', routeLabel: 'Mitglieder ohne SEPA anzeigen'
    };
    if (memberStats.inkassoQuote !== null) {
      kpiDetailDefs['inkasso'] = {
        title: 'Inkasso-Quote', subtitle: 'Bezahlte Rechnungen (ohne Stripe)',
        hero: `${memberStats.inkassoQuote} %`,
        rows: [
          { label: 'Bezahlt', value: formatNumber(memberStats.bezahltRechnungen), tone: 'positive' },
          { label: 'Offen', value: formatNumber((memberStats.totalRechnungen || 0) - (memberStats.bezahltRechnungen || 0)), tone: 'warning' },
          { label: 'Rechnungen gesamt', value: formatNumber(memberStats.totalRechnungen) }
        ],
        route: '/dashboard/rechnungen', routeLabel: 'Rechnungen öffnen'
      };
    }
    kpiDetailDefs['netto-wachstum'] = {
      title: 'Netto-Wachstum', subtitle: `${periodLabel} · ${periodRange}`,
      hero: `${memberStats.nettoWachstum > 0 ? '+' : ''}${memberStats.nettoWachstum}`,
      rows: [
        { label: 'Neue Verträge', value: `+${formatNumber(memberStats.neueMitglieder)}`, tone: 'positive' },
        { label: 'Beendete Verträge', value: `−${formatNumber(memberStats.verloreneMitglieder)}`, tone: 'negative' },
        { label: 'Netto', value: `${memberStats.nettoWachstum > 0 ? '+' : ''}${memberStats.nettoWachstum}`, tone: memberStats.nettoWachstum >= 0 ? 'positive' : 'negative' }
      ],
      route: '/dashboard/mitglieder', routeLabel: 'Mitglieder öffnen'
    };
  }

  const kpiCards = stats ? [
    {
      id: 'revenue',
      icon: TrendingUp,
      label: 'Gesamteinnahmen',
      value: formatCurrency(stats.gesamteinnahmen),
      detail: `${stats.einnahmenTrend > 0 ? '+' : ''}${(stats.einnahmenTrend ?? 0).toFixed(1)}% vs. Vorperiode`,
      tone: stats.einnahmenTrend >= 0 ? 'positive' : 'negative',
      route: '/dashboard/jahresuebersicht'
    },
    {
      id: 'expenses',
      icon: TrendingDown,
      label: 'Gesamtausgaben',
      value: formatCurrency(stats.gesamteAusgaben),
      detail: stats.ausgabenTrend !== 0
        ? `${stats.ausgabenTrend > 0 ? '+' : ''}${(stats.ausgabenTrend ?? 0).toFixed(1)}% vs. Vorperiode`
        : 'Trenddaten folgen',
      tone: stats.gesamteAusgaben > 0 ? 'warning' : 'neutral',
      route: '/dashboard/ausgaben'
    },
    {
      id: 'cashflow',
      icon: Wallet,
      label: 'Cashflow',
      value: formatCurrency(stats.cashflow),
      detail: `${stats.cashflowProzent > 0 ? '+' : ''}${(stats.cashflowProzent ?? 0).toFixed(1)}% Marge`,
      tone: stats.cashflow >= 0 ? 'positive' : 'negative',
      route: '/dashboard/euer'
    },
    {
      id: 'open-invoices',
      icon: FileText,
      label: 'Offene Rechnungen',
      value: formatNumber(stats.offeneRechnungen),
      detail: `${formatCurrency(stats.offeneRechnungenBetrag)} offen`,
      tone: stats.offeneRechnungen > 0 ? 'warning' : 'positive',
      route: '/dashboard/rechnungen'
    },
    {
      id: 'contracts',
      icon: Users,
      label: 'Aktive Verträge',
      value: formatNumber(stats.anzahlVertraege),
      detail: `${formatCurrency(stats.monatlicheEinnahmen)} pro Monat`,
      tone: 'neutral',
      route: '/dashboard/beitraege'
    },
    {
      id: 'sales',
      icon: Receipt,
      label: 'Verkäufe',
      value: formatNumber(stats.anzahlVerkaeufe),
      detail: `${formatCurrency(stats.verkaeufeEinnahmen)} Umsatz`,
      tone: 'neutral',
      route: '/dashboard/tresen'
    }
  ] : [];

  const insights = stats ? [
    {
      id: 'period',
      icon: Calendar,
      title: 'Auswertungszeitraum',
      description: `${formatDate(stats.dateStart)} – ${formatDate(stats.dateEnd)}`
    },
    {
      id: 'cashflow',
      icon: stats.cashflow >= 0 ? ArrowUpRight : ArrowDownRight,
      title: stats.cashflow >= 0 ? 'Positiver Cashflow' : 'Cashflow unter Null',
      description: stats.cashflow >= 0
        ? `Überschuss von ${formatCurrency(stats.cashflow)} nach Ausgaben`
        : `Defizit von ${formatCurrency(Math.abs(stats.cashflow))} nach Ausgaben`
    },
    {
      id: 'average-sale',
      icon: BarChart3,
      title: 'Ø Umsatz pro Verkauf',
      description: `${formatCurrency(averageSale)} bei ${formatNumber(stats.anzahlVerkaeufe)} Verkäufen`
    },
    {
      id: 'open-postings',
      icon: stats.offeneRechnungen > 0 ? AlertCircle : CheckCircle2,
      title: stats.offeneRechnungen > 0 ? 'Offene Forderungen' : 'Keine offenen Rechnungen',
      description: stats.offeneRechnungen > 0
        ? `${formatNumber(stats.offeneRechnungen)} Rechnungen über ${formatCurrency(stats.offeneRechnungenBetrag)}`
        : 'Alle Rechnungen sind beglichen'
    }
  ] : [];

  const incomeMetrics = stats ? [
    { label: 'Monatlich', value: formatCurrency(stats.monatlicheEinnahmen) },
    { label: 'Quartal', value: formatCurrency(stats.quartalsEinnahmen) },
    { label: 'Jahr', value: formatCurrency(stats.jahresEinnahmen) },
    {
      label: 'Trend',
      value: `${Math.abs((stats.einnahmenTrend ?? 0).toFixed(1))}%`,
      tone: stats.einnahmenTrend >= 0 ? 'positive' : 'negative',
      icon: stats.einnahmenTrend >= 0 ? ArrowUpRight : ArrowDownRight
    }
  ] : [];

  const paymentMetrics = stats ? [
    { label: 'Bar', value: formatCurrency(stats.barEinnahmen) },
    { label: 'Karte', value: formatCurrency(stats.kartenEinnahmen) },
    { label: 'Lastschrift', value: formatCurrency(stats.lastschriftEinnahmen) }
  ] : [];

  const dueMetrics = stats ? [
    {
      label: 'Offener Betrag',
      value: formatCurrency(stats.offeneRechnungenBetrag),
      tone: stats.offeneRechnungenBetrag > 0 ? 'warning' : 'positive',
      route: '/dashboard/rechnungen'
    },
    {
      label: 'Offene Rechnungen',
      value: formatNumber(stats.offeneRechnungen),
      tone: stats.offeneRechnungen > 0 ? 'warning' : 'positive',
      route: '/dashboard/rechnungen'
    },
    {
      label: 'Überfällig',
      value: stats.ueberfaelligeRechnungen > 0
        ? formatNumber(stats.ueberfaelligeRechnungen)
        : 'Keine',
      tone: stats.ueberfaelligeRechnungen > 0 ? 'negative' : 'positive',
      route: '/dashboard/rechnungen'
    },
    {
      label: 'Mahnfähige Beiträge',
      value: formatCurrency(stats.ausstehendeZahlungenBetrag),
      sublabel: `${formatNumber(stats.ausstehendeZahlungen)} Mahnfälle`,
      tone: stats.ausstehendeZahlungen > 0 ? 'warning' : 'positive',
      route: '/dashboard/mahnwesen'
    }
  ] : [];

  const activityMetrics = stats ? [
    {
      label: 'Zahlläufe',
      value: formatNumber(stats.anzahlZahllaeufe),
      sublabel: `${formatCurrency(stats.zahllaeufeEinnahmen)} abgeschlossen`,
      route: '/dashboard/lastschriftlauf'
    },
    {
      label: 'Zahlungen',
      value: formatNumber(stats.anzahlZahlungen),
      sublabel: formatCurrency(stats.zahlungenEinnahmen)
    },
    {
      label: 'Rechnungen (bezahlt)',
      value: formatCurrency(stats.rechnungenEinnahmen),
      route: '/dashboard/rechnungen'
    },
    {
      label: 'Ausgaben',
      value: formatCurrency(stats.gesamteAusgaben),
      sublabel: `${formatNumber(stats.anzahlAusgaben)} Buchungen`,
      route: '/dashboard/ausgaben'
    }
  ] : [];

  const memberKpiCards = memberStats ? [
    {
      id: 'avg-beitrag',
      icon: DollarSign,
      label: 'Ø Monatsbeitrag',
      value: formatCurrency(memberStats.avgMonatsbeitrag),
      detail: `${formatNumber(memberStats.totalVertraege)} aktive Verträge`,
      tone: 'neutral'
    },
    {
      id: 'sepa-rate',
      icon: CreditCard,
      label: 'SEPA-Quote',
      value: `${memberStats.sepaRate}\u202f%`,
      detail: `${formatNumber(memberStats.sepaCount)} von ${formatNumber(memberStats.totalVertraege)}`,
      tone: memberStats.sepaRate >= 70 ? 'positive' : memberStats.sepaRate >= 40 ? 'warning' : 'negative',
      progress: memberStats.sepaRate
    },
    memberStats.inkassoQuote !== null && {
      id: 'inkasso',
      icon: CheckCircle2,
      label: 'Inkasso-Quote',
      value: `${memberStats.inkassoQuote}\u202f%`,
      detail: `${formatNumber(memberStats.bezahltRechnungen)} / ${formatNumber(memberStats.totalRechnungen)} Rechnungen`,
      tone: memberStats.inkassoQuote >= 90 ? 'positive' : memberStats.inkassoQuote >= 70 ? 'warning' : 'negative',
      progress: memberStats.inkassoQuote
    },
    {
      id: 'netto-wachstum',
      icon: memberStats.nettoWachstum >= 0 ? TrendingUp : TrendingDown,
      label: 'Netto-Wachstum',
      value: `${memberStats.nettoWachstum > 0 ? '+' : ''}${memberStats.nettoWachstum}`,
      detail: `+${memberStats.neueMitglieder} neu · -${memberStats.verloreneMitglieder} beendet`,
      tone: memberStats.nettoWachstum > 0 ? 'positive' : memberStats.nettoWachstum < 0 ? 'negative' : 'neutral'
    }
  ].filter(Boolean) : [];

  // Zahlungsarten mit Prozentwerten für Progress-Bars
  const totalZahlungen = stats
    ? (stats.barEinnahmen || 0) + (stats.kartenEinnahmen || 0) + (stats.lastschriftEinnahmen || 0) +
      (stats.ueberweisungEinnahmen || 0) + (stats.paypalEinnahmen || 0) + (stats.sonstigeEinnahmen || 0)
    : 0;
  const PAYMENT_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#06b6d4', '#94a3b8'];
  const zahlungsartenRows = stats ? [
    { label: 'Lastschrift / SEPA', value: stats.lastschriftEinnahmen || 0, color: PAYMENT_COLORS[2] },
    { label: 'Bar', value: stats.barEinnahmen || 0, color: PAYMENT_COLORS[0] },
    { label: 'Karte', value: stats.kartenEinnahmen || 0, color: PAYMENT_COLORS[1] },
    { label: 'Überweisung', value: stats.ueberweisungEinnahmen || 0, color: PAYMENT_COLORS[3] },
    { label: 'PayPal', value: stats.paypalEinnahmen || 0, color: PAYMENT_COLORS[4] },
    { label: 'Sonstige', value: stats.sonstigeEinnahmen || 0, color: PAYMENT_COLORS[5] }
  ].filter(r => r.value > 0) : [];

  // Neue Insights aus memberStats
  const memberInsights = memberStats ? [
    memberStats.sepaRate < 50 && {
      id: 'sepa-low',
      icon: AlertCircle,
      tone: 'warning',
      title: 'SEPA-Quote unter 50\u202f%',
      description: `Nur ${memberStats.sepaRate}\u202f% zahlen per Lastschrift – Automatisierung empfohlen`
    },
    memberStats.sepaRate >= 80 && {
      id: 'sepa-high',
      icon: CheckCircle2,
      tone: 'positive',
      title: 'Hohe SEPA-Automatisierung',
      description: `${memberStats.sepaRate}\u202f% der Mitglieder zahlen per Lastschrift – sehr gut`
    },
    memberStats.inkassoQuote !== null && memberStats.inkassoQuote < 80 && {
      id: 'inkasso-low',
      icon: AlertTriangle,
      tone: 'negative',
      title: `Inkasso-Quote ${memberStats.inkassoQuote}\u202f%`,
      description: `${memberStats.bezahltRechnungen} von ${memberStats.totalRechnungen} Rechnungen beglichen (ohne Stripe)`
    },
    memberStats.nettoWachstum > 0 && {
      id: 'growth',
      icon: TrendingUp,
      tone: 'positive',
      title: `+${memberStats.nettoWachstum} Verträge netto`,
      description: `${memberStats.neueMitglieder} neue, ${memberStats.verloreneMitglieder} beendete Verträge in diesem Zeitraum`
    },
    memberStats.nettoWachstum < 0 && {
      id: 'churn',
      icon: TrendingDown,
      tone: 'negative',
      title: `${memberStats.nettoWachstum} Verträge netto`,
      description: `${memberStats.verloreneMitglieder} beendet, nur ${memberStats.neueMitglieder} neue Verträge`
    }
  ].filter(Boolean) : [];

  const ActionCard = ({ icon: Icon, label, desc, iconColor, onClick, badge }) => (
    <button className="fc__action-card" onClick={onClick}>
      <span className="fc__action-card-icon" style={{ '--icon-color': iconColor || 'var(--primary)' }}>
        <Icon size={20} />
      </span>
      <span className="fc__action-card-text">
        <span className="fc__action-card-label">{label}</span>
        {desc && <span className="fc__action-card-desc">{desc}</span>}
      </span>
      {badge > 0 && <span className="fc__action-badge">{badge}</span>}
      <ChevronRight size={14} className="fc__action-card-arrow" />
    </button>
  );

  if (loading) {
    return (
      <div className="finanzcockpit">
        <div className="finanzcockpit-card finanzcockpit__state">
          <div className="finanzcockpit__spinner" />
          <p>Finanzdaten werden geladen…</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="finanzcockpit">
        <div className="finanzcockpit-card finanzcockpit__state is-error">
          <AlertCircle size={48} />
          <h3>Fehler beim Laden der Daten</h3>
          <p>Bitte versuchen Sie es später erneut.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`finanzcockpit${embed ? ' finanzcockpit--embed' : ''}`}>
      {embed && (
        <div className="fc__embed-toolbar">
          <div className="finanzcockpit__period-selector">
            <button className={selectedPeriod === 'week' ? 'is-active' : ''} onClick={() => setSelectedPeriod('week')}>Woche</button>
            <button className={selectedPeriod === 'month' ? 'is-active' : ''} onClick={() => setSelectedPeriod('month')}>Monat</button>
            <button className={selectedPeriod === 'quarter' ? 'is-active' : ''} onClick={() => setSelectedPeriod('quarter')}>Quartal</button>
            <button className={selectedPeriod === 'year' ? 'is-active' : ''} onClick={() => setSelectedPeriod('year')}>Jahr</button>
          </div>
          <span className="fc__embed-period-info">
            <Calendar size={14} /> {formatDate(stats.dateStart)} – {formatDate(stats.dateEnd)}
          </span>
        </div>
      )}
      {!embed && (
      <header className="finanzcockpit-card finanzcockpit__header">
        <div className="finanzcockpit__header-top">
          <div className="finanzcockpit__headline">
            <span className="finanzcockpit__eyebrow">Finanzen</span>
            <div className="finanzcockpit__title-row">
              <h1 className="finanzcockpit__title">Finanzcockpit</h1>
              <span className="finanzcockpit__badge">{periodLabel}</span>
            </div>
            <p className="finanzcockpit__subtitle">
              Alle Kennzahlen und Bewegungen auf einen Blick – inklusive Cashflow, offenen Posten und Zahlungsarten.
            </p>
          </div>
          <div className="finanzcockpit__controls">
            {/* Dojo-Selektor */}
            {dojos && dojos.length > 1 && (
              <div className="finanzcockpit__dojo-selector">
                <Building2 size={14} />
                <select
                  value={selectedDojoId}
                  onChange={(e) => handleDojoChange(e.target.value)}
                  className="finanzcockpit__dojo-select"
                >
                  <option value="all">Alle Standorte</option>
                  {dojos.map(dojo => (
                    <option key={dojo.id} value={dojo.id}>
                      {dojo.dojoname}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="finanzcockpit__period-selector">
              <button
                className={selectedPeriod === 'week' ? 'is-active' : ''}
                onClick={() => setSelectedPeriod('week')}
              >
                Woche
              </button>
              <button
                className={selectedPeriod === 'month' ? 'is-active' : ''}
                onClick={() => setSelectedPeriod('month')}
              >
                Monat
              </button>
              <button
                className={selectedPeriod === 'quarter' ? 'is-active' : ''}
                onClick={() => setSelectedPeriod('quarter')}
              >
                Quartal
              </button>
              <button
                className={selectedPeriod === 'year' ? 'is-active' : ''}
                onClick={() => setSelectedPeriod('year')}
              >
                Jahr
              </button>
            </div>
            <div className="finanzcockpit__period-info">
              <Calendar size={16} />
              <span>{formatDate(stats.dateStart)} – {formatDate(stats.dateEnd)}</span>
            </div>
          </div>
        </div>
      </header>
      )}

      <section className="finanzcockpit__kpi-grid">
        {kpiCards.map(({ id, icon: Icon, label, value, detail, tone }) => (
          <div
            key={id}
            className={`finanzcockpit-card finanzcockpit__kpi-card finanzcockpit__kpi-card--${tone} finanzcockpit__kpi-card--clickable`}
            onClick={() => setOpenKpi(id)}
            title={`${label} – Details anzeigen`}
          >
            <div className="finanzcockpit__kpi-meta">
              <div className="finanzcockpit__kpi-icon">
                <Icon size={18} />
              </div>
              <span className="finanzcockpit__kpi-label">{label}</span>
              <ChevronRight size={13} className="finanzcockpit__kpi-arrow" />
            </div>
            <div className="finanzcockpit__kpi-value">{value}</div>
            <span className="finanzcockpit__kpi-detail">{detail}</span>
          </div>
        ))}
      </section>

      {memberKpiCards.length > 0 && (
        <section>
          <p className="finanzcockpit__member-section-label">Mitglieder-Kennzahlen</p>
          <div className="finanzcockpit__member-kpi-grid">
            {memberKpiCards.map(({ id, icon: Icon, label, value, detail, tone, progress }) => (
              <div
                key={id}
                className={`finanzcockpit-card finanzcockpit__kpi-card finanzcockpit__kpi-card--mini finanzcockpit__kpi-card--${tone}${kpiDetailDefs[id] ? ' finanzcockpit__kpi-card--clickable' : ''}`}
                onClick={() => kpiDetailDefs[id] && setOpenKpi(id)}
                title={kpiDetailDefs[id] ? `${label} – Details anzeigen` : undefined}
              >
                <div className="finanzcockpit__kpi-meta">
                  <div className="finanzcockpit__kpi-icon"><Icon size={16} /></div>
                  <span className="finanzcockpit__kpi-label">{label}</span>
                  {kpiDetailDefs[id] && <ChevronRight size={12} className="finanzcockpit__kpi-arrow" />}
                </div>
                <div className="finanzcockpit__kpi-value">{value}</div>
                <span className="finanzcockpit__kpi-detail">{detail}</span>
                {progress !== undefined && (
                  <div className="fc__progress-wrap">
                    <div className={`fc__progress-bar fc__progress-bar--${tone}`} style={{ width: `${Math.min(progress, 100)}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {alerts.ruecklastschriften > 0 && (
        <section className="fc__alerts">
          <div className="fc__alert-card fc__alert-card--error" onClick={() => navigate('/dashboard/ruecklastschriften')}>
            <AlertTriangle size={16} />
            <span className="fc__alert-count">{alerts.ruecklastschriften}</span>
            <span className="fc__alert-label">offene Rücklastschrift{alerts.ruecklastschriften !== 1 ? 'en' : ''} – sofortige Bearbeitung empfohlen</span>
            <ChevronRight size={13} className="fc__alert-arrow" />
          </div>
        </section>
      )}

      {/* ══ ÜBERSICHT: Kennzahlen-Karten + Insights ══ */}
      <section className="finanzcockpit__details">
        <div className="finanzcockpit-card finanzcockpit__detail-card finanzcockpit__detail-card--clickable" onClick={() => setOpenKpi('income')}>
          <div className="finanzcockpit__detail-header">
            <TrendingUp size={16} />
            <div>
              <h3>Einnahmen-Übersicht</h3>
              <p>Regelmäßige und variable Umsätze</p>
            </div>
            <ChevronRight size={14} className="finanzcockpit__detail-arrow" />
          </div>
          <div className="finanzcockpit__metrics-list">
            {incomeMetrics.map(metric => {
              const MetricIcon = metric.icon;
              return (
                <div key={metric.label} className="finanzcockpit__metric-row">
                  <span className="finanzcockpit__metric-label">{metric.label}</span>
                  <span className={`finanzcockpit__metric-value ${metric.tone ? `is-${metric.tone}` : ''}`}>
                    {MetricIcon && <MetricIcon size={13} />}{metric.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="finanzcockpit-card finanzcockpit__detail-card finanzcockpit__detail-card--clickable" onClick={() => setOpenKpi('payments')}>
          <div className="finanzcockpit__detail-header">
            <PieChartIcon size={16} />
            <div>
              <h3>Zahlungsarten</h3>
              <p>Verteilung nach Einnahmen</p>
            </div>
            <ChevronRight size={14} className="finanzcockpit__detail-arrow" />
          </div>
          <div>
            {zahlungsartenRows.length > 0 ? zahlungsartenRows.map(row => {
              const pct = totalZahlungen > 0 ? Math.round((row.value / totalZahlungen) * 100) : 0;
              return (
                <div key={row.label} className="fc__payment-row">
                  <div className="fc__payment-row-header">
                    <div className="fc__payment-row-left">
                      <div className="fc__payment-dot" style={{ background: row.color }} />
                      <span className="fc__payment-row-label">{row.label}</span>
                    </div>
                    <div className="fc__payment-row-right">
                      <span className="fc__payment-row-pct">{`${pct}\u202f%`}</span>
                      <span className="fc__payment-row-value">{formatCurrency(row.value)}</span>
                    </div>
                  </div>
                  <div className="fc__progress-wrap">
                    <div className="fc__progress-bar" style={{ width: `${pct}%`, background: row.color }} />
                  </div>
                </div>
              );
            }) : <p className="fc__no-data">Keine Daten im gewählten Zeitraum</p>}
          </div>
        </div>

        <div className="finanzcockpit-card finanzcockpit__detail-card finanzcockpit__detail-card--clickable" onClick={() => setOpenKpi('open-posten')}>
          <div className="finanzcockpit__detail-header">
            <FileText size={16} />
            <div>
              <h3>Offene Posten</h3>
              <p>Forderungen und offene Beiträge</p>
            </div>
            <ChevronRight size={14} className="finanzcockpit__detail-arrow" />
          </div>
          <div className="finanzcockpit__metrics-list">
            {dueMetrics.map(metric => (
              <div
                key={metric.label}
                className={`finanzcockpit__metric-row${metric.route ? ' finanzcockpit__metric-row--clickable' : ''}`}
                onClick={metric.route ? (e) => { e.stopPropagation(); navigate(metric.route); } : undefined}
              >
                <span className="finanzcockpit__metric-label">{metric.label}</span>
                <span className={`finanzcockpit__metric-value ${metric.tone ? `is-${metric.tone}` : ''}`}>
                  {metric.value}
                  {metric.sublabel && <small>{metric.sublabel}</small>}
                </span>
                {metric.route && <ChevronRight size={12} className="fc__metric-row-arrow" />}
              </div>
            ))}
          </div>
        </div>

        <div className="finanzcockpit-card finanzcockpit__detail-card">
          <div className="finanzcockpit__detail-header">
            <BarChart3 size={16} />
            <div>
              <h3>Aktivität</h3>
              <p>Operative Kennzahlen der Periode</p>
            </div>
          </div>
          <div className="finanzcockpit__metrics-list">
            {activityMetrics.map(metric => (
              <div
                key={metric.label}
                className={`finanzcockpit__metric-row${metric.route ? ' finanzcockpit__metric-row--clickable' : ''}`}
                onClick={metric.route ? () => navigate(metric.route) : undefined}
              >
                <span className="finanzcockpit__metric-label">{metric.label}</span>
                <span className="finanzcockpit__metric-value">
                  {metric.value}
                  {metric.sublabel && <small>{metric.sublabel}</small>}
                </span>
                {metric.route && <ChevronRight size={12} className="fc__metric-row-arrow" />}
              </div>
            ))}
          </div>
        </div>

        {tarifData.length > 0 && (
          <div className="finanzcockpit-card finanzcockpit__detail-card">
            <div className="finanzcockpit__detail-header">
              <Users size={16} />
              <div>
                <h3>Top-Tarife</h3>
                <p>Umsatz nach Mitgliedschaftsart</p>
              </div>
            </div>
            {(() => {
              const maxVal = Math.max(...tarifData.map(t => t.value), 1);
              return (
                <div className="fc__tarif-list">
                  {tarifData.slice(0, 5).map((tarif, idx) => (
                    <div key={tarif.name} className="fc__tarif-item">
                      <div className="fc__tarif-header">
                        <div className="fc__tarif-name">
                          <span className="fc__tarif-rank">{idx + 1}</span>
                          <span className="fc__tarif-name-text">{tarif.name}</span>
                        </div>
                        <span className="fc__tarif-stats">{formatCurrency(tarif.value)} · {tarif.count}×</span>
                      </div>
                      <div className="fc__tarif-bar-wrap">
                        <div className="fc__tarif-bar" style={{ width: `${Math.round((tarif.value / maxVal) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        <div className="finanzcockpit-card finanzcockpit__insights">
          <div className="finanzcockpit__card-header">
            <div>
              <span className="finanzcockpit__card-eyebrow">Insights</span>
              <h3>Einschätzungen</h3>
            </div>
          </div>
          <ul className="finanzcockpit__insight-list">
            {[...insights, ...memberInsights].map(({ id, icon: Icon, title, description, tone }) => (
              <li key={id}>
                <div className={`finanzcockpit__insight-icon${tone ? ` finanzcockpit__insight-icon--${tone}` : ''}`}><Icon size={13} /></div>
                <div>
                  <p className="finanzcockpit__insight-title">{title}</p>
                  <p className="finanzcockpit__insight-description">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ══ AKTIONEN: Schnellzugriffe (horizontal) ══ */}
      <div className="fc__actions-bar">
        <div className="fc__action-group">
          <h3 className="fc__action-group-title">Abrechnung</h3>
          <div className="fc__action-list">
            <ActionCard icon={CreditCard} label="Lastschriftlauf" desc="SEPA-Einzüge starten" iconColor="#3b82f6" onClick={() => navigate('/dashboard/lastschriftlauf')} />
            <ActionCard icon={AlertCircle} label="Mahnwesen" desc="Überfällige Zahlungen" iconColor="#f59e0b" onClick={() => navigate('/dashboard/mahnwesen')} badge={stats?.ausstehendeZahlungen || 0} />
            <ActionCard icon={RotateCcw} label="Rücklastschriften" desc="Fehlgeschlagene Abbuchungen" iconColor="#ef4444" onClick={() => navigate('/dashboard/ruecklastschriften')} badge={alerts.ruecklastschriften} />
            <ActionCard icon={DollarSign} label="Beiträge verwalten" desc="Verträge und Tarife" iconColor="#10b981" onClick={() => navigate('/dashboard/beitraege')} />
            <ActionCard icon={Upload} label="Kontoauszug importieren" desc="CSV / MT940 importieren" iconColor="#f97316" onClick={() => navigate('/dashboard/kontoauszug-import')} />
          </div>
        </div>

        <div className="fc__action-group">
          <h3 className="fc__action-group-title">Mitglieder-Analysen</h3>
          <div className="fc__action-list">
            <ActionCard icon={AlertCircle} label="Ohne SEPA-Mandat" desc="Mitglieder ohne Einzugsermächtigung" iconColor="#ef4444" onClick={() => navigate('/dashboard/mitglieder-filter/ohne-sepa')} />
            <ActionCard icon={FileText} label="Ohne Vertrag" desc="Mitglieder ohne aktiven Vertrag" iconColor="#f59e0b" onClick={() => navigate('/dashboard/mitglieder-filter/ohne-vertrag')} />
            <ActionCard icon={AlertTriangle} label="Tarif-Abweichungen" desc="Soll/Ist-Vergleich der Beiträge" iconColor="#8b5cf6" onClick={() => navigate('/dashboard/mitglieder-filter/tarif-abweichung')} />
            <ActionCard icon={CreditCard} label="Nach Zahlungsweise" desc="Gruppiert nach Bar / Karte / SEPA" iconColor="#3b82f6" onClick={() => navigate('/dashboard/mitglieder-filter/zahlungsweisen')} />
          </div>
        </div>

        <div className="fc__action-group">
          <h3 className="fc__action-group-title">Dokumente & Export</h3>
          <div className="fc__action-list">
            <ActionCard icon={FileSpreadsheet} label="Dokument-Vorlagen" desc="Briefe und E-Mails verwalten" iconColor="#8B0000" onClick={() => navigate('/dashboard/vorlagen')} />
          </div>
        </div>
      </div>

      {/* ══ GRAFIKEN: gleich groß, sauber nebeneinander ══ */}
      <section className="fc__charts-grid">
        <div className="finanzcockpit-card">
          <div className="finanzcockpit__card-header">
            <div>
              <span className="finanzcockpit__card-eyebrow">Performance</span>
              <h3>Umsatz-Entwicklung</h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" stroke="rgba(255,255,255,0.5)" />
              <YAxis stroke="rgba(255,255,255,0.5)" tickFormatter={formatCurrencyCompact} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--modal-bg-dark)', border: '1px solid var(--border-accent)', borderRadius: '12px', color: 'var(--text-1)' }} formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Line type="monotone" dataKey="umsatz" stroke="#ffd700" strokeWidth={2} name="Umsatz" dot={{ fill: '#ffd700', r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="trend" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" name="Trend" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="finanzcockpit-card">
          <div className="finanzcockpit__card-header">
            <div>
              <span className="finanzcockpit__card-eyebrow">Aufschlüsselung</span>
              <h3>{aktiverChartTab === 'zahlungsarten' ? 'Zahlungsarten' : 'Einnahmen'}</h3>
            </div>
            <div className="fc__chart-tabs">
              <button className={aktiverChartTab === 'zahlungsarten' ? 'is-active' : ''} onClick={() => setAktiverChartTab('zahlungsarten')}>
                <PieChartIcon size={13} /> Zahlungsarten
              </button>
              <button className={aktiverChartTab === 'einnahmen' ? 'is-active' : ''} onClick={() => setAktiverChartTab('einnahmen')}>
                <BarChart3 size={13} /> Aufschlüsselung
              </button>
            </div>
          </div>
          {aktiverChartTab === 'zahlungsarten' && paymentMethodData.length > 0 && (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={paymentMethodData} cx="50%" cy="50%" labelLine={false} label={({ percent }) => percent >= 0.08 ? `${(percent * 100).toFixed(0)}%` : ''} innerRadius={55} outerRadius={92} paddingAngle={2} dataKey="value">
                  {paymentMethodData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--modal-bg-dark)', border: '1px solid var(--border-accent)', borderRadius: '12px', color: 'var(--text-1)' }} formatter={(value) => formatCurrency(value)} />
                <Legend verticalAlign="bottom" height={24} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.72rem' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          {aktiverChartTab === 'zahlungsarten' && paymentMethodData.length === 0 && (
            <p className="fc__no-data">Keine Daten im gewählten Zeitraum</p>
          )}
          {aktiverChartTab === 'einnahmen' && incomeBreakdownData.length > 0 && (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={incomeBreakdownData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" tickFormatter={formatCurrencyCompact} />
                <Tooltip content={<CustomIncomeTooltip />} />
                <Bar dataKey="value" fill="#ffd700" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {aktiverChartTab === 'einnahmen' && incomeBreakdownData.length === 0 && (
            <p className="fc__no-data">Keine Daten im gewählten Zeitraum</p>
          )}
        </div>
      </section>

      {/* ══ KPI-DETAIL-MODAL (Portal an body → immer im Viewport zentriert) ══ */}
      {openKpi && kpiDetailDefs[openKpi] && createPortal(
        <div className="fc__modal-overlay" onClick={() => setOpenKpi(null)}>
          <div className="fc__modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="fc__modal-close" onClick={() => setOpenKpi(null)} aria-label="Schließen">×</button>
            <div className="fc__modal-head">
              <span className="fc__modal-eyebrow">{kpiDetailDefs[openKpi].subtitle}</span>
              <h3 className="fc__modal-title">{kpiDetailDefs[openKpi].title}</h3>
              <div className="fc__modal-hero">{kpiDetailDefs[openKpi].hero}</div>
            </div>
            <div className="fc__modal-rows">
              {kpiDetailDefs[openKpi].rows.map((r) => (
                <div key={r.label} className="fc__modal-row">
                  <span className="fc__modal-row-label">{r.label}</span>
                  <span className={`fc__modal-row-value${r.tone ? ` is-${r.tone}` : ''}`}>{r.value}</span>
                </div>
              ))}
            </div>
            {kpiDetailDefs[openKpi].route && (
              <button
                className="fc__modal-cta"
                onClick={() => { const r = kpiDetailDefs[openKpi].route; setOpenKpi(null); navigate(r); }}
              >
                {kpiDetailDefs[openKpi].routeLabel || 'Öffnen'} <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Finanzcockpit;
