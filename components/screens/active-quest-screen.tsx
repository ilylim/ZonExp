"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import type { Screen } from "@/app/page"
import { Pause, X, MapPin, Footprints, Gem, Timer, CheckCircle, Home, Map as MapIcon, User } from "lucide-react"

interface ActiveQuestScreenProps {
  onNavigate: (screen: Screen) => void
}

export function ActiveQuestScreen({ onNavigate }: ActiveQuestScreenProps) {
  const [time, setTime] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(45)
  const [showCheckpoint, setShowCheckpoint] = useState(false)
  const [xp, setXp] = useState(70)

  useEffect(() => {
    if (isPaused) return

    const timer = setInterval(() => {
      setTime((t) => t + 1)
      setProgress((p) => Math.min(p + 0.5, 100))
      setXp((x) => Math.min(x + 1, 150))
    }, 1000)

    return () => clearInterval(timer)
  }, [isPaused])

  useEffect(() => {
    // Show checkpoint every 30 seconds for demo
    const checkpointTimer = setInterval(() => {
      if (!isPaused) {
        setShowCheckpoint(true)
        setTimeout(() => setShowCheckpoint(false), 3000)
      }
    }, 30000)

    return () => clearInterval(checkpointTimer)
  }, [isPaused])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const handleComplete = () => {
    onNavigate("reward")
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* HEADER */}
      <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 border-b shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsPaused(!isPaused)}
        >
          <Pause className="w-5 h-5" />
        </Button>
        <div className="text-center">
          <span className="text-3xl font-bold font-mono bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">{formatTime(time)}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleComplete}
        >
          <X className="w-5 h-5" />
        </Button>
      </header>

      {/* PAUSE OVERLAY */}
      {isPaused && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 text-center space-y-4 max-w-sm mx-4 shadow-2xl">
            <div className="w-16 h-16 mx-auto bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
              <Pause className="w-8 h-8 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold">Пауза</h2>
            <p className="text-muted-foreground">Трекинг приостановлен</p>
            <div className="space-y-2">
              <Button className="w-full" onClick={() => setIsPaused(false)}>Продолжить</Button>
              <Button variant="outline" className="w-full" onClick={() => onNavigate("quest-map")}>Отменить квест</Button>
            </div>
          </div>
        </div>
      )}

      {/* MAP SECTION */}
      <div className="relative flex-1 min-h-[300px] bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground p-4">
            <div className="w-16 h-16 mx-auto mb-2 bg-white/50 dark:bg-gray-800/50 rounded-lg flex items-center justify-center">
              <MapPin className="w-8 h-8 text-purple-600" />
            </div>
            <span className="text-sm font-medium">Карта с маршрутом</span>
            <span className="text-xs block mt-1">Здесь будет интерактивная карта</span>
          </div>
        </div>

        {/* Route visualization */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          {/* Full route */}
          <path
            d="M 10 20 Q 30 15 50 30 T 90 80"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="2"
            strokeDasharray="3,2"
          />
          {/* Passed route */}
          <path
            d="M 10 20 Q 20 18 30 25"
            fill="none"
            stroke="url(#routeGradient)"
            strokeWidth="3"
          />
          <defs>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
        </svg>

        {/* User position - pulsing dot */}
        <div className="absolute" style={{ top: "28%", left: "28%" }}>
          <div className="relative">
            <div className="w-6 h-6 bg-purple-600 rounded-full border-4 border-white dark:border-gray-900 shadow-lg z-10 relative" />
            <div className="absolute inset-0 w-6 h-6 bg-purple-600 rounded-full animate-ping opacity-30" />
            <div className="absolute inset-0 w-6 h-6 bg-purple-600/20 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Start marker */}
        <div className="absolute top-4 left-2 px-2 py-1 bg-green-100 dark:bg-green-900/50 rounded-full text-xs font-medium">
          <span className="text-green-600">Старт</span>
        </div>

        {/* My location button */}
        <Button
          size="icon"
          variant="outline"
          className="absolute bottom-4 right-4 bg-white dark:bg-gray-900 shadow-lg"
        >
          <MapPin className="w-5 h-5 text-purple-600" />
        </Button>
      </div>

      {/* PROGRESS BAR */}
      <div className="px-4 py-3 bg-white dark:bg-gray-900 border-b">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-purple-600">{Math.round(progress)}%</span>
            <span className="text-muted-foreground">
              Пройдено {Math.round(progress * 12)} м из 1200 м
            </span>
          </div>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-3 gap-px bg-gray-200 dark:bg-gray-800">
        <div className="flex flex-col items-center gap-1 py-4 px-3 bg-white dark:bg-gray-900">
          <Timer className="w-5 h-5 text-purple-600 mb-1" />
          <span className="text-xs text-muted-foreground">ВРЕМЯ</span>
          <span className="text-sm font-semibold">{formatTime(time)}</span>
        </div>
        <div className="flex flex-col items-center gap-1 py-4 px-3 bg-white dark:bg-gray-900">
          <Footprints className="w-5 h-5 text-blue-600 mb-1" />
          <span className="text-xs text-muted-foreground">ШАГИ</span>
          <span className="text-sm font-semibold">{Math.round(time * 1.5)}</span>
        </div>
        <div className="flex flex-col items-center gap-1 py-4 px-3 bg-white dark:bg-gray-900">
          <Gem className="w-5 h-5 text-yellow-600 mb-1" />
          <span className="text-xs text-muted-foreground">XP</span>
          <span className="text-sm font-semibold text-yellow-600">+{xp}</span>
        </div>
      </div>

      {/* CHECKPOINT NOTIFICATION */}
      {showCheckpoint && (
        <div className="fixed top-20 left-4 right-4 bg-white dark:bg-gray-900 rounded-xl shadow-xl p-4 z-30 border border-purple-200 dark:border-purple-800 animate-in slide-in-from-top">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-green-600">Чекпоинт пройден!</p>
              <p className="text-sm text-muted-foreground">+20 XP</p>
            </div>
          </div>
        </div>
      )}

      {/* CONTROLS SECTION */}
      <div className="p-4 bg-white dark:bg-gray-900 border-t space-y-2">
        <Button
          className="w-full h-12 text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          onClick={handleComplete}
        >
          Завершить квест
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => onNavigate("quest-map")}
        >
          Отмена
        </Button>
      </div>

      {/* BOTTOM NAVIGATION */}
      <nav className="flex items-center justify-around p-3 border-t bg-white dark:bg-gray-950">
        <button
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => onNavigate("quest-map")}
        >
          <Home className="w-6 h-6" />
          <span className="text-xs">Главная</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-purple-600">
          <MapIcon className="w-6 h-6" />
          <span className="text-xs font-medium">Квесты</span>
        </button>
        <button
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => onNavigate("profile")}
        >
          <User className="w-6 h-6" />
          <span className="text-xs">Профиль</span>
        </button>
      </nav>
    </div>
  )
}
