const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function getNextKiteTokenExpiry(now = new Date()): string {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth();
  const day = ist.getUTCDate() + 1;
  const nextSixAmIstAsUtcParts = Date.UTC(year, month, day, 6, 0, 0) - IST_OFFSET_MS;
  return new Date(nextSixAmIstAsUtcParts).toISOString();
}

export function isTokenExpired(expiresAt?: string | null, now = new Date()) {
  if (!expiresAt) return true;
  const expiry = new Date(expiresAt);
  return Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime();
}

export function todayIstDate(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}`;
}
