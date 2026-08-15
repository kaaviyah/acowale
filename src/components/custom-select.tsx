'use client'

/**
 * Select.
 *
 * A custom listbox rather than a native `<select>`, because the native popup is
 * painted by the OS and cannot be styled — on this dashboard it was the one control
 * that looked borrowed from another application.
 *
 * The tradeoff is that everything the platform gave away for free has to be rebuilt:
 * `aria-expanded` and `role="listbox"`/`role="option"` so it announces as a select,
 * arrow keys and Home/End to move through options, Enter/Space to commit, Escape to
 * abandon, and focus returning to the trigger on close. A styled div that only
 * responds to clicks is not a select, however much it looks like one.
 */
import { useEffect, useId, useRef, useState } from 'react'

export interface SelectOption {
  value: string
  label: string
}

/**
 * How the trigger looks, kept apart from the classes that make it work so a caller
 * can restyle it wholesale — passing a second `rounded-*` or `border-*` instead
 * leaves it to Tailwind's source order to decide which one wins.
 */
export const SELECT_TRIGGER_APPEARANCE =
  'rounded-lg border border-series-1/35 bg-series-1/8 px-3 py-2 text-sm font-medium hover:border-series-1/55 focus-visible:border-series-1'

interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  /** Accessible name, since there is no `<select>` for a `<label>` to point at. */
  label?: string
  /** Appearance of the trigger; replaces {@link SELECT_TRIGGER_APPEARANCE}. */
  className?: string
  /** Put on the trigger, so a `<label htmlFor>` can point at it — buttons are labelable. */
  id?: string
  /** Mirrors `aria-invalid` on a native select, for a field that failed validation. */
  invalid?: boolean
  /** Id of an error or hint element to announce with the control. */
  describedBy?: string
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  label,
  className = SELECT_TRIGGER_APPEARANCE,
  id: triggerId,
  invalid,
  describedBy,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  /** Which option the keyboard is on — distinct from which one is selected. */
  const [activeIndex, setActiveIndex] = useState(0)

  /** Namespaces the option ids: several of these render on one page. */
  const id = useId()
  const listboxId = `${id}-listbox`
  const optionId = (index: number) => `${id}-option-${index}`

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selectedIndex = options.findIndex((option) => option.value === value)
  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex].label : placeholder

  // Open onto the current selection, not the top of the list.
  function open() {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
    setIsOpen(true)
  }

  function close({ refocus = true }: { refocus?: boolean } = {}) {
    setIsOpen(false)
    if (refocus) triggerRef.current?.focus()
  }

  function commit(index: number) {
    const option = options[index]
    if (option) onChange(option.value)
    close()
  }

  // A click anywhere else dismisses without choosing — and without stealing focus
  // back, since the person is already on their way somewhere else.
  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  // Keep the keyboard cursor in view when it walks past the scroll edge.
  useEffect(() => {
    if (!isOpen) return
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [isOpen, activeIndex])

  function handleKeyDown(event: React.KeyboardEvent) {
    if (disabled) return

    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault()
        open()
      }
      return
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        close()
        break
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex((index) => Math.min(index + 1, options.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActiveIndex((index) => Math.max(index - 1, 0))
        break
      case 'Home':
        event.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        event.preventDefault()
        setActiveIndex(options.length - 1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        commit(activeIndex)
        break
      case 'Tab':
        close({ refocus: false })
        break
    }
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`flex w-full items-center justify-between gap-2 text-left text-ink transition-colors disabled:opacity-50 ${className}`}
      >
        <span className="truncate">{selectedLabel}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className={`h-2.5 w-2.5 shrink-0 text-series-1 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          <path d="M2 4l4 4 4-4" fill="currentColor" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={label}
          aria-activedescendant={optionId(activeIndex)}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-series-1/35 bg-surface py-1 shadow-lg shadow-black/10"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value
            const isActive = index === activeIndex

            return (
              <div
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={isSelected}
                onClick={() => commit(index)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
                  isSelected ? 'font-semibold text-series-1' : 'text-ink'
                } ${isActive ? 'bg-series-1/10' : ''}`}
              >
                {/* Reserved width, so the label doesn't shift when the tick appears. */}
                <span aria-hidden="true" className="w-2.5 shrink-0 text-series-1">
                  {isSelected ? '✓' : ''}
                </span>
                <span className="truncate">{option.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
