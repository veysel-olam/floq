import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const REDIRECT_IF_AUTHED = ['/', '/login', '/register']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get('better-auth.session_token')?.value
  const isLoggedIn = !!sessionToken

  // Logged-in user tries to access landing or auth pages → send to /home
  if (isLoggedIn && REDIRECT_IF_AUTHED.includes(pathname)) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/login', '/register'],
}
