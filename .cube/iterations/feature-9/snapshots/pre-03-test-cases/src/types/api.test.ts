import { getAppConfig } from '@/config'

it('getAppConfig returns version string', () => {
  const config = getAppConfig()
  expect(typeof config.version).toBe('string')
  expect(config.version.length).toBeGreaterThan(0)
})

it('getAppConfig returns llm config with required fields', () => {
  const config = getAppConfig()
  expect(config.llm).toBeDefined()
  expect(typeof config.llm.baseUrl).toBe('string')
  expect(typeof config.llm.model).toBe('string')
})
