import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Acowale CRM — Customer Feedback',
    template: '%s · Acowale CRM',
  },
  description:
    'Share feedback with the Acowale team, and analyse trends in the admin console. Machine test build by Kaaviyah Prakasam.',
  // The admin console must never be indexed; the public form has no SEO value
  // for a machine test either.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9f9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0d0d' },
  ],
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
