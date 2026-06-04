import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { TemplatesModule } from './index'

const mockRouterPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

beforeEach(() => {
  vi.clearAllMocks()
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url === '/api/templates') {
      return {
        json: async () => ({
          success: true,
          data: {
            templates: [
              {
                templateId: 'three-kingdoms-advisors',
                version: '1.0.0',
                name: '三国军师团',
                description: 'desc',
                category: '历史策略',
                tags: ['三国'],
                roleCount: 5,
                eventCount: 4,
                usageCount: 0,
                sessionCount: 0,
                favoriteCount: 0,
                isBuiltin: true,
                availableForSessionCreation: true,
              },
            ],
          },
        }),
      }
    }

    if (url === '/api/templates/three-kingdoms-advisors') {
      return {
        json: async () => ({
          success: true,
          data: {
            template: {
              templateId: 'three-kingdoms-advisors',
              version: '1.0.0',
              name: '三国军师团',
              description: '三国时代最睿智的谋士们汇聚一堂，围绕议题展开激烈讨论',
              category: '历史策略',
              tags: ['三国'],
              overview: {
                worldview: '东汉末年',
                userIdentity: '议题提出者',
                applicableScenarios: ['战略决策'],
              },
              roles: [],
              events: [
                { id: 'evt-slap', type: 'slap', trigger: '当某方观点被事实或逻辑明显驳倒时', description: '打脸事件' },
                { id: 'evt-camp', type: 'camp', trigger: '当争论形成明显对立阵营时', description: '站队事件' },
                { id: 'evt-vote', type: 'vote', trigger: '当讨论陷入僵局需要表决时', description: '投票事件' },
                { id: 'evt-reverse', type: 'reverse', trigger: '当某角色因新信息或论据改变立场时', description: '反转事件' },
              ],
              rhythm: { maxTurnsPerStage: {}, minTurnsBeforeClimax: 4 },
              modelDefaults: { defaultModel: 'claude-3-5-haiku' },
              metrics: { usageCount: 0, sessionCount: 0, favoriteCount: 0 },
              isBuiltin: true,
              visible: true,
              availableForSessionCreation: true,
              editable: true,
              createdAt: '2026-06-01T00:00:00.000Z',
            },
          },
        }),
      }
    }

    if (url === '/api/templates/three-kingdoms-advisors/roles') {
      return {
        json: async () => ({
          success: true,
          data: {
            roles: [],
          },
        }),
      }
    }

    throw new Error(`Unexpected fetch: ${url}`)
  })
})

describe('Task-17: TemplatesModule — detail data loading', () => {
  it('loads template detail on mount and renders selected template information', async () => {
    render(<TemplatesModule />)

    await waitFor(() => {
      const detailDescription = screen.getByText('三国时代最睿智的谋士们汇聚一堂，围绕议题展开激烈讨论')
      const detailCard = detailDescription.closest('div')

      expect(detailCard).not.toBeNull()
      expect(within(detailCard as HTMLDivElement).getByText('三国军师团')).toBeInTheDocument()
      expect(detailDescription).toBeInTheDocument()
    })
  })

  it('shows retry state when template list request fails', async () => {
    fetchMock.mockImplementationOnce(async () => ({
      json: async () => ({
        success: false,
        error: { message: '模板加载失败' },
      }),
    }))

    render(<TemplatesModule />)

    await waitFor(() => {
      expect(screen.getByText('模板加载失败')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
    })
  })

  it('navigates to home with templateId when clicking 使用模板', async () => {
    render(<TemplatesModule />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '使用模板' })).toBeEnabled()
    })

    fireEvent.click(screen.getByRole('button', { name: '使用模板' }))
    expect(mockRouterPush).toHaveBeenCalledWith('/?templateId=three-kingdoms-advisors')
  })

  it('loads roles data after switching to 角色 tab', async () => {
    render(<TemplatesModule />)

    fireEvent.click(screen.getByRole('tab', { name: '角色' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/templates/three-kingdoms-advisors/roles')
    })
  })
})
