import type { CampDocument, CampScheduleBlock, CampStudentPublic, CampTeam, CampVehicle } from "@/lib/camp/types";

export const campName = "Camp Oakwood";
export const campStartsOn = "2026-06-29";

// Real Camp Oakwood teams: the six colors are the teams. Leader/co-leader/room
// are intentionally blank here (not invented) and render only when real data
// is present. Mirrors migration 012 / the live camp_teams records.
export const campTeams: CampTeam[] = [
  { id: "team-blue", name: "Blue", color: "Blue", leader: "", coLeader: "", room: "" },
  { id: "team-red", name: "Red", color: "Red", leader: "", coLeader: "", room: "" },
  { id: "team-yellow", name: "Yellow", color: "Yellow", leader: "", coLeader: "", room: "" },
  { id: "team-green", name: "Green", color: "Green", leader: "", coLeader: "", room: "" },
  { id: "team-orange", name: "Orange", color: "Orange", leader: "", coLeader: "", room: "" },
  { id: "team-purple", name: "Purple", color: "Purple", leader: "", coLeader: "", room: "" }
];

export const campVehicles: CampVehicle[] = [
  { id: "van-1", name: "Van 1", driver: "Marcus Lee", departureWindow: "June 29, 8:00 AM", capacity: 7 },
  { id: "van-2", name: "Van 2", driver: "Tara Mitchell", departureWindow: "June 29, 8:00 AM", capacity: 7 },
  { id: "van-3", name: "Van 3", driver: "Sam Carter", departureWindow: "June 29, 8:15 AM", capacity: 6 }
];

export const campSchedule: CampScheduleBlock[] = [
  { id: "sched-1", day: "Mon, Jun 29", time: "8:00 AM", title: "Leader check-in and vehicle load", location: "Church parking lot", audience: "All Camp" },
  { id: "sched-2", day: "Mon, Jun 29", time: "8:45 AM", title: "Depart for camp", location: "Vehicle roster stations", audience: "All Camp" },
  { id: "sched-3", day: "Mon, Jun 29", time: "12:30 PM", title: "Camp arrival and cabin drop", location: "Main lodge", audience: "All Camp" },
  { id: "sched-4", day: "Mon, Jun 29", time: "1:15 PM", title: "Medication check-in review", location: "Medical lead table", audience: "Medical Team" },
  { id: "sched-5", day: "Tue, Jun 30", time: "9:00 AM", title: "Morning rally", location: "Chapel", audience: "All Camp" },
  { id: "sched-6", day: "Fri, Jul 3", time: "10:30 AM", title: "Medication return and luggage sweep", location: "Medical lead table", audience: "Medical Team" }
];

export const campDocuments: CampDocument[] = [
  { id: "doc-1", title: "Leader field guide", owner: "Andrew", status: "Ready", audience: "All Leaders" },
  { id: "doc-2", title: "Vehicle roster packet", owner: "Jaci", status: "Ready", audience: "Drivers" },
  { id: "doc-3", title: "Camp schedule one-sheet", owner: "Joel", status: "Ready", audience: "All Leaders" },
  { id: "doc-4", title: "Restricted medical binder index", owner: "Andrew", status: "Needs Review", audience: "Restricted Medical" }
];

export const campStudents: CampStudentPublic[] = [
  {
    id: "stu-1",
    name: "Avery Johnson",
    photoInitials: "AJ",
    grade: "8th",
    teamId: "team-blue",
    vehicleId: "van-1",
    cabin: "Cabin A",
    limitedSafetyFlags: ["Restricted info on file"],
    hasRestrictedMedicalInfo: true,
    hasMedicationPlan: true,
    needsParentClarification: false
  },
  {
    id: "stu-2",
    name: "Jordan Kim",
    photoInitials: "JK",
    grade: "7th",
    teamId: "team-red",
    vehicleId: "van-2",
    cabin: "Cabin B",
    limitedSafetyFlags: ["Needs Parent Clarification"],
    hasRestrictedMedicalInfo: true,
    hasMedicationPlan: true,
    needsParentClarification: true
  },
  {
    id: "stu-3",
    name: "Riley Brooks",
    photoInitials: "RB",
    grade: "9th",
    teamId: "team-yellow",
    vehicleId: "van-2",
    cabin: "Cabin C",
    limitedSafetyFlags: [],
    hasRestrictedMedicalInfo: false,
    hasMedicationPlan: false,
    needsParentClarification: false
  },
  {
    id: "stu-4",
    name: "Taylor Nguyen",
    photoInitials: "TN",
    grade: "10th",
    teamId: "team-green",
    vehicleId: "van-3",
    cabin: "Cabin A",
    limitedSafetyFlags: ["Restricted info on file"],
    hasRestrictedMedicalInfo: true,
    hasMedicationPlan: false,
    needsParentClarification: false
  },
  {
    id: "stu-5",
    name: "Morgan Smith",
    photoInitials: "MS",
    grade: "6th",
    teamId: "team-orange",
    vehicleId: "van-1",
    cabin: "Cabin B",
    limitedSafetyFlags: [],
    hasRestrictedMedicalInfo: false,
    hasMedicationPlan: false,
    needsParentClarification: false
  },
  {
    id: "stu-6",
    name: "Casey Patel",
    photoInitials: "CP",
    grade: "8th",
    teamId: "team-purple",
    vehicleId: "van-3",
    cabin: "Cabin C",
    limitedSafetyFlags: ["Medication plan on file"],
    hasRestrictedMedicalInfo: true,
    hasMedicationPlan: true,
    needsParentClarification: false
  }
];
