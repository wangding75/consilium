/**
 * Web-E2E: Settings templates API HTTP endpoints (Task-09 coverage)
 *
 * Standard: standards/testing/web-e2e.md
 * Tests the full request → handler → response roundtrip for settings templates APIs.
 * Calls route handler functions directly (the project's established web-e2e pattern).
 */

import { describe, it, expect } from 'vitest'
import { POST as templatesPOST } from '@/app/api/settings/templates/route'
import { PATCH as templatePATCH } from '@/app/api/settings/templates/[templateId]/route'
import { POST as rolesPOST } from '@/app/api/settings/templates/[templateId]/roles/route'
import { PATCH as rolePATCH } from '@/app/api/settings/templates/[templateId]/roles/[roleId]/route'
import { DELETE as roleDELETE } from '@/app/api/settings/templates/[templateId]/roles/[roleId]/route'
import { POST as roleCopyPOST } from '@/app/api/settings/templates/[templateId]/roles/[roleId]/copy/route'

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

// ─── POST /api/settings/templates (create template skeleton) ──────────────────

describe('web-e2e: POST /api/settings/templates', () => {
  it('returns 501 NOT_IMPLEMENTED for skeleton', async () => {
    const req = jsonPost('/api/settings/templates', {
      name: 'New Template',
      description: 'A test template',
      defaultStrategy: 'smart_fallback',
    })
    const res = await templatesPOST(req)
    expect(res.status).toBe(501)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('NOT_IMPLEMENTED')
  })
})

// ─── PATCH /api/settings/templates/[templateId] (update template skeleton) ────

describe('web-e2e: PATCH /api/settings/templates/[templateId]', () => {
  it('returns 501 NOT_IMPLEMENTED for skeleton', async () => {
    const req = jsonPatch('/api/settings/templates/startup-board', { name: 'Renamed' })
    const res = await templatePATCH(req, { params: Promise.resolve({ templateId: 'startup-board' }) })
    expect(res.status).toBe(501)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_IMPLEMENTED')
  })
})

// ─── POST /api/settings/templates/[templateId]/roles ──────────────────────────

describe('web-e2e: POST /api/settings/templates/[templateId]/roles', () => {
  it('returns 200 and created role list', async () => {
    const suffix = crypto.randomUUID().slice(0, 8)
    const roleName = `Expert ${suffix}`
    const req = jsonPost('/api/settings/templates/startup-board/roles', {
      name: roleName,
      persona: 'Domain expert',
      systemPrompt: 'You are an expert.',
      providerConnectionId: 'conn-001',
      model: 'gpt-4o',
    })
    const res = await rolesPOST(req, { params: Promise.resolve({ templateId: 'startup-board' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.templateId).toBe('startup-board')
    expect(body.data.roles.some((role: { name: string }) => role.name === roleName)).toBe(true)
  })
})

// ─── PATCH /api/settings/templates/[templateId]/roles/[roleId] (update role) ──

describe('web-e2e: PATCH /api/settings/templates/[templateId]/roles/[roleId]', () => {
  it('returns 501 NOT_IMPLEMENTED for skeleton', async () => {
    const req = jsonPatch('/api/settings/templates/startup-board/roles/ceo-host', { enabled: false })
    const res = await rolePATCH(req, { params: Promise.resolve({ templateId: 'startup-board', roleId: 'ceo-host' }) })
    expect(res.status).toBe(501)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_IMPLEMENTED')
  })
})

// ─── DELETE /api/settings/templates/[templateId]/roles/[roleId] ───────────────

describe('web-e2e: DELETE /api/settings/templates/[templateId]/roles/[roleId]', () => {
  it('returns 200 after deleting an existing role', async () => {
    const suffix = crypto.randomUUID().slice(0, 8)
    const roleName = `Delete Me ${suffix}`
    const roleId = `delete-me-${suffix}`

    await rolesPOST(
      jsonPost('/api/settings/templates/startup-board/roles', {
        name: roleName,
        persona: 'Disposable role',
        systemPrompt: 'Temporary role.',
        providerConnectionId: 'conn-001',
        model: 'gpt-4o',
      }),
      { params: Promise.resolve({ templateId: 'startup-board' }) }
    )

    const req = jsonDelete(`/api/settings/templates/startup-board/roles/${roleId}`)
    const res = await roleDELETE(req, { params: Promise.resolve({ templateId: 'startup-board', roleId }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.deletedRoleId).toBe(roleId)
  })
})

// ─── POST /api/settings/templates/[templateId]/roles/[roleId]/copy (copy role) ─

describe('web-e2e: POST /api/settings/templates/[templateId]/roles/[roleId]/copy', () => {
  it('returns 501 NOT_IMPLEMENTED for skeleton', async () => {
    const req = jsonPost('/api/settings/templates/startup-board/roles/ceo-host/copy', {})
    const res = await roleCopyPOST(req, { params: Promise.resolve({ templateId: 'startup-board', roleId: 'ceo-host' }) })
    expect(res.status).toBe(501)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_IMPLEMENTED')
  })
})
