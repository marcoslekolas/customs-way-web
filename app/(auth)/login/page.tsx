import { requireGuest } from '@/lib/auth/server'
import LoginForm from './LoginForm'

export default async function LoginPage() {
    // Redirect to dashboard if already logged in
    await requireGuest()

    return <LoginForm />
}
