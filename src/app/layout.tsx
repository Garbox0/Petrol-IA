import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Petrol-IA | Industrial Cybersecurity Hub',
  description: 'Cybersecurity management for Vaca Muerta oil & gas operations.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <main className="min-h-screen flex flex-col">
          {children}
        </main>
      </body>
    </html>
  )
}
