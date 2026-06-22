/**
 * TemplateConfig frontend-ui tests — iteration 11 (Task-13)
 *
 * Standard: standards/testing/frontend-ui.md
 * Tests that the template module is reused in settings mode for template config,
 * role config, and add-role interaction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { TemplatesModule } from '@/modules/templates'

const mockRouterPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => new URLSearchParams(),
}))

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

    if (url === '/api/templates' && (!init || init.method === 'GET')) {
      return jsonResponse({
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
      })
    }

    if (url === '/api/templates/startup-board/roles' && (!init || init.method === 'GET')) {
      return jsonResponse({
        success: true,
        data: {
          templateId: 'startup-board',
          templateVersion: '1.0.0',
          roles: [
            {
              roleId: 'ceo-host',
              name: 'CEO Host',
              persona: 'Startup CEO',
              systemPrompt: 'You are a CEO.',
              runtimeConfig: {
                providerConnectionId: 'conn-001',
                model: 'gpt-4o',
              },
              configStatus: 'customized',
            },
          ],
        },
      })
    }

    if (url === '/api/templates/startup-board' && (!init || init.method === 'GET')) {
      return jsonResponse({
        success: true,
        data: {
          template: {
            templateId: 'startup-board',
            version: '1.0.0',
            name: 'Startup Board',
            description: 'A startup board template',
            category: 'business',
            isBuiltin: true,
            defaultStrategy: 'smart_fallback',
            roles: [
              {
                roleId: 'ceo-host',
                name: 'CEO Host',
                persona: 'Startup CEO',
                systemPrompt: 'You are a CEO.',
              },
            ],
          },
        },
      })
    }

    if (url === '/api/settings/templates/startup-board/roles' && init?.method === 'POST') {
      return jsonResponse({
        success: true,
        data: {
          templateId: 'startup-board',
          templateVersion: '1.0.1',
          roles: [],
        },
      })
    }

    if (url === '/api/settings/templates/startup-board/roles/ceo-host' && init?.method === 'DELETE') {
      return jsonResponse({
        success: true,
        data: { deletedRoleId: 'ceo-host' },
      })
    }

    return jsonResponse({ success: true, data: null })
  }) as typeof fetch
})

describe('TemplateConfig — settings-mode template management (Task-13)', () => {
  it('renders without crashing', async () => {
    render(<TemplatesModule />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: '模板' })).toBeInTheDocument()
      expect(screen.getByText('Startup Board')).toBeInTheDocument()
    })
  })

  it('SHOULD list templates from GET /api/templates', async () => {
    render(<TemplatesModule />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Startup Board' })).toBeInTheDocument()
    })
  })

  it('SHOULD display template details including roleCount, eventCount, defaultStrategy, configStatus', async () => {
    render(<TemplatesModule />)
    await waitFor(() => {
      expect(screen.getByText(/角色数：3/i)).toBeInTheDocument()
      expect(screen.getByText(/事件数：2/i)).toBeInTheDocument()
      expect(screen.getByText(/smart_fallback/i)).toBeInTheDocument()
      expect(screen.getByText(/default|customized/i)).toBeInTheDocument()
    })
  })

  it('SHOULD show role list when a template is selected', async () => {
    render(<TemplatesModule />)
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '角色' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: '角色' }))

    await waitFor(() => {
      expect(screen.getByText('CEO Host')).toBeInTheDocument()
      expect(screen.getByText(/startup ceo/i)).toBeInTheDocument()
    })
  })

  it('SHOULD have an "add role" button in settings mode', async () => {
    render(<TemplatesModule />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /新增角色|add role/i })).toBeInTheDocument()
    })
  })

  it('SHOULD support role delete in settings mode', async () => {
    render(<TemplatesModule />)
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '角色' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: '角色' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /删除|delete/i })).toBeInTheDocument()
    })
  })

  it('SHOULD support role edit (runtime config) in settings mode', async () => {
    render(<TemplatesModule />)
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '角色' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: '角色' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Provider Connection')).toBeInTheDocument()
      expect(screen.getByLabelText('模型')).toBeInTheDocument()
    })
  })
})
