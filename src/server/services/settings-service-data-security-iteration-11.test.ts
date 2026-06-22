import { describe, it, expect } from 'vitest'
import { SettingsService } from '@/server/services/settings.service'
import { MockSettingsRepository } from '@/server/repositories/mock/mock-settings.repository'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockMessageRepository } from '@/server/repositories/mock/mock-message.repository'
import { MockEventRepository } from '@/server/repositories/mock/mock-event.repository'
import { MockVoteRepository } from '@/server/repositories/mock/mock-vote.repository'
import type { ClearScope, SettingsImportCommitRequest } from '@/types/api'
import type { ProviderConnection, SettingsExportBundle, SettingsImportPreview } from '@/types'

function makeService(repo: MockSettingsRepository = new MockSettingsRepository()) {
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
    id: 'conn-import',
    providerType: 'openai',
    displayName: 'Imported Connection',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyRef: 'sk-import-ref',
    modelList: ['gpt-4o'],
    enabled: true,
    lastTestStatus: 'untested',
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

// ─── exportSettings ────────────────────────────────────────────────────────────

describe('SettingsService.exportSettings', () => {
  it('returns the persisted settings bundle', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveProviderConnection(makeConnection())
    const svc = makeService(repo)

    const result = await svc.exportSettings()

    expect(result.version).toBe('1.0.0')
    expect(result.providerConnections).toHaveLength(1)
    expect(result.providerConnections[0].displayName).toBe('Imported Connection')
    expect(result.templateRuntimeConfigs).toEqual([])
    expect(result.prompts).toEqual([])
  })
})

// ─── previewImportSettings ─────────────────────────────────────────────────────

describe('SettingsService.previewImportSettings', () => {
  it('returns preview token and additions for new data', async () => {
    const repo = new MockSettingsRepository()
    const svc = makeService(repo)
    const bundle = makeExportBundle({ providerConnections: [makeConnection()] })

    const result = await svc.previewImportSettings({
      bundle,
      fileName: 'settings.json',
    })

    expect(result.previewToken).toBeTruthy()
    expect(result.additions).toContain('provider:conn-import')
    expect(result.conflicts).toEqual([])
  })
})

// ─── importSettings ────────────────────────────────────────────────────────────

describe('SettingsService.importSettings', () => {
  it('imports the previewed bundle and clears the saved preview', async () => {
    const repo = new MockSettingsRepository()
    const svc = makeService(repo)
    const bundle = makeExportBundle({ providerConnections: [makeConnection()] })
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
    expect((await repo.getProviderConnectionById('conn-import'))?.displayName).toBe('Imported Connection')
    expect(await repo.getImportPreview(preview.previewToken)).toBeNull()
  })
})

// ─── exportSessionsMarkdown (skeleton → NOT_IMPLEMENTED) ──────────────────────

describe('SettingsService.exportSessionsMarkdown (RED)', () => {
  it('throws NOT_IMPLEMENTED — skeleton exists but no implementation', async () => {
    const svc = makeService()
    await expect(svc.exportSessionsMarkdown()).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' })
  })
})

// ─── clearData (already implemented, expanded scope) ──────────────────────────

describe('SettingsService.clearData — expanded scope', () => {
  it('accepts cache scope without throwing', async () => {
    const svc = makeService()
    await expect(svc.clearData('cache' as ClearScope)).resolves.toBeUndefined()
  })

  it('accepts sessions scope without throwing', async () => {
    const svc = makeService()
    await expect(svc.clearData('sessions' as ClearScope)).resolves.toBeUndefined()
  })

  it('accepts settings scope without throwing', async () => {
    const svc = makeService()
    await expect(svc.clearData('settings' as ClearScope)).resolves.toBeUndefined()
  })

  it('accepts all scope without throwing', async () => {
    const svc = makeService()
    await expect(svc.clearData('all' as ClearScope)).resolves.toBeUndefined()
  })
})

// ─── import preview token flow (repository integrity) ──────────────────────────

describe('MockSettingsRepository — import preview lifecycle', () => {
  it('saves and retrieves import preview with token', async () => {
    const repo = new MockSettingsRepository()
    const bundle = makeExportBundle()
    const preview: SettingsImportPreview = { additions: ['a'], updates: [], conflicts: [], invalidItems: [] }
    await repo.saveImportPreview('token-abc', bundle, preview)

    const saved = await repo.getImportPreview('token-abc')
    expect(saved).not.toBeNull()
    expect(saved!.preview.additions).toEqual(['a'])
  })

  it('returns null for unknown token', async () => {
    const repo = new MockSettingsRepository()
    const result = await repo.getImportPreview('bad-token')
    expect(result).toBeNull()
  })

  it('deleteImportPreview removes the token entry', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveImportPreview('token-del', makeExportBundle(), { additions: [], updates: [], conflicts: [], invalidItems: [] })
    await repo.deleteImportPreview('token-del')

    expect(await repo.getImportPreview('token-del')).toBeNull()
  })

  it('getImportPreview returns defensive copy of bundle', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveImportPreview('token-x', makeExportBundle(), { additions: ['x'], updates: [], conflicts: [], invalidItems: [] })

    const saved = await repo.getImportPreview('token-x')
    saved!.bundle.providerConnections.push({
      id: 'evil',
      providerType: 'custom',
      displayName: 'bad',
      baseUrl: 'http://evil',
      modelList: [],
      enabled: true,
      lastTestStatus: 'untested',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    const again = await repo.getImportPreview('token-x')
    expect(again!.bundle.providerConnections).toEqual([])
  })
})
