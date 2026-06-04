import { MODEL_STRATEGIES, DEFAULT_STRATEGY_ID } from '@/data/model-strategies'
import type { ModelStrategyId } from '@/data/model-strategies'

it('MODEL_STRATEGIES contains exactly 3 strategies', () => {
  expect(MODEL_STRATEGIES).toHaveLength(3)
})

it('MODEL_STRATEGIES[0] is smart strategy', () => {
  const smart = MODEL_STRATEGIES.find(s => s.id === 'smart')
  expect(smart).toBeDefined()
  expect(smart!.name).toBe('智能躲避反馈')
  expect(smart!.description).toBe('优先快模型，复杂场景切强模型')
})

it('MODEL_STRATEGIES[1] is quality strategy', () => {
  const quality = MODEL_STRATEGIES.find(s => s.id === 'quality')
  expect(quality).toBeDefined()
  expect(quality!.name).toBe('质量优先')
  expect(quality!.description).toBe('更多推理与更强模型，适合严肃决策')
})

it('MODEL_STRATEGIES[2] is cost strategy', () => {
  const cost = MODEL_STRATEGIES.find(s => s.id === 'cost')
  expect(cost).toBeDefined()
  expect(cost!.name).toBe('成本优先')
  expect(cost!.description).toBe('压缩 token 与发言长度，适合快速探索')
})

it('DEFAULT_STRATEGY_ID is smart', () => {
  expect(DEFAULT_STRATEGY_ID).toBe('smart')
})

it('each strategy has id name and description fields', () => {
  for (const strategy of MODEL_STRATEGIES) {
    expect(typeof strategy.id).toBe('string')
    expect(typeof strategy.name).toBe('string')
    expect(typeof strategy.description).toBe('string')
  }
})

it('DEFAULT_STRATEGY_ID is a valid ModelStrategyId', () => {
  const validIds: ModelStrategyId[] = ['smart', 'quality', 'cost']
  expect(validIds).toContain(DEFAULT_STRATEGY_ID)
})
