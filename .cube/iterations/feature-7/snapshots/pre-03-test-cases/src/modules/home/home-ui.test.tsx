/**
 * HomeModule frontend-ui tests
 *
 * Standard: standards/testing/frontend-ui.md
 * Coverage: Task-10 – HomeModule 首页完整 UI
 *
 * These tests verify rendering and interaction behavior of HomeModule using
 * React Testing Library + jsdom. Full frontend-to-backend roundtrip verification
 * (real browser, real HTTP) is deferred to stage 05 manual walkthrough,
 * which is a Known Risk to be approved by the user.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { HomeModule } from '@/modules/home'

const mockRouterPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}))

global.fetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    json: async () => ({ success: true, data: [] }),
  })
})

it('HomeModule renders topic textarea', () => {
  render(<HomeModule />)
  expect(screen.getByPlaceholderText('输入讨论议题...')).toBeInTheDocument()
})

it('HomeModule renders 开始讨论 button', () => {
  render(<HomeModule />)
  expect(screen.getByRole('button', { name: '开始讨论' })).toBeInTheDocument()
})

it('HomeModule renders 4 quick-start chips', () => {
  render(<HomeModule />)
  expect(screen.getByText('评估新功能优先级')).toBeInTheDocument()
  expect(screen.getByText('制定市场进入策略')).toBeInTheDocument()
  expect(screen.getByText('分析用户增长方案')).toBeInTheDocument()
  expect(screen.getByText('优化定价策略')).toBeInTheDocument()
})

it('clicking quick-start chip fills topic textarea', () => {
  render(<HomeModule />)
  fireEvent.click(screen.getByText('评估新功能优先级'))
  const textarea = screen.getByPlaceholderText('输入讨论议题...')
  expect((textarea as HTMLTextAreaElement).value).toBe('评估新功能优先级')
})

it('submitting empty topic shows TOPIC_REQUIRED error', async () => {
  render(<HomeModule />)
  fireEvent.click(screen.getByRole('button', { name: '开始讨论' }))
  expect(screen.getByText('请输入讨论议题')).toBeInTheDocument()
})

it('empty topic submit does not call fetch', () => {
  render(<HomeModule />)
  fireEvent.click(screen.getByRole('button', { name: '开始讨论' }))
  expect(global.fetch).not.toHaveBeenCalledWith('/api/sessions', expect.anything())
})

it('HomeModule fetches recent sessions on mount', async () => {
  render(<HomeModule />)
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith('/api/sessions/recent')
  })
})

it('HomeModule renders 暂无最近讨论 when API returns empty array', async () => {
  render(<HomeModule />)
  await waitFor(() => {
    expect(screen.getByText('暂无最近讨论')).toBeInTheDocument()
  })
})

it('HomeModule renders recent session list when API returns data', async () => {
  ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    json: async () => ({
      success: true,
      data: [
        {
          id: 'session-1',
          topic: '近期讨论议题',
          templateId: 'three-kingdoms-advisors',
          status: 'active',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          state: { stage: 'idle', turnCount: 0, lastSpeakerId: null },
          messages: [],
        },
      ],
    }),
  })
  render(<HomeModule />)
  await waitFor(() => {
    expect(screen.getByText('近期讨论议题')).toBeInTheDocument()
  })
})

it('topic character counter shows n/100', () => {
  render(<HomeModule />)
  const textarea = screen.getByPlaceholderText('输入讨论议题...')
  fireEvent.change(textarea, { target: { value: '测试' } })
  expect(screen.getByText('2/100')).toBeInTheDocument()
})

it('clicking 开始讨论 with valid topic calls POST /api/sessions', async () => {
  ;(global.fetch as ReturnType<typeof vi.fn>)
    .mockResolvedValueOnce({ json: async () => ({ success: true, data: [] }) })
    .mockResolvedValueOnce({
      json: async () => ({
        success: true,
        data: { sessionId: 'new-session-id', topic: '测试', status: 'active', createdAt: Date.now(), template: { id: 't1', name: '三国' } },
      }),
    })
  render(<HomeModule />)
  const textarea = screen.getByPlaceholderText('输入讨论议题...')
  fireEvent.change(textarea, { target: { value: '如何提高效率' } })
  fireEvent.click(screen.getByRole('button', { name: '开始讨论' }))
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/sessions',
      expect.objectContaining({ method: 'POST' })
    )
  })
})

it('clicking 开始讨论 with valid topic navigates to /discussion/[sessionId]', async () => {
  ;(global.fetch as ReturnType<typeof vi.fn>)
    .mockResolvedValueOnce({ json: async () => ({ success: true, data: [] }) })
    .mockResolvedValueOnce({
      json: async () => ({
        success: true,
        data: { sessionId: 'nav-session-id', topic: '测试', status: 'active', createdAt: Date.now(), template: { id: 't1', name: '三国' } },
      }),
    })
  render(<HomeModule />)
  const textarea = screen.getByPlaceholderText('输入讨论议题...')
  fireEvent.change(textarea, { target: { value: '如何提高效率' } })
  fireEvent.click(screen.getByRole('button', { name: '开始讨论' }))
  await waitFor(() => {
    expect(mockRouterPush).toHaveBeenCalledWith('/discussion/nav-session-id')
  })
})
