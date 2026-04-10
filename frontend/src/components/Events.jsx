import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import config from '../config/config.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx';
import TdaTurniereList from './TdaTurniereList.jsx';
import EventsJahresplanung from './EventsJahresplanung.jsx';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/Events.css';
import '../styles/Dashboard.css';
import '../styles/TdaTurniere.css';

const Events = () => {
  const { token, isAdmin } = useAuth();
  const { activeDojo } = useDojoContext();

  const [events, setEvents] = useState([]);
  const [raeume, setRaeume] = useState([]);
  const [trainer, setTrainer] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('aktuelle'); // 'aktuelle', 'geplante', 'vergangene'

  // Modal States
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [selectedEventForParticipant, setSelectedEventForParticipant] = useState(null);
  const selectedEventRef = useRef(null);

  // Teilnehmer-Verwaltung States
  const [allMembers, setAllMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [addParticipantBestelloptionen, setAddParticipantBestelloptionen] = useState([]);
  const [adminBestellMengen, setAdminBestellMengen] = useState({});
  const [adminGaesteAnzahl, setAdminGaesteAnzahl] = useState(0);
  const [participantBemerkung, setParticipantBemerkung] = useState('');
  const [participantBezahlt, setParticipantBezahlt] = useState(false);
  const [eventRegistrations, setEventRegistrations] = useState({});

  // Form States
  const [newEvent, setNewEvent] = useState({
    titel: '',
    beschreibung: '',
    event_typ: 'Sonstiges',
    datum: '',
    uhrzeit_beginn: '',
    uhrzeit_ende: '',
    ort: '',
    raum_id: '',
    max_teilnehmer: '',
    teilnahmegebuehr: '0.00',
    anmeldefrist: '',
    status: 'geplant',
    trainer_ids: [],
    anforderungen: ''
  });
  const [newEventImage, setNewEventImage] = useState(null);
  const [selectedEventImage, setSelectedEventImage] = useState(null);
  const [activeNewTab, setActiveNewTab] = useState('basis');
  const [activeEditTab, setActiveEditTab] = useState('basis');

  // Bestelloptionen States
  const [eventBestelloptionen, setEventBestelloptionen] = useState([]);
  const [neueOption, setNeueOption] = useState({ name: '', preis: '', einheit: 'Stk' });
  const [bestellSummary, setBestellSummary] = useState(null);
  const [newEventBestelloptionen, setNewEventBestelloptionen] = useState([]); // Optionen für neues Event (lokal, vor dem Speichern)
  const [neueOptionCreate, setNeueOptionCreate] = useState({ name: '', preis: '', einheit: 'Stk' });

  // Anmeldungen Loading/Error
  const [anmeldungenLoading, setAnmeldungenLoading] = useState(false);
  const [anmeldungenError, setAnmeldungenError] = useState('');

  // Gast-Modal States (Admin fügt Gast direkt hinzu)
  const [showAddGuestModal, setShowAddGuestModal] = useState(false);
  const [guestForm, setGuestForm] = useState({ vorname: '', nachname: '', email: '', telefon: '', anzahl: 1, bemerkung: '' });
  const [adminGuestBestellMengen, setAdminGuestBestellMengen] = useState({});
  const [guestBestelloptionen, setGuestBestelloptionen] = useState([]);

  // Lade Events
  const ladeEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const dojoFilter = activeDojo?.id ? `?dojo_id=${activeDojo.id}` : '';
      const response = await axios.get(`/events${dojoFilter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Stelle sicher, dass response.data ein Array ist
      if (Array.isArray(response.data)) {
        setEvents(response.data);
      } else {
        console.error('Events API returned non-array:', response.data);
        setEvents([]);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Events:', err);
      setError('Fehler beim Laden der Events: ' + err.message);
      setEvents([]); // Stelle sicher, dass events ein Array bleibt
    } finally {
      setLoading(false);
    }
  }, [token, activeDojo]);

  // Lade Räume
  const ladeRaeume = useCallback(async () => {
    try {
      const response = await axios.get(`/raeume`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Die API gibt { success: true, data: raeume } zurück
      const raeumeData = response.data.data || response.data || [];

      // Stelle sicher, dass raeumeData ein Array ist
      if (Array.isArray(raeumeData)) {
        setRaeume(raeumeData);
      } else {
        console.error('Raeume API returned non-array:', raeumeData);
        setRaeume([]);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Räume:', err);
      setRaeume([]);
    }
  }, [token]);

  // Lade Trainer
  const ladeTrainer = useCallback(async () => {
    try {
      const response = await axios.get(`/trainer`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Stelle sicher, dass response.data ein Array ist
      if (Array.isArray(response.data)) {
        setTrainer(response.data);
      } else {
        console.error('Trainer API returned non-array:', response.data);
        setTrainer([]);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Trainer:', err);
      setTrainer([]);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      ladeEvents();
      ladeRaeume();
      ladeTrainer();
    }
  }, [token, ladeEvents, ladeRaeume, ladeTrainer]);

  // Bild hochladen
  const uploadEventBild = async (eventId, imageFile) => {
    if (!imageFile) return;
    const formData = new FormData();
    formData.append('bild', imageFile);
    try {
      await axios.post(`/events/${eventId}/bild`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
    } catch (err) {
      console.error('Fehler beim Hochladen des Bildes:', err);
    }
  };

  // Event erstellen
  const handleCreateEvent = async () => {
    setError('');

    // Konflikt-Check gegen privaten iCloud-Kalender (nur wenn Datum gesetzt)
    if (newEvent.datum) {
      try {
        const start = `${newEvent.datum}T${newEvent.uhrzeit_beginn || '00:00:00'}`;
        const end   = `${newEvent.datum}T${newEvent.uhrzeit_ende   || '23:59:59'}`;
        const cr = await axios.post(
          '/admin/calendar/check-conflict',
          { start, end },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (cr.data.conflicts?.length > 0) {
          const names = cr.data.conflicts.map(c => `• ${c.summary}`).join('\n');
          const ok = window.confirm(
            `⚠️ Terminkonflikt mit privatem Kalender!\n\n${names}\n\nTrotzdem anlegen?`
          );
          if (!ok) return;
        }
      } catch (e) {
        // Kein iCal konfiguriert oder kein Super-Admin → still ignorieren
      }
    }

    try {
      const response = await axios.post(
        `/events`,
        {
          ...newEvent,
          dojo_id: activeDojo?.id || 1,
          raum_id: newEvent.raum_id || null,
          max_teilnehmer: newEvent.max_teilnehmer ? parseInt(newEvent.max_teilnehmer) : null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Bild hochladen falls vorhanden
      const newEventId = response.data?.event_id || response.data?.id;
      if (newEventImage && newEventId) {
        await uploadEventBild(newEventId, newEventImage);
      }

      // Bestelloptionen anlegen falls vorhanden
      if (newEventId && newEventBestelloptionen.length > 0) {
        for (const opt of newEventBestelloptionen) {
          try {
            await axios.post(
              `/events/${newEventId}/bestelloptionen`,
              { name: opt.name, preis: opt.preis, einheit: opt.einheit },
              { headers: { Authorization: `Bearer ${token}` } }
            );
          } catch (err) {
            console.error('Fehler beim Anlegen der Bestelloption:', err);
          }
        }
      }

      setShowNewEvent(false);
      setNewEventImage(null);
      setNewEventBestelloptionen([]);
      setNeueOptionCreate({ name: '', preis: '', einheit: 'Stk' });
      setNewEvent({
        titel: '',
        beschreibung: '',
        event_typ: 'Sonstiges',
        datum: '',
        uhrzeit_beginn: '',
        uhrzeit_ende: '',
        ort: '',
        raum_id: '',
        max_teilnehmer: '',
        teilnahmegebuehr: '0.00',
        anmeldefrist: '',
        status: 'geplant',
        trainer_ids: [],
        anforderungen: ''
      });
      ladeEvents();
    } catch (err) {
      console.error('Fehler beim Erstellen des Events:', err);
      setError('Fehler beim Erstellen des Events: ' + (err.response?.data?.error || err.message));
    }
  };

  // Event aktualisieren
  const handleUpdateEvent = async () => {
    setError('');
    try {
      // trainer_ids aus DB kommt als String "1,2,3" → als Array normalisieren
      const trainerIds = selectedEvent.trainer_ids
        ? (Array.isArray(selectedEvent.trainer_ids)
          ? selectedEvent.trainer_ids
          : selectedEvent.trainer_ids.split(',').map(id => parseInt(id.trim())).filter(Boolean))
        : [];

      await axios.put(
        `/events/${selectedEvent.event_id}`,
        {
          ...selectedEvent,
          trainer_ids: trainerIds,
          raum_id: selectedEvent.raum_id || null,
          max_teilnehmer: selectedEvent.max_teilnehmer ? parseInt(selectedEvent.max_teilnehmer) : null,
          // ISO-Datetime → nur Datumsteil (MySQL DATE akzeptiert kein '2026-01-23T23:00:00.000Z')
          datum: selectedEvent.datum ? selectedEvent.datum.substring(0, 10) : null,
          anmeldefrist: selectedEvent.anmeldefrist ? selectedEvent.anmeldefrist.substring(0, 10) : null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Bild hochladen falls neu gewählt
      if (selectedEventImage) {
        await uploadEventBild(selectedEvent.event_id, selectedEventImage);
      }

      setShowEditEvent(false);
      setSelectedEvent(null);
      setSelectedEventImage(null);
      ladeEvents();
    } catch (err) {
      console.error('Fehler beim Aktualisieren des Events:', err);
      setError('Fehler beim Aktualisieren: ' + (err.response?.data?.error || err.message));
    }
  };

  // Event löschen
  const handleDeleteEvent = async (eventId, force = false) => {
    if (!force && !window.confirm('Möchten Sie dieses Event wirklich löschen?')) return;

    setError('');
    try {
      const url = force ? `/events/${eventId}?force=true` : `/events/${eventId}`;
      await axios.delete(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      ladeEvents();
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 409 && data?.anmeldungen > 0) {
        const ok = window.confirm(
          `⚠️ Dieses Event hat ${data.anmeldungen} Anmeldung${data.anmeldungen !== 1 ? 'en' : ''}.\n\nAlle Anmeldungen werden unwiderruflich gelöscht. Trotzdem fortfahren?`
        );
        if (ok) handleDeleteEvent(eventId, true);
      } else {
        setError('Fehler beim Löschen: ' + (data?.message || data?.error || err.message));
      }
    }
  };

  // Ref immer aktuell halten
  selectedEventRef.current = selectedEvent;

  // Anmeldungen für ein Event laden
  const ladeAnmeldungen = async (event) => {
    const eventId = event?.event_id;
    if (!eventId) return;
    setAnmeldungenLoading(true);
    setAnmeldungenError('');
    try {
      const response = await axios.get(
        `/events/${eventId}/anmeldungen`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedEvent(prev => ({ ...(prev || event), anmeldungen: response.data }));
    } catch (err) {
      console.error('Fehler beim Laden der Anmeldungen:', err);
      setAnmeldungenError('Anmeldungen konnten nicht geladen werden.');
    } finally {
      setAnmeldungenLoading(false);
    }
  };

  // Event Details anzeigen (Nicht-Admin)
  const handleShowDetails = async (event) => {
    setSelectedEvent(event);
    setShowEventDetails(true);
    await ladeAnmeldungen(event);
  };

  // Edit-Modal öffnen (Admin) — optional direkt auf Anmeldungen-Tab
  const handleOpenEdit = (event, tab = 'basis') => {
    setSelectedEvent(event);
    setSelectedEventImage(null);
    setActiveEditTab(tab);
    setShowEditEvent(true);
    setBestellSummary(null);
    if (tab === 'anmeldungen') {
      ladeAnmeldungen(event);
    }
    if (tab === 'bestelloptionen') {
      ladeBestelloptionen(event.event_id);
    }
  };

  // Bestelloptionen laden
  const ladeBestelloptionen = async (eventId) => {
    try {
      const response = await axios.get(
        `/events/${eventId}/bestelloptionen`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEventBestelloptionen(response.data.optionen || []);
    } catch (err) {
      console.error('Fehler beim Laden der Bestelloptionen:', err);
    }
  };

  // Bestelloption anlegen
  const handleAddOption = async (eventId) => {
    if (!neueOption.name.trim()) return;
    try {
      await axios.post(
        `/events/${eventId}/bestelloptionen`,
        { name: neueOption.name, preis: neueOption.preis, einheit: neueOption.einheit },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNeueOption({ name: '', preis: '', einheit: 'Stk' });
      ladeBestelloptionen(eventId);
    } catch (err) {
      console.error('Fehler beim Anlegen der Option:', err);
    }
  };

  // Bestelloption löschen
  const handleDeleteOption = async (eventId, optionId) => {
    if (!window.confirm('Option wirklich löschen?')) return;
    try {
      await axios.delete(
        `/events/${eventId}/bestelloptionen/${optionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      ladeBestelloptionen(eventId);
    } catch (err) {
      console.error('Fehler beim Löschen der Option:', err);
    }
  };

  // Bestellübersicht laden
  const ladeBestellSummary = async (eventId) => {
    try {
      const response = await axios.get(
        `/events/${eventId}/bestellungen/summary`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBestellSummary(response.data);
    } catch (err) {
      console.error('Fehler beim Laden der Bestellübersicht:', err);
    }
  };

  // Öffne Gast-hinzufügen-Modal (Admin)
  const handleShowAddGuest = async (event) => {
    setGuestForm({ vorname: '', nachname: '', email: '', telefon: '', anzahl: 1, bemerkung: '' });
    setAdminGuestBestellMengen({});
    setGuestBestelloptionen([]);
    try {
      const res = await axios.get(`/events/${event.event_id}/bestelloptionen`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const optionen = res.data.optionen || [];
      setGuestBestelloptionen(optionen);
      const initialMengen = {};
      optionen.forEach(o => { initialMengen[o.option_id] = 0; });
      setAdminGuestBestellMengen(initialMengen);
    } catch (err) {
      console.error('Fehler beim Laden der Bestelloptionen:', err);
    }
    setShowAddGuestModal(true);
  };

  // Gast speichern (Admin)
  const handleAddGuest = async () => {
    try {
      const bestellungen = Object.entries(adminGuestBestellMengen)
        .filter(([, menge]) => menge > 0)
        .map(([option_id, menge]) => ({ option_id: parseInt(option_id), menge }));
      await axios.post(`/events/${selectedEvent.event_id}/gast-anmelden`, {
        ...guestForm,
        vorname: guestForm.vorname.trim() || 'Gast',
        nachname: guestForm.nachname.trim() || '–',
        bestellungen
      });
      setShowAddGuestModal(false);
      ladeAnmeldungen(selectedEvent);
      ladeEvents();
    } catch (err) {
      alert('Fehler: ' + (err.response?.data?.error || err.message));
    }
  };

  // Bestellübersicht drucken
  const handlePrintBestellSummary = () => {
    if (!bestellSummary) return;
    const eventTitle = selectedEvent?.titel || 'Event';
    const rows = bestellSummary.summary.filter(r => r.menge_gesamt > 0);
    const today = new Date().toLocaleDateString('de-DE');
    const printWindow = window.open('', '_blank', 'width=700,height=500');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Bestellübersicht – ${eventTitle}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 2rem; color: #000; }
    h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
    .meta { color: #555; font-size: 0.9rem; margin-bottom: 1.5rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
    th { background: #f0f0f0; padding: 0.5rem 0.75rem; text-align: left; border-bottom: 2px solid #ccc; }
    td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #e0e0e0; }
    th:nth-child(2), th:nth-child(3), td:nth-child(2), td:nth-child(3) { text-align: right; }
    tfoot td { border-top: 2px solid #333; font-weight: bold; border-bottom: none; }
    @media print { body { padding: 0.5rem; } }
  </style>
</head>
<body>
  <h1>Bestellübersicht: ${eventTitle}</h1>
  <div class="meta">Erstellt am ${today}</div>
  <table>
    <thead><tr><th>Artikel</th><th>Menge</th><th>Gesamt</th></tr></thead>
    <tbody>
      ${rows.map(r => `<tr><td>${r.name}</td><td>${r.menge_gesamt} ${r.einheit}</td><td>${parseFloat(r.preis_gesamt).toFixed(2)} €</td></tr>`).join('')}
    </tbody>
    <tfoot><tr><td>Gesamt</td><td></td><td>${parseFloat(bestellSummary.gesamtbetrag).toFixed(2)} €</td></tr></tfoot>
  </table>
</body>
</html>`);
    printWindow.document.close();
    printWindow.print();
  };

  // Bezahlliste für den Eventtag drucken
  const handlePrintBezahlliste = () => {
    if (!selectedEvent?.anmeldungen) return;
    const anmeldungen = selectedEvent.anmeldungen;
    const eventTitle = selectedEvent.titel || 'Event';
    const eventDatum = selectedEvent.datum
      ? new Date(selectedEvent.datum).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
      : '';
    const teilnahmegebuehr = parseFloat(selectedEvent.teilnahmegebuehr || 0);

    const rows = anmeldungen.map(a => {
      const bestellungsText = a.bestellungen?.length > 0
        ? a.bestellungen.map(b => `${b.menge}× ${b.name}`).join(', ')
        : '';
      let betrag = 0;
      if (teilnahmegebuehr > 0) betrag += teilnahmegebuehr * (1 + (a.gaeste_anzahl || 0));
      if (a.bestellungen?.length > 0) {
        betrag += a.bestellungen.reduce((sum, b) => sum + b.menge * parseFloat(b.preis || 0), 0);
      }
      return {
        name: `${a.vorname} ${a.nachname}`,
        gaeste: a.gaeste_anzahl > 0 ? `+${a.gaeste_anzahl}` : '',
        isGast: !!a.ist_gast,
        bestellung: bestellungsText,
        betrag,
        bezahlt: !a.ist_gast && !!a.bezahlt
      };
    });

    const printWindow = window.open('', '_blank', 'width=900,height=650');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Bezahlliste – ${eventTitle}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 1.5rem 2rem; color: #000; font-size: 0.9rem; }
    h1 { font-size: 1.4rem; margin-bottom: 0.2rem; }
    .meta { color: #444; font-size: 0.85rem; margin-bottom: 1.5rem; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #e8e8e8; padding: 0.5rem 0.6rem; text-align: left; border-top: 2px solid #555; border-bottom: 2px solid #555; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.4px; }
    td { padding: 0.5rem 0.6rem; border-bottom: 1px solid #d0d0d0; vertical-align: top; }
    .col-name { width: 22%; font-weight: 600; }
    .col-artikel { width: 45%; color: #333; font-size: 0.85rem; }
    .col-preis { width: 13%; text-align: right; font-weight: 600; white-space: nowrap; }
    .col-check { width: 10%; text-align: center; font-size: 1rem; }
    th.col-preis { text-align: right; }
    th.col-check { text-align: center; }
    .badge-gast { display: inline-block; background: #fff3cd; border: 1px solid #f0c04c; padding: 0 4px; border-radius: 3px; font-size: 0.72rem; font-weight: normal; margin-left: 4px; }
    .badge-gaeste { display: inline-block; background: #d4edda; border: 1px solid #80c69e; padding: 0 4px; border-radius: 3px; font-size: 0.72rem; margin-left: 4px; }
    .paid { color: #1a7f1a; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .footer { margin-top: 2rem; font-size: 0.78rem; color: #888; border-top: 1px solid #ccc; padding-top: 0.5rem; display: flex; justify-content: space-between; }
    @media print { body { padding: 0.5rem 1rem; } }
  </style>
</head>
<body>
  <h1>Bezahlliste: ${eventTitle}</h1>
  <div class="meta">${eventDatum}${teilnahmegebuehr > 0 ? ` &nbsp;·&nbsp; Teilnahmegebühr: ${teilnahmegebuehr.toFixed(2)} €` : ''} &nbsp;·&nbsp; ${anmeldungen.length} Anmeldungen</div>
  <table>
    <thead>
      <tr>
        <th class="col-name">Name</th>
        <th class="col-artikel">Bestellung / Artikel</th>
        <th class="col-preis">Betrag</th>
        <th class="col-check">Bezahlt</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => `
        <tr>
          <td class="col-name">
            ${r.name}
            ${r.isGast ? '<span class="badge-gast">Gast</span>' : ''}
            ${r.gaeste ? `<span class="badge-gaeste">${r.gaeste}&nbsp;Gäste</span>` : ''}
          </td>
          <td class="col-artikel">${r.bestellung || '–'}</td>
          <td class="col-preis">${r.betrag.toFixed(2)} €</td>
          <td class="col-check">${r.bezahlt ? '<span class="paid">✓</span>' : '☐'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="footer">
    <span>Gedruckt am ${new Date().toLocaleDateString('de-DE')}</span>
    <span>Gesamt offen: ${rows.filter(r => !r.bezahlt && r.betrag > 0).reduce((s, r) => s + r.betrag, 0).toFixed(2)} €</span>
  </div>
</body>
</html>`);
    printWindow.document.close();
    printWindow.print();
  };

  // Lade alle Mitglieder für Teilnehmer-Auswahl (ALLE Mitglieder, nicht nur vom aktuellen Dojo)
  useEffect(() => {
    const loadMembers = async () => {
      if (!isAdmin) return;
      try {
        const response = await axios.get(`/mitglieder/all`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAllMembers(response.data || []);
      } catch (err) {
        console.error('Fehler beim Laden der Mitglieder:', err);
      }
    };
    loadMembers();
  }, [isAdmin, token]);

  // Öffne Add Participant Modal
  const handleShowAddParticipant = async (event) => {
    setSelectedEventForParticipant(event);
    setSelectedMemberId('');
    setMemberSearchQuery('');
    setParticipantBemerkung('');
    setParticipantBezahlt(false);
    setAdminBestellMengen({});
    setAdminGaesteAnzahl(0);
    setAddParticipantBestelloptionen([]);

    // Lade existierende Anmeldungen + Bestelloptionen parallel
    try {
      const [anmeldungenRes, bestelloptionenRes] = await Promise.all([
        axios.get(`/events/${event.event_id}/anmeldungen`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`/events/${event.event_id}/bestelloptionen`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const registeredIds = anmeldungenRes.data.map(a => a.mitglied_id);
      setEventRegistrations(prev => ({...prev, [event.event_id]: registeredIds}));
      const optionen = bestelloptionenRes.data.optionen || [];
      setAddParticipantBestelloptionen(optionen);
      const initialMengen = {};
      optionen.forEach(o => { initialMengen[o.option_id] = 0; });
      setAdminBestellMengen(initialMengen);
    } catch (err) {
      console.error('Fehler beim Laden:', err);
    }

    setShowAddParticipantModal(true);
  };

  // Füge Teilnehmer zum Event hinzu
  const handleAddParticipant = async () => {
    if (!selectedMemberId) {
      alert('Bitte wählen Sie ein Mitglied aus');
      return;
    }

    setError('');
    try {
      const bestellungen = Object.entries(adminBestellMengen)
        .filter(([, menge]) => menge > 0)
        .map(([option_id, menge]) => ({ option_id: parseInt(option_id), menge }));

      const response = await axios.post(
        `/events/${selectedEventForParticipant.event_id}/admin-anmelden`,
        {
          mitglied_id: parseInt(selectedMemberId),
          bemerkung: participantBemerkung || undefined,
          bezahlt: participantBezahlt,
          bestellungen,
          gaeste_anzahl: adminGaesteAnzahl
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setShowAddParticipantModal(false);
        ladeEvents();
        ladeAnmeldungen(selectedEventForParticipant);
      }
    } catch (err) {
      console.error('Fehler beim Hinzufügen des Teilnehmers:', err);
      alert('Fehler: ' + (err.response?.data?.error || err.message));
    }
  };

  // Markiere Anmeldung als bezahlt
  const handleMarkAsPaid = async (anmeldungId) => {
    if (!confirm('Anmeldung als bezahlt markieren?')) {
      return;
    }

    try {
      const response = await axios.put(
        `/events/anmeldung/${anmeldungId}/bezahlt`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert(response.data.message || 'Anmeldung als bezahlt markiert');
        // Refresh event details um aktualisierte Anmeldung zu zeigen
        if (selectedEvent) {
          const eventResponse = await axios.get(
            `/events/${selectedEvent.event_id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setSelectedEvent(eventResponse.data);
        }
      }
    } catch (err) {
      console.error('Fehler beim Markieren als bezahlt:', err);
      alert('Fehler: ' + (err.response?.data?.error || err.message));
    }
  };

  // Formatiere Datum
  const formatDatum = (datum) => {
    if (!datum) return '';
    return new Date(datum).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Formatiere Uhrzeit
  const formatUhrzeit = (zeit) => {
    if (!zeit) return '';
    return zeit.substring(0, 5);
  };

  // Event-Typ Badge-Farbe
  const getEventTypColor = (typ) => {
    const colors = {
      'Turnier': 'badge-danger',
      'Lehrgang': 'badge-info',
      'Prüfung': 'badge-warning',
      'Seminar': 'badge-success',
      'Workshop': 'badge-primary',
      'Feier': 'badge-special',
      'Sonstiges': 'badge-secondary'
    };
    return colors[typ] || 'badge-secondary';
  };

  // Status Badge-Farbe
  const getStatusColor = (status) => {
    const colors = {
      'geplant': 'badge-secondary',
      'anmeldung_offen': 'badge-success',
      'ausgebucht': 'badge-danger',
      'abgeschlossen': 'badge-info',
      'abgesagt': 'badge-dark'
    };
    return colors[status] || 'badge-secondary';
  };

  // Status-Text
  const getStatusText = (status) => {
    const texts = {
      'geplant': 'Geplant',
      'anmeldung_offen': 'Anmeldung offen',
      'ausgebucht': 'Ausgebucht',
      'abgeschlossen': 'Abgeschlossen',
      'abgesagt': 'Abgesagt'
    };
    return texts[status] || status;
  };

  // Trainer-Namen formatieren
  const getTrainerNamen = (trainer_ids) => {
    if (!trainer_ids) return 'Keine Trainer zugewiesen';
    const ids = trainer_ids.split(',').map(id => parseInt(id.trim()));
    const namen = ids
      .map(id => {
        const t = trainer.find(tr => tr.trainer_id === id);
        return t ? `${t.vorname} ${t.nachname}` : null;
      })
      .filter(Boolean);
    return namen.length > 0 ? namen.join(', ') : 'Keine Trainer zugewiesen';
  };

  // Events nach Datum filtern
  const getFilteredEvents = () => {
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);

    return events.filter(event => {
      const eventDatum = new Date(event.datum);
      eventDatum.setHours(0, 0, 0, 0);

      if (activeTab === 'aktuelle') {
        // Heute und zukünftig
        return eventDatum.getTime() >= heute.getTime();
      } else if (activeTab === 'geplante') {
        // Nur Status "geplant" (noch nicht zur Anmeldung offen)
        return eventDatum.getTime() >= heute.getTime() && event.status === 'geplant';
      } else if (activeTab === 'vergangene') {
        // Vergangen
        return eventDatum.getTime() < heute.getTime();
      }
      return true;
    });
  };

  const filteredEvents = getFilteredEvents();

  // Tab-Konfiguration für Sidebar
  const tabs = [
    { key: 'aktuelle',      label: 'Aktuelle',      icon: '📅' },
    { key: 'geplante',      label: 'Geplante',       icon: '🗓️' },
    { key: 'vergangene',    label: 'Vergangene',     icon: '📜' },
    { key: 'jahresplanung', label: 'Jahresplanung',  icon: '📆' },
    { key: 'tda-turniere',  label: 'TDA Turniere',   icon: '🏆' },
  ];

  return (
    <div className="events-container">
      <div className="events-layout">
        {/* Sidebar */}
        <aside className="events-sidebar">
          {/* Sidebar Header */}
          <div className="events-sidebar-header">
            <div className="events-icon">📅</div>
            <h2 className="events-sidebar-title">Events</h2>
          </div>

          {/* Neues Event Button - oben prominent */}
          {isAdmin && (
            <button
              className="btn-create-event"
              onClick={() => setShowNewEvent(true)}
            >
              <span>➕</span>
              <span>Neues Event erstellen</span>
            </button>
          )}

          {/* Navigation Tabs */}
          <nav className="tabs-vertical">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`tab-vertical-btn ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="events-content">
          {error && (
            <div className="error-message ev-mb-1rem">
              ⚠️ {error}
            </div>
          )}

          <div className="glass-card">
            <div className="card-body">
            {activeTab === 'jahresplanung' ? (
              <EventsJahresplanung
                token={token}
                activeDojo={activeDojo}
                onCreateEvent={(datum) => {
                  setNewEvent(prev => ({ ...prev, datum }));
                  setShowNewEvent(true);
                }}
              />
            ) : activeTab === 'tda-turniere' ? (
              <TdaTurniereList />
            ) : loading ? (
              <div className="loading-state">
                <p>Lade Events...</p>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📅</div>
                <h3>Keine {activeTab === 'aktuelle' ? 'aktuellen' : activeTab === 'geplante' ? 'geplanten' : 'vergangenen'} Events</h3>
                <p>{activeTab === 'aktuelle' ? 'Heute finden keine Events statt.' : activeTab === 'geplante' ? 'Es sind noch keine Events geplant.' : 'Es gibt noch keine vergangenen Events.'}</p>
              </div>
            ) : (
              <div className="events-list">
                {filteredEvents.map((event) => (
                  <div
                    key={event.event_id}
                    className={`event-card ${activeTab === 'vergangene' ? 'event-card-compact' : ''}`}
                    onClick={isAdmin
                      ? () => handleOpenEdit(event, 'anmeldungen')
                      : activeTab === 'vergangene' ? () => handleShowDetails(event) : undefined}
                    style={isAdmin || activeTab === 'vergangene' ? { cursor: 'pointer' } : {}}
                  >
                    {activeTab === 'vergangene' ? (
                      // Kompakte Ansicht für vergangene Events
                      <div className="ev-card-compact-row" onClick={(e) => e.stopPropagation()}>
                        <div className="u-flex-1-min0">
                          <div className="ev-compact-title">{event.titel}</div>
                          <div className="ev-compact-date">📅 {formatDatum(event.datum)}</div>
                        </div>
                        {isAdmin && (
                          <div className="ev-btn-group">
                            <button className="btn-icon ev-btn-anmeldungen" onClick={(e) => { e.stopPropagation(); handleOpenEdit(event, 'anmeldungen'); }} title="Anmeldungen">
                              👥{event.anzahl_anmeldungen > 0 ? ` (${event.anzahl_anmeldungen})` : ''}
                            </button>
                            <button className="btn-icon ev-btn-xxs" onClick={(e) => { e.stopPropagation(); handleOpenEdit(event, 'basis'); }} title="Bearbeiten">✏️</button>
                            <button className="btn-icon btn-danger ev-btn-xxs" onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.event_id); }} title="Löschen">🗑️</button>
                          </div>
                        )}
                      </div>
                    ) : (
                      // Vollständige Ansicht für aktuelle und geplante Events
                      <>
                        {/* Header: Titel + Admin-Icons rechts */}
                        <div className="ev-card-header-row">
                          <h3 className="ev-card-title">{event.titel}</h3>
                          {isAdmin && (
                            <div className="ev-btn-group">
                              <button
                                className="btn-icon ev-btn-xs"
                                onClick={(e) => { e.stopPropagation(); handleOpenEdit(event, 'basis'); }}
                                title="Bearbeiten"
                              >✏️</button>
                              <button
                                className="btn-icon btn-danger ev-btn-xs"
                                onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.event_id); }}
                                title="Löschen"
                              >🗑️</button>
                            </div>
                          )}
                        </div>

                        {/* Body: Badges + Info */}
                        <div className="ev-card-body-pad">
                          {/* Badges */}
                          <div className="event-badges ev-mb-3">
                            <span className={`badge ${getEventTypColor(event.event_typ)}`}>{event.event_typ}</span>
                            <span className={`badge ${getStatusColor(event.status)}`}>{getStatusText(event.status)}</span>
                          </div>

                          {event.bild_url && (
                            <div className="ev-mb-img">
                              <img src={event.bild_url} alt={event.titel} className="ev-img-card-sm" />
                            </div>
                          )}

                          <div className="event-info-row">
                            <span className="event-icon">📅</span>
                            <span>{formatDatum(event.datum)}{event.uhrzeit_beginn && ` · ${formatUhrzeit(event.uhrzeit_beginn)}${event.uhrzeit_ende ? `–${formatUhrzeit(event.uhrzeit_ende)}` : ''}`}</span>
                          </div>

                          {event.ort && (
                            <div className="event-info-row">
                              <span className="event-icon">📍</span>
                              <span>{event.ort}</span>
                            </div>
                          )}

                          {event.max_teilnehmer && (
                            <div className="event-info-row">
                              <span className="event-icon">👥</span>
                              <span>
                                {event.anzahl_anmeldungen || 0} / {event.max_teilnehmer} Teilnehmer
                                {event.verfuegbare_plaetze === 0 && <span className="text-danger"> · ausgebucht</span>}
                              </span>
                            </div>
                          )}

                          {event.teilnahmegebuehr > 0 && (
                            <div className="event-info-row">
                              <span className="event-icon">💰</span>
                              <span>{parseFloat(event.teilnahmegebuehr).toFixed(2)} €</span>
                            </div>
                          )}

                          {event.beschreibung && (
                            <div className="event-description">
                              <p>{event.beschreibung}</p>
                            </div>
                          )}

                          {event.anmeldefrist && (
                            <div className="event-info-row">
                              <span className="event-icon">⏰</span>
                              <span>Anmeldefrist: {formatDatum(event.anmeldefrist)}</span>
                            </div>
                          )}
                        </div>

                        {/* Footer */}
                        <div className={`ev-card-footer-row${isAdmin ? ' ev-card-footer-row--admin' : ''}`}>
                          {isAdmin && (
                            <button
                              className="btn-icon ev-btn-anmeldungen-footer"
                              onClick={(e) => { e.stopPropagation(); handleOpenEdit(event, 'anmeldungen'); }}
                            >
                              👥 Anmeldungen{event.anzahl_anmeldungen > 0 ? ` (${event.anzahl_anmeldungen})` : ''}
                            </button>
                          )}
                          {!isAdmin && (
                            <button className="btn btn-primary ev-btn-sm" onClick={(e) => { e.stopPropagation(); handleShowDetails(event); }}>
                              Details
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Modal: Neues Event */}
      {showNewEvent && isAdmin && (
        <div className="modal-overlay" onClick={() => { setShowNewEvent(false); setActiveNewTab('basis'); }}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Neues Event erstellen</h2>
              <button className="modal-close" onClick={() => { setShowNewEvent(false); setActiveNewTab('basis'); }}>✕</button>
            </div>

            {/* Tab Bar */}
            <div className="modal-tabs-bar">
              {[['basis', '📋 Basis'], ['ort', '📍 Ort & Teilnehmer'], ['details', '📝 Details'], ['bestelloptionen', `🛒 Bestelloptionen${newEventBestelloptionen.length > 0 ? ` (${newEventBestelloptionen.length})` : ''}`]].map(([key, label]) => (
                <button key={key} onClick={() => setActiveNewTab(key)} className={`modal-tab-btn${activeNewTab === key ? ' active' : ''}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="modal-body">
              {/* Tab: Basis */}
              {activeNewTab === 'basis' && (
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Titel *</label>
                    <input type="text" value={newEvent.titel}
                      onChange={(e) => setNewEvent({ ...newEvent, titel: e.target.value })}
                      placeholder="z.B. Sommerturnier 2025" />
                  </div>
                  <div className="form-group">
                    <label>Event-Typ</label>
                    <select value={newEvent.event_typ} onChange={(e) => setNewEvent({ ...newEvent, event_typ: e.target.value })}>
                      <option value="Turnier">Turnier</option>
                      <option value="Lehrgang">Lehrgang</option>
                      <option value="Prüfung">Prüfung</option>
                      <option value="Seminar">Seminar</option>
                      <option value="Workshop">Workshop</option>
                      <option value="Feier">Feier</option>
                      <option value="Sonstiges">Sonstiges</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={newEvent.status} onChange={(e) => setNewEvent({ ...newEvent, status: e.target.value })}>
                      <option value="geplant">Geplant</option>
                      <option value="anmeldung_offen">Anmeldung offen</option>
                      <option value="ausgebucht">Ausgebucht</option>
                      <option value="abgeschlossen">Abgeschlossen</option>
                      <option value="abgesagt">Abgesagt</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Datum *</label>
                    <input type="date" value={newEvent.datum}
                      onChange={(e) => setNewEvent({ ...newEvent, datum: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Anmeldefrist</label>
                    <input type="date" value={newEvent.anmeldefrist}
                      onChange={(e) => setNewEvent({ ...newEvent, anmeldefrist: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Beginn</label>
                    <input type="time" value={newEvent.uhrzeit_beginn}
                      onChange={(e) => setNewEvent({ ...newEvent, uhrzeit_beginn: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Ende</label>
                    <input type="time" value={newEvent.uhrzeit_ende}
                      onChange={(e) => setNewEvent({ ...newEvent, uhrzeit_ende: e.target.value })} />
                  </div>
                </div>
              )}

              {/* Tab: Ort & Teilnehmer */}
              {activeNewTab === 'ort' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>Ort</label>
                    <input type="text" value={newEvent.ort}
                      onChange={(e) => setNewEvent({ ...newEvent, ort: e.target.value })}
                      placeholder="z.B. Haupthalle" />
                  </div>
                  <div className="form-group">
                    <label>Raum</label>
                    <select value={newEvent.raum_id} onChange={(e) => setNewEvent({ ...newEvent, raum_id: e.target.value })}>
                      <option value="">Kein Raum</option>
                      {Array.isArray(raeume) && raeume.map((raum) => (
                        <option key={raum.raum_id || raum.id} value={raum.raum_id || raum.id}>{raum.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Max. Teilnehmer</label>
                    <input type="number" value={newEvent.max_teilnehmer}
                      onChange={(e) => setNewEvent({ ...newEvent, max_teilnehmer: e.target.value })}
                      placeholder="Leer = unbegrenzt" min="1" />
                  </div>
                  <div className="form-group">
                    <label>Teilnahmegebühr (€)</label>
                    <input type="number" step="0.01" value={newEvent.teilnahmegebuehr}
                      onChange={(e) => setNewEvent({ ...newEvent, teilnahmegebuehr: e.target.value })} />
                  </div>
                  <div className="form-group full-width">
                    <label>Trainer</label>
                    <div className="trainer-multiselect">
                      {trainer.map((t) => (
                        <label key={t.trainer_id} className="trainer-checkbox">
                          <input type="checkbox" checked={newEvent.trainer_ids.includes(t.trainer_id)}
                            onChange={(e) => {
                              setNewEvent({ ...newEvent, trainer_ids: e.target.checked
                                ? [...newEvent.trainer_ids, t.trainer_id]
                                : newEvent.trainer_ids.filter(id => id !== t.trainer_id) });
                            }} />
                          {t.vorname} {t.nachname}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Details */}
              {activeNewTab === 'details' && (
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Beschreibung</label>
                    <textarea value={newEvent.beschreibung} rows="4"
                      onChange={(e) => setNewEvent({ ...newEvent, beschreibung: e.target.value })}
                      placeholder="Beschreiben Sie das Event..." />
                  </div>
                  <div className="form-group full-width">
                    <label>Anforderungen / Voraussetzungen</label>
                    <textarea value={newEvent.anforderungen} rows="3"
                      onChange={(e) => setNewEvent({ ...newEvent, anforderungen: e.target.value })}
                      placeholder="z.B. Mindestgraduierung, Ausrüstung, etc." />
                  </div>
                  <div className="form-group full-width">
                    <label>Eventbild</label>
                    <input type="file" accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={(e) => setNewEventImage(e.target.files[0] || null)} />
                    {newEventImage && (
                      <img src={URL.createObjectURL(newEventImage)} alt="Vorschau"
                        className="ev-img-preview-sm" />
                    )}
                  </div>
                </div>
              )}

              {/* Tab: Bestelloptionen (Create) */}
              {activeNewTab === 'bestelloptionen' && (
                <div>
                  <p className="ev-section-subtitle-sm">
                    Artikel, die Teilnehmer bei der Anmeldung bestellen können (z.B. Weißwurst, Breze, Kaffee).
                  </p>
                  {newEventBestelloptionen.length > 0 && (
                    <table className="ev-table-full">
                      <thead>
                        <tr className="ev-row-border">
                          <th className="ev-td-pad">Name</th>
                          <th className="ev-td-right">Preis</th>
                          <th className="ev-td-pad">Einheit</th>
                          <th className="ev-td-pad"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {newEventBestelloptionen.map((opt, idx) => (
                          <tr key={idx} className="ev-row-border">
                            <td className="ev-td-pad">{opt.name}</td>
                            <td className="ev-td-right">{parseFloat(opt.preis || 0).toFixed(2)} €</td>
                            <td className="ev-td-pad">{opt.einheit}</td>
                            <td className="ev-td-pad">
                              <button onClick={() => setNewEventBestelloptionen(newEventBestelloptionen.filter((_, i) => i !== idx))}
                                className="ev-btn-delete">🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div className="ev-add-option-row">
                    <div className="ev-field-flex2">
                      <label className="ev-label-sm">Name *</label>
                      <input type="text" value={neueOptionCreate.name} placeholder="z.B. Weißwurst"
                        onChange={(e) => setNeueOptionCreate({ ...neueOptionCreate, name: e.target.value })}
                        className="ev-input-full" />
                    </div>
                    <div className="u-flex-1">
                      <label className="ev-label-sm">Preis (€)</label>
                      <input type="number" step="0.01" min="0" value={neueOptionCreate.preis} placeholder="0.00"
                        onChange={(e) => setNeueOptionCreate({ ...neueOptionCreate, preis: e.target.value })}
                        className="ev-input-full" />
                    </div>
                    <div className="u-flex-1">
                      <label className="ev-label-sm">Einheit</label>
                      <input type="text" value={neueOptionCreate.einheit} placeholder="Stk"
                        onChange={(e) => setNeueOptionCreate({ ...neueOptionCreate, einheit: e.target.value })}
                        className="ev-input-full" />
                    </div>
                    <button
                      onClick={() => {
                        if (!neueOptionCreate.name.trim()) return;
                        setNewEventBestelloptionen([...newEventBestelloptionen, { ...neueOptionCreate }]);
                        setNeueOptionCreate({ name: '', preis: '', einheit: 'Stk' });
                      }}
                      className="btn btn-primary ev-nowrap">
                      + Hinzufügen
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowNewEvent(false); setActiveNewTab('basis'); setNewEventBestelloptionen([]); setNeueOptionCreate({ name: '', preis: '', einheit: 'Stk' }); }}>Abbrechen</button>
              <button className="btn btn-primary" onClick={handleCreateEvent}>Event erstellen</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Event bearbeiten */}
      {showEditEvent && selectedEvent && isAdmin && (
        <div className="modal-overlay" onClick={() => { setShowEditEvent(false); setActiveEditTab('basis'); }}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedEvent.titel}</h2>
              <button className="modal-close" onClick={() => { setShowEditEvent(false); setActiveEditTab('basis'); }}>✕</button>
            </div>

            {/* Tab Bar */}
            <div className="modal-tabs-bar">
              {[['basis', '📋 Basis'], ['ort', '📍 Ort & Teilnehmer'], ['details', '📝 Details'], ['bestelloptionen', '🛒 Bestelloptionen'], ['anmeldungen', `👥 Anmeldungen${selectedEvent.anmeldungen ? ` (${selectedEvent.anmeldungen.length})` : ''}`]].map(([key, label]) => (
                <button key={key} onClick={(e) => {
                  e.preventDefault();
                  setActiveEditTab(key);
                  const ev = selectedEventRef.current;
                  if (key === 'anmeldungen') ladeAnmeldungen(ev);
                  if (key === 'bestelloptionen') { ladeBestelloptionen(ev.event_id); setBestellSummary(null); }
                }} className={`modal-tab-btn${activeEditTab === key ? ' active' : ''}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="modal-body">
              {/* Tab: Basis */}
              {activeEditTab === 'basis' && (
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Titel *</label>
                    <input type="text" value={selectedEvent.titel}
                      onChange={(e) => setSelectedEvent({ ...selectedEvent, titel: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Event-Typ</label>
                    <select value={selectedEvent.event_typ} onChange={(e) => setSelectedEvent({ ...selectedEvent, event_typ: e.target.value })}>
                      <option value="Turnier">Turnier</option>
                      <option value="Lehrgang">Lehrgang</option>
                      <option value="Prüfung">Prüfung</option>
                      <option value="Seminar">Seminar</option>
                      <option value="Workshop">Workshop</option>
                      <option value="Feier">Feier</option>
                      <option value="Sonstiges">Sonstiges</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={selectedEvent.status} onChange={(e) => setSelectedEvent({ ...selectedEvent, status: e.target.value })}>
                      <option value="geplant">Geplant</option>
                      <option value="anmeldung_offen">Anmeldung offen</option>
                      <option value="ausgebucht">Ausgebucht</option>
                      <option value="abgeschlossen">Abgeschlossen</option>
                      <option value="abgesagt">Abgesagt</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Datum *</label>
                    <input type="date" value={selectedEvent.datum?.substring(0, 10)}
                      onChange={(e) => setSelectedEvent({ ...selectedEvent, datum: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Anmeldefrist</label>
                    <input type="date" value={selectedEvent.anmeldefrist?.substring(0, 10) || ''}
                      onChange={(e) => setSelectedEvent({ ...selectedEvent, anmeldefrist: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Beginn</label>
                    <input type="time" value={selectedEvent.uhrzeit_beginn || ''}
                      onChange={(e) => setSelectedEvent({ ...selectedEvent, uhrzeit_beginn: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Ende</label>
                    <input type="time" value={selectedEvent.uhrzeit_ende || ''}
                      onChange={(e) => setSelectedEvent({ ...selectedEvent, uhrzeit_ende: e.target.value })} />
                  </div>
                </div>
              )}

              {/* Tab: Ort & Teilnehmer */}
              {activeEditTab === 'ort' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>Ort</label>
                    <input type="text" value={selectedEvent.ort || ''}
                      onChange={(e) => setSelectedEvent({ ...selectedEvent, ort: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Raum</label>
                    <select value={selectedEvent.raum_id || ''} onChange={(e) => setSelectedEvent({ ...selectedEvent, raum_id: e.target.value })}>
                      <option value="">Kein Raum</option>
                      {Array.isArray(raeume) && raeume.map((raum) => (
                        <option key={raum.raum_id || raum.id} value={raum.raum_id || raum.id}>{raum.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Max. Teilnehmer</label>
                    <input type="number" value={selectedEvent.max_teilnehmer || ''}
                      onChange={(e) => setSelectedEvent({ ...selectedEvent, max_teilnehmer: e.target.value })} min="1" />
                  </div>
                  <div className="form-group">
                    <label>Teilnahmegebühr (€)</label>
                    <input type="number" step="0.01" value={selectedEvent.teilnahmegebuehr}
                      onChange={(e) => setSelectedEvent({ ...selectedEvent, teilnahmegebuehr: e.target.value })} />
                  </div>
                  <div className="form-group full-width">
                    <label>Trainer</label>
                    <div className="trainer-multiselect">
                      {trainer.map((t) => {
                        const currentIds = selectedEvent.trainer_ids
                          ? (Array.isArray(selectedEvent.trainer_ids)
                            ? selectedEvent.trainer_ids
                            : selectedEvent.trainer_ids.split(',').map(id => parseInt(id.trim())).filter(Boolean))
                          : [];
                        return (
                          <label key={t.trainer_id} className="trainer-checkbox">
                            <input type="checkbox" checked={currentIds.includes(t.trainer_id)}
                              onChange={(e) => {
                                const ids = Array.isArray(selectedEvent.trainer_ids)
                                  ? selectedEvent.trainer_ids
                                  : (selectedEvent.trainer_ids
                                    ? selectedEvent.trainer_ids.split(',').map(id => parseInt(id.trim())).filter(Boolean)
                                    : []);
                                setSelectedEvent({ ...selectedEvent, trainer_ids: e.target.checked
                                  ? [...ids, t.trainer_id]
                                  : ids.filter(id => id !== t.trainer_id) });
                              }} />
                            {t.vorname} {t.nachname}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Details */}
              {activeEditTab === 'details' && (
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Beschreibung</label>
                    <textarea value={selectedEvent.beschreibung || ''} rows="4"
                      onChange={(e) => setSelectedEvent({ ...selectedEvent, beschreibung: e.target.value })} />
                  </div>
                  <div className="form-group full-width">
                    <label>Anforderungen / Voraussetzungen</label>
                    <textarea value={selectedEvent.anforderungen || ''} rows="3"
                      onChange={(e) => setSelectedEvent({ ...selectedEvent, anforderungen: e.target.value })} />
                  </div>
                  <div className="form-group full-width">
                    <label>Eventbild</label>
                    {selectedEvent.bild_url && !selectedEventImage && (
                      <div className="ev-mb-3">
                        <img src={selectedEvent.bild_url} alt="Aktuelles Bild"
                          className="ev-img-edit-preview" />
                        <div className="ev-img-hint">
                          Neues Bild hochladen um zu ersetzen
                        </div>
                      </div>
                    )}
                    <input type="file" accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={(e) => setSelectedEventImage(e.target.files[0] || null)} />
                    {selectedEventImage && (
                      <img src={URL.createObjectURL(selectedEventImage)} alt="Vorschau"
                        className="ev-img-preview-sm" />
                    )}
                  </div>
                </div>
              )}

              {/* Tab: Bestelloptionen */}
              {activeEditTab === 'bestelloptionen' && (
                <div>
                  <h3 className="ev-section-h3">
                    Bestelloptionen verwalten
                  </h3>
                  <p className="ev-section-desc">
                    Füge Artikel hinzu, die Teilnehmer bei der Anmeldung bestellen können (z.B. Weißwürste, Breze, Kaffee).
                  </p>

                  {/* Bestehende Optionen */}
                  {eventBestelloptionen.length > 0 && (
                    <table className="ev-table-orders">
                      <thead>
                        <tr className="ev-row-border-light">
                          <th className="ev-th-left-muted">Artikel</th>
                          <th className="ev-td-right-muted-lg">Preis</th>
                          <th className="ev-th-left-muted">Einheit</th>
                          <th className="ev-w-40"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {eventBestelloptionen.map(opt => (
                          <tr key={opt.option_id} className="ev-tr-border-faint">
                            <td className="ev-td-sm">{opt.name}</td>
                            <td className="ev-td-sm-right">{parseFloat(opt.preis).toFixed(2)} €</td>
                            <td className="ev-td-sm">{opt.einheit}</td>
                            <td className="ev-td-sm-center">
                              <button
                                onClick={() => handleDeleteOption(selectedEvent.event_id, opt.option_id)}
                                className="ev-btn-delete-red"
                                title="Löschen"
                              >🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {eventBestelloptionen.length === 0 && (
                    <p className="ev-empty-options">
                      Noch keine Bestelloptionen vorhanden
                    </p>
                  )}

                  {/* Neue Option hinzufügen */}
                  <div className="ev-add-option-row-edit">
                    <div className="ev-field-flex2-min">
                      <label className="ev-label-muted">Artikel *</label>
                      <input
                        type="text"
                        value={neueOption.name}
                        onChange={(e) => setNeueOption(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="z.B. Weißwurst"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddOption(selectedEvent.event_id)}
                      />
                    </div>
                    <div className="ev-field-flex">
                      <label className="ev-label-muted">Preis (€)</label>
                      <input
                        type="number"
                        step="0.10"
                        min="0"
                        value={neueOption.preis}
                        onChange={(e) => setNeueOption(prev => ({ ...prev, preis: e.target.value }))}
                        placeholder="2.80"
                      />
                    </div>
                    <div className="ev-field-flex">
                      <label className="ev-label-muted">Einheit</label>
                      <input
                        type="text"
                        value={neueOption.einheit}
                        onChange={(e) => setNeueOption(prev => ({ ...prev, einheit: e.target.value }))}
                        placeholder="Stk"
                      />
                    </div>
                    <button
                      className="btn btn-primary ev-nowrap"
                      onClick={() => handleAddOption(selectedEvent.event_id)}
                      disabled={!neueOption.name.trim()}
                    >
                      + Hinzufügen
                    </button>
                  </div>
                </div>
              )}

              {/* Tab: Anmeldungen */}
              {activeEditTab === 'anmeldungen' && (
                <div>
                  <div className="ev-anmeldungen-header">
                    <h3 className="ev-anmeldungen-count">
                      {selectedEvent.anmeldungen ? `${selectedEvent.anmeldungen.length} Anmeldungen` : 'Lade...'}
                    </h3>
                    <div className="u-flex-wrap-gap">
                      <button className="btn btn-secondary ev-btn-sm"
                        onClick={() => ladeBestellSummary(selectedEvent.event_id)}>
                        📊 Bestellübersicht
                      </button>
                      <button className="btn btn-secondary ev-btn-sm"
                        onClick={handlePrintBezahlliste}>
                        💳 Bezahlliste
                      </button>
                      <button className="btn btn-secondary ev-btn-sm"
                        onClick={() => handleShowAddParticipant(selectedEvent)}>
                        👤➕ Mitglied
                      </button>
                      <button className="btn btn-secondary ev-btn-sm"
                        onClick={() => handleShowAddGuest(selectedEvent)}>
                        🎟️ Gast
                      </button>
                      <button className="btn btn-secondary ev-btn-sm"
                        onClick={() => { const url = `${window.location.origin}/event/${selectedEvent.event_id}/gast`; navigator.clipboard?.writeText(url); alert(`Gast-Link kopiert:\n${url}`); }}>
                        🔗 Gast-Link
                      </button>
                    </div>
                  </div>

                  {/* Bestellübersicht */}
                  {bestellSummary && (
                    <div className="ev-bestelluebersicht">
                      <div className="ev-bestelluebersicht-header">
                        <strong>📊 Bestellübersicht</strong>
                        <div className="ev-bestelluebersicht-actions">
                          <button onClick={handlePrintBestellSummary} className="ev-btn-print">🖨️ Drucken</button>
                          <button onClick={() => setBestellSummary(null)} className="ev-btn-dismiss-inline">✕</button>
                        </div>
                      </div>
                      {bestellSummary.summary.filter(r => r.menge_gesamt > 0).length === 0 ? (
                        <p className="ev-text-muted-sm">Keine Bestellungen vorhanden</p>
                      ) : (
                        <table className="ev-table-summary">
                          <thead>
                            <tr className="ev-row-border-light">
                              <th className="ev-th-left-no-color">Artikel</th>
                              <th className="ev-td-right-muted">Menge</th>
                              <th className="ev-td-right-muted">Gesamt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bestellSummary.summary.filter(r => r.menge_gesamt > 0).map(r => (
                              <tr key={r.option_id} className="ev-tr-border-faint2">
                                <td className="ev-td-pad-xs">{r.name}</td>
                                <td className="ev-td-right-xs">{r.menge_gesamt} {r.einheit}</td>
                                <td className="ev-td-right-xs">{parseFloat(r.preis_gesamt).toFixed(2)} €</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="ev-tr-total">
                              <td className="ev-td-pad">Gesamt</td>
                              <td></td>
                              <td className="ev-td-right">{parseFloat(bestellSummary.gesamtbetrag).toFixed(2)} €</td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  )}

                  {anmeldungenError ? (
                    <div className="ev-text-center-pad">
                      <p className="ev-error-text">⚠️ {anmeldungenError}</p>
                      <button className="btn btn-secondary ev-btn-sm-85"
                        onClick={() => ladeAnmeldungen(selectedEventRef.current)}>
                        🔄 Erneut laden
                      </button>
                    </div>
                  ) : anmeldungenLoading || !selectedEvent.anmeldungen ? (
                    <p className="ev-text-muted-center">
                      ⏳ Lade Anmeldungen...
                    </p>
                  ) : selectedEvent.anmeldungen.length === 0 ? (
                    <p className="ev-text-muted-center">Noch keine Anmeldungen</p>
                  ) : (
                    <div className="anmeldungen-liste">
                      {selectedEvent.anmeldungen.map((anmeldung) => (
                        <div key={anmeldung.ist_gast ? `gast-${anmeldung.gast_id}` : anmeldung.anmeldung_id} className="anmeldung-card">
                          <div className="anmeldung-header">
                            <div className="u-flex-row-sm">
                              <strong>{anmeldung.vorname} {anmeldung.nachname}</strong>
                              {anmeldung.ist_gast && (
                                <span className="ev-badge-gast">🎟️ Gast</span>
                              )}
                              {!anmeldung.ist_gast && anmeldung.gaeste_anzahl > 0 && (
                                <span className="ev-badge-gaeste">+{anmeldung.gaeste_anzahl} Gast{anmeldung.gaeste_anzahl > 1 ? 'e' : ''}</span>
                              )}
                            </div>
                            {!anmeldung.ist_gast && <span className={`badge ${getStatusColor(anmeldung.status)}`}>{getStatusText(anmeldung.status)}</span>}
                            {anmeldung.ist_gast && <span className={`badge ${getStatusColor(anmeldung.status)}`}>{getStatusText(anmeldung.status)}</span>}
                          </div>
                          <div className="anmeldung-info">
                            {anmeldung.email && <div>📧 {anmeldung.email}</div>}
                            {anmeldung.telefon && <div>📱 {anmeldung.telefon}</div>}
                            {anmeldung.ist_gast && anmeldung.anzahl > 1 && <div>👥 {anmeldung.anzahl} Personen</div>}
                            <div>Angemeldet: {formatDatum(anmeldung.anmeldedatum)}</div>
                            {!anmeldung.ist_gast && (anmeldung.bezahlt ? (
                              <div className="text-success">✅ Bezahlt</div>
                            ) : (
                              <div className="u-flex-row-sm">
                                <div className="text-warning">⏳ Nicht bezahlt</div>
                                <button onClick={() => handleMarkAsPaid(anmeldung.anmeldung_id)} className="ev-btn-paid">Als bezahlt markieren</button>
                              </div>
                            ))}
                            {anmeldung.bemerkung && <div className="anmeldung-bemerkung"><em>{anmeldung.bemerkung}</em></div>}
                            {anmeldung.bestellungen && anmeldung.bestellungen.length > 0 && (
                              <div className="ev-bestellungen-list">
                                🍽️ {anmeldung.ist_gast
                                  ? anmeldung.bestellungen.map(b => `${b.menge}× ${b.name}`).join(' | ')
                                  : anmeldung.bestellungen.map(b => `${b.menge}× ${b.name} (${parseFloat(b.preis * b.menge).toFixed(2)} €)`).join(' | ')}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowEditEvent(false); setActiveEditTab('basis'); }}>Abbrechen</button>
              {activeEditTab !== 'anmeldungen' && activeEditTab !== 'bestelloptionen' && (
                <button className="btn btn-primary" onClick={handleUpdateEvent}>Speichern</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Event Details (für nicht-Admin) */}
      {showEventDetails && selectedEvent && (
        <div className="modal-overlay" onClick={() => setShowEventDetails(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedEvent.titel}</h2>
              <button className="modal-close" onClick={() => setShowEventDetails(false)}>✕</button>
            </div>
            <div className="modal-body">
              {selectedEvent.bild_url && (
                <img src={selectedEvent.bild_url} alt={selectedEvent.titel}
                  className="ev-img-hero" />
              )}
              <div className="details-info">
                <div className="info-row">
                  <span className="info-label">Typ:</span>
                  <span className={`badge ${getEventTypColor(selectedEvent.event_typ)}`}>{selectedEvent.event_typ}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Status:</span>
                  <span className={`badge ${getStatusColor(selectedEvent.status)}`}>{getStatusText(selectedEvent.status)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Datum:</span>
                  <span>{formatDatum(selectedEvent.datum)}</span>
                </div>
                {selectedEvent.uhrzeit_beginn && (
                  <div className="info-row">
                    <span className="info-label">Uhrzeit:</span>
                    <span>{formatUhrzeit(selectedEvent.uhrzeit_beginn)}{selectedEvent.uhrzeit_ende && ` – ${formatUhrzeit(selectedEvent.uhrzeit_ende)}`}</span>
                  </div>
                )}
                {selectedEvent.ort && <div className="info-row"><span className="info-label">Ort:</span><span>{selectedEvent.ort}</span></div>}
                {selectedEvent.teilnahmegebuehr > 0 && (
                  <div className="info-row">
                    <span className="info-label">Gebühr:</span>
                    <span>{parseFloat(selectedEvent.teilnahmegebuehr).toFixed(2)} €</span>
                  </div>
                )}
                {selectedEvent.anmeldefrist && (
                  <div className="info-row">
                    <span className="info-label">Anmeldefrist:</span>
                    <span>{formatDatum(selectedEvent.anmeldefrist)}</span>
                  </div>
                )}
              </div>
              {selectedEvent.beschreibung && <div className="ev-mt-1"><p>{selectedEvent.beschreibung}</p></div>}
              {selectedEvent.anforderungen && (
                <div className="ev-anforderungen-box">
                  <strong>Anforderungen:</strong> {selectedEvent.anforderungen}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEventDetails(false)}>Schließen</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Teilnehmer hinzufügen */}
      {showAddParticipantModal && selectedEventForParticipant && isAdmin && (
        <div className="modal-overlay" onClick={() => setShowAddParticipantModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Teilnehmer hinzufügen</h2>
              <button className="modal-close" onClick={() => setShowAddParticipantModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="ev-section-subtitle">
                Event: <strong className="u-text-primary">{selectedEventForParticipant.titel}</strong>
              </p>
              <div className="form-group">
                <label>Mitglied auswählen *</label>
                <input
                  type="text"
                  placeholder="Name oder E-Mail suchen..."
                  value={memberSearchQuery}
                  onChange={(e) => { setMemberSearchQuery(e.target.value); setSelectedMemberId(''); }}
                  className="ev-search-input"
                  autoFocus
                />
                {(() => {
                  const registeredIds = eventRegistrations[selectedEventForParticipant.event_id] || [];
                  const q = memberSearchQuery.toLowerCase().trim();
                  const filtered = allMembers
                    .filter(m => !registeredIds.includes(m.mitglied_id))
                    .filter(m => !q || `${m.vorname} ${m.nachname} ${m.email}`.toLowerCase().includes(q))
                    .sort((a, b) => a.nachname.localeCompare(b.nachname) || a.vorname.localeCompare(b.vorname));
                  return (
                    <div className="ev-member-list">
                      {filtered.length === 0 ? (
                        <div className="ev-member-empty">Keine Treffer</div>
                      ) : filtered.map(m => (
                        <div key={m.mitglied_id}
                          className={`ev-member-item${selectedMemberId === String(m.mitglied_id) ? ' ev-member-item--selected' : ''}`}
                          onClick={() => { setSelectedMemberId(String(m.mitglied_id)); setMemberSearchQuery(`${m.vorname} ${m.nachname}`); }}
                        >
                          <strong>{m.nachname}, {m.vorname}</strong>
                          {m.email && <span className="ev-ml-sm-muted">({m.email})</span>}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {addParticipantBestelloptionen.length > 0 && (
                <div className="form-group">
                  <label>Bestellung</label>
                  {addParticipantBestelloptionen.map(opt => (
                    <div key={opt.option_id} className="ev-option-row">
                      <span className="ev-text-sm">{opt.name} <span className="ev-opacity-muted">({parseFloat(opt.preis).toFixed(2)} €/{opt.einheit})</span></span>
                      <div className="u-flex-row-sm">
                        <button onClick={() => setAdminBestellMengen(prev => ({ ...prev, [opt.option_id]: Math.max(0, (prev[opt.option_id] || 0) - 1) }))}
                          className="ev-qty-btn">−</button>
                        <span className="ev-qty-count">{adminBestellMengen[opt.option_id] || 0}</span>
                        <button onClick={() => setAdminBestellMengen(prev => ({ ...prev, [opt.option_id]: (prev[opt.option_id] || 0) + 1 }))}
                          className="ev-qty-btn">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="form-group">
                <label>Gäste mitbringen</label>
                <div className="u-flex-row-md">
                  <button onClick={() => setAdminGaesteAnzahl(Math.max(0, adminGaesteAnzahl - 1))}
                    className="ev-stepper-btn">−</button>
                  <span className="ev-qty-count-lg">{adminGaesteAnzahl}</span>
                  <button onClick={() => setAdminGaesteAnzahl(adminGaesteAnzahl + 1)}
                    className="ev-stepper-btn">+</button>
                  <span className="u-text-secondary-sm">Person(en) zusätzlich</span>
                </div>
              </div>
              <div className="form-group">
                <label>Bemerkung (optional)</label>
                <textarea rows="2" value={participantBemerkung}
                  onChange={(e) => setParticipantBemerkung(e.target.value)}
                  placeholder="Optionale Notiz..." />
              </div>
              <div className="form-group">
                <label>Zahlungsstatus</label>
                <div className="ev-radio-group">
                  <label className="ev-label-row">
                    <input type="radio" name="bezahlt-participant" checked={participantBezahlt === true} onChange={() => setParticipantBezahlt(true)} />
                    Bezahlt
                  </label>
                  <label className="ev-label-row">
                    <input type="radio" name="bezahlt-participant" checked={participantBezahlt === false} onChange={() => setParticipantBezahlt(false)} />
                    Offen
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddParticipantModal(false)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={handleAddParticipant} disabled={!selectedMemberId}>✓ Hinzufügen</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Gast hinzufügen (Admin) */}
      {showAddGuestModal && selectedEvent && isAdmin && (
        <div className="modal-overlay" onClick={() => setShowAddGuestModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🎟️ Gast hinzufügen</h2>
              <button className="modal-close" onClick={() => setShowAddGuestModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="ev-section-subtitle">
                Event: <strong className="u-text-primary">{selectedEvent.titel}</strong>
              </p>
              <div className="ev-form-grid">
                <div className="form-group">
                  <label>Vorname *</label>
                  <input type="text" value={guestForm.vorname}
                    onChange={e => setGuestForm({ ...guestForm, vorname: e.target.value })}
                    placeholder="Vorname" autoFocus />
                </div>
                <div className="form-group">
                  <label>Nachname *</label>
                  <input type="text" value={guestForm.nachname}
                    onChange={e => setGuestForm({ ...guestForm, nachname: e.target.value })}
                    placeholder="Nachname" />
                </div>
              </div>
              <div className="form-group ev-mb-3">
                <label>E-Mail (optional)</label>
                <input type="email" value={guestForm.email}
                  onChange={e => setGuestForm({ ...guestForm, email: e.target.value })}
                  placeholder="gast@beispiel.de" />
              </div>
              <div className="ev-form-grid">
                <div className="form-group">
                  <label>Telefon (optional)</label>
                  <input type="text" value={guestForm.telefon}
                    onChange={e => setGuestForm({ ...guestForm, telefon: e.target.value })}
                    placeholder="0176 ..." />
                </div>
                <div className="form-group">
                  <label>Anzahl Personen</label>
                  <input type="number" min="1" max="20" value={guestForm.anzahl}
                    onChange={e => setGuestForm({ ...guestForm, anzahl: parseInt(e.target.value) || 1 })} />
                </div>
              </div>
              {guestBestelloptionen.length > 0 && (
                <div className="form-group ev-mb-3">
                  <label>Bestellung</label>
                  {guestBestelloptionen.map(opt => (
                    <div key={opt.option_id} className="ev-option-row">
                      <span className="ev-text-sm">{opt.name} <span className="ev-opacity-muted">({parseFloat(opt.preis).toFixed(2)} €/{opt.einheit})</span></span>
                      <div className="u-flex-row-sm">
                        <button type="button" onClick={() => setAdminGuestBestellMengen(prev => ({ ...prev, [opt.option_id]: Math.max(0, (prev[opt.option_id] || 0) - 1) }))}
                          className="ev-qty-btn">−</button>
                        <span className="ev-qty-count">{adminGuestBestellMengen[opt.option_id] || 0}</span>
                        <button type="button" onClick={() => setAdminGuestBestellMengen(prev => ({ ...prev, [opt.option_id]: (prev[opt.option_id] || 0) + 1 }))}
                          className="ev-qty-btn">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="form-group">
                <label>Bemerkung (optional)</label>
                <textarea rows="2" value={guestForm.bemerkung}
                  onChange={e => setGuestForm({ ...guestForm, bemerkung: e.target.value })}
                  placeholder="Optionale Notiz..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddGuestModal(false)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={handleAddGuest}>
                🎟️ Gast hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;
