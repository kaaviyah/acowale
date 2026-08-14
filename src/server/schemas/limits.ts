/**
 * Validation limits.
 *
 * Deliberately a file of plain numbers with no imports, so client components can
 * use the same bounds the server enforces without pulling Zod or Drizzle into the
 * browser bundle. The character counter in the form and the `CHECK` constraint in
 * the database are then guaranteed to agree.
 */
export const COMMENT_MIN_LENGTH = 3
export const COMMENT_MAX_LENGTH = 2000
export const EMAIL_MAX_LENGTH = 320
export const SEARCH_MAX_LENGTH = 120
export const PAGE_SIZE_DEFAULT = 20
export const PAGE_SIZE_MAX = 100
