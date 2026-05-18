import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types/api'
import type { Session } from '@/types'
import { SessionService } from '@/server/services/session.service'
import { sharedSessionRepo, sharedTemplateRepo } from '@/server/repositories/mock/instances'
import { ServiceError } from '@/server/errors'

export async function GET(): Promise<NextResponse<ApiResponse<Session[]>>> {
  const requestId = crypto.randomUUID()
  try {
    const service = new SessionService(sharedSessionRepo, sharedTemplateRepo)
    const data = await service.getRecentSessions(10)
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
