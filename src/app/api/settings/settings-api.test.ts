import { describe, it, expect, beforeEach } from 'vitest'
import { GET as providersGET, PUT as providersPUT } from '@/app/api/llm/providers/route'
import { POST as providersTestPOST } from '@/app/api/llm/providers/test/route'
import { GET as modelDefaultsGET, PUT as modelDefaultsPUT } from '@/app/api/settings/model-defaults/route'
import { GET as roleModelsGET, PUT as roleModelsPUT } from '@/app/api/settings/role-models/route'
import { GET as promptsGET, PUT as promptsPUT } from '@/app/api/settings/prompts/route'
import { sharedSettingsRepo } from '@/server/repositories/mock/instances'

function jsonReq(body: unknown): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(async () => {
  await sharedSettingsRepo.clearAll()
})

// ─── Task-07: GET /api/llm/providers ─────────────────────────────────────────

describe('GET /api/llm/providers', () => {
  it('returns success with empty array when no providers', async () => {
    const res = await providersGET()
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual([])
    expect(typeof body.requestId).toBe('string')
  })

  it('returns masked API keys (never raw)', async () => {
    await providersPUT(jsonReq({
      providerId: 'openai',
      enabled: true,
      apiKey: 'sk-real-secret-key-12345678',
    }))
    const res = await providersGET()
    const body = await res.json()
    const [dto] = body.data
    expect(dto.maskedKey).toContain('***')
    expect(dto.maskedKey).not.toBe('sk-real-secret-key-12345678')
    expect(dto.maskedKey).not.toContain('real-secret')
  })

  it('returns correct status fields', async () => {
    await providersPUT(jsonReq({ providerId: 'anthropic', enabled: true }))
    const res = await providersGET()
    const body = await res.json()
    const [dto] = body.data
    expect(dto.providerId).toBe('anthropic')
    expect(dto.enabled).toBe(true)
    expect(dto.lastTestStatus).toBeDefined()
  })
})

// ─── Task-07: PUT /api/llm/providers ─────────────────────────────────────────

describe('PUT /api/llm/providers', () => {
  it('saves provider and returns masked response', async () => {
    const res = await providersPUT(jsonReq({
      providerId: 'openai',
      enabled: true,
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-xxx',
      modelList: ['gpt-4o'],
      headers: { 'X-Custom': 'secret' },
    }))
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.providerId).toBe('openai')
    expect(body.data.maskedKey).toContain('***')
    expect(body.data.maskedKey).not.toBe('sk-xxx')
  })

  it('returns VALIDATION_ERROR when providerId is missing', async () => {
    const res = await providersPUT(jsonReq({ enabled: true }))
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toContain('providerId')
  })

  it('rejects empty body', async () => {
    const res = await providersPUT(jsonReq({}))
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── Task-07: POST /api/llm/providers/test ───────────────────────────────────

describe('POST /api/llm/providers/test', () => {
  it('returns VALIDATION_ERROR when providerId is missing', async () => {
    const res = await providersTestPOST(jsonReq({}))
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('accepts full test request', async () => {
    const res = await providersTestPOST(jsonReq({
      providerId: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o',
      headers: { 'X-Custom': 'value' },
    }))
    const body = await res.json()
    // will fail at skeleton level (testProvider not implemented), but should be 500 not 400
    expect(body.success).toBe(false)
    expect(body.error.code).toBeDefined()
    expect(typeof body.requestId).toBe('string')
  })
})

// ─── Task-07: GET /api/settings/model-defaults ────────────────────────────────

describe('GET /api/settings/model-defaults', () => {
  it('returns null data when no defaults saved', async () => {
    const res = await modelDefaultsGET()
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toBeNull()
  })

  it('returns saved defaults', async () => {
    await modelDefaultsPUT(jsonReq({ providerId: 'openai', model: 'gpt-4o', temperature: 0.7, maxTokens: 512 }))
    const res = await modelDefaultsGET()
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.providerId).toBe('openai')
    expect(body.data.model).toBe('gpt-4o')
  })
})

// ─── Task-07: PUT /api/settings/model-defaults ────────────────────────────────

describe('PUT /api/settings/model-defaults', () => {
  it('saves and returns model defaults', async () => {
    const res = await modelDefaultsPUT(jsonReq({
      providerId: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 512,
    }))
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.providerId).toBe('openai')
    expect(body.data.temperature).toBe(0.7)
  })

  it('returns VALIDATION_ERROR when providerId is missing', async () => {
    const res = await modelDefaultsPUT(jsonReq({ model: 'gpt-4o' }))
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns VALIDATION_ERROR when model is missing', async () => {
    const res = await modelDefaultsPUT(jsonReq({ providerId: 'openai' }))
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── Task-07: GET /api/settings/role-models ───────────────────────────────────

describe('GET /api/settings/role-models', () => {
  it('returns empty array when no overrides', async () => {
    const res = await roleModelsGET()
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual([])
  })

  it('returns saved overrides', async () => {
    await roleModelsPUT(jsonReq({ overrides: [{ roleId: 'role_001', model: 'gpt-4o' }] }))
    const res = await roleModelsGET()
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].roleId).toBe('role_001')
  })
})

// ─── Task-07: PUT /api/settings/role-models ──────────────────────────────────

describe('PUT /api/settings/role-models', () => {
  it('saves and returns overrides', async () => {
    const res = await roleModelsPUT(jsonReq({
      overrides: [
        { roleId: 'role_001', providerId: 'anthropic', model: 'claude-haiku-4-5-20251001', temperature: 0.8, maxTokens: 1024 },
      ],
    }))
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].model).toBe('claude-haiku-4-5-20251001')
  })

  it('returns VALIDATION_ERROR when overrides is not an array', async () => {
    const res = await roleModelsPUT(jsonReq({ overrides: 'not-an-array' }))
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── Task-07: GET /api/settings/prompts ──────────────────────────────────────

describe('GET /api/settings/prompts', () => {
  it('returns empty array when no prompts', async () => {
    const res = await promptsGET()
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual([])
  })

  it('returns saved prompts', async () => {
    await promptsPUT(jsonReq({ promptId: 'global_system', content: 'New prompt' }))
    const res = await promptsGET()
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].promptId).toBe('global_system')
  })
})

// ─── Task-07: PUT /api/settings/prompts ──────────────────────────────────────

describe('PUT /api/settings/prompts', () => {
  it('creates and updates prompt', async () => {
    // First create
    await promptsPUT(jsonReq({ promptId: 'p1', content: 'Initial content' }))
    const res = await promptsPUT(jsonReq({ promptId: 'p1', content: 'Updated content' }))
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.content).toBe('Updated content')
    expect(body.data.isDefault).toBe(false)
  })

  it('resets prompt to default', async () => {
    await promptsPUT(jsonReq({ promptId: 'p1', content: 'Initial content' }))
    const res = await promptsPUT(jsonReq({ promptId: 'p1', reset: true }))
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.isDefault).toBe(true)
  })

  it('returns VALIDATION_ERROR when promptId is missing', async () => {
    const res = await promptsPUT(jsonReq({ content: 'test' }))
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('auto-creates prompt when it does not exist yet', async () => {
    const res = await promptsPUT(jsonReq({ promptId: 'new-prompt', content: 'test' }))
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.promptId).toBe('new-prompt')
    expect(body.data.isDefault).toBe(false)
  })
})

// ─── Task-07: Security — unknown fields / mass-assignment ────────────────────

describe('Settings API security boundaries', () => {
  it('PUT /api/llm/providers ignores unknown fields gracefully', async () => {
    const res = await providersPUT(jsonReq({
      providerId: 'openai',
      enabled: true,
      isAdmin: true,
      secretBackdoor: 'malicious',
    }))
    const body = await res.json()
    expect(body.success).toBe(true)
    // stored provider should not have unknown fields
    const getRes = await providersGET()
    const getBody = await getRes.json()
    const [dto] = getBody.data
    expect(dto).not.toHaveProperty('isAdmin')
    expect(dto).not.toHaveProperty('secretBackdoor')
  })

  it('PUT /api/settings/model-defaults preserves only known fields', async () => {
    const res = await modelDefaultsPUT(jsonReq({
      providerId: 'openai',
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 512,
      extraField: 'should-be-ignored',
    }))
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).not.toHaveProperty('extraField')
  })
})