import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Route protection (Next.js 16 proxy convention).
 * - /app/* requires authentication (redirect to /masuk if not logged in)
 * - /masuk redirects to /app if already logged in
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = request.cookies.get('finbest-session')?.value

  // Protected app routes
  if (pathname.startsWith('/app')) {
    if (!session) {
      const loginUrl = new URL('/masuk', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Auth page: redirect to app if already logged in
  if (pathname === '/masuk') {
    if (session) {
      return NextResponse.redirect(new URL('/app', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/app/:path*', '/masuk'],
}
