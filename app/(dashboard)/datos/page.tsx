'use client'

import { useState, useEffect } from 'react'
import { Download, Upload, Plus, Trash2, Edit2, Save, X } from 'lucide-react'

interface Tariff {
    id: string
    handling_company: string
    year: number
    concept: string
    price_type: string
    min_price: number | null
    price_per_unit: number
    weight_range_min: number | null
    weight_range_max: number | null
}

export default function DatosPage() {
    const [tariffs, setTariffs] = useState<Tariff[]>([])
    const [loading, setLoading] = useState(false)
    const [importYear, setImportYear] = useState(new Date().getFullYear().toString())
    const [importCompany, setImportCompany] = useState('')
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)
    const [showManualForm, setShowManualForm] = useState(false)
    const [editingTariff, setEditingTariff] = useState<Tariff | null>(null)
    const [selectedTariffs, setSelectedTariffs] = useState<Set<string>>(new Set())
    const [manualTariff, setManualTariff] = useState({
        concept: '',
        price_type: 'fixed',
        price_per_unit: '',
        min_price: '',
        weight_range_min: '',
        weight_range_max: ''
    })

    // PDF Upload state
    const [uploadPdf, setUploadPdf] = useState<File | null>(null)
    const [uploadCompany, setUploadCompany] = useState('')
    const [uploadYear, setUploadYear] = useState(new Date().getFullYear().toString())
    const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'processing' | 'done'>('idle')
    const [ocrResult, setOcrResult] = useState<{
        free_storage_days: number | null
        storage_charge_mode: 'after_free' | 'all_days' | null
        confidence: string
        matches: string[]
        sampleText?: string
        extractedTariffs?: { concept: string; price: number; type: string }[]
    } | null>(null)
    const [uploadError, setUploadError] = useState('')



    const handlingCompanies = ['Swissport', 'Iberia Handling', 'WFS', 'Menzies', 'Groundforce', 'Otro']

    useEffect(() => {
        fetchTariffs()
    }, [])

    const fetchTariffs = async () => {
        try {
            const response = await fetch('/api/tariffs')
            const data = await response.json()
            if (Array.isArray(data)) {
                setTariffs(data)
            }
        } catch (error) {
            console.error('Error fetching tariffs:', error)
        }
    }

    const handleExportCSV = async () => {
        try {
            const response = await fetch('/api/records')
            const records = await response.json()

            const csv = [
                ['AWB', 'Consignatario', 'Peso', 'Año', 'Status', 'Aeropuerto', 'Fecha'].join(','),
                ...records.map((r: any) => [
                    r.awb,
                    r.recipient,
                    r.weight,
                    r.year,
                    r.data?.status || '',
                    r.data?.airport || '',
                    new Date(r.created_at).toLocaleDateString()
                ].join(','))
            ].join('\n')

            const blob = new Blob([csv], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `customs-way-export-${new Date().toISOString().split('T')[0]}.csv`
            a.click()
        } catch (error) {
            console.error('Error exporting:', error)
        }
    }

    const handleBackup = async () => {
        try {
            const [records, users, tariffsData] = await Promise.all([
                fetch('/api/records').then(r => r.json()),
                fetch('/api/users').then(r => r.json()),
                fetch('/api/tariffs').then(r => r.json())
            ])

            const backup = {
                date: new Date().toISOString(),
                records,
                users: users.map((u: any) => ({ ...u, password_hash: undefined })),
                tariffs: tariffsData,
                stats: {
                    totalRecords: records.length,
                    totalUsers: users.length,
                    totalTariffs: tariffsData.length
                }
            }

            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `customs-way-backup-${new Date().toISOString().split('T')[0]}.json`
            a.click()
        } catch (error) {
            console.error('Error creating backup:', error)
        }
    }

    const handleUploadPdf = async () => {
        if (!uploadPdf || !uploadCompany) {
            setUploadError('Selecciona un archivo PDF y una compañía')
            return
        }

        setUploadProgress('uploading')
        setUploadError('')
        setOcrResult(null)

        try {
            // Step 1: Upload PDF to Supabase Storage (optional, for archival)
            const formData = new FormData()
            formData.append('file', uploadPdf)
            formData.append('company', uploadCompany)
            formData.append('year', uploadYear)

            // Upload in background (don't wait for it)
            fetch('/api/tariffs/upload', {
                method: 'POST',
                body: formData
            }).catch(e => console.log('Upload to storage skipped:', e.message))

            setUploadProgress('processing')

            // Step 2: Parse PDF on CLIENT SIDE (avoid DOMMatrix server error)
            const pdfjs = await import('pdfjs-dist')
            pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs'

            const arrayBuffer = await uploadPdf.arrayBuffer()
            const pdf = await pdfjs.getDocument({
                data: arrayBuffer,
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

            console.log('=== PDF TEXT EXTRACTED ===')
            console.log('Pages:', pdf.numPages)
            console.log('Text length:', fullText.length)
            console.log('Sample:', fullText.substring(0, 1000))

            // Step 3: Extract ALL tariffs using comprehensive parsing
            const extractedTariffs = parseTariffsFromText(fullText, parseInt(uploadYear), uploadCompany)

            // Find config items
            const freeDaysConfig = extractedTariffs.find(t => t.concept === 'CONFIG_FREE_DAYS')
            const chargeModeConfig = extractedTariffs.find(t => t.concept === 'CONFIG_CHARGE_MODE')

            // Convert to display format
            const displayTariffs = extractedTariffs
                .filter(t => !t.concept.startsWith('CONFIG_'))
                .map(t => ({
                    concept: t.concept,
                    price: t.price_per_unit,
                    type: t.price_type
                }))

            setOcrResult({
                free_storage_days: freeDaysConfig?.price_per_unit || null,
                storage_charge_mode: chargeModeConfig?.price_per_unit === 0 ? 'after_free' :
                    chargeModeConfig?.price_per_unit === 1 ? 'all_days' : null,
                confidence: extractedTariffs.length > 5 ? 'high' : extractedTariffs.length > 2 ? 'medium' : 'low',
                matches: extractedTariffs.map(t => `${t.concept}: ${t.price_per_unit}€`),
                sampleText: fullText.substring(0, 500),
                extractedTariffs: displayTariffs
            })
            setUploadProgress('done')

            setImportStatus({
                type: 'success',
                message: `OCR completado: ${extractedTariffs.length} tarifas extraídas del PDF`
            })

        } catch (error: any) {
            console.error('Upload/OCR error:', error)
            setUploadError(error.message)
            setUploadProgress('idle')
        }
    }

    const handleSaveOcrTariffs = async () => {
        if (!ocrResult || !uploadCompany) return

        setUploadProgress('uploading') // reusing state for loading
        setUploadError('')

        try {
            // 1. First, get and delete existing tariffs for this company and year to avoid duplicates
            const existingRes = await fetch(`/api/tariffs?company=${uploadCompany}&year=${uploadYear}`)
            const existingTariffs = await existingRes.json()

            if (Array.isArray(existingTariffs)) {
                for (const t of existingTariffs) {
                    await fetch(`/api/tariffs/${t.id}`, { method: 'DELETE' })
                }
            }

            // 2. Prepare all tariffs to save (including config)
            const tariffsToSave = []

            // Config items
            if (ocrResult.free_storage_days !== null) {
                tariffsToSave.push({
                    concept: 'CONFIG_FREE_DAYS',
                    price_type: 'config',
                    price_per_unit: ocrResult.free_storage_days
                })
            }
            if (ocrResult.storage_charge_mode) {
                tariffsToSave.push({
                    concept: 'CONFIG_CHARGE_MODE',
                    price_type: 'config',
                    price_per_unit: ocrResult.storage_charge_mode === 'after_free' ? 0 : 1
                })
            }

            // Extracted items
            if (ocrResult.extractedTariffs) {
                for (const et of ocrResult.extractedTariffs) {
                    tariffsToSave.push({
                        concept: et.concept,
                        price_type: et.type,
                        price_per_unit: et.price
                    })
                }
            }

            // 3. Save all new tariffs
            let successCount = 0
            for (const t of tariffsToSave) {
                const res = await fetch('/api/tariffs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...t,
                        handling_company: uploadCompany,
                        year: parseInt(uploadYear)
                    })
                })
                if (res.ok) successCount++
            }

            setImportStatus({
                type: 'success',
                message: `Se han guardado ${successCount} tarifas para ${uploadCompany} (${uploadYear})`
            })
            setOcrResult(null)
            fetchTariffs()

        } catch (error: any) {
            console.error('Save OCR error:', error)
            setUploadError('Error al guardar tarifas: ' + error.message)
        } finally {
            setUploadProgress('idle')
        }
    }

    // Client-side function to parse free storage days from text
    const parseFreeDaysFromText = (text: string, company: string) => {
        const normalizedText = text.toLowerCase()
        const matches: string[] = []

        // Common patterns for free storage days
        const patterns = [
            /(\d+)\s*d[íi]as?\s*(libres?|gratis|gratuitos?|franquicia|sin\s*cargo)/gi,
            /franquicia\s*(?:de\s*)?(\d+)\s*d[íi]as?/gi,
            /primeros?\s*(\d+)\s*d[íi]as?\s*(sin\s*cargo|gratis|gratuitos?)/gi,
            /(\d+)\s*free\s*days?/gi,
            /almacenaje\s*(gratuito|libre|sin\s*cargo)\s*(?:durante\s*)?(\d+)\s*d[íi]as?/gi,
            /d[íi]as?\s*(?:de\s*)?(carencia|cortesía|gracia)[:\s]*(\d+)/gi,
            /periodo\s*(?:de\s*)?(?:almacenaje\s*)?gratuito[:\s]*(\d+)/gi,
        ]

        let foundDays: number | null = null

        for (const pattern of patterns) {
            const regex = new RegExp(pattern.source, pattern.flags)
            let match
            while ((match = regex.exec(text)) !== null) {
                matches.push(match[0])
                const num = parseInt(match[1]) || parseInt(match[2])
                if (num && num >= 1 && num <= 10) {
                    foundDays = num
                }
            }
        }

        // Determine charge mode
        let chargeMode: 'after_free' | 'all_days' | null = null

        if (normalizedText.includes('a partir del día') ||
            normalizedText.includes('desde el día') ||
            normalizedText.includes('transcurrido')) {
            chargeMode = 'after_free'
        } else if (normalizedText.includes('totalidad de los días') ||
            normalizedText.includes('todos los días') ||
            normalizedText.includes('desde el primer día')) {
            chargeMode = 'all_days'
        }

        // Default based on company
        const companyLower = company.toLowerCase()
        if (companyLower.includes('swissport')) {
            chargeMode = chargeMode || 'after_free'
            if (!foundDays) foundDays = 3
        } else if (companyLower.includes('groundforce')) {
            chargeMode = chargeMode || 'all_days'
            if (!foundDays) foundDays = 2
        }

        return {
            free_storage_days: foundDays,
            storage_charge_mode: chargeMode,
            confidence: matches.length > 0 ? 'high' : (foundDays ? 'medium' : 'low'),
            matches
        }
    }

    const handleImportPDF = async () => {
        if (!importCompany) {
            setImportStatus({ type: 'error', message: 'Selecciona una compañía handling' })
            return
        }
        if (!selectedFile) {
            setImportStatus({ type: 'error', message: 'Selecciona un archivo PDF' })
            return
        }

        setLoading(true)
        setImportStatus(null)

        try {
            // Parse PDF on client side using pdfjs-dist
            const pdfjs = await import('pdfjs-dist')

            // Set worker source - use matching version from unpkg
            pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs'

            // Read file as ArrayBuffer
            const arrayBuffer = await selectedFile.arrayBuffer()

            // Load PDF document with disabled worker fallback
            const pdf = await pdfjs.getDocument({
                data: arrayBuffer,
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

            console.log('Extracted PDF text:', fullText.substring(0, 500))

            // Parse tariffs from the extracted text
            const extractedTariffs = parseTariffsFromText(fullText, parseInt(importYear), importCompany)

            if (extractedTariffs.length === 0) {
                setImportStatus({
                    type: 'error',
                    message: 'No se encontraron tarifas en el PDF. Revisa el formato o añádelas manualmente.'
                })
                setLoading(false)
                return
            }

            // Send extracted tariffs to server
            let successCount = 0
            for (const tariff of extractedTariffs) {
                try {
                    const response = await fetch('/api/tariffs', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(tariff)
                    })
                    if (response.ok) successCount++
                } catch (e) {
                    console.error('Error saving tariff:', e)
                }
            }

            setImportStatus({
                type: 'success',
                message: `Se importaron ${successCount} de ${extractedTariffs.length} tarifas correctamente`
            })
            fetchTariffs()
            setSelectedFile(null)

        } catch (error: any) {
            console.error('PDF parsing error:', error)
            setImportStatus({ type: 'error', message: 'Error al leer el PDF: ' + error.message })
        } finally {
            setLoading(false)
        }
    }

    // Function to parse tariffs from PDF - REAL OCR extraction
    const parseTariffsFromText = (text: string, year: number, handlingCompany: string) => {
        const tariffs: any[] = []
        const addedConcepts = new Set<string>()

        // Normalize text for better parsing
        const normalizedText = text.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ')

        console.log('=== OCR EXTRACTION START ===')
        console.log('Text length:', text.length)
        console.log('Sample:', text.substring(0, 800))

        const addTariff = (concept: string, priceType: string, price: number, minPrice?: number) => {
            const key = concept.toLowerCase()
            if (addedConcepts.has(key) || price <= 0 || price > 10000) return false
            tariffs.push({
                handling_company: handlingCompany, year,
                concept, price_type: priceType, price_per_unit: price,
                min_price: minPrice || null,
                weight_range_min: null, weight_range_max: null
            })
            addedConcepts.add(key)
            console.log(`✓ Extracted: ${concept} = ${price}€ (${priceType})`)
            return true
        }

        // === PATTERN DEFINITIONS FOR COMMON TARIFF CONCEPTS ===
        // Each pattern tries to match concept name followed by a price

        const tariffPatterns = [
            // GESTIÓN DOCUMENTAL / DOCUMENTOS
            {
                concept: 'Documentos (Gestión Documental)',
                patterns: [
                    /(?:gesti[oó]n\s*documental|documentaci[oó]n|documentos)[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                    /documentos[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                ],
                type: 'fixed'
            },
            // ALMACENAJE - buscar múltiples precios
            {
                concept: 'Almacenaje - Mínimo',
                patterns: [
                    /almacenaje[^\d]*?m[íi]nimo[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                    /m[íi]nimo[^\d]*?almacen[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                ],
                type: 'fixed'
            },
            {
                concept: 'Almacenaje - Por Día/100Kg',
                patterns: [
                    /almacenaje[^\d]*?(\d{1,2}[.,]\d{2})[^\d]*?(?:por\s*)?(?:100\s*)?kg/gi,
                    /(?:por\s*)?100\s*kg[^\d]*?d[íi]a[^\d]*?(\d{1,2}[.,]\d{2})/gi,
                    /almacenaje[^\d]*?1[ºª°]?\s*(?:tramo|periodo)[^\d]*?(\d{1,2}[.,]\d{2})/gi,
                ],
                type: 'per_kg'
            },
            // ACCESO RECINTO
            {
                concept: 'Acceso Recinto - Mínimo',
                patterns: [
                    /acceso[^\d]*?recinto[^\d]*?m[íi]nimo[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                    /entrada[^\d]*?recinto[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                ],
                type: 'fixed'
            },
            {
                concept: 'Acceso Recinto - Por Kg',
                patterns: [
                    /acceso[^\d]*?recinto[^\d]*?(\d[.,]\d{2,4})[^\d]*?kg/gi,
                ],
                type: 'per_kg'
            },
            // ENTREGA MISMO DÍA
            {
                concept: 'Entrega Mismo Día',
                patterns: [
                    /entrega[^\d]*?mismo\s*d[íi]a[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                    /same\s*day[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                ],
                type: 'fixed'
            },
            // HANDLING EXPRESS
            {
                concept: 'Handling Express - Mínimo',
                patterns: [
                    /(?:handling|manipulaci[oó]n)[^\d]*?express[^\d]*?m[íi]nimo[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                    /express[^\d]*?m[íi]nimo[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                ],
                type: 'fixed'
            },
            {
                concept: 'Handling Express - Por Kg',
                patterns: [
                    /(?:handling|manipulaci[oó]n)[^\d]*?express[^\d]*?(\d[.,]\d{2,4})[^\d]*?kg/gi,
                ],
                type: 'per_kg'
            },
            // APERTURA FUERA DE HORARIO
            {
                concept: 'Apertura Fuera de Horario',
                patterns: [
                    /(?:apertura|horario)[^\d]*?(?:fuera|extraordin)[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                    /fuera[^\d]*?horario[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                    /(?:after\s*hours|opening)[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                ],
                type: 'fixed'
            },
            // FIN DE SEMANA / FESTIVO
            {
                concept: 'Fin de Semana/Festivo',
                patterns: [
                    /(?:fin\s*(?:de\s*)?semana|festivo|weekend)[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                    /s[áa]bado[^\d]*?domingo[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                ],
                type: 'fixed'
            },
            // CARGA CAMIÓN
            {
                concept: 'Carga Camión - Mínimo',
                patterns: [
                    /carga[^\d]*?cami[oó]n[^\d]*?m[íi]nimo[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                    /truck[^\d]*?loading[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                ],
                type: 'fixed'
            },
            {
                concept: 'Carga Camión - Por Kg',
                patterns: [
                    /carga[^\d]*?cami[oó]n[^\d]*?(\d[.,]\d{2,4})[^\d]*?kg/gi,
                ],
                type: 'per_kg'
            },
            // TASA ENERGÍA / MANTENIMIENTO
            {
                concept: 'Tasa Energía/Mantenimiento',
                patterns: [
                    /(?:tasa|cargo)[^\d]*?(?:energ[íi]a|mantenimiento|infraestructura)[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                    /mantenimiento[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                    /infrastructure[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                ],
                type: 'fixed'
            },
            // SEGURIDAD
            {
                concept: 'Seguridad',
                patterns: [
                    /(?:tasa\s*)?seguridad[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                    /security[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                ],
                type: 'fixed'
            },
            // EXTRACARGO (Groundforce specific)
            {
                concept: 'Extracargo',
                patterns: [
                    /extracargo[^\d]*?(\d{1,3}[.,]\d{2})/gi,
                ],
                type: 'fixed'
            },
        ]

        // Try each pattern
        for (const { concept, patterns, type } of tariffPatterns) {
            for (const pattern of patterns) {
                const regex = new RegExp(pattern.source, pattern.flags)
                const matches = [...normalizedText.matchAll(regex)]
                if (matches.length > 0) {
                    // Take the first valid price found
                    for (const match of matches) {
                        const priceStr = match[1]?.replace(',', '.')
                        const price = parseFloat(priceStr)
                        if (addTariff(concept, type, price)) {
                            break // Found valid price, move to next concept
                        }
                    }
                }
            }
        }

        // === GENERIC PRICE EXTRACTION ===
        // Find any remaining prices with context
        const genericPricePattern = /([a-záéíóúñ\s]+)[:\s]+(\d{1,3}[.,]\d{2})\s*€/gi
        const genericMatches = [...normalizedText.matchAll(genericPricePattern)]
        for (const match of genericMatches) {
            const conceptName = match[1].trim()
            const price = parseFloat(match[2].replace(',', '.'))
            if (conceptName.length > 3 && conceptName.length < 50 && !addedConcepts.has(conceptName.toLowerCase())) {
                addTariff(conceptName, 'fixed', price)
            }
        }

        // === DETECT FREE STORAGE DAYS ===
        const freeDaysPatterns = [
            /(\d+)\s*d[íi]as?\s*(?:libres?|gratis|gratuitos?|franquicia)/gi,
            /franquicia\s*(?:de\s*)?(\d+)\s*d[íi]as?/gi,
            /(\d+)\s*free\s*days?/gi,
        ]

        for (const pattern of freeDaysPatterns) {
            const match = pattern.exec(normalizedText)
            if (match) {
                const days = parseInt(match[1])
                if (days >= 1 && days <= 10) {
                    addTariff('CONFIG_FREE_DAYS', 'config', days)
                    console.log(`✓ Free days detected: ${days}`)
                    break
                }
            }
        }

        // Add charge mode based on company if not detected
        if (handlingCompany.toLowerCase().includes('swissport')) {
            if (!addedConcepts.has('config_charge_mode')) {
                addTariff('CONFIG_CHARGE_MODE', 'config', 0) // 0 = after_free
            }
            // Default free days if not found
            if (!addedConcepts.has('config_free_days')) {
                addTariff('CONFIG_FREE_DAYS', 'config', 3)
            }
        } else if (handlingCompany.toLowerCase().includes('groundforce')) {
            if (!addedConcepts.has('config_charge_mode')) {
                addTariff('CONFIG_CHARGE_MODE', 'config', 1) // 1 = all_days
            }
            if (!addedConcepts.has('config_free_days')) {
                addTariff('CONFIG_FREE_DAYS', 'config', 2)
            }
        }

        console.log(`=== OCR EXTRACTION END: ${tariffs.length} tariffs found ===`)
        return tariffs
    }

    const handleAddManualTariff = async () => {
        if (!importCompany || !manualTariff.concept || !manualTariff.price_per_unit) {
            setImportStatus({ type: 'error', message: 'Completa todos los campos requeridos' })
            return
        }

        setLoading(true)
        try {
            const response = await fetch('/api/tariffs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    handling_company: importCompany,
                    year: parseInt(importYear),
                    concept: manualTariff.concept,
                    price_type: manualTariff.price_type,
                    price_per_unit: parseFloat(manualTariff.price_per_unit),
                    min_price: manualTariff.min_price ? parseFloat(manualTariff.min_price) : null,
                    weight_range_min: manualTariff.weight_range_min ? parseFloat(manualTariff.weight_range_min) : null,
                    weight_range_max: manualTariff.weight_range_max ? parseFloat(manualTariff.weight_range_max) : null
                })
            })

            if (response.ok) {
                setImportStatus({ type: 'success', message: 'Tarifa añadida correctamente' })
                fetchTariffs()
                setManualTariff({
                    concept: '',
                    price_type: 'fixed',
                    price_per_unit: '',
                    min_price: '',
                    weight_range_min: '',
                    weight_range_max: ''
                })
                setShowManualForm(false)
            } else {
                const data = await response.json()
                setImportStatus({ type: 'error', message: data.error })
            }
        } catch (error: any) {
            setImportStatus({ type: 'error', message: error.message })
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteTariff = async (id: string) => {
        try {
            const response = await fetch(`/api/tariffs/${id}`, { method: 'DELETE' })
            if (response.ok) {
                fetchTariffs()
                setSelectedTariffs(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(id)
                    return newSet
                })
            }
        } catch (error) {
            console.error('Error deleting tariff:', error)
        }
    }

    const handleDeleteSelected = async () => {
        if (selectedTariffs.size === 0) return

        setLoading(true)
        try {
            for (const id of selectedTariffs) {
                await fetch(`/api/tariffs/${id}`, { method: 'DELETE' })
            }
            setSelectedTariffs(new Set())
            fetchTariffs()
            setImportStatus({ type: 'success', message: `${selectedTariffs.size} tarifas eliminadas` })
        } catch (error) {
            console.error('Error deleting tariffs:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteGroupTariffs = async (groupItems: Tariff[]) => {
        setLoading(true)
        try {
            for (const tariff of groupItems) {
                await fetch(`/api/tariffs/${tariff.id}`, { method: 'DELETE' })
            }
            setSelectedTariffs(new Set())
            fetchTariffs()
            setImportStatus({ type: 'success', message: `${groupItems.length} tarifas eliminadas` })
        } catch (error) {
            console.error('Error deleting tariffs:', error)
        } finally {
            setLoading(false)
        }
    }

    const toggleSelectTariff = (id: string) => {
        setSelectedTariffs(prev => {
            const newSet = new Set(prev)
            if (newSet.has(id)) {
                newSet.delete(id)
            } else {
                newSet.add(id)
            }
            return newSet
        })
    }

    const toggleSelectAll = (groupItems: Tariff[]) => {
        const allSelected = groupItems.every(t => selectedTariffs.has(t.id))
        setSelectedTariffs(prev => {
            const newSet = new Set(prev)
            if (allSelected) {
                groupItems.forEach(t => newSet.delete(t.id))
            } else {
                groupItems.forEach(t => newSet.add(t.id))
            }
            return newSet
        })
    }

    const groupedTariffs = tariffs.reduce((acc, tariff) => {
        const key = `${tariff.handling_company}-${tariff.year}`
        if (!acc[key]) {
            acc[key] = { company: tariff.handling_company, year: tariff.year, items: [] }
        }
        acc[key].items.push(tariff)
        return acc
    }, {} as Record<string, { company: string; year: number; items: Tariff[] }>)

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Gestión de Datos</h1>

            {/* Export & Backup Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="card p-6">
                    <h2 className="text-xl font-bold mb-4 text-gray-800">Exportar CSV</h2>
                    <p className="text-gray-600 mb-4">Descarga todos los registros en formato CSV compatible con Excel</p>
                    <button onClick={handleExportCSV} className="btn-primary flex items-center gap-2">
                        <Download className="w-5 h-5" />
                        Exportar CSV
                    </button>
                </div>

                <div className="card p-6">
                    <h2 className="text-xl font-bold mb-4 text-gray-800">Backup Completo</h2>
                    <p className="text-gray-600 mb-4">Descarga un backup completo de la aplicación en formato JSON</p>
                    <button onClick={handleBackup} className="btn-primary flex items-center gap-2">
                        <Download className="w-5 h-5" />
                        Descargar Backup
                    </button>
                </div>
            </div>

            {/* PDF Upload & OCR Section */}
            <div className="card p-6 mb-8">
                <h2 className="text-xl font-bold mb-4 text-gray-800">📄 Subir PDF de Tarifas</h2>
                <p className="text-gray-600 mb-4">
                    Sube los PDFs de tarifas de Swissport o Groundforce para extraer automáticamente los días de almacenaje gratis mediante OCR.
                </p>

                {uploadError && (
                    <div className="mb-4 p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
                        {uploadError}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Compañía *</label>
                        <select
                            value={uploadCompany}
                            onChange={(e) => setUploadCompany(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Seleccionar...</option>
                            <option value="Swissport">Swissport</option>
                            <option value="Groundforce">Groundforce</option>
                            <option value="Iberia Handling">Iberia Handling</option>
                            <option value="WFS">WFS</option>
                            <option value="Menzies">Menzies</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Año</label>
                        <select
                            value={uploadYear}
                            onChange={(e) => setUploadYear(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            {[2024, 2025, 2026, 2027].map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Archivo PDF *</label>
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => setUploadPdf(e.target.files?.[0] || null)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <button
                    onClick={handleUploadPdf}
                    disabled={uploadProgress !== 'idle' && uploadProgress !== 'done'}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                    <Upload className="w-5 h-5" />
                    {uploadProgress === 'uploading' ? 'Subiendo...' :
                        uploadProgress === 'processing' ? 'Procesando OCR...' :
                            'Subir y Analizar PDF'}
                </button>

                {/* OCR Results */}
                {ocrResult && (
                    <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                        <h3 className="font-semibold text-gray-800 mb-3">📊 Resultados del OCR</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                <p className="text-sm text-gray-500">Días Libres Detectados</p>
                                <p className="text-3xl font-bold text-blue-600">
                                    {ocrResult.free_storage_days ?? 'No detectado'}
                                </p>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                <p className="text-sm text-gray-500">Modo de Cobro</p>
                                <p className="text-lg font-semibold text-gray-800">
                                    {ocrResult.storage_charge_mode === 'after_free'
                                        ? '📅 Solo días extra'
                                        : ocrResult.storage_charge_mode === 'all_days'
                                            ? '📅 Todos los días'
                                            : 'No detectado'}
                                </p>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                <p className="text-sm text-gray-500">Confianza</p>
                                <p className={`text-lg font-semibold ${ocrResult.confidence === 'high' ? 'text-green-600' :
                                    ocrResult.confidence === 'medium' ? 'text-yellow-600' : 'text-red-600'
                                    }`}>
                                    {ocrResult.confidence === 'high' ? '✅ Alta' :
                                        ocrResult.confidence === 'medium' ? '⚠️ Media' : '❌ Baja'}
                                </p>
                            </div>
                        </div>

                        {/* Extracted Tariffs Table */}
                        {ocrResult.extractedTariffs && ocrResult.extractedTariffs.length > 0 && (
                            <div className="mt-6">
                                <h4 className="font-semibold text-gray-700 mb-2">📋 Conceptos y Precios Extraídos</h4>
                                <div className="bg-white rounded-lg overflow-hidden border border-blue-100 shadow-sm">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-600 font-medium">
                                            <tr>
                                                <th className="px-4 py-2">Concepto</th>
                                                <th className="px-4 py-2">Tipo</th>
                                                <th className="px-4 py-2">Precio</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {ocrResult.extractedTariffs.map((t, i) => (
                                                <tr key={i} className="hover:bg-blue-50/50">
                                                    <td className="px-4 py-2 text-gray-800">{t.concept}</td>
                                                    <td className="px-4 py-2 text-gray-500">
                                                        {t.type === 'fixed' ? 'Fijo' : t.type === 'per_kg' ? 'Por Kg' : t.type}
                                                    </td>
                                                    <td className="px-4 py-2 font-semibold text-blue-700">{t.price}€</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="mt-4 flex gap-3">
                                    <button
                                        onClick={handleSaveOcrTariffs}
                                        disabled={uploadProgress === 'uploading'}
                                        className="btn-primary bg-green-600 hover:bg-green-700 flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        Guardar estas tarifas
                                    </button>
                                    <button
                                        onClick={() => setOcrResult(null)}
                                        className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
                                    >
                                        Descartar
                                    </button>
                                </div>
                            </div>
                        )}

                        {ocrResult.matches.length > 0 && (
                            <div className="mt-4 border-t border-blue-100 pt-4">
                                <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider font-bold">Debug: Coincidencias Texto</p>
                                <div className="flex flex-wrap gap-2">
                                    {ocrResult.matches.slice(0, 10).map((match, i) => (
                                        <span key={i} className="px-2 py-1 bg-blue-50 text-blue-500 rounded text-[10px] font-mono">
                                            {match}
                                        </span>
                                    ))}
                                    {ocrResult.matches.length > 10 && (
                                        <span className="text-[10px] text-gray-400">+{ocrResult.matches.length - 10} más...</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>


            {/* Tariff Import Section */}
            <div className="card p-6 mb-8">
                <h2 className="text-xl font-bold mb-4 text-gray-800">Importar Tarifas</h2>
                <p className="text-gray-600 mb-4">Importa tarifas desde un archivo PDF o añádelas manualmente</p>

                {importStatus && (
                    <div className={`mb-4 p-4 rounded-lg ${importStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {importStatus.message}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Año</label>
                        <select
                            value={importYear}
                            onChange={(e) => setImportYear(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            {[2024, 2025, 2026, 2027].map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Compañía Handling</label>
                        <select
                            value={importCompany}
                            onChange={(e) => setImportCompany(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Seleccionar...</option>
                            {handlingCompanies.map(company => (
                                <option key={company} value={company}>{company}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Archivo PDF</label>
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleImportPDF}
                        disabled={loading || !selectedFile}
                        className="btn-primary flex items-center gap-2 disabled:opacity-50"
                    >
                        <Upload className="w-5 h-5" />
                        {loading ? 'Importando...' : 'Importar PDF'}
                    </button>

                    <button
                        onClick={() => setShowManualForm(!showManualForm)}
                        className="px-6 py-3 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Añadir Manualmente
                    </button>
                </div>

                {/* Manual Tariff Form */}
                {showManualForm && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h3 className="font-semibold mb-4 text-gray-800">Nueva Tarifa Manual</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Concepto *</label>
                                <input
                                    type="text"
                                    value={manualTariff.concept}
                                    onChange={(e) => setManualTariff({ ...manualTariff, concept: e.target.value })}
                                    placeholder="Ej: Almacenaje"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Precio</label>
                                <select
                                    value={manualTariff.price_type}
                                    onChange={(e) => setManualTariff({ ...manualTariff, price_type: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                >
                                    <option value="fixed">Fijo</option>
                                    <option value="per_kg">Por Kg</option>
                                    <option value="per_package">Por Bulto</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Precio/Unidad (€) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={manualTariff.price_per_unit}
                                    onChange={(e) => setManualTariff({ ...manualTariff, price_per_unit: e.target.value })}
                                    placeholder="0.00"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Precio Mínimo (€)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={manualTariff.min_price}
                                    onChange={(e) => setManualTariff({ ...manualTariff, min_price: e.target.value })}
                                    placeholder="Opcional"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Peso Mínimo (Kg)</label>
                                <input
                                    type="number"
                                    value={manualTariff.weight_range_min}
                                    onChange={(e) => setManualTariff({ ...manualTariff, weight_range_min: e.target.value })}
                                    placeholder="Opcional"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Peso Máximo (Kg)</label>
                                <input
                                    type="number"
                                    value={manualTariff.weight_range_max}
                                    onChange={(e) => setManualTariff({ ...manualTariff, weight_range_max: e.target.value })}
                                    placeholder="Opcional"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                        </div>
                        <div className="mt-4 flex gap-3">
                            <button
                                onClick={handleAddManualTariff}
                                disabled={loading}
                                className="btn-primary flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                Guardar Tarifa
                            </button>
                            <button
                                onClick={() => setShowManualForm(false)}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Tariffs List */}
            <div className="card p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-800">Tarifas Registradas</h2>

                {Object.keys(groupedTariffs).length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No hay tarifas registradas</p>
                ) : (
                    <div className="space-y-6">
                        {Object.values(groupedTariffs).map((group) => (
                            <div key={`${group.company}-${group.year}`} className="border border-gray-200 rounded-lg overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                                    <h3 className="font-semibold text-gray-800">
                                        {group.company} - {group.year} ({group.items.length} tarifas)
                                    </h3>
                                    <div className="flex gap-2">
                                        {selectedTariffs.size > 0 && group.items.some(t => selectedTariffs.has(t.id)) && (
                                            <button
                                                onClick={handleDeleteSelected}
                                                disabled={loading}
                                                className="text-sm px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-1"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                                Eliminar seleccionados ({selectedTariffs.size})
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteGroupTariffs(group.items)}
                                            disabled={loading}
                                            className="text-sm px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                                        >
                                            Eliminar todas
                                        </button>
                                    </div>
                                </div>
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-center w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={group.items.every(t => selectedTariffs.has(t.id))}
                                                    onChange={() => toggleSelectAll(group.items)}
                                                    className="w-4 h-4 rounded border-gray-300"
                                                />
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Concepto</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Tipo</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Precio</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Mínimo</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Rango Peso</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {group.items.map((tariff) => (
                                            <tr key={tariff.id} className={`hover:bg-gray-50 ${selectedTariffs.has(tariff.id) ? 'bg-blue-50' : ''}`}>
                                                <td className="px-4 py-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedTariffs.has(tariff.id)}
                                                        onChange={() => toggleSelectTariff(tariff.id)}
                                                        className="w-4 h-4 rounded border-gray-300"
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-900">{tariff.concept}</td>
                                                <td className="px-4 py-2 text-sm text-gray-600">
                                                    {tariff.price_type === 'fixed' ? 'Fijo' :
                                                        tariff.price_type === 'per_kg' ? 'Por Kg' : 'Por Bulto'}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-900 font-medium">
                                                    {tariff.price_per_unit?.toFixed(2)} €
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-600">
                                                    {tariff.min_price ? `${tariff.min_price.toFixed(2)} €` : '-'}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-600">
                                                    {tariff.weight_range_min !== null && tariff.weight_range_max !== null
                                                        ? `${tariff.weight_range_min} - ${tariff.weight_range_max} kg`
                                                        : '-'}
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    <button
                                                        onClick={() => handleDeleteTariff(tariff.id)}
                                                        className="text-red-600 hover:text-red-800 p-1"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div >
    )
}
