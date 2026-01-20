import { createSupabaseClient } from '@/lib/supabase/client'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const supabase = createSupabaseClient()
        const { searchParams } = new URL(request.url)

        const segmentBy = searchParams.get('segmentBy') || 'handling'
        const year = searchParams.get('year') || new Date().getFullYear().toString()

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

        // Aggregate by segment
        const segmentData: Record<string, { totalExpenses: number; totalWeight: number; recordCount: number }> = {}

        filtered.forEach(r => {
            let segmentValue: string
            switch (segmentBy) {
                case 'consignatario':
                    segmentValue = r.recipient || 'Sin Consignatario'
                    break
                case 'handling':
                    segmentValue = r.data?.handling || 'Sin Handling'
                    break
                case 'airport':
                    segmentValue = r.data?.airport || 'Sin Aeropuerto'
                    break
                case 'vessel':
                    segmentValue = r.data?.vessel_name || 'Sin Buque'
                    break
                default:
                    segmentValue = 'Otros'
            }

            if (!segmentData[segmentValue]) {
                segmentData[segmentValue] = { totalExpenses: 0, totalWeight: 0, recordCount: 0 }
            }

            segmentData[segmentValue].recordCount++
            segmentData[segmentValue].totalWeight += r.weight || 0
            segmentData[segmentValue].totalExpenses += expenseMap[r.id] || 0
        })

        // Convert to array with cost per kg
        const results = Object.entries(segmentData).map(([segment, data]) => ({
            segment,
            totalExpenses: Math.round(data.totalExpenses * 100) / 100,
            totalWeight: Math.round(data.totalWeight * 100) / 100,
            recordCount: data.recordCount,
            costPerKg: data.totalWeight > 0
                ? Math.round((data.totalExpenses / data.totalWeight) * 100) / 100
                : 0
        }))

        // Sort by costPerKg descending
        results.sort((a, b) => b.costPerKg - a.costPerKg)

        return NextResponse.json({
            data: results.slice(0, 20), // Top 20
            year: parseInt(year)
        })
    } catch (error: any) {
        console.error('Error fetching cost per kg:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
