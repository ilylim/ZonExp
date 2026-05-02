import type { Metadata } from 'next'
import { VT323, Press_Start_2P } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Providers } from '@/components/providers'
import './globals.css'

const vt323 = VT323({
  weight: '400',
  subsets: ['latin', 'cyrillic'],
  variable: '--font-vt323',
})

const pressStart2P = Press_Start_2P({
  weight: '400',
  subsets: ['latin', 'cyrillic'],
  variable: '--font-press-start',
})

export const metadata: Metadata = {
  title: 'ZonExp - RPG Quests',
  description: 'Geolocation RPG Quests',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru">
      <body className={`${vt323.variable} ${pressStart2P.variable} font-vt323 antialiased bg-background text-foreground text-xl`}>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  )
}
