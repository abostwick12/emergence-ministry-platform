function getActiveSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet_(sheetName) {
  return getActiveSpreadsheet_().getSheetByName(sheetName);
}

function getOrCreateSheet_(sheetName) {
  const spreadsheet = getActiveSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  return sheet;
}

function getSettingsMap() {
  const sheet = getSheet_(SHEET_NAMES.SYSTEM_SETTINGS);
  if (!sheet) return {};
  const lastRow = Math.max(sheet.getLastRow(), 1);
  if (lastRow < 5) return {};
  const values = sheet.getRange(5, 1, lastRow - 4, 4).getValues();
  return values.reduce((settings, row) => {
    const key = row[1];
    if (key) settings[key] = row[2];
    return settings;
  }, {});
}

function getSettingValue(key, fallbackValue) {
  const settings = getSettingsMap();
  return Object.prototype.hasOwnProperty.call(settings, key) ? settings[key] : fallbackValue;
}

function setSettingValue(key, value) {
  const sheet = getSheet_(SHEET_NAMES.SYSTEM_SETTINGS);
  if (!sheet) return false;
  const lastRow = sheet.getLastRow();
  if (lastRow < 5) return false;
  const keys = sheet.getRange(5, 2, lastRow - 4, 1).getValues().flat();
  const rowIndex = keys.indexOf(key);
  if (rowIndex === -1) return false;
  sheet.getRange(rowIndex + 5, 3).setValue(assertNoSecretInUi(value));
  return true;
}

function getCurrentEnvironment() {
  return getSettingValue(SETTINGS_KEYS.ENVIRONMENT, 'Test');
}

function getConfiguredStatus(propertyKey) {
  return isSecretConfigured(propertyKey) ? 'Configured' : 'Missing';
}

function getNamedRangeValues_(rangeName) {
  const range = getActiveSpreadsheet_().getRangeByName(rangeName);
  if (!range) return [];
  return range.getValues().flat().filter(String);
}
