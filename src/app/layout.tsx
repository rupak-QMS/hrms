import type { Metadata, Viewport } from 'next'
import { DM_Sans, Sora, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import '../styles/yahweh-theme.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-sora',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'HRMS',
    template: '%s | HRMS',
  },
  description:
    'Enterprise HR Management System for Yahweh Care & Yahweh Property Care — multi-tenant, compliance-first, production-ready.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/favicon.ico',
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0E3D52',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${sora.variable} ${jetbrainsMono.variable}`}
    >
      {/* Prevent flash of wrong theme on load */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('hrms-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className={dmSans.className}>
        {/* Mesh background overlay — visible in dark mode only */}
        <div className="y-mesh-bg" aria-hidden="true" />
        {children}
      </body>
    </html>
  )
}
