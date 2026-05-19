import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Loader2, User as UserIcon, Mail, Lock, CreditCard, Settings, CheckCircle, Zap, Video } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  user: User | null
}

interface Plan {
  id: string
  price: number
  max_frames: number
  max_duration_s: number
}

interface Subscription {
  user_id: string
  plan_id: string
  current_period_end: string
  status: string
}

export default function ProfileModal({ isOpen, onClose, user }: ProfileModalProps) {
  // ── Tabs State ──
  const [activeTab, setActiveTab] = useState<'subscription' | 'profile'>('subscription')

  // ── Profile State ──
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // ── Subscription State ──
  const [plans, setPlans] = useState<Plan[]>([])
  const [currentSub, setCurrentSub] = useState<Subscription | null>(null)
  const [loadingPlans, setLoadingPlans] = useState(false)

  // Cargar datos iniciales
  useEffect(() => {
    if (user && isOpen) {
      // Setup perfil
      setUsername(user.user_metadata?.username || '')
      setEmail(user.email || '')
      setPassword('')
      setError('')
      setSuccess('')
      setActiveTab('subscription') // Default tab
      
      // Fetch planes y suscripción
      fetchSubscriptionData()
    }
  }, [user, isOpen])

  const fetchSubscriptionData = async () => {
    setLoadingPlans(true)
    try {
      // 1. Obtener todos los planes (ordenados por precio)
      const { data: plansData, error: plansError } = await supabase
        .from('plans')
        .select('*')
        .order('price')
      
      if (plansError) throw plansError
      setPlans(plansData || [])

      // 2. Obtener la suscripción actual del usuario
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle() // maybeSingle no tira error si no hay resultados (ej. usuario nuevo)

      if (subError) throw subError
      setCurrentSub(subData)

    } catch (err: any) {
      console.error("Error cargando suscripciones:", err.message)
    } finally {
      setLoadingPlans(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (!user) throw new Error("No hay usuario autenticado")

      // 1. Actualizar Username en la tabla 'profiles'
      if (username !== user.user_metadata?.username) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ username: username.trim() })
          .eq('id', user.id)

        if (profileError) throw new Error('Error al actualizar el nombre en la base de datos: ' + profileError.message)

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
        setSuccess('')
      }, 3000)

    } catch (err: any) {
      setError(err.message || 'Error inesperado al actualizar el perfil')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !user) return null

  // Identificar el plan activo (si no hay, asumimos que es el gratuito visualmente)
  const activePlanId = currentSub?.plan_id || 'free'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Fondo oscuro con blur */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Contenedor del Modal */}
      <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]">
        
        {/* Header y Botón Cerrar */}
        <div className="px-6 pt-6 pb-4">
          <button onClick={onClose} className="absolute top-5 right-5 p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors cursor-pointer">
            <X size={20} />
          </button>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            Mi Cuenta
          </h2>
        </div>

        {/* ── NAVEGACIÓN DE TABS ── */}
        <div className="flex px-6 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('subscription')}
            className={`px-4 py-3 font-semibold text-sm transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'subscription' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <CreditCard size={16}/> Suscripción
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-3 font-semibold text-sm transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'profile' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <Settings size={16}/> Configuración
          </button>
        </div>

        {/* ── CONTENIDO SCROLLEABLE ── */}
        <div className="p-6 overflow-y-auto scrollbar-thin flex-1">
          
          {/* TAB: SUSCRIPCIONES */}
          {activeTab === 'subscription' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              
              <div className="mb-2">
                <h3 className="text-lg font-bold text-white">Tu Plan Actual</h3>
                <p className="text-sm text-gray-400">Mejora tu plan para aumentar tus límites de traducción y video.</p>
              </div>

              {loadingPlans ? (
                <div className="flex flex-col items-center justify-center py-10 text-indigo-500">
                  <Loader2 className="animate-spin mb-2" size={32} />
                  <p className="text-sm text-gray-400">Cargando planes...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plans.map((plan) => {
                    const isActive = activePlanId === plan.id
                    
                    return (
                      <div 
                        key={plan.id} 
                        className={`relative p-5 rounded-2xl border transition-all ${
                          isActive 
                            ? 'bg-indigo-900/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                            : 'bg-gray-800/50 border-gray-700 hover:border-gray-500'
                        }`}
                      >
                        {isActive && (
                          <div className="absolute -top-3 right-4 bg-indigo-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                            Plan Actual
                          </div>
                        )}
                        
                        <h4 className="text-xl font-extrabold text-white uppercase tracking-wider mb-1">{plan.id}</h4>
                        <div className="mb-4">
                          <span className="text-3xl font-black text-white">${plan.price}</span>
                          <span className="text-gray-400 text-sm"> / mes</span>
                        </div>

                        <ul className="space-y-3 mb-6">
                          <li className="flex items-center gap-2 text-sm text-gray-300">
                            <Zap size={16} className="text-indigo-400"/> Hasta {plan.max_frames} frames por análisis
                          </li>
                          <li className="flex items-center gap-2 text-sm text-gray-300">
                            <Video size={16} className="text-indigo-400"/> Grabación de {plan.max_duration_s} segundos
                          </li>
                          <li className="flex items-center gap-2 text-sm text-gray-300">
                            <CheckCircle size={16} className="text-indigo-400"/> Traducción de alta precisión
                          </li>
                        </ul>

                        {!isActive && (
                          <button className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors cursor-pointer text-sm">
                            Cambiar a {plan.id}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Info extra de la suscripción (fecha de corte) - Oculto si el plan es FREE */}
              {currentSub && currentSub.current_period_end && activePlanId !== 'free' && (
                <div className="mt-6 p-4 rounded-xl bg-gray-800/80 border border-gray-700 text-sm flex justify-between items-center animate-in fade-in duration-200">
                  <span className="text-gray-400">Próximo ciclo de facturación:</span>
                  <span className="text-white font-bold">{new Date(currentSub.current_period_end).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB: CONFIGURACIÓN DE PERFIL */}
          {activeTab === 'profile' && (
            <form onSubmit={handleUpdateProfile} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 max-w-md mx-auto">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-2">
                  <UserIcon size={16} /> Nombre de usuario
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-2">
                  <Mail size={16} /> Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

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
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3"><p className="text-red-400 text-sm">{error}</p></div>}
              {success && <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3"><p className="text-green-400 text-sm">{success}</p></div>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 cursor-pointer"
              >
                {loading ? <><Loader2 size={18} className="animate-spin" /> Guardando...</> : 'Guardar Cambios'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  )
}