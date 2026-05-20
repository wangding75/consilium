import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HomeModule } from '@/modules/home'
import { DiscussionModule } from '@/modules/discussion'

// Task-07: Home recent discussions & discussion detail entry status handling
describe('Home & Discussion lifecycle status — Task-07', () => {
  it('displays running status text for active sessions in home', () => {
    render(<HomeModule />)
    expect(screen.getByText(/进行中/)).toBeTruthy()
  })

  it('displays completed status text in home', () => {
    render(<HomeModule />)
    expect(screen.getByText(/已完成/)).toBeTruthy()
  })

  it('displays archived status text in home', () => {
    render(<HomeModule />)
    expect(screen.getByText(/已归档/)).toBeTruthy()
  })

  it('discussion page shows error state for invalid sessionId', () => {
    render(<DiscussionModule sessionId="invalid-session-id" />)
    expect(screen.getByText(/错误|不存在|找不到/)).toBeTruthy()
  })
})
