import { describe, expect, it } from "vitest";

import { mergeVolunteerLeaders, removeLeaderFromAssignments, type VolunteerLeader } from "@/lib/volunteer-leaders";

const baseLeaders: VolunteerLeader[] = [
  { id: "leader-alex", name: "Alex Walker", role: "Admin", email: "alex@example.test" },
  { id: "leader-bailey", name: "Bailey North", role: "Small Group Leader", email: "bailey@example.test" }
];

describe("volunteer leader helpers", () => {
  it("merges base and custom leaders while honoring deleted ids", () => {
    const leaders = mergeVolunteerLeaders(
      baseLeaders,
      [{ id: "leader-casey", name: "Casey Reed", role: "Volunteer", sourceChurch: "Lead Emergence" }],
      ["leader-bailey"]
    );

    expect(leaders.map((leader) => leader.id)).toEqual(["leader-alex", "leader-casey"]);
  });

  it("clears a deleted leader from every event assignment", () => {
    expect(removeLeaderFromAssignments({
      evt_one: ["leader-alex", "leader-bailey"],
      evt_two: ["leader-bailey"],
      evt_three: []
    }, "leader-bailey")).toEqual({
      evt_one: ["leader-alex"],
      evt_two: [],
      evt_three: []
    });
  });
});
