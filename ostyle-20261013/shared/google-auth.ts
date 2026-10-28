/**
 * Public OAuth audience used to request and verify Google ID tokens.
 * OAuth client IDs are identifiers, not client secrets.
 */
export const GOOGLE_WEB_CLIENT_ID =
  "789078559023-hpj1l1jcmddfjh736t8vagbn60r6ei9n.apps.googleusercontent.com";

/** Keeps Google accounts in the same unique openId column as existing auth accounts. */
export const GOOGLE_OPEN_ID_PREFIX = "google_";

export function googleOpenId(subject: string): string {
  return `${GOOGLE_OPEN_ID_PREFIX}${subject}`;
}
