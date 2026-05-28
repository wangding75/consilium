import { GET as templatesGET } from '@/app/api/templates/route'
import { GET as sessionsGET } from '@/app/api/sessions/route'
import { GET as discussionsGET } from '@/app/api/discussions/route'
import { GET as llmProvidersGET } from '@/app/api/llm/providers/route'
import { TemplateService } from '@/server/services/template.service'
import { ServiceError } from '@/server/errors'

it('GET /api/templates returns success response with data array and requestId', async () => {
  const res = await templatesGET()
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(Array.isArray(body.data)).toBe(true)
  expect(typeof body.requestId).toBe('string')
})

it('GET /api/sessions returns success response with data array and requestId', async () => {
  const res = await sessionsGET()
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(Array.isArray(body.data)).toBe(true)
  expect(typeof body.requestId).toBe('string')
})

it('GET /api/discussions returns success response with data array', async () => {
  const res = await discussionsGET()
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(Array.isArray(body.data)).toBe(true)
})

it('GET /api/llm/providers returns success response with providers array', async () => {
  const res = await llmProvidersGET()
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(Array.isArray(body.data)).toBe(true)
})

it('GET /api/templates returns 500 with INTERNAL_ERROR when service throws', async () => {
  vi.spyOn(TemplateService.prototype, 'listTemplates').mockRejectedValueOnce(
    new ServiceError('INTERNAL_ERROR', 'forced failure')
  )
  const res = await templatesGET()
  const body = await res.json()
  expect(body.success).toBe(false)
  expect(body.error?.code).toBe('INTERNAL_ERROR')
})
