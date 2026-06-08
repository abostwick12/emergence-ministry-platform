function clearDashboardArea_(sheet, row, column, rowCount, columnCount) {
  const range = sheet.getRange(row, column, rowCount, columnCount);
  range.breakApart();
  range.clearContent();
  range.clearFormat();
  range.clearDataValidations();
  range
    .setFontFamily('Arial')
    .setFontColor(UI_COLORS.INK)
    .setBackground(UI_COLORS.CARD_BG);
}

function setDashboardHeader_(sheet, titleRangeA1, title, titleColor, subtitleRangeA1, subtitle, noteRangeA1, note) {
  sheet.getRange(titleRangeA1).merge()
    .setValue(title)
    .setBackground(UI_COLORS.CARD_BG)
    .setFontColor(titleColor)
    .setFontWeight('bold')
    .setFontSize(24)
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle');

  sheet.getRange(subtitleRangeA1).merge()
    .setValue(subtitle)
    .setBackground(UI_COLORS.CARD_BG)
    .setFontColor(UI_COLORS.MUTED)
    .setFontSize(10)
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle');

  sheet.getRange(noteRangeA1).merge()
    .setValue(note)
    .setBackground(UI_COLORS.SOFT_BG)
    .setFontColor(UI_COLORS.NAVY)
    .setFontSize(10)
    .setFontWeight('bold')
    .setHorizontalAlignment('right')
    .setVerticalAlignment('middle')
    .setWrap(true);
}

function setDashboardKpiCard_(sheet, row, column, rowCount, columnCount, label, value, helper, accentColor) {
  const card = sheet.getRange(row, column, rowCount, columnCount);
  card
    .setBackground(UI_COLORS.CARD_BG)
    .setBorder(true, true, true, true, false, false, UI_COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  sheet.getRange(row, column, 1, columnCount).merge()
    .setValue(label)
    .setFontColor(UI_COLORS.NAVY)
    .setFontWeight('bold')
    .setFontSize(9)
    .setHorizontalAlignment('center');

  const valueRange = sheet.getRange(row + 1, column, Math.max(rowCount - 3, 1), columnCount).merge()
    .setFontColor(accentColor)
    .setFontWeight('bold')
    .setFontSize(20)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  if (typeof value === 'string' && value.charAt(0) === '=') {
    valueRange.setFormula(value);
  } else {
    valueRange.setValue(value);
  }

  sheet.getRange(row + rowCount - 2, column, 1, columnCount).merge()
    .setValue(helper)
    .setFontColor(UI_COLORS.MUTED)
    .setFontSize(9)
    .setHorizontalAlignment('center');

  sheet.getRange(row + rowCount - 1, column, 1, columnCount).merge()
    .setValue(EMERGENCE_APP.packageName)
    .setFontColor(UI_COLORS.MUTED)
    .setFontSize(8)
    .setHorizontalAlignment('center');
}
