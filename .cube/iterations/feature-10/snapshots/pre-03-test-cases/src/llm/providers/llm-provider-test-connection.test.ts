import { describe, it, expect } from 'vitest'
import type { LLMProvider, LLMConnectionTestResult, LLMMessage } from '@/llm/providers/base.provider'

// ─── Task-10: LLMProvider.testConnection 接口契约 ───────────────────────────

describe('LLMProvider.testConnection contract', () => {
  it('testConnection is an optional method on LLMProvider', () => {
    // Provider without testConnection is valid
    const providerWithoutTest: LLMProvider = {
      async chat() {
        return 'response'
      },
    }
    expect(typeof providerWithoutTest.chat).toBe('function')
    expect(providerWithoutTest.testConnection).toBeUndefined()
  })

  it('testConnection returns LLMConnectionTestResult with required fields', () => {
    // Provider with testConnection must conform to return type
    const providerWithTest: LLMProvider = {
      async chat() {
        return 'response'
      },
      async testConnection() {
        return {
          status: 'success',
          latencyMs: 42,
          availableModels: ['model-a', 'model-b'],
        }
      },
    }
    expect(typeof providerWithTest.testConnection).toBe('function')
  })

  it('LLMConnectionTestResult status is success or failed', () => {
    const success: LLMConnectionTestResult = {
      status: 'success',
      latencyMs: 100,
      availableModels: ['gpt-4o'],
    }
    const failed: LLMConnectionTestResult = {
      status: 'failed',
      latencyMs: 5000,
      availableModels: [],
      errorCode: 'PROVIDER_AUTH_FAILED',
      errorMessage: 'Invalid API key',
    }
    expect(success.status).toBe('success')
    expect(failed.status).toBe('failed')
    expect(failed.errorCode).toBe('PROVIDER_AUTH_FAILED')
  })

  it('LLMConnectionTestResult availableModels is always an array', () => {
    const result: LLMConnectionTestResult = {
      status: 'success',
      latencyMs: 50,
      availableModels: [],
    }
    expect(Array.isArray(result.availableModels)).toBe(true)
  })

  it('LLMConnectionTestResult latencyMs is a number', () => {
    const result: LLMConnectionTestResult = {
      status: 'success',
      latencyMs: 821,
      availableModels: ['m1'],
    }
    expect(typeof result.latencyMs).toBe('number')
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })
})