'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Home, FileText, Database, Settings, LogOut, Menu, X } from 'lucide-react'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const pathname = usePathname()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [userRole, setUserRole] = useState<string>('admin')

    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => res.ok ? res.json() : Promise.reject())
            .then(data => {
                if (data.role) setUserRole(data.role)
            })
            .catch(() => router.push('/login'))
    }, [])

    const handleLogout = () => {
        document.cookie = 'customs-way-session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
        router.push('/login')
    }

    const navigation = [
        { name: 'Dashboard', href: '/dashboard', icon: Home, adminOnly: false },
        { name: 'Registros', href: '/registros', icon: FileText, adminOnly: false },
        { name: 'Datos', href: '/datos', icon: Database, adminOnly: true },
        { name: 'Configuración', href: '/configuracion', icon: Settings, adminOnly: true },
    ]

    return (
        <div className="min-h-screen flex">
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 bg-gradient-to-r from-blue-900 to-blue-800 shadow-lg z-50 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shadow-lg">
                            <img src="/logo-cw.jpg" alt="CW" className="w-full h-full object-cover" />
                        </div>
                        <h1 className="text-lg font-bold text-white">Customs Way</h1>
                    </div>
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        {sidebarOpen ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
                    </button>
                </div>
            </div>

            {/* Overlay */}
            {sidebarOpen && (
                <div className="md:hidden fixed inset-0 bg-black/30 z-40" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-blue-900 to-blue-800 shadow-2xl transform transition-transform overflow-y-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="p-6 hidden md:block border-b border-blue-700/50">
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative w-32 h-32 rounded-full overflow-hidden flex items-center justify-center shadow-xl ring-4 ring-white/20">
                            <img src="/logo-cw.jpg" alt="CW Logo" className="w-full h-full object-cover" />
                        </div>
                        <div className="text-center">
                            <h1 className="text-xl font-bold text-white">CUSTOMS WAY</h1>
                            <p className="text-xs text-blue-300">Web Edition</p>
                        </div>
                    </div>
                </div>

                <nav className="mt-6 px-3">
                    {navigation.map((item) => {
                        if (item.adminOnly && userRole !== 'admin') return null
                        const Icon = item.icon
                        const isActive = pathname === item.href
                        return (
                            <button
                                key={item.name}
                                onClick={() => { router.push(item.href); setSidebarOpen(false) }}
                                className={`w-full flex items-center gap-3 px-4 py-3 mb-1 rounded-lg transition-all ${isActive ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`}
                            >
                                <Icon className="w-5 h-5" />
                                {item.name}
                            </button>
                        )
                    })}

                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 mt-6 text-red-300 hover:bg-red-500/20 hover:text-red-200 rounded-lg transition-all">
                        <LogOut className="w-5 h-5" />
                        Cerrar Sesión
                    </button>
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 ml-0 md:ml-64 mt-16 md:mt-0 relative bg-gray-50 min-h-screen">
                {/* Watermark Background - CW initials as subtle shadow on white */}
                <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 md:ml-64 overflow-hidden">
                    <img
                        src="/cw-watermark.png"
                        alt=""
                        className="w-full h-full object-contain max-w-none"
                        style={{
                            opacity: 0.7,
                            transform: 'scale(1.3)'
                        }}
                    />
                </div>
                <div className="relative z-10">
                    {children}
                </div>
            </div>
        </div>
    )
}
