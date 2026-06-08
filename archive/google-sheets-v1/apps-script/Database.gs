function installDataModel() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone('America/Chicago');
  ensureTable_(APP_CONFIG.sheets.events, [
    'Event ID', 'Event Name', 'Event Type', 'Start Date', 'End Date', 'Status', 'Completion',
    'Budgeted', 'Spent', 'Health', 'Owner', 'Vision', 'Volunteer Needs', 'Communication Needs',
    'Follow Up Plan', 'Last Updated'
  ], seedEvents_());
  ensureTable_(APP_CONFIG.sheets.tasks, [
    'Task ID', 'Task Name', 'Event ID', 'Event Name', 'Due Date', 'Type', 'Owner', 'Status',
    'Completion', 'Health', 'Priority', 'Notes', 'Last Updated'
  ], seedTasks_());
  ensureTable_(APP_CONFIG.sheets.communications, [
    'Draft ID', 'Event ID', 'Event Name', 'Platform', 'Audience', 'Sender Voice', 'Subject',
    'Draft', 'Review Status', 'Admin Reviewer', 'Created At', 'Updated At'
  ], seedCommunications_());
  ensureTable_(APP_CONFIG.sheets.voiceProfiles, [
    'Voice ID', 'Name', 'Audience', 'Tone', 'Do', 'Avoid', 'Sample'
  ], seedVoices_());
  ensureTable_(APP_CONFIG.sheets.promptTemplates, [
    'Template ID', 'Workflow', 'Prompt Name', 'Prompt', 'Guardrails'
  ], seedPrompts_());
  ensureTable_(APP_CONFIG.sheets.documents, ['Document ID', 'Event ID', 'Name', 'Type', 'URL', 'Status', 'Notes'], []);
  ensureTable_(APP_CONFIG.sheets.budget, ['Budget ID', 'Event ID', 'Category', 'Budgeted', 'Spent', 'Owner', 'Status'], []);
  ensureTable_(APP_CONFIG.sheets.leaders, ['Leader ID', 'Name', 'Role', 'Phone', 'Email', 'Availability', 'Notes'], []);
  ensureTable_(APP_CONFIG.sheets.students, ['Student ID', 'Name', 'Grade', 'Group', 'Parent Contact', 'Forms Status', 'Notes'], []);
  ensureTable_(APP_CONFIG.sheets.worship, ['Plan ID', 'Event ID', 'Service Date', 'Song', 'Key', 'Owner', 'Status', 'Notes'], []);
  ensureTable_(APP_CONFIG.sheets.settings, ['Setting', 'Value', 'Notes'], [['Admin Review Email', '', 'Required for communication review routing']]);
  ensureTable_(APP_CONFIG.sheets.activity, ['Timestamp', 'Action', 'Record ID', 'User', 'Message'], []);
  hideDatabaseSheets_();
}

function ensureTable_(sheetName, headers, seedRows) {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  const existingHeader = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const missingHeader = headers.some((header, index) => existingHeader[index] !== header);
  if (missingHeader) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#EAF3FF');
  }
  if (sheet.getLastRow() < 2 && seedRows.length) {
    sheet.getRange(2, 1, seedRows.length, headers.length).setValues(seedRows);
  }
  sheet.setFrozenRows(1);
}

function hideDatabaseSheets_() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(APP_CONFIG.sheets).forEach(key => {
    const sheet = ss.getSheetByName(APP_CONFIG.sheets[key]);
    if (sheet && ss.getSheets().length > 1) sheet.hideSheet();
  });
}

function tableRows_(sheetName) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  const headers = values.shift();
  return values.filter(row => row.some(value => value !== '')).map(row => objectFromRow_(headers, row));
}

function appendRow_(sheetName, object) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(header => object[header] ?? '');
  sheet.appendRow(row);
}

function updateRow_(sheetName, idHeader, id, patch) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idCol = headers.indexOf(idHeader) + 1;
  if (!idCol) throw new Error(`Missing ID header ${idHeader}`);
  const ids = sheet.getRange(2, idCol, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
  const offset = ids.findIndex(row => row[0] === id);
  if (offset < 0) throw new Error(`Record not found: ${id}`);
  const rowNumber = offset + 2;
  Object.keys(patch).forEach(key => {
    const col = headers.indexOf(key) + 1;
    if (col) sheet.getRange(rowNumber, col).setValue(patch[key]);
  });
}

function objectFromRow_(headers, row) {
  return headers.reduce((object, header, index) => {
    object[header] = row[index];
    return object;
  }, {});
}

function logActivity(action, recordId, message) {
  appendRow_(APP_CONFIG.sheets.activity, {
    Timestamp: new Date(),
    Action: action,
    'Record ID': recordId,
    User: Session.getActiveUser().getEmail(),
    Message: message
  });
}
