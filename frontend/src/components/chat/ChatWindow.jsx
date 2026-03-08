// =====================================================================================
// CHAT WINDOW - Chatfenster mit Nachrichten-Liste und Eingabe
// =====================================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, ArrowLeft, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useChatContext } from '../../context/ChatContext.jsx';
import ChatMessage from './ChatMessage.jsx';

const ChatWindow = ({ room, onBack }) => {
  const { token } = useAuth();
  const { socket, joinRoom, leaveRoom, markRoomAsRead, sendMessage } = useChatContext();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesTopRef = useRef(null);
  const isLoadingMore = useRef(false);
  const inputRef = useRef(null);

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

    socket.on('chat:message', handleMessage);
    socket.on('chat:reaction', handleReaction);

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:reaction', handleReaction);
    };
  }, [socket, room.id, markRoomAsRead]);

  // Nachricht senden
  const handleSend = async () => {
    const content = input.trim();
    if (!content || isSending) return;
    setInput('');
    setIsSending(true);
    try {
      await sendMessage(room.id, content);
    } catch (e) {
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
    } finally {
      setIsSending(false);
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

  const roomIcon = room.type === 'announcement' ? '📣' : room.type === 'group' ? '👥' : '💬';

  return (
    <div className="chat-window">
      {/* Header */}
      <div className="chat-window-header">
        <button className="chat-back-btn" onClick={onBack} title="Zurück">
          <ArrowLeft size={18} />
        </button>
        <div className="chat-window-header-info">
          <span className="chat-window-room-icon">{roomIcon}</span>
          <div>
            <div className="chat-window-room-name">{room.name || 'Chat'}</div>
            {room.member_count > 0 && (
              <div className="chat-window-member-count">
                <Users size={11} /> {room.member_count} Mitglieder
              </div>
            )}
          </div>
        </div>
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
            <div className="chat-empty-icon">💬</div>
            <div className="chat-empty-text">Noch keine Nachrichten</div>
            <div className="chat-empty-hint">Schreibe die erste Nachricht!</div>
          </div>
        )}

        {messages.map(message => (
          <ChatMessage
            key={message.id}
            message={message}
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
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Eingabe (nur wenn kein Ankündigungs-Kanal oder Nutzer kein Mitglied) */}
      {room.type !== 'announcement' ? (
        <div className="chat-input-bar">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="Nachricht schreiben…"
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
      ) : (
        <div className="chat-readonly-bar">
          📣 Nur Admins können hier schreiben
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
