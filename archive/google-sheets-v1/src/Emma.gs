function openEmmaSidebar() {
  const template = HtmlService.createTemplateFromFile('EmmaSidebar');
  template.status = getEmmaPlaceholderStatus();
  template.environment = getCurrentEnvironment();
  const html = template.evaluate()
    .setTitle(EMERGENCE_APP.assistantName)
    .setWidth(360);
  SpreadsheetApp.getUi().showSidebar(html);
}

function getEmmaPlaceholderStatus() {
  return {
    assistantName: EMERGENCE_APP.assistantName,
    fullName: EMERGENCE_APP.assistantFullName,
    packageName: EMERGENCE_APP.packageName,
    message: 'EMMA workflows are not enabled yet. Package 1 gives you the sidebar shell, safe setup checks, and clear coming-soon actions without connecting Gemini or sending communication.',
    quickActions: [
      'Explain current tab',
      'Review missing setup',
      'Prepare for Add Event',
      'Open Package 1 smoke test'
    ]
  };
}
