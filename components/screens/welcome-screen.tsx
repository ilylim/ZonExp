"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Screen } from "@/app/page"
import { Crown, Footprints, Sword, Sparkles, Crosshair, PawPrint, Mail, Lock, User, Eye, EyeOff, Shield } from "lucide-react"

interface WelcomeScreenProps {
  onNavigate: (screen: Screen) => void
  onLogout?: () => void
  onSetUserName: (name: string) => void
}

type OnboardingStep = "hero" | "class" | "register"

const characterClasses = [
  { id: "warrior", icon: Sword, name: "Воин", color: "bg-red-600 border-red-900", text: "text-red-600 dark:text-red-400", description: "Высокая защита и урон в ближнем бою." },
  { id: "mage", icon: Sparkles, name: "Маг", color: "bg-blue-600 border-blue-900", text: "text-blue-600 dark:text-blue-400", description: "Могущественные заклинания и контроль маны." },
  { id: "ranger", icon: Crosshair, name: "Стрелок", color: "bg-green-600 border-green-900", text: "text-green-600 dark:text-green-400", description: "Дальний бой и смертельная точность." },
  { id: "shapeshifter", icon: PawPrint, name: "Друид", color: "bg-amber-600 border-amber-900", text: "text-amber-600 dark:text-amber-400", description: "Связь с природой и призыв существ." },
]

export function WelcomeScreen({ onNavigate, onLogout, onSetUserName }: WelcomeScreenProps) {
  const [step, setStep] = useState<OnboardingStep>("hero")
  const [selectedClass, setSelectedClass] = useState(characterClasses[0])

  // Registration form
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!username.trim()) return setError("Введите имя героя")
    if (!email.trim()) return setError("Введите email")
    if (password !== confirmPassword) return setError("Пароли не совпадают")
    if (password.length < 8) return setError("Пароль должен быть минимум 8 символов")

    setIsLoading(true)

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          username: username.trim(),
          characterClass: selectedClass.id,
        }),
      })

      if (res.ok) {
        const { signIn } = await import("next-auth/react")
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        })

        if (result?.ok) {
          window.location.reload()
        } else {
          onNavigate("login")
        }
      } else {
        const text = await res.text()
        if (text) {
          try {
            const data = JSON.parse(text)
            if (data.error === "Email already registered") {
              setError("Свиток с этим email уже существует. Попробуйте войти.")
            } else {
              setError(data.error || "Ошибка создания персонажа")
            }
          } catch {
            setError("Ошибка создания персонажа")
          }
        }
      }
    } catch {
      setError("Серверы перегружены монстрами (Ошибка соединения)")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      {/* HEADER */}
      <header className="sticky top-0 z-20 p-4 bg-background/80 backdrop-blur-md border-b-4 border-border flex items-center justify-between">
        <button
          onClick={() => setStep("hero")}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer text-left"
        >
          <img src="/emblem-pixel.png" alt="ZonExp Emblem" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
          <span className="font-press-start text-lg sm:text-xl text-pixel-shadow text-primary">ZonExp</span>
        </button>
      </header>

      <main className="flex-1 p-4 md:p-6 flex flex-col items-center justify-center max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait">
          {/* HERO SECTION */}
          {step === "hero" && (
            <motion.div
              key="hero"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-8 w-full border-pixel p-8 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-secondary/10 pointer-events-none" />

              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="mx-auto flex items-center justify-center relative z-10"
              >
                <img src="/logo-pixel.png" alt="ZonExp Logo" className="w-48 h-48 sm:w-64 sm:h-64 object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.3)]" />
              </motion.div>

              <div className="space-y-4 relative z-10">
                <h1 className="text-2xl md:text-3xl font-press-start text-pixel-shadow text-primary leading-relaxed">
                  ТВОЙ ГОРОД — ТВОЯ RPG
                </h1>
                <p className="text-xl">
                  Преврати прогулки в эпичное приключение. Выполняй квесты, сражайся с ленью, получай лут!
                </p>
              </div>

              <div className="space-y-4 relative z-10 pt-4">
                <Button
                  onClick={() => setStep("class")}
                  className="w-full h-16 text-xl border-pixel-sm bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] transition-transform font-press-start"
                >
                  НАЧАТЬ ИГРУ
                </Button>
                <button
                  className="w-full h-12 text-lg text-secondary dark:text-secondary-foreground hover:underline font-bold"
                  onClick={() => onNavigate("login")}
                >
                  Уже есть сохранение? Войти
                </button>
              </div>
            </motion.div>
          )}

          {/* CLASS SELECTION */}
          {step === "class" && (
            <motion.div
              key="class"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full space-y-6"
            >
              <div className="border-pixel p-4 text-center bg-secondary">
                <h2 className="text-xl font-press-start text-pixel-shadow text-secondary-foreground">ВЫБЕРИ КЛАСС</h2>
              </div>

              <div className="space-y-3">
                {characterClasses.map((cls) => (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    key={cls.id}
                    onClick={() => setSelectedClass(cls)}
                    className={cn(
                      "w-full flex items-center gap-4 p-3 border-pixel-sm text-left transition-colors",
                      selectedClass.id === cls.id
                        ? "bg-muted"
                        : "bg-card hover:bg-muted/50"
                    )}
                  >
                    <div className={cn("w-14 h-14 border-pixel-sm flex items-center justify-center", cls.color)}>
                      <cls.icon className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className={cn("font-press-start text-sm mb-2 text-pixel-shadow", cls.text)}>
                        {cls.name}
                      </p>
                      <p className="text-lg leading-tight">{cls.description}</p>
                    </div>
                  </motion.button>
                ))}
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  variant="outline"
                  className="w-1/3 h-14 border-pixel-sm text-lg font-bold"
                  onClick={() => setStep("hero")}
                >
                  НАЗАД
                </Button>
                <Button
                  className="w-2/3 h-14 border-pixel-sm bg-primary text-primary-foreground font-press-start text-sm hover:bg-primary/90 hover:scale-[1.02] transition-transform"
                  onClick={() => setStep("register")}
                >
                  ВЫБРАТЬ
                </Button>
              </div>
            </motion.div>
          )}

          {/* REGISTRATION FORM */}
          {step === "register" && (
            <motion.div
              key="register"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full space-y-6 border-pixel p-6"
            >
              <div className="text-center space-y-4">
                <div className={cn("w-20 h-20 mx-auto border-pixel-sm flex items-center justify-center", selectedClass.color)}>
                  <selectedClass.icon className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-xl font-press-start text-pixel-shadow text-primary">СОЗДАНИЕ ПЕРСОНАЖА</h2>
                <p className="text-xl">Класс: <span className={cn("font-bold", selectedClass.text)}>{selectedClass.name}</span></p>
              </div>

              <form onSubmit={handleRegister} className="space-y-5">
                {error && (
                  <div className="p-3 border-pixel-sm bg-destructive text-destructive-foreground text-center font-bold">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-lg font-bold uppercase">Имя героя</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Имя персонажа"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-12 h-14 text-xl border-pixel-sm bg-input text-foreground rounded-none"
                      required
                      minLength={2}
                      maxLength={50}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-lg font-bold uppercase">Свиток связи (Email)</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-12 h-14 text-xl border-pixel-sm bg-input text-foreground rounded-none"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-lg font-bold uppercase">Секретный код</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Минимум 8 рун"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-12 pr-12 h-14 text-xl border-pixel-sm bg-input text-foreground rounded-none"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-lg font-bold uppercase">Подтверди код</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Повтори код"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-12 pr-12 h-14 text-xl border-pixel-sm bg-input text-foreground rounded-none"
                      required
                    />
                  </div>
                </div>

                <div className="pt-4 space-y-4">
                  <Button
                    type="submit"
                    className="w-full h-14 border-pixel-sm bg-primary text-primary-foreground font-press-start hover:bg-primary/90 text-sm hover:scale-[1.02] transition-transform"
                    disabled={isLoading}
                  >
                    {isLoading ? "КОВКА..." : "СОЗДАТЬ"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 border-pixel-sm font-bold text-lg"
                    onClick={() => setStep("class")}
                  >
                    НАЗАД
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FOOTER */}
      <footer className="p-4 border-t-4 border-border bg-card text-center text-lg font-bold">
        <a href="#" className="hover:text-primary transition-colors">Правила гильдии (Конфиденциальность)</a>
        <span className="mx-2 text-primary">•</span>
        <span>© 2026 ZonExp</span>
      </footer>
    </div>
  )
}
