import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInstall } from '../lib/install'

/**
 * Renders its child as an "Install app" control: one-tap install where the browser allows it,
 * otherwise opens the /install page with steps for the visitor's device. Hidden once installed.
 */
export default function InstallAppButton({ children }: { children: (onClick: () => void) => ReactNode }) {
  const { installed, canPrompt, prompt } = useInstall()
  const navigate = useNavigate()
  if (installed) return null
  return <>{children(() => (canPrompt ? prompt() : navigate('/install')))}</>
}
