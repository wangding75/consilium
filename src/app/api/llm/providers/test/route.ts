import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { ApiResponse, ProviderTestRequest, ProviderTestResult } from '@/types/api'
import { SettingsService } from '@/server/services/settings.service'
import { sharedSettingsRepo, sharedSessionRepo, sharedMessageRepo, sharedEventRepo, sharedVoteRepo } from '@/server/repositories/mock/instances'
import { ServiceError } from '@/server/errors'

function getService(): SettingsService {
  return new SettingsService(
    sharedSettingsRepo,
    sharedSessionRepo,
    sharedMessageRepo,
    sharedEventRepo,
    sharedVoteRepo
  )
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<ProviderTestResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const body = (await req.json()) as ProviderTestRequest
    if (!body.providerId) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'providerId is required' }, requestId },
        { status: 400 }
      )
    }
    const service = getService()
    const data = await service.testProvider(body)
    if (data.status === 'failed') {
      return NextResponse.json(
        { success: false, data: null, error: { code: data.errorCode ?? 'PROVIDER_TEST_FAILED', message: data.errorMessage ?? 'Provider connection test failed' }, requestId },
        { status: 500 }
      )
    }
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError) {
      const status = err.code === 'PROVIDER_NOT_CONFIGURED' ? 422 : 500
      return NextResponse.json(
        { success: false, data: null, error: { code: err.code, message: err.message }, requestId },
        { status }
      )
    }
    return NextResponse.json(
      { success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, requestId },
      { status: 500 }
    )
  }
}
