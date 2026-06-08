const EVENTS_VISIBLE_HEADERS = [
  'Event ID',
  'Event Name',
  'Event Type',
  'Start Date',
  'End Date',
  'Status',
  'Completion',
  'Days Away',
  'Budgeted',
  'Spent',
  'Health',
  'Owner',
  'Last Updated'
];

function setupEventsSheet() {
  const sheet = getOrCreateSheet_(SHEET_NAMES.EVENTS);
  resetDashboardRange_(sheet, 80, 18);
  sheet.setTabColor(TAB_COLORS[SHEET_NAMES.EVENTS]);
  buildEventsDashboard_();
  applyEventsFormatting();
}

function applyEventsFormatting() {
  const sheet = getSheet_(SHEET_NAMES.EVENTS);
  if (!sheet) return;

  sheet.setFrozenRows(12);
  sheet.setFrozenColumns(0);
  sheet.setColumnWidths(1, 15, 118);
  sheet.setColumnWidth(2, 190);
  sheet.setColumnWidth(3, 130);
  sheet.setColumnWidths(4, 2, 100);
  sheet.setColumnWidth(6, 125);
  sheet.setColumnWidth(7, 105);
  sheet.setColumnWidth(8, 90);
  sheet.setColumnWidths(9, 2, 105);
  sheet.setColumnWidth(11, 115);
  sheet.setColumnWidth(12, 100);
  sheet.setColumnWidth(13, 115);
  sheet.setColumnWidths(14, 2, 115);
  sheet.setColumnWidths(16, 3, 40);

  sheet.setRowHeights(1, 2, 28);
  sheet.setRowHeights(4, 2, 30);
  sheet.setRowHeight(6, 24);
  sheet.setRowHeights(7, 4, 28);
  sheet.setRowHeight(12, 32);
  sheet.setRowHeights(13, 30, 30);

  const bodyRows = 48;
  sheet.getRange(13, 4, bodyRows, 2).setNumberFormat('m/d/yyyy');
  sheet.getRange(13, 7, bodyRows, 1).setNumberFormat('0%');
  sheet.getRange(13, 9, bodyRows, 2).setNumberFormat('$#,##0');
  applyValidationToRange_(sheet.getRange(13, 6, bodyRows, 1), NAMED_RANGES.STATUSES);
  applyValidationToRange_(sheet.getRange(13, 11, bodyRows, 1), NAMED_RANGES.HEALTH);
}

function buildEventsDashboard_() {
  const sheet = getSheet_(SHEET_NAMES.EVENTS);

  setMergedBlock_(sheet, 'A1:O1', EMERGENCE_APP.name, {
    background: UI_COLORS.NAVY,
    fontColor: '#FFFFFF',
    fontSize: 15,
    bold: true,
    horizontalAlignment: 'left'
  });
  setMergedBlock_(sheet, 'A2:O2', `Environment: ${getCurrentEnvironment()} | ${EMERGENCE_APP.packageName}`, {
    background: '#EEF3F7',
    fontColor: UI_COLORS.MUTED,
    fontSize: 9,
    horizontalAlignment: 'left'
  });

  setMergedBlock_(sheet, 'A4:C5', 'EVENTS', {
    background: '#FFFFFF',
    fontColor: UI_COLORS.EVENTS,
    fontSize: 20,
    bold: true,
    horizontalAlignment: 'left'
  });
  setMergedBlock_(sheet, 'D4:H5', 'Plan with clarity. Execute with excellence.', {
    background: '#FFFFFF',
    fontColor: UI_COLORS.MUTED,
    fontSize: 10,
    horizontalAlignment: 'left'
  });
  setPlaceholderControl_(sheet, 'J4:K5', 'Add New Event');
  setPlaceholderControl_(sheet, 'L4:M5', 'Clear Filters');
  setPlaceholderControl_(sheet, 'N4:O5', 'Ask EMMA');
  setMergedBlock_(sheet, 'J6:O6', 'Use the EMERGEnce menu for Package 1 actions.', {
    background: '#FFFFFF',
    fontColor: UI_COLORS.MUTED,
    fontSize: 8,
    horizontalAlignment: 'center'
  });

  setKpiCard_(sheet, 'A7:C10', 'ACTIVE EVENTS', '0', 'Events in progress', UI_COLORS.EVENTS);
  setKpiCard_(sheet, 'D7:F10', 'UPCOMING EVENTS', '0', 'Next 90 days', UI_COLORS.KANBAN);
  setKpiCard_(sheet, 'G7:I10', 'COMPLETION AVG', '0%', 'Formula-ready', UI_COLORS.DOCUMENTS);
  setKpiCard_(sheet, 'J7:L10', 'OVERDUE TASKS', '0', 'Needs attention', UI_COLORS.DANGER);
  setKpiCard_(sheet, 'M7:O10', 'TOTAL BUDGETED', '$0', 'All events', UI_COLORS.NAVY);

  setTableHeader_(sheet, 12, EVENTS_VISIBLE_HEADERS, UI_COLORS.EVENTS);
  applyAlternatingBody_(sheet, 13, 48, EVENTS_VISIBLE_HEADERS.length);
}

function applyEventsHelperColumnVisibility_(sheet) {
  if (!sheet) return;
  sheet.showColumns(1, 18);
}
