import { describe, it, expect } from 'vitest'
import { SettingsService } from '@/server/services/settings.service'
import { MockSettingsRepository } from '@/server/repositories/mock/mock-settings.repository'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockMessageRepository } from '@/server/repositories/mock/mock-message.repository'
import { MockEventRepository } from '@/server/repositories/mock/mock-event.repository'
import { MockVoteRepository } from '@/server/repositories/mock/mock-vote.repository'
import type { UpsertProviderConfigRequest } from '@/types/api'

function makeRepo() {
  return new MockSettingsRepository()
}

function makeService(repo?: MockSettingsRepository) {
  const r = repo ?? makeRepo()
  return new SettingsService(
    r,
    new MockSessionRepository(),
    new MockMessageRepository(),
    new MockEventRepository(),
    new MockVoteRepository()
  )
}

async function seedProvider(svc: SettingsService, overrides?: Partial<UpsertProviderConfigRequest>) {
  return svc.upsertProviderConfig({
    providerId: 'openai',
    enabled: true,
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-real-api-key-12345678',
    modelList: ['gpt-4o', 'gpt-4o-mini'],
    headers: { 'X-Custom': 'secret-value' },
    ...overrides,
  })
}

// ─── Task-03: SettingsService Provider methods ────────────────────────────────

describe('SettingsService.listProviders', () => {
  it('returns empty array when no providers configured', async () => {
    const svc = makeService()
    const list = await svc.listProviders()
    expect(list).toEqual([])
  })

  it('masks API key (never returns raw apiKeyRef)', async () => {
    const svc = makeService()
    await seedProvider(svc)
    const [dto] = await svc.listProviders()
    expect(dto.maskedKey).toBeDefined()
    expect(dto.maskedKey).toContain('***')
    expect(dto.maskedKey).not.toBe('sk-real-api-key-12345678')
    expect(dto.maskedKey).not.toContain('real-api-key')
  })

  it('masks all custom header values', async () => {
    const svc = makeService()
    await seedProvider(svc)
    const [dto] = await svc.listProviders()
    expect(dto.maskedHeaders['X-Custom']).toBe('***')
  })

  it('returns lastTestStatus from stored config', async () => {
    const repo = makeRepo()
    await repo.upsertProviderConfig({
      providerId: 'anthropic',
      enabled: true,
      modelList: ['claude-sonnet-4-6'],
      lastTestStatus: 'failed',
      lastErrorCode: 'PROVIDER_AUTH_FAILED',
    })
    const svc = makeService(repo)
    const [dto] = await svc.listProviders()
    expect(dto.lastTestStatus).toBe('failed')
    expect(dto.lastErrorCode).toBe('PROVIDER_AUTH_FAILED')
  })

  it('returns all configured providers', async () => {
    const svc = makeService()
    await seedProvider(svc)
    await svc.upsertProviderConfig({ providerId: 'anthropic', enabled: true, apiKey: 'sk-ant' })
    await svc.upsertProviderConfig({ providerId: 'gemini', enabled: false })

    const list = await svc.listProviders()
    expect(list).toHaveLength(3)
    expect(list.map((p) => p.providerId).sort()).toEqual(['anthropic', 'gemini', 'openai'])
  })

  it('disabled provider still appears in list', async () => {
    const svc = makeService()
    await svc.upsertProviderConfig({ providerId: 'deepseek', enabled: false })
    const [dto] = await svc.listProviders()
    expect(dto.enabled).toBe(false)
  })

  it('empty customHeaders returns empty maskedHeaders object', async () => {
    const svc = makeService()
    await seedProvider(svc, { headers: undefined })
    const [dto] = await svc.listProviders()
    expect(dto.maskedHeaders).toEqual({})
  })

  it('returns baseUrl from config', async () => {
    const svc = makeService()
    await seedProvider(svc, { baseUrl: 'https://custom.api.com/v1' })
    const [dto] = await svc.listProviders()
    expect(dto.baseUrl).toBe('https://custom.api.com/v1')
  })
})

describe('SettingsService.upsertProviderConfig', () => {
  it('saves provider and returns masked DTO', async () => {
    const svc = makeService()
    const result = await seedProvider(svc)
    expect(result.providerId).toBe('openai')
    expect(result.maskedKey).toContain('***')
    expect(result.maskedKey).not.toBe('sk-real-api-key-12345678')
  })

  it('updates existing provider configuration', async () => {
    const svc = makeService()
    await seedProvider(svc)
    await svc.upsertProviderConfig({ providerId: 'openai', enabled: false, apiKey: 'sk-new-key-abcdef' })

    const [dto] = await svc.listProviders()
    expect(dto.enabled).toBe(false)
    expect(dto.maskedKey).toContain('bcdef')
  })

  it('preserves existing optional fields when not provided in update', async () => {
    const svc = makeService()
    await seedProvider(svc, { baseUrl: 'https://my.api.com' })
    await svc.upsertProviderConfig({ providerId: 'openai', enabled: true })

    const [dto] = await svc.listProviders()
    expect(dto.baseUrl).toBe('https://my.api.com')
    expect(dto.modelList).toEqual(['gpt-4o', 'gpt-4o-mini'])
  })

  it('returns masked headers', async () => {
    const svc = makeService()
    await seedProvider(svc)
    const [dto] = await svc.listProviders()
    expect(dto.maskedHeaders['X-Custom']).toBe('***')
  })
})

describe('SettingsService.testProvider (contract)', () => {
  it('accepts ProviderTestRequest with required fields', async () => {
    const svc = makeService()
    const result = await svc.testProvider({
      providerId: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o',
      headers: { 'X-Custom': 'value' },
    })
    expect(result.providerId).toBe('openai')
    expect(result.status).toBeDefined()
    expect(typeof result.latencyMs).toBe('number')
    expect(result.checkedAt).toBeTruthy()
    expect(Array.isArray(result.availableModels)).toBe(true)
  })

  it('accepts minimal request (providerId only)', async () => {
    const svc = makeService()
    const result = await svc.testProvider({ providerId: 'openai' })
    expect(result.providerId).toBe('openai')
    expect(result.status).toBeDefined()
  })

  it('on success, returns status=success with latency', async () => {
    const svc = makeService()
    const result = await svc.testProvider({ providerId: 'anthropic', apiKey: 'sk-valid' })
    expect(result.status).toBe('success')
    expect(result.latencyMs).toBeGreaterThan(0)
    expect(result.availableModels.length).toBeGreaterThan(0)
  })

  it('on failure, returns status=failed with error fields', async () => {
    const svc = makeService()
    const result = await svc.testProvider({ providerId: 'custom', apiKey: 'sk-bad' })
    expect(result.status).toBe('failed')
    expect(result.errorCode).toBeDefined()
    expect(result.errorMessage).toBeDefined()
  })

  it('masks API key in result', async () => {
    const svc = makeService()
    const result = await svc.testProvider({ providerId: 'openai', apiKey: 'sk-secret-12345678' })
    expect(result.maskedKey).toContain('***')
    expect(result.maskedKey).not.toBe('sk-secret-12345678')
  })
})
