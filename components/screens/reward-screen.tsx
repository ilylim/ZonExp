"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Screen } from "@/app/page"
import { Share2, CheckCircle, Timer, Footprints, Flame, Gem, Trophy, MapPin, Crown, Home, Map as MapIcon, User } from "lucide-react"
import Confetti from 'react-confetti'

interface RewardScreenProps {
  onNavigate: (screen: Screen) => void
  data?: { earnedXp?: number; quest?: any; successful?: boolean }
}

export function RewardScreen({ onNavigate, data }: RewardScreenProps) {
  const [animatedXp, setAnimatedXp] = useState(0)
  const [showXpAnimation, setShowXpAnimation] = useState(true)
  const [windowDimensions, setWindowDimensions] = useState({ width: 0, height: 0 })
  const earnedXp = data?.earnedXp || 150
  const successful = data?.successful !== false

  useEffect(() => {
    setWindowDimensions({ width: window.innerWidth, height: window.innerHeight })
    
    let count = 0
    const interval = setInterval(() => {
      count += Math.max(5, Math.floor(earnedXp / 30))
      if (count >= earnedXp) {
        count = earnedXp
        clearInterval(interval)
      }
      setAnimatedXp(count)
    }, 25)
    return () => clearInterval(interval)
  }, [earnedXp])

  return (
    <div className="min-h-screen bg-background flex flex-col relative z-10 pb-20">
      {successful && <Confetti width={windowDimensions.width} height={windowDimensions.height} colors={['#eab308', '#8b5cf6', '#3b82f6', '#22c55e']} recycle={false} numberOfPieces={200} />}
      
      {/* HEADER - Empty for focus */}
      <header className="h-4" />

      <main className="flex-1 p-4 flex flex-col items-center justify-center">
        {/* SUCCESS HERO */}
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
          className="text-center space-y-4 mb-8"
        >
          <div
            className={`w-24 h-24 mx-auto border-pixel bg-green-500 flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.5)] transition-all duration-700 ${
              showXpAnimation ? "scale-100 opacity-100" : "scale-50 opacity-0"
            }`}
          >
            <Trophy className="w-12 h-12 text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.3)]" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-press-start text-primary text-pixel-shadow leading-relaxed">КВЕСТ<br/>ПРОЙДЕН!</h1>
            <p className="font-bold text-lg uppercase text-muted-foreground">Отличная работа, Герой!</p>
          </div>
        </motion.div>

        {/* REWARD SECTION */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-sm mb-6"
        >
          <Card className="p-0 border-pixel bg-card overflow-hidden">
            <div className="bg-primary p-3 border-b-4 border-border text-center">
              <h2 className="text-sm font-press-start text-primary-foreground text-pixel-shadow">ТВОЯ НАГРАДА</h2>
            </div>
            
            <div className="p-6 text-center bg-[url('/pixel-pattern.png')] bg-repeat bg-[length:16px_16px]">
              {/* Animated XP */}
              <motion.div 
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-5xl font-press-start mb-6 text-accent drop-shadow-[0_4px_0_rgba(0,0,0,0.8)]"
              >
                +{animatedXp} XP
              </motion.div>

              {/* Badge */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mb-4 p-3 border-pixel-sm bg-background">
                <div className="w-12 h-12 bg-orange-500 border-pixel-sm flex items-center justify-center shrink-0">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <span className="font-bold uppercase text-orange-500 flex-1 text-center sm:text-left text-sm sm:text-base">Первопроходец</span>
              </div>

              {/* New territory */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 p-3 border-pixel-sm bg-background">
                <div className="w-12 h-12 bg-emerald-600 border-pixel-sm flex items-center justify-center shrink-0">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <span className="font-bold uppercase text-emerald-600 flex-1 text-center sm:text-left leading-tight text-xs sm:text-sm">Открыта земля:<br/>Старый город</span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* STATS SECTION */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="w-full max-w-sm mb-6"
        >
          <Card className="p-4 border-pixel bg-card">
            <h2 className="text-sm font-press-start mb-4 text-center text-pixel-shadow text-primary">СТАТИСТИКА</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center p-3 border-pixel-sm bg-background hover:bg-muted transition-colors">
                <Timer className="w-6 h-6 text-accent mb-2" />
                <span className="text-[10px] font-press-start text-muted-foreground mb-1 leading-none">ВРЕМЯ</span>
                <span className="font-bold text-lg leading-none">15 мин</span>
              </div>
              <div className="flex flex-col items-center p-3 border-pixel-sm bg-background hover:bg-muted transition-colors">
                <MapPin className="w-6 h-6 text-primary mb-2" />
                <span className="text-[10px] font-press-start text-muted-foreground mb-1 leading-none">ПУТЬ</span>
                <span className="font-bold text-lg leading-none">1.2 км</span>
              </div>
              <div className="flex flex-col items-center p-3 border-pixel-sm bg-background hover:bg-muted transition-colors">
                <Footprints className="w-6 h-6 text-green-500 mb-2" />
                <span className="text-[10px] font-press-start text-muted-foreground mb-1 leading-none">ШАГИ</span>
                <span className="font-bold text-lg leading-none">1500</span>
              </div>
              <div className="flex flex-col items-center p-3 border-pixel-sm bg-background hover:bg-muted transition-colors">
                <Flame className="w-6 h-6 text-orange-500 mb-2" />
                <span className="text-[10px] font-press-start text-muted-foreground mb-1 leading-none">ЭНЕРГИЯ</span>
                <span className="font-bold text-lg leading-none">120 ккал</span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* LEVEL PROGRESS */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="w-full max-w-sm mb-6"
        >
          <Card className="p-4 border-pixel bg-secondary">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-primary" />
                <h3 className="font-press-start text-xs text-primary text-pixel-shadow">УРОВЕНЬ 2</h3>
              </div>
              <span className="font-bold text-secondary-foreground">150 / 300 XP</span>
            </div>
            <div className="w-full h-4 bg-muted border-2 border-border overflow-hidden mb-3">
              <div className="w-1/2 h-full bg-primary relative">
                <div className="absolute top-0 left-0 right-0 h-1 bg-white/30"></div>
              </div>
            </div>
            <p className="text-xs font-bold text-center text-muted-foreground uppercase">До уровня 3: 150 XP</p>
          </Card>
        </motion.div>
      </main>

      {/* CTA SECTION */}
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t-4 border-border z-50 pointer-events-auto space-y-3 shadow-[0_-5px_0_rgba(0,0,0,0.5)]"
      >
        <Button 
          className="w-full h-16 text-lg font-press-start text-pixel-shadow transition-transform hover:scale-[1.02] active:scale-95 bg-primary text-primary-foreground hover:bg-primary/90 border-pixel-sm" 
          onClick={() => onNavigate("quest-map")}
        >
          ПРОДОЛЖИТЬ ПУТЬ
        </Button>
        <Button 
          variant="outline" 
          className="w-full h-14 font-bold uppercase border-pixel-sm"
        >
          <Share2 className="w-5 h-5 mr-2" />
          Похвастаться в таверне
        </Button>
      </motion.div>
    </div>
  )
}
