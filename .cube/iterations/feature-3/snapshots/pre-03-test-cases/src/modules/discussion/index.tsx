'use client'

import { useState, useEffect, useCallback } from 'react'
import { DiscussionProvider } from '@/store/discussion.store'
import { DiscussionHeader } from './discussion-header'
import { RoleBar } from './role-bar'
import { MessageList } from './message-list'
import { MessageInput } from './message-input'
import { MoreSheet } from './more-sheet'
import type { DiscussionMessage } from '@/types'
import type { ApiError } from '@/types/api'
import type { RoleInfo } from './role-bar'

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
  const [messages, setMessages] = useState<DiscussionMessage[]>([])
  const [roles, setRoles] = useState<RoleInfo[]>([])
  const [topic, setTopic] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [isMoreOpen, setIsMoreOpen] = useState(false)

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`)
      const json = await res.json()
      if (json.success) {
        setTopic(json.data.topic)
        setTemplateName(json.data.template?.name ?? '')
        setRoles(json.data.roles)
        setActiveSpeakerId(json.data.activeSpeakerId)
      }
    } catch {
      // ignore
    }
  }, [sessionId])

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/discussions/${sessionId}/messages?limit=50`)
      const json = await res.json()
      if (json.success) {
        setMessages(json.data.messages)
        setActiveSpeakerId(json.data.activeSpeakerId)
      }
    } catch {
      // ignore
    }
  }, [sessionId])

  useEffect(() => {
    loadSession()
    loadMessages()
  }, [loadSession, loadMessages])

  const handleSend = async (content: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/discussions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const json = await res.json()
      if (json.success) {
        const newMsgs: DiscussionMessage[] = []
        if (json.data.userMessage) newMsgs.push(json.data.userMessage)
        newMsgs.push(...json.data.agentMessages)
        setMessages((prev) => [...prev, ...newMsgs])
        setActiveSpeakerId(json.data.activeSpeakerId)
      } else {
        setError(json.error ?? { code: 'SEND_FAILED', message: '发送失败，请重试' })
      }
    } catch {
      setError({ code: 'NETWORK_ERROR', message: '网络错误，请重试' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <DiscussionHeader
        topic={topic || `会话 ID：${sessionId}`}
        templateName={templateName}
        onBack={() => {
          window.location.href = '/'
        }}
        onMore={() => setIsMoreOpen(true)}
      />
      <RoleBar roles={roles} activeSpeakerId={activeSpeakerId} />
      <MessageList messages={messages} isLoading={isLoading} error={error} onRetry={loadMessages} />
      <MessageInput onSend={handleSend} disabled={isLoading} />
      <MoreSheet isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} />
    </div>
  )
}
