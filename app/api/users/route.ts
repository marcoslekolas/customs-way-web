import { createSupabaseClient } from '@/lib/supabase/client'
import { NextResponse } from 'next/server'

// GET all users
export async function GET() {
    try {
        const supabase = createSupabaseClient()
        const { data, error } = await supabase
            .from('users')
            .select('id, username, role, is_locked, created_at')
            .order('created_at', { ascending: false })

        if (error) throw error
        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST new user
export async function POST(request: Request) {
    try {
        const { username, password, role } = await request.json()

        if (!username || !password) {
            return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
        }

        const supabase = createSupabaseClient()

        const { data, error } = await supabase
            .from('users')
            .insert([{
                username,
                password_hash: password, // Store plaintext for now
                role: role || 'user',
                must_change_password: false,
                is_locked: false
            }])
            .select()
            .single()

        if (error) throw error
        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
