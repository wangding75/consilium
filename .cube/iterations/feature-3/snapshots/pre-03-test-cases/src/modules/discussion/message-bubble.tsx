'use client'

import type { DiscussionMessage } from '@/types'

interface MessageBubbleProps {
  msg: DiscussionMessage
  onRetry?: (clientMessageId: string) => void
}

export function MessageBubble({ msg: _msg, onRetry: _onRetry }: MessageBubbleProps) {
  throw new Error('not implemented')
}
