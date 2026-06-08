import { describe, it, expect } from 'vitest'
import { MockSettingsRepository } from '@/server/repositories/mock/mock-settings.repository'
import type { ProviderConfig, GlobalModelDefaults, RoleModelOverride, PromptConfig } from '@/types'

function makeProvider(overrides?: Partial<ProviderConfig>): ProviderConfig {
  return {
    providerId: 'openai',
    enabled: true,
    baseUrl: 'https://api.openai.com/v1',
    apiKeyRef: 'sk-ref-12345678',
    modelList: ['gpt-4o'],
    lastTestStatus: 'untested',
    ...overrides,
  }
}

function makeDefaults(overrides?: Partial<GlobalModelDefaults>): GlobalModelDefaults {
  return { providerId: 'openai', model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 512, ...overrides }
}

function makePrompt(overrides?: Partial<PromptConfig>): PromptConfig {
  return {
    promptId: 'global_system',
    scope: 'global',
    version: '1.0.0',
    content: 'You are helpful.',
    updatedAt: '2026-06-04T00:00:00.000Z',
    isDefault: true,
    ...overrides,
  }
}

// ─── MockSettingsRepository ───────────────────────────────────────────────────

describe('MockSettingsRepository', () => {
  describe('ProviderConfigs', () => {
    it('starts empty', async () => {
      const repo = new MockSettingsRepository()
      const configs = await repo.getProviderConfigs()
      expect(configs).toEqual([])
    })

    it('upsertProviderConfig inserts and returns defensive copy', async () => {
      const repo = new MockSettingsRepository()
      const input = makeProvider()
      const saved = await repo.upsertProviderConfig(input)

      // 修改返回值不应影响内部状态
      saved.modelList.push('intruder')
      const configs = await repo.getProviderConfigs()
      expect(configs[0].modelList).toEqual(['gpt-4o'])
    })

    it('upsertProviderConfig updates existing provider', async () => {
      const repo = new MockSettingsRepository()
      await repo.upsertProviderConfig(makeProvider({ providerId: 'openai', enabled: false }))
      await repo.upsertProviderConfig(makeProvider({ providerId: 'openai', enabled: true }))

      const configs = await repo.getProviderConfigs()
      expect(configs).toHaveLength(1)
      expect(configs[0].enabled).toBe(true)
    })

    it('getProviderConfigs returns defensive copy', async () => {
      const repo = new MockSettingsRepository()
      await repo.upsertProviderConfig(makeProvider())

      const configs = await repo.getProviderConfigs()
      configs.length = 0 // 尝试清空
      const again = await repo.getProviderConfigs()
      expect(again).toHaveLength(1)
    })

    it('constructing args mutation does not pollute internal state', async () => {
      const repo = new MockSettingsRepository()
      const config = makeProvider()
      await repo.upsertProviderConfig(config)
      config.modelList.push('injected')

      const stored = await repo.getProviderConfigs()
      expect(stored[0].modelList).toEqual(['gpt-4o'])
    })
  })

  describe('ModelDefaults', () => {
    it('starts null', async () => {
      const repo = new MockSettingsRepository()
      expect(await repo.getModelDefaults()).toBeNull()
    })

    it('saveModelDefaults persists and returns defensive copy', async () => {
      const repo = new MockSettingsRepository()
      const input = makeDefaults()
      const saved = await repo.saveModelDefaults(input)
      saved.temperature = 999

      const stored = await repo.getModelDefaults()
      expect(stored!.temperature).toBe(0.7)
    })

    it('saveModelDefaults overwrites previous', async () => {
      const repo = new MockSettingsRepository()
      await repo.saveModelDefaults(makeDefaults({ model: 'old-model' }))
      await repo.saveModelDefaults(makeDefaults({ model: 'new-model' }))

      const stored = await repo.getModelDefaults()
      expect(stored!.model).toBe('new-model')
    })

    it('constructing args mutation does not pollute internal state', async () => {
      const repo = new MockSettingsRepository()
      const defaults = makeDefaults()
      await repo.saveModelDefaults(defaults)
      defaults.temperature = 999

      const stored = await repo.getModelDefaults()
      expect(stored!.temperature).toBe(0.7)
    })
  })

  describe('RoleModelOverrides', () => {
    it('starts empty', async () => {
      const repo = new MockSettingsRepository()
      expect(await repo.getRoleModelOverrides()).toEqual([])
    })

    it('saveRoleModelOverrides persists and returns defensive copy', async () => {
      const repo = new MockSettingsRepository()
      const overrides: RoleModelOverride[] = [{ roleId: 'role_001', model: 'gpt-4o' }]
      const saved = await repo.saveRoleModelOverrides(overrides)
      saved[0].model = 'hacked'

      const stored = await repo.getRoleModelOverrides()
      expect(stored[0].model).toBe('gpt-4o')
    })

    it('getRoleModelOverrides returns defensive copy of each item', async () => {
      const repo = new MockSettingsRepository()
      await repo.saveRoleModelOverrides([{ roleId: 'role_001', model: 'gpt-4o' }])

      const stored = await repo.getRoleModelOverrides()
      stored[0].roleId = 'evil'
      const again = await repo.getRoleModelOverrides()
      expect(again[0].roleId).toBe('role_001')
    })

    it('saveRoleModelOverrides replaces all overrides', async () => {
      const repo = new MockSettingsRepository()
      await repo.saveRoleModelOverrides([{ roleId: 'a', model: 'm1' }])
      await repo.saveRoleModelOverrides([{ roleId: 'b', model: 'm2' }, { roleId: 'c', model: 'm3' }])

      const stored = await repo.getRoleModelOverrides()
      expect(stored).toHaveLength(2)
      expect(stored.map((o) => o.roleId)).toEqual(['b', 'c'])
    })
  })

  describe('PromptConfigs', () => {
    it('starts empty', async () => {
      const repo = new MockSettingsRepository()
      expect(await repo.getPromptConfigs()).toEqual([])
    })

    it('savePromptConfig inserts and returns defensive copy', async () => {
      const repo = new MockSettingsRepository()
      const input = makePrompt()
      const saved = await repo.savePromptConfig(input)
      saved.content = 'hacked'

      const stored = await repo.getPromptConfigs()
      expect(stored[0].content).toBe('You are helpful.')
    })

    it('savePromptConfig updates existing prompt', async () => {
      const repo = new MockSettingsRepository()
      await repo.savePromptConfig(makePrompt({ promptId: 'p1', version: '1.0.0' }))
      await repo.savePromptConfig(makePrompt({ promptId: 'p1', version: '2.0.0' }))

      const stored = await repo.getPromptConfigs()
      expect(stored).toHaveLength(1)
      expect(stored[0].version).toBe('2.0.0')
    })

    it('getPromptConfigs returns defensive copies', async () => {
      const repo = new MockSettingsRepository()
      await repo.savePromptConfig(makePrompt())

      const stored = await repo.getPromptConfigs()
      stored.length = 0
      const again = await repo.getPromptConfigs()
      expect(again).toHaveLength(1)
    })

    it('constructing args mutation does not pollute internal state', async () => {
      const repo = new MockSettingsRepository()
      const prompt = makePrompt()
      await repo.savePromptConfig(prompt)
      prompt.content = 'injected'

      const stored = await repo.getPromptConfigs()
      expect(stored[0].content).toBe('You are helpful.')
    })
  })

  describe('clearAll', () => {
    it('clears all data', async () => {
      const repo = new MockSettingsRepository()
      await repo.upsertProviderConfig(makeProvider())
      await repo.saveModelDefaults(makeDefaults())
      await repo.saveRoleModelOverrides([{ roleId: 'r1' }])
      await repo.savePromptConfig(makePrompt())

      await repo.clearAll()

      expect(await repo.getProviderConfigs()).toEqual([])
      expect(await repo.getModelDefaults()).toBeNull()
      expect(await repo.getRoleModelOverrides()).toEqual([])
      expect(await repo.getPromptConfigs()).toEqual([])
    })
  })
})

// ─── Repository interface contract checks (compile-time + runtime) ────────────

describe('Repository interface contracts (Task-02)', () => {
  it('VoteRepository exports findBySessionId and clearAll', async () => {
    const { sharedVoteRepo } = await import('@/server/repositories/mock/instances')
    expect(typeof sharedVoteRepo.findBySessionId).toBe('function')
    expect(typeof sharedVoteRepo.clearAll).toBe('function')
  })

  it('SessionRepository exports clearAll', async () => {
    const { sharedSessionRepo } = await import('@/server/repositories/mock/instances')
    expect(typeof sharedSessionRepo.clearAll).toBe('function')
  })

  it('MessageRepository exports clearAll', async () => {
    const { sharedMessageRepo } = await import('@/server/repositories/mock/instances')
    expect(typeof sharedMessageRepo.clearAll).toBe('function')
  })

  it('EventRepository exports clearAll', async () => {
    const { sharedEventRepo } = await import('@/server/repositories/mock/instances')
    expect(typeof sharedEventRepo.clearAll).toBe('function')
  })

  it('SettingsRepository is exported from instances', async () => {
    const { sharedSettingsRepo } = await import('@/server/repositories/mock/instances')
    expect(sharedSettingsRepo).toBeDefined()
    expect(typeof sharedSettingsRepo.getProviderConfigs).toBe('function')
    expect(typeof sharedSettingsRepo.upsertProviderConfig).toBe('function')
    expect(typeof sharedSettingsRepo.getModelDefaults).toBe('function')
    expect(typeof sharedSettingsRepo.saveModelDefaults).toBe('function')
    expect(typeof sharedSettingsRepo.getRoleModelOverrides).toBe('function')
    expect(typeof sharedSettingsRepo.saveRoleModelOverrides).toBe('function')
    expect(typeof sharedSettingsRepo.getPromptConfigs).toBe('function')
    expect(typeof sharedSettingsRepo.savePromptConfig).toBe('function')
    expect(typeof sharedSettingsRepo.clearAll).toBe('function')
  })
})