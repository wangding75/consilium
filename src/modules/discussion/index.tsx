'use client'

import { useEffect, useState } from 'react'
import { DiscussionProvider, useDiscussionStore } from '@/store/discussion.store'
import { DiscussionHeader } from './discussion-header'
import { RoleBar } from './role-bar'
import { MessageList } from './message-list'
import { MessageInput } from './message-input'
import { MoreSheet } from './more-sheet'

interface DiscussionModuleProps {
  sessionId: string
}

export function DiscussionModule({ sessionId }: DiscussionModuleProps) {
  return (
    <DiscussionProvider>
      <DiscussionModuleInner sessionId={sessionId} />
    </DiscussionProvider>
  )
}

function DiscussionModuleInner({ sessionId }: DiscussionModuleProps) {
  const { state, actions } = useDiscussionStore()
  const [isMoreOpen, setIsMoreOpen] = useState(false)

  const session = state.sessions[sessionId]
  const messages = state.messagesBySessionId[sessionId] ?? []
  const activeSpeakerId = state.activeSpeakerBySessionId[sessionId] ?? null
  const isLoading = state.loadingBySessionId[sessionId] ?? false
  const error = state.errorBySessionId[sessionId] ?? null
  const isTyping = state.typingBySessionId[sessionId] ?? false
  const typingSpeaker = state.typingSpeakerBySessionId[sessionId] ?? null
  const roles = session?.roles ?? []

  const typingSpeakerName = isTyping
    ? typingSpeaker?.name ?? (activeSpeakerId ? null : null)
    : null

  useEffect(() => {
    actions.loadSession(sessionId)
    actions.loadMessages(sessionId)
  }, [sessionId, actions.loadSession, actions.loadMessages])

  return (
    <div className="flex flex-col h-full">
      <DiscussionHeader
        topic={session?.topic || `会话 ID：${sessionId}`}
        templateName={session?.template?.name ?? ''}
        onBack={() => { window.location.href = '/' }}
        onMore={() => setIsMoreOpen(true)}
      />
      <RoleBar roles={roles} activeSpeakerId={activeSpeakerId} />
      <MessageList
        messages={messages}
        isLoading={isLoading}
        error={error}
        typingSpeakerName={typingSpeakerName}
        onRetry={() => actions.loadMessages(sessionId)}
        onMessageRetry={(clientMessageId) => actions.retryMessage(sessionId, clientMessageId)}
      />
      <MessageInput
        onSend={(content) => actions.sendMessage(sessionId, content)}
        disabled={isLoading}
      />
      <MoreSheet isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} />
    </div>
  )
}
