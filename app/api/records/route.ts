import { createSupabaseClient } from '@/lib/supabase/client'
import { NextResponse } from 'next/server'

// GET all records
export async function GET() {
    try {
        const supabase = createSupabaseClient()
        const { data, error } = await supabase
            .from('cargo_records')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error
        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST new record
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const supabase = createSupabaseClient()

        const { data, error } = await supabase
            .from('cargo_records')
            .insert([body])
            .select()
            .single()

        if (error) throw error
        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
