// Shared configuration constants

export const API_CONFIG = {
  BASE_URL: process.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  TIMEOUT: 30000,
} as const

export const APP_CONFIG = {
  NAME: process.env.VITE_APP_NAME || 'School Management SaaS',
  VERSION: '1.0.0',
} as const

export const PAGINATION_CONFIG = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
} as const
