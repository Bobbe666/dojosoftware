import React, { useState, useEffect } from "react";
import {
  DollarSign,
  Package,
  Percent,
  Users,
  Calendar,
  Settings,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Tag,
  Clock,
  CreditCard,
  Calculator,
  ChevronDown,
  ChevronUp,
  Baby,
  User,
  GraduationCap
} from "lucide-react";
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/TarifePreise.css";

function translateBillingCycle(cycle) {
  if (!cycle) return '';
  const cycleMap = {
    'monthly': 'Monatlich', 'monatlich': 'Monatlich',
    'quarterly': 'Vierteljährlich', 'vierteljaehrlich': 'Vierteljährlich',
    'semi-annually': 'Halbjährlich', 'halbjaehrlich': 'Halbjährlich',
    'annually': 'Jährlich', 'jaehrlich': 'Jährlich', 'yearly': 'Jährlich'
  };
  return cycleMap[cycle.toLowerCase()] || cycle;
}

const TarifePreise = () => {
  const { activeDojo } = useDojoContext();
  const [tarife, setTarife] = useState([]);
  const [rabatte, setRabatte] = useState([]);
  const [zahlungszyklen, setZahlungszyklen] = useState([]);
  const [laufzeiten, setLaufzeiten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTarif, setEditingTarif] = useState(null);
  const [editingRabatt, setEditingRabatt] = useState(null);
  const [showNewTarif, setShowNewTarif] = useState(false);
  const [showNewRabatt, setShowNewRabatt] = useState(false);
  const [showNewIndividuell, setShowNewIndividuell] = useState(false);
  const [dojoSettings, setDojoSettings] = useState({
    vertragsmodell: 'gesetzlich',
    beitragsgarantie_bei_nichtverlaengerung: 'aktueller_tarif',
    verlaengerung_erinnerung_tage: 60,
    verlaengerung_erinnerung2_tage: 30,
    verlaengerung_erinnerung3_tage: 14,
    kuendigungsfrist_monate: 3,
    mindestlaufzeit_monate: 12,
    verlaengerung_monate: 12,
    ruhepause_max_monate: 3,
    kuendigung_nur_monatsende: false,
    kuendigung_schriftlich: false
  });
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const getDojoId = () => {
    if (!activeDojo || activeDojo === 'super-admin') return null;
    return activeDojo.id;
  };

  const [newIndividuell, setNewIndividuell] = useState({
    name: "", duration_months: "", mindestlaufzeit_monate: "",
    kuendigungsfrist_monate: "", price_cents: "", aufnahmegebuehr_cents: 4999
  });

  const [newTarif, setNewTarif] = useState({
    name: "", price_cents: "", aufnahmegebuehr_cents: 4999,
    currency: "EUR", duration_months: "", mindestlaufzeit_monate: "",
    kuendigungsfrist_monate: 3, billing_cycle: "monthly",
    payment_method: "bank_transfer", active: true
  });

  const [newRabatt, setNewRabatt] = useState({
    name: "", beschreibung: "", rabatt_prozent: "",
    gueltig_von: "", gueltig_bis: "", max_nutzungen: "", aktiv: true
  });

  // ── Starterpakete State ──────────────────────────────────────────
  const [starterpakete, setStarterpakete] = useState([]);
  const [spStile, setSpStile] = useState([]);
  const [spArtikel, setSpArtikel] = useState([]);
  const [spArtikelLoading, setSpArtikelLoading] = useState(false);
  const [editingSp, setEditingSp] = useState(null);
  const [expandedSpId, setExpandedSpId] = useState(null);
  const [spSaving, setSpSaving] = useState(false);
  const [addingPosForId, setAddingPosForId] = useState(null);
  const [newSp, setNewSp] = useState({
    stil_id: '', name: '', beschreibung: '',
    hinweis: 'Für ein einheitliches Auftreten, ein starkes Teamgefühl und die Einhaltung unserer Qualitäts- und Sicherheitsstandards bitten wir darum, im Training sowie insbesondere bei Wettkämpfen ausschließlich Ausrüstung zu verwenden, die über unsere Schule bzw. unsere offiziellen Partner bezogen wurde. So stellen wir sicher, dass alle Mitglieder mit geprüfter, passender und einheitlicher Ausrüstung trainieren und auftreten. Vielen Dank für euer Verständnis und eure Unterstützung unseres gemeinsamen Auftritts als Team.',
    rabatt_prozent: 0, aktiv: true
  });
  const [newPos, setNewPos] = useState({ artikel_id: null, bezeichnung: '', menge: 1, einzelpreis_cent: '', pflicht: true });
  const [showNewSp, setShowNewSp] = useState(false);
  const [activeTab, setActiveTab] = useState('tarife');
  const [tarifeFilter, setTarifeFilter] = useState('alle');
  const [catCollapsed, setCatCollapsed] = useState({ kinder: false, studenten: false, erwachsene: false, familien: false, sonstige: false, archiviert: true });

  useEffect(() => {
    loadTarifeUndRabatte();
    loadDojoSettings();
    loadStarterpakete();
  }, [activeDojo]);

  const loadTarifeUndRabatte = async () => {
    try {
      setLoading(true);
      const dojoId = getDojoId();
      const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';
      const [tarifeResponse, rabatteResponse, zahlungszyklenResponse, laufzeitenResponse] = await Promise.all([
        axios.get(`/tarife${dojoParam}`),
        axios.get(`/tarife/rabatte${dojoParam}`),
        axios.get(`/zahlungszyklen${dojoParam}`).catch(() => ({ data: { data: [] } })),
        axios.get(`/laufzeiten${dojoParam}`).catch(() => ({ data: { data: [] } }))
      ]);
      const tarifeData = tarifeResponse.data;
      const rabatteData = rabatteResponse.data;
      if (tarifeData.success && rabatteData.success) {
        const mappedTarife = tarifeData.data.map(tarif => ({
          id: tarif.id,
          name: tarif.name,
          price_euros: (tarif.price_cents / 100).toFixed(2),
          price_cents: tarif.price_cents,
          aufnahmegebuehr_euros: ((tarif.aufnahmegebuehr_cents || 4999) / 100).toFixed(2),
          aufnahmegebuehr_cents: tarif.aufnahmegebuehr_cents || 4999,
          currency: tarif.currency || 'EUR',
          duration_months: tarif.duration_months,
          billing_cycle: tarif.billing_cycle,
          payment_method: tarif.payment_method,
          active: tarif.active === 1,
          ist_archiviert: tarif.ist_archiviert === 1 || tarif.ist_archiviert === true,
          nachfolger_tarif_id: tarif.nachfolger_tarif_id,
          isChildRate: (tarif.name.toLowerCase().includes('kinder') ||
                       tarif.name.toLowerCase().includes('kids') ||
                       tarif.name.toLowerCase().includes('jugendliche')) &&
                       !tarif.name.toLowerCase().includes('studenten') &&
                       !tarif.name.toLowerCase().includes('schüler'),
          isStudentRate: tarif.name.toLowerCase().includes('studenten') ||
                        tarif.name.toLowerCase().includes('schüler') ||
                        tarif.name.toLowerCase().includes('kids'),
          isAdultRate: tarif.name.toLowerCase().includes('erwachsene') ||
                      tarif.name.toLowerCase().includes('18+'),
          isFamilienRate: tarif.name.toLowerCase().includes('famili')
        }));
        const mappedRabatte = rabatteData.data.map(rabatt => ({
          id: rabatt.rabatt_id, name: rabatt.name, beschreibung: rabatt.beschreibung,
          rabatt_prozent: parseFloat(rabatt.rabatt_prozent), gueltig_von: rabatt.gueltig_von,
          gueltig_bis: rabatt.gueltig_bis, max_nutzungen: rabatt.max_nutzungen,
          aktiv: rabatt.aktiv === 1, genutzt: rabatt.genutzt || 0
        }));
        setTarife(mappedTarife);
        setRabatte(mappedRabatte);
        setZahlungszyklen(zahlungszyklenResponse.data.data || []);
        setLaufzeiten(laufzeitenResponse.data.data || []);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Tarife und Rabatte:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Starterpakete: Laden + CRUD ──────────────────────────────────
  const loadStarterpakete = async () => {
    const dojoId = getDojoId();
    const p = dojoId ? `?dojo_id=${dojoId}` : '';
    try {
      const [pkRes, stRes] = await Promise.all([
        axios.get(`/starterpakete${p}`).catch(() => null),
        axios.get(`/stile?aktiv=true${dojoId ? `&dojo_id=${dojoId}` : ''}`).catch(() => null),
      ]);
      if (pkRes?.data?.success) setStarterpakete(pkRes.data.pakete || []);
      if (stRes?.data) {
        const arr = Array.isArray(stRes.data) ? stRes.data : (stRes.data.data || []);
        setSpStile(arr.filter(s => s.aktiv !== 0 && s.aktiv !== false));
      }
    } catch (err) {
      console.error('Starterpakete laden Fehler:', err);
    }
  };

  const openAddPos = async (paketId, dojoIdFromPaket) => {
    setAddingPosForId(paketId);
    setNewPos({ artikel_id: null, bezeichnung: '', menge: 1, einzelpreis_cent: '', pflicht: true });
    setSpArtikel([]);
    setSpArtikelLoading(true);
    try {
      const id = dojoIdFromPaket || getDojoId();
      const res = await axios.get(`/starterpakete/artikel-options${id ? `?dojo_id=${id}` : ''}`);
      setSpArtikel(res.data?.artikel || []);
    } catch (e) {
      console.error('Artikel-Load Fehler:', e?.response?.status, e?.message);
    } finally {
      setSpArtikelLoading(false);
    }
  };

  const handleCreateSp = async () => {
    if (!newSp.stil_id || !newSp.name) return;
    setSpSaving(true);
    const dojoId = getDojoId();
    const p = dojoId ? `?dojo_id=${dojoId}` : '';
    try {
      const r = await axios.post(`/starterpakete${p}`, { ...newSp, stil_id: parseInt(newSp.stil_id) });
      if (r.data.success) {
        setStarterpakete(prev => [...prev, r.data.paket]);
        setShowNewSp(false);
        setNewSp({ stil_id: '', name: '', beschreibung: '', hinweis: 'Für ein einheitliches Auftreten, ein starkes Teamgefühl und die Einhaltung unserer Qualitäts- und Sicherheitsstandards bitten wir darum, im Training sowie insbesondere bei Wettkämpfen ausschließlich Ausrüstung zu verwenden, die über unsere Schule bzw. unsere offiziellen Partner bezogen wurde. So stellen wir sicher, dass alle Mitglieder mit geprüfter, passender und einheitlicher Ausrüstung trainieren und auftreten. Vielen Dank für euer Verständnis und eure Unterstützung unseres gemeinsamen Auftritts als Team.', rabatt_prozent: 0, aktiv: true });
      }
    } catch (err) { console.error(err); }
    finally { setSpSaving(false); }
  };

  const handleUpdateSp = async () => {
    if (!editingSp || !editingSp.name) return;
    setSpSaving(true);
    const dojoId = getDojoId();
    const p = dojoId ? `?dojo_id=${dojoId}` : '';
    try {
      const r = await axios.put(`/starterpakete/${editingSp.paket_id}${p}`, editingSp);
      if (r.data.success) {
        setStarterpakete(prev => prev.map(x => x.paket_id === editingSp.paket_id ? r.data.paket : x));
        setEditingSp(null);
      }
    } catch (err) { console.error(err); }
    finally { setSpSaving(false); }
  };

  const handleDeleteSp = async (paketId) => {
    if (!window.confirm('Starterpaket wirklich löschen?')) return;
    const dojoId = getDojoId();
    const p = dojoId ? `?dojo_id=${dojoId}` : '';
    try {
      await axios.delete(`/starterpakete/${paketId}${p}`);
      setStarterpakete(prev => prev.filter(x => x.paket_id !== paketId));
      if (expandedSpId === paketId) setExpandedSpId(null);
    } catch (err) { console.error(err); }
  };

  const handleAddPos = async (paketId) => {
    if (!newPos.bezeichnung || newPos.einzelpreis_cent === '') return;
    setSpSaving(true);
    const dojoId = getDojoId();
    const p = dojoId ? `?dojo_id=${dojoId}` : '';
    try {
      const r = await axios.post(`/starterpakete/${paketId}/positionen${p}`, {
        ...newPos,
        einzelpreis_cent: Math.round(parseFloat(String(newPos.einzelpreis_cent).replace(',', '.')) * 100),
      });
      if (r.data.success) {
        setStarterpakete(prev => prev.map(x => x.paket_id === paketId ? r.data.paket : x));
        if (editingSp?.paket_id === paketId) setEditingSp(r.data.paket);
        setNewPos({ artikel_id: null, bezeichnung: '', menge: 1, einzelpreis_cent: '', pflicht: true });
        setAddingPosForId(null);
      }
    } catch (err) { console.error(err); }
    finally { setSpSaving(false); }
  };

  const handleDeletePos = async (paketId, posId) => {
    const dojoId = getDojoId();
    const p = dojoId ? `?dojo_id=${dojoId}` : '';
    try {
      const r = await axios.delete(`/starterpakete/${paketId}/positionen/${posId}${p}`);
      if (r.data.success) {
        setStarterpakete(prev => prev.map(x => x.paket_id === paketId ? r.data.paket : x));
        if (editingSp?.paket_id === paketId) setEditingSp(r.data.paket);
      }
    } catch (err) { console.error(err); }
  };

  const loadDojoSettings = async () => {
    const dojoId = getDojoId();
    if (!dojoId) return;
    try {
      const res = await axios.get(`/dojo${dojoId ? `?dojo_id=${dojoId}` : ''}`);
      if (res.data?.success && res.data?.dojo) {
        const d = res.data.dojo;
        setDojoSettings({
          vertragsmodell: d.vertragsmodell || 'gesetzlich',
          beitragsgarantie_bei_nichtverlaengerung: d.beitragsgarantie_bei_nichtverlaengerung || 'aktueller_tarif',
          verlaengerung_erinnerung_tage: d.verlaengerung_erinnerung_tage || 60,
          verlaengerung_erinnerung2_tage: d.verlaengerung_erinnerung2_tage || 30,
          verlaengerung_erinnerung3_tage: d.verlaengerung_erinnerung3_tage || 14,
          kuendigungsfrist_monate: d.kuendigungsfrist_monate || 3,
          mindestlaufzeit_monate: d.mindestlaufzeit_monate || 12,
          verlaengerung_monate: d.verlaengerung_monate || 12,
          ruhepause_max_monate: d.ruhepause_max_monate || 3,
          kuendigung_nur_monatsende: !!d.kuendigung_nur_monatsende,
          kuendigung_schriftlich: !!d.kuendigung_schriftlich
        });
      }
    } catch (e) {}
  };

  const saveDojoSettings = async () => {
    const dojoId = getDojoId();
    if (!dojoId) return;
    setSavingSettings(true);
    try {
      await axios.put(`/dojo${dojoId ? `?dojo_id=${dojoId}` : ''}`, dojoSettings);
      setIsEditingSettings(false);
    } catch (e) {}
    setSavingSettings(false);
  };

  const handleSaveTarif = async (tarifData) => {
    try {
      const dojoId = getDojoId();
      const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';
      let response;
      if (tarifData.id) {
        response = await axios.put(`/tarife/${tarifData.id}${dojoParam}`, tarifData);
      } else {
        response = await axios.post(`/tarife${dojoParam}`, tarifData);
      }
      if (response.data.success) {
        await loadTarifeUndRabatte();
        setShowNewTarif(false);
        setEditingTarif(null);
        setNewTarif({ name: "", price_cents: "", aufnahmegebuehr_cents: 4999, currency: "EUR", duration_months: "", billing_cycle: "monthly", payment_method: "bank_transfer", active: true });
      } else {
        alert('Fehler beim Speichern: ' + response.data.error);
      }
    } catch (error) {
      alert('Fehler beim Speichern des Tarifs');
    }
  };

  const handleDeleteTarif = async (tarifId) => {
    if (window.confirm('Sind Sie sicher, dass Sie diesen Tarif löschen möchten?')) {
      try {
        const dojoId = getDojoId();
        const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';
        const response = await axios.delete(`/tarife/${tarifId}${dojoParam}`);
        if (response.data.success) {
          await loadTarifeUndRabatte();
        } else {
          alert('Fehler beim Löschen: ' + response.data.error);
        }
      } catch (error) {
        alert('Fehler beim Löschen des Tarifs');
      }
    }
  };

  const handleArchiveTarif = async (tarifId, currentStatus) => {
    const newStatus = !currentStatus;
    const confirmMessage = newStatus
      ? 'Diesen Tarif als "Alter Tarif" markieren? Er wird dann nicht mehr für neue Mitglieder verfügbar sein.'
      : 'Diesen Tarif reaktivieren? Er wird dann wieder für neue Mitglieder verfügbar sein.';
    if (window.confirm(confirmMessage)) {
      try {
        const dojoId = getDojoId();
        const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';
        const response = await axios.put(`/api/tarife/${tarifId}/archivieren${dojoParam}`, { ist_archiviert: newStatus });
        if (response.data.success) {
          await loadTarifeUndRabatte();
        } else {
          alert('Fehler beim Archivieren: ' + response.data.error);
        }
      } catch (error) {
        alert('Fehler beim Archivieren des Tarifs');
      }
    }
  };

  const handleSetNachfolger = async (tarifId) => {
    const tarif = tarife.find(t => t.id === tarifId);
    if (!tarif) return;
    const aktiveTarife = tarife.filter(t => !t.ist_archiviert && t.id !== tarifId);
    if (aktiveTarife.length === 0) {
      alert('Keine aktiven Tarife verfügbar. Bitte erstellen Sie zuerst einen neuen Tarif.');
      return;
    }
    const options = aktiveTarife.map(t => `${t.id}: ${t.name} (€${t.price_euros}/Monat)`).join('\n');
    const nachfolgerId = prompt(`Nachfolger-Tarif für "${tarif.name}" festlegen:\n\n${options}\n\nBitte Tarif-ID eingeben (oder leer lassen zum Entfernen):`);
    if (nachfolgerId === null) return;
    const nachfolgerTarifId = nachfolgerId.trim() === '' ? null : parseInt(nachfolgerId, 10);
    try {
      const dojoId = getDojoId();
      const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';
      const response = await axios.put(`/api/tarife/${tarifId}/nachfolger${dojoParam}`, { nachfolger_tarif_id: nachfolgerTarifId });
      if (response.data.success) {
        alert(nachfolgerTarifId ? 'Nachfolger-Tarif erfolgreich zugewiesen!' : 'Nachfolger-Tarif entfernt');
        await loadTarifeUndRabatte();
      } else {
        alert('Fehler beim Zuweisen: ' + response.data.error);
      }
    } catch (error) {
      alert('Fehler beim Zuweisen des Nachfolger-Tarifs');
    }
  };

  const handleMigrateContracts = async (tarifId) => {
    const tarif = tarife.find(t => t.id === tarifId);
    if (!tarif) return;
    const nachfolger = tarif.nachfolger_tarif_id ? tarife.find(t => t.id === tarif.nachfolger_tarif_id) : null;
    let zielTarifId;
    if (nachfolger) {
      const useNachfolger = window.confirm(
        `Alle aktiven Verträge von "${tarif.name}" auf den Nachfolger-Tarif "${nachfolger.name}" (€${nachfolger.price_euros}/Monat) umstellen?\n\nDies betrifft ALLE Mitglieder mit diesem Tarif!`
      );
      if (!useNachfolger) return;
      zielTarifId = nachfolger.id;
    } else {
      const aktiveTarife = tarife.filter(t => !t.ist_archiviert && t.id !== tarifId);
      if (aktiveTarife.length === 0) {
        alert('Keine aktiven Tarife verfügbar.');
        return;
      }
      const options = aktiveTarife.map(t => `${t.id}: ${t.name} (€${t.price_euros}/Monat)`).join('\n');
      const inputId = prompt(`ALLE aktiven Verträge von "${tarif.name}" umstellen auf:\n\n${options}\n\nBitte Ziel-Tarif-ID eingeben:`);
      if (!inputId) return;
      zielTarifId = parseInt(inputId, 10);
    }
    try {
      const dojoId = getDojoId();
      const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';
      const response = await axios.post(`/api/tarife/${tarifId}/migrate-contracts${dojoParam}`, { ziel_tarif_id: zielTarifId });
      if (response.data.success) {
        alert(`✅ ${response.data.message}\n\nAnzahl migriert: ${response.data.anzahl_migriert}\nNeuer Monatsbeitrag: €${response.data.neuer_monatsbeitrag}`);
        await loadTarifeUndRabatte();
      } else {
        alert('Fehler bei der Migration: ' + response.data.error);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || 'Unbekannter Fehler';
      alert(`Fehler bei der Vertrags-Migration: ${errorMsg}`);
    }
  };

  const getFilteredTarife = () => {
    switch (tarifeFilter) {
      case 'kinder': return tarife.filter(t => t.isChildRate && !t.ist_archiviert);
      case 'studenten': return tarife.filter(t => t.isStudentRate && !t.ist_archiviert);
      case 'erwachsene': return tarife.filter(t => t.isAdultRate && !t.ist_archiviert);
      case 'familien': return tarife.filter(t => t.isFamilienRate && !t.isChildRate && !t.isStudentRate && !t.isAdultRate && !t.ist_archiviert);
      case 'sonstige': return tarife.filter(t => !t.isChildRate && !t.isStudentRate && !t.isAdultRate && !t.isFamilienRate && !t.ist_archiviert);
      case 'archiviert': return tarife.filter(t => t.ist_archiviert);
      default: return tarife.filter(t => !t.ist_archiviert);
    }
  };

  if (loading) {
    return (
      <div className="tarife-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Lade Tarif-Daten...</p>
        </div>
      </div>
    );
  }

  // ── Inline CategorySection (Accordion) ───────────────────────────
  const CategorySection = ({ title, icon, items, catKey }) => {
    if (items.length === 0) return null;
    const collapsed = catCollapsed[catKey];
    return (
      <div className="tc-cat-section">
        <button className="tc-cat-header" onClick={() => setCatCollapsed(p => ({ ...p, [catKey]: !p[catKey] }))}>
          <div className="tc-cat-title">
            {icon}
            <span>{title}</span>
            <span className="tc-cat-count">{items.length}</span>
          </div>
          <ChevronDown size={15} className={`tc-cat-chevron${collapsed ? '' : ' open'}`} />
        </button>
        {!collapsed && (
          <div className="tc-grid tc-grid--cat">
            {items.map(tarif => <TarifCard key={tarif.id} tarif={tarif} />)}
          </div>
        )}
      </div>
    );
  };

  // ── Inline TarifCard ──────────────────────────────────────────────
  const TarifCard = ({ tarif }) => (
    <div className={`tc-card${tarif.ist_archiviert ? ' tc-card--archived' : ''}`}>
      {/* Hero: Preis */}
      <div className="tc-card-hero">
        <div className="tc-card-price-block">
          <span className="tc-price-val">€{tarif.price_euros}</span>
          <span className="tc-price-period">/Mo.</span>
        </div>
      </div>

      {/* Name */}
      <div className="tc-card-name">{tarif.name}</div>

      {/* Details */}
      <div className="tc-card-details">
        <div className="tc-detail">
          <Calendar size={11} />
          <span>{tarif.duration_months} Monate Laufzeit</span>
        </div>
        <div className="tc-detail">
          <Clock size={11} />
          <span>{translateBillingCycle(tarif.billing_cycle)}</span>
        </div>
        <div className="tc-detail">
          <CreditCard size={11} />
          <span>Aufnahme €{tarif.aufnahmegebuehr_euros}</span>
        </div>
      </div>

      {/* Footer: Status + Aktionen */}
      <div className="tc-card-footer">
        <span className={`tc-status-badge${tarif.ist_archiviert ? ' archived' : tarif.active ? ' active' : ' inactive'}`}>
          <span className="tc-status-dot" />
          {tarif.ist_archiviert ? 'Archiviert' : tarif.active ? 'Aktiv' : 'Inaktiv'}
        </span>
        <div className="tc-card-actions">
          <button className="action-btn edit" onClick={() => setEditingTarif(tarif)} title="Bearbeiten"><Edit size={13} /></button>
          <button className="action-btn delete" onClick={() => handleDeleteTarif(tarif.id)} title="Löschen"><Trash2 size={13} /></button>
          <button
            className={`action-btn archive${tarif.ist_archiviert ? ' is-archived' : ''}`}
            onClick={() => handleArchiveTarif(tarif.id, tarif.ist_archiviert)}
            title={tarif.ist_archiviert ? "Reaktivieren" : "Archivieren"}
          >
            {tarif.ist_archiviert ? '↺' : '▣'}
          </button>
        </div>
      </div>

      {tarif.ist_archiviert && (
        <div className="tc-card-archive-row">
          <button className="tc-archive-btn" onClick={() => handleSetNachfolger(tarif.id)}>
            {tarif.nachfolger_tarif_id ? '✏️ Nachfolger' : '➕ Nachfolger'}
          </button>
          <button className="tc-archive-btn tc-archive-btn--green" onClick={() => handleMigrateContracts(tarif.id)}>
            🔄 Migration
          </button>
        </div>
      )}
      {tarif.nachfolger_tarif_id && tarif.ist_archiviert && (
        <div className="tc-card-nachfolger">
          ➜ {tarife.find(t => t.id === tarif.nachfolger_tarif_id)?.name || `ID ${tarif.nachfolger_tarif_id}`}
        </div>
      )}
    </div>
  );

  return (
    <div className="tarife-container">

      {/* ─── Page Header ─────────────────────────────── */}
      <div className="tarife-page-header">
        <div className="tarife-page-header-icon"><DollarSign size={18} /></div>
        <div>
          <h1>Tarife & Preise</h1>
          <p>Mitgliedstarife, Starterpakete und Vertragsbedingungen verwalten</p>
        </div>
      </div>

      {/* ─── Tab Navigation ──────────────────────────── */}
      <div className="tarife-tab-nav">
        <button className={`tarife-tab-btn${activeTab === 'tarife' ? ' active' : ''}`} onClick={() => setActiveTab('tarife')}>
          <Package size={14} />
          Tarife
          <span className="tarife-tab-count">{tarife.filter(t => !t.ist_archiviert).length}</span>
        </button>
        <button className={`tarife-tab-btn${activeTab === 'starterpakete' ? ' active' : ''}`} onClick={() => setActiveTab('starterpakete')}>
          <span>🎁</span>
          Starterpakete
          {starterpakete.length > 0 && <span className="tarife-tab-count">{starterpakete.length}</span>}
        </button>
        <button className={`tarife-tab-btn${activeTab === 'einstellungen' ? ' active' : ''}`} onClick={() => setActiveTab('einstellungen')}>
          <Settings size={14} />
          Vertragseinstellungen
        </button>
      </div>

      {/* ═══════════ TAB: TARIFE ═══════════ */}
      {activeTab === 'tarife' && (
        <>
          {/* Kompakter Stats-Strip */}
          <div className="tc-stats-strip">
            <div className="tc-stat">
              <span className="tc-stat-val">{tarife.filter(t => !t.ist_archiviert && t.active).length}</span>
              <span className="tc-stat-lbl">Aktive Tarife</span>
            </div>
            <div className="tc-stat-div" />
            <div className="tc-stat">
              <span className="tc-stat-val">{tarife.filter(t => t.isChildRate && !t.ist_archiviert).length}</span>
              <span className="tc-stat-lbl">Kinder</span>
            </div>
            <div className="tc-stat-div" />
            <div className="tc-stat">
              <span className="tc-stat-val">{tarife.filter(t => t.isStudentRate && !t.ist_archiviert).length}</span>
              <span className="tc-stat-lbl">Studenten</span>
            </div>
            <div className="tc-stat-div" />
            <div className="tc-stat">
              <span className="tc-stat-val">{tarife.filter(t => t.isAdultRate && !t.ist_archiviert).length}</span>
              <span className="tc-stat-lbl">Erwachsene</span>
            </div>
            <div className="tc-stat-div" />
            <div className="tc-stat">
              <span className="tc-stat-val tc-stat-val--gold">
                €{tarife.filter(t => !t.ist_archiviert).length > 0
                  ? (tarife.filter(t => !t.ist_archiviert).reduce((s, t) => s + parseFloat(t.price_euros), 0) / tarife.filter(t => !t.ist_archiviert).length).toFixed(2)
                  : '0.00'}
              </span>
              <span className="tc-stat-lbl">Ø Beitrag/Mo.</span>
            </div>
          </div>

          {/* Toolbar: Filter-Pills + Aktionen */}
          <div className="tarife-toolbar">
            <div className="tarife-filter-pills">
              {[
                { key: 'alle', label: 'Alle', count: tarife.filter(t => !t.ist_archiviert).length },
                { key: 'kinder', label: 'Kinder', count: tarife.filter(t => t.isChildRate && !t.ist_archiviert).length },
                { key: 'studenten', label: 'Studenten', count: tarife.filter(t => t.isStudentRate && !t.ist_archiviert).length },
                { key: 'erwachsene', label: 'Erwachsene', count: tarife.filter(t => t.isAdultRate && !t.ist_archiviert).length },
                { key: 'familien', label: 'Familien', count: tarife.filter(t => t.isFamilienRate && !t.isChildRate && !t.isStudentRate && !t.isAdultRate && !t.ist_archiviert).length },
                { key: 'sonstige', label: 'Sonstige', count: tarife.filter(t => !t.isChildRate && !t.isStudentRate && !t.isAdultRate && !t.isFamilienRate && !t.ist_archiviert).length },
                { key: 'archiviert', label: 'Archiviert', count: tarife.filter(t => t.ist_archiviert).length },
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  className={`tarife-filter-pill${tarifeFilter === key ? ' active' : ''}`}
                  onClick={() => setTarifeFilter(key)}
                >
                  {label}
                  {count !== null && count > 0 && <span className="pill-count">{count}</span>}
                </button>
              ))}
            </div>
            <div className="tarife-toolbar-right">
              <button className="btn btn-secondary" onClick={() => setShowNewIndividuell(true)}>
                <Plus size={14} /> Individuell
              </button>
              <button className="btn btn-primary" onClick={() => setShowNewTarif(true)}>
                <Plus size={14} /> Neuer Tarif
              </button>
            </div>
          </div>

          {/* Tarife: Accordion-Gruppen (Alle) oder flaches Grid (Filter) */}
          {tarifeFilter === 'alle' ? (
            <div className="tc-categories">
              <CategorySection title="Kinder & Jugendliche" icon={<Baby size={14} />} items={tarife.filter(t => t.isChildRate && !t.ist_archiviert)} catKey="kinder" />
              <CategorySection title="Studenten & Schüler" icon={<GraduationCap size={14} />} items={tarife.filter(t => t.isStudentRate && !t.ist_archiviert)} catKey="studenten" />
              <CategorySection title="Erwachsene" icon={<User size={14} />} items={tarife.filter(t => t.isAdultRate && !t.ist_archiviert)} catKey="erwachsene" />
              <CategorySection title="Familien" icon={<Users size={14} />} items={tarife.filter(t => t.isFamilienRate && !t.isChildRate && !t.isStudentRate && !t.isAdultRate && !t.ist_archiviert)} catKey="familien" />
              <CategorySection title="Sonstige" icon={<Package size={14} />} items={tarife.filter(t => !t.isChildRate && !t.isStudentRate && !t.isAdultRate && !t.isFamilienRate && !t.ist_archiviert)} catKey="sonstige" />
              <CategorySection title="Archiviert" icon={<Tag size={14} />} items={tarife.filter(t => t.ist_archiviert)} catKey="archiviert" />
            </div>
          ) : (
            <div className="tc-grid">
              {getFilteredTarife().map(tarif => (
                <TarifCard key={tarif.id} tarif={tarif} />
              ))}
              {getFilteredTarife().length === 0 && (
                <div className="tc-empty">
                  <Package size={28} />
                  <p>Keine Tarife in dieser Kategorie</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══════════ TAB: STARTERPAKETE ═══════════ */}
      {activeTab === 'starterpakete' && (
        <div style={{ marginTop: '1.5rem' }}>
          <div className="section-header" style={{ marginBottom: '1.25rem' }}>
            <h2><span style={{ marginRight: '0.5rem' }}>🎁</span>Starterpakete</h2>
            <div className="header-actions">
              <button className="btn btn-primary" onClick={() => setShowNewSp(true)}>
                <Plus size={14} /> Neues Paket
              </button>
            </div>
          </div>

          <div style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 10, padding: '0.875rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
            <strong style={{ color: '#d4af37' }}>ℹ️ Starterpakete</strong> — beim ersten Login wählt das Neumitglied seinen Kampfkunststil und sieht das zugeordnete Starterpaket. Das Paket wird per Lastschrift abgebucht.
          </div>

          {showNewSp && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }}>
              <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Neues Starterpaket</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="u-form-label">Stil *</label>
                  <select value={newSp.stil_id} onChange={e => setNewSp({ ...newSp, stil_id: e.target.value })} className="u-input-sm">
                    <option value="">— Stil wählen —</option>
                    {spStile.map(s => <option key={s.stil_id} value={s.stil_id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="u-form-label">Paketname *</label>
                  <input className="u-input-sm" value={newSp.name} onChange={e => setNewSp({ ...newSp, name: e.target.value })} placeholder="z. B. Karate Starterpaket" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="u-form-label">Beschreibung</label>
                  <input className="u-input-sm" value={newSp.beschreibung} onChange={e => setNewSp({ ...newSp, beschreibung: e.target.value })} placeholder="Kurze Beschreibung" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="u-form-label">Pflichthinweis für Mitglied</label>
                  <textarea className="u-input-sm" rows={4} value={newSp.hinweis} onChange={e => setNewSp({ ...newSp, hinweis: e.target.value })} style={{ resize: 'vertical' }} />
                </div>
                <div>
                  <label className="u-form-label">Rabatt (%)</label>
                  <input className="u-input-sm" type="number" min="0" max="100" step="0.5" value={newSp.rabatt_prozent} onChange={e => setNewSp({ ...newSp, rabatt_prozent: parseFloat(e.target.value) || 0 })} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={newSp.aktiv} onChange={e => setNewSp({ ...newSp, aktiv: e.target.checked })} />
                    Paket aktiv
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowNewSp(false)}>Abbrechen</button>
                <button className="btn btn-primary btn-sm" onClick={handleCreateSp} disabled={spSaving || !newSp.stil_id || !newSp.name}>
                  {spSaving ? 'Speichern…' : 'Paket anlegen'}
                </button>
              </div>
            </div>
          )}

          {starterpakete.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem 0' }}>Noch keine Starterpakete angelegt.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {starterpakete.map(pk => (
                <div key={pk.paket_id} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${pk.aktiv ? 'rgba(212,175,55,0.25)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', cursor: 'pointer' }} onClick={() => setExpandedSpId(expandedSpId === pk.paket_id ? null : pk.paket_id)}>
                    <span style={{ fontSize: '1.2rem' }}>🎁</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: pk.aktiv ? '#fff' : 'rgba(255,255,255,0.4)' }}>{pk.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {pk.stil_name} · {pk.positionen?.length || 0} Positionen · {((pk.endpreis_cent || 0) / 100).toFixed(2)} €
                        {pk.rabatt_prozent > 0 && <span style={{ color: '#4ade80', marginLeft: '0.4rem' }}>−{pk.rabatt_prozent}%</span>}
                        {!pk.aktiv && <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: '0.4rem' }}>inaktiv</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="btn btn-sm btn-secondary" onClick={e => { e.stopPropagation(); setEditingSp({ ...pk }); }} title="Bearbeiten"><Edit size={13} /></button>
                      <button className="btn btn-sm btn-danger" onClick={e => { e.stopPropagation(); handleDeleteSp(pk.paket_id); }} title="Löschen"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  {expandedSpId === pk.paket_id && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '0.875rem 1rem' }}>
                      {pk.hinweis && (
                        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '0.5rem 0.75rem', marginBottom: '0.875rem', fontSize: '0.82rem', color: '#fca5a5' }}>
                          ⚠️ {pk.hinweis}
                        </div>
                      )}
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '0.875rem' }}>
                        <thead>
                          <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                            <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', fontWeight: 600 }}>Bezeichnung</th>
                            <th style={{ textAlign: 'center', padding: '0.35rem 0.5rem', fontWeight: 600 }}>Menge</th>
                            <th style={{ textAlign: 'right', padding: '0.35rem 0.5rem', fontWeight: 600 }}>Preis</th>
                            <th style={{ textAlign: 'right', padding: '0.35rem 0.5rem', fontWeight: 600 }}>Gesamt</th>
                            <th style={{ width: 30 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(pk.positionen || []).map(pos => (
                            <tr key={pos.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '0.4rem 0.5rem', color: pos.pflicht ? '#fff' : 'rgba(255,255,255,0.55)' }}>
                                {pos.bezeichnung}{!pos.pflicht && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>optional</span>}
                              </td>
                              <td style={{ textAlign: 'center', padding: '0.4rem 0.5rem', color: 'var(--text-muted)' }}>{pos.menge}</td>
                              <td style={{ textAlign: 'right', padding: '0.4rem 0.5rem' }}>{(pos.einzelpreis_cent / 100).toFixed(2)} €</td>
                              <td style={{ textAlign: 'right', padding: '0.4rem 0.5rem', fontWeight: 600 }}>{(pos.einzelpreis_cent * pos.menge / 100).toFixed(2)} €</td>
                              <td style={{ textAlign: 'right', padding: '0.4rem 0.25rem' }}>
                                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.6)', padding: '0.2rem' }} onClick={() => handleDeletePos(pk.paket_id, pos.id)}><Trash2 size={12} /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                            <td colSpan={3} style={{ textAlign: 'right', padding: '0.5rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                              Summe{pk.rabatt_prozent > 0 ? ` − ${pk.rabatt_prozent}% Rabatt` : ''}
                            </td>
                            <td style={{ textAlign: 'right', padding: '0.5rem 0.5rem', fontWeight: 700, color: '#d4af37' }}>{((pk.endpreis_cent || 0) / 100).toFixed(2)} €</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                      {addingPosForId === pk.paket_id ? (
                        <div className="tc-pos-form">
                          {spArtikelLoading && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-4)', marginBottom: '0.5rem' }}>Lade Artikel…</div>
                          )}
                          {!spArtikelLoading && spArtikel.length > 0 && (
                            <div style={{ marginBottom: '0.6rem' }}>
                              <select
                                className="tc-pos-input"
                                value={newPos.artikel_id || ''}
                                onChange={e => {
                                  const art = spArtikel.find(a => a.artikel_id === parseInt(e.target.value));
                                  if (art) {
                                    setNewPos(p => ({ ...p, artikel_id: art.artikel_id, bezeichnung: art.name, einzelpreis_cent: (art.verkaufspreis_cent / 100).toFixed(2) }));
                                  } else {
                                    setNewPos(p => ({ ...p, artikel_id: null }));
                                  }
                                }}
                              >
                                <option value="">— Aus Artikelkatalog wählen (optional) —</option>
                                {spArtikel.map(a => (
                                  <option key={a.artikel_id} value={a.artikel_id}>
                                    {a.name} — €{(a.verkaufspreis_cent / 100).toFixed(2)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <input className="tc-pos-input" placeholder="Bezeichnung *" value={newPos.bezeichnung} onChange={e => setNewPos({ ...newPos, bezeichnung: e.target.value })} />
                            <input className="tc-pos-input" type="number" min="1" placeholder="Menge" value={newPos.menge} onChange={e => setNewPos({ ...newPos, menge: parseInt(e.target.value) || 1 })} />
                            <input className="tc-pos-input" type="number" min="0" step="0.01" placeholder="Preis € *" value={newPos.einzelpreis_cent} onChange={e => setNewPos({ ...newPos, einzelpreis_cent: e.target.value })} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'space-between' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-3)', cursor: 'pointer' }}>
                              <input type="checkbox" checked={newPos.pflicht} onChange={e => setNewPos({ ...newPos, pflicht: e.target.checked })} /> Pflicht
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button className="btn btn-sm btn-secondary" onClick={() => { setAddingPosForId(null); setNewPos({ artikel_id: null, bezeichnung: '', menge: 1, einzelpreis_cent: '', pflicht: true }); }}>Abbrechen</button>
                              <button className="btn btn-sm btn-primary" onClick={() => handleAddPos(pk.paket_id)} disabled={spSaving || !newPos.bezeichnung || newPos.einzelpreis_cent === ''}>
                                {spSaving ? '…' : 'Hinzufügen'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button className="btn btn-sm btn-secondary" onClick={() => openAddPos(pk.paket_id, pk.dojo_id)} style={{ marginTop: '0.25rem' }}>
                          <Plus size={13} /> Position hinzufügen
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ TAB: VERTRAGSEINSTELLUNGEN ═══════════ */}
      {activeTab === 'einstellungen' && (
        <div className="section" style={{ marginTop: '1.5rem' }}>
          <div className="section-header" style={{ marginBottom: '1.5rem' }}>
            <h2><span style={{ marginRight: '0.5rem' }}>📋</span>Vertragsmodell & Vertragsbedingungen</h2>
            <div className="header-actions">
              {!isEditingSettings ? (
                <button className="btn btn-secondary" onClick={() => setIsEditingSettings(true)}>Bearbeiten</button>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={() => { setIsEditingSettings(false); loadDojoSettings(); }}>Abbrechen</button>
                  <button className="btn btn-primary" onClick={saveDojoSettings} disabled={savingSettings}>
                    {savingSettings ? 'Speichern...' : 'Speichern'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div style={{ padding: '0 0 1rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>🔄 Vertragsmodell</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ display: 'flex', gap: '0.75rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: `1px solid ${dojoSettings.vertragsmodell === 'gesetzlich' ? 'var(--primary)' : 'rgba(255,255,255,0.08)'}`, cursor: isEditingSettings ? 'pointer' : 'default' }}>
                  <input type="radio" name="vertragsmodell" value="gesetzlich" checked={dojoSettings.vertragsmodell === 'gesetzlich'} onChange={(e) => setDojoSettings({ ...dojoSettings, vertragsmodell: e.target.value })} disabled={!isEditingSettings} />
                  <div>
                    <div style={{ fontWeight: 600 }}>📜 Gesetzliche Verlängerung (Standard)</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Vertrag verlängert sich automatisch. Nach der Verlängerung kann das Mitglied jederzeit mit <strong>1 Monat Frist</strong> kündigen.
                    </div>
                  </div>
                </label>
                <label style={{ display: 'flex', gap: '0.75rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: `1px solid ${dojoSettings.vertragsmodell === 'beitragsgarantie' ? '#14B8A6' : 'rgba(255,255,255,0.08)'}`, cursor: isEditingSettings ? 'pointer' : 'default' }}>
                  <input type="radio" name="vertragsmodell" value="beitragsgarantie" checked={dojoSettings.vertragsmodell === 'beitragsgarantie'} onChange={(e) => setDojoSettings({ ...dojoSettings, vertragsmodell: e.target.value })} disabled={!isEditingSettings} />
                  <div>
                    <div style={{ fontWeight: 600 }}>💰 Beitragsgarantie-Modell</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Mitglied muss <strong>aktiv verlängern</strong>, um seinen aktuellen Beitrag zu behalten.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>📝 Allgemeine Vertragsbedingungen</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                {[
                  { label: 'Kündigungsfrist (Monate)', key: 'kuendigungsfrist_monate', min: 1, max: 3 },
                  { label: 'Mindestlaufzeit (Monate)', key: 'mindestlaufzeit_monate', min: 1, max: 24 },
                  { label: 'Verlängerungszeitraum (Monate)', key: 'verlaengerung_monate', min: 1, max: 12 },
                  { label: 'Max. Ruhepause (Monate)', key: 'ruhepause_max_monate', min: 1, max: 12 }
                ].map(({ label, key, min, max }) => (
                  <div key={key}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>{label}</label>
                    <input
                      type="number" min={min} max={max} value={dojoSettings[key]}
                      onChange={(e) => setDojoSettings({ ...dojoSettings, [key]: parseInt(e.target.value) || min })}
                      disabled={!isEditingSettings}
                      style={{ width: '100%', padding: '0.5rem', background: 'var(--input-bg, rgba(255,255,255,0.05))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text-primary)', opacity: isEditingSettings ? 1 : 0.7 }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  { label: 'Kündigung nur zum Monatsende möglich', key: 'kuendigung_nur_monatsende' },
                  { label: 'Kündigung muss schriftlich erfolgen', key: 'kuendigung_schriftlich' }
                ].map(({ label, key }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: isEditingSettings ? 'pointer' : 'default' }}>
                    <input type="checkbox" checked={dojoSettings[key]} onChange={(e) => setDojoSettings({ ...dojoSettings, [key]: e.target.checked })} disabled={!isEditingSettings} />
                    <span style={{ fontSize: '0.9rem' }}>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {dojoSettings.vertragsmodell === 'beitragsgarantie' && (
              <div style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.3)', borderRadius: '8px', padding: '1.25rem' }}>
                <h4 style={{ marginBottom: '1rem', color: '#14B8A6' }}>⚙️ Beitragsgarantie-Einstellungen</h4>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Bei Nicht-Verlängerung</label>
                  <select
                    value={dojoSettings.beitragsgarantie_bei_nichtverlaengerung}
                    onChange={(e) => setDojoSettings({ ...dojoSettings, beitragsgarantie_bei_nichtverlaengerung: e.target.value })}
                    disabled={!isEditingSettings}
                    style={{ padding: '0.5rem', background: 'var(--input-bg, rgba(255,255,255,0.05))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text-primary)' }}
                  >
                    <option value="aktueller_tarif">Automatisch aktueller Tarifpreis</option>
                    <option value="vertrag_endet">Vertrag endet</option>
                  </select>
                </div>
                <h5 style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>📧 Erinnerungs-E-Mails</h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  {[
                    { label: '1. Erinnerung', key: 'verlaengerung_erinnerung_tage' },
                    { label: '2. Erinnerung', key: 'verlaengerung_erinnerung2_tage' },
                    { label: 'Letzte Erinnerung', key: 'verlaengerung_erinnerung3_tage' }
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>{label}</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="number" min={0} max={90} value={dojoSettings[key]}
                          onChange={(e) => setDojoSettings({ ...dojoSettings, [key]: parseInt(e.target.value) || 0 })}
                          disabled={!isEditingSettings}
                          style={{ width: '70px', padding: '0.5rem', background: 'var(--input-bg, rgba(255,255,255,0.05))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text-primary)' }}
                        />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tage vorher</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ MODALS ═══════════ */}

      {/* Modal: Individueller Vertrag */}
      {showNewIndividuell && (
        <div className="ds-modal-overlay" onClick={() => setShowNewIndividuell(false)}>
          <div className="ds-modal ds-modal--md" onClick={(e) => e.stopPropagation()}>
            <div className="ds-modal-header">
              <div><h3 className="ds-modal-title">Neuer individueller Vertrag</h3></div>
              <button className="ds-modal-close" onClick={() => setShowNewIndividuell(false)}><X size={18} /></button>
            </div>
            <div className="ds-modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Vertragsname *</label>
                  <input type="text" value={newIndividuell.name} onChange={(e) => setNewIndividuell({...newIndividuell, name: e.target.value})} placeholder="z.B. Individualtarif Max Mustermann" />
                </div>
                <div className="form-group">
                  <label>Laufzeit (Monate) *</label>
                  <input type="number" min="1" value={newIndividuell.duration_months} onChange={(e) => setNewIndividuell({...newIndividuell, duration_months: e.target.value})} placeholder="z.B. 12" />
                </div>
                <div className="form-group">
                  <label>Mindestlaufzeit (Monate) *</label>
                  <input type="number" min="1" value={newIndividuell.mindestlaufzeit_monate} onChange={(e) => setNewIndividuell({...newIndividuell, mindestlaufzeit_monate: e.target.value})} placeholder="z.B. 12" />
                </div>
                <div className="form-group">
                  <label>Kündigungsfrist (Monate) *</label>
                  <input type="number" min="0" value={newIndividuell.kuendigungsfrist_monate} onChange={(e) => setNewIndividuell({...newIndividuell, kuendigungsfrist_monate: e.target.value})} placeholder="z.B. 3" />
                </div>
                <div className="form-group">
                  <label>Monatlicher Beitrag (€) *</label>
                  <input type="number" step="0.01" min="0" value={newIndividuell.price_cents ? (newIndividuell.price_cents / 100).toFixed(2) : ''} onChange={(e) => setNewIndividuell({...newIndividuell, price_cents: Math.round(parseFloat(e.target.value || 0) * 100)})} placeholder="z.B. 49.90" />
                </div>
                <div className="form-group">
                  <label>Aufnahmegebühr (€)</label>
                  <input type="number" step="0.01" min="0" value={newIndividuell.aufnahmegebuehr_cents ? (newIndividuell.aufnahmegebuehr_cents / 100).toFixed(2) : ''} onChange={(e) => setNewIndividuell({...newIndividuell, aufnahmegebuehr_cents: Math.round(parseFloat(e.target.value || 0) * 100)})} placeholder="49.99" />
                </div>
              </div>
            </div>
            <div className="ds-modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNewIndividuell(false)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={async () => {
                try {
                  const dojoId = getDojoId();
                  const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';
                  await axios.post(`/tarife${dojoParam}`, {
                    name: newIndividuell.name,
                    duration_months: parseInt(newIndividuell.duration_months),
                    mindestlaufzeit_monate: parseInt(newIndividuell.mindestlaufzeit_monate),
                    kuendigungsfrist_monate: parseInt(newIndividuell.kuendigungsfrist_monate),
                    price_cents: newIndividuell.price_cents,
                    aufnahmegebuehr_cents: newIndividuell.aufnahmegebuehr_cents,
                    currency: 'EUR', billing_cycle: 'MONTHLY', payment_method: 'SEPA', active: true
                  });
                  setShowNewIndividuell(false);
                  setNewIndividuell({ name: "", duration_months: "", mindestlaufzeit_monate: "", kuendigungsfrist_monate: "", price_cents: "", aufnahmegebuehr_cents: 4999 });
                  loadTarifeUndRabatte();
                  alert('Individueller Vertrag erfolgreich erstellt!');
                } catch (error) {
                  alert('Fehler beim Erstellen: ' + (error.response?.data?.error || error.message));
                }
              }}>
                <Save size={18} /> Vertrag erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Neuer Tarif */}
      {showNewTarif && (
        <div className="ds-modal-overlay" onClick={() => setShowNewTarif(false)}>
          <div className="ds-modal ds-modal--md" onClick={(e) => e.stopPropagation()}>
            <div className="ds-modal-header">
              <div><h3 className="ds-modal-title">Neuer Tarif</h3></div>
              <button className="ds-modal-close" onClick={() => setShowNewTarif(false)}><X size={18} /></button>
            </div>
            <div className="ds-modal-body">
              <div className="tp-field-mb">
                <label className="u-form-label">Name *</label>
                <input type="text" value={newTarif.name} onChange={(e) => setNewTarif({...newTarif, name: e.target.value})} placeholder="Tarif-Bezeichnung" className="u-input-sm" />
              </div>
              <div className="u-grid-2col">
                <div>
                  <label className="u-form-label">Preis (€) *</label>
                  <input type="number" step="0.01" value={newTarif.price_cents ? (newTarif.price_cents / 100).toFixed(2) : ''} onChange={(e) => setNewTarif({...newTarif, price_cents: Math.round(parseFloat(e.target.value || 0) * 100)})} placeholder="0.00" className="u-input-sm" />
                </div>
                <div>
                  <label className="u-form-label">Aufnahmegebühr (€)</label>
                  <input type="number" step="0.01" min="0" value={newTarif.aufnahmegebuehr_cents ? (newTarif.aufnahmegebuehr_cents / 100).toFixed(2) : ''} onChange={(e) => setNewTarif({...newTarif, aufnahmegebuehr_cents: Math.round(parseFloat(e.target.value || 0) * 100)})} placeholder="49.99" className="u-input-sm" />
                </div>
              </div>
              <div className="u-grid-2col">
                <div>
                  <label className="u-form-label">Laufzeit (Monate) *</label>
                  <input type="number" min="1" value={newTarif.duration_months} onChange={(e) => setNewTarif({...newTarif, duration_months: parseInt(e.target.value) || ''})} placeholder="12" className="u-input-sm" />
                </div>
                <div>
                  <label className="u-form-label">Zahlungsintervall *</label>
                  <select value={newTarif.billing_cycle} onChange={(e) => setNewTarif({...newTarif, billing_cycle: e.target.value})} className="u-input-sm">
                    <option value="">Bitte wählen...</option>
                    {zahlungszyklen.length > 0 ? (
                      zahlungszyklen.map(zyklus => {
                        const cycleValue = zyklus.name?.toLowerCase() || zyklus.intervall?.toLowerCase() || '';
                        return <option key={zyklus.id || zyklus.zyklus_id} value={cycleValue}>{zyklus.name || zyklus.intervall}</option>;
                      })
                    ) : (
                      <>
                        <option value="daily">Täglich</option>
                        <option value="weekly">Wöchentlich</option>
                        <option value="monthly">Monatlich</option>
                        <option value="quarterly">Vierteljährlich</option>
                        <option value="yearly">Jährlich</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
              <div className="u-grid-2col">
                <div>
                  <label className="u-form-label">Zahlungsmethode *</label>
                  <select value={newTarif.payment_method} onChange={(e) => setNewTarif({...newTarif, payment_method: e.target.value})} className="u-input-sm">
                    <option value="bank_transfer">Banküberweisung</option>
                    <option value="direct_debit">Lastschrift</option>
                    <option value="credit_card">Kreditkarte</option>
                    <option value="cash">Bar</option>
                  </select>
                </div>
                <div>
                  <label className="u-form-label">Währung</label>
                  <select value={newTarif.currency} onChange={(e) => setNewTarif({...newTarif, currency: e.target.value})} className="u-input-sm">
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="CHF">CHF</option>
                  </select>
                </div>
              </div>
              <div className="u-grid-2col" style={{marginTop: '12px'}}>
                <div>
                  <label className="u-form-label">Mindestlaufzeit (Monate)</label>
                  <input type="number" min="1" value={newTarif.mindestlaufzeit_monate || ''} onChange={(e) => setNewTarif({...newTarif, mindestlaufzeit_monate: parseInt(e.target.value) || ''})} placeholder={newTarif.duration_months || '12'} className="u-input-sm" />
                </div>
                <div>
                  <label className="u-form-label">Kündigungsfrist (Monate)</label>
                  <input type="number" min="1" value={newTarif.kuendigungsfrist_monate ?? ''} onChange={(e) => setNewTarif({...newTarif, kuendigungsfrist_monate: parseInt(e.target.value) || ''})} placeholder="3" className="u-input-sm" />
                </div>
              </div>
              <div className="tp-status-row">
                <label className="tp-status-label">
                  <input type="checkbox" checked={newTarif.active} onChange={(e) => setNewTarif({...newTarif, active: e.target.checked})} />
                  Tarif ist aktiv
                </label>
              </div>
            </div>
            <div className="ds-modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNewTarif(false)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={() => handleSaveTarif(newTarif)} disabled={!newTarif.name || !newTarif.price_cents || !newTarif.duration_months}>
                <Save size={16} /> Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Starterpaket bearbeiten (inkl. Positionen) */}
      {editingSp && (
        <div className="ds-modal-overlay" onClick={() => { setEditingSp(null); setAddingPosForId(null); }}>
          <div className="ds-modal ds-modal--xl" onClick={e => e.stopPropagation()} style={{ background: 'rgba(26,26,46,0.99)', maxWidth: 'min(900px, 96vw)', width: '96vw' }}>
            <div className="ds-modal-header">
              <div>
                <h3 className="ds-modal-title">Starterpaket bearbeiten</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-4)' }}>{editingSp.stil_name} · {editingSp.positionen?.length || 0} Positionen · {((editingSp.endpreis_cent || 0) / 100).toFixed(2)} €</p>
              </div>
              <button className="ds-modal-close" onClick={() => { setEditingSp(null); setAddingPosForId(null); }}><X size={16} /></button>
            </div>
            <div className="ds-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* ── Paketdetails ── */}
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-4)', marginBottom: '0.65rem' }}>Paketdetails</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="u-form-label">Stil *</label>
                    <select value={editingSp.stil_id} onChange={e => setEditingSp({ ...editingSp, stil_id: parseInt(e.target.value) })} className="u-input-sm">
                      <option value="">— Stil wählen —</option>
                      {spStile.map(s => <option key={s.stil_id} value={s.stil_id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="u-form-label">Paketname *</label>
                    <input className="u-input-sm" value={editingSp.name} onChange={e => setEditingSp({ ...editingSp, name: e.target.value })} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="u-form-label">Beschreibung</label>
                    <input className="u-input-sm" value={editingSp.beschreibung || ''} onChange={e => setEditingSp({ ...editingSp, beschreibung: e.target.value })} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="u-form-label">Pflichthinweis</label>
                    <textarea className="u-input-sm" rows={3} value={editingSp.hinweis || ''} onChange={e => setEditingSp({ ...editingSp, hinweis: e.target.value })} style={{ resize: 'vertical' }} />
                  </div>
                  <div>
                    <label className="u-form-label">Rabatt (%)</label>
                    <input className="u-input-sm" type="number" min="0" max="100" step="0.5" value={editingSp.rabatt_prozent || 0} onChange={e => setEditingSp({ ...editingSp, rabatt_prozent: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-3)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!editingSp.aktiv} onChange={e => setEditingSp({ ...editingSp, aktiv: e.target.checked })} />
                      Paket aktiv
                    </label>
                  </div>
                </div>
              </div>

              {/* ── Divider ── */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.09)' }} />

              {/* ── Positionen ── */}
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-4)', marginBottom: '0.65rem' }}>Positionen / Artikel</div>

                {(editingSp.positionen || []).length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-4)', borderBottom: '1px solid rgba(255,255,255,0.09)' }}>
                        <th style={{ textAlign: 'left', padding: '0.3rem 0.4rem', fontWeight: 600 }}>Bezeichnung</th>
                        <th style={{ textAlign: 'center', padding: '0.3rem 0.4rem', fontWeight: 600, width: 60 }}>Menge</th>
                        <th style={{ textAlign: 'right', padding: '0.3rem 0.4rem', fontWeight: 600, width: 90 }}>Preis</th>
                        <th style={{ textAlign: 'right', padding: '0.3rem 0.4rem', fontWeight: 600, width: 90 }}>Gesamt</th>
                        <th style={{ width: 30 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {editingSp.positionen.map(pos => (
                        <tr key={pos.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '0.35rem 0.4rem', color: pos.pflicht ? 'var(--text-1)' : 'var(--text-4)' }}>
                            {pos.bezeichnung}
                            {!pos.pflicht && <span style={{ fontSize: '0.73rem', color: 'var(--text-4)', marginLeft: '0.3rem' }}>optional</span>}
                          </td>
                          <td style={{ textAlign: 'center', padding: '0.35rem 0.4rem', color: 'var(--text-3)' }}>{pos.menge}</td>
                          <td style={{ textAlign: 'right', padding: '0.35rem 0.4rem' }}>{(pos.einzelpreis_cent / 100).toFixed(2)} €</td>
                          <td style={{ textAlign: 'right', padding: '0.35rem 0.4rem', fontWeight: 600 }}>{(pos.einzelpreis_cent * pos.menge / 100).toFixed(2)} €</td>
                          <td style={{ textAlign: 'right', padding: '0.35rem 0.2rem' }}>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.6)', padding: '0.2rem' }} onClick={() => handleDeletePos(editingSp.paket_id, pos.id)}><Trash2 size={12} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                        <td colSpan={3} style={{ textAlign: 'right', padding: '0.45rem 0.4rem', color: 'var(--text-4)', fontSize: '0.82rem' }}>
                          Summe{editingSp.rabatt_prozent > 0 ? ` − ${editingSp.rabatt_prozent}% Rabatt` : ''}
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.45rem 0.4rem', fontWeight: 700, color: '#d4af37' }}>{((editingSp.endpreis_cent || 0) / 100).toFixed(2)} €</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <p style={{ color: 'var(--text-4)', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>Noch keine Positionen. Füge unten Artikel hinzu.</p>
                )}

                {/* Position hinzufügen */}
                {addingPosForId === editingSp.paket_id ? (
                  <div className="tc-pos-form">
                    {spArtikelLoading && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-4)', marginBottom: '0.5rem' }}>Lade Artikel…</div>
                    )}
                    {!spArtikelLoading && spArtikel.length > 0 && (
                      <div style={{ marginBottom: '0.6rem' }}>
                        <select
                          className="tc-pos-input"
                          value={newPos.artikel_id || ''}
                          onChange={e => {
                            const art = spArtikel.find(a => a.artikel_id === parseInt(e.target.value));
                            if (art) {
                              setNewPos(p => ({ ...p, artikel_id: art.artikel_id, bezeichnung: art.name, einzelpreis_cent: (art.verkaufspreis_cent / 100).toFixed(2) }));
                            } else {
                              setNewPos(p => ({ ...p, artikel_id: null }));
                            }
                          }}
                        >
                          <option value="">— Aus Artikelkatalog wählen (optional) —</option>
                          {spArtikel.map(a => (
                            <option key={a.artikel_id} value={a.artikel_id}>
                              {a.name} — €{(a.verkaufspreis_cent / 100).toFixed(2)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input className="tc-pos-input" placeholder="Bezeichnung *" value={newPos.bezeichnung} onChange={e => setNewPos({ ...newPos, bezeichnung: e.target.value })} />
                      <input className="tc-pos-input" type="number" min="1" placeholder="Menge" value={newPos.menge} onChange={e => setNewPos({ ...newPos, menge: parseInt(e.target.value) || 1 })} />
                      <input className="tc-pos-input" type="number" min="0" step="0.01" placeholder="Preis € *" value={newPos.einzelpreis_cent} onChange={e => setNewPos({ ...newPos, einzelpreis_cent: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-3)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={newPos.pflicht} onChange={e => setNewPos({ ...newPos, pflicht: e.target.checked })} /> Pflicht
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => { setAddingPosForId(null); setNewPos({ artikel_id: null, bezeichnung: '', menge: 1, einzelpreis_cent: '', pflicht: true }); }}>Abbrechen</button>
                        <button className="btn btn-sm btn-primary" onClick={() => handleAddPos(editingSp.paket_id)} disabled={spSaving || !newPos.bezeichnung || newPos.einzelpreis_cent === ''}>
                          {spSaving ? '…' : 'Hinzufügen'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button className="btn btn-sm btn-secondary" onClick={() => openAddPos(editingSp.paket_id, editingSp.dojo_id)}>
                    <Plus size={13} /> Position hinzufügen
                  </button>
                )}
              </div>
            </div>
            <div className="ds-modal-footer">
              <button className="btn btn-secondary" onClick={() => { setEditingSp(null); setAddingPosForId(null); }}>Schließen</button>
              <button className="btn btn-primary" onClick={handleUpdateSp} disabled={spSaving || !editingSp.name}>
                <Save size={14} /> {spSaving ? 'Speichern…' : 'Änderungen speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tarif bearbeiten */}
      {editingTarif && (
        <div className="ds-modal-overlay" onClick={() => setEditingTarif(null)}>
          <div className="ds-modal ds-modal--md" onClick={(e) => e.stopPropagation()}>
            <div className="ds-modal-header">
              <div>
                <h3 className="ds-modal-title">Tarif bearbeiten</h3>
                <p className="ds-modal-subtitle">{editingTarif.name}</p>
              </div>
              <button className="ds-modal-close" onClick={() => setEditingTarif(null)}><X size={18} /></button>
            </div>
            <div className="ds-modal-body">
              <div className="tp-field-mb">
                <label className="u-form-label">Name *</label>
                <input type="text" value={editingTarif.name} onChange={(e) => setEditingTarif({...editingTarif, name: e.target.value})} placeholder="Tarif-Bezeichnung" className="u-input-sm" />
              </div>
              <div className="u-grid-2col">
                <div>
                  <label className="u-form-label">Preis (€) *</label>
                  <input type="number" step="0.01" value={editingTarif.price_euros || ''} onChange={(e) => setEditingTarif({...editingTarif, price_euros: e.target.value, price_cents: Math.round(parseFloat(e.target.value || 0) * 100)})} placeholder="0.00" className="u-input-sm" />
                </div>
                <div>
                  <label className="u-form-label">Aufnahmegebühr (€)</label>
                  <input type="number" step="0.01" min="0" value={editingTarif.aufnahmegebuehr_euros || ''} onChange={(e) => setEditingTarif({...editingTarif, aufnahmegebuehr_euros: e.target.value, aufnahmegebuehr_cents: Math.round(parseFloat(e.target.value || 0) * 100)})} placeholder="49.99" className="u-input-sm" />
                </div>
              </div>
              <div className="u-grid-2col">
                <div>
                  <label className="u-form-label">Laufzeit (Monate) *</label>
                  <input type="number" min="1" value={editingTarif.duration_months} onChange={(e) => setEditingTarif({...editingTarif, duration_months: parseInt(e.target.value) || ''})} placeholder="12" className="u-input-sm" />
                </div>
                <div>
                  <label className="u-form-label">Zahlungsintervall *</label>
                  <select value={editingTarif.billing_cycle?.toUpperCase() || ''} onChange={(e) => setEditingTarif({...editingTarif, billing_cycle: e.target.value})} className="u-input-sm">
                    <option value="">Bitte wählen...</option>
                    <option value="MONTHLY">Monatlich</option>
                    <option value="QUARTERLY">Vierteljährlich</option>
                    <option value="YEARLY">Jährlich</option>
                  </select>
                </div>
              </div>
              <div className="u-grid-2col">
                <div>
                  <label className="u-form-label">Zahlungsmethode *</label>
                  <select value={editingTarif.payment_method?.toUpperCase() || ''} onChange={(e) => setEditingTarif({...editingTarif, payment_method: e.target.value})} className="u-input-sm">
                    <option value="SEPA">SEPA</option>
                    <option value="CARD">Kreditkarte</option>
                    <option value="PAYPAL">PayPal</option>
                    <option value="BANK_TRANSFER">Banküberweisung</option>
                  </select>
                </div>
                <div>
                  <label className="u-form-label">Währung</label>
                  <select value={editingTarif.currency} onChange={(e) => setEditingTarif({...editingTarif, currency: e.target.value})} className="u-input-sm">
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="CHF">CHF</option>
                  </select>
                </div>
              </div>
              <div className="u-grid-2col" style={{marginTop: '12px'}}>
                <div>
                  <label className="u-form-label">Mindestlaufzeit (Monate)</label>
                  <input type="number" min="1" value={editingTarif.mindestlaufzeit_monate || ''} onChange={(e) => setEditingTarif({...editingTarif, mindestlaufzeit_monate: parseInt(e.target.value) || ''})} placeholder={editingTarif.duration_months || '12'} className="u-input-sm" />
                </div>
                <div>
                  <label className="u-form-label">Kündigungsfrist (Monate)</label>
                  <input type="number" min="1" value={editingTarif.kuendigungsfrist_monate ?? ''} onChange={(e) => setEditingTarif({...editingTarif, kuendigungsfrist_monate: parseInt(e.target.value) || ''})} placeholder="3" className="u-input-sm" />
                </div>
              </div>
              <div className="tp-status-row">
                <label className="tp-status-label">
                  <input type="checkbox" checked={editingTarif.active} onChange={(e) => setEditingTarif({...editingTarif, active: e.target.checked})} />
                  Tarif ist aktiv
                </label>
              </div>
            </div>
            <div className="ds-modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingTarif(null)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={() => handleSaveTarif(editingTarif)} disabled={!editingTarif.name || !editingTarif.price_cents || !editingTarif.duration_months}>
                <Save size={16} /> Speichern
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TarifePreise;
