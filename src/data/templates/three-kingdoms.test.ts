import { threeKingdomsTemplate } from '@/data/templates/three-kingdoms'

it('threeKingdomsTemplate has required templateId, name, and roles fields', () => {
  expect(typeof threeKingdomsTemplate.templateId).toBe('string')
  expect(typeof threeKingdomsTemplate.name).toBe('string')
  expect(Array.isArray(threeKingdomsTemplate.roles)).toBe(true)
})

it('threeKingdomsTemplate has exactly 5 roles with one host', () => {
  expect(threeKingdomsTemplate.roles.length).toBe(5)
  const host = threeKingdomsTemplate.roles.find(r => r.isHost)
  expect(host).toBeDefined()
})
