import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types/api'
import type { Template } from '@/types'
import { TemplateService } from '@/server/services/template.service'
import { MockTemplateRepository } from '@/server/repositories/mock/mock-template.repository'
import { ServiceError } from '@/server/errors'

export async function GET(): Promise<NextResponse<ApiResponse<Template[]>>> {
  const requestId = crypto.randomUUID()
  try {
    const service = new TemplateService(new MockTemplateRepository())
    const data = await service.listTemplates()
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    const code = err instanceof ServiceError ? err.code : 'INTERNAL_ERROR'
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, data: null, error: { code, message }, requestId },
      { status: 500 }
    )
  }
}
