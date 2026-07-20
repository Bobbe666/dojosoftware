import React, { useState, useEffect, useCallback } from 'react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import CreateUserModal from './CreateUserModal';

// ERP-Rollensystem Phase 2: dojo-scoped Verwaltung der Staff-Accounts (admin_users).
// Zeigt Mitarbeiter mit Rolle + Rechte-Kurzfassung; Rolle ändern (setzt Standard-
// rechte neu), aktiv/inaktiv, Passwort zurücksetzen, löschen. Backend: /api/auth/staff.

const ROLLEN = {
  super_admin:      { l: 'Super-Admin',      i: '⭐', c: '#f59e0b' },
  admin:            { l: 'Admin',            i: '👨‍💼', c: '#3b82f6' },
  dojoleiter:       { l: 'Dojoleiter',       i: '🏯', c: '#8b5cf6' },
  kassenwart:       { l: 'Kassenwart',       i: '💰', c: '#f59e0b' },
  pruefer:          { l: 'Prüfer',           i: '🎓', c: '#10b981' },
  trainer:          { l: 'Trainer',          i: '🥋', c: '#22c55e' },
  assistenztrainer: { l: 'Assistenztrainer', i: '🥋', c: '#84cc16' },
  rezeption:        { l: 'Rezeption',        i: '🛎️', c: '#06b6d4' },
  mitarbeiter:      { l: 'Mitarbeiter',      i: '👤', c: '#64748b' },
  eingeschraenkt:   { l: 'Eingeschränkt',    i: '🔒', c: '#64748b' },
  checkin:          { l: 'Check-in',         i: '✅', c: '#64748b' },
};
// Rollen, die ein Dojo-Admin zuweisen darf (admin/super_admin bleiben Super-Admin vorbehalten)
const ZUWEISBAR = ['dojoleiter', 'kassenwart', 'pruefer', 'trainer', 'assistenztrainer', 'rezeption', 'mitarbeiter', 'eingeschraenkt', 'checkin'];
const BEREICHE = [
  ['mitglieder', 'Mitglieder'], ['finanzen', 'Finanzen'], ['vertraege', 'Verträge'],
  ['pruefungen', 'Prüfungen'], ['stundenplan', 'Stundenplan'], ['einstellungen', 'Einstellungen'], ['berichte', 'Berichte'],
];

const st = {
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', marginBottom: 10 },
  row: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  badge: (c) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700, background: c + '22', color: c, border: '1px solid ' + c + '55' }),
  chip: { fontSize: '0.72rem', padding: '2px 7px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' },
  btn: { padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#e5e7eb', cursor: 'pointer', fontSize: '0.82rem' },
  btnDanger: { padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', cursor: 'pointer', fontSize: '0.82rem' },
  select: { padding: '5px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(20,20,40,0.9)', color: '#e5e7eb', fontSize: '0.82rem' },
  msg: (ok) => ({ padding: '8px 12px', borderRadius: 8, marginBottom: 12, background: ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: ok ? '#86efac' : '#fca5a5', fontSize: '0.85rem' }),
};

export default function MitarbeiterRollen() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/auth/staff`);
      if (!res.ok) throw new Error('Laden fehlgeschlagen');
      setStaff(await res.json());
    } catch (e) { flash('Mitarbeiter konnten nicht geladen werden.', false); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rechteKurz = (b) => {
    if (!b) return [];
    return BEREICHE.filter(([k]) => b[k]?.lesen).map(([, label]) => label);
  };

  const aendereRolle = async (u, rolle) => {
    if (rolle === u.rolle) return;
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/auth/staff/${u.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rolle }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Fehler');
      flash(`Rolle von ${u.username} → ${ROLLEN[rolle]?.l || rolle}. Rechte auf Standard gesetzt.`);
      load();
    } catch (e) { flash(e.message, false); }
  };

  const toggleAktiv = async (u) => {
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/auth/staff/${u.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktiv: !u.aktiv }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Fehler');
      flash(`${u.username} ${!u.aktiv ? 'aktiviert' : 'deaktiviert'}.`);
      load();
    } catch (e) { flash(e.message, false); }
  };

  const resetPasswort = async (u) => {
    const pw = window.prompt(`Neues Passwort für ${u.username} (min. Richtlinie):`);
    if (!pw) return;
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/auth/staff/${u.id}/password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Fehler');
      flash(`Passwort für ${u.username} gesetzt.`);
    } catch (e) { flash(e.message, false); }
  };

  const loeschen = async (u) => {
    if (!window.confirm(`Mitarbeiter ${u.username} (${ROLLEN[u.rolle]?.l || u.rolle}) wirklich löschen?`)) return;
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/auth/staff/${u.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Fehler');
      flash(`${u.username} gelöscht.`);
      load();
    } catch (e) { flash(e.message, false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0 }}>🧑‍💼 Mitarbeiter & Rechte</h3>
          <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem' }}>
            Rollen mit gestaffelten Rechten. Rolle ändern setzt die Standard-Rechte der Rolle.
          </p>
        </div>
        <button style={{ ...st.btn, background: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.4)', color: '#93c5fd', fontWeight: 700 }}
          onClick={() => setShowCreate(true)}>+ Mitarbeiter anlegen</button>
      </div>

      {msg && <div style={st.msg(msg.ok)}>{msg.text}</div>}

      {loading ? <p style={{ color: 'rgba(255,255,255,0.55)' }}>Lädt…</p>
        : staff.length === 0 ? <p style={{ color: 'rgba(255,255,255,0.55)' }}>Noch keine Mitarbeiter-Accounts angelegt.</p>
        : staff.map(u => {
          const rInfo = ROLLEN[u.rolle] || { l: u.rolle, i: '👤', c: '#64748b' };
          const geschuetzt = u.rolle === 'super_admin' || u.rolle === 'admin';
          const rechte = rechteKurz(u.berechtigungen);
          return (
            <div key={u.id} style={{ ...st.card, opacity: u.aktiv ? 1 : 0.55 }}>
              <div style={st.row}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700 }}>
                    {(u.vorname || u.nachname) ? `${u.vorname || ''} ${u.nachname || ''}`.trim() : u.username}
                    {!u.aktiv && <span style={{ ...st.chip, marginLeft: 8, color: '#fca5a5' }}>inaktiv</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{u.email} · @{u.username}</div>
                </div>
                <span style={st.badge(rInfo.c)}>{rInfo.i} {rInfo.l}</span>
              </div>

              {rechte.length > 0 && (
                <div style={{ ...st.row, marginTop: 8, gap: 6 }}>
                  {rechte.map(r => <span key={r} style={st.chip}>{r}</span>)}
                </div>
              )}

              {!geschuetzt && (
                <div style={{ ...st.row, marginTop: 10, gap: 8 }}>
                  <select style={st.select} value={ZUWEISBAR.includes(u.rolle) ? u.rolle : ''} onChange={e => aendereRolle(u, e.target.value)}>
                    {!ZUWEISBAR.includes(u.rolle) && <option value="">{rInfo.l}</option>}
                    {ZUWEISBAR.map(r => <option key={r} value={r}>{ROLLEN[r].i} {ROLLEN[r].l}</option>)}
                  </select>
                  <button style={st.btn} onClick={() => toggleAktiv(u)}>{u.aktiv ? 'Deaktivieren' : 'Aktivieren'}</button>
                  <button style={st.btn} onClick={() => resetPasswort(u)}>Passwort</button>
                  <button style={st.btnDanger} onClick={() => loeschen(u)}>Löschen</button>
                </div>
              )}
              {geschuetzt && <div style={{ ...st.row, marginTop: 8 }}><span style={{ ...st.chip, color: 'rgba(255,255,255,0.4)' }}>Über die Super-Admin-Verwaltung änderbar</span></div>}
            </div>
          );
        })}

      {showCreate && (
        <CreateUserModal
          rolle="kassenwart"
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); flash('Mitarbeiter angelegt.'); load(); }}
        />
      )}
    </div>
  );
}
