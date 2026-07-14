import { describe, expect, it, vi } from "vitest";
import {
  buildPlanningCenterAuthUrl,
  exchangePlanningCenterCode,
  isPlanningCenterTokenExpired,
  listPlanningCenterAttendance,
  listPlanningCenterPeople,
  normalizeAttendance,
  normalizePerson,
  PlanningCenterConfigError,
  readPlanningCenterConfig,
  refreshPlanningCenterAccessToken
} from "@/lib/integrations/planning-center/client";

const configuredEnv = {
  PLANNING_CENTER_CLIENT_ID: "client-id",
  PLANNING_CENTER_CLIENT_SECRET: "client-secret",
  PLANNING_CENTER_REDIRECT_URI: "https://example.com/api/integrations/planning-center/callback",
  PLANNING_CENTER_API_BASE_URL: "https://api.example.test"
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as Response;
}

describe("readPlanningCenterConfig", () => {
  it("reports missing required OAuth env vars", () => {
    const config = readPlanningCenterConfig({});
    expect(config.configured).toBe(false);
    expect(config.missing).toEqual([
      "PLANNING_CENTER_CLIENT_ID",
      "PLANNING_CENTER_CLIENT_SECRET",
      "PLANNING_CENTER_REDIRECT_URI"
    ]);
  });

  it("reports configured and keeps the API base URL server-side", () => {
    const config = readPlanningCenterConfig(configuredEnv);
    expect(config.configured).toBe(true);
    expect(config.apiBaseUrl).toBe("https://api.example.test");
  });
});

describe("buildPlanningCenterAuthUrl", () => {
  it("throws PlanningCenterConfigError when not configured", () => {
    expect(() => buildPlanningCenterAuthUrl({ state: "state", env: {} })).toThrow(PlanningCenterConfigError);
  });

  it("builds an OAuth authorization URL with CSRF state", () => {
    const url = new URL(buildPlanningCenterAuthUrl({ state: "csrf-state", env: configuredEnv }));
    expect(url.origin + url.pathname).toBe("https://api.planningcenteronline.com/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(configuredEnv.PLANNING_CENTER_REDIRECT_URI);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("csrf-state");
  });
});

describe("Planning Center token exchange", () => {
  it("exchanges an authorization code for tokens", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: "people check_ins" })
    );
    const tokens = await exchangePlanningCenterCode({ code: "code", env: configuredEnv, fetchImpl });
    expect(tokens.accessToken).toBe("at");
    expect(tokens.refreshToken).toBe("rt");
    expect(tokens.scope).toBe("people check_ins");
    expect(new Date(tokens.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("refreshes access tokens", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ access_token: "new-at", expires_in: 3600 }));
    const tokens = await refreshPlanningCenterAccessToken({ refreshToken: "rt", env: configuredEnv, fetchImpl });
    expect(tokens.accessToken).toBe("new-at");
  });

  it("detects expired tokens with skew", () => {
    expect(isPlanningCenterTokenExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
    expect(isPlanningCenterTokenExpired(new Date(Date.now() + 120_000).toISOString())).toBe(false);
  });
});

describe("Planning Center normalization", () => {
  it("minimizes person records without preserving contact or note fields", () => {
    const person = normalizePerson({
      id: "person-1",
      attributes: {
        first_name: "Alex",
        last_name: "Walker",
        grade: "11",
        mobile_phone_number: "555-1111",
        medical_notes: "do not store",
        updated_at: "2026-07-01T12:00:00Z"
      },
      relationships: { household: { data: { id: "house-1", type: "Household" } } }
    });
    expect(person).toEqual({
      externalPersonId: "person-1",
      displayName: "Alex Walker",
      householdExternalId: "house-1",
      grade: "11",
      ageBand: undefined,
      sourceUpdatedAt: "2026-07-01T12:00:00Z"
    });
    expect(JSON.stringify(person)).not.toContain("555-1111");
    expect(JSON.stringify(person)).not.toContain("medical");
  });

  it("minimizes attendance records", () => {
    expect(
      normalizeAttendance({
        id: "check-1",
        attributes: {
          event_name: "Student Night",
          location_name: "Student Center",
          checked_in_at: "2026-07-12T23:00:00Z"
        },
        relationships: {
          person: { data: { id: "person-1", type: "Person" } },
          event: { data: { id: "event-1", type: "Event" } }
        }
      })
    ).toEqual({
      externalCheckInId: "check-1",
      externalPersonId: "person-1",
      externalEventId: "event-1",
      sessionLabel: "Student Night",
      locationLabel: "Student Center",
      checkedInAt: "2026-07-12T23:00:00Z"
    });
  });
});

describe("Planning Center collection fetches", () => {
  it("fetches and normalizes people", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ data: [{ id: "person-1", attributes: { name: "Jordan Lee", age: 15 } }] })
    );
    await expect(listPlanningCenterPeople({ accessToken: "at", env: configuredEnv, fetchImpl })).resolves.toEqual([
      expect.objectContaining({ externalPersonId: "person-1", displayName: "Jordan Lee", ageBand: "15" })
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.example.test/people/v2/people?per_page=100",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer at" }) })
    );
  });

  it("fetches and normalizes attendance", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ data: [{ id: "check-1", attributes: { name: "Main check-in" } }] })
    );
    await expect(listPlanningCenterAttendance({ accessToken: "at", env: configuredEnv, fetchImpl })).resolves.toEqual([
      expect.objectContaining({ externalCheckInId: "check-1", sessionLabel: "Main check-in" })
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.example.test/check-ins/v2/check_ins?per_page=100",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer at" }) })
    );
  });
});
