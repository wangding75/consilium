/**
 * ProviderSheet frontend-ui tests — iteration 11 (Task-12)
 *
 * Standard: standards/testing/frontend-ui.md
 * Tests that ProviderSheet is reused and upgraded for multi-connection management.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ProviderSheet } from '@/modules/settings/ProviderSheet'

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url === '/api/settings/provider-connections' && init?.method === 'GET') {
      return jsonResponse({
        success: true,
        data: {
          connections: [
            {
              id: 'conn-001',
              providerType: 'openai',
              displayName: 'OpenAI Prod',
              baseUrl: 'https://api.openai.com/v1',
              modelList: ['gpt-4o'],
              enabled: true,
              lastTestStatus: 'success',
              maskedKey: 'sk-***12345',
              maskedHeaders: {},
              createdAt: '2026-06-01T00:00:00.000Z',
              updatedAt: '2026-06-08T00:00:00.000Z',
            },
          ],
        },
      })
    }

    if (url === '/api/settings/provider-connections' && (init?.method === 'POST' || init?.method === 'PUT')) {
      return jsonResponse({
        success: true,
        data: {
          id: 'conn-new',
          providerType: 'openai',
          displayName: 'New Connection',
          baseUrl: 'https://api.openai.com/v1',
          modelList: ['gpt-4o'],
          enabled: true,
          lastTestStatus: 'untested',
          maskedKey: 'sk-***67890',
          maskedHeaders: {},
          createdAt: '2026-06-08T00:00:00.000Z',
          updatedAt: '2026-06-08T00:00:00.000Z',
        },
      })
    }

    if (url === '/api/settings/provider-connections/test' && init?.method === 'POST') {
      return jsonResponse({
        success: true,
        data: {
          status: 'success',
          latencyMs: 42,
          checkedAt: '2026-06-08T00:00:00.000Z',
          availableModels: ['gpt-4o'],
          maskedKey: 'sk-***12345',
        },
      })
    }

    return jsonResponse({ success: true, data: null })
  }) as typeof fetch
})

describe('ProviderSheet — multi-connection UI (Task-12)', () => {
  it('renders without crashing when opened', () => {
    render(<ProviderSheet isOpen={true} providerId="openai" onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('SHOULD call GET /api/settings/provider-connections to list connections', async () => {
    const fetchMock = vi.mocked(global.fetch)
    render(<ProviderSheet isOpen={true} providerId="openai" onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/settings/provider-connections', expect.objectContaining({ method: 'GET' }))
    })
  })

  it('SHOULD display connection cards for each saved connection', async () => {
    render(<ProviderSheet isOpen={true} providerId="openai" onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('OpenAI Prod')).toBeInTheDocument()
      expect(screen.getByText(/gpt-4o/i)).toBeInTheDocument()
    })
  })

  it('SHOULD mask API key in connection list (never show plaintext)', async () => {
    render(<ProviderSheet isOpen={true} providerId="openai" onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('sk-***12345')).toBeInTheDocument()
      expect(screen.queryByText(/sk-secret-key-12345/i)).toBeNull()
    })
  })

  it('SHOULD have a "+" button to add new connection', async () => {
    render(<ProviderSheet isOpen={true} providerId="openai" onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+|新增|添加|add/i })).toBeInTheDocument()
    })
  })

  it('SHOULD support test connection button', async () => {
    const fetchMock = vi.mocked(global.fetch)
    render(<ProviderSheet isOpen={true} providerId="openai" onClose={vi.fn()} onSaved={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: 'sk-test' } })
    fireEvent.change(screen.getByLabelText(/model list/i), { target: { value: 'gpt-4o' } })
    fireEvent.click(screen.getByRole('button', { name: /测试|test/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/settings/provider-connections/test', expect.objectContaining({ method: 'POST' }))
    })
  })
})
