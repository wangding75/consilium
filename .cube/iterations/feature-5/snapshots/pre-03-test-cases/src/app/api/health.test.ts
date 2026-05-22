import { GET } from '@/app/api/health/route'
import { HealthService } from '@/server/services/health.service'
import { ServiceError } from '@/server/errors'

it('GET /api/health returns success response with status ok', async () => {
  const res = await GET()
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.data).toBeDefined()
  expect(body.data.status).toBe('ok')
})

it('GET /api/health response includes requestId string', async () => {
  const res = await GET()
  const body = await res.json()
  expect(typeof body.requestId).toBe('string')
  expect(body.requestId.length).toBeGreaterThan(0)
})

it('GET /api/health returns 500 with INTERNAL_ERROR when service throws', async () => {
  vi.spyOn(HealthService.prototype, 'getHealth').mockRejectedValueOnce(
    new ServiceError('INTERNAL_ERROR', 'forced failure')
  )
  const res = await GET()
  const body = await res.json()
  expect(body.success).toBe(false)
  expect(body.error?.code).toBe('INTERNAL_ERROR')
})
