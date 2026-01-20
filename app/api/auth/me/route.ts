import { createSupabaseClient } from '@/lib/supabase/client'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
    try {
        const cookieStore = await cookies()
        const sessionCookie = cookieStore.get('customs-way-session')

        if (!sessionCookie) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const userId = sessionCookie.value
        const supabase = createSupabaseClient()

        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, role, is_locked')
            .eq('id', userId)
            .single()

        if (error || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        return NextResponse.json(user)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
