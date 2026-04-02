// =====================================================================================
// CHAT ROOM SETTINGS - Gruppeneinstellungen: Name, Avatar, Mitglieder
// =====================================================================================

import React, { useState, useEffect } from 'react';
import { X, Check, Users, Trash2, UserMinus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

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
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  const ownId = user?.mitglied_id || user?.user_id || user?.admin_id || user?.id;
  const ownType = user?.role === 'member' ? 'mitglied' : user?.role;
  const isAdminUser = user?.role === 'admin' || user?.role === 'super_admin';
  const canDeleteRoom = room.my_role === 'owner' || isAdminUser;

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
        onUpdated(null); // null = Gruppe verlassen, zurück zur Liste
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
            <Users size={14} /> Mitglieder
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
                        <span className="crs-member-type">
                          {member.member_type === 'mitglied' ? 'Mitglied' :
                           member.member_type === 'trainer' ? 'Trainer' :
                           member.member_type === 'verband' ? 'Verband' : 'Admin'}
                        </span>
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
