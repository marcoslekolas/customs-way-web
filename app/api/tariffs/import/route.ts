import { createSupabaseClient } from '@/lib/supabase/client'
import { NextResponse } from 'next/server'

// POST - Import tariffs from PDF or manual entry
export async function POST(request: Request) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const year = formData.get('year') as string
        const handlingCompany = formData.get('handling_company') as string
        const manualTariffs = formData.get('tariffs') as string | null

        if (!year || !handlingCompany) {
            return NextResponse.json(
                { error: 'Año y compañía handling son requeridos' },
                { status: 400 }
            )
        }

        const supabase = createSupabaseClient()
        let tariffs: any[] = []

        // If manual tariffs are provided (JSON array)
        if (manualTariffs) {
            tariffs = JSON.parse(manualTariffs)
        }
        // If PDF file is provided, parse it
        else if (file) {
            // Note: pdf-parse has issues in Next.js server - recommend manual entry
            // For now, return an error suggesting manual entry
            return NextResponse.json({
                error: 'La importación automática de PDF no está disponible. Por favor, usa "Añadir Manualmente" para introducir las tarifas.',
                suggestion: 'manual'
            }, { status: 400 })
        }

        if (tariffs.length === 0) {
            return NextResponse.json(
                { error: 'No se encontraron tarifas para importar' },
                { status: 400 }
            )
        }

        // Add year and handling company to each tariff
        const tariffsToInsert = tariffs.map(t => ({
            ...t,
            year: parseInt(year),
            handling_company: handlingCompany
        }))

        // Upsert tariffs (update if exists, insert if new)
        const { data, error } = await supabase
            .from('tariffs')
            .upsert(tariffsToInsert, {
                onConflict: 'handling_company,year,concept,weight_range_min,weight_range_max'
            })
            .select()

        if (error) throw error

        return NextResponse.json({
            success: true,
            imported: tariffsToInsert.length,
            tariffs: data
        })
    } catch (error: any) {
        console.error('Error importing tariffs:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// Function to parse PDF text and extract tariff information
function parsePdfTariffs(text: string, year: number, handlingCompany: string): any[] {
    const tariffs: any[] = []
    const lines = text.split('\n').map(l => l.trim()).filter(l => l)

    // Common patterns for tariff tables
    // Pattern: "Concept - Price" or "Concept: Price" or table rows
    const pricePattern = /(\d+[.,]\d{2})\s*€?/g
    const conceptPatterns = [
        /almacenaje/i,
        /handling/i,
        /despacho/i,
        /manipulaci[oó]n/i,
        /carga/i,
        /descarga/i,
        /documentaci[oó]n/i,
        /inspecci[oó]n/i,
        /apertura/i,
        /express/i,
        /fuera.?horario/i,
        /festivo/i,
        /urgente/i
    ]

    // Try to identify table structure
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // Look for lines that might contain concept and price
        for (const pattern of conceptPatterns) {
            if (pattern.test(line)) {
                const prices = line.match(pricePattern)
                if (prices && prices.length > 0) {
                    const concept = line.replace(pricePattern, '').trim()
                    const price = parseFloat(prices[0].replace(',', '.').replace('€', ''))

                    if (!isNaN(price) && concept) {
                        tariffs.push({
                            concept: concept.substring(0, 100),
                            price_type: 'fixed',
                            price_per_unit: price,
                            min_price: null,
                            weight_range_min: null,
                            weight_range_max: null
                        })
                    }
                }
                break
            }
        }

        // Look for weight range patterns like "0-100 kg: 0.50€/kg"
        const rangePattern = /(\d+)\s*[-–]\s*(\d+)\s*kg/i
        const rangeMatch = line.match(rangePattern)
        if (rangeMatch) {
            const prices = line.match(pricePattern)
            if (prices) {
                tariffs.push({
                    concept: 'Almacenaje por peso',
                    price_type: 'per_kg',
                    price_per_unit: parseFloat(prices[0].replace(',', '.').replace('€', '')),
                    min_price: prices[1] ? parseFloat(prices[1].replace(',', '.').replace('€', '')) : null,
                    weight_range_min: parseFloat(rangeMatch[1]),
                    weight_range_max: parseFloat(rangeMatch[2])
                })
            }
        }
    }

    return tariffs
}
