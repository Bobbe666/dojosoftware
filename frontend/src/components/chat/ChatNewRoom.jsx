// =====================================================================================
// CHAT NEW ROOM - Neuen Raum oder Direktchat erstellen
// =====================================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Search, Users, MessageCircle, Check, Hash, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDojoContext } from '../../context/DojoContext.jsx';

// Emoji-Auswahl für Gruppen-Avatar
const GROUP_EMOJIS = [
  '🥋','👊','🏆','⚔️','🎯','💪','🔥','🌟','🦁','🐉',
  '🥇','🎓','📢','⚡','🌍','🤝','💬','🏅','🎪','🌈',
  '🦅','🐺','🔵','🟢','🟡','🟠','🔴','🟣','⭐','💎',
];

// Farb-Optionen für Gruppen-Avatar
const AVATAR_COLORS = [
  { value: '#4f7cff', label: 'Blau' },
  { value: '#7c4dff', label: 'Violett' },
  { value: '#22c55e', label: 'Grün' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Rot' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#64748b', label: 'Grau' },
];

const ChatNewRoom = ({ mode = 'direct', onCreated, onClose }) => {
  const isGroupMode = mode === 'group';
  const { token, user } = useAuth();
  const { activeDojo } = useDojoContext();

  // Super-Admin: dojo_id=null im JWT
  const isSuperAdmin = user?.dojo_id === null || user?.dojo_id === undefined;

  // Für Super-Admin: Dojo im Modal wählbar
  const defaultDojoId = activeDojo?.id || user?.dojo_id || null;
  const [selectedDojoId, setSelectedDojoId] = useState(defaultDojoId);
  const [dojoOptions, setDojoOptions] = useState([]);

  // Effektives Dojo für alle API-Calls
  const effectiveDojoId = isSuperAdmin ? selectedDojoId : defaultDojoId;

  const [searchQuery, setSearchQuery] = useState('');
  const [allMembers, setAllMembers] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('🥋');
  const [avatarColor, setAvatarColor] = useState('#4f7cff');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const searchInputRef = useRef(null);

  const ownId   = user?.mitglied_id || user?.user_id || user?.admin_id || user?.id;
  const ownType = user?.role === 'member' ? 'mitglied' : user?.role;

  const filterSelf = (list) =>
    list.filter(r => !(String(r.member_id) === String(ownId) && r.member_type === ownType));

  // Dojos für Super-Admin laden
  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch('/api/dojos', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : (data.dojos || []);
        setDojoOptions([
          ...list.filter(d => d.ist_aktiv),
          { id: -1, dojoname: '🏅 Verbandsmitglieder', ist_aktiv: true },
          { id: -2, dojoname: '💻 Lizenznehmer', ist_aktiv: true },
        ]);
      })
      .catch(() => {});
  }, [isSuperAdmin, token]);

  // Alle Mitglieder laden — nur wenn Dojo bekannt
  const loadAll = useCallback(async () => {
    if (!effectiveDojoId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ q: '' });
      params.append('dojo_id', effectiveDojoId);
      const res = await fetch(`/api/chat/members/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        setError(`Fehler ${res.status}: ${data.message || 'Mitglieder konnten nicht geladen werden'}`);
        return;
      }
      setAllMembers(filterSelf(data.results || []));
    } catch (e) {
      setError('Mitglieder konnten nicht geladen werden');
    } finally {
      setIsLoading(false);
    }
  }, [token, effectiveDojoId]);

  // Server-Suche (ab 2 Zeichen)
  const search = useCallback(async (q) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ q });
      if (effectiveDojoId) params.append('dojo_id', effectiveDojoId);
      const res = await fetch(`/api/chat/members/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        setError(`Suche fehlgeschlagen (${res.status})`);
        return;
      }
      setSearchResults(filterSelf(data.results || []));
    } catch (e) {
      setError('Suche fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  }, [token, effectiveDojoId]);

  useEffect(() => {
    setAllMembers([]);
    setSearchResults([]);
    loadAll();
    setTimeout(() => searchInputRef.current?.focus(), 80);
  }, [loadAll]);

  useEffect(() => {
    if (searchQuery.length === 0) { setSearchResults([]); return; }
    const t = setTimeout(() => search(searchQuery), 280);
    return () => clearTimeout(t);
  }, [searchQuery, search]);

  // isSelected MUSS vor displayList definiert sein (TDZ: sort()-Callback wird sofort ausgeführt!)
  const isSelected = (person) =>
    !!selected.find(p =>
      `${p.member_id}:${p.member_type}` === `${person.member_id}:${person.member_type}`
    );

  const showAllMembers = isGroupMode && !!effectiveDojoId;
  const rawList = searchQuery.length >= 2 ? searchResults : showAllMembers ? allMembers : [];
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

  const create = async () => {
    if (selected.length === 0) return;
    setIsCreating(true);
    setError('');
    try {
      const type = isGroupMode ? 'group' : 'direct';
      // Virtuelle Gruppen (-1 Verbandsmitglieder, -2 Lizenznehmer) → dojo_id=2 (TDA International)
      const rawDojoId = effectiveDojoId || selected[0]?.dojo_id;
      const createDojoId = rawDojoId < 0 ? 2 : rawDojoId;
      const body = {
        type,
        members: selected.map(s => ({ member_id: s.member_id, member_type: s.member_type }))
      };
      if (type === 'group' && groupName.trim()) body.name = groupName.trim();
      if (type === 'group') {
        body.avatar_emoji = avatarEmoji;
        body.avatar_color = avatarColor;
      }
      if (createDojoId) body.dojo_id = createDojoId;

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
    if (type === 'verband') return 'Verband';
    return 'Admin';
  };

  const displayName = (person) => person.name.split(' (')[0];

  // Dojo wechseln (Super-Admin) — Auswahl NICHT löschen (gemischte Gruppen möglich)
  const handleDojoChange = (newDojoId) => {
    setSelectedDojoId(newDojoId ? Number(newDojoId) : null);
    setSearchQuery('');
  };

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

          {/* Dojo-Auswahl für Super-Admin */}
          {isSuperAdmin && dojoOptions.length > 0 && (
            <div className="cnr-dojo-picker">
              <label className="cnr-label">Dojo</label>
              <div className="cnr-select-wrap">
                <select
                  className="cnr-select"
                  value={selectedDojoId || ''}
                  onChange={e => handleDojoChange(e.target.value)}
                >
                  <option value="">Dojo wählen…</option>
                  {dojoOptions.map(d => (
                    <option key={d.id} value={d.id}>{d.dojoname}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="cnr-select-icon" />
              </div>
            </div>
          )}

          {/* Gruppen-Avatar + Name */}
          {isGroupMode && (
            <>
              <div className="cnr-group-setup">
                {/* Avatar-Vorschau */}
                <button
                  type="button"
                  className="cnr-avatar-btn"
                  style={{ background: avatarColor }}
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  title="Emoji & Farbe wählen"
                >
                  {avatarEmoji}
                </button>

                {/* Gruppenname */}
                <div className="cnr-field cnr-field--grow">
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
              </div>

              {/* Inline Emoji-Picker (kein Float, kein z-index Problem) */}
              {showEmojiPicker && (
                <div className="cnr-emoji-picker-inline">
                  <div className="cnr-emoji-grid">
                    {GROUP_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        className={`cnr-emoji-option ${avatarEmoji === emoji ? 'cnr-emoji-option--active' : ''}`}
                        onClick={() => { setAvatarEmoji(emoji); setShowEmojiPicker(false); }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="cnr-color-grid">
                    {AVATAR_COLORS.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        className={`cnr-color-dot ${avatarColor === c.value ? 'cnr-color-dot--active' : ''}`}
                        style={{ background: c.value }}
                        title={c.label}
                        onClick={() => setAvatarColor(c.value)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
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

        </div>

        {/* ── Haupt-Body: Liste links, Auswahl rechts ── */}
        <div className="cnr-body">

          {/* Scrollbare Mitgliederliste */}
          <div className="cnr-list">
            {isLoading && (
              <div className="cnr-list-loading">
                <span className="cnr-spinner" /> Lädt…
              </div>
            )}

            {!isLoading && isSuperAdmin && !effectiveDojoId && (
              <div className="cnr-list-hint">Bitte oben ein Dojo auswählen</div>
            )}

            {!isLoading && !isSuperAdmin && !showAllMembers && searchQuery.length < 2 && (
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
                    {person.kategorie || typeLabel(person.member_type)}
                    {person.dojo_name && person.kategorie !== 'Verbandsmitglied' && person.kategorie !== 'Lizenzinhaber' && (
                      <span className="cnr-item-dojo"> · {person.dojo_name}</span>
                    )}
                  </div>
                </div>
                <div className="cnr-item-check">
                  {isSelected(person) && <Check size={15} />}
                </div>
              </button>
            ))}
          </div>

          {/* Ausgewählte Mitglieder — rechte Seitenleiste (nur Gruppenmode) */}
          {isGroupMode && (
            <div className="cnr-selected-panel">
              <div className="cnr-selected-panel-title">
                {selected.length === 0
                  ? 'Auswahl'
                  : `${selected.length} ausgewählt`}
              </div>
              <div className="cnr-selected-list">
                {selected.length === 0 && (
                  <div className="cnr-selected-empty">Namen antippen zum Auswählen</div>
                )}
                {selected.map(p => (
                  <div key={`${p.member_id}:${p.member_type}`} className="cnr-panel-chip">
                    <span className="cnr-panel-chip-avatar">{displayName(p)[0].toUpperCase()}</span>
                    <span className="cnr-panel-chip-name">{displayName(p)}</span>
                    <button className="cnr-panel-chip-remove" onClick={() => toggleSelect(p)}>
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
