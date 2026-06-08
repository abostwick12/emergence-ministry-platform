const APP_CONFIG = {
  appName: 'EMERGEnce Ministry Platform',
  assistantName: 'EMMA',
  spreadsheetId: '1czd9z1qKcIcplyUS68S1ImxagazyK4OOnAE1OS7O7IU',
  sheets: {
    events: 'Events_DB',
    tasks: 'Tasks_DB',
    documents: 'Documents_DB',
    budget: 'Budget_DB',
    leaders: 'Leaders_DB',
    students: 'Students_DB',
    worship: 'Worship_DB',
    communications: 'Communications_DB',
    voiceProfiles: 'VoiceProfiles_DB',
    promptTemplates: 'PromptTemplates_DB',
    settings: 'Settings_DB',
    activity: 'Activity_Log'
  },
  eventTypes: ['Weekend Service', 'Retreat', 'Event', 'Outreach', 'Camp', 'Worship', 'Parent Event'],
  owners: ['Jaci', 'Nick', 'Andrew'],
  taskStatuses: ['Not Started', 'In Progress', 'Waiting / Blocked', 'In Review', 'Complete'],
  health: ['On Track', 'Caution', 'At Risk'],
  nav: [
    { id: 'dashboard', label: 'Dashboard', color: '#071B42' },
    { id: 'events', label: 'Events', color: '#EE244F' },
    { id: 'kanban', label: 'Kanban Board', color: '#E58C00' },
    { id: 'documents', label: 'Documents', color: '#256FDB' },
    { id: 'budget', label: 'Budget', color: '#168344' },
    { id: 'leaders', label: 'Leader List', color: '#6E35C4' },
    { id: 'students', label: 'Student List', color: '#0589A5' },
    { id: 'worship', label: 'Worship', color: '#EE244F' },
    { id: 'communication', label: 'Communication', color: '#071B42' },
    { id: 'voices', label: 'Voice Profiles', color: '#071B42' },
    { id: 'prompts', label: 'Prompt Templates', color: '#071B42' },
    { id: 'settings', label: 'System Settings', color: '#071B42' }
  ]
};

function today_() {
  return new Date();
}

function nowIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function uuid_(prefix) {
  return `${prefix}-${Utilities.getUuid().slice(0, 8).toUpperCase()}`;
}
