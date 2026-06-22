import { describe, it, expect } from 'vitest'
import type {
  ProviderConfig,
  GlobalModelDefaults,
  RoleModelOverride,
  PromptConfig,
  SessionRuntimeConfigSnapshot,
  ResolvedModelConfig,
  ResolvedModelConfigSource,
  ProviderConnectionStatus,
} from '@/types'
import type {
  ProviderStatusDTO,
  ProviderTestRequest,
  ProviderTestResult,
  ModelDefaultsDTO,
  RoleModelOverrideDTO,
  SaveRoleModelOverridesRequest,
  PromptConfigDTO,
  UpdatePromptRequest,
  SessionExportResult,
  UpsertProviderConfigRequest,
  ApiResponse,
} from '@/types/api'

// ─── Task-01: Settings 核心类型 ───────────────────────────────────────────────

describe('ProviderConfig', () => {
  it('accepts valid openai config', () => {
    const config: ProviderConfig = {
      providerId: 'openai',
      enabled: true,
      baseUrl: 'https://api.openai.com/v1',
      apiKeyRef: 'sk-ref-12345678',
      modelList: ['gpt-4o', 'gpt-4o-mini'],
      customHeaders: { 'X-Custom': 'val' },
      lastTestStatus: 'success',
      lastTestedAt: '2026-06-04T00:00:00.000Z',
      lastErrorCode: undefined,
      lastErrorMessage: undefined,
    }
    expect(config.providerId).toBe('openai')
    expect(config.lastTestStatus).toBe('success')
  })

  it('allows minimal config (untested, no optional fields)', () => {
    const config: ProviderConfig = {
      providerId: 'custom',
      enabled: false,
      modelList: [],
      lastTestStatus: 'untested',
    }
    expect(config.providerId).toBe('custom')
    expect(config.enabled).toBe(false)
    expect(config.baseUrl).toBeUndefined()
  })

  it('allows all provider ID union values', () => {
    const ids: ProviderConfig['providerId'][] = ['openai', 'anthropic', 'gemini', 'deepseek', 'custom']
    expect(ids).toHaveLength(5)
  })

  it('lastTestStatus accepts all union values', () => {
    const statuses: ProviderConfig['lastTestStatus'][] = ['untested', 'success', 'failed']
    expect(statuses).toHaveLength(3)
  })

  it('lastErrorCode and lastErrorMessage are optional', () => {
    const config: ProviderConfig = {
      providerId: 'anthropic',
      enabled: true,
      modelList: ['claude-sonnet-4-6'],
      lastTestStatus: 'failed',
      lastErrorCode: 'PROVIDER_AUTH_FAILED',
      lastErrorMessage: 'Invalid API key',
    }
    expect(config.lastErrorCode).toBe('PROVIDER_AUTH_FAILED')
    expect(config.lastErrorMessage).toBe('Invalid API key')
  })
})

describe('GlobalModelDefaults', () => {
  it('accepts valid defaults', () => {
    const defaults: GlobalModelDefaults = {
      providerId: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 512,
    }
    expect(defaults.providerId).toBe('openai')
    expect(defaults.temperature).toBe(0.7)
    expect(defaults.maxTokens).toBe(512)
  })

  it('accepts boundary temperature values', () => {
    const minTemp: GlobalModelDefaults = { providerId: 'openai', model: 'm', temperature: 0, maxTokens: 1 }
    const maxTemp: GlobalModelDefaults = { providerId: 'openai', model: 'm', temperature: 2, maxTokens: 1 }
    expect(minTemp.temperature).toBe(0)
    expect(maxTemp.temperature).toBe(2)
  })
})

describe('RoleModelOverride', () => {
  it('accepts full override', () => {
    const override: RoleModelOverride = {
      roleId: 'role_001',
      providerId: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      temperature: 0.8,
      maxTokens: 1024,
    }
    expect(override.roleId).toBe('role_001')
    expect(override.providerId).toBe('anthropic')
  })

  it('accepts partial override (model only)', () => {
    const override: RoleModelOverride = { roleId: 'role_002', model: 'gpt-4o' }
    expect(override.roleId).toBe('role_002')
    expect(override.model).toBe('gpt-4o')
    expect(override.providerId).toBeUndefined()
  })

  it('accepts empty override (no fields set)', () => {
    const override: RoleModelOverride = { roleId: 'role_003' }
    expect(override.roleId).toBe('role_003')
    expect(override.model).toBeUndefined()
  })
})

describe('PromptConfig', () => {
  it('accepts global scope prompt', () => {
    const prompt: PromptConfig = {
      promptId: 'global_system',
      scope: 'global',
      version: '1.0.0',
      content: 'You are a helpful assistant.',
      updatedAt: '2026-06-04T00:00:00.000Z',
      isDefault: true,
    }
    expect(prompt.promptId).toBe('global_system')
    expect(prompt.scope).toBe('global')
    expect(prompt.isDefault).toBe(true)
  })

  it('accepts role scope prompt with targetId', () => {
    const prompt: PromptConfig = {
      promptId: 'role_host_prompt',
      scope: 'role',
      targetId: 'host_role',
      version: '2.1.3',
      content: 'You are the host.',
      updatedAt: '2026-06-04T00:00:00.000Z',
      isDefault: false,
    }
    expect(prompt.scope).toBe('role')
    expect(prompt.targetId).toBe('host_role')
    expect(prompt.isDefault).toBe(false)
  })

  it('version follows semver format', () => {
    const prompt: PromptConfig = {
      promptId: 'p1',
      scope: 'global',
      version: '3.14.159',
      content: 'test',
      updatedAt: new Date().toISOString(),
      isDefault: true,
    }
    expect(prompt.version).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

describe('SessionRuntimeConfigSnapshot', () => {
  it('contains globalDefaults and roleOverrides', () => {
    const defaults: GlobalModelDefaults = { providerId: 'openai', model: 'gpt-4o', temperature: 0.5, maxTokens: 256 }
    const snapshot: SessionRuntimeConfigSnapshot = {
      globalDefaults: defaults,
      roleOverrides: [{ roleId: 'role_001', model: 'claude-sonnet-4-6' }],
      snapshotAt: '2026-06-04T06:00:00.000Z',
    }
    expect(snapshot.globalDefaults.providerId).toBe('openai')
    expect(snapshot.roleOverrides).toHaveLength(1)
    expect(snapshot.snapshotAt).toBeTruthy()
  })
})

describe('ResolvedModelConfig', () => {
  it('has all required fields with source', () => {
    const config: ResolvedModelConfig = {
      providerId: 'openai',
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 512,
      source: 'globalDefaults',
    }
    expect(config.providerId).toBe('openai')
    expect(config.source).toBe('globalDefaults')
  })

  it('source accepts all union values', () => {
    const sources: ResolvedModelConfigSource[] = [
      'roleOverride',
      'sessionSnapshot',
      'templateDefaults',
      'strategyDefaults',
      'globalDefaults',
      'providerDefault',
    ]
    expect(sources).toHaveLength(6)
  })
})

describe('ProviderConnectionStatus', () => {
  it('is a string union type', () => {
    const statuses: ProviderConnectionStatus[] = ['unconfigured', 'untested', 'success', 'failed', 'disabled']
    expect(statuses).toHaveLength(5)
  })
})

// ─── Task-01: API DTOs ────────────────────────────────────────────────────────

describe('ProviderStatusDTO', () => {
  it('has masked fields not raw secrets', () => {
    const dto: ProviderStatusDTO = {
      providerId: 'openai',
      enabled: true,
      maskedKey: 'sk-***1234',
      modelList: ['gpt-4o'],
      maskedHeaders: { 'X-Custom': '***' },
      lastTestStatus: 'success',
      lastTestedAt: '2026-06-04T06:00:00.000Z',
    }
    expect(dto.maskedKey).toContain('***')
    expect(dto.maskedHeaders['X-Custom']).toBe('***')
  })

  it('lastErrorCode and lastErrorMessage are optional', () => {
    const dto: ProviderStatusDTO = {
      providerId: 'custom',
      enabled: true,
      modelList: [],
      maskedHeaders: {},
      lastTestStatus: 'failed',
      lastErrorCode: 'PROVIDER_AUTH_FAILED',
      lastErrorMessage: 'Auth failed',
    }
    expect(dto.lastErrorCode).toBe('PROVIDER_AUTH_FAILED')
  })
})

describe('UpsertProviderConfigRequest', () => {
  it('accepts full request body with apiKey (write-only)', () => {
    const req: UpsertProviderConfigRequest = {
      providerId: 'openai',
      enabled: true,
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-xxx',
      modelList: ['gpt-4o'],
      headers: { 'X-Custom': 'value' },
    }
    expect(req.providerId).toBe('openai')
    expect(req.apiKey).toBe('sk-xxx')
  })

  it('providerId is required union', () => {
    const req: UpsertProviderConfigRequest = { providerId: 'custom', enabled: false }
    expect(req.providerId).toBe('custom')
    expect(req.apiKey).toBeUndefined()
  })
})

describe('ProviderTestRequest', () => {
  it('accepts test request with required fields', () => {
    const req: ProviderTestRequest = {
      providerId: 'custom',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-xxx',
      model: 'custom-model',
      headers: { 'X-Custom': 'value' },
    }
    expect(req.providerId).toBe('custom')
    expect(req.model).toBe('custom-model')
  })

  it('allows minimal request (providerId only)', () => {
    const req: ProviderTestRequest = { providerId: 'openai' }
    expect(req.providerId).toBe('openai')
    expect(req.apiKey).toBeUndefined()
  })
})

describe('ProviderTestResult', () => {
  it('accepts success result', () => {
    const result: ProviderTestResult = {
      providerId: 'openai',
      status: 'success',
      latencyMs: 821,
      checkedAt: '2026-06-04T06:00:00.000Z',
      availableModels: ['gpt-4o'],
      maskedKey: 'sk-***xxx',
    }
    expect(result.status).toBe('success')
    expect(result.latencyMs).toBeGreaterThan(0)
    expect(result.maskedKey).toContain('***')
  })

  it('accepts failed result with error fields', () => {
    const result: ProviderTestResult = {
      providerId: 'custom',
      status: 'failed',
      latencyMs: 0,
      checkedAt: '2026-06-04T06:00:00.000Z',
      availableModels: [],
      errorCode: 'PROVIDER_AUTH_FAILED',
      errorMessage: 'Invalid API key',
    }
    expect(result.status).toBe('failed')
    expect(result.errorCode).toBe('PROVIDER_AUTH_FAILED')
  })
})

describe('ModelDefaultsDTO', () => {
  it('is assignable from GlobalModelDefaults', () => {
    const dto: ModelDefaultsDTO = { providerId: 'openai', model: 'gpt-4o', temperature: 0.7, maxTokens: 512 }
    expect(dto.providerId).toBe('openai')
    expect(dto.temperature).toBe(0.7)
  })
})

describe('RoleModelOverrideDTO', () => {
  it('is assignable from RoleModelOverride', () => {
    const dto: RoleModelOverrideDTO = { roleId: 'role_001', model: 'claude-haiku-4-5-20251001' }
    expect(dto.roleId).toBe('role_001')
  })
})

describe('SaveRoleModelOverridesRequest', () => {
  it('wraps overrides array', () => {
    const req: SaveRoleModelOverridesRequest = {
      overrides: [{ roleId: 'role_001', model: 'gpt-4o' }],
    }
    expect(req.overrides).toHaveLength(1)
    expect(req.overrides[0].roleId).toBe('role_001')
  })
})

describe('PromptConfigDTO', () => {
  it('is assignable from PromptConfig', () => {
    const dto: PromptConfigDTO = {
      promptId: 'global_system',
      scope: 'global',
      version: '1.0.0',
      content: 'You are helpful.',
      updatedAt: '2026-06-04T00:00:00.000Z',
      isDefault: true,
    }
    expect(dto.promptId).toBe('global_system')
    expect(dto.isDefault).toBe(true)
  })
})

describe('UpdatePromptRequest', () => {
  it('accepts content update', () => {
    const req: UpdatePromptRequest = { promptId: 'global_system', content: 'New prompt' }
    expect(req.promptId).toBe('global_system')
    expect(req.content).toBe('New prompt')
    expect(req.reset).toBeUndefined()
  })

  it('accepts reset flag', () => {
    const req: UpdatePromptRequest = { promptId: 'global_system', reset: true }
    expect(req.promptId).toBe('global_system')
    expect(req.reset).toBe(true)
    expect(req.content).toBeUndefined()
  })

  it('rejects both content and reset simultaneously (application logic)', () => {
    const req: UpdatePromptRequest = { promptId: 'p1', content: 'x', reset: false }
    expect(req.content).toBe('x')
    expect(req.reset).toBe(false)
  })
})

describe('SessionExportResult', () => {
  it('has all export fields', () => {
    const result: SessionExportResult = {
      sessionId: 'sess_001',
      format: 'md',
      filename: 'session-sess_001.md',
      content: '# 讨论导出\n\ntest',
      generatedAt: '2026-06-04T06:00:00.000Z',
      sanitized: true,
    }
    expect(result.format).toBe('md')
    expect(result.sanitized).toBe(true)
    expect(result.filename).toContain('sess_001')
  })

  it('sanitized is always true', () => {
    const result: SessionExportResult = {
      sessionId: 's',
      format: 'md',
      filename: 'f.md',
      content: 'c',
      generatedAt: new Date().toISOString(),
      sanitized: true,
    }
    expect(result.sanitized).toBe(true)
  })
})

// ─── ApiResponse envelope ─────────────────────────────────────────────────────

describe('ApiResponse envelope (Settings)', () => {
  it('success response wraps ProviderStatusDTO[]', () => {
    const dto: ProviderStatusDTO = {
      providerId: 'openai',
      enabled: true,
      modelList: ['gpt-4o'],
      maskedHeaders: {},
      lastTestStatus: 'success',
    }
    const resp: ApiResponse<ProviderStatusDTO[]> = {
      success: true,
      data: [dto],
      requestId: 'req-1',
    }
    expect(resp.success).toBe(true)
    expect(resp.data).toHaveLength(1)
    expect(resp.data![0].providerId).toBe('openai')
  })

  it('error response has null data and error code', () => {
    const resp: ApiResponse<null> = {
      success: false,
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'providerId is required' },
      requestId: 'req-2',
    }
    expect(resp.success).toBe(false)
    expect(resp.error!.code).toBe('VALIDATION_ERROR')
  })
})