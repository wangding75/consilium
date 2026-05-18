import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types/api'
import { HealthService } from '@/server/services/health.service'
import { ServiceError } from '@/server/errors'
import { getAppConfig } from '@/config'

export async function GET(): Promise<NextResponse<ApiResponse<{ version: string; status: 'ok'; timestamp: string }>>> {
  const requestId = crypto.randomUUID()
  try {
    const config = getAppConfig()
    const service = new HealthService(config)
    const data = await service.getHealth()
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    const code = 'INTERNAL_ERROR'
    const message = err instanceof ServiceError ? err.message : 'An unexpected error occurred'
    return NextResponse.json(
      { success: false, data: null, error: { code, message }, requestId },
      { status: 500 }
    )
  }
}
