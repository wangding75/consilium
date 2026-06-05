import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { ApiResponse, ProviderStatusDTO, UpsertProviderConfigRequest } from '@/types/api'
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

export async function GET(): Promise<NextResponse<ApiResponse<ProviderStatusDTO[]>>> {
  const requestId = crypto.randomUUID()
  try {
    const service = getService()
    const data = await service.listProviders()
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

export async function PUT(req: NextRequest): Promise<NextResponse<ApiResponse<Partial<ProviderStatusDTO>>>> {
  const requestId = crypto.randomUUID()
  try {
    const body = (await req.json()) as UpsertProviderConfigRequest
    if (!body.providerId) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'providerId is required' }, requestId },
        { status: 400 }
      )
    }
    const service = getService()
    const data = await service.upsertProviderConfig(body)
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    const code = err instanceof ServiceError ? err.code ?? 'INTERNAL_ERROR' : 'INTERNAL_ERROR'
    const message = err instanceof ServiceError ? err.message : 'An unexpected error occurred'
    return NextResponse.json(
      { success: false, data: null, error: { code, message }, requestId },
      { status: 500 }
    )
  }
}
