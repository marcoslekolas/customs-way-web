import { createSupabaseClient } from '@/lib/supabase/client'
import { NextResponse } from 'next/server'

// GET expenses for a record
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = createSupabaseClient()

        const { data, error } = await supabase
            .from('record_expenses')
            .select('*, tariff:tariffs(*)')
            .eq('record_id', id)
            .order('created_at')

        if (error) throw error
        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST - Calculate and save expenses based on tariffs
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const {
            handling_company,
            weight,
            packages,
            arrival_date,
            pickup_date,
            extra_truck_loading,
            extra_express_handling,
            extra_after_hours,
            extra_weekend,
            custom_expense_concept,
            custom_expense_amount
        } = body

        const supabase = createSupabaseClient()
        const expenses: any[] = []

        // Get the year from pickup date
        const year = new Date(pickup_date).getFullYear()

        // Calculate storage days (difference between pickup and arrival)
        let storageDays = 0
        if (arrival_date && pickup_date) {
            const arrivalMs = new Date(arrival_date).getTime()
            const pickupMs = new Date(pickup_date).getTime()
            storageDays = Math.max(0, Math.floor((pickupMs - arrivalMs) / (1000 * 60 * 60 * 24)))
        }

        // Fetch applicable tariffs for this handling company and year
        const { data: tariffs, error: tariffError } = await supabase
            .from('tariffs')
            .select('*')
            .eq('handling_company', handling_company)
            .eq('year', year)

        if (tariffError) throw tariffError

        // Helper to find tariff by concept name (partial match)
        const findTariff = (searchTerm: string) => {
            return tariffs?.find(t =>
                t.concept.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        // Helper to add expense from tariff
        const addExpense = (tariff: any, conceptLabel?: string) => {
            if (!tariff) return
            let amount = 0

            switch (tariff.price_type) {
                case 'per_kg':
                    // For per_kg tariffs in almacenaje, calculate per 100kg
                    if (tariff.concept.toLowerCase().includes('almacenaje') ||
                        tariff.concept.toLowerCase().includes('tramo')) {
                        amount = (weight / 100) * tariff.price_per_unit
                    } else {
                        amount = weight * tariff.price_per_unit
                    }
                    if (tariff.min_price && amount < tariff.min_price) {
                        amount = tariff.min_price
                    }
                    break
                case 'per_package':
                    amount = (packages || 1) * tariff.price_per_unit
                    break
                case 'fixed':
                default:
                    amount = tariff.price_per_unit
                    break
            }

            if (amount > 0) {
                expenses.push({
                    record_id: id,
                    concept: conceptLabel || tariff.concept,
                    amount: Math.round(amount * 100) / 100,
                    is_manual: false,
                    tariff_id: tariff.id
                })
            }
        }

        // === CONCEPTOS FIJOS (siempre se aplican) ===

        // 1. Documentos / Gestión Documental
        const docTariff = findTariff('documentos') || findTariff('gestión documental')
        addExpense(docTariff, 'Documentos')

        // 2. Almacenaje - Mínimo (siempre se aplica)
        const almacenajeMin = findTariff('almacenaje') && findTariff('mínimo')
            ? tariffs?.find(t => t.concept.toLowerCase().includes('almacenaje') && t.concept.toLowerCase().includes('mínimo'))
            : findTariff('almacenaje')
        addExpense(almacenajeMin, 'Almacenaje')

        // 3. Acceso Recinto
        const accesoMin = tariffs?.find(t =>
            t.concept.toLowerCase().includes('acceso') && t.concept.toLowerCase().includes('mínimo')
        ) || findTariff('acceso recinto')
        addExpense(accesoMin, 'Acceso Recinto')

        // 4. Additional storage days calculation with FREE STORAGE PERIOD logic
        // Get company config from tariffs
        const configFreeDays = tariffs?.find(t => t.concept === 'CONFIG_FREE_DAYS')
        const configChargeMode = tariffs?.find(t => t.concept === 'CONFIG_CHARGE_MODE')

        const freeStorageDays = configFreeDays?.price_per_unit || 0
        const chargeMode = configChargeMode?.price_per_unit === 1 ? 'all_days' : 'after_free'

        // Calculate billable days based on charge mode
        let billableDays = 0
        if (storageDays > freeStorageDays) {
            if (chargeMode === 'all_days') {
                // Groundforce mode: charge ALL days from arrival if free period exceeded
                billableDays = storageDays
            } else {
                // Swissport mode: charge only days AFTER free period
                billableDays = storageDays - freeStorageDays
            }
        }
        // If within free period, billableDays = 0 (no storage charge)

        if (billableDays > 0) {
            const extraStorageTariff = tariffs?.find(t =>
                (t.concept.toLowerCase().includes('almacenaje') || t.concept.toLowerCase().includes('tramo')) &&
                !t.concept.toLowerCase().includes('mínimo') &&
                t.price_type !== 'config'
            )
            if (extraStorageTariff) {
                let extraAmount = 0
                if (extraStorageTariff.price_type === 'per_kg') {
                    extraAmount = (weight / 100) * extraStorageTariff.price_per_unit * billableDays
                } else {
                    extraAmount = extraStorageTariff.price_per_unit * billableDays
                }
                if (extraAmount > 0) {
                    const conceptLabel = chargeMode === 'all_days'
                        ? `Almacenaje (${billableDays} días, período libre excedido)`
                        : `Almacenaje Extra (${billableDays} días después de ${freeStorageDays} días libres)`
                    expenses.push({
                        record_id: id,
                        concept: conceptLabel,
                        amount: Math.round(extraAmount * 100) / 100,
                        is_manual: false,
                        tariff_id: extraStorageTariff.id
                    })
                }
            }
        }

        // 5. Tasa Energía / Mantenimiento
        const tasaEnergia = findTariff('tasa energía') || findTariff('mantenimiento')
        addExpense(tasaEnergia, 'Tasa Energía/Mantenimiento')

        // 5. Extracargo Groundforce (solo si es Groundforce)
        if (handling_company.toLowerCase().includes('groundforce')) {
            const extracargo = findTariff('extracargo')
            addExpense(extracargo, 'Extracargo Groundforce')
        }

        // === CONCEPTOS OPCIONALES (solo si se seleccionan) ===

        // Carga Camión
        if (extra_truck_loading) {
            const cargaTariff = findTariff('carga camión') || findTariff('carga/descarga')
            if (cargaTariff) {
                addExpense(cargaTariff, 'Carga Camión')
            } else {
                expenses.push({
                    record_id: id,
                    concept: 'Carga Camión',
                    amount: 71.91, // Fallback default
                    is_manual: true,
                    tariff_id: null
                })
            }
        }

        // Handling Express
        if (extra_express_handling) {
            const expressTariff = tariffs?.find(t =>
                t.concept.toLowerCase().includes('express') && t.concept.toLowerCase().includes('mínimo')
            ) || findTariff('handling express')
            if (expressTariff) {
                addExpense(expressTariff, 'Handling Express')
            } else {
                expenses.push({
                    record_id: id,
                    concept: 'Handling Express',
                    amount: 74.25, // Fallback default
                    is_manual: true,
                    tariff_id: null
                })
            }
        }

        // Apertura Fuera de Horario
        if (extra_after_hours) {
            const aperturaTariff = findTariff('apertura fuera')
            if (aperturaTariff) {
                addExpense(aperturaTariff, 'Apertura Fuera de Horario')
            } else {
                expenses.push({
                    record_id: id,
                    concept: 'Apertura Fuera de Horario',
                    amount: 100.27, // Fallback default
                    is_manual: true,
                    tariff_id: null
                })
            }
        }

        // Fin de Semana / Festivo
        if (extra_weekend) {
            const weekendTariff = findTariff('fin de semana') || findTariff('festivo')
            if (weekendTariff) {
                addExpense(weekendTariff, 'Fin de Semana/Festivo')
            } else {
                expenses.push({
                    record_id: id,
                    concept: 'Fin de Semana/Festivo',
                    amount: 148.63, // Fallback default
                    is_manual: true,
                    tariff_id: null
                })
            }
        }

        // Add custom expense if provided
        if (custom_expense_concept && custom_expense_amount) {
            expenses.push({
                record_id: id,
                concept: custom_expense_concept,
                amount: parseFloat(custom_expense_amount),
                is_manual: true,
                tariff_id: null
            })
        }

        // Delete existing expenses for this record before inserting new ones
        await supabase
            .from('record_expenses')
            .delete()
            .eq('record_id', id)

        // Insert calculated expenses
        if (expenses.length > 0) {
            const { data, error } = await supabase
                .from('record_expenses')
                .insert(expenses)
                .select()

            if (error) throw error

            const total = expenses.reduce((sum, e) => sum + e.amount, 0)
            return NextResponse.json({
                success: true,
                expenses: data,
                total: Math.round(total * 100) / 100
            })
        }

        return NextResponse.json({
            success: true,
            expenses: [],
            total: 0,
            message: 'No se encontraron tarifas para ' + handling_company + ' en ' + year
        })
    } catch (error: any) {
        console.error('Error calculating expenses:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
