/** Our own web addresses: where links in emails and payment returns may point. */
export const APP_ORIGINS = [
  'https://school-management-1f070.web.app',
  'https://school-management-1f070.firebaseapp.com',
  'http://localhost:5173',
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) : []),
];

/** The caller's origin if it is one of ours, otherwise the live site. */
export const appOrigin = (origin?: string) => (origin && APP_ORIGINS.includes(origin) ? origin : APP_ORIGINS[0]);
