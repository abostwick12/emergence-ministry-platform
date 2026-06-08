function logActivity(action, area, recordType, recordId, recordName, beforeValue, afterValue, result, notes) {
  const sheet = getOrCreateSheet_(SHEET_NAMES.ACTIVITY_LOG);
  ensureActivityLogStructure_();
  sheet.appendRow([
    new Date(),
    getCurrentUserEmailSafe(),
    sanitizeForLog_(action),
    sanitizeForLog_(area),
    sanitizeForLog_(recordType),
    sanitizeForLog_(recordId),
    sanitizeForLog_(recordName),
    sanitizeForLog_(beforeValue),
    sanitizeForLog_(afterValue),
    sanitizeForLog_(result || 'OK'),
    sanitizeForLog_(notes)
  ]);
}

function safeLogError(area, functionName, error) {
  const message = error && error.message ? error.message : String(error || 'Unknown error');
  try {
    logActivity(
      'Error',
      area,
      'Function',
      functionName,
      functionName,
      '',
      '',
      'Error',
      `${ERROR_CODES.UNKNOWN_ERROR}: ${message}`
    );
  } catch (loggingError) {
    console.error(`Unable to log error from ${functionName}: ${message}`);
  }
}

function ensureActivityLogStructure_() {
  const sheet = getOrCreateSheet_(SHEET_NAMES.ACTIVITY_LOG);
  const headerRow = TABLE_START_ROWS.ACTIVITY_LOG;
  sheet.getRange(headerRow, 1, 1, PACKAGE_ONE_COLUMNS.ACTIVITY_LOG.length)
    .setValues([PACKAGE_ONE_COLUMNS.ACTIVITY_LOG])
    .setBackground(UI_COLORS.ACTIVITY_LOG)
    .setFontColor('#FFFFFF')
    .setFontWeight('bold');
  sheet.setFrozenRows(headerRow);
  sheet.setTabColor(TAB_COLORS[SHEET_NAMES.ACTIVITY_LOG]);
}
