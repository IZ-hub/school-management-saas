import type { ReactNode } from 'react'

const tones: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-rose-100 text-rose-700',
  slate: 'bg-slate-200 text-slate-700',
  blue: 'bg-sky-100 text-sky-700',
}

export type BadgeTone = keyof typeof tones

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${tones[tone] ?? tones.slate}`}>
      {children}
    </span>
  )
}
