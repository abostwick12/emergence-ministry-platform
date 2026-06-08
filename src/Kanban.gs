function setupKanbanSheet() {
  const sheet = getOrCreateSheet_(SHEET_NAMES.KANBAN);
  renderKanbanShell();
}

function applyKanbanFormatting() {
  renderKanbanShell();
}

function refreshKanbanBoard() {
  renderKanbanShell();
  logActivity('Kanban Refreshed', SHEET_NAMES.KANBAN, 'Sheet', '', SHEET_NAMES.KANBAN, '', '', 'OK', 'Package 1 Kanban visual shell refreshed.');
  SpreadsheetApp.getUi().alert('Kanban Board shell refreshed. Live card automation comes in a later build.');
}

function renderKanbanShell() {
  const sheet = getOrCreateSheet_(SHEET_NAMES.KANBAN);
  sheet.clearFormats();
  sheet.setTabColor(TAB_COLORS[SHEET_NAMES.KANBAN]);
  buildKanbanHeader_(sheet);
  buildKanbanKpis_(sheet);
  buildKanbanLanes_(sheet);
  renderCompletionTickerShell();
  sheet.setFrozenRows(10);
  sheet.setColumnWidths(1, 15, 115);
}

function renderCompletionTickerShell() {
  const sheet = getOrCreateSheet_(SHEET_NAMES.KANBAN);
  const startRow = 34;
  sheet.getRange(startRow, 1, 1, 15).merge().setValue('Weekly Completion Ticker').setBackground(UI_COLORS.NAVY).setFontColor('#FFFFFF').setFontWeight('bold');
  sheet.getRange(startRow + 1, 1, 1, 15).merge().setValue('Package 1 reserves this area for completed assigned work by owner. Live task completion dates arrive in Package 2.').setBackground(UI_COLORS.SOFT_BG).setFontColor(UI_COLORS.MUTED);
  sheet.getRange(startRow + 3, 1, 1, 5).setValues([['Owner', 'Completed This Week', 'Completed This Month', 'Source', 'Notes']]).setBackground(UI_COLORS.KANBAN).setFontColor('#FFFFFF').setFontWeight('bold');
}

function buildKanbanHeader_(sheet) {
  sheet.getRange('A1:O1').merge().setValue(EMERGENCE_APP.name).setBackground(UI_COLORS.NAVY).setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(20);
  sheet.getRange('A2:O2').merge().setValue(`Environment: ${getCurrentEnvironment()} | ${EMERGENCE_APP.packageName}`).setBackground(UI_COLORS.SOFT_BG).setFontColor(UI_COLORS.MUTED);
  sheet.getRange('A4:C5').merge().setValue('KANBAN BOARD').setBackground('#FFFFFF').setFontColor(UI_COLORS.KANBAN).setFontWeight('bold').setFontSize(24).setVerticalAlignment('middle');
  sheet.getRange('D4:G5').merge().setValue('Visualize the work. Move the mission forward.').setBackground('#FFFFFF').setFontColor(UI_COLORS.MUTED).setVerticalAlignment('middle');
  const controls = [['Filter: All Events','Display label'],['Group by: Status','Display lane mapping'],['Refresh','Menu action'],['Ask EMMA','Menu action']];
  controls.forEach((control, index) => {
    const column = 8 + (index * 2);
    sheet.getRange(4, column, 2, 2).merge().setValue(`${control[0]}\n${control[1]}`).setBackground(index === 3 ? UI_COLORS.STUDENTS : '#FFFFFF').setFontColor(index === 3 ? '#FFFFFF' : UI_COLORS.NAVY).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setBorder(true, true, true, true, true, true, UI_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });
}

function buildKanbanKpis_(sheet) {
  const kpis = [
    ['Total Tasks', '0', 'Task logic arrives in Package 2'],
    ['In Progress', '=COUNTIF(Events!H15:H,"In Progress")+COUNTIF(Events!H15:H,"Working on It")', 'Active work'],
    ['Overdue', '0', 'Needs task due dates'],
    ['Complete', '=COUNTIF(Events!H15:H,"Completed")', 'Completed events'],
    ['Avg. Completion', '=IFERROR(AVERAGE(FILTER(Events!I15:I,Events!B15:B<>"")),0)', 'From Events table']
  ];
  kpis.forEach((kpi, index) => {
    const column = 1 + (index * 3);
    sheet.getRange(7, column, 3, 2).setBackground('#FFFFFF').setBorder(true, true, true, true, true, true, UI_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(7, column, 1, 2).merge().setValue(kpi[0]).setFontWeight('bold').setFontColor(UI_COLORS.NAVY).setHorizontalAlignment('center');
    sheet.getRange(8, column, 1, 2).merge().setFormula(kpi[1]).setFontWeight('bold').setFontSize(18).setFontColor(UI_COLORS.KANBAN).setHorizontalAlignment('center');
    sheet.getRange(9, column, 1, 2).merge().setValue(kpi[2]).setFontSize(9).setFontColor(UI_COLORS.MUTED).setHorizontalAlignment('center');
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
    sheet.getRange(12, column, 1, 2).merge().setValue(lane.label).setBackground(lane.color).setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.getRange(13, column, 17, 2).setBackground('#FFFFFF').setBorder(true, true, true, true, true, true, UI_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(14, column, 3, 2).merge().setValue('Card area reserved\nLive cards arrive in Package 2').setFontColor(UI_COLORS.MUTED).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground(UI_COLORS.SOFT_BG);
    sheet.getRange(18, column).setValue('Health circle').setFontColor(UI_COLORS.MUTED).setFontSize(9);
    sheet.getRange(18, column + 1).setValue('○').setFontSize(18).setFontColor(UI_COLORS.GRAY).setHorizontalAlignment('center');
  });
  const summaryRow = 31;
  ['Overall Completion','Due This Week','Overdue Tasks','Critical Tasks On Track','Events in Progress'].forEach((summary, index) => {
    const column = 1 + (index * 3);
    sheet.getRange(summaryRow, column, 2, 2).setBackground('#FFFFFF').setBorder(true, true, true, true, true, true, UI_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(summaryRow, column, 1, 2).merge().setValue(summary).setFontWeight('bold').setFontColor(UI_COLORS.NAVY).setHorizontalAlignment('center');
    sheet.getRange(summaryRow + 1, column, 1, 2).merge().setValue('Formula-ready').setFontColor(UI_COLORS.MUTED).setHorizontalAlignment('center');
  });
}
