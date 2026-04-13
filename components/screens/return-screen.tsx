"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Screen } from "@/app/page"
import { Clock, Gem, Heart, Crown, Timer, MapPin, ChevronRight, Home, Map as MapIcon, User } from "lucide-react"

interface ReturnScreenProps {
  onNavigate: (screen: Screen) => void
  userName: string
}

export function ReturnScreen({ onNavigate, userName }: ReturnScreenProps) {
  const [timeLeft, setTimeLeft] = useState(24 * 60 * 60) // 24 hours in seconds

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTimeLeft = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}ч ${minutes}м`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-950 dark:to-gray-900 flex flex-col">
      {/* HEADER - Empty for focus */}
      <header className="h-4" />

      <main className="flex-1 p-6 flex flex-col items-center justify-center">
        {/* WELCOME HERO */}
        <div className="text-center space-y-4 mb-8">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center shadow-xl animate-pulse">
            <Heart className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">С возвращением, {userName}!</h1>
            <p className="text-muted-foreground text-lg">Мы скучали!</p>
          </div>
        </div>

        {/* SUPPORT MESSAGE */}
        <Card className="w-full max-w-sm p-6 border-0 shadow-lg mb-6 text-center">
          <div className="w-12 h-12 mx-auto mb-4 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
            <Crown className="w-6 h-6 text-purple-600" />
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            Перерывы — это нормально. Главное — вернуться.
          </p>
          <p className="text-sm text-muted-foreground">
            Твой прогресс сохранён, а персонаж ждёт новых приключений.
          </p>
        </Card>

        {/* SPECIAL QUEST */}
        <div className="w-full max-w-sm mb-6">
          <h2 className="text-lg font-semibold mb-3 text-center">Мягкий старт</h2>
          <Card
            className="p-4 border-0 shadow-lg cursor-pointer hover:shadow-xl transition-all"
            onClick={() => onNavigate("quest-details")}
          >
            <div className="h-2 bg-gradient-to-r from-green-400 to-emerald-500 rounded-t-xl -mx-4 -mt-4 mb-4" />
            <h3 className="font-medium mb-3">Прогулка по району</h3>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                10 мин
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full text-xs font-medium">
                Лёгкий
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
              <div className="flex items-center gap-2">
                <Gem className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium">+100 XP + Бонус возвращения</span>
              </div>
              <ChevronRight className="w-5 h-5 text-purple-600" />
            </div>
          </Card>
        </div>

        {/* BONUS SECTION */}
        <Card className="w-full max-w-sm p-4 border-0 shadow-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white">
          <div className="text-center">
            <h3 className="font-semibold mb-2">Бонус за возвращение</h3>
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Gem className="w-6 h-6" />
              </div>
              <span className="text-xl font-bold">+50 XP к первому квесту</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm bg-white/10 rounded-full px-4 py-2">
              <Timer className="w-4 h-4" />
              <span>Действует {formatTimeLeft(timeLeft)}</span>
            </div>
          </div>
        </Card>
      </main>

      {/* CTA SECTION */}
      <div className="p-4 space-y-2">
        <Button
          className="w-full h-12 text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          onClick={() => onNavigate("active-quest")}
        >
          Начать квест
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => onNavigate("quest-map")}
        >
          Позже
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
        <button
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => onNavigate("quest-details")}
        >
          <MapIcon className="w-6 h-6" />
          <span className="text-xs">Квесты</span>
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
