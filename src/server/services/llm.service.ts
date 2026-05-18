import type { AppConfig } from '@/config/types'
import { ServiceError } from '@/server/errors'

export class LlmService {
  constructor(private readonly config: AppConfig) {}

  async listProviders(): Promise<{ id: string; name: string }[]> {
    try {
      return [
        { id: 'anthropic', name: 'Anthropic' },
        { id: 'openai', name: 'OpenAI' },
      ]
    } catch (err) {
      throw new ServiceError('LLM_PROVIDERS_FAILED', 'Failed to list LLM providers', err)
    }
  }

  getConfig(): AppConfig['llm'] {
    return this.config.llm
  }
}
