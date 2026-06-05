import { describe, it, expect } from 'vitest'
import type {
  DiscussionTemplate,
  TemplateRole,
  ModelStrategy,
  TemplateSnapshot,
  ModelStrategySnapshot,
  LLMConfig,
  AgentCallLog,
} from '@/types'
import type {
  TemplateSummary,
  TemplateListResult,
  TemplateDetailResult,
  ModelStrategiesResult,
  SessionListItem,
  SessionListResult,
  CreateSessionResult,
  SessionDetailResult,
} from '@/types/api'

// ─── TemplateSummary ─────────────────────────────────────────────────────────

describe('TemplateSummary (API DTO)', () => {
  it('has all required fields for template listing', () => {
    const summary: TemplateSummary = {
      templateId: 'tpl-1',
      version: '1.0.0',
      name: '三国军师团',
      description: '模拟三国军师讨论',
      category: 'history',
      tags: ['strategy', 'debate'],
      roleCount: 3,
      eventCount: 2,
      usageCount: 42,
      sessionCount: 10,
      favoriteCount: 5,
      isBuiltin: true,
      availableForSessionCreation: true,
    }
    expect(summary.templateId).toBe('tpl-1')
    expect(summary.version).toBe('1.0.0')
    expect(summary.roleCount).toBe(3)
    expect(summary.isBuiltin).toBe(true)
    expect(summary.availableForSessionCreation).toBe(true)
  })

  it('can be returned inside TemplateListResult', () => {
    const result: TemplateListResult = {
      templates: [
        {
          templateId: 'tpl-1',
          version: '1.0.0',
          name: '三国军师团',
          description: '模拟三国军师讨论',
          category: 'history',
          tags: ['strategy'],
          roleCount: 3,
          eventCount: 2,
          usageCount: 0,
          sessionCount: 0,
          favoriteCount: 0,
          isBuiltin: false,
          availableForSessionCreation: true,
        },
      ],
    }
    expect(result.templates).toHaveLength(1)
    expect(result.templates[0].templateId).toBe('tpl-1')
  })
})

// ─── DiscussionTemplate ──────────────────────────────────────────────────────

describe('DiscussionTemplate (domain type)', () => {
  it('has required identity and metadata fields', () => {
    const tpl: DiscussionTemplate = {
      templateId: 'tpl-1',
      version: '1.0.0',
      name: '三国军师团',
      description: '模拟三国军师讨论',
      category: 'history',
      tags: ['strategy'],
      overview: {
        worldview: '东汉末年',
        userIdentity: '主公',
        applicableScenarios: ['策略制定'],
      },
      roles: [],
      events: [],
      rhythm: { maxTurnsPerStage: {}, minTurnsBeforeClimax: 3 },
      modelDefaults: { defaultModel: 'gpt-4o' },
      metrics: { usageCount: 0, sessionCount: 0, favoriteCount: 0 },
      isBuiltin: false,
      visible: true,
      availableForSessionCreation: true,
      editable: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    expect(tpl.templateId).toBe('tpl-1')
    expect(tpl.version).toBe('1.0.0')
    expect(tpl.visible).toBe(true)
  })

  it('contains a list of TemplateRole objects', () => {
    const tpl: DiscussionTemplate = {
      templateId: 'tpl-1',
      version: '1.0.0',
      name: '三国军师团',
      description: '模拟三国军师讨论',
      category: 'history',
      tags: [],
      overview: {
        worldview: '东汉末年',
        userIdentity: '主公',
        applicableScenarios: [],
      },
      roles: [
        {
          roleId: 'role-1',
          name: '诸葛亮',
          persona: '智谋过人',
          isHost: true,
          agentType: 'host',
          systemPrompt: '你是诸葛亮',
          visible: true,
          configStatus: 'default',
        },
      ],
      events: [],
      rhythm: { maxTurnsPerStage: {}, minTurnsBeforeClimax: 3 },
      modelDefaults: { defaultModel: 'gpt-4o' },
      metrics: { usageCount: 0, sessionCount: 0, favoriteCount: 0 },
      isBuiltin: false,
      visible: true,
      availableForSessionCreation: true,
      editable: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    expect(tpl.roles).toHaveLength(1)
    expect(tpl.roles[0].roleId).toBe('role-1')
  })
})

// ─── TemplateRole ────────────────────────────────────────────────────────────

describe('TemplateRole (domain type)', () => {
  it('has all required fields with correct types', () => {
    const role: TemplateRole = {
      roleId: 'role-1',
      name: '诸葛亮',
      persona: '蜀汉丞相，智谋过人',
      isHost: true,
      agentType: 'host',
      systemPrompt: '你是诸葛亮，负责主持讨论',
      visible: true,
      configStatus: 'default',
    }
    expect(role.roleId).toBe('role-1')
    expect(role.isHost).toBe(true)
    expect(role.configStatus).toBe('default')
  })

  it('allows optional runtimeConfig with model, temperature, maxCharsPerTurn', () => {
    const role: TemplateRole = {
      roleId: 'role-2',
      name: '司马懿',
      persona: '曹魏谋士',
      isHost: false,
      agentType: 'expert',
      systemPrompt: '你是司马懿',
      visible: true,
      configStatus: 'customized',
      runtimeConfig: {
        model: 'gpt-4o-mini',
        temperature: 0.8,
        maxCharsPerTurn: 500,
      },
    }
    expect(role.runtimeConfig?.model).toBe('gpt-4o-mini')
    expect(role.runtimeConfig?.temperature).toBe(0.8)
    expect(role.runtimeConfig?.maxCharsPerTurn).toBe(500)
  })

  it('permits optional avatarEmoji', () => {
    const role: TemplateRole = {
      roleId: 'role-3',
      name: '周瑜',
      persona: '东吴大都督',
      isHost: false,
      agentType: 'critic',
      systemPrompt: '你是周瑜',
      visible: true,
      configStatus: 'default',
      avatarEmoji: '🔥',
    }
    expect(role.avatarEmoji).toBe('🔥')
  })
})

// ─── TemplateSnapshot ────────────────────────────────────────────────────────

describe('TemplateSnapshot (domain type)', () => {
  it('captures template state with snapshotAt timestamp', () => {
    const snapshot: TemplateSnapshot = {
      templateId: 'tpl-1',
      version: '1.0.0',
      name: '三国军师团',
      overview: {
        worldview: '东汉末年',
        userIdentity: '主公',
        applicableScenarios: [],
      },
      roles: [],
      events: [],
      rhythm: { maxTurnsPerStage: {}, minTurnsBeforeClimax: 3 },
      modelDefaults: { defaultModel: 'gpt-4o' },
      snapshotAt: '2026-06-01T12:00:00.000Z',
    }
    expect(snapshot.snapshotAt).toBe('2026-06-01T12:00:00.000Z')
  })
})

// ─── ModelStrategy ───────────────────────────────────────────────────────────

describe('ModelStrategy (domain type)', () => {
  it('has required strategy fields including priority array', () => {
    const strategy: ModelStrategy = {
      modelStrategyId: 'ms-1',
      name: 'Quality First',
      description: 'Prioritize response quality',
      priority: ['quality', 'speed', 'cost'],
      defaultModel: 'gpt-4o',
      roleOverrides: {},
      fallbackChain: ['gpt-4o-mini', 'claude-3-haiku'],
      temperature: 0.7,
      maxTokens: 4096,
      costPolicy: 'balanced',
      speedPolicy: 'standard',
      active: true,
      isDefault: true,
    }
    expect(strategy.priority).toEqual(['quality', 'speed', 'cost'])
    expect(strategy.active).toBe(true)
    expect(strategy.isDefault).toBe(true)
  })

  it('supports roleOverrides as Record<string, ModelOverride>', () => {
    const strategy: ModelStrategy = {
      modelStrategyId: 'ms-2',
      name: 'Custom Overrides',
      description: 'Overrides for specific roles',
      priority: ['quality'],
      defaultModel: 'gpt-4o',
      roleOverrides: {
        'role-1': { model: 'gpt-4o', temperature: 0.5, maxTokens: 2048 },
        'role-2': { model: 'gpt-4o-mini' },
      },
      fallbackChain: [],
      temperature: 0.7,
      maxTokens: 4096,
      costPolicy: 'low',
      speedPolicy: 'fast',
      active: true,
      isDefault: false,
    }
    expect(strategy.roleOverrides['role-1'].temperature).toBe(0.5)
    expect(strategy.roleOverrides['role-2'].model).toBe('gpt-4o-mini')
  })
})

// ─── ModelStrategySnapshot ───────────────────────────────────────────────────

describe('ModelStrategySnapshot (domain type)', () => {
  it('captures strategy state with snapshotAt and selectedByDefault flag', () => {
    const snapshot: ModelStrategySnapshot = {
      modelStrategyId: 'ms-1',
      name: 'Quality First',
      selectedByDefault: true,
      defaultModel: 'gpt-4o',
      roleOverrides: {},
      fallbackChain: [],
      temperature: 0.7,
      maxTokens: 4096,
      snapshotAt: '2026-06-01T12:00:00.000Z',
    }
    expect(snapshot.selectedByDefault).toBe(true)
    expect(snapshot.snapshotAt).toBe('2026-06-01T12:00:00.000Z')
  })
})

// ─── API DTOs ────────────────────────────────────────────────────────────────

describe('TemplateDetailResult (API DTO)', () => {
  it('wraps a DiscussionTemplate in template field', () => {
    const result: TemplateDetailResult = {
      template: {
        templateId: 'tpl-1',
        version: '1.0.0',
        name: '三国军师团',
        description: '模拟三国军师讨论',
        category: 'history',
        tags: [],
        overview: {
          worldview: '东汉末年',
          userIdentity: '主公',
          applicableScenarios: [],
        },
        roles: [],
        events: [],
        rhythm: { maxTurnsPerStage: {}, minTurnsBeforeClimax: 3 },
        modelDefaults: { defaultModel: 'gpt-4o' },
        metrics: { usageCount: 0, sessionCount: 0, favoriteCount: 0 },
        isBuiltin: false,
        visible: true,
        availableForSessionCreation: true,
        editable: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    }
    expect(result.template.templateId).toBe('tpl-1')
  })
})

describe('ModelStrategiesResult (API DTO)', () => {
  it('returns strategies array and defaultModelStrategyId', () => {
    const result: ModelStrategiesResult = {
      strategies: [
        {
          modelStrategyId: 'ms-1',
          name: 'Quality First',
          description: 'Quality priority',
          priority: ['quality'],
          defaultModel: 'gpt-4o',
          roleOverrides: {},
          fallbackChain: [],
          temperature: 0.7,
          maxTokens: 4096,
          costPolicy: 'balanced',
          speedPolicy: 'standard',
          active: true,
          isDefault: true,
        },
      ],
      defaultModelStrategyId: 'ms-1',
    }
    expect(result.strategies).toHaveLength(1)
    expect(result.defaultModelStrategyId).toBe('ms-1')
  })
})

// ─── SessionListItem ─────────────────────────────────────────────────────────

describe('SessionListItem (API DTO)', () => {
  it('has required session list fields', () => {
    const item: SessionListItem = {
      sessionId: 'sess-1',
      topic: '如何提高团队效率',
      status: 'running',
      template: {
        templateId: 'tpl-1',
        name: '三国军师团',
        fromSnapshot: false,
      },
      roleCount: 3,
      eventCount: 0,
      messageCount: 12,
      createdAt: 1234567890000,
      updatedAt: 1234567900000,
    }
    expect(item.sessionId).toBe('sess-1')
    expect(item.template.fromSnapshot).toBe(false)
  })

  it('template supports version and fallbackReason when fromSnapshot is true', () => {
    const item: SessionListItem = {
      sessionId: 'sess-2',
      topic: '产品战略讨论',
      status: 'completed',
      template: {
        templateId: 'tpl-1',
        name: '三国军师团',
        version: '1.0.0',
        fromSnapshot: true,
        fallbackReason: 'template updated after session start',
      },
      modelStrategy: {
        modelStrategyId: 'ms-1',
        name: 'Quality First',
        fromSnapshot: true,
      },
      roleCount: 3,
      eventCount: 1,
      messageCount: 20,
      createdAt: 1234567890000,
      updatedAt: 1234567900000,
    }
    expect(item.template.version).toBe('1.0.0')
    expect(item.template.fallbackReason).toBe('template updated after session start')
    expect(item.modelStrategy?.fromSnapshot).toBe(true)
  })

  it('can be returned inside SessionListResult', () => {
    const result: SessionListResult = {
      sessions: [
        {
          sessionId: 'sess-1',
          topic: '测试',
          status: 'running',
          template: { templateId: 'tpl-1', name: '测试模板', fromSnapshot: false },
          roleCount: 2,
          eventCount: 0,
          messageCount: 5,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    }
    expect(result.sessions).toHaveLength(1)
    expect(result.sessions[0].sessionId).toBe('sess-1')
  })
})

// ─── CreateSessionResult ─────────────────────────────────────────────────────

describe('CreateSessionResult (API DTO)', () => {
  it('has sessionId, topic, template, modelStrategy, status, createdAt', () => {
    const result: CreateSessionResult = {
      sessionId: 'sess-new',
      topic: '如何提高团队效率',
      template: { templateId: 'tpl-1', name: '三国军师团', version: '1.0.0' },
      modelStrategy: { modelStrategyId: 'ms-1', name: 'Quality First', selectedByDefault: true },
      status: 'running',
      createdAt: 1234567890000,
    }
    expect(result.sessionId).toBe('sess-new')
    expect(result.template.version).toBe('1.0.0')
    expect(result.modelStrategy.selectedByDefault).toBe(true)
  })
})

// ─── SessionDetailResult ─────────────────────────────────────────────────────

describe('SessionDetailResult (API DTO)', () => {
  it('has full session detail fields including roles array', () => {
    const result: SessionDetailResult = {
      sessionId: 'sess-1',
      topic: '如何提高团队效率',
      template: { templateId: 'tpl-1', name: '三国军师团', fromSnapshot: false },
      status: 'running',
      roles: [
        { roleId: 'role-1', name: '诸葛亮', agentType: 'host', avatar: 'ava1', model: 'gpt-4o' },
      ],
      activeSpeakerId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    expect(result.roles).toHaveLength(1)
    expect(result.roles[0].roleId).toBe('role-1')
    expect(result.activeSpeakerId).toBeNull()
  })

  it('supports optional phase and state fields', () => {
    const result: SessionDetailResult = {
      sessionId: 'sess-1',
      topic: '如何提高团队效率',
      template: { templateId: 'tpl-1', name: '三国军师团', fromSnapshot: false },
      status: 'running',
      phase: 'developing',
      state: { stage: 'developing', turnCount: 5, lastSpeakerId: 'role-1' },
      roles: [],
      activeSpeakerId: 'role-2',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    expect(result.phase).toBe('developing')
    expect(result.state?.turnCount).toBe(5)
  })
})

// ─── LLMConfig ───────────────────────────────────────────────────────────────

describe('LLMConfig (domain type)', () => {
  it('includes maxTokens field', () => {
    const config: LLMConfig = {
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com',
      temperature: 0.7,
      maxTokens: 4096,
    }
    expect(config.maxTokens).toBe(4096)
  })

  it('allows maxTokens to be omitted', () => {
    const config: LLMConfig = {
      provider: 'anthropic',
      model: 'claude-3-sonnet',
    }
    expect(config.maxTokens).toBeUndefined()
  })
})

// ─── AgentCallLog ────────────────────────────────────────────────────────────

describe('AgentCallLog (domain type)', () => {
  it('includes modelStrategyId field', () => {
    const log: AgentCallLog = {
      id: 'log-1',
      sessionId: 'sess-1',
      runId: 'run-1',
      agentId: 'agent-1',
      roleId: 'role-1',
      provider: 'openai',
      model: 'gpt-4o',
      inputSummary: 'summary',
      durationMs: 1000,
      status: 'success',
      createdAt: '2026-01-01T00:00:00.000Z',
      modelStrategyId: 'ms-1',
    }
    expect(log.modelStrategyId).toBe('ms-1')
  })

  it('includes temperature field', () => {
    const log: AgentCallLog = {
      id: 'log-1',
      sessionId: 'sess-1',
      runId: 'run-1',
      agentId: 'agent-1',
      roleId: 'role-1',
      provider: 'openai',
      model: 'gpt-4o',
      inputSummary: 'summary',
      durationMs: 1000,
      status: 'success',
      createdAt: '2026-01-01T00:00:00.000Z',
      temperature: 0.7,
    }
    expect(log.temperature).toBe(0.7)
  })

  it('includes maxTokens field', () => {
    const log: AgentCallLog = {
      id: 'log-1',
      sessionId: 'sess-1',
      runId: 'run-1',
      agentId: 'agent-1',
      roleId: 'role-1',
      provider: 'openai',
      model: 'gpt-4o',
      inputSummary: 'summary',
      durationMs: 1000,
      status: 'success',
      createdAt: '2026-01-01T00:00:00.000Z',
      maxTokens: 4096,
    }
    expect(log.maxTokens).toBe(4096)
  })

  it('includes resolvedModelSource with allowed literal values', () => {
    const log: AgentCallLog = {
      id: 'log-1',
      sessionId: 'sess-1',
      runId: 'run-1',
      agentId: 'agent-1',
      roleId: 'role-1',
      provider: 'openai',
      model: 'gpt-4o',
      inputSummary: 'summary',
      durationMs: 1000,
      status: 'success',
      createdAt: '2026-01-01T00:00:00.000Z',
      resolvedModelSource: 'strategyDefaults',
    }
    expect(log.resolvedModelSource).toBe('strategyDefaults')
  })

  it('includes fallbackFrom field when a fallback occurred', () => {
    const log: AgentCallLog = {
      id: 'log-1',
      sessionId: 'sess-1',
      runId: 'run-1',
      agentId: 'agent-1',
      roleId: 'role-1',
      provider: 'openai',
      model: 'gpt-4o-mini',
      inputSummary: 'summary',
      durationMs: 1000,
      status: 'success',
      createdAt: '2026-01-01T00:00:00.000Z',
      resolvedModelSource: 'fallback',
      fallbackFrom: 'gpt-4o',
    }
    expect(log.fallbackFrom).toBe('gpt-4o')
  })
})
