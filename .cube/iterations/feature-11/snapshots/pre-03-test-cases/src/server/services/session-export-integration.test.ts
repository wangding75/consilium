/**
 * Integration test: SessionExportService full cross-component chain
 *
 * Standard: standards/testing/integration.md
 * Exercises: SessionRepo → MessageRepo → EventRepo → VoteRepo → Markdown output
 * Verifies: data flow across all four repositories, markdown structure correctness
 */

import { describe, it, expect } from 'vitest'
import { SessionExportService } from '@/server/services/session-export.service'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockMessageRepository } from '@/server/repositories/mock/mock-message.repository'
import { MockEventRepository } from '@/server/repositories/mock/mock-event.repository'
import { MockVoteRepository } from '@/server/repositories/mock/mock-vote.repository'
import type { Session, DiscussionMessage, EventRecord, VoteRecord } from '@/types'

describe('SessionExportService integration: full component chain', () => {
  it('assembles complete markdown from all four repositories', async () => {
    const sessionRepo = new MockSessionRepository()
    const msgRepo = new MockMessageRepository()
    const eventRepo = new MockEventRepository()
    const voteRepo = new MockVoteRepository()

    // Arrange: seed data across all four repositories
    await sessionRepo.save({
      id: 'sess_int_001',
      templateId: 'tpl_001',
      topic: '战略规划讨论',
      status: 'completed',
      state: { stage: 'closing', turnCount: 8, lastSpeakerId: null },
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      templateSnapshot: {
        templateId: 'tpl_001', version: '1.0.0', name: '三国演义',
        overview: { worldview: '三国', userIdentity: '主公', applicableScenarios: ['战略'] },
        roles: [
          { roleId: 'r1', name: '诸葛亮', persona: '军师', isHost: true, agentType: 'host', systemPrompt: '你是诸葛亮', visible: true },
          { roleId: 'r2', name: '关羽', persona: '武将', isHost: false, agentType: 'expert', systemPrompt: '你是关羽', visible: true },
        ],
        events: [], rhythm: { maxTurnsPerStage: {}, minTurnsBeforeClimax: 3 },
        modelDefaults: { defaultModel: 'gpt-4o', temperature: 0.7, maxTokens: 512 },
        snapshotAt: '2026-06-04T00:00:00.000Z',
      },
    })

    await msgRepo.save({
      messageId: 'm1', sessionId: 'sess_int_001', type: 'host', roleId: 'r1',
      content: '各位，今天我们讨论北伐的战略方向。', status: 'completed',
      createdAt: '2026-06-04T06:00:00.000Z',
    })
    await msgRepo.save({
      messageId: 'm2', sessionId: 'sess_int_001', type: 'character', roleId: 'r2',
      content: '我认为应当先取长安。', status: 'completed',
      createdAt: '2026-06-04T06:01:00.000Z',
    })
    await msgRepo.save({
      messageId: 'm3', sessionId: 'sess_int_001', type: 'user',
      content: '大家的意见我都听到了。', status: 'completed',
      createdAt: '2026-06-04T06:05:00.000Z',
    })

    await eventRepo.save({
      eventId: 'evt_1', sessionId: 'sess_int_001', eventType: 'vote',
      trigger: 'auto', status: 'active',
      title: '北伐方向投票', description: '选择北伐的最优路线',
      reason: '需要决策',
      payload: { question: '路线？', options: [{ id: 'o1', label: '长安', roles: [] }, { id: 'o2', label: '洛阳', roles: [] }], tally: {} },
      relatedMessageId: 'm1',
      createdAt: '2026-06-04T06:02:00.000Z',
    })

    await voteRepo.save({
      voteId: 'v1', sessionId: 'sess_int_001', eventId: 'evt_1',
      voterType: 'role', voterId: 'r1', optionId: 'o1',
      createdAt: '2026-06-04T06:03:00.000Z',
    })
    await voteRepo.save({
      voteId: 'v2', sessionId: 'sess_int_001', eventId: 'evt_1',
      voterType: 'role', voterId: 'r2', optionId: 'o2',
      createdAt: '2026-06-04T06:04:00.000Z',
    })

    const svc = new SessionExportService(sessionRepo, msgRepo, eventRepo, voteRepo)

    // Act: export across all four repositories
    const result = await svc.exportToMarkdown('sess_int_001')

    // Assert: full chain verification
    // 1. Session metadata (SessionRepo)
    expect(result.content).toContain('战略规划讨论')
    expect(result.content).toContain('sess_int_001')
    expect(result.content).toContain('三国演义')

    // 2. Role list from template snapshot (SessionRepo)
    expect(result.content).toContain('诸葛亮')
    expect(result.content).toContain('关羽')

    // 3. Messages from all types (MessageRepo)
    expect(result.content).toContain('北伐的战略方向')  // host
    expect(result.content).toContain('应当先取长安')    // character
    expect(result.content).toContain('大家的意见我都听到了')  // user

    // 4. Events (EventRepo)
    expect(result.content).toContain('北伐方向投票')

    // 5. Votes (VoteRepo)
    expect(result.content).toContain('投票结果')
    // Vote data linked to specific event
    expect(result.content).toContain('r1')
    expect(result.content).toContain('r2')

    // 6. Sanitization
    expect(result.sanitized).toBe(true)
    expect(result.content).not.toContain('apiKey')
    expect(result.content).not.toContain('sk-')

    // 7. Output format
    expect(result.format).toBe('md')
    expect(result.filename).toBe('session-sess_int_001.md')
  })

  it('handles missing session with correct error code', async () => {
    const svc = new SessionExportService(
      new MockSessionRepository(),
      new MockMessageRepository(),
      new MockEventRepository(),
      new MockVoteRepository()
    )
    await expect(svc.exportToMarkdown('nonexistent')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})