import { describe, it, expect } from 'vitest'
import { ModelStrategyService } from '@/server/services/model-strategy.service'
import { MockModelStrategyRepository } from '@/server/repositories/mock/mock-model-strategy.repository'
import type { TemplateRole, ModelDefaults } from '@/types'
import { ServiceError } from '@/server/errors'

function makeStrategyRepo() {
  return new MockModelStrategyRepository()
}

function makeService(repo = makeStrategyRepo()) {
  return new ModelStrategyService(repo)
}

function makeRole(overrides: Partial<TemplateRole> = {}): TemplateRole {
  return {
    roleId: 'test-role',
    name: 'Test Role',
    agentType: 'advisor',
    isHost: false,
    goal: 'Test goal',
    personality: 'Test personality',
    speakingStyle: 'Test style',
    visible: true,
    ...overrides,
  } as TemplateRole
}

const defaultModelDefaults: ModelDefaults = {
  defaultModel: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 2048,
  maxCharsPerTurn: 500,
}

describe('ModelStrategyService — getStrategy / getDefaultStrategy (Task-05)', () => {
  it('getStrategy returns active strategy by id', async () => {
    const service = makeService()
    const strategy = await service.getStrategy('smart')
    expect(strategy).toBeDefined()
    expect(strategy.modelStrategyId).toBe('smart')
    expect(strategy.active).toBe(true)
  })

  it('getStrategy throws MODEL_STRATEGY_NOT_FOUND for nonexistent id', async () => {
    const service = makeService()
    await expect(service.getStrategy('nonexistent')).rejects.toBeInstanceOf(ServiceError)
  })

  it('getStrategy throws MODEL_STRATEGY_UNAVAILABLE for inactive strategy', async () => {
    const service = makeService()
    await expect(service.getStrategy('inactive')).rejects.toMatchObject({ code: 'MODEL_STRATEGY_UNAVAILABLE' })
  })

  it('getDefaultStrategy returns the active default strategy', async () => {
    const service = makeService()
    const strategy = await service.getDefaultStrategy()
    expect(strategy).toBeDefined()
    expect(strategy.isDefault).toBe(true)
    expect(strategy.active).toBe(true)
  })

  it('getDefaultStrategy throws MODEL_STRATEGY_REQUIRED when no default exists', async () => {
    const repo = makeStrategyRepo()
    vi.spyOn(repo, 'findDefault').mockResolvedValueOnce(null)
    const service = new ModelStrategyService(repo)
    await expect(service.getDefaultStrategy()).rejects.toMatchObject({ code: 'MODEL_STRATEGY_REQUIRED' })
  })
})

describe('ModelStrategyService — createStrategySnapshot (Task-05)', () => {
  it('createStrategySnapshot returns a deep copy with selectedByDefault', async () => {
    const service = makeService()
    const strategy = await service.getStrategy('smart')
    const snapshot = service.createStrategySnapshot(strategy, true)
    expect(snapshot.modelStrategyId).toBe('smart')
    expect(snapshot.selectedByDefault).toBe(true)
    expect(snapshot.snapshotAt).toBeDefined()
  })

  it('snapshot is a deep copy not referencing original', async () => {
    const service = makeService()
    const strategy = await service.getStrategy('smart')
    const snapshot = service.createStrategySnapshot(strategy, false)
    strategy.name = 'Changed'
    expect(snapshot.name).not.toBe('Changed')
  })
})

describe('ModelStrategyService — resolveRoleRuntimeConfig (Task-05)', () => {
  it('resolves with template defaults when no overrides', async () => {
    const service = makeService()
    const strategy = await service.getStrategy('smart')
    const snapshot = service.createStrategySnapshot(strategy, false)
    const role = makeRole()
    const resolved = service.resolveRoleRuntimeConfig(role, defaultModelDefaults, snapshot)
    expect(resolved.model).toBeDefined()
    expect(resolved.temperature).toBeDefined()
    expect(resolved.maxTokens).toBeDefined()
  })

  it('strategy defaultModel overrides template default', async () => {
    const service = makeService()
    const strategy = await service.getStrategy('smart')
    const snapshot = service.createStrategySnapshot(strategy, false)
    const role = makeRole()
    const resolved = service.resolveRoleRuntimeConfig(role, defaultModelDefaults, snapshot)
    if (snapshot.defaultModel) {
      expect(resolved.model).toBe(snapshot.defaultModel)
    }
  })

  it('roleOverrides in strategy override defaults', async () => {
    const service = makeService()
    const strategy = await service.getStrategy('smart')
    const snapshot = service.createStrategySnapshot({
      ...strategy,
      roleOverrides: {
        'test-role': { model: 'gpt-4-turbo', temperature: 0.3, maxTokens: 4096 },
      },
    }, false)
    const role = makeRole({ roleId: 'test-role' })
    const resolved = service.resolveRoleRuntimeConfig(role, defaultModelDefaults, snapshot)
    expect(resolved.model).toBe('gpt-4-turbo')
    expect(resolved.temperature).toBe(0.3)
  })

  it('role.runtimeConfig overrides strategy roleOverrides', async () => {
    const service = makeService()
    const strategy = await service.getStrategy('smart')
    const snapshot = service.createStrategySnapshot({
      ...strategy,
      roleOverrides: {
        'test-role': { model: 'gpt-4-turbo', temperature: 0.3 },
      },
    }, false)
    const role = makeRole({
      roleId: 'test-role',
      runtimeConfig: { model: 'claude-3-opus', temperature: 0.5, maxCharsPerTurn: 800 },
    })
    const resolved = service.resolveRoleRuntimeConfig(role, defaultModelDefaults, snapshot)
    if (role.runtimeConfig?.model) {
      expect(resolved.model).toBe(role.runtimeConfig.model)
    }
  })

  it('maxCharsPerTurn is preserved separately from maxTokens', async () => {
    const service = makeService()
    const strategy = await service.getStrategy('smart')
    const snapshot = service.createStrategySnapshot(strategy, false)
    const role = makeRole({ runtimeConfig: { maxCharsPerTurn: 1200 } })
    const resolved = service.resolveRoleRuntimeConfig(role, defaultModelDefaults, snapshot)
    expect(resolved.maxCharsPerTurn).toBe(1200)
  })

  it('fallbackChain is returned in resolved config', async () => {
    const service = makeService()
    const strategy = await service.getStrategy('smart')
    const snapshot = service.createStrategySnapshot(strategy, false)
    const role = makeRole()
    const resolved = service.resolveRoleRuntimeConfig(role, defaultModelDefaults, snapshot)
    expect(Array.isArray(resolved.fallbackChain)).toBe(true)
  })

  it('resolvedModelSource is default when no fallback used', async () => {
    const service = makeService()
    const strategy = await service.getStrategy('smart')
    const snapshot = service.createStrategySnapshot(strategy, false)
    const role = makeRole()
    const resolved = service.resolveRoleRuntimeConfig(role, defaultModelDefaults, snapshot)
    expect(resolved.resolvedModelSource).toBe('default')
  })
})

describe('ModelStrategyService — listStrategies (Task-04/05)', () => {
  it('listStrategies returns active strategies and defaultModelStrategyId', async () => {
    const service = makeService()
    const result = await service.listStrategies()
    expect(Array.isArray(result.strategies)).toBe(true)
    expect(result.strategies.length).toBeGreaterThan(0)
    expect(result.defaultModelStrategyId).toBeDefined()
    for (const s of result.strategies) {
      expect(s.active).toBe(true)
    }
  })
})
