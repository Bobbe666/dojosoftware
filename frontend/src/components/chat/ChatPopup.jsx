// =====================================================================================
// CHAT POPUP - In-App Toast-Benachrichtigung bei neuer Nachricht
// =====================================================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, X } from 'lucide-react';
import { useChatContext } from '../../context/ChatContext.jsx';

const ChatPopup = () => {
  const { popup, dismissPopup } = useChatContext();
  const navigate = useNavigate();

  if (!popup) return null;

  const handleClick = () => {
    dismissPopup();
    navigate(`/member/chat?room=${popup.roomId}`);
  };

  return (
    <div
      className="chat-popup"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
    >
      <div className="chat-popup-icon">
        <MessageCircle size={18} />
      </div>
      <div className="chat-popup-content">
        <div className="chat-popup-sender">{popup.senderName}</div>
        <div className="chat-popup-preview">{popup.preview}</div>
      </div>
      <button
        className="chat-popup-close"
        onClick={e => { e.stopPropagation(); dismissPopup(); }}
        aria-label="Schließen"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default ChatPopup;
