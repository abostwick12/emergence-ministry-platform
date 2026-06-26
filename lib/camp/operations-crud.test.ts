import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetCampStoreForTests,
  archiveCampScheduleItem,
  archiveCampVehicle,
  assignCampStudent,
  getCampOverview,
  upsertCampScheduleItem,
  upsertCampTeam,
  upsertCampVehicle
} from "@/lib/camp/store";

describe("Camp operations CRUD mock store", () => {
  beforeEach(() => {
    __resetCampStoreForTests();
  });

  it("creates, edits, and archives schedule items visible in overview", () => {
    const created = upsertCampScheduleItem({
      title: "Swim rotation",
      day: "Tue, Jun 30",
      time: "2:00 PM",
      date: "2026-06-30",
      startTime: "14:00",
      endTime: "15:00",
      location: "Pool",
      owner: "Jaci",
      audience: "All Camp",
      status: "Planned",
      visibility: "All Camp"
    });

    const edited = upsertCampScheduleItem({ ...created, title: "Swim rotation updated", audience: "Leaders" });
    expect(edited.title).toBe("Swim rotation updated");
    expect(getCampOverview("general_leader").schedule.some((item) => item.id === created.id)).toBe(true);

    const archived = archiveCampScheduleItem({ id: created.id });
    expect(archived.status).toBe(200);
    expect(getCampOverview("general_leader").schedule.some((item) => item.id === created.id)).toBe(false);
  });

  it("creates teams and vehicles and keeps camper assignments in sync", () => {
    const team = upsertCampTeam({ name: "Silver", color: "Silver", leader: "Andrew", room: "Cabin Z" });
    const vehicle = upsertCampVehicle({ name: "Bus 1", driver: "Joel", capacity: 40, departureWindow: "8:30 AM" });

    const student = assignCampStudent({ studentId: "stu-1", teamId: team.id, vehicleId: vehicle.id, cabin: "Cabin Z" });
    expect(student.teamId).toBe(team.id);
    expect(student.vehicleId).toBe(vehicle.id);

    const unassignedStudent = assignCampStudent({ studentId: "stu-1", teamId: "", vehicleId: "" });
    expect(unassignedStudent.teamId).toBe("");
    expect(unassignedStudent.vehicleId).toBe("");
    assignCampStudent({ studentId: "stu-1", vehicleId: vehicle.id });

    const archivedVehicle = archiveCampVehicle({ id: vehicle.id });
    expect(archivedVehicle.status).toBe(200);
    const overview = getCampOverview("general_leader");
    const refreshedStudent = overview.students.find((item) => item.id === "stu-1");
    expect(refreshedStudent?.vehicleId).toBe("");
    expect(overview.vehicles.some((item) => item.id === vehicle.id)).toBe(false);
  });
});
