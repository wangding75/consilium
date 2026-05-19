import React from 'react'
import { render } from '@testing-library/react'
import { HomeModule } from '@/modules/home'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

global.fetch = vi.fn().mockResolvedValue({
  json: async () => ({ success: true, data: [] }),
})

it('HomeModule renders without crash', () => {
  const { container } = render(<HomeModule />)
  expect(container.firstChild).not.toBeNull()
})
