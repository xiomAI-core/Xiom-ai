import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/shared/Navbar'
import { Providers } from '@/components/Providers'
import { Toaster } from 'sonner'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'XIOM — Personal AI Operating System',
    template: '%s | XIOM',
  },
  description:
    'Turn any terminal AI into a governed, memory-enabled agent with a Digital World Model.',
  metadataBase: new URL('https://xiom-ai.com'),
  openGraph: {
    title: 'XIOM — Personal AI Operating System',
    description: 'Turn any terminal AI into a governed, memory-enabled agent.',
    siteName: 'XIOM',
    url: 'https://xiom-ai.com',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'XIOM — Personal AI Operating System',
    description: 'Turn any terminal AI into a governed, memory-enabled agent.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-black text-white antialiased">
        <Providers>
          <Navbar />
          {children}
          <Toaster theme="dark" position="bottom-right" />
        </Providers>
      </body>
    </html>
  )
}
