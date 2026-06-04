import { NextResponse } from 'next/server'
import type { ApiResponse, RoleConfigPatchRequest, RoleConfigPatchResult } from '@/types/api'
import { TemplateService } from '@/server/services/template.service'
import { sharedTemplateRepo } from '@/server/repositories/mock/instances'
import { ServiceError } from '@/server/errors'

export async function PATCH(
  request: Request,
  { params }: { params: { templateId: string; roleId: string } }
): Promise<NextResponse<ApiResponse<RoleConfigPatchResult>>> {
  const requestId = crypto.randomUUID()
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'INVALID_REQUEST', message: 'Invalid JSON body' }, requestId },
        { status: 400 }
      )
    }
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'INVALID_REQUEST', message: 'Request body must be an object' }, requestId },
        { status: 400 }
      )
    }
    const patch = body as RoleConfigPatchRequest
    const service = new TemplateService(sharedTemplateRepo)
    const data = await service.updateRoleConfig(params.templateId, params.roleId, patch)
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError) {
      const httpStatus =
        err.code === 'TEMPLATE_NOT_FOUND' || err.code === 'ROLE_NOT_FOUND' ? 404
        : err.code === 'TEMPLATE_UNAVAILABLE' || err.code === 'TEMPLATE_NOT_EDITABLE' || err.code === 'VALIDATION_ERROR' ? 400
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
