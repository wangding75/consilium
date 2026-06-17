'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: '首页', icon: '⌂' },
  { href: '/discussion', label: '讨论', icon: '☵' },
  { href: '/sessions', label: '会话', icon: '▣' },
  { href: '/templates', label: '模板', icon: '▦' },
  { href: '/settings', label: '设置', icon: '⚙' },
]

export function BottomNav() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    if (href === '/discussion') return pathname.startsWith('/discussion')
    return pathname.startsWith(`/${href.split('/')[1]}`)
  }

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-20 bg-white/96 border-t border-[#e8eef6]"
      style={{ paddingBottom: 'var(--spacing-safe-bottom)', height: 'calc(var(--nav-height) + var(--spacing-safe-bottom))' }}
    >
      <ul className="grid grid-cols-5 gap-[2px] h-[var(--nav-height)] px-2 pt-[7px]">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-[2px] py-1 rounded-xl text-[10px] font-semibold transition-colors ${
                  active ? 'text-primary' : 'text-[#64748b]'
                }`}
              >
                <span className={`text-[19px] leading-none ${active ? 'drop-shadow-[0_5px_8px_rgba(16,98,255,.18)]' : ''}`}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
