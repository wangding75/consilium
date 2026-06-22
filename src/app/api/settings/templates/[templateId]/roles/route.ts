import { NextResponse } from 'next/server'
import type { ApiResponse, CreateTemplateRoleRequest, TemplateRolesResult } from '@/types/api'
import { TemplateService } from '@/server/services/template.service'
import { sharedTemplateRepo } from '@/server/repositories/mock/instances'
import { ServiceError } from '@/server/errors'

function getService(): TemplateService {
  return new TemplateService(sharedTemplateRepo)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ templateId: string }> }
): Promise<NextResponse<ApiResponse<TemplateRolesResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const { templateId } = await params
    const body = await req.json() as CreateTemplateRoleRequest
    const data = await getService().createRole(templateId, body)
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError) {
      const status =
        err.code === 'TEMPLATE_NOT_FOUND'
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
