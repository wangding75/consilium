import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types/api'
import type { SettingsExportBundle } from '@/types'
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

export async function GET(): Promise<NextResponse<ApiResponse<SettingsExportBundle>>> {
  const requestId = crypto.randomUUID()
  try {
    const data = await getService().exportSettings()
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError) {
      const status = err.code === 'NOT_IMPLEMENTED' ? 501 : 500
      return NextResponse.json({ success: false, data: null, error: { code: err.code, message: err.message }, requestId }, { status })
    }
    return NextResponse.json(
      { success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, requestId },
      { status: 500 }
    )
  }
}
