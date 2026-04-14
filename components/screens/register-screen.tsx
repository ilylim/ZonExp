"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Crown, Mail, Lock, User, Eye, EyeOff } from "lucide-react"
import type { Screen } from "@/app/page"

interface RegisterScreenProps {
  onNavigate: (screen: Screen) => void
}

export function RegisterScreen({ onNavigate }: RegisterScreenProps) {
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

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
      // Сначала регистрируем пользователя
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, username }),
      })

      if (res.ok) {
        // После успешной регистрации - автоматически входим
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        })

        if (result?.ok) {
          // Перезагружаем страницу для обновления сессии
          window.location.reload()
        } else {
          // Если вход не удался - отправляем на экран входа
          onNavigate("login")
        }
      } else {
        // Форматируем ошибку для отображения
        let errorMessage = "Ошибка регистрации"
        
        try {
          const text = await res.text()
          if (text) {
            const data = JSON.parse(text)
            if (data.error) {
              if (typeof data.error === "string") {
                if (data.error === "Email already registered") {
                  errorMessage = "Этот email уже зарегистрирован. Попробуйте войти."
                } else if (data.error.startsWith("Database error:")) {
                  const dbError = data.error.replace("Database error:", "").trim()
                  if (dbError.includes("connect") || dbError.includes("connection")) {
                    errorMessage = "Ошибка подключения к базе данных. Проверьте DATABASE_URL в .env"
                  } else if (dbError.includes("relation") || dbError.includes("table")) {
                    errorMessage = "Таблицы не найдены. Запустите: npm run db:migrate"
                  } else {
                    errorMessage = `Ошибка базы данных: ${dbError}`
                  }
                } else {
                  errorMessage = data.error
                }
              } else if (data.error.fieldErrors) {
                const fieldErrors = Object.entries(data.error.fieldErrors)
                if (fieldErrors.length > 0) {
                  const [field, errors] = fieldErrors[0]
                  const fieldNameMap: Record<string, string> = {
                    email: "Email",
                    password: "Пароль",
                    username: "Имя",
                  }
                  const fieldName = fieldNameMap[field] || field
                  const errorMessages: Record<string, string> = {
                    email: "Введите корректный email",
                    password: "Пароль должен быть от 8 до 128 символов",
                    username: "Имя должно быть от 1 до 64 символов",
                  }
                  errorMessage = `${fieldName}: ${errorMessages[field] || (errors as string[])[0]}`
                }
              }
            }
          }
        } catch (err) {
          console.error("Error parsing response:", err)
          errorMessage = `Ошибка сервера (статус: ${res.status})`
        }
        
        setError(errorMessage)
      }
    } catch (err) {
      console.error("Registration error:", err)
      setError("Ошибка соединения с сервером. Попробуйте снова.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-950 dark:to-gray-900 flex flex-col">
      {/* HEADER */}
      <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white dark:bg-gray-950 border-b">
        <button
          onClick={() => onNavigate("welcome")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Назад
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg">ZonExp</span>
        </div>
        <div className="w-12" />
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 space-y-6 border-2 shadow-xl">
          {/* HEADER */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/50 dark:to-blue-900/50 rounded-full flex items-center justify-center">
              <Crown className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h1 className="text-2xl font-bold">Создай аккаунт</h1>
            <p className="text-muted-foreground">Начни приключение по Красноярску!</p>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Повтори пароль..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10 h-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
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

          {/* FOOTER LINK */}
          <div className="text-center text-sm text-muted-foreground">
            Уже есть аккаунт?{" "}
            <button
              onClick={() => onNavigate("login")}
              className="text-purple-600 hover:text-purple-800 dark:hover:text-purple-400 font-medium underline transition-colors"
            >
              Войти
            </button>
          </div>
        </Card>
      </main>
    </div>
  )
}
