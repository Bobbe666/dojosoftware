// =====================================================================================
// CHAT ROOM SETTINGS - Gruppeneinstellungen: Name, Avatar, Mitglieder
// =====================================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { X, Check, Users, Trash2, UserMinus, UserPlus, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDojoContext } from '../../context/DojoContext.jsx';

const GROUP_EMOJIS = [
  '🥋','👊','🏆','⚔️','🎯','💪','🔥','🌟','🦁','🐉',
  '🥇','🎓','📢','⚡','🌍','🤝','💬','🏅','🎪','🌈',
  '🦅','🐺','🔵','🟢','🟡','🟠','🔴','🟣','⭐','💎',
];

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

const ChatRoomSettings = ({ room, token, onClose, onUpdated }) => {
  const { user } = useAuth();
  const { activeDojo } = useDojoContext();
  const [name, setName] = useState(room.name || '');
  const [avatarEmoji, setAvatarEmoji] = useState(room.avatar_emoji || '🥋');
  const [avatarColor, setAvatarColor] = useState(room.avatar_color || '#4f7cff');
  const [members, setMembers] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [tab, setTab] = useState('settings'); // 'settings' | 'members'
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [roomStatus, setRoomStatus] = useState(room.status || 'active');

  // Mitglied hinzufügen
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingId, setAddingId] = useState(null);

  const ownId = user?.mitglied_id || user?.user_id || user?.admin_id || user?.id;
  const ownType = user?.role === 'member' ? 'mitglied' : user?.role;
  const isAdminUser = user?.role === 'admin' || user?.role === 'super_admin';
  const canDeleteRoom = room.my_role === 'owner' || isAdminUser;
  const dojoId = activeDojo?.id || user?.dojo_id;

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setIsLoadingMembers(true);
    try {
      const res = await fetch(`/api/chat/rooms/${room.id}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setMembers(data.members);
    } catch (e) {
      console.error('Mitglieder laden Fehler:', e);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  // Mitglieder-Suche (debounced)
  const searchMembers = useCallback(async (q) => {
    if (q.length < 2) { setAddResults([]); return; }
    setIsSearching(true);
    try {
      const params = new URLSearchParams({ q });
      if (dojoId) params.append('dojo_id', dojoId);
      const res = await fetch(`/api/chat/members/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      // Bereits vorhandene Mitglieder herausfiltern
      const memberKeys = new Set(members.map(m => `${m.member_id}:${m.member_type}`));
      setAddResults((data.results || []).filter(r => !memberKeys.has(`${r.member_id}:${r.member_type}`)));
    } catch (e) {
      // Suche still fehlschlagen lassen
    } finally {
      setIsSearching(false);
    }
  }, [token, dojoId, members]);

  useEffect(() => {
    if (addQuery.length === 0) { setAddResults([]); return; }
    const t = setTimeout(() => searchMembers(addQuery), 280);
    return () => clearTimeout(t);
  }, [addQuery, searchMembers]);

  const handleAddMember = async (person) => {
    const key = `${person.member_id}:${person.member_type}`;
    setAddingId(key);
    try {
      const res = await fetch(`/api/chat/rooms/${room.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ member_id: person.member_id, member_type: person.member_type })
      });
      const data = await res.json();
      if (data.success) {
        setMembers(prev => [...prev, { ...person, role: 'member' }]);
        setAddResults(prev => prev.filter(r => `${r.member_id}:${r.member_type}` !== key));
        setAddQuery('');
      } else {
        setError(data.message || 'Fehler beim Hinzufügen');
      }
    } catch (e) {
      setError('Netzwerkfehler');
    } finally {
      setAddingId(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/chat/rooms/${room.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim() || null, avatar_emoji: avatarEmoji, avatar_color: avatarColor, status: roomStatus })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Gespeichert!');
        setTimeout(() => setSuccessMsg(''), 2000);
        onUpdated({ ...room, name: name.trim() || null, avatar_emoji: avatarEmoji, avatar_color: avatarColor, status: roomStatus });
      } else {
        setError(data.message || 'Fehler beim Speichern');
      }
    } catch (e) {
      setError('Netzwerkfehler');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = async (member) => {
    if (!window.confirm(`${member.name} aus der Gruppe entfernen?`)) return;
    try {
      const res = await fetch(
        `/api/chat/rooms/${room.id}/members/${member.member_id}?member_type=${member.member_type}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.success) {
        setMembers(prev => prev.filter(m =>
          !(m.member_id === member.member_id && m.member_type === member.member_type)
        ));
      }
    } catch (e) {
      setError('Fehler beim Entfernen');
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm('Gruppe verlassen?')) return;
    try {
      const res = await fetch(
        `/api/chat/rooms/${room.id}/members/${ownId}?member_type=${ownType}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.success) {
        onUpdated(null);
      }
    } catch (e) {
      setError('Fehler');
    }
  };

  const handleDeleteRoom = async () => {
    setIsDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/chat/rooms/${room.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        onUpdated(null, 'deleted');
      } else {
        setError(data.message || 'Fehler beim Löschen');
        setShowDeleteConfirm(false);
      }
    } catch (e) {
      setError('Netzwerkfehler');
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const roleLabel = (role) => {
    if (role === 'owner') return '👑';
    if (role === 'admin') return '🔧';
    return '';
  };

  const typeLabel = (t) => {
    if (t === 'mitglied') return 'Mitglied';
    if (t === 'trainer')  return 'Trainer';
    if (t === 'verband')  return 'Verband';
    return 'Admin';
  };

  const isSelf = (member) =>
    String(member.member_id) === String(ownId) && member.member_type === ownType;

  return (
    <div className="crs-overlay" onClick={onClose}>
      <div className="crs-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="crs-header">
          <div className="crs-avatar-preview" style={{ background: avatarColor }}>
            {avatarEmoji}
          </div>
          <div className="crs-header-info">
            <h3 className="crs-title">{name || 'Gruppe'}</h3>
            <p className="crs-subtitle">{members.length} Mitglieder</p>
          </div>
          <button className="crs-close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="crs-tabs">
          <button
            className={`crs-tab ${tab === 'settings' ? 'crs-tab--active' : ''}`}
            onClick={() => setTab('settings')}
          >
            ⚙️ Einstellungen
          </button>
          <button
            className={`crs-tab ${tab === 'members' ? 'crs-tab--active' : ''}`}
            onClick={() => setTab('members')}
          >
            <Users size={14} /> Mitglieder ({members.length})
          </button>
        </div>

        <div className="crs-body">
          {tab === 'settings' && (
            <>
              {/* Avatar-Bereich */}
              <div className="crs-section">
                <label className="crs-label">Gruppen-Avatar</label>
                <div className="crs-emoji-grid">
                  {GROUP_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      className={`cnr-emoji-option ${avatarEmoji === emoji ? 'cnr-emoji-option--active' : ''}`}
                      onClick={() => setAvatarEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="crs-color-grid">
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

              {/* Gruppenname */}
              <div className="crs-section">
                <label className="crs-label">Gruppenname</label>
                <input
                  className="cnr-input"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Gruppenname eingeben…"
                  maxLength={100}
                />
              </div>

              {/* Status */}
              <div className="crs-section">
                <label className="crs-label">Status</label>
                <div className="crs-status-btns">
                  {[
                    { key: 'active',   label: '🟢 Aktiv',       desc: 'Chat ist aktiv' },
                    { key: 'archived', label: '📦 Archiviert',   desc: 'Archiviert, kein Schreiben' },
                    { key: 'closed',   label: '🔒 Geschlossen',  desc: 'Geschlossen' },
                  ].map(s => (
                    <button
                      key={s.key}
                      type="button"
                      className={`crs-status-btn ${roomStatus === s.key ? 'crs-status-btn--active' : ''}`}
                      onClick={() => setRoomStatus(s.key)}
                      title={s.desc}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && <div className="cnr-error">{error}</div>}
              {successMsg && <div className="crs-success">{successMsg}</div>}

              <button className="crs-btn-save" onClick={handleSave} disabled={isSaving}>
                {isSaving ? '…' : <><Check size={16} /> Speichern</>}
              </button>
            </>
          )}

          {tab === 'members' && (
            <>
              {/* Mitglied hinzufügen */}
              <div className="crs-section">
                <label className="crs-label"><UserPlus size={12} /> Mitglied hinzufügen</label>
                <div className="cnr-search" style={{ marginBottom: addResults.length > 0 ? 0 : undefined }}>
                  <Search size={13} className="cnr-search-icon" />
                  <input
                    className="cnr-search-input"
                    type="text"
                    placeholder="Name suchen… (mind. 2 Zeichen)"
                    value={addQuery}
                    onChange={e => setAddQuery(e.target.value)}
                    autoComplete="off"
                  />
                  {addQuery && (
                    <button className="cnr-search-clear" onClick={() => { setAddQuery(''); setAddResults([]); }}>
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Suchergebnisse */}
                {isSearching && (
                  <div className="cnr-list-loading" style={{ padding: '0.5rem' }}>
                    <span className="cnr-spinner" /> Suche…
                  </div>
                )}
                {addResults.length > 0 && (
                  <div style={{
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: 10,
                    overflow: 'hidden',
                    marginTop: '0.3rem',
                    maxHeight: 180,
                    overflowY: 'auto'
                  }}>
                    {addResults.map(person => {
                      const key = `${person.member_id}:${person.member_type}`;
                      const isAdding = addingId === key;
                      return (
                        <button
                          key={key}
                          className="cnr-item"
                          onClick={() => handleAddMember(person)}
                          disabled={isAdding}
                          style={{ borderRadius: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          <div className="cnr-item-avatar">{(person.name || '?')[0].toUpperCase()}</div>
                          <div className="cnr-item-info">
                            <div className="cnr-item-name">{person.name.split(' (')[0]}</div>
                            <div className="cnr-item-meta">{typeLabel(person.member_type)}</div>
                          </div>
                          <UserPlus size={15} style={{ color: isAdding ? '#888' : '#4f7cff', flexShrink: 0 }} />
                        </button>
                      );
                    })}
                  </div>
                )}
                {addQuery.length >= 2 && !isSearching && addResults.length === 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', padding: '0.5rem 0.2rem' }}>
                    Keine Treffer — alle gefundenen Personen sind bereits Mitglied.
                  </div>
                )}
              </div>

              {/* Mitgliederliste */}
              {isLoadingMembers ? (
                <div className="cnr-list-loading"><span className="cnr-spinner" /> Lädt…</div>
              ) : (
                <div className="crs-member-list">
                  {members.map(member => (
                    <div key={`${member.member_id}:${member.member_type}`} className="crs-member-item">
                      <div className="crs-member-avatar">
                        {(member.name || '?')[0].toUpperCase()}
                      </div>
                      <div className="crs-member-info">
                        <span className="crs-member-name">
                          {member.name}
                          {roleLabel(member.role) && (
                            <span className="crs-member-role">{roleLabel(member.role)}</span>
                          )}
                        </span>
                        <span className="crs-member-type">{typeLabel(member.member_type)}</span>
                      </div>
                      {!isSelf(member) && (
                        <button
                          className="crs-member-remove"
                          onClick={() => handleRemoveMember(member)}
                          title="Entfernen"
                        >
                          <UserMinus size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button className="crs-btn-leave" onClick={handleLeaveGroup}>
                Gruppe verlassen
              </button>

              {canDeleteRoom && !showDeleteConfirm && (
                <button className="crs-btn-delete" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 size={15} /> Gruppe löschen
                </button>
              )}

              {canDeleteRoom && showDeleteConfirm && (
                <div className="crs-delete-confirm">
                  <div className="crs-delete-warning">
                    ⚠️ Achtung: Diese Gruppe und alle Nachrichten werden <strong>dauerhaft gelöscht</strong> und sind nicht mehr verfügbar.
                  </div>
                  <div className="crs-delete-confirm-btns">
                    <button className="crs-btn-cancel-delete" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
                      Abbrechen
                    </button>
                    <button className="crs-btn-confirm-delete" onClick={handleDeleteRoom} disabled={isDeleting}>
                      {isDeleting ? '…' : 'Ja, endgültig löschen'}
                    </button>
                  </div>
                </div>
              )}

              {error && <div className="cnr-error" style={{ marginTop: '0.5rem' }}>{error}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatRoomSettings;
