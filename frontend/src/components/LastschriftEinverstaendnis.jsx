/**
 * LastschriftEinverstaendnis.jsx
 * Admin-Ansicht: Lastschrift-Einverständnisverwaltung
 * Zeigt Status aller Mitglieder, erlaubt Massen-E-Mail-Versand und manuelle Anpassungen.
 */

import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { DatenContext } from '@shared/DatenContext.jsx';
import '../styles/LastschriftEinverstaendnis.css';

const STATUS_LABEL = {
  zugestimmt: 'Zugestimmt',
  abgelehnt:  'Abgelehnt',
  ausstehend: 'Ausstehend',
  null:       'Nicht angefragt',
};

const STATUS_CLASS = {
  zugestimmt: 'le-badge--ok',
  abgelehnt:  'le-badge--no',
  ausstehend: 'le-badge--pending',
  null:       'le-badge--none',
};

const STATUS_FILTER_OPTIONS = [
  { value: '',            label: 'Alle Mitglieder' },
  { value: 'zugestimmt', label: 'Zugestimmt' },
  { value: 'abgelehnt',  label: 'Abgelehnt' },
  { value: 'ausstehend', label: 'Ausstehend' },
  { value: 'ohne',       label: 'Nicht angefragt' },
];

function fmt(dt) {
  if (!dt) return '–';
  return new Date(dt).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function LastschriftEinverstaendnis() {
  const { activeDojo } = useContext(DatenContext);
  const dojoId = activeDojo?.id || null;

  const [members, setMembers]         = useState([]);
  const [stats, setStats]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch]           = useState('');
  const [msg, setMsg]                 = useState({ type: '', text: '' });
  const [sending, setSending]         = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editRow, setEditRow]         = useState(null); // { id, status, notiz }

  const ladeData = useCallback(async () => {
    if (!dojoId) return;
    setLoading(true);
    try {
      const [membRes, statsRes] = await Promise.all([
        axios.get('/lastschrift-einverstaendnis', { params: { status: filterStatus, search, dojo_id: dojoId } }),
        axios.get('/lastschrift-einverstaendnis/stats', { params: { dojo_id: dojoId } }),
      ]);
      setMembers(membRes.data.data || []);
      setStats(statsRes.data.stats || null);
    } catch (err) {
      setMsg({ type: 'error', text: 'Fehler beim Laden: ' + (err.response?.data?.error || err.message) });
    } finally {
      setLoading(false);
    }
  }, [filterStatus, search, dojoId]);

  useEffect(() => { ladeData(); }, [ladeData]);

  const [showVorlage, setShowVorlage] = useState(false);

  const handleSendenAlle = async () => {
    if (!window.confirm('E-Mail-Anfrage an alle Mitglieder ohne bisherige Anfrage senden?')) return;
    setSending(true);
    setMsg({ type: '', text: '' });
    try {
      const res = await axios.post('/lastschrift-einverstaendnis/senden', { nur_ohne_anfrage: true, dojo_id: dojoId });
      setMsg({ type: 'ok', text: res.data.message });
      ladeData();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Fehler' });
    } finally {
      setSending(false);
    }
  };

  const handleSendenAusgewaehlt = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Anfrage an ${selectedIds.size} ausgewählte Mitglieder senden?`)) return;
    setSending(true);
    try {
      const res = await axios.post('/lastschrift-einverstaendnis/senden', {
        mitglied_ids: [...selectedIds],
        dojo_id: dojoId,
      });
      setMsg({ type: 'ok', text: res.data.message });
      setSelectedIds(new Set());
      ladeData();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Fehler' });
    } finally {
      setSending(false);
    }
  };

  const handleErinnerung = async () => {
    if (!window.confirm('Erinnerungs-E-Mail an alle mit Status "Ausstehend" senden?')) return;
    setSending(true);
    try {
      const res = await axios.post('/lastschrift-einverstaendnis/erinnerung', { dojo_id: dojoId });
      setMsg({ type: 'ok', text: res.data.message });
      ladeData();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Fehler' });
    } finally {
      setSending(false);
    }
  };

  const handleStatusSpeichern = async () => {
    if (!editRow) return;
    try {
      await axios.put(`/lastschrift-einverstaendnis/${editRow.id}/status`, {
        status: editRow.status,
        notiz:  editRow.notiz,
        dojo_id: dojoId,
      });
      setMsg({ type: 'ok', text: 'Status gespeichert.' });
      setEditRow(null);
      ladeData();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Fehler' });
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === members.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(members.map(m => m.mitglied_id)));
    }
  };

  if (!dojoId) {
    return (
      <div className="le-container">
        <div className="le-header">
          <div>
            <h2 className="le-title">Lastschrift-Einverständnis</h2>
            <p className="le-subtitle">Verwalte, wer dem automatischen Lastschrifteinzug bei Einkäufen zugestimmt hat.</p>
          </div>
        </div>
        <div className="le-hint-box">
          <strong>Bitte wähle zuerst ein Dojo aus</strong>, um die Lastschrift-Einverständnisse zu verwalten.
        </div>
      </div>
    );
  }

  return (
    <div className="le-container">
      {/* Header */}
      <div className="le-header">
        <div>
          <h2 className="le-title">Lastschrift-Einverständnis</h2>
          <p className="le-subtitle">
            Verwalte, wer dem automatischen Lastschrifteinzug bei Einkäufen zugestimmt hat.
          </p>
        </div>
      </div>

      {/* Meldung */}
      {msg.text && (
        <div className={`le-msg le-msg--${msg.type}`}>
          {msg.text}
          <button className="le-msg-close" onClick={() => setMsg({ type: '', text: '' })}>✕</button>
        </div>
      )}

      {/* Stats-Karten */}
      {stats && (
        <div className="le-stats">
          {[
            { label: 'Mitglieder gesamt',    value: stats.total,        cls: '' },
            { label: 'Zugestimmt',           value: stats.zugestimmt,   cls: 'le-stat--ok' },
            { label: 'Abgelehnt',            value: stats.abgelehnt,    cls: 'le-stat--no' },
            { label: 'Ausstehend',           value: stats.ausstehend,   cls: 'le-stat--pending' },
            { label: 'Nicht angefragt',      value: stats.ohne,         cls: 'le-stat--none' },
          ].map(s => (
            <div key={s.label} className={`le-stat-card ${s.cls}`}>
              <div className="le-stat-value">{s.value ?? '–'}</div>
              <div className="le-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* E-Mail-Vorlage */}
      <div className="le-vorlage-wrap">
        <button className="le-vorlage-toggle" onClick={() => setShowVorlage(v => !v)}>
          {showVorlage ? '▲' : '▼'} E-Mail-Vorschau anzeigen
        </button>
        {showVorlage && (
          <div className="le-vorlage-box">
            <div className="le-vorlage-meta">
              <span><strong>Betreff:</strong> Einverständnis Lastschrifteinzug — [Dojo-Name]</span>
            </div>
            <div className="le-vorlage-body">
              <p>Hallo <em>[Vorname Nachname]</em>,</p>
              <p>
                um Ihnen den Einkauf in unserem Shop so komfortabel wie möglich zu gestalten,
                möchten wir Sie fragen, ob Sie damit einverstanden sind, dass zukünftige Einkäufe
                automatisch per <strong>SEPA-Lastschrift</strong> von Ihrem hinterlegten Konto
                eingezogen werden.
              </p>
              <div className="le-vorlage-infobox">
                <strong>Was bedeutet das konkret?</strong><br />
                Bei jedem Kauf im Dojo-Shop wird der Betrag automatisch von Ihrem Bankkonto
                abgebucht — bequem ohne weiteren Zahlungsschritt. Sie haben gemäß SEPA-Regelwerk
                ein Widerrufsrecht von 8 Wochen.
              </div>
              <p>Bitte teilen Sie uns Ihre Entscheidung mit:</p>
              <div className="le-vorlage-btns">
                <span className="le-vorlage-btn-ja">✓ Ja, ich stimme zu</span>
                <span className="le-vorlage-btn-nein">✗ Nein, ich lehne ab</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#888' }}>
                Dieser Link ist 30 Tage gültig. Sie können Ihre Entscheidung jederzeit über uns widerrufen.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Aktions-Leiste */}
      <div className="le-actions">
        <div className="le-filter-bar">
          <input
            className="le-search"
            type="text"
            placeholder="Name oder E-Mail suchen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="le-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            {STATUS_FILTER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="le-btn-group">
          {selectedIds.size > 0 && (
            <button className="le-btn le-btn--primary" onClick={handleSendenAusgewaehlt} disabled={sending}>
              {sending ? '…' : `Anfrage an ${selectedIds.size} senden`}
            </button>
          )}
          <button className="le-btn le-btn--secondary" onClick={handleErinnerung} disabled={sending}>
            {sending ? '…' : `Erinnerung (${stats?.ausstehend ?? 0} ausstehend)`}
          </button>
          <button className="le-btn le-btn--primary" onClick={handleSendenAlle} disabled={sending}>
            {sending ? 'Sende…' : `Anfrage an alle (${stats?.ohne ?? 0} ohne Anfrage)`}
          </button>
        </div>
      </div>

      {/* Tabelle */}
      {loading ? (
        <div className="le-loading">Lade…</div>
      ) : members.length === 0 ? (
        <div className="le-empty">Keine Mitglieder gefunden.</div>
      ) : (
        <div className="le-table-wrap">
          <table className="le-table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox"
                    checked={selectedIds.size === members.length && members.length > 0}
                    onChange={toggleAll} />
                </th>
                <th>Mitglied</th>
                <th>E-Mail</th>
                <th>Status</th>
                <th>Angefragt am</th>
                <th>Beantwortet am</th>
                <th>Kanal</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => {
                const statusKey = m.einverstaendnis_status || 'null';
                const isEditing = editRow && editRow._mitglied_id === m.mitglied_id;
                return (
                  <tr key={m.mitglied_id} className={selectedIds.has(m.mitglied_id) ? 'le-row--selected' : ''}>
                    <td>
                      <input type="checkbox"
                        checked={selectedIds.has(m.mitglied_id)}
                        onChange={() => toggleSelect(m.mitglied_id)} />
                    </td>
                    <td className="le-name">{m.vorname} {m.nachname}</td>
                    <td className="le-email">{m.email || '–'}</td>
                    <td>
                      <span className={`le-badge ${STATUS_CLASS[statusKey]}`}>
                        {STATUS_LABEL[statusKey]}
                      </span>
                    </td>
                    <td className="le-date">{fmt(m.angefragt_am)}</td>
                    <td className="le-date">{fmt(m.beantwortet_am)}</td>
                    <td className="le-kanal">{m.kanal || '–'}</td>
                    <td>
                      {!isEditing ? (
                        <button
                          className="le-btn le-btn--sm le-btn--ghost"
                          onClick={() => setEditRow({
                            id: m.einverstaendnis_id,
                            _mitglied_id: m.mitglied_id,
                            status: m.einverstaendnis_status || 'ausstehend',
                            notiz: m.notiz || '',
                          })}
                          disabled={!m.einverstaendnis_id}
                          title={!m.einverstaendnis_id ? 'Erst Anfrage senden' : 'Status manuell setzen'}
                        >
                          Bearbeiten
                        </button>
                      ) : (
                        <div className="le-inline-edit">
                          <select
                            className="le-select-sm"
                            value={editRow.status}
                            onChange={e => setEditRow(r => ({ ...r, status: e.target.value }))}
                          >
                            <option value="ausstehend">Ausstehend</option>
                            <option value="zugestimmt">Zugestimmt</option>
                            <option value="abgelehnt">Abgelehnt</option>
                          </select>
                          <input
                            className="le-notiz-input"
                            type="text"
                            placeholder="Notiz…"
                            value={editRow.notiz}
                            onChange={e => setEditRow(r => ({ ...r, notiz: e.target.value }))}
                          />
                          <button className="le-btn le-btn--sm le-btn--primary" onClick={handleStatusSpeichern}>
                            Speichern
                          </button>
                          <button className="le-btn le-btn--sm le-btn--ghost" onClick={() => setEditRow(null)}>
                            ✕
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Hinweis */}
      <div className="le-hint-box">
        <strong>Hinweis:</strong> Die Zustimmung wird mit Zeitstempel, Kanal (E-Mail / Portal / Admin)
        und IP-Adresse gespeichert. Eine einmal gegebene Antwort kann vom Admin nachträglich korrigiert
        werden (z.&nbsp;B. bei telefonischer Zustimmung). Mitglieder ohne E-Mail-Adresse müssen manuell
        eingetragen werden.
      </div>
    </div>
  );
}
