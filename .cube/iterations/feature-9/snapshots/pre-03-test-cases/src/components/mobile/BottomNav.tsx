'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  emoji: string
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: '首页', emoji: '🏠' },
  { href: '/sessions', label: '会话', emoji: '📋' },
  { href: '/templates', label: '模板', emoji: '📖' },
  { href: '/settings', label: '设置', emoji: '⚙️' },
]

export function BottomNav() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href.split('/')[1] ? `/${href.split('/')[1]}` : href)
  }

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-20 bg-surface border-t border-border"
      style={{ paddingBottom: 'var(--spacing-safe-bottom)', height: 'calc(var(--nav-height) + var(--spacing-safe-bottom))' }}
    >
      <ul className="flex justify-around items-center h-[var(--nav-height)]">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-2 px-1 text-xs transition-colors ${
                  active ? 'text-primary' : 'text-text-muted'
                }`}
              >
                <span className="text-xl leading-none">{item.emoji}</span>
                <span className={active ? 'font-medium' : ''}>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
