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

describe('MockMessageRepository', () => {
  let repo: MockMessageRepository

  beforeEach(() => {
    repo = new MockMessageRepository()
  })

  it('saves a message and returns it with the same messageId', async () => {
    const msg = makeMsg({ messageId: 'msg-abc' })
    const saved = await repo.save(msg)
    expect(saved.messageId).toBe('msg-abc')
    expect(saved.content).toBe('测试消息')
  })

  it('findBySessionId returns messages for the given session', async () => {
    await repo.save(makeMsg({ messageId: 'msg-1', sessionId: 'sess-1' }))
    await repo.save(makeMsg({ messageId: 'msg-2', sessionId: 'sess-2' }))
    const results = await repo.findBySessionId('sess-1')
    expect(results).toHaveLength(1)
    expect(results[0].messageId).toBe('msg-1')
  })

  it('countBySessionId returns correct count', async () => {
    await repo.save(makeMsg({ sessionId: 'sess-1' }))
    await repo.save(makeMsg({ sessionId: 'sess-1' }))
    await repo.save(makeMsg({ sessionId: 'sess-2' }))
    const count = await repo.countBySessionId('sess-1')
    expect(count).toBe(2)
  })

  it('findBySessionId respects limit option', async () => {
    for (let i = 0; i < 5; i++) {
      await repo.save(makeMsg({ messageId: `msg-${i}`, sessionId: 'sess-1' }))
    }
    const results = await repo.findBySessionId('sess-1', { limit: 3 })
    expect(results.length).toBeLessThanOrEqual(3)
  })

  it('findBySessionId returns empty array when no messages exist', async () => {
    const results = await repo.findBySessionId('sess-nonexistent')
    expect(results).toEqual([])
  })

  it('multiple saves to same messageId replaces the message', async () => {
    await repo.save(makeMsg({ messageId: 'msg-dup', content: '原始内容' }))
    await repo.save(makeMsg({ messageId: 'msg-dup', content: '更新内容' }))
    const results = await repo.findBySessionId('sess-1')
    const found = results.find((m) => m.messageId === 'msg-dup')
    expect(found?.content).toBe('更新内容')
  })
})
