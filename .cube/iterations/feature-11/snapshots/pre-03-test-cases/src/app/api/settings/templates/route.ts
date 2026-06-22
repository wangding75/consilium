import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { ApiResponse, CreateTemplateRequest, TemplateDetailResult } from '@/types/api'
import { TemplateService } from '@/server/services/template.service'
import { sharedTemplateRepo } from '@/server/repositories/mock/instances'
import { ServiceError } from '@/server/errors'

function getService(): TemplateService {
  return new TemplateService(sharedTemplateRepo)
}

export async function POST(_req: NextRequest): Promise<NextResponse<ApiResponse<TemplateDetailResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const data = await getService().createTemplate({} as CreateTemplateRequest)
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError) {
      const status = err.code === 'VALIDATION_ERROR' ? 400 : err.code === 'NOT_IMPLEMENTED' ? 501 : 500
      return NextResponse.json({ success: false, data: null, error: { code: err.code, message: err.message }, requestId }, { status })
    }
    return NextResponse.json(
      { success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, requestId },
      { status: 500 }
    )
  }
}
