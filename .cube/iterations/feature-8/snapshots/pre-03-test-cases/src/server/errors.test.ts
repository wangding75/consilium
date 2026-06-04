import { ServiceError } from '@/server/errors'

it('ServiceError is instance of Error with code field', () => {
  const err = new ServiceError('E001', 'test error')
  expect(err).toBeInstanceOf(Error)
  expect(err.code).toBe('E001')
  expect(err.message).toBe('test error')
})

it('ServiceError accepts optional details', () => {
  const details = { field: 'value' }
  const err = new ServiceError('E002', 'msg', details)
  expect(err.details).toEqual(details)
  expect(err.name).toBe('ServiceError')
})
