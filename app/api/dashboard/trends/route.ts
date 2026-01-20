import { createSupabaseClient } from '@/lib/supabase/client'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const supabase = createSupabaseClient()
        const { searchParams } = new URL(request.url)

        const segmentBy = searchParams.get('segmentBy') || 'handling' // consignatario, handling, airport, vessel
        const year = searchParams.get('year') || new Date().getFullYear().toString()
        const segment = searchParams.get('segment') // specific value to filter by

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

        // Filter by specific segment if provided
        if (segment) {
            filtered = filtered.filter(r => {
                switch (segmentBy) {
                    case 'consignatario':
                        return r.recipient?.toLowerCase().includes(segment.toLowerCase())
                    case 'handling':
                        return r.data?.handling === segment
                    case 'airport':
                        return r.data?.airport === segment
                    case 'vessel':
                        return r.data?.vessel_name?.toLowerCase().includes(segment.toLowerCase())
                    default:
                        return true
                }
            })
        }

        // Get record IDs for expense lookup
        const recordIds = filtered.map(r => r.id)

        // Fetch expenses for these records
        const { data: expenses, error: expError } = await supabase
            .from('record_expenses')
            .select('*')
            .in('record_id', recordIds)

        if (expError) throw expError

        // Group records and expenses by month
        const monthlyData: Record<number, { totalExpenses: number; totalWeight: number; recordCount: number }> = {}

        // Initialize all 12 months
        for (let m = 1; m <= 12; m++) {
            monthlyData[m] = { totalExpenses: 0, totalWeight: 0, recordCount: 0 }
        }

        // Aggregate records by month
        filtered.forEach(r => {
            const date = r.data?.arrival_date || r.data?.pickup_date || r.created_at
            if (!date) return
            const month = new Date(date).getMonth() + 1
            if (month >= 1 && month <= 12) {
                monthlyData[month].recordCount++
                monthlyData[month].totalWeight += r.weight || 0
            }
        })

        // Create a map of record_id to month
        const recordMonthMap: Record<string, number> = {}
        filtered.forEach(r => {
            const date = r.data?.arrival_date || r.data?.pickup_date || r.created_at
            if (date) {
                recordMonthMap[r.id] = new Date(date).getMonth() + 1
            }
        })

        // Aggregate expenses by month
        expenses?.forEach(e => {
            const month = recordMonthMap[e.record_id]
            if (month && month >= 1 && month <= 12) {
                monthlyData[month].totalExpenses += e.amount || 0
            }
        })

        // Convert to array format for charts
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        const trends = Object.entries(monthlyData).map(([month, data]) => ({
            month: monthNames[parseInt(month) - 1],
            monthNum: parseInt(month),
            totalExpenses: Math.round(data.totalExpenses * 100) / 100,
            totalWeight: Math.round(data.totalWeight * 100) / 100,
            recordCount: data.recordCount,
            costPerKg: data.totalWeight > 0 ? Math.round((data.totalExpenses / data.totalWeight) * 100) / 100 : 0
        }))

        return NextResponse.json({ trends, year: parseInt(year) })
    } catch (error: any) {
        console.error('Error fetching trends:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
