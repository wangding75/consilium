import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types/api'
import type { TemplateRolesResult } from '@/types/api'
import { TemplateService } from '@/server/services/template.service'
import { sharedTemplateRepo } from '@/server/repositories/mock/instances'
import { ServiceError } from '@/server/errors'

export async function GET(
  _request: Request,
  { params }: { params: { templateId: string } }
): Promise<NextResponse<ApiResponse<TemplateRolesResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const service = new TemplateService(sharedTemplateRepo)
    const data = await service.listTemplateRoles(params.templateId)
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError) {
      const httpStatus = err.code === 'TEMPLATE_NOT_FOUND' ? 404 : err.code === 'TEMPLATE_UNAVAILABLE' ? 400 : 500
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
