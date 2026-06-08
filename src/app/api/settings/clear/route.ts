import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { ApiResponse } from '@/types/api'
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

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<null>>> {
  const requestId = crypto.randomUUID()
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' }, requestId },
        { status: 400 }
      )
    }

    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'scope is required' }, requestId },
        { status: 400 }
      )
    }

    const { scope } = body as Record<string, unknown>
    if (typeof scope !== 'string' || !['sessions', 'settings', 'all'].includes(scope)) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'scope must be sessions, settings, or all' }, requestId },
        { status: 400 }
      )
    }

    await getService().clearData(scope as 'sessions' | 'settings' | 'all')
    return NextResponse.json({ success: true, data: null, requestId })
  } catch (err) {
    const code = err instanceof ServiceError ? err.code : 'INTERNAL_ERROR'
    const message = err instanceof ServiceError ? err.message : 'An unexpected error occurred'
    return NextResponse.json(
      { success: false, data: null, error: { code, message }, requestId },
      { status: 500 }
    )
  }
}