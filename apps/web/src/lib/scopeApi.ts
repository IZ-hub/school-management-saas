import { api } from './api'

export interface MyScope {
  all: boolean
  linked: boolean
  classIds: string[]
  formClassIds: string[]
  subjects: { classId: string; subjectId: string }[]
}

let cached: Promise<MyScope> | null = null

/** What the signed-in person may work on: everything for admins, their own classes for teachers. */
export function getMyScope(): Promise<MyScope> {
  if (!cached) {
    cached = api.get('/teaching-assignments/mine').then((r) => r.data.data)
    cached.catch(() => { cached = null })
  }
  return cached
}

/** Forget the cached scope (e.g. after signing in as someone else). */
export const resetMyScope = () => { cached = null }

export const UNLINKED_MESSAGE = "Your account isn't linked to a teacher record yet, so you can't see any classes. Ask your school admin to link it on the Staff accounts page."
