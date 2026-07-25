import { describe, expect, it } from "vitest";
import {
  clearPendingGroupMeCallback,
  GROUPME_PENDING_CALLBACK_KEY,
  GROUPME_PENDING_CALLBACK_MAX_AGE_MS,
  readPendingGroupMeCallback,
  savePendingGroupMeCallback
} from "@/lib/integrations/groupme/pending-callback";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("GroupMe pending callback storage", () => {
  it("saves and reads a pending callback token for login resume", () => {
    const storage = new MemoryStorage();

    savePendingGroupMeCallback({ accessToken: " token-123 ", state: "csrf-state", createdAt: 1000 }, storage);

    expect(readPendingGroupMeCallback(storage, 1000)).toEqual({
      accessToken: "token-123",
      state: "csrf-state",
      createdAt: 1000
    });
  });

  it("clears expired callback tokens", () => {
    const storage = new MemoryStorage();
    savePendingGroupMeCallback({ accessToken: "token-123", state: null, createdAt: 1000 }, storage);

    expect(readPendingGroupMeCallback(storage, 1000 + GROUPME_PENDING_CALLBACK_MAX_AGE_MS + 1)).toBeNull();
    expect(storage.getItem(GROUPME_PENDING_CALLBACK_KEY)).toBeNull();
  });

  it("clears malformed callback tokens", () => {
    const storage = new MemoryStorage();
    storage.setItem(GROUPME_PENDING_CALLBACK_KEY, "{nope");

    expect(readPendingGroupMeCallback(storage, 1000)).toBeNull();
    expect(storage.getItem(GROUPME_PENDING_CALLBACK_KEY)).toBeNull();
  });

  it("clears the pending callback explicitly", () => {
    const storage = new MemoryStorage();
    savePendingGroupMeCallback({ accessToken: "token-123", state: null, createdAt: 1000 }, storage);

    clearPendingGroupMeCallback(storage);

    expect(storage.getItem(GROUPME_PENDING_CALLBACK_KEY)).toBeNull();
  });
});
