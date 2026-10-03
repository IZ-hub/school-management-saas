import { api } from './api'
import type { Term } from './examsApi'

export interface TermDates { session: string; term: Term; start: string; end: string }

export interface SchoolSettings {
  id: string
  name: string
  address: string
  city: string
  state: string
  phone: string
  email: string
  motto: string
  principalName: string
  logo: string | null
  termDates: TermDates[]
  currentTerm: { term: Term; session: string }
}

let cached: Promise<SchoolSettings> | null = null

/** The school's settings, fetched once per page load (and refreshed after saving). */
export function getSchool(fresh = false): Promise<SchoolSettings> {
  if (!cached || fresh) {
    cached = api.get('/school').then((r) => r.data.data)
    cached.catch(() => { cached = null })
  }
  return cached
}

export async function updateSchool(body: Partial<Omit<SchoolSettings, 'id' | 'termDates' | 'currentTerm'>>): Promise<SchoolSettings> {
  const data = (await api.patch('/school', body)).data.data
  cached = Promise.resolve(data)
  return data
}

export async function saveTermDates(session: string, terms: { term: Term; start: string; end: string }[]): Promise<SchoolSettings> {
  const data = (await api.put('/school/terms', { session, terms })).data.data
  cached = Promise.resolve(data)
  return data
}

/** Shrinks an image file to fit within `max` pixels and returns a small data URL for the logo. */
export function resizeImage(file: File, max = 240): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      // PNG keeps transparent backgrounds; fall back to WebP if that is too large.
      let data = canvas.toDataURL('image/png')
      if (data.length > 90_000) data = canvas.toDataURL('image/webp', 0.85)
      if (data.length > 90_000) data = canvas.toDataURL('image/jpeg', 0.8)
      if (data.length > 90_000) reject(new Error('This image is too detailed to use as a logo. Try a simpler one.'))
      else resolve(data)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't an image we can read.")) }
    img.src = url
  })
}
