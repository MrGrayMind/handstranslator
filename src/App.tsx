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
} from 'lucide-react'

type Mode = 'sequence' | 'video'

interface TranslationResult {
  resultado: string
  tipo: string
  confianza: string
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

  // ── User limits ──
  const [userLimits, setUserLimits] = useState<UserLimits>({
    max_frames: 0,
    max_duration_s: 0,
  })
  const [canUse, setCanUse] = useState(true)
  const [limitReason, setLimitReason] = useState('')
  const [limitsLoaded, setLimitsLoaded] = useState(false)

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
      console.log("asdasd")
      //fetchUserLimits()
    } else {
      console.log("sin usuario")
      setLimitsLoaded(false)
      setCanUse(true)
    }
  }, [user])

  const fetchUserLimits = async () => {
    console.log("entro")
    try {
      const { data, error } = await supabase.functions.invoke('user-status')
      console.log(data)
      if (!error && data) {
        setCanUse(data.can_use ?? true)
        setLimitReason(data.reason ?? '')
        setUserLimits(
          data.limits ?? { max_frames: 0, max_duration_s: 0 }
        )
      }
    } catch (err) {
      console.error('Error fetching user limits:', err)
    } finally {
      setLimitsLoaded(true)
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
    captureFrame()
  }

  // ── Video mode: auto capture ──
  const startVideoCapture = () => {
    if (!user) {
      setAuthModalOpen(true)
      return
    }
    if (!canUse) {
      alert(limitReason || 'No puedes usar el servicio en este momento')
      return
    }
    if (!cameraOn) {
      alert('Primero enciende la cámara')
      return
    }

    setIsCapturing(true)
    const maxFrames = userLimits.max_frames || 10
    const maxDuration = userLimits.max_duration_s || 5
    let frameCount = 0

    // Calculate interval to capture max_frames evenly over max_duration
    const intervalMs = (maxDuration * 1000) / maxFrames

    // Countdown
    setCaptureCountdown(maxDuration)

    captureIntervalRef.current = setInterval(() => {
      captureFrame()
      frameCount++

      if (frameCount >= maxFrames) {
        stopCapture()
      }
    }, intervalMs)
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
      // Upload each frame to Supabase Storage
      for (let i = 0; i < frames.length; i++) {
        const response = await fetch(frames[i])
        const blob = await response.blob()

        const { error: uploadError } = await supabase.storage
          .from('frames')
          .upload(`${user.id}/frame${i + 1}.jpg`, blob, {
            upsert: true,
            contentType: 'image/jpeg',
          })

        if (uploadError) {
          console.error('Error uploading frame:', uploadError)
        }
      }

      // Call the translate edge function
      const { data, error } = await supabase.functions.invoke('translate', {
        body: {
          userId: user.id,
          frameCount: frames.length,
        },
      })

      if (error) {
        console.error('Error from translate:', error)
        alert('Error al procesar los frames: ' + (error.message || 'Error desconocido'))
      } else if (data) {
        setResult(data)
      }
    } catch (err) {
      console.error('Error processing:', err)
      alert('Error al procesar los frames')
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
  //  RENDER
  // ════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ═══════════ HEADER ═══════════ */}
      <header className="sticky top-0 z-40 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-xl">
                <Hand size={24} className="text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                HandsTranslator
              </span>
            </div>

            {/* User controls */}
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <span className="hidden sm:block text-sm text-gray-400">
                    {user.user_metadata?.username || user.email}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-all text-sm"
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
                  Iniciar Sesión
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ── Mode Selector ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex bg-gray-900 rounded-xl p-1.5 border border-gray-800">
            <button
              onClick={() => setMode('sequence')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'sequence'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Layers size={16} />
              Secuencia de señas
            </button>
            <button
              onClick={() => setMode('video')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'video'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Video size={16} />
              Video
            </button>
          </div>

          {/* User limits info */}
          {user && limitsLoaded && (
            <div className="flex items-center gap-2 text-xs">
              {canUse ? (
                <>
                  <ShieldCheck size={14} className="text-green-400" />
                  <span className="text-gray-400">
                    Máx. {userLimits.max_frames} frames · {userLimits.max_duration_s}s video
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle size={14} className="text-yellow-400" />
                  <span className="text-yellow-400">{limitReason}</span>
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
            <div className="relative bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <div className="aspect-video bg-gray-900 relative flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${cameraOn ? 'block' : 'hidden'}`}
                />
                {!cameraOn && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className="bg-gray-800 p-6 rounded-full">
                      <Camera size={48} className="text-gray-600" />
                    </div>
                    <p className="text-gray-500 text-sm">
                      Enciende la cámara para comenzar
                    </p>
                  </div>
                )}
                {/* Recording indicator */}
                {isCapturing && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600/90 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <CircleDot size={12} className="text-white animate-pulse" />
                    <span className="text-white text-xs font-medium">
                      REC {captureCountdown}s
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Frame Carousel ── */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-300">
                  Frames capturados
                  <span className="ml-2 text-xs text-gray-500">
                    ({frames.length} {frames.length === 1 ? 'frame' : 'frames'})
                  </span>
                </h3>
                {frames.length > 0 && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => scrollCarousel('left')}
                      className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => scrollCarousel('right')}
                      className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>

              {frames.length === 0 ? (
                <div className="py-8 text-center text-gray-600 text-sm">
                  Los frames capturados aparecerán aquí
                </div>
              ) : (
                <div
                  ref={carouselRef}
                  className="flex gap-2 overflow-x-auto scrollbar-thin pb-2"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  {frames.map((frame, index) => (
                    <div
                      key={index}
                      className="flex-shrink-0 relative group"
                    >
                      <img
                        src={frame}
                        alt={`Frame ${index + 1}`}
                        className="w-24 h-18 object-cover rounded-lg border border-gray-700"
                      />
                      <div className="absolute bottom-1 left-1 bg-black/70 text-[10px] text-gray-300 px-1.5 py-0.5 rounded">
                        {index + 1}
                      </div>
                      <button
                        onClick={() =>
                          setFrames((prev) => prev.filter((_, i) => i !== index))
                        }
                        className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
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
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  cameraOn
                    ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                    : 'bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20'
                }`}
              >
                {cameraOn ? (
                  <>
                    <CameraOff size={16} />
                    Apagar cámara
                  </>
                ) : (
                  <>
                    <Camera size={16} />
                    Encender cámara
                  </>
                )}
              </button>

              {/* Capture / Start Stop */}
              {mode === 'sequence' ? (
                <button
                  onClick={handleSequenceCapture}
                  disabled={!cameraOn}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-indigo-600/25 disabled:shadow-none"
                >
                  <CircleDot size={16} />
                  Capturar
                </button>
              ) : (
                <button
                  onClick={isCapturing ? stopCapture : startVideoCapture}
                  disabled={!cameraOn && !isCapturing}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                    isCapturing
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/25'
                      : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-800 disabled:text-gray-600 text-white shadow-lg shadow-indigo-600/25 disabled:shadow-none'
                  }`}
                >
                  {isCapturing ? (
                    <>
                      <Square size={16} />
                      Detener ({captureCountdown}s)
                    </>
                  ) : (
                    <>
                      <CircleDot size={16} />
                      Iniciar captura
                    </>
                  )}
                </button>
              )}

              {/* Process */}
              <button
                onClick={processFrames}
                disabled={processing || frames.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-purple-600/25 disabled:shadow-none"
              >
                {processing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    Procesar
                  </>
                )}
              </button>

              {/* Clear */}
              <button
                onClick={clearFrames}
                disabled={frames.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:text-gray-600 text-gray-300 rounded-xl font-medium text-sm transition-all border border-gray-700 disabled:border-gray-800"
              >
                <Trash2 size={16} />
                Limpiar
              </button>
            </div>
          </div>

          {/* ═══ RIGHT: Results Panel ═══ */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 sticky top-24">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Zap size={18} className="text-indigo-400" />
                Resultado
              </h3>

              {processing ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 size={40} className="text-indigo-400 animate-spin" />
                  <p className="text-gray-400 text-sm text-center">
                    Procesando frames con IA...
                  </p>
                  <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-indigo-600 h-full rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                </div>
              ) : result ? (
                <div className="space-y-4">
                  {/* Main result */}
                  <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-xl p-5 text-center">
                    <p className="text-sm text-gray-400 mb-1">Traducción</p>
                    <p className="text-3xl font-bold text-white">
                      {result.resultado}
                    </p>
                  </div>

                  {/* Badges */}
                  <div className="flex gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${getTypeColor(result.tipo)}`}
                    >
                      {result.tipo}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${getConfidenceColor(result.confianza)}`}
                    >
                      Confianza: {result.confianza}
                    </span>
                  </div>

                  {/* Alternatives */}
                  {result.alternativas && result.alternativas.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-400 mb-2">
                        Alternativas
                      </p>
                      <div className="space-y-1.5">
                        {result.alternativas.map((alt, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2"
                          >
                            <CheckCircle
                              size={14}
                              className="text-gray-500 flex-shrink-0"
                            />
                            <span className="text-sm text-gray-300">
                              {alt.seña}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="bg-gray-800 p-4 rounded-full">
                    <Zap size={32} className="text-gray-600" />
                  </div>
                  <p className="text-gray-500 text-sm text-center">
                    Los resultados aparecerán aquí
                    <br />
                    después de procesar los frames
                  </p>
                  {!user && (
                    <p className="text-indigo-400/60 text-xs text-center mt-2">
                      Inicia sesión para procesar
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ═══════════ AUTH MODAL ═══════════ */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  )
}
