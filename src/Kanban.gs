function setupKanbanSheet() {
  renderKanbanShell();
}

function applyKanbanFormatting() {
  renderKanbanShell();
}

function refreshKanbanBoard() {
  renderKanbanShell();
  logActivity('Kanban Refreshed', SHEET_NAMES.KANBAN, 'Sheet', '', SHEET_NAMES.KANBAN, '', '', 'OK', 'Package 1 Kanban visual shell refreshed without grid sidebar navigation.');
  SpreadsheetApp.getUi().alert('Kanban Board shell refreshed. Live card automation comes in a later build.');
}

function renderKanbanShell() {
  const sheet = getOrCreateSheet_(SHEET_NAMES.KANBAN);
  clearDashboardArea_(sheet, 1, 1, 44, 15);
  sheet.setTabColor(TAB_COLORS[SHEET_NAMES.KANBAN]);
  buildKanbanHeader_(sheet);
  buildKanbanKpis_(sheet);
  buildKanbanLanes_(sheet);
  buildKanbanBottomSummary_(sheet);
  renderCompletionTickerShell();
  sheet.setFrozenRows(11);
  sheet.setColumnWidths(1, 15, 115);
  sheet.setRowHeights(1, 2, 30);
  sheet.setRowHeights(4, 3, 28);
  sheet.setRowHeights(8, 4, 32);
  sheet.setRowHeights(13, 20, 28);
  sheet.setHiddenGridlines(true);
}

function buildKanbanHeader_(sheet) {
  sheet.getRange('A1:O1').merge().setValue(EMERGENCE_APP.name)
    .setBackground(UI_COLORS.NAVY)
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setFontSize(20);
  sheet.getRange('A2:O2').merge().setValue(`Environment: ${getCurrentEnvironment()} | ${EMERGENCE_APP.packageName}`)
    .setBackground(UI_COLORS.SOFT_BG)
    .setFontColor(UI_COLORS.MUTED);
  setDashboardHeader_(
    sheet,
    'A4:C6',
    'KANBAN BOARD',
    UI_COLORS.KANBAN,
    'D4:G6',
    'Visualize the work. Move the mission forward.',
    'H4:O6',
    'Use the EMERGEnce menu for navigation, setup, smoke tests, and EMMA.'
  );
}

function buildKanbanKpis_(sheet) {
  const kpis = [
    ['Total Tasks', '0', 'Task logic arrives in Package 2', UI_COLORS.NAVY],
    ['In Progress', '=COUNTIF(Events!H15:H,"In Progress")+COUNTIF(Events!H15:H,"Working on It")', 'Active work', UI_COLORS.KANBAN],
    ['Overdue', '0', 'Needs task due dates', UI_COLORS.DANGER],
    ['Complete', '=COUNTIF(Events!H15:H,"Completed")', 'Completed events', UI_COLORS.SUCCESS],
    ['Avg. Completion', '=IFERROR(AVERAGE(FILTER(Events!I15:I,Events!B15:B<>"")),0)', 'From Events table', UI_COLORS.NAVY]
  ];
  kpis.forEach((kpi, index) => {
    const column = 1 + (index * 3);
    setDashboardKpiCard_(sheet, 8, column, 4, 2, kpi[0], kpi[1], kpi[2], kpi[3]);
  });
}

function buildKanbanLanes_(sheet) {
  const lanes = [
    { label: 'Not Started', color: UI_COLORS.GRAY },
    { label: 'In Progress', color: UI_COLORS.KANBAN },
    { label: 'Waiting / Stuck', color: UI_COLORS.DANGER },
    { label: 'In Review', color: UI_COLORS.LEADERS },
    { label: 'Complete', color: UI_COLORS.SUCCESS }
  ];
  lanes.forEach((lane, index) => {
    const column = 1 + (index * 3);
    sheet.getRange(13, column, 1, 2).merge().setValue(lane.label)
      .setBackground(lane.color)
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    sheet.getRange(14, column, 19, 2)
      .setBackground('#FFFFFF')
      .setBorder(true, true, true, true, true, true, UI_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(15, column, 4, 2).merge()
      .setValue('Card area reserved\nLive cards arrive in Package 2')
      .setFontColor(UI_COLORS.MUTED)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setBackground(UI_COLORS.SOFT_BG);
    sheet.getRange(20, column).setValue('Health circle').setFontColor(UI_COLORS.MUTED).setFontSize(9);
    sheet.getRange(20, column + 1).setValue('O').setFontSize(18).setFontColor(UI_COLORS.GRAY).setHorizontalAlignment('center');
  });
}

function buildKanbanBottomSummary_(sheet) {
  const summaries = ['Overall Completion', 'Due This Week', 'Overdue Tasks', 'Critical Tasks On Track', 'Events in Progress'];
  summaries.forEach((summary, index) => {
    const column = 1 + (index * 3);
    sheet.getRange(34, column, 5, 2)
      .setBackground('#FFFFFF')
      .setBorder(true, true, true, true, true, true, UI_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(34, column, 1, 2).merge().setValue(summary).setFontWeight('bold').setFontColor(UI_COLORS.NAVY).setHorizontalAlignment('center');
    sheet.getRange(35, column, 3, 2).merge().setValue('Formula-ready').setFontColor(UI_COLORS.MUTED).setHorizontalAlignment('center').setVerticalAlignment('middle');
    sheet.getRange(38, column, 1, 2).merge().setValue('Package 1 foundation').setFontColor(UI_COLORS.MUTED).setFontSize(8).setHorizontalAlignment('center');
  });
}

function renderCompletionTickerShell() {
  const sheet = getOrCreateSheet_(SHEET_NAMES.KANBAN);
  sheet.getRange(40, 1, 1, 15).merge().setValue('Weekly Completion Ticker')
    .setBackground(UI_COLORS.NAVY)
    .setFontColor('#FFFFFF')
    .setFontWeight('bold');
  sheet.getRange(41, 1, 1, 15).merge()
    .setValue('Package 1 reserves this area for completed assigned work by owner. Live task completion dates arrive in Package 2.')
    .setBackground(UI_COLORS.SOFT_BG)
    .setFontColor(UI_COLORS.MUTED);
  sheet.getRange(43, 1, 1, 5).setValues([['Owner', 'Completed This Week', 'Completed This Month', 'Source', 'Notes']])
    .setBackground(UI_COLORS.KANBAN)
    .setFontColor('#FFFFFF')
    .setFontWeight('bold');
}
