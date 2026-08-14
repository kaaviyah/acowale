import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '@/server/lib/password'

describe('password hashing', () => {
  it('verifies a correct password', async () => {
    const hash = await hashPassword('correct-horse-battery')
    await expect(verifyPassword('correct-horse-battery', hash)).resolves.toBe(true)
  })

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct-horse-battery')
    await expect(verifyPassword('correct-horse-batter', hash)).resolves.toBe(false)
  })

  it('salts each hash, so the same password never produces the same string', async () => {
    const [first, second] = await Promise.all([hashPassword('same-password'), hashPassword('same-password')])

    expect(first).not.toBe(second)
    // Both still verify — the salt travels inside the stored hash.
    await expect(verifyPassword('same-password', first)).resolves.toBe(true)
    await expect(verifyPassword('same-password', second)).resolves.toBe(true)
  })

  it('records its own parameters, so the cost can be raised without invalidating old hashes', async () => {
    const parts = (await hashPassword('parameters-please')).split(':')

    expect(parts).toHaveLength(6)
    expect(parts[0]).toBe('scrypt')
    expect(Number(parts[1])).toBeGreaterThanOrEqual(16_384)
  })

  it('verifies against the parameters recorded in the hash, not the current defaults', async () => {
    // Stands in for a hash written when the cost parameters were lower: raising
    // the cost must not lock out existing accounts.
    const { scryptSync } = await import('node:crypto')
    const salt = Buffer.from('legacy-salt-1234')
    const key = scryptSync('legacy-password', salt, 32, { N: 1024, r: 8, p: 1 })
    const legacy = ['scrypt', 1024, 8, 1, salt.toString('base64'), key.toString('base64')].join(':')

    await expect(verifyPassword('legacy-password', legacy)).resolves.toBe(true)
    await expect(verifyPassword('wrong-password', legacy)).resolves.toBe(false)
  })

  it('fails closed on a malformed stored hash', async () => {
    for (const malformed of ['', 'not-a-hash', 'scrypt:only:three', 'bcrypt:16384:8:1:a:b']) {
      await expect(verifyPassword('whatever', malformed)).resolves.toBe(false)
    }
  })

  it('contains no `$`, so env-file parsers cannot mangle it', async () => {
    // Regression guard: `$`-delimited hashes are silently truncated by Node's
    // --env-file variable expansion, which breaks every login with no error.
    expect(await hashPassword('dollar-free')).not.toContain('$')
  })
})
