import { Hand, Layers, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase' // Ajusta la ruta si tu archivo de supabase está en otra carpeta
import type { User } from '@supabase/supabase-js'

interface LsmSectionProps {
  theme: 'dark' | 'light'
  user: User | null
  onAuthRequired: () => void
}

export default function LsmSection({ theme, user, onAuthRequired }: LsmSectionProps) {
  return (
    <>
      {/* ═══════════ SECCIÓN EDUCATIVA ═══════════ */}
      <section className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t ${
        theme === 'dark' ? 'border-gray-900' : 'border-gray-200'
      }`}>
        <div className="text-center mb-16">
          <h2 className={`text-3xl md:text-4xl font-extrabold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Aprende sobre la LSM
          </h2>
          <p className={`max-w-2xl mx-auto text-lg ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            La Lengua de Señas Mexicana es más que solo manos; es cultura, identidad y gramática propia.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className={`p-8 rounded-3xl border transition-all duration-300 hover:-translate-y-1 group ${
            theme === 'dark' ? 'bg-gray-900/50 border-gray-800 hover:border-indigo-500/50' : 'bg-white border-gray-200 shadow-md hover:shadow-xl hover:border-indigo-300'
          }`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${
              theme === 'dark' ? 'bg-indigo-600/20' : 'bg-indigo-100'
            }`}>
              <Layers size={28} className={theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} />
            </div>
            <h3 className={`text-xl font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Dactilología</h3>
            <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Es el abecedario manual. Se utiliza para deletrear nombres propios, lugares o palabras que no tienen una seña específica. Es el primer paso para cualquier aprendiz.
            </p>
          </div>

          <div className={`p-8 rounded-3xl border transition-all duration-300 hover:-translate-y-1 group ${
            theme === 'dark' ? 'bg-gray-900/50 border-gray-800 hover:border-purple-500/50' : 'bg-white border-gray-200 shadow-md hover:shadow-xl hover:border-purple-300'
          }`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${
              theme === 'dark' ? 'bg-purple-600/20' : 'bg-purple-100'
            }`}>
              <Hand size={28} className={theme === 'dark' ? 'text-purple-400' : 'text-purple-600'} />
            </div>
            <h3 className={`text-xl font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Ideogramas</h3>
            <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              A diferencia del deletreo, una sola seña representa un concepto o palabra completa (ej. "Casa", "Familia"). Estas señas involucran configuración, movimiento y gesticulación.
            </p>
          </div>

          <div className={`p-8 rounded-3xl border transition-all duration-300 hover:-translate-y-1 group ${
            theme === 'dark' ? 'bg-gray-900/50 border-gray-800 hover:border-pink-500/50' : 'bg-white border-gray-200 shadow-md hover:shadow-xl hover:border-pink-300'
          }`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${
              theme === 'dark' ? 'bg-pink-600/20' : 'bg-pink-100'
            }`}>
              <ShieldCheck size={28} className={theme === 'dark' ? 'text-pink-400' : 'text-pink-600'} />
            </div>
            <h3 className={`text-xl font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Mitos Comunes</h3>
            <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              La lengua de señas NO es universal. Cada país tiene la suya (LSM en México, LSE en España, ASL en EE.UU.). Tampoco es una mímica simplificada, es un idioma completo.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════ FORMULARIO DE COMUNIDAD ═══════════ */}
      <section className="max-w-4xl mx-auto px-4 pb-24">
        <div className={`rounded-[2.5rem] p-8 md:p-12 border relative overflow-hidden transition-colors ${
          theme === 'dark'
            ? 'bg-gradient-to-br from-gray-900 to-indigo-900/20 border-indigo-500/20'
            : 'bg-gradient-to-br from-white to-indigo-50/50 border-indigo-200 shadow-2xl shadow-indigo-100/50'
        }`}>
          <div className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl ${
            theme === 'dark' ? 'bg-indigo-600/10' : 'bg-indigo-300/30'
          }`} />

          <div className="relative z-10">
            <h2 className={`text-3xl font-extrabold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Queremos conocerte
            </h2>
            <p className={`mb-10 text-lg ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Ayúdanos a mejorar HandsTranslator respondiendo estas breves preguntas.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const payload = Object.fromEntries(formData.entries());

                if (!user) {
                  alert('Debes iniciar sesión para enviar tus comentarios.');
                  onAuthRequired();
                  return;
                }

                try {
                  const { error } = await supabase.functions.invoke('form', { body: payload });
                  if (error) throw error;
                  alert('¡Gracias! Tus respuestas se han guardado correctamente.');
                  (e.target as HTMLFormElement).reset();
                } catch (err: any) {
                  console.error('Error al enviar formulario:', err);
                  alert('Hubo un error al enviar tus respuestas. Por favor, intenta más tarde.');
                }
              }}
              className="space-y-8"
            >
              <div className="space-y-4">
                <label className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                  ¿Tienes algún familiar que use lengua de señas?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {['Sí, cercano', 'Sí, lejano', 'No'].map((opcion) => (
                    <label key={opcion} className="relative">
                      <input type="radio" name="familiar" value={opcion} className="peer sr-only" required />
                      <div className={`p-3 text-center text-sm font-medium border rounded-xl cursor-pointer transition-all ${
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-gray-300 peer-checked:bg-indigo-600 peer-checked:text-white peer-checked:border-indigo-500 hover:bg-gray-700'
                          : 'bg-white border-gray-300 text-gray-700 peer-checked:bg-indigo-500 peer-checked:text-white peer-checked:border-indigo-500 hover:bg-gray-50 shadow-sm'
                      }`}>
                        {opcion}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                  ¿Cuál es tu nivel de conocimiento en LSM?
                </label>
                <select name="nivel" className={`w-full border rounded-xl p-3.5 text-sm font-medium outline-none transition-colors cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white focus:border-indigo-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 shadow-sm'
                }`}>
                  <option value="ninguno">Ninguno</option>
                  <option value="basico">Básico (Abecedario)</option>
                  <option value="intermedio">Intermedio (Conversación fluida)</option>
                  <option value="avanzado">Avanzado / Intérprete</option>
                </select>
              </div>

              <div className="space-y-4">
                <label className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                  ¿Conoces a alguien que le pueda resultar útil esta página?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {['Sí, mucho', 'Tal vez alguien'].map((opcion) => (
                    <label key={opcion} className="relative">
                      <input type="radio" name="utilidad" value={opcion} className="peer sr-only" />
                      <div className={`p-3 text-center text-sm font-medium border rounded-xl cursor-pointer transition-all ${
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-gray-300 peer-checked:bg-indigo-600 peer-checked:text-white peer-checked:border-indigo-500 hover:bg-gray-700'
                          : 'bg-white border-gray-300 text-gray-700 peer-checked:bg-indigo-500 peer-checked:text-white peer-checked:border-indigo-500 hover:bg-gray-50 shadow-sm'
                      }`}>
                        {opcion}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                  ¿Qué otra función te gustaría ver?
                </label>
                <textarea
                  name="sugerencia"
                  rows={3}
                  placeholder="Ej: Diccionario visual, curso básico..."
                  className={`w-full border rounded-xl p-4 text-sm font-medium outline-none transition-colors ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-700 text-white focus:border-indigo-500 placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 placeholder-gray-400 shadow-sm'
                  }`}
                />
              </div>

              <button
                type="submit"
                className={`w-full py-4 rounded-xl font-bold transition-all shadow-lg text-lg cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-white text-gray-950 hover:bg-gray-100 shadow-white/10'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/25'
                }`}
              >
                Enviar respuestas
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  )
}