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
  sheet.getRange('A4:D6').merge().setValue('EVENTS')
    .setBackground('#FFFFFF')
    .setFontColor(UI_COLORS.EVENTS)
    .setFontWeight('bold')
    .setFontSize(26)
    .setVerticalAlignment('middle');
  sheet.getRange('E4:J6').merge().setValue('Plan with clarity. Execute with excellence.')
    .setBackground('#FFFFFF')
    .setFontColor(UI_COLORS.MUTED)
    .setVerticalAlignment('middle');
  sheet.getRange('K4:Z6').merge()
    .setValue('Menu actions: Add New Event, Clear Filters, View Calendar, Open EMMA Sidebar')
    .setBackground(UI_COLORS.SOFT_BG)
    .setFontColor(UI_COLORS.NAVY)
    .setFontWeight('bold')
    .setHorizontalAlignment('right')
    .setVerticalAlignment('middle');
}

function buildEventsMetricCards_(sheet) {
  const cards = [
    ['Active Events', '=COUNTIFS(H15:H,"<>Completed",D15:D,">="&TODAY())'],
    ['Upcoming Events', '=COUNTIFS(D15:D,">="&TODAY(),D15:D,"<="&TODAY()+90)'],
    ['Completion Avg', '=IFERROR(AVERAGE(FILTER(I15:I,B15:B<>"")),0)'],
    ['Overdue Tasks', '0'],
    ['Total Budgeted', '=IFERROR(SUM(K15:K),0)'],
    ['Total Spent', '=IFERROR(SUM(L15:L),0)']
  ];
  cards.forEach((card, index) => {
    const column = 1 + (index * 4);
    const range = sheet.getRange(8, column, 5, 3);
    range
      .setBackground('#FFFFFF')
      .setBorder(true, true, true, true, true, true, UI_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(8, column, 1, 3).merge().setValue(card[0]).setFontWeight('bold').setFontColor(UI_COLORS.NAVY).setHorizontalAlignment('center');
    sheet.getRange(9, column, 2, 3).merge().setFormula(card[1]).setFontWeight('bold').setFontSize(18).setFontColor(index === 3 ? UI_COLORS.DANGER : UI_COLORS.NAVY).setHorizontalAlignment('center').setVerticalAlignment('middle');
    sheet.getRange(11, column, 1, 3).merge().setValue('Calculated from table data').setFontColor(UI_COLORS.MUTED).setFontSize(9).setHorizontalAlignment('center');
    sheet.getRange(12, column, 1, 3).merge().setValue('Package 1 foundation').setFontColor(UI_COLORS.MUTED).setFontSize(8).setHorizontalAlignment('center');
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

function clearDashboardArea_(sheet, row, column, rowCount, columnCount) {
  const range = sheet.getRange(row, column, rowCount, columnCount);
  range.breakApart();
  range.clear({ contentsOnly: false });
}
