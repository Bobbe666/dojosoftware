// =====================================================================================
// CHAT NEW ROOM - Neuen Raum oder Direktchat erstellen
// =====================================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Search, Users, MessageCircle, Check, Hash } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDojoContext } from '../../context/DojoContext.jsx';

const ChatNewRoom = ({ mode = 'direct', onCreated, onClose }) => {
  const isGroupMode = mode === 'group';
  const { token, user } = useAuth();
  const { activeDojo } = useDojoContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [allMembers, setAllMembers] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const searchInputRef = useRef(null);

  const dojoId = activeDojo?.id || user?.dojo_id;
  const ownId   = user?.mitglied_id || user?.user_id || user?.admin_id || user?.id;
  const ownType = user?.role === 'member' ? 'mitglied' : user?.role;

  const filterSelf = (list) =>
    list.filter(r => !(String(r.member_id) === String(ownId) && r.member_type === ownType));

  // Alle Mitglieder beim Öffnen laden
  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ q: '' });
      if (dojoId) params.append('dojo_id', dojoId);
      const res = await fetch(`/api/chat/members/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setAllMembers(filterSelf(data.results || []));
    } catch (e) {
      setError('Mitglieder konnten nicht geladen werden');
    } finally {
      setIsLoading(false);
    }
  }, [token, dojoId]);

  // Server-Suche (ab 2 Zeichen)
  const search = useCallback(async (q) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ q });
      if (dojoId) params.append('dojo_id', dojoId);
      const res = await fetch(`/api/chat/members/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSearchResults(filterSelf(data.results || []));
    } catch (e) {
      setError('Suche fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  }, [token, dojoId]);

  useEffect(() => {
    loadAll();
    setTimeout(() => searchInputRef.current?.focus(), 80);
  }, [loadAll]);

  useEffect(() => {
    if (searchQuery.length === 0) { setSearchResults([]); return; }
    const t = setTimeout(() => search(searchQuery), 280);
    return () => clearTimeout(t);
  }, [searchQuery, search]);

  const rawList = searchQuery.length >= 2 ? searchResults : isGroupMode ? allMembers : [];
  const displayList = [...rawList].sort((a, b) => (isSelected(a) ? 1 : 0) - (isSelected(b) ? 1 : 0));

  const toggleSelect = (person) => {
    const key = `${person.member_id}:${person.member_type}`;
    setSelected(prev => {
      const exists = prev.find(p => `${p.member_id}:${p.member_type}` === key);
      if (exists) return prev.filter(p => `${p.member_id}:${p.member_type}` !== key);
      if (!isGroupMode) return [person];
      return [...prev, person];
    });
  };

  const isSelected = (person) =>
    !!selected.find(p =>
      `${p.member_id}:${p.member_type}` === `${person.member_id}:${person.member_type}`
    );

  const create = async () => {
    if (selected.length === 0) return;
    setIsCreating(true);
    setError('');
    try {
      const type = isGroupMode ? 'group' : 'direct';
      const effectiveDojoId = dojoId || selected[0]?.dojo_id;
      const body = {
        type,
        members: selected.map(s => ({ member_id: s.member_id, member_type: s.member_type }))
      };
      if (type === 'group' && groupName.trim()) body.name = groupName.trim();
      if (effectiveDojoId) body.dojo_id = effectiveDojoId;

      const res = await fetch('/api/chat/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        onCreated(data.room_id);
      } else {
        setError(data.message || 'Fehler beim Erstellen');
      }
    } catch (e) {
      setError('Netzwerkfehler');
    } finally {
      setIsCreating(false);
    }
  };

  const typeLabel = (type) => {
    if (type === 'mitglied') return 'Mitglied';
    if (type === 'trainer') return 'Trainer';
    return 'Admin';
  };

  const displayName = (person) => person.name.split(' (')[0];

  return (
    <div className="cnr-overlay" onClick={onClose}>
      <div className="cnr-modal" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="cnr-header">
          <div className="cnr-header-icon">
            {isGroupMode ? <Users size={18} /> : <MessageCircle size={18} />}
          </div>
          <h3 className="cnr-title">
            {isGroupMode ? 'Gruppenchat erstellen' : 'Direktnachricht'}
          </h3>
          <button className="cnr-close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* ── Fester oberer Bereich ── */}
        <div className="cnr-top">

          {/* Gruppenname */}
          {isGroupMode && (
            <div className="cnr-field">
              <label className="cnr-label">
                <Hash size={13} /> Gruppenname
              </label>
              <input
                className="cnr-input"
                type="text"
                placeholder="z. B. Training A-Kader, Eltern, …"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchInputRef.current?.focus()}
              />
            </div>
          )}

          {/* Ausgewählte Chips */}
          {selected.length > 0 && (
            <div className="cnr-chips">
              {selected.map(p => (
                <span key={`${p.member_id}:${p.member_type}`} className="cnr-chip">
                  <span className="cnr-chip-avatar">{displayName(p)[0].toUpperCase()}</span>
                  <span className="cnr-chip-name">{displayName(p)}</span>
                  <button className="cnr-chip-remove" onClick={() => toggleSelect(p)}>
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Suchleiste */}
          <div className="cnr-search">
            <Search size={14} className="cnr-search-icon" />
            <input
              ref={searchInputRef}
              className="cnr-search-input"
              type="text"
              placeholder={isGroupMode ? 'Suchen oder Liste scrollen…' : 'Name oder E-Mail…'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="cnr-search-clear" onClick={() => setSearchQuery('')}>
                <X size={13} />
              </button>
            )}
          </div>

          {/* Status-Zeile */}
          <div className="cnr-status">
            {isGroupMode && selected.length < 2 && (
              <span className="cnr-status-hint">
                {selected.length === 0 ? 'Mindestens 2 Personen auswählen' : 'Noch 1 Person auswählen'}
              </span>
            )}
            {isGroupMode && selected.length >= 2 && (
              <span className="cnr-status-ok">✓ {selected.length} Personen ausgewählt</span>
            )}
          </div>
        </div>

        {/* ── Scrollbare Mitgliederliste ── */}
        <div className="cnr-list">
          {isLoading && (
            <div className="cnr-list-loading">
              <span className="cnr-spinner" /> Lädt…
            </div>
          )}

          {!isLoading && !isGroupMode && searchQuery.length < 2 && (
            <div className="cnr-list-hint">Mindestens 2 Zeichen eingeben</div>
          )}

          {!isLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="cnr-list-hint">Keine Treffer für „{searchQuery}"</div>
          )}

          {displayList.map(person => (
            <button
              key={`${person.member_id}:${person.member_type}`}
              className={`cnr-item ${isSelected(person) ? 'cnr-item--selected' : ''}`}
              onClick={() => toggleSelect(person)}
            >
              <div className="cnr-item-avatar">{displayName(person)[0].toUpperCase()}</div>
              <div className="cnr-item-info">
                <div className="cnr-item-name">{displayName(person)}</div>
                <div className="cnr-item-meta">
                  {typeLabel(person.member_type)}
                  {person.dojo_name && <span className="cnr-item-dojo"> · {person.dojo_name}</span>}
                </div>
              </div>
              <div className="cnr-item-check">
                {isSelected(person) && <Check size={15} />}
              </div>
            </button>
          ))}
        </div>

        {/* ── Footer ── */}
        <div className="cnr-footer">
          {error && <div className="cnr-error">{error}</div>}
          <div className="cnr-footer-btns">
            <button className="cnr-btn-cancel" onClick={onClose}>Abbrechen</button>
            <button
              className="cnr-btn-create"
              onClick={create}
              disabled={selected.length === 0 || isCreating || (isGroupMode && selected.length < 2)}
            >
              {isCreating ? '…' : isGroupMode
                ? `Gruppe erstellen${selected.length >= 2 ? ` (${selected.length})` : ''}`
                : 'Chat starten'
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ChatNewRoom;
