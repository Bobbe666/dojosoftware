// =====================================================================================
// VISITOR CHAT ALERTS – In-App Chat-Popup für eingehende Besucher-Nachrichten
// Zeigt ein Popup-Fenster mit direkter Antwortmöglichkeit
// =====================================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useChatContext } from '../../context/ChatContext.jsx';
import axios from 'axios';

// ─── Einzelnes Popup-Fenster ──────────────────────────────────────────────────

const ChatPopup = ({ popup, onDismiss, onOpenChat }) => {
  const [messages, setMessages] = useState(popup.messages || []);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const token = localStorage.getItem('dojo_auth_token') || localStorage.getItem('token');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Neue Nachrichten von außen (via addMessage) empfangen
  useEffect(() => {
    setMessages(popup.messages || []);
  }, [popup.messages]);

  const sendReply = async () => {
    if (!reply.trim() || sending) return;
    const text = reply.trim();
    setReply('');
    setSending(true);
    try {
      const res = await axios.post(
        `/visitor-chat/sessions/${popup.sessionId}/reply`,
        { message: text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setMessages(prev => [...prev, res.data.message]);
      }
    } catch (err) {
      console.error('Popup-Antwort fehlgeschlagen', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  };

  return (
    <div style={{
      width: '340px',
      background: '#1a1a2e',
      border: '2px solid #c53030',
      borderRadius: '14px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      animation: 'popupIn 0.25s ease'
    }}>
      {/* Header */}
      <div style={{
        background: '#c53030',
        padding: '10px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: '12px', color: '#fed7d7', fontWeight: 500 }}>
            🌐 Chatnachricht von {popup.site || 'Homepage'}
          </div>
          <div style={{ fontSize: '14px', color: '#fff', fontWeight: 700, marginTop: '1px' }}>
            {popup.visitorName}
          </div>
        </div>
        <button
          onClick={() => onDismiss(popup.id)}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: '#fff',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >×</button>
      </div>

      {/* Nachrichtenverlauf */}
      <div style={{
        padding: '12px',
        maxHeight: '200px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        background: '#12122a'
      }}>
        {messages.map((msg, i) => (
          <div key={msg.id || i} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.sender_type === 'staff' ? 'flex-end' : 'flex-start'
          }}>
            <div style={{
              background: msg.sender_type === 'staff' ? '#2b6cb0' : '#2d3748',
              color: '#e2e8f0',
              borderRadius: msg.sender_type === 'staff' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              padding: '7px 11px',
              fontSize: '13px',
              maxWidth: '90%',
              wordBreak: 'break-word'
            }}>
              {msg.message}
            </div>
            <div style={{ fontSize: '10px', color: '#718096', marginTop: '2px' }}>
              {msg.sender_type === 'staff' ? '✓ Gesendet' : popup.visitorName}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Antwort-Eingabe */}
      <div style={{
        padding: '10px 12px',
        background: '#1a1a2e',
        borderTop: '1px solid #2d3748',
        display: 'flex',
        gap: '8px'
      }}>
        <input
          value={reply}
          onChange={e => setReply(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Antworten…"
          disabled={sending}
          style={{
            flex: 1,
            background: '#2d3748',
            border: '1px solid #4a5568',
            borderRadius: '8px',
            padding: '7px 10px',
            color: '#e2e8f0',
            fontSize: '13px',
            outline: 'none'
          }}
        />
        <button
          onClick={sendReply}
          disabled={!reply.trim() || sending}
          style={{
            background: reply.trim() ? '#2b6cb0' : '#2d3748',
            border: 'none',
            borderRadius: '8px',
            padding: '7px 12px',
            color: '#fff',
            cursor: reply.trim() ? 'pointer' : 'default',
            fontSize: '16px',
            flexShrink: 0
          }}
        >➤</button>
      </div>

      {/* Footer-Buttons */}
      <div style={{
        padding: '8px 12px 12px',
        display: 'flex',
        gap: '8px',
        background: '#1a1a2e'
      }}>
        <button
          onClick={() => onOpenChat(popup.id)}
          style={{
            flex: 1,
            background: '#2d3748',
            color: '#90cdf4',
            border: '1px solid #4a5568',
            borderRadius: '8px',
            padding: '7px',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          Im Chat öffnen →
        </button>
        <button
          onClick={() => onDismiss(popup.id)}
          style={{
            flex: 1,
            background: '#744210',
            color: '#fefcbf',
            border: 'none',
            borderRadius: '8px',
            padding: '7px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          ✓ Zur Kenntnis genommen
        </button>
      </div>
    </div>
  );
};

// ─── Container: verwaltet alle Popups ────────────────────────────────────────

let popupIdCounter = 0;

const VisitorChatAlerts = () => {
  const { socket } = useChatContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [popups, setPopups] = useState([]);

  // Staff-Room beitreten wenn NICHT auf BesucherChat-Seite
  useEffect(() => {
    if (!socket) return;
    const onBesucherChatPage = location.pathname.includes('/besucher-chat');
    if (onBesucherChatPage) return;

    let dojoId = null;
    try {
      const stored = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (stored) {
        const payload = JSON.parse(atob(stored.split('.')[1]));
        dojoId = payload.dojo_id || null;
      }
    } catch {}

    socket.emit('visitor-chat:staff-join', { dojoId });
    return () => socket.emit('visitor-chat:staff-leave', { dojoId });
  }, [socket, location.pathname]);

  // Socket-Events: neue Session oder Nachricht
  useEffect(() => {
    if (!socket) return;

    const onNewSession = (data) => {
      // Popup erstellen (noch keine Nachricht, nur Session-Ankündigung)
      const id = ++popupIdCounter;
      setPopups(prev => {
        // Falls schon ein Popup für diese Session existiert, nicht doppelt anlegen
        if (prev.find(p => p.sessionId === data.sessionId)) return prev;
        return [...prev, {
          id,
          sessionId: data.sessionId,
          visitorName: data.visitor_name,
          site: data.source_site,
          messages: []
        }];
      });
    };

    const onNewMessage = (data) => {
      const { sessionId, message, visitor_name, source_site } = data;

      setPopups(prev => {
        const existing = prev.find(p => p.sessionId === sessionId);
        if (existing) {
          // Nachricht zu bestehendem Popup hinzufügen
          return prev.map(p =>
            p.sessionId === sessionId
              ? { ...p, messages: [...p.messages, message] }
              : p
          );
        } else {
          // Neues Popup für diese Session
          const id = ++popupIdCounter;
          return [...prev, {
            id,
            sessionId,
            visitorName: visitor_name || message?.sender_name || 'Besucher',
            site: source_site,
            messages: message ? [message] : []
          }];
        }
      });
    };

    socket.on('visitor-chat:new-session', onNewSession);
    socket.on('visitor-chat:new-message', onNewMessage);
    return () => {
      socket.off('visitor-chat:new-session', onNewSession);
      socket.off('visitor-chat:new-message', onNewMessage);
    };
  }, [socket]);

  const dismiss = (id) => setPopups(prev => prev.filter(p => p.id !== id));

  const openChat = (id) => {
    dismiss(id);
    navigate('/dashboard/besucher-chat');
  };

  if (popups.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes popupIn {
          from { transform: translateY(20px) scale(0.95); opacity: 0; }
          to   { transform: translateY(0) scale(1);    opacity: 1; }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: '12px',
        pointerEvents: 'none'
      }}>
        {popups.map(popup => (
          <div key={popup.id} style={{ pointerEvents: 'all' }}>
            <ChatPopup
              popup={popup}
              onDismiss={dismiss}
              onOpenChat={openChat}
            />
          </div>
        ))}
      </div>
    </>
  );
};

export default VisitorChatAlerts;
