"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Screen } from "@/app/page"
import { Crown, Footprints, Sword, Sparkles, Crosshair, PawPrint, Mail, Lock, User, Eye, EyeOff } from "lucide-react"

interface WelcomeScreenProps {
  onNavigate: (screen: Screen) => void
  onLogout?: () => void
  onSetUserName: (name: string) => void
}

type OnboardingStep = "hero" | "class" | "register"

const characterClasses = [
  { id: "mage", icon: Sparkles, name: "Маг", color: "text-purple-600", description: "Мудрость и сила стихий" },
  { id: "warrior", icon: Sword, name: "Мечник", color: "text-red-600", description: "Сила и выносливость" },
  { id: "ranger", icon: Crosshair, name: "Стрелок", color: "text-green-600", description: "Меткость и скорость" },
  { id: "ninja", icon: Footprints, name: "Ниндзя", color: "text-gray-800", description: "Скрытность и ловкость" },
  { id: "shapeshifter", icon: PawPrint, name: "Оборотень", color: "text-amber-600", description: "Адаптивность и мощь" },
]

export function WelcomeScreen({ onNavigate, onLogout, onSetUserName }: WelcomeScreenProps) {
  const [step, setStep] = useState<OnboardingStep>("hero")
  const [selectedClass, setSelectedClass] = useState(characterClasses[1]) // warrior by default
  
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

    if (!username.trim()) {
      setError("Введите имя героя")
      return
    }
    if (!email.trim()) {
      setError("Введите email")
      return
    }
    if (password !== confirmPassword) {
      setError("Пароли не совпадают")
      return
    }
    if (password.length < 8) {
      setError("Пароль должен быть минимум 8 символов")
      return
    }

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
        // После регистрации — автоматический вход
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
              setError("Этот email уже зарегистрирован. Попробуйте войти.")
            } else {
              setError(data.error || "Ошибка регистрации")
            }
          } catch {
            setError("Ошибка регистрации")
          }
        }
      }
    } catch {
      setError("Ошибка соединения с сервером")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* HEADER */}
      <header className="p-4 bg-white dark:bg-gray-950">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg">ZonExp</span>
        </div>
      </header>

      <main className="flex-1 p-6 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        {/* HERO SECTION */}
        {step === "hero" && (
          <div className="text-center space-y-6 w-full">
            <div className="w-48 h-48 mx-auto bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/50 dark:to-blue-900/50 rounded-full flex items-center justify-center relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-blue-400/20 rounded-full animate-pulse" />
              <div className="relative">
                <Crown className="w-20 h-20 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Твой город — твоя RPG
              </h1>
              <p className="text-muted-foreground text-lg">
                Преврати прогулки по Красноярску в приключение
              </p>
            </div>
            <div className="space-y-3">
              <Button 
                className="w-full h-12 text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" 
                onClick={() => setStep("class")}
              >
                Начать приключение
              </Button>
              <button 
                className="w-full h-12 text-sm text-purple-600 hover:text-purple-800 dark:hover:text-purple-400 font-medium transition-colors hover:underline"
                onClick={() => onNavigate("login")}
              >
                Уже есть аккаунт? Войти
              </button>
            </div>
          </div>
        )}

        {/* CLASS SELECTION */}
        {step === "class" && (
          <div className="text-center space-y-6 w-full">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Выбери класс</h2>
              <p className="text-muted-foreground">Каждый класс уникален и будет развиваться</p>
            </div>
            
            <div className="space-y-3">
              {characterClasses.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClass(cls)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left",
                    selectedClass.id === cls.id
                      ? `border-purple-500 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 shadow-md scale-[1.02] ${cls.color}`
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    selectedClass.id === cls.id
                      ? `bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/50 dark:to-blue-900/50 ${cls.color}`
                      : "bg-muted"
                  )}>
                    <cls.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className={cn("font-semibold", selectedClass.id === cls.id ? cls.color : "")}>
                      {cls.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{cls.description}</p>
                  </div>
                </button>
              ))}
            </div>

            <Button className="w-full h-12" onClick={() => setStep("register")}>
              Далее
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setStep("hero")}>
              Назад
            </Button>
          </div>
        )}

        {/* REGISTRATION FORM */}
        {step === "register" && (
          <div className="text-center space-y-6 w-full">
            <div className="space-y-2">
              <div className={cn("w-16 h-16 mx-auto rounded-xl flex items-center justify-center", selectedClass.color)}>
                <selectedClass.icon className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold">Создай аккаунт</h2>
              <p className="text-muted-foreground">Класс: <span className={cn("font-medium", selectedClass.color)}>{selectedClass.name}</span></p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4 text-left">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Имя героя</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Как тебя зовут?"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 h-12"
                    required
                    minLength={2}
                    maxLength={50}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Пароль</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Минимум 8 символов..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12"
                    required
                    minLength={8}
                    maxLength={128}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Подтверди пароль</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Повтори пароль..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10 h-12"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                disabled={isLoading}
              >
                {isLoading ? "Создание аккаунта..." : "Создать аккаунт"}
              </Button>
            </form>

            <div className="text-center text-sm text-muted-foreground">
              Уже есть аккаунт?{" "}
              <button
                onClick={() => onNavigate("login")}
                className="text-purple-600 hover:text-purple-800 dark:hover:text-purple-400 font-medium underline transition-colors"
              >
                Войти
              </button>
            </div>

            <Button variant="ghost" className="w-full" onClick={() => setStep("class")}>
              Назад к выбору класса
            </Button>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="p-4 border-t bg-white dark:bg-gray-950 text-center text-xs text-muted-foreground">
        <a href="#" className="underline hover:text-foreground transition-colors">Политика конфиденциальности</a>
        <span className="mx-2">•</span>
        <span>© 2026 ZonExp</span>
      </footer>
    </div>
  )
}
