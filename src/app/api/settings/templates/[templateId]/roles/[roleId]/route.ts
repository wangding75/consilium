import { NextResponse } from 'next/server'
import type {
  ApiResponse,
  DeleteTemplateRoleResult,
  TemplateRolesResult,
  UpdateTemplateRoleRequest,
} from '@/types/api'
import { TemplateService } from '@/server/services/template.service'
import { sharedTemplateRepo } from '@/server/repositories/mock/instances'
import { ServiceError } from '@/server/errors'

function getService(): TemplateService {
  return new TemplateService(sharedTemplateRepo)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ templateId: string; roleId: string }> }
): Promise<NextResponse<ApiResponse<TemplateRolesResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const { templateId, roleId } = await params
    const body = await req.json() as UpdateTemplateRoleRequest
    const data = await getService().updateRole(templateId, roleId, body)
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError) {
      const status =
        err.code === 'TEMPLATE_NOT_FOUND' || err.code === 'ROLE_NOT_FOUND'
          ? 404
          : err.code === 'VALIDATION_ERROR' || err.code === 'TEMPLATE_NOT_EDITABLE' || err.code === 'TEMPLATE_UNAVAILABLE'
            ? 400
            : err.code === 'NOT_IMPLEMENTED'
              ? 501
              : 500
      return NextResponse.json({ success: false, data: null, error: { code: err.code, message: err.message }, requestId }, { status })
    }
    return NextResponse.json(
      { success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, requestId },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ templateId: string; roleId: string }> }
): Promise<NextResponse<ApiResponse<DeleteTemplateRoleResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const { templateId, roleId } = await params
    const data = await getService().deleteRole(templateId, roleId)
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError) {
      const status =
        err.code === 'TEMPLATE_NOT_FOUND' || err.code === 'ROLE_NOT_FOUND'
          ? 404
          : err.code === 'ROLE_DELETE_FORBIDDEN'
            ? 409
            : err.code === 'VALIDATION_ERROR' || err.code === 'TEMPLATE_NOT_EDITABLE' || err.code === 'TEMPLATE_UNAVAILABLE'
              ? 400
              : err.code === 'NOT_IMPLEMENTED'
                ? 501
                : 500
      return NextResponse.json({ success: false, data: null, error: { code: err.code, message: err.message }, requestId }, { status })
    }
    return NextResponse.json(
      { success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, requestId },
      { status: 500 }
    )
  }
}
