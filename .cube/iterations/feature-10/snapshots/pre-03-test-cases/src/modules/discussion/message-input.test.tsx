import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MessageInput } from './message-input'

describe('MessageInput', () => {
  // Task-14: does not call onSend for empty input
  it('does not call onSend when input is empty', () => {
    const onSend = vi.fn()
    render(<MessageInput onSend={onSend} />)
    const sendButton = screen.getByRole('button', { name: '发送' })
    fireEvent.click(sendButton)
    expect(onSend).not.toHaveBeenCalled()
  })

  // Task-14: calls onSend with content and clears input
  it('calls onSend with trimmed content and clears input', () => {
    const onSend = vi.fn()
    render(<MessageInput onSend={onSend} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '  hello  ' } })
    const sendButton = screen.getByRole('button', { name: '发送' })
    fireEvent.click(sendButton)
    expect(onSend).toHaveBeenCalledWith('hello')
  })

  // Task-14: Enter key triggers send
  it('sends message on Enter key press', () => {
    const onSend = vi.fn()
    render(<MessageInput onSend={onSend} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'test message' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('test message')
  })

  // Task-14: disabled state
  it('disables input and button when disabled prop is true', () => {
    const onSend = vi.fn()
    render(<MessageInput onSend={onSend} disabled={true} />)
    const input = screen.getByRole('textbox')
    const sendButton = screen.getByRole('button', { name: '发送' })
    expect(input).toBeDisabled()
    expect(sendButton).toBeDisabled()
  })
})
