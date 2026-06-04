import { readFileSync } from 'fs'
import { join } from 'path'

it('package.json has project name consilium', () => {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))
  expect(pkg.name).toBe('consilium')
})

it('package.json has version field', () => {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))
  expect(typeof pkg.version).toBe('string')
  expect(pkg.version.length).toBeGreaterThan(0)
})
