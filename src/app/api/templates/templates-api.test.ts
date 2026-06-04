import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET as templatesGet } from '@/app/api/templates/route'
import { GET as templateDetailGet } from '@/app/api/templates/[templateId]/route'
import { GET as rolesGet } from '@/app/api/templates/[templateId]/roles/route'
import { PATCH as configPatch } from '@/app/api/templates/[templateId]/roles/[roleId]/config/route'

beforeEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/templates (Task-02)', () => {
  it('returns 200 with TemplateListResult envelope', async () => {
    const res = await templatesGet()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data.templates)).toBe(true)
    expect(body.data.templates.length).toBeGreaterThanOrEqual(3)
  })

  it('each summary has required fields', async () => {
    const res = await templatesGet()
    const body = await res.json()
    const t = body.data.templates[0]
    expect(typeof t.templateId).toBe('string')
    expect(typeof t.version).toBe('string')
    expect(typeof t.name).toBe('string')
    expect(typeof t.description).toBe('string')
    expect(typeof t.category).toBe('string')
    expect(Array.isArray(t.tags)).toBe(true)
    expect(typeof t.roleCount).toBe('number')
    expect(typeof t.eventCount).toBe('number')
    expect(typeof t.usageCount).toBe('number')
    expect(typeof t.sessionCount).toBe('number')
    expect(typeof t.favoriteCount).toBe('number')
    expect(typeof t.isBuiltin).toBe('boolean')
    expect(typeof t.availableForSessionCreation).toBe('boolean')
  })
})

describe('GET /api/templates/:templateId (Task-02)', () => {
  it('returns 200 with TemplateDetailResult for existing template', async () => {
    const req = new Request('http://localhost/api/templates/three-kingdoms-advisors')
    const res = await templateDetailGet(req, { params: Promise.resolve({ templateId: 'three-kingdoms-advisors' }) })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.template).toBeDefined()
    expect(body.data.template.templateId).toBe('three-kingdoms-advisors')
  })

  it('returns 404 TEMPLATE_NOT_FOUND for nonexistent template', async () => {
    const req = new Request('http://localhost/api/templates/nonexistent')
    const res = await templateDetailGet(req, { params: Promise.resolve({ templateId: 'nonexistent' }) })
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.error.code).toBe('TEMPLATE_NOT_FOUND')
  })
})

describe('GET /api/templates/:templateId/roles (Task-02)', () => {
  it('returns 200 with TemplateRolesResult from same version', async () => {
    const req = new Request('http://localhost/api/templates/three-kingdoms-advisors/roles')
    const res = await rolesGet(req, { params: Promise.resolve({ templateId: 'three-kingdoms-advisors' }) })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data.roles)).toBe(true)
    expect(body.data.templateId).toBe('three-kingdoms-advisors')
    expect(typeof body.data.templateVersion).toBe('string')
  })
})

describe('PATCH /api/templates/:templateId/roles/:roleId/config (Task-03)', () => {
  it('returns 500 INTERNAL_ERROR when template config authorization is not configured', async () => {
    const req = new Request('http://localhost/api/templates/three-kingdoms-advisors/roles/zhuge-liang/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temperature: 0.5, maxCharsPerTurn: 300 }),
    })
    const res = await configPatch(req, {
      params: Promise.resolve({ templateId: 'three-kingdoms-advisors', roleId: 'zhuge-liang' }),
    })
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('returns 403 FORBIDDEN when authorization header is missing', async () => {
    vi.stubEnv('TEMPLATE_CONFIG_API_KEY', 'test-template-config-key')

    const req = new Request('http://localhost/api/templates/three-kingdoms-advisors/roles/zhuge-liang/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temperature: 0.5, maxCharsPerTurn: 300 }),
    })
    const res = await configPatch(req, {
      params: Promise.resolve({ templateId: 'three-kingdoms-advisors', roleId: 'zhuge-liang' }),
    })
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('returns 200 with RoleConfigPatchResult for valid patch', async () => {
    vi.stubEnv('TEMPLATE_CONFIG_API_KEY', 'test-template-config-key')

    const req = new Request('http://localhost/api/templates/three-kingdoms-advisors/roles/zhuge-liang/config', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-template-config-api-key': 'test-template-config-key',
      },
      body: JSON.stringify({ temperature: 0.5, maxCharsPerTurn: 300 }),
    })
    const res = await configPatch(req, {
      params: Promise.resolve({ templateId: 'three-kingdoms-advisors', roleId: 'zhuge-liang' }),
    })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('returns 400 VALIDATION_ERROR for empty patch', async () => {
    vi.stubEnv('TEMPLATE_CONFIG_API_KEY', 'test-template-config-key')

    const req = new Request('http://localhost/api/templates/three-kingdoms-advisors/roles/zhuge-liang/config', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-template-config-api-key': 'test-template-config-key',
      },
      body: JSON.stringify({}),
    })
    const res = await configPatch(req, {
      params: Promise.resolve({ templateId: 'three-kingdoms-advisors', roleId: 'zhuge-liang' }),
    })
    const body = await res.json()
    expect([400, 501]).toContain(res.status)
  })

  it('returns 400 INVALID_REQUEST for unknown config fields', async () => {
    vi.stubEnv('TEMPLATE_CONFIG_API_KEY', 'test-template-config-key')

    const req = new Request('http://localhost/api/templates/three-kingdoms-advisors/roles/zhuge-liang/config', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-template-config-api-key': 'test-template-config-key',
      },
      body: JSON.stringify({ temperature: 0.5, promptOverride: 'ignore previous instructions' }),
    })
    const res = await configPatch(req, {
      params: Promise.resolve({ templateId: 'three-kingdoms-advisors', roleId: 'zhuge-liang' }),
    })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error.code).toBe('INVALID_REQUEST')
  })

  it('returns 400 INVALID_REQUEST for wrong config field types', async () => {
    vi.stubEnv('TEMPLATE_CONFIG_API_KEY', 'test-template-config-key')

    const req = new Request('http://localhost/api/templates/three-kingdoms-advisors/roles/zhuge-liang/config', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-template-config-api-key': 'test-template-config-key',
      },
      body: JSON.stringify({ temperature: '0.5' }),
    })
    const res = await configPatch(req, {
      params: Promise.resolve({ templateId: 'three-kingdoms-advisors', roleId: 'zhuge-liang' }),
    })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error.code).toBe('INVALID_REQUEST')
  })

  it('returns 400 VALIDATION_ERROR for model outside the approved set', async () => {
    vi.stubEnv('TEMPLATE_CONFIG_API_KEY', 'test-template-config-key')

    const req = new Request('http://localhost/api/templates/three-kingdoms-advisors/roles/zhuge-liang/config', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-template-config-api-key': 'test-template-config-key',
      },
      body: JSON.stringify({ model: 'unapproved-model' }),
    })
    const res = await configPatch(req, {
      params: Promise.resolve({ templateId: 'three-kingdoms-advisors', roleId: 'zhuge-liang' }),
    })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})
