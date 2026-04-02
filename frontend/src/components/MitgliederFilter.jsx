import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  AlertCircle,
  FileText,
  CreditCard,
  Users,
  Download,
  Mail,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Edit,
  Check,
  X,
  Package,
  Zap
} from "lucide-react";
import { useDojoContext } from '../context/DojoContext.jsx';
import config from "../config/config";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/MitgliederFilter.css";
import "../styles/Auswertungen.css";
import { fetchWithAuth } from '../utils/fetchWithAuth';


const GRUND_TEXTE = {
  tarife: {
    label: 'Anpassung an aktuelle Tarife',
    kurz: 'Tarifanpassung',
    text: 'In den vergangenen Jahren haben wir unsere Beiträge trotz steigender Kosten stabil gehalten. Die aktuelle Anpassung dient der nachhaltigen Sicherung unseres Trainingsbetriebs sowie der kontinuierlichen Weiterentwicklung unserer Angebote.\n\nSelbstverständlich bleiben alle bestehenden Leistungen unverändert bestehen.\n\nWir danken Ihnen herzlich für Ihr Vertrauen und Ihre Treue.'
  },
  nebenkosten: {
    label: 'Gestiegene Betriebskosten',
    kurz: 'Energie & Miete',
    text: 'Die Kosten für Energie, Heizung, Strom sowie Miete sind in den letzten Jahren deutlich gestiegen. Diese Entwicklungen betreffen auch unseren Trainingsbetrieb unmittelbar.\n\nUm weiterhin sichere, beheizte und professionell ausgestattete Trainingsräume anbieten zu können, haben wir die Erhöhung so gering wie möglich gehalten.\n\nWir danken Ihnen für Ihr Verständnis.'
  },
  inflation: {
    label: 'Allgemeine Preis- und Lohnentwicklung',
    kurz: 'Inflation & Löhne',
    text: 'Die allgemeine Preisentwicklung sowie gestiegene Lohn- und Personalkosten machen eine Anpassung unserer Mitgliedsbeiträge erforderlich.\n\nUnser Ziel ist es, weiterhin qualifiziertes Training auf hohem Niveau anzubieten und faire Rahmenbedingungen für unsere Trainer sicherzustellen.\n\nVielen Dank für Ihr Vertrauen und Ihre Unterstützung.'
  },
  investitionen: {
    label: 'Investitionen in Angebot & Ausstattung',
    kurz: 'Investitionen',
    text: 'Um unser Trainingsangebot weiter zu verbessern, haben wir in neue Ausstattung, Trainingsmaterialien und strukturelle Verbesserungen investiert.\n\nDiese Maßnahmen dienen Ihrer Trainingsqualität, Sicherheit und Weiterentwicklung.\n\nWir danken Ihnen für Ihre Unterstützung und Ihr Vertrauen.'
  },
  mehrere: {
    label: 'Mehrere Faktoren (kombiniert)',
    kurz: 'Kombiniert',
    text: 'In den vergangenen Jahren sind sowohl Energie- und Mietkosten als auch allgemeine Betriebskosten deutlich gestiegen. Gleichzeitig investieren wir kontinuierlich in Qualität, Sicherheit und Trainingsangebote.\n\nUm den Trainingsbetrieb langfristig aufrechtzuerhalten und unser Niveau weiterzuentwickeln, haben wir die Erhöhung bewusst so gering wie möglich gehalten.\n\nUns ist wichtig zu betonen: Diese Entscheidung ist uns nicht leicht gefallen. Wir danken Ihnen herzlich für Ihr Vertrauen und Ihre Treue.'
  },
  persoenlich: {
    label: 'Persönlich & familiär',
    kurz: 'Persönlich',
    text: 'Als Teil unserer Dojo-Familie ist uns Offenheit besonders wichtig. Deshalb möchten wir dich persönlich darüber informieren.\n\nIn den letzten Jahren sind viele Kosten im Hintergrund gestiegen – von Energie über Miete bis hin zu Trainingsmaterial und Organisation. Gleichzeitig investieren wir viel Zeit und Herzblut in die Qualität unseres Unterrichts.\n\nWir haben lange gerechnet und bewusst versucht, die Anpassung so moderat wie möglich zu halten.\n\nUnser Ziel bleibt unverändert: Ein starkes, sicheres und wertvolles Training für Kinder, Jugendliche und Erwachsene – mit Respekt, Disziplin und Gemeinschaft.\n\nDanke, dass du Teil unseres Weges bist.'
  },
  dojo: {
    label: 'Dojo-Qualität & Identität',
    kurz: 'Dojo-Stil',
    text: 'Unser Anspruch war und ist es, mehr als „nur Training" anzubieten. Wir stehen für Qualität, Disziplin, Charakterbildung und sportliche Exzellenz.\n\nUm diesen Standard dauerhaft aufrechtzuerhalten, investieren wir kontinuierlich in:\n- qualifiziertes und erfahrenes Trainerteam\n- moderne Trainingsausstattung\n- sichere Trainingsumgebung\n- Weiterbildungen und organisatorische Struktur\n\nGleichzeitig sind die laufenden Kosten für Energie, Miete und Organisation spürbar gestiegen.\n\nDiese Entscheidung ist eine Investition in Stabilität, Qualität und Zukunft – damit wir weiterhin ein Umfeld bieten können, in dem Kinder wachsen, Jugendliche Selbstvertrauen entwickeln und Erwachsene ihre sportlichen Ziele erreichen.\n\nWir danken dir für dein Vertrauen und deine Unterstützung.'
  },
  schrittweise: {
    label: 'Schrittweise Erhöhung',
    kurz: 'In Schritten',
    text: 'Um die finanzielle Belastung für unsere Mitglieder so gering wie möglich zu halten, findet diese Anpassung nicht auf einmal, sondern in mehreren Schritten statt. Wir sind überzeugt, dass dies der fairste Weg ist, notwendige Anpassungen umzusetzen – ohne dass der volle Betrag auf einmal anfällt.'
  },
  eigene: {
    label: 'Eigene Begründung',
    kurz: 'Individuell',
    text: ''
  }
};

const MitgliederFilter = () => {
  const { filterType } = useParams();
  const navigate = useNavigate();
  const { getDojoFilterParam, activeDojo } = useDojoContext();
  const [loading, setLoading] = useState(true);
  const [mitglieder, setMitglieder] = useState([]);
  const [statistik, setStatistik] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('all');
  const [editingMitglied, setEditingMitglied] = useState(null);
  const [newBeitrag, setNewBeitrag] = useState('');
  const [massenModal, setMassenModal] = useState(false);
  const [massenStep, setMassenStep] = useState(1);
  const [massenOrgTyp, setMassenOrgTyp] = useState('kommerziell');
  const [massenTyp, setMassenTyp] = useState('absolut'); // 'absolut' | 'prozent' | 'kombination'
  const [massenErhoehung, setMassenErhoehung] = useState('');
  const [massenProzent, setMassenProzent] = useState('');
  const [massenDatum, setMassenDatum] = useState('');
  const [massenVorlage, setMassenVorlage] = useState('freundlich');
  const [massenLoading, setMassenLoading] = useState(false);
  const [massenResult, setMassenResult] = useState(null);
  const [massenAngewendet, setMassenAngewendet] = useState(false);
  const [koennte5Prozent, setKoennte5Prozent] = useState(false);
  const [kuendigungKopiert, setKuendigungKopiert] = useState(false);
  const [massenGrund, setMassenGrund] = useState([]); // Array für Multi-Select
  const [massenGrundCustom, setMassenGrundCustom] = useState('');
  const [schritte, setSchritte] = useState([{ datum: '', betrag: '' }, { datum: '', betrag: '' }]);
  const [vorschauData, setVorschauData] = useState(null);
  const [vorschauLoading, setVorschauLoading] = useState(false);
  const [ausgeschlossen, setAusgeschlossen] = useState(new Set());
  const [massenSendPush, setMassenSendPush] = useState(true);
  const [terminiertResult, setTerminiertResult] = useState(null);
  const [testMailLoading, setTestMailLoading] = useState(false);
  const [testMailSent, setTestMailSent] = useState(false);
  const [verfuegbareTarife, setVerfuegbareTarife] = useState([]);
  const [migrationMap, setMigrationMap] = useState({}); // {vertrag_id: neuer_tarif_id}
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);
  const [showMigrationPanel, setShowMigrationPanel] = useState(false);

  useEffect(() => {
    loadFilteredMembers();
  }, [filterType, activeDojo, selectedPaymentMethod]);

  const loadFilteredMembers = async () => {
    try {
      setLoading(true);
      const dojoFilterParam = getDojoFilterParam();
      const separator = dojoFilterParam ? '&' : '';

      let endpoint = '';
      switch (filterType) {
        case 'ohne-sepa':
          endpoint = `/mitglieder/filter/ohne-sepa?${dojoFilterParam}`;
          break;
        case 'ohne-vertrag':
          endpoint = `/mitglieder/filter/ohne-vertrag?${dojoFilterParam}`;
          break;
        case 'tarif-abweichung':
          endpoint = `/mitglieder/filter/tarif-abweichung?${dojoFilterParam}`;
          break;
        case 'zahlungsweisen':
          endpoint = `/mitglieder/filter/zahlungsweisen?payment_method=${selectedPaymentMethod}${separator}${dojoFilterParam}`;
          break;
        default:
          endpoint = `/mitglieder?${dojoFilterParam}`;
      }

      const response = await fetchWithAuth(`${config.apiBaseUrl}${endpoint}`);

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Mitglieder');
      }

      const data = await response.json();
      setMitglieder(data.data || data.mitglieder || []);
      setStatistik(data.statistik || null);
      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der Mitglieder:', error);
      setMitglieder([]);
      setLoading(false);
    }
  };

  const getFilterTitle = () => {
    switch (filterType) {
      case 'ohne-sepa':
        return '🚫 Mitglieder ohne SEPA-Mandat';
      case 'ohne-vertrag':
        return '📄 Mitglieder ohne Vertrag';
      case 'tarif-abweichung':
        return '⚠️ Mitglieder mit Tarif-Abweichungen';
      case 'zahlungsweisen':
        return '💳 Mitglieder nach Zahlungsweise';
      default:
        return '👥 Mitglieder';
    }
  };

  const getFilterDescription = () => {
    switch (filterType) {
      case 'ohne-sepa':
        return 'Diese Mitglieder haben Lastschrift als Zahlungsmethode, aber kein aktives SEPA-Mandat hinterlegt.';
      case 'ohne-vertrag':
        return 'Diese Mitglieder haben aktuell keinen aktiven Vertrag.';
      case 'tarif-abweichung':
        return 'Diese Mitglieder zahlen einen abweichenden Beitrag vom Standard-Tarif.';
      case 'zahlungsweisen':
        return 'Mitglieder gefiltert nach ihrer Zahlungsmethode.';
      default:
        return '';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  };

  const buildSchrittweisenText = (schritteArr) => {
    const valid = (schritteArr || []).filter(s => s.datum && s.betrag);
    if (valid.length === 0) return GRUND_TEXTE.schrittweise.text;
    const fmtDate = (d) => { const [y, m, day] = d.split('-'); return `${day}.${m}.${y}`; };
    const fmtEur = (v) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(parseFloat(v));
    const stepsText = valid.map(s => `• Ab ${fmtDate(s.datum)}`).join('\n');
    return `Um die finanzielle Belastung für unsere Mitglieder so gering wie möglich zu halten, findet diese Anpassung nicht auf einmal, sondern in mehreren Schritten statt:\n\n${stepsText}\n\nWir sind überzeugt, dass dies der fairste Weg ist, notwendige Anpassungen umzusetzen – ohne dass der volle Betrag auf einmal anfällt.`;
  };

  const getAbweichungsStatistik = () => {
    if (filterType !== 'tarif-abweichung') return null;
    // Verwende Backend-Statistik wenn vorhanden, sonst fallback auf Frontend-Berechnung
    if (statistik) return statistik;

    // Fallback: Frontend-Berechnung (für Abwärtskompatibilität)
    if (mitglieder.length === 0) return null;
    const zuViel = mitglieder.filter(m => !m.ist_archiviert && m.differenz > 0);
    const zuWenig = mitglieder.filter(m => !m.ist_archiviert && m.differenz < 0);
    const archiviert = mitglieder.filter(m => m.ist_archiviert);
    const gesamtDifferenz = zuViel.reduce((sum, m) => sum + m.differenz, 0) + zuWenig.reduce((sum, m) => sum + m.differenz, 0);

    return {
      gesamt: mitglieder.length,
      archivierterTarif: archiviert.length,
      zuViel: zuViel.length,
      zuWenig: zuWenig.length,
      keinTarif: mitglieder.filter(m => !m.tarif_id).length,
      summeArchiviert: archiviert.reduce((sum, m) => sum + parseFloat(m.monatsbeitrag || 0), 0),
      summeZuViel: zuViel.reduce((sum, m) => sum + m.differenz, 0),
      summeZuWenig: Math.abs(zuWenig.reduce((sum, m) => sum + m.differenz, 0))
    };
  };

  const updateBeitrag = async (mitgliedId) => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${mitgliedId}/beitrag`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monatsbeitrag: parseFloat(newBeitrag) })
      });

      if (!response.ok) throw new Error('Fehler beim Aktualisieren');

      // Reload members
      await loadFilteredMembers();
      setEditingMitglied(null);
      setNewBeitrag('');
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      alert('Fehler beim Aktualisieren des Beitrags');
    }
  };

  const setSollbeitrag = async (mitglied) => {
    try {
      const sollBeitrag = mitglied.soll_beitrag || mitglied.tarif_betrag;
      const response = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${mitglied.mitglied_id}/beitrag`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monatsbeitrag: sollBeitrag })
      });

      if (!response.ok) throw new Error('Fehler beim Aktualisieren');

      await loadFilteredMembers();
    } catch (error) {
      console.error('Fehler:', error);
      alert('Fehler beim Setzen des Sollbeitrags');
    }
  };

  const openMassenModal = () => {
    // Default-Datum setzen: Kommerziell = 4 Wochen, Verein = 6 Wochen
    const wochen = massenOrgTyp === 'verein' ? 6 : 4;
    const d = new Date();
    d.setDate(d.getDate() + wochen * 7);
    setMassenDatum(d.toISOString().split('T')[0]);
    setMassenStep(1);
    setMassenResult(null);
    setMassenAngewendet(false);
    setKoennte5Prozent(false);
    setKuendigungKopiert(false);
    setMassenGrund([]);
    setMassenGrundCustom('');
    setSchritte([{ datum: '', betrag: '' }, { datum: '', betrag: '' }]);
    setVorschauData(null);
    setAusgeschlossen(new Set());
    setMassenSendPush(true);
    setTerminiertResult(null);
    setMassenModal(true);
  };

  const applyMassenErhoehung = async () => {
    try {
      setMassenLoading(true);
      const dojoFilterParam = getDojoFilterParam();
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/mitglieder/filter/tarif-abweichung/massenerhohung${dojoFilterParam ? '?' + dojoFilterParam : ''}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            erhoehung: parseFloat(massenErhoehung) || 0,
            erhoehungProzent: parseFloat(massenProzent) || 0,
            typ: massenTyp,
            ausschluss: [...ausgeschlossen]
          })
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler');
      setMassenAngewendet(true);
      await loadFilteredMembers();
    } catch (err) {
      alert('Fehler beim Anwenden: ' + err.message);
    } finally {
      setMassenLoading(false);
    }
  };

  const sendBenachrichtigung = async () => {
    if (!massenDatum || !massenVorlage) return;
    try {
      setMassenLoading(true);
      const dojoFilterParam = getDojoFilterParam();
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/mitglieder/filter/tarif-abweichung/benachrichtigung${dojoFilterParam ? '?' + dojoFilterParam : ''}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            erhoehung: parseFloat(massenErhoehung) || 0,
            erhoehungProzent: parseFloat(massenProzent) || 0,
            typ: massenTyp,
            vorlage: massenVorlage,
            gueltigAb: massenDatum,
            grund: [
              ...massenGrund.filter(k => k !== 'eigene' && k !== 'schrittweise').map(k => GRUND_TEXTE[k]?.text).filter(Boolean),
              ...(massenGrund.includes('schrittweise') ? [buildSchrittweisenText(schritte)] : []),
              ...(massenGrund.includes('eigene') && massenGrundCustom ? [massenGrundCustom] : [])
            ].join('\n\n'),
            ausschluss: [...ausgeschlossen],
            sendPush: true
          })
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler');
      setMassenResult(data);
    } catch (err) {
      alert('Fehler beim Senden: ' + err.message);
    } finally {
      setMassenLoading(false);
    }
  };

  const terminierungUndBenachrichtigung = async () => {
    if (!massenDatum || !massenVorlage) return;
    try {
      setMassenLoading(true);
      const dojoFilterParam = getDojoFilterParam();
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/mitglieder/filter/tarif-abweichung/terminierung${dojoFilterParam ? '?' + dojoFilterParam : ''}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            erhoehung: parseFloat(massenErhoehung) || 0,
            erhoehungProzent: parseFloat(massenProzent) || 0,
            typ: massenTyp,
            vorlage: massenVorlage,
            gueltigAb: massenDatum,
            grund: [
              ...massenGrund.filter(k => k !== 'eigene' && k !== 'schrittweise').map(k => GRUND_TEXTE[k]?.text).filter(Boolean),
              ...(massenGrund.includes('schrittweise') ? [buildSchrittweisenText(schritte)] : []),
              ...(massenGrund.includes('eigene') && massenGrundCustom ? [massenGrundCustom] : [])
            ].join('\n\n'),
            ausschluss: [...ausgeschlossen],
            schritte: massenGrund.includes('schrittweise')
              ? schritte.filter(s => s.datum && s.betrag && parseFloat(s.betrag) > 0)
              : []
          })
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler');
      setTerminiertResult(data);
    } catch (err) {
      alert('Fehler: ' + err.message);
    } finally {
      setMassenLoading(false);
    }
  };

  const sendeTestMail = async () => {
    try {
      setTestMailLoading(true);
      const dojoFilterParam = getDojoFilterParam();
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/mitglieder/filter/tarif-abweichung/test-mail${dojoFilterParam ? '?' + dojoFilterParam : ''}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            erhoehung: parseFloat(massenErhoehung) || 0,
            erhoehungProzent: parseFloat(massenProzent) || 0,
            typ: massenTyp,
            vorlage: massenVorlage,
            gueltigAb: massenDatum,
            grund: [
              ...massenGrund.filter(k => k !== 'eigene' && k !== 'schrittweise').map(k => GRUND_TEXTE[k]?.text).filter(Boolean),
              ...(massenGrund.includes('schrittweise') ? [buildSchrittweisenText(schritte)] : []),
              ...(massenGrund.includes('eigene') && massenGrundCustom ? [massenGrundCustom] : [])
            ].join('\n\n')
          })
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler');
      setTestMailSent(true);
      setTimeout(() => setTestMailSent(false), 4000);
    } catch (err) {
      alert('Test-Mail Fehler: ' + err.message);
    } finally {
      setTestMailLoading(false);
    }
  };

  const storniereTerminierung = async () => {
    if (!window.confirm('Alle noch nicht angewendeten Terminierungen für dieses Dojo wirklich zurückziehen?')) return;
    try {
      setMassenLoading(true);
      const dojoFilterParam = getDojoFilterParam();
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/mitglieder/filter/tarif-abweichung/terminierung${dojoFilterParam ? '?' + dojoFilterParam : ''}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler');
      alert(`✓ ${data.storniert} Terminierung(en) zurückgezogen${data.schritteGeloescht > 0 ? `, ${data.schritteGeloescht} Schritte gelöscht` : ''}.`);
      setTerminiertResult(null);
    } catch (err) {
      alert('Fehler: ' + err.message);
    } finally {
      setMassenLoading(false);
    }
  };

  const loadVerfuegbareTarife = async (mitgliederMitArchivTarif) => {
    try {
      const dojoFilterParam = getDojoFilterParam();
      const res = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/filter-options/tarife${dojoFilterParam ? '?' + dojoFilterParam : ''}`);
      const data = await res.json();
      setVerfuegbareTarife(data);
      // Nachfolger-Tarife auto-vorausfüllen
      const map = {};
      (mitgliederMitArchivTarif || []).forEach(m => {
        if (m.nachfolger_tarif_id) map[m.vertrag_id] = m.nachfolger_tarif_id;
      });
      setMigrationMap(map);
    } catch (e) {
      console.error('Tarife laden fehlgeschlagen:', e);
    }
  };

  const sendMigration = async () => {
    const migrationen = Object.entries(migrationMap)
      .filter(([, tarif_id]) => tarif_id)
      .map(([vertrag_id, neuer_tarif_id]) => ({
        vertrag_id: parseInt(vertrag_id),
        neuer_tarif_id: parseInt(neuer_tarif_id)
      }));
    if (migrationen.length === 0) return;
    setMigrationLoading(true);
    try {
      const dojoFilterParam = getDojoFilterParam();
      const res = await fetchWithAuth(
        `${config.apiBaseUrl}/mitglieder/filter/tarif-migration${dojoFilterParam ? '?' + dojoFilterParam : ''}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ migrationen })
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fehler');
      setMigrationResult(data);
      setShowMigrationPanel(false);
      setMigrationMap({});
      await loadFilteredMembers();
    } catch (e) {
      alert('Fehler bei Migration: ' + e.message);
    } finally {
      setMigrationLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Vorname', 'Nachname', 'Email', 'Zahlungsmethode', 'Monatsbeitrag', 'Status'];
    const rows = mitglieder.map(m => [
      m.mitglied_id,
      m.vorname,
      m.nachname,
      m.email,
      m.zahlungsmethode || '-',
      m.monatsbeitrag || '-',
      m.aktiv ? 'Aktiv' : 'Inaktiv'
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(';'))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `mitglieder_${filterType}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="mf-page-wrapper">
      {/* Header */}
      <div className="mf-page-header">
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard/finanzcockpit')}>
          <ArrowLeft size={20} />
          Zurück zum Finanzcockpit
        </button>
        <div>
          <h1>{getFilterTitle()}</h1>
          <p>{getFilterDescription()}</p>
        </div>
        <div className="u-flex-gap-sm">
          <button className="btn btn-primary" onClick={exportToCSV} disabled={mitglieder.length === 0}>
            <Download size={20} />
            CSV Export
          </button>
        </div>
      </div>

      {/* Zahlungsweise-Filter (nur für zahlungsweisen-Ansicht) */}
      {filterType === 'zahlungsweisen' && (
        <div className="mf-filter-panel">
          <h3 className="mf-filter-panel-h3">Zahlungsmethode wählen</h3>
          <div className="mf-filter-panel-btns">
            {['all', 'Lastschrift', 'Überweisung', 'Bar', 'Karte', 'PayPal'].map(method => (
              <button
                key={method}
                className={`btn ${selectedPaymentMethod === method ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedPaymentMethod(method)}
              >
                {method === 'all' ? '🔍 Alle' : method}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Info Bar */}
      <div className="mf-info-bar">
        <span className="mf-info-bar-label">
          {loading ? 'Laden…' : `${mitglieder.length} Mitglieder`}
        </span>
        <span className="mf-info-bar-desc">
          {filterType === 'tarif-abweichung' && 'Beitragsabweichungen vom Tarif-Standard'}
          {filterType === 'ohne-sepa' && 'Fehlende SEPA-Mandate'}
          {filterType === 'ohne-vertrag' && 'Mitglieder ohne aktiven Vertrag'}
          {filterType === 'zahlungsweisen' && 'Gefiltert nach Zahlungsmethode'}
        </span>
      </div>

      {/* Tarif-Abweichung Statistiken */}
      {filterType === 'tarif-abweichung' && !loading && mitglieder.length > 0 && (() => {
        const stats = getAbweichungsStatistik();
        if (!stats) return null;
        const netto = (stats.summeZuViel || 0) - (stats.summeZuWenig || 0);

        return (
          <>
            {/* Kompakte Übersichtsleiste */}
            <div className="mf-overview-bar">
              {[
                { label: 'Gesamt', value: stats.gesamt || mitglieder.length, color: 'rgba(255,255,255,0.65)' },
                { label: 'Abweichend', value: stats.zuWenig + stats.zuViel, color: stats.zuWenig + stats.zuViel > 0 ? 'var(--status-warning)' : 'rgba(255,255,255,0.8)', sub: netto !== 0 ? `${netto > 0 ? '+' : ''}${formatCurrency(netto)}` : null },
                { label: 'Archivierter Tarif', value: stats.archivierterTarif, color: stats.archivierterTarif > 0 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.8)' },
                { label: 'Kein Tarif', value: stats.keinTarif, color: stats.keinTarif > 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.8)' },
              ].map((item, i, arr) => (
                <div key={item.label} className="mf-overview-bar-item">
                  <div className="mf-overview-bar-item-label">
                    {item.label}
                  </div>
                  <div className="mf-overview-bar-item-value" style={{ '--item-color': item.color }}>
                    {item.value}
                  </div>
                  {item.sub && (
                    <div className={`mf-overview-bar-item-sub ${netto < 0 ? 'mf-overview-bar-item-sub--negative' : 'mf-overview-bar-item-sub--positive'}`}>
                      {item.sub}/Monat
                    </div>
                  )}
                </div>
              ))}

              {/* Archiv-Hinweis + Link */}
              {stats.archivierterTarif > 0 && (
                <div className="mf-archiv-hint-row">
                  <span className="mf-archiv-hint-text">
                    <Package size={13} />
                    {stats.archivierterTarif} Mitglieder nutzen noch archivierte Tarife
                  </span>
                  <button
                    onClick={() => {
                      const archivierteMitglieder = mitglieder.filter(m => m.ist_archiviert === 1);
                      setShowMigrationPanel(true);
                      setMigrationResult(null);
                      loadVerfuegbareTarife(archivierteMitglieder);
                    }}
                    className="btn btn-secondary"
                  >
                    Tarife migrieren →
                  </button>
                </div>
              )}
            </div>

            {/* Massenerhöhung Trigger */}
            {stats.zuWenig > 0 && (
              <div className="mf-massen-trigger">
                <span className="mf-massen-trigger-text">
                  <Zap size={13} /> {stats.zuWenig} Mitglieder zahlen unter Tarif-Preis
                </span>
                <button onClick={openMassenModal} className="btn btn-primary">
                  Beitragserhöhung planen →
                </button>
              </div>
            )}
          </>
        );
      })()}

      {/* Tarif-Migration Panel */}
      {filterType === 'tarif-abweichung' && showMigrationPanel && (() => {
        const archivierteMitglieder = mitglieder.filter(m => m.ist_archiviert === 1);
        const mitNachfolger = archivierteMitglieder.filter(m => m.nachfolger_tarif_id);
        const assignedCount = Object.values(migrationMap).filter(Boolean).length;
        const fmtPreis = t => {
          const p = t.billing_cycle === 'MONTHLY' ? t.price_cents / 100
            : t.billing_cycle === 'QUARTERLY' ? t.price_cents / 300
            : t.price_cents / 1200;
          return p.toFixed(2).replace('.', ',') + ' €/Mo';
        };
        return (
          <div className="mf-migration-panel">
            <div className="mf-migration-header">
              <div>
                <div className="mf-migration-title">Tarif-Migration</div>
                <div className="mf-migration-subtitle">
                  Tarif-Zuordnung korrigieren — Beitrag bleibt unverändert, Cap greift danach korrekt
                </div>
              </div>
              <button onClick={() => setShowMigrationPanel(false)} className="mf-migration-close">✕</button>
            </div>

            {mitNachfolger.length > 0 && (
              <button
                onClick={() => {
                  const map = { ...migrationMap };
                  mitNachfolger.forEach(m => { map[m.vertrag_id] = m.nachfolger_tarif_id; });
                  setMigrationMap(map);
                }}
                className="ds-btn ds-btn--sm ds-btn--ghost mf-migration-auto-btn"
              >
                ⚡ Alle mit Nachfolger auto-zuweisen ({mitNachfolger.length})
              </button>
            )}

            <div className="mf-migration-list">
              {archivierteMitglieder.map(m => (
                <div key={m.vertrag_id} className="mf-migration-row">
                  <div className="mf-migration-name">{m.vorname} {m.nachname}</div>
                  <div className="mf-migration-old">
                    <span className="mf-migration-old-name">{m.tarif_name}</span>
                    <span className="mf-badge-archiv">archiviert</span>
                    {m.mindestlaufzeit_monate && (
                      <span className="mf-migration-laufzeit">{m.mindestlaufzeit_monate} Mo.</span>
                    )}
                    {m.nachfolger_tarif_name && (
                      <span className="mf-migration-hint">→ {m.nachfolger_tarif_name}</span>
                    )}
                  </div>
                  <select
                    value={migrationMap[m.vertrag_id] || ''}
                    onChange={e => setMigrationMap(prev => ({ ...prev, [m.vertrag_id]: parseInt(e.target.value) || '' }))}
                    className="mf-migration-select"
                  >
                    <option value="">— Tarif wählen —</option>
                    {verfuegbareTarife.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({fmtPreis(t)})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="mf-migration-footer">
              {migrationResult && (
                <span className="mf-migration-result-txt">
                  ✓ {migrationResult.migriert} migriert{migrationResult.fehler > 0 ? ` · ${migrationResult.fehler} Fehler` : ''}
                </span>
              )}
              <span className="mf-migration-count">{assignedCount} von {archivierteMitglieder.length} zugewiesen</span>
              <button
                onClick={sendMigration}
                disabled={migrationLoading || assignedCount === 0}
                className="ds-btn ds-btn--primary ds-btn--sm"
              >
                {migrationLoading ? 'Migriere…' : `${assignedCount} Verträge migrieren`}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Mitglieder-Liste */}
      {loading ? (
        <div className="mf-loading-state">
          <p>Lade Mitglieder...</p>
        </div>
      ) : mitglieder.length === 0 ? (
        <div className="mf-empty-panel">
          <Users size={48} color="#9ca3af" className="mf-empty-panel-icon" />
          <h3 className="u-text-muted">Keine Mitglieder gefunden</h3>
          <p className="u-text-muted">
            {filterType === 'ohne-sepa' && 'Alle Mitglieder mit Lastschrift haben ein SEPA-Mandat. ✅'}
            {filterType === 'ohne-vertrag' && 'Alle aktiven Mitglieder haben einen Vertrag. ✅'}
            {filterType === 'tarif-abweichung' && 'Keine Tarif-Abweichungen gefunden. ✅'}
            {filterType === 'zahlungsweisen' && 'Keine Mitglieder mit dieser Zahlungsmethode.'}
          </p>
        </div>
      ) : (
        <div className="mitglieder-grid">
          {mitglieder.map(mitglied => (
            <div
              key={mitglied.mitglied_id}
              className="mitglied-card mf-cursor-pointer"
              onClick={() => navigate(`/dashboard/mitglieder/${mitglied.mitglied_id}`)}
            >
              {/* Card Header */}
              <div className="mf-card-header">
                <div>
                  <div className="mf-card-title">
                    {mitglied.vorname} {mitglied.nachname}
                  </div>
                  <div className="mf-card-id">ID {mitglied.mitglied_id}</div>
                </div>
                {filterType === 'tarif-abweichung' && mitglied.monatsbeitrag && (
                  <div className="mf-card-beitrag-wrap">
                    <div className="mf-card-beitrag-amount">
                      {formatCurrency(mitglied.monatsbeitrag)}
                    </div>
                    <div className="mf-card-beitrag-label">pro Monat</div>
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="mf-card-body">
                {/* Meta-Infos */}
                <div className="mf-card-meta-row">
                  {mitglied.email && (
                    <span className="mf-card-meta-chip">
                      <Mail size={11} /> {mitglied.email}
                    </span>
                  )}
                  {mitglied.zahlungsmethode && (
                    <span className="mf-card-meta-chip">
                      <CreditCard size={11} /> {mitglied.zahlungsmethode}
                    </span>
                  )}
                </div>

                {filterType === 'ohne-sepa' && (
                  <div className="mf-card-sepa-missing">
                    <AlertCircle size={13} /> Kein SEPA-Mandat
                  </div>
                )}

                {filterType === 'ohne-vertrag' && (
                  <div className="mf-card-no-contract">
                    <FileText size={13} /> Kein aktiver Vertrag
                  </div>
                )}

                {filterType === 'tarif-abweichung' && (
                  <>
                    {/* Abweichungsgrund – kompakt */}
                    {mitglied.abweichung_grund && (
                      <div className="mf-card-abw-grund">
                        {mitglied.abweichung_grund}
                      </div>
                    )}

                    {/* Archivierter Tarif */}
                    {mitglied.ist_archiviert === 1 ? (
                      <div className="mf-card-divider-row">
                        <span className="mf-card-archiv-badge">
                          <Package size={12} /> Archivierter Tarif
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate('/dashboard/tarife'); }} className="mf-card-archiv-btn"
                        >
                          Tarif ändern →
                        </button>
                      </div>
                    ) : mitglied.differenz != null && (
                      <div className="mf-card-divider-row">
                        <div className="mf-card-differenz-row">
                          <span className="mf-card-soll-label">Soll </span>
                          <span className="u-text-secondary">{formatCurrency(mitglied.erwarteter_monatsbeitrag || mitglied.soll_beitrag || mitglied.tarif_betrag)}</span>
                          <span className={mitglied.differenz > 0 ? 'mf-differenz-value--positive' : 'mf-differenz-value--negative'}>
                            {mitglied.differenz > 0 ? '+' : ''}{formatCurrency(mitglied.differenz)}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingMitglied(mitglied);
                            setNewBeitrag(mitglied.erwarteter_monatsbeitrag || mitglied.soll_beitrag || mitglied.tarif_betrag || '');
                          }}
                          className="mf-card-edit-btn">
                          <Edit size={11} /> Anpassen
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Für andere Filter: Monatsbeitrag */}
                {filterType !== 'tarif-abweichung' && mitglied.monatsbeitrag && (
                  <div className="mf-card-other-beitrag">
                    {formatCurrency(mitglied.monatsbeitrag)}/Monat
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Beitrag-Anpassungs-Modal */}
      {editingMitglied && (
        <div className="ds-modal-overlay" onClick={() => setEditingMitglied(null)}>
          <div className="ds-modal mf-beitrag-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="mf-modal-h2">Beitrag anpassen</h2>

            <div className="mf-modal-member-block">
              <h3 className="u-text-primary">{editingMitglied.vorname} {editingMitglied.nachname}</h3>
              <p className="mf-modal-member-id">ID: {editingMitglied.mitglied_id}</p>
            </div>

            <div className="mf-info-grid">
              <div className="mf-info-row">
                <span className="u-text-secondary">Aktueller Beitrag:</span>
                <span className="mf-modal-info-strong">{formatCurrency(editingMitglied.monatsbeitrag)}</span>
              </div>
              {editingMitglied.ist_archiviert === 1 ? (
                <div className="mf-modal-archiv-box">
                  <div className="mf-modal-archiv-title">
                    ⚠️ ARCHIVIERTER TARIF
                  </div>
                  <div className="u-text-secondary-sm">
                    Tarif: {editingMitglied.tarif_name}
                  </div>
                  <div className="mf-modal-archiv-hint">
                    Bitte zuerst auf aktuellen Tarif umstellen unter "Tarife & Preise"
                  </div>
                </div>
              ) : (
                <>
                  <div className="mf-info-row">
                    <span className="u-text-secondary">Sollbeitrag (Tarif):</span>
                    <span className="mf-modal-soll-val">
                      {formatCurrency(editingMitglied.soll_beitrag || editingMitglied.tarif_betrag)}
                    </span>
                  </div>
                  <div className="mf-info-row mf-modal-info-row-sep">
                    <span className="u-text-secondary">Differenz:</span>
                    <span className={`mf-fw-700 ${editingMitglied.differenz > 0 ? 'mf-differenz-value--positive' : 'mf-differenz-value--negative'}`}>
                      {editingMitglied.differenz > 0 ? '+' : ''}{formatCurrency(editingMitglied.differenz)}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="mf-modal-member-block">
              <label className="u-form-label-secondary">
                Neuer Monatsbeitrag (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={newBeitrag}
                onChange={(e) => setNewBeitrag(e.target.value)}
                className="ds-input ds-input--lg"

                autoFocus
              />
            </div>

            <div className="mf-modal-btn-row-wrap">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setNewBeitrag(editingMitglied.soll_beitrag || editingMitglied.tarif_betrag || '')}
              >
                Sollbeitrag setzen
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setNewBeitrag(editingMitglied.monatsbeitrag || '')}
              >
                Zurücksetzen
              </button>
            </div>

            <div className="mf-modal-footer-row">
              <button
                className="btn btn-secondary"
                onClick={() => setEditingMitglied(null)}
              >
                <X size={18} /> Abbrechen
              </button>
              <button
                className="btn btn-primary"
                onClick={() => updateBeitrag(editingMitglied.mitglied_id)}
                disabled={editingMitglied.ist_archiviert === 1 || !newBeitrag || parseFloat(newBeitrag) === editingMitglied.monatsbeitrag}
                title={editingMitglied.ist_archiviert === 1 ? "Bitte zuerst Tarif aktualisieren" : ""}
              >
                <Check size={18} /> {editingMitglied.ist_archiviert === 1 ? 'Tarif ist archiviert' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== BEITRAGSERHÖHUNG MODAL ===== */}
      {massenModal && (() => {
        const betrag = parseFloat(massenErhoehung) || 0;
        const today = new Date();
        const minDate = new Date(today); minDate.setDate(today.getDate() + 14);
        const effDate = massenDatum ? new Date(massenDatum) : null;
        const daysUntil = effDate ? Math.round((effDate - today) / 86400000) : 0;
        const minVerein = 42; // 6 Wochen
        const minKomm  = 28; // 4 Wochen
        const minEmpfohlen = massenOrgTyp === 'verein' ? minVerein : minKomm;

        const datumFormatiert = effDate
          ? effDate.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
          : '–';

        const neuerBetragBeispiel = betrag > 0 ? `${(34.99 + betrag).toFixed(2).replace('.', ',')} €` : '–';

        // Begründungstext auflösen (Multi-Select: alle gewählten Texte zusammenführen)
        const grundText = [
          ...massenGrund.filter(k => k !== 'eigene' && k !== 'schrittweise').map(k => GRUND_TEXTE[k]?.text).filter(Boolean),
          ...(massenGrund.includes('schrittweise') ? [buildSchrittweisenText(schritte)] : []),
          ...(massenGrund.includes('eigene') && massenGrundCustom ? [massenGrundCustom] : [])
        ].join('\n\n');

        const VORLAGEN = {
          formell: {
            name: 'Formell',
            desc: 'Unpersönlich, sachlich — für größere Studios oder Vereine',
            preview: `Sehr geehrte/r [Vorname] [Nachname],

wir möchten Sie hiermit über eine Anpassung Ihres monatlichen Mitgliedsbeitrags informieren.

Ab dem ${datumFormatiert} beträgt Ihr monatlicher Beitrag [neuer Betrag] (bisher: [alter Betrag]).
${grundText ? `\n${grundText}\n` : ''}
Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
[Dojo-Name]`
          },
          freundlich: {
            name: 'Freundlich',
            desc: 'Persönlich, herzlich — für enge Mitgliederbeziehungen',
            preview: `Hallo [Vorname],

wir möchten dich über eine Anpassung deines monatlichen Mitgliedsbeitrags informieren.

Ab dem ${datumFormatiert} beträgt dein monatlicher Beitrag [neuer Betrag] (bisher: [alter Betrag]).
${grundText ? `\n${grundText}\n` : ''}
Wir danken dir für deine Mitgliedschaft und freuen uns, dich weiterhin bei uns im Dojo willkommen zu heißen!

Herzliche Grüße
[Dojo-Name]`
          },
          kurz: {
            name: 'Kurz & sachlich',
            desc: 'Kompakt, direkt — für schnelle Information',
            preview: `[Vorname] [Nachname],

ab dem ${datumFormatiert} wird dein monatlicher Mitgliedsbeitrag auf [neuer Betrag] angepasst (bisher: [alter Betrag]).
${grundText ? `\n${grundText}\n` : ''}
[Dojo-Name]`
          }
        };

        // inputStyle + labelStyle → CSS-Klassen ds-input / mf-label

        const prozent = parseFloat(massenProzent) || 0;
        const canStep2 = (
          (massenTyp === 'absolut' && betrag > 0) ||
          (massenTyp === 'prozent' && prozent > 0) ||
          (massenTyp === 'kombination' && betrag > 0 && prozent > 0)
        ) && massenDatum && daysUntil >= 14;
        const canStep3 = !!vorschauData; // kann zu Step 3 wenn Vorschau geladen
        const canSend  = massenStep === 4 && massenDatum && massenVorlage;

        return createPortal(
          <div className="ds-modal-overlay" onClick={() => setMassenModal(false)}>
            <div className="ds-modal mf-wizard-modal" onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="ds-modal-header">
                <div>
                  <h2 className="ds-modal-title">Beitragserhöhung planen</h2>
                  <p className="ds-modal-subtitle">Schritt {massenStep} von 4</p>
                </div>
                <button onClick={() => setMassenModal(false)} className="ds-modal-close">
                  <X size={20} />
                </button>
              </div>

              {/* Steps */}
              <div className="mf-modal-steps">
                {['Konfiguration', 'Vorschau', 'E-Mail Vorlage', 'Versand'].map((label, i) => (
                  <div key={i}
                    className={`mf-step-tab${massenStep === i + 1 ? ' mf-step-tab--active' : ''}${i + 1 < massenStep ? ' mf-step-tab--done' : ''}`}
                    onClick={() => i + 1 < massenStep && setMassenStep(i + 1)}>
                    {i + 1}. {label}
                  </div>
                ))}
              </div>

              {/* Content */}
              <div className="ds-modal-body">

                {/* ── STEP 1: Konfiguration ── */}
                {massenStep === 1 && (
                  <div className="mf-col-gap-md mf-step1-col">

                    {/* Organisationstyp */}
                    <div>
                      <span className="mf-label">Organisationstyp</span>
                      <div className="mf-row-gap-sm">
                        {[
                          { key: 'kommerziell', label: 'Kommerzielles Studio / Schule', desc: 'GmbH, GbR, Einzelunternehmen' },
                          { key: 'verein', label: 'Eingetragener Verein (e.V.)', desc: 'Vereinsrecht, Mitgliederversammlung' }
                        ].map(o => (
                          <button key={o.key} onClick={() => {
                            setMassenOrgTyp(o.key);
                            const d = new Date(); d.setDate(d.getDate() + (o.key === 'verein' ? 42 : 28));
                            setMassenDatum(d.toISOString().split('T')[0]);
                          }} className={`mf-select-btn${massenOrgTyp === o.key ? ' mf-select-btn--active' : ''}`}>
                            <div className="mf-select-btn-title">{o.label}</div>
                            <div className="mf-select-btn-desc">{o.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Erhöhungstyp */}
                    <div>
                      <span className="mf-label">Art der Erhöhung</span>
                      <div className="mf-erh-type-row">
                        {[
                          { key: 'absolut', label: 'Fixer Betrag', desc: '+ X €/Monat' },
                          { key: 'prozent', label: 'Prozentual', desc: '+ Y %' },
                          { key: 'kombination', label: '€ max. Y%', desc: '+ X €, aber max. Y%' }
                        ].map(o => (
                          <button key={o.key} onClick={() => setMassenTyp(o.key)}
                            className={`mf-select-btn mf-select-btn--sm${massenTyp === o.key ? ' mf-select-btn--active' : ''}`}>
                            <div className="mf-select-btn-title">{o.label}</div>
                            <div className="mf-select-btn-desc">{o.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Betrag / Prozent / Kombi */}
                    <div className={massenTyp === 'kombination' ? 'mf-massen-input-grid--3cols' : 'mf-massen-input-grid--2cols'}>
                      {massenTyp !== 'prozent' && (
                        <div className="ds-form-group">
                          <label className="mf-label">Erhöhung (€/Monat)</label>
                          <input type="number" min="0.01" max="500" step="0.01" placeholder="z.B. 2.00"
                            value={massenErhoehung} onChange={e => setMassenErhoehung(e.target.value)}
                            className="ds-input" />
                        </div>
                      )}
                      {massenTyp !== 'absolut' && (
                        <div className="ds-form-group">
                          <label className="mf-label">{massenTyp === 'kombination' ? 'Max. Erhöhung (%)' : 'Erhöhung (%)'}</label>
                          <input type="number" min="0.1" max="100" step="0.1" placeholder="z.B. 5.0"
                            value={massenProzent} onChange={e => setMassenProzent(e.target.value)}
                            className="ds-input" />
                        </div>
                      )}
                      <div className="ds-form-group">
                        <label className="mf-label">Gültig ab (Datum)</label>
                        <input type="date"
                          min={minDate.toISOString().split('T')[0]}
                          value={massenDatum} onChange={e => setMassenDatum(e.target.value)}
                          className="ds-input" />
                      </div>
                    </div>

                    {/* Begründung der Erhöhung */}
                    <div>
                      <div className="mf-section-title">
                        BEGRÜNDUNG DER ERHÖHUNG
                        <span className="mf-section-title-hint">· wird in E-Mails eingefügt</span>
                      </div>
                      <div className="mf-section-hint">Mehrfachauswahl möglich — Texte werden kombiniert</div>
                      <div className={`mf-grund-pills-wrap${massenGrund.length > 0 ? ' mf-grund-pills-wrap--has-selection' : ''}`}>
                        {Object.entries(GRUND_TEXTE).map(([key, g]) => {
                          const active = massenGrund.includes(key);
                          return (
                            <button key={key} onClick={() => setMassenGrund(prev =>
                              prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
                            )} className={`mf-pill${active ? ' mf-pill--active' : ''}`}>
                              {active ? '✓ ' : ''}{g.kurz}
                            </button>
                          );
                        })}
                      </div>

                      {/* Kombinierte Vorschau aller gewählten Texte */}
                      {massenGrund.filter(k => k !== 'eigene').length > 0 && (
                        <div className="mf-text-preview">
                          {massenGrund.filter(k => k !== 'eigene').map((k, i) => {
                            const txt = k === 'schrittweise' ? buildSchrittweisenText(schritte) : GRUND_TEXTE[k]?.text;
                            return (
                              <span key={k}>
                                {i > 0 && <span className="mf-preview-spacer" />}
                                „{txt}"
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Schritte-Editor (wenn "In Schritten" gewählt) */}
                      {massenGrund.includes('schrittweise') && (
                        <div className="mf-schritte-editor">
                          <div className="mf-schritte-title">
                            SCHRITTE DEFINIEREN — Datum & Betrag pro Erhöhungsschritt
                          </div>
                          {schritte.map((s, i) => (
                            <div key={i} className="mf-schritt-row">
                              <div className="mf-schritt-row-flex">
                                <input
                                  type="date"
                                  value={s.datum}
                                  onChange={e => {
                                    const next = [...schritte];
                                    next[i] = { ...next[i], datum: e.target.value };
                                    setSchritte(next);
                                  }}
                                  className="ds-input ds-input--sm"
                                />
                              </div>
                              <div className="mf-schritt-row-fixed">
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  placeholder="+ € Betrag"
                                  value={s.betrag}
                                  onChange={e => {
                                    const next = [...schritte];
                                    next[i] = { ...next[i], betrag: e.target.value };
                                    setSchritte(next);
                                  }}
                                  className="ds-input ds-input--sm"
                                />
                              </div>
                              {schritte.length > 1 && (
                                <button
                                  onClick={() => setSchritte(prev => prev.filter((_, idx) => idx !== i))}
                                  className="mf-schritt-remove-btn"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                          <div className="mf-schritte-footer">
                            <button
                              onClick={() => setSchritte(prev => [...prev, { datum: '', betrag: '' }])}
                              className="mf-schritt-add-btn"
                            >
                              + Schritt hinzufügen
                            </button>
                            {schritte.some(s => s.betrag) && (
                              <span className="mf-schritte-gesamt">
                                Gesamt: {formatCurrency(schritte.reduce((sum, s) => sum + (parseFloat(s.betrag) || 0), 0))}/Monat
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Freies Textfeld */}
                      {massenGrund.includes('eigene') && (
                        <textarea
                          placeholder="Ihre individuelle Begründung für die Beitragserhöhung…"
                          value={massenGrundCustom}
                          onChange={e => setMassenGrundCustom(e.target.value)}
                          rows={3} className="mf-custom-textarea"
                        />
                      )}
                    </div>

                    {/* Fristen-Anzeige */}
                    {massenDatum && (
                      <div className="mf-frist-box">
                        <div className="mf-frist-title">
                          ANKÜNDIGUNGSFRISTEN — {daysUntil} Tage bis zur Wirksamkeit
                        </div>
                        <div className="mf-frist-rows">
                          <div className="mf-frist-row">
                            <span className={`mf-frist-status ${daysUntil >= 14 ? 'mf-frist-status--ok' : 'mf-frist-status--error'}`}>
                              {daysUntil >= 14 ? '✓' : '✗'}
                            </span>
                            <span className="mf-frist-row-text">SEPA-Vorabankündigung: mind. 14 Tage</span>
                            <span className="mf-frist-row-badge">EU-Pflicht</span>
                          </div>
                          {massenOrgTyp === 'verein' ? (
                            <>
                              <div className="mf-frist-row">
                                <span className={`mf-frist-status ${daysUntil >= 42 ? 'mf-frist-status--ok' : 'mf-frist-status--warning'}`}>
                                  {daysUntil >= 42 ? '✓' : '⚠'}
                                </span>
                                <span className="mf-frist-row-text">Ankündigung vor Mitgliederversammlung: 6 Wochen</span>
                                <span className="mf-frist-row-badge">Empfehlung</span>
                              </div>
                              <div className="mf-frist-note">
                                MV entscheidet über Erhöhungen (§27 BGB). Schriftliche Info mind. 6 Wochen davor empfohlen. Kein Sonderkündigungsrecht.
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="mf-frist-row">
                                <span className={`mf-frist-status ${daysUntil >= 28 ? 'mf-frist-status--ok' : 'mf-frist-status--warning'}`}>
                                  {daysUntil >= 28 ? '✓' : '⚠'}
                                </span>
                                <span className="mf-frist-row-text">Ankündigungsfrist gem. AGB: 4–6 Wochen</span>
                                <span className="mf-frist-row-badge">Empfehlung</span>
                              </div>
                              <div className="mf-frist-note">
                                Erfordert AGB-Klausel (§307 BGB). Begründung der Erhöhung empfohlen (Transparenzgebot).
                              </div>

                              {/* >5% Warnung mit Toggle */}
                              <div className={`mf-warn-box ${koennte5Prozent ? 'mf-warn-box--orange' : 'mf-warn-box--warning'}`}>
                                <div className={`mf-warn-title ${koennte5Prozent ? 'mf-warn-title--orange' : 'mf-warn-title--warning'}`}>
                                  ⚠ Sonderkündigungsrecht bei &gt;5% Erhöhung (BGH-Rechtsprechung)
                                </div>
                                <div className="mf-warn-text">
                                  Bei ≥5% kann laut BGH ein Sonderkündigungsrecht entstehen — auch wenn vertraglich ausgeschlossen. Ggf. Erhöhung reduzieren oder stückeln.
                                </div>
                                <label className="mf-warn-checkbox-label">
                                  <input
                                    type="checkbox"
                                    checked={koennte5Prozent}
                                    onChange={e => setKoennte5Prozent(e.target.checked)}
                                    className="mf-warn-checkbox-input"
                                  />
                                  <span className="mf-warn-checkbox-text">
                                    Die Erhöhung beträgt bei manchen Mitgliedern ≥5% — Antwortvorlage für Kündigungsanfragen bereitstellen
                                  </span>
                                </label>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── STEP 2: Vorschau & Auswahl ── */}
                {massenStep === 2 && (
                  <div className="mf-col-gap-md">
                    {/* Kopfzeile */}
                    <div className="mf-row-spread">
                      <div>
                        <div className="mf-vorschau-count">
                          {vorschauData ? `${(vorschauData.length - ausgeschlossen.size)} von ${vorschauData.length} Mitgliedern` : '–'}
                        </div>
                        <div className="mf-vorschau-hint">
                          Klick auf ✕ schließt Mitglied aus der Erhöhung aus
                        </div>
                      </div>
                      {ausgeschlossen.size > 0 && (
                        <button onClick={() => setAusgeschlossen(new Set())} className="ds-btn ds-btn--ghost ds-btn--xs">Alle wieder aufnehmen</button>
                      )}
                    </div>

                    {/* Gesamtübersicht */}
                    {vorschauData && vorschauData.length > 0 && (() => {
                      const aktive = vorschauData.filter(m => !ausgeschlossen.has(m.mitglied_id));
                      const sumAlt  = aktive.reduce((s, m) => s + Number(m.alter_betrag), 0);
                      const sumNeu  = aktive.reduce((s, m) => s + Number(m.neuer_betrag), 0);
                      const sumDiff = sumNeu - sumAlt;
                      const fmt = v => `${v.toFixed(2).replace('.', ',')} €`;
                      return (
                        <div className="mf-stats-grid">
                          {[
                            { label: 'Aktuell/Monat', value: fmt(sumAlt), color: 'rgba(255,255,255,0.45)' },
                            { label: 'Neu/Monat', value: fmt(sumNeu), color: 'var(--status-success)' },
                            { label: 'Mehreinnahmen', value: `+${fmt(sumDiff)}`, color: '#86efac' },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="mf-stat-card">
                              <div className="mf-stat-label">{label}</div>
                              <div className="mf-stat-value" style={{ '--stat-color': color }}>{value}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Mitgliederliste */}
                    {vorschauLoading ? (
                      <div className="mf-empty-state">Lade Vorschau…</div>
                    ) : vorschauData && vorschauData.length === 0 ? (
                      <div className="mf-empty-state">
                        Keine Mitglieder betroffen — alle zahlen bereits den vollen Tarif-Preis.
                      </div>
                    ) : (
                      <div className="mf-member-list-col">
                        {/* Tabellen-Header */}
                        <div className="mf-member-list-header">
                          <span>NAME</span><span className="mf-text-right">AKTUELL</span><span className="mf-text-right">NEU</span><span className="mf-text-right">+DIFF</span><span/>
                        </div>
                        {(vorschauData || []).map(m => {
                          const excluded = ausgeschlossen.has(m.mitglied_id);
                          const fmt = v => `${Number(v).toFixed(2).replace('.', ',')} €`;
                          const fmtDate = d => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null;
                          const laufzeitInfo = (() => {
                            const parts = [];
                            if (m.mindestlaufzeit_monate) parts.push(`${m.mindestlaufzeit_monate} Mon.`);
                            if (m.vertragsbeginn) parts.push(`seit ${fmtDate(m.vertragsbeginn)}`);
                            if (m.vertragsende) parts.push(`bis ${fmtDate(m.vertragsende)}`);
                            return parts.join(' · ');
                          })();
                          const schrittweisenInfo = (() => {
                            if (!massenGrund.includes('schrittweise')) return null;
                            const valid = schritte.filter(s => s.datum && s.betrag && parseFloat(s.betrag) > 0);
                            if (valid.length === 0) return null;
                            let kumulativ = 0;
                            return valid.map((s, i) => {
                              kumulativ += parseFloat(s.betrag);
                              const betrag = Math.round((Number(m.alter_betrag) + kumulativ) * 100) / 100;
                              return `${fmtDate(s.datum)}: ${fmt(betrag)}`;
                            }).join(' → ');
                          })();
                          return (
                            <div key={m.mitglied_id} className={`mf-member-row ${excluded ? 'mf-member-row--excluded' : 'mf-member-row--included'}`}>
                              <div className="mf-member-name-cell">
                                <div className={`mf-member-name ${excluded ? 'mf-member-name--excluded' : 'mf-member-name--included'}`}>
                                  {m.vorname} {m.nachname}
                                </div>
                                {(m.tarif_name || laufzeitInfo) && (
                                  <div className="mf-member-meta">
                                    {m.tarif_name && <span className={m.tarif_archiviert ? 'mf-tarif-name--archived' : 'mf-tarif-name--active'}>{m.tarif_name}</span>}
                                    {m.tarif_name && laufzeitInfo && <span className="mf-tarif-sep">·</span>}
                                    {laufzeitInfo && <span>{laufzeitInfo}</span>}
                                  </div>
                                )}
                                {schrittweisenInfo && !excluded && (
                                  <div className="mf-member-schritte">
                                    ↗ {schrittweisenInfo}
                                  </div>
                                )}
                              </div>
                              <span className={`mf-cell-altbetrag${excluded ? '' : ' mf-cell-altbetrag--strikethrough'}`}>
                                {fmt(m.alter_betrag)}
                              </span>
                              <span className={excluded ? 'mf-neuer-betrag--excluded' : 'mf-neuer-betrag--included'}>
                                {excluded ? '—' : fmt(m.neuer_betrag)}
                              </span>
                              <span className={excluded ? 'mf-differenz-cell--excluded' : 'mf-differenz-cell--included'}>
                                {excluded ? '' : `+${fmt(m.differenz)}`}
                              </span>
                              <button onClick={() => setAusgeschlossen(s => {
                                const n = new Set(s);
                                if (n.has(m.mitglied_id)) n.delete(m.mitglied_id); else n.add(m.mitglied_id);
                                return n;
                              })} className={`mf-member-toggle-btn ${excluded ? 'mf-member-toggle-btn--excluded' : 'mf-member-toggle-btn--included'}`} title={excluded ? 'Wieder aufnehmen' : 'Ausschließen'}>
                                {excluded ? '+' : '✕'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── STEP 3: Vorlage ── */}
                {massenStep === 3 && (
                  <div className="mf-col-gap-lg">
                    <div className="mf-col-gap-sm">
                      {Object.entries(VORLAGEN).map(([key, v]) => (
                        <button key={key} onClick={() => setMassenVorlage(key)} className={`mf-vorlage-btn${massenVorlage === key ? ' mf-vorlage-btn--active' : ''}`}>
                          <div className="mf-vorlage-title">{v.name}</div>
                          <div className="mf-vorlage-desc">{v.desc}</div>
                        </button>
                      ))}
                    </div>
                    {/* Vorschau Massenmail */}
                    <div>
                      <div className="mf-email-preview-header">
                        <div className="mf-email-preview-label">VORSCHAU — MASSENBENACHRICHTIGUNG</div>
                        <button
                          onClick={sendeTestMail}
                          disabled={testMailLoading || !massenDatum}
                          className={`ds-btn ds-btn--xs ${testMailSent ? 'ds-btn--success' : 'ds-btn--ghost'}`}
                        >
                          {testMailLoading ? 'Sende…' : testMailSent ? '✓ Test-Mail gesendet' : '✉ Test-Mail an mich'}
                        </button>
                      </div>
                      <div className="mf-email-preview-box">
                        {VORLAGEN[massenVorlage].preview}
                      </div>
                    </div>

                    {/* Kündigungsantwort — nur bei kommerziell + koennte5Prozent */}
                    {massenOrgTyp === 'kommerziell' && koennte5Prozent && (() => {
                      const kuendigungsText = `Sehr geehrte/r [Vorname] [Nachname],

vielen Dank für Ihre Nachricht bezüglich der Beitragsanpassung zum ${datumFormatiert}.

Wir verstehen, dass eine Anpassung des Mitgliedsbeitrags immer einer sorgfältigen Überlegung wert ist, und schätzen Ihre offene Rückmeldung.

Die vorgenommene Anpassung basiert auf unserer Mitgliedschaftsvereinbarung, die uns berechtigt, die Beiträge entsprechend der wirtschaftlichen Entwicklung anzupassen. Diese Anpassung erfolgt transparent und mit ausreichendem Vorlauf, wie in unseren AGB vorgesehen.

Ein Sonderkündigungsrecht infolge dieser Beitragsanpassung ist in Ihrem aktuellen Vertrag nicht vorgesehen. Ihre regulären Kündigungsrechte und -fristen bleiben selbstverständlich vollständig unberührt.

Wir würden uns sehr freuen, Sie weiterhin in unserem Dojo begrüßen zu dürfen. Für ein persönliches Gespräch stehen wir Ihnen jederzeit gerne zur Verfügung.

Mit freundlichen Grüßen
[Dojo-Name]`;

                      return (
                        <div className="mf-kuendigung-box">
                          <div className="mf-kuendigung-header">
                            <div>
                              <div className="mf-kuendigung-title">Antwortvorlage bei Kündigungsanfragen</div>
                              <div className="mf-kuendigung-subtitle">Individuelle Antwort — nicht für Massenversand</div>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(kuendigungsText);
                                setKuendigungKopiert(true);
                                setTimeout(() => setKuendigungKopiert(false), 2500);
                              }}
                              className={`ds-btn ds-btn--sm ${kuendigungKopiert ? 'ds-btn--success' : ''}`}
                              style={kuendigungKopiert ? {} : { background: 'rgba(251,146,60,0.15)', borderColor: 'rgba(251,146,60,0.3)', color: 'rgba(251,146,60,0.9)' }}
                            >
                              {kuendigungKopiert ? '✓ Kopiert' : 'Kopieren'}
                            </button>
                          </div>
                          <div className="mf-kuendigung-content">
                            {kuendigungsText}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* ── STEP 4: Terminieren & Versand ── */}
                {massenStep === 4 && (
                  <div className="mf-col-gap-xl">

                    {/* Zusammenfassung */}
                    <div className="mf-summary-box">
                      <div className="mf-summary-title">ZUSAMMENFASSUNG</div>
                      {(() => {
                        const einheitLabel = massenTyp === 'prozent'
                          ? `+${massenProzent} %`
                          : massenTyp === 'kombination'
                            ? `+${massenErhoehung} € (max. ${massenProzent} %)`
                            : `+${betrag.toFixed(2).replace('.', ',')} €/Monat`;
                        const aktiveAnzahl = vorschauData ? vorschauData.length - ausgeschlossen.size : '–';
                        const dojoLabel = activeDojo === 'super-admin'
                          ? 'Alle Dojos (Super-Admin)'
                          : activeDojo === 'verband'
                            ? 'Verband'
                            : activeDojo?.dojoname || '–';
                        return [
                          ['Dojo', dojoLabel],
                          ['Erhöhung', einheitLabel],
                          ['Gültig ab', datumFormatiert],
                          ['Vorlage', VORLAGEN[massenVorlage]?.name || massenVorlage],
                          ['Betroffene Mitglieder', `${aktiveAnzahl} Mitglieder`],
                          ...(ausgeschlossen.size > 0 ? [['Ausgeschlossen', `${ausgeschlossen.size} Mitglieder`]] : [])
                        ];
                      })().map(([k, v]) => (
                        <div key={k} className="mf-summary-row">
                          <span className="mf-summary-key">{k}</span>
                          <span className="mf-summary-val">{v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Primäre Aktion: Terminieren + Benachrichtigen */}
                    <div className={`mf-action-box ${terminiertResult ? (terminiertResult.emailWarning ? 'mf-action-box--warning' : 'mf-action-box--success') : 'mf-action-box--indigo'}`}>
                      <div className={`mf-action-title ${terminiertResult ? (terminiertResult.emailWarning ? 'mf-action-title--warning' : 'mf-action-title--success') : 'mf-action-title--indigo'}`}>
                        {terminiertResult ? (terminiertResult.emailWarning ? '⚠ Terminiert — einige E-Mails fehlgeschlagen' : '✓ Erhöhung terminiert & Mitglieder informiert') : '🗓 Erhöhung terminieren & Mitglieder informieren'}
                      </div>
                      {terminiertResult ? (
                        <div className="mf-col-gap-sm mf-result-mt">
                          <div className="mf-result-primary">
                            <span className="mf-result-success-num">{terminiertResult.terminiert}</span> Verträge terminiert — Änderung wird am {datumFormatiert} automatisch angewendet
                          </div>
                          <div className="mf-result-meta-row">
                            <span>✉ {terminiertResult.sent} E-Mails gesendet</span>
                            {terminiertResult.pushSent > 0 && <span>🔔 {terminiertResult.pushSent} Push gesendet</span>}
                            {terminiertResult.failed > 0 && <span className="u-text-error">⚠ {terminiertResult.failed} fehlgeschlagen</span>}
                            {terminiertResult.noEmail > 0 && <span className="mf-result-disabled-txt">{terminiertResult.noEmail} ohne E-Mail</span>}
                          </div>
                          <div className="mf-row-gap-sm mf-flex-wrap mf-result-actions-mt">
                            <button
                              onClick={storniereTerminierung}
                              disabled={massenLoading}
                              className="ds-btn ds-btn--danger ds-btn--sm"
                            >
                              Terminierung zurückziehen
                            </button>
                            <button
                              onClick={sendBenachrichtigung}
                              disabled={massenLoading}
                              className="ds-btn ds-btn--ghost ds-btn--sm"
                            >
                              {massenLoading ? 'Sendet…' : '✉ Erinnerung erneut senden'}
                            </button>
                          </div>
                          {massenResult && (
                            <div className="mf-reminder-result">
                              ✓ Erinnerung: {massenResult.sent} E-Mails
                              {massenResult.pushSent > 0 && ` · ${massenResult.pushSent} Push`}
                              {massenResult.failed > 0 && <span className="u-text-error"> · {massenResult.failed} fehlgeschlagen</span>}
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <p className="mf-action-desc">
                            Speichert die geplante Erhöhung für jeden betroffenen Vertrag und sendet sofort E-Mail + Push-Benachrichtigung. Am {datumFormatiert} wird der neue Betrag automatisch aktiviert.
                          </p>
                          <button
                            onClick={terminierungUndBenachrichtigung}
                            disabled={massenLoading}
                            className="ds-btn ds-btn--indigo ds-btn--lg"
                          >
                            {massenLoading ? 'Läuft…' : '🗓 Terminieren & Mitglieder informieren'}
                          </button>
                        </>
                      )}
                    </div>

                    {/* Sekundär: Sofort anwenden (manuell) */}
                    {!terminiertResult && (
                      <div className="mf-manual-box">
                        <div className="mf-manual-subtitle">
                          Manuelle Sofortanwendung
                        </div>
                        <p className="mf-manual-desc">
                          Ändert die Vertragsbeträge sofort — ohne Terminierung und ohne automatische Benachrichtigung.
                        </p>
                        <div className="mf-row-gap-sm mf-flex-wrap">
                          {massenAngewendet ? (
                            <div className="mf-manual-success">
                              <Check size={13} /> Sofort angewendet
                            </div>
                          ) : (
                            <button onClick={applyMassenErhoehung} disabled={massenLoading} className="ds-btn ds-btn--ghost ds-btn--sm">
                              {massenLoading ? 'Läuft…' : 'Sofort anwenden (ohne Benachrichtigung)'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="ds-modal-footer ds-modal-footer--spread">
                <button onClick={() => massenStep > 1 ? setMassenStep(s => s - 1) : setMassenModal(false)} className="ds-btn ds-btn--ghost ds-btn--sm">
                  {massenStep > 1 ? '← Zurück' : 'Schließen'}
                </button>
                {massenStep < 4 && (() => {
                  const canGo = massenStep === 1 ? canStep2 : massenStep === 2 ? canStep3 : !!massenVorlage;
                  const handleWeiter = async () => {
                    if (massenStep === 1) {
                      // Vorschau laden
                      setVorschauLoading(true);
                      setVorschauData(null);
                      setAusgeschlossen(new Set());
                      try {
                        const dojoParam = getDojoFilterParam();
                        const qs = new URLSearchParams({
                          typ: massenTyp,
                          erhoehung: massenErhoehung || '0',
                          erhoehungProzent: massenProzent || '0',
                          ...(dojoParam ? Object.fromEntries(new URLSearchParams(dojoParam)) : {})
                        });
                        const resp = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/filter/tarif-abweichung/vorschau?${qs}`);
                        const data = await resp.json();
                        setVorschauData(Array.isArray(data) ? data : []);
                      } catch(e) { setVorschauData([]); }
                      setVorschauLoading(false);
                    }
                    setMassenStep(s => s + 1);
                  };
                  return (
                    <button onClick={handleWeiter} disabled={!canGo || vorschauLoading} className="ds-btn ds-btn--ghost ds-btn--sm">
                      {vorschauLoading ? 'Lade…' : 'Weiter →'}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        , document.body);
      })()}
    </div>
  );
};

export default MitgliederFilter;
