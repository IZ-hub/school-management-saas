import { api } from './api'

const load = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't a photo we can read. Use a JPEG or PNG.")) }
  img.src = url
})

/** A square crop from the middle (a little above centre, where faces sit), as a JPEG under `limit` characters. */
function square(img: HTMLImageElement, size: number, limit: number) {
  const side = Math.min(img.width, img.height)
  const sx = (img.width - side) / 2
  const sy = Math.max(0, Math.min(img.height - side, (img.height - side) * 0.3))
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, size, size)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
  for (let q = 0.85; q >= 0.4; q -= 0.1) {
    const data = canvas.toDataURL('image/jpeg', q)
    if (data.length <= limit) return data
  }
  throw new Error('This photo is too detailed. Try another one.')
}

/** Turns a chosen or camera photo into what the server keeps: a 320px photo and a 112px thumbnail. */
export async function makeStudentPhoto(file: File) {
  if (!file.type.startsWith('image/')) throw new Error("That file isn't a photo. Choose a JPEG or PNG.")
  const img = await load(file)
  return { photo: square(img, 320, 78_000), thumb: square(img, 112, 11_500) }
}

export const setStudentPhoto = async (id: string, p: { photo: string; thumb: string }) => (await api.put(`/students/${id}/photo`, { photo: p.photo, thumb: p.thumb })).data.data
export const removeStudentPhoto = async (id: string) => (await api.delete(`/students/${id}/photo`)).data.data
