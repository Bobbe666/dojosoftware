import React, { useContext, useState, useMemo, useEffect } from "react";
import axios from "axios";
import { useTranslation } from 'react-i18next';
import config from '../config/config.js';
import "../styles/themes.css";       // Centralized theme system
import "../styles/components.css";   // Universal component styles
import "../styles/Kurse.css";
import { DatenContext } from "@shared/DatenContext.jsx";
import { useDojoContext } from '../context/DojoContext.jsx'; // 🔒 TAX COMPLIANCE
import { useStandortContext } from '../context/StandortContext.jsx'; // Multi-Location Support
import { fetchWithAuth } from '../utils/fetchWithAuth';
import Stundenplan from './Stundenplan.jsx';


const Kurse = () => {
  const { t } = useTranslation(['courses', 'common']);
  const { kurse, trainer, stile, gruppen, ladeAlleDaten } = useContext(DatenContext); // <-- Fix hier
  const { getDojoFilterParam, activeDojo } = useDojoContext(); // 🔒 TAX COMPLIANCE: Dojo-Filter
  const { standorte, activeStandort, switchStandort, hasMultipleLocations } = useStandortContext(); // Multi-Location

  const [neuerKurs, setNeuerKurs] = useState({
    gruppenname: "",
    stil: "",
    trainer_ids: [],
    raum_id: ""
  });

  const [raeume, setRaeume] = useState([]);
  const [scheduleMap, setScheduleMap] = useState({}); // kurs_id → [{wochentag, uhrzeit, dauer}]

  const [showNewTrainerForm, setShowNewTrainerForm] = useState(false);
  const [newTrainerData, setNewTrainerData] = useState({
    vorname: "",
    nachname: "",
    email: "",
    telefon: ""
  });
  
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  
  const [newStyleName, setNewStyleName] = useState("");
  const [showNewStyleInput, setShowNewStyleInput] = useState(false);
  
  const [newRoomData, setNewRoomData] = useState({
    name: "",
    beschreibung: "",
    groesse: "",
    kapazitaet: ""
  });
  const [showNewRoomForm, setShowNewRoomForm] = useState(false);
  
  // States für Stammdaten-Raumverwaltung
  const [showNewRoomFormStammdaten, setShowNewRoomFormStammdaten] = useState(false);
  const [newRoomDataStammdaten, setNewRoomDataStammdaten] = useState({
    name: "",
    beschreibung: "",
    groesse: "",
    kapazitaet: ""
  });

  // Räume + Stundenplan laden
  useEffect(() => {
    loadRaeume();
    loadSchedule();
  }, [activeDojo]);

  const loadSchedule = async () => {
    try {
      const dojoParam = getDojoFilterParam();
      const suffix = dojoParam ? `?include_schedule=true&${dojoParam}` : '?include_schedule=true';
      const res = await axios.get(`/kurse${suffix}`);
      const map = {};
      (res.data || []).forEach(entry => {
        if (!entry.kurs_id || !entry.wochentag) return;
        if (!map[entry.kurs_id]) map[entry.kurs_id] = [];
        map[entry.kurs_id].push({ wochentag: entry.wochentag, uhrzeit: entry.uhrzeit, dauer: entry.dauer });
      });
      setScheduleMap(map);
    } catch (e) {
      console.warn('Stundenplan konnte nicht geladen werden:', e.message);
    }
  };

  const loadRaeume = async () => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/raeume`);
      const result = await response.json();
      if (result.success) {
        setRaeume(result.data);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Räume:', error);
    }
  };

  // Tab System — 3 Haupt-Tabs
  const [activeTab, setActiveTab] = useState("kurse"); // "kurse" | "stundenplan" | "stammdaten"

  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState({
    gruppenname: "",
    stil: "",
    trainer_ids: [],
    raum_id: ""
  });

  const [sortConfig, setSortConfig] = useState({ key: 'gruppenname', direction: 'asc' });
  const [filterStil, setFilterStil] = useState("");
  const [filterTrainer, setFilterTrainer] = useState("");
  const [expandedKursId, setExpandedKursId] = useState(null);
  const [showNeuerKursModal, setShowNeuerKursModal] = useState(false);

  // Cockpit-State
  const [cockpitTab, setCockpitTab] = useState({}); // kursId → 'details'|'stundenplan'|'mitglieder'
  const [kursScheduleData, setKursScheduleData] = useState({}); // kursId → [full stundenplan entries]
  const [kursMitgliederData, setKursMitgliederData] = useState({}); // kursId → [members]
  const [scheduleForm, setScheduleForm] = useState({ tag: '', uhrzeit_start: '', uhrzeit_ende: '', raum_id: '' });
  const [showScheduleForm, setShowScheduleForm] = useState(false);

  // Wizard States
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardEntries, setWizardEntries] = useState([]); // schedule entries for step 2
  const [wizardEntryForm, setWizardEntryForm] = useState({ tag: '', uhrzeit_start: '', uhrzeit_ende: '', raum_id: '' });

  // Stammdaten Tab System
  const [sdTab, setSdTab] = useState('trainer');
  const [sdSearch, setSdSearch] = useState('');
  const [sdEditItem, setSdEditItem] = useState(null); // { section, item }

  // Toast notification
  const [toast, setToast] = useState(null); // { type: 'success'|'error', text: '' }

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  // Einstellungen-Tab: Accordion + Card-Grid State
  const [openSdSections, setOpenSdSections] = useState({});
  const [expandedSdItem, setExpandedSdItem] = useState({});
  const [editingTrainerInDetail, setEditingTrainerInDetail] = useState(null);
  const [trainerEditModal, setTrainerEditModal] = useState(null);
  const [modalStile, setModalStile] = useState([]);

  const toggleKursExpanded = (kursId) => {
    setExpandedKursId(prev => prev === kursId ? null : kursId);
    setEditingId(null);
  };

  // Offen-State für Stil-Gruppen (leer = alle geschlossen → Grid-Ansicht sichtbar)
  const [openStile, setOpenStile] = useState({});

  const getTrainerName = (trainer_id) => {
    const t = trainer.find(t => t.trainer_id === Number(trainer_id));
    return t ? `${t.vorname} ${t.nachname}` : "Unbekannter Trainer";
  };

  const getTrainerNames = (trainer_ids) => {
    if (!trainer_ids || trainer_ids.length === 0) return "Keine Trainer";
    const names = trainer_ids.map(id => {
      const t = trainer.find(t => t.trainer_id === Number(id));
      return t ? `${t.vorname} ${t.nachname}` : "Unbekannt";
    });
    return names.join(", ");
  };

  const getRaumName = (raum_id) => {
    if (!raum_id) return "Kein Raum zugewiesen";
    const raum = raeume.find(r => r.id === Number(raum_id));
    return raum ? raum.name : "Unbekannter Raum";
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return "⇅";
    return sortConfig.direction === 'asc' ? "↑" : "↓";
  };

  // Toggle Stil-Gruppe (openStile: leer = alle zu, true = offen)
  const toggleStil = (stilName) => {
    setOpenStile(prev => ({ ...prev, [stilName]: !prev[stilName] }));
  };

  // Cockpit: Tab wechseln + Daten laden
  const openCockpitTab = async (kursId, tab, kurs) => {
    setCockpitTab(prev => ({ ...prev, [kursId]: tab }));
    if (tab === 'stundenplan' && !kursScheduleData[kursId]) {
      await loadKursSchedule(kursId);
    }
    if (tab === 'mitglieder' && !kursMitgliederData[kursId]) {
      await loadKursMitglieder(kursId, kurs.stil);
    }
  };

  const loadKursSchedule = async (kursId) => {
    try {
      const dojoParam = getDojoFilterParam();
      const isSuperAdmin = activeDojo === 'super-admin';
      const base = isSuperAdmin ? `?kurs_id=${kursId}` : `?kurs_id=${kursId}&${dojoParam}`;
      const res = await axios.get(`/stundenplan${base}`);
      setKursScheduleData(prev => ({ ...prev, [kursId]: res.data }));
    } catch (e) {
      console.error('Stundenplan-Laden fehlgeschlagen:', e);
    }
  };

  const loadKursMitglieder = async (kursId, stil) => {
    try {
      const dojoParam = getDojoFilterParam();
      const stilParam = stil ? `stil=${encodeURIComponent(stil)}` : '';
      const combined = [stilParam, dojoParam].filter(Boolean).join('&');
      const res = await axios.get(`/mitglieder${combined ? `?${combined}` : ''}`);
      const members = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.mitglieder || []);
      setKursMitgliederData(prev => ({ ...prev, [kursId]: members }));
    } catch (e) {
      console.error('Mitglieder-Laden fehlgeschlagen:', e);
    }
  };

  const handleAddScheduleEntry = async (kursId) => {
    if (!scheduleForm.tag || !scheduleForm.uhrzeit_start || !scheduleForm.uhrzeit_ende) {
      showToast('error', 'Bitte Tag, Startzeit und Endzeit angeben.');
      return;
    }
    try {
      await axios.post('/stundenplan', {
        tag: scheduleForm.tag,
        uhrzeit_start: scheduleForm.uhrzeit_start,
        uhrzeit_ende: scheduleForm.uhrzeit_ende,
        kurs_id: kursId,
        raum_id: scheduleForm.raum_id || null,
      });
      setScheduleForm({ tag: '', uhrzeit_start: '', uhrzeit_ende: '', raum_id: '' });
      setShowScheduleForm(false);
      await loadKursSchedule(kursId);
      await loadSchedule();
      showToast('success', 'Trainingszeit hinzugefügt!');
    } catch (e) {
      showToast('error', 'Fehler: ' + (e.response?.data?.error || e.message));
    }
  };

  const toggleSdSection = (key) => {
    setOpenSdSections(prev => ({ ...prev, [key]: !prev[key] }));
    setExpandedSdItem(prev => ({ ...prev, [key]: null }));
    setEditingTrainerInDetail(null);
  };

  const toggleSdItem = (sectionKey, itemId) => {
    setExpandedSdItem(prev => ({
      ...prev,
      [sectionKey]: prev[sectionKey] === itemId ? null : itemId
    }));
    setEditingTrainerInDetail(null);
  };

  const handleSaveTrainerDetail = async (trainerId) => {
    if (!editingTrainerInDetail?.vorname || !editingTrainerInDetail?.nachname) {
      showToast('error', 'Bitte Vor- und Nachname eingeben.');
      return;
    }
    try {
      await axios.put(`/trainer/${trainerId}`, {
        vorname: editingTrainerInDetail.vorname,
        nachname: editingTrainerInDetail.nachname,
        email: editingTrainerInDetail.email || '',
        telefon: editingTrainerInDetail.telefon || ''
      });
      setEditingTrainerInDetail(null);
      ladeAlleDaten();
      showToast('success', 'Trainer gespeichert!');
    } catch (err) {
      showToast('error', "Fehler: " + (err.response?.data?.error || err.message));
    }
  };

  const openTrainerModal = async (item) => {
    setTrainerEditModal({
      trainer_id: item.trainer_id,
      vorname: item.vorname || '',
      nachname: item.nachname || '',
      email: item.email || '',
      telefon: item.telefon || '',
      stile: item.stile || []
    });
    // Stile frisch laden, damit immer alle verfügbaren Stile im Modal erscheinen
    try {
      const res = await axios.get('/stile?aktiv=true');
      const data = Array.isArray(res.data) ? res.data : [];
      setModalStile(data);
    } catch {
      // Fallback auf DatenContext-Stile
      setModalStile(stile);
    }
  };

  const handleSaveTrainerModal = async () => {
    if (!trainerEditModal?.vorname || !trainerEditModal?.nachname) {
      showToast('error', 'Bitte Vor- und Nachname eingeben.');
      return;
    }
    try {
      await axios.put(`/trainer/${trainerEditModal.trainer_id}`, {
        vorname: trainerEditModal.vorname,
        nachname: trainerEditModal.nachname,
        email: trainerEditModal.email || '',
        telefon: trainerEditModal.telefon || '',
        stile: trainerEditModal.stile || []
      });
      setTrainerEditModal(null);
      ladeAlleDaten();
      showToast('success', 'Trainer gespeichert!');
    } catch (err) {
      showToast('error', "Fehler: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteScheduleEntry = async (entryId, kursId) => {
    if (!window.confirm('Stundenplan-Eintrag löschen?')) return;
    try {
      await axios.delete(`/stundenplan/${entryId}`);
      setKursScheduleData(prev => ({
        ...prev,
        [kursId]: prev[kursId]?.filter(e => e.id !== entryId) || []
      }));
      await loadSchedule();
      showToast('success', 'Trainingszeit gelöscht.');
    } catch (e) {
      showToast('error', 'Fehler: ' + (e.response?.data?.error || e.message));
    }
  };

  // Gruppiere Kurse nach Stil
  const kurseByStil = useMemo(() => {
    const grouped = {};

    kurse
      .filter(k => !filterTrainer || k.trainer_id.toString() === filterTrainer)
      .filter(k => activeStandort === 'all' || !k.standort_id || k.standort_id === activeStandort)
      .forEach(kurs => {
        const stil = kurs.stil || 'Unbekannter Stil';
        if (!grouped[stil]) {
          grouped[stil] = [];
        }
        grouped[stil].push(kurs);
      });

    // Sortiere Kurse innerhalb jeder Gruppe basierend auf sortConfig
    Object.keys(grouped).forEach(stil => {
      grouped[stil].sort((a, b) => {
        if (!sortConfig.key) {
          // Standard: nach Gruppenname
          const aVal = a.gruppenname || '';
          const bVal = b.gruppenname || '';
          return aVal.localeCompare(bVal);
        }

        let aVal, bVal;

        // Spezielle Behandlung für Trainer (kann Array sein)
        if (sortConfig.key === 'trainer') {
          aVal = Array.isArray(a.trainer_ids) ? getTrainerNames(a.trainer_ids) : getTrainerName(a.trainer_id);
          bVal = Array.isArray(b.trainer_ids) ? getTrainerNames(b.trainer_ids) : getTrainerName(b.trainer_id);
        } else if (sortConfig.key === 'raum') {
          aVal = getRaumName(a.raum_id);
          bVal = getRaumName(b.raum_id);
        } else if (sortConfig.key === 'gruppenname') {
          aVal = a.gruppenname || '';
          bVal = b.gruppenname || '';
        } else {
          aVal = a[sortConfig.key]?.toString() || '';
          bVal = b[sortConfig.key]?.toString() || '';
        }

        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    });

    return grouped;
  }, [kurse, filterTrainer, sortConfig, activeStandort]);

  // Warning: Kurse ohne Stundenplan-Einträge (muss nach kurseByStil stehen!)
  const kurseOhneZeiten = Object.values(kurseByStil).flat().filter(k => {
    const schedule = scheduleMap[k.kurs_id] || [];
    return schedule.length === 0;
  });

  const handleCSVExport = () => {
    const csv = [
      ['Stil', 'Gruppe', 'Trainer'],
      ...kurse.map(k => [
        k.stil,
        k.gruppenname,
        getTrainerName(k.trainer_id)
      ])
    ].map(e => e.join(";")).join("\n");

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "kurse.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleHinzufuegen = async (scheduleEntries = []) => {
    if (!neuerKurs.gruppenname || !neuerKurs.stil || neuerKurs.trainer_ids.length === 0) {
      showToast('error', 'Bitte Gruppenname, Stil und mindestens einen Trainer angeben.');
      return;
    }
    if (!activeDojo) {
      showToast('error', 'Fehler: Kein Dojo ausgewählt.');
      return;
    }
    try {
      const res = await axios.post(`/kurse`, {
        gruppenname: neuerKurs.gruppenname,
        stil: neuerKurs.stil,
        trainer_ids: neuerKurs.trainer_ids,
        raum_id: neuerKurs.raum_id || null,
        dojo_id: activeDojo.id
      });
      const newKursId = res.data?.kurs_id || res.data?.id;
      if (newKursId && scheduleEntries.length > 0) {
        await Promise.all(scheduleEntries.map(entry =>
          axios.post('/stundenplan', {
            tag: entry.tag,
            uhrzeit_start: entry.uhrzeit_start,
            uhrzeit_ende: entry.uhrzeit_ende,
            kurs_id: newKursId,
            raum_id: entry.raum_id || null
          }).catch(() => {})
        ));
      }
      setNeuerKurs({ gruppenname: "", stil: "", trainer_ids: [], raum_id: "" });
      setWizardStep(1);
      setWizardEntries([]);
      setWizardEntryForm({ tag: '', uhrzeit_start: '', uhrzeit_ende: '', raum_id: '' });
      setShowNeuerKursModal(false);
      ladeAlleDaten();
      await loadSchedule();
      showToast('success', `Kurs „${neuerKurs.gruppenname}" erfolgreich erstellt!`);
    } catch (err) {
      console.error("Fehler beim Hinzufügen:", err);
      showToast('error', "Fehler: " + (err.response?.data?.error || err.message));
    }
  };

  const handleLoeschen = async (id) => {
    if (!window.confirm("Soll dieser Kurs wirklich gelöscht werden?")) return;
    try {
      const dojoFilterParam = getDojoFilterParam();
      const url = dojoFilterParam ? `/kurse/${id}?${dojoFilterParam}` : `/kurse/${id}`;
      await axios.delete(url);
      ladeAlleDaten();
      showToast('success', 'Kurs gelöscht.');
    } catch (err) {
      showToast('error', "Fehler: " + (err.response?.data?.error || err.message));
    }
  };

  const handleBearbeiten = (kurs) => {
    setEditingId(kurs.kurs_id);
    const editData = {
      gruppenname: kurs.gruppenname,
      stil: kurs.stil,
      trainer_ids: Array.isArray(kurs.trainer_ids) ? kurs.trainer_ids : [kurs.trainer_id],
      raum_id: kurs.raum_id || ""
    };
    console.log('EditingData gesetzt auf:', editData);
    setEditingData(editData);
  };

  const handleSpeichern = async (id) => {
    if (!editingData.gruppenname || !editingData.stil || editingData.trainer_ids.length === 0) {
      showToast('error', 'Bitte Gruppenname, Stil und mindestens einen Trainer angeben.');
      return;
    }
    const dojoFilterParam = getDojoFilterParam();
    const url = dojoFilterParam ? `/kurse/${id}?${dojoFilterParam}` : `/kurse/${id}`;
    try {
      await axios.put(url, {
        gruppenname: editingData.gruppenname,
        stil: editingData.stil,
        trainer_ids: editingData.trainer_ids,
        raum_id: editingData.raum_id || null
      });
      setEditingId(null);
      ladeAlleDaten();
      showToast('success', 'Kurs gespeichert!');
    } catch (err) {
      showToast('error', "Fehler: " + (err.response?.data?.error || err.message));
    }
  };

  const handleAbbrechen = () => setEditingId(null);

  const handleNewTrainer = async () => {
    if (!newTrainerData.vorname || !newTrainerData.nachname) {
      showToast('error', 'Bitte Vor- und Nachname eingeben.');
      return;
    }
    try {
      await axios.post(`/trainer`, {
        vorname: newTrainerData.vorname,
        nachname: newTrainerData.nachname,
        email: newTrainerData.email || "",
        telefon: newTrainerData.telefon || ""
      });
      setNewTrainerData({ vorname: "", nachname: "", email: "", telefon: "" });
      setShowNewTrainerForm(false);
      ladeAlleDaten();
      showToast('success', 'Trainer erfolgreich hinzugefügt!');
    } catch (err) {
      showToast('error', "Fehler: " + (err.response?.data?.error || err.message));
    }
  };

  const handleNewGroup = async () => {
    if (!newGroupName.trim()) {
      showToast('error', 'Bitte Gruppennamen eingeben.');
      return;
    }
    try {
      await axios.post(`/gruppen`, { name: newGroupName.trim() });
      setNewGroupName("");
      setShowNewGroupInput(false);
      ladeAlleDaten();
      showToast('success', 'Gruppe erfolgreich hinzugefügt!');
    } catch (err) {
      showToast('error', "Fehler: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteStil = async (stilId, stilName) => {
    if (!window.confirm(`Stil "${stilName}" wirklich löschen?`)) return;
    try {
      await axios.delete(`/stile/${stilId}`);
      ladeAlleDaten();
      showToast('success', `Stil „${stilName}" gelöscht.`);
    } catch (err) {
      showToast('error', "Fehler: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteGruppe = async (gruppenId, name) => {
    if (!window.confirm(`Gruppe "${name}" wirklich löschen?`)) return;
    try {
      await axios.delete(`/gruppen/${gruppenId}`);
      ladeAlleDaten();
      showToast('success', `Gruppe „${name}" gelöscht.`);
    } catch (err) {
      showToast('error', "Fehler: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteTrainer = async (trainerId, name) => {
    if (!window.confirm(`Trainer "${name}" wirklich löschen?`)) return;
    try {
      await axios.delete(`/trainer/${trainerId}`);
      ladeAlleDaten();
      showToast('success', `Trainer „${name}" gelöscht.`);
    } catch (err) {
      showToast('error', "Fehler: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteRaum = async (raumId, name) => {
    if (!window.confirm(`Raum "${name}" wirklich löschen?`)) return;
    try {
      await axios.delete(`/raeume/${raumId}`);
      loadRaeume();
      showToast('success', `Raum „${name}" gelöscht.`);
    } catch (err) {
      showToast('error', "Fehler: " + (err.response?.data?.error || err.message));
    }
  };

  const handleNewStyle = async () => {
    if (!newStyleName.trim()) {
      showToast('error', 'Bitte Stil-Namen eingeben.');
      return;
    }
    try {
      await axios.post(`/stile`, { name: newStyleName.trim() });
      setNewStyleName("");
      setShowNewStyleInput(false);
      ladeAlleDaten();
      showToast('success', 'Stil erfolgreich hinzugefügt!');
    } catch (err) {
      showToast('error', "Fehler: " + (err.response?.data?.error || err.message));
    }
  };

  const handleNewRoom = async (roomData, isStammdaten = false) => {
    if (!roomData.name.trim()) {
      showToast('error', 'Bitte Raum-Name eingeben.');
      return;
    }
    try {
      await axios.post(`/raeume`, {
        name: roomData.name.trim(),
        beschreibung: roomData.beschreibung.trim(),
        dojo_id: activeDojo?.id,
        groesse: roomData.groesse.trim() || null,
        kapazitaet: roomData.kapazitaet.trim() || null
      });
      if (isStammdaten) {
        setNewRoomDataStammdaten({ name: "", beschreibung: "", groesse: "", kapazitaet: "" });
        setShowNewRoomFormStammdaten(false);
      } else {
        setNewRoomData({ name: "", beschreibung: "", groesse: "", kapazitaet: "" });
        setShowNewRoomForm(false);
      }
      loadRaeume();
      showToast('success', 'Raum erfolgreich hinzugefügt!');
    } catch (err) {
      showToast('error', "Fehler: " + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="kurse-container-modern">
      {/* Toast Notification */}
      {toast && (
        <div className={`ku-toast ku-toast--${toast.type}`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.text}
        </div>
      )}

      {/* Header: Titel + kompakte Stat-Pills */}
      <div className="kurse-header ku-header">
        <h2 className="ku-header-title">🥋 {t('management.title')}</h2>
        {activeTab === "kurse" && (
          <div className="ku-header-stats">
            <div className="ku-hstat-card">
              <span className="ku-hstat-num">{kurse.length}</span>
              <span className="ku-hstat-label">Kurse</span>
            </div>
            <div className="ku-hstat-card">
              <span className="ku-hstat-num">{Object.keys(kurseByStil).length}</span>
              <span className="ku-hstat-label">Stile</span>
            </div>
            <div className="ku-hstat-card">
              <span className="ku-hstat-num">{new Set(kurse.map(k => k.trainer_id)).size}</span>
              <span className="ku-hstat-label">Trainer</span>
            </div>
            <div className="ku-hstat-card">
              <span className="ku-hstat-num">{new Set(kurse.map(k => k.raum_id).filter(Boolean)).size}</span>
              <span className="ku-hstat-label">Räume</span>
            </div>
          </div>
        )}
      </div>

      {/* Einheitliche Kontrollleiste */}
      <div className="ku-controls-bar">
        <div className="tab-navigation ku-tab-nav">
          <button className={`tab-button ${activeTab === "kurse" ? "active" : ""}`} onClick={() => setActiveTab("kurse")}>🥋 Kurse</button>
          <button className={`tab-button ${activeTab === "stundenplan" ? "active" : ""}`} onClick={() => setActiveTab("stundenplan")}>📅 Stundenplan</button>
          <button className={`tab-button ${activeTab === "stammdaten" ? "active" : ""}`} onClick={() => setActiveTab("stammdaten")}>⚙️ Trainer & Gruppen</button>
        </div>
        {activeTab === "kurse" && (
          <>
            <span className="ku-controls-divider" />
            <button onClick={() => handleSort('gruppenname')} className={`ku-ctrl ${sortConfig.key === 'gruppenname' ? 'ku-ctrl--active' : ''}`}>
              🏷️ {t('management.sortGroup')} {sortConfig.key === 'gruppenname' && getSortIcon('gruppenname')}
            </button>
            <button onClick={() => handleSort('raum')} className={`ku-ctrl ${sortConfig.key === 'raum' ? 'ku-ctrl--active' : ''}`}>
              🏛️ {t('management.sortRoom')} {sortConfig.key === 'raum' && getSortIcon('raum')}
            </button>
            <button onClick={() => handleSort('trainer')} className={`ku-ctrl ${sortConfig.key === 'trainer' ? 'ku-ctrl--active' : ''}`}>
              👨‍🏫 {t('management.sortTrainer')} {sortConfig.key === 'trainer' && getSortIcon('trainer')}
            </button>
            <span className="ku-controls-divider" />
            <select className="ku-ctrl ku-ctrl-select" onChange={e => setFilterTrainer(e.target.value)} value={filterTrainer}>
              <option value="">{t('management.allTrainers')}</option>
              {trainer.map(tr => (
                <option key={tr.trainer_id} value={tr.trainer_id}>{tr.vorname} {tr.nachname}</option>
              ))}
            </select>
            <span className="ku-controls-spacer" />
            <button className="ku-ctrl ku-ctrl--gold" onClick={() => setShowNeuerKursModal(true)}>➕ Neuer Kurs</button>
            <button className="ku-ctrl" onClick={handleCSVExport}>📊 {t('management.csvExport')}</button>
          </>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === "kurse" && renderKurseTab()}
      {activeTab === "stundenplan" && <Stundenplan />}
      {activeTab === "stammdaten" && renderEinstellungenTab()}

      {/* Trainer Edit Modal */}
      {trainerEditModal && (
        <div className="ku-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setTrainerEditModal(null); }}>
          <div className="ku-modal ku-trainer-modal">
            <div className="ku-modal-header">
              <span className="ku-modal-title">✏️ Trainer bearbeiten</span>
              <button className="ku-modal-close" onClick={() => setTrainerEditModal(null)}>✕</button>
            </div>
            <div className="ku-trainer-modal-body">
              <div className="ku-trainer-form-grid">
                <div className="ku-trainer-field">
                  <label className="ku-trainer-label">Vorname *</label>
                  <input className="sd-input" value={trainerEditModal.vorname} onChange={e => setTrainerEditModal(p => ({...p, vorname: e.target.value}))} />
                </div>
                <div className="ku-trainer-field">
                  <label className="ku-trainer-label">Nachname *</label>
                  <input className="sd-input" value={trainerEditModal.nachname} onChange={e => setTrainerEditModal(p => ({...p, nachname: e.target.value}))} />
                </div>
                <div className="ku-trainer-field">
                  <label className="ku-trainer-label">E-Mail</label>
                  <input className="sd-input" type="email" value={trainerEditModal.email} onChange={e => setTrainerEditModal(p => ({...p, email: e.target.value}))} />
                </div>
                <div className="ku-trainer-field">
                  <label className="ku-trainer-label">Telefon</label>
                  <input className="sd-input" type="tel" value={trainerEditModal.telefon} onChange={e => setTrainerEditModal(p => ({...p, telefon: e.target.value}))} />
                </div>
              </div>

              <div className="ku-trainer-stile-section">
                <div className="ku-trainer-label">Stile zuordnen</div>
                <div className="ku-trainer-stile-list">
                  {modalStile.length === 0 && (
                    <span className="ku-trainer-stile-empty">Keine Stile vorhanden</span>
                  )}
                  {modalStile.map(s => {
                    const checked = trainerEditModal.stile.includes(s.name);
                    return (
                      <label key={s.stil_id} className={`ku-trainer-stil-row${checked ? ' ku-trainer-stil-row--checked' : ''}`}>
                        <input
                          type="checkbox"
                          className="ku-trainer-stil-checkbox"
                          checked={checked}
                          onChange={() => setTrainerEditModal(p => ({
                            ...p,
                            stile: checked
                              ? p.stile.filter(x => x !== s.name)
                              : [...p.stile, s.name]
                          }))}
                        />
                        <span className="ku-trainer-stil-name">🥋 {s.name}</span>
                        {checked && <span className="ku-trainer-stil-check">✓</span>}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="ku-trainer-modal-actions">
                <button className="sd-btn sd-btn--cancel" onClick={() => setTrainerEditModal(null)}>Abbrechen</button>
                <button className="sd-btn sd-btn--save" onClick={handleSaveTrainerModal}>✅ Speichern</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderKurseTab() {
    return (
      <>
        {/* Warnung: Kurse ohne Trainingszeiten */}
        {kurseOhneZeiten.length > 0 && (
          <div className="ku-warning-banner">
            <span className="ku-warning-icon">⚠️</span>
            <div className="ku-warning-content">
              <strong>{kurseOhneZeiten.length} {kurseOhneZeiten.length === 1 ? 'Kurs hat' : 'Kurse haben'} noch keine Trainingszeiten:</strong>
              <span className="ku-warning-list">
                {kurseOhneZeiten.slice(0, 5).map(k => k.gruppenname).join(', ')}
                {kurseOhneZeiten.length > 5 ? ` + ${kurseOhneZeiten.length - 5} weitere` : ''}
              </span>
            </div>
            <button
              className="ku-warning-action"
              onClick={() => setActiveTab('stundenplan')}
            >Im Stundenplan ergänzen →</button>
          </div>
        )}

        {/* Kursliste — Cards nebeneinander, Detail-Panel darunter */}
        <div className="ku-kurslist-container">
          {Object.keys(kurseByStil).length > 0 ? (
            Object.keys(kurseByStil).sort().map((stilName) => {
              const selectedInSection = kurseByStil[stilName].find(k => k.kurs_id === expandedKursId);
              return (
              <div key={stilName} className={`ku-kurslist-section${openStile[stilName] ? ' ku-kurslist-section--open' : ''}`}>
                {/* Stil-Header — klick öffnet/schliesst */}
                <div className="ku-acc-stil-header" onClick={() => toggleStil(stilName)}>
                  <span className="ku-acc-stil-icon">🥋</span>
                  <span className="ku-acc-stil-name">{stilName}</span>
                  <span className="ku-acc-stil-count">{kurseByStil[stilName].length} Kurse</span>
                  <span className={`ku-acc-chevron${openStile[stilName] ? '' : ' ku-acc-chevron--closed'}`}>▼</span>
                </div>

                {openStile[stilName] && (<>
                  {/* Card-Grid — bleibt immer sichtbar, Karten stehen nebeneinander */}
                  <div className="ku-cards-grid">
                    {kurseByStil[stilName].map((kurs) => {
                      const isSelected = expandedKursId === kurs.kurs_id;
                      const schedule = scheduleMap[kurs.kurs_id] || [];
                      const trainerName = Array.isArray(kurs.trainer_ids)
                        ? getTrainerNames(kurs.trainer_ids)
                        : getTrainerName(kurs.trainer_id);
                      return (
                        <div key={kurs.kurs_id}
                          className={`ku-card${isSelected ? ' ku-card--selected' : ''}`}
                          onClick={() => toggleKursExpanded(kurs.kurs_id)}
                        >
                          <div className="ku-card-name">{kurs.gruppenname || '—'}</div>
                          <div className="ku-card-meta">
                            {schedule.slice(0, 3).map((s, i) => (
                              <span key={i} className="ku-schedule-tag">
                                {s.wochentag?.substring(0, 2)} {s.uhrzeit ? s.uhrzeit.substring(0, 5) : ''}
                              </span>
                            ))}
                          </div>
                          <div className="ku-card-trainer">👨‍🏫 {trainerName}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Kurs-Cockpit — öffnet sich unterhalb des Card-Grids wenn eine Karte angeklickt */}
                  {selectedInSection && (() => {
                    const kurs = selectedInSection;
                    const isEditing = editingId === kurs.kurs_id;
                    const schedule = scheduleMap[kurs.kurs_id] || [];
                    const trainerName = Array.isArray(kurs.trainer_ids)
                      ? getTrainerNames(kurs.trainer_ids)
                      : getTrainerName(kurs.trainer_id);
                    const raumName = getRaumName(kurs.raum_id);
                    const activeTab = cockpitTab[kurs.kurs_id] || 'details';
                    return (
                      <div className="ku-detail-panel ku-cockpit">
                        {/* Cockpit Header */}
                        <div className="ku-cockpit-header">
                          <span className="ku-cockpit-title">{kurs.gruppenname}</span>
                          <div className="ku-cockpit-tabs">
                            <button
                              className={`ku-cockpit-tab${activeTab === 'details' ? ' ku-cockpit-tab--active' : ''}`}
                              onClick={() => openCockpitTab(kurs.kurs_id, 'details', kurs)}
                            >✏️ Details</button>
                            <button
                              className={`ku-cockpit-tab${activeTab === 'stundenplan' ? ' ku-cockpit-tab--active' : ''}`}
                              onClick={() => openCockpitTab(kurs.kurs_id, 'stundenplan', kurs)}
                            >📅 Stundenplan</button>
                            <button
                              className={`ku-cockpit-tab${activeTab === 'mitglieder' ? ' ku-cockpit-tab--active' : ''}`}
                              onClick={() => openCockpitTab(kurs.kurs_id, 'mitglieder', kurs)}
                            >👥 Mitglieder</button>
                          </div>
                          <button className="ku-cockpit-close" onClick={() => setExpandedKursId(null)}>✕</button>
                        </div>

                        {/* Tab: Details */}
                        {activeTab === 'details' && (
                          <div className="ku-cockpit-body">
                            {isEditing ? (
                              <div className="ku-edit-panel">
                                <div className="ku-edit-fields">
                                  <div className="ku-edit-field">
                                    <label>Stil</label>
                                    <input type="text" className="sd-input" value={editingData.stil} onChange={(e) => setEditingData({...editingData, stil: e.target.value})} placeholder="Stil" />
                                  </div>
                                  <div className="ku-edit-field">
                                    <label>Gruppe</label>
                                    <select className="sd-input" value={editingData.gruppenname} onChange={(e) => setEditingData({...editingData, gruppenname: e.target.value})}>
                                      <option value="">Gruppe auswählen...</option>
                                      {gruppen.map((gruppe) => (
                                        <option key={gruppe.gruppen_id} value={gruppe.name}>{gruppe.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="ku-edit-field">
                                    <label>Raum</label>
                                    <select className="sd-input" value={editingData.raum_id || ""} onChange={(e) => setEditingData({...editingData, raum_id: e.target.value})}>
                                      <option value="">Kein Raum</option>
                                      {raeume.map(raum => (
                                        <option key={raum.id} value={raum.id}>{raum.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                                <div className="ku-edit-trainers">
                                  <label>Trainer</label>
                                  <div className="trainer-multiselect">
                                    {trainer.map(tr => (
                                      <label key={tr.trainer_id} className="trainer-checkbox-label">
                                        <input type="checkbox"
                                          checked={editingData.trainer_ids.includes(tr.trainer_id)}
                                          onChange={(e) => {
                                            const newIds = e.target.checked
                                              ? [...editingData.trainer_ids, tr.trainer_id]
                                              : editingData.trainer_ids.filter(id => id !== tr.trainer_id);
                                            setEditingData({...editingData, trainer_ids: newIds});
                                          }}
                                        />
                                        <span className="trainer-checkbox-name">{tr.vorname} {tr.nachname}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                                <div className="ku-edit-actions">
                                  <button className="sd-btn sd-btn--save" onClick={() => handleSpeichern(kurs.kurs_id)}>✅ Speichern</button>
                                  <button className="sd-btn sd-btn--cancel" onClick={handleAbbrechen}>Abbrechen</button>
                                </div>
                              </div>
                            ) : (
                              <div className="ku-detail-content">
                                <div className="ku-detail-info">
                                  <div className="ku-info-block">
                                    <span className="ku-info-label">TRAINER</span>
                                    <span className="ku-info-value ku-info-trainer">{trainerName}</span>
                                  </div>
                                  <div className="ku-info-block">
                                    <span className="ku-info-label">RAUM</span>
                                    <span className="ku-info-value">{raumName}</span>
                                  </div>
                                  <div className="ku-info-block">
                                    <span className="ku-info-label">STIL</span>
                                    <span className="ku-info-value">{kurs.stil}</span>
                                  </div>
                                  {hasMultipleLocations && kurs.standort_name && (
                                    <div className="ku-info-block">
                                      <span className="ku-info-label">STANDORT</span>
                                      <span className="ku-info-value" style={{ color: kurs.standort_farbe || '#4F46E5' }}>📍 {kurs.standort_name}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="ku-detail-actions">
                                  <button className="sd-btn sd-btn--save" onClick={() => handleBearbeiten(kurs)}>✏️ Bearbeiten</button>
                                  <button className="ku-detail-del-btn" onClick={() => handleLoeschen(kurs.kurs_id)}>🗑️ Löschen</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tab: Stundenplan (read-only — bearbeiten im Stundenplan-Tab) */}
                        {activeTab === 'stundenplan' && (
                          <div className="ku-cockpit-body">
                            <div className="ku-cockpit-sp-list">
                              {!kursScheduleData[kurs.kurs_id] ? (
                                <div className="ku-cockpit-loading">Lädt…</div>
                              ) : kursScheduleData[kurs.kurs_id].length === 0 ? (
                                <div className="ku-cockpit-empty">Noch keine Zeiten eingetragen.</div>
                              ) : (
                                kursScheduleData[kurs.kurs_id].map(entry => (
                                  <div key={entry.id} className="ku-sp-row">
                                    <span className="ku-sp-tag">{entry.tag}</span>
                                    <span className="ku-sp-time">
                                      {entry.uhrzeit_start?.substring(0,5)} – {entry.uhrzeit_ende?.substring(0,5)}
                                    </span>
                                    {entry.raumname && <span className="ku-sp-raum">🏛️ {entry.raumname}</span>}
                                  </div>
                                ))
                              )}
                            </div>
                            <button
                              className="ku-cockpit-add-btn"
                              style={{ marginTop: '0.75rem' }}
                              onClick={() => setActiveTab('stundenplan')}
                            >📅 Im Stundenplan verwalten →</button>
                          </div>
                        )}

                        {/* Tab: Mitglieder */}
                        {activeTab === 'mitglieder' && (
                          <div className="ku-cockpit-body">
                            {!kursMitgliederData[kurs.kurs_id] ? (
                              <div className="ku-cockpit-loading">Lädt…</div>
                            ) : kursMitgliederData[kurs.kurs_id].length === 0 ? (
                              <div className="ku-cockpit-empty">Keine Mitglieder mit Stil „{kurs.stil}" gefunden.</div>
                            ) : (
                              <>
                                <div className="ku-cockpit-member-count">{kursMitgliederData[kurs.kurs_id].length} Mitglieder mit Stil „{kurs.stil}"</div>
                                <div className="ku-cockpit-member-list">
                                  {kursMitgliederData[kurs.kurs_id].map(m => (
                                    <div key={m.mitglied_id} className="ku-member-row">
                                      <span className="ku-member-name">{m.vorname} {m.nachname}</span>
                                      {m.mitgliedsnummer && <span className="ku-member-nr">#{m.mitgliedsnummer}</span>}
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>)}
              </div>
            )})
          ) : (
            <div className="no-kurse-message">
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <h3>{t('list.noCoursesFound')}</h3>
                <p>{t('list.noCoursesFilter')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal für neuen Kurs — 2-Schritt-Wizard */}
        {showNeuerKursModal && (
          <div className="ku-modal-overlay" onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNeuerKursModal(false);
              setWizardStep(1);
              setWizardEntries([]);
            }
          }}>
            <div className="ku-modal ku-wizard-modal">
              <div className="ku-modal-header">
                <span className="ku-modal-title">
                  ➕ Neuer Kurs
                  <span className="ku-wizard-step-badge">Schritt {wizardStep} / 2</span>
                </span>
                <button className="ku-modal-close" onClick={() => {
                  setShowNeuerKursModal(false);
                  setWizardStep(1);
                  setWizardEntries([]);
                }}>✕</button>
              </div>

              {/* Wizard Schritt-Indikatoren */}
              <div className="ku-wizard-steps">
                <div className={`ku-wizard-step-dot${wizardStep >= 1 ? ' ku-wizard-step-dot--active' : ''}`}>
                  <span>1</span><span className="ku-wizard-step-label">Was &amp; Wer</span>
                </div>
                <div className="ku-wizard-step-line" />
                <div className={`ku-wizard-step-dot${wizardStep >= 2 ? ' ku-wizard-step-dot--active' : ''}`}>
                  <span>2</span><span className="ku-wizard-step-label">Trainingszeiten</span>
                </div>
              </div>

              {/* Step 1: Was & Wer */}
              {wizardStep === 1 && (
                <div className="ku-wizard-body">
                  <div className="form-group">
                    <label>🥋 Stil:</label>
                    <select className="form-select" value={neuerKurs.stil} onChange={(e) => setNeuerKurs({ ...neuerKurs, stil: e.target.value })}>
                      <option value="">Stil auswählen…</option>
                      {stile.filter(s => s.aktiv !== 0).map(s => <option key={s.stil_id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>🏷️ Gruppe:</label>
                    <select className="form-select" value={neuerKurs.gruppenname} onChange={(e) => setNeuerKurs({ ...neuerKurs, gruppenname: e.target.value })}>
                      <option value="">Gruppe auswählen…</option>
                      {gruppen.map(g => <option key={g.gruppen_id} value={g.name}>{g.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>🏛️ Raum (optional):</label>
                    <select className="form-select" value={neuerKurs.raum_id || ""} onChange={(e) => setNeuerKurs({ ...neuerKurs, raum_id: e.target.value })}>
                      <option value="">Kein Raum</option>
                      {raeume.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>👨‍🏫 Trainer:</label>
                    <div className="trainer-multiselect">
                      {trainer.map(tr => (
                        <label key={tr.trainer_id} className="trainer-checkbox-label">
                          <input
                            type="checkbox"
                            checked={neuerKurs.trainer_ids.includes(tr.trainer_id)}
                            onChange={(e) => {
                              const newIds = e.target.checked
                                ? [...neuerKurs.trainer_ids, tr.trainer_id]
                                : neuerKurs.trainer_ids.filter(id => id !== tr.trainer_id);
                              setNeuerKurs({ ...neuerKurs, trainer_ids: newIds });
                            }}
                          />
                          <span className="trainer-checkbox-name">{tr.vorname} {tr.nachname}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="ku-wizard-footer">
                    <button className="sd-btn sd-btn--cancel" onClick={() => { setShowNeuerKursModal(false); setWizardStep(1); }}>Abbrechen</button>
                    <button
                      className="sd-btn sd-btn--save"
                      onClick={() => {
                        if (!neuerKurs.gruppenname || !neuerKurs.stil || neuerKurs.trainer_ids.length === 0) {
                          showToast('error', 'Bitte Stil, Gruppe und mindestens einen Trainer auswählen.');
                          return;
                        }
                        setWizardStep(2);
                      }}
                    >Weiter → Trainingszeiten</button>
                  </div>
                </div>
              )}

              {/* Step 2: Trainingszeiten */}
              {wizardStep === 2 && (
                <div className="ku-wizard-body">
                  {/* Summary */}
                  <div className="ku-wizard-summary">
                    <span className="ku-wizard-summary-pill">🥋 {neuerKurs.stil}</span>
                    <span className="ku-wizard-summary-pill">🏷️ {neuerKurs.gruppenname}</span>
                    {neuerKurs.raum_id && <span className="ku-wizard-summary-pill">🏛️ {getRaumName(neuerKurs.raum_id)}</span>}
                  </div>

                  {/* Added entries */}
                  {wizardEntries.length > 0 && (
                    <div className="ku-wizard-entries">
                      {wizardEntries.map((entry, i) => (
                        <div key={i} className="ku-wizard-entry-row">
                          <span className="ku-sp-tag">{entry.tag}</span>
                          <span className="ku-sp-time">{entry.uhrzeit_start} – {entry.uhrzeit_ende}</span>
                          {entry.raum_id && <span className="ku-sp-raum">🏛️ {getRaumName(entry.raum_id)}</span>}
                          <button className="ku-sp-del" onClick={() => setWizardEntries(prev => prev.filter((_, idx) => idx !== i))}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Entry form */}
                  <div className="ku-sp-form ku-sp-form--wizard">
                    <select className="sd-input ku-sp-input" value={wizardEntryForm.tag} onChange={e => setWizardEntryForm(p => ({...p, tag: e.target.value}))}>
                      <option value="">Tag wählen…</option>
                      {['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'].map(d => <option key={d}>{d}</option>)}
                    </select>
                    <input type="time" className="sd-input ku-sp-input" value={wizardEntryForm.uhrzeit_start} onChange={e => setWizardEntryForm(p => ({...p, uhrzeit_start: e.target.value}))} />
                    <span className="ku-sp-bis">–</span>
                    <input type="time" className="sd-input ku-sp-input" value={wizardEntryForm.uhrzeit_ende} onChange={e => setWizardEntryForm(p => ({...p, uhrzeit_ende: e.target.value}))} />
                    <select className="sd-input ku-sp-input" value={wizardEntryForm.raum_id} onChange={e => setWizardEntryForm(p => ({...p, raum_id: e.target.value}))}>
                      <option value="">Kein Raum</option>
                      {raeume.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <button
                      className="ku-cockpit-add-btn"
                      onClick={() => {
                        if (!wizardEntryForm.tag || !wizardEntryForm.uhrzeit_start || !wizardEntryForm.uhrzeit_ende) {
                          showToast('error', 'Bitte Tag, Start- und Endzeit angeben.');
                          return;
                        }
                        setWizardEntries(prev => [...prev, { ...wizardEntryForm }]);
                        setWizardEntryForm({ tag: '', uhrzeit_start: '', uhrzeit_ende: '', raum_id: '' });
                      }}
                    >+ Zeit hinzufügen</button>
                  </div>

                  <div className="ku-wizard-footer">
                    <button className="sd-btn sd-btn--cancel" onClick={() => setWizardStep(1)}>← Zurück</button>
                    <button
                      className="add-button-modern"
                      onClick={() => handleHinzufuegen(wizardEntries)}
                    >
                      <span className="btn-icon">🥋</span>
                      Kurs erstellen{wizardEntries.length > 0 ? ` (${wizardEntries.length} Zeiten)` : ' (ohne Zeiten)'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  function renderEinstellungenTab() {
    const SD_TABS = [
      { key: 'trainer', icon: '👨‍🏫', label: 'Trainer' },
      { key: 'gruppen', icon: '🏷️', label: 'Gruppen' },
      { key: 'stile', icon: '🥋', label: 'Stile' },
      { key: 'raeume', icon: '🏛️', label: 'Räume' },
    ];

    const getItems = () => {
      switch(sdTab) {
        case 'trainer': return trainer;
        case 'gruppen': return gruppen;
        case 'stile': return stile;
        case 'raeume': return raeume;
        default: return [];
      }
    };

    const getItemName = (item) => {
      if (sdTab === 'trainer') return `${item.vorname} ${item.nachname}`;
      return item.name;
    };

    const getItemSub = (item) => {
      if (sdTab === 'trainer') return [item.email, item.telefon].filter(Boolean).join(' · ');
      if (sdTab === 'raeume') return [item.beschreibung, item.groesse, item.kapazitaet ? `${item.kapazitaet} Pers.` : null].filter(Boolean).join(' · ');
      return '';
    };

    const getItemKey = (item) => {
      if (sdTab === 'trainer') return item.trainer_id;
      if (sdTab === 'gruppen') return item.gruppen_id;
      if (sdTab === 'stile') return item.stil_id;
      return item.id || item.raum_id;
    };

    const handleDelete = (item) => {
      if (sdTab === 'trainer') handleDeleteTrainer(item.trainer_id, `${item.vorname} ${item.nachname}`);
      else if (sdTab === 'gruppen') handleDeleteGruppe(item.gruppen_id, item.name);
      else if (sdTab === 'stile') handleDeleteStil(item.stil_id, item.name);
      else handleDeleteRaum(item.id || item.raum_id, item.name);
    };

    const items = getItems().filter(item =>
      !sdSearch || getItemName(item).toLowerCase().includes(sdSearch.toLowerCase())
    );

    return (
      <div className="sd-container">
        {/* Compact Tab Bar */}
        <div className="ku-sd-tabs">
          {SD_TABS.map(tab => (
            <button
              key={tab.key}
              className={`ku-sd-tab${sdTab === tab.key ? ' ku-sd-tab--active' : ''}`}
              onClick={() => { setSdTab(tab.key); setSdSearch(''); setSdEditItem(null); }}
            >
              {tab.icon} {tab.label}
              <span className="ku-sd-tab-count">
                {tab.key === 'trainer' ? trainer.length : tab.key === 'gruppen' ? gruppen.length : tab.key === 'stile' ? stile.length : raeume.length}
              </span>
            </button>
          ))}
        </div>

        {/* Search + Add row */}
        <div className="ku-sd-toolbar">
          <input
            className="sd-input ku-sd-search"
            placeholder={`${SD_TABS.find(t => t.key === sdTab)?.label} suchen…`}
            value={sdSearch}
            onChange={e => setSdSearch(e.target.value)}
          />
          <button className="ku-ctrl ku-ctrl--gold" onClick={() => {
            if (sdTab === 'trainer') setShowNewTrainerForm(p => !p);
            else if (sdTab === 'gruppen') setShowNewGroupInput(p => !p);
            else if (sdTab === 'stile') setShowNewStyleInput(p => !p);
            else setShowNewRoomFormStammdaten(p => !p);
          }}>+ Hinzufügen</button>
        </div>

        {/* Add Forms */}
        {sdTab === 'trainer' && showNewTrainerForm && (
          <div className="sd-add-form">
            <div className="sd-add-grid sd-add-grid--2">
              <input className="sd-input" placeholder="Vorname *" value={newTrainerData.vorname} onChange={e => setNewTrainerData({...newTrainerData, vorname: e.target.value})} />
              <input className="sd-input" placeholder="Nachname *" value={newTrainerData.nachname} onChange={e => setNewTrainerData({...newTrainerData, nachname: e.target.value})} />
              <input className="sd-input" type="email" placeholder="E-Mail" value={newTrainerData.email} onChange={e => setNewTrainerData({...newTrainerData, email: e.target.value})} />
              <input className="sd-input" type="tel" placeholder="Telefon" value={newTrainerData.telefon} onChange={e => setNewTrainerData({...newTrainerData, telefon: e.target.value})} />
            </div>
            <div className="sd-form-actions">
              <button className="sd-btn sd-btn--save" onClick={handleNewTrainer}>✅ Hinzufügen</button>
              <button className="sd-btn sd-btn--cancel" onClick={() => { setShowNewTrainerForm(false); setNewTrainerData({ vorname: "", nachname: "", email: "", telefon: "" }); }}>Abbrechen</button>
            </div>
          </div>
        )}
        {sdTab === 'gruppen' && showNewGroupInput && (
          <div className="sd-add-form">
            <div className="sd-inline-form">
              <input className="sd-input" placeholder="Gruppenname" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleNewGroup()} autoFocus />
              <button className="sd-btn sd-btn--save" onClick={handleNewGroup}>✅</button>
              <button className="sd-btn sd-btn--cancel" onClick={() => { setShowNewGroupInput(false); setNewGroupName(""); }}>✕</button>
            </div>
          </div>
        )}
        {sdTab === 'stile' && showNewStyleInput && (
          <div className="sd-add-form">
            <div className="sd-inline-form">
              <input className="sd-input" placeholder="Stil-Name" value={newStyleName} onChange={e => setNewStyleName(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleNewStyle()} autoFocus />
              <button className="sd-btn sd-btn--save" onClick={handleNewStyle}>✅</button>
              <button className="sd-btn sd-btn--cancel" onClick={() => { setShowNewStyleInput(false); setNewStyleName(""); }}>✕</button>
            </div>
          </div>
        )}
        {sdTab === 'raeume' && showNewRoomFormStammdaten && (
          <div className="sd-add-form">
            <div className="sd-add-grid sd-add-grid--2">
              <input className="sd-input" placeholder="Raum-Name *" value={newRoomDataStammdaten.name} onChange={e => setNewRoomDataStammdaten({...newRoomDataStammdaten, name: e.target.value})} />
              <input className="sd-input" placeholder="Beschreibung" value={newRoomDataStammdaten.beschreibung} onChange={e => setNewRoomDataStammdaten({...newRoomDataStammdaten, beschreibung: e.target.value})} />
              <input className="sd-input" placeholder="Größe (z.B. 50m²)" value={newRoomDataStammdaten.groesse} onChange={e => setNewRoomDataStammdaten({...newRoomDataStammdaten, groesse: e.target.value})} />
              <input className="sd-input" type="number" placeholder="Kapazität" value={newRoomDataStammdaten.kapazitaet} onChange={e => setNewRoomDataStammdaten({...newRoomDataStammdaten, kapazitaet: e.target.value})} />
            </div>
            <div className="sd-form-actions">
              <button className="sd-btn sd-btn--save" onClick={() => handleNewRoom(newRoomDataStammdaten, true)}>✅ Hinzufügen</button>
              <button className="sd-btn sd-btn--cancel" onClick={() => { setShowNewRoomFormStammdaten(false); setNewRoomDataStammdaten({ name: "", beschreibung: "", groesse: "", kapazitaet: "" }); }}>Abbrechen</button>
            </div>
          </div>
        )}

        {/* Item list */}
        <div className="ku-sd-list">
          {items.length === 0 && (
            <div className="ku-cockpit-empty">Keine Einträge gefunden.</div>
          )}
          {items.map(item => {
            const itemKey = getItemKey(item);
            const isTrainer = sdTab === 'trainer';
            return (
              <div key={itemKey} className="ku-sd-list-row">
                <div className="ku-sd-list-info">
                  <span className="ku-sd-list-name">{getItemName(item)}</span>
                  {getItemSub(item) && <span className="ku-sd-list-sub">{getItemSub(item)}</span>}
                  {isTrainer && item.stile && item.stile.length > 0 && (
                    <div className="ku-sd-stile-pills">
                      {item.stile.map(s => <span key={s} className="ku-stil-tag">{s}</span>)}
                    </div>
                  )}
                </div>
                <div className="ku-sd-list-actions">
                  {isTrainer && (
                    <button className="sd-btn sd-btn--save" onClick={() => openTrainerModal(item)}>✏️</button>
                  )}
                  <button className="ku-detail-del-btn" onClick={() => handleDelete(item)}>🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

};

export default Kurse;
