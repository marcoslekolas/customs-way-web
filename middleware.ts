import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Check if accessing dashboard routes
    const isDashboardRoute = pathname.startsWith('/dashboard') ||
        pathname.startsWith('/registros') ||
        pathname.startsWith('/datos') ||
        pathname.startsWith('/configuracion')

    if (isDashboardRoute) {
        // Check for session cookie
        const sessionCookie = request.cookies.get('customs-way-session')

        if (!sessionCookie) {
            // Redirect to login if no session
            const loginUrl = new URL('/login', request.url)
            return NextResponse.redirect(loginUrl)
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/dashboard/:path*', '/registros/:path*', '/datos/:path*', '/configuracion/:path*']
}
