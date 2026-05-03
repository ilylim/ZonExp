"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Screen } from "@/app/page"
import { Settings, Lock, Map, User, LogOut, ChevronRight, Trophy, Footprints, Sparkles, Calendar, Bell, Home, X, Shield, Target } from "lucide-react"

interface ProfileScreenProps {
  onNavigate: (screen: Screen) => void
  onLogout: () => void
  userName: string
  userEmail: string
  userLevel: number
  userXp: number
  userCompletedQuests: number
}

const territories = [
  { name: "Старый город (Центр)", unlocked: true, level: 1 },
  { name: "Каменные Исполины (Столбы)", unlocked: false, level: 5 },
  { name: "Остров Сусликов (Татышев)", unlocked: false, level: 8 },
  { name: "Снежные Склоны (Бобровый лог)", unlocked: false, level: 10 },
]

const badges = [
  { id: 1, icon: Trophy, name: "Первая Кровь", unlocked: true },
  { id: 2, icon: Sparkles, name: "Герой Недели", unlocked: true },
  { id: 3, icon: Footprints, name: "Марафонец", unlocked: true },
  { id: 4, icon: Map, name: "Ночной Дозор", unlocked: false },
  { id: 5, icon: Trophy, name: "Меткий Лук", unlocked: false },
  { id: 6, icon: Shield, name: "Страж Города", unlocked: false },
]

export function ProfileScreen({ onNavigate, onLogout, userName, userEmail, userLevel, userXp, userCompletedQuests }: ProfileScreenProps) {
  const xpForNextLevel = userLevel * 500
  const xpPercentage = Math.min((userXp / xpForNextLevel) * 100, 100)
  const [showSettings, setShowSettings] = useState(false)
  const [showSupportForm, setShowSupportForm] = useState(false)
  const [supportSubject, setSupportSubject] = useState("")
  const [supportMessage, setSupportMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [supportStatus, setSupportStatus] = useState<"idle" | "success" | "error">("idle")

  const totalSteps = userCompletedQuests * 1875
  const totalDistance = (userCompletedQuests * 1.8).toFixed(1)
  const userDaysInGame = Math.max(Math.floor(userXp / 100), 1) // Calculated or mock value

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSupportStatus("idle")

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          subject: supportSubject,
          message: supportMessage,
        }),
      })

      if (response.ok) {
        setSupportStatus("success")
        setSupportSubject("")
        setSupportMessage("")
        setTimeout(() => {
          setShowSupportForm(false)
          setSupportStatus("idle")
        }, 2000)
      } else {
        setSupportStatus("error")
      }
    } catch (error) {
      setSupportStatus("error")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative z-10 pb-20">
      {/* HEADER */}
      <header className="sticky top-0 z-20 flex items-center justify-between p-4 bg-background/90 backdrop-blur-sm border-b-4 border-border">
        <button 
          onClick={() => onNavigate("quest-map")}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <img src="/emblem-pixel.png" alt="Emblem" className="w-10 h-10 object-contain" />
          <h1 className="text-lg sm:text-xl font-press-start text-pixel-shadow text-primary uppercase text-left">Герой</h1>
        </button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="border-pixel-sm">
            <Bell className="w-5 h-5" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setShowSettings(true)} className="border-pixel-sm">
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* SETTINGS MODAL */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card w-full max-w-sm border-pixel p-1 shadow-2xl"
            >
              <div className="bg-secondary p-4 border-b-4 border-border flex items-center justify-between">
                <h2 className="text-lg font-press-start text-secondary-foreground text-pixel-shadow">ОПЦИИ</h2>
                <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-black/20 transition-colors">
                  <X className="w-6 h-6 text-secondary-foreground" />
                </button>
              </div>
              <div className="p-4 space-y-3 bg-card">
                <button 
                  onClick={() => {}} 
                  className="w-full flex items-center justify-between min-h-[3.5rem] py-2 px-4 border-pixel-sm bg-background hover:bg-muted font-bold text-base sm:text-lg text-left whitespace-normal transition-colors"
                >
                  <span className="flex-1 pr-2">Гримуар (Аккаунт)</span>
                  <ChevronRight className="w-5 h-5 shrink-0 text-primary" />
                </button>

                <button 
                  onClick={() => setShowSupportForm(true)} 
                  className="w-full flex items-center justify-between min-h-[3.5rem] py-2 px-4 border-pixel-sm bg-background hover:bg-muted font-bold text-xs sm:text-base text-left whitespace-normal transition-colors leading-tight"
                >
                  <span className="flex-1 pr-2">Совет Мудрецов (Поддержка)</span>
                  <ChevronRight className="w-5 h-5 shrink-0 text-primary" />
                </button>

                <button
                  style={{ backgroundColor: '#991b1b' }}
                  className="w-full flex items-center justify-between min-h-[3.5rem] py-2 px-4 border-pixel-sm text-white font-bold text-lg mt-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.3)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                  onClick={() => { onLogout(); setShowSettings(false) }}
                >
                  <div className="flex items-center gap-2">
                    <LogOut className="w-5 h-5" />
                    <span>Покинуть игру</span>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SUPPORT FORM MODAL */}
      <AnimatePresence>
        {showSupportForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card w-full max-w-md border-pixel p-1 shadow-2xl"
            >
              <div className="bg-primary p-4 border-b-4 border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-primary-foreground" />
                  <h2 className="text-sm sm:text-lg font-press-start text-primary-foreground text-pixel-shadow">СОВЕТ МУДРЕЦОВ</h2>
                </div>
                <button onClick={() => setShowSupportForm(false)} className="p-1 hover:bg-black/20 transition-colors">
                  <X className="w-6 h-6 text-primary-foreground" />
                </button>
              </div>

              <div className="p-6 space-y-5 bg-secondary">
                {supportStatus === "success" ? (
                  <div className="text-center py-8 space-y-4">
                    <div className="w-16 h-16 bg-emerald-600 border-pixel-sm mx-auto flex items-center justify-center">
                      <Sparkles className="w-10 h-10 text-white" />
                    </div>
                    <p className="font-press-start text-xs text-emerald-600 text-pixel-shadow uppercase">Весть отправлена!</p>
                    <p className="text-sm font-bold">Мудрецы услышали твой зов и скоро дадут ответ.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSupportSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-press-start text-secondary-foreground text-pixel-shadow uppercase">Суть обращения</label>
                      <input
                        type="text"
                        placeholder="Тема сообщения..."
                        value={supportSubject}
                        onChange={(e) => setSupportSubject(e.target.value)}
                        className="w-full p-3 border-pixel-sm bg-background focus:outline-none focus:border-primary font-bold"
                        required
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-press-start text-secondary-foreground text-pixel-shadow uppercase">Твое послание</label>
                      <textarea
                        placeholder="Опиши свою проблему или идею..."
                        value={supportMessage}
                        onChange={(e) => setSupportMessage(e.target.value)}
                        rows={4}
                        className="w-full p-3 border-pixel-sm bg-background focus:outline-none focus:border-primary font-bold resize-none"
                        required
                        disabled={isSubmitting}
                      />
                    </div>

                    {supportStatus === "error" && (
                      <p className="text-destructive font-bold text-sm text-center">
                        Голубь не долетел... Ошибка при отправке.
                      </p>
                    )}

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-14 border-pixel-sm bg-primary text-primary-foreground font-press-start text-xs hover:bg-primary/90 transition-all text-pixel-shadow"
                    >
                      {isSubmitting ? "ОТПРАВКА..." : "ОТПРАВИТЬ ВЕСТЬ"}
                    </Button>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* PROFILE HERO */}
        <div className="p-6 text-center border-pixel bg-secondary relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/pixel-pattern.png')] opacity-10 mix-blend-overlay"></div>

          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="w-24 h-24 mx-auto mb-4 border-pixel bg-primary flex items-center justify-center shadow-[4px_4px_0_0_rgba(0,0,0,0.5)] relative z-10"
          >
            <span className="font-press-start text-4xl text-primary-foreground text-pixel-shadow">
              {userName.charAt(0).toUpperCase()}
            </span>
          </motion.div>

          <div className="relative z-10 px-2">
            <h2 className="text-xl sm:text-2xl font-press-start text-secondary-foreground mb-2 text-pixel-shadow uppercase break-words hyphens-auto">{userName}</h2>
            <div className="inline-block bg-background border-pixel-sm px-2 sm:px-4 py-1 mb-4">
              <span className="text-lg sm:text-xl font-bold text-primary">УРОВЕНЬ {userLevel}</span>
            </div>

            <div className="max-w-xs mx-auto bg-card border-pixel-sm p-3">
              <div className="flex justify-between text-sm mb-2 font-bold uppercase">
                <span>ОПЫТ</span>
                <span className="text-primary">{userXp} / {xpForNextLevel}</span>
              </div>
              <div className="w-full h-4 bg-muted border-2 border-border overflow-hidden">
                <div
                  className="h-full bg-primary relative"
                  style={{ width: `${xpPercentage}%` }}
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-white/30"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STATS SECTION */}
        <div>
          <h3 className="text-xl font-press-start text-primary text-pixel-shadow mb-4 uppercase">Статистика</h3>
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-3 sm:p-4 text-center border-pixel-sm bg-card hover:bg-muted transition-colors cursor-pointer group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 bg-primary border-pixel-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                <Target className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
              </div>
              <span className="text-xl sm:text-3xl font-press-start text-primary truncate block">{userCompletedQuests}</span>
              <p className="text-[10px] sm:text-sm font-bold uppercase mt-1 sm:mt-2 text-muted-foreground">Квестов</p>
            </Card>

            <Card className="p-3 sm:p-4 text-center border-pixel-sm bg-card hover:bg-muted transition-colors cursor-pointer group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 bg-accent border-pixel-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                <Footprints className="w-5 h-5 sm:w-6 sm:h-6 text-accent-foreground" />
              </div>
              <span className="text-lg sm:text-2xl font-press-start text-accent pt-1 truncate block">{totalSteps > 9999 ? "9999+" : totalSteps}</span>
              <p className="text-[10px] sm:text-sm font-bold uppercase mt-1 sm:mt-2 text-muted-foreground">Шагов</p>
            </Card>

            <Card className="p-3 sm:p-4 text-center border-pixel-sm bg-card hover:bg-muted transition-colors cursor-pointer group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 bg-emerald-600 border-pixel-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <span className="text-lg sm:text-2xl font-press-start text-emerald-600 pt-1 truncate block">{userXp > 9999 ? "9999+" : userXp}</span>
              <p className="text-[10px] sm:text-sm font-bold uppercase mt-1 sm:mt-2 text-muted-foreground">Опыта (XP)</p>
            </Card>

            <Card className="p-3 sm:p-4 text-center border-pixel-sm bg-card hover:bg-muted transition-colors cursor-pointer group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 bg-amber-600 border-pixel-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <span className="text-lg sm:text-2xl font-press-start text-amber-600 pt-1 truncate block">{userDaysInGame}</span>
              <p className="text-[10px] sm:text-sm font-bold uppercase mt-1 sm:mt-2 text-muted-foreground">Дней в игре</p>
            </Card>
          </div>
        </div>

        {/* TERRITORIES SECTION */}
        <div>
          <h3 className="text-xl font-press-start text-primary text-pixel-shadow mb-4 uppercase">Земли</h3>
          <div className="space-y-3">
            {territories.map((territory) => (
              <div
                key={territory.name}
                className={`flex items-center justify-between p-3 border-pixel-sm transition-transform hover:scale-[1.01] cursor-pointer ${territory.unlocked ? "bg-card" : "bg-muted opacity-80"
                  }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 border-pixel-sm flex items-center justify-center ${territory.unlocked ? "bg-primary" : "bg-slate-700"
                    }`}>
                    <Map className={`w-6 h-6 ${territory.unlocked ? "text-primary-foreground" : "text-slate-400"}`} />
                  </div>
                  <div className="flex flex-col">
                    <span className={`font-bold text-lg ${territory.unlocked ? "text-foreground" : "text-muted-foreground"}`}>
                      {territory.name}
                    </span>
                    {!territory.unlocked && (
                      <span className="text-xs font-press-start text-destructive mt-1">
                        НУЖЕН УР {territory.level}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {territory.unlocked ? (
                    <ChevronRight className="w-6 h-6 text-primary" />
                  ) : (
                    <Lock className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BADGES SECTION */}
        <div>
          <h3 className="text-xl font-press-start text-primary text-pixel-shadow mb-4 uppercase">Трофеи</h3>
          <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-1 snap-x">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className={`flex flex-col items-center shrink-0 w-28 snap-center ${badge.unlocked ? "opacity-100" : "opacity-50 grayscale"
                  }`}
              >
                <div className="relative mb-2">
                  <div className={`w-20 h-20 border-pixel-sm flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] ${badge.unlocked ? "bg-accent" : "bg-muted"
                    }`}>
                    <badge.icon className={`w-10 h-10 ${badge.unlocked ? "text-accent-foreground" : "text-muted-foreground"}`} />
                  </div>
                  {!badge.unlocked && (
                    <div className="absolute -bottom-2 -right-2 bg-background border-pixel-sm p-1">
                      <Lock className="w-4 h-4 text-destructive" />
                    </div>
                  )}
                </div>
                <span className="text-sm font-bold text-center leading-tight">
                  {badge.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 flex items-center justify-around p-2 border-t-4 border-border bg-card z-40">
        <button
          className="flex flex-col items-center gap-1 p-2 text-muted-foreground hover:text-primary transition-colors group"
          onClick={() => onNavigate("quest-map")}
        >
          <div className="group-hover:-translate-y-1 transition-transform">
            <Home className="w-7 h-7" />
          </div>
          <span className="text-xs font-bold uppercase">Карта</span>
        </button>
        <button
          className="flex flex-col items-center gap-1 p-2 text-muted-foreground hover:text-primary transition-colors group"
          onClick={() => onNavigate("quest-list")}
        >
          <div className="group-hover:-translate-y-1 transition-transform">
            <Map className="w-7 h-7" />
          </div>
          <span className="text-xs font-bold uppercase">Квесты</span>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 text-primary">
          <div className="-translate-y-1">
            <User className="w-7 h-7 drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]" />
          </div>
          <span className="text-xs font-bold uppercase underline decoration-2 underline-offset-4">Герой</span>
        </button>
      </nav>
    </div>
  )
}

