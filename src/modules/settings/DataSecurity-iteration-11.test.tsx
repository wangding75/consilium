/**
 * DataSecurity frontend-ui tests — iteration 11 (Task-14)
 *
 * Standard: standards/testing/frontend-ui.md
 * Tests the data security page: import/export, clear data, and privacy notice.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DataCleanupSheet } from '@/modules/settings/DataCleanupSheet'
import type { SettingsExportBundle } from '@/types'

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeBundle(): SettingsExportBundle {
  return {
    version: '1.0.0',
    exportedAt: '2026-06-08T00:00:00.000Z',
    includePrompts: false,
    providerConnections: [],
    templateRuntimeConfigs: [],
    prompts: [],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url === '/api/sessions') {
      return jsonResponse({
        success: true,
        data: { sessions: [] },
      })
    }

    if (url === '/api/llm/providers') {
      return jsonResponse({
        success: true,
        data: [],
      })
    }

    if (url === '/api/settings/prompts') {
      return jsonResponse({
        success: true,
        data: [],
      })
    }

    if (url === '/api/settings/clear') {
      return jsonResponse({
        success: true,
        data: null,
      })
    }

    if (url === '/api/settings/export') {
      return jsonResponse({
        success: true,
        data: makeBundle(),
      })
    }

    if (url === '/api/settings/import/preview') {
      return jsonResponse({
        success: true,
        data: {
          previewToken: 'preview-token-123',
          additions: [],
          updates: [],
          conflicts: [],
          invalidItems: [],
        },
      })
    }

    if (url === '/api/settings/import') {
      return jsonResponse({
        success: true,
        data: { importedConnections: 1, importedTemplates: 0, importedPrompts: 0 },
      })
    }

    return jsonResponse({ success: true, data: null })
  }) as typeof fetch
})

describe('DataSecurity — import/export, clear, privacy (Task-14)', () => {
  it('renders without crashing when opened', async () => {
    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/数据安全设置/i)).toBeInTheDocument()
    })
  })

  it('SHOULD show export section with export button', async () => {
    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /导出|export/i })).toBeInTheDocument()
    })
  })

  it('SHOULD show import section with file upload area', async () => {
    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByLabelText(/导入文件|upload|file/i)).toBeInTheDocument()
    })
  })

  it('SHOULD show import preview after file selection', async () => {
    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByLabelText(/导入文件|upload|file/i)).toBeInTheDocument()
    })

    const file = new File(['placeholder'], 'settings.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', {
      value: vi.fn().mockResolvedValue(JSON.stringify(makeBundle())),
    })

    fireEvent.change(screen.getByLabelText(/导入文件|upload|file/i), {
      target: { files: [file] },
    })

    await waitFor(() => {
      expect(screen.getByText(/preview-token-123/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /确认导入/i })).toBeInTheDocument()
    })
  })

  it('SHOULD show clear data section with scope selection', async () => {
    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cache/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sessions|session/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument()
    })
  })

  it('SHOULD show confirm dialog for destructive operations', async () => {
    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /settings/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /设置清理/i })).toBeInTheDocument()
      expect(screen.getByText(/provider 将不可用，需要重新配置/i)).toBeInTheDocument()
    })
  })

  it('SHOULD show privacy notice / data handling explanation', async () => {
    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText(/隐私|privacy|敏感|sensitive/i)).toBeInTheDocument()
    })
  })

  it('SHOULD show success/error feedback after operations', async () => {
    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /settings/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /设置清理/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /确认/i }))

    await waitFor(() => {
      expect(screen.getByText(/清理成功|失败|error/i)).toBeInTheDocument()
    })
  })
})
