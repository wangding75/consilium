import type { AppConfig } from '@/config/types'

export class HealthService {
  constructor(private readonly config: AppConfig) {}

  async getHealth(): Promise<{ version: string; status: 'ok'; timestamp: string }> {
    return {
      version: this.config.version,
      status: 'ok',
      timestamp: new Date().toISOString(),
    }
  }
}
