import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type {
  ApiResponse,
  ProviderConnectionDTO,
  ProviderConnectionDeleteResult,
  UpdateProviderConnectionRequest,
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

export async function PATCH(
  _req: NextRequest,
  _context: { params: Promise<{ connectionId: string }> }
): Promise<NextResponse<ApiResponse<ProviderConnectionDTO>>> {
  const requestId = crypto.randomUUID()
  try {
    void ({} as UpdateProviderConnectionRequest)
    const data = await getService().updateProviderConnection()
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError) {
      const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'VALIDATION_ERROR' ? 400 : err.code === 'NOT_IMPLEMENTED' ? 501 : 500
      return NextResponse.json({ success: false, data: null, error: { code: err.code, message: err.message }, requestId }, { status })
    }
    return NextResponse.json(
      { success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, requestId },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  _context: { params: Promise<{ connectionId: string }> }
): Promise<NextResponse<ApiResponse<ProviderConnectionDeleteResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const data = await getService().deleteProviderConnection()
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError) {
      const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'CONNECTION_IN_USE' ? 409 : err.code === 'NOT_IMPLEMENTED' ? 501 : 500
      return NextResponse.json({ success: false, data: null, error: { code: err.code, message: err.message }, requestId }, { status })
    }
    return NextResponse.json(
      { success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, requestId },
      { status: 500 }
    )
  }
}
