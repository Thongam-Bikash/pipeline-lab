import { useId, type InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }

// The hint sits outside the label, so screen readers announce it as a description, not as part of the name.
export function Input({ label, hint, className = '', ...props }: Props) {
  const hintId = useId()
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1 text-sm text-muted">
        {label}
        <input
          aria-describedby={hint ? hintId : undefined}
          className={`rounded-base border border-rule bg-surface px-2 py-1.5 text-ink ${className}`}
          {...props}
        />
      </label>
      {hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
