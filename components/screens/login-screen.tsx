"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Crown, Mail, Lock, Eye, EyeOff } from "lucide-react"
import type { Screen } from "@/app/page"

interface LoginScreenProps {
  onNavigate: (screen: Screen) => void
}

export function LoginScreen({ onNavigate }: LoginScreenProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        // Определяем конкретную причину ошибки
        const errorMap: Record<string, string> = {
          "Пользователь с таким email не найден": "Пользователь с таким email не найден. Проверьте email или зарегистрируйтесь.",
          "Неверный пароль": "Неверный пароль. Попробуйте снова.",
          "Неверный формат email или пароля": "Неверный формат email или пароля.",
          "CredentialsSignin": "Неверный email или пароль. Проверьте данные и попробуйте снова.",
        }
        
        const mappedError = errorMap[result.error] || errorMap["CredentialsSignin"] || `Ошибка входа: ${result.error}`
        setError(mappedError)
      } else if (result?.ok) {
        window.location.reload()
      }
    } catch (err) {
      console.error("Login error:", err)
      setError("Ошибка соединения с сервером. Попробуйте снова.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-950 dark:to-gray-900 flex flex-col">
      {/* HEADER */}
      <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-950 border-b">
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
            <h1 className="text-2xl font-bold">Вход в аккаунт</h1>
            <p className="text-muted-foreground">С возвращением, герой!</p>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

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
                  placeholder="Введи пароль..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-12"
                  required
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

            <Button
              type="submit"
              className="w-full h-12 text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              disabled={isLoading}
            >
              {isLoading ? "Вход..." : "Войти"}
            </Button>
          </form>

          {/* FOOTER LINK */}
          <div className="text-center text-sm text-muted-foreground">
            Нет аккаунта?{" "}
            <button
              onClick={() => onNavigate("register")}
              className="text-purple-600 hover:text-purple-800 dark:hover:text-purple-400 font-medium underline transition-colors"
            >
              Зарегистрироваться
            </button>
          </div>
        </Card>
      </main>
    </div>
  )
}
