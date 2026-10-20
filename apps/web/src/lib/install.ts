import { useEffect, useState } from 'react'

/** The browser's "Install app" prompt (Chrome and Edge on Android and computers). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/** Call once at start-up: registers the service worker and keeps the install prompt for later. */
export function setUpInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
  }
}

export const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true

export const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const isAndroid = () => /android/i.test(navigator.userAgent)

/** Whether the app can be installed with one tap, and a function that shows the browser's prompt. */
export function useInstall() {
  const [, rerender] = useState(0)
  useEffect(() => {
    const l = () => rerender((n) => n + 1)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])
  return {
    installed: isInstalled(),
    canPrompt: !!deferred,
    prompt: async () => {
      if (!deferred) return false
      const e = deferred
      await e.prompt()
      const { outcome } = await e.userChoice
      deferred = null
      notify()
      return outcome === 'accepted'
    },
  }
}
