'use client'

// Force dynamic rendering for auth check
export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react'
import { Plus, Package, CheckCircle, Euro, Plane, ChevronDown, ChevronRight, Edit, Trash2, Filter, X } from 'lucide-react'
import RecordModal from '../components/RecordModal'

interface CargoRecord {
    id: string
    awb: string
    recipient: string
    weight: number
    year: number
    data: {
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
    }
    created_at: string
}

export default function RegistrosPage() {
    const [records, setRecords] = useState<CargoRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedRecord, setSelectedRecord] = useState<CargoRecord | null>(null)
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
    const [rowExpenses, setRowExpenses] = useState<Record<string, { expenses: any[], total: number }>>({})
    const [showFilters, setShowFilters] = useState(false)
    const [filters, setFilters] = useState({
        pickupDateFrom: '',
        pickupDateTo: '',
        consignatario: '',
        buque: '',
        status: '',
        handling: '',
        airport: ''
    })

    // Static options for filters
    const statusOptions = ['T1', 'C', 'X']
    const handlingOptions = ['Swissport', 'Iberia Handling', 'WFS', 'Menzies', 'Groundforce']
    const airportOptions = ['MAD', 'BCN', 'VLC', 'AGP', 'BIO', 'SVQ']

    useEffect(() => {
        fetchRecords()
    }, [])

    const fetchRecords = async () => {
        try {
            const response = await fetch('/api/records')
            const data = await response.json()
            setRecords(data)
        } catch (error) {
            console.error('Error fetching records:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este registro?')) return

        try {
            const response = await fetch(`/api/records/${id}`, {
                method: 'DELETE',
            })
            if (response.ok) fetchRecords()
        } catch (error) {
            console.error('Error deleting record:', error)
        }
    }

    const toggleRowExpanded = async (recordId: string) => {
        const newExpanded = new Set(expandedRows)
        if (newExpanded.has(recordId)) {
            newExpanded.delete(recordId)
        } else {
            newExpanded.add(recordId)
            // Fetch expenses if not already loaded
            if (!rowExpenses[recordId]) {
                await fetchRowExpenses(recordId)
            }
        }
        setExpandedRows(newExpanded)
    }

    const fetchRowExpenses = async (recordId: string) => {
        try {
            const response = await fetch(`/api/records/${recordId}/expenses`)
            const data = await response.json()
            if (Array.isArray(data)) {
                const total = data.reduce((sum: number, e: any) => sum + e.amount, 0)
                setRowExpenses(prev => ({
                    ...prev,
                    [recordId]: { expenses: data, total }
                }))
            }
        } catch (error) {
            console.error('Error fetching expenses:', error)
        }
    }

    // Clear all filters
    const clearFilters = () => {
        setFilters({
            pickupDateFrom: '',
            pickupDateTo: '',
            consignatario: '',
            buque: '',
            status: '',
            handling: '',
            airport: ''
        })
    }

    const hasActiveFilters = Object.values(filters).some(v => v !== '')

    // Filter and sort records
    const filteredRecords = records
        .filter(record => {
            // Text search
            const searchLower = searchTerm.toLowerCase()
            const matchesSearch = !searchTerm || (
                record.awb?.toLowerCase().includes(searchLower) ||
                record.recipient?.toLowerCase().includes(searchLower) ||
                record.data?.vessel_name?.toLowerCase().includes(searchLower) ||
                record.data?.handling?.toLowerCase().includes(searchLower) ||
                record.data?.airport?.toLowerCase().includes(searchLower)
            )

            // Filter by pickup date range
            const pickupDate = record.data?.pickup_date
            const matchesDateFrom = !filters.pickupDateFrom || (pickupDate && pickupDate >= filters.pickupDateFrom)
            const matchesDateTo = !filters.pickupDateTo || (pickupDate && pickupDate <= filters.pickupDateTo)

            // Filter by consignatario
            const matchesConsignatario = !filters.consignatario ||
                record.recipient?.toLowerCase().includes(filters.consignatario.toLowerCase())

            // Filter by buque
            const matchesBuque = !filters.buque ||
                record.data?.vessel_name?.toLowerCase().includes(filters.buque.toLowerCase())

            // Filter by status
            const matchesStatus = !filters.status || record.data?.status === filters.status

            // Filter by handling
            const matchesHandling = !filters.handling || record.data?.handling === filters.handling

            // Filter by airport
            const matchesAirport = !filters.airport || record.data?.airport === filters.airport

            return matchesSearch && matchesDateFrom && matchesDateTo &&
                matchesConsignatario && matchesBuque && matchesStatus &&
                matchesHandling && matchesAirport
        })
        .sort((a, b) => {
            const aPickedUp = a.data?.pickup_confirmed === true
            const bPickedUp = b.data?.pickup_confirmed === true

            // Non-picked-up records come first
            if (!aPickedUp && bPickedUp) return -1
            if (aPickedUp && !bPickedUp) return 1

            // Within non-picked-up: arrived at airport comes after pending
            if (!aPickedUp && !bPickedUp) {
                const aArrived = a.data?.arrived_at_airport === true
                const bArrived = b.data?.arrived_at_airport === true
                if (aArrived && !bArrived) return 1
                if (!aArrived && bArrived) return -1
                // Both same status: sort by creation date descending
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            }

            // Both picked up: sort by pickup_date descending (newest first)
            const aDate = a.data?.pickup_date ? new Date(a.data.pickup_date).getTime() : 0
            const bDate = b.data?.pickup_date ? new Date(b.data.pickup_date).getTime() : 0
            return bDate - aDate
        })

    const getStatusBadge = (status: string) => {
        const classes = {
            'T1': 'badge badge-t1',
            'C': 'badge badge-c',
            'X': 'badge badge-x',
        }
        return classes[status as keyof typeof classes] || 'badge badge-t1'
    }

    const getRecordStateIcons = (record: CargoRecord) => {
        const icons = []

        if (record.data?.arrived_at_airport && !record.data?.pickup_confirmed) {
            icons.push(
                <span key="arrived" title="En aeropuerto" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-100 text-yellow-600">
                    <Plane className="w-4 h-4" />
                </span>
            )
        }

        if (record.data?.pickup_confirmed) {
            icons.push(
                <span key="pickup" title="Recogido" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                </span>
            )
        }

        if (record.data?.billing_confirmed) {
            icons.push(
                <span key="billing" title="Facturado" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-600">
                    <Euro className="w-4 h-4" />
                </span>
            )
        }

        if (icons.length === 0) {
            icons.push(
                <span key="pending" title="Pendiente" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-400">
                    <Package className="w-4 h-4" />
                </span>
            )
        }

        return <div className="flex gap-1">{icons}</div>
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-xl">Cargando...</div>
            </div>
        )
    }

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Registros</h1>

            <div className="mb-6 space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <input
                        type="text"
                        placeholder="Buscar por AWB, Consignatario, Buque, Handling, Aeropuerto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${hasActiveFilters
                            ? 'bg-blue-100 text-blue-700 border-2 border-blue-400'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        <Filter className="w-4 h-4" />
                        Filtros {hasActiveFilters && '•'}
                    </button>
                    <button
                        onClick={() => {
                            setSelectedRecord(null)
                            setIsModalOpen(true)
                        }}
                        className="btn-primary flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Nuevo Registro
                    </button>
                </div>

                {/* Advanced Filters Panel */}
                {showFilters && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-700">Filtros Avanzados</h3>
                            {hasActiveFilters && (
                                <button
                                    onClick={clearFilters}
                                    className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                                >
                                    <X className="w-3 h-3" /> Limpiar filtros
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Fecha recogida desde</label>
                                <input
                                    type="date"
                                    value={filters.pickupDateFrom}
                                    onChange={(e) => setFilters({ ...filters, pickupDateFrom: e.target.value })}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Fecha recogida hasta</label>
                                <input
                                    type="date"
                                    value={filters.pickupDateTo}
                                    onChange={(e) => setFilters({ ...filters, pickupDateTo: e.target.value })}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Consignatario</label>
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    value={filters.consignatario}
                                    onChange={(e) => setFilters({ ...filters, consignatario: e.target.value })}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Buque</label>
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    value={filters.buque}
                                    onChange={(e) => setFilters({ ...filters, buque: e.target.value })}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Status</label>
                                <select
                                    value={filters.status}
                                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="">Todos</option>
                                    {statusOptions.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Handling</label>
                                <select
                                    value={filters.handling}
                                    onChange={(e) => setFilters({ ...filters, handling: e.target.value })}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="">Todos</option>
                                    {handlingOptions.map(h => (
                                        <option key={h} value={h}>{h}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Aeropuerto</label>
                                <select
                                    value={filters.airport}
                                    onChange={(e) => setFilters({ ...filters, airport: e.target.value })}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="">Todos</option>
                                    {airportOptions.map(a => (
                                        <option key={a} value={a}>{a}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gradient-to-r from-blue-50 to-purple-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Estado</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">AWB</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Aeropuerto</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Llegada</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Buque</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Consignatario</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Handling</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Peso (Kg)</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                                        No hay registros
                                    </td>
                                </tr>
                            ) : (
                                filteredRecords.map((record) => {
                                    const isExpanded = expandedRows.has(record.id)
                                    const isPickedUp = record.data?.pickup_confirmed === true
                                    const expenseData = rowExpenses[record.id]

                                    return (
                                        <React.Fragment key={record.id}>
                                            <tr className="hover:bg-blue-50/50 transition-colors">
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {getRecordStateIcons(record)}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="text-sm font-medium text-gray-900">{record.awb}</span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {record.data?.airport ? (
                                                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                                                            {record.data.airport}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                                    {record.data?.arrival_date
                                                        ? new Date(record.data.arrival_date).toLocaleDateString('es-ES')
                                                        : record.created_at
                                                            ? new Date(record.created_at).toLocaleDateString('es-ES')
                                                            : '-'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                                    {record.data?.vessel_name || '-'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                                    {record.recipient}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {record.data?.handling ? (
                                                        <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                                                            {record.data.handling}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                                    {record.weight?.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={getStatusBadge(record.data?.status || 'T1')}>
                                                        {record.data?.status || 'T1'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                                    {isPickedUp ? (
                                                        <button
                                                            onClick={() => toggleRowExpanded(record.id)}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-lg transition-colors"
                                                            title="Ver detalles"
                                                        >
                                                            {isExpanded ? (
                                                                <ChevronDown className="w-5 h-5" />
                                                            ) : (
                                                                <ChevronRight className="w-5 h-5" />
                                                            )}
                                                            <span className="text-xs">Detalles</span>
                                                        </button>
                                                    ) : (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedRecord(record)
                                                                    setIsModalOpen(true)
                                                                }}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                                Editar
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(record.id)}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                                Eliminar
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                            {/* Expanded Details Row */}
                                            {isExpanded && isPickedUp && (
                                                <tr className="bg-gradient-to-r from-blue-50 to-indigo-50">
                                                    <td colSpan={10} className="px-6 py-4">
                                                        <div className="flex flex-wrap gap-6 items-start">
                                                            <div className="flex-1 min-w-[300px]">
                                                                <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                                                    Expedición Recogida
                                                                    {record.data?.pickup_date && (
                                                                        <span className="text-gray-500 font-normal">
                                                                            el {new Date(record.data.pickup_date).toLocaleDateString('es-ES')}
                                                                        </span>
                                                                    )}
                                                                </h4>
                                                                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                                                    <div><span className="text-gray-500">AWB:</span> <span className="font-medium">{record.awb}</span></div>
                                                                    <div><span className="text-gray-500">Consignatario:</span> <span className="font-medium">{record.recipient}</span></div>
                                                                    <div><span className="text-gray-500">Peso:</span> <span className="font-medium">{record.weight?.toLocaleString()} kg</span></div>
                                                                    <div><span className="text-gray-500">Bultos:</span> <span className="font-medium">{record.data?.packages || '-'}</span></div>
                                                                    <div><span className="text-gray-500">Aeropuerto:</span> <span className="font-medium">{record.data?.airport || '-'}</span></div>
                                                                    <div><span className="text-gray-500">Handling:</span> <span className="font-medium">{record.data?.handling || '-'}</span></div>
                                                                </div>
                                                            </div>
                                                            <div className="min-w-[200px]">
                                                                <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                                                    <Euro className="w-4 h-4 text-blue-600" />
                                                                    Gastos
                                                                </h4>
                                                                {expenseData?.expenses.length ? (
                                                                    <div className="space-y-1 text-sm">
                                                                        {expenseData.expenses.slice(0, 4).map((exp: any) => (
                                                                            <div key={exp.id} className="flex justify-between">
                                                                                <span className="text-gray-600 truncate max-w-[120px]">{exp.concept}</span>
                                                                                <span className="font-medium">{exp.amount.toFixed(2)}€</span>
                                                                            </div>
                                                                        ))}
                                                                        {expenseData.expenses.length > 4 && (
                                                                            <div className="text-gray-400 text-xs">+{expenseData.expenses.length - 4} más</div>
                                                                        )}
                                                                        <div className="border-t pt-1 mt-1 flex justify-between font-semibold text-blue-700">
                                                                            <span>Total</span>
                                                                            <span>{expenseData.total.toFixed(2)}€</span>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-sm text-gray-400">Sin gastos registrados</div>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedRecord(record)
                                                                        setIsModalOpen(true)
                                                                    }}
                                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                                                >
                                                                    <Edit className="w-4 h-4" />
                                                                    Modificar
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between text-sm text-gray-600">
                <div>Mostrando {filteredRecords.length} de {records.length} registros</div>
                <div className="flex items-center gap-4 mt-2 md:mt-0">
                    <span className="flex items-center gap-1">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-100 text-yellow-600">
                            <Plane className="w-3 h-3" />
                        </span>
                        En aeropuerto
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600">
                            <CheckCircle className="w-3 h-3" />
                        </span>
                        Recogido
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600">
                            <Euro className="w-3 h-3" />
                        </span>
                        Facturado
                    </span>
                </div>
            </div>

            <RecordModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={fetchRecords}
                record={selectedRecord}
            />
        </div>
    )
}
