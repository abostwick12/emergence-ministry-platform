function setupEmergencePlatform() {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(30000)) {
      SpreadsheetApp.getUi().alert('Someone else is updating the platform right now. Try again in a few seconds.');
      return;
    }
    logActivity('Setup Started', 'Package 1', 'Platform', '', EMERGENCE_APP.name, '', '', 'Started', EMERGENCE_APP.packageName);
    createOrRepairTabs();
    initializeSystemSettings();
    seedDropdownValues();
    initializeNamedRanges();
    applyAllFormatting();
    setSettingValue(SETTINGS_KEYS.LAST_SETUP_AT, new Date());
    logActivity('Setup Completed', 'Package 1', 'Platform', '', EMERGENCE_APP.name, '', '', 'OK', 'Package 1 platform foundation created or repaired.');
    getActiveSpreadsheet_().setActiveSheet(getSheet_(SHEET_NAMES.EVENTS));
    SpreadsheetApp.getUi().alert('Package 1 setup is complete. The platform foundation, tabs, settings, dropdowns, Events shell, Kanban shell, and Activity Log are ready.');
  } catch (error) {
    safeLogError('Package 1', 'setupEmergencePlatform', error);
    SpreadsheetApp.getUi().alert('Package 1 setup could not finish. Check Activity Log for the plain-language error entry.');
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function resetPlatformFormatting() {
  applyAllFormatting();
  logActivity('Formatting Reset', 'Package 1', 'Platform', '', EMERGENCE_APP.name, '', '', 'OK', 'Formatting repaired without intentionally deleting table data.');
  SpreadsheetApp.getUi().alert('Platform formatting was repaired. Existing table data was not intentionally deleted.');
}

function createOrRepairTabs() {
  const spreadsheet = getActiveSpreadsheet_();
  TAB_ORDER.forEach((sheetName, index) => {
    const sheet = getOrCreateSheet_(sheetName);
    sheet.setTabColor(TAB_COLORS[sheetName]);
    spreadsheet.setActiveSheet(sheet);
    spreadsheet.moveActiveSheet(index + 1);
  });
}

function initializeSystemSettings() {
  const sheet = getOrCreateSheet_(SHEET_NAMES.SYSTEM_SETTINGS);
  sheet.clearFormats();
  sheet.setTabColor(TAB_COLORS[SHEET_NAMES.SYSTEM_SETTINGS]);
  sheet.getRange('A1:F1').merge().setValue(EMERGENCE_APP.name).setBackground(UI_COLORS.SYSTEM_SETTINGS).setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(18);
  sheet.getRange('A2:F2').merge().setValue('System Settings - configuration placeholders only. Do not store secrets here.').setBackground(UI_COLORS.SOFT_BG).setFontColor(UI_COLORS.MUTED);
  sheet.getRange(4, 1, 1, 4).setValues([['Section', 'Setting', 'Value', 'Notes']]).setBackground(UI_COLORS.SYSTEM_SETTINGS).setFontColor('#FFFFFF').setFontWeight('bold');
  const existing = getSettingsMap();
  const rows = REQUIRED_SETTINGS.map((setting) => [setting.section, setting.key, Object.prototype.hasOwnProperty.call(existing, setting.key) && existing[setting.key] !== '' ? existing[setting.key] : setting.value, setting.notes]);
  sheet.getRange(5, 1, rows.length, 4).setValues(rows);
  sheet.setFrozenRows(4);
  sheet.setColumnWidths(1, 4, 210);
  sheet.getRange(5, 3, rows.length, 1).setBackground('#FFFFFF');
  applyValidationToRange_(sheet.getRange(6, 3), NAMED_RANGES.ENVIRONMENTS);
  sheet.getRange(7, 3).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['true', 'false'], true).build());
  applyValidationToRange_(sheet.getRange(15, 3, 2, 1), NAMED_RANGES.CONFIG_STATUSES);
}

function seedDropdownValues() {
  const sheet = getOrCreateSheet_(SHEET_NAMES.SYSTEM_SETTINGS);
  const startRow = 24;
  sheet.getRange(startRow, 1, 1, 3).setValues([['Dropdown Lists', 'Named Range', 'Values']]).setBackground(UI_COLORS.NAVY).setFontColor('#FFFFFF').setFontWeight('bold');
  DROPDOWN_SOURCES.forEach((source, index) => {
    const row = startRow + 1 + index;
    sheet.getRange(row, 1, 1, 2).setValues([[source.label, source.rangeName]]);
    sheet.getRange(row, 3, 1, source.values.length).setValues([source.values]);
  });
}

function initializeNamedRanges() {
  const spreadsheet = getActiveSpreadsheet_();
  const sheet = getOrCreateSheet_(SHEET_NAMES.SYSTEM_SETTINGS);
  const existingRanges = spreadsheet.getNamedRanges();
  DROPDOWN_SOURCES.forEach((source, index) => {
    existingRanges.filter((namedRange) => namedRange.getName() === source.rangeName).forEach((namedRange) => namedRange.remove());
    spreadsheet.setNamedRange(source.rangeName, sheet.getRange(25 + index, 3, 1, source.values.length));
  });
}

function applyAllFormatting() {
  setupEventsSheet();
  setupKanbanSheet();
  setupPackageOneShellTables_();
  setupWorshipSheet_();
  ensureActivityLogStructure_();
  formatWorkbookDefaults_();
}

function runPackageOneSmokeTest() {
  const settingsMap = getSettingsMap();
  const checks = [];
  checks.push(['Required sheets exist', TAB_ORDER.every((sheetName) => Boolean(getSheet_(sheetName)))]);
  checks.push(['System Settings exists', Boolean(getSheet_(SHEET_NAMES.SYSTEM_SETTINGS))]);
  checks.push(['Activity Log exists', Boolean(getSheet_(SHEET_NAMES.ACTIVITY_LOG))]);
  checks.push(['Events tab exists', Boolean(getSheet_(SHEET_NAMES.EVENTS))]);
  checks.push(['Kanban Board tab exists', Boolean(getSheet_(SHEET_NAMES.KANBAN))]);
  checks.push(['Required settings keys exist', REQUIRED_SETTINGS.every((setting) => Object.prototype.hasOwnProperty.call(settingsMap, setting.key))]);
  checks.push(['Required dropdown named ranges exist', DROPDOWN_SOURCES.every((source) => Boolean(getActiveSpreadsheet_().getRangeByName(source.rangeName)))]);
  checks.push(['Setup function exists', typeof setupEmergencePlatform === 'function']);
  checks.push(['Kanban shell function exists', typeof renderKanbanShell === 'function']);
  const failed = checks.filter((check) => !check[1]);
  const result = failed.length ? 'Failed' : 'Passed';
  logActivity('Smoke Test', 'Package 1', 'Platform', '', EMERGENCE_APP.name, '', '', result, failed.map((check) => check[0]).join('; '));
  SpreadsheetApp.getUi().alert(failed.length ? `Package 1 smoke test found ${failed.length} issue(s): ${failed.map((check) => check[0]).join(', ')}` : 'Package 1 smoke test passed basic structure checks.');
  return { result, checks };
}

function setupPackageOneShellTables_() {
  setupSimpleShellTable_(SHEET_NAMES.DOCUMENTS, 'DOCUMENTS', 'Keep linked platform files easy to find.', PACKAGE_ONE_COLUMNS.DOCUMENTS, UI_COLORS.DOCUMENTS);
  setupSimpleShellTable_(SHEET_NAMES.BUDGET, 'BUDGET', 'Track estimates, actual spending, and approval status.', PACKAGE_ONE_COLUMNS.BUDGET, UI_COLORS.BUDGET);
  setupSimpleShellTable_(SHEET_NAMES.LEADERS, 'LEADER LIST', 'Track adult leaders and contact basics.', PACKAGE_ONE_COLUMNS.LEADERS, UI_COLORS.LEADERS);
  setupSimpleShellTable_(SHEET_NAMES.STUDENTS, 'STUDENT LIST', 'Track attendance basics without storing sensitive care details.', PACKAGE_ONE_COLUMNS.STUDENTS, UI_COLORS.STUDENTS);
  setupSimpleShellTable_(SHEET_NAMES.COMMUNICATION, 'COMMUNICATION', 'Track draft review status. Nothing sends automatically.', PACKAGE_ONE_COLUMNS.COMMUNICATION, UI_COLORS.COMMUNICATION);
  setupSimpleShellTable_(SHEET_NAMES.VOICE_PROFILES, 'VOICE PROFILES', 'Store sender and audience voice guidance for future EMMA drafts.', PACKAGE_ONE_COLUMNS.VOICE_PROFILES, UI_COLORS.VOICE_PROFILES);
  setupSimpleShellTable_(SHEET_NAMES.PROMPT_TEMPLATES, 'PROMPT TEMPLATES', 'Store reusable prompt structures and guardrails.', PACKAGE_ONE_COLUMNS.PROMPT_TEMPLATES, UI_COLORS.PROMPT_TEMPLATES);
  setupSimpleShellTable_(SHEET_NAMES.ENCOURAGEMENT_BANK, 'ENCOURAGEMENT BANK', 'Store approved encouragement lines for future daily briefs.', PACKAGE_ONE_COLUMNS.ENCOURAGEMENT_BANK, UI_COLORS.ENCOURAGEMENT_BANK);
  setupSimpleShellTable_(SHEET_NAMES.EVENT_ARCHIVE, 'EVENT ARCHIVE', 'Prepare completed, deleted, or manually archived event records.', PACKAGE_ONE_COLUMNS.EVENT_ARCHIVE, UI_COLORS.EVENT_ARCHIVE);
  setupSimpleShellTable_(SHEET_NAMES.TASK_ARCHIVE, 'TASK ARCHIVE', 'Prepare completed, deleted, or restored task records.', PACKAGE_ONE_COLUMNS.TASK_ARCHIVE, UI_COLORS.TASK_ARCHIVE);
  applyGenericValidations_();
}

function setupSimpleShellTable_(sheetName, title, subtitle, headers, accentColor) {
  const sheet = getOrCreateSheet_(sheetName);
  sheet.clearFormats();
  sheet.setTabColor(TAB_COLORS[sheetName]);
  sheet.getRange(1, 1, 1, Math.max(headers.length, 6)).merge().setValue(title).setBackground(accentColor).setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(18);
  sheet.getRange(2, 1, 1, Math.max(headers.length, 6)).merge().setValue(subtitle).setBackground(UI_COLORS.SOFT_BG).setFontColor(UI_COLORS.MUTED);
  const headerRow = TABLE_START_ROWS.GENERIC;
  sheet.getRange(headerRow, 1, 1, headers.length).setValues([headers]).setBackground(accentColor).setFontColor('#FFFFFF').setFontWeight('bold');
  sheet.setFrozenRows(headerRow);
  sheet.autoResizeColumns(1, headers.length);
}

function setupWorshipSheet_() {
  const sheet = getOrCreateSheet_(SHEET_NAMES.WORSHIP);
  sheet.clearFormats();
  sheet.setTabColor(TAB_COLORS[SHEET_NAMES.WORSHIP]);
  sheet.getRange('A1:Z1').merge().setValue('WORSHIP').setBackground(UI_COLORS.WORSHIP).setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(18);
  sheet.getRange('A2:Z2').merge().setValue('See the Core 10 library and two-month worship plan at a glance.').setBackground(UI_COLORS.SOFT_BG).setFontColor(UI_COLORS.MUTED);
  sheet.getRange(6, 1, 1, WORSHIP_LIBRARY_COLUMNS.length).merge().setValue('Core 10 Song Library').setBackground('#FCE7EF').setFontColor(UI_COLORS.WORSHIP).setFontWeight('bold');
  sheet.getRange(TABLE_START_ROWS.WORSHIP_LIBRARY, 1, 1, WORSHIP_LIBRARY_COLUMNS.length).setValues([WORSHIP_LIBRARY_COLUMNS]).setBackground(UI_COLORS.WORSHIP).setFontColor('#FFFFFF').setFontWeight('bold');
  sheet.getRange(17, 1, 1, WORSHIP_PLAN_COLUMNS.length).merge().setValue('Two-Month Worship Plan').setBackground('#FCE7EF').setFontColor(UI_COLORS.WORSHIP).setFontWeight('bold');
  sheet.getRange(TABLE_START_ROWS.WORSHIP_PLAN, 1, 1, WORSHIP_PLAN_COLUMNS.length).setValues([WORSHIP_PLAN_COLUMNS]).setBackground(UI_COLORS.WORSHIP).setFontColor('#FFFFFF').setFontWeight('bold');
  sheet.setFrozenRows(19);
  sheet.autoResizeColumns(1, Math.min(WORSHIP_PLAN_COLUMNS.length, sheet.getMaxColumns()));
}

function applyGenericValidations_() {
  applyColumnValidation_(SHEET_NAMES.BUDGET, 'Category', NAMED_RANGES.BUDGET_CATEGORIES);
  applyColumnValidation_(SHEET_NAMES.BUDGET, 'Approval Status', NAMED_RANGES.REVIEW_STATUSES);
  applyColumnValidation_(SHEET_NAMES.STUDENTS, 'Grade', NAMED_RANGES.GRADES);
  applyColumnValidation_(SHEET_NAMES.COMMUNICATION, 'Draft Status', NAMED_RANGES.COMMUNICATION_STATUSES);
  applyColumnValidation_(SHEET_NAMES.COMMUNICATION, 'Admin Review Status', NAMED_RANGES.REVIEW_STATUSES);
}

function applyColumnValidation_(sheetName, header, rangeName) {
  const sheet = getSheet_(sheetName);
  if (!sheet) return;
  const headerRow = sheetName === SHEET_NAMES.EVENTS ? TABLE_START_ROWS.EVENTS : TABLE_START_ROWS.GENERIC;
  const headers = sheet.getRange(headerRow, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  const column = headers.indexOf(header) + 1;
  if (column < 1) return;
  applyValidationToRange_(sheet.getRange(headerRow + 1, column, Math.max(sheet.getMaxRows() - headerRow, 1), 1), rangeName);
}

function applyValidationToRange_(range, rangeName) {
  const source = getActiveSpreadsheet_().getRangeByName(rangeName);
  if (!source) return;
  range.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(source, true).setAllowInvalid(false).build());
}

function formatWorkbookDefaults_() {
  TAB_ORDER.forEach((sheetName) => {
    const sheet = getSheet_(sheetName);
    if (!sheet) return;
    sheet.getDataRange().setFontFamily('Arial').setFontColor(UI_COLORS.INK);
    sheet.setHiddenGridlines(false);
  });
}
