// Values that have appeared in example files or old code; anyone can sign tokens with them.
const KNOWN_PUBLIC_SECRETS = ['default_jwt_secret', 'your_jwt_secret_change_in_production'];

/** Returns JWT_SECRET, refusing a missing, publicly known or too-short value. */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set. Refusing to sign or verify tokens without it.');
  }
  if (KNOWN_PUBLIC_SECRETS.includes(secret) || secret.length < 32) {
    throw new Error('JWT_SECRET is a placeholder or shorter than 32 characters. Set a long random value.');
  }
  return secret;
}
