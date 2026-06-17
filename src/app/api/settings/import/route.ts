import { NextResponse } from 'next/server'
import type { ApiResponse, SettingsImportCommitRequest, SettingsImportCommitResult } from '@/types/api'
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

export async function POST(req: Request): Promise<NextResponse<ApiResponse<SettingsImportCommitResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const body = await req.json() as SettingsImportCommitRequest
    const data = await getService().importSettings(body)
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError) {
      const status = err.code === 'VALIDATION_ERROR' ? 400 : err.code === 'IMPORT_CONFLICT' ? 409 : err.code === 'NOT_IMPLEMENTED' ? 501 : 500
      return NextResponse.json({ success: false, data: null, error: { code: err.code, message: err.message }, requestId }, { status })
    }
    return NextResponse.json(
      { success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, requestId },
      { status: 500 }
    )
  }
}
