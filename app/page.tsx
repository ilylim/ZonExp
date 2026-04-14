"use client"

import { useState, useCallback, useEffect } from "react"
import { SessionProvider } from "next-auth/react"
import { WelcomeScreen } from "@/components/screens/welcome-screen"
import { QuestMapScreen } from "@/components/screens/quest-map-screen"
import { QuestListScreen } from "@/components/screens/quest-list-screen"
import { QuestDetailsScreen } from "@/components/screens/quest-details-screen"
import { ActiveQuestScreen } from "@/components/screens/active-quest-screen"
import { RewardScreen } from "@/components/screens/reward-screen"
import { ProfileScreen } from "@/components/screens/profile-screen"
import { ReturnScreen } from "@/components/screens/return-screen"
import { LoginScreen } from "@/components/screens/login-screen"
import { RegisterScreen } from "@/components/screens/register-screen"
import { useCurrentUser } from "@/hooks/use-current-user"

export type Screen =
  | "welcome"
  | "login"
  | "register"
  | "quest-map"
  | "quest-list"
  | "quest-details"
  | "active-quest"
  | "reward"
  | "profile"
  | "return"

interface ScreenState {
  name: Screen
  data?: any
}

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>({ name: "welcome" })
  const { user, isAuthenticated, isLoading } = useCurrentUser()
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)

  // Read saved location from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("user_location")
      if (saved) {
        setUserLocation(JSON.parse(saved))
      }
    } catch {}
  }, [])

  const navigate = useCallback((screen: Screen, data?: any) => {
    setCurrentScreen({ name: screen, data })
  }, [])

  const handleLogout = useCallback(async () => {
    const { signOut } = await import("next-auth/react")
    await signOut({ redirect: false })
    navigate("login")
  }, [navigate])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (isAuthenticated && (currentScreen.name === "welcome" || currentScreen.name === "login" || currentScreen.name === "register")) {
    setCurrentScreen({ name: "quest-map" })
    return null
  }

  return (
    <div className="min-h-screen bg-muted">
      {currentScreen.name === "welcome" && (
        <WelcomeScreen
          onNavigate={navigate}
          onLogout={handleLogout}
          onSetUserName={() => {}}
        />
      )}
      {currentScreen.name === "login" && (
        <LoginScreen onNavigate={navigate} />
      )}
      {currentScreen.name === "register" && (
        <RegisterScreen onNavigate={navigate} />
      )}
      {currentScreen.name === "quest-map" && (
        <QuestMapScreen
          onNavigate={navigate}
          onLogout={handleLogout}
          userName={user?.username || "Герой"}
        />
      )}
      {currentScreen.name === "quest-list" && (
        <QuestListScreen
          onNavigate={navigate}
          userLocation={userLocation}
        />
      )}
      {currentScreen.name === "quest-details" && (
        <QuestDetailsScreen
          onNavigate={navigate}
          quest={currentScreen.data}
          userLocation={userLocation}
        />
      )}
      {currentScreen.name === "active-quest" && (
        <ActiveQuestScreen 
          onNavigate={navigate} 
          session={currentScreen.data}
        />
      )}
      {currentScreen.name === "reward" && (
        <RewardScreen onNavigate={navigate} />
      )}
      {currentScreen.name === "profile" && (
        <ProfileScreen
          onNavigate={navigate}
          onLogout={handleLogout}
          userName={user?.username || "Герой"}
          userLevel={user?.level || 1}
          userXp={user?.xp || 0}
          userCompletedQuests={user?.completedQuests || 0}
        />
      )}
      {currentScreen.name === "return" && (
        <ReturnScreen onNavigate={navigate} userName={user?.username || "Герой"} />
      )}
    </div>
  )
}

export default function App() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  )
}
