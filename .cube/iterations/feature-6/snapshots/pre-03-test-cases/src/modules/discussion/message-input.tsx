'use client'

import { useState, useEffect, useRef } from 'react'

interface MessageInputProps {
  onSend: (content: string) => void
  disabled?: boolean
  isRecognizingIntent?: boolean
  draftContent?: string | null
  onDraftConsumed?: () => void
  invitationPrompt?: string | null
  invitationMode?: boolean
}

export function MessageInput({
  onSend,
  disabled = false,
  isRecognizingIntent = false,
  draftContent,
  onDraftConsumed,
  invitationPrompt: _invitationPrompt,
  invitationMode: _invitationMode = false,
}: MessageInputProps) {
  const [content, setContent] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (draftContent) {
      setContent(draftContent)
      inputRef.current?.focus()
      onDraftConsumed?.()
    }
  }, [draftContent, onDraftConsumed])

  const handleSend = () => {
    const trimmed = content.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setContent('')
  }

  return (
    <div className="flex gap-2 p-4 border-t border-border">
      <button type="button" className="text-sm text-muted-foreground" disabled={disabled} aria-label="@" onClick={() => { setContent('@'); }}>@</button>
      <button type="button" className="text-sm text-muted-foreground" disabled={disabled} aria-label="#" onClick={() => { setContent('#'); }}>#</button>
      <button type="button" className="text-sm text-muted-foreground" disabled={disabled} aria-label="总结" onClick={() => { setContent('总结当前结论'); }}>总结</button>
      <input
        ref={inputRef}
        className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') handleSend()
        }}
        disabled={disabled || isRecognizingIntent}
      />
      <button
        className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
        onClick={handleSend}
        disabled={disabled || isRecognizingIntent || !content.trim()}
      >
        {isRecognizingIntent ? '解析中...' : '发送'}
      </button>
    </div>
  )
}
