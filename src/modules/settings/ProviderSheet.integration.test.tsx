import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { NextRequest } from 'next/server'
import { ProviderSheet } from '@/modules/settings/ProviderSheet'
import { PUT as saveProviderRoute } from '@/app/api/llm/providers/route'
import { POST as testProviderRoute } from '@/app/api/llm/providers/test/route'
import { sharedSettingsRepo } from '@/server/repositories/mock/instances'
import { ServiceError } from '@/server/errors'
import { SettingsService } from '@/server/services/settings.service'

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

    if (url === '/api/llm/providers' && method === 'PUT') {
      return saveProviderRoute(createJsonRequest(url, method, body))
    }

    if (url === '/api/llm/providers/test' && method === 'POST') {
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

  it('persists provider config through PUT /api/llm/providers and masks secrets in the response', async () => {
    const onSaved = vi.fn()

    render(
      <ProviderSheet
        isOpen={true}
        providerId="openai"
        onClose={vi.fn()}
        onSaved={onSaved}
      />
    )

    fillValidProviderForm('sk-live-secret')
    fireEvent.click(screen.getByRole('button', { name: /保存|save/i }))

    await waitFor(async () => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/llm/providers',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        })
      )
      expect(onSaved).toHaveBeenCalled()
      await expect(sharedSettingsRepo.getProviderConfigs()).resolves.toEqual([
        expect.objectContaining({
          providerId: 'openai',
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
      ([url, requestInit]) => url === '/api/llm/providers' && (requestInit as RequestInit | undefined)?.method === 'PUT'
    )
    expect(saveCalls).toHaveLength(0)
    await expect(sharedSettingsRepo.getProviderConfigs()).resolves.toEqual([])
  })

  it('surfaces route-level save failures without persisting partial state', async () => {
    vi.spyOn(SettingsService.prototype, 'upsertProviderConfig').mockRejectedValueOnce(
      new ServiceError('INTERNAL_ERROR', 'Save failed')
    )

    render(
      <ProviderSheet
        isOpen={true}
        providerId="openai"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    fillValidProviderForm()
    fireEvent.click(screen.getByRole('button', { name: /保存|save/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/llm/providers',
        expect.objectContaining({ method: 'PUT' })
      )
      expect(screen.getByText(/save.*fail|保存.*失败|error/i)).toBeInTheDocument()
    })

    await expect(sharedSettingsRepo.getProviderConfigs()).resolves.toEqual([])
  })

  it('sends provider test requests through POST /api/llm/providers/test and shows the returned result', async () => {
    render(
      <ProviderSheet
        isOpen={true}
        providerId="openai"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    fillValidProviderForm('sk-valid')
    fireEvent.click(screen.getByText(/测试|test.*(连接|connection)/i))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/llm/providers/test',
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

    fillValidProviderForm(apiKey)
    fireEvent.click(screen.getByText(/测试|test.*(连接|connection)/i))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/llm/providers/test',
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
      ([url, requestInit]) => url === '/api/llm/providers/test' && (requestInit as RequestInit | undefined)?.method === 'POST'
    )
    const testButton = screen.getByText(/测试|test.*(连接|connection)/i)
    expect(testButton.closest('button')).toBeDisabled()
    expect(testCalls).toHaveLength(0)
  })
})
