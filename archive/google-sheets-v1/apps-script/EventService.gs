function getEvents() {
  installDataModel();
  return tableRows_(APP_CONFIG.sheets.events).map(eventView_);
}

function createEvent(form) {
  installDataModel();
  const id = uuid_('E');
  const startDate = form.startDate ? new Date(form.startDate) : today_();
  const endDate = form.endDate ? new Date(form.endDate) : startDate;
  const event = {
    'Event ID': id,
    'Event Name': form.eventName || 'Untitled Event',
    'Event Type': form.eventType || 'Event',
    'Start Date': startDate,
    'End Date': endDate,
    Status: form.status || 'Planning',
    Completion: Number(form.completion || 0),
    Budgeted: Number(form.budgeted || 0),
    Spent: 0,
    Health: form.health || 'At Risk',
    Owner: form.owner || 'Jaci',
    Vision: form.vision || '',
    'Volunteer Needs': form.volunteerNeeds || '',
    'Communication Needs': form.communicationNeeds || '',
    'Follow Up Plan': form.followUpPlan || '',
    'Last Updated': new Date()
  };
  appendRow_(APP_CONFIG.sheets.events, event);
  createBaselineTasks_(id, event['Event Name'], startDate, event.Owner, event['Event Type']);
  logActivity('Create Event', id, `Created event: ${event['Event Name']}`);
  return eventView_(event);
}

function getDashboardState() {
  installDataModel();
  const events = getEvents();
  const tasks = getTasks();
  const communications = getCommunications();
  const budgeted = events.reduce((sum, event) => sum + event.budgeted, 0);
  const spent = events.reduce((sum, event) => sum + event.spent, 0);
  const avgCompletion = events.length
    ? Math.round(events.reduce((sum, event) => sum + event.completion, 0) / events.length * 100)
    : 0;
  return {
    events,
    tasks,
    communications,
    metrics: {
      activeEvents: events.length,
      upcomingEvents: events.filter(event => event.daysAway <= 90).length,
      avgCompletion,
      attentionTasks: tasks.filter(task => task.health === 'At Risk' || task.status === 'Waiting / Blocked').length,
      totalBudgeted: budgeted,
      totalSpent: spent,
      spendPercent: budgeted ? Math.round(spent / budgeted * 1000) / 10 : 0,
      draftsInReview: communications.filter(item => item.reviewStatus !== 'Approved').length
    }
  };
}

function eventView_(row) {
  const startDate = new Date(row['Start Date']);
  const endDate = new Date(row['End Date']);
  const daysAway = Math.max(0, Math.ceil((startDate - today_()) / 86400000));
  return {
    id: row['Event ID'],
    name: row['Event Name'],
    type: row['Event Type'],
    startDate: dateText_(startDate),
    endDate: dateText_(endDate),
    status: row.Status,
    completion: Number(row.Completion || 0),
    daysAway,
    budgeted: Number(row.Budgeted || 0),
    spent: Number(row.Spent || 0),
    health: row.Health,
    owner: row.Owner,
    vision: row.Vision,
    volunteerNeeds: row['Volunteer Needs'],
    communicationNeeds: row['Communication Needs'],
    followUpPlan: row['Follow Up Plan'],
    lastUpdated: dateText_(row['Last Updated'])
  };
}

function dateText_(date) {
  if (!date || String(date) === 'Invalid Date') return '';
  return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), 'M/d/yyyy');
}
