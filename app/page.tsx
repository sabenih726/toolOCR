// app/page.tsx
"use client"

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

// Dynamic import komponen utama dengan ssr: false
const PassportOCRClient = dynamic(() => import('./PassportOCRClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mb-4"></div>
        <p className="text-white text-lg">Loading Passport OCR...</p>
      </div>
    </div>
  )
})

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <PassportOCRClient />
    </Suspense>
  )
}
