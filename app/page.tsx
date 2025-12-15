// app/page.tsx
"use client"

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { createWorker, PSM, OEM } from "tesseract.js"
import * as XLSX from 'xlsx'

// ====================== TYPES ======================
interface ExtractedData {
  passportNo: string
  fullName: string
  dateOfBirth: string
  placeOfBirth: string
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

type SortField = keyof ExtractedData | 'filename' | 'status'
type SortDirection = 'asc' | 'desc'

// ====================== ICONS ======================
const UploadIcon = () => (
  <svg className="h-16 w-16 text-purple-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 48 48">
    <path d="M42 30v8a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4v-8" strokeWidth={3} strokeLinecap="round"/>
    <polyline points="34 20 24 10 14 20" strokeWidth={3} strokeLinecap="round"/>
    <line x1="24" y1="10" x2="24" y2="30" strokeWidth={3} strokeLinecap="round"/>
  </svg>
)

const SearchIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <circle cx="11" cy="11" r="8"/>
    <path d="M21 21l-4.35-4.35"/>
  </svg>
)

const SortIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M3 6h18M3 12h12M3 18h6"/>
  </svg>
)

const FilterIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
)

const CopyIcon = ({ className = "h-4 w-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)

const CheckIcon = ({ className = "h-4 w-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const TrashIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
)

const EditIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

const SaveIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
)

const ExcelIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
    <line x1="9" y1="12" x2="15" y2="12"/>
  </svg>
)

const DownloadIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const FileTextIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
)

// ====================== OCR CONFIG ======================
const OCR_CONFIG = {
  preprocessing: { contrast: 1.5, denoise: true, sharpen: true }
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
          if (OCR_CONFIG.preprocessing.denoise) imageData = this.denoise(imageData)
          if (OCR_CONFIG.preprocessing.sharpen) imageData = this.sharpen(imageData)
          
          ctx.putImageData(imageData, 0, 0)
          resolve(canvas.toDataURL('image/png'))
        }
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(file)
    })
  }
  
  static calculateOptimalSize(width: number, height: number) {
    const MAX_SIZE = 2560, MIN_SIZE = 1280
    if (width < MIN_SIZE && height < MIN_SIZE) {
      const scale = MIN_SIZE / Math.min(width, height)
      return { width: Math.round(width * scale), height: Math.round(height * scale) }
    }
    if (width > MAX_SIZE || height > MAX_SIZE) {
      const scale = MAX_SIZE / Math.max(width, height)
      return { width: Math.round(width * scale), height: Math.round(height * scale) }
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
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, (data[i] - 128) * factor + 128))
      data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] - 128) * factor + 128))
      data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] - 128) * factor + 128))
    }
    return imageData
  }
  
  static denoise(imageData: ImageData): ImageData {
    const data = imageData.data, width = imageData.width, height = imageData.height
    const output = new Uint8ClampedArray(data)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4
        let sum = 0, count = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += data[((y + dy) * width + (x + dx)) * 4]
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
    const data = imageData.data, width = imageData.width, height = imageData.height
    const output = new Uint8ClampedArray(data)
    const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0]
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4
        let sum = 0
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            sum += data[((y + ky) * width + (x + kx)) * 4] * kernel[(ky + 1) * 3 + (kx + 1)]
          }
        }
        output[idx] = output[idx + 1] = output[idx + 2] = Math.max(0, Math.min(255, sum))
      }
    }
    imageData.data.set(output)
    return imageData
  }
}

// ====================== MRZ PARSER ======================
class EnhancedMRZParser {
  static parse(text: string): ExtractedData {
    const mrzLines = this.extractMRZLines(text)
    let mrzData = this.emptyData()
    
    if (mrzLines.line1 && mrzLines.line2) {
      mrzData = this.parseMRZByPosition(mrzLines.line1, mrzLines.line2)
    }
    
    const visualData = this.parseVisualText(text)
    
    return {
      passportNo: mrzData.passportNo || visualData.passportNo || "",
      fullName: mrzData.fullName || visualData.fullName || "",
      dateOfBirth: mrzData.dateOfBirth || visualData.dateOfBirth || "",
      placeOfBirth: visualData.placeOfBirth || "",
      dateOfExpiry: mrzData.dateOfExpiry || visualData.dateOfExpiry || "",
      nationality: mrzData.nationality || visualData.nationality || "",
      gender: mrzData.gender || visualData.gender || ""
    }
  }
  
  static extractMRZLines(text: string): { line1: string; line2: string } {
    const lines = text.split('\n')
    let line1 = "", line2 = ""
    
    for (const line of lines) {
      const cleaned = line.trim().replace(/\s+/g, '').toUpperCase()
      
      if (!line1 && (cleaned.includes('P0CHN') || cleaned.includes('POCHN') || cleaned.includes('P<CHN'))) {
        line1 = cleaned.replace(/P0CHN/g, 'P<CHN').replace(/POCHN/g, 'P<CHN')
      }
      
      if (!line2 && line1 && cleaned.includes('CHN') && /\d{6,}/.test(cleaned) && cleaned.length >= 30) {
        line2 = this.cleanMRZLine2(cleaned)
      }
    }
    
    if (line1 && !line2) {
      for (const line of lines) {
        const cleaned = line.replace(/\s+/g, '').toUpperCase()
        if (/CHN\d{6,7}[MF]\d{6}/.test(cleaned)) {
          line2 = this.cleanMRZLine2(cleaned)
          break
        }
      }
    }
    
    return { line1, line2 }
  }
  
  static cleanMRZLine2(raw: string): string {
    let cleaned = raw
    const fixes: Record<string, string> = { '丁F': 'EF', '丁G': 'EG', '一F': 'EF', '一G': 'EG', ',丁F': 'EF', ',F': 'EF', '0F': 'EF', '0G': 'EG' }
    for (const [wrong, correct] of Object.entries(fixes)) {
      if (cleaned.startsWith(wrong)) {
        cleaned = correct + cleaned.substring(wrong.length)
        break
      }
    }
    return cleaned.replace(/^[,、。；]/g, '')
  }
  
  static parseMRZByPosition(line1: string, line2: string): ExtractedData {
    const data = this.emptyData()
    
    if (line1.includes('CHN')) {
      data.nationality = 'CHN'
      const chnIndex = line1.indexOf('CHN')
      const nameSection = line1.substring(chnIndex + 3).replace(/K/g, '<')
      const nameParts = nameSection.split(/<<+/)
      
      if (nameParts.length >= 2) {
        const surname = nameParts[0].replace(/[<]/g, '').replace(/0/g, 'O').replace(/\d+/g, '').trim()
        const givenName = nameParts[1].replace(/[<]/g, ' ').replace(/0/g, 'O').replace(/\d+/g, '').replace(/\s+/g, ' ').trim()
        if (surname && givenName) data.fullName = `${surname}, ${givenName}`
      }
    }
    
    if (!line2) return data
    
    const chnIndex = line2.indexOf('CHN')
    if (chnIndex === -1) return data
    
    let passport = line2.substring(0, chnIndex).replace(/[^A-Z0-9]/g, '')
    
    if (passport.match(/^([A-Z]{1,2})\d{7}(\d)\2$/)) {
      passport = passport.substring(0, passport.length - 1)
    } else if (passport.length > 9) {
      passport = passport.substring(0, 9)
    }
    
    data.passportNo = passport
    
    const afterCHN = line2.substring(chnIndex + 3)
    if (afterCHN.length >= 6) {
      const dobRaw = afterCHN.substring(0, 6)
      if (/^\d{6}$/.test(dobRaw)) data.dateOfBirth = this.parseMRZDate(dobRaw, false)
    }
    
    if (afterCHN.length >= 8) {
      const genderChar = afterCHN[7]
      if (genderChar === 'M' || genderChar === 'F') {
        data.gender = genderChar === 'M' ? 'Male' : 'Female'
        const afterGender = afterCHN.substring(8)
        if (afterGender.length >= 6) {
          const doeRaw = afterGender.substring(0, 6)
          if (/^\d{6}$/.test(doeRaw)) data.dateOfExpiry = this.parseMRZDate(doeRaw, true)
        }
      }
    }
    
    return data
  }
  
  static parseMRZDate(dateStr: string, isExpiry: boolean): string {
    if (!/^\d{6}$/.test(dateStr)) return ""
    const yy = parseInt(dateStr.substring(0, 2))
    const mm = parseInt(dateStr.substring(2, 4))
    const dd = parseInt(dateStr.substring(4, 6))
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return ""
    const year = isExpiry ? 2000 + yy : (yy <= 30 ? 2000 + yy : 1900 + yy)
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
    return `${dd.toString().padStart(2, '0')} ${months[mm - 1]} ${year}`
  }
  
  static parseVisualText(text: string): ExtractedData {
    const data = this.emptyData()
    const lines = text.split('\n').map(l => l.trim())
    
    const provinces = ['BEIJING', 'SHANGHAI', 'TIANJIN', 'CHONGQING', 'HEBEI', 'SHANXI', 'LIAONING', 'JILIN', 'HEILONGJIANG', 'JIANGSU', 'ZHEJIANG', 'ANHUI', 'FUJIAN', 'JIANGXI', 'SHANDONG', 'HENAN', 'HUBEI', 'HUNAN', 'GUANGDONG', 'HAINAN', 'SICHUAN', 'GUIZHOU', 'YUNNAN', 'SHAANXI', 'GANSU', 'QINGHAI', 'TAIWAN', 'GUANGXI', 'NEIMENGGU', 'NINGXIA', 'XINJIANG', 'XIZANG', 'HONGKONG', 'MACAU', '北京', '上海', '天津', '重庆', '河北', '山西', '辽宁', '吉林', '黑龙江', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '海南', '四川', '贵州', '云南', '陕西', '甘肃', '青海', '台湾', '广西', '内蒙古', '宁夏', '新疆', '西藏', '香港', '澳门']
    
    for (const line of lines) {
      if (!data.passportNo) {
        const match = line.match(/([EG][A-Z]?)\s*(\d{7})(?:\d)?/i)
        if (match) data.passportNo = (match[1] + match[2]).replace(/\s/g, '').toUpperCase()
      }
      if (!data.fullName) {
        const match = line.match(/([A-Z]{2,}),\s*([A-Z]{2,})/)
        if (match && !['TYPE', 'CODE'].includes(match[1])) data.fullName = `${match[1]}, ${match[2]}`
      }
      if (!data.placeOfBirth) {
        const upperLine = line.toUpperCase()
        for (const province of provinces) {
          if (upperLine.includes(province) || line.includes(province)) {
            data.placeOfBirth = province.toUpperCase()
            break
          }
        }
      }
      if (!data.nationality && /CHINESE|CHN/i.test(line)) data.nationality = 'CHN'
      if (!data.gender) {
        if (/男|\/M\s|Male/i.test(line)) data.gender = 'Male'
        else if (/女|\/F\s|Female/i.test(line)) data.gender = 'Female'
      }
    }
    
    return data
  }
  
  static emptyData(): ExtractedData {
    return { passportNo: "", fullName: "", dateOfBirth: "", placeOfBirth: "", dateOfExpiry: "", nationality: "", gender: "" }
  }
}

// ====================== OCR WORKER ======================
class EnhancedOCRWorker {
  private worker: any = null
  private initialized = false
  
  async initialize() {
    if (this.initialized) return
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
function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
      <div className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-300" style={{ width: `${progress}%` }}/>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={handleCopy} disabled={!text} className={`p-1.5 rounded transition-all ${copied ? "bg-green-500/20 text-green-400" : text ? "hover:bg-gray-700 text-gray-400" : "text-gray-600 cursor-not-allowed"}`}>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  )
}

// ====================== MAIN COMPONENT ======================
export default function EnhancedPassportOCR() {
  const [files, setFiles] = useState<ProcessedFile[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [workerReady, setWorkerReady] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState("Initializing OCR...")
  const [activeTab, setActiveTab] = useState("table")
  const [isDragging, setIsDragging] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>("filename")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "error" | "processing">("all")
  const [isEditing, setIsEditing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const ocrWorker = useRef<EnhancedOCRWorker>(new EnhancedOCRWorker())
  
  useEffect(() => {
    const initOCR = async () => {
      try {
        setLoadingMessage("Loading OCR Engine...")
        await ocrWorker.current.initialize()
        setWorkerReady(true)
        setLoadingMessage("Ready!")
      } catch (err) {
        console.error("OCR init failed:", err)
        setLoadingMessage("Failed to initialize")
      }
    }
    initOCR()
    return () => { ocrWorker.current.terminate() }
  }, [])
  
  const processFile = async (file: File, onProgress: (p: number) => void) => {
    onProgress(10)
    const processedImage = await ImagePreprocessor.process(file)
    onProgress(20)
    const text = await ocrWorker.current.recognize(processedImage, p => onProgress(20 + p * 0.6))
    onProgress(85)
    const structuredData = EnhancedMRZParser.parse(text)
    onProgress(100)
    return { text, structuredData }
  }
  
  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || !workerReady) return
    const valid = Array.from(fileList).filter(f => f.type.startsWith("image/"))
    if (valid.length === 0) return alert("Please select valid image files (JPG, PNG)")
    
    const newFiles: ProcessedFile[] = valid.map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file, imageUrl: URL.createObjectURL(file), extractedText: "",
      structuredData: { passportNo: "", fullName: "", dateOfBirth: "", placeOfBirth: "", dateOfExpiry: "", nationality: "", gender: "" },
      isProcessing: true, progress: 0, error: null
    }))
    
    setFiles(prev => [...prev, ...newFiles])
    if (!selectedId && newFiles[0]) setSelectedId(newFiles[0].id)
    
    for (const fileData of newFiles) {
      try {
        const result = await processFile(fileData.file, progress => {
          setFiles(prev => prev.map(f => f.id === fileData.id ? { ...f, progress } : f))
        })
        setFiles(prev => prev.map(f => f.id === fileData.id ? { ...f, extractedText: result.text, structuredData: result.structuredData, isProcessing: false, progress: 100 } : f))
      } catch (error) {
        setFiles(prev => prev.map(f => f.id === fileData.id ? { ...f, isProcessing: false, error: String(error) } : f))
      }
    }
  }, [workerReady, selectedId])
  
  const updateField = (field: keyof ExtractedData, value: string) => {
    setFiles(prev => prev.map(f => f.id === selectedId ? { ...f, structuredData: { ...f.structuredData, [field]: value } } : f))
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
  
  const clearAllFiles = () => {
    files.forEach(f => URL.revokeObjectURL(f.imageUrl))
    setFiles([])
    setSelectedId("")
  }
  
  const exportToExcel = () => {
    if (files.length === 0) return alert("No data to export!")
    const excelData = files.map((f, i) => ({
      'No': i + 1, 'File Name': f.file.name, 'Passport Number': f.structuredData.passportNo || '-',
      'Full Name': f.structuredData.fullName || '-', 'Date of Birth': f.structuredData.dateOfBirth || '-',
      'Place of Birth': f.structuredData.placeOfBirth || '-', 'Date of Expiry': f.structuredData.dateOfExpiry || '-',
      'Nationality': f.structuredData.nationality || '-', 'Gender': f.structuredData.gender || '-',
      'Status': f.error ? 'Error' : f.structuredData.passportNo ? 'Success' : 'No Data'
    }))
    const ws = XLSX.utils.json_to_sheet(excelData)
    ws['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Passport Data')
    XLSX.writeFile(wb, `Passport_OCR_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const exportToCSV = () => {
    if (files.length === 0) return alert("No data to export!")
    const rows = files.map((f, i) => [i + 1, f.file.name, f.structuredData.passportNo, f.structuredData.fullName, f.structuredData.dateOfBirth, f.structuredData.placeOfBirth, f.structuredData.dateOfExpiry, f.structuredData.nationality, f.structuredData.gender, f.error ? 'Error' : f.structuredData.passportNo ? 'Success' : 'No Data'].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(","))
    const csv = ["No,File Name,Passport Number,Full Name,Date of Birth,Place of Birth,Date of Expiry,Nationality,Gender,Status", ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `Passport_OCR_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportToJSON = () => {
    if (files.length === 0) return alert("No data to export!")
    const jsonData = files.map((f, i) => ({ no: i + 1, filename: f.file.name, ...f.structuredData, status: f.error ? 'error' : 'success' }))
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `Passport_OCR_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  // Filtered and sorted files
  const processedFiles = useMemo(() => {
    let filtered = files.filter(f => !f.isProcessing)
    
    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(f => {
        if (statusFilter === "success") return !f.error && f.structuredData.passportNo
        if (statusFilter === "error") return f.error || (!f.isProcessing && !f.structuredData.passportNo)
        if (statusFilter === "processing") return f.isProcessing
        return true
      })
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(f => 
        f.file.name.toLowerCase().includes(query) ||
        f.structuredData.passportNo.toLowerCase().includes(query) ||
        f.structuredData.fullName.toLowerCase().includes(query) ||
        f.structuredData.dateOfBirth.toLowerCase().includes(query) ||
        f.structuredData.placeOfBirth.toLowerCase().includes(query)
      )
    }
    
    // Sort
    filtered.sort((a, b) => {
      let aVal: string, bVal: string
      
      if (sortField === 'filename') {
        aVal = a.file.name
        bVal = b.file.name
      } else if (sortField === 'status') {
        aVal = a.error ? 'error' : a.structuredData.passportNo ? 'success' : 'no-data'
        bVal = b.error ? 'error' : b.structuredData.passportNo ? 'success' : 'no-data'
      } else {
        aVal = a.structuredData[sortField]
        bVal = b.structuredData[sortField]
      }
      
      if (sortDirection === 'asc') {
        return aVal.localeCompare(bVal)
      } else {
        return bVal.localeCompare(aVal)
      }
    })
    
    return filtered
  }, [files, searchQuery, sortField, sortDirection, statusFilter])
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }
  
  const selectedFile = files.find(f => f.id === selectedId)
  const successCount = files.filter(f => !f.isProcessing && !f.error && f.structuredData.passportNo).length
  const processingCount = files.filter(f => f.isProcessing).length
  const errorCount = files.filter(f => f.error || (!f.isProcessing && !f.structuredData.passportNo)).length
  
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-900 via-purple-900 to-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Passport OCR Pro
              </h1>
              <p className="text-sm text-gray-400">AI-Powered MRZ Parser & Data Extraction</p>
            </div>
            <div className="flex items-center gap-3">
              {workerReady ? (
                <span className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"/>Ready
                </span>
              ) : (
                <span className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-500/10 px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full animate-ping"/>{loadingMessage}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 mb-6 text-center transition-all ${isDragging ? "border-purple-500 bg-purple-500/10" : workerReady ? "border-gray-700 hover:border-gray-600 cursor-pointer hover:bg-gray-800/30" : "border-gray-800 opacity-50 cursor-not-allowed"}`}
          onClick={() => workerReady && fileInputRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files) }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
        >
          <UploadIcon />
          <p className="text-xl font-semibold mt-4">{isDragging ? "Drop files here" : "Upload Passport Images"}</p>
          <p className="text-gray-400 mt-2">Drag & drop or click • JPG, PNG supported • Batch processing enabled</p>
        </div>
        <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={e => handleFiles(e.target.files)} className="hidden"/>

        {/* Main Content */}
        {files.length > 0 && (
          <div className="grid grid-cols-12 gap-6">
            {/* Sidebar */}
            <aside className="col-span-12 lg:col-span-3">
              <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden sticky top-24">
                <div className="p-4 border-b border-gray-700">
                  <h2 className="font-semibold text-gray-200">Files ({files.length})</h2>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                    <span className="text-green-400">{successCount} ✓</span>
                    <span className="text-yellow-400">{processingCount} ⏳</span>
                    <span className="text-red-400">{errorCount} ✗</span>
                  </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto">
                  {files.map(f => (
                    <div
                      key={f.id}
                      onClick={() => setSelectedId(f.id)}
                      className={`p-3 border-b border-gray-700/50 cursor-pointer transition-all ${f.id === selectedId ? "bg-purple-600/20 border-l-4 border-l-purple-500" : "hover:bg-gray-700/30"}`}
                    >
                      <div className="flex gap-3">
                        <img src={f.imageUrl} alt="" className="w-16 h-16 object-cover rounded"/>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{f.file.name}</p>
                          {f.isProcessing ? (
                            <div className="mt-1">
                              <ProgressBar progress={f.progress}/>
                              <p className="text-xs text-gray-500 mt-1">Processing...</p>
                            </div>
                          ) : f.error ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">Error</span>
                          ) : f.structuredData.passportNo ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">✓ {f.structuredData.passportNo}</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">No Data</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t border-gray-700 space-y-2">
                  <button onClick={exportToExcel} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors text-sm font-medium">
                    <ExcelIcon/> Export Excel
                  </button>
                  <button onClick={exportToCSV} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm font-medium">
                    <DownloadIcon/> Export CSV
                  </button>
                  <button onClick={clearAllFiles} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors text-sm font-medium">
                    <TrashIcon/> Clear All
                  </button>
                </div>
              </div>
            </aside>

            {/* Main Panel */}
            <section className="col-span-12 lg:col-span-9">
              <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-gray-700">
                  {[
                    { id: 'table', label: 'Table View', icon: '📊' },
                    { id: 'details', label: 'Details', icon: '📄' },
                    { id: 'raw', label: 'Raw Text', icon: '📝' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-gray-700 text-white border-b-2 border-purple-500' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
                    >
                      <span>{tab.icon}</span>{tab.label}
                    </button>
                  ))}
                </div>

                <div className="p-6">
                  {/* TABLE VIEW */}
                  {activeTab === 'table' && (
                    <div className="space-y-4">
                      {/* Search & Filters */}
                      <div className="flex flex-wrap gap-3">
                        <div className="flex-1 min-w-[200px] relative">
                          <SearchIcon />
                          <input
                            type="text"
                            placeholder="Search files..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                          />
                          <div className="absolute left-3 top-1/2 -translate-y-1/2">
                            <SearchIcon/>
                          </div>
                        </div>
                        <select
                          value={statusFilter}
                          onChange={e => setStatusFilter(e.target.value as any)}
                          className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                        >
                          <option value="all">All Status</option>
                          <option value="success">Success Only</option>
                          <option value="error">Errors Only</option>
                        </select>
                      </div>

                      {/* Table */}
                      <div className="overflow-x-auto rounded-lg border border-gray-700">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-900">
                            <tr>
                              <th className="text-left py-3 px-4 font-medium text-gray-400">No</th>
                              {[
                                { field: 'filename' as SortField, label: 'File' },
                                { field: 'passportNo' as SortField, label: 'Passport' },
                                { field: 'fullName' as SortField, label: 'Name' },
                                { field: 'dateOfBirth' as SortField, label: 'DOB' },
                                { field: 'placeOfBirth' as SortField, label: 'Place' },
                                { field: 'dateOfExpiry' as SortField, label: 'Expiry' },
                                { field: 'nationality' as SortField, label: 'Nat.' },
                                { field: 'gender' as SortField, label: 'Gender' },
                                { field: 'status' as SortField, label: 'Status' }
                              ].map(col => (
                                <th
                                  key={col.field}
                                  onClick={() => handleSort(col.field)}
                                  className="text-left py-3 px-4 font-medium text-gray-400 cursor-pointer hover:text-purple-400 transition-colors"
                                >
                                  <div className="flex items-center gap-1">
                                    {col.label}
                                    {sortField === col.field && (
                                      <span className="text-purple-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                  </div>
                                </th>
                              ))}
                              <th className="text-left py-3 px-4 font-medium text-gray-400">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {processedFiles.map((f, i) => (
                              <tr
                                key={f.id}
                                onClick={() => setSelectedId(f.id)}
                                className={`border-t border-gray-700/50 hover:bg-gray-700/30 cursor-pointer transition-colors ${f.id === selectedId ? 'bg-purple-600/10' : ''}`}
                              >
                                <td className="py-3 px-4 text-gray-300">{i + 1}</td>
                                <td className="py-3 px-4 text-gray-300 truncate max-w-[150px]">{f.file.name}</td>
                                <td className="py-3 px-4 text-gray-100 font-mono">{f.structuredData.passportNo || '-'}</td>
                                <td className="py-3 px-4 text-gray-300">{f.structuredData.fullName || '-'}</td>
                                <td className="py-3 px-4 text-gray-300">{f.structuredData.dateOfBirth || '-'}</td>
                                <td className="py-3 px-4 text-gray-300">{f.structuredData.placeOfBirth || '-'}</td>
                                <td className="py-3 px-4 text-gray-300">{f.structuredData.dateOfExpiry || '-'}</td>
                                <td className="py-3 px-4 text-gray-300">{f.structuredData.nationality || '-'}</td>
                                <td className="py-3 px-4 text-gray-300">{f.structuredData.gender || '-'}</td>
                                <td className="py-3 px-4">
                                  {f.error ? (
                                    <span className="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400">Error</span>
                                  ) : f.structuredData.passportNo ? (
                                    <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">Success</span>
                                  ) : (
                                    <span className="px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-400">No Data</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex gap-1">
                                    <CopyButton text={`${f.structuredData.passportNo}\t${f.structuredData.fullName}`}/>
                                    <button onClick={(e) => { e.stopPropagation(); deleteFile(f.id) }} className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors">
                                      <TrashIcon/>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {processedFiles.length === 0 && (
                        <div className="text-center py-12">
                          <p className="text-gray-500">No files match your filters</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* DETAILS VIEW */}
                  {activeTab === 'details' && selectedFile && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-200">File: {selectedFile.file.name}</h3>
                        <button
                          onClick={() => setIsEditing(!isEditing)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isEditing ? "bg-green-600 hover:bg-green-700" : "bg-gray-700 hover:bg-gray-600"}`}
                        >
                          {isEditing ? <><SaveIcon/> Save</> : <><EditIcon/> Edit</>}
                        </button>
                      </div>

                      {Object.entries(selectedFile.structuredData).map(([key, value]) => (
                        <div key={key} className="border-b border-gray-700/30 pb-3">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <label className="text-sm font-medium text-gray-400 block mb-1 capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}:
                              </label>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={value}
                                  onChange={(e) => updateField(key as keyof ExtractedData, e.target.value)}
                                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                                />
                              ) : (
                                <p className={`text-lg font-semibold ${value ? "text-white" : "text-gray-500 italic"}`}>
                                  {value || "Not detected"}
                                </p>
                              )}
                            </div>
                            <CopyButton text={value}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* RAW TEXT VIEW */}
                  {activeTab === 'raw' && selectedFile && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-gray-400">{selectedFile.extractedText.length} characters extracted</p>
                        <CopyButton text={selectedFile.extractedText}/>
                      </div>
                      <textarea
                        readOnly
                        value={selectedFile.extractedText}
                        className="w-full h-96 bg-gray-900 p-4 rounded-xl border border-gray-700 font-mono text-sm focus:outline-none resize-none text-gray-300"
                        placeholder="No text extracted..."
                      />
                    </div>
                  )}

                  {!selectedFile && activeTab !== 'table' && (
                    <div className="text-center py-12">
                      <FileTextIcon/>
                      <p className="text-gray-500 mt-4">Select a file from the sidebar to view details</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
