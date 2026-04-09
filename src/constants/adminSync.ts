/** Normalize auth UUIDs for comparison (env files often add spaces or quotes). */
function normalizeAuthUserId(id: string): string {
  return id
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase();
}

function parseSyncAdminUserIds(): string[] {
  const raw = import.meta.env.VITE_SYNC_ADMIN_USER_ID as string | undefined;
  if (raw == null || String(raw).trim() === '') return [];
  return String(raw)
    .split(',')
    .map((s) => normalizeAuthUserId(s))
    .filter(Boolean);
}

const SYNC_ADMIN_USER_IDS = parseSyncAdminUserIds();

/** First configured admin id (for debugging / display). Comma-separated list also supported in env. */
export const SYNC_ADMIN_USER_ID: string | undefined = SYNC_ADMIN_USER_IDS[0];

/** Only listed auth users may run Sleeper team sync from the UI (see Settings). Not a secret — IDs are public. */
export function isSyncAdminUser(userId: string | undefined | null): boolean {
  if (!userId || SYNC_ADMIN_USER_IDS.length === 0) return false;
  const u = normalizeAuthUserId(userId);
  return SYNC_ADMIN_USER_IDS.includes(u);
}
