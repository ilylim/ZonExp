"use client"

import { useEffect } from "react"
import type { Screen } from "@/app/page"

interface RegisterScreenProps {
  onNavigate: (screen: Screen) => void
}

export function RegisterScreen({ onNavigate }: RegisterScreenProps) {
  useEffect(() => {
    // Redirection back to welcome screen since it handles registration
    onNavigate("welcome")
  }, [onNavigate])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="font-press-start text-primary text-pixel-shadow animate-pulse">
        ПЕРЕХОД...
      </div>
    </div>
  )
}
