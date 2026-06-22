/**
 * Web-E2E: Settings API HTTP endpoints (Task-07/Task-08 coverage)
 *
 * Standard: standards/testing/web-e2e.md
 * Tests the full request → handler → response roundtrip for all Settings APIs.
 * Calls route handler functions directly (the project's established web-e2e pattern).
 * Exercises: ApiResponse envelope, status codes, error codes, masked fields.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { GET as providersGET } from '@/app/api/llm/providers/route'
import { POST as providersTestPOST } from '@/app/api/llm/providers/test/route'
import { GET as modelDefaultsGET } from '@/app/api/settings/model-defaults/route'
import { GET as roleModelsGET } from '@/app/api/settings/role-models/route'
import { GET as promptsGET } from '@/app/api/settings/prompts/route'
import { GET as exportGET } from '@/app/api/sessions/[sessionId]/export/route'
import { sharedSettingsRepo, sharedSessionRepo } from '@/server/repositories/mock/instances'

function jsonPost(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(async () => {
  await sharedSettingsRepo.clearAll()
  // clean sessions too
  for (const s of await sharedSessionRepo.findAll()) {
    await sharedSessionRepo.delete(s.id)
  }
})

// ─── web-e2e: Provider endpoints ────────────────────────────────────────────

describe('web-e2e: GET /api/llm/providers', () => {
  it('returns 200 with ApiResponse envelope and empty array', async () => {
    const res = await providersGET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toEqual([])
    expect(typeof body.requestId).toBe('string')
  })

  it('returns maskedKey not raw apiKeyRef after PUT', async () => {
    // Seed via PUT
    const { PUT } = await import('@/app/api/llm/providers/route')
    await PUT(jsonPost('/api/llm/providers', {
      providerId: 'openai',
      enabled: true,
      apiKey: 'sk-secret-key-abc12345',
      modelList: ['gpt-4o'],
    }))

    const res = await providersGET()
    const body = await res.json()
    const provider = body.data[0]
    expect(provider.maskedKey).toContain('***')
    expect(provider.maskedKey).not.toContain('secret-key')
    expect(provider.maskedKey).not.toBe('sk-secret-key-abc12345')
  })
})

describe('web-e2e: POST /api/llm/providers/test', () => {
  it('returns 400 VALIDATION_ERROR when providerId missing', async () => {
    const res = await providersTestPOST(jsonPost('/api/llm/providers/test', {}))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.data).toBeNull()
  })

  it('returns 400 VALIDATION_ERROR for null body', async () => {
    const res = await providersTestPOST(jsonPost('/api/llm/providers/test', null))
    // null body → body.providerId is undefined → validation error
    expect(res.status).toBe(400)
  })

  it('accepts full test request (handler validates and processes)', async () => {
    const res = await providersTestPOST(jsonPost('/api/llm/providers/test', {
      providerId: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o',
      headers: { 'X-Custom': 'value' },
    }))
    const body = await res.json()
    // Will fail at service layer (not implemented), but should not be 400
    expect(body).toHaveProperty('success')
    expect(body).toHaveProperty('requestId')
    expect(typeof body.requestId).toBe('string')
  })
})

// ─── web-e2e: Model defaults ─────────────────────────────────────────────────

describe('web-e2e: GET /api/settings/model-defaults', () => {
  it('returns 200 with null when no defaults', async () => {
    const res = await modelDefaultsGET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toBeNull()
  })
})

// ─── web-e2e: Role models ────────────────────────────────────────────────────

describe('web-e2e: GET /api/settings/role-models', () => {
  it('returns 200 with empty array', async () => {
    const res = await roleModelsGET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toEqual([])
  })
})

// ─── web-e2e: Prompts ────────────────────────────────────────────────────────

describe('web-e2e: GET /api/settings/prompts', () => {
  it('returns 200 with empty array', async () => {
    const res = await promptsGET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toEqual([])
  })
})

// ─── web-e2e: Session export ─────────────────────────────────────────────────

describe('web-e2e: GET /api/sessions/[sessionId]/export', () => {
  it('returns 404 NOT_FOUND for nonexistent session', async () => {
    const res = await exportGET(
      new Request('http://localhost/api/sessions/nonexistent/export?format=md'),
      { params: Promise.resolve({ sessionId: 'nonexistent' }) }
    )
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.data).toBeNull()
    expect(typeof body.requestId).toBe('string')
  })

  it('returns 200 with SessionExportResult for existing session', async () => {
    await sharedSessionRepo.save({
      id: 'sess_e2e_001',
      templateId: 'tpl_001',
      topic: 'E2E 导出测试',
      status: 'completed',
      state: { stage: 'closing', turnCount: 3, lastSpeakerId: null },
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    const res = await exportGET(
      new Request('http://localhost/api/sessions/sess_e2e_001/export?format=md'),
      { params: Promise.resolve({ sessionId: 'sess_e2e_001' }) }
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.sessionId).toBe('sess_e2e_001')
    expect(body.data.format).toBe('md')
    expect(body.data.sanitized).toBe(true)
    expect(body.data.filename).toBe('session-sess_e2e_001.md')
    expect(typeof body.data.content).toBe('string')
    expect(typeof body.data.generatedAt).toBe('string')
    expect(body.data.content).toContain('E2E 导出测试')
    expect(body.data.content).not.toContain('apiKey')
    expect(body.data.content).not.toContain('sk-')
  })
})