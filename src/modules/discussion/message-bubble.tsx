'use client'

import type { DiscussionMessage } from '@/types'

interface MessageBubbleProps {
  msg: DiscussionMessage
  onRetry?: (clientMessageId: string) => void
}

export function MessageBubble({ msg, onRetry }: MessageBubbleProps) {
  const { type, content, status, clientMessageId } = msg

  const isLeft = type === 'host' || type === 'character'
  const isRight = type === 'user'
  const isCenter = type === 'system'

  const opacity = status === 'pending' ? 0.5 : 1

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isRight ? 'flex-end' : isCenter ? 'center' : 'flex-start',
        opacity,
      }}
    >
      <div>
        <span>{content}</span>
        {status === 'failed' && onRetry && clientMessageId && (
          <button onClick={() => onRetry(clientMessageId)}>重试</button>
        )}
      </div>
    </div>
  )
}
