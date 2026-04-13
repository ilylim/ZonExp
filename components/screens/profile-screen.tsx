"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Screen } from "@/app/page"
import { Settings, Lock, Map, User, LogOut, ChevronRight, Trophy, Footprints, Sparkles, Calendar, Bell, Home, X } from "lucide-react"

interface ProfileScreenProps {
  onNavigate: (screen: Screen) => void
  onLogout: () => void
  userName: string
  userLevel: number
  userXp: number
  userCompletedQuests: number
}

const territories = [
  { name: "Центр Красноярска", unlocked: true },
  { name: "Столбы", unlocked: false, level: 5 },
  { name: "Остров Татышев", unlocked: false, level: 8 },
  { name: "Бобровый лог", unlocked: false, level: 10 },
]

const badges = [
  { id: 1, icon: Trophy, name: "Первопроходец", unlocked: true },
  { id: 2, icon: Sparkles, name: "Звезда недели", unlocked: true },
  { id: 3, icon: Footprints, name: "Марафонец", unlocked: true },
  { id: 4, icon: Map, name: "Ночной странник", unlocked: false },
  { id: 5, icon: Trophy, name: "Снайпер", unlocked: false },
  { id: 6, icon: User, name: "Король района", unlocked: false },
]

export function ProfileScreen({ onNavigate, onLogout, userName, userLevel, userXp, userCompletedQuests }: ProfileScreenProps) {
  const xpForNextLevel = userLevel * 300
  const xpPercentage = Math.min((userXp / xpForNextLevel) * 100, 100)
  const [showSettings, setShowSettings] = useState(false)

  const totalSteps = userCompletedQuests * 1875
  const totalDistance = (userCompletedQuests * 1.8).toFixed(1)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* HEADER */}
      <header className="flex items-center justify-between p-4 border-b bg-white dark:bg-gray-950 shrink-0">
        <h1 className="text-xl font-bold">Профиль</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Bell className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}>
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-900 p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Настройки</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-muted rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              <Button variant="outline" className="w-full justify-between">
                Настройки аккаунта
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" className="w-full justify-between">
                Помощь и поддержка
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-900/20"
                onClick={() => { onLogout(); setShowSettings(false) }}
              >
                <span className="flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  Выйти из аккаунта
                </span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-20">
        {/* PROFILE HERO */}
        <div className="p-6 text-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-b">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
            {userName.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-2xl font-bold mb-1">{userName}</h2>
          <p className="text-3xl font-bold mb-3 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Уровень {userLevel}
          </p>
          <div className="max-w-xs mx-auto">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Прогресс</span>
              <span>{userXp} / {xpForNextLevel} XP</span>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${xpPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* STATS SECTION */}
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold mb-4">Статистика</h3>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 text-center hover:shadow-md transition-all">
              <div className="w-10 h-10 mx-auto mb-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center">
                <Trophy className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-2xl font-bold">{userCompletedQuests}</span>
              <p className="text-xs text-muted-foreground mt-1">Квестов</p>
            </Card>
            <Card className="p-4 text-center hover:shadow-md transition-all">
              <div className="w-10 h-10 mx-auto mb-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
                <Footprints className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-2xl font-bold">{totalSteps.toLocaleString()}</span>
              <p className="text-xs text-muted-foreground mt-1">Шагов</p>
            </Card>
            <Card className="p-4 text-center hover:shadow-md transition-all">
              <div className="w-10 h-10 mx-auto mb-2 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-2xl font-bold">{userXp.toLocaleString()}</span>
              <p className="text-xs text-muted-foreground mt-1">XP</p>
            </Card>
            <Card className="p-4 text-center hover:shadow-md transition-all">
              <div className="w-10 h-10 mx-auto mb-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-2xl font-bold">{Math.max(userCompletedQuests, 1)}</span>
              <p className="text-xs text-muted-foreground mt-1">Дней активно</p>
            </Card>
          </div>
        </div>

        {/* TERRITORIES SECTION */}
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold mb-4">Открытые территории</h3>
          <div className="space-y-2">
            {territories.map((territory) => (
              <div
                key={territory.name}
                className="flex items-center justify-between p-3 rounded-lg border hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${territory.unlocked ? "bg-purple-100 dark:bg-purple-900/50" : "bg-muted"}`}>
                    <Map className={`w-4 h-4 ${territory.unlocked ? "text-purple-600" : "text-muted-foreground"}`} />
                  </div>
                  <span className={territory.unlocked ? "" : "text-muted-foreground"}>
                    {territory.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!territory.unlocked && (
                    <span className="text-xs text-muted-foreground">
                      Уровень {territory.level}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BADGES SECTION */}
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold mb-4">Коллекция бейджей</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className={`flex flex-col items-center shrink-0 p-3 rounded-lg border-2 ${badge.unlocked
                    ? "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20"
                    : "border-muted bg-muted/50 opacity-50"
                  }`}
              >
                <div className="relative">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${badge.unlocked ? "bg-purple-100 dark:bg-purple-900/50" : "bg-muted"}`}>
                    <badge.icon className={`w-6 h-6 ${badge.unlocked ? "text-purple-600" : "text-muted-foreground"}`} />
                  </div>
                  {!badge.unlocked && (
                    <Lock className="absolute -bottom-1 -right-1 w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <span className="text-xs mt-2 text-center max-w-[80px] truncate">
                  {badge.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* SETTINGS LINKS - removed, now in modal */}
      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 flex items-center justify-around p-3 border-t bg-white dark:bg-gray-950 z-40">
        <button
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => onNavigate("quest-map")}
        >
          <Home className="w-6 h-6" />
          <span className="text-xs">Главная</span>
        </button>
        <button
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => onNavigate("quest-list")}
        >
          <Map className="w-6 h-6" />
          <span className="text-xs">Квесты</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-purple-600">
          <User className="w-6 h-6" />
          <span className="text-xs font-medium">Профиль</span>
        </button>
      </nav>
    </div>
  )
}
