import { describe, it, expect } from 'vitest'
import { MockSettingsRepository } from '@/server/repositories/mock/mock-settings.repository'
import type { ProviderConnection, TemplateRuntimeConfig, SettingsExportBundle, SettingsImportPreview } from '@/types'

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

function makeExportBundle(overrides?: Partial<SettingsExportBundle>): SettingsExportBundle {
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

function makeImportPreview(overrides?: Partial<SettingsImportPreview>): SettingsImportPreview {
  return {
    additions: ['conn-a'],
    updates: [],
    conflicts: [],
    invalidItems: [],
    ...overrides,
  }
}

// ─── ProviderConnection storage ────────────────────────────────────────────────

describe('MockSettingsRepository — provider connections', () => {
  it('starts with empty connections', async () => {
    const repo = new MockSettingsRepository()
    const connections = await repo.getProviderConnections()
    expect(connections).toEqual([])
  })

  it('saveProviderConnection persists and returns defensive copy', async () => {
    const repo = new MockSettingsRepository()
    const input = makeConnection()
    const saved = await repo.saveProviderConnection(input)
    saved.modelList.push('intruder')

    const [stored] = await repo.getProviderConnections()
    expect(stored.modelList).toEqual(['gpt-4o'])
  })

  it('getProviderConnectionById returns null for unknown id', async () => {
    const repo = new MockSettingsRepository()
    const result = await repo.getProviderConnectionById('nonexistent')
    expect(result).toBeNull()
  })

  it('getProviderConnectionById returns connection after save', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveProviderConnection(makeConnection({ id: 'conn-a' }))
    const conn = await repo.getProviderConnectionById('conn-a')
    expect(conn).not.toBeNull()
    expect(conn!.id).toBe('conn-a')
  })

  it('getProviderConnectionById returns defensive copy', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveProviderConnection(makeConnection({ id: 'conn-a', displayName: 'Original' }))
    const conn = await repo.getProviderConnectionById('conn-a')
    conn!.displayName = 'hacked'

    const again = await repo.getProviderConnectionById('conn-a')
    expect(again!.displayName).toBe('Original')
  })

  it('saveProviderConnection overwrites by id', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveProviderConnection(makeConnection({ id: 'conn-1', displayName: 'First' }))
    await repo.saveProviderConnection(makeConnection({ id: 'conn-1', displayName: 'Second' }))

    const conns = await repo.getProviderConnections()
    expect(conns).toHaveLength(1)
    expect(conns[0].displayName).toBe('Second')
  })

  it('saveProviderConnection is defensive against constructing args mutation', async () => {
    const repo = new MockSettingsRepository()
    const conn = makeConnection({ id: 'conn-a', modelList: ['gpt-4o'] })
    await repo.saveProviderConnection(conn)
    conn.modelList.push('injected')

    const [stored] = await repo.getProviderConnections()
    expect(stored.modelList).toEqual(['gpt-4o'])
  })

  it('deleteProviderConnection returns true when connection exists', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveProviderConnection(makeConnection({ id: 'conn-a' }))
    const deleted = await repo.deleteProviderConnection('conn-a')
    expect(deleted).toBe(true)
    const conns = await repo.getProviderConnections()
    expect(conns).toEqual([])
  })

  it('deleteProviderConnection returns false when connection does not exist', async () => {
    const repo = new MockSettingsRepository()
    const deleted = await repo.deleteProviderConnection('nonexistent')
    expect(deleted).toBe(false)
  })

  it('getProviderConnections returns defensive copy of array', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveProviderConnection(makeConnection({ id: 'conn-a' }))

    const conns = await repo.getProviderConnections()
    conns.length = 0
    const again = await repo.getProviderConnections()
    expect(again).toHaveLength(1)
  })
})

// ─── TemplateRuntimeConfig storage ─────────────────────────────────────────────

describe('MockSettingsRepository — template runtime configs', () => {
  it('starts with empty configs', async () => {
    const repo = new MockSettingsRepository()
    const configs = await repo.getTemplateRuntimeConfigs()
    expect(configs).toEqual([])
  })

  it('saveTemplateRuntimeConfigs persists and returns defensive copies', async () => {
    const repo = new MockSettingsRepository()
    const configs: TemplateRuntimeConfig[] = [
      {
        templateId: 'startup-board',
        defaultStrategy: 'smart_fallback',
        roleConfigs: [{ roleId: 'ceo-host', providerConnectionId: 'conn-1', model: 'gpt-4o', systemPrompt: 'You are CEO.', includedInDefaultQueue: true }],
      },
    ]
    const saved = await repo.saveTemplateRuntimeConfigs(configs)
    saved[0].roleConfigs.push({
      roleId: 'intruder', providerConnectionId: 'bad', model: 'bad', systemPrompt: 'bad', includedInDefaultQueue: false,
    })

    const stored = await repo.getTemplateRuntimeConfigs()
    expect(stored[0].roleConfigs).toHaveLength(1)
  })

  it('saveTemplateRuntimeConfigs overwrites previous configs', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveTemplateRuntimeConfigs([{ templateId: 'tpl-1', defaultStrategy: 'quality_first', roleConfigs: [] }])
    await repo.saveTemplateRuntimeConfigs([{ templateId: 'tpl-2', defaultStrategy: 'cost_first', roleConfigs: [] }])

    const stored = await repo.getTemplateRuntimeConfigs()
    expect(stored).toHaveLength(1)
    expect(stored[0].templateId).toBe('tpl-2')
  })
})

// ─── Import preview storage ────────────────────────────────────────────────────

describe('MockSettingsRepository — import preview', () => {
  it('starts with no previews', async () => {
    const repo = new MockSettingsRepository()
    const preview = await repo.getImportPreview('any-token')
    expect(preview).toBeNull()
  })

  it('saveImportPreview persists and returns defensive copies', async () => {
    const repo = new MockSettingsRepository()
    const bundle = makeExportBundle()
    const preview = makeImportPreview()
    await repo.saveImportPreview('token-123', bundle, preview)

    const saved = await repo.getImportPreview('token-123')
    expect(saved).not.toBeNull()
    expect(saved!.preview.additions).toEqual(['conn-a'])
  })

  it('getImportPreview returns defensive copy (bundle) on get', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveImportPreview('token-x', makeExportBundle(), makeImportPreview())

    const saved = await repo.getImportPreview('token-x')
    saved!.bundle.providerConnections.push({
      id: 'evil', providerType: 'custom', displayName: 'bad', baseUrl: 'http://evil',
      modelList: [], enabled: true, lastTestStatus: 'untested',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    })

    const again = await repo.getImportPreview('token-x')
    expect(again!.bundle.providerConnections).toEqual([])
  })

  it('saveImportPreview is defensive against constructing args mutation', async () => {
    const repo = new MockSettingsRepository()
    const bundle = makeExportBundle()
    const preview = makeImportPreview()
    await repo.saveImportPreview('token-m', bundle, preview)
    preview.additions.push('injected')

    const saved = await repo.getImportPreview('token-m')
    expect(saved!.preview.additions).toEqual(['conn-a'])
  })

  it('deleteImportPreview removes the preview', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveImportPreview('token-del', makeExportBundle(), makeImportPreview())
    await repo.deleteImportPreview('token-del')

    const saved = await repo.getImportPreview('token-del')
    expect(saved).toBeNull()
  })
})

// ─── clearAll covers new storage ───────────────────────────────────────────────

describe('MockSettingsRepository — clearAll covers connections/configs/previews', () => {
  it('clears connections, template configs, and import previews', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveProviderConnection(makeConnection({ id: 'conn-a' }))
    await repo.saveTemplateRuntimeConfigs([{ templateId: 'tpl-1', defaultStrategy: 'smart_fallback', roleConfigs: [] }])
    await repo.saveImportPreview('token-1', makeExportBundle(), makeImportPreview())

    await repo.clearAll()

    expect(await repo.getProviderConnections()).toEqual([])
    expect(await repo.getTemplateRuntimeConfigs()).toEqual([])
    expect(await repo.getImportPreview('token-1')).toBeNull()
  })
})