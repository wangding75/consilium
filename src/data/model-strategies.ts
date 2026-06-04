import type { ModelStrategy as DomainModelStrategy } from '@/types'

export type ModelStrategyId = 'smart' | 'quality' | 'cost'

export type ModelStrategy = DomainModelStrategy & {
  id: ModelStrategyId
}

export const MODEL_STRATEGIES: ModelStrategy[] = [
  {
    id: 'smart',
    modelStrategyId: 'smart',
    name: '智能躲避反馈',
    description: '优先快模型，复杂场景切强模型',
    priority: ['speed', 'quality', 'cost'],
    defaultModel: 'mock',
    roleOverrides: {},
    fallbackChain: ['mock', 'mock-fallback'],
    temperature: 0.7,
    maxTokens: 512,
    costPolicy: '复杂度低时优先快模型，复杂场景再切换强模型',
    speedPolicy: '优先低延迟模型，必要时走 fallback',
    active: true,
    isDefault: true,
  },
  {
    id: 'quality',
    modelStrategyId: 'quality',
    name: '质量优先',
    description: '更多推理与更强模型，适合严肃决策',
    priority: ['quality', 'cost', 'speed'],
    defaultModel: 'mock',
    roleOverrides: {},
    fallbackChain: ['mock', 'mock-fallback'],
    temperature: 0.5,
    maxTokens: 1024,
    costPolicy: '允许更高 token 预算换取回答质量',
    speedPolicy: '优先质量，必要时接受更高延迟',
    active: true,
    isDefault: false,
  },
  {
    id: 'cost',
    modelStrategyId: 'cost',
    name: '成本优先',
    description: '压缩 token 与发言长度，适合快速探索',
    priority: ['cost', 'speed', 'quality'],
    defaultModel: 'mock-fallback',
    roleOverrides: {},
    fallbackChain: ['mock-fallback', 'mock'],
    temperature: 0.9,
    maxTokens: 256,
    costPolicy: '优先低成本模型并限制 token 预算',
    speedPolicy: '优先快速响应，避免长上下文推理',
    active: true,
    isDefault: false,
  },
]

export const DEFAULT_STRATEGY_ID: ModelStrategyId = 'smart'
