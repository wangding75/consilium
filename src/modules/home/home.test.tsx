import React from 'react'
import { render } from '@testing-library/react'
import { HomeModule } from '@/modules/home'

it('HomeModule renders without crash', () => {
  const { container } = render(<HomeModule />)
  expect(container.firstChild).not.toBeNull()
})
