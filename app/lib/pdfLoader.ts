// app/lib/pdfLoader.ts

let pdfjsLib: any = null
let loadingPromise: Promise<any> | null = null

export async function loadPdfJs() {
  // Return cached
  if (pdfjsLib) return pdfjsLib

  // Wait if already loading
  if (loadingPromise) return loadingPromise

  loadingPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if ((window as any).pdfjsLib) {
      pdfjsLib = (window as any).pdfjsLib
      resolve(pdfjsLib)
      return
    }

    console.log('📦 Loading PDF.js from CDN...')

    // Load PDF.js from CDN
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.async = true

    script.onload = () => {
      pdfjsLib = (window as any).pdfjsLib

      if (!pdfjsLib) {
        reject(new Error('PDF.js failed to load'))
        return
      }

      // Set worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

      console.log('✅ PDF.js loaded successfully from CDN')
      resolve(pdfjsLib)
    }

    script.onerror = () => {
      loadingPromise = null
      reject(new Error('Failed to load PDF.js script'))
    }

    document.head.appendChild(script)
  })

  return loadingPromise
}