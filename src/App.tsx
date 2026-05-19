import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './lib/supabase'
import type { User } from '@supabase/supabase-js'
import AuthModal from './components/AuthModal'
import ProfileModal from './components/ProfileModal'
import LsmSection from './components/LsmSection'
import {
  User as UserIcon,
  LogOut,
  Camera,
  CameraOff,
  CircleDot,
  Square,
  Zap,
  Trash2,
  Hand,
  Loader2,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Video,
  Layers,
  ShieldCheck,
  X,
  Volume2,
  Sun,
  Moon,
  Keyboard,
  SplitSquareHorizontal,
  BookOpen,
  MessageCircle,
  History,
  ThumbsUp,
  ThumbsDown,
  Gauge
} from 'lucide-react'

// ── Tipos y Constantes ──
type Mode = 'sequence' | 'video' | 'text' | 'conversation' | 'dictionary'

interface TranslationResult {
  resultado: string
  tipo: string
  confianza: string
  analisis_movimiento?: string
  alternativas: { seña: string }[]
  timestamp?: number // Para el historial
}

interface UserLimits {
  max_frames: number
  max_duration_s: number
}

const PALABRAS_DISPONIBLES: Record<string, string[]> = {
  "YO": ["YO", "YO_2"],
  "USTED": ["USTED"],
  "TUYO": ["TUYO"],
  "TU": ["TU"],
  "TODO": ["TODO"],
  "TODAVIA": ["TODAVIA"],
  "TAMBIEN": ["TAMBIEN"],
  "SUYO": ["SUYO"],
  "PROPIO": ["PROPIO"],
  "PRIMERO": ["PRIMERO"],
  "POR": ["POR"],
  "PARA": ["PARA"],
  "NUESTRO": ["NUESTRO"],
  "NOSOTROS": ["NOSOTROS"],
  "NOS": ["NOS"],
  "NI": ["NI"],
  "MISMO": ["MISMO"],
  "MIO": ["MIO"],
  "MI": ["MI"],
  "ESO": ["ESO"],
  "ESE": ["ESE"],
  "ESA": ["ESA"],
  "ENTRE": ["ENTRE", "ENTRE_2"],
  "EN": ["EN"],
  "ELLOS": ["ELLOS"],
  "ELLA": ["ELLA"],
  "EL": ["EL"],
  "DE": ["DE"],
  "CONTRA": ["CONTRA"],
  "CONTIGO": ["CONTIGO", "CONTIGO_2"],
  "CONMIGO": ["CONMIGO"],
  "CADA": ["CADA"],
  "ARTICULO": ["ARTICULO"],
  "ANTE": ["ANTE"],
  "ALGO": ["ALGO"],
  "ADJETIVO": ["ADJETIVO"]
}


const FRASES_RAPIDAS = [
  "Hola, soy una persona sorda",
  "Necesito ayuda por favor",
  "¿Cuánto cuesta esto?",
  "Por favor, háblame de frente",
  "Necesito un médico",
  "Gracias"
]

const DICCIONARIO_CATEGORIAS = [
  { nombre: 'Básico', palabras: ['HOLA', 'ADIOS', 'GRACIAS', 'POR FAVOR', 'PERDON'] },
  { nombre: 'Emergencia', palabras: ['AYUDA', 'MEDICO', 'HOSPITAL', 'POLICIA', 'DOLOR'] },
  { nombre: 'Familia', palabras: ['MAMA', 'PAPA', 'HERMANO', 'HIJO', 'ABUELO'] }
]

export default function App() {
  // ── Auth state ──
  const [user, setUser] = useState<User | null>(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)

  // ── App state ──
  const [mode, setMode] = useState<Mode>('sequence')
  const [cameraOn, setCameraOn] = useState(false)
  const [frames, setFrames] = useState<string[]>([])
  const [result, setResult] = useState<TranslationResult | null>(null)
  const [processing, setProcessing] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [captureCountdown, setCaptureCountdown] = useState(0)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  // ── Nuevos Estados (Mejoras UX) ──
  const [flash, setFlash] = useState(false) // Feedback visual
  const [history, setHistory] = useState<TranslationResult[]>([]) // Historial offline
  const [showHistory, setShowHistory] = useState(false)
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1) // Control de velocidad

  // ── Estados para Texto a Señas ──
  interface SignItem {
    isSpace: boolean
    url: string
    label: string
    variants?: string[]
    currentVariant?: number
  }
  const [playlist, setPlaylist] = useState<SignItem[]>([])
  const [modalPlaylist, setModalPlaylist] = useState<SignItem[]>([])

  const [inputText, setInputText] = useState('')
  const [signModalOpen, setSignModalOpen] = useState(false)
  const [modalText, setModalText] = useState('') // NUEVO: Guardar el texto exacto

  const [qualityWarning, setQualityWarning] = useState<string | null>(null)

  // ── Limits ──
  const [limits, setLimits] = useState<null | {
    can_use: boolean
    reason: string
    limits: UserLimits
  }>(null)

  // ── Refs ──
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const carouselRef = useRef<HTMLDivElement>(null)
  const modalCarouselRef = useRef<HTMLDivElement>(null)

  // ════════════════════════════════════════════
  //  INIT & AUTH & HISTORY
  // ════════════════════════════════════════════
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))

    // Cargar historial de localStorage
    const savedHistory = localStorage.getItem('handsTranslatorHistory')
    if (savedHistory) {
      try { setHistory(JSON.parse(savedHistory)) } catch (e) { console.error('Error loading history') }
    }
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) fetchUserLimits()
    else setLimits(null)
  }, [user])

  const fetchUserLimits = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('user-status')
      if (error || !data) throw new Error('Error fetching limits')
      setLimits(typeof data === 'string' ? JSON.parse(data) : data)
    } catch (err) {
      setLimits({ can_use: true, reason: 'exception', limits: { max_frames: 10, max_duration_s: 5 } })
    }
  }

  const saveToHistory = (newResult: TranslationResult) => {
    const resultWithTime = { ...newResult, timestamp: Date.now() }
    setHistory(prev => {
      const updated = [resultWithTime, ...prev].slice(0, 15) // Guardar últimos 15
      localStorage.setItem('handsTranslatorHistory', JSON.stringify(updated))
      return updated
    })
  }

  // ════════════════════════════════════════════
  //  CAMERA & CAPTURE
  // ════════════════════════════════════════════
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setCameraOn(true)
      }
    } catch (err) {
      alert('No se pudo acceder a la cámara. Verifica los permisos.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false)
    stopCapture()
  }

  const toggleCamera = () => cameraOn ? stopCamera() : startCamera()

  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      // Si el elemento de video actual no tiene el stream asignado, se lo volvemos a poner
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current
      }
    }
  }, [mode, cameraOn])

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
      if (e.code === 'Space') {
        e.preventDefault()
        if (mode === 'sequence' || mode === 'conversation') handleSequenceCapture()
        else if (mode === 'video') isCapturing ? stopCapture() : startVideoCapture()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, isCapturing, cameraOn, user, limits, frames])

  const triggerFeedback = () => {
    setFlash(true)
    setTimeout(() => setFlash(false), 100)
    // Feedback háptico si está disponible en el dispositivo
    if (navigator.vibrate) navigator.vibrate(50)
  }

  const analyzeQuality = (canvas: HTMLCanvasElement): string | null => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // Calcular brillo promedio
    let brightness = 0
    for (let i = 0; i < data.length; i += 4) {
      brightness += (data[i] + data[i + 1] + data[i + 2]) / 3
    }
    brightness /= (data.length / 4)

    if (brightness < 40) return "⚠️ Iluminación muy baja"
    return null
  }

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = 640
    canvas.height = 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)

    // Chequeo de calidad
    const warning = analyzeQuality(canvas)
    if (warning) {
      setQualityWarning(warning)
      setTimeout(() => setQualityWarning(null), 2000)
      return // No capturamos si la calidad es mala
    }

    triggerFeedback()
    setFrames((prev) => [...prev, canvas.toDataURL('image/jpeg', 0.8)])
  }, [])

  const handleSequenceCapture = () => {
    if (!user) return setAuthModalOpen(true)
    if (!limits?.can_use) return alert(limits?.reason || 'No puedes usar el servicio ahora')
    if (frames.length >= (limits.limits.max_frames || 10)) return alert('Límite de frames alcanzado')
    captureFrame()
  }

  const startVideoCapture = () => {
    if (!user) return setAuthModalOpen(true)
    if (!cameraOn) return alert('Primero enciende la cámara')
    clearFrames()
    setIsCapturing(true)
    const maxFrames = Math.max(1, limits?.limits.max_frames || 10)
    const maxDuration = limits?.limits.max_duration_s || 5
    let frameCount = 0
    setCaptureCountdown(maxDuration)
    captureIntervalRef.current = setInterval(() => {
      captureFrame()
      frameCount++
      if (frameCount >= maxFrames) stopCapture()
    }, (maxDuration / maxFrames) * 1000)
  }

  const stopCapture = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current)
      captureIntervalRef.current = null
    }
    setIsCapturing(false)
  }

  useEffect(() => {
    if (!isCapturing || captureCountdown <= 0) return
    const timer = setTimeout(() => setCaptureCountdown(p => p <= 1 ? (stopCapture(), 0) : p - 1), 1000)
    return () => clearTimeout(timer)
  }, [isCapturing, captureCountdown])

  // ════════════════════════════════════════════
  //  TEXT TO SIGN LOGIC
  // ════════════════════════════════════════════
  const generatePlaylistFromText = (text: string) => {
    if (!text.trim()) return []
    const cleanText = text.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '')
    const words = cleanText.split(/\s+/)
    let newPlaylist: { isSpace: boolean; url: string; label: string }[] = []

    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      if (!word) continue
      if (PALABRAS_DISPONIBLES[word]) {
        newPlaylist.push({
          isSpace: false,
          url: getSignUrl(PALABRAS_DISPONIBLES[word][0]), // URL construida al vuelo
          variants: PALABRAS_DISPONIBLES[word].map(getSignUrl), // Arreglo de URLs completas
          label: word
        })
      } else {
        for (const letter of word) {
          if (/[A-Z]/.test(letter)) newPlaylist.push({ isSpace: false, url: `/señas/letras/${letter}.png`, label: letter })
        }
      }
      if (i < words.length - 1) newPlaylist.push({ isSpace: true, url: '', label: '' })
    }
    return newPlaylist
  }

  const rotateVariant = (index: number) => {
    setModalPlaylist(prev =>
      prev.map((item, i) => {
        if (i !== index || !item.variants || item.variants.length <= 1) {
          return item
        }

        const currentIndex = item.variants.indexOf(item.url)
        const nextIndex = (currentIndex + 1) % item.variants.length

        return {
          ...item,
          url: item.variants[nextIndex],
          currentVariant: nextIndex
        }
      })
    )
  }

  const getSignUrl = (filename: string) => `/señas/palabras/${filename}.png`;

  const handleTextToSign = () => setPlaylist(generatePlaylistFromText(inputText))

  const openSignModal = (text: string) => {
    setModalText(text)
    setModalPlaylist(generatePlaylistFromText(text))
    setSignModalOpen(true)
  }

  // ════════════════════════════════════════════
  //  PROCESS & UTILS
  // ════════════════════════════════════════════
  const handleModeChange = (newMode: Mode) => {
    if (mode !== newMode) {
      setMode(newMode)
      clearFrames()
      if (isCapturing) stopCapture()
      if ((newMode === 'text' || newMode === 'dictionary') && cameraOn) stopCamera()
    }
  }

  const processFrames = async () => {
    if (!user) return setAuthModalOpen(true)
    if (frames.length === 0) return alert('No hay frames para procesar')

    setProcessing(true)
    setResult(null)
    setFeedbackGiven(null)

    try {
      // Limpiar anteriores
      const { data: existingFiles } = await supabase.storage.from('frames').list(user.id)
      if (existingFiles?.length) await supabase.storage.from('frames').remove(existingFiles.map(f => `${user.id}/${f.name}`))

      // Subir nuevos
      await Promise.all(frames.map(async (frame, index) => {
        const response = await fetch(frame)
        const blob = await response.blob()
        await supabase.storage.from('frames').upload(`${user.id}/frame${index + 1}.jpg`, blob, { upsert: true, contentType: 'image/jpeg' })
      }))

      // Llamar IA
      const { data, error } = await supabase.functions.invoke('translate')
      if (error) throw error
      if (data) {
        setResult(data)
        saveToHistory(data)
      }
    } catch (err: any) {
      alert('Error al procesar: ' + (err.message || 'Desconocido'))
    } finally {
      setProcessing(false)
    }
  }

  const clearFrames = () => { setFrames([]); setResult(null); setFeedbackGiven(null); }
  const scrollCarousel = (ref: any, dir: 'left' | 'right') => ref.current?.scrollBy({ left: dir === 'left' ? -160 : 160, behavior: 'smooth' })

  const speak = (text: string) => {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'es-MX'
    window.speechSynthesis.speak(utterance)
  }

  const handleLogout = async () => { stopCamera(); clearFrames(); await supabase.auth.signOut(); }

  // ════════════════════════════════════════════
  //  COMPONENTES REUTILIZABLES (UI)
  // ════════════════════════════════════════════
  const QuickPhrases = () => (
    <div className="mb-6">
      <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Frases Rápidas (Un clic)</p>
      <div className="flex flex-wrap gap-2">
        {FRASES_RAPIDAS.map((frase, i) => (
          <button
            key={i}
            onClick={() => { speak(frase); openSignModal(frase); }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all shadow-sm hover:shadow-md cursor-pointer flex items-center gap-2 ${theme === 'dark' ? 'bg-gray-800 text-gray-300 hover:bg-indigo-600 hover:text-white border border-gray-700' : 'bg-white text-gray-700 hover:bg-indigo-50 border border-gray-200'
              }`}
          >
            <MessageCircle size={14} /> {frase}
          </button>
        ))}
      </div>
    </div>
  )

  const renderCameraView = (showControls = true) => (
    <div className="space-y-4">
      <div className={`relative rounded-2xl border overflow-hidden transition-all duration-100 ${flash ? 'border-white bg-white scale-[1.01]' : theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-black border-gray-200 shadow-sm'}`}>
        <div className={`aspect-video relative flex items-center justify-center ${flash ? 'opacity-50' : 'opacity-100'}`}>
          <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${cameraOn ? 'block' : 'hidden'}`} />
          {qualityWarning && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
              <div className="bg-red-500 text-white px-6 py-3 rounded-full font-bold shadow-lg animate-bounce">
                {qualityWarning}
              </div>
            </div>
          )}
          {!cameraOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
              <div className={`p-6 rounded-full ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-900'}`}>
                <Camera size={48} className="text-gray-500" />
              </div>
              <p className="text-gray-400 text-sm font-medium">Enciende la cámara</p>
            </div>
          )}
          {isCapturing && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg">
              <CircleDot size={12} className="text-white animate-pulse" />
              <span className="text-white text-xs font-bold">REC {captureCountdown}s</span>
            </div>
          )}
        </div>
      </div>

      {showControls && (
        <div className="flex flex-wrap gap-3">
          <button onClick={toggleCamera} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all border cursor-pointer ${cameraOn ? 'bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20' : 'bg-green-500/10 text-green-500 border-green-500/30 hover:bg-green-500/20'}`}>
            {cameraOn ? <><CameraOff size={18} /> Apagar</> : <><Camera size={18} /> Encender</>}
          </button>

          {mode === 'video' ? (
            <button onClick={isCapturing ? stopCapture : startVideoCapture} disabled={!cameraOn && !isCapturing} className={`flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-medium text-sm shadow-lg cursor-pointer ${isCapturing ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50'}`}>
              {isCapturing ? <><Square size={18} /> Detener</> : <><Video size={18} /> Grabar Video</>}
            </button>
          ) : (
            <button onClick={handleSequenceCapture} disabled={!cameraOn} className="flex items-center gap-2 px-5 py-2.5 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl font-medium text-sm shadow-lg disabled:opacity-50 cursor-pointer">
              <CircleDot size={18} /> Capturar Frame
            </button>
          )}

          <button onClick={processFrames} disabled={processing || frames.length === 0} className="flex items-center gap-2 px-5 py-2.5 text-white bg-purple-600 hover:bg-purple-700 rounded-xl font-medium text-sm shadow-lg disabled:opacity-50 cursor-pointer">
            {processing ? <><Loader2 size={18} className="animate-spin" /> Procesando</> : <><Zap size={18} /> Traducir</>}
          </button>

          <button onClick={clearFrames} disabled={frames.length === 0} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm border disabled:opacity-50 cursor-pointer ${theme === 'dark' ? 'bg-gray-800 text-gray-300 border-gray-700' : 'bg-white text-gray-700'}`}>
            <Trash2 size={18} /> Limpiar ({frames.length})
          </button>
        </div>
      )}
    </div>
  )

  const ResultCard = ({ res }: { res: TranslationResult }) => (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      <div className={`border rounded-xl p-6 text-center relative ${theme === 'dark' ? 'bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border-indigo-500/30' : 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200 shadow-inner'}`}>
        <p className={`text-sm font-bold uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-600'}`}>Traducción IA</p>
        <div className="flex items-center justify-center gap-3">
          <p className={`text-4xl font-extrabold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{res.resultado}</p>
          <button onClick={() => speak(res.resultado)} className={`p-2 rounded-full transition-all cursor-pointer ${theme === 'dark' ? 'text-indigo-400 hover:bg-indigo-500/30' : 'text-indigo-600 hover:bg-indigo-200'}`}><Volume2 size={24} /></button>
          <button onClick={() => openSignModal(res.resultado)} className={`p-2 rounded-full transition-all cursor-pointer ${theme === 'dark' ? 'text-purple-400 hover:bg-purple-500/30' : 'text-purple-600 hover:bg-purple-200'}`}><Hand size={24} /></button>
        </div>
      </div>

      {/* Botones de Feedback y Alternativas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${res.confianza.toLowerCase() === 'alto' ? 'bg-green-500/20 text-green-500 border-green-500/30' : 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'}`}>
            Confianza: {res.confianza}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setFeedbackGiven('up')} className={`p-1.5 rounded-md transition-colors ${feedbackGiven === 'up' ? 'bg-green-500 text-white' : theme === 'dark' ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-200'}`}><ThumbsUp size={16} /></button>
            <button onClick={() => setFeedbackGiven('down')} className={`p-1.5 rounded-md transition-colors ${feedbackGiven === 'down' ? 'bg-red-500 text-white' : theme === 'dark' ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-200'}`}><ThumbsDown size={16} /></button>
          </div>
        </div>

        {/* ✅ AQUÍ ESTÁ EL BLOQUE DE ALTERNATIVAS QUE FALTABA */}
        {res.alternativas && res.alternativas.length > 0 && (
          <div className={`border rounded-xl p-4 ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Otras interpretaciones posibles:</p>
            <div className="grid grid-cols-1 gap-2">
              {res.alternativas.map((alt, idx) => (
                <div key={idx} className={`text-xs flex items-center justify-between p-2 rounded-lg border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                  <span className="font-extrabold uppercase tracking-wide opacity-90">{alt.seña}</span>
                  <div className="flex gap-1">
                    <button onClick={() => speak(alt.seña)} className="text-indigo-500 hover:text-indigo-400 p-1 cursor-pointer"><Volume2 size={14} /></button>
                    <button onClick={() => openSignModal(alt.seña)} className="text-purple-500 hover:text-purple-400 p-1 cursor-pointer"><Hand size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // ════════════════════════════════════════════
  //  RENDER PRINCIPAL
  // ════════════════════════════════════════════
  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <canvas ref={canvasRef} className="hidden" />

      {/* ═══════════ HEADER ═══════════ */}
      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-colors ${theme === 'dark' ? 'bg-gray-900/80 border-gray-800' : 'bg-white/80 border-gray-200 shadow-sm'}`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg"><Hand size={24} className="text-white" /></div>
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent hidden sm:block">HandsTranslator</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar">
            <button onClick={() => setShowHistory(!showHistory)} className={`p-2.5 rounded-xl border transition-all ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700 text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-600'}`} title="Historial Offline"><History size={18} /></button>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`p-2.5 rounded-xl border transition-all ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700 text-yellow-400' : 'bg-gray-100 border-gray-200 text-indigo-600'}`}><Sun size={18} className="hidden dark:block" /><Moon size={18} className="block dark:hidden" /></button>

            {user ? (
              <div className="flex items-center gap-2">
                {/* ✅ NUEVO BOTÓN PARA ABRIR EL PERFIL/SUSCRIPCIONES */}
                <button
                  onClick={() => setProfileModalOpen(true)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700 hover:text-white text-gray-300 hover:bg-gray-800' : 'bg-gray-100 border-gray-200 hover:bg-gray-200 text-gray-600'}`}
                  title="Mi Cuenta y Suscripción"
                >
                  <UserIcon size={18} />
                </button>

                <button onClick={handleLogout} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-red-500/20' : 'text-gray-600 hover:bg-red-50 hover:text-red-600'}`}>
                  <LogOut size={18} />
                  <span className="hidden md:inline">Salir</span>
                </button>
              </div>
            ) : (
              <button onClick={() => setAuthModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg cursor-pointer transition-colors">
                <UserIcon size={18} /> Entrar
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* Selector de Modos */}
        <div className={`flex flex-wrap gap-2 rounded-xl p-1.5 border mb-6 inline-flex w-full md:w-auto overflow-x-auto ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
          {[
            { id: 'sequence', icon: Layers, label: 'Secuencia' },
            { id: 'video', icon: Video, label: 'Video' },
            { id: 'conversation', icon: SplitSquareHorizontal, label: 'Conversación' },
            { id: 'text', icon: Keyboard, label: 'Teclado' },
            { id: 'dictionary', icon: BookOpen, label: 'Diccionario' }
          ].map(m => (
            <button
              key={m.id}
              onClick={() => handleModeChange(m.id as Mode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${mode === m.id ? 'bg-indigo-600 text-white shadow-md' : theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <m.icon size={16} /> {m.label}
            </button>
          ))}
        </div>

        {/* ── MODO: SECUENCIA / VIDEO ── */}
        {(mode === 'sequence' || mode === 'video') && (
          <div>
            <QuickPhrases />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {/* 1. Usamos la función render para que no se desmonte el video */}
                {renderCameraView(true)}

                {/* 2. AQUÍ ESTÁ EL CARRUSEL DE FRAMES QUE FALTABA */}
                {frames.length > 0 && (
                  <div className={`mt-4 p-4 rounded-xl border flex gap-3 overflow-x-auto ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                    {frames.map((frame, index) => (
                      <div key={index} className="relative flex-shrink-0">
                        <img src={frame} alt={`Frame ${index + 1}`} className="h-20 w-28 object-cover rounded-lg border border-gray-300 dark:border-gray-700" />
                        <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                          {index + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-1">
                <div className={`rounded-2xl border p-6 sticky top-24 ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}><Zap size={20} className="text-indigo-500" /> Resultado</h3>
                  {processing ? (
                    <div className="flex flex-col items-center gap-3">
                      {/* Animación de mano brillante */}
                      <div className="relative">
                        <Hand size={40} className="text-indigo-500 animate-pulse" />
                        <div className="absolute inset-0 bg-indigo-400 blur-xl animate-ping opacity-50"></div>
                      </div>
                      <p className="text-sm font-bold text-indigo-400 animate-pulse">Analizando señas...</p>
                    </div>
                  ) : result ? (
                    <ResultCard res={result} />
                  ) : (
                    <div className={`py-12 text-center text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Captura y procesa para ver el resultado</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MODO: CONVERSACIÓN (Pantalla Dividida Mejorada y Responsiva) ── */}
        {mode === 'conversation' && (
          /* FIX 1: Quitamos lg:h-[75vh] y ponemos h-auto para que crezca según necesite */
          <div className="flex flex-col md:flex-row gap-4 min-h-[650px] h-auto">

            {/* Lado Oyente (Texto a Señas) */}
            <div className={`flex-1 rounded-2xl border p-5 md:p-6 flex flex-col ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
              <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}><Keyboard size={16} /> Escribe para mostrar señas</h3>
              <div className="flex gap-2 mb-4">
                <input
                  type="text" value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleTextToSign()}
                  placeholder="Escribe aquí..."
                  className={`flex-1 border rounded-xl p-3 text-sm outline-none ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-300'}`}
                />
                <button onClick={handleTextToSign} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 rounded-xl font-bold cursor-pointer transition-colors">Traducir</button>
              </div>
              <div className={`flex-1 rounded-xl border flex items-center justify-center p-4 overflow-hidden ${theme === 'dark' ? 'bg-black/50 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                {playlist.length > 0 ? (
                  <div className="flex gap-4 overflow-x-auto w-full items-center pb-2 scrollbar-thin">
                    {playlist.map((item, i) => !item.isSpace && (
                      <div key={i} className="flex flex-col items-center flex-shrink-0">
                        <img src={item.url} className="w-24 h-24 object-contain rounded-lg bg-white p-1 border" alt={item.label} />
                        <span className="text-center font-extrabold mt-2 block text-sm uppercase">{item.label}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="opacity-50 text-sm">El texto en señas aparecerá aquí</p>}
              </div>
            </div>

            {/* Separador Visual */}
            <div className="hidden md:flex flex-col items-center justify-center text-gray-300 dark:text-gray-700"><div className="w-px h-full bg-current"></div><MessageCircle className="my-2" /><div className="w-px h-full bg-current"></div></div>

            {/* Lado Sordo (Cámara a Texto) */}
            <div className={`flex-1 rounded-2xl border p-5 md:p-6 flex flex-col h-full ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
              <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}><Camera size={16} /> Graba para mostrar texto</h3>

              <div className="mb-4">
                {renderCameraView(false)}

                {frames.length > 0 && (
                  <div className={`mt-3 p-3 rounded-xl border flex gap-2 overflow-x-auto scrollbar-thin ${theme === 'dark' ? 'bg-black/40 border-gray-800' : 'bg-gray-50 border-gray-200 shadow-inner'}`}>
                    {frames.map((frame, index) => (
                      <div key={index} className="relative flex-shrink-0">
                        <img src={frame} alt={`Frame ${index + 1}`} className="h-12 w-16 object-cover rounded-md border border-gray-300 dark:border-gray-700" />
                        <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[8px] font-bold px-1 rounded">
                          {index + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Controles de Captura */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button onClick={handleSequenceCapture} disabled={!cameraOn || isCapturing} className="bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-colors">
                  <CircleDot size={18} /> <span>Foto</span>
                </button>

                <button onClick={isCapturing ? stopCapture : startVideoCapture} disabled={!cameraOn && !isCapturing} className={`py-2.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer transition-colors ${isCapturing ? 'bg-red-500 hover:bg-red-600 shadow-inner' : 'bg-pink-600 hover:bg-pink-700'}`}>
                  {isCapturing ? <><Square size={18} className="animate-pulse" /> <span>{captureCountdown}s</span></> : <><Video size={18} /> <span>Grabar</span></>}
                </button>
              </div>

              {/* Controles de Acción (Traducir, Limpiar, Toggle Cámara) */}
              <div className="flex gap-2 mb-4">
                <button onClick={processFrames} disabled={processing || frames.length === 0} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold disabled:opacity-50 cursor-pointer transition-colors flex items-center justify-center gap-2">
                  <Zap size={18} /> Traducir ({frames.length})
                </button>

                <button onClick={clearFrames} disabled={frames.length === 0} className={`px-4 border rounded-xl cursor-pointer transition-colors ${theme === 'dark' ? 'border-gray-700 hover:bg-gray-800 text-gray-400' : 'border-gray-300 hover:bg-gray-100 text-gray-500'} disabled:opacity-50`} title="Limpiar fotos">
                  <Trash2 size={20} />
                </button>

                <button onClick={toggleCamera} className={`px-4 border rounded-xl cursor-pointer transition-colors ${theme === 'dark' ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-300 hover:bg-gray-100'}`} title={cameraOn ? "Apagar cámara" : "Encender cámara"}>
                  <Camera size={20} className={cameraOn ? 'text-red-500' : (theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                </button>
              </div>

              {/* FIX 2: flex-1 y overflow-y-auto scrollbar-thin agregados a la caja de resultados */}
              <div className={`p-4 rounded-xl text-center border flex flex-col items-center justify-center transition-colors min-h-[140px] flex-1 overflow-y-auto scrollbar-thin ${theme === 'dark' ? 'bg-gray-800/40 border-gray-700' : 'bg-indigo-50/60 border-indigo-100'}`}>
                {processing ? (
                  <Loader2 className="animate-spin text-indigo-500" size={28} />
                ) : result ? (
                  <div className="w-full space-y-3 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-center gap-3">
                      <p className="text-3xl font-extrabold uppercase tracking-wide">{result.resultado}</p>
                      <button onClick={() => speak(result.resultado)} className={`p-1.5 rounded-full transition-colors cursor-pointer ${theme === 'dark' ? 'text-indigo-400 hover:bg-gray-700' : 'text-indigo-600 hover:bg-indigo-200'}`} title="Escuchar"><Volume2 size={20} /></button>
                      <button onClick={() => openSignModal(result.resultado)} className={`p-1.5 rounded-full transition-colors cursor-pointer ${theme === 'dark' ? 'text-purple-400 hover:bg-gray-700' : 'text-purple-600 hover:bg-purple-200'}`} title="Ver señas en modal"><Hand size={20} /></button>
                    </div>

                    <div className="text-[11px] font-bold">
                      <span className={`px-2.5 py-0.5 rounded-full border ${result.confianza.toLowerCase() === 'alto' ? 'bg-green-500/20 text-green-500 border-green-500/30' : 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'}`}>
                        Confianza: {result.confianza}
                      </span>
                    </div>

                    {result.alternativas && result.alternativas.length > 0 && (
                      <div className="text-left border-t border-gray-300 dark:border-gray-700/60 pt-2.5 mt-2 w-full">
                        <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>¿Quisiste decir?</p>
                        <div className="grid grid-cols-1 gap-1.5">
                          {result.alternativas.map((alt, idx) => (
                            <div key={idx} className={`text-xs flex items-center justify-between p-2 rounded-lg border ${theme === 'dark' ? 'bg-black/30 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                              <span className="font-extrabold uppercase tracking-wide opacity-90">{alt.seña}</span>
                              <div className="flex gap-1">
                                <button onClick={() => speak(alt.seña)} className="text-indigo-500 hover:text-indigo-400 p-1 cursor-pointer"><Volume2 size={14} /></button>
                                <button onClick={() => openSignModal(alt.seña)} className="text-purple-500 hover:text-purple-400 p-1 cursor-pointer"><Hand size={14} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="opacity-50 text-sm">La traducción de la cámara aparecerá aquí</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── MODO: TEXTO A SEÑAS ── */}
        {mode === 'text' && (
          <div className={`rounded-2xl border p-8 ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
            <QuickPhrases />
            <div className="flex gap-3 mb-8">
              <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleTextToSign()} placeholder="Escribe para traducir..." className={`flex-1 border rounded-xl p-4 outline-none ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-300'}`} />
              <button onClick={handleTextToSign} className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer hover:bg-indigo-700 transition-colors">Traducir</button>
            </div>
            <div className={`rounded-xl border p-6 min-h-[300px] flex items-center ${theme === 'dark' ? 'bg-black/40 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex gap-4 overflow-x-auto w-full pb-4 items-center scrollbar-thin">
                {playlist.map((item, index) => item.isSpace ? (
                  <div key={index} className="w-16 h-40 flex-shrink-0 border-2 border-dashed opacity-40 rounded-xl flex items-center justify-center">
                    <span className="text-[10px] rotate-90 uppercase font-bold">Espacio</span>
                  </div>
                ) : (
                  <div key={index} className={`flex flex-col items-center flex-shrink-0 p-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
                    <img src={item.url} className="w-40 h-40 object-contain rounded-lg bg-white p-1" alt={item.label} />
                    <span className="mt-3 font-extrabold text-xl">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── MODO: DICCIONARIO VISUAL ── */}
        {mode === 'dictionary' && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold">Diccionario de Aprendizaje</h2>
              <p className="opacity-70">Haz clic en cualquier palabra para ver su seña</p>
            </div>
            {DICCIONARIO_CATEGORIAS.map((cat, i) => (
              <div key={i} className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><BookOpen className="text-indigo-500" /> {cat.nombre}</h3>
                <div className="flex flex-wrap gap-3">
                  {cat.palabras.map((palabra, j) => (
                    <button key={j} onClick={() => openSignModal(palabra)} className={`px-4 py-3 rounded-xl font-bold border transition-all hover:scale-105 ${theme === 'dark' ? 'bg-gray-800 border-gray-700 hover:border-indigo-500' : 'bg-gray-50 border-gray-200 hover:border-indigo-300'}`}>
                      {palabra}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* ✅ AQUÍ ACOPLAS EL NUEVO ARCHIVO EXTRAÍDO */}
      <LsmSection
        theme={theme}
        user={user}
        onAuthRequired={() => setAuthModalOpen(true)}
      />

      {/* ═══════════ HISTORIAL SIDEBAR (Overlay) ═══════════ */}
      {showHistory && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 z-50 bg-black/50 backdrop-blur-sm flex justify-end">
          <div className={`w-full sm:w-96 h-full p-6 shadow-2xl flex flex-col ${theme === 'dark' ? 'bg-gray-900 border-l border-gray-800' : 'bg-white border-l border-gray-200'}`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2"><History /> Historial Offline</h3>
              <button onClick={() => setShowHistory(false)} className="p-2 rounded-full hover:bg-gray-500/20"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {history.length === 0 ? <p className="text-center opacity-50 mt-10">No hay traducciones recientes.</p> : history.map((h, i) => (
                <div key={i} className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                  <p className="text-xs opacity-50 mb-1">{new Date(h.timestamp || Date.now()).toLocaleTimeString()}</p>
                  <p className="text-lg font-bold mb-2">{h.resultado}</p>
                  <div className="flex gap-2">
                    <button onClick={() => speak(h.resultado)} className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-500"><Volume2 size={16} /></button>
                    <button onClick={() => openSignModal(h.resultado)} className="p-1.5 rounded-md bg-purple-500/10 text-purple-500"><Hand size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ SIGN TRANSLATION MODAL (Diseño Panorámico Expandido) ═══════════ */}
      {signModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4">
          {/* CAMBIO: Se cambió max-w-4xl a max-w-6xl/7xl y se redujo el padding externo de p-8 a p-4 md:p-6 */}
          <div className={`relative w-full max-w-6xl xl:max-w-7xl rounded-2xl p-4 md:p-6 shadow-2xl transition-all ${theme === 'dark' ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>

            <div className="flex justify-between items-center mb-4 md:mb-6">
              <h2 className={`text-xl md:text-2xl font-bold flex items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}><Hand className="text-purple-500" /> Traducción</h2>
              <div className="flex items-center gap-2 md:gap-4">

                {/* Botón de Audio */}
                <button
                  onClick={() => speak(modalText)}
                  className={`p-2 rounded-full transition-colors cursor-pointer ${theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/40' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'}`}
                  title="Escuchar texto en voz alta"
                >
                  <Volume2 size={20} />
                </button>

                {/* Control de Velocidad */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'}`}>
                  <Gauge size={16} className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} />
                  <select value={playbackSpeed} onChange={(e) => setPlaybackSpeed(Number(e.target.value))} className="bg-transparent text-sm font-bold outline-none cursor-pointer">
                    <option value={0.5}>0.5x (Lento)</option>
                    <option value={1}>1x (Normal)</option>
                    <option value={1.5}>1.5x (Rápido)</option>
                  </select>
                </div>

                <button onClick={() => setSignModalOpen(false)} className={`p-2 rounded-full transition-colors cursor-pointer ${theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}><X size={24} /></button>
              </div>
            </div>

            {/* CAMBIO: Se redujo el padding interno de p-6 a p-3 md:p-4 y el min-h para ganar espacio vertical */}
            <div className={`rounded-xl border p-3 md:p-4 min-h-[240px] flex items-center transition-colors ${theme === 'dark' ? 'bg-black/50 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
              {/* CAMBIO: Reducido el gap de 4 a 3 y ajustado el padding inferior a pb-2 */}
              <div ref={modalCarouselRef} className="flex gap-3 overflow-x-auto w-full pb-2 scrollbar-thin items-center transition-transform" style={{ transitionDuration: `${1 / playbackSpeed}s` }}>
                {modalPlaylist.map((item, index) => item.isSpace ? (
                  /* CAMBIO: Espacio más compacto (w-10 a w-12) */
                  <div key={index} className="flex-shrink-0 w-10 md:w-12 h-32 mx-1 rounded-xl border-2 border-dashed flex items-center justify-center opacity-40 border-gray-400">
                    <span className="text-[9px] rotate-90 uppercase font-bold tracking-wider">Espacio</span>
                  </div>
                ) : (
                  <div
                    onClick={() => rotateVariant(index)}
                    className="relative cursor-pointer group"
                  >
                    <img
                      src={item.url}
                      alt={item.label}
                      className="w-40 h-40 object-contain rounded-lg bg-white p-1 transition-all duration-200 group-hover:scale-105"
                    />

                    {item.variants && item.variants.length > 1 && (
                      <div className="absolute top-2 right-2 bg-indigo-600 text-white text-[10px] px-2 py-1 rounded-full font-bold">
                        {item.currentVariant! + 1}/{item.variants.length}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Controles de navegación inferior */}
            <div className="mt-3 flex justify-center gap-4">
              <button onClick={() => scrollCarousel(modalCarouselRef, 'left')} className="p-2 md:p-3 rounded-full bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 cursor-pointer transition-colors"><ChevronLeft size={20} /></button>
              <button onClick={() => scrollCarousel(modalCarouselRef, 'right')} className="p-2 md:p-3 rounded-full bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 cursor-pointer transition-colors"><ChevronRight size={20} /></button>
            </div>

          </div>
        </div>
      )}

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      <ProfileModal isOpen={profileModalOpen} onClose={() => setProfileModalOpen(false)} user={user} />
    </div>
  )
}