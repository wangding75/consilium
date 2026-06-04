import { NextResponse } from 'next/server'
import type { ApiResponse, RoleConfigPatchRequest, RoleConfigPatchResult } from '@/types/api'
import { TemplateService } from '@/server/services/template.service'
import { sharedTemplateRepo } from '@/server/repositories/mock/instances'
import { ServiceError } from '@/server/errors'

const TEMPLATE_CONFIG_API_KEY_HEADER = 'x-template-config-api-key'

function getTemplateConfigApiKey(): string {
  const expectedApiKey = process.env.TEMPLATE_CONFIG_API_KEY
  if (!expectedApiKey) {
    throw new ServiceError('INTERNAL_ERROR', 'Template config authorization is not configured')
  }

  return expectedApiKey
}

function isAuthorizedTemplateConfigRequest(request: Request, expectedApiKey: string): boolean {
  return request.headers.get(TEMPLATE_CONFIG_API_KEY_HEADER) === expectedApiKey
}

const ALLOWED_ROLE_CONFIG_FIELDS = new Set<keyof RoleConfigPatchRequest>([
  'model',
  'temperature',
  'maxCharsPerTurn',
])

function parseRoleConfigPatch(body: unknown): { patch?: RoleConfigPatchRequest; error?: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { error: 'Request body must be an object' }
  }

  const patch: RoleConfigPatchRequest = {}

  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_ROLE_CONFIG_FIELDS.has(key as keyof RoleConfigPatchRequest)) {
      return { error: `Unknown config field: ${key}` }
    }

    if (key === 'model') {
      if (typeof value !== 'string' || value.trim() === '') {
        return { error: 'model must be a non-empty string' }
      }
      patch.model = value
      continue
    }

    if (key === 'temperature') {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return { error: 'temperature must be a finite number' }
      }
      patch.temperature = value
      continue
    }

    if (key === 'maxCharsPerTurn') {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return { error: 'maxCharsPerTurn must be an integer' }
      }
      patch.maxCharsPerTurn = value
    }
  }

  return { patch }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ templateId: string; roleId: string }> }
): Promise<NextResponse<ApiResponse<RoleConfigPatchResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const expectedApiKey = getTemplateConfigApiKey()
    if (!isAuthorizedTemplateConfigRequest(request, expectedApiKey)) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'FORBIDDEN', message: 'Template config updates require explicit authorization' },
          requestId,
        },
        { status: 403 }
      )
    }

    const { templateId, roleId } = await params
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'INVALID_REQUEST', message: 'Invalid JSON body' }, requestId },
        { status: 400 }
      )
    }

    const parsed = parseRoleConfigPatch(body)
    if (parsed.error || !parsed.patch) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'INVALID_REQUEST', message: parsed.error ?? 'Invalid request body' },
          requestId,
        },
        { status: 400 }
      )
    }

    const service = new TemplateService(sharedTemplateRepo)
    const data = await service.updateRoleConfig(templateId, roleId, parsed.patch)
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError) {
      const httpStatus =
        err.code === 'TEMPLATE_NOT_FOUND' || err.code === 'ROLE_NOT_FOUND'
          ? 404
          : err.code === 'TEMPLATE_UNAVAILABLE' || err.code === 'TEMPLATE_NOT_EDITABLE' || err.code === 'VALIDATION_ERROR'
            ? 400
            : 500
      return NextResponse.json(
        { success: false, data: null, error: { code: err.code, message: err.message }, requestId },
        { status: httpStatus }
      )
    }
    return NextResponse.json(
      { success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, requestId },
      { status: 500 }
    )
  }
}
