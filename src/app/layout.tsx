import type { Metadata } from 'next'
import './globals.css'
import TopNav from '@/components/TopNav'

export const metadata: Metadata = {
  title: 'Community Intelligence Platform',
  description: 'DFW demographic intelligence dashboard for Lakepointe Church',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <TopNav />
        {children}
      </body>
    </html>
  )
}
