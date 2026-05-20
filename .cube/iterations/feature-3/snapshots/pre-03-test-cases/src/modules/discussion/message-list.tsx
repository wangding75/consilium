'use client'

import type { DiscussionMessage } from '@/types'
import type { ApiError } from '@/types/api'

interface MessageListProps {
  messages: DiscussionMessage[]
  isLoading: boolean
  error?: ApiError | null
  typingSpeakerName?: string | null
  onRetry?: () => void
  onMessageRetry?: (clientMessageId: string) => void
}

export function MessageList({
  messages,
  isLoading,
  error,
  typingSpeakerName,
  onRetry,
  onMessageRetry: _onMessageRetry,
}: MessageListProps) {
  return (
    <div className="flex flex-col gap-2 flex-1 overflow-y-auto p-4">
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
      {isLoading && messages.length === 0 && <div className="text-sm text-text-secondary">加载中...</div>}
      {!isLoading && messages.length === 0 && !error && (
        <div className="text-sm text-text-secondary">暂无消息</div>
      )}
      {messages.map((message) => (
        <div
          key={message.messageId}
          className={message.type === 'user' ? 'self-end rounded-lg bg-primary px-3 py-2 text-white' : 'self-start rounded-lg bg-surface px-3 py-2 text-text-primary'}
        >
          {message.content}
        </div>
      ))}
      {typingSpeakerName && <div className="text-sm text-text-secondary">{typingSpeakerName}正在输入...</div>}
    </div>
  )
}
