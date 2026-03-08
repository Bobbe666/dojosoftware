// =====================================================================================
// CHAT CONTEXT - Dojosoftware
// Socket.io-Verbindung, Ungelesen-Zähler, In-App-Popup
// =====================================================================================

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const ChatContext = createContext(null);

// Socket.io-URL aus API-URL ableiten
function getSocketUrl() {
  if (import.meta.env.MODE === 'production') {
    return window.location.origin; // Gleicher Host wie die App
  }
  return 'http://localhost:5001'; // Dev-Server Port (ohne /api)
}

export const ChatProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [popup, setPopup] = useState(null); // { senderName, preview, roomId }
  const [isConnected, setIsConnected] = useState(false);
  const popupTimeoutRef = useRef(null);

  // Ungelesen-Zähler beim Start laden
  const loadUnreadCount = useCallback(async () => {
    if (!token || !user) return;
    try {
      const dojoId = user.dojo_id;
      const url = dojoId ? `/api/chat/unread-count?dojo_id=${dojoId}` : '/api/chat/unread-count';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count || 0);
      }
    } catch (e) {
      // Stille Fehler beim Laden des Zählers
    }
  }, [token, user]);

  // Socket.io verbinden wenn eingeloggt
  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const s = io(getSocketUrl(), {
      auth: { token },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });

    s.on('connect', () => {
      setIsConnected(true);
      loadUnreadCount();
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    s.on('connect_error', (err) => {
      console.warn('[Chat] Socket-Verbindungsfehler:', err.message);
    });

    // Neue Nachricht empfangen → Badge erhöhen + Popup zeigen
    s.on('chat:message', (message) => {
      // Nur wenn es NICHT die eigene Nachricht ist
      const ownSenderId = user.mitglied_id || user.user_id || user.admin_id;
      const isOwn = (
        String(message.sender_id) === String(ownSenderId) &&
        (
          (user.role === 'member' && message.sender_type === 'mitglied') ||
          (user.role === 'trainer' && message.sender_type === 'trainer') ||
          (user.role === 'admin' && message.sender_type === 'admin')
        )
      );

      if (!isOwn) {
        setUnreadCount(c => c + 1);
        showPopup({
          senderName: message.sender_name || 'Jemand',
          preview: message.content.length > 70
            ? message.content.substring(0, 70) + '…'
            : message.content,
          roomId: message.room_id
        });
      }
    });

    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [token]); // Nur auf token-Wechsel reagieren

  // Initiales Laden des Zählers
  useEffect(() => {
    if (token && user) loadUnreadCount();
  }, [token, user]);

  // Popup anzeigen (mit Auto-dismiss)
  const showPopup = useCallback((data) => {
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    setPopup(data);
    popupTimeoutRef.current = setTimeout(() => setPopup(null), 5000);
  }, []);

  const dismissPopup = useCallback(() => {
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    setPopup(null);
  }, []);

  // Ungelesen-Zähler zurücksetzen (wenn Chat-Seite geöffnet)
  const markRoomAsRead = useCallback(async (roomId) => {
    if (!roomId || !token) return;
    // Socket-Event senden (für Echtzeit-UX, falls verbunden)
    if (socket) socket.emit('chat:read', { room_id: roomId });
    // REST-Endpunkt als garantiertes DB-Update (unabhängig vom Socket-Status)
    try {
      await fetch(`/api/chat/rooms/${roomId}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {
      // Stille Fehler
    }
    // Zähler sofort neu laden (kein 500ms-Delay mehr)
    loadUnreadCount();
  }, [socket, token, loadUnreadCount]);

  // Nachricht via Socket senden
  const sendMessage = useCallback((roomId, content) => {
    return new Promise((resolve, reject) => {
      if (!socket || !socket.connected) {
        reject(new Error('Nicht verbunden'));
        return;
      }
      socket.emit('chat:message', { room_id: roomId, content }, (response) => {
        if (response?.success) resolve(response);
        else reject(new Error('Senden fehlgeschlagen'));
      });
    });
  }, [socket]);

  // Reaktion via Socket senden
  const sendReaction = useCallback((messageId, emoji) => {
    if (!socket) return;
    socket.emit('chat:react', { message_id: messageId, emoji });
  }, [socket]);

  // Raum via Socket beitreten
  const joinRoom = useCallback((roomId) => {
    if (!socket) return;
    socket.emit('chat:join', roomId);
  }, [socket]);

  const leaveRoom = useCallback((roomId) => {
    if (!socket) return;
    socket.emit('chat:leave', roomId);
  }, [socket]);

  const value = {
    socket,
    isConnected,
    unreadCount,
    setUnreadCount,
    popup,
    dismissPopup,
    markRoomAsRead,
    sendMessage,
    sendReaction,
    joinRoom,
    leaveRoom,
    loadUnreadCount
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext muss innerhalb ChatProvider verwendet werden');
  return ctx;
};

export default ChatContext;
