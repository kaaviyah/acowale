/**
 * Dashboard skeleton.
 *
 * Shown while the server renders the real page. It mirrors the final layout so the
 * content lands in the same places rather than pushing everything down — a skeleton
 * whose shape doesn't match its page is just a different kind of flicker.
 */
export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 animate-pulse px-4 py-8" aria-busy="true">
      <span className="sr-only">Loading the dashboard…</span>

      <div className="h-8 w-40 rounded bg-grid" />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((tile) => (
          <div key={tile} className="h-32 rounded-xl border border-hairline bg-surface" />
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className="h-80 rounded-xl border border-hairline bg-surface lg:col-span-3" />
        <div className="h-80 rounded-xl border border-hairline bg-surface lg:col-span-2" />
      </div>

      <div className="mt-8 h-96 rounded-xl border border-hairline bg-surface" />
    </main>
  )
}
