'use client'

import type { DiscussionMessage } from '@/types'

interface MessageListProps {
  messages: DiscussionMessage[]
  isLoading: boolean
  error?: string | null
  onRetry?: () => void
}

export function MessageList({
  messages: _messages,
  isLoading: _isLoading,
  error: _error,
  onRetry: _onRetry,
}: MessageListProps) {
  return <div className="flex flex-col gap-2 flex-1 overflow-y-auto p-4" />
}
