'use client'

import { useEffect, useRef } from 'react'
import type { DiscussionMessage } from '@/types'
import type { ApiError } from '@/types/api'
import { MessageBubble } from './message-bubble'
import { TypingIndicator } from './typing-indicator'

interface MessageListProps {
  messages: DiscussionMessage[]
  isLoading: boolean
  error?: ApiError | null
  intentError?: ApiError | null
  typingSpeakerName?: string | null
  debugIntent?: boolean
  onRetry?: () => void
  onMessageRetry?: (clientMessageId: string) => void
  onRewriteCommand?: () => void
  onContinueAsPlainMessage?: () => void
}

export function MessageList({
  messages,
  isLoading,
  error,
  intentError,
  typingSpeakerName,
  debugIntent,
  onRetry,
  onMessageRetry,
  onRewriteCommand,
  onContinueAsPlainMessage,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const userScrolledUp = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      userScrolledUp.current = scrollHeight - scrollTop - clientHeight > 50
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!userScrolledUp.current && bottomRef.current) {
      try { bottomRef.current.scrollIntoView({ behavior: 'smooth' }) } catch { /* ignore in test env */ }
    }
  }, [messages, typingSpeakerName])

  return (
    <div ref={containerRef} className="flex flex-col gap-2 flex-1 overflow-y-auto p-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p>{error.message}</p>
          {onRetry && (
            <button className="mt-2 text-xs underline" onClick={onRetry}>
              重试
            </button>
          )}
        </div>
      )}
      {intentError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p>{intentError.message}</p>
          <div className="mt-2 flex gap-2 text-xs">
            {onRewriteCommand && <button className="underline" onClick={onRewriteCommand}>改写指令</button>}
            {onContinueAsPlainMessage && <button className="underline" onClick={onContinueAsPlainMessage}>按普通发言继续</button>}
          </div>
        </div>
      )}
      {isLoading && messages.length === 0 && <div className="text-sm text-text-secondary">加载中...</div>}
      {!isLoading && messages.length === 0 && !error && (
        <div className="text-sm text-text-secondary">暂无消息</div>
      )}
      {messages.map((message) => (
        <MessageBubble key={message.messageId} msg={message} onRetry={onMessageRetry} debugIntent={debugIntent} />
      ))}
      {typingSpeakerName !== undefined && typingSpeakerName !== null && (
        <TypingIndicator speakerName={typingSpeakerName} />
      )}
      <div ref={bottomRef} />
    </div>
  )
}
