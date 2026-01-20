import { createSupabaseClient } from '@/lib/supabase/client'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const supabase = createSupabaseClient()
        const { searchParams } = new URL(request.url)

        // Get record IDs from query params (comma-separated)
        const recordIdsParam = searchParams.get('recordIds')
        const recordIds = recordIdsParam ? recordIdsParam.split(',') : []

        if (recordIds.length === 0) {
            return NextResponse.json({
                totalExpenses: 0,
                expensesByConcept: {},
                expensesByHandling: {},
                count: 0
            })
        }

        // Fetch expenses for filtered records
        const { data: expenses, error } = await supabase
            .from('record_expenses')
            .select('*')
            .in('record_id', recordIds)

        if (error) throw error

        // Fetch cargo records to get handling info
        const { data: records, error: recordsError } = await supabase
            .from('cargo_records')
            .select('id, data')
            .in('id', recordIds)

        if (recordsError) throw recordsError

        // Create a map of record_id to handling
        const handlingMap: Record<string, string> = {}
        records?.forEach(r => {
            handlingMap[r.id] = r.data?.handling || 'Sin Handling'
        })

        const expensesList = expenses || []
        const totalExpenses = expensesList.reduce((sum, e) => sum + (e.amount || 0), 0)

        // Group by concept
        const expensesByConcept: Record<string, number> = {}
        expensesList.forEach(e => {
            const concept = e.concept || 'Otros'
            expensesByConcept[concept] = (expensesByConcept[concept] || 0) + e.amount
        })

        // Group by handling (from related record)
        const expensesByHandling: Record<string, number> = {}
        expensesList.forEach(e => {
            const handling = handlingMap[e.record_id] || 'Sin Handling'
            expensesByHandling[handling] = (expensesByHandling[handling] || 0) + e.amount
        })

        // Sort expensesByConcept by amount descending
        const sortedByConcept = Object.entries(expensesByConcept)
            .sort((a, b) => b[1] - a[1])
            .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {})

        const sortedByHandling = Object.entries(expensesByHandling)
            .sort((a, b) => b[1] - a[1])
            .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {})

        return NextResponse.json({
            totalExpenses: Math.round(totalExpenses * 100) / 100,
            expensesByConcept: sortedByConcept,
            expensesByHandling: sortedByHandling,
            count: expensesList.length
        })
    } catch (error: any) {
        console.error('Error fetching dashboard expenses:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

