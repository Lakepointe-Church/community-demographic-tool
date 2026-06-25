import type { Metadata } from 'next'
import './globals.css'
import TopNav from '@/components/TopNav'
import { Analytics } from '@vercel/analytics/next'

export const metadata: Metadata = {
  title: 'Community Intelligence Platform',
  description: 'DFW demographic intelligence dashboard for Lakepointe Church',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body>
        <TopNav />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
