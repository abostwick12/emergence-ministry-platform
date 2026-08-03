import { beforeEach, describe, expect, it, vi } from "vitest";

const { getOverviewMock, getSupabaseAuthClientMock, resolveMinistryScopeMock } = vi.hoisted(() => ({
  getOverviewMock: vi.fn(),
  getSupabaseAuthClientMock: vi.fn(),
  resolveMinistryScopeMock: vi.fn()
}));

vi.mock("@/lib/data/ministry-repository", () => ({ getOverview: getOverviewMock }));
vi.mock("@/lib/ministry/scope", () => ({ resolveMinistryScope: resolveMinistryScopeMock }));
vi.mock("@/lib/auth/config", () => ({ isSupabaseConfigured: vi.fn(() => true) }));
vi.mock("@/lib/auth/server", () => ({ getSupabaseAuthClient: getSupabaseAuthClientMock }));

import { getAuthenticatedMinistryNarrativeContext } from "@/lib/ministry/narrative-repository";

const overview = { events: [], tasks: [], users: [], expenses: [], activity: [] };

beforeEach(() => {
  vi.clearAllMocks();
  getOverviewMock.mockResolvedValue(overview);
  resolveMinistryScopeMock.mockResolvedValue("ministry-one");
});

describe("authenticated ministry narrative repository", () => {
  it("scopes every read and never exposes a write operation", async () => {
    const queries = querySet();
    getSupabaseAuthClientMock.mockReturnValue({ from: (table: string) => queries[table] });

    const context = await getAuthenticatedMinistryNarrativeContext(session());

    expect(context.overview).toBe(overview);
    expect(context.planningCenter).toMatchObject({ available: true, connectionStatus: "connected" });
    expect(context.volunteerHub).toMatchObject({ available: true });
    expect(context.volunteerHub.leaders[0]?.name).toBe("Jordan Leader");
    expect(queries.planning_center_attendance_refs.order).toHaveBeenCalledWith("checked_in_at", { ascending: false });
    for (const query of Object.values(queries)) {
      expect(query.eq).toHaveBeenCalledWith("ministry_id", "ministry-one");
      expect("insert" in query).toBe(false);
      expect("upsert" in query).toBe(false);
      expect("update" in query).toBe(false);
    }
  });

  it("fails individual source families closed without failing the ministry overview", async () => {
    const queries = querySet({ planningCenterError: true, volunteerError: false });
    getSupabaseAuthClientMock.mockReturnValue({ from: (table: string) => queries[table] });

    const context = await getAuthenticatedMinistryNarrativeContext(session());

    expect(context.overview).toBe(overview);
    expect(context.planningCenter).toEqual({
      available: false,
      connectionStatus: "unavailable",
      lastSyncAt: undefined,
      attendance: [],
      peopleAvailable: false,
      syncHistoryAvailable: false,
      people: [],
      syncRuns: []
    });
    expect(context.volunteerHub.available).toBe(true);
  });

  it("does not query authenticated people sources for mock sessions", async () => {
    const context = await getAuthenticatedMinistryNarrativeContext({ ...session(), isMock: true });

    expect(getSupabaseAuthClientMock).not.toHaveBeenCalled();
    expect(resolveMinistryScopeMock).not.toHaveBeenCalled();
    expect(context.planningCenter.connectionStatus).toBe("unavailable");
    expect(context.volunteerHub.available).toBe(false);
  });
});

function session() {
  return {
    accessToken: "token",
    isMock: false,
    user: { id: "user-one", email: "admin@example.test", fullName: "Admin", role: "admin" }
  };
}

function querySet(options: { planningCenterError?: boolean; volunteerError?: boolean } = {}): Record<string, ReturnType<typeof query>> {
  return {
    ministry_integrations: query({
      data: options.planningCenterError ? null : { status: "connected", last_sync_at: "2026-08-01T00:00:00.000Z" },
      error: options.planningCenterError ? { message: "missing" } : null
    }),
    planning_center_attendance_refs: query({
      data: options.planningCenterError ? null : [{
        id: "attendance-one",
        external_person_id: "person-one",
        external_event_id: "event-one",
        session_label: "Students",
        location_label: "Student Center",
        checked_in_at: "2026-07-26T09:00:00.000Z"
      }],
      error: options.planningCenterError ? { message: "missing" } : null
    }),
    planning_center_people_refs: query({
      data: options.planningCenterError ? null : [{ external_person_id: "person-one", grade: "7", age_band: "middle_school", last_synced_at: "2026-08-01T00:00:00.000Z" }],
      error: options.planningCenterError ? { message: "missing" } : null
    }),
    planning_center_sync_runs: query({
      data: options.planningCenterError ? null : [{ status: "succeeded", people_count: 1, attendance_count: 1, started_at: "2026-08-01T00:00:00.000Z", completed_at: "2026-08-01T00:01:00.000Z" }],
      error: options.planningCenterError ? { message: "missing" } : null
    }),
    volunteer_hub_leaders: query({
      data: options.volunteerError ? null : [{ id: "leader-one", profile_user_id: "user-one", name: "Jordan Leader", role_label: "Leader", serving_areas: ["Students"], availability: "Sunday", skills: ["Groups"], background_check_expires: null }],
      error: options.volunteerError ? { message: "missing" } : null
    }),
    volunteer_hub_small_groups: query({
      data: options.volunteerError ? null : [{ id: "group-one", name: "Group", leader_id: "leader-one", co_leader_id: null, service_time: "Sunday" }],
      error: options.volunteerError ? { message: "missing" } : null
    }),
    volunteer_hub_small_group_members: query({
      data: options.volunteerError ? null : [{ group_id: "group-one", student_source: "planning_center", student_ref_id: "person-one", created_at: "2026-07-01" }],
      error: options.volunteerError ? { message: "missing" } : null
    }),
    volunteer_hub_event_leader_assignments: query({
      data: options.volunteerError ? null : [{ event_id: "event-one", leader_id: "leader-one", created_at: "2026-07-01" }],
      error: options.volunteerError ? { message: "missing" } : null
    }),
    volunteer_hub_items: query({
      data: options.volunteerError ? null : [{ id: "item-one", item_type: "training", title: "Training", due_date: null, required: true, blocks_student_contact: false }],
      error: options.volunteerError ? { message: "missing" } : null
    }),
    volunteer_hub_item_progress: query({
      data: options.volunteerError ? null : [{ item_id: "item-one", user_id: "user-one", completed: true, completed_at: "2026-07-01" }],
      error: options.volunteerError ? { message: "missing" } : null
    }),
    volunteer_hub_follow_ups: query({
      data: options.volunteerError ? null : [{ id: "follow-one", volunteer_leader_id: "leader-one", status: "assigned", created_at: "2026-07-01", updated_at: "2026-07-01" }],
      error: options.volunteerError ? { message: "missing" } : null
    })
  };
}

function query(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    not: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    is: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    returns: vi.fn(async () => result)
  };
  return builder;
}
