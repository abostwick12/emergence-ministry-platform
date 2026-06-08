function setupKanbanSheet() {
  renderKanbanShell();
}

function applyKanbanFormatting() {
  renderKanbanShell();
}

function refreshKanbanBoard() {
  renderKanbanShell();
  logActivity('Kanban Refreshed', SHEET_NAMES.KANBAN, 'Sheet', '', SHEET_NAMES.KANBAN, '', '', 'OK', 'Package 1 Kanban dashboard shell rebuilt from scratch.');
  SpreadsheetApp.getUi().alert('Kanban Board shell refreshed. Package 1 placeholders remain clearly labeled.');
}

function renderKanbanShell() {
  const sheet = getOrCreateSheet_(SHEET_NAMES.KANBAN);
  resetDashboardRange_(sheet, 90, 20);
  sheet.setTabColor(TAB_COLORS[SHEET_NAMES.KANBAN]);
  buildKanbanDashboard_();
  formatKanbanDashboard_(sheet);
}

function buildKanbanDashboard_() {
  const sheet = getSheet_(SHEET_NAMES.KANBAN);

  setMergedBlock_(sheet, 'A1:T1', EMERGENCE_APP.name, {
    background: UI_COLORS.NAVY,
    fontColor: '#FFFFFF',
    fontSize: 15,
    bold: true,
    horizontalAlignment: 'left'
  });
  setMergedBlock_(sheet, 'A2:T2', `Environment: ${getCurrentEnvironment()} | ${EMERGENCE_APP.packageName}`, {
    background: '#EEF3F7',
    fontColor: UI_COLORS.MUTED,
    fontSize: 9,
    horizontalAlignment: 'left'
  });

  setMergedBlock_(sheet, 'A4:D5', 'KANBAN BOARD', {
    background: '#FFFFFF',
    fontColor: UI_COLORS.KANBAN,
    fontSize: 20,
    bold: true,
    horizontalAlignment: 'left'
  });
  setMergedBlock_(sheet, 'E4:J5', 'Visualize the work. Move the mission forward.', {
    background: '#FFFFFF',
    fontColor: UI_COLORS.MUTED,
    fontSize: 10,
    horizontalAlignment: 'left'
  });
  setPlaceholderControl_(sheet, 'L4:N5', 'Filter');
  setPlaceholderControl_(sheet, 'O4:Q5', 'Group by');
  setPlaceholderControl_(sheet, 'R4:S5', 'Refresh');
  setPlaceholderControl_(sheet, 'T4:T5', 'EMMA');
  setMergedBlock_(sheet, 'L6:T6', 'Use the EMERGEnce menu for Package 1 actions.', {
    background: '#FFFFFF',
    fontColor: UI_COLORS.MUTED,
    fontSize: 8,
    horizontalAlignment: 'center'
  });

  setKpiCard_(sheet, 'A7:D10', 'TOTAL TASKS', '0', 'Package 2 logic', UI_COLORS.NAVY);
  setKpiCard_(sheet, 'E7:H10', 'IN PROGRESS', '0', 'Active work', UI_COLORS.KANBAN);
  setKpiCard_(sheet, 'I7:L10', 'OVERDUE', '0', 'Needs attention', UI_COLORS.DANGER);
  setKpiCard_(sheet, 'M7:P10', 'COMPLETE', '0', 'Completed this week', UI_COLORS.SUCCESS);
  setKpiCard_(sheet, 'Q7:T10', 'AVG. COMPLETION', '0%', 'Formula-ready', UI_COLORS.DOCUMENTS);

  buildKanbanLane_(sheet, 'A12:D34', 'NOT STARTED', '0', UI_COLORS.GRAY, '#F5F7FA', '0%');
  buildKanbanLane_(sheet, 'E12:H34', 'IN PROGRESS', '0', UI_COLORS.KANBAN, '#FFF7E6', '45%');
  buildKanbanLane_(sheet, 'I12:L34', 'WAITING / STUCK', '0', UI_COLORS.DANGER, '#FDECEC', '20%');
  buildKanbanLane_(sheet, 'M12:P34', 'IN REVIEW', '0', UI_COLORS.LEADERS, '#F3EDFB', '75%');
  buildKanbanLane_(sheet, 'Q12:T34', 'COMPLETE', '0', UI_COLORS.SUCCESS, '#EAF7EE', '100%');

  buildKanbanSummary_(sheet);
  renderCompletionTickerShell();
}

function buildKanbanLane_(sheet, laneA1, label, count, headerColor, bodyColor, percent) {
  const lane = sheet.getRange(laneA1);
  const row = lane.getRow();
  const column = lane.getColumn();
  const columns = lane.getNumColumns();

  lane
    .setBackground(bodyColor)
    .setBorder(true, true, true, true, false, false, headerColor, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  sheet.getRange(row, column, 2, columns).merge()
    .setValue(label + '     ' + count)
    .setBackground(headerColor)
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setFontSize(10)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  buildKanbanCardSlot_(sheet, row + 4, column, columns, percent, 'Reserved card slot', 'Package 2 dynamic data');
  buildKanbanCardSlot_(sheet, row + 12, column, columns, '', 'Reserved card slot', 'Package 2 dynamic data');
}

function buildKanbanCardSlot_(sheet, row, column, columns, percent, title, helper) {
  sheet.getRange(row, column, 5, columns)
    .setBackground('#FFFFFF')
    .setBorder(true, true, true, true, false, false, '#CBD8E6', SpreadsheetApp.BorderStyle.SOLID);

  const badge = sheet.getRange(row + 1, column, 2, 1).merge();
  badge
    .setValue(percent || '')
    .setFontColor(percent ? UI_COLORS.NAVY : UI_COLORS.MUTED)
    .setFontWeight('bold')
    .setFontSize(percent ? 14 : 10)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBackground('#F8FBFD')
    .setBorder(true, true, true, true, false, false, '#9FB0C2', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  sheet.getRange(row + 1, column + 1, 1, columns - 1).merge()
    .setValue(title)
    .setFontColor(UI_COLORS.NAVY)
    .setFontWeight('bold')
    .setFontSize(9)
    .setHorizontalAlignment('center');
  sheet.getRange(row + 2, column + 1, 1, columns - 1).merge()
    .setValue(helper)
    .setFontColor(UI_COLORS.MUTED)
    .setFontSize(8)
    .setHorizontalAlignment('center');
}

function buildKanbanSummary_(sheet) {
  const summaries = [
    ['A36:D40', 'Overall Completion', '0%'],
    ['E36:H40', 'Due This Week', '0'],
    ['I36:L40', 'Overdue Tasks', '0'],
    ['M36:P40', 'Critical Tasks On Track', '0%'],
    ['Q36:T40', 'Events in Progress', '0']
  ];

  summaries.forEach((summary) => {
    setKpiCard_(sheet, summary[0], summary[1].toUpperCase(), summary[2], 'Package 1 shell', UI_COLORS.NAVY);
  });
}

function renderCompletionTickerShell() {
  const sheet = getOrCreateSheet_(SHEET_NAMES.KANBAN);
  setMergedBlock_(sheet, 'A42:T42', 'Weekly Completion Ticker', {
    background: UI_COLORS.NAVY,
    fontColor: '#FFFFFF',
    fontSize: 11,
    bold: true,
    horizontalAlignment: 'left'
  });
  setMergedBlock_(sheet, 'A43:T43', 'Package 1 reserves this area for completed assigned work by owner. Live task completion dates arrive in Package 2.', {
    background: '#EEF3F7',
    fontColor: UI_COLORS.MUTED,
    fontSize: 9,
    horizontalAlignment: 'left'
  });
  sheet.getRange('A45:E45')
    .setValues([['Owner', 'Completed This Week', 'Completed This Month', 'Source', 'Notes']])
    .setBackground(UI_COLORS.KANBAN)
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBorder(true, true, true, true, true, true, UI_COLORS.KANBAN, SpreadsheetApp.BorderStyle.SOLID);
  applyAlternatingBody_(sheet, 46, 3, 5);
}

function formatKanbanDashboard_(sheet) {
  sheet.setFrozenRows(10);
  sheet.setFrozenColumns(0);
  sheet.setColumnWidths(1, 20, 92);
  sheet.setRowHeights(1, 2, 28);
  sheet.setRowHeights(4, 2, 30);
  sheet.setRowHeight(6, 24);
  sheet.setRowHeights(7, 4, 28);
  sheet.setRowHeights(12, 23, 25);
  sheet.setRowHeights(36, 5, 26);
  sheet.setRowHeights(42, 7, 25);
}
