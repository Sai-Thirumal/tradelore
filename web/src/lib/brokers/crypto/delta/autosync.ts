export const DELTA_AUTO_SYNC_STALE_MS = 8 * 60 * 60 * 1000;

export function isDeltaAutoSyncDue(lastSyncAt?: string | null, now = Date.now()) {
  if (!lastSyncAt) return true;
  const last = Date.parse(lastSyncAt);
  if (!Number.isFinite(last)) return true;
  return now - last >= DELTA_AUTO_SYNC_STALE_MS;
}
