'use client'

import type { DiscussionMessage } from '@/types'

interface MessageBubbleProps {
  msg: DiscussionMessage
  onRetry?: (clientMessageId: string) => void
  debugIntent?: boolean
}

export function MessageBubble({ msg, onRetry, debugIntent }: MessageBubbleProps) {
  const { type, content, status, clientMessageId, metadata } = msg

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
        {metadata?.intentLabel && <span>{metadata.intentLabel}</span>}
        <span>{content}</span>
        {debugIntent && metadata?.intent?.debugSummary && (
          <span style={{ fontSize: '0.7em', color: '#888', display: 'block' }}>
            classifierMode: {metadata.intent.debugSummary.classifierMode}, matchedRule: {metadata.intent.debugSummary.matchedRule}
          </span>
        )}
        {status === 'failed' && onRetry && clientMessageId && (
          <button onClick={() => onRetry(clientMessageId)}>重试</button>
        )}
      </div>
    </div>
  )
}
