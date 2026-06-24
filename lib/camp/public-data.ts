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
  { id: "sched-mon-registration", day: "Mon, Jun 29", time: "3:00 PM-5:30 PM", date: "2026-06-29", startTime: "15:00", endTime: "17:30", title: "Registration", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-mon-vespers", day: "Mon, Jun 29", time: "6:15 PM", date: "2026-06-29", startTime: "18:15", title: "Vespers", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-mon-dinner", day: "Mon, Jun 29", time: "6:30 PM", date: "2026-06-29", startTime: "18:30", title: "Dinner", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-mon-team-colors", day: "Mon, Jun 29", time: "7:15 PM", date: "2026-06-29", startTime: "19:15", title: "Team Colors Meeting", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-mon-evening-worship", day: "Mon, Jun 29", time: "7:30 PM", date: "2026-06-29", startTime: "19:30", title: "Evening Worship", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-mon-yak-snack", day: "Mon, Jun 29", time: "9:00 PM", date: "2026-06-29", startTime: "21:00", title: "Yak & Snack", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-mon-late-night-rec", day: "Mon, Jun 29", time: "9:00 PM-10:00 PM", date: "2026-06-29", startTime: "21:00", endTime: "22:00", title: "Late Night Rec", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-mon-leaders-meeting", day: "Mon, Jun 29", time: "10:30 PM", date: "2026-06-29", startTime: "22:30", title: "Leaders Meeting", location: "", audience: "Leaders", status: "Confirmed", visibility: "Leaders Only" },
  { id: "sched-mon-lights-out", day: "Mon, Jun 29", time: "11:00 PM", date: "2026-06-29", startTime: "23:00", title: "Lights Out", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },

  { id: "sched-tue-wake-up", day: "Tue, Jun 30", time: "7:30 AM", date: "2026-06-30", startTime: "07:30", title: "Wake Up", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-tue-morning-watch", day: "Tue, Jun 30", time: "8:30 AM", date: "2026-06-30", startTime: "08:30", title: "Morning Watch", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-tue-breakfast", day: "Tue, Jun 30", time: "8:45 AM", date: "2026-06-30", startTime: "08:45", title: "Breakfast", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-tue-morning-worship", day: "Tue, Jun 30", time: "9:30 AM", date: "2026-06-30", startTime: "09:30", title: "Morning Worship", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-tue-breakout-1", day: "Tue, Jun 30", time: "10:00 AM-10:40 AM", date: "2026-06-30", startTime: "10:00", endTime: "10:40", title: "Break-out Group 1", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-tue-breakout-2", day: "Tue, Jun 30", time: "10:45 AM-11:15 AM", date: "2026-06-30", startTime: "10:45", endTime: "11:15", title: "Break-out Group 2", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-tue-mail-call", day: "Tue, Jun 30", time: "12:00 PM", date: "2026-06-30", startTime: "12:00", title: "Mail Call", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-tue-lunch", day: "Tue, Jun 30", time: "12:30 PM", date: "2026-06-30", startTime: "12:30", title: "Lunch", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-tue-youth-group-time", day: "Tue, Jun 30", time: "1:30 PM", date: "2026-06-30", startTime: "13:30", title: "Youth Group Time", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-tue-recreation-1", day: "Tue, Jun 30", time: "2:15 PM-3:30 PM", date: "2026-06-30", startTime: "14:15", endTime: "15:30", title: "Recreation Time #1", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-tue-recreation-2", day: "Tue, Jun 30", time: "3:30 PM-5:00 PM", date: "2026-06-30", startTime: "15:30", endTime: "17:00", title: "Recreation Time #2", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-tue-vespers", day: "Tue, Jun 30", time: "6:15 PM", date: "2026-06-30", startTime: "18:15", title: "Vespers", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-tue-dinner", day: "Tue, Jun 30", time: "6:30 PM", date: "2026-06-30", startTime: "18:30", title: "Dinner", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-tue-evening-worship", day: "Tue, Jun 30", time: "7:30 PM", date: "2026-06-30", startTime: "19:30", title: "Evening Worship", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-tue-yak-snack", day: "Tue, Jun 30", time: "9:00 PM", date: "2026-06-30", startTime: "21:00", title: "Yak & Snack", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-tue-late-night-rec", day: "Tue, Jun 30", time: "9:00 PM-10:00 PM", date: "2026-06-30", startTime: "21:00", endTime: "22:00", title: "Late Night Rec", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },

  { id: "sched-wed-wake-up", day: "Wed, Jul 1", time: "7:30 AM", date: "2026-07-01", startTime: "07:30", title: "Wake Up", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-wed-morning-watch", day: "Wed, Jul 1", time: "8:30 AM", date: "2026-07-01", startTime: "08:30", title: "Morning Watch", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-wed-breakfast", day: "Wed, Jul 1", time: "8:45 AM", date: "2026-07-01", startTime: "08:45", title: "Breakfast", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-wed-morning-worship", day: "Wed, Jul 1", time: "9:30 AM", date: "2026-07-01", startTime: "09:30", title: "Morning Worship", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-wed-breakout-1", day: "Wed, Jul 1", time: "10:00 AM-10:40 AM", date: "2026-07-01", startTime: "10:00", endTime: "10:40", title: "Break-out Group 1", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-wed-breakout-2", day: "Wed, Jul 1", time: "10:45 AM-11:15 AM", date: "2026-07-01", startTime: "10:45", endTime: "11:15", title: "Break-out Group 2", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-wed-mail-call", day: "Wed, Jul 1", time: "12:00 PM", date: "2026-07-01", startTime: "12:00", title: "Mail Call", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-wed-lunch", day: "Wed, Jul 1", time: "12:30 PM", date: "2026-07-01", startTime: "12:30", title: "Lunch", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-wed-youth-group-time", day: "Wed, Jul 1", time: "1:30 PM", date: "2026-07-01", startTime: "13:30", title: "Youth Group Time", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-wed-recreation-1", day: "Wed, Jul 1", time: "2:15 PM-3:30 PM", date: "2026-07-01", startTime: "14:15", endTime: "15:30", title: "Recreation Time #1", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-wed-recreation-2", day: "Wed, Jul 1", time: "3:30 PM-5:00 PM", date: "2026-07-01", startTime: "15:30", endTime: "17:00", title: "Recreation Time #2", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-wed-vespers", day: "Wed, Jul 1", time: "6:15 PM", date: "2026-07-01", startTime: "18:15", title: "Vespers", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-wed-dinner", day: "Wed, Jul 1", time: "6:30 PM", date: "2026-07-01", startTime: "18:30", title: "Dinner", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-wed-evening-worship", day: "Wed, Jul 1", time: "7:30 PM", date: "2026-07-01", startTime: "19:30", title: "Evening Worship", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-wed-yak-snack", day: "Wed, Jul 1", time: "9:00 PM", date: "2026-07-01", startTime: "21:00", title: "Yak & Snack", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-wed-late-night-rec", day: "Wed, Jul 1", time: "9:00 PM-10:00 PM", date: "2026-07-01", startTime: "21:00", endTime: "22:00", title: "Late Night Rec", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },

  { id: "sched-thu-wake-up", day: "Thu, Jul 2", time: "7:30 AM", date: "2026-07-02", startTime: "07:30", title: "Wake Up", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-thu-morning-watch", day: "Thu, Jul 2", time: "8:30 AM", date: "2026-07-02", startTime: "08:30", title: "Morning Watch", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-thu-breakfast", day: "Thu, Jul 2", time: "8:45 AM", date: "2026-07-02", startTime: "08:45", title: "Breakfast", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-thu-morning-worship", day: "Thu, Jul 2", time: "9:30 AM", date: "2026-07-02", startTime: "09:30", title: "Morning Worship", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-thu-breakout-1", day: "Thu, Jul 2", time: "10:00 AM-10:40 AM", date: "2026-07-02", startTime: "10:00", endTime: "10:40", title: "Break-out Group 1", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-thu-breakout-2", day: "Thu, Jul 2", time: "10:45 AM-11:15 AM", date: "2026-07-02", startTime: "10:45", endTime: "11:15", title: "Break-out Group 2", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-thu-mail-call", day: "Thu, Jul 2", time: "12:00 PM", date: "2026-07-02", startTime: "12:00", title: "Mail Call", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-thu-lunch", day: "Thu, Jul 2", time: "12:30 PM", date: "2026-07-02", startTime: "12:30", title: "Lunch", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-thu-youth-group-time", day: "Thu, Jul 2", time: "1:30 PM", date: "2026-07-02", startTime: "13:30", title: "Youth Group Time", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-thu-recreation-1", day: "Thu, Jul 2", time: "2:15 PM-3:30 PM", date: "2026-07-02", startTime: "14:15", endTime: "15:30", title: "Recreation Time #1", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-thu-recreation-2", day: "Thu, Jul 2", time: "3:30 PM-5:00 PM", date: "2026-07-02", startTime: "15:30", endTime: "17:00", title: "Recreation Time #2", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-thu-vespers", day: "Thu, Jul 2", time: "6:15 PM", date: "2026-07-02", startTime: "18:15", title: "Vespers", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-thu-dinner", day: "Thu, Jul 2", time: "6:30 PM", date: "2026-07-02", startTime: "18:30", title: "Dinner", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-thu-evening-worship", day: "Thu, Jul 2", time: "7:30 PM", date: "2026-07-02", startTime: "19:30", title: "Evening Worship", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-thu-yak-snack", day: "Thu, Jul 2", time: "9:00 PM", date: "2026-07-02", startTime: "21:00", title: "Yak & Snack", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-thu-late-night-rec", day: "Thu, Jul 2", time: "9:00 PM-10:00 PM", date: "2026-07-02", startTime: "21:00", endTime: "22:00", title: "Late Night Rec", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },

  { id: "sched-fri-wake-up", day: "Fri, Jul 3", time: "7:00 AM", date: "2026-07-03", startTime: "07:00", title: "Wake Up", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-fri-morning-watch", day: "Fri, Jul 3", time: "8:30 AM", date: "2026-07-03", startTime: "08:30", title: "Morning Watch", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-fri-breakfast", day: "Fri, Jul 3", time: "8:45 AM", date: "2026-07-03", startTime: "08:45", title: "Breakfast", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-fri-morning-worship", day: "Fri, Jul 3", time: "9:30 AM", date: "2026-07-03", startTime: "09:30", title: "Morning Worship", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-fri-pictures-dismissal", day: "Fri, Jul 3", time: "10:30 AM", date: "2026-07-03", startTime: "10:30", title: "Pictures / Dismissal", location: "", audience: "All Camp", status: "Confirmed", visibility: "All Camp" },
  { id: "sched-fri-clc-pickup", day: "Fri, Jul 3", time: "12:30 PM", date: "2026-07-03", startTime: "12:30", title: "CLC Pickup at Church", location: "Community Life Church", audience: "Leaders", notes: "Category: Transportation. Audience: CLC / Emerge. Parent pickup at Community Life Church. Time based on parent email.", status: "Confirmed", visibility: "Leaders Only" }
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
