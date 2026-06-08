/**
 * Integration test: ModelConfigResolver full priority chain
 *
 * Standard: standards/testing/integration.md
 * Exercises: RoleOverride → SessionSnapshot → TemplateDefaults → GlobalDefaults → ProviderDefault
 * All five priority levels tested end-to-end
 */

import { describe, it, expect } from 'vitest'
import { ModelConfigResolver } from '@/server/services/model-config-resolver'
import type {
  GlobalModelDefaults,
  ModelDefaults,
  ModelStrategySnapshot,
  SessionRuntimeConfigSnapshot,
} from '@/types'

const resolver = new ModelConfigResolver()

// ─── Integration: Full five-level priority chain ─────────────────────────────

describe('ModelConfigResolver integration: full priority chain', () => {
  it('when all levels present, roleOverride wins (priority 1)', () => {
    const snap: SessionRuntimeConfigSnapshot = {
      globalDefaults: { providerId: 'openai', model: 'gpt-4o', temperature: 0.7, maxTokens: 512 },
      roleOverrides: [{ roleId: 'role_001', providerId: 'anthropic', model: 'claude-opus-4-7', temperature: 0.3, maxTokens: 4096 }],
      snapshotAt: new Date().toISOString(),
    }
    const strategy: ModelStrategySnapshot = {
      modelStrategyId: 's1', name: 'Fast', selectedByDefault: true,
      defaultModel: 'strategy-model', roleOverrides: {}, fallbackChain: [],
      temperature: 0.5, maxTokens: 256, snapshotAt: new Date().toISOString(),
    }
    const template: ModelDefaults = { defaultModel: 'tpl-model', temperature: 0.6, maxTokens: 384 }
    const global: GlobalModelDefaults = { providerId: 'openai', model: 'global-model', temperature: 0.9, maxTokens: 1024 }

    const result = resolver.resolveForRole('role_001', snap, template, strategy, global, 'provider-default-model')

    expect(result.source).toBe('roleOverride')
    expect(result.providerId).toBe('anthropic')
    expect(result.model).toBe('claude-opus-4-7')
    expect(result.temperature).toBe(0.3)
    expect(result.maxTokens).toBe(4096)
  })

  it('when roleOverride absent, sessionSnapshot wins (priority 2)', () => {
    const snap: SessionRuntimeConfigSnapshot = {
      globalDefaults: { providerId: 'gemini', model: 'gemini-pro', temperature: 0.4, maxTokens: 256 },
      roleOverrides: [],
      snapshotAt: new Date().toISOString(),
    }
    const strategy: ModelStrategySnapshot = {
      modelStrategyId: 's1', name: 'Fast', selectedByDefault: true,
      defaultModel: 'strategy-model', roleOverrides: {}, fallbackChain: [],
      temperature: 0.5, maxTokens: 512, snapshotAt: new Date().toISOString(),
    }
    const template: ModelDefaults = { defaultModel: 'tpl-model', temperature: 0.3, maxTokens: 128 }
    const global: GlobalModelDefaults = { providerId: 'openai', model: 'global-model', temperature: 0.2, maxTokens: 64 }

    const result = resolver.resolveForRole('role_001', snap, template, strategy, global, 'provider-default')

    expect(result.source).toBe('sessionSnapshot')
    expect(result.providerId).toBe('gemini')
    expect(result.model).toBe('gemini-pro')
  })

  it('when no snapshot, strategySnapshot wins (priority 3a)', () => {
    const strategy: ModelStrategySnapshot = {
      modelStrategyId: 's1', name: 'Quality', selectedByDefault: true,
      defaultModel: 'quality-model', roleOverrides: {}, fallbackChain: [],
      temperature: 0.2, maxTokens: 2048, snapshotAt: new Date().toISOString(),
    }
    const template: ModelDefaults = { defaultModel: 'tpl-model', temperature: 0.8, maxTokens: 256 }
    const global: GlobalModelDefaults = { providerId: 'openai', model: 'global-model', temperature: 0.1, maxTokens: 128 }

    const result = resolver.resolveForRole('role_001', undefined, template, strategy, global, 'provider-default')

    expect(result.source).toBe('strategyDefaults')
    expect(result.model).toBe('quality-model')
    expect(result.temperature).toBe(0.2)
  })

  it('when no strategy, templateDefaults wins (priority 3b)', () => {
    const template: ModelDefaults = { defaultModel: 'template-model', temperature: 0.35, maxTokens: 480 }
    const global: GlobalModelDefaults = { providerId: 'openai', model: 'global-model', temperature: 0.9, maxTokens: 64 }

    const result = resolver.resolveForRole('role_001', undefined, template, undefined, global, 'provider-default')

    expect(result.source).toBe('templateDefaults')
    expect(result.model).toBe('template-model')
    expect(result.temperature).toBe(0.35)
  })

  it('when no template, globalDefaults wins (priority 4)', () => {
    const global: GlobalModelDefaults = { providerId: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.7, maxTokens: 512 }
    const emptyTemplate: ModelDefaults = { defaultModel: '', temperature: 0, maxTokens: 0 }

    const result = resolver.resolveForRole('role_001', undefined, emptyTemplate, undefined, global, 'fallback-model')

    expect(result.source).toBe('globalDefaults')
    expect(result.providerId).toBe('anthropic')
    expect(result.model).toBe('claude-sonnet-4-6')
  })

  it('when nothing configured, providerDefault wins (priority 5)', () => {
    const emptyTemplate: ModelDefaults = { defaultModel: '', temperature: 0, maxTokens: 0 }

    const result = resolver.resolveForRole('role_001', undefined, emptyTemplate, undefined, null, 'last-resort-model')

    expect(result.source).toBe('providerDefault')
    expect(result.model).toBe('last-resort-model')
    expect(result.temperature).toBe(0.7)
    expect(result.maxTokens).toBe(512)
  })

  it('result always contains all five fields', () => {
    const snap: SessionRuntimeConfigSnapshot = {
      globalDefaults: { providerId: 'openai', model: 'gpt-4o', temperature: 0.7, maxTokens: 512 },
      roleOverrides: [{ roleId: 'role_001', model: 'claude-opus-4-7' }],
      snapshotAt: new Date().toISOString(),
    }
    const template: ModelDefaults = { defaultModel: 'tpl-model', temperature: 0.6, maxTokens: 384 }

    const result = resolver.resolveForRole('role_001', snap, template, undefined, null, 'pd')

    expect(result).toHaveProperty('providerId')
    expect(result).toHaveProperty('model')
    expect(result).toHaveProperty('temperature')
    expect(result).toHaveProperty('maxTokens')
    expect(result).toHaveProperty('source')
    expect(typeof result.providerId).toBe('string')
    expect(typeof result.model).toBe('string')
    expect(typeof result.temperature).toBe('number')
    expect(typeof result.maxTokens).toBe('number')
  })
})