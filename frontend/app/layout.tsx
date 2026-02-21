import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Financial Health Calculator — India',
  description: 'Upload your financial statements and get a comprehensive 0–100 health score with 50+ ratios in 60 seconds.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className} style={{ backgroundColor: '#F8F7F4', color: '#1C1917', margin: 0 }}>
        {children}
      </body>
    </html>
  )
}
