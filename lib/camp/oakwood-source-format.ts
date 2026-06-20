export const oakwoodExpectedCsvHeaders = [
  "Registration ID",
  "Name",
  "Selection",
  "Grade",
  "Room Number",
  "T-Shirt Size",
  "Quick Filter",
  "Emergency Contact",
  "Medical Notes",
  "Dietary Requirements",
  "Team",
  "Vehicle",
  "Registration Contact First Name",
  "Registration Contact Last Name",
  "Registration Contact Phone Number",
  "Insurance",
  "Any other important information you would like us to know about your child?"
] as const;

export const oakwoodRequiredCsvHeaders = ["Registration ID", "Name"] as const;

export const oakwoodRecommendedCsvHeaders = ["Selection", "Grade", "Room Number", "T-Shirt Size", "Quick Filter", "Emergency Contact"] as const;

export const oakwoodOptionalCsvHeaders = [
  "Medical Notes",
  "Dietary Requirements",
  "Team",
  "Vehicle",
  "Registration Contact First Name",
  "Registration Contact Last Name",
  "Registration Contact Phone Number",
  "Insurance",
  "Any other important information you would like us to know about your child?"
] as const;

export const oakwoodSampleHeaderRow = oakwoodExpectedCsvHeaders.join(",");
