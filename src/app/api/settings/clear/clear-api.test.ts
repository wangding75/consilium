import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as clearPOST } from '@/app/api/settings/clear/route'
import { sharedSettingsRepo, sharedSessionRepo, sharedMessageRepo, sharedEventRepo, sharedVoteRepo } from '@/server/repositories/mock/instances'
import { SettingsService } from '@/server/services/settings.service'

function jsonReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/settings/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function emptyJsonReq(): NextRequest {
  return new NextRequest('http://localhost/api/settings/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(async () => {
  vi.restoreAllMocks()
  await sharedSettingsRepo.clearAll()
  await sharedMessageRepo.clearAll()
  await sharedEventRepo.clearAll()
  await sharedVoteRepo.clearAll()
  for (const session of await sharedSessionRepo.findAll()) {
    await sharedSessionRepo.delete(session.id)
  }
})

describe('POST /api/settings/clear', () => {
  it('returns VALIDATION_ERROR when scope is missing', async () => {
    const res = await clearPOST(jsonReq({}))
    const body = await res.json()

    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns VALIDATION_ERROR when scope is invalid', async () => {
    const res = await clearPOST(jsonReq({ scope: 'invalid_scope' }))
    const body = await res.json()

    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns VALIDATION_ERROR for null body', async () => {
    const res = await clearPOST(jsonReq(null))
    const body = await res.json()

    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns VALIDATION_ERROR for an empty request body', async () => {
    const res = await clearPOST(emptyJsonReq())
    const body = await res.json()

    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns VALIDATION_ERROR when body is an array', async () => {
    const res = await clearPOST(jsonReq(['sessions']))
    const body = await res.json()

    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns VALIDATION_ERROR when body is a string', async () => {
    const res = await clearPOST(jsonReq('sessions'))
    const body = await res.json()

    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns success when clearing sessions scope', async () => {
    await sharedSessionRepo.save({
      id: 'sess_clear_001',
      templateId: 'tpl_001',
      topic: 'Test Session',
      status: 'completed',
      state: { stage: 'closing', turnCount: 1, lastSpeakerId: null },
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    const res = await clearPOST(jsonReq({ scope: 'sessions' }))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data).toBeNull()
    expect(typeof body.requestId).toBe('string')
    expect(await sharedSessionRepo.findAll()).toHaveLength(0)
  })

  it('returns success when clearing settings scope', async () => {
    await sharedSettingsRepo.saveModelDefaults({
      providerId: 'openai',
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 512,
    })
    await sharedSettingsRepo.upsertProviderConfig({
      providerId: 'openai',
      enabled: true,
      baseUrl: 'https://api.openai.com/v1',
      apiKeyRef: 'sk-live-secret',
      modelList: ['gpt-4o'],
      customHeaders: { Authorization: 'Bearer test' },
      lastTestStatus: 'success',
      lastTestedAt: new Date().toISOString(),
    })
    await sharedSettingsRepo.saveRoleModelOverrides([
      { roleId: 'advisor', providerId: 'openai', model: 'gpt-4o', temperature: 0.7, maxTokens: 512 },
    ])
    await sharedSettingsRepo.savePromptConfig({
      promptId: 'global_system',
      scope: 'global',
      version: '1.0.0',
      content: 'hello',
      updatedAt: new Date().toISOString(),
      isDefault: false,
    })

    const res = await clearPOST(jsonReq({ scope: 'settings' }))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data).toBeNull()
    expect(await sharedSettingsRepo.getModelDefaults()).toBeNull()
    expect(await sharedSettingsRepo.getProviderConfigs()).toEqual([])
    expect(await sharedSettingsRepo.getRoleModelOverrides()).toEqual([])
    expect(await sharedSettingsRepo.getPromptConfigs()).toEqual([])
  })

  it('returns success when clearing all scope', async () => {
    await sharedSessionRepo.save({
      id: 'sess_clear_all',
      templateId: 'tpl_001',
      topic: 'Test',
      status: 'completed',
      state: { stage: 'closing', turnCount: 1, lastSpeakerId: null },
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    await sharedMessageRepo.save({
      messageId: 'msg-clear-all',
      sessionId: 'sess_clear_all',
      type: 'user',
      content: 'hello',
      status: 'completed',
      createdAt: new Date().toISOString(),
    })
    await sharedEventRepo.save({
      eventId: 'evt-clear-all',
      sessionId: 'sess_clear_all',
      eventType: 'slap',
      trigger: 'manual',
      status: 'active',
      title: 'title',
      description: 'desc',
      reason: 'reason',
      payload: { refuter: 'a', refuted: 'b', refutedView: 'view', reason: 'reason' },
      relatedMessageId: 'msg-clear-all',
      createdAt: new Date().toISOString(),
    })
    await sharedVoteRepo.save({
      voteId: 'vote-clear-all',
      sessionId: 'sess_clear_all',
      eventId: 'evt-clear-all',
      voterType: 'user',
      voterId: 'u1',
      optionId: 'opt1',
      createdAt: new Date().toISOString(),
    })
    await sharedSettingsRepo.saveModelDefaults({
      providerId: 'openai',
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 512,
    })

    const res = await clearPOST(jsonReq({ scope: 'all' }))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data).toBeNull()
    expect(await sharedSessionRepo.findAll()).toHaveLength(0)
    expect(await sharedMessageRepo.findBySessionId('sess_clear_all')).toHaveLength(0)
    expect(await sharedEventRepo.findBySessionId('sess_clear_all')).toHaveLength(0)
    expect(await sharedVoteRepo.findBySessionId('sess_clear_all')).toHaveLength(0)
    expect(await sharedSettingsRepo.getModelDefaults()).toBeNull()
  })

  it('ignores unknown fields without breaking the request contract', async () => {
    const res = await clearPOST(jsonReq({ scope: 'sessions', isAdmin: true, extraField: 'malicious' }))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data).toBeNull()
  })

  it('returns INTERNAL_ERROR when the service throws unexpectedly', async () => {
    const clearDataSpy = vi
      .spyOn(SettingsService.prototype, 'clearData')
      .mockRejectedValueOnce(new Error('boom'))

    const res = await clearPOST(jsonReq({ scope: 'sessions' }))
    const body = await res.json()

    expect(clearDataSpy).toHaveBeenCalledWith('sessions')
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})
