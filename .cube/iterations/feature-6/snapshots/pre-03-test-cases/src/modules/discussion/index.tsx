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

  const canIntervene = session?.status === 'running'
  const intentError = state.intentErrorBySessionId?.[sessionId] ?? null

  const typingSpeakerName = isTyping
    ? typingSpeaker?.name ?? (activeSpeakerId ? null : null)
    : null

  useEffect(() => {
    actions.loadSession(sessionId)
    actions.loadMessages(sessionId)
  }, [sessionId, actions.loadSession, actions.loadMessages])

  if (error && !session) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4">
        <p className="text-sm text-red-500">会话不存在或加载失败</p>
        <button type="button" className="text-xs text-accent mt-2" onClick={() => window.location.href = '/'}>
          返回首页
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <DiscussionHeader
        topic={session?.topic || `会话 ID：${sessionId}`}
        templateName={session?.template?.name ?? ''}
        onBack={() => { window.location.href = '/' }}
        onMore={() => setIsMoreOpen(true)}
      />
      <RoleBar roles={roles} activeSpeakerId={activeSpeakerId} />
      {!canIntervene && session && (
        <div className="px-4 py-2 text-xs text-center text-muted-foreground bg-muted/50">
          当前会话不可继续操作或需要恢复
        </div>
      )}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        error={error}
        intentError={intentError}
        typingSpeakerName={typingSpeakerName}
        onRetry={() => actions.loadMessages(sessionId)}
        onMessageRetry={(clientMessageId) => actions.retryMessage(sessionId, clientMessageId)}
        onRewriteCommand={() => actions.fillComposer(sessionId, state.pendingCommandBySessionId?.[sessionId] ?? '')}
        onContinueAsPlainMessage={() => actions.continueAsPlainMessage(sessionId)}
      />
      <MessageInput
        onSend={(content) => actions.sendMessage(sessionId, content)}
        disabled={isLoading || !canIntervene}
      />
      <MoreSheet isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} canIntervene={canIntervene} />
    </div>
  )
}
