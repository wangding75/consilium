import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { NextRequest } from 'next/server'
import { ProviderSheet } from '@/modules/settings/ProviderSheet'
import { GET as listConnectionsRoute, POST as createConnectionRoute } from '@/app/api/settings/provider-connections/route'
import { PATCH as updateConnectionRoute } from '@/app/api/settings/provider-connections/[connectionId]/route'
import { POST as testProviderRoute } from '@/app/api/settings/provider-connections/test/route'
import { sharedSettingsRepo } from '@/server/repositories/mock/instances'

function fillValidProviderForm(apiKey = 'sk-test-key'): void {
  fireEvent.change(screen.getByLabelText(/base.*url|Base.*URL|地址/i), {
    target: { value: 'https://api.openai.com/v1' },
  })
  fireEvent.change(screen.getByLabelText(/api.*key|API.*Key|密钥/i), {
    target: { value: apiKey },
  })
  fireEvent.change(screen.getByLabelText(/model.*list|模型.*列表/i), {
    target: { value: 'gpt-4o,gpt-4.1' },
  })
}

function createJsonRequest(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function installRouteBackedFetch(): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(init.body as string) : undefined

    if (url === '/api/settings/provider-connections' && method === 'GET') {
      return listConnectionsRoute()
    }

    if (url === '/api/settings/provider-connections' && method === 'POST') {
      return createConnectionRoute(createJsonRequest(url, method, body))
    }

    if (url.startsWith('/api/settings/provider-connections/') && !url.endsWith('/test') && method === 'PATCH') {
      const connectionId = url.split('/').pop() ?? ''
      return updateConnectionRoute(createJsonRequest(url, method, body), {
        params: Promise.resolve({ connectionId }),
      })
    }

    if (url === '/api/settings/provider-connections/test' && method === 'POST') {
      return testProviderRoute(createJsonRequest(url, method, body))
    }

    throw new Error(`Unhandled fetch call: ${method} ${url}`)
  }) as typeof fetch
}

describe('ProviderSheet API integration', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await sharedSettingsRepo.clearAll()
    installRouteBackedFetch()
  })

  it('persists provider connection through POST /api/settings/provider-connections and masks secrets in the response', async () => {
    const onSaved = vi.fn()

    render(
      <ProviderSheet
        isOpen={true}
        providerId="openai"
        onClose={vi.fn()}
        onSaved={onSaved}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /\+|新增|添加|add/i }))
    fireEvent.change(screen.getByLabelText(/连接名称/i), { target: { value: 'OpenAI Primary' } })
    fillValidProviderForm('sk-live-secret')
    fireEvent.click(screen.getByRole('button', { name: /保存|save/i }))

    await waitFor(async () => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/provider-connections',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        })
      )
      expect(onSaved).toHaveBeenCalled()
      await expect(sharedSettingsRepo.getProviderConnections()).resolves.toEqual([
        expect.objectContaining({
          providerType: 'openai',
          displayName: 'OpenAI Primary',
          enabled: true,
          baseUrl: 'https://api.openai.com/v1',
          apiKeyRef: 'sk-live-secret',
          modelList: ['gpt-4o', 'gpt-4.1'],
        }),
      ])
    })
  })

  it('does not hit the save route when the form is invalid', async () => {
    render(
      <ProviderSheet
        isOpen={true}
        providerId="openai"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /\+|新增|添加|add/i }))
    fireEvent.change(screen.getByLabelText(/连接名称/i), { target: { value: 'OpenAI Primary' } })
    fireEvent.change(screen.getByLabelText(/base.*url|Base.*URL|地址/i), {
      target: { value: 'invalid-url' },
    })
    fireEvent.change(screen.getByLabelText(/api.*key|API.*Key|密钥/i), {
      target: { value: 'sk-test-key' },
    })
    fireEvent.change(screen.getByLabelText(/model.*list|模型.*列表/i), {
      target: { value: 'gpt-4o' },
    })

    fireEvent.click(screen.getByRole('button', { name: /保存|save/i }))

    const saveCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url, requestInit]) => url === '/api/settings/provider-connections' && (requestInit as RequestInit | undefined)?.method === 'POST'
    )
    expect(saveCalls).toHaveLength(0)
    await expect(sharedSettingsRepo.getProviderConnections()).resolves.toEqual([])
  })

  it('surfaces route-level save failures without persisting partial state', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method ?? 'GET'

      if (url === '/api/settings/provider-connections' && method === 'GET') {
        return listConnectionsRoute()
      }

      if (url === '/api/settings/provider-connections' && method === 'POST') {
        return new Response(
          JSON.stringify({
            success: false,
            data: null,
            error: { code: 'INTERNAL_ERROR', message: 'Save failed' },
            requestId: 'req-save-fail',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }

      throw new Error(`Unhandled fetch call: ${method} ${url}`)
    }) as typeof fetch

    render(
      <ProviderSheet
        isOpen={true}
        providerId="openai"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /\+|新增|添加|add/i }))
    fireEvent.change(screen.getByLabelText(/连接名称/i), { target: { value: 'OpenAI Primary' } })
    fillValidProviderForm()
    fireEvent.click(screen.getByRole('button', { name: /保存|save/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/provider-connections',
        expect.objectContaining({ method: 'POST' })
      )
      expect(screen.getByText(/save.*fail|保存.*失败|error/i)).toBeInTheDocument()
    })

    await expect(sharedSettingsRepo.getProviderConnections()).resolves.toEqual([])
  })

  it('sends provider test requests through POST /api/settings/provider-connections/test and shows the returned result', async () => {
    render(
      <ProviderSheet
        isOpen={true}
        providerId="openai"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /\+|新增|添加|add/i }))
    fillValidProviderForm('sk-valid')
    fireEvent.click(screen.getByText(/测试|test.*(连接|connection)/i))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/provider-connections/test',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        })
      )
      expect(screen.getByText(/success|成功|正常/i)).toBeInTheDocument()
      expect(screen.getByText(/42.*ms|42ms/i)).toBeInTheDocument()
    })
  })

  it.each([
    ['sk-bad', /API.*Key|验证失败|密钥/i],
    ['sk-unknown', /尚未配置|not.*configured|操作失败|failed/i],
  ])('maps route-backed provider test failures for apiKey %s', async (apiKey, expectedText) => {
    render(
      <ProviderSheet
        isOpen={true}
        providerId="openai"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /\+|新增|添加|add/i }))
    fillValidProviderForm(apiKey)
    fireEvent.click(screen.getByText(/测试|test.*(连接|connection)/i))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/provider-connections/test',
        expect.objectContaining({ method: 'POST' })
      )
      expect(screen.getByText(expectedText)).toBeInTheDocument()
      expect(screen.queryByText(apiKey)).not.toBeInTheDocument()
    })
  })

  it('does not initiate provider test when required fields are missing', async () => {
    render(
      <ProviderSheet
        isOpen={true}
        providerId=""
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    const testCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url, requestInit]) => url === '/api/settings/provider-connections/test' && (requestInit as RequestInit | undefined)?.method === 'POST'
    )
    const testButton = screen.getByText(/测试|test.*(连接|connection)/i)
    expect(testButton.closest('button')).toBeDisabled()
    expect(testCalls).toHaveLength(0)
  })
})
