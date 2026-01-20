import { createSupabaseClient } from '@/lib/supabase/client'
import { NextResponse } from 'next/server'

// PATCH - lock/unlock user
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    try {
        const { is_locked } = await request.json()
        const supabase = createSupabaseClient()

        // Check if it's admin user
        const { data: user } = await supabase
            .from('users')
            .select('username')
            .eq('id', id)
            .single()

        if (user?.username === 'admin') {
            return NextResponse.json({ error: 'Cannot lock admin user' }, { status: 403 })
        }

        const { data, error } = await supabase
            .from('users')
            .update({ is_locked })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// DELETE user
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    try {
        const supabase = createSupabaseClient()

        // Check if it's admin user
        const { data: user } = await supabase
            .from('users')
            .select('username')
            .eq('id', id)
            .single()

        if (user?.username === 'admin') {
            return NextResponse.json({ error: 'Cannot delete admin user' }, { status: 403 })
        }

        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', id)

        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
