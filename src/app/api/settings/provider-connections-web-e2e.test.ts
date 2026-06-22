/**
 * Web-E2E: Settings provider-connections API HTTP endpoints (Task-08 coverage)
 *
 * Standard: standards/testing/web-e2e.md
 * Tests the full request → handler → response roundtrip for provider-connections APIs.
 * Calls route handler functions directly (the project's established web-e2e pattern).
 * Exercises: ApiResponse envelope, status codes, error codes, masked fields.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { GET as connectionsGET } from '@/app/api/settings/provider-connections/route'
import { POST as connectionsPOST } from '@/app/api/settings/provider-connections/route'
import { PATCH as connectionPATCH } from '@/app/api/settings/provider-connections/[connectionId]/route'
import { DELETE as connectionDELETE } from '@/app/api/settings/provider-connections/[connectionId]/route'
import { POST as testPOST } from '@/app/api/settings/provider-connections/test/route'
import { POST as savedTestPOST } from '@/app/api/settings/provider-connections/[connectionId]/test/route'
import { sharedSettingsRepo } from '@/server/repositories/mock/instances'

function jsonPost(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function jsonPatch(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function jsonDelete(path: string): Request {
  return new Request(`http://localhost${path}`, { method: 'DELETE' })
}

beforeEach(async () => {
  await sharedSettingsRepo.clearAll()
})

async function seedConnection() {
  await sharedSettingsRepo.saveProviderConnection({
    id: 'conn-001',
    providerType: 'openai',
    displayName: 'Test OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyRef: 'sk-secret-key-12345',
    modelList: ['gpt-4o'],
    enabled: true,
    lastTestStatus: 'success',
    createdAt: '2026-06-08T00:00:00.000Z',
    updatedAt: '2026-06-08T00:00:00.000Z',
  })
}

// ─── GET /api/settings/provider-connections ───────────────────────────────────

describe('web-e2e: GET /api/settings/provider-connections', () => {
  it('returns 200 with ApiResponse envelope and empty array', async () => {
    const res = await connectionsGET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.connections).toEqual([])
    expect(typeof body.requestId).toBe('string')
  })

  it('returns connections after seeding', async () => {
    await seedConnection()
    const res = await connectionsGET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.connections).toHaveLength(1)
    expect(body.data.connections[0].id).toBe('conn-001')
  })

  it('DTO has maskedKey not raw apiKeyRef', async () => {
    await seedConnection()
    const res = await connectionsGET()
    const body = await res.json()
    const dto = body.data.connections[0]
    expect(dto.maskedKey).toContain('***')
    expect(dto.maskedKey).not.toBe('sk-secret-key-12345')
    expect(dto.maskedKey).not.toContain('secret-key')
  })

  it('DTO has maskedHeaders with values replaced', async () => {
    await sharedSettingsRepo.saveProviderConnection({
      id: 'conn-002',
      providerType: 'anthropic',
      displayName: 'Claude',
      baseUrl: 'https://api.anthropic.com',
      apiKeyRef: 'sk-anthropic-key',
      modelList: ['claude-sonnet-4-6'],
      customHeaders: { 'X-Secret': 'plain-value', 'X-Org': 'org-123' },
      enabled: true,
      lastTestStatus: 'success',
      createdAt: '2026-06-08T00:00:00.000Z',
      updatedAt: '2026-06-08T00:00:00.000Z',
    })
    const res = await connectionsGET()
    const body = await res.json()
    const dto = body.data.connections[0]
    expect(dto.maskedHeaders['X-Secret']).toBe('***')
    expect(dto.maskedHeaders['X-Org']).toBe('***')
  })
})

// ─── POST /api/settings/provider-connections ────────────────────────────────

describe('web-e2e: POST /api/settings/provider-connections', () => {
  it('returns 200 and created provider connection DTO', async () => {
    const req = jsonPost('/api/settings/provider-connections', {
      providerType: 'openai',
      displayName: 'New Connection',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-valid',
      modelList: ['gpt-4o'],
      enabled: true,
    })
    const res = await connectionsPOST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.displayName).toBe('New Connection')
    expect(body.data.maskedKey).toContain('***')
  })

  it('returns 400 for invalid payload', async () => {
    const req = jsonPost('/api/settings/provider-connections', {})
    const res = await connectionsPOST(req)
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── PATCH /api/settings/provider-connections/[connectionId] ─────────────────

describe('web-e2e: PATCH /api/settings/provider-connections/[connectionId]', () => {
  it('returns 200 and updated provider connection DTO', async () => {
    await seedConnection()
    const req = jsonPatch('/api/settings/provider-connections/conn-001', { displayName: 'Renamed' })
    const res = await connectionPATCH(req, { params: Promise.resolve({ connectionId: 'conn-001' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.displayName).toBe('Renamed')
  })
})

// ─── DELETE /api/settings/provider-connections/[connectionId] ────────────────

describe('web-e2e: DELETE /api/settings/provider-connections/[connectionId]', () => {
  it('returns 200 for deleting an unused connection', async () => {
    await seedConnection()
    const req = jsonDelete('/api/settings/provider-connections/conn-001')
    const res = await connectionDELETE(req, { params: Promise.resolve({ connectionId: 'conn-001' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual({ deletedConnectionId: 'conn-001' })
  })
})

// ─── POST /api/settings/provider-connections/test ────────────────────────────

describe('web-e2e: POST /api/settings/provider-connections/test', () => {
  it('returns 200 for test result', async () => {
    const req = jsonPost('/api/settings/provider-connections/test', {
      providerType: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-valid',
      model: 'gpt-4o',
    })
    const res = await testPOST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('success')
  })
})

// ─── POST /api/settings/provider-connections/[connectionId]/test ─────────────

describe('web-e2e: POST /api/settings/provider-connections/[connectionId]/test', () => {
  it('returns 200 and persists test result for saved connection', async () => {
    await sharedSettingsRepo.saveProviderConnection({
      id: 'conn-001',
      providerType: 'openai',
      displayName: 'Test OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      apiKeyRef: 'sk-valid',
      modelList: ['gpt-4o'],
      enabled: true,
      lastTestStatus: 'untested',
      createdAt: '2026-06-08T00:00:00.000Z',
      updatedAt: '2026-06-08T00:00:00.000Z',
    })
    const req = new Request('http://localhost/api/settings/provider-connections/conn-001/test', { method: 'POST' })
    const res = await savedTestPOST(req, { params: Promise.resolve({ connectionId: 'conn-001' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('success')

    const saved = await sharedSettingsRepo.getProviderConnectionById('conn-001')
    expect(saved?.lastTestStatus).toBe('success')
  })
})
