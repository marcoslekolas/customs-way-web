import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase/client'

export async function POST(request: NextRequest) {
    try {
        const { url, company } = await request.json()

        if (!url) {
            return NextResponse.json({ error: 'URL del PDF requerida' }, { status: 400 })
        }

        // Fetch PDF from URL
        const pdfResponse = await fetch(url)
        if (!pdfResponse.ok) {
            return NextResponse.json({ error: 'No se pudo descargar el PDF' }, { status: 400 })
        }

        const arrayBuffer = await pdfResponse.arrayBuffer()

        // Parse PDF using pdfjs-dist
        const pdfjs = await import('pdfjs-dist')

        // Set worker source
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs'

        const pdf = await pdfjs.getDocument({
            data: new Uint8Array(arrayBuffer),
            useWorkerFetch: false,
            isEvalSupported: false,
            useSystemFonts: true
        }).promise

        // Extract text from all pages
        let fullText = ''
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const textContent = await page.getTextContent()
            const pageText = textContent.items.map((item: any) => item.str).join(' ')
            fullText += pageText + '\n'
        }

        // Parse for free storage days patterns
        const result = parseFreeDays(fullText, company)

        return NextResponse.json({
            success: true,
            pages: pdf.numPages,
            textLength: fullText.length,
            extractedData: result,
            sampleText: fullText.substring(0, 500) // First 500 chars for debugging
        })

    } catch (error: any) {
        console.error('OCR error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

function parseFreeDays(text: string, company: string): {
    free_storage_days: number | null
    storage_charge_mode: 'after_free' | 'all_days' | null
    confidence: string
    matches: string[]
} {
    const normalizedText = text.toLowerCase()
    const matches: string[] = []

    // Common patterns for free storage days in Spanish tariff documents
    const patterns = [
        // "X días libres de almacenaje"
        /(\d+)\s*d[íi]as?\s*(libres?|gratis|gratuitos?|franquicia|sin\s*cargo)/gi,
        // "franquicia de X días"
        /franquicia\s*(?:de\s*)?(\d+)\s*d[íi]as?/gi,
        // "primeros X días sin cargo"
        /primeros?\s*(\d+)\s*d[íi]as?\s*(sin\s*cargo|gratis|gratuitos?)/gi,
        // "X free days" (English)
        /(\d+)\s*free\s*days?/gi,
        // "almacenaje gratuito X días"
        /almacenaje\s*(gratuito|libre|sin\s*cargo)\s*(?:durante\s*)?(\d+)\s*d[íi]as?/gi,
        // "días de carencia: X"
        /d[íi]as?\s*(?:de\s*)?(carencia|cortesía|gracia)[:\s]*(\d+)/gi,
        // Specific patterns for tariff tables
        /periodo\s*(?:de\s*)?(?:almacenaje\s*)?gratuito[:\s]*(\d+)/gi,
    ]

    let foundDays: number | null = null

    for (const pattern of patterns) {
        const regex = new RegExp(pattern.source, pattern.flags)
        let match
        while ((match = regex.exec(text)) !== null) {
            matches.push(match[0])
            // Extract the number (could be in position 1 or 2 depending on pattern)
            const num = parseInt(match[1]) || parseInt(match[2])
            if (num && num >= 1 && num <= 10) { // Reasonable range for free days
                foundDays = num
            }
        }
    }

    // Determine charge mode based on company or text patterns
    let chargeMode: 'after_free' | 'all_days' | null = null

    // Look for charge mode indicators
    if (normalizedText.includes('a partir del día') ||
        normalizedText.includes('desde el día') ||
        normalizedText.includes('transcurrido') ||
        normalizedText.includes('excedido el plazo')) {
        chargeMode = 'after_free' // Only charges days after free period
    } else if (normalizedText.includes('totalidad de los días') ||
        normalizedText.includes('todos los días') ||
        normalizedText.includes('desde el primer día')) {
        chargeMode = 'all_days' // Charges all days if exceeded
    }

    // Default based on known company behavior
    if (!chargeMode && company) {
        const companyLower = company.toLowerCase()
        if (companyLower.includes('swissport')) {
            chargeMode = 'after_free'
            if (!foundDays) foundDays = 3 // Default Swissport free days
        } else if (companyLower.includes('groundforce')) {
            chargeMode = 'all_days'
            if (!foundDays) foundDays = 2 // Default Groundforce free days
        }
    }

    return {
        free_storage_days: foundDays,
        storage_charge_mode: chargeMode,
        confidence: matches.length > 0 ? 'high' : (foundDays ? 'medium' : 'low'),
        matches
    }
}
