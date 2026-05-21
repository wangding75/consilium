import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { HomeModule } from '@/modules/home'
import { DiscussionModule } from '@/modules/discussion'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

const mockSessions = [
  { id: 's1', templateId: 'three-kingdoms-advisors', topic: 'Running session', status: 'running', state: { stage: 'idle', turnCount: 0, lastSpeakerId: null }, messages: [], createdAt: Date.now(), updatedAt: Date.now() },
  { id: 's2', templateId: 'three-kingdoms-advisors', topic: 'Completed session', status: 'completed', state: { stage: 'closing', turnCount: 10, lastSpeakerId: 'host' }, messages: [], createdAt: Date.now() - 1000, updatedAt: Date.now() },
  { id: 's3', templateId: 'three-kingdoms-advisors', topic: 'Archived session', status: 'archived', state: { stage: 'developing', turnCount: 4, lastSpeakerId: null }, messages: [], createdAt: Date.now() - 2000, updatedAt: Date.now() },
]

beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/sessions/recent') || url.includes('/api/sessions?')) {
      return Promise.resolve({ json: () => Promise.resolve({ success: true, data: mockSessions }) })
    }
    if (url.includes('/api/sessions/invalid-session-id')) {
      return Promise.resolve({ json: () => Promise.resolve({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' } }) })
    }
    return Promise.resolve({ json: () => Promise.resolve({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }) })
  }))
})

// Task-07: Home recent discussions & discussion detail entry status handling
describe('Home & Discussion lifecycle status — Task-07', () => {
  it('displays running status text for active sessions in home', async () => {
    render(<HomeModule />)
    await waitFor(() => expect(screen.getByText(/进行中/)).toBeTruthy())
  })

  it('displays completed status text in home', async () => {
    render(<HomeModule />)
    await waitFor(() => expect(screen.getByText(/已完成/)).toBeTruthy())
  })

  it('displays archived status text in home', async () => {
    render(<HomeModule />)
    await waitFor(() => expect(screen.getByText(/已归档/)).toBeTruthy())
  })

  it('discussion page shows error state for invalid sessionId', async () => {
    render(<DiscussionModule sessionId="invalid-session-id" />)
    await waitFor(() => expect(screen.getByText(/错误|不存在|找不到/)).toBeTruthy())
  })
})
