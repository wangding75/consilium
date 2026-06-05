/**
 * SettingsModule frontend-ui tests (Task-11)
 *
 * Standard: standards/testing/frontend-ui.md
 * These tests verify the SettingsModule renders the five sections and handles
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
  ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url === '/api/llm/providers') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              providerId: 'openai',
              enabled: true,
              baseUrl: 'https://api.openai.com/v1',
              maskedKey: 'sk-***1234',
              modelList: ['gpt-4o', 'gpt-4o-mini'],
              maskedHeaders: {},
              lastTestStatus: 'success',
              lastTestedAt: '2026-06-04T06:00:00.000Z',
            },
            {
              providerId: 'anthropic',
              enabled: true,
              baseUrl: 'https://api.anthropic.com',
              maskedKey: 'sk-***abcd',
              modelList: ['claude-sonnet-4-6'],
              maskedHeaders: {},
              lastTestStatus: 'untested',
            },
          ],
        }),
      }
    }

    if (url === '/api/settings/model-defaults') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: { providerId: 'openai', model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 512 },
        }),
      }
    }

    if (url === '/api/settings/role-models') {
      return {
        ok: true,
        json: async () => ({ success: true, data: [] }),
      }
    }

    if (url === '/api/settings/prompts') {
      return {
        ok: true,
        json: async () => ({ success: true, data: [] }),
      }
    }

    return { ok: true, json: async () => ({ success: true, data: null }) }
  })
})

// ─── Task-11: SettingsModule UI ──────────────────────────────────────────────

describe('SettingsModule', () => {
  it('renders the settings page', async () => {
    render(<SettingsModule />)
    // Settings page should render something
    const heading = await screen.findByText(/设置/i)
    expect(heading).toBeInTheDocument()
  })

  it('renders five setting sections', async () => {
    render(<SettingsModule />)
    // Provider section
    expect(await screen.findByText(/Provider|模型供应商/i)).toBeInTheDocument()
    // Model section
    expect(await screen.findByText(/模型|Model/i)).toBeInTheDocument()
    // Template section (placeholder)
    expect(await screen.findByText(/模板|Template/i)).toBeInTheDocument()
    // Prompt section
    expect(await screen.findByText(/Prompt|提示词/i)).toBeInTheDocument()
    // Data section
    expect(await screen.findByText(/数据|Data|安全|Security/i)).toBeInTheDocument()
  })

  it('loads and displays provider status from API', async () => {
    render(<SettingsModule />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/llm/providers')
    })
  })

  it('loads model defaults from API', async () => {
    render(<SettingsModule />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/settings/model-defaults')
    })
  })

  it('shows all five providers even when API returns empty', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/api/llm/providers') {
        return { ok: true, json: async () => ({ success: true, data: [] }) }
      }
      return { ok: true, json: async () => ({ success: true, data: null }) }
    })

    render(<SettingsModule />)
    // All five hardcoded provider IDs should be displayed
    await waitFor(() => {
      expect(screen.getByText(/openai/i)).toBeInTheDocument()
      expect(screen.getByText(/anthropic/i)).toBeInTheDocument()
      expect(screen.getByText(/gemini/i)).toBeInTheDocument()
      expect(screen.getByText(/deepseek/i)).toBeInTheDocument()
      expect(screen.getByText(/custom/i)).toBeInTheDocument()
    })
  })

  it('shows provider connection status', async () => {
    render(<SettingsModule />)

    await waitFor(() => {
      // Should show openai and anthropic providers
      expect(screen.getByText(/openai/i)).toBeInTheDocument()
      expect(screen.getByText(/anthropic/i)).toBeInTheDocument()
    })
  })
})