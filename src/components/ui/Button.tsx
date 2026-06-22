import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'blue-soft' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-bold font-sans transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary: 'bg-[#1062ff] text-white shadow-[0_16px_26px_rgba(16,98,255,.22)] hover:bg-[#0b57e6]',
    secondary: 'border border-[#e1e8f4] bg-[#f2f6fd] text-[#243044]',
    ghost: 'border border-[#e5eaf2] bg-white text-[#243044]',
    'blue-soft': 'bg-[#eaf2ff] text-[#1062ff] border border-[#dbe7ff]',
    danger: 'bg-[#fff1f2] text-[#be123c] border border-[#fecdd3]',
  }

  const sizes = {
    sm: 'px-[10px] py-0 min-h-[30px] text-xs rounded-[9px]',
    md: 'px-4 min-h-[36px] text-[13px] rounded-[11px]',
    lg: 'px-4 min-h-[48px] text-[15px] rounded-[11px] w-full',
  }

  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export default Button