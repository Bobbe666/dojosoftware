import React, { useState, useRef } from 'react'

export default function MessageInput({ onSend, disabled, placeholder }) {
  const [text, setText] = useState('')
  const textareaRef = useRef(null)

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e) => {
    // Enter ohne Shift = senden
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e) => {
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    setText(el.value)
  }

  return (
    <div className="msg-input-bar">
      <textarea
        ref={textareaRef}
        className="msg-input-field"
        placeholder={placeholder || 'Nachricht schreiben…'}
        value={text}
        onInput={handleInput}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        disabled={disabled}
      />
      <button
        className={`msg-send-btn${text.trim() ? ' msg-send-btn--active' : ''}`}
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        aria-label="Senden"
      >
        ➤
      </button>
    </div>
  )
}
