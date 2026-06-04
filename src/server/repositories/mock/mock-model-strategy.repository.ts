import type { ModelStrategy } from '@/types'
import type { ModelStrategyRepository } from '../model-strategy.repository'

const BUILTIN_STRATEGIES: ModelStrategy[] = [
  {
    modelStrategyId: 'smart',
    name: '智能平衡',
    description: '优先快模型，复杂场景切强模型，平衡质量与成本',
    priority: ['quality', 'speed', 'cost'],
    defaultModel: 'mock',
    roleOverrides: {},
    fallbackChain: ['mock', 'mock-fallback'],
    temperature: 0.7,
    maxTokens: 512,
    costPolicy: '动态路由，避免不必要的高成本模型',
    speedPolicy: '首选低延迟模型，超时自动降级',
    active: true,
    isDefault: true,
  },
  {
    modelStrategyId: 'quality',
    name: '质量优先',
    description: '更多推理与更强模型，适合严肃决策场景',
    priority: ['quality', 'cost', 'speed'],
    defaultModel: 'mock',
    roleOverrides: {},
    fallbackChain: ['mock', 'mock-fallback'],
    temperature: 0.5,
    maxTokens: 1024,
    costPolicy: '允许更高成本以换取更好质量',
    speedPolicy: '不优先速度，以质量为准',
    active: true,
    isDefault: false,
  },
  {
    modelStrategyId: 'cost',
    name: '成本优先',
    description: '压缩 token 与发言长度，适合快速探索场景',
    priority: ['cost', 'speed', 'quality'],
    defaultModel: 'mock',
    roleOverrides: {},
    fallbackChain: ['mock-fallback', 'mock'],
    temperature: 0.9,
    maxTokens: 256,
    costPolicy: '严格控制 token 用量，优先最便宜模型',
    speedPolicy: '使用最快最便宜的模型',
    active: true,
    isDefault: false,
  },
  {
    modelStrategyId: 'inactive',
    name: '停用策略',
    description: '用于验证停用策略不可用',
    priority: ['quality', 'speed', 'cost'],
    defaultModel: 'mock',
    roleOverrides: {},
    fallbackChain: ['mock'],
    temperature: 0.7,
    maxTokens: 512,
    costPolicy: '停用策略不参与成本路由',
    speedPolicy: '停用策略不参与速度路由',
    active: false,
    isDefault: false,
  },
]

export class MockModelStrategyRepository implements ModelStrategyRepository {
  private readonly strategies: ModelStrategy[] = BUILTIN_STRATEGIES.map(s => ({ ...s }))

  async findAll(): Promise<ModelStrategy[]> {
    return this.strategies.filter(s => s.active).map(s => ({ ...s }))
  }

  async findById(modelStrategyId: string): Promise<ModelStrategy | null> {
    const strategy = this.strategies.find(s => s.modelStrategyId === modelStrategyId)
    return strategy ? { ...strategy } : null
  }

  async findDefault(): Promise<ModelStrategy | null> {
    const strategy = this.strategies.find(s => s.active && s.isDefault)
    return strategy ? { ...strategy } : null
  }
}
