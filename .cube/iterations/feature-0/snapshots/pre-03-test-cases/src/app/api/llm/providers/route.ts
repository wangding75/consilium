import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types/api'
import { LlmService } from '@/server/services/llm.service'
import { ServiceError } from '@/server/errors'
import { getAppConfig } from '@/config'

export async function GET(): Promise<NextResponse<ApiResponse<{ id: string; name: string }[]>>> {
  const requestId = crypto.randomUUID()
  try {
    const service = new LlmService(getAppConfig())
    const data = await service.listProviders()
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
