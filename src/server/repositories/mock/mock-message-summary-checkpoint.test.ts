import { describe, it, expect, beforeEach } from 'vitest'
import { MockMessageRepository } from './mock-message.repository'
import type { DiscussionMessage } from '@/types'

function makeMessage(overrides: Partial<DiscussionMessage> = {}): DiscussionMessage {
  return {
    messageId: 'msg-1',
    sessionId: 'sess-1',
    type: 'host',
    content: '测试消息',
    status: 'completed',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('MockMessageRepository summary checkpoint and invitation metadata', () => {
  let repo: MockMessageRepository

  beforeEach(() => {
    repo = new MockMessageRepository()
  })

  describe('findById', () => {
    it('returns null for non-existent messageId', async () => {
      const result = await repo.findById('nonexistent')
      expect(result).toBeNull()
    })

    it('returns message by messageId', async () => {
      await repo.save(makeMessage({ messageId: 'msg-1' }))
      const result = await repo.findById('msg-1')
      expect(result).not.toBeNull()
      expect(result!.messageId).toBe('msg-1')
    })

    it('finds summary checkpoint message by id', async () => {
      await repo.save(makeMessage({
        messageId: 'msg-summary',
        metadata: {
          hostMessageKind: 'final_summary',
          summary: {
            summaryId: 'sum-1',
            sessionId: 'sess-1',
            messageId: 'msg-summary',
            consensus: ['一致'],
            disagreements: [],
            recommendations: [],
            nextSteps: [],
            checkpointCreatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      }))
      const result = await repo.findById('msg-summary')
      expect(result).not.toBeNull()
      expect(result!.metadata?.summary?.summaryId).toBe('sum-1')
    })
  })

  describe('updateMetadata', () => {
    it('returns null for non-existent messageId', async () => {
      const result = await repo.updateMetadata('nonexistent', { hostMessageKind: 'opening' })
      expect(result).toBeNull()
    })

    it('merges new metadata with existing metadata without clearing', async () => {
      await repo.save(makeMessage({
        messageId: 'msg-1',
        metadata: { replyToClientMessageId: 'client-1', intentLabel: '指令' },
      }))
      const result = await repo.updateMetadata('msg-1', { hostMessageKind: 'invitation', invitationId: 'inv-1' })
      expect(result).not.toBeNull()
      expect(result!.metadata?.hostMessageKind).toBe('invitation')
      expect(result!.metadata?.invitationId).toBe('inv-1')
      expect(result!.metadata?.replyToClientMessageId).toBe('client-1')
      expect(result!.metadata?.intentLabel).toBe('指令')
    })

    it('preserves existing metadata fields when merging new fields', async () => {
      await repo.save(makeMessage({
        messageId: 'msg-2',
        metadata: { roundIndex: 3, isMock: true },
      }))
      await repo.updateMetadata('msg-2', { hostMessageKind: 'transition' })
      const result = await repo.findById('msg-2')
      expect(result!.metadata?.roundIndex).toBe(3)
      expect(result!.metadata?.isMock).toBe(true)
      expect(result!.metadata?.hostMessageKind).toBe('transition')
    })

    it('adds summary checkpoint metadata to message', async () => {
      await repo.save(makeMessage({ messageId: 'msg-summary' }))
      const summary = {
        summaryId: 'sum-1',
        sessionId: 'sess-1',
        messageId: 'msg-summary',
        consensus: ['c1'],
        disagreements: [],
        recommendations: [],
        nextSteps: [],
        checkpointCreatedAt: '2026-01-01T00:00:00.000Z',
      }
      await repo.updateMetadata('msg-summary', { hostMessageKind: 'final_summary', summary })
      const result = await repo.findById('msg-summary')
      expect(result!.metadata?.summary).toEqual(summary)
      expect(result!.metadata?.hostMessageKind).toBe('final_summary')
    })

    it('preserves existing intent metadata when adding hostMessageKind', async () => {
      await repo.save(makeMessage({
        messageId: 'msg-3',
        metadata: {
          intent: { type: 'command', confidence: 0.9, rawText: '反驳', execution: { status: 'immediate' } },
          intentLabel: '指令',
        },
      }))
      await repo.updateMetadata('msg-3', { hostMessageKind: 'opening' })
      const result = await repo.findById('msg-3')
      expect(result!.metadata?.intent).toBeDefined()
      expect(result!.metadata?.intentLabel).toBe('指令')
      expect(result!.metadata?.hostMessageKind).toBe('opening')
    })
  })
})
