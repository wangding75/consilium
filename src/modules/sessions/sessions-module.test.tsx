import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SessionsModule } from '@/modules/sessions'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const mockSessions = [
  { id: 's1', topic: '测试会话1', status: 'running', createdAt: Date.now(), updatedAt: Date.now() },
  { id: 's2', topic: '测试会话2', status: 'archived', createdAt: Date.now(), updatedAt: Date.now() },
]

beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ success: true, data: mockSessions }),
  }))
})

// Task-06: Session center search, filter, archive/resume UI
describe('SessionsModule — Task-06', () => {
  it('renders session list with status badges', async () => {
    render(<SessionsModule />)
    await waitFor(() => expect(screen.getByText(/测试会话1/)).toBeTruthy())
  })

  it('displays filter tabs for status', async () => {
    render(<SessionsModule />)
    await waitFor(() => expect(screen.getByText(/进行中/)).toBeTruthy())
  })

  it('shows search input for keyword filtering', async () => {
    render(<SessionsModule />)
    await waitFor(() => expect(screen.getByPlaceholderText(/搜索/)).toBeTruthy())
  })

  it('renders archive action on session cards', async () => {
    render(<SessionsModule />)
    await waitFor(() => expect(screen.getByText(/归档/)).toBeTruthy())
  })

  it('renders resume action for archived sessions', async () => {
    render(<SessionsModule />)
    await waitFor(() => expect(screen.getByText(/恢复/)).toBeTruthy())
  })
})
