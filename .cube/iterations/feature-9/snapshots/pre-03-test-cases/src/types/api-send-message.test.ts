import type { ApiError, SendMessageParams, SendMessageResult, MessageListResult } from '@/types/api'

// Task-02：扩展 API 类型（SendMessageRequest / SendMessageResult / 消息列表参数）

it('SendMessageParams has optional clientMessageId field', () => {
  const params: SendMessageParams = { content: 'hello', clientMessageId: 'client_123_abc' }
  expect(params.clientMessageId).toBe('client_123_abc')
})

it('SendMessageParams works without clientMessageId', () => {
  const params: SendMessageParams = { content: 'hello' }
  expect(params.clientMessageId).toBeUndefined()
})

it('SendMessageResult has optional clientMessageId echo', () => {
  const result: SendMessageResult = {
    sessionId: 'sess-1',
    runId: 'run-1',
    clientMessageId: 'client_123_abc',
    userMessage: null,
    agentMessages: [],
    activeSpeakerId: null,
  }
  expect(result.clientMessageId).toBe('client_123_abc')
})

it('SendMessageResult works without clientMessageId', () => {
  const result: SendMessageResult = {
    sessionId: 'sess-1',
    runId: 'run-1',
    userMessage: null,
    agentMessages: [],
    activeSpeakerId: null,
  }
  expect(result.clientMessageId).toBeUndefined()
})

it('MessageListResult has hasMore boolean field', () => {
  const result: MessageListResult = {
    sessionId: 'sess-1',
    messages: [],
    activeSpeakerId: null,
    hasMore: false,
  }
  expect(result.hasMore).toBe(false)
})

it('ApiError has code and message fields', () => {
  const err: ApiError = { code: 'SESSION_NOT_FOUND', message: 'Session not found' }
  expect(err.code).toBe('SESSION_NOT_FOUND')
  expect(err.message).toBe('Session not found')
})
