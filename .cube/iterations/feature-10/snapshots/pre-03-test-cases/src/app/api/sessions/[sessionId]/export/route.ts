import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { ApiResponse, SessionExportResult } from '@/types/api'
import { SessionExportService } from '@/server/services/session-export.service'
import { sharedSessionRepo, sharedMessageRepo, sharedEventRepo, sharedVoteRepo } from '@/server/repositories/mock/instances'
import { ServiceError } from '@/server/errors'

function getService(): SessionExportService {
  return new SessionExportService(
    sharedSessionRepo,
    sharedMessageRepo,
    sharedEventRepo,
    sharedVoteRepo
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse<ApiResponse<SessionExportResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const { sessionId } = await params
    const service = getService()
    const data = await service.exportToMarkdown(sessionId)
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError && err.code === 'NOT_FOUND') {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'NOT_FOUND', message: 'Session not found' }, requestId },
        { status: 404 }
      )
    }
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    return NextResponse.json(
      { success: false, data: null, error: { code: 'INTERNAL_ERROR', message }, requestId },
      { status: 500 }
    )
  }
}
