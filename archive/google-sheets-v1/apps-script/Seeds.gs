function seedEvents_() {
  return [
    ['E-2025-018', 'Summer Kickoff', 'Weekend Service', new Date('2025-06-08'), new Date('2025-06-08'), 'Planning', 0.45, 2500, 850, 'Caution', 'Jaci', 'Launch summer with clarity, joy, and strong leader alignment.', 'Greeters, setup, worship support', 'Parent reminder, leader GroupMe, student text', 'Capture wins and attendance notes', new Date('2025-05-24')],
    ['E-2025-017', 'High School Camp', 'Retreat', new Date('2025-07-21'), new Date('2025-07-25'), 'Planning', 0.32, 7800, 2150, 'At Risk', 'Jaci', 'Create a spiritually focused camp experience with clear parent trust.', 'Cabin leaders, transport, medical forms', 'Parent email sequence, packing reminders', 'Post-camp parent recap and leader debrief', new Date('2025-05-22')],
    ['E-2025-016', 'Parent Night', 'Event', new Date('2025-06-15'), new Date('2025-06-15'), 'Planning', 0.60, 1200, 600, 'On Track', 'Nick', 'Build parent trust and make next steps obvious.', 'Hospitality, check-in, table hosts', 'Parent invite, leader talking points', 'Follow up with absent families', new Date('2025-05-23')],
    ['E-2025-015', 'Serve Day', 'Outreach', new Date('2025-06-21'), new Date('2025-06-21'), 'Planning', 0.25, 800, 200, 'At Risk', 'Nick', 'Help students practice visible love for God and people.', 'Drivers, site leads, supplies', 'Leader GroupMe, parent logistics', 'Thank volunteers and capture stories', new Date('2025-05-22')],
    ['E-2025-014', 'Middle School Camp', 'Retreat', new Date('2025-08-04'), new Date('2025-08-06'), 'Planning', 0.15, 4350, 1100, 'At Risk', 'Jaci', 'Make camp simple, safe, and spiritually meaningful for middle schoolers.', 'Cabin leaders, forms, games', 'Parent email, packing list, student reminders', 'Debrief and parent photo recap', new Date('2025-05-20')],
    ['E-2025-013', 'Baptism Sunday', 'Weekend Service', new Date('2025-06-29'), new Date('2025-06-29'), 'Planning', 0.70, 1000, 700, 'On Track', 'Nick', 'Celebrate students taking faithful next steps.', 'Testimony coach, photo support', 'Parent invite, service reminders', 'Follow-up discipleship plan', new Date('2025-05-24')],
    ['E-2025-012', 'Back to School Bash', 'Event', new Date('2025-08-10'), new Date('2025-08-10'), 'Planning', 0.10, 1000, 0, 'At Risk', 'Jaci', 'Begin the school year with momentum and easy invites.', 'Games, food, small group leaders', 'Student invite copy, parent details', 'Connect new students to groups', new Date('2025-05-19')]
  ];
}

function seedTasks_() {
  return [
    ['T-001', 'Confirm Guest Speaker', 'E-2025-017', 'High School Camp', new Date('2025-07-21'), 'Event', 'J', 'Not Started', 0, 'Neutral', 'High', 'Confirm topic, honorarium, arrival details.', new Date()],
    ['T-002', 'Reserve Transportation', 'E-2025-017', 'High School Camp', new Date('2025-07-21'), 'Event', 'J', 'Not Started', 0, 'Neutral', 'High', 'Confirm vans, drivers, pickup/dropoff.', new Date()],
    ['T-003', 'Design Event T-Shirt', 'E-2025-012', 'Back to School Bash', new Date('2025-08-10'), 'Event', 'N', 'Not Started', 0, 'Neutral', 'Medium', 'Gather design and order deadlines.', new Date()],
    ['T-004', 'Build Communication Plan', 'E-2025-018', 'Summer Kickoff', new Date('2025-06-08'), 'Event', 'J', 'In Progress', 0.45, 'Caution', 'High', 'Parent email, leader GroupMe, student text.', new Date()],
    ['T-005', 'Recruit Volunteers', 'E-2025-015', 'Serve Day', new Date('2025-06-21'), 'Outreach', 'N', 'In Progress', 0.30, 'Caution', 'High', 'Need site leads and drivers.', new Date()],
    ['T-006', 'Order Supplies', 'E-2025-016', 'Parent Night', new Date('2025-06-15'), 'Event', 'N', 'In Progress', 0.65, 'Caution', 'Medium', 'Hospitality and printed handouts.', new Date()],
    ['T-007', 'Need Worship Setlist', 'E-2025-017', 'High School Camp', new Date('2025-07-21'), 'Event', 'J', 'Waiting / Blocked', 0.20, 'At Risk', 'High', 'Waiting on worship leader confirmation.', new Date()],
    ['T-008', 'Budget Approval', 'E-2025-014', 'Middle School Camp', new Date('2025-08-04'), 'Event', 'J', 'Waiting / Blocked', 0.10, 'At Risk', 'High', 'Need final approval before deposits.', new Date()],
    ['T-009', 'Marketing Graphics', 'E-2025-018', 'Summer Kickoff', new Date('2025-06-08'), 'Event', 'N', 'In Review', 0.75, 'Review', 'Medium', 'Review for brand and clarity.', new Date()],
    ['T-010', 'Small Group Plan', 'E-2025-014', 'Middle School Camp', new Date('2025-08-04'), 'Event', 'J', 'In Review', 0.50, 'Review', 'Medium', 'Check age-appropriate discussion steps.', new Date()],
    ['T-011', 'Book Venue', 'E-2025-016', 'Parent Night', new Date('2025-06-15'), 'Event', 'N', 'Complete', 1, 'On Track', 'High', 'Room confirmed.', new Date()],
    ['T-012', 'Create Registration Form', 'E-2025-015', 'Serve Day', new Date('2025-06-21'), 'Event', 'N', 'Complete', 1, 'On Track', 'High', 'Form ready.', new Date()],
    ['T-013', 'Submit Background Checks', 'E-2025-015', 'Serve Day', new Date('2025-06-21'), 'Outreach', 'J', 'Complete', 1, 'On Track', 'High', 'Submitted for volunteers.', new Date()]
  ];
}

function seedCommunications_() {
  return [
    ['C-001', 'E-2025-017', 'High School Camp', 'Email', 'Parents', 'Parent Trustworthy', 'High School Camp details for review', 'Draft parent email covering dates, packing, forms, payment, and next steps.', 'Draft', 'Admin', new Date(), new Date()],
    ['C-002', 'E-2025-015', 'Serve Day', 'GroupMe', 'Leaders', 'Leader Actionable', 'Serve Day leader plan for review', 'Short leader-facing message with assignments and arrival time.', 'Draft', 'Admin', new Date(), new Date()]
  ];
}

function seedVoices_() {
  return [
    ['V-001', 'Parent Trustworthy', 'Parents', 'Clear, complete, calm, warm', 'Include dates, deadlines, safety, cost, next steps', 'Do not sound vague or hype-driven', 'Parents, here are the key details so you can plan with confidence.'],
    ['V-002', 'Leader Actionable', 'Leaders', 'Direct, honoring, practical', 'Give clear asks and context', 'Do not treat volunteers like staffing units', 'Team, thank you for helping make this meaningful for students.']
  ];
}

function seedPrompts_() {
  return [
    ['P-001', 'Event Planning Assistant', 'Build Event Plan', 'Create vision, logistics, tasks, volunteer needs, communications, and follow-up plan.', 'Do not invent details. Flag missing info.'],
    ['P-002', 'Parent Email Generator', 'Parent Event Email', 'Draft a complete parent-facing email from event details and voice profile.', 'Must go to admin review before sending.'],
    ['P-003', 'Leader GroupMe Generator', 'Leader Action Message', 'Draft a brief leader-facing GroupMe message with clear assignments.', 'Respect volunteers as ministry partners.']
  ];
}
