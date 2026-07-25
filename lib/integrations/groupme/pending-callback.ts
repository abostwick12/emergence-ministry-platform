export type PendingGroupMeCallback = {
  accessToken: string;
  state: string | null;
  createdAt: number;
};

export const GROUPME_PENDING_CALLBACK_KEY = "lead-emergence.pending-groupme-callback.v1";
export const GROUPME_PENDING_CALLBACK_MAX_AGE_MS = 10 * 60 * 1000;

type CallbackStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export function savePendingGroupMeCallback(callback: PendingGroupMeCallback, storage = getSessionStorage()) {
  if (!storage) return;
  try {
    storage.setItem(GROUPME_PENDING_CALLBACK_KEY, JSON.stringify(callback));
  } catch {
    // If storage is blocked, the immediate callback attempt can still run.
  }
}

export function readPendingGroupMeCallback(storage = getSessionStorage(), now = Date.now()): PendingGroupMeCallback | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(GROUPME_PENDING_CALLBACK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingGroupMeCallback>;
    const accessToken = typeof parsed.accessToken === "string" ? parsed.accessToken.trim() : "";
    const state = typeof parsed.state === "string" ? parsed.state : null;
    const createdAt = typeof parsed.createdAt === "number" ? parsed.createdAt : 0;
    if (!accessToken || !createdAt || now - createdAt > GROUPME_PENDING_CALLBACK_MAX_AGE_MS) {
      clearPendingGroupMeCallback(storage);
      return null;
    }
    return { accessToken, state, createdAt };
  } catch {
    clearPendingGroupMeCallback(storage);
    return null;
  }
}

export function clearPendingGroupMeCallback(storage = getSessionStorage()) {
  if (!storage) return;
  try {
    storage.removeItem(GROUPME_PENDING_CALLBACK_KEY);
  } catch {
    // Storage cleanup is best effort.
  }
}

function getSessionStorage(): CallbackStorage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}
