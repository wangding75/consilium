'use client'

import { createContext, createElement, useContext, useReducer, useRef, type ReactNode } from 'react'
import type { DiscussionMessage } from '@/types'
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
}

export interface DiscussionActions {
  loadSession(sessionId: string): Promise<void>
  loadMessages(sessionId: string, opts?: { before?: string }): Promise<void>
  sendMessage(sessionId: string, content: string): Promise<void>
  retryMessage(sessionId: string, clientMessageId: string): Promise<void>
  clearError(sessionId: string): void
}

export function generateClientMessageId(): string {
  throw new Error('not implemented')
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

export function discussionReducer(
  state: DiscussionStoreState,
  action: DiscussionAction
): DiscussionStoreState {
  throw new Error('not implemented')
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
  const [state] = useReducer(discussionReducer, initialState)
  useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const actions: DiscussionActions = {
    loadSession: async () => {
      throw new Error('not implemented')
    },
    loadMessages: async () => {
      throw new Error('not implemented')
    },
    sendMessage: async () => {
      throw new Error('not implemented')
    },
    retryMessage: async () => {
      throw new Error('not implemented')
    },
    clearError: () => {
      throw new Error('not implemented')
    },
  }

  return createElement(DiscussionContext.Provider, { value: { state, actions } }, children)
}

export function useDiscussionStore(): DiscussionContextValue {
  const ctx = useContext(DiscussionContext)
  if (!ctx) throw new Error('useDiscussionStore must be used within DiscussionProvider')
  return ctx
}
