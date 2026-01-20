import { createSupabaseClient } from '@/lib/supabase/client'
import { NextResponse } from 'next/server'

// GET single record
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    try {
        const supabase = createSupabaseClient()
        const { data, error } = await supabase
            .from('cargo_records')
            .select('*')
            .eq('id', id)
            .single()

        if (error) throw error
        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PUT (update) record
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    try {
        const body = await request.json()
        const supabase = createSupabaseClient()

        const { data, error } = await supabase
            .from('cargo_records')
            .update(body)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// DELETE record
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    try {
        const supabase = createSupabaseClient()
        const { error } = await supabase
            .from('cargo_records')
            .delete()
            .eq('id', id)

        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
