import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types/api'
import type { Session } from '@/types'
import { SessionService } from '@/server/services/session.service'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { ServiceError } from '@/server/errors'

export async function GET(): Promise<NextResponse<ApiResponse<Session[]>>> {
  const requestId = crypto.randomUUID()
  try {
    const service = new SessionService(new MockSessionRepository())
    const data = await service.listSessions()
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
