import type { AppConfig } from './types'

export function getAppConfig(): AppConfig {
  return {
    // NEXT_PUBLIC_ prefix is intentional — safe to expose at build time
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0',
    llm: {
      // NEVER add NEXT_PUBLIC_ prefix to these — server-only secrets
      apiKey: process.env.LLM_API_KEY ?? '',
      baseUrl: process.env.LLM_BASE_URL ?? 'https://api.anthropic.com',
      model: process.env.LLM_MODEL ?? 'claude-haiku-4-5-20251001',
    },
  }
}
