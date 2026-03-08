// =====================================================================================
// ADMIN CHAT PAGE - Wie ChatPage, aber ohne MemberHeader (Admin-Header kommt vom Dashboard)
// =====================================================================================

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import ChatRoomList from './ChatRoomList.jsx';
import ChatWindow from './ChatWindow.jsx';
import ChatPopup from './ChatPopup.jsx';
import '../../styles/Chat.css';

const AdminChatPage = () => {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const [isMobileListVisible, setIsMobileListVisible] = useState(true);

  useEffect(() => {
    const roomParam = searchParams.get('room');
    if (roomParam) {
      setActiveRoomId(parseInt(roomParam));
      setIsMobileListVisible(false);
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
    } catch (e) {}
  };

  const handleSelectRoom = (roomId, room) => {
    setActiveRoomId(roomId);
    if (room) setActiveRoom(room);
    else loadRoom(roomId);
    setIsMobileListVisible(false);
  };

  const handleBack = () => {
    setIsMobileListVisible(true);
    setActiveRoomId(null);
    setActiveRoom(null);
  };

  return (
    <div className="chat-page chat-page--admin">
      <ChatPopup />
      <div className="chat-layout">
        <div className={`chat-sidebar ${!isMobileListVisible ? 'chat-sidebar--hidden-mobile' : ''}`}>
          <ChatRoomList
            activeRoomId={activeRoomId}
            onSelectRoom={handleSelectRoom}
          />
        </div>
        <div className={`chat-main ${isMobileListVisible && !activeRoomId ? 'chat-main--hidden-mobile' : ''}`}>
          {activeRoom ? (
            <ChatWindow
              key={activeRoom.id}
              room={activeRoom}
              onBack={handleBack}
            />
          ) : (
            <div className="chat-placeholder">
              <div className="chat-placeholder-icon">💬</div>
              <div className="chat-placeholder-title">Wähle einen Chat</div>
              <div className="chat-placeholder-hint">
                Wähle links einen Chat aus oder starte eine neue Unterhaltung.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminChatPage;
