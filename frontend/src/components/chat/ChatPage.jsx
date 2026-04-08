// =====================================================================================
// CHAT PAGE - Hauptseite mit Raumliste (links) und Chatfenster (rechts)
// =====================================================================================

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import MemberHeader from '../MemberHeader.jsx';
import ChatRoomList from './ChatRoomList.jsx';
import ChatWindow from './ChatWindow.jsx';
import ChatPopup from './ChatPopup.jsx';
import '../../styles/Chat.css';

const ChatPage = () => {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const [isMobileListVisible, setIsMobileListVisible] = useState(true);
  const [roomListVersion, setRoomListVersion] = useState(0);

  // URL-Parameter: ?room=123 direkt öffnen (z.B. von Push-Klick)
  useEffect(() => {
    const roomParam = searchParams.get('room');
    if (roomParam) {
      setActiveRoomId(parseInt(roomParam));
      setIsMobileListVisible(false);
      // Raum-Details laden
      loadRoom(parseInt(roomParam));
    }
  }, [searchParams]);

  const loadRoom = async (roomId) => {
    if (!roomId || !token) return;
    try {
      const res = await fetch(`/api/chat/rooms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        const room = data.rooms.find(r => r.id === roomId);
        if (room) setActiveRoom(room);
      }
    } catch (e) {
      // Stille Fehler
    }
  };

  const handleSelectRoom = (roomId, room) => {
    setActiveRoomId(roomId);
    if (room) setActiveRoom(room);
    else loadRoom(roomId);
    setIsMobileListVisible(false); // Mobile: Chatfenster zeigen
  };

  const handleBack = () => {
    setIsMobileListVisible(true); // Mobile: zurück zur Liste
    setActiveRoomId(null);
    setActiveRoom(null);
  };

  return (
    <div className="chat-page">
      <MemberHeader />
      <ChatPopup />

      <div className="chat-layout">
        {/* Linke Spalte: Raumliste */}
        <div className={`chat-sidebar ${!isMobileListVisible ? 'chat-sidebar--hidden-mobile' : ''}`}>
          <ChatRoomList
            activeRoomId={activeRoomId}
            onSelectRoom={handleSelectRoom}
            refreshVersion={roomListVersion}
          />
        </div>

        {/* Rechte Spalte: Chatfenster */}
        <div className={`chat-main ${isMobileListVisible && !activeRoomId ? 'chat-main--hidden-mobile' : ''}`}>
          {activeRoom ? (
            <ChatWindow
              key={activeRoom.id}
              room={activeRoom}
              onBack={handleBack}
              onRoomUpdated={(updatedRoom, action) => {
                if (!updatedRoom) {
                  // Gruppe verlassen oder Raum gelöscht
                  handleBack();
                  if (action === 'deleted') {
                    setRoomListVersion(v => v + 1); // Raumliste neu laden
                  }
                } else {
                  setActiveRoom(updatedRoom);
                }
              }}
            />
          ) : (
            <div className="chat-placeholder">
              <div className="chat-placeholder-icon">🥋</div>
              <div className="chat-placeholder-title">Wähle einen Chat</div>
              <div className="chat-placeholder-hint">
                Wähle links einen Chat aus oder starte eine neue Runde.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
