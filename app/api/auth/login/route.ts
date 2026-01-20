import { createSupabaseClient } from '@/lib/supabase/client'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
    try {
        const { username, password } = await request.json()

        if (!username || !password) {
            return NextResponse.json({ error: 'Usuario y contraseña requeridos' }, { status: 400 })
        }

        const supabase = createSupabaseClient()

        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)

        if (error || !users || users.length === 0) {
            return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
        }

        const user = users[0]

        // Check if user is locked
        if (user.is_locked) {
            return NextResponse.json({ error: 'Usuario bloqueado' }, { status: 403 })
        }

        // Simple password check (plaintext for now, as stored in DB)
        const passwordMatch = password === user.password_hash

        if (!passwordMatch) {
            return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
        }

        // Set session cookie
        (await cookies()).set('customs-way-session', user.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        })

        return NextResponse.json({ success: true, user: { id: user.id, username: user.username, role: user.role } })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
