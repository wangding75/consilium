import React from 'react'
import { render } from '@testing-library/react'
import { AppShell } from '@/components/layout/AppShell'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

it('AppShell renders children in main content area', () => {
  const { getByText } = render(<AppShell><div>test content</div></AppShell>)
  expect(getByText('test content')).toBeTruthy()
})
