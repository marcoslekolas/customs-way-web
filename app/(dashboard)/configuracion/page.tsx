'use client'

import { useEffect, useState } from 'react'
import { Lock, Unlock, Trash2, UserPlus } from 'lucide-react'

interface User {
    id: string
    username: string
    role: string
    is_locked: boolean
    created_at: string
}

export default function ConfiguracionPage() {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' })

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        try {
            const response = await fetch('/api/users')
            const data = await response.json()
            setUsers(data)
        } catch (error) {
            console.error('Error fetching users:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser),
            })
            if (response.ok) {
                setShowCreateModal(false)
                setNewUser({ username: '', password: '', role: 'user' })
                fetchUsers()
            } else {
                const error = await response.json()
                alert('Error: ' + error.error)
            }
        } catch (error) {
            console.error('Error creating user:', error)
        }
    }

    const handleToggleLock = async (user: User) => {
        try {
            const response = await fetch(`/api/users/${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_locked: !user.is_locked }),
            })
            if (response.ok) fetchUsers()
        } catch (error) {
            console.error('Error toggling lock:', error)
        }
    }

    const handleDelete = async (userId: string) => {
        if (!confirm('¿Eliminar este usuario?')) return
        try {
            const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
            if (response.ok) fetchUsers()
        } catch (error) {
            console.error('Error deleting user:', error)
        }
    }

    if (loading) return <div className="p-8">Cargando...</div>

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold gradient-text">Configuración</h1>
                <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    Crear Usuario
                </button>
            </div>

            <div className="card overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-blue-50 to-purple-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Usuario</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Rol</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Estado</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-blue-50/50">
                                <td className="px-4 py-3 font-medium">{user.username}</td>
                                <td className="px-4 py-3">
                                    <span className={`badge ${user.role === 'admin' ? 'badge-c' : 'badge-t1'}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`badge ${user.is_locked ? 'badge-x' : 'badge-c'}`}>
                                        {user.is_locked ? 'Bloqueado' : 'Activo'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right space-x-3">
                                    {user.username !== 'admin' && (
                                        <>
                                            <button
                                                onClick={() => handleToggleLock(user)}
                                                className="text-blue-600 hover:text-blue-900"
                                                title={user.is_locked ? 'Desbloquear' : 'Bloquear'}
                                            >
                                                {user.is_locked ? <Unlock className="w-4 h-4 inline" /> : <Lock className="w-4 h-4 inline" />}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user.id)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                <Trash2 className="w-4 h-4 inline" />
                                            </button>
                                        </>
                                    )}
                                    {user.username === 'admin' && (
                                        <span className="text-gray-400 text-sm">Protegido</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
                    <div className="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">Crear Nuevo Usuario</h2>
                        <div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-2">Usuario</label>
                                <input
                                    type="text"
                                    value={newUser.username}
                                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg"
                                    placeholder="Nombre de usuario"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-2">Contraseña</label>
                                <input
                                    type="password"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg"
                                    placeholder="Contraseña"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-2">Rol</label>
                                <select
                                    value={newUser.role}
                                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg"
                                >
                                    <option value="user">Usuario</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={async () => {
                                        if (!newUser.username || !newUser.password) {
                                            alert('Usuario y contraseña requeridos')
                                            return
                                        }
                                        try {
                                            const response = await fetch('/api/users', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify(newUser),
                                            })
                                            if (response.ok) {
                                                setShowCreateModal(false)
                                                setNewUser({ username: '', password: '', role: 'user' })
                                                fetchUsers()
                                                alert('Usuario creado correctamente')
                                            } else {
                                                const error = await response.json()
                                                alert('Error: ' + error.error)
                                            }
                                        } catch (error) {
                                            console.error('Error creating user:', error)
                                            alert('Error al crear usuario')
                                        }
                                    }}
                                    className="btn-primary flex-1"
                                >
                                    Crear
                                </button>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 border rounded-lg flex-1 hover:bg-gray-100"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
