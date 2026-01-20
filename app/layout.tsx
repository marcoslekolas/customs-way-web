import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'Customs Way - Sistema de Gestión',
    description: 'Sistema de gestión de registros aduaneros',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="es">
            <body>{children}</body>
        </html>
    )
}
