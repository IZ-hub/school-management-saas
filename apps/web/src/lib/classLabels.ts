/** Minimal class shape needed to label classes for display. */
export interface ClassLike {
  id: string
  name: string
  status?: string
  createdAt?: unknown
}

/** "JSS 2B", "JSS2B" and "jss-2b" are the same class name (matches the server). */
export const classNameKey = (name: string) => name.toLowerCase().replace(/[\s\-_.]+/g, '')

// Firestore timestamps arrive as { _seconds }, the local API sends ISO strings.
const createdMillis = (v: unknown): number => {
  if (v && typeof v === 'object' && '_seconds' in v) return Number((v as { _seconds: number })._seconds) * 1000
  const t = new Date(v as string).getTime()
  return Number.isNaN(t) ? 0 : t
}

/**
 * Display labels for classes. Active classes that share a name get " (copy 1)", " (copy 2)"…
 * in the order they were created, so twins can be told apart in lists and dropdowns.
 */
export function classLabels(classes: ClassLike[]): Map<string, string> {
  const labels = new Map(classes.map((c) => [c.id, c.name]))
  const groups = new Map<string, ClassLike[]>()
  for (const c of classes) {
    if (c.status === 'INACTIVE') continue
    groups.set(classNameKey(c.name), [...(groups.get(classNameKey(c.name)) ?? []), c])
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue
    group
      .sort((a, b) => createdMillis(a.createdAt) - createdMillis(b.createdAt))
      .forEach((c, i) => labels.set(c.id, `${c.name} (copy ${i + 1})`))
  }
  return labels
}

/** Groups of active classes that share a name, for the duplicate warning. */
export function duplicateClassGroups(classes: ClassLike[]): ClassLike[][] {
  const groups = new Map<string, ClassLike[]>()
  for (const c of classes) {
    if (c.status === 'INACTIVE') continue
    groups.set(classNameKey(c.name), [...(groups.get(classNameKey(c.name)) ?? []), c])
  }
  return [...groups.values()].filter((g) => g.length > 1)
}
