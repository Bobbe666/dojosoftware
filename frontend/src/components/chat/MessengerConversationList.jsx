// =====================================================================================
// MESSENGER CONVERSATION LIST - Seitenleiste mit Facebook Messenger Konversationen
// =====================================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDojoContext } from '../../context/DojoContext.jsx';

const MessengerConversationList = ({ activeRoomId, onSelectRoom }) => {
  const { token } = useAuth();
  const { activeDojo } = useDojoContext();
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');

  const dojoId = activeDojo?.id || activeDojo;

  const loadConversations = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      setError(null);
      const params = dojoId && dojoId !== 'super-admin' ? `?dojo_id=${dojoId}` : '';
      const res = await fetch(`/api/messenger/conversations${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setConversations(data.conversations || []);
      } else {
        setError(data.error || 'Fehler beim Laden');
      }
    } catch (e) {
      setError('Netzwerkfehler');
    } finally {
      setIsLoading(false);
    }
  }, [token, dojoId]);

  useEffect(() => {
    loadConversations();
    // Alle 30 Sekunden neu laden (kein Socket.io für Messenger-Liste)
    const interval = setInterval(loadConversations, 30000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const filteredConversations = filter
    ? conversations.filter(c =>
        c.fb_name?.toLowerCase().includes(filter.toLowerCase()) ||
        c.last_message?.toLowerCase().includes(filter.toLowerCase())
      )
    : conversations;

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) {
      const mins = Math.floor(diffMs / 60000);
      return mins <= 1 ? 'Gerade eben' : `vor ${mins} Min.`;
    }
    if (diffHours < 24) return `vor ${Math.floor(diffHours)} Std.`;
    if (diffDays < 7) return `vor ${Math.floor(diffDays)} T.`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSelectConversation = (conv) => {
    const roomObj = {
      id: conv.chat_room_id,
      name: conv.fb_name || 'Facebook-Nutzer',
      type: 'direct',
      source: 'messenger',
      psid: conv.psid,
      window_open: conv.window_open,
      last_message_at: conv.last_message_at
    };
    onSelectRoom(conv.chat_room_id, roomObj);
  };

  if (isLoading) {
    return (
      <div className="chat-room-list">
        <div className="chat-room-list__header">
          <span className="chat-room-list__title">📘 Messenger</span>
        </div>
        <div className="chat-room-list__loading">Lade Konversationen…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chat-room-list">
        <div className="chat-room-list__header">
          <span className="chat-room-list__title">📘 Messenger</span>
        </div>
        <div className="chat-room-list__empty" style={{ color: 'var(--color-error, #ef4444)' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="chat-room-list">
      <div className="chat-room-list__header">
        <span className="chat-room-list__title">📘 Messenger</span>
        <button
          className="chat-room-list__refresh"
          onClick={loadConversations}
          title="Aktualisieren"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.6 }}
        >
          ↻
        </button>
      </div>

      {/* Suche */}
      <div className="chat-room-list__search">
        <input
          type="text"
          placeholder="Konversation suchen…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="chat-room-list__search-input"
        />
      </div>

      {/* Konversationen */}
      {filteredConversations.length === 0 ? (
        <div className="chat-room-list__empty">
          {filter ? 'Keine Ergebnisse.' : 'Noch keine Messenger-Nachrichten eingegangen.'}
        </div>
      ) : (
        <div className="chat-room-list__rooms">
          {filteredConversations.map(conv => (
            <div
              key={conv.id}
              className={`chat-room-item ${activeRoomId === conv.chat_room_id ? 'chat-room-item--active' : ''}`}
              onClick={() => handleSelectConversation(conv)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && handleSelectConversation(conv)}
            >
              {/* Avatar */}
              <div className="chat-room-item__avatar messenger-avatar">
                <span>{getInitials(conv.fb_name)}</span>
              </div>

              {/* Inhalt */}
              <div className="chat-room-item__content">
                <div className="chat-room-item__top">
                  <span className="chat-room-item__name">{conv.fb_name || 'Facebook-Nutzer'}</span>
                  <span className="chat-room-item__time">{formatTime(conv.last_message_at)}</span>
                </div>
                <div className="chat-room-item__bottom">
                  <span className="chat-room-item__preview">
                    {conv.last_sender_type !== 'messenger_user' && (
                      <span style={{ opacity: 0.6, marginRight: 3 }}>Du: </span>
                    )}
                    {conv.last_message || <em style={{ opacity: 0.5 }}>Keine Nachrichten</em>}
                  </span>
                  <div className="chat-room-item__badges">
                    {!conv.window_open && (
                      <span
                        className="messenger-window-badge messenger-window-badge--closed"
                        title="24h-Fenster abgelaufen — Nutzer muss zuerst schreiben"
                      >
                        🔒
                      </span>
                    )}
                    {conv.unread_count > 0 && (
                      <span className="chat-unread-badge">{conv.unread_count}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessengerConversationList;
