import { createSupabaseClient } from '@/lib/supabase/client'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const supabase = createSupabaseClient()
        const { searchParams } = new URL(request.url)

        const year = searchParams.get('year') || new Date().getFullYear().toString()
        const limit = parseInt(searchParams.get('limit') || '10')

        // Fetch all records for the year
        const { data: records, error } = await supabase
            .from('cargo_records')
            .select('*')

        if (error) throw error

        let filtered = records || []

        // Filter by year
        filtered = filtered.filter(r => {
            const recordYear = r.year || new Date(r.created_at).getFullYear()
            return recordYear === parseInt(year)
        })

        // Get record IDs
        const recordIds = filtered.map(r => r.id)

        // Fetch expenses
        const { data: expenses, error: expError } = await supabase
            .from('record_expenses')
            .select('*')
            .in('record_id', recordIds)

        if (expError) throw expError

        // Map expenses to records
        const expenseMap: Record<string, number> = {}
        expenses?.forEach(e => {
            expenseMap[e.record_id] = (expenseMap[e.record_id] || 0) + (e.amount || 0)
        })

        // Aggregate by consignatario
        const consignatarioData: Record<string, {
            totalExpenses: number
            totalWeight: number
            recordCount: number
            packages: number
        }> = {}

        filtered.forEach(r => {
            const consignatario = r.recipient || 'Sin Consignatario'

            if (!consignatarioData[consignatario]) {
                consignatarioData[consignatario] = { totalExpenses: 0, totalWeight: 0, recordCount: 0, packages: 0 }
            }

            consignatarioData[consignatario].recordCount++
            consignatarioData[consignatario].totalWeight += r.weight || 0
            consignatarioData[consignatario].totalExpenses += expenseMap[r.id] || 0
            consignatarioData[consignatario].packages += r.data?.packages || 0
        })

        // Convert to array
        const results = Object.entries(consignatarioData).map(([name, data]) => ({
            name,
            totalExpenses: Math.round(data.totalExpenses * 100) / 100,
            totalWeight: Math.round(data.totalWeight * 100) / 100,
            recordCount: data.recordCount,
            packages: data.packages,
            costPerKg: data.totalWeight > 0
                ? Math.round((data.totalExpenses / data.totalWeight) * 100) / 100
                : 0
        }))

        // Sort by totalExpenses descending (top by expenses)
        const byExpenses = [...results].sort((a, b) => b.totalExpenses - a.totalExpenses).slice(0, limit)

        // Sort by totalWeight descending (top by volume)
        const byVolume = [...results].sort((a, b) => b.totalWeight - a.totalWeight).slice(0, limit)

        // Sort by recordCount descending (top by frequency)
        const byFrequency = [...results].sort((a, b) => b.recordCount - a.recordCount).slice(0, limit)

        return NextResponse.json({
            byExpenses,
            byVolume,
            byFrequency,
            year: parseInt(year),
            totalConsignatarios: results.length
        })
    } catch (error: any) {
        console.error('Error fetching top consignatarios:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
