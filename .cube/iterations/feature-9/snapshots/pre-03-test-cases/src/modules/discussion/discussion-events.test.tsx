import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageInput } from './message-input'

describe('Task-13: MessageInput — # button triggers vote event', () => {
  it('calls onTriggerEvent when # button is clicked', () => {
    const onTriggerEvent = vi.fn()
    render(<MessageInput onSend={vi.fn()} onTriggerEvent={onTriggerEvent} />)
    fireEvent.click(screen.getByRole('button', { name: '#' }))
    expect(onTriggerEvent).toHaveBeenCalledWith('发起投票')
  })

  it('calls onTriggerEvent when input starts with # and send is clicked', () => {
    const onTriggerEvent = vi.fn()
    render(<MessageInput onSend={vi.fn()} onTriggerEvent={onTriggerEvent} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '#迁都问题' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(onTriggerEvent).toHaveBeenCalledWith('迁都问题')
  })

  it('calls onTriggerEvent with fallback when input is just #', () => {
    const onTriggerEvent = vi.fn()
    render(<MessageInput onSend={vi.fn()} onTriggerEvent={onTriggerEvent} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '#' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(onTriggerEvent).toHaveBeenCalledWith('发起投票')
  })

  it('does not call onSend when # prefix triggers event', () => {
    const onSend = vi.fn()
    const onTriggerEvent = vi.fn()
    render(<MessageInput onSend={onSend} onTriggerEvent={onTriggerEvent} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '#迁都问题' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(onSend).not.toHaveBeenCalled()
  })

  it('clears input after # event triggered', () => {
    render(<MessageInput onSend={vi.fn()} onTriggerEvent={vi.fn()} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: '#迁都问题' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(input.value).toBe('')
  })

  it('disables # button when disabled=true', () => {
    render(<MessageInput onSend={vi.fn()} onTriggerEvent={vi.fn()} disabled={true} />)
    const hashButton = screen.getByRole('button', { name: '#' })
    expect(hashButton).toHaveProperty('disabled', true)
  })
})
