import { describe, it, expect } from 'vitest'
import { MockLLMClient } from './mock-llm-client'
import type { LLMMessage } from '@/llm/providers/base.provider'
import type { LLMConfig } from '@/types'

const baseConfig: LLMConfig = {
  provider: 'mock',
  model: 'mock-default',
}

const systemMsg = (content: string): LLMMessage => ({ role: 'system', content })
const userMsg = (content: string): LLMMessage => ({ role: 'user', content })

describe('MockLLMClient', () => {
  it('returns host-style opening text when systemPrompt mentions host keywords', async () => {
    const client = new MockLLMClient()
    const messages: LLMMessage[] = [
      systemMsg('你是主持人，负责开场和主持讨论'),
      userMsg('请开始讨论'),
    ]
    const result = await client.chat(messages, baseConfig)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    expect(result).toMatch(/主持|欢迎|开场|主题|今天/i)
  })

  it('returns expert-style strategy text for non-host roles', async () => {
    const client = new MockLLMClient()
    const messages: LLMMessage[] = [
      systemMsg('你是诸葛亮，足智多谋的军师'),
      userMsg('如何看待这个问题？'),
    ]
    const result = await client.chat(messages, baseConfig)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns critic-style questioning text when systemPrompt mentions critic keywords', async () => {
    const client = new MockLLMClient()
    const messages: LLMMessage[] = [
      systemMsg('你是评论者，负责质疑和批判分析'),
      userMsg('请评价这个方案'),
    ]
    const result = await client.chat(messages, baseConfig)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns stable output for identical inputs', async () => {
    const client = new MockLLMClient()
    const messages: LLMMessage[] = [
      systemMsg('你是专家，提供见解'),
      userMsg('分析这个话题'),
    ]
    const result1 = await client.chat(messages, baseConfig)
    const result2 = await client.chat(messages, baseConfig)
    expect(result1).toBe(result2)
  })

  it('throws when config.model is mock-fail', async () => {
    const client = new MockLLMClient()
    const messages: LLMMessage[] = [systemMsg('test'), userMsg('test')]
    const failConfig: LLMConfig = { provider: 'mock', model: 'mock-fail' }
    await expect(client.chat(messages, failConfig)).rejects.toThrow()
  })
})
