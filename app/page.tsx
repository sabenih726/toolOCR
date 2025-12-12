// app/page.tsx
"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import { createWorker, PSM, OEM } from "tesseract.js"

// ====================== TYPES ======================
interface ExtractedData {
  passportNo: string
  fullName: string
  dateOfBirth: string
  placeOfBirth: string
  dateOfIssue: string
  dateOfExpiry: string
  nationality: string
  gender: string
}

interface ProcessedFile {
  id: string
  file: File
  imageUrl: string
  extractedText: string
  structuredData: ExtractedData
  isProcessing: boolean
  progress: number
  error: string | null
}

// ====================== ICONS ======================
const UploadIcon = () => (
  <svg className="h-16 w-16 text-purple-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 48 48" aria-hidden="true">
    <path d="M42 30v8a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4v-8" strokeWidth={3} strokeLinecap="round"/>
    <polyline points="34 20 24 10 14 20" strokeWidth={3} strokeLinecap="round"/>
    <line x1="24" y1="10" x2="24" y2="30" strokeWidth={3} strokeLinecap="round"/>
  </svg>
)

const CopyIcon = ({ className = "h-4 w-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)

const CheckIcon = ({ className = "h-4 w-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const ZoomInIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
    <circle cx="11" cy="11" r="8"/>
    <path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/>
  </svg>
)

const ZoomOutIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
    <circle cx="11" cy="11" r="8"/>
    <path d="M21 21l-4.35-4.35M8 11h6"/>
  </svg>
)

const RotateIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
    <path d="M23 4v6h-6M1 20v-6h6"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
)

const TrashIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
)

const EditIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

const SaveIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
)

const FileIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
)

const DownloadIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

// ====================== ENHANCED OCR CONFIGURATION ======================
const OCR_CONFIG = {
  languages: ['eng', 'chi_sim'],
  psm: PSM.AUTO_OSD,
  oem: OEM.LSTM_ONLY,
  tessdataPath: 'https://tessdata.projectnaptha.com/4.0.0_best',
  preprocessing: {
    resize: true,
    targetDPI: 300,
    contrast: 1.5,
    sharpen: true,
    denoise: true,
    threshold: 128
  }
}

// ====================== IMAGE PREPROCESSING ======================
class ImagePreprocessor {
  static async process(file: File): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image()
      const reader = new FileReader()
      
      reader.onload = (e) => {
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')!
          
          let { width, height } = this.calculateOptimalSize(img.width, img.height)
          canvas.width = width
          canvas.height = height
          
          ctx.drawImage(img, 0, 0, width, height)
          
          let imageData = ctx.getImageData(0, 0, width, height)
          
          imageData = this.toGrayscale(imageData)
          imageData = this.adjustContrast(imageData, OCR_CONFIG.preprocessing.contrast)
          
          if (OCR_CONFIG.preprocessing.denoise) {
            imageData = this.denoise(imageData)
          }
          
          if (OCR_CONFIG.preprocessing.sharpen) {
            imageData = this.sharpen(imageData)
          }
          
          ctx.putImageData(imageData, 0, 0)
          resolve(canvas.toDataURL('image/png'))
        }
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(file)
    })
  }
  
  static calculateOptimalSize(width: number, height: number) {
    const MAX_SIZE = 2560
    const MIN_SIZE = 1280
    
    if (width < MIN_SIZE && height < MIN_SIZE) {
      const scale = MIN_SIZE / Math.min(width, height)
      return {
        width: Math.round(width * scale),
        height: Math.round(height * scale)
      }
    }
    
    if (width > MAX_SIZE || height > MAX_SIZE) {
      const scale = MAX_SIZE / Math.max(width, height)
      return {
        width: Math.round(width * scale),
        height: Math.round(height * scale)
      }
    }
    
    return { width, height }
  }
  
  static toGrayscale(imageData: ImageData): ImageData {
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      data[i] = data[i + 1] = data[i + 2] = gray
    }
    return imageData
  }
  
  static adjustContrast(imageData: ImageData, factor: number): ImageData {
    const data = imageData.data
    const adjust = (value: number) => Math.max(0, Math.min(255, (value - 128) * factor + 128))
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = adjust(data[i])
      data[i + 1] = adjust(data[i + 1])
      data[i + 2] = adjust(data[i + 2])
    }
    return imageData
  }
  
  static denoise(imageData: ImageData): ImageData {
    const data = imageData.data
    const width = imageData.width
    const height = imageData.height
    const output = new Uint8ClampedArray(data)
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4
        let sum = 0
        let count = 0
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nIdx = ((y + dy) * width + (x + dx)) * 4
            sum += data[nIdx]
            count++
          }
        }
        
        output[idx] = output[idx + 1] = output[idx + 2] = sum / count
      }
    }
    
    imageData.data.set(output)
    return imageData
  }
  
  static sharpen(imageData: ImageData): ImageData {
    const data = imageData.data
    const width = imageData.width
    const height = imageData.height
    const output = new Uint8ClampedArray(data)
    
    const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0]
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4
        let sum = 0
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const nIdx = ((y + ky) * width + (x + kx)) * 4
            const kernelIdx = (ky + 1) * 3 + (kx + 1)
            sum += data[nIdx] * kernel[kernelIdx]
          }
        }
        
        output[idx] = output[idx + 1] = output[idx + 2] = Math.max(0, Math.min(255, sum))
      }
    }
    
    imageData.data.set(output)
    return imageData
  }
}

// ====================== ENHANCED MRZ PARSER (FINAL FIXED) ======================
class EnhancedMRZParser {
  
  static parse(text: string): ExtractedData {
    console.log("🔍 Starting MRZ-Focused Parsing...")
    
    const mrzLines = this.extractMRZLines(text)
    
    if (mrzLines.line1 && mrzLines.line2) {
      console.log("✅ Found MRZ Lines!")
      console.log("   Line 1:", mrzLines.line1)
      console.log("   Line 2:", mrzLines.line2)
      
      const mrzData = this.parseMRZPositionBased(mrzLines.line1, mrzLines.line2)
      const visualData = this.parseVisualText(text)
      
      return {
        passportNo: mrzData.passportNo || visualData.passportNo || "",
        fullName: mrzData.fullName || visualData.fullName || "",
        dateOfBirth: mrzData.dateOfBirth || visualData.dateOfBirth || "",
        placeOfBirth: visualData.placeOfBirth || "",
        dateOfIssue: visualData.dateOfIssue || "",
        dateOfExpiry: mrzData.dateOfExpiry || visualData.dateOfExpiry || "",
        nationality: mrzData.nationality || visualData.nationality || "",
        gender: mrzData.gender || visualData.gender || ""
      }
    }
    
    console.warn("⚠️ MRZ not found, using visual parsing only")
    return this.parseVisualText(text)
  }
  
  static extractMRZLines(text: string): { line1: string; line2: string } {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    
    let line1 = ""
    let line2 = ""
    
    for (const line of lines) {
      const cleaned = line
        .replace(/\s+/g, '')
        .replace(/[kK]/g, '<')
        .toUpperCase()
      
      const isMRZLike = (
        cleaned.length >= 30 &&
        (/[<]{2,}/.test(cleaned) || /^[A-Z0-9<]{30,}$/.test(cleaned))
      )
      
      if (isMRZLike) {
        if (cleaned.startsWith('P') && cleaned.includes('CHN')) {
          line1 = cleaned
          console.log("📌 Found MRZ Line 1:", line1)
        }
        else if (/^[A-Z]{1,2}\d/.test(cleaned) && cleaned.includes('CHN')) {
          line2 = cleaned
          console.log("📌 Found MRZ Line 2:", line2)
        }
      }
    }
    
    return { line1, line2 }
  }
  
  static parseMRZPositionBased(line1: string, line2: string): ExtractedData {
    const data: ExtractedData = this.emptyData()
    
    const cleanLine1 = line1.replace(/[0]/g, 'O')
    const cleanLine2 = line2
    
    console.log("📝 Parsing MRZ...")
    console.log("   Clean Line 1:", cleanLine1)
    console.log("   Clean Line 2:", cleanLine2)
    
    // ========== PARSE LINE 1: Name ==========
    const chnPosLine1 = cleanLine1.indexOf('CHN')
    if (chnPosLine1 > 0) {
      const afterCHN = cleanLine1.substring(chnPosLine1 + 3)
      const nameParts = afterCHN.split(/<<+/)
      
      if (nameParts.length >= 2) {
        // FIX: Remove numbers from name!
        const surname = nameParts[0]
          .replace(/</g, '')
          .replace(/\d+/g, '')  // ← HAPUS ANGKA
          .trim()
        
        const givenName = nameParts[1]
          .replace(/</g, ' ')
          .replace(/\d+/g, '')  // ← HAPUS ANGKA
          .trim()
        
        if (surname && givenName) {
          data.fullName = `${surname}, ${givenName}`
          console.log("✅ Name:", data.fullName)
        }
      } else if (nameParts.length === 1 && nameParts[0].includes('<')) {
        const altParts = nameParts[0].split('<').filter(p => p.length > 0)
        if (altParts.length >= 2) {
          // FIX: Remove numbers here too
          const surname = altParts[0].replace(/\d+/g, '')
          const givenName = altParts.slice(1).join(' ').replace(/\d+/g, '')
          data.fullName = `${surname}, ${givenName}`
          console.log("✅ Name (alt):", data.fullName)
        }
      }
      
      data.nationality = 'CHN'
    }
    
    // ========== PARSE LINE 2: Details ==========
    const chnPosLine2 = cleanLine2.indexOf('CHN')
    
    if (chnPosLine2 > 0) {
      // Passport number
      const beforeCHN = cleanLine2.substring(0, chnPosLine2)
      const passportMatch = beforeCHN.match(/^([A-Z]{1,2}\d+)/)
      if (passportMatch) {
        let passport = passportMatch[1]
        if (passport.length > 8) {
          passport = passport.substring(0, passport.length - 1)
        }
        data.passportNo = passport
        console.log("✅ Passport:", data.passportNo)
      }
      
      // After CHN
      const afterCHN = cleanLine2.substring(chnPosLine2 + 3)
      console.log("   After CHN:", afterCHN)
      
      // Birth date
      const birthMatch = afterCHN.match(/^(\d{6})/)
      if (birthMatch) {
        // Birth = bisa 1900s atau 2000s
        data.dateOfBirth = this.formatMRZDate(birthMatch[1], false)
        console.log("✅ Birth:", data.dateOfBirth, "from", birthMatch[1])
      }
      
      // Gender and Expiry
      const genderMatch = afterCHN.match(/\d{6}\d?([MF])/)
      if (genderMatch) {
        data.gender = genderMatch[1] === 'M' ? 'Male' : 'Female'
        console.log("✅ Gender:", data.gender)
        
        const afterGender = afterCHN.substring(afterCHN.indexOf(genderMatch[1]) + 1)
        const expiryMatch = afterGender.match(/^(\d{6})/)
        if (expiryMatch) {
          // Expiry = SELALU masa depan (2000+)
          data.dateOfExpiry = this.formatMRZDate(expiryMatch[1], true)
          console.log("✅ Expiry:", data.dateOfExpiry, "from", expiryMatch[1])
        }
      }
    }
    
    return data
  }
  
  // ==================== FORMAT MRZ DATE (FIXED!) ====================
  static formatMRZDate(dateStr: string, isExpiry: boolean = false): string {
    if (!/^\d{6}$/.test(dateStr)) return ""
    
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
                    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
    
    const yy = parseInt(dateStr.substring(0, 2))
    const mm = parseInt(dateStr.substring(2, 4))
    const dd = parseInt(dateStr.substring(4, 6))
    
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return ""
    
    // FIX: Different logic for birth vs expiry!
    let year: number
    
    if (isExpiry) {
      // Expiry date: ALWAYS in the future (2000-2099)
      year = 2000 + yy
      console.log(`   Expiry year logic: ${yy} → ${year} (always 2000+)`)
    } else {
      // Birth date: 00-30 = 2000s, 31-99 = 1900s
      year = yy <= 30 ? 2000 + yy : 1900 + yy
      console.log(`   Birth year logic: ${yy} → ${year}`)
    }
    
    const month = months[mm - 1]
    
    return `${dd.toString().padStart(2, '0')} ${month} ${year}`
  }
  
  static parseVisualText(text: string): ExtractedData {
    const data: ExtractedData = this.emptyData()
    const lines = text.split('\n').map(l => l.trim())
    
    for (const line of lines) {
      if (!data.passportNo) {
        const match = line.match(/([A-Z]{1,2})\s*(\d[\s\d]{6,8})/)
        if (match) {
          data.passportNo = match[1] + match[2].replace(/\s/g, '')
        }
      }
      
      if (!data.fullName) {
        const match = line.match(/([A-Z]{2,15}),\s*([A-Z]{2,})/)
        if (match) {
          const excludes = ['TYPE', 'SEX', 'COUNTRY', 'CODE', 'PASSPORT']
          if (!excludes.includes(match[1])) {
            data.fullName = `${match[1]}, ${match[2]}`
          }
        }
      }
      
      const dateMatch = line.match(/(\d{1,2})\s*([A-Z]{3})\s*(\d{4})/i)
      if (dateMatch) {
        const formatted = `${dateMatch[1].padStart(2, '0')} ${dateMatch[2].toUpperCase()} ${dateMatch[3]}`
        const year = parseInt(dateMatch[3])
        
        if (!data.dateOfBirth && year >= 1950 && year <= 2010) {
          data.dateOfBirth = formatted
        } else if (!data.dateOfExpiry && year > 2025) {
          data.dateOfExpiry = formatted
        } else if (!data.dateOfIssue && year >= 2015 && year <= 2025) {
          data.dateOfIssue = formatted
        }
      }
      
      if (!data.nationality && /CHINESE|CHN|中\s*国/i.test(line)) {
        data.nationality = "CHN"
      }
      
      if (!data.gender) {
        if (/男|\/M|Male/i.test(line)) data.gender = "Male"
        else if (/女|\/F|Female/i.test(line)) data.gender = "Female"
      }
    }
    
    return data
  }
  
  static emptyData(): ExtractedData {
    return {
      passportNo: "", fullName: "", dateOfBirth: "", placeOfBirth: "",
      dateOfIssue: "", dateOfExpiry: "", nationality: "", gender: ""
    }
  }
}

// ====================== ENHANCED OCR WORKER ======================
class EnhancedOCRWorker {
  private worker: any = null
  private initialized = false
  
  async initialize() {
    if (this.initialized) return
    
    // Create single worker with combined languages
    this.worker = await createWorker('eng+chi_sim', 1, {
      workerPath: 'https://unpkg.com/tesseract.js@v5.1.1/dist/worker.min.js',
      corePath: 'https://unpkg.com/tesseract.js-core@v5.1.0/tesseract-core.wasm.js',
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
      logger: () => {}
    })
    
    this.initialized = true
  }
  
  async recognize(imageData: string, onProgress?: (p: number) => void): Promise<string> {
    await this.initialize()
    
    if (onProgress) onProgress(50)
    
    const result = await this.worker.recognize(imageData)
    
    if (onProgress) onProgress(100)
    
    return result.data.text
  }
  
  async terminate() {
    if (this.worker) {
      await this.worker.terminate()
      this.worker = null
      this.initialized = false
    }
  }
}

// ====================== COMPONENTS ======================
function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <button
      onClick={handleCopy}
      disabled={!text}
      className={`p-1.5 rounded-lg transition-all duration-200 ${
        copied 
          ? "bg-green-500/20 text-green-400" 
          : text 
            ? "bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white" 
            : "bg-gray-800 text-gray-600 cursor-not-allowed"
      }`}
      title={label ? `Copy ${label}` : "Copy"}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  )
}

function DataField({ 
  label, 
  value, 
  onChange, 
  isEditing 
}: { 
  label: string
  value: string
  onChange: (v: string) => void
  isEditing: boolean
}) {
  return (
    <div className="border-b border-gray-700/30 pb-3 mb-3 last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <span className="text-green-400 text-xl">✅</span>
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-400 block mb-1">
            {label}:
          </label>
          {isEditing ? (
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-lg font-semibold focus:outline-none focus:border-purple-500"
            />
          ) : (
            <p className={`text-lg font-semibold ${value ? "text-white" : "text-gray-500 italic"}`}>
              {value || "Not detected"}
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          <CopyButton text={value} label={label} />
        </div>
      </div>
    </div>
  )
}

function Tabs({ 
  tabs, 
  activeTab, 
  onChange 
}: { 
  tabs: { id: string; label: string }[]
  activeTab: string
  onChange: (id: string) => void 
}) {
  return (
    <div className="flex gap-1 p-1 bg-gray-800/50 rounded-xl">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all ${
            activeTab === tab.id
              ? "bg-purple-600 text-white shadow-lg shadow-purple-500/25"
              : "text-gray-400 hover:text-white hover:bg-gray-700/50"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
      <div 
        className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-300"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

// ====================== MAIN COMPONENT ======================
export default function EnhancedPassportOCR() {
  const [files, setFiles] = useState<ProcessedFile[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [workerReady, setWorkerReady] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState("Initializing Enhanced OCR...")
  const [activeTab, setActiveTab] = useState("data")
  const [isEditing, setIsEditing] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const ocrWorker = useRef<EnhancedOCRWorker>(new EnhancedOCRWorker())
  
  useEffect(() => {
    const initOCR = async () => {
      try {
        setLoadingMessage("Loading Enhanced OCR (Chinese + English)...")
        await ocrWorker.current.initialize()
        setWorkerReady(true)
        setLoadingMessage("Ready!")
      } catch (err) {
        console.error("OCR initialization failed:", err)
        setLoadingMessage("Failed to initialize. Please refresh.")
      }
    }
    
    initOCR()
    
    return () => {
      ocrWorker.current.terminate()
    }
  }, [])
  
  const processFile = async (file: File, onProgress: (p: number) => void) => {
    try {
      onProgress(10)
      const processedImage = await ImagePreprocessor.process(file)
      
      onProgress(20)
      const text = await ocrWorker.current.recognize(processedImage, (p) => {
        onProgress(20 + p * 0.6)
      })
      
      onProgress(85)
      const structuredData = EnhancedMRZParser.parse(text)
      
      onProgress(100)
      
      return { text, structuredData }
    } catch (error) {
      console.error("OCR processing failed:", error)
      throw error
    }
  }
  
  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || !workerReady) return
    
    const valid = Array.from(fileList).filter(f => f.type.startsWith("image/"))
    if (valid.length === 0) {
      alert("Please select valid image files (JPG, PNG)")
      return
    }
    
    const newFiles: ProcessedFile[] = valid.map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      imageUrl: URL.createObjectURL(file),
      extractedText: "",
      structuredData: {
        passportNo: "", fullName: "", dateOfBirth: "", placeOfBirth: "",
        dateOfIssue: "", dateOfExpiry: "", nationality: "", gender: ""
      },
      isProcessing: true,
      progress: 0,
      error: null
    }))
    
    setFiles(prev => [...prev, ...newFiles])
    if (!selectedId && newFiles[0]) setSelectedId(newFiles[0].id)
    
    for (const fileData of newFiles) {
      try {
        const result = await processFile(fileData.file, (progress) => {
          setFiles(prev => prev.map(f => 
            f.id === fileData.id ? { ...f, progress } : f
          ))
        })
        
        setFiles(prev => prev.map(f => 
          f.id === fileData.id 
            ? { 
                ...f, 
                extractedText: result.text,
                structuredData: result.structuredData,
                isProcessing: false,
                progress: 100
              }
            : f
        ))
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === fileData.id 
            ? { ...f, isProcessing: false, error: String(error) }
            : f
        ))
      }
    }
  }, [workerReady, selectedId])
  
  const updateField = (field: keyof ExtractedData, value: string) => {
    setFiles(prev => prev.map(f => 
      f.id === selectedId 
        ? { ...f, structuredData: { ...f.structuredData, [field]: value } }
        : f
    ))
  }
  
  const deleteFile = (id: string) => {
    const file = files.find(f => f.id === id)
    if (file) URL.revokeObjectURL(file.imageUrl)
    
    setFiles(prev => prev.filter(f => f.id !== id))
    if (selectedId === id) {
      const remaining = files.filter(f => f.id !== id)
      setSelectedId(remaining[0]?.id || "")
    }
  }
  
  const reprocessFile = async (id: string) => {
    const file = files.find(f => f.id === id)
    if (!file || !workerReady) return
    
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, isProcessing: true, progress: 0, error: null } : f
    ))
    
    try {
      const result = await processFile(file.file, (progress) => {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, progress } : f))
      })
      
      setFiles(prev => prev.map(f =>
        f.id === id 
          ? { ...f, extractedText: result.text, structuredData: result.structuredData, isProcessing: false, progress: 100 }
          : f
      ))
    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.id === id ? { ...f, isProcessing: false, error: String(error) } : f
      ))
    }
  }
  
  const exportCSV = () => {
    const rows = files.map(f => [
      f.file.name, f.structuredData.passportNo, f.structuredData.fullName,
      f.structuredData.dateOfBirth, f.structuredData.dateOfExpiry,
      f.structuredData.nationality, f.structuredData.gender
    ].map(v => `"${(v || "").replace(/"/g, '""')}"`).join(","))
    
    const csv = ["File,Passport No,Full Name,Date Of Birth,Date Of Expiry,Nationality,Gender", ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `passport_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  const clearAllFiles = useCallback(() => {
    files.forEach(f => URL.revokeObjectURL(f.imageUrl))
    setFiles([])
    setSelectedId("")
  }, [files])
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])
  
  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])
  
  const selectedFile = files.find(f => f.id === selectedId)
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                Passport OCR Pro - Enhanced Edition
              </h1>
              <p className="text-sm text-gray-500">
                EasyOCR-inspired • Advanced MRZ Parser • Multi-Language Support
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">
                ⚡ Enhanced OCR
              </span>
              {workerReady ? (
                <span className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"/>
                  Ready
                </span>
              ) : (
                <span className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-500/10 px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"/>
                  {loadingMessage}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Upload Area */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${
            isDragging 
              ? "border-purple-500 bg-purple-500/10 scale-[1.02]" 
              : workerReady 
                ? "border-gray-700 hover:border-gray-600 cursor-pointer hover:bg-gray-800/30" 
                : "border-gray-800 opacity-50 cursor-not-allowed"
          }`}
          onClick={() => workerReady && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <UploadIcon />
          <p className="text-xl font-semibold mt-4">
            {isDragging ? "Drop your passport here" : "Upload Passport Images"}
          </p>
          <p className="text-gray-400 mt-2">
            Drag & drop or click to browse • JPG, PNG supported
          </p>
          <p className="text-gray-500 text-sm mt-1">
            💡 Enhanced OCR with better accuracy for Chinese passports
          </p>
        </div>
        <input 
          ref={fileInputRef} 
          type="file" 
          multiple 
          accept="image/*" 
          onChange={e => handleFiles(e.target.files)} 
          className="hidden"
        />
        
        {/* Main Content */}
        {files.length > 0 && (
          <div className="mt-8 grid grid-cols-12 gap-6">
            {/* Sidebar - File List */}
            <aside className="col-span-12 lg:col-span-3">
              <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-200">Files ({files.length})</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={exportCSV}
                      className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                      title="Export CSV"
                    >
                      <DownloadIcon />
                    </button>
                    <button
                      onClick={clearAllFiles}
                      className="p-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors"
                      title="Clear All"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                  {files.map(f => (
                    <div
                      key={f.id}
                      onClick={() => setSelectedId(f.id)}
                      className={`p-3 border-b border-gray-700/30 cursor-pointer transition-all ${
                        f.id === selectedId 
                          ? "bg-purple-600/20 border-l-4 border-l-purple-500" 
                          : "hover:bg-gray-700/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <img 
                          src={f.imageUrl} 
                          alt="Thumbnail"
                          className="w-12 h-12 object-cover rounded-lg"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{f.file.name}</p>
                          {f.isProcessing ? (
                            <div className="mt-2">
                              <ProgressBar progress={f.progress} />
                              <p className="text-xs text-gray-500 mt-1">Processing...</p>
                            </div>
                          ) : f.error ? (
                            <p className="text-xs text-red-400 mt-1">❌ Error</p>
                          ) : (
                            <p className="text-xs text-green-400 mt-1">
                              ✓ {f.structuredData.passportNo || "Processed"}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteFile(f.id) }}
                          className="p-1.5 hover:bg-red-600/20 text-gray-500 hover:text-red-400 rounded-lg transition-colors"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
            
            {/* Main Panel */}
            <section className="col-span-12 lg:col-span-9">
              {selectedFile ? (
                <div className="space-y-6">
                  {/* Image Preview */}
                  <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 overflow-hidden">
                    <div className="p-4 border-b border-gray-700/50 flex items-center justify-between flex-wrap gap-2">
                      <h3 className="font-semibold text-gray-200 flex items-center gap-2">
                        <FileIcon />
                        <span className="truncate max-w-[200px]">{selectedFile.file.name}</span>
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <ZoomOutIcon />
                        </button>
                        <span className="text-sm text-gray-400 w-16 text-center">
                          {Math.round(zoom * 100)}%
                        </span>
                        <button
                          onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <ZoomInIcon />
                        </button>
                        <button
                          onClick={() => setRotation(r => (r + 90) % 360)}
                          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <RotateIcon />
                        </button>
                        <button
                          onClick={() => { setZoom(1); setRotation(0) }}
                          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => reprocessFile(selectedFile.id)}
                          disabled={selectedFile.isProcessing}
                          className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg transition-colors text-sm"
                        >
                          🔄 Reprocess
                        </button>
                      </div>
                    </div>
                    <div className="p-4 overflow-auto max-h-[400px] flex items-center justify-center bg-gray-900/50">
                      <img
                        src={selectedFile.imageUrl}
                        alt="Passport"
                        className="max-w-full transition-transform duration-300"
                        style={{
                          transform: `scale(${zoom}) rotate(${rotation}deg)`,
                          transformOrigin: 'center center'
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* Data Panel */}
                  <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 overflow-hidden">
                    <div className="p-4 border-b border-gray-700/50 flex items-center justify-between flex-wrap gap-4">
                      <Tabs
                        tabs={[
                          { id: "data", label: "Extracted Data" },
                          { id: "raw", label: "Raw Text" },
                        ]}
                        activeTab={activeTab}
                        onChange={setActiveTab}
                      />
                      {activeTab === "data" && (
                        <button
                          onClick={() => setIsEditing(!isEditing)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                            isEditing 
                              ? "bg-green-600 hover:bg-green-700" 
                              : "bg-gray-700 hover:bg-gray-600"
                          }`}
                        >
                          {isEditing ? <SaveIcon /> : <EditIcon />}
                          {isEditing ? "Save" : "Edit"}
                        </button>
                      )}
                    </div>
                    
                    <div className="p-6">
                      {activeTab === "data" && (
                        <div className="space-y-1">
                          <DataField
                            label="Passport No"
                            value={selectedFile.structuredData.passportNo}
                            onChange={(v) => updateField("passportNo", v)}
                            isEditing={isEditing}
                          />
                          <DataField
                            label="Full Name"
                            value={selectedFile.structuredData.fullName}
                            onChange={(v) => updateField("fullName", v)}
                            isEditing={isEditing}
                          />
                          <DataField
                            label="Date of Birth"
                            value={selectedFile.structuredData.dateOfBirth}
                            onChange={(v) => updateField("dateOfBirth", v)}
                            isEditing={isEditing}
                          />
                          <DataField
                            label="Date of Expiry"
                            value={selectedFile.structuredData.dateOfExpiry}
                            onChange={(v) => updateField("dateOfExpiry", v)}
                            isEditing={isEditing}
                          />
                          <DataField
                            label="Nationality"
                            value={selectedFile.structuredData.nationality}
                            onChange={(v) => updateField("nationality", v)}
                            isEditing={isEditing}
                          />
                          <DataField
                            label="Gender"
                            value={selectedFile.structuredData.gender}
                            onChange={(v) => updateField("gender", v)}
                            isEditing={isEditing}
                          />
                        </div>
                      )}
                      
                      {activeTab === "raw" && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <p className="text-sm text-gray-400">
                              {selectedFile.extractedText.length} characters extracted
                            </p>
                            <CopyButton text={selectedFile.extractedText} label="All Text" />
                          </div>
                          <textarea
                            readOnly
                            value={selectedFile.extractedText}
                            className="w-full h-80 bg-gray-900 p-4 rounded-xl border border-gray-700 font-mono text-sm focus:outline-none resize-none"
                            placeholder="No text extracted..."
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 p-12 text-center">
                  <FileIcon />
                  <p className="text-gray-400 mt-4">Select a file from the sidebar to view details</p>
                </div>
              )}
            </section>
          </div>
        )}
        
        {/* Quick Stats */}
        {files.length > 0 && (
          <section className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
              <p className="text-3xl font-bold text-purple-400">{files.length}</p>
              <p className="text-sm text-gray-400">Total Files</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
              <p className="text-3xl font-bold text-green-400">
                {files.filter(f => !f.isProcessing && !f.error && f.structuredData.passportNo).length}
              </p>
              <p className="text-sm text-gray-400">Successful</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
              <p className="text-3xl font-bold text-yellow-400">
                {files.filter(f => f.isProcessing).length}
              </p>
              <p className="text-sm text-gray-400">Processing</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
              <p className="text-3xl font-bold text-red-400">
                {files.filter(f => f.error || (!f.isProcessing && !f.structuredData.passportNo)).length}
              </p>
              <p className="text-sm text-gray-400">Failed/No Data</p>
            </div>
          </section>
        )}
      </main>
      
      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12 py-6 text-center text-gray-500 text-sm">
        <p>Passport OCR Pro Enhanced • Built with Next.js & Tesseract.js • All processing happens locally</p>
      </footer>
    </div>
  )
}