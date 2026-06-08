function setupEventsSheet() {
  const sheet = getOrCreateSheet_(SHEET_NAMES.EVENTS);
  const existingRows = getExistingEventsTableRows_(sheet);
  clearDashboardArea_(sheet, 1, 1, 44, 26);
  sheet.setTabColor(TAB_COLORS[SHEET_NAMES.EVENTS]);
  buildEventsHeader_(sheet);
  buildEventsMetricCards_(sheet);
  buildEventsTable_(sheet);
  restoreEventsTableRows_(sheet, existingRows);
  applyEventsFormatting();
}

function applyEventsFormatting() {
  const sheet = getSheet_(SHEET_NAMES.EVENTS);
  if (!sheet) return;
  const headerRow = TABLE_START_ROWS.EVENTS;
  const columnCount = PACKAGE_ONE_COLUMNS.EVENTS.length;
  sheet.getRange(headerRow, 1, 1, columnCount)
    .setBackground(UI_COLORS.EVENTS)
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(headerRow);
  sheet.setFrozenColumns(4);
  sheet.setColumnWidths(1, columnCount, 130);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(4, 110);
  sheet.setColumnWidth(8, 130);
  sheet.setColumnWidth(9, 110);
  sheet.setColumnWidth(14, 120);
  sheet.getRange(headerRow + 1, 4, Math.max(sheet.getMaxRows() - headerRow, 1), 2).setNumberFormat('m/d/yyyy');
  sheet.getRange(headerRow + 1, 11, Math.max(sheet.getMaxRows() - headerRow, 1), 2).setNumberFormat('$#,##0.00');
  sheet.getRange(headerRow + 1, 9, Math.max(sheet.getMaxRows() - headerRow, 1), 1).setNumberFormat('0%');
  sheet.setRowHeights(1, 2, 30);
  sheet.setRowHeights(4, 3, 28);
  sheet.setRowHeights(8, 5, 30);
  sheet.setRowHeight(headerRow, 28);
  sheet.setHiddenGridlines(true);
  applyColumnValidation_(SHEET_NAMES.EVENTS, 'Event Type', NAMED_RANGES.EVENT_TYPES);
  applyColumnValidation_(SHEET_NAMES.EVENTS, 'Status', NAMED_RANGES.STATUSES);
  applyColumnValidation_(SHEET_NAMES.EVENTS, 'Health', NAMED_RANGES.HEALTH);
  applyColumnValidation_(SHEET_NAMES.EVENTS, 'Owner', NAMED_RANGES.OWNERS);
  applyEventsHelperColumnVisibility_(sheet);
}

function applyEventsHelperColumnVisibility_(sheet) {
  const helperStartColumn = 16;
  const helperColumnCount = PACKAGE_ONE_COLUMNS.EVENTS.length - helperStartColumn + 1;
  if (helperColumnCount > 0) {
    sheet.hideColumns(helperStartColumn, helperColumnCount);
  }
}

function buildEventsHeader_(sheet) {
  sheet.getRange('A1:Z1').merge().setValue(EMERGENCE_APP.name)
    .setBackground(UI_COLORS.NAVY)
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setFontSize(20);
  sheet.getRange('A2:Z2').merge().setValue(`Environment: ${getCurrentEnvironment()} | ${EMERGENCE_APP.packageName}`)
    .setBackground(UI_COLORS.SOFT_BG)
    .setFontColor(UI_COLORS.MUTED);
  setDashboardHeader_(
    sheet,
    'A4:D6',
    'EVENTS',
    UI_COLORS.EVENTS,
    'E4:J6',
    'Plan with clarity. Execute with excellence.',
    'K4:Z6',
    'Use the EMERGEnce menu for navigation, setup, smoke tests, and EMMA.'
  );
}

function buildEventsMetricCards_(sheet) {
  const cards = [
    ['Active Events', '=COUNTIFS(H15:H,"<>Completed",D15:D,">="&TODAY())', 'Events in progress', UI_COLORS.EVENTS],
    ['Upcoming Events', '=COUNTIFS(D15:D,">="&TODAY(),D15:D,"<="&TODAY()+90)', 'Next 90 days', UI_COLORS.NAVY],
    ['Completion Avg', '=IFERROR(AVERAGE(FILTER(I15:I,B15:B<>"")),0)', 'All active events', UI_COLORS.NAVY],
    ['Overdue Tasks', '0', 'Needs task logic', UI_COLORS.DANGER],
    ['Total Budgeted', '=IFERROR(SUM(K15:K),0)', 'All active events', UI_COLORS.NAVY],
    ['Total Spent', '=IFERROR(SUM(L15:L),0)', 'From Events table', UI_COLORS.SUCCESS]
  ];
  cards.forEach((card, index) => {
    const column = 1 + (index * 4);
    setDashboardKpiCard_(sheet, 8, column, 5, 3, card[0], card[1], card[2], card[3]);
  });
}

function buildEventsTable_(sheet) {
  const headerRow = TABLE_START_ROWS.EVENTS;
  sheet.getRange(headerRow, 1, 1, PACKAGE_ONE_COLUMNS.EVENTS.length).setValues([PACKAGE_ONE_COLUMNS.EVENTS]);
  if (!sheet.getFilter()) {
    sheet.getRange(headerRow, 1, Math.max(sheet.getMaxRows() - headerRow + 1, 2), PACKAGE_ONE_COLUMNS.EVENTS.length).createFilter();
  }
}

function getExistingEventsTableRows_(sheet) {
  const headerRow = TABLE_START_ROWS.EVENTS;
  if (sheet.getLastRow() <= headerRow) return [];
  const headers = sheet.getRange(headerRow, 1, 1, PACKAGE_ONE_COLUMNS.EVENTS.length).getValues()[0];
  if (headers.join('|') !== PACKAGE_ONE_COLUMNS.EVENTS.join('|')) return [];
  return sheet.getRange(headerRow + 1, 1, sheet.getLastRow() - headerRow, PACKAGE_ONE_COLUMNS.EVENTS.length)
    .getValues()
    .filter((row) => row.some((cell) => cell !== ''));
}

function restoreEventsTableRows_(sheet, rows) {
  if (!rows || !rows.length) return;
  sheet.getRange(TABLE_START_ROWS.EVENTS + 1, 1, rows.length, PACKAGE_ONE_COLUMNS.EVENTS.length).setValues(rows);
}
