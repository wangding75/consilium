import { describe, it, expect } from 'vitest'
import { ModelConfigResolver } from '@/server/services/model-config-resolver'
import type {
  GlobalModelDefaults,
  ModelDefaults,
  ModelStrategySnapshot,
  SessionRuntimeConfigSnapshot,
  RoleModelOverride,
} from '@/types'

const resolver = new ModelConfigResolver()

function defaults(overrides?: Partial<GlobalModelDefaults>): GlobalModelDefaults {
  return { providerId: 'openai', model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 512, ...overrides }
}

function snapshot(
  defaults: GlobalModelDefaults,
  overrides?: RoleModelOverride[]
): SessionRuntimeConfigSnapshot {
  return {
    globalDefaults: defaults,
    roleOverrides: overrides ?? [],
    snapshotAt: '2026-06-04T06:00:00.000Z',
  }
}

function strategySnapshot(overrides?: Partial<ModelStrategySnapshot>): ModelStrategySnapshot {
  return {
    modelStrategyId: 'strategy-1',
    name: 'Default',
    selectedByDefault: true,
    defaultModel: 'strategy-default-model',
    roleOverrides: {},
    fallbackChain: [],
    temperature: 0.5,
    maxTokens: 1024,
    snapshotAt: '2026-06-04T00:00:00.000Z',
    ...overrides,
  }
}

const templateDefaults: ModelDefaults = {
  defaultModel: 'template-default-model',
  temperature: 0.6,
  maxTokens: 768,
}

// ─── Task-05: ModelConfigResolver — 五级优先级解析 ───────────────────────────

describe('ModelConfigResolver.resolveForRole', () => {
  // ── Priority 5: providerDefault (lowest) ──────────────────────────────

  it('falls back to provider default when nothing else configured', () => {
    const result = resolver.resolveForRole(
      'role_001',
      undefined,
      { defaultModel: '', temperature: 0, maxTokens: 0 },
      undefined,
      null,
      'default-provider-model'
    )
    expect(result.source).toBe('providerDefault')
    expect(result.model).toBe('default-provider-model')
    expect(result.temperature).toBe(0.7)
    expect(result.maxTokens).toBe(512)
  })

  it('returns empty model when providerDefault is undefined', () => {
    const result = resolver.resolveForRole(
      'role_001',
      undefined,
      { defaultModel: '', temperature: 0, maxTokens: 0 },
      undefined,
      null
    )
    expect(result.source).toBe('providerDefault')
    expect(result.model).toBe('')
  })

  // ── Priority 4: globalDefaults ────────────────────────────────────────

  it('uses globalDefaults when no snapshot or template defaults', () => {
    const result = resolver.resolveForRole(
      'role_001',
      undefined,
      { defaultModel: '', temperature: 0, maxTokens: 0 },
      undefined,
      defaults({ providerId: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.8, maxTokens: 256 })
    )
    expect(result.source).toBe('globalDefaults')
    expect(result.providerId).toBe('anthropic')
    expect(result.model).toBe('claude-sonnet-4-6')
    expect(result.temperature).toBe(0.8)
    expect(result.maxTokens).toBe(256)
  })

  // ── Priority 3b: templateDefaults ─────────────────────────────────────

  it('uses templateDefaults when no snapshot and no global defaults', () => {
    const result = resolver.resolveForRole(
      'role_001',
      undefined,
      templateDefaults,
      undefined,
      null
    )
    expect(result.source).toBe('templateDefaults')
    expect(result.model).toBe('template-default-model')
    expect(result.temperature).toBe(0.6)
    expect(result.maxTokens).toBe(768)
  })

  // ── Priority 3a: strategySnapshot ─────────────────────────────────────

  it('uses strategySnapshot defaultModel when available', () => {
    const result = resolver.resolveForRole(
      'role_001',
      undefined,
      templateDefaults,
      strategySnapshot(),
      null
    )
    expect(result.source).toBe('strategyDefaults')
    expect(result.model).toBe('strategy-default-model')
    expect(result.temperature).toBe(0.5)
    expect(result.maxTokens).toBe(1024)
  })

  it('uses strategySnapshot role override when available', () => {
    const ss = strategySnapshot({
      roleOverrides: {
        role_001: { model: 'role-strategy-model', temperature: 0.3, maxTokens: 2048 },
      },
    })
    const result = resolver.resolveForRole(
      'role_001',
      undefined,
      templateDefaults,
      ss,
      null
    )
    expect(result.source).toBe('strategyDefaults')
    expect(result.model).toBe('role-strategy-model')
    expect(result.temperature).toBe(0.3)
    expect(result.maxTokens).toBe(2048)
  })

  // ── Priority 2: sessionRuntimeConfigSnapshot ──────────────────────────

  it('uses session snapshot global defaults', () => {
    const snap = snapshot(defaults({ providerId: 'gemini', model: 'gemini-pro', temperature: 0.9, maxTokens: 128 }))
    const result = resolver.resolveForRole(
      'role_001',
      snap,
      templateDefaults,
      strategySnapshot(),
      defaults({ providerId: 'openai', model: 'gpt-4o', temperature: 0.7, maxTokens: 512 })
    )
    expect(result.source).toBe('sessionSnapshot')
    expect(result.providerId).toBe('gemini')
    expect(result.model).toBe('gemini-pro')
    expect(result.temperature).toBe(0.9)
    expect(result.maxTokens).toBe(128)
  })

  // ── Priority 1: roleOverride (highest) ────────────────────────────────

  it('uses role-specific override from session snapshot', () => {
    const snap = snapshot(
      defaults({ providerId: 'openai', model: 'gpt-4o', temperature: 0.7, maxTokens: 512 }),
      [{ roleId: 'role_001', model: 'claude-opus-4-7', temperature: 0.3, maxTokens: 4096 }]
    )
    const result = resolver.resolveForRole(
      'role_001',
      snap,
      templateDefaults,
      strategySnapshot(),
      defaults()
    )
    expect(result.source).toBe('roleOverride')
    expect(result.model).toBe('claude-opus-4-7')
    expect(result.temperature).toBe(0.3)
    expect(result.maxTokens).toBe(4096)
  })

  it('roleOverride with providerId uses it instead of snapshot default', () => {
    const snap = snapshot(
      defaults({ providerId: 'openai', model: 'gpt-4o', temperature: 0.7, maxTokens: 512 }),
      [{ roleId: 'role_001', providerId: 'anthropic', model: 'claude-sonnet-4-6' }]
    )
    const result = resolver.resolveForRole('role_001', snap, templateDefaults, undefined, null)
    expect(result.source).toBe('roleOverride')
    expect(result.providerId).toBe('anthropic')
  })

  it('roleOverride without model is NOT applied (no override match)', () => {
    const snap = snapshot(
      defaults({ providerId: 'openai', model: 'gpt-4o', temperature: 0.7, maxTokens: 512 }),
      [{ roleId: 'role_001', temperature: 0.1 }] // no model field → don't match
    )
    const result = resolver.resolveForRole('role_001', snap, templateDefaults, undefined, null)
    // falls through to sessionSnapshot because roleOverride.model is undefined
    expect(result.source).toBe('sessionSnapshot')
    expect(result.model).toBe('gpt-4o')
  })

  // ── Edge cases ────────────────────────────────────────────────────────

  it('roleOverride applies only to matching roleId', () => {
    const snap = snapshot(
      defaults({ providerId: 'openai', model: 'gpt-4o', temperature: 0.7, maxTokens: 512 }),
      [{ roleId: 'role_001', model: 'special-model' }]
    )
    // role_002 should NOT get role_001's override
    const result = resolver.resolveForRole('role_002', snap, templateDefaults, undefined, null)
    expect(result.source).toBe('sessionSnapshot')
    expect(result.model).toBe('gpt-4o')
  })

  it('all fields are present in result', () => {
    const result = resolver.resolveForRole(
      'role_001',
      snapshot(defaults()),
      templateDefaults,
      undefined,
      null
    )
    expect(result).toHaveProperty('providerId')
    expect(result).toHaveProperty('model')
    expect(result).toHaveProperty('temperature')
    expect(result).toHaveProperty('maxTokens')
    expect(result).toHaveProperty('source')
  })

  it('temperature is always a number', () => {
    const result = resolver.resolveForRole('role_001', undefined, { defaultModel: '', temperature: 0, maxTokens: 0 }, undefined, null)
    expect(typeof result.temperature).toBe('number')
    expect(typeof result.maxTokens).toBe('number')
  })

  it('session snapshot with empty roleOverrides falls to snapshot global', () => {
    const snap = snapshot(defaults({ providerId: 'gemini', model: 'gemini-pro', temperature: 0.5, maxTokens: 256 }), [])
    const result = resolver.resolveForRole('role_001', snap, templateDefaults, undefined, null)
    expect(result.source).toBe('sessionSnapshot')
    expect(result.providerId).toBe('gemini')
  })

  it('snapshot without roleOverride.model but with other fields skips override', () => {
    const snap = snapshot(
      defaults({ providerId: 'openai', model: 'global-snap-model', temperature: 0.5, maxTokens: 256 }),
      [{ roleId: 'role_001', temperature: 0.01, maxTokens: 100 } as RoleModelOverride] // no model
    )
    const result = resolver.resolveForRole('role_001', snap, templateDefaults, undefined, null)
    // no model → skip roleOverride → use sessionSnapshot
    expect(result.source).toBe('sessionSnapshot')
    expect(result.model).toBe('global-snap-model')
  })
})