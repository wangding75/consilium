import { describe, expect, it, vi } from 'vitest'
import { DefaultAgentRuntime } from '@/engine/agent-runtime'
import { DiscussionService } from '@/server/services/discussion.service'
import { MockDiscussionRepository } from '@/server/repositories/mock/mock-discussion.repository'
import { MockMessageRepository } from '@/server/repositories/mock/mock-message.repository'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import type {
  DiscussionMessage,
  ModelStrategySnapshot,
  Session,
  TemplateSnapshot,
} from '@/types'

function makeTemplateSnapshot(): TemplateSnapshot {
  return {
    templateId: 'startup-board',
    version: '1.0.0',
    name: '创业公司董事会',
    overview: {
      worldview: '创业公司经营决策场景',
      userIdentity: 'CEO',
      applicableScenarios: ['融资', '定价'],
    },
    roles: [
      {
        roleId: 'ceo',
        name: 'CEO',
        persona: '负责综合决策',
        isHost: true,
        agentType: 'host',
        systemPrompt: '主持讨论',
        visible: true,
        configStatus: 'default',
      },
    ],
    events: [],
    rhythm: { maxTurnsPerStage: {}, minTurnsBeforeClimax: 3 },
    modelDefaults: { defaultModel: 'gpt-4o', temperature: 0.7, maxTokens: 512 },
    snapshotAt: '2026-06-02T00:00:00.000Z',
  }
}

function makeStrategySnapshot(): ModelStrategySnapshot {
  return {
    modelStrategyId: 'smart',
    name: '智能平衡',
    selectedByDefault: true,
    defaultModel: 'claude-3-5-sonnet',
    roleOverrides: {
      ceo: {
        model: 'claude-3-5-sonnet',
        temperature: 0.4,
        maxTokens: 256,
      },
    },
    fallbackChain: ['claude-3-5-haiku'],
    temperature: 0.6,
    maxTokens: 384,
    snapshotAt: '2026-06-02T00:00:00.000Z',
  }
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-snapshot',
    templateId: 'startup-board',
    topic: '讨论融资策略',
    status: 'running',
    state: { stage: 'developing', turnCount: 4, lastSpeakerId: null },
    messages: [],
    createdAt: 1717200000000,
    updatedAt: 1717203600000,
    templateSnapshot: makeTemplateSnapshot(),
    strategySnapshot: makeStrategySnapshot(),
    snapshotCreatedAt: '2026-06-02T00:00:00.000Z',
    ...overrides,
  }
}

function makeAgentMessage(sessionId: string): DiscussionMessage {
  return {
    messageId: 'msg-agent-1',
    sessionId,
    type: 'host',
    roleId: 'ceo',
    content: '我们继续推进这轮讨论。',
    status: 'completed',
    createdAt: '2026-06-02T00:00:00.000Z',
  }
}

class NullTemplateRepository {
  async findById(): Promise<null> {
    return null
  }
}

describe('integration: snapshot recovery and runtime chain (Task-08)', () => {
  it('sendUserMessage uses session snapshots to build templateName and profiles when live template is unavailable', async () => {
    const sessionRepo = new MockSessionRepository()
    const messageRepo = new MockMessageRepository()
    const discussionRepo = new MockDiscussionRepository()
    const orchestrator = {
      run: vi.fn().mockResolvedValue({
        agentMessages: [makeAgentMessage('sess-snapshot')],
        callLogs: [],
        activeSpeakerId: 'ceo',
      }),
    }

    await sessionRepo.save(makeSession())

    const service = new DiscussionService(
      discussionRepo,
      sessionRepo,
      new NullTemplateRepository() as never,
      messageRepo,
      undefined,
      orchestrator as never,
    )

    await service.sendUserMessage('sess-snapshot', '请继续分析')

    expect(orchestrator.run).toHaveBeenCalled()
    const input = orchestrator.run.mock.calls[0][0]
    expect(input.templateName).toBe('创业公司董事会')
    expect(input.profiles).toEqual([
      expect.objectContaining({
        roleId: 'ceo',
        name: 'CEO',
        model: 'claude-3-5-sonnet',
        temperature: 0.4,
        maxTokens: 256,
        visible: true,
      }),
    ])
  })

  it('getSessionDetail returns snapshot template and strategy summaries when live template is unavailable', async () => {
    const sessionRepo = new MockSessionRepository()
    const discussionRepo = new MockDiscussionRepository()

    await sessionRepo.save(makeSession())

    const service = new DiscussionService(
      discussionRepo,
      sessionRepo,
      new NullTemplateRepository() as never,
    )

    const detail = await service.getSessionDetail('sess-snapshot')

    expect(detail.template).toEqual({
      templateId: 'startup-board',
      name: '创业公司董事会',
      version: '1.0.0',
      fromSnapshot: true,
    })
    expect(detail.modelStrategy).toEqual({
      modelStrategyId: 'smart',
      name: '智能平衡',
      selectedByDefault: true,
      fromSnapshot: true,
    })
    expect(detail.roles).toEqual([
      expect.objectContaining({
        roleId: 'ceo',
        name: 'CEO',
        model: 'claude-3-5-sonnet',
      }),
    ])
  })

  it('DefaultAgentRuntime forwards maxTokens from resolved runtime config to provider chat options', async () => {
    const provider = {
      chat: vi.fn().mockResolvedValue('好的'),
    }
    const runtime = new DefaultAgentRuntime(provider as never)

    await runtime.run(
      {
        agentId: 'agent-ceo',
        roleId: 'ceo',
        agentType: 'host',
        name: 'CEO',
        persona: '负责综合决策',
        systemPrompt: '主持讨论',
        model: 'claude-3-5-sonnet',
        temperature: 0.4,
        maxTokens: 256,
        visible: true,
      } as never,
      []
    )

    expect(provider.chat).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        provider: 'mock',
        model: 'claude-3-5-sonnet',
        temperature: 0.4,
        maxTokens: 256,
      })
    )
  })
})
