"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Crown, Mail, Lock, Eye, EyeOff, Shield } from "lucide-react"
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
        const errorMap: Record<string, string> = {
          CredentialsSignin: "Неверный свиток или руны пароля. Попробуйте снова.",
        }
        
        const mappedError = errorMap[result.error] || errorMap.CredentialsSignin
        setError(mappedError)
      } else if (result?.ok) {
        window.location.reload()
      }
    } catch (err) {
      setError("Серверы перегружены монстрами (Ошибка соединения)")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative z-10 bg-background">
      {/* HEADER */}
      <header className="sticky top-0 z-20 p-4 bg-background/80 backdrop-blur-md border-b-4 border-border flex items-center justify-center sm:justify-start">
        <button 
          onClick={() => onNavigate("welcome")}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <img src="/emblem-pixel.png" alt="ZonExp Emblem" className="w-12 h-12 object-contain" />
          <span className="font-press-start text-xl text-pixel-shadow text-primary hidden sm:block">ZonExp</span>
        </button>
      </header>

      <main className="flex-1 p-4 flex flex-col items-center justify-center">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-sm"
        >
          <Card className="p-0 border-pixel bg-card overflow-hidden">
            <div className="bg-primary p-4 border-b-4 border-border text-center flex items-center justify-center gap-3">
              <Shield className="w-8 h-8 text-primary-foreground drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]" />
              <h1 className="text-xl font-press-start text-primary-foreground text-pixel-shadow">ВХОД В ГИЛЬДИЮ</h1>
            </div>

            <div className="p-6 bg-secondary">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-3 border-pixel-sm bg-destructive text-destructive-foreground text-center font-bold text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-press-start text-secondary-foreground text-pixel-shadow">Свиток (Email)</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-12 h-14 text-lg border-pixel-sm bg-input text-foreground rounded-none focus-visible:ring-0 focus-visible:border-primary"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-press-start text-secondary-foreground text-pixel-shadow">Секретные руны</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-12 pr-12 h-14 text-lg border-pixel-sm bg-input text-foreground rounded-none focus-visible:ring-0 focus-visible:border-primary"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                    </button>
                  </div>
                </div>

                <div className="pt-4 space-y-4">
                  <Button
                    type="submit"
                    className="w-full h-16 border-pixel-sm bg-primary text-primary-foreground font-press-start text-sm hover:bg-primary/90 hover:scale-[1.02] transition-transform text-pixel-shadow"
                    disabled={isLoading}
                  >
                    {isLoading ? "ОТКРЫВАЕМ ВРАТА..." : "ВОЙТИ"}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => onNavigate("welcome")}
                      className="text-sm font-bold uppercase text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
                    >
                      Нет профиля? Присоединиться
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </Card>
        </motion.div>
      </main>
    </div>
  )
}
