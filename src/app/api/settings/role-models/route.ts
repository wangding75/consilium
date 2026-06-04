import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { ApiResponse, RoleModelOverrideDTO, SaveRoleModelOverridesRequest } from '@/types/api'
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

export async function GET(): Promise<NextResponse<ApiResponse<RoleModelOverrideDTO[]>>> {
  const requestId = crypto.randomUUID()
  try {
    const data = await getService().getRoleModelOverrides()
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : 'An unexpected error occurred'
    return NextResponse.json(
      { success: false, data: null, error: { code: 'INTERNAL_ERROR', message }, requestId },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse<ApiResponse<RoleModelOverrideDTO[]>>> {
  const requestId = crypto.randomUUID()
  try {
    const body = (await req.json()) as SaveRoleModelOverridesRequest
    if (!Array.isArray(body.overrides)) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'overrides must be an array' }, requestId },
        { status: 400 }
      )
    }
    const data = await getService().saveRoleModelOverrides(body.overrides)
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    const code = err instanceof ServiceError ? err.code : 'INTERNAL_ERROR'
    const message = err instanceof ServiceError ? err.message : 'An unexpected error occurred'
    return NextResponse.json(
      { success: false, data: null, error: { code, message }, requestId },
      { status: 500 }
    )
  }
}
