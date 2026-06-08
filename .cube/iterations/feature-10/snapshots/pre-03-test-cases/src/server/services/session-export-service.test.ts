import { describe, it, expect } from 'vitest'
import { SessionExportService } from '@/server/services/session-export.service'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockMessageRepository } from '@/server/repositories/mock/mock-message.repository'
import { MockEventRepository } from '@/server/repositories/mock/mock-event.repository'
import { MockVoteRepository } from '@/server/repositories/mock/mock-vote.repository'
import type { Session, DiscussionMessage, EventRecord, VoteRecord } from '@/types'

function makeService() {
  return new SessionExportService(
    new MockSessionRepository(),
    new MockMessageRepository(),
    new MockEventRepository(),
    new MockVoteRepository()
  )
}

function makeSession(overrides?: Partial<Session>): Session {
  return {
    id: 'sess_001',
    templateId: 'tpl_001',
    topic: '测试讨论',
    status: 'completed',
    state: { stage: 'closing', turnCount: 5, lastSpeakerId: null },
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    templateSnapshot: {
      templateId: 'tpl_001',
      version: '1.0.0',
      name: '三国演义',
      overview: { worldview: '三国', userIdentity: '主公', applicableScenarios: ['战略讨论'] },
      roles: [
        { roleId: 'role_001', name: '荀彧', persona: '谋士', isHost: true, agentType: 'host', systemPrompt: '你是荀彧', visible: true },
        { roleId: 'role_002', name: '关羽', persona: '武将', isHost: false, agentType: 'expert', systemPrompt: '你是关羽', visible: true },
      ],
      events: [],
      rhythm: { maxTurnsPerStage: {}, minTurnsBeforeClimax: 3 },
      modelDefaults: { defaultModel: 'gpt-4o', temperature: 0.7, maxTokens: 512 },
      snapshotAt: '2026-06-04T00:00:00.000Z',
    },
    ...overrides,
  }
}

function makeMessage(overrides?: Partial<DiscussionMessage>): DiscussionMessage {
  return {
    messageId: 'msg_001',
    sessionId: 'sess_001',
    type: 'host',
    roleId: 'role_001',
    content: '欢迎各位来到讨论。',
    status: 'completed',
    createdAt: '2026-06-04T06:00:00.000Z',
    ...overrides,
  }
}

function makeEvent(overrides?: Partial<EventRecord>): EventRecord {
  return {
    eventId: 'evt_001',
    sessionId: 'sess_001',
    eventType: 'vote',
    trigger: 'auto',
    status: 'active',
    title: '重大决策投票',
    description: '是否出兵？',
    reason: '局面需要决策',
    payload: {
      question: '是否出兵？',
      options: [{ id: 'opt_1', label: '是', roles: [] }],
      tally: {},
    },
    relatedMessageId: 'msg_005',
    createdAt: '2026-06-04T06:05:00.000Z',
    ...overrides,
  }
}

function makeVote(overrides?: Partial<VoteRecord>): VoteRecord {
  return {
    voteId: 'vote_001',
    sessionId: 'sess_001',
    eventId: 'evt_001',
    voterType: 'role',
    voterId: 'role_001',
    optionId: 'opt_1',
    createdAt: '2026-06-04T06:06:00.000Z',
    ...overrides,
  }
}

// ─── Task-06: SessionExportService ───────────────────────────────────────────

describe('SessionExportService.exportToMarkdown', () => {
  it('throws NOT_FOUND when session does not exist', async () => {
    const svc = makeService()
    await expect(svc.exportToMarkdown('nonexistent')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('returns SessionExportResult with correct format fields', async () => {
    const sessionRepo = new MockSessionRepository()
    await sessionRepo.save(makeSession())
    const svc = new SessionExportService(sessionRepo, new MockMessageRepository(), new MockEventRepository(), new MockVoteRepository())

    const result = await svc.exportToMarkdown('sess_001')
    expect(result.sessionId).toBe('sess_001')
    expect(result.format).toBe('md')
    expect(result.filename).toBe('session-sess_001.md')
    expect(result.sanitized).toBe(true)
    expect(result.generatedAt).toBeTruthy()
    expect(typeof result.content).toBe('string')
  })

  it('content includes session metadata', async () => {
    const sessionRepo = new MockSessionRepository()
    await sessionRepo.save(makeSession())
    const svc = new SessionExportService(sessionRepo, new MockMessageRepository(), new MockEventRepository(), new MockVoteRepository())

    const result = await svc.exportToMarkdown('sess_001')
    expect(result.content).toContain('测试讨论')
    expect(result.content).toContain('sess_001')
    expect(result.content).toContain('三国演义')
  })

  it('content includes sanitization notice', async () => {
    const sessionRepo = new MockSessionRepository()
    await sessionRepo.save(makeSession())
    const svc = new SessionExportService(sessionRepo, new MockMessageRepository(), new MockEventRepository(), new MockVoteRepository())

    const result = await svc.exportToMarkdown('sess_001')
    expect(result.content).toContain('脱敏')
    expect(result.content).toContain('sanitized: true')
  })

  it('content never contains ProviderConfig or API Key references', async () => {
    const sessionRepo = new MockSessionRepository()
    await sessionRepo.save(makeSession())
    const svc = new SessionExportService(sessionRepo, new MockMessageRepository(), new MockEventRepository(), new MockVoteRepository())

    const result = await svc.exportToMarkdown('sess_001')
    expect(result.content).not.toContain('apiKey')
    expect(result.content).not.toContain('apiKeyRef')
    expect(result.content).not.toContain('Authorization')
    expect(result.content).not.toContain('ProviderConfig')
    expect(result.content).not.toContain('sk-')
  })

  it('content includes messages section', async () => {
    const sessionRepo = new MockSessionRepository()
    const msgRepo = new MockMessageRepository()
    await sessionRepo.save(makeSession())
    await msgRepo.save(makeMessage({ content: '第一轮发言' }))
    await msgRepo.save(makeMessage({ messageId: 'msg_002', type: 'character', roleId: 'role_002', content: '我反对' }))
    const svc = new SessionExportService(sessionRepo, msgRepo, new MockEventRepository(), new MockVoteRepository())

    const result = await svc.exportToMarkdown('sess_001')
    expect(result.content).toContain('消息记录')
    expect(result.content).toContain('第一轮发言')
    expect(result.content).toContain('我反对')
  })

  it('content includes events section with votes', async () => {
    const sessionRepo = new MockSessionRepository()
    const eventRepo = new MockEventRepository()
    const voteRepo = new MockVoteRepository()
    await sessionRepo.save(makeSession())
    await eventRepo.save(makeEvent())
    await voteRepo.save(makeVote())
    const svc = new SessionExportService(sessionRepo, new MockMessageRepository(), eventRepo, voteRepo)

    const result = await svc.exportToMarkdown('sess_001')
    expect(result.content).toContain('事件记录')
    expect(result.content).toContain('重大决策投票')
    expect(result.content).toContain('投票结果')
  })

  it('content includes role list from template snapshot', async () => {
    const sessionRepo = new MockSessionRepository()
    await sessionRepo.save(makeSession())
    const svc = new SessionExportService(sessionRepo, new MockMessageRepository(), new MockEventRepository(), new MockVoteRepository())

    const result = await svc.exportToMarkdown('sess_001')
    expect(result.content).toContain('角色列表')
    expect(result.content).toContain('荀彧')
    expect(result.content).toContain('关羽')
  })

  it('handles session without templateSnapshot gracefully', async () => {
    const sessionRepo = new MockSessionRepository()
    await sessionRepo.save(makeSession({ templateSnapshot: undefined }))
    const svc = new SessionExportService(sessionRepo, new MockMessageRepository(), new MockEventRepository(), new MockVoteRepository())

    const result = await svc.exportToMarkdown('sess_001')
    expect(result.content).toContain('sess_001')
    // should not contain role list section
    expect(result.content).not.toContain('角色列表')
  })

  it('handles empty session (no messages, events, votes)', async () => {
    const sessionRepo = new MockSessionRepository()
    await sessionRepo.save(makeSession())
    const svc = new SessionExportService(sessionRepo, new MockMessageRepository(), new MockEventRepository(), new MockVoteRepository())

    const result = await svc.exportToMarkdown('sess_001')
    expect(result.sessionId).toBe('sess_001')
    expect(result.content).not.toContain('消息记录')
    expect(result.content).not.toContain('事件记录')
  })

  it('handles user type messages', async () => {
    const sessionRepo = new MockSessionRepository()
    const msgRepo = new MockMessageRepository()
    await sessionRepo.save(makeSession())
    await msgRepo.save(makeMessage({ messageId: 'msg_user', type: 'user', content: '用户输入', roleId: undefined }))
    const svc = new SessionExportService(sessionRepo, msgRepo, new MockEventRepository(), new MockVoteRepository())

    const result = await svc.exportToMarkdown('sess_001')
    expect(result.content).toContain('用户输入')
    expect(result.content).toContain('[user]')
  })

  it('content is valid markdown structure', async () => {
    const sessionRepo = new MockSessionRepository()
    await sessionRepo.save(makeSession())
    const svc = new SessionExportService(sessionRepo, new MockMessageRepository(), new MockEventRepository(), new MockVoteRepository())

    const result = await svc.exportToMarkdown('sess_001')
    // Has h1 and h2 headings
    expect(result.content).toMatch(/^# /m)
    expect(result.content).toMatch(/^## /m)
  })
})