/**
 * SettingsModule frontend-ui tests — iteration 11 (Task-11)
 *
 * Standard: standards/testing/frontend-ui.md
 * Tests the three-entry settings homepage IA and secondary view switching.
 * Current state: SettingsModule still renders old iteration-9 layout.
 * These tests are RED — they will FAIL until Task-11 implementation is done.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
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
          data: [],
        }),
      }
    }

    if (url === '/api/settings/model-defaults') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: null,
        }),
      }
    }

    if (url === '/api/templates') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            templates: [
              {
                templateId: 'startup-board',
                version: '1.0.0',
                name: 'Startup Board',
                description: 'A startup board template',
                category: 'business',
                tags: ['startup'],
                roleCount: 3,
                eventCount: 2,
                usageCount: 5,
                sessionCount: 3,
                favoriteCount: 1,
                isBuiltin: true,
                availableForSessionCreation: true,
                defaultStrategy: 'smart_fallback',
                configStatus: 'default',
              },
            ],
          },
        }),
      }
    }

    // Default: return empty success
    return {
      ok: true,
      json: async () => ({ success: true, data: null }),
    }
  })
})

// ─── Three-entry homepage contract ────────────────────────────────────────────

describe('SettingsModule — three-entry homepage (Task-11)', () => {
  it('renders the settings page without crashing', async () => {
    render(<SettingsModule />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: '设置' })).toBeInTheDocument()
    })
  })

  it('SHOULD render three entry cards: 厂商配置, 模板配置, 数据安全', async () => {
    render(<SettingsModule />)
    // RED: current implementation renders old 5-section layout, not 3 entries
    await waitFor(() => {
      // These assertions will FAIL until Task-11 is implemented
      const hasProviderEntry = screen.queryByText(/厂商配置/) !== null
      const hasTemplateEntry = screen.queryByText(/模板配置/) !== null
      const hasDataSecurityEntry = screen.queryByText(/数据安全/) !== null
      const threeEntries = [hasProviderEntry, hasTemplateEntry, hasDataSecurityEntry].filter(Boolean).length
      expect(threeEntries).toBe(3)
    })
  })

  it('SHOULD NOT render old model/prompt independent entries', async () => {
    render(<SettingsModule />)
    // RED: current implementation still shows old model/prompt sections
    await waitFor(() => {
      const oldModelEntry = screen.queryByText(/全局默认模型/)
      const oldPromptEntry = screen.queryByText(/提示词/)
      expect(oldModelEntry).toBeNull()
      expect(oldPromptEntry).toBeNull()
    })
  })

  it('SHOULD render secondary view when an entry is clicked', async () => {
    render(<SettingsModule />)

    await waitFor(() => {
      expect(screen.getByText(/厂商配置/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(/厂商配置/))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /返回|back/i })).toBeInTheDocument()
    })
  })

  it('SHOULD return to homepage when back button is clicked in secondary view', async () => {
    render(<SettingsModule />)

    await waitFor(() => {
      expect(screen.getByText(/厂商配置/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(/厂商配置/))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /返回|back/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /返回|back/i }))

    await waitFor(() => {
      const hasProviderEntry = screen.queryByText(/厂商配置/) !== null
      const hasTemplateEntry = screen.queryByText(/模板配置/) !== null
      const hasDataSecurityEntry = screen.queryByText(/数据安全/) !== null
      const visibleEntries = [hasProviderEntry, hasTemplateEntry, hasDataSecurityEntry].filter(Boolean).length
      expect(visibleEntries).toBe(3)
    })
  })
})