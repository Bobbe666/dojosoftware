// =====================================================================================
// CHAT WINDOW - Chatfenster mit Nachrichten-Liste und Eingabe
// =====================================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, ArrowLeft, Users, Settings, Trash2, Archive, X, MoreVertical } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useChatContext } from '../../context/ChatContext.jsx';
import ChatMessage from './ChatMessage.jsx';
import ChatRoomSettings from './ChatRoomSettings.jsx';

const ChatWindow = ({ room, onBack, onRoomUpdated }) => {
  const { token, user } = useAuth();
  const { socket, joinRoom, leaveRoom, markRoomAsRead, sendMessage } = useChatContext();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [readSummary, setReadSummary] = useState({}); // { message_id: { read_count, reader_names, total_members } }
  const [roomMemberCount, setRoomMemberCount] = useState(0);
  const isMessenger = room.source === 'messenger';
  const messengerWindowOpen = !isMessenger || room.window_open !== false;
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDirectMenu, setShowDirectMenu] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesTopRef = useRef(null);
  const isLoadingMore = useRef(false);
  const inputRef = useRef(null);

  // Bestimme ob aktueller User Owner/Admin im Raum ist (für Settings-Button)
  const myRole = room.my_role; // 'owner', 'admin', 'member'
  const isAdminUser = user?.role === 'admin' || user?.role === 'super_admin';
  const canManageRoom = room.type === 'group' && (myRole === 'owner' || myRole === 'admin' || isAdminUser);

  // Read-Summary laden (wer hat welche Nachrichten gelesen)
  const loadReadSummary = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/chat/rooms/${room.id}/reads-summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setReadSummary(data.summary || {});
        // Mitgliederzahl aus erstem Eintrag holen
        const first = Object.values(data.summary || {})[0];
        if (first?.total_members) setRoomMemberCount(first.total_members);
      }
    } catch (_) {}
  }, [room.id, token]);

  // Nachrichten laden
  const loadMessages = useCallback(async (beforeId = null) => {
    if (isLoadingMore.current) return;
    isLoadingMore.current = true;
    setIsLoading(true);
    try {
      let url = `/api/chat/rooms/${room.id}/messages?limit=50`;
      if (beforeId) url += `&before_id=${beforeId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        if (beforeId) {
          setMessages(prev => [...data.messages, ...prev]);
        } else {
          setMessages(data.messages);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'instant' }), 50);
        }
        setHasMore(data.has_more);
      }
    } catch (e) {
      console.error('[ChatWindow] Nachrichten laden Fehler:', e);
    } finally {
      setIsLoading(false);
      isLoadingMore.current = false;
    }
  }, [room.id, token]);

  // Raum beitreten, Nachrichten laden und Input fokussieren
  useEffect(() => {
    loadMessages();
    loadReadSummary();
    joinRoom(room.id);
    markRoomAsRead(room.id);
    setTimeout(() => inputRef.current?.focus(), 100);

    return () => {
      leaveRoom(room.id);
    };
  }, [room.id]);

  // Socket.io: neue Nachrichten empfangen
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (message) => {
      if (message.room_id !== room.id) return;
      setMessages(prev => {
        // Duplikate vermeiden
        if (prev.find(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      // Als gelesen markieren da wir gerade im Raum sind
      markRoomAsRead(room.id);
    };

    const handleReaction = ({ message_id, reactions }) => {
      setMessages(prev => prev.map(m =>
        m.id === message_id ? { ...m, reactions } : m
      ));
    };

    // Read-Receipt Event: Jemand hat Nachrichten gelesen
    const handleRead = ({ room_id, reader_id, reader_type, reader_name, message_ids }) => {
      if (room_id !== room.id) return;
      setReadSummary(prev => {
        const updated = { ...prev };
        for (const msgId of message_ids) {
          const existing = updated[msgId] || { read_count: 0, reader_names: [], total_members: roomMemberCount };
          if (!existing.reader_names.includes(reader_name)) {
            updated[msgId] = {
              ...existing,
              read_count: existing.read_count + 1,
              reader_names: [...existing.reader_names, reader_name],
              total_members: existing.total_members
            };
          }
        }
        return updated;
      });
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:reaction', handleReaction);
    socket.on('chat:read', handleRead);

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:reaction', handleReaction);
      socket.off('chat:read', handleRead);
    };
  }, [socket, room.id, markRoomAsRead, roomMemberCount]);

  // Nachricht senden
  const handleSend = async () => {
    const content = input.trim();
    if (!content || isSending) return;
    setInput('');
    setIsSending(true);
    try {
      if (isMessenger) {
        // Messenger: Senden über Graph API via Backend
        const res = await fetch('/api/messenger/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ chat_room_id: room.id, text: content })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Senden fehlgeschlagen');
      } else {
        await sendMessage(room.id, content);
      }
    } catch (e) {
      if (!isMessenger) {
        // Socket fehlgeschlagen → REST-Fallback
        try {
          const res = await fetch(`/api/chat/rooms/${room.id}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ content })
          });
          const data = await res.json();
          if (data.success) {
            setMessages(prev => [...prev, data.message]);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
          }
        } catch (restErr) {
          setInput(content); // Inhalt zurückstellen
        }
      } else {
        setInput(content); // Inhalt zurückstellen
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleSetStatus = async (status) => {
    setShowDirectMenu(false);
    try {
      // 'archived' nutzt den per-User Toggle-Endpoint (kein owner-Recht nötig)
      const url = status === 'archived'
        ? `/api/chat/rooms/${room.id}/archive`
        : `/api/chat/rooms/${room.id}`;
      const method = status === 'archived' ? 'PUT' : 'PUT';
      const body = status === 'archived' ? undefined : JSON.stringify({ status });
      const headers = { Authorization: `Bearer ${token}` };
      if (body) headers['Content-Type'] = 'application/json';
      const res = await fetch(url, { method, headers, body });
      const data = await res.json();
      if (data.success) {
        if (onRoomUpdated) onRoomUpdated(null, 'deleted'); // zurück zur Liste
      }
    } catch (e) {}
  };

  const handleDeleteDirectChat = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/chat/rooms/${room.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        if (onRoomUpdated) onRoomUpdated(null, 'deleted');
      } else {
        setShowDeleteConfirm(false);
      }
    } catch (e) {
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleScroll = (e) => {
    const { scrollTop } = e.target;
    if (scrollTop < 80 && hasMore && !isLoadingMore.current && messages.length > 0) {
      loadMessages(messages[0]?.id);
    }
  };

  // Avatar-Darstellung im Header
  const HeaderAvatar = () => {
    if (room.type === 'direct') {
      const initial = (room.name || '?')[0].toUpperCase();
      return <div className="chat-header-avatar chat-header-avatar--direct">{initial}</div>;
    }
    if (room.type === 'announcement') {
      return <div className="chat-header-avatar chat-header-avatar--announcement">📣</div>;
    }
    // Gruppe mit Emoji + Farbe
    const emoji = room.avatar_emoji || '👥';
    const color = room.avatar_color || '#4f7cff';
    return (
      <div className="chat-header-avatar chat-header-avatar--group" style={{ background: color }}>
        {emoji}
      </div>
    );
  };

  return (
    <div className="chat-window">
      {/* Header */}
      <div className="chat-window-header">
        <button className="chat-back-btn" onClick={onBack} title="Zurück">
          <ArrowLeft size={18} />
        </button>
        <HeaderAvatar />
        <div className="chat-window-header-info">
          <div className="chat-window-room-name">
            {isMessenger && <span style={{ marginRight: 5 }}>📘</span>}
            {room.name || 'Chat'}
          </div>
          {isMessenger ? (
            <div className="chat-window-member-count">
              {messengerWindowOpen
                ? <span style={{ color: 'var(--color-success, #22c55e)' }}>● 24h-Fenster offen</span>
                : <span style={{ color: 'var(--color-muted, #94a3b8)' }}>🔒 Fenster abgelaufen</span>
              }
            </div>
          ) : room.member_count > 0 && (
            <div className="chat-window-member-count">
              <Users size={11} /> {room.member_count} Mitglieder
            </div>
          )}
        </div>
        {room.type === 'direct' && (
          <div style={{ position: 'relative' }}>
            <button
              className="chat-settings-btn"
              onClick={() => setShowDirectMenu(v => !v)}
              title="Chat-Optionen"
            >
              <MoreVertical size={17} />
            </button>
            {showDirectMenu && (
              <div className="chat-direct-menu" onClick={e => e.stopPropagation()}>
                <button className="chat-direct-menu-item" onClick={() => handleSetStatus('active')}>
                  🟢 Als Aktiv markieren
                </button>
                <button className="chat-direct-menu-item" onClick={() => handleSetStatus('archived')}>
                  📦 Archivieren
                </button>
                <button className="chat-direct-menu-item" onClick={() => handleSetStatus('closed')}>
                  🔒 Schließen
                </button>
                <div className="chat-direct-menu-divider" />
                <button className="chat-direct-menu-item chat-direct-menu-item--danger" onClick={() => { setShowDirectMenu(false); setShowDeleteConfirm(true); }}>
                  <Trash2 size={13} /> Löschen
                </button>
              </div>
            )}
          </div>
        )}
        {canManageRoom && (
          <button
            className="chat-settings-btn"
            onClick={() => setShowSettings(true)}
            title="Gruppeneinstellungen"
          >
            <Settings size={18} />
          </button>
        )}
      </div>

      {/* Nachrichten */}
      <div className="chat-messages-list" onScroll={handleScroll}>
        <div ref={messagesTopRef} />

        {isLoading && messages.length === 0 && (
          <div className="chat-loading">Nachrichten werden geladen…</div>
        )}

        {hasMore && messages.length > 0 && (
          <div className="chat-load-more">
            <button onClick={() => loadMessages(messages[0]?.id)} disabled={isLoading}>
              {isLoading ? '…' : 'Ältere Nachrichten laden'}
            </button>
          </div>
        )}

        {messages.length === 0 && !isLoading && (
          <div className="chat-empty">
            <div className="chat-empty-icon">🥋</div>
            <div className="chat-empty-text">Noch keine Nachrichten</div>
            <div className="chat-empty-hint">Starte die erste Runde!</div>
          </div>
        )}

        {messages.map((message, index) => {
          const msgDate = new Date(message.sent_at);
          const msgDateKey = `${msgDate.getFullYear()}-${msgDate.getMonth()}-${msgDate.getDate()}`;
          const prevMsg = messages[index - 1];
          const prevDate = prevMsg ? new Date(prevMsg.sent_at) : null;
          const prevDateKey = prevDate
            ? `${prevDate.getFullYear()}-${prevDate.getMonth()}-${prevDate.getDate()}`
            : null;
          const showSeparator = msgDateKey !== prevDateKey;
          const today = new Date();
          const isToday = msgDate.getFullYear() === today.getFullYear() &&
            msgDate.getMonth() === today.getMonth() &&
            msgDate.getDate() === today.getDate();
          const separatorLabel = isToday
            ? 'Heute'
            : msgDate.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

          return (
            <React.Fragment key={message.id}>
              {showSeparator && (
                <div className={`chat-date-separator${isToday ? ' chat-date-separator--today' : ''}`}>
                  <span className="chat-date-separator-label">{separatorLabel}</span>
                </div>
              )}
              <ChatMessage
                message={message}
                readInfo={readSummary[message.id]}
                totalMembers={roomMemberCount}
                onReact={(messageId, emoji) => {
              // Optimistische UI-Aktualisierung
              setMessages(prev => prev.map(m => {
                if (m.id !== messageId) return m;
                const reactions = [...(m.reactions || [])];
                const idx = reactions.findIndex(r => r.emoji === emoji);
                if (idx >= 0) {
                  const updated = { ...reactions[idx] };
                  updated.count = Math.max(0, updated.count - 1);
                  if (updated.count === 0) reactions.splice(idx, 1);
                  else reactions[idx] = updated;
                } else {
                  reactions.push({ emoji, count: 1 });
                }
                return { ...m, reactions };
              }));
            }}
          />
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Eingabe (nur wenn kein Ankündigungs-Kanal oder Nutzer kein Mitglied) */}
      {room.type !== 'announcement' ? (
        isMessenger && !messengerWindowOpen ? (
          <div className="chat-readonly-bar">
            🔒 24-Stunden-Fenster abgelaufen — Nutzer muss zuerst eine neue Nachricht senden
          </div>
        ) : (
          <div className="chat-input-bar">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder={isMessenger ? 'Antwort an Facebook-Nutzer…' : 'Nachricht schreiben…'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={2000}
            />
            <button
              className="chat-send-btn"
              onClick={handleSend}
              disabled={!input.trim() || isSending}
              title="Senden (Enter)"
            >
              <Send size={18} />
            </button>
          </div>
        )
      ) : (
        <div className="chat-readonly-bar">
          📣 Nur Admins können hier schreiben
        </div>
      )}

      {/* Direktchat löschen — Bestätigungsdialog */}
      {showDeleteConfirm && (
        <div className="chat-delete-overlay" onClick={() => !isDeleting && setShowDeleteConfirm(false)}>
          <div className="chat-delete-modal" onClick={e => e.stopPropagation()}>
            <div className="chat-delete-modal-icon">🗑️</div>
            <h4 className="chat-delete-modal-title">Chat löschen?</h4>
            <p className="chat-delete-modal-text">
              Diese Unterhaltung und alle Nachrichten werden <strong>dauerhaft gelöscht</strong> und sind nicht mehr verfügbar.
            </p>
            <div className="chat-delete-modal-btns">
              <button className="crs-btn-cancel-delete" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
                Abbrechen
              </button>
              <button className="crs-btn-confirm-delete" onClick={handleDeleteDirectChat} disabled={isDeleting}>
                {isDeleting ? '…' : 'Ja, löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gruppeneinstellungen-Modal */}
      {showSettings && (
        <ChatRoomSettings
          room={room}
          token={token}
          onClose={() => setShowSettings(false)}
          onUpdated={(updatedRoom) => {
            setShowSettings(false);
            if (onRoomUpdated) onRoomUpdated(updatedRoom);
          }}
        />
      )}
    </div>
  );
};

export default ChatWindow;
