function resetDashboardRange_(sheet, rowCount, columnCount) {
  const filter = sheet.getFilter();
  if (filter) {
    filter.remove();
  }

  sheet.showRows(1, Math.min(sheet.getMaxRows(), rowCount));
  sheet.showColumns(1, Math.min(sheet.getMaxColumns(), columnCount));
  sheet.setFrozenRows(0);
  sheet.setFrozenColumns(0);
  sheet.setHiddenGridlines(false);

  const range = sheet.getRange(1, 1, rowCount, columnCount);
  range.breakApart();
  range.clearContent();
  range.clearFormat();
  range.clearDataValidations();
  range
    .setFontFamily('Arial')
    .setFontColor(UI_COLORS.INK)
    .setFontSize(10)
    .setBackground('#FFFFFF')
    .setWrap(true)
    .setVerticalAlignment('middle');
}

function setMergedBlock_(sheet, a1, value, options) {
  const range = sheet.getRange(a1);
  range.merge();
  range.setValue(value);
  applyBlockStyle_(range, options || {});
  return range;
}

function applyBlockStyle_(range, options) {
  if (options.background) range.setBackground(options.background);
  if (options.fontColor) range.setFontColor(options.fontColor);
  if (options.fontSize) range.setFontSize(options.fontSize);
  if (options.bold !== undefined) range.setFontWeight(options.bold ? 'bold' : 'normal');
  if (options.horizontalAlignment) range.setHorizontalAlignment(options.horizontalAlignment);
  if (options.verticalAlignment) range.setVerticalAlignment(options.verticalAlignment);
  if (options.wrap !== undefined) range.setWrap(options.wrap);
  if (options.borderColor) {
    range.setBorder(true, true, true, true, false, false, options.borderColor, SpreadsheetApp.BorderStyle.SOLID);
  }
}

function setPlaceholderControl_(sheet, a1, label) {
  setMergedBlock_(sheet, a1, label + '\nPlaceholder', {
    background: '#FFFFFF',
    fontColor: UI_COLORS.NAVY,
    fontSize: 9,
    bold: false,
    horizontalAlignment: 'center',
    verticalAlignment: 'middle',
    borderColor: '#CBD8E6'
  });
}

function setKpiCard_(sheet, a1, label, value, helper, accentColor) {
  const range = sheet.getRange(a1);
  range.merge();
  range
    .setBackground('#FFFFFF')
    .setBorder(true, true, true, true, false, false, '#CBD8E6', SpreadsheetApp.BorderStyle.SOLID)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  const text = label + '\n' + value + '\n' + helper;
  const richText = SpreadsheetApp.newRichTextValue()
    .setText(text)
    .setTextStyle(0, label.length, SpreadsheetApp.newTextStyle()
      .setFontSize(9)
      .setBold(true)
      .setForegroundColor(UI_COLORS.NAVY)
      .build())
    .setTextStyle(label.length + 1, label.length + 1 + String(value).length, SpreadsheetApp.newTextStyle()
      .setFontSize(20)
      .setBold(true)
      .setForegroundColor(accentColor)
      .build())
    .setTextStyle(label.length + 2 + String(value).length, text.length, SpreadsheetApp.newTextStyle()
      .setFontSize(9)
      .setForegroundColor(UI_COLORS.MUTED)
      .build())
    .build();

  range.setRichTextValue(richText);
}

function setTableHeader_(sheet, row, headers, fillColor) {
  sheet.getRange(row, 1, 1, headers.length)
    .setValues([headers])
    .setBackground(fillColor)
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setFontSize(9)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true)
    .setBorder(true, true, true, true, true, true, fillColor, SpreadsheetApp.BorderStyle.SOLID);
}

function applyAlternatingBody_(sheet, startRow, rowCount, columnCount) {
  for (let i = 0; i < rowCount; i++) {
    const fill = i % 2 === 0 ? '#FFFFFF' : '#F6F9FC';
    sheet.getRange(startRow + i, 1, 1, columnCount)
      .setBackground(fill)
      .setBorder(true, true, true, true, true, true, '#E2E8F0', SpreadsheetApp.BorderStyle.SOLID);
  }
}
