import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = [/^\/_next\//, /^\/favicon/, /^\/robots\.txt$/]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC_PATHS.some(p => p.test(pathname))) return NextResponse.next()

  const auth = req.headers.get('authorization') ?? ''

  if (auth === `Bearer ${process.env.CRON_SECRET}`) return NextResponse.next()

  if (auth.startsWith('Basic ')) {
    const decoded = atob(auth.slice(6))
    const colonIdx = decoded.indexOf(':')
    const user = decoded.slice(0, colonIdx)
    const pass = decoded.slice(colonIdx + 1)
    if (user === process.env.BASIC_AUTH_USER && pass === process.env.BASIC_AUTH_PASS) {
      return NextResponse.next()
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Lakepointe CIP"' },
  })
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] }
