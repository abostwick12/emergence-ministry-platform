function setupEventsSheet() {
  const sheet = getOrCreateSheet_(SHEET_NAMES.EVENTS);
  sheet.clearFormats();
  sheet.setTabColor(TAB_COLORS[SHEET_NAMES.EVENTS]);
  buildEventsHeader_(sheet);
  buildEventsMetricCards_(sheet);
  buildEventsTable_(sheet);
  applyEventsFormatting();
}

function applyEventsFormatting() {
  const sheet = getSheet_(SHEET_NAMES.EVENTS);
  if (!sheet) return;
  const headerRow = TABLE_START_ROWS.EVENTS;
  const columnCount = PACKAGE_ONE_COLUMNS.EVENTS.length;
  sheet.getRange(headerRow, 1, 1, columnCount).setBackground(UI_COLORS.EVENTS).setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center');
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
  if (helperColumnCount > 0) sheet.hideColumns(helperStartColumn, helperColumnCount);
}

function buildEventsHeader_(sheet) {
  sheet.getRange('A1:Z1').merge().setValue(EMERGENCE_APP.name).setBackground(UI_COLORS.NAVY).setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(20);
  sheet.getRange('A2:Z2').merge().setValue(`Environment: ${getCurrentEnvironment()} | ${EMERGENCE_APP.packageName}`).setBackground(UI_COLORS.SOFT_BG).setFontColor(UI_COLORS.MUTED);
  sheet.getRange('A4:D5').merge().setValue('EVENTS').setBackground('#FFFFFF').setFontColor(UI_COLORS.EVENTS).setFontWeight('bold').setFontSize(26).setVerticalAlignment('middle');
  sheet.getRange('E4:H5').merge().setValue('Plan with clarity. Execute with excellence.').setBackground('#FFFFFF').setFontColor(UI_COLORS.MUTED).setVerticalAlignment('middle');
  const controls = [['Add New Event','Build Package 2'],['Clear Filters','Menu: EMERGEnce > Events'],['View Calendar','Later build'],['Ask EMMA','Menu: EMERGEnce']];
  controls.forEach((control, index) => {
    const column = 10 + (index * 2);
    const range = sheet.getRange(4, column, 2, 2);
    range.merge().setValue(`${control[0]}\n${control[1]}`).setBackground(index === 3 ? UI_COLORS.STUDENTS : '#FFFFFF').setFontColor(index === 3 ? '#FFFFFF' : UI_COLORS.NAVY).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setBorder(true, true, true, true, true, true, UI_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    range.setNote(`${control[0]} is available through the EMERGEnce menu or will be enabled in the listed build package.`);
  });
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
    sheet.getRange(8, column, 3, 3).setBackground('#FFFFFF').setBorder(true, true, true, true, true, true, UI_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(8, column, 1, 3).merge().setValue(card[0]).setFontWeight('bold').setFontColor(UI_COLORS.NAVY).setHorizontalAlignment('center');
    sheet.getRange(9, column, 1, 3).merge().setFormula(card[1]).setFontWeight('bold').setFontSize(18).setFontColor(index === 3 ? UI_COLORS.DANGER : UI_COLORS.NAVY).setHorizontalAlignment('center');
    sheet.getRange(10, column, 1, 3).merge().setValue('Calculated from table data').setFontColor(UI_COLORS.MUTED).setFontSize(9).setHorizontalAlignment('center');
  });
}

function buildEventsTable_(sheet) {
  const headerRow = TABLE_START_ROWS.EVENTS;
  sheet.getRange(headerRow, 1, 1, PACKAGE_ONE_COLUMNS.EVENTS.length).setValues([PACKAGE_ONE_COLUMNS.EVENTS]);
  if (!sheet.getFilter()) sheet.getRange(headerRow, 1, Math.max(sheet.getMaxRows() - headerRow + 1, 2), PACKAGE_ONE_COLUMNS.EVENTS.length).createFilter();
}
