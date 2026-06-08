function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('EMERGEnce')
    .addItem('Setup / Repair Platform', 'setupEmergencePlatform')
    .addSeparator()
    .addItem('Go to Events', 'goToEvents')
    .addItem('Go to Kanban Board', 'goToKanban')
    .addItem('Go to Documents', 'goToDocuments')
    .addItem('Go to Budget', 'goToBudget')
    .addItem('Go to Leader List', 'goToLeaderList')
    .addItem('Go to Student List', 'goToStudentList')
    .addItem('Go to Worship', 'goToWorship')
    .addSeparator()
    .addSubMenu(
      SpreadsheetApp.getUi()
        .createMenu('Events')
        .addItem('Add New Event', 'showAddEventDialog')
        .addItem('Clear Event Filters', 'clearEventsFilters')
        .addItem('Show All Event Columns', 'showAllEventsColumns')
        .addItem('View Calendar', 'showCalendarComingSoon')
    )
    .addSubMenu(
      SpreadsheetApp.getUi()
        .createMenu('Kanban Board')
        .addItem('Refresh Kanban Shell', 'refreshKanbanBoard')
    )
    .addSeparator()
    .addItem('Open EMMA Sidebar', 'openEmmaSidebar')
    .addItem('Run Package 1 Smoke Test', 'runPackageOneSmokeTest')
    .addToUi();
}

function goToSheetByName(sheetName) {
  const sheet = getSheet_(sheetName);
  if (!sheet) {
    showComingSoon(`Sheet navigation for ${sheetName}`, 'Package 1 setup');
    return;
  }
  getActiveSpreadsheet_().setActiveSheet(sheet);
}

function goToEvents() {
  goToSheetByName(SHEET_NAMES.EVENTS);
}

function goToKanban() {
  goToSheetByName(SHEET_NAMES.KANBAN);
}

function goToDocuments() {
  goToSheetByName(SHEET_NAMES.DOCUMENTS);
}

function goToBudget() {
  goToSheetByName(SHEET_NAMES.BUDGET);
}

function goToLeaderList() {
  goToSheetByName(SHEET_NAMES.LEADERS);
}

function goToStudentList() {
  goToSheetByName(SHEET_NAMES.STUDENTS);
}

function goToWorship() {
  goToSheetByName(SHEET_NAMES.WORSHIP);
}

function showComingSoon(featureName, buildPackage) {
  const packageLabel = buildPackage || 'a later build';
  SpreadsheetApp.getUi().alert(
    `${featureName} is coming in ${packageLabel}. Package 1 built the safe foundation and visual shell first.`
  );
}

function showAddEventDialog() {
  showComingSoon('Add New Event', 'Build Package 2');
}

function showCalendarComingSoon() {
  showComingSoon('Calendar connection', 'a later build');
}

function clearEventsFilters() {
  const sheet = getSheet_(SHEET_NAMES.EVENTS);
  if (!sheet) return showComingSoon('Events filters', 'Package 1 setup');
  const filter = sheet.getFilter();
  if (filter) {
    filter.remove();
    logActivity('Filters Cleared', SHEET_NAMES.EVENTS, 'Sheet', '', SHEET_NAMES.EVENTS, '', '', 'OK', 'Removed Events tab filter.');
    SpreadsheetApp.getUi().alert('Event filters were cleared.');
    return;
  }
  SpreadsheetApp.getUi().alert('No active Events filter was found.');
}

function showAllEventsColumns() {
  const sheet = getSheet_(SHEET_NAMES.EVENTS);
  if (!sheet) return showComingSoon('Show All Event Columns', 'Package 1 setup');
  sheet.showColumns(1, Math.max(sheet.getMaxColumns(), PACKAGE_ONE_COLUMNS.EVENTS.length));
  applyEventsHelperColumnVisibility_(sheet);
  logActivity('Columns Shown', SHEET_NAMES.EVENTS, 'Sheet', '', SHEET_NAMES.EVENTS, '', '', 'OK', 'Visible Events columns were restored and helper columns remained hidden.');
  SpreadsheetApp.getUi().alert('Visible Events columns were restored. Helper columns are still hidden for safety.');
}
