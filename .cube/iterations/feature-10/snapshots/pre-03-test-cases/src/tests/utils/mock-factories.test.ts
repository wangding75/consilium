import { mockTemplate, mockRole, mockSession } from '@/tests/utils/mock-factories'

it('mockTemplate returns Template with id and roles array', () => {
  const t = mockTemplate()
  expect(typeof t.id).toBe('string')
  expect(Array.isArray(t.roles)).toBe(true)
  expect(t.roles.length).toBeGreaterThan(0)
})

it('mockRole returns Role with id and isHost boolean', () => {
  const r = mockRole()
  expect(typeof r.id).toBe('string')
  expect(typeof r.isHost).toBe('boolean')
})
