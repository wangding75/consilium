/**
 * Web-E2E: Settings data-security API HTTP endpoints (Task-10 coverage)
 *
 * Standard: standards/testing/web-e2e.md
 * Tests the full request → handler → response roundtrip for data-security APIs.
 * Calls route handler functions directly (the project's established web-e2e pattern).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { GET as exportGET } from '@/app/api/settings/export/route'
import { GET as sessionsExportGET } from '@/app/api/settings/export/sessions/route'
import { POST as importPreviewPOST } from '@/app/api/settings/import/preview/route'
import { POST as importPOST } from '@/app/api/settings/import/route'
import { POST as clearPOST } from '@/app/api/settings/clear/route'
import { sharedSettingsRepo } from '@/server/repositories/mock/instances'
import type { SettingsExportBundle } from '@/types'

function jsonPost(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeBundle(): SettingsExportBundle {
  return {
    version: '1.0.0',
    exportedAt: '2026-06-08T00:00:00.000Z',
    includePrompts: false,
    providerConnections: [
      {
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
      },
    ],
    templateRuntimeConfigs: [],
    prompts: [],
  }
}

beforeEach(async () => {
  await sharedSettingsRepo.clearAll()
})

// ─── GET /api/settings/export ──────────────────────────────────────────────────

describe('web-e2e: GET /api/settings/export', () => {
  it('returns 200 with the exported settings bundle', async () => {
    const res = await exportGET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.version).toBe('1.0.0')
    expect(Array.isArray(body.data.providerConnections)).toBe(true)
  })
})

// ─── POST /api/settings/import/preview ─────────────────────────────────────────

describe('web-e2e: POST /api/settings/import/preview', () => {
  it('returns 200 with preview token and additions', async () => {
    const req = jsonPost('/api/settings/import/preview', {
      bundle: makeBundle(),
      fileName: 'settings.json',
    })
    const res = await importPreviewPOST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(typeof body.data.previewToken).toBe('string')
    expect(body.data.additions).toContain('provider:conn-import')
  })
})

// ─── POST /api/settings/import ─────────────────────────────────────────────────

describe('web-e2e: POST /api/settings/import', () => {
  it('returns 200 after importing a previewed bundle', async () => {
    const bundle = makeBundle()
    const previewReq = jsonPost('/api/settings/import/preview', {
      bundle,
      fileName: 'settings.json',
    })
    const previewRes = await importPreviewPOST(previewReq)
    const previewBody = await previewRes.json()

    const req = jsonPost('/api/settings/import', {
      bundle,
      previewToken: previewBody.data.previewToken,
      overwrite: false,
    })
    const res = await importPOST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual({
      importedConnections: 1,
      importedTemplates: 0,
      importedPrompts: 0,
    })
    expect(await sharedSettingsRepo.getImportPreview(previewBody.data.previewToken)).toBeNull()
  })
})

// ─── GET /api/settings/export/sessions (sessions export skeleton) ──────────────

describe('web-e2e: GET /api/settings/export/sessions', () => {
  it('returns 501 NOT_IMPLEMENTED for skeleton', async () => {
    const res = await sessionsExportGET()
    expect(res.status).toBe(501)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_IMPLEMENTED')
  })
})

// ─── POST /api/settings/clear (expanded scope) ────────────────────────────────

describe('web-e2e: POST /api/settings/clear', () => {
  it('accepts cache scope and returns 200', async () => {
    const req = jsonPost('/api/settings/clear', { scope: 'cache' })
    const res = await clearPOST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toBeNull()
  })

  it('accepts sessions scope and returns 200', async () => {
    const req = jsonPost('/api/settings/clear', { scope: 'sessions' })
    const res = await clearPOST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('accepts settings scope and returns 200', async () => {
    const req = jsonPost('/api/settings/clear', { scope: 'settings' })
    const res = await clearPOST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('accepts all scope and returns 200', async () => {
    const req = jsonPost('/api/settings/clear', { scope: 'all' })
    const res = await clearPOST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 400 VALIDATION_ERROR for invalid scope', async () => {
    const req = jsonPost('/api/settings/clear', { scope: 'invalid-scope' })
    const res = await clearPOST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 VALIDATION_ERROR for empty body', async () => {
    const req = jsonPost('/api/settings/clear', {})
    const res = await clearPOST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 VALIDATION_ERROR for null body', async () => {
    const req = jsonPost('/api/settings/clear', null)
    const res = await clearPOST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})
