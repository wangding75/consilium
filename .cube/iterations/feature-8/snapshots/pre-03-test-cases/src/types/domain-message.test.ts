import type { DiscussionMessage } from '@/types'

// Task-01：扩展 DiscussionMessage 类型（添加 pending 状态、clientMessageId 和回复关联 metadata）

it('DiscussionMessage status allows pending value', () => {
  const msg: DiscussionMessage = {
    messageId: 'msg-1',
    sessionId: 'sess-1',
    type: 'user',
    content: 'test',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  expect(msg.status).toBe('pending')
})

it('DiscussionMessage has optional clientMessageId field', () => {
  const msg: DiscussionMessage = {
    messageId: 'msg-2',
    sessionId: 'sess-1',
    type: 'user',
    content: 'test',
    status: 'completed',
    clientMessageId: 'client_123_abc',
    createdAt: new Date().toISOString(),
  }
  expect(msg.clientMessageId).toBe('client_123_abc')
})

it('DiscussionMessage metadata can carry replyToClientMessageId for agent reply association', () => {
  const msg: DiscussionMessage = {
    messageId: 'msg-3',
    sessionId: 'sess-1',
    type: 'character',
    roleId: 'zhuge-liang',
    content: 'agent reply',
    status: 'completed',
    createdAt: new Date().toISOString(),
    metadata: { replyToClientMessageId: 'client_123_abc' },
  }
  expect(msg.metadata?.replyToClientMessageId).toBe('client_123_abc')
})

it('DiscussionMessage without clientMessageId compiles for non-user messages', () => {
  const msg: DiscussionMessage = {
    messageId: 'msg-4',
    sessionId: 'sess-1',
    type: 'character',
    roleId: 'zhuge-liang',
    content: 'agent message',
    status: 'completed',
    createdAt: new Date().toISOString(),
  }
  expect(msg.clientMessageId).toBeUndefined()
})
