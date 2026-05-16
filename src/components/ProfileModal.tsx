import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Loader2, User as UserIcon, Mail, Lock } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  user: User | null
}

export default function ProfileModal({ isOpen, onClose, user }: ProfileModalProps) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Cargar los datos actuales del usuario cuando se abre el modal
  useEffect(() => {
    if (user && isOpen) {
      setUsername(user.user_metadata?.username || '')
      setEmail(user.email || '')
      setPassword('') // La contraseña siempre se deja en blanco por seguridad
      setError('')
      setSuccess('')
    }
  }, [user, isOpen])

  if (!isOpen || !user) return null

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      // 1. Actualizar Username en la tabla 'profiles'
      if (username !== user.user_metadata?.username) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ username: username.trim() })
          .eq('id', user.id)

        if (profileError) throw new Error('Error al actualizar el nombre en la base de datos: ' + profileError.message)

        // También actualizamos los metadatos del Auth para mantener consistencia
        await supabase.auth.updateUser({
          data: { username: username.trim() }
        })
      }

      // 2. Actualizar Email o Contraseña en Auth
      const authUpdates: any = {}
      if (email !== user.email && email.trim() !== '') authUpdates.email = email.trim()
      if (password.trim() !== '') authUpdates.password = password

      if (Object.keys(authUpdates).length > 0) {
        const { error: authError } = await supabase.auth.updateUser(authUpdates)
        if (authError) throw new Error(authError.message)
      }

      setSuccess('¡Perfil actualizado con éxito!')
      setTimeout(() => {
        onClose()
      }, 2000)

    } catch (err: any) {
      setError(err.message || 'Error inesperado al actualizar el perfil')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Fondo oscuro con blur */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Contenedor del Modal */}
      <div className="relative w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>

        <div className="px-8 pt-8 pb-6">
          <h2 className="text-2xl font-bold text-white text-center">Editar Perfil</h2>
          <p className="text-gray-400 text-center mt-1 text-sm">
            Actualiza tu información personal
          </p>
        </div>

        <form onSubmit={handleUpdate} className="px-8 pb-8 space-y-5">
          {/* Campo Username */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-2">
              <UserIcon size={16} /> Nombre de usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Campo Email */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-2">
              <Mail size={16} /> Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Campo Contraseña */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-2">
              <Lock size={16} /> Nueva Contraseña <span className="text-gray-500 text-xs font-normal">(Opcional)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Deja en blanco para no cambiarla"
              minLength={6}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Mensajes de feedback */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          {/* Botón Guardar */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 cursor-pointer"
          >
            {loading ? (
              <><Loader2 size={18} className="animate-spin" /> Guardando...</>
            ) : (
              'Guardar Cambios'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}