import { createSupabaseClient } from '@/lib/supabase/client'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const supabase = createSupabaseClient()
        const { searchParams } = new URL(request.url)

        const year = searchParams.get('year') || new Date().getFullYear().toString()
        const daysThreshold = parseInt(searchParams.get('days') || '3')

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

        const now = new Date()

        // Find records that are at airport but not picked up
        const atAirportLong = filtered
            .filter(r => r.data?.arrived_at_airport === true && r.data?.pickup_confirmed !== true)
            .map(r => {
                const arrivalDate = r.data?.arrival_date ? new Date(r.data.arrival_date) : new Date(r.created_at)
                const daysAtAirport = Math.floor((now.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24))
                return {
                    id: r.id,
                    awb: r.awb,
                    recipient: r.recipient,
                    handling: r.data?.handling || 'Sin Handling',
                    airport: r.data?.airport || 'Sin Aeropuerto',
                    arrivalDate: r.data?.arrival_date || r.created_at,
                    daysAtAirport,
                    weight: r.weight || 0
                }
            })
            .filter(r => r.daysAtAirport >= daysThreshold)
            .sort((a, b) => b.daysAtAirport - a.daysAtAirport)

        // Calculate average pickup time for completed records
        const completedRecords = filtered.filter(r =>
            r.data?.arrived_at_airport === true &&
            r.data?.pickup_confirmed === true &&
            r.data?.arrival_date &&
            r.data?.pickup_date
        )

        let avgPickupDays = 0
        if (completedRecords.length > 0) {
            const totalDays = completedRecords.reduce((sum, r) => {
                const arrival = new Date(r.data.arrival_date)
                const pickup = new Date(r.data.pickup_date)
                const days = Math.floor((pickup.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24))
                return sum + Math.max(0, days)
            }, 0)
            avgPickupDays = Math.round((totalDays / completedRecords.length) * 10) / 10
        }

        // Status summary
        const pending = filtered.filter(r => !r.data?.arrived_at_airport && !r.data?.pickup_confirmed).length
        const atAirport = filtered.filter(r => r.data?.arrived_at_airport === true && r.data?.pickup_confirmed !== true).length
        const pickedUp = filtered.filter(r => r.data?.pickup_confirmed === true).length
        const billed = filtered.filter(r => r.data?.billing_confirmed === true).length

        return NextResponse.json({
            alerts: {
                longStays: atAirportLong.slice(0, 10),
                longStaysCount: atAirportLong.length,
                threshold: daysThreshold
            },
            efficiency: {
                avgPickupDays,
                completedRecordsCount: completedRecords.length
            },
            statusSummary: {
                pending,
                atAirport,
                pickedUp,
                billed,
                total: filtered.length
            },
            year: parseInt(year)
        })
    } catch (error: any) {
        console.error('Error fetching alerts:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
