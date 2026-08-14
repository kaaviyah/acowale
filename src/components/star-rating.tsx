'use client'

/**
 * Star rating input.
 *
 * Built on real radio inputs rather than clickable divs: keyboard support, focus
 * management and screen-reader announcements come from the platform instead of
 * being reimplemented with `onKeyDown` handlers. The inputs are visually hidden but
 * not `display: none`, so they stay focusable and reachable.
 *
 * Rating is optional throughout the product, so there is a way back to "no rating".
 */
import { useId } from 'react'

const STARS = [1, 2, 3, 4, 5] as const

const LABELS: Record<number, string> = {
  1: '1 star — poor',
  2: '2 stars — needs work',
  3: '3 stars — okay',
  4: '4 stars — good',
  5: '5 stars — excellent',
}

interface StarRatingProps {
  value: number | null
  onChange: (value: number | null) => void
  disabled?: boolean
}

export function StarRating({ value, onChange, disabled = false }: StarRatingProps) {
  const groupName = useId()

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="text-sm font-medium text-ink">
        How would you rate your experience?{' '}
        <span className="font-normal text-ink-secondary">(optional)</span>
      </legend>

      <div className="mt-2 flex items-center gap-1">
        {STARS.map((star) => {
          const selected = value !== null && star <= value

          return (
            <label
              key={star}
              className="group cursor-pointer p-0.5"
              title={LABELS[star]}
            >
              <input
                type="radio"
                name={groupName}
                value={star}
                checked={value === star}
                onChange={() => onChange(star)}
                className="sr-only peer"
              />
              <span className="sr-only">{LABELS[star]}</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className={[
                  'h-8 w-8 transition-transform',
                  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-series-1',
                  selected ? 'text-status-warning' : 'text-baseline',
                  disabled ? '' : 'group-hover:scale-110',
                ].join(' ')}
                fill={selected ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth={selected ? 0 : 1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.48 3.5a.56.56 0 0 1 1.04 0l2.13 4.31c.08.17.24.29.43.31l4.76.7c.46.06.64.63.31.95l-3.44 3.36a.56.56 0 0 0-.16.5l.81 4.74c.08.46-.4.81-.82.6l-4.26-2.24a.57.57 0 0 0-.52 0L7.5 18.97c-.41.21-.9-.14-.82-.6l.82-4.74a.56.56 0 0 0-.17-.5L3.9 9.77a.56.56 0 0 1 .31-.95l4.76-.7a.56.56 0 0 0 .42-.31l2.1-4.31Z"
                />
              </svg>
            </label>
          )
        })}

        {value !== null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-2 rounded px-2 py-1 text-sm text-ink-secondary underline underline-offset-2 hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>
    </fieldset>
  )
}
