'use client'

import { useState, useEffect } from 'react'
import { X, Package, CheckCircle, Euro, AlertCircle } from 'lucide-react'

interface RecordModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: () => void
    record?: CargoRecord | null
}

interface CargoRecord {
    id?: string
    awb: string
    recipient: string
    weight: number
    year: number
    data?: {
        status?: string
        airport?: string
        handling?: string
        dossier?: string
        vessel_name?: string
        packages?: number
        arrived_at_airport?: boolean
        arrival_date?: string
        pickup_confirmed?: boolean
        pickup_date?: string
        billing_confirmed?: boolean
        billing_date?: string
        extra_truck_loading?: boolean
        extra_express_handling?: boolean
        extra_after_hours?: boolean
        extra_weekend?: boolean
        custom_expense_concept?: string
        custom_expense_amount?: number
    }
}

interface Expense {
    id: string
    concept: string
    amount: number
    is_manual: boolean
}

export default function RecordModal({ isOpen, onClose, onSave, record }: RecordModalProps) {
    const [formData, setFormData] = useState({
        awb: '',
        recipient: '',
        weight: '',
        status: 'T1',
        airport: '',
        airport_other: '',
        handling: '',
        handling_other: '',
        dossier: '',
        vessel_name: '',
        packages: '',
        arrived_at_airport: false,
        arrival_date: '',
        pickup_confirmed: false,
        pickup_date: '',
        billing_confirmed: false,
        billing_date: '',
        extra_truck_loading: false,
        extra_express_handling: false,
        extra_after_hours: false,
        extra_weekend: false,
        custom_expense_concept: '',
        custom_expense_amount: '',
    })

    // Static list of handling companies (same as in datos/page.tsx)
    const handlingCompanyOptions = ['Swissport', 'Iberia Handling', 'WFS', 'Menzies', 'Groundforce']
    const airportOptions = ['MAD', 'BCN', 'VLC', 'AGP', 'BIO', 'SVQ']
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [handlingCompanies, setHandlingCompanies] = useState<string[]>([])
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [expensesTotal, setExpensesTotal] = useState(0)
    const [showExpenses, setShowExpenses] = useState(false)

    useEffect(() => {
        fetchHandlingCompanies()
    }, [])

    useEffect(() => {
        if (record) {
            setFormData({
                awb: record.awb || '',
                recipient: record.recipient || '',
                weight: record.weight?.toString() || '',
                status: record.data?.status || 'T1',
                airport: record.data?.airport || '',
                airport_other: '',
                handling: record.data?.handling || '',
                handling_other: '',
                dossier: record.data?.dossier || '',
                vessel_name: record.data?.vessel_name || '',
                packages: record.data?.packages?.toString() || '',
                arrived_at_airport: record.data?.arrived_at_airport || false,
                arrival_date: record.data?.arrival_date || '',
                pickup_confirmed: record.data?.pickup_confirmed || false,
                pickup_date: record.data?.pickup_date || '',
                billing_confirmed: record.data?.billing_confirmed || false,
                billing_date: record.data?.billing_date || '',
                extra_truck_loading: record.data?.extra_truck_loading || false,
                extra_express_handling: record.data?.extra_express_handling || false,
                extra_after_hours: record.data?.extra_after_hours || false,
                extra_weekend: record.data?.extra_weekend || false,
                custom_expense_concept: record.data?.custom_expense_concept || '',
                custom_expense_amount: record.data?.custom_expense_amount?.toString() || '',
            })
            if (record.id && record.data?.pickup_confirmed) {
                fetchExpenses(record.id)
            }
        } else {
            resetForm()
        }
        setError('')
    }, [record, isOpen])

    const resetForm = () => {
        setFormData({
            awb: '',
            recipient: '',
            weight: '',
            status: 'T1',
            airport: '',
            airport_other: '',
            handling: '',
            handling_other: '',
            dossier: '',
            vessel_name: '',
            packages: '',
            arrived_at_airport: false,
            arrival_date: '',
            pickup_confirmed: false,
            pickup_date: '',
            billing_confirmed: false,
            billing_date: '',
            extra_truck_loading: false,
            extra_express_handling: false,
            extra_after_hours: false,
            extra_weekend: false,
            custom_expense_concept: '',
            custom_expense_amount: '',
        })
        setExpenses([])
        setExpensesTotal(0)
        setShowExpenses(false)
    }

    const fetchHandlingCompanies = async () => {
        try {
            const response = await fetch('/api/tariffs')
            const data = await response.json()
            if (Array.isArray(data)) {
                const companies = [...new Set(data.map((t: any) => t.handling_company))]
                setHandlingCompanies(companies as string[])
            }
        } catch (error) {
            console.error('Error fetching handling companies:', error)
        }
    }

    const fetchExpenses = async (recordId: string) => {
        try {
            const response = await fetch(`/api/records/${recordId}/expenses`)
            const data = await response.json()
            if (Array.isArray(data)) {
                setExpenses(data)
                setExpensesTotal(data.reduce((sum: number, e: Expense) => sum + e.amount, 0))
                setShowExpenses(true)
            }
        } catch (error) {
            console.error('Error fetching expenses:', error)
        }
    }

    const handleConfirmPickup = async () => {
        if (!formData.handling) {
            setError('Selecciona una compañía handling para calcular los gastos')
            return
        }
        if (!formData.pickup_date) {
            setFormData({ ...formData, pickup_date: new Date().toISOString().split('T')[0] })
        }

        setFormData(prev => ({ ...prev, pickup_confirmed: true }))
        setShowExpenses(true)

        // If record exists, calculate expenses
        if (record?.id) {
            await calculateExpenses()
        }
    }

    const calculateExpenses = async () => {
        if (!record?.id) return

        try {
            const response = await fetch(`/api/records/${record.id}/expenses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    handling_company: formData.handling === 'Otro' ? formData.handling_other : formData.handling,
                    weight: parseFloat(formData.weight) || 0,
                    packages: parseInt(formData.packages) || 0,
                    arrival_date: formData.arrival_date || null,
                    pickup_date: formData.pickup_date || new Date().toISOString().split('T')[0],
                    extra_truck_loading: formData.extra_truck_loading,
                    extra_express_handling: formData.extra_express_handling,
                    extra_after_hours: formData.extra_after_hours,
                    extra_weekend: formData.extra_weekend,
                    custom_expense_concept: formData.custom_expense_concept,
                    custom_expense_amount: formData.custom_expense_amount
                })
            })

            const data = await response.json()
            if (response.ok) {
                setExpenses(data.expenses || [])
                setExpensesTotal(data.total || 0)
            }
        } catch (error) {
            console.error('Error calculating expenses:', error)
        }
    }

    const handleConfirmBilling = () => {
        setFormData(prev => ({
            ...prev,
            billing_confirmed: true,
            billing_date: new Date().toISOString().split('T')[0]
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (!formData.awb || !formData.recipient || !formData.weight) {
            setError('Por favor completa los campos obligatorios (AWB, Consignatario, Peso)')
            return
        }

        setLoading(true)

        try {
            const payload = {
                awb: formData.awb,
                recipient: formData.recipient,
                weight: parseFloat(formData.weight),
                year: new Date().getFullYear(),
                data: {
                    status: formData.status,
                    airport: formData.airport === 'Otro' ? formData.airport_other : formData.airport,
                    handling: formData.handling === 'Otro' ? formData.handling_other : formData.handling,
                    dossier: formData.dossier,
                    vessel_name: formData.vessel_name,
                    packages: formData.packages ? parseInt(formData.packages) : null,
                    arrived_at_airport: formData.arrived_at_airport,
                    arrival_date: formData.arrival_date || null,
                    pickup_confirmed: formData.pickup_confirmed,
                    pickup_date: formData.pickup_date || null,
                    billing_confirmed: formData.billing_confirmed,
                    billing_date: formData.billing_date || null,
                    extra_truck_loading: formData.extra_truck_loading,
                    extra_express_handling: formData.extra_express_handling,
                    extra_after_hours: formData.extra_after_hours,
                    extra_weekend: formData.extra_weekend,
                    custom_expense_concept: formData.custom_expense_concept || null,
                    custom_expense_amount: formData.custom_expense_amount ? parseFloat(formData.custom_expense_amount) : null,
                }
            }

            const url = record?.id ? `/api/records/${record.id}` : '/api/records'
            const method = record?.id ? 'PUT' : 'POST'

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Error al guardar el registro')
            }

            // If pickup was just confirmed, calculate expenses
            if (formData.pickup_confirmed && record?.id) {
                await calculateExpenses()
            }

            onSave()
            onClose()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="card max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-700 p-6 -m-6 mb-6 rounded-t-xl z-10">
                    <div className="flex items-center justify-between px-4">
                        <h2 className="text-2xl font-bold text-white ml-4">
                            {record ? 'Editar Registro' : 'Nuevo Registro'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="w-6 h-6 text-white" />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            {error}
                        </div>
                    )}

                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                AWB <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.awb}
                                onChange={(e) => setFormData({ ...formData, awb: e.target.value })}
                                placeholder="123-45678901"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Consignatario <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.recipient}
                                onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                                placeholder="Nombre de la empresa"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Nombre del Buque
                            </label>
                            <input
                                type="text"
                                value={formData.vessel_name}
                                onChange={(e) => setFormData({ ...formData, vessel_name: e.target.value })}
                                placeholder="Nombre del buque/vuelo"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Peso (Kg) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.weight}
                                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                                placeholder="100.50"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Nº Bultos
                            </label>
                            <input
                                type="number"
                                value={formData.packages}
                                onChange={(e) => setFormData({ ...formData, packages: e.target.value })}
                                placeholder="1"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Status
                            </label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="T1">T1</option>
                                <option value="C">C</option>
                                <option value="X">X</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Aeropuerto
                            </label>
                            <select
                                value={formData.airport}
                                onChange={(e) => setFormData({ ...formData, airport: e.target.value, airport_other: e.target.value === 'Otro' ? formData.airport_other : '' })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Seleccionar...</option>
                                {airportOptions.map(airport => (
                                    <option key={airport} value={airport}>{airport}</option>
                                ))}
                                <option value="Otro">Otro</option>
                            </select>
                            {formData.airport === 'Otro' && (
                                <input
                                    type="text"
                                    value={formData.airport_other}
                                    onChange={(e) => setFormData({ ...formData, airport_other: e.target.value })}
                                    placeholder="Especificar aeropuerto..."
                                    className="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Compañía Handling
                            </label>
                            <select
                                value={formData.handling}
                                onChange={(e) => setFormData({ ...formData, handling: e.target.value, handling_other: e.target.value === 'Otro' ? formData.handling_other : '' })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Seleccionar...</option>
                                {handlingCompanyOptions.map(company => (
                                    <option key={company} value={company}>{company}</option>
                                ))}
                                <option value="Otro">Otro</option>
                            </select>
                            {formData.handling === 'Otro' && (
                                <input
                                    type="text"
                                    value={formData.handling_other}
                                    onChange={(e) => setFormData({ ...formData, handling_other: e.target.value })}
                                    placeholder="Especificar compañía..."
                                    className="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Nº Expediente
                            </label>
                            <input
                                type="text"
                                value={formData.dossier}
                                onChange={(e) => setFormData({ ...formData, dossier: e.target.value })}
                                placeholder="Número de expediente"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Status Section */}
                    <div className="border-t border-gray-200 pt-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2 ml-1">
                            <Package className="w-5 h-5" />
                            Estado de la Mercancía
                        </h3>

                        <div className="bg-gray-50 rounded-lg p-4 space-y-4 mt-2">
                            {/* Arrived at airport checkbox */}
                            <div className="flex flex-wrap items-center gap-4">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.arrived_at_airport}
                                        onChange={(e) => {
                                            const checked = e.target.checked
                                            setFormData({
                                                ...formData,
                                                arrived_at_airport: checked,
                                                arrival_date: checked && !formData.arrival_date
                                                    ? new Date().toISOString().split('T')[0]
                                                    : formData.arrival_date
                                            })
                                        }}
                                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        disabled={formData.pickup_confirmed}
                                    />
                                    <span className="text-gray-700 font-medium">
                                        Mercancía en aeropuerto
                                    </span>
                                </label>

                                {/* Arrival Date Input */}
                                {formData.arrived_at_airport && (
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Fecha de llegada</label>
                                        <input
                                            type="date"
                                            value={formData.arrival_date}
                                            onChange={(e) => setFormData({ ...formData, arrival_date: e.target.value })}
                                            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Pickup Section */}
                            <div className="flex flex-wrap items-center gap-4 pt-2">
                                {!formData.pickup_confirmed ? (
                                    <button
                                        type="button"
                                        onClick={handleConfirmPickup}
                                        disabled={!formData.arrived_at_airport}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        Confirmar Recogida
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2 text-green-600 font-medium">
                                        <CheckCircle className="w-5 h-5" />
                                        Recogida confirmada
                                    </div>
                                )}

                                {formData.pickup_confirmed && (
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Fecha de recogida</label>
                                        <input
                                            type="date"
                                            value={formData.pickup_date}
                                            onChange={(e) => setFormData({ ...formData, pickup_date: e.target.value })}
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Expenses Section - Only show if pickup confirmed */}
                    {(showExpenses || formData.pickup_confirmed) && (
                        <div className="border-t border-gray-200 pt-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2 ml-1">
                                <Euro className="w-5 h-5" />
                                Gastos y Tarifas
                            </h3>

                            {/* Extra charges */}
                            <div className="bg-gray-50 rounded-lg p-4 mb-4 mt-2">
                                <h4 className="text-sm font-semibold text-gray-700 mb-3">Gastos Extras</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.extra_truck_loading}
                                            onChange={(e) => setFormData({ ...formData, extra_truck_loading: e.target.checked })}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">Carga camión</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.extra_express_handling}
                                            onChange={(e) => setFormData({ ...formData, extra_express_handling: e.target.checked })}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">Handling express</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.extra_after_hours}
                                            onChange={(e) => setFormData({ ...formData, extra_after_hours: e.target.checked })}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">Apertura fuera horario</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.extra_weekend}
                                            onChange={(e) => setFormData({ ...formData, extra_weekend: e.target.checked })}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">Fin de semana / Festivo</span>
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Concepto personalizado</label>
                                        <input
                                            type="text"
                                            value={formData.custom_expense_concept}
                                            onChange={(e) => setFormData({ ...formData, custom_expense_concept: e.target.value })}
                                            placeholder="Ej: Transporte especial"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Importe (€)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.custom_expense_amount}
                                            onChange={(e) => setFormData({ ...formData, custom_expense_amount: e.target.value })}
                                            placeholder="0.00"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Calculated expenses list */}
                            {expenses.length > 0 && (
                                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Concepto</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Importe</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {expenses.map((expense) => (
                                                <tr key={expense.id}>
                                                    <td className="px-4 py-2 text-sm text-gray-700">
                                                        {expense.concept}
                                                        {expense.is_manual && (
                                                            <span className="ml-2 text-xs text-gray-400">(manual)</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
                                                        {expense.amount.toFixed(2)} €
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-blue-50">
                                            <tr>
                                                <td className="px-4 py-2 text-sm font-bold text-gray-800">TOTAL</td>
                                                <td className="px-4 py-2 text-sm text-right font-bold text-blue-600">
                                                    {expensesTotal.toFixed(2)} €
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            {/* Recalculate button */}
                            {record?.id && (
                                <button
                                    type="button"
                                    onClick={calculateExpenses}
                                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                                >
                                    Recalcular gastos
                                </button>
                            )}
                        </div>
                    )}

                    {/* Billing Section */}
                    {formData.pickup_confirmed && (
                        <div className="border-t border-gray-200 pt-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4 ml-1">Facturación</h3>

                            <div className="flex flex-wrap items-center gap-4">
                                {!formData.billing_confirmed ? (
                                    <button
                                        type="button"
                                        onClick={handleConfirmBilling}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                                    >
                                        <Euro className="w-4 h-4" />
                                        Confirmar Facturación
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2 text-blue-600 font-medium">
                                        <Euro className="w-5 h-5" />
                                        Facturado
                                        {formData.billing_date && (
                                            <span className="text-gray-500 text-sm ml-2">
                                                ({new Date(formData.billing_date).toLocaleDateString()})
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Guardando...' : (record ? 'Actualizar' : 'Crear Registro')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
