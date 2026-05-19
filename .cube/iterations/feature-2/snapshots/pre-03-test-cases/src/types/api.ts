import type { DiscussionMessage } from '@/types'

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export type ApiResponse<T> =
  | { success: true; data: T; error?: never; requestId: string }
  | { success: false; data: null; error: ApiError; requestId: string }

export interface CreateSessionParams {
  topic: string
  templateId: string
  modelStrategyId?: string
}

export interface CreateSessionResult {
  sessionId: string
  topic: string
  template: { id: string; name: string }
  status: 'active'
  createdAt: number
}

// Iteration 2: discussion API types
export interface SessionDetailResult {
  sessionId: string
  topic: string
  template: { templateId: string; name: string }
  status: 'active' | 'completed' | 'archived'
  roles: Array<{
    roleId: string
    name: string
    agentType: 'host' | 'expert' | 'critic'
    avatar: string
    model: string
  }>
  activeSpeakerId: string | null
  createdAt: string
  updatedAt: string
}

export interface MessageListResult {
  sessionId: string
  messages: DiscussionMessage[]
  activeSpeakerId: string | null
  hasMore: boolean
}

export interface SendMessageParams {
  content: string
  clientMessageId?: string
}

export interface SendMessageResult {
  sessionId: string
  runId: string
  userMessage: DiscussionMessage | null
  agentMessages: DiscussionMessage[]
  activeSpeakerId: string | null
}
