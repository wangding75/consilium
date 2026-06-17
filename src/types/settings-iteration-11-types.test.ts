import { describe, it, expect } from 'vitest'
import type {
  ProviderConnection,
  ProviderType,
  ProviderConnectionTestStatus,
  RoleRuntimeConfig,
  TemplateRoleRuntimeConfig,
  TemplateRuntimeConfig,
  TemplateDefaultStrategy,
  SettingsExportBundle,
  SettingsImportPreview,
} from '@/types'
import type {
  ProviderConnectionDTO,
  CreateProviderConnectionRequest,
  UpdateProviderConnectionRequest,
  ProviderConnectionTestRequest,
  ProviderConnectionTestResult,
  ProviderConnectionDeleteResult,
  ProviderConnectionListResult,
  TemplateSummarySettingsFields,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  CreateTemplateRoleRequest,
  UpdateTemplateRoleRequest,
  DeleteTemplateRoleResult,
  TemplateRoleListResult,
  SettingsImportPreviewResult,
  SettingsImportCommitRequest,
  SettingsImportCommitResult,
  SettingsSessionsExportResult,
  ClearScope,
  TemplateListSettingsResult,
  ApiResponse,
} from '@/types/api'

// ─── Task-01: ProviderConnection 领域类型 ─────────────────────────────────────

describe('ProviderConnection (domain)', () => {
  it('accepts a complete connection with all required fields', () => {
    const conn: ProviderConnection = {
      id: 'conn-001',
      providerType: 'openai',
      displayName: 'My OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      apiKeyRef: 'sk-ref-abc123',
      modelList: ['gpt-4o', 'gpt-4o-mini'],
      customHeaders: { 'X-Org': 'org-123' },
      enabled: true,
      lastTestStatus: 'success',
      lastTestAt: '2026-06-08T00:00:00.000Z',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-08T00:00:00.000Z',
    }
    expect(conn.providerType).toBe('openai')
    expect(conn.displayName).toBe('My OpenAI')
    expect(conn.enabled).toBe(true)
  })

  it('allows minimal connection (untested, no optional fields)', () => {
    const conn: ProviderConnection = {
      id: 'conn-min',
      providerType: 'custom',
      displayName: 'minimal',
      baseUrl: 'http://localhost:8080',
      modelList: [],
      enabled: false,
      lastTestStatus: 'untested',
      createdAt: '2026-06-08T00:00:00.000Z',
      updatedAt: '2026-06-08T00:00:00.000Z',
    }
    expect(conn.lastTestStatus).toBe('untested')
    expect(conn.apiKeyRef).toBeUndefined()
  })

  it('allows all ProviderType union values', () => {
    const types: ProviderType[] = ['openai', 'anthropic', 'gemini', 'deepseek', 'custom']
    expect(types).toHaveLength(5)
  })

  it('lastTestStatus accepts all union values', () => {
    const statuses: ProviderConnectionTestStatus[] = ['untested', 'success', 'failed']
    expect(statuses).toHaveLength(3)
  })

  it('allows error fields on failed connection', () => {
    const conn: ProviderConnection = {
      id: 'conn-fail',
      providerType: 'gemini',
      displayName: 'failed',
      baseUrl: 'https://bad.url',
      modelList: [],
      enabled: true,
      lastTestStatus: 'failed',
      lastTestAt: '2026-06-08T00:00:00.000Z',
      lastErrorCode: 'PROVIDER_AUTH_FAILED',
      lastErrorMessage: 'Invalid API key',
      createdAt: '2026-06-08T00:00:00.000Z',
      updatedAt: '2026-06-08T00:00:00.000Z',
    }
    expect(conn.lastErrorCode).toBe('PROVIDER_AUTH_FAILED')
    expect(conn.lastErrorMessage).toBe('Invalid API key')
  })
})

// ─── Task-01: RoleRuntimeConfig / TemplateRuntimeConfig ────────────────────────

describe('TemplateRuntimeConfig (domain)', () => {
  it('accepts valid TemplateDefaultStrategy', () => {
    const strategies: TemplateDefaultStrategy[] = ['smart_fallback', 'quality_first', 'cost_first']
    expect(strategies).toHaveLength(3)
  })

  it('accepts RoleRuntimeConfig with full fields', () => {
    const cfg: RoleRuntimeConfig = {
      providerConnectionId: 'conn-001',
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 4096,
      maxCharsPerTurn: 2000,
      systemPrompt: 'You are helpful.',
      includedInDefaultQueue: true,
    }
    expect(cfg.model).toBe('gpt-4o')
    expect(cfg.includedInDefaultQueue).toBe(true)
  })

  it('accepts minimal RoleRuntimeConfig (empty)', () => {
    const cfg: RoleRuntimeConfig = {}
    expect(cfg.model).toBeUndefined()
  })

  it('accepts TemplateRoleRuntimeConfig with required fields', () => {
    const cfg: TemplateRoleRuntimeConfig = {
      roleId: 'role-host',
      providerConnectionId: 'conn-001',
      model: 'claude-sonnet-4-6',
      systemPrompt: 'You are the host.',
      includedInDefaultQueue: true,
    }
    expect(cfg.roleId).toBe('role-host')
    expect(cfg.providerConnectionId).toBe('conn-001')
  })

  it('accepts TemplateRuntimeConfig with fallback', () => {
    const cfg: TemplateRuntimeConfig = {
      templateId: 'startup-board',
      defaultStrategy: 'smart_fallback',
      fallbackProviderConnectionId: 'conn-fallback',
      fallbackModel: 'gpt-4o-mini',
      roleConfigs: [],
    }
    expect(cfg.templateId).toBe('startup-board')
    expect(cfg.fallbackProviderConnectionId).toBe('conn-fallback')
  })
})

// ─── Task-01: SettingsExportBundle / SettingsImportPreview ─────────────────────

describe('SettingsExportBundle (domain)', () => {
  it('accepts valid export bundle', () => {
    const bundle: SettingsExportBundle = {
      version: '1.0.0',
      exportedAt: '2026-06-08T00:00:00.000Z',
      includePrompts: true,
      providerConnections: [],
      templateRuntimeConfigs: [],
      prompts: [],
    }
    expect(bundle.version).toBe('1.0.0')
    expect(bundle.includePrompts).toBe(true)
  })

  it('accepts bundle with connections and configs', () => {
    const conn: ProviderConnection = {
      id: 'conn-1',
      providerType: 'openai',
      displayName: 'Test',
      baseUrl: 'https://api.openai.com/v1',
      modelList: ['gpt-4o'],
      enabled: true,
      lastTestStatus: 'success',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const bundle: SettingsExportBundle = {
      version: '1.0.0',
      exportedAt: '2026-06-08T00:00:00.000Z',
      includePrompts: false,
      providerConnections: [conn],
      templateRuntimeConfigs: [],
      prompts: [],
    }
    expect(bundle.providerConnections).toHaveLength(1)
  })
})

describe('SettingsImportPreview (domain)', () => {
  it('accepts valid preview with additions and conflicts', () => {
    const preview: SettingsImportPreview = {
      additions: ['conn-new', 'tpl-new'],
      updates: ['conn-existing'],
      conflicts: ['tpl-conflict'],
      invalidItems: [],
    }
    expect(preview.additions).toHaveLength(2)
    expect(preview.conflicts).toHaveLength(1)
  })

  it('accepts empty preview (nothing to import)', () => {
    const preview: SettingsImportPreview = {
      additions: [],
      updates: [],
      conflicts: [],
      invalidItems: ['bad.json'],
    }
    expect(preview.invalidItems).toHaveLength(1)
  })
})

// ─── Task-01: ProviderConnectionDTO ────────────────────────────────────────────

describe('ProviderConnectionDTO', () => {
  it('has maskedKey instead of apiKeyRef and maskedHeaders', () => {
    const dto: ProviderConnectionDTO = {
      id: 'conn-001',
      providerType: 'openai',
      displayName: 'OpenAI Prod',
      baseUrl: 'https://api.openai.com/v1',
      modelList: ['gpt-4o'],
      enabled: true,
      lastTestStatus: 'success',
      maskedKey: 'sk-***56789',
      maskedHeaders: { 'X-Org': '***' },
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-08T00:00:00.000Z',
    }
    expect(dto.maskedKey).toContain('***')
    expect(dto.maskedHeaders['X-Org']).toBe('***')
  })

  it('allows undefined maskedKey (untested connection)', () => {
    const dto: ProviderConnectionDTO = {
      id: 'conn-002',
      providerType: 'anthropic',
      displayName: 'Claude',
      baseUrl: 'https://api.anthropic.com',
      modelList: [],
      enabled: false,
      lastTestStatus: 'untested',
      maskedHeaders: {},
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    }
    expect(dto.maskedKey).toBeUndefined()
  })
})

// ─── Task-01: Create/Update ProviderConnection requests ────────────────────────

describe('CreateProviderConnectionRequest', () => {
  it('accepts valid create request', () => {
    const req: CreateProviderConnectionRequest = {
      providerType: 'openai',
      displayName: 'New Connection',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-secret-key',
      modelList: ['gpt-4o'],
      customHeaders: { 'X-Org': 'org-id' },
      enabled: true,
    }
    expect(req.providerType).toBe('openai')
    expect(req.apiKey).toBe('sk-secret-key')
  })

  it('accepts minimal create request (no apiKey, no headers)', () => {
    const req: CreateProviderConnectionRequest = {
      providerType: 'custom',
      displayName: 'Local',
      baseUrl: 'http://localhost:11434',
      modelList: [],
      enabled: false,
    }
    expect(req.modelList).toEqual([])
  })
})

describe('UpdateProviderConnectionRequest', () => {
  it('accepts partial update (name only)', () => {
    const req: UpdateProviderConnectionRequest = { displayName: 'Renamed' }
    expect(req.displayName).toBe('Renamed')
    expect(req.baseUrl).toBeUndefined()
  })

  it('accepts full update', () => {
    const req: UpdateProviderConnectionRequest = {
      displayName: 'Updated',
      baseUrl: 'https://new.url',
      apiKey: 'sk-new-key',
      modelList: ['gpt-4o', 'gpt-4o-mini'],
      customHeaders: {},
      enabled: true,
    }
    expect(req.modelList).toHaveLength(2)
  })
})

// ─── Task-01: ProviderConnectionTestRequest / ProviderConnectionTestResult ─────

describe('ProviderConnectionTestRequest', () => {
  it('accepts test request without model', () => {
    const req: ProviderConnectionTestRequest = {
      providerType: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
    }
    expect(req.providerType).toBe('openai')
    expect(req.model).toBeUndefined()
  })

  it('accepts test request with model and custom headers', () => {
    const req: ProviderConnectionTestRequest = {
      providerType: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'sk-test',
      model: 'claude-sonnet-4-6',
      customHeaders: { 'X-Custom': 'value' },
    }
    expect(req.model).toBe('claude-sonnet-4-6')
    expect(req.customHeaders).toEqual({ 'X-Custom': 'value' })
  })
})

describe('ProviderConnectionTestResult', () => {
  it('accepts success result with available models', () => {
    const result: ProviderConnectionTestResult = {
      status: 'success',
      latencyMs: 234,
      checkedAt: '2026-06-08T00:00:00.000Z',
      availableModels: ['gpt-4o', 'gpt-4o-mini'],
      maskedKey: 'sk-***12345',
    }
    expect(result.status).toBe('success')
    expect(result.availableModels).toHaveLength(2)
  })

  it('accepts failed result with error codes (no plaintext key)', () => {
    const result: ProviderConnectionTestResult = {
      status: 'failed',
      latencyMs: 5000,
      checkedAt: '2026-06-08T00:00:00.000Z',
      availableModels: [],
      errorCode: 'PROVIDER_AUTH_FAILED',
      errorMessage: 'Invalid API key',
    }
    expect(result.errorCode).toBe('PROVIDER_AUTH_FAILED')
  })
})

describe('ProviderConnectionDeleteResult', () => {
  it('returns deleted connection id', () => {
    const result: ProviderConnectionDeleteResult = { deletedConnectionId: 'conn-001' }
    expect(result.deletedConnectionId).toBe('conn-001')
  })
})

describe('ProviderConnectionListResult', () => {
  it('wraps connections array', () => {
    const result: ProviderConnectionListResult = { connections: [] }
    expect(result.connections).toEqual([])
  })
})

// ─── Task-01: TemplateSummarySettingsFields ────────────────────────────────────

describe('TemplateSummarySettingsFields', () => {
  it('has defaultStrategy and configStatus', () => {
    const fields: TemplateSummarySettingsFields = {
      defaultStrategy: 'smart_fallback',
      configStatus: 'customized',
    }
    expect(fields.defaultStrategy).toBe('smart_fallback')
    expect(fields.configStatus).toBe('customized')
  })

  it('configStatus allows default', () => {
    const fields: TemplateSummarySettingsFields = {
      defaultStrategy: 'quality_first',
      configStatus: 'default',
    }
    expect(fields.configStatus).toBe('default')
  })
})

// ─── Task-01: CreateTemplateRequest / UpdateTemplateRequest ────────────────────

describe('CreateTemplateRequest', () => {
  it('accepts valid create request with category', () => {
    const req: CreateTemplateRequest = {
      name: 'New Template',
      description: 'A test template',
      category: 'brainstorm',
      defaultStrategy: 'quality_first',
    }
    expect(req.name).toBe('New Template')
    expect(req.category).toBe('brainstorm')
  })

  it('accepts minimal create request (no category)', () => {
    const req: CreateTemplateRequest = {
      name: 'Minimal',
      description: 'desc',
      defaultStrategy: 'cost_first',
    }
    expect(req.category).toBeUndefined()
  })
})

describe('UpdateTemplateRequest', () => {
  it('accepts partial update (name only)', () => {
    const req: UpdateTemplateRequest = { name: 'Renamed Template' }
    expect(req.name).toBe('Renamed Template')
  })

  it('accepts fallback config update', () => {
    const req: UpdateTemplateRequest = {
      fallbackProviderConnectionId: 'conn-fb',
      fallbackModel: 'gpt-4o-mini',
    }
    expect(req.fallbackProviderConnectionId).toBe('conn-fb')
  })
})

// ─── Task-01: CreateTemplateRoleRequest / UpdateTemplateRoleRequest ────────────

describe('CreateTemplateRoleRequest', () => {
  it('accepts full role create request', () => {
    const req: CreateTemplateRoleRequest = {
      name: 'Expert',
      persona: 'Domain expert',
      systemPrompt: 'You are an expert.',
      providerConnectionId: 'conn-001',
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 4096,
      includedInDefaultQueue: true,
      enabled: true,
    }
    expect(req.name).toBe('Expert')
    expect(req.enabled).toBe(true)
  })

  it('accepts minimal role create (only required fields)', () => {
    const req: CreateTemplateRoleRequest = {
      name: 'Critic',
      persona: 'Critical reviewer',
      systemPrompt: 'Review everything.',
      providerConnectionId: 'conn-002',
      model: 'claude-sonnet-4-6',
    }
    expect(req.includedInDefaultQueue).toBeUndefined()
    expect(req.enabled).toBeUndefined()
  })
})

describe('UpdateTemplateRoleRequest', () => {
  it('accepts partial role update (enabled only)', () => {
    const req: UpdateTemplateRoleRequest = { enabled: false }
    expect(req.enabled).toBe(false)
  })

  it('accepts full role update', () => {
    const req: UpdateTemplateRoleRequest = {
      name: 'Updated Role',
      persona: 'Updated persona',
      systemPrompt: 'Updated prompt',
      providerConnectionId: 'conn-003',
      model: 'gemini-pro',
      temperature: 1.0,
      maxTokens: 8192,
      includedInDefaultQueue: false,
      enabled: true,
    }
    expect(req.model).toBe('gemini-pro')
  })
})

describe('DeleteTemplateRoleResult', () => {
  it('returns deleted role id', () => {
    const result: DeleteTemplateRoleResult = { deletedRoleId: 'role-001' }
    expect(result.deletedRoleId).toBe('role-001')
  })
})

describe('TemplateRoleListResult', () => {
  it('has templateId, templateVersion, and roles', () => {
    const result: TemplateRoleListResult = {
      templateId: 'startup-board',
      templateVersion: '1.0.0',
      roles: [],
    }
    expect(result.templateId).toBe('startup-board')
    expect(result.roles).toEqual([])
  })
})

// ─── Task-01: SettingsImportPreviewResult / ImportCommit ───────────────────────

describe('SettingsImportPreviewResult', () => {
  it('extends SettingsImportPreview with previewToken', () => {
    const result: SettingsImportPreviewResult = {
      additions: ['conn-a'],
      updates: [],
      conflicts: ['tpl-x'],
      invalidItems: [],
      previewToken: 'preview-token-abc123',
    }
    expect(result.previewToken).toBe('preview-token-abc123')
  })
})

describe('SettingsImportCommitRequest', () => {
  it('requires bundle, previewToken, and overwrite', () => {
    const req: SettingsImportCommitRequest = {
      bundle: {
        version: '1.0.0',
        exportedAt: '2026-06-08T00:00:00.000Z',
        includePrompts: false,
        providerConnections: [],
        templateRuntimeConfigs: [],
        prompts: [],
      },
      previewToken: 'preview-token-abc',
      overwrite: false,
    }
    expect(req.previewToken).toBe('preview-token-abc')
    expect(req.overwrite).toBe(false)
  })
})

describe('SettingsImportCommitResult', () => {
  it('tallies imported counts', () => {
    const result: SettingsImportCommitResult = {
      importedConnections: 2,
      importedTemplates: 3,
      importedPrompts: 1,
    }
    expect(result.importedConnections).toBe(2)
    expect(result.importedTemplates).toBe(3)
  })
})

// ─── Task-01: SettingsSessionsExportResult / ClearScope ────────────────────────

describe('SettingsSessionsExportResult', () => {
  it('has filename, content, sessionCount, sanitized', () => {
    const result: SettingsSessionsExportResult = {
      filename: 'sessions-export-20260608.md',
      content: '# Sessions\n\n...',
      sessionCount: 5,
      sanitized: true,
    }
    expect(result.sessionCount).toBe(5)
    expect(result.sanitized).toBe(true)
  })
})

describe('ClearScope', () => {
  it('allows cache, sessions, settings, all', () => {
    const scopes: ClearScope[] = ['cache', 'sessions', 'settings', 'all']
    expect(scopes).toHaveLength(4)
  })
})

// ─── Task-01: TemplateListSettingsResult ───────────────────────────────────────

describe('TemplateListSettingsResult', () => {
  it('wraps templates with settings fields', () => {
    const result: TemplateListSettingsResult = { templates: [] }
    expect(result.templates).toEqual([])
  })
})

// ─── Task-01: ApiResponse wrapper for iteration-11 DTOs ────────────────────────

describe('ApiResponse for iteration-11 DTOs', () => {
  it('ApiResponse<ProviderConnectionDTO> success shape compiles', () => {
    const resp: ApiResponse<ProviderConnectionDTO> = {
      success: true,
      data: {
        id: 'conn-1',
        providerType: 'openai',
        displayName: 'Test',
        baseUrl: 'https://api.openai.com/v1',
        modelList: ['gpt-4o'],
        enabled: true,
        lastTestStatus: 'success',
        maskedHeaders: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      requestId: 'req-123',
    }
    expect(resp.success).toBe(true)
    expect(resp.data?.id).toBe('conn-1')
  })

  it('ApiResponse<ProviderConnectionTestResult> error shape compiles', () => {
    const resp: ApiResponse<ProviderConnectionTestResult> = {
      success: false,
      data: null,
      error: { code: 'PROVIDER_AUTH_FAILED', message: 'Invalid API key' },
      requestId: 'req-err',
    }
    expect(resp.success).toBe(false)
    expect(resp.error?.code).toBe('PROVIDER_AUTH_FAILED')
  })
})