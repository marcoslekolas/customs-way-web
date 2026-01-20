import { redirect } from 'next/navigation'

// Force dynamic rendering to ensure redirect works in production
export const dynamic = 'force-dynamic'

export default function HomePage() {
    redirect('/login')
}
