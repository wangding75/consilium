import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TemplatesModule } from './index'

describe('Task-17: TemplatesModule — event rules display', () => {
  it('renders 事件规则 section header', () => {
    render(<TemplatesModule />)
    expect(screen.getByText('事件规则')).toBeDefined()
  })

  it('renders slap event type badge', () => {
    render(<TemplatesModule />)
    expect(screen.getByText('slap')).toBeDefined()
  })

  it('renders camp event type badge', () => {
    render(<TemplatesModule />)
    expect(screen.getByText('camp')).toBeDefined()
  })

  it('renders vote event type badge', () => {
    render(<TemplatesModule />)
    expect(screen.getByText('vote')).toBeDefined()
  })

  it('renders reverse event type badge', () => {
    render(<TemplatesModule />)
    expect(screen.getByText('reverse')).toBeDefined()
  })

  it('renders all 4 event rule descriptions', () => {
    render(<TemplatesModule />)
    expect(screen.getByText(/打脸事件/)).toBeDefined()
    expect(screen.getByText(/站队事件/)).toBeDefined()
    expect(screen.getByText(/投票事件/)).toBeDefined()
    expect(screen.getByText(/反转事件/)).toBeDefined()
  })

  it('renders event trigger conditions', () => {
    render(<TemplatesModule />)
    expect(screen.getByText(/当某方观点被事实或逻辑明显驳倒时/)).toBeDefined()
  })
})
