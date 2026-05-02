"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
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
    <div className="min-h-screen bg-background flex flex-col relative z-10 pb-20">
      <div className="absolute inset-0 bg-[url('/pixel-pattern.png')] opacity-5 mix-blend-overlay pointer-events-none"></div>
      
      {/* HEADER - Empty for focus */}
      <header className="h-4" />

      <main className="flex-1 p-4 flex flex-col items-center justify-center relative z-10">
        {/* WELCOME HERO */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center space-y-4 mb-8 w-full max-w-sm"
        >
          <div className="w-24 h-24 mx-auto border-pixel bg-accent flex items-center justify-center shadow-[4px_4px_0_0_rgba(0,0,0,0.5)] animate-pulse">
            <Heart className="w-12 h-12 text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.3)]" />
          </div>
          <div className="space-y-2 bg-card border-pixel-sm p-4 inline-block mx-auto">
            <h1 className="text-xl font-press-start text-primary text-pixel-shadow leading-relaxed uppercase">С ВОЗВРАЩЕНИЕМ,<br/>{userName}!</h1>
            <p className="font-bold text-muted-foreground uppercase">Гильдия ждала тебя!</p>
          </div>
        </motion.div>

        {/* SUPPORT MESSAGE */}
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-sm mb-6"
        >
          <Card className="p-4 border-pixel bg-secondary text-center">
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <img src="/emblem-pixel.png" alt="Emblem" className="w-full h-full object-contain" />
            </div>
            <p className="text-sm font-bold text-secondary-foreground mb-2 uppercase">
              Отдых у костра окончен.
            </p>
            <p className="text-sm font-vt323 text-lg text-muted-foreground">
              Твой прогресс сохранён в свитках, а мир ждёт новых свершений.
            </p>
          </Card>
        </motion.div>

        {/* BONUS SECTION */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-sm mb-6"
        >
          <Card className="p-0 border-pixel bg-card overflow-hidden">
            <div className="bg-accent p-3 border-b-4 border-border text-center">
              <h3 className="font-press-start text-xs text-white text-pixel-shadow">ДАР ВОЗВРАЩЕНИЯ</h3>
            </div>
            <div className="p-5 text-center bg-[url('/pixel-pattern.png')] bg-repeat bg-[length:16px_16px]">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-12 h-12 bg-background border-pixel-sm flex items-center justify-center">
                  <Gem className="w-8 h-8 text-accent" />
                </div>
                <span className="text-2xl font-press-start text-accent drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]">+50 XP</span>
              </div>
              <p className="font-bold mb-4 uppercase">Бонус к первому квесту!</p>
              <div className="inline-flex items-center justify-center gap-2 text-sm bg-background border-pixel-sm px-4 py-2">
                <Timer className="w-5 h-5 text-destructive" />
                <span className="font-press-start text-xs text-destructive">ТАЙМЕР: {formatTimeLeft(timeLeft)}</span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* SPECIAL QUEST */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="w-full max-w-sm mb-6"
        >
          <h2 className="text-sm font-press-start mb-3 text-center text-pixel-shadow text-primary">ЛЕГКИЙ СТАРТ</h2>
          <Card
            className="p-0 border-pixel bg-card cursor-pointer hover:bg-muted transition-colors group"
            onClick={() => onNavigate("quest-details")}
          >
            <div className="h-3 bg-green-500 border-b-4 border-border" />
            <div className="p-4">
              <h3 className="font-bold text-lg uppercase mb-3 group-hover:text-primary transition-colors">Патруль района</h3>
              <div className="flex items-center gap-4 text-sm font-bold text-muted-foreground mb-4">
                <span className="flex items-center gap-1 bg-background border-pixel-sm px-2 py-1">
                  <Clock className="w-4 h-4 text-accent" />
                  10 мин
                </span>
                <span className="flex items-center gap-1 px-2 py-1 bg-background border-pixel-sm border-l-4 border-l-green-500 text-green-600 text-xs">
                  ЛЁГКИЙ
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary border-pixel-sm">
                <div className="flex items-center gap-2">
                  <Gem className="w-5 h-5 text-primary" />
                  <span className="text-xs font-press-start text-primary">100 XP + БОНУС</span>
                </div>
                <ChevronRight className="w-6 h-6 text-primary group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Card>
        </motion.div>
      </main>

      {/* CTA SECTION */}
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t-4 border-border z-50 pointer-events-auto space-y-3 shadow-[0_-5px_0_rgba(0,0,0,0.5)]"
      >
        <Button
          className="w-full h-16 text-lg font-press-start text-pixel-shadow bg-primary text-primary-foreground hover:bg-primary/90 border-pixel-sm"
          onClick={() => onNavigate("quest-details")}
        >
          НАЧАТЬ ПАТРУЛЬ
        </Button>
        <Button
          variant="outline"
          className="w-full h-14 font-bold uppercase border-pixel-sm"
          onClick={() => onNavigate("quest-map")}
        >
          ИЗУЧИТЬ КАРТУ
        </Button>
      </motion.div>
    </div>
  )
}
