import React from 'react'
import { notFound } from 'next/navigation'

// Temporary 404 until middleware (Phase 0.2b) ships.
// Remove this file once the site-wide basic-auth middleware is deployed.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  notFound()
}
