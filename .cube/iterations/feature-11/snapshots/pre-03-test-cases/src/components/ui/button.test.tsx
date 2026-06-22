import React from 'react'
import { render } from '@testing-library/react'
import { Button } from '@/components/ui/Button'

it('Button renders with button role', () => {
  const { getByRole } = render(<Button>Click me</Button>)
  expect(getByRole('button')).toBeTruthy()
})
