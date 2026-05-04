import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './lib/supabase'
import type { User } from '@supabase/supabase-js'
import AuthModal from './components/AuthModal'
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
  MessageSquare,
  Send,
  Volume2,
  Sun,
  Moon,
} from 'lucide-react'

type Mode = 'sequence' | 'video'

interface TranslationResult {
  resultado: string
  tipo: string
  confianza: string
  analisis_movimiento?: string
  alternativas: { seña: string }[]
}

interface UserLimits {
  max_frames: number
  max_duration_s: number
}

export default function App() {
  // ── Auth state ──
  const [user, setUser] = useState<User | null>(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  // ── App state ──
  const [mode, setMode] = useState<Mode>('sequence')
  const [cameraOn, setCameraOn] = useState(false)
  const [frames, setFrames] = useState<string[]>([])
  const [result, setResult] = useState<TranslationResult | null>(null)
  const [processing, setProcessing] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [captureCountdown, setCaptureCountdown] = useState(0)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

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

  // ════════════════════════════════════════════
  //  AUTH
  // ════════════════════════════════════════════
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // ════════════════════════════════════════════
  //  FETCH USER LIMITS
  // ════════════════════════════════════════════
  useEffect(() => {
    if (user) {
      setLimits(null)
      fetchUserLimits()
    } else {
      setLimits(null)
    }
  }, [user])

  const fetchUserLimits = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('user-status')

      if (error || !data) {
        setLimits({
          can_use: false,
          reason: 'error',
          limits: { max_frames: 0, max_duration_s: 0 }
        })
        return
      }

      // 🛠️ SOLUCIÓN: Verificamos si data es un string. Si lo es, lo parseamos a JSON.
      const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
      setLimits(parsedData);

    } catch (err) {
      console.error(err)

      setLimits({
        can_use: true,
        reason: 'exception',
        limits: {
          max_frames: 10,
          max_duration_s: 5
        }
      })
    }
  }

  // ════════════════════════════════════════════
  //  CAMERA
  // ════════════════════════════════════════════
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setCameraOn(true)
      }
    } catch (err) {
      console.error('Error accessing camera:', err)
      alert('No se pudo acceder a la cámara. Verifica los permisos.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraOn(false)
    stopCapture()
  }

  const toggleCamera = () => {
    if (cameraOn) {
      stopCamera()
    } else {
      startCamera()
    }
  }

  // ════════════════════════════════════════════
  //  FRAME CAPTURE
  // ════════════════════════════════════════════
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    setFrames((prev) => [...prev, dataUrl])
  }, [])

  // ── Sequence mode: manual capture ──
  const handleSequenceCapture = () => {
    if (!user) {
      setAuthModalOpen(true)
      return
    }
    if (!limits) {
      alert('Cargando límites...')
      return
    }
    if (!limits.can_use) {
      alert(limits.reason || 'No puedes usar el servicio en este momento')
      return
    }

    const maxFrames = limits.limits.max_frames || 10

    // 🛠️ SOLUCIÓN: Verificamos si ya llegamos al límite de frames
    if (frames.length >= maxFrames) {
      alert(`Has alcanzado el límite máximo de ${maxFrames} frames permitidos.`)
      return
    }

    captureFrame()
  }

  // ── Video mode: auto capture ──
  const startVideoCapture = () => {
    if (!user) {
      setAuthModalOpen(true)
      return
    }
    if (!limits) {
      alert('Cargando límites...')
      return
    }

    if (!limits.can_use) {
      alert(limits.reason || 'No puedes usar el servicio en este momento')
      return
    }
    if (!cameraOn) {
      alert('Primero enciende la cámara')
      return
    }

    clearFrames()
    
    setIsCapturing(true)
    const maxFrames = Math.max(1, limits?.limits.max_frames || 10)
    const maxDuration = limits?.limits.max_duration_s || 5
    let frameCount = 0

    // Countdown
    setCaptureCountdown(maxDuration)

    // 🛠️ SOLUCIÓN: Declaramos intervalMs dividiendo el tiempo total entre los frames
    const intervalMs = (maxDuration / maxFrames) * 1000

    captureIntervalRef.current = setInterval(() => {
      captureFrame()
      frameCount++

      if (frameCount >= maxFrames) {
        stopCapture()
      }
    }, intervalMs) // <--- Ahora sí existe
  }

  const stopCapture = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current)
      captureIntervalRef.current = null
    }
    setIsCapturing(false)
  }

  // Countdown timer for video mode
  useEffect(() => {
    if (!isCapturing || captureCountdown <= 0) return
    const timer = setTimeout(() => {
      setCaptureCountdown((prev) => {
        if (prev <= 1) {
          stopCapture()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearTimeout(timer)
  }, [isCapturing, captureCountdown])

  // ════════════════════════════════════════════
  //  CHANGE MODE
  // ════════════════════════════════════════════
  const handleModeChange = (newMode: Mode) => {
    if (mode !== newMode) {
      setMode(newMode)
      clearFrames()
      if (isCapturing) stopCapture() 
    }
  }
  
  // ════════════════════════════════════════════
  //  PROCESS FRAMES
  // ════════════════════════════════════════════
  const processFrames = async () => {
    if (!user) {
      setAuthModalOpen(true)
      return
    }
    if (frames.length === 0) {
      alert('No hay frames para procesar')
      return
    }

    setProcessing(true)
    setResult(null)

    try {
      // 1️⃣ LIMPIEZA: Buscar y borrar frames anteriores del usuario
      const { data: existingFiles, error: listError } = await supabase.storage
        .from('frames')
        .list(user.id)

      if (listError) {
        throw new Error(`Error al buscar frames anteriores: ${listError.message}`)
      }

      if (existingFiles && existingFiles.length > 0) {
        const filesToRemove = existingFiles.map((file) => `${user.id}/${file.name}`)
        const { error: removeError } = await supabase.storage
          .from('frames')
          .remove(filesToRemove)

        if (removeError) {
          throw new Error(`Error al limpiar frames antiguos: ${removeError.message}`)
        }
      }

      // 2️⃣ SUBIDA: Subir los frames nuevos en paralelo
      const uploadPromises = frames.map(async (frame, index) => {
        const response = await fetch(frame)
        const blob = await response.blob()

        const { error: uploadError } = await supabase.storage
          .from('frames')
          .upload(`${user.id}/frame${index + 1}.jpg`, blob, {
            upsert: true,
            contentType: 'image/jpeg',
          })

        if (uploadError) {
          throw new Error(`Fallo al subir el frame ${index + 1}: ${uploadError.message}`)
        }
      })

      await Promise.all(uploadPromises)

      // 3️⃣ PROCESAMIENTO: Llamar a la Edge Function sin parámetros
      const { data, error } = await supabase.functions.invoke('translate')

      if (error) {
        console.error('Error from translate:', error)
        alert('Error al procesar los frames: ' + (error.message || 'Error desconocido'))
      } else if (data) {
        setResult(data)
      }
    } catch (err: any) {
      console.error('Error processing:', err)
      alert(err.message || 'Error al procesar los frames')
    } finally {
      setProcessing(false)
    }
  }

  // ════════════════════════════════════════════
  //  CLEAR
  // ════════════════════════════════════════════
  const clearFrames = () => {
    setFrames([])
    setResult(null)
  }

  // ════════════════════════════════════════════
  //  CAROUSEL SCROLL
  // ════════════════════════════════════════════
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 160
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      })
    }
  }

  // ════════════════════════════════════════════
  //  CONFIDENCE BADGE
  // ════════════════════════════════════════════
  const getConfidenceColor = (confianza: string) => {
    switch (confianza.toLowerCase()) {
      case 'alto':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'medio':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'bajo':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getTypeColor = (tipo: string) => {
    switch (tipo.toLowerCase()) {
      case 'dactilologia':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'seña-palabra':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'numero':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  // ════════════════════════════════════════════
  //  LOGOUT
  // ════════════════════════════════════════════
  const handleLogout = async () => {
    stopCamera()
    clearFrames()
    await supabase.auth.signOut()
  }

  // ════════════════════════════════════════════
  //  SPEAK
  // ════════════════════════════════════════════
  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // 🛠️ Buscar voces premium instaladas
    const voices = window.speechSynthesis.getVoices();
    
    // Intentamos buscar voces que digan "Google" o "Natural" que suelen ser mejores
    const bestVoice = voices.find(v => v.lang.includes('es') && v.name.includes('Google')) 
                   || voices.find(v => v.lang.includes('es')) 
                   || voices[0];
  
    if (bestVoice) utterance.voice = bestVoice;

    utterance.volume = 0.8;
    
    utterance.lang = 'es-MX';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  // ════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════
  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      theme === 'dark' ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'
    }`}>
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ═══════════ HEADER ═══════════ */}
      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-colors duration-300 ${
        theme === 'dark' ? 'bg-gray-900/80 border-gray-800' : 'bg-white/80 border-gray-200 shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-600/20">
                <Hand size={24} className="text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
                HandsTranslator
              </span>
            </div>

            {/* User controls & Theme Toggle */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* 🛠️ Botón de Tema */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`p-2.5 rounded-xl transition-all border ${
                  theme === 'dark' 
                    ? 'bg-gray-800/50 border-gray-700 text-yellow-400 hover:bg-gray-800' 
                    : 'bg-gray-100 border-gray-200 text-indigo-600 hover:bg-gray-200'
                }`}
                title={theme === 'dark' ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {user ? (
                <>
                  <span className={`hidden sm:block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                    {user.user_metadata?.username || user.email}
                  </span>
                  <button
                    onClick={handleLogout}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-sm font-medium ${
                      theme === 'dark' 
                        ? 'text-gray-400 hover:text-white hover:bg-gray-800' 
                        : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
                    }`}
                  >
                    <LogOut size={18} />
                    <span className="hidden sm:inline">Salir</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all font-medium text-sm shadow-lg shadow-indigo-600/25"
                >
                  <UserIcon size={18} />
                  <span className="hidden sm:inline">Iniciar Sesión</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Mode Selector ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className={`flex rounded-xl p-1.5 border transition-colors ${
            theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'
          }`}>
            <button
              onClick={() => handleModeChange('sequence')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'sequence'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : theme === 'dark' 
                    ? 'text-gray-400 hover:text-white hover:bg-gray-800' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Layers size={16} />
              Secuencia de señas
            </button>
            <button
              onClick={() => handleModeChange('video')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'video'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : theme === 'dark' 
                    ? 'text-gray-400 hover:text-white hover:bg-gray-800' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Video size={16} />
              Video
            </button>
          </div>

          {/* User limits info */}
          {user && limits && (
            <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border ${
              theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'
            }`}>
              {limits.can_use ? (
                <>
                  <ShieldCheck size={14} className="text-green-500" />
                  <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                    Máx. {limits.limits.max_frames} frames · {limits.limits.max_duration_s}s video
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle size={14} className="text-yellow-500" />
                  <span className="text-yellow-600 dark:text-yellow-400">{limits.reason}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Main Grid: Camera + Results ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ═══ LEFT: Camera Area ═══ */}
          <div className="lg:col-span-2 space-y-4">
            {/* Camera Feed */}
            <div className={`relative rounded-2xl border overflow-hidden transition-colors ${
              theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-black border-gray-200 shadow-sm'
            }`}>
              <div className="aspect-video relative flex items-center justify-center bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${cameraOn ? 'block' : 'hidden'}`}
                />
                {!cameraOn && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className={`p-6 rounded-full ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-900'}`}>
                      <Camera size={48} className="text-gray-500" />
                    </div>
                    <p className="text-gray-400 text-sm font-medium">
                      Enciende la cámara para comenzar
                    </p>
                  </div>
                )}
                {/* Recording indicator */}
                {isCapturing && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg">
                    <CircleDot size={12} className="text-white animate-pulse" />
                    <span className="text-white text-xs font-bold">
                      REC {captureCountdown}s
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Frame Carousel ── */}
            <div className={`rounded-2xl border p-4 transition-colors ${
              theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Frames capturados
                  <span className={`ml-2 text-xs font-normal ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                    ({frames.length} {frames.length === 1 ? 'frame' : 'frames'})
                  </span>
                </h3>
                {frames.length > 0 && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => scrollCarousel('left')}
                      className={`p-1 rounded-lg transition-colors ${
                        theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      onClick={() => scrollCarousel('right')}
                      className={`p-1 rounded-lg transition-colors ${
                        theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}
              </div>

              {frames.length === 0 ? (
                <div className={`py-8 text-center text-sm font-medium ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
                  Los frames capturados aparecerán aquí
                </div>
              ) : (
                <div
                  ref={carouselRef}
                  className="flex gap-3 overflow-x-auto scrollbar-thin pb-2"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  {frames.map((frame, index) => (
                    <div key={index} className="flex-shrink-0 relative group">
                      <img
                        src={frame}
                        alt={`Frame ${index + 1}`}
                        className={`w-24 h-18 object-cover rounded-xl border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}
                      />
                      <div className="absolute bottom-1.5 left-1.5 bg-black/70 backdrop-blur-sm text-[10px] text-white font-bold px-1.5 py-0.5 rounded-md">
                        {index + 1}
                      </div>
                      <button
                        onClick={() => setFrames((prev) => prev.filter((_, i) => i !== index))}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Control Buttons ── */}
            <div className="flex flex-wrap gap-3">
              {/* Camera toggle */}
              <button
                onClick={toggleCamera}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all border ${
                  cameraOn
                    ? theme === 'dark' 
                      ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20' 
                      : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                    : theme === 'dark'
                      ? 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20'
                      : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
                }`}
              >
                {cameraOn ? (
                  <><CameraOff size={18} /> Apagar cámara</>
                ) : (
                  <><Camera size={18} /> Encender cámara</>
                )}
              </button>

              {/* Capture / Start Stop */}
              {mode === 'sequence' ? (
                <button
                  onClick={handleSequenceCapture}
                  disabled={!cameraOn}
                  className={`flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-medium text-sm transition-all shadow-lg ${
                    theme === 'dark' 
                      ? 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-800 disabled:text-gray-600 shadow-indigo-600/20' 
                      : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-500 shadow-indigo-600/20'
                  } disabled:shadow-none border-none`}
                >
                  <CircleDot size={18} /> Capturar
                </button>
              ) : (
                <button
                  onClick={isCapturing ? stopCapture : startVideoCapture}
                  disabled={!cameraOn && !isCapturing}
                  className={`flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-medium text-sm transition-all shadow-lg ${
                    isCapturing
                      ? 'bg-red-500 hover:bg-red-600 shadow-red-500/25'
                      : theme === 'dark'
                        ? 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-800 disabled:text-gray-600 shadow-indigo-600/20'
                        : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-500 shadow-indigo-600/20'
                  } disabled:shadow-none border-none`}
                >
                  {isCapturing ? (
                    <><Square size={18} /> Detener ({captureCountdown}s)</>
                  ) : (
                    <><CircleDot size={18} /> Iniciar captura</>
                  )}
                </button>
              )}

              {/* Process */}
              <button
                onClick={processFrames}
                disabled={processing || frames.length === 0}
                className={`flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-medium text-sm transition-all shadow-lg ${
                  theme === 'dark'
                    ? 'bg-purple-600 hover:bg-purple-700 disabled:bg-gray-800 disabled:text-gray-600 shadow-purple-600/20'
                    : 'bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:text-gray-500 shadow-purple-600/20'
                } disabled:shadow-none border-none`}
              >
                {processing ? (
                  <><Loader2 size={18} className="animate-spin" /> Procesando...</>
                ) : (
                  <><Zap size={18} /> Procesar</>
                )}
              </button>

              {/* Clear */}
              <button
                onClick={clearFrames}
                disabled={frames.length === 0}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all border ${
                  theme === 'dark'
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700 disabled:bg-gray-900 disabled:text-gray-700 disabled:border-gray-800'
                    : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300 disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200 shadow-sm disabled:shadow-none'
                }`}
              >
                <Trash2 size={18} /> Limpiar
              </button>
            </div>
          </div>

          {/* ═══ RIGHT: Results Panel ═══ */}
          <div className="lg:col-span-1">
            <div className={`rounded-2xl border p-6 sticky top-24 transition-colors ${
              theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200 shadow-sm'
            }`}>
              <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                <Zap size={20} className="text-indigo-500" />
                Resultado
              </h3>

              {processing ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 size={40} className="text-indigo-500 animate-spin" />
                  <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    Procesando frames con IA...
                  </p>
                  <div className={`w-full rounded-full h-1.5 overflow-hidden ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200'}`}>
                    <div className="bg-indigo-500 h-full rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                </div>
              ) : result ? (
                <div className="space-y-5">
                  {/* Main result */}
                  <div className={`border rounded-xl p-6 text-center relative ${
                    theme === 'dark' 
                      ? 'bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border-indigo-500/30' 
                      : 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200 shadow-inner'
                  }`}>
                    <p className={`text-sm font-bold uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-600'}`}>
                      Traducción
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <p className={`text-4xl font-extrabold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {result.resultado}
                      </p>
                      <button
                        onClick={() => speak(result.resultado)}
                        className={`p-2 rounded-full transition-all ${
                          theme === 'dark' ? 'text-indigo-400 hover:text-white hover:bg-indigo-500/30' : 'text-indigo-600 hover:bg-indigo-200'
                        }`}
                        title="Escuchar respuesta"
                      >
                        <Volume2 size={24} />
                      </button>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${getTypeColor(result.tipo)}`}>
                      {result.tipo}
                    </span>
                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${getConfidenceColor(result.confianza)}`}>
                      Confianza: {result.confianza}
                    </span>
                  </div>

                  {/* Bloque de Análisis de Movimiento */}
                  {result.analisis_movimiento && (
                    <div className={`border rounded-xl p-5 mt-4 ${
                      theme === 'dark' ? 'bg-gray-800/40 border-gray-700/50' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2 ${
                        theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
                      }`}>
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                        Razonamiento de la IA
                      </p>
                      <p className={`text-sm leading-relaxed italic ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        "{result.analisis_movimiento}"
                      </p>
                    </div>
                  )}
                  
                  {/* Alternatives */}
                  {result.alternativas && result.alternativas.length > 0 && (
                    <div>
                      <p className={`text-sm font-bold mb-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        Alternativas
                      </p>
                      <div className="space-y-2">
                        {result.alternativas.map((alt, index) => (
                          <div
                            key={index}
                            className={`flex items-center justify-between border rounded-lg px-4 py-2.5 ${
                              theme === 'dark' ? 'bg-gray-800/50 border-gray-700/50' : 'bg-white border-gray-200 shadow-sm'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <CheckCircle size={16} className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} />
                              <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                                {alt.seña}
                              </span>
                            </div>
                            <button
                              onClick={() => speak(alt.seña)}
                              className={`p-1.5 rounded-md transition-colors ${
                                theme === 'dark' ? 'text-gray-400 hover:text-indigo-400 hover:bg-gray-700' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                              }`}
                            >
                              <Volume2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className={`p-5 rounded-full ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    <Zap size={32} className={theme === 'dark' ? 'text-gray-600' : 'text-gray-400'} />
                  </div>
                  <p className={`text-sm font-medium text-center ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                    Los resultados aparecerán aquí
                    <br />
                    después de procesar los frames
                  </p>
                  {!user && (
                    <p className="text-indigo-500 text-xs font-bold text-center mt-2">
                      Inicia sesión para procesar
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

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
          {/* Decoración de fondo */}
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
                    setAuthModalOpen(true);
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
              {/* Pregunta 1 */}
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
      
              {/* Pregunta 2 */}
              <div className="space-y-4">
                <label className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                  ¿Cuál es tu nivel de conocimiento en LSM?
                </label>
                <select name="nivel" className={`w-full border rounded-xl p-3.5 text-sm font-medium outline-none transition-colors ${
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
      
              {/* Pregunta 3 */}
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
      
              {/* Pregunta Abierta */}
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
                className={`w-full py-4 rounded-xl font-bold transition-all shadow-lg text-lg ${
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
      
      {/* ═══════════ FOOTER ═══════════ */}
      <footer className={`border-t py-12 text-center transition-colors ${
        theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
      }`}>
        <div className="flex justify-center gap-6 mb-6">
          <Hand className={theme === 'dark' ? 'text-gray-600' : 'text-gray-400'} size={24} />
          <ShieldCheck className={theme === 'dark' ? 'text-gray-600' : 'text-gray-400'} size={24} />
          <Layers className={theme === 'dark' ? 'text-gray-600' : 'text-gray-400'} size={24} />
        </div>
        <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
          © 2026 HandsTranslator. Tecnología con impacto social.
        </p>
      </footer>
      
      {/* ═══════════ AUTH MODAL ═══════════ */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  )
}
