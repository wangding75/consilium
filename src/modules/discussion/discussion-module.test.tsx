import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DiscussionModule } from '@/modules/discussion'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

global.fetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    json: async () => ({ success: true, data: { messages: [], activeSpeakerId: null, hasMore: false } }),
  })
})

it('DiscussionModule renders send button', () => {
  render(<DiscussionModule sessionId="sess-1" />)
  expect(screen.getByRole('button', { name: '发送' })).toBeInTheDocument()
})

it('DiscussionModule renders sessionId in the page', () => {
  render(<DiscussionModule sessionId="sess-test-id" />)
  expect(screen.getByText(/sess-test-id/)).toBeInTheDocument()
})
