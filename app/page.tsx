"use client"

import { useState, useCallback, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { SessionProvider } from "next-auth/react"
import { WelcomeScreen } from "@/components/screens/welcome-screen"
import { QuestMapScreen } from "@/components/screens/quest-map-screen"
import { QuestListScreen } from "@/components/screens/quest-list-screen"
import { QuestDetailsScreen } from "@/components/screens/quest-details-screen"
import { RewardScreen } from "@/components/screens/reward-screen"
import { ProfileScreen } from "@/components/screens/profile-screen"
import { ReturnScreen } from "@/components/screens/return-screen"
import { LoginScreen } from "@/components/screens/login-screen"
import { RegisterScreen } from "@/components/screens/register-screen"
import { useCurrentUser } from "@/hooks/use-current-user"
import { MapProvider, useMap } from "@/components/map/map-provider"
import { GlobalMap } from "@/components/map/global-map"

export type Screen =
  | "welcome"
  | "login"
  | "register"
  | "quest-map"
  | "quest-list"
  | "quest-details"
  | "reward"
  | "profile"
  | "return"

interface ScreenState {
  name: Screen
  data?: any
}

const screenRoutes: Partial<Record<Screen, string>> = {
  welcome: "/",
  login: "/login",
  register: "/register",
  "quest-map": "/map",
  "quest-list": "/quests",
  profile: "/profile",
  return: "/return",
}

function screenFromPathname(pathname: string): ScreenState {
  if (pathname.startsWith("/quests/")) {
    const id = pathname.replace("/quests/", "")
    if (id && id !== "page") {
      return { name: "quest-details", data: { questId: id } }
    }
  }
  if (pathname.startsWith("/active-quest/")) {
    const id = pathname.replace("/active-quest/", "")
    if (id && id !== "page") {
      return { name: "quest-details", data: { sessionId: id } }
    }
  }

  switch (pathname) {
    case "/login":
      return { name: "login" }
    case "/register":
      return { name: "register" }
    case "/map":
      return { name: "quest-map" }
    case "/quests":
      return { name: "quest-list" }
    case "/profile":
      return { name: "profile" }
    case "/return":
      return { name: "return" }
    default:
      return { name: "welcome" }
  }
}

function AppContent() {
  const { setViewMode } = useMap()
  const router = useRouter()
  const pathname = usePathname()
  const [currentScreen, setCurrentScreen] = useState<ScreenState>(() =>
    screenFromPathname(pathname)
  )
  const { user, isAuthenticated, isLoading } = useCurrentUser()

  useEffect(() => {
    const nextScreen = screenFromPathname(pathname)
    // УПРАВЛЕНИЕ РЕЖИМОМ КАРТЫ
    if (nextScreen.name === "quest-map") {
      setViewMode("full")
    } else if (nextScreen.name === "quest-details") {
      setViewMode("header")
    } else {
      setViewMode("hidden")
    }

    setCurrentScreen((current) => {
      // Если мы перешли на динамический путь, обновляем экран даже если имя совпадает (из-за данных)
      if (
        nextScreen.name === "quest-details" &&
        (nextScreen.data?.questId !== current.data?.questId ||
          nextScreen.data?.sessionId !== current.data?.sessionId)
      ) {
        return nextScreen
      }
      return current.name === nextScreen.name ? current : nextScreen
    })
  }, [pathname])

  const navigate = useCallback((screen: Screen, data?: any) => {
    setCurrentScreen({ name: screen, data })

    let href = screenRoutes[screen]
    if (screen === "quest-details" && data?.sessionId) {
      href = `/active-quest/${data.sessionId}`
    } else if (screen === "quest-details" && data?.questId) {
      href = `/quests/${data.questId}`
    }

    if (href && href !== pathname) {
      router.push(href)
    }
  }, [pathname, router])

  const handleLogout = useCallback(async () => {
    const { signOut } = await import("next-auth/react")
    await signOut({ redirect: false })
    navigate("login")
  }, [navigate])

  useEffect(() => {
    if (isLoading) return

    const protectedScreens: Screen[] = [
      "quest-map",
      "quest-list",
      "quest-details",
      "profile",
      "return",
    ]

    if (
      isAuthenticated &&
      (currentScreen.name === "welcome" ||
        currentScreen.name === "login" ||
        currentScreen.name === "register")
    ) {
      navigate("quest-map")
    } else if (!isAuthenticated && protectedScreens.includes(currentScreen.name)) {
      navigate("login")
    }
  }, [currentScreen.name, isAuthenticated, isLoading, navigate])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent relative">
      <GlobalMap />
      {currentScreen.name === "welcome" && (
        <WelcomeScreen
          onNavigate={navigate}
          onLogout={handleLogout}
          onSetUserName={() => { }}
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
        />
      )}
      {currentScreen.name === "quest-details" && (
        <QuestDetailsScreen
          onNavigate={navigate}
          quest={currentScreen.data}
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
      <MapProvider>
        <AppContent />
      </MapProvider>
    </SessionProvider>
  )
}
