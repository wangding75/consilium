import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SessionsModule } from '@/modules/sessions'

// Task-06: Session center search, filter, archive/resume UI
describe('SessionsModule — Task-06', () => {
  it('renders session list with status badges', () => {
    render(<SessionsModule />)
    expect(screen.getByText(/会话/)).toBeTruthy()
  })

  it('displays filter tabs for status', () => {
    render(<SessionsModule />)
    expect(screen.getByText(/进行中/)).toBeTruthy()
  })

  it('shows search input for keyword filtering', () => {
    render(<SessionsModule />)
    expect(screen.getByPlaceholderText(/搜索/)).toBeTruthy()
  })

  it('renders archive action on session cards', () => {
    render(<SessionsModule />)
    expect(screen.getByText(/归档/)).toBeTruthy()
  })

  it('renders resume action for archived sessions', () => {
    render(<SessionsModule />)
    expect(screen.getByText(/恢复/)).toBeTruthy()
  })
})
