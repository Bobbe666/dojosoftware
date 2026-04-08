// =====================================================================================
// CHAT MESSAGE - Einzelne Nachricht mit Reaktionen
// =====================================================================================

import React, { useState } from 'react';
import { useChatContext } from '../../context/ChatContext.jsx';

const EMOJIS = ['🥋', '🤜', '🏆', '🎯', '💪', '⚡'];

const ChatMessage = ({ message, onReact }) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const { sendReaction } = useChatContext();

  const handleReact = (emoji) => {
    sendReaction(message.id, emoji);
    if (onReact) onReact(message.id, emoji);
    setShowEmojiPicker(false);
  };

  const isToday = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    return `${date} ${time}`;
  };

  const isPushRef = message.message_type === 'push_ref';
  const isDeleted = !!message.deleted_at;

  return (
    <div
      className={`chat-message ${message.is_own ? 'chat-message--own' : 'chat-message--other'} ${isPushRef ? 'chat-message--push' : ''}`}
      onMouseEnter={() => !isDeleted && setShowEmojiPicker(false)}
    >
      {/* Absender-Name (nur bei fremden Nachrichten) */}
      {!message.is_own && !isPushRef && (
        <div className="chat-message-sender">{message.sender_name}</div>
      )}

      {/* Nachrichten-Bubble */}
      <div className="chat-message-bubble-wrap">
        <div
          className="chat-message-bubble"
          onDoubleClick={() => !isDeleted && setShowEmojiPicker(v => !v)}
        >
          {isPushRef ? (
            // Ankündigung-Karte
            <div className="chat-message-announcement">
              <span className="chat-message-announcement-icon">📣</span>
              <div className="chat-message-announcement-text">
                {message.content.replace(/^📣 \*\*/, '').replace(/\*\*\n\n/, '\n\n')}
              </div>
            </div>
          ) : isDeleted ? (
            <span className="chat-message-deleted">[Nachricht gelöscht]</span>
          ) : (
            <span className="chat-message-text">{message.content}</span>
          )}
          <span className={`chat-message-time${isToday(message.sent_at) ? ' chat-message-time--today' : ''}`}>
            {formatTime(message.sent_at)}
          </span>
        </div>

        {/* Emoji-Picker (bei Hover/Doppelklick) */}
        {showEmojiPicker && !isDeleted && (
          <div className={`chat-emoji-picker ${message.is_own ? 'chat-emoji-picker--left' : 'chat-emoji-picker--right'}`}>
            {EMOJIS.map(emoji => (
              <button
                key={emoji}
                className="chat-emoji-btn"
                onClick={() => handleReact(emoji)}
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Reaktionen */}
      {message.reactions && message.reactions.length > 0 && (
        <div className={`chat-reactions ${message.is_own ? 'chat-reactions--own' : ''}`}>
          {message.reactions.map(r => (
            <button
              key={r.emoji}
              className="chat-reaction-bubble"
              onClick={() => handleReact(r.emoji)}
              title={`${r.count} Reaktion${r.count !== 1 ? 'en' : ''}`}
            >
              {r.emoji} <span className="chat-reaction-count">{r.count}</span>
            </button>
          ))}
          <button
            className="chat-reaction-add-btn"
            onClick={() => setShowEmojiPicker(v => !v)}
            title="Reaktion hinzufügen"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
