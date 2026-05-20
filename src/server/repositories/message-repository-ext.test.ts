import type { MessageRepository } from './message.repository'
import { MockMessageRepository } from './mock/mock-message.repository'

// Task-03：扩展 MessageRepository 接口（添加 findByClientMessageId 和 updateStatus 方法）
// These tests verify the interface contract - the new methods exist and return correct types

it('MessageRepository interface has findByClientMessageId method', async () => {
  const repo: MessageRepository = new MockMessageRepository()
  const result = await repo.findByClientMessageId('client_test', 'sess-1')
  // Should return null when not found (not throw)
  expect(result).toBeNull()
})

it('MessageRepository interface has findRepliesByClientMessageId method', async () => {
  const repo: MessageRepository = new MockMessageRepository()
  const result = await repo.findRepliesByClientMessageId('sess-1', 'client_test')
  // Should return empty array (not throw)
  expect(result).toEqual([])
})

it('MessageRepository interface has updateStatus method', async () => {
  const repo: MessageRepository = new MockMessageRepository()
  // Should not throw on non-existent message
  await expect(repo.updateStatus('msg-nonexistent', 'completed')).resolves.toBeUndefined()
})

it('findByClientMessageId returns DiscussionMessage when found', async () => {
  const repo = new MockMessageRepository()
  await repo.save({
    messageId: 'msg-1',
    sessionId: 'sess-1',
    type: 'user',
    content: 'test',
    status: 'completed',
    clientMessageId: 'client_found',
    createdAt: new Date().toISOString(),
  })
  const result = await repo.findByClientMessageId('client_found', 'sess-1')
  expect(result).not.toBeNull()
  expect(result!.clientMessageId).toBe('client_found')
})

it('findRepliesByClientMessageId returns matching agent messages', async () => {
  const repo = new MockMessageRepository()
  await repo.save({
    messageId: 'msg-agent',
    sessionId: 'sess-1',
    type: 'character',
    roleId: 'zhuge-liang',
    content: 'reply',
    status: 'completed',
    createdAt: new Date().toISOString(),
    metadata: { replyToClientMessageId: 'client_reply' },
  })
  const result = await repo.findRepliesByClientMessageId('sess-1', 'client_reply')
  expect(result).toHaveLength(1)
  expect(result[0].metadata?.replyToClientMessageId).toBe('client_reply')
})

it('updateStatus changes message status from pending to completed', async () => {
  const repo = new MockMessageRepository()
  await repo.save({
    messageId: 'msg-status',
    sessionId: 'sess-1',
    type: 'user',
    content: 'test',
    status: 'pending',
    createdAt: new Date().toISOString(),
  })
  await repo.updateStatus('msg-status', 'completed')
  const messages = await repo.findBySessionId('sess-1')
  const msg = messages.find(m => m.messageId === 'msg-status')
  expect(msg?.status).toBe('completed')
})

it('findByClientMessageId is scoped to sessionId', async () => {
  const repo = new MockMessageRepository()
  await repo.save({
    messageId: 'msg-s1',
    sessionId: 'sess-1',
    type: 'user',
    content: 'test',
    status: 'completed',
    clientMessageId: 'client_shared',
    createdAt: new Date().toISOString(),
  })
  await repo.save({
    messageId: 'msg-s2',
    sessionId: 'sess-2',
    type: 'user',
    content: 'test',
    status: 'completed',
    clientMessageId: 'client_shared',
    createdAt: new Date().toISOString(),
  })
  const result = await repo.findByClientMessageId('client_shared', 'sess-1')
  expect(result!.sessionId).toBe('sess-1')
})
