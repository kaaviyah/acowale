import { describe, expect, it } from 'vitest'
import {
  analyticsQuerySchema,
  createFeedbackSchema,
  listFeedbackQuerySchema,
  loginSchema,
  updateFeedbackStatusSchema,
} from '@/server/schemas'

const valid = { categorySlug: 'product', comment: 'The dashboard is much faster now.' }

describe('createFeedbackSchema', () => {
  it('accepts a minimal submission and defaults the optional fields to null', () => {
    const parsed = createFeedbackSchema.parse(valid)

    expect(parsed.rating).toBeNull()
    expect(parsed.email).toBeNull()
  })

  it('trims the comment before measuring it', () => {
    expect(createFeedbackSchema.parse({ ...valid, comment: '  spaced out  ' }).comment).toBe(
      'spaced out',
    )
    // Whitespace-only is empty, not a 3-character comment.
    expect(createFeedbackSchema.safeParse({ ...valid, comment: '   ' }).success).toBe(false)
  })

  it('enforces the comment length bounds', () => {
    expect(createFeedbackSchema.safeParse({ ...valid, comment: 'ab' }).success).toBe(false)
    expect(createFeedbackSchema.safeParse({ ...valid, comment: 'abc' }).success).toBe(true)
    expect(createFeedbackSchema.safeParse({ ...valid, comment: 'a'.repeat(2000) }).success).toBe(true)
    expect(createFeedbackSchema.safeParse({ ...valid, comment: 'a'.repeat(2001) }).success).toBe(
      false,
    )
  })

  it('coerces a rating sent as a string, and rejects one outside 1–5', () => {
    expect(createFeedbackSchema.parse({ ...valid, rating: '4' }).rating).toBe(4)
    expect(createFeedbackSchema.safeParse({ ...valid, rating: 0 }).success).toBe(false)
    expect(createFeedbackSchema.safeParse({ ...valid, rating: 6 }).success).toBe(false)
    expect(createFeedbackSchema.safeParse({ ...valid, rating: 3.5 }).success).toBe(false)
  })

  it('treats a blank email as "not provided" rather than invalid', () => {
    // An untouched optional input posts an empty string; that is not a validation error.
    expect(createFeedbackSchema.parse({ ...valid, email: '' }).email).toBeNull()
    expect(createFeedbackSchema.parse({ ...valid, email: '   ' }).email).toBeNull()
    expect(createFeedbackSchema.parse({ ...valid, email: 'someone@example.com' }).email).toBe(
      'someone@example.com',
    )
    expect(createFeedbackSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false)
  })

  it('reports the offending field, so the form can show the message in place', () => {
    const result = createFeedbackSchema.safeParse({ categorySlug: '', comment: 'x' })

    expect(result.success).toBe(false)
    const paths = result.error?.issues.map((issue) => issue.path.join('.')) ?? []
    expect(paths).toContain('categorySlug')
    expect(paths).toContain('comment')
  })
})

describe('listFeedbackQuerySchema', () => {
  it('applies defaults for an empty query string', () => {
    expect(listFeedbackQuerySchema.parse({})).toMatchObject({
      page: 1,
      pageSize: 20,
      sort: 'newest',
    })
  })

  it('caps pageSize, so no caller can ask for the whole table', () => {
    expect(listFeedbackQuerySchema.parse({ pageSize: '100' }).pageSize).toBe(100)
    expect(listFeedbackQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false)
  })

  it('parses dates and rejects unknown enum values', () => {
    expect(listFeedbackQuerySchema.parse({ from: '2026-08-01' }).from).toBeInstanceOf(Date)
    expect(listFeedbackQuerySchema.safeParse({ status: 'archived' }).success).toBe(false)
    expect(listFeedbackQuerySchema.safeParse({ sort: 'random' }).success).toBe(false)
  })
})

describe('other contracts', () => {
  it('defaults analytics to the last 30 days', () => {
    expect(analyticsQuerySchema.parse({}).range).toBe('30d')
    expect(analyticsQuerySchema.safeParse({ range: '5y' }).success).toBe(false)
  })

  it('accepts only the three real statuses', () => {
    expect(updateFeedbackStatusSchema.parse({ status: 'resolved' }).status).toBe('resolved')
    expect(updateFeedbackStatusSchema.safeParse({ status: 'closed' }).success).toBe(false)
  })

  it('does not impose a password length rule that would leak the real policy', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true)
    expect(loginSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false)
  })
})
