import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type {
  ApiResponse,
  CreateProviderConnectionRequest,
  ProviderConnectionDTO,
  ProviderConnectionListResult,
} from '@/types/api'
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

export async function GET(): Promise<NextResponse<ApiResponse<ProviderConnectionListResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const data = await getService().listProviderConnections()
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    const code = err instanceof ServiceError ? err.code : 'INTERNAL_ERROR'
    const message = err instanceof ServiceError ? err.message : 'An unexpected error occurred'
    return NextResponse.json({ success: false, data: null, error: { code, message }, requestId }, { status: 500 })
  }
}

export async function POST(_req: NextRequest): Promise<NextResponse<ApiResponse<ProviderConnectionDTO>>> {
  const requestId = crypto.randomUUID()
  try {
    void ({} as CreateProviderConnectionRequest)
    const data = await getService().createProviderConnection()
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
