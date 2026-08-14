import { describe, expect, it } from 'vitest'
import { percentageChange, resolvePeriod } from '@/server/lib/time'

const NOW = new Date('2026-08-13T12:00:00Z')

describe('resolvePeriod', () => {
  it('produces a window of the requested length', () => {
    const period = resolvePeriod('30d', NOW)

    expect(period.days).toBe(30)
    expect(period.to).toEqual(NOW)
    expect(period.from.toISOString()).toBe('2026-07-14T12:00:00.000Z')
  })

  it('places the comparison window immediately before, at equal length', () => {
    // "+12% vs the previous 30 days" is only meaningful if both windows are 30 days.
    const period = resolvePeriod('7d', NOW)

    expect(period.previousFrom.toISOString()).toBe('2026-07-30T12:00:00.000Z')
    expect(period.from.getTime() - period.previousFrom.getTime()).toBe(
      period.to.getTime() - period.from.getTime(),
    )
  })

  it('bounds the "all" range, so the trend query stays finite', () => {
    expect(resolvePeriod('all', NOW).days).toBe(365)
  })
})

describe('percentageChange', () => {
  it('computes the change to one decimal place', () => {
    expect(percentageChange(110, 100)).toBe(10)
    expect(percentageChange(50, 100)).toBe(-50)
    expect(percentageChange(133, 100)).toBe(33)
  })

  it('returns null with no baseline, rather than infinity', () => {
    // Growth from zero is undefined, not "+∞%" and not "+100%".
    expect(percentageChange(25, 0)).toBeNull()
    expect(percentageChange(0, 0)).toBeNull()
  })

  it('reports no change as zero', () => {
    expect(percentageChange(100, 100)).toBe(0)
  })
})
