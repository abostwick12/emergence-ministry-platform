function getCommunications() {
  installDataModel();
  return tableRows_(APP_CONFIG.sheets.communications).map(commView_);
}

function createCommunicationDraft(form) {
  installDataModel();
  const events = getEvents();
  const event = events.find(item => item.id === form.eventId) || events[0];
  const platform = form.platform || 'Email';
  const audience = form.audience || 'Parents';
  const voice = form.voice || (audience === 'Parents' ? 'Parent Trustworthy' : 'Leader Actionable');
  const subject = `[${event ? event.name : 'Event'}] communication in [${platform}] for review`;
  const draft = buildDraftText_(event, platform, audience, voice, form.goal || '');
  const row = {
    'Draft ID': uuid_('C'),
    'Event ID': event ? event.id : '',
    'Event Name': event ? event.name : '',
    Platform: platform,
    Audience: audience,
    'Sender Voice': voice,
    Subject: subject,
    Draft: draft,
    'Review Status': 'Draft',
    'Admin Reviewer': 'Admin',
    'Created At': new Date(),
    'Updated At': new Date()
  };
  appendRow_(APP_CONFIG.sheets.communications, row);
  logActivity('Create Communication Draft', row['Draft ID'], subject);
  return commView_(row);
}

function buildDraftText_(event, platform, audience, voice, goal) {
  if (!event) return 'Add an event first, then generate a communication draft.';
  const goalLine = goal ? `Goal: ${goal}\n\n` : '';
  if (platform === 'GroupMe') {
    return `${goalLine}Team, thank you for helping with ${event.name}. Please review your assignments, note the date (${event.startDate}), and reply with any blockers by tomorrow. We want this to feel clear, calm, and meaningful for students.`;
  }
  if (platform === 'SMS') {
    return `${event.name} reminder: ${event.startDate}. Please check the details and complete any needed forms. Reply with questions.`;
  }
  return `${goalLine}Parents,\n\nHere are the key details for ${event.name} so you can plan with confidence.\n\nDate: ${event.startDate}\nEvent Type: ${event.type}\nNext Step: Please review forms, deadlines, and any packing or arrival instructions.\n\nWe are grateful to partner with you.`;
}

function commView_(row) {
  return {
    id: row['Draft ID'],
    eventId: row['Event ID'],
    eventName: row['Event Name'],
    platform: row.Platform,
    audience: row.Audience,
    voice: row['Sender Voice'],
    subject: row.Subject,
    draft: row.Draft,
    reviewStatus: row['Review Status'],
    reviewer: row['Admin Reviewer'],
    createdAt: dateText_(row['Created At']),
    updatedAt: dateText_(row['Updated At'])
  };
}
