'use client'

import { useState, useEffect, useCallback } from 'react'
import { RoleBar } from './role-bar'
import { MessageList } from './message-list'
import { MessageInput } from './message-input'
import type { DiscussionMessage } from '@/types'
import type { RoleInfo } from './role-bar'

interface DiscussionModuleProps {
  sessionId: string
}

export function DiscussionModule({ sessionId }: DiscussionModuleProps) {
  const [messages, setMessages] = useState<DiscussionMessage[]>([])
  const [roles, setRoles] = useState<RoleInfo[]>([])
  const [topic, setTopic] = useState('')
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`)
      const json = await res.json()
      if (json.success) {
        setTopic(json.data.topic)
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
        setError(json.error?.message ?? '发送失败，请重试')
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-bold text-text-primary mb-1">讨论</h1>
        <p className="text-text-secondary text-sm">会话 ID：{sessionId}</p>
        {topic && <p className="text-text-secondary text-sm mt-1">主题：{topic}</p>}
      </div>
      <RoleBar roles={roles} activeSpeakerId={activeSpeakerId} />
      <MessageList messages={messages} isLoading={isLoading} error={error} onRetry={loadMessages} />
      <MessageInput onSend={handleSend} disabled={isLoading} />
    </div>
  )
}
