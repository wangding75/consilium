/**
 * SettingsModule frontend-ui tests (Task-11)
 *
 * Standard: standards/testing/frontend-ui.md
 * These tests verify the SettingsModule renders the three-entry navigation and handles
 * user interactions. Full browser roundtrip verification deferred to stage 05.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SettingsModule } from '@/modules/settings'

const mockRouterPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => new URLSearchParams(),
}))

global.fetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Task-11: SettingsModule UI ──────────────────────────────────────────────

describe('SettingsModule', () => {
  it('renders the settings page', async () => {
    render(<SettingsModule />)
    const heading = await screen.findByText(/设置/i)
    expect(heading).toBeInTheDocument()
  })

  it('renders three entry cards on home', async () => {
    render(<SettingsModule />)
    expect(await screen.findByText(/厂商配置/i)).toBeInTheDocument()
    expect(await screen.findByText(/模板配置/i)).toBeInTheDocument()
    expect(await screen.findByText(/数据安全/i)).toBeInTheDocument()
  })

  it('navigates to provider view when clicking provider card', async () => {
    render(<SettingsModule />)

    fireEvent.click(await screen.findByText(/厂商配置/i))

    await waitFor(() => {
      expect(screen.getByText('选择要管理的 Provider 类型。')).toBeInTheDocument()
    })
  })

  it('navigates to template view when clicking template card', async () => {
    render(<SettingsModule />)

    fireEvent.click(await screen.findByText(/模板配置/i))

    await waitFor(() => {
      expect(screen.getByText('返回')).toBeInTheDocument()
    })
  })

  it('navigates to data-security view when clicking data security card', async () => {
    render(<SettingsModule />)

    fireEvent.click(await screen.findByText(/数据安全/i))

    await waitFor(() => {
      expect(screen.getByText('数据安全设置')).toBeInTheDocument()
    })
  })

  it('returns to home from provider view via back button', async () => {
    render(<SettingsModule />)

    fireEvent.click(await screen.findByText(/厂商配置/i))
    await waitFor(() => {
      expect(screen.getByText('选择要管理的 Provider 类型。')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('返回'))
    await waitFor(() => {
      expect(screen.getByText(/厂商配置/i)).toBeInTheDocument()
      expect(screen.getByText(/模板配置/i)).toBeInTheDocument()
    })
  })

  it('shows provider type switcher buttons in provider view', async () => {
    render(<SettingsModule />)

    fireEvent.click(await screen.findByText(/厂商配置/i))

    await waitFor(() => {
      expect(screen.getByText('openai')).toBeInTheDocument()
      expect(screen.getByText('anthropic')).toBeInTheDocument()
      expect(screen.getByText('gemini')).toBeInTheDocument()
      expect(screen.getByText('deepseek')).toBeInTheDocument()
      expect(screen.getByText('custom')).toBeInTheDocument()
    })
  })
})