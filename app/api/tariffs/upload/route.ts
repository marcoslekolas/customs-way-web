import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase/client'

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File
        const company = formData.get('company') as string
        const year = formData.get('year') as string

        if (!file || !company || !year) {
            return NextResponse.json(
                { error: 'Faltan campos requeridos: file, company, year' },
                { status: 400 }
            )
        }

        const supabase = createSupabaseClient()

        // Generate unique filename
        const timestamp = Date.now()
        const sanitizedCompany = company.toLowerCase().replace(/\s+/g, '-')
        const filename = `${sanitizedCompany}_${year}_${timestamp}.pdf`

        // Convert File to ArrayBuffer then to Uint8Array for Supabase
        const arrayBuffer = await file.arrayBuffer()
        const fileBuffer = new Uint8Array(arrayBuffer)

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('tariff-pdfs')
            .upload(filename, fileBuffer, {
                contentType: 'application/pdf',
                upsert: false
            })

        if (error) {
            console.error('Storage upload error:', error)
            // If bucket doesn't exist, try to create it
            if (error.message.includes('not found') || error.message.includes('Bucket')) {
                return NextResponse.json(
                    { error: 'El bucket de almacenamiento no existe. Créalo en Supabase: tariff-pdfs' },
                    { status: 500 }
                )
            }
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('tariff-pdfs')
            .getPublicUrl(filename)

        // Save reference in database
        const { data: tariffPdf, error: dbError } = await supabase
            .from('tariff_pdfs')
            .insert({
                handling_company: company,
                year: parseInt(year),
                filename: filename,
                storage_path: data.path,
                public_url: urlData.publicUrl,
                uploaded_at: new Date().toISOString()
            })
            .select()
            .single()

        if (dbError) {
            console.error('DB insert error:', dbError)
            // If table doesn't exist, just return the storage info
            return NextResponse.json({
                success: true,
                filename,
                path: data.path,
                url: urlData.publicUrl,
                message: 'PDF subido correctamente. Tabla tariff_pdfs no existe aún.'
            })
        }

        return NextResponse.json({
            success: true,
            id: tariffPdf?.id,
            filename,
            path: data.path,
            url: urlData.publicUrl
        })

    } catch (error: any) {
        console.error('Upload error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
