import { describe, it, expect, beforeEach } from 'vitest'
import { MockMessageRepository } from './mock-message.repository'
import type { DiscussionMessage } from '@/types'

function makeMsg(overrides?: Partial<DiscussionMessage>): DiscussionMessage {
  return {
    messageId: `msg-${Math.random().toString(36).slice(2)}`,
    sessionId: 'sess-1',
    type: 'user',
    content: '测试消息',
    status: 'completed',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// Task-04：实现 MockMessageRepository 的新方法、排序和回复关联
describe('MockMessageRepository — Task-04 new methods', () => {
  let repo: MockMessageRepository

  beforeEach(() => {
    repo = new MockMessageRepository()
  })

  it('findBySessionId returns messages sorted by createdAt ascending', async () => {
    await repo.save(makeMsg({
      messageId: 'msg-early',
      sessionId: 'sess-1',
      createdAt: '2026-01-01T00:00:00.000Z',
    }))
    await repo.save(makeMsg({
      messageId: 'msg-late',
      sessionId: 'sess-1',
      createdAt: '2026-01-02T00:00:00.000Z',
    }))
    await repo.save(makeMsg({
      messageId: 'msg-mid',
      sessionId: 'sess-1',
      createdAt: '2026-01-01T12:00:00.000Z',
    }))
    const results = await repo.findBySessionId('sess-1')
    expect(results[0].messageId).toBe('msg-early')
    expect(results[1].messageId).toBe('msg-mid')
    expect(results[2].messageId).toBe('msg-late')
  })

  it('findByClientMessageId returns user message with matching clientMessageId', async () => {
    await repo.save(makeMsg({
      messageId: 'msg-u1',
      sessionId: 'sess-1',
      clientMessageId: 'client_100_abc',
      type: 'user',
    }))
    const found = await repo.findByClientMessageId('client_100_abc', 'sess-1')
    expect(found).not.toBeNull()
    expect(found!.messageId).toBe('msg-u1')
  })

  it('findByClientMessageId returns null when no matching clientMessageId', async () => {
    const found = await repo.findByClientMessageId('client_nonexistent', 'sess-1')
    expect(found).toBeNull()
  })

  it('findByClientMessageId is scoped to sessionId', async () => {
    await repo.save(makeMsg({
      messageId: 'msg-u1',
      sessionId: 'sess-1',
      clientMessageId: 'client_shared',
    }))
    await repo.save(makeMsg({
      messageId: 'msg-u2',
      sessionId: 'sess-2',
      clientMessageId: 'client_shared',
    }))
    const found = await repo.findByClientMessageId('client_shared', 'sess-1')
    expect(found!.messageId).toBe('msg-u1')
  })

  it('findRepliesByClientMessageId returns agent messages with replyToClientMessageId', async () => {
    await repo.save(makeMsg({
      messageId: 'msg-user',
      sessionId: 'sess-1',
      clientMessageId: 'client_200',
      type: 'user',
    }))
    await repo.save(makeMsg({
      messageId: 'msg-agent-1',
      sessionId: 'sess-1',
      type: 'character',
      roleId: 'zhuge-liang',
      content: 'agent reply 1',
      metadata: { replyToClientMessageId: 'client_200' },
    }))
    await repo.save(makeMsg({
      messageId: 'msg-agent-2',
      sessionId: 'sess-1',
      type: 'character',
      roleId: 'simayi',
      content: 'agent reply 2',
      metadata: { replyToClientMessageId: 'client_200' },
    }))
    await repo.save(makeMsg({
      messageId: 'msg-agent-3',
      sessionId: 'sess-1',
      type: 'character',
      roleId: 'caocao',
      content: 'unrelated reply',
      metadata: { replyToClientMessageId: 'client_other' },
    }))
    const replies = await repo.findRepliesByClientMessageId('sess-1', 'client_200')
    expect(replies).toHaveLength(2)
    expect(replies.every(r => r.metadata?.replyToClientMessageId === 'client_200')).toBe(true)
  })

  it('findRepliesByClientMessageId returns empty array when no matching replies', async () => {
    const replies = await repo.findRepliesByClientMessageId('sess-1', 'client_nonexistent')
    expect(replies).toEqual([])
  })

  it('findRepliesByClientMessageId returns all matches without pagination', async () => {
    for (let i = 0; i < 5; i++) {
      await repo.save(makeMsg({
        messageId: `msg-agent-${i}`,
        sessionId: 'sess-1',
        type: 'character',
        roleId: `role-${i}`,
        content: `reply ${i}`,
        metadata: { replyToClientMessageId: 'client_300' },
      }))
    }
    const replies = await repo.findRepliesByClientMessageId('sess-1', 'client_300')
    expect(replies).toHaveLength(5)
  })

  it('updateStatus changes the status of an existing message', async () => {
    await repo.save(makeMsg({ messageId: 'msg-u1', status: 'pending' }))
    await repo.updateStatus('msg-u1', 'completed')
    const messages = await repo.findBySessionId('sess-1')
    const msg = messages.find(m => m.messageId === 'msg-u1')
    expect(msg?.status).toBe('completed')
  })

  it('updateStatus on non-existent message does not throw', async () => {
    await expect(repo.updateStatus('msg-nonexistent', 'completed')).resolves.toBeUndefined()
  })

  it('findBySessionId with before cursor returns messages before the given messageId', async () => {
    await repo.save(makeMsg({
      messageId: 'msg-a',
      sessionId: 'sess-1',
      createdAt: '2026-01-01T00:00:00.000Z',
    }))
    await repo.save(makeMsg({
      messageId: 'msg-b',
      sessionId: 'sess-1',
      createdAt: '2026-01-02T00:00:00.000Z',
    }))
    await repo.save(makeMsg({
      messageId: 'msg-c',
      sessionId: 'sess-1',
      createdAt: '2026-01-03T00:00:00.000Z',
    }))
    const results = await repo.findBySessionId('sess-1', { limit: 50, before: 'msg-c' })
    expect(results).toHaveLength(2)
    expect(results.every(m => m.messageId !== 'msg-c')).toBe(true)
  })

  it('findBySessionId with non-existent before cursor returns empty array', async () => {
    await repo.save(makeMsg({ messageId: 'msg-a', sessionId: 'sess-1' }))
    const results = await repo.findBySessionId('sess-1', { limit: 50, before: 'msg-nonexistent' })
    expect(results).toEqual([])
  })

  it('save updates clientIdIndex when message has clientMessageId', async () => {
    await repo.save(makeMsg({
      messageId: 'msg-u1',
      sessionId: 'sess-1',
      clientMessageId: 'client_400',
    }))
    const found = await repo.findByClientMessageId('client_400', 'sess-1')
    expect(found).not.toBeNull()
    expect(found!.messageId).toBe('msg-u1')
  })

  it('save with same messageId but different clientMessageId updates index', async () => {
    await repo.save(makeMsg({
      messageId: 'msg-u1',
      sessionId: 'sess-1',
      clientMessageId: 'client_old',
    }))
    await repo.save(makeMsg({
      messageId: 'msg-u1',
      sessionId: 'sess-1',
      clientMessageId: 'client_new',
    }))
    const old = await repo.findByClientMessageId('client_old', 'sess-1')
    expect(old).toBeNull()
    const updated = await repo.findByClientMessageId('client_new', 'sess-1')
    expect(updated).not.toBeNull()
  })
})
