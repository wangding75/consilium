'use client'

import { createContext, createElement, useContext, useReducer, useRef, useCallback, type ReactNode } from 'react'
import type { DiscussionMessage, DiscussionSummary, IntentResult, Invitation } from '@/types'
import type { ApiError, SessionDetailResult } from '@/types/api'

export type SessionSummary = SessionDetailResult

export interface DiscussionStoreState {
  sessions: Record<string, SessionSummary>
  messagesBySessionId: Record<string, DiscussionMessage[]>
  activeSpeakerBySessionId: Record<string, string | null>
  loadingBySessionId: Record<string, boolean>
  sendingByClientMessageId: Record<string, 'pending' | 'completed' | 'failed'>
  typingBySessionId: Record<string, boolean>
  typingSpeakerBySessionId: Record<string, { roleId: string; name: string } | null>
  errorBySessionId: Record<string, ApiError | null>
  recognizingIntentBySessionId?: Record<string, boolean>
  intentErrorBySessionId?: Record<string, ApiError | null>
  pendingCommandBySessionId?: Record<string, string | null>
  pendingInvitationBySessionId?: Record<string, Invitation | null>
  summaryBySessionId?: Record<string, DiscussionSummary | null>
  directorErrorBySessionId?: Record<string, ApiError | null>
}

export interface DiscussionActions {
  loadSession(sessionId: string): Promise<void>
  loadMessages(sessionId: string, opts?: { before?: string }): Promise<void>
  sendMessage(sessionId: string, content: string): Promise<void>
  retryMessage(sessionId: string, clientMessageId: string): Promise<void>
  clearError(sessionId: string): void
  continueAsPlainMessage(sessionId: string): Promise<void>
  fillComposer(sessionId: string, content: string): void
  loadPendingInvitation(sessionId: string): Promise<void>
  respondInvitation(sessionId: string, invitationId: string, content: string): Promise<void>
  skipInvitation(sessionId: string, invitationId: string): Promise<void>
  requestSummary(sessionId: string): Promise<void>
  resumeAfterSummary(sessionId: string): Promise<void>
}

export function generateClientMessageId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let random = ''
  for (let i = 0; i < 6; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `client_${Date.now()}_${random}`
}

const initialState: DiscussionStoreState = {
  sessions: {},
  messagesBySessionId: {},
  activeSpeakerBySessionId: {},
  loadingBySessionId: {},
  sendingByClientMessageId: {},
  typingBySessionId: {},
  typingSpeakerBySessionId: {},
  errorBySessionId: {},
  recognizingIntentBySessionId: {},
  intentErrorBySessionId: {},
  pendingCommandBySessionId: {},
  pendingInvitationBySessionId: {},
  summaryBySessionId: {},
  directorErrorBySessionId: {},
}

export type DiscussionAction =
  | { type: 'SESSION_LOADED'; sessionId: string; session: SessionSummary }
  | { type: 'MESSAGES_LOADED'; sessionId: string; messages: DiscussionMessage[]; activeSpeakerId: string | null }
  | { type: 'LOADING_SET'; sessionId: string; loading: boolean }
  | { type: 'TYPING_SET'; sessionId: string; typing: boolean }
  | { type: 'ERROR_SET'; sessionId: string; error: ApiError | null }
  | { type: 'MESSAGE_OPTIMISTIC'; sessionId: string; message: DiscussionMessage }
  | { type: 'MESSAGE_SENT'; sessionId: string; clientMessageId: string; userMessage: DiscussionMessage | null; agentMessages: DiscussionMessage[]; activeSpeakerId: string | null }
  | { type: 'MESSAGE_FAILED'; sessionId: string; clientMessageId: string; error: ApiError }
  | { type: 'SENDING_STATUS'; clientMessageId: string; status: 'pending' | 'completed' | 'failed' }

function mergeMessages(
  existing: DiscussionMessage[],
  incoming: DiscussionMessage[]
): DiscussionMessage[] {
  const map = new Map<string, DiscussionMessage>()
  for (const m of existing) map.set(m.messageId, m)
  for (const m of incoming) {
    const key = m.clientMessageId && !map.has(m.messageId)
      ? Array.from(map.values()).find(e => e.clientMessageId === m.clientMessageId)?.messageId
      : m.messageId
    map.set(key ?? m.messageId, m)
  }
  return Array.from(map.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function discussionReducer(
  state: DiscussionStoreState,
  action: DiscussionAction
): DiscussionStoreState {
  switch (action.type) {
    case 'SESSION_LOADED':
      return {
        ...state,
        sessions: { ...state.sessions, [action.sessionId]: action.session },
        activeSpeakerBySessionId: { ...state.activeSpeakerBySessionId, [action.sessionId]: action.session.activeSpeakerId },
      }
    case 'MESSAGES_LOADED': {
      const current = state.messagesBySessionId[action.sessionId] ?? []
      const merged = mergeMessages(current, action.messages)
      return {
        ...state,
        messagesBySessionId: { ...state.messagesBySessionId, [action.sessionId]: merged },
        activeSpeakerBySessionId: { ...state.activeSpeakerBySessionId, [action.sessionId]: action.activeSpeakerId },
      }
    }
    case 'LOADING_SET':
      return { ...state, loadingBySessionId: { ...state.loadingBySessionId, [action.sessionId]: action.loading } }
    case 'TYPING_SET':
      return { ...state, typingBySessionId: { ...state.typingBySessionId, [action.sessionId]: action.typing } }
    case 'ERROR_SET':
      return { ...state, errorBySessionId: { ...state.errorBySessionId, [action.sessionId]: action.error } }
    case 'MESSAGE_OPTIMISTIC': {
      const current = state.messagesBySessionId[action.sessionId] ?? []
      return {
        ...state,
        messagesBySessionId: { ...state.messagesBySessionId, [action.sessionId]: [...current, action.message] },
      }
    }
    case 'MESSAGE_SENT': {
      const current = state.messagesBySessionId[action.sessionId] ?? []
      const incoming = [...(action.userMessage ? [action.userMessage] : []), ...(action.agentMessages ?? [])]
      const merged = mergeMessages(current, incoming)
      return {
        ...state,
        messagesBySessionId: { ...state.messagesBySessionId, [action.sessionId]: merged },
        typingBySessionId: { ...state.typingBySessionId, [action.sessionId]: false },
        typingSpeakerBySessionId: { ...state.typingSpeakerBySessionId, [action.sessionId]: null },
        activeSpeakerBySessionId: { ...state.activeSpeakerBySessionId, [action.sessionId]: action.activeSpeakerId },
        sendingByClientMessageId: { ...state.sendingByClientMessageId, [action.clientMessageId]: 'completed' },
      }
    }
    case 'MESSAGE_FAILED': {
      const current = state.messagesBySessionId[action.sessionId] ?? []
      const updated = current.map(m =>
        m.clientMessageId === action.clientMessageId ? { ...m, status: 'failed' as const } : m
      )
      return {
        ...state,
        messagesBySessionId: { ...state.messagesBySessionId, [action.sessionId]: updated },
        typingBySessionId: { ...state.typingBySessionId, [action.sessionId]: false },
        typingSpeakerBySessionId: { ...state.typingSpeakerBySessionId, [action.sessionId]: null },
        sendingByClientMessageId: { ...state.sendingByClientMessageId, [action.clientMessageId]: 'failed' },
        errorBySessionId: { ...state.errorBySessionId, [action.sessionId]: action.error },
      }
    }
    case 'SENDING_STATUS':
      return { ...state, sendingByClientMessageId: { ...state.sendingByClientMessageId, [action.clientMessageId]: action.status } }
    default:
      return state
  }
}

interface DiscussionContextValue {
  state: DiscussionStoreState
  actions: DiscussionActions
}

const DiscussionContext = createContext<DiscussionContextValue | null>(null)

interface DiscussionProviderProps {
  children: ReactNode
}

export function DiscussionProvider({ children }: DiscussionProviderProps) {
  const [state, dispatch] = useReducer(discussionReducer, initialState)
  const timeoutHandles = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const actions: DiscussionActions = {
    loadSession: useCallback(async (sessionId: string) => {
      dispatch({ type: 'LOADING_SET', sessionId, loading: true })
      dispatch({ type: 'ERROR_SET', sessionId, error: null })
      try {
        const res = await fetch(`/api/sessions/${sessionId}`)
        const json = await res.json()
        if (json.success) {
          dispatch({ type: 'SESSION_LOADED', sessionId, session: json.data })
        } else {
          dispatch({ type: 'ERROR_SET', sessionId, error: json.error })
        }
      } catch {
        dispatch({ type: 'ERROR_SET', sessionId, error: { code: 'NETWORK_ERROR', message: '网络错误' } })
      } finally {
        dispatch({ type: 'LOADING_SET', sessionId, loading: false })
      }
    }, []),

    loadMessages: useCallback(async (sessionId: string, opts?: { before?: string }) => {
      try {
        const params = new URLSearchParams({ limit: '50' })
        if (opts?.before) params.set('before', opts.before)
        const res = await fetch(`/api/discussions/${sessionId}/messages?${params}`)
        const json = await res.json()
        if (json.success) {
          dispatch({ type: 'MESSAGES_LOADED', sessionId, messages: json.data.messages, activeSpeakerId: json.data.activeSpeakerId })
        }
      } catch {
        // silently ignore
      }
    }, []),

    sendMessage: useCallback(async (sessionId: string, content: string) => {
      const clientMessageId = generateClientMessageId()
      const session = state.sessions[sessionId]
      const activeSpeakerId = state.activeSpeakerBySessionId[sessionId]
      let typingSpeaker: { roleId: string; name: string } | null = null
      if (activeSpeakerId && session) {
        const role = session.roles.find(r => r.roleId === activeSpeakerId)
        if (role) typingSpeaker = { roleId: role.roleId, name: role.name }
      }

      const optimisticMsg: DiscussionMessage = {
        messageId: `optimistic-${clientMessageId}`,
        sessionId,
        type: 'user',
        content,
        status: 'pending',
        clientMessageId,
        createdAt: new Date().toISOString(),
      }

      dispatch({ type: 'MESSAGE_OPTIMISTIC', sessionId, message: optimisticMsg })
      dispatch({ type: 'SENDING_STATUS', clientMessageId, status: 'pending' })
      dispatch({ type: 'TYPING_SET', sessionId, typing: true })

      // 10s timeout
      const handle = setTimeout(() => {
        if (state.sendingByClientMessageId[clientMessageId] === 'pending') {
          dispatch({ type: 'MESSAGE_FAILED', sessionId, clientMessageId, error: { code: 'TIMEOUT', message: '发送超时' } })
        }
        timeoutHandles.current.delete(clientMessageId)
      }, 10000)
      timeoutHandles.current.set(clientMessageId, handle)

      try {
        // Call Intent API first
        let intentResponse: { sessionId: string; clientMessageId?: string; activeSpeakerId: string | null; intent: IntentResult } | undefined
        try {
          const intentRes = await fetch(`/api/discussions/${sessionId}/intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, clientMessageId }),
          })
          const intentJson = await intentRes.json()
          if (intentJson.success) {
            intentResponse = intentJson.data
          }
        } catch {
          // Intent API failure is non-blocking; send message without intent
        }

        const res = await fetch(`/api/discussions/${sessionId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, clientMessageId, intentResponse }),
        })
        const json = await res.json()
        clearTimeout(handle)
        timeoutHandles.current.delete(clientMessageId)

        if (json.success) {
          dispatch({ type: 'MESSAGE_SENT', sessionId, clientMessageId, userMessage: json.data.userMessage, agentMessages: json.data.agentMessages, activeSpeakerId: json.data.activeSpeakerId })
        } else {
          dispatch({ type: 'MESSAGE_FAILED', sessionId, clientMessageId, error: json.error })
        }
      } catch {
        clearTimeout(handle)
        timeoutHandles.current.delete(clientMessageId)
        dispatch({ type: 'MESSAGE_FAILED', sessionId, clientMessageId, error: { code: 'NETWORK_ERROR', message: '网络错误' } })
      }
    }, [state.sessions, state.activeSpeakerBySessionId, state.sendingByClientMessageId]),

    retryMessage: useCallback(async (sessionId: string, clientMessageId: string) => {
      const session = state.sessions[sessionId]
      const activeSpeakerId = state.activeSpeakerBySessionId[sessionId]
      let typingSpeaker: { roleId: string; name: string } | null = null
      if (activeSpeakerId && session) {
        const role = session.roles.find(r => r.roleId === activeSpeakerId)
        if (role) typingSpeaker = { roleId: role.roleId, name: role.name }
      }

      // Reset the failed message to pending
      const current = state.messagesBySessionId[sessionId] ?? []
      const updated = current.map(m =>
        m.clientMessageId === clientMessageId ? { ...m, status: 'pending' as const } : m
      )
      dispatch({ type: 'MESSAGES_LOADED', sessionId, messages: updated, activeSpeakerId })
      dispatch({ type: 'SENDING_STATUS', clientMessageId, status: 'pending' })
      dispatch({ type: 'TYPING_SET', sessionId, typing: true })

      const handle = setTimeout(() => {
        if (state.sendingByClientMessageId[clientMessageId] === 'pending') {
          dispatch({ type: 'MESSAGE_FAILED', sessionId, clientMessageId, error: { code: 'TIMEOUT', message: '发送超时' } })
        }
        timeoutHandles.current.delete(clientMessageId)
      }, 10000)
      timeoutHandles.current.set(clientMessageId, handle)

      try {
        const failedMsg = current.find(m => m.clientMessageId === clientMessageId)
        const res = await fetch(`/api/discussions/${sessionId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: failedMsg?.content ?? '', clientMessageId }),
        })
        const json = await res.json()
        clearTimeout(handle)
        timeoutHandles.current.delete(clientMessageId)

        if (json.success) {
          dispatch({ type: 'MESSAGE_SENT', sessionId, clientMessageId, userMessage: json.data.userMessage, agentMessages: json.data.agentMessages, activeSpeakerId: json.data.activeSpeakerId })
        } else {
          dispatch({ type: 'MESSAGE_FAILED', sessionId, clientMessageId, error: json.error })
        }
      } catch {
        clearTimeout(handle)
        timeoutHandles.current.delete(clientMessageId)
        dispatch({ type: 'MESSAGE_FAILED', sessionId, clientMessageId, error: { code: 'NETWORK_ERROR', message: '网络错误' } })
      }
    }, [state.sessions, state.activeSpeakerBySessionId, state.sendingByClientMessageId, state.messagesBySessionId]),

    continueAsPlainMessage: useCallback(async (sessionId: string) => {
      const pending = state.pendingCommandBySessionId?.[sessionId]
      if (pending) {
        const clientMessageId = generateClientMessageId()
        try {
          const res = await fetch(`/api/discussions/${sessionId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: pending,
              clientMessageId,
              intentResponse: {
                sessionId,
                clientMessageId,
                activeSpeakerId: null,
                intent: { type: 'passive' as const, confidence: 1.0, rawText: pending, execution: { status: 'immediate' as const } },
              },
            }),
          })
          const json = await res.json()
          if (json.success) {
            dispatch({ type: 'MESSAGE_SENT', sessionId, clientMessageId, userMessage: json.data.userMessage, agentMessages: json.data.agentMessages, activeSpeakerId: json.data.activeSpeakerId })
          }
        } catch {
          // silently ignore
        }
      }
    }, [state.pendingCommandBySessionId]),

    fillComposer: useCallback((_sessionId: string, _content: string) => {
      // Composer fill is handled by draftContent prop wired to MessageInput
    }, []),



    loadPendingInvitation: useCallback(async (_sessionId: string) => {
      throw new Error('not implemented')
    }, []),

    respondInvitation: useCallback(async (_sessionId: string, _invitationId: string, _content: string) => {
      throw new Error('not implemented')
    }, []),

    skipInvitation: useCallback(async (_sessionId: string, _invitationId: string) => {
      throw new Error('not implemented')
    }, []),

    requestSummary: useCallback(async (_sessionId: string) => {
      throw new Error('not implemented')
    }, []),

    resumeAfterSummary: useCallback(async (_sessionId: string) => {
      throw new Error('not implemented')
    }, []),
    clearError: useCallback((sessionId: string) => {
      dispatch({ type: 'ERROR_SET', sessionId, error: null })
    }, []),
  }

  return createElement(DiscussionContext.Provider, { value: { state, actions } }, children)
}

export function useDiscussionStore(): DiscussionContextValue {
  const ctx = useContext(DiscussionContext)
  if (!ctx) throw new Error('useDiscussionStore must be used within DiscussionProvider')
  return ctx
}
