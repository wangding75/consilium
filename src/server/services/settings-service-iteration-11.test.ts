import { describe, it, expect } from 'vitest'
import type { SettingsRepository } from '@/server/repositories/settings.repository'
import { SettingsService } from '@/server/services/settings.service'
import { MockSettingsRepository } from '@/server/repositories/mock/mock-settings.repository'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockMessageRepository } from '@/server/repositories/mock/mock-message.repository'
import { MockEventRepository } from '@/server/repositories/mock/mock-event.repository'
import { MockVoteRepository } from '@/server/repositories/mock/mock-vote.repository'
import type { ProviderConnection, SettingsExportBundle, TemplateRuntimeConfig } from '@/types'
import type {
  ProviderConnectionTestRequest,
  SettingsImportCommitRequest,
  ClearScope,
} from '@/types/api'
import { ServiceError } from '@/server/errors'

function makeService(repo: SettingsRepository = new MockSettingsRepository()) {
  return new SettingsService(
    repo,
    new MockSessionRepository(),
    new MockMessageRepository(),
    new MockEventRepository(),
    new MockVoteRepository()
  )
}

function makeConnection(overrides?: Partial<ProviderConnection>): ProviderConnection {
  return {
    id: 'conn-001',
    providerType: 'openai',
    displayName: 'Test Connection',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyRef: 'sk-ref-test',
    modelList: ['gpt-4o'],
    enabled: true,
    lastTestStatus: 'success',
    createdAt: '2026-06-08T00:00:00.000Z',
    updatedAt: '2026-06-08T00:00:00.000Z',
    ...overrides,
  }
}

function makeRuntimeConfig(overrides?: Partial<TemplateRuntimeConfig>): TemplateRuntimeConfig {
  return {
    templateId: 'startup-board',
    defaultStrategy: 'smart_fallback',
    roleConfigs: [
      {
        roleId: 'ceo-host',
        providerConnectionId: 'conn-001',
        model: 'gpt-4o',
        systemPrompt: 'You are a CEO.',
        includedInDefaultQueue: true,
      },
    ],
    ...overrides,
  }
}

function makeBundle(overrides?: Partial<SettingsExportBundle>): SettingsExportBundle {
  return {
    version: '1.0.0',
    exportedAt: '2026-06-08T00:00:00.000Z',
    includePrompts: false,
    providerConnections: [],
    templateRuntimeConfigs: [],
    prompts: [],
    ...overrides,
  }
}

// ─── SettingsRepository contract shape check ───────────────────────────────────

describe('SettingsRepository interface (contract check)', () => {
  it('declares getProviderConnections', () => {
    const repo: SettingsRepository = new MockSettingsRepository()
    expect(typeof repo.getProviderConnections).toBe('function')
  })

  it('declares getProviderConnectionById', () => {
    const repo: SettingsRepository = new MockSettingsRepository()
    expect(typeof repo.getProviderConnectionById).toBe('function')
  })

  it('declares saveProviderConnection', () => {
    const repo: SettingsRepository = new MockSettingsRepository()
    expect(typeof repo.saveProviderConnection).toBe('function')
  })

  it('declares deleteProviderConnection', () => {
    const repo: SettingsRepository = new MockSettingsRepository()
    expect(typeof repo.deleteProviderConnection).toBe('function')
  })

  it('declares getTemplateRuntimeConfigs', () => {
    const repo: SettingsRepository = new MockSettingsRepository()
    expect(typeof repo.getTemplateRuntimeConfigs).toBe('function')
  })

  it('declares saveTemplateRuntimeConfigs', () => {
    const repo: SettingsRepository = new MockSettingsRepository()
    expect(typeof repo.saveTemplateRuntimeConfigs).toBe('function')
  })

  it('declares saveImportPreview', () => {
    const repo: SettingsRepository = new MockSettingsRepository()
    expect(typeof repo.saveImportPreview).toBe('function')
  })

  it('declares getImportPreview', () => {
    const repo: SettingsRepository = new MockSettingsRepository()
    expect(typeof repo.getImportPreview).toBe('function')
  })

  it('declares deleteImportPreview', () => {
    const repo: SettingsRepository = new MockSettingsRepository()
    expect(typeof repo.deleteImportPreview).toBe('function')
  })

  it('retains legacy provider config methods', () => {
    const repo: SettingsRepository = new MockSettingsRepository()
    expect(typeof repo.getProviderConfigs).toBe('function')
    expect(typeof repo.upsertProviderConfig).toBe('function')
    expect(typeof repo.getModelDefaults).toBe('function')
    expect(typeof repo.saveModelDefaults).toBe('function')
  })
})

// ─── SettingsService.listProviderConnections (existing skeleton) ───────────────

describe('SettingsService.listProviderConnections', () => {
  it('returns connection list with correct DTO shape', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveProviderConnection(makeConnection())
    const svc = makeService(repo)
    const result = await svc.listProviderConnections()
    expect(result.connections).toHaveLength(1)
    expect(result.connections[0].id).toBe('conn-001')
  })

  it('returns empty list when no connections exist', async () => {
    const svc = makeService()
    const result = await svc.listProviderConnections()
    expect(result.connections).toEqual([])
  })

  it('DTO has maskedKey not raw apiKeyRef', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveProviderConnection(makeConnection({ apiKeyRef: 'sk-secret-full-key' }))
    const svc = makeService(repo)
    const result = await svc.listProviderConnections()
    const dto = result.connections[0]
    expect(dto.maskedKey).toBeDefined()
    expect(dto.maskedKey).toContain('***')
    expect(dto.maskedKey).not.toBe('sk-secret-full-key')
  })

  it('DTO has maskedHeaders with values replaced', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveProviderConnection(makeConnection({ customHeaders: { 'X-Secret': 'plaintext-value' } }))
    const svc = makeService(repo)
    const result = await svc.listProviderConnections()
    expect(result.connections[0].maskedHeaders['X-Secret']).toBe('***')
  })
})

// ─── SettingsService provider connection mutations ───────────────────────────

describe('SettingsService provider connection mutations', () => {
  it('creates, updates, and deletes a provider connection', async () => {
    const repo = new MockSettingsRepository()
    const svc = makeService(repo)

    const created = await svc.createProviderConnection({
      providerType: 'openai',
      displayName: 'Created Connection',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-valid',
      modelList: ['gpt-4o'],
      enabled: true,
    })
    expect(created.displayName).toBe('Created Connection')

    const updated = await svc.updateProviderConnection(created.id, { displayName: 'Updated Connection' })
    expect(updated.displayName).toBe('Updated Connection')

    await expect(svc.deleteProviderConnection(created.id)).resolves.toEqual({ deletedConnectionId: created.id })
  })

  it('tests unsaved and saved provider connections', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveProviderConnection(makeConnection({ apiKeyRef: 'sk-valid', lastTestStatus: 'untested' }))
    const svc = makeService(repo)

    await expect(svc.testProviderConnection({
      providerType: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-valid',
      model: 'gpt-4o',
    })).resolves.toMatchObject({ status: 'success' })

    await expect(svc.testSavedProviderConnection('conn-001')).resolves.toMatchObject({ status: 'success' })
  })
})

// ─── SettingsService.exportSettings ─────────────────────────────────────────────

describe('SettingsService.exportSettings', () => {
  it('returns persisted provider connections, runtime configs, and prompts', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveProviderConnection(makeConnection())
    await repo.saveTemplateRuntimeConfigs([makeRuntimeConfig()])
    await repo.savePromptConfig({
      promptId: 'prompt-001',
      scope: 'global',
      version: '1.0.0',
      content: 'Prompt content',
      updatedAt: '2026-06-08T00:00:00.000Z',
      isDefault: false,
    })

    const svc = makeService(repo)
    const result = await svc.exportSettings()

    expect(result.version).toBe('1.0.0')
    expect(result.providerConnections).toHaveLength(1)
    expect(result.providerConnections[0].id).toBe('conn-001')
    expect(result.templateRuntimeConfigs).toHaveLength(1)
    expect(result.templateRuntimeConfigs[0].templateId).toBe('startup-board')
    expect(result.prompts).toHaveLength(1)
    expect(result.includePrompts).toBe(true)
  })
})

// ─── SettingsService.previewImportSettings ──────────────────────────────────────

describe('SettingsService.previewImportSettings', () => {
  it('returns additions and stores preview token for a new bundle', async () => {
    const repo = new MockSettingsRepository()
    const svc = makeService(repo)
    const bundle = makeBundle({ providerConnections: [makeConnection()] })

    const result = await svc.previewImportSettings({
      bundle,
      fileName: 'settings.json',
    })

    expect(result.previewToken).toBeTruthy()
    expect(result.additions).toContain('provider:conn-001')
    expect(result.conflicts).toEqual([])

    const saved = await repo.getImportPreview(result.previewToken)
    expect(saved?.bundle.providerConnections).toHaveLength(1)
  })

  it('marks existing ids as conflicts', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveProviderConnection(makeConnection())
    const svc = makeService(repo)

    const result = await svc.previewImportSettings({
      bundle: makeBundle({ providerConnections: [makeConnection({ displayName: 'Updated Connection' })] }),
      fileName: 'settings.json',
    })

    expect(result.updates).toContain('provider:conn-001')
    expect(result.conflicts).toContain('provider:conn-001')
  })
})

// ─── SettingsService.importSettings ─────────────────────────────────────────────

describe('SettingsService.importSettings', () => {
  it('imports a previewed bundle and consumes the preview token', async () => {
    const repo = new MockSettingsRepository()
    const svc = makeService(repo)
    const bundle = makeBundle({ providerConnections: [makeConnection()] })
    const preview = await svc.previewImportSettings({ bundle, fileName: 'settings.json' })

    const req: SettingsImportCommitRequest = {
      bundle,
      previewToken: preview.previewToken,
      overwrite: false,
    }

    const result = await svc.importSettings(req)

    expect(result).toEqual({
      importedConnections: 1,
      importedTemplates: 0,
      importedPrompts: 0,
    })
    expect((await repo.getProviderConnectionById('conn-001'))?.displayName).toBe('Test Connection')
    expect(await repo.getImportPreview(preview.previewToken)).toBeNull()
  })

  it('rejects conflicting import when overwrite is false', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveProviderConnection(makeConnection())
    const svc = makeService(repo)
    const bundle = makeBundle({ providerConnections: [makeConnection({ displayName: 'Updated Connection' })] })
    const preview = await svc.previewImportSettings({ bundle, fileName: 'settings.json' })

    await expect(
      svc.importSettings({
        bundle,
        previewToken: preview.previewToken,
        overwrite: false,
      })
    ).rejects.toMatchObject({ code: 'IMPORT_CONFLICT' })
  })
})

// ─── SettingsService.exportSessionsMarkdown (NOT_IMPLEMENTED skeleton) ─────────

describe('SettingsService.exportSessionsMarkdown (skeleton)', () => {
  it('throws NOT_IMPLEMENTED for session export skeleton', async () => {
    const svc = makeService()
    await expect(svc.exportSessionsMarkdown()).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
  })
})

// ─── Existing methods remain functional ────────────────────────────────────────

describe('SettingsService existing methods (no regression)', () => {
  it('listProviders still works after settings contract extension', async () => {
    const svc = makeService()
    const list = await svc.listProviders()
    expect(Array.isArray(list)).toBe(true)
  })

  it('getModelDefaults still works', async () => {
    const svc = makeService()
    const defaults = await svc.getModelDefaults()
    expect(defaults === null || typeof defaults === 'object').toBe(true)
  })

  it('getRoleModelOverrides still works', async () => {
    const svc = makeService()
    const overrides = await svc.getRoleModelOverrides()
    expect(Array.isArray(overrides)).toBe(true)
  })

  it('getPromptConfigs still works', async () => {
    const svc = makeService()
    const configs = await svc.getPromptConfigs()
    expect(Array.isArray(configs)).toBe(true)
  })

  it('clearData accepts expanded scope values', async () => {
    const svc = makeService()
    await expect(svc.clearData('cache' as ClearScope)).resolves.toBeUndefined()
    await expect(svc.clearData('sessions' as ClearScope)).resolves.toBeUndefined()
    await expect(svc.clearData('settings' as ClearScope)).resolves.toBeUndefined()
    await expect(svc.clearData('all' as ClearScope)).resolves.toBeUndefined()
  })
})
