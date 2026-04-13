"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Screen } from "@/app/page"
import { Share2, CheckCircle, Timer, Footprints, Flame, Gem, Trophy, MapPin, Crown, Home, Map as MapIcon, User } from "lucide-react"

interface RewardScreenProps {
  onNavigate: (screen: Screen) => void
}

export function RewardScreen({ onNavigate }: RewardScreenProps) {
  const [showXpAnimation, setShowXpAnimation] = useState(false)
  const [animatedXp, setAnimatedXp] = useState(0)

  useEffect(() => {
    setShowXpAnimation(true)
    
    // Animate XP count
    const interval = setInterval(() => {
      setAnimatedXp((prev) => {
        if (prev >= 150) {
          clearInterval(interval)
          return 150
        }
        return prev + 5
      })
    }, 30)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-950 dark:to-gray-900 flex flex-col">
      {/* HEADER - Empty for focus */}
      <header className="h-4" />

      <main className="flex-1 p-6 flex flex-col items-center justify-center">
        {/* SUCCESS HERO */}
        <div className="text-center space-y-4 mb-8">
          <div
            className={`w-20 h-20 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center transition-all duration-700 shadow-xl ${
              showXpAnimation ? "scale-100 opacity-100" : "scale-50 opacity-0"
            }`}
          >
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Квест завершён!</h1>
            <p className="text-muted-foreground text-lg">Отличная работа!</p>
          </div>
        </div>

        {/* STATS SECTION */}
        <Card className="w-full max-w-sm p-4 border-0 shadow-lg mb-6">
          <h2 className="text-lg font-semibold mb-4 text-center">Твои результаты</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
              <Timer className="w-6 h-6 text-purple-600 mb-2" />
              <span className="text-xs text-muted-foreground mb-1">ВРЕМЯ</span>
              <span className="font-bold text-lg">15 мин</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <MapPin className="w-6 h-6 text-blue-600 mb-2" />
              <span className="text-xs text-muted-foreground mb-1">ДИСТАНЦИЯ</span>
              <span className="font-bold text-lg">1.2 км</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
              <Footprints className="w-6 h-6 text-green-600 mb-2" />
              <span className="text-xs text-muted-foreground mb-1">ШАГИ</span>
              <span className="font-bold text-lg">1500</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
              <Flame className="w-6 h-6 text-orange-600 mb-2" />
              <span className="text-xs text-muted-foreground mb-1">КАЛОРИИ</span>
              <span className="font-bold text-lg">120</span>
            </div>
          </div>
        </Card>

        {/* REWARD SECTION */}
        <Card className="w-full max-w-sm p-6 border-0 shadow-lg mb-6 text-center">
          <h2 className="text-lg font-semibold mb-4">Твоя награда</h2>

          {/* Animated XP */}
          <div
            className={`text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent transition-all duration-700 ${
              showXpAnimation ? "scale-100 opacity-100" : "scale-50 opacity-0"
            }`}
          >
            +{animatedXp} XP
          </div>

          {/* Badge */}
          <div className="flex items-center justify-center gap-3 mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/40 rounded-lg flex items-center justify-center">
              <Trophy className="w-6 h-6 text-orange-600" />
            </div>
            <span className="font-semibold text-orange-600">Первопроходец</span>
          </div>

          {/* New territory */}
          <div className="flex items-center justify-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center">
              <MapPin className="w-6 h-6 text-green-600" />
            </div>
            <span className="font-semibold text-green-600">Открыт новый район: Центр</span>
          </div>
        </Card>

        {/* LEVEL PROGRESS */}
        <Card className="w-full max-w-sm p-4 border-0 shadow-lg mb-6">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold">Уровень 2</h3>
            </div>
            <span className="text-sm text-muted-foreground">150 / 300 XP</span>
          </div>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden mb-2">
            <div className="w-1/2 h-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full transition-all duration-1000" />
          </div>
          <p className="text-xs text-muted-foreground text-center">До уровня 3: 150 XP</p>
        </Card>
      </main>

      {/* CTA SECTION */}
      <div className="p-4 space-y-2">
        <Button className="w-full h-12 text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" onClick={() => onNavigate("quest-map")}>
          Продолжить
        </Button>
        <Button variant="outline" className="w-full h-12">
          <Share2 className="w-5 h-5 mr-2" />
          Поделиться
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
