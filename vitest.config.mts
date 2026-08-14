import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Everything under test is server code; no DOM is needed.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    /**
     * Integration tests each own a PGlite instance (real Postgres, in WASM). Two
     * of those in the same process is fine; a dozen in parallel is a lot of memory
     * and CPU, so files run one at a time.
     */
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    // Mirrors the `@/*` path alias in tsconfig.json.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
