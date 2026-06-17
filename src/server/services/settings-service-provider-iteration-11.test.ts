import { describe, it, expect } from 'vitest'
import { SettingsService } from '@/server/services/settings.service'
import { MockSettingsRepository } from '@/server/repositories/mock/mock-settings.repository'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockMessageRepository } from '@/server/repositories/mock/mock-message.repository'
import { MockEventRepository } from '@/server/repositories/mock/mock-event.repository'
import { MockVoteRepository } from '@/server/repositories/mock/mock-vote.repository'
import type { ProviderConnection, ProviderConnectionTestStatus, TemplateRuntimeConfig } from '@/types'
import type { CreateProviderConnectionRequest, ProviderConnectionTestRequest } from '@/types/api'
import { ServiceError } from '@/server/errors'

function makeService(repo?: MockSettingsRepository) {
  return new SettingsService(
    repo ?? new MockSettingsRepository(),
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
    lastTestStatus: 'success' as ProviderConnectionTestStatus,
    createdAt: '2026-06-08T00:00:00.000Z',
    updatedAt: '2026-06-08T00:00:00.000Z',
    ...overrides,
  }
}

function makeCreateRequest(overrides?: Partial<CreateProviderConnectionRequest>): CreateProviderConnectionRequest {
  return {
    providerType: 'openai',
    displayName: 'New Connection',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-valid',
    modelList: ['gpt-4o'],
    enabled: true,
    ...overrides,
  }
}

function makeRuntimeConfig(overrides?: Partial<TemplateRuntimeConfig>): TemplateRuntimeConfig {
  return {
    templateId: 'template-001',
    defaultStrategy: 'smart_fallback',
    roleConfigs: [
      {
        roleId: 'role-001',
        providerConnectionId: 'conn-001',
        model: 'gpt-4o',
        systemPrompt: 'prompt',
        includedInDefaultQueue: true,
      },
    ],
    ...overrides,
  }
}

// ─── createProviderConnection ────────────────────────────────────────────────

describe('SettingsService.createProviderConnection', () => {
  it('creates a connection with masked DTO fields', async () => {
    const svc = makeService()
    const result = await svc.createProviderConnection(makeCreateRequest({ customHeaders: { 'X-Api-Version': '2026-06-09' } }))
    expect(result.providerType).toBe('openai')
    expect(result.displayName).toBe('New Connection')
    expect(result.maskedKey).toContain('***')
    expect(result.maskedHeaders['X-Api-Version']).toBe('***')
  })

  it('rejects missing required fields', async () => {
    const svc = makeService()
    await expect(svc.createProviderConnection({ ...makeCreateRequest(), displayName: '' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})

// ─── updateProviderConnection ────────────────────────────────────────────────

describe('SettingsService.updateProviderConnection', () => {
  it('updates only provided fields and preserves api key when omitted', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveProviderConnection(makeConnection({ apiKeyRef: 'sk-secret-12345678' }))
    const svc = makeService(repo)

    const result = await svc.updateProviderConnection('conn-001', {
      displayName: 'Renamed Connection',
      enabled: false,
    })

    expect(result.displayName).toBe('Renamed Connection')
    expect(result.enabled).toBe(false)
    expect(result.maskedKey).toContain('***')
    const saved = await repo.getProviderConnectionById('conn-001')
    expect(saved?.apiKeyRef).toBe('sk-secret-12345678')
  })

  it('returns NOT_FOUND when connection does not exist', async () => {
    const svc = makeService()
    await expect(svc.updateProviderConnection('missing', { displayName: 'Renamed' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

// ─── deleteProviderConnection ────────────────────────────────────────────────

describe('SettingsService.deleteProviderConnection', () => {
  it('deletes an unused connection', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveProviderConnection(makeConnection())
    const svc = makeService(repo)

    await expect(svc.deleteProviderConnection('conn-001')).resolves.toEqual({ deletedConnectionId: 'conn-001' })
    await expect(repo.getProviderConnectionById('conn-001')).resolves.toBeNull()
  })

  it('rejects deletion when a runtime config references the connection', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveProviderConnection(makeConnection())
    await repo.saveTemplateRuntimeConfigs([makeRuntimeConfig()])
    const svc = makeService(repo)

    await expect(svc.deleteProviderConnection('conn-001')).rejects.toMatchObject({ code: 'CONNECTION_IN_USE' })
  })
})

// ─── testProviderConnection ──────────────────────────────────────────────────

describe('SettingsService.testProviderConnection', () => {
  it('returns success for sk-valid and masks the key', async () => {
    const svc = makeService()
    const req: ProviderConnectionTestRequest = {
      providerType: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-valid',
      model: 'gpt-4o',
    }

    const result = await svc.testProviderConnection(req)
    expect(result.status).toBe('success')
    expect(result.availableModels).toEqual(['gpt-4o'])
    expect(result.maskedKey).toContain('***')
  })

  it('rejects invalid provider type', async () => {
    const svc = makeService()
    await expect(svc.testProviderConnection({ providerType: 'invalid' as never } as ProviderConnectionTestRequest)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})

// ─── testSavedProviderConnection ─────────────────────────────────────────────

describe('SettingsService.testSavedProviderConnection', () => {
  it('tests saved connection and persists the latest test status', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveProviderConnection(makeConnection({ apiKeyRef: 'sk-valid', lastTestStatus: 'untested' }))
    const svc = makeService(repo)

    const result = await svc.testSavedProviderConnection('conn-001')
    expect(result.status).toBe('success')

    const saved = await repo.getProviderConnectionById('conn-001')
    expect(saved?.lastTestStatus).toBe('success')
    expect(saved?.lastTestAt).toBeTruthy()
  })

  it('returns NOT_FOUND when saved connection does not exist', async () => {
    const svc = makeService()
    await expect(svc.testSavedProviderConnection('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

// ─── listProviderConnections (already implemented, verifies DTO masking) ───────

describe('SettingsService.listProviderConnections (existing)', () => {
  it('lists connections with masked key and headers', async () => {
    const repo = new MockSettingsRepository()
    await repo.saveProviderConnection(makeConnection({ apiKeyRef: 'sk-secret-12345', customHeaders: { 'X-Secret': 'plain' } }))
    const svc = new SettingsService(repo, new MockSessionRepository(), new MockMessageRepository(), new MockEventRepository(), new MockVoteRepository())
    const result = await svc.listProviderConnections()
    expect(result.connections).toHaveLength(1)
    const dto = result.connections[0]
    expect(dto.maskedKey).toBeDefined()
    expect(dto.maskedKey).toContain('***')
    expect(dto.maskedKey).not.toBe('sk-secret-12345')
    expect(dto.maskedHeaders['X-Secret']).toBe('***')
  })
})