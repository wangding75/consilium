import React from 'react'
import { render } from '@testing-library/react'
import { BottomNav } from '@/components/mobile/BottomNav'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

it('BottomNav renders nav element with 5 items', () => {
  const { container } = render(<BottomNav />)
  const nav = container.querySelector('nav')
  expect(nav).not.toBeNull()
  const links = container.querySelectorAll('a')
  expect(links.length).toBe(5)
})
