import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /**
   * Both packages resolve things at runtime that a bundler can't follow: pino
   * loads level serialisers dynamically, PGlite loads a WASM binary. Leaving them
   * external keeps them working in the server output.
   */
  serverExternalPackages: ['pino', '@electric-sql/pglite'],

  /** No reason to advertise the framework and version to scanners. */
  poweredByHeader: false,

  /**
   * Baseline security headers on every response.
   *
   * A strict Content-Security-Policy is deliberately absent: doing it properly
   * with Next.js needs per-request nonces threaded through `proxy.ts`, and a
   * half-configured CSP is worse than none — it breaks the app while providing no
   * real guarantee. Recorded as a follow-up in DECISIONS.md.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Don't let a browser guess that a JSON response is really HTML.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // The admin console has no reason to be framed by anyone.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Don't leak admin URLs (which contain feedback ids) to third parties.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

export default nextConfig
