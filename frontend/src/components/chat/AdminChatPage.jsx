// =====================================================================================
// ADMIN CHAT PAGE - Wie ChatPage, aber ohne MemberHeader (Admin-Header kommt vom Dashboard)
// Tabs: 💬 Intern | 📘 Messenger (Enterprise)
// =====================================================================================

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSubscription } from '../../context/SubscriptionContext.jsx';
import ChatRoomList from './ChatRoomList.jsx';
import ChatWindow from './ChatWindow.jsx';
import ChatPopup from './ChatPopup.jsx';
import MessengerConversationList from './MessengerConversationList.jsx';
import '../../styles/Chat.css';

const AdminChatPage = () => {
  const { token } = useAuth();
  const { hasFeature, getMinimumPlanForFeature } = useSubscription();
  const [searchParams] = useSearchParams();
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const [isMobileListVisible, setIsMobileListVisible] = useState(true);
  const [roomListVersion, setRoomListVersion] = useState(0);
  const [chatMode, setChatMode] = useState('intern'); // 'intern' | 'messenger'

  const hasMessenger = hasFeature('messenger');

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

  const handleSwitchMode = (mode) => {
    setChatMode(mode);
    handleBack();
  };

  return (
    <div className="chat-page chat-page--admin">
      <ChatPopup />

      {/* Tab-Leiste */}
      <div className="chat-mode-tabs">
        <button
          className={`chat-mode-tab ${chatMode === 'intern' ? 'chat-mode-tab--active' : ''}`}
          onClick={() => handleSwitchMode('intern')}
        >
          💬 Intern
        </button>
        <button
          className={`chat-mode-tab ${chatMode === 'messenger' ? 'chat-mode-tab--active' : ''}`}
          onClick={() => handleSwitchMode('messenger')}
        >
          📘 Messenger
          {!hasMessenger && <span className="chat-mode-tab__badge">Enterprise</span>}
        </button>
      </div>

      {/* Messenger-Upgrade-Banner */}
      {chatMode === 'messenger' && !hasMessenger && (
        <div className="chat-upgrade-banner">
          <div className="chat-upgrade-banner__icon">📘</div>
          <div className="chat-upgrade-banner__content">
            <strong>Facebook Messenger Integration</strong>
            <p>Beantworte eingehende Facebook Messenger Nachrichten direkt im Chat-Dashboard.</p>
            <p className="chat-upgrade-banner__plan">
              Verfügbar ab dem <strong>Enterprise-Plan</strong>
            </p>
          </div>
          <a href="/dashboard/subscription" className="chat-upgrade-banner__btn">
            Plan upgraden →
          </a>
        </div>
      )}

      {/* Chat-Layout */}
      {(chatMode === 'intern' || hasMessenger) && (
        <div className="chat-layout">
          <div className={`chat-sidebar ${!isMobileListVisible ? 'chat-sidebar--hidden-mobile' : ''}`}>
            {chatMode === 'intern' ? (
              <ChatRoomList
                activeRoomId={activeRoomId}
                onSelectRoom={handleSelectRoom}
                refreshVersion={roomListVersion}
              />
            ) : (
              <MessengerConversationList
                activeRoomId={activeRoomId}
                onSelectRoom={handleSelectRoom}
              />
            )}
          </div>
          <div className={`chat-main ${isMobileListVisible && !activeRoomId ? 'chat-main--hidden-mobile' : ''}`}>
            {activeRoom ? (
              <ChatWindow
                key={activeRoom.id}
                room={activeRoom}
                onBack={handleBack}
                onRoomUpdated={(updatedRoom, action) => {
                  if (!updatedRoom) {
                    handleBack();
                    if (action === 'deleted') setRoomListVersion(v => v + 1);
                  } else {
                    setActiveRoom(updatedRoom);
                  }
                }}
              />
            ) : (
              <div className="chat-placeholder">
                <div className="chat-placeholder-icon">
                  {chatMode === 'messenger' ? '📘' : '💬'}
                </div>
                <div className="chat-placeholder-title">
                  {chatMode === 'messenger' ? 'Wähle eine Messenger-Konversation' : 'Wähle einen Chat'}
                </div>
                <div className="chat-placeholder-hint">
                  {chatMode === 'messenger'
                    ? 'Eingehende Facebook Messenger Nachrichten erscheinen hier.'
                    : 'Wähle links einen Chat aus oder starte eine neue Unterhaltung.'
                  }
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminChatPage;
