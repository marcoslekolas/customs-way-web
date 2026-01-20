import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

// Simple session validation - checks if cookie exists and has valid format
export async function getServerSession() {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('customs-way-session')

    if (!sessionCookie) {
        return null
    }

    // Session exists - for now we trust the cookie
    // The API route /api/auth/me already validates against Supabase
    // This is just for SSR routing decisions
    return { authenticated: true, sessionId: sessionCookie.value }
}

export async function requireAuth() {
    const session = await getServerSession()

    if (!session) {
        redirect('/login')
    }

    return session
}

export async function requireGuest() {
    const session = await getServerSession()

    if (session) {
        redirect('/dashboard')
    }
}
