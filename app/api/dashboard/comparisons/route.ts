import { createSupabaseClient } from '@/lib/supabase/client'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const supabase = createSupabaseClient()
        const { searchParams } = new URL(request.url)

        const segmentBy = searchParams.get('segmentBy') || 'handling'
        const year1 = parseInt(searchParams.get('year1') || (new Date().getFullYear() - 1).toString())
        const year2 = parseInt(searchParams.get('year2') || new Date().getFullYear().toString())

        // Fetch all records
        const { data: records, error } = await supabase
            .from('cargo_records')
            .select('*')

        if (error) throw error

        const allRecords = records || []

        // Filter by years
        const recordsYear1 = allRecords.filter(r => {
            const recordYear = r.year || new Date(r.created_at).getFullYear()
            return recordYear === year1
        })

        const recordsYear2 = allRecords.filter(r => {
            const recordYear = r.year || new Date(r.created_at).getFullYear()
            return recordYear === year2
        })

        // Get all record IDs
        const allIds = [...recordsYear1.map(r => r.id), ...recordsYear2.map(r => r.id)]

        // Fetch expenses
        const { data: expenses, error: expError } = await supabase
            .from('record_expenses')
            .select('*')
            .in('record_id', allIds)

        if (expError) throw expError

        const expenseMap: Record<string, number> = {}
        expenses?.forEach(e => {
            expenseMap[e.record_id] = (expenseMap[e.record_id] || 0) + (e.amount || 0)
        })

        // Helper function to aggregate by segment
        const aggregateBySegment = (recs: any[]) => {
            const result: Record<string, { totalExpenses: number; totalWeight: number; recordCount: number }> = {}

            recs.forEach(r => {
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

                if (!result[segmentValue]) {
                    result[segmentValue] = { totalExpenses: 0, totalWeight: 0, recordCount: 0 }
                }

                result[segmentValue].recordCount++
                result[segmentValue].totalWeight += r.weight || 0
                result[segmentValue].totalExpenses += expenseMap[r.id] || 0
            })

            return result
        }

        const dataYear1 = aggregateBySegment(recordsYear1)
        const dataYear2 = aggregateBySegment(recordsYear2)

        // Combine into comparison format
        const allSegments = new Set([...Object.keys(dataYear1), ...Object.keys(dataYear2)])
        const comparisons = Array.from(allSegments).map(segment => ({
            segment,
            year1: {
                year: year1,
                totalExpenses: Math.round((dataYear1[segment]?.totalExpenses || 0) * 100) / 100,
                totalWeight: Math.round((dataYear1[segment]?.totalWeight || 0) * 100) / 100,
                recordCount: dataYear1[segment]?.recordCount || 0
            },
            year2: {
                year: year2,
                totalExpenses: Math.round((dataYear2[segment]?.totalExpenses || 0) * 100) / 100,
                totalWeight: Math.round((dataYear2[segment]?.totalWeight || 0) * 100) / 100,
                recordCount: dataYear2[segment]?.recordCount || 0
            },
            change: dataYear1[segment]?.totalExpenses
                ? Math.round(((dataYear2[segment]?.totalExpenses || 0) - dataYear1[segment].totalExpenses) / dataYear1[segment].totalExpenses * 100)
                : null
        }))

        // Sort by year2 totalExpenses descending
        comparisons.sort((a, b) => b.year2.totalExpenses - a.year2.totalExpenses)

        return NextResponse.json({
            comparisons: comparisons.slice(0, 15), // Top 15
            year1,
            year2
        })
    } catch (error: any) {
        console.error('Error fetching comparisons:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
