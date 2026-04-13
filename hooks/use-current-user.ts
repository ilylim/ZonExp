"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"

export interface UserProfile {
  userId: string
  username: string
  email: string
  xp: number
  level: number
  completedQuests: number
}

export function useCurrentUser() {
  const { data: session, status } = useSession()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (status === "loading") return

    if (!session?.user?.id) {
      setProfile(null)
      setIsLoading(false)
      return
    }

    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/me/progress")
        if (res.ok) {
          const data = await res.json()
          setProfile({
            userId: session.user.id,
            username: session.user.name || "Герой",
            email: session.user.email || "",
            xp: data.xp || 0,
            level: data.level || 1,
            completedQuests: data.completedQuests || 0,
          })
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [session, status])

  return {
    user: profile,
    isAuthenticated: !!session?.user?.id,
    isLoading: status === "loading" || isLoading,
  }
}
