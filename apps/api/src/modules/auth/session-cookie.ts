import type { Request, Response } from 'express';

/**
 * Firebase Hosting forwards only a cookie named "__session" to Cloud Functions,
 * so the refresh token must use that name.
 */
export const SESSION_COOKIE = '__session';
export const SESSION_DAYS = 30;

export function readSessionCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

const cookieOptions = {
  httpOnly: true, // page scripts can never read it
  secure: true,
  sameSite: 'strict' as const, // never sent on requests from other sites
  path: '/api/v1/auth',
};

export function setSessionCookie(res: Response, value: string) {
  res.cookie(SESSION_COOKIE, value, { ...cookieOptions, maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}
