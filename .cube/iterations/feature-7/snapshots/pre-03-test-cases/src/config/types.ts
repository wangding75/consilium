export interface AppConfig {
  version: string
  llm: {
    apiKey: string
    baseUrl: string
    model: string
  }
}
