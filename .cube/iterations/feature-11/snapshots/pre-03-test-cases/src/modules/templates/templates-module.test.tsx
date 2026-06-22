import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TemplatesModule } from '@/modules/templates'

const mockRouterPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const templateListResponse = {
  success: true,
  data: {
    templates: [
      {
        templateId: 'startup-board',
        version: '1.0.0',
        name: '创业公司董事会',
        description: '模拟创业公司董事会讨论',
        category: 'business',
        tags: ['startup'],
        roleCount: 4,
        eventCount: 2,
        usageCount: 10,
        sessionCount: 5,
        favoriteCount: 2,
        isBuiltin: true,
        availableForSessionCreation: true,
      },
    ],
  },
}

const templateDetailResponse = {
  success: true,
  data: {
    template: {
      templateId: 'startup-board',
      version: '1.0.0',
      name: '创业公司董事会',
      description: '模拟创业公司董事会讨论',
      category: 'business',
      tags: ['startup'],
      overview: {
        worldview: '创业公司经营决策场景',
        userIdentity: 'CEO',
        applicableScenarios: ['融资', '定价'],
      },
      roles: [],
      events: [],
      rhythm: { maxTurnsPerStage: {}, minTurnsBeforeClimax: 3 },
      modelDefaults: { defaultModel: 'gpt-4o' },
      metrics: { usageCount: 10, sessionCount: 5, favoriteCount: 2 },
      isBuiltin: true,
      visible: true,
      availableForSessionCreation: true,
      editable: true,
      createdAt: '2026-06-01T00:00:00.000Z',
    },
  },
}

const rolesResponse = {
  success: true,
  data: {
    templateId: 'startup-board',
    templateVersion: '1.0.0',
    roles: [
      {
        roleId: 'ceo',
        name: 'CEO',
        persona: '负责综合决策',
        isHost: true,
        agentType: 'host',
        systemPrompt: '主持讨论',
        visible: true,
        configStatus: 'default',
      },
    ],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url === '/api/templates') {
      return { json: async () => templateListResponse }
    }

    if (url === '/api/templates/startup-board') {
      return { json: async () => templateDetailResponse }
    }

    if (url === '/api/templates/startup-board/roles') {
      return { json: async () => rolesResponse }
    }

    throw new Error(`Unexpected fetch: ${url}`)
  })
})

describe('Task-10: TemplatesModule', () => {
  it('loads template list on mount and renders the fetched template name', async () => {
    render(<TemplatesModule />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/templates')
    })

    expect(screen.getByText('创业公司董事会')).toBeInTheDocument()
  })

  it('switches to the 角色 tab and renders fetched role data', async () => {
    render(<TemplatesModule />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '角色' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: '角色' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/templates/startup-board/roles')
    })

    expect(screen.getByText('CEO')).toBeInTheDocument()
  })

  it('clicks 使用模板 and navigates back to home with the selected templateId', async () => {
    render(<TemplatesModule />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '使用模板' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '使用模板' }))

    expect(mockRouterPush).toHaveBeenCalledWith('/?templateId=startup-board')
  })

  it('shows an error state with retry action when template loading fails', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        success: false,
        error: { code: 'TEMPLATE_LIST_FAILED', message: '模板加载失败' },
        data: null,
      }),
    })

    render(<TemplatesModule />)

    await waitFor(() => {
      expect(screen.getByText('模板加载失败')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
  })
})
