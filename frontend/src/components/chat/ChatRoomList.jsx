// =====================================================================================
// CHAT ROOM LIST - Linke Seitenleiste mit allen Räumen
// =====================================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { MessageCircle, Users, Megaphone, Search, UserPlus, UsersRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDojoContext } from '../../context/DojoContext.jsx';
import { useChatContext } from '../../context/ChatContext.jsx';
import ChatNewRoom from './ChatNewRoom.jsx';

const STATUS_TABS = [
  { key: 'active',   label: 'Aktiv',       color: '#22c55e' },
  { key: 'archived', label: 'Archiviert',   color: '#f59e0b' },
  { key: 'closed',   label: 'Geschlossen',  color: '#64748b' },
];

const StatusDot = ({ status }) => {
  const map = {
    active:   { color: '#22c55e', label: 'Aktiv' },
    archived: { color: '#f59e0b', label: 'Archiviert' },
    closed:   { color: '#64748b', label: 'Geschlossen' },
  };
  const s = map[status] || map.active;
  return (
    <span
      title={s.label}
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: s.color,
        flexShrink: 0,
        marginLeft: 4,
        verticalAlign: 'middle',
      }}
    />
  );
};

const ChatRoomList = ({ activeRoomId, onSelectRoom, refreshVersion }) => {
  const { token, user } = useAuth();
  const { activeDojo } = useDojoContext();
  const { socket, unreadCount } = useChatContext();
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewRoom, setShowNewRoom] = useState(null); // null | 'direct' | 'group'
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  const dojoId = activeDojo?.id || user?.dojo_id;

  const loadRooms = useCallback(async (status) => {
    try {
      const params = new URLSearchParams();
      if (dojoId) params.append('dojo_id', dojoId);
      params.append('status', status || statusFilter);
      const res = await fetch(`/api/chat/rooms?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setRooms(data.rooms);
    } catch (e) {
      console.error('[ChatRoomList] Räume laden Fehler:', e);
    } finally {
      setIsLoading(false);
    }
  }, [token, dojoId, statusFilter]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  // Bei Löschung / Status-Wechsel Raumliste neu laden
  useEffect(() => {
    if (refreshVersion > 0) loadRooms();
  }, [refreshVersion]);

  // Neue Nachricht empfangen → Raumliste aktualisieren
  useEffect(() => {
    if (!socket) return;
    const handleMessage = (message) => {
      setRooms(prev => {
        const updated = prev.map(r => {
          if (r.id !== message.room_id) return r;
          const isActive = r.id === activeRoomId;
          return {
            ...r,
            last_message: message.content,
            last_message_at: message.sent_at,
            unread_count: isActive ? 0 : (r.unread_count || 0) + 1
          };
        });
        // Raum nach oben sortieren
        return [...updated].sort((a, b) => {
          const ta = new Date(a.last_message_at || a.created_at).getTime();
          const tb = new Date(b.last_message_at || b.created_at).getTime();
          return tb - ta;
        });
      });
    };
    socket.on('chat:message', handleMessage);
    return () => socket.off('chat:message', handleMessage);
  }, [socket, activeRoomId]);

  const handleRoomCreated = (roomId) => {
    setShowNewRoom(null);
    loadRooms();
    onSelectRoom(roomId);
  };

  const handleSelectRoom = (room) => {
    // Lokal als gelesen markieren
    setRooms(prev => prev.map(r =>
      r.id === room.id ? { ...r, unread_count: 0 } : r
    ));
    onSelectRoom(room.id, room);
  };

  const handleStatusTabChange = (key) => {
    setStatusFilter(key);
    setRooms([]);
    setIsLoading(true);
    loadRooms(key);
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  // Emoji-Avatar für Gruppen-/Ankündigungs-Räume
  const RoomAvatar = ({ room }) => {
    if (room.type === 'direct') {
      // Initialen-Avatar
      const initial = (room.name || '?')[0].toUpperCase();
      return (
        <div className="chat-room-avatar chat-room-avatar--direct">
          {initial}
        </div>
      );
    }
    if (room.type === 'announcement') {
      return (
        <div className="chat-room-avatar chat-room-avatar--announcement">
          📣
        </div>
      );
    }
    // Gruppen-Avatar: Emoji + Farbe
    const emoji = room.avatar_emoji || '👥';
    const color = room.avatar_color || '#4f7cff';
    return (
      <div
        className="chat-room-avatar chat-room-avatar--group"
        style={{ background: color }}
      >
        {emoji}
      </div>
    );
  };

  const filteredRooms = rooms.filter(r =>
    !filter || (r.name || '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="chat-room-list">
      {/* Header */}
      <div className="chat-room-list-header">
        <h2 className="chat-room-list-title">
          <MessageCircle size={18} />
          Chat
          {unreadCount > 0 && (
            <span className="chat-badge-large">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </h2>
        <div className="chat-new-btns">
          <button
            className="chat-new-btn"
            onClick={() => setShowNewRoom('direct')}
            title="Direktnachricht"
          >
            <UserPlus size={16} />
          </button>
          <button
            className="chat-new-btn chat-new-btn--group"
            onClick={() => setShowNewRoom('group')}
            title="Gruppenchat erstellen"
          >
            <UsersRound size={16} />
          </button>
        </div>
      </div>

      {/* Status-Filter Tabs */}
      <div className="chat-status-tabs">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            className={`chat-status-tab ${statusFilter === tab.key ? 'chat-status-tab--active' : ''}`}
            onClick={() => handleStatusTabChange(tab.key)}
            style={statusFilter === tab.key ? { borderBottomColor: tab.color, color: tab.color } : {}}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Suche */}
      <div className="chat-room-filter">
        <Search size={14} />
        <input
          type="text"
          placeholder="Chats filtern…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      {/* Raumliste */}
      <div className="chat-room-items">
        {isLoading && (
          <div className="chat-loading">Lädt…</div>
        )}

        {!isLoading && filteredRooms.length === 0 && (
          <div className="chat-room-empty">
            <MessageCircle size={32} />
            <p>Keine {STATUS_TABS.find(t => t.key === statusFilter)?.label?.toLowerCase()} Chats</p>
            {statusFilter === 'active' && (
              <button className="chat-btn-primary" onClick={() => setShowNewRoom('direct')}>
                Ersten Chat starten
              </button>
            )}
          </div>
        )}

        {filteredRooms.map(room => (
          <button
            key={room.id}
            className={`chat-room-item ${room.id === activeRoomId ? 'chat-room-item--active' : ''} ${room.unread_count > 0 ? 'chat-room-item--unread' : ''}`}
            onClick={() => handleSelectRoom(room)}
          >
            <RoomAvatar room={room} />
            <div className="chat-room-item-content">
              <div className="chat-room-item-top">
                <span className="chat-room-item-name">
                  {room.name || 'Chat'}
                  {room.status !== 'active' && <StatusDot status={room.status} />}
                </span>
                <span className="chat-room-item-time">{formatTime(room.last_message_at)}</span>
              </div>
              <div className="chat-room-item-bottom">
                <span className="chat-room-item-preview">
                  {room.last_message
                    ? (room.last_message.length > 45
                        ? room.last_message.substring(0, 45) + '…'
                        : room.last_message)
                    : 'Noch keine Nachrichten'}
                </span>
                {room.unread_count > 0 && (
                  <span className="chat-badge">{room.unread_count > 99 ? '99+' : room.unread_count}</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Neuer Raum Modal */}
      {showNewRoom && (
        <ChatNewRoom
          mode={showNewRoom}
          onCreated={handleRoomCreated}
          onClose={() => setShowNewRoom(null)}
        />
      )}
    </div>
  );
};

export default ChatRoomList;
