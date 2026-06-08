import type { LLMMessage } from '@/llm/providers/base.provider'

it('LLMMessage has role and content string fields', () => {
  const msg: LLMMessage = { role: 'user', content: 'hello world' }
  expect(msg.role).toBe('user')
  expect(msg.content).toBe('hello world')
})
