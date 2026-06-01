export type ModelStrategyId = 'smart' | 'quality' | 'cost'

export interface ModelStrategy {
  id: ModelStrategyId
  name: string
  description: string
}

export const MODEL_STRATEGIES: ModelStrategy[] = [
  { id: 'smart', name: '智能躲避反馈', description: '优先快模型，复杂场景切强模型' },
  { id: 'quality', name: '质量优先', description: '更多推理与更强模型，适合严肃决策' },
  { id: 'cost', name: '成本优先', description: '压缩 token 与发言长度，适合快速探索' },
]

export const DEFAULT_STRATEGY_ID: ModelStrategyId = 'smart'
