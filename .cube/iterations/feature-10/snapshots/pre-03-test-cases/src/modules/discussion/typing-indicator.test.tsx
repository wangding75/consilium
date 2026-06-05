import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { TypingIndicator } from './typing-indicator'

describe('TypingIndicator', () => {
  // Task-12: shows speaker name with typing text
  it('renders "[speakerName]正在输入..." when speakerName is provided', () => {
    render(<TypingIndicator speakerName="诸葛亮" />)
    expect(screen.getByText(/诸葛亮.*正在输入/)).toBeInTheDocument()
  })

  // Task-12: fallback when speakerName is null
  it('renders fallback "正在生成..." when speakerName is null', () => {
    render(<TypingIndicator speakerName={null} />)
    expect(screen.getByText(/正在生成/)).toBeInTheDocument()
  })
})
