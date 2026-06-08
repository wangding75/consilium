import { NextResponse } from 'next/server'
import type { ApiResponse, TemplateListSettingsResult } from '@/types/api'
import { TemplateService } from '@/server/services/template.service'
import { sharedTemplateRepo } from '@/server/repositories/mock/instances'
import { ServiceError } from '@/server/errors'

export async function GET(): Promise<NextResponse<ApiResponse<TemplateListSettingsResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const service = new TemplateService(sharedTemplateRepo)
    const data = await service.listTemplateSummariesForSettings()
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    const code = err instanceof ServiceError ? err.code : 'INTERNAL_ERROR'
    const message = err instanceof ServiceError ? err.message : 'An unexpected error occurred'
    return NextResponse.json(
      { success: false, data: null, error: { code, message }, requestId },
      { status: 500 }
    )
  }
}
