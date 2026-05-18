import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types/api'
import type { Discussion } from '@/types'
import { DiscussionService } from '@/server/services/discussion.service'
import { MockDiscussionRepository } from '@/server/repositories/mock/mock-discussion.repository'
import { ServiceError } from '@/server/errors'

export async function GET(): Promise<NextResponse<ApiResponse<Discussion[]>>> {
  const requestId = crypto.randomUUID()
  try {
    const service = new DiscussionService(new MockDiscussionRepository())
    const data = await service.listDiscussions()
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
