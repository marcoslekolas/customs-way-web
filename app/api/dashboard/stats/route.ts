import { createSupabaseClient } from '@/lib/supabase/client'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const supabase = createSupabaseClient()
        const { searchParams } = new URL(request.url)

        // Get filter params
        const month = searchParams.get('month')
        const year = searchParams.get('year')
        const status = searchParams.get('status')
        const consignatario = searchParams.get('consignatario')
        const airport = searchParams.get('airport')
        const handling = searchParams.get('handling')

        // Fetch all records
        const { data: records, error } = await supabase
            .from('cargo_records')
            .select('*')

        if (error) throw error

        // Apply filters in memory (Supabase doesn't support JSONB filtering well)
        let filtered = records || []

        if (year) {
            filtered = filtered.filter(r => {
                const recordYear = r.year || new Date(r.created_at).getFullYear()
                return recordYear === parseInt(year)
            })
        }

        if (month) {
            filtered = filtered.filter(r => {
                const date = r.data?.pickup_date || r.data?.arrival_date || r.created_at
                if (!date) return false
                const recordMonth = new Date(date).getMonth() + 1
                return recordMonth === parseInt(month)
            })
        }

        if (status) {
            filtered = filtered.filter(r => r.data?.status === status)
        }

        if (consignatario) {
            const search = consignatario.toLowerCase()
            filtered = filtered.filter(r =>
                r.recipient?.toLowerCase().includes(search)
            )
        }

        if (airport) {
            filtered = filtered.filter(r => r.data?.airport === airport)
        }

        if (handling) {
            filtered = filtered.filter(r => r.data?.handling === handling)
        }

        // Calculate statistics
        const totalRecords = filtered.length
        const totalWeight = filtered.reduce((sum, r) => sum + (r.weight || 0), 0)
        const totalPackages = filtered.reduce((sum, r) => sum + (r.data?.packages || 0), 0)

        // Distribution by status
        const byStatus: Record<string, number> = {}
        filtered.forEach(r => {
            const s = r.data?.status || 'Sin Status'
            byStatus[s] = (byStatus[s] || 0) + 1
        })

        // Distribution by handling
        const byHandling: Record<string, number> = {}
        filtered.forEach(r => {
            const h = r.data?.handling || 'Sin Handling'
            byHandling[h] = (byHandling[h] || 0) + 1
        })

        // Distribution by airport
        const byAirport: Record<string, number> = {}
        filtered.forEach(r => {
            const a = r.data?.airport || 'Sin Aeropuerto'
            byAirport[a] = (byAirport[a] || 0) + 1
        })

        // Records with pickup confirmed vs pending
        const pickedUp = filtered.filter(r => r.data?.pickup_confirmed === true).length
        const pending = filtered.filter(r => !r.data?.pickup_confirmed).length
        const atAirport = filtered.filter(r => r.data?.arrived_at_airport && !r.data?.pickup_confirmed).length

        return NextResponse.json({
            totalRecords,
            totalWeight,
            totalPackages,
            byStatus,
            byHandling,
            byAirport,
            pickedUp,
            pending,
            atAirport,
            recordIds: filtered.map(r => r.id)
        })
    } catch (error: any) {
        console.error('Error fetching dashboard stats:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
