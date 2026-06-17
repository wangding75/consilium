import { NextResponse } from 'next/server'
import type { ApiResponse, ProviderConnectionTestResult } from '@/types/api'
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

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ connectionId: string }> }
): Promise<NextResponse<ApiResponse<ProviderConnectionTestResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const { connectionId } = await params
    const data = await getService().testSavedProviderConnection(connectionId)
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError) {
      const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'NOT_IMPLEMENTED' ? 501 : 500
      return NextResponse.json({ success: false, data: null, error: { code: err.code, message: err.message }, requestId }, { status })
    }
    return NextResponse.json(
      { success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, requestId },
      { status: 500 }
    )
  }
}
