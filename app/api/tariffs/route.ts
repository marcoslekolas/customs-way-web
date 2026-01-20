import { createSupabaseClient } from '@/lib/supabase/client'
import { NextResponse } from 'next/server'

// GET all tariffs (filterable by year and company)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const year = searchParams.get('year')
        const company = searchParams.get('company')

        const supabase = createSupabaseClient()
        let query = supabase
            .from('tariffs')
            .select('*')
            .order('handling_company')
            .order('concept')

        if (year) {
            query = query.eq('year', parseInt(year))
        }
        if (company) {
            query = query.eq('handling_company', company)
        }

        const { data, error } = await query

        if (error) throw error
        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST new tariff
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const supabase = createSupabaseClient()

        const { data, error } = await supabase
            .from('tariffs')
            .insert([body])
            .select()
            .single()

        if (error) throw error
        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
