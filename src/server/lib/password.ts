/**
 * Password hashing for the single admin account.
 *
 * scrypt from Node's standard library: memory-hard (so GPU brute force is
 * expensive), no native module to compile, nothing to keep patched. The stored
 * format carries its own parameters —
 *
 *   scrypt:N:r:p:<base64 salt>:<base64 hash>
 *
 * — so the cost can be raised later without invalidating existing hashes: verify
 * with whatever parameters the stored string names, not with today's constants.
 *
 * The conventional delimiter here would be `$` (as in crypt(3) and PHC strings).
 * It is `:` instead, deliberately: Node's `--env-file` parser expands `$NAME`
 * inside double-quoted values, so a `$`-delimited hash silently truncates to
 * `"scrypt"` and every login fails with no visible cause. Base64 never produces a
 * colon, so this format survives env files, shells, and CI secret editors alike.
 */
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

/** CPU/memory cost. 2^14 needs ~16 MB per hash — comfortable for a login route. */
const DEFAULT_N = 16_384
const DEFAULT_R = 8
const DEFAULT_P = 1
const KEY_LENGTH = 32
const SALT_LENGTH = 16

const derive = (
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const key = await derive(password, salt, KEY_LENGTH, {
    N: DEFAULT_N,
    r: DEFAULT_R,
    p: DEFAULT_P,
  })

  return [
    'scrypt',
    DEFAULT_N,
    DEFAULT_R,
    DEFAULT_P,
    salt.toString('base64'),
    key.toString('base64'),
  ].join(':')
}

/**
 * Verifies a password against a stored hash.
 *
 * Comparison is `timingSafeEqual`: a byte-by-byte `===` leaks how much of the
 * hash matched through response timing. Returns `false` rather than throwing on a
 * malformed stored hash, so a misconfigured `ADMIN_PASSWORD_HASH` fails closed.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const [, rawN, rawR, rawP, rawSalt, rawKey] = parts
  const N = Number(rawN)
  const r = Number(rawR)
  const p = Number(rawP)
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false

  try {
    const expected = Buffer.from(rawKey, 'base64')
    const actual = await derive(password, Buffer.from(rawSalt, 'base64'), expected.length, {
      N,
      r,
      p,
      // Node caps scrypt memory at 32 MB by default; be explicit so raising the
      // cost parameters later fails loudly here rather than at 3am in production.
      maxmem: 256 * N * r,
    })

    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}
