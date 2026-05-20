'use client'

import { useState } from 'react'

interface MessageInputProps {
  onSend: (content: string) => void
  disabled?: boolean
}

export function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const [content, setContent] = useState('')

  const handleSend = () => {
    const trimmed = content.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setContent('')
  }

  return (
    <div className="flex gap-2 p-4 border-t border-border">
      <input
        className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') handleSend()
        }}
        disabled={disabled}
      />
      <button
        className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
        onClick={handleSend}
        disabled={disabled || !content.trim()}
      >
        发送
      </button>
    </div>
  )
}
