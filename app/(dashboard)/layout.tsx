import { requireAuth } from '@/lib/auth/server'
import DashboardSidebar from './components/DashboardSidebar'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Verify authentication on server side before rendering
    await requireAuth()

    return (
        <div className="min-h-screen flex">
            <DashboardSidebar />

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
