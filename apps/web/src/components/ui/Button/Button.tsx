import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' }

// Paper on Signal reads correctly in both themes, because both tokens flip together.
const VARIANTS = {
  primary: 'bg-signal text-paper hover:opacity-90',
  quiet: 'border border-rule text-ink hover:bg-surface',
}

export function Button({ variant = 'quiet', className = '', ...props }: Props) {
  return <button className={`rounded-base px-3 py-1.5 text-sm font-semibold ${VARIANTS[variant]} ${className}`} {...props} />
}
