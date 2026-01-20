'use client'

import { useEffect, useState, useCallback } from 'react'
import { TrendingUp, Package, FileText, Calendar, Euro, Filter, X, BarChart3, Plane, CheckCircle, Clock, AlertTriangle, Users, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface Stats {
    totalRecords: number
    totalWeight: number
    totalPackages: number
    byStatus: Record<string, number>
    byHandling: Record<string, number>
    byAirport: Record<string, number>
    pickedUp: number
    pending: number
    atAirport: number
    recordIds: string[]
}

interface ExpensesData {
    totalExpenses: number
    expensesByConcept: Record<string, number>
    expensesByHandling: Record<string, number>
    count: number
}

interface TrendData {
    month: string
    monthNum: number
    totalExpenses: number
    totalWeight: number
    recordCount: number
    costPerKg: number
}

interface AlertData {
    alerts: {
        longStays: Array<{
            id: string
            awb: string
            recipient: string
            handling: string
            airport: string
            daysAtAirport: number
            weight: number
        }>
        longStaysCount: number
        threshold: number
    }
    efficiency: {
        avgPickupDays: number
        completedRecordsCount: number
    }
}

interface TopConsignatario {
    name: string
    totalExpenses: number
    totalWeight: number
    recordCount: number
    costPerKg: number
}

interface Filters {
    month: string
    year: string
    status: string
    consignatario: string
    airport: string
    handling: string
}

export default function DashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [expenses, setExpenses] = useState<ExpensesData | null>(null)
    const [trends, setTrends] = useState<TrendData[]>([])
    const [alerts, setAlerts] = useState<AlertData | null>(null)
    const [topConsignatarios, setTopConsignatarios] = useState<TopConsignatario[]>([])
    const [loading, setLoading] = useState(true)
    const [showFilters, setShowFilters] = useState(false)
    const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'alerts'>('overview')
    const [filters, setFilters] = useState<Filters>({
        month: '',
        year: new Date().getFullYear().toString(),
        status: '',
        consignatario: '',
        airport: '',
        handling: ''
    })

    // Static options
    const months = [
        { value: '1', label: 'Enero' },
        { value: '2', label: 'Febrero' },
        { value: '3', label: 'Marzo' },
        { value: '4', label: 'Abril' },
        { value: '5', label: 'Mayo' },
        { value: '6', label: 'Junio' },
        { value: '7', label: 'Julio' },
        { value: '8', label: 'Agosto' },
        { value: '9', label: 'Septiembre' },
        { value: '10', label: 'Octubre' },
        { value: '11', label: 'Noviembre' },
        { value: '12', label: 'Diciembre' }
    ]
    const years = ['2024', '2025', '2026']
    const statusOptions = ['T1', 'C', 'X']
    const handlingOptions = ['Swissport', 'Iberia Handling', 'WFS', 'Menzies', 'Groundforce']
    const airportOptions = ['MAD', 'BCN', 'VLC', 'AGP', 'BIO', 'SVQ']

    const fetchStats = useCallback(async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (filters.month) params.set('month', filters.month)
            if (filters.year) params.set('year', filters.year)
            if (filters.status) params.set('status', filters.status)
            if (filters.consignatario) params.set('consignatario', filters.consignatario)
            if (filters.airport) params.set('airport', filters.airport)
            if (filters.handling) params.set('handling', filters.handling)

            const response = await fetch(`/api/dashboard/stats?${params.toString()}`)
            const data = await response.json()
            setStats(data)

            // Fetch expenses for filtered records
            if (data.recordIds?.length > 0) {
                const expResponse = await fetch(`/api/dashboard/expenses?recordIds=${data.recordIds.join(',')}`)
                const expData = await expResponse.json()
                setExpenses(expData)
            } else {
                setExpenses({ totalExpenses: 0, expensesByConcept: {}, expensesByHandling: {}, count: 0 })
            }

            // Fetch trends
            const trendsResponse = await fetch(`/api/dashboard/trends?year=${filters.year}`)
            const trendsData = await trendsResponse.json()
            setTrends(trendsData.trends || [])

            // Fetch alerts
            const alertsResponse = await fetch(`/api/dashboard/alerts?year=${filters.year}`)
            const alertsData = await alertsResponse.json()
            setAlerts(alertsData)

            // Fetch top consignatarios
            const topResponse = await fetch(`/api/dashboard/top-consignatarios?year=${filters.year}&limit=5`)
            const topData = await topResponse.json()
            setTopConsignatarios(topData.byExpenses || [])

        } catch (error) {
            console.error('Error fetching stats:', error)
        } finally {
            setLoading(false)
        }
    }, [filters])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    const clearFilters = () => {
        setFilters({
            month: '',
            year: new Date().getFullYear().toString(),
            status: '',
            consignatario: '',
            airport: '',
            handling: ''
        })
    }

    const hasActiveFilters = filters.month || filters.status || filters.consignatario || filters.airport || filters.handling

    const getFilterLabel = () => {
        const parts = []
        if (filters.month) {
            const m = months.find(m => m.value === filters.month)
            parts.push(m?.label)
        }
        if (filters.year) parts.push(filters.year)
        if (filters.status) parts.push(`Status: ${filters.status}`)
        if (filters.handling) parts.push(filters.handling)
        if (filters.airport) parts.push(filters.airport)
        if (filters.consignatario) parts.push(`"${filters.consignatario}"`)
        return parts.join(' • ') || 'Todos los registros'
    }

    // Calculate max expense for progress bars
    const maxExpense = expenses ? Math.max(...Object.values(expenses.expensesByConcept), 1) : 1
    const maxTrendExpense = trends.length > 0 ? Math.max(...trends.map(t => t.totalExpenses), 1) : 1

    if (loading && !stats) {
        return <div className="flex items-center justify-center h-screen"><div className="text-xl">Cargando dashboard...</div></div>
    }

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Dashboard Inteligente</h1>
                    <p className="text-gray-500 text-sm mt-1">{getFilterLabel()}</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Tab Buttons */}
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'overview' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            Resumen
                        </button>
                        <button
                            onClick={() => setActiveTab('trends')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'trends' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            Tendencias
                        </button>
                        <button
                            onClick={() => setActiveTab('alerts')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1 ${activeTab === 'alerts' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            Alertas
                            {alerts && alerts.alerts.longStaysCount > 0 && (
                                <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{alerts.alerts.longStaysCount}</span>
                            )}
                        </button>
                    </div>
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
                </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Filter className="w-4 h-4" />
                            Filtros de Análisis
                        </h3>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                            >
                                <X className="w-3 h-3" /> Limpiar filtros
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Mes</label>
                            <select
                                value={filters.month}
                                onChange={(e) => setFilters({ ...filters, month: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Todos</option>
                                {months.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Año</label>
                            <select
                                value={filters.year}
                                onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                {years.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Status</label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Todos</option>
                                {airportOptions.map(a => (
                                    <option key={a} value={a}>{a}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Consignatario</label>
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={filters.consignatario}
                                onChange={(e) => setFilters({ ...filters, consignatario: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
                <>
                    {/* Main Stats Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100 hover:shadow-xl transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                                <div className="bg-cyan-500 p-3 rounded-lg shadow-lg">
                                    <FileText className="w-6 h-6 text-white" />
                                </div>
                                {loading && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>}
                            </div>
                            <p className="text-sm text-gray-500 mb-1">Total Registros</p>
                            <p className="text-3xl font-bold text-gray-900">{stats?.totalRecords || 0}</p>
                        </div>

                        <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100 hover:shadow-xl transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                                <div className="bg-blue-500 p-3 rounded-lg shadow-lg">
                                    <Package className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 mb-1">Peso Total</p>
                            <p className="text-3xl font-bold text-gray-900">{stats?.totalWeight?.toLocaleString() || 0} <span className="text-lg font-normal text-gray-400">Kg</span></p>
                        </div>

                        <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100 hover:shadow-xl transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                                <div className="bg-emerald-500 p-3 rounded-lg shadow-lg">
                                    <Euro className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 mb-1">Gastos Totales</p>
                            <p className="text-3xl font-bold text-gray-900">{expenses?.totalExpenses?.toLocaleString('es-ES', { minimumFractionDigits: 2 }) || '0.00'} <span className="text-lg font-normal text-gray-400">€</span></p>
                        </div>

                        <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100 hover:shadow-xl transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                                <div className="bg-purple-500 p-3 rounded-lg shadow-lg">
                                    <TrendingUp className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 mb-1">Media por Registro</p>
                            <p className="text-3xl font-bold text-gray-900">
                                {stats?.totalRecords && expenses?.totalExpenses
                                    ? (expenses.totalExpenses / stats.totalRecords).toLocaleString('es-ES', { minimumFractionDigits: 2 })
                                    : '0.00'
                                } <span className="text-lg font-normal text-gray-400">€</span>
                            </p>
                        </div>
                    </div>

                    {/* Efficiency Metrics */}
                    {alerts && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-200">
                                <div className="flex items-center gap-3">
                                    <div className="bg-indigo-100 p-2 rounded-lg">
                                        <Clock className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-indigo-700">{alerts.efficiency.avgPickupDays}</p>
                                        <p className="text-xs text-indigo-600">Días promedio recogida</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-4 border border-yellow-200">
                                <div className="flex items-center gap-3">
                                    <div className="bg-yellow-100 p-2 rounded-lg">
                                        <Plane className="w-5 h-5 text-yellow-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-yellow-700">{stats?.atAirport || 0}</p>
                                        <p className="text-xs text-yellow-600">En Aeropuerto</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                                <div className="flex items-center gap-3">
                                    <div className="bg-green-100 p-2 rounded-lg">
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-green-700">{stats?.pickedUp || 0}</p>
                                        <p className="text-xs text-green-600">Recogidos</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-4 border border-gray-200">
                                <div className="flex items-center gap-3">
                                    <div className="bg-gray-100 p-2 rounded-lg">
                                        <Package className="w-5 h-5 text-gray-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-700">{stats?.pending || 0}</p>
                                        <p className="text-xs text-gray-600">Pendientes</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Two Column Layout: Expenses + Top Consignatarios */}
                    <div className="grid lg:grid-cols-2 gap-6">
                        {/* Expenses by Concept */}
                        <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-blue-600" />
                                Gastos por Concepto
                            </h2>
                            {expenses && Object.keys(expenses.expensesByConcept).length > 0 ? (
                                <div className="space-y-3 max-h-80 overflow-y-auto">
                                    {Object.entries(expenses.expensesByConcept).map(([concept, amount]) => (
                                        <div key={concept} className="group">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-sm text-gray-700 truncate max-w-[70%]">{concept}</span>
                                                <span className="text-sm font-semibold text-gray-900">{amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
                                                    style={{ width: `${(amount / maxExpense) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    <Euro className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p>No hay gastos registrados</p>
                                </div>
                            )}
                        </div>

                        {/* Top Consignatarios */}
                        <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <Users className="w-5 h-5 text-purple-600" />
                                Top Consignatarios por Gastos
                            </h2>
                            {topConsignatarios.length > 0 ? (
                                <div className="space-y-3">
                                    {topConsignatarios.map((c, idx) => (
                                        <div key={c.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-gray-100 text-gray-600' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500'}`}>
                                                {idx + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                                                <p className="text-xs text-gray-500">{c.recordCount} envíos • {c.totalWeight.toLocaleString()} kg</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-gray-900">{c.totalExpenses.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</p>
                                                <p className="text-xs text-gray-500">{c.costPerKg.toFixed(2)} €/kg</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p>No hay datos de consignatarios</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Distribution Cards */}
                    <div className="grid md:grid-cols-3 gap-6">
                        {/* By Status */}
                        <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Por Status</h3>
                            <div className="space-y-2">
                                {stats && Object.entries(stats.byStatus).map(([status, count]) => (
                                    <div key={status} className="flex justify-between items-center">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${status === 'T1' ? 'bg-amber-100 text-amber-700' :
                                            status === 'C' ? 'bg-green-100 text-green-700' :
                                                status === 'X' ? 'bg-red-100 text-red-700' :
                                                    'bg-gray-100 text-gray-700'
                                            }`}>{status}</span>
                                        <span className="text-sm font-medium text-gray-900">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* By Airport */}
                        <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Por Aeropuerto</h3>
                            <div className="space-y-2">
                                {stats && Object.entries(stats.byAirport).slice(0, 5).map(([airport, count]) => (
                                    <div key={airport} className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">{airport}</span>
                                        <span className="text-sm font-medium text-gray-900">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* By Handling */}
                        <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Por Handling</h3>
                            <div className="space-y-2">
                                {stats && Object.entries(stats.byHandling).slice(0, 5).map(([handling, count]) => (
                                    <div key={handling} className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600 truncate max-w-[60%]">{handling}</span>
                                        <span className="text-sm font-medium text-gray-900">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* TRENDS TAB */}
            {activeTab === 'trends' && (
                <>
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-blue-600" />
                            Tendencias Mensuales - {filters.year}
                        </h2>

                        {/* Chart Area */}
                        <div className="h-64 flex items-end gap-2 mb-4">
                            {trends.map((t) => (
                                <div key={t.month} className="flex-1 flex flex-col items-center">
                                    <div
                                        className="w-full bg-gradient-to-t from-blue-500 to-cyan-400 rounded-t-lg transition-all duration-500 hover:from-blue-600 hover:to-cyan-500"
                                        style={{ height: `${maxTrendExpense > 0 ? (t.totalExpenses / maxTrendExpense) * 100 : 0}%`, minHeight: t.totalExpenses > 0 ? '8px' : '2px' }}
                                        title={`${t.month}: ${t.totalExpenses.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`}
                                    ></div>
                                </div>
                            ))}
                        </div>

                        {/* Month Labels */}
                        <div className="flex gap-2">
                            {trends.map((t) => (
                                <div key={t.month} className="flex-1 text-center text-xs text-gray-500">{t.month}</div>
                            ))}
                        </div>
                    </div>

                    {/* Monthly Details Table */}
                    <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100 overflow-x-auto">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Detalle por Mes</h3>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th className="text-left py-2 px-3 font-medium text-gray-600">Mes</th>
                                    <th className="text-right py-2 px-3 font-medium text-gray-600">Registros</th>
                                    <th className="text-right py-2 px-3 font-medium text-gray-600">Peso (kg)</th>
                                    <th className="text-right py-2 px-3 font-medium text-gray-600">Gastos (€)</th>
                                    <th className="text-right py-2 px-3 font-medium text-gray-600">€/kg</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trends.filter(t => t.recordCount > 0).map((t) => (
                                    <tr key={t.month} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="py-2 px-3 font-medium text-gray-900">{t.month}</td>
                                        <td className="py-2 px-3 text-right text-gray-700">{t.recordCount}</td>
                                        <td className="py-2 px-3 text-right text-gray-700">{t.totalWeight.toLocaleString()}</td>
                                        <td className="py-2 px-3 text-right font-semibold text-gray-900">{t.totalExpenses.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                                        <td className="py-2 px-3 text-right text-gray-600">{t.costPerKg.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ALERTS TAB */}
            {activeTab === 'alerts' && alerts && (
                <>
                    {/* Alert Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className={`rounded-xl p-5 border ${alerts.alerts.longStaysCount > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-lg ${alerts.alerts.longStaysCount > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                                    <AlertTriangle className={`w-6 h-6 ${alerts.alerts.longStaysCount > 0 ? 'text-red-600' : 'text-green-600'}`} />
                                </div>
                                <div>
                                    <p className={`text-3xl font-bold ${alerts.alerts.longStaysCount > 0 ? 'text-red-700' : 'text-green-700'}`}>
                                        {alerts.alerts.longStaysCount}
                                    </p>
                                    <p className={`text-sm ${alerts.alerts.longStaysCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        Envíos +{alerts.alerts.threshold} días en aeropuerto
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-200">
                            <div className="flex items-center gap-3">
                                <div className="bg-indigo-100 p-3 rounded-lg">
                                    <Clock className="w-6 h-6 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-indigo-700">{alerts.efficiency.avgPickupDays}</p>
                                    <p className="text-sm text-indigo-600">Días promedio recogida</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-100 p-3 rounded-lg">
                                    <CheckCircle className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-blue-700">{alerts.efficiency.completedRecordsCount}</p>
                                    <p className="text-sm text-blue-600">Envíos completados</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Long Stay Alerts List */}
                    {alerts.alerts.longStays.length > 0 && (
                        <div className="bg-white rounded-xl shadow-lg p-5 border border-red-100">
                            <h2 className="text-lg font-semibold text-red-800 mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" />
                                Envíos con Muchos Días en Aeropuerto
                            </h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className="text-left py-2 px-3 font-medium text-gray-600">AWB</th>
                                            <th className="text-left py-2 px-3 font-medium text-gray-600">Consignatario</th>
                                            <th className="text-left py-2 px-3 font-medium text-gray-600">Aeropuerto</th>
                                            <th className="text-left py-2 px-3 font-medium text-gray-600">Handling</th>
                                            <th className="text-right py-2 px-3 font-medium text-gray-600">Peso</th>
                                            <th className="text-right py-2 px-3 font-medium text-gray-600">Días</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {alerts.alerts.longStays.map((item) => (
                                            <tr key={item.id} className="border-b border-gray-100 hover:bg-red-50">
                                                <td className="py-2 px-3 font-medium text-gray-900">{item.awb}</td>
                                                <td className="py-2 px-3 text-gray-700">{item.recipient}</td>
                                                <td className="py-2 px-3">
                                                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">{item.airport}</span>
                                                </td>
                                                <td className="py-2 px-3 text-gray-700">{item.handling}</td>
                                                <td className="py-2 px-3 text-right text-gray-700">{item.weight.toLocaleString()} kg</td>
                                                <td className="py-2 px-3 text-right">
                                                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${item.daysAtAirport >= 7 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                        {item.daysAtAirport} días
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {alerts.alerts.longStays.length === 0 && (
                        <div className="bg-green-50 rounded-xl p-8 border border-green-200 text-center">
                            <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                            <h3 className="text-xl font-semibold text-green-800 mb-2">¡Todo en orden!</h3>
                            <p className="text-green-600">No hay envíos con más de {alerts.alerts.threshold} días en aeropuerto.</p>
                        </div>
                    )}
                </>
            )}

            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl shadow-2xl p-6 text-white">
                <h2 className="text-xl font-bold mb-1">Customs Way Web</h2>
                <p className="text-cyan-100 text-sm">Sistema de gestión aduanera con análisis inteligente de gastos en tiempo real</p>
            </div>
        </div>
    )
}
