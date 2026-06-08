function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('EMMA')
    .addItem('Open Platform App', 'showPlatformApp')
    .addItem('Install / Repair Data Tables', 'installDataModel')
    .addSeparator()
    .addItem('Add New Event', 'showAddEventDialog')
    .addItem('Ask EMMA', 'showEmmaSidebar')
    .addToUi();
}

function doGet() {
  return renderApp_();
}

function showPlatformApp() {
  SpreadsheetApp.getUi().showModelessDialog(
    renderApp_().setWidth(1280).setHeight(820),
    'EMERGEnce Ministry Platform'
  );
}

function showAddEventDialog() {
  const template = HtmlService.createTemplateFromFile('AddEventDialog');
  template.eventTypes = APP_CONFIG.eventTypes;
  template.owners = APP_CONFIG.owners;
  SpreadsheetApp.getUi().showModalDialog(template.evaluate().setWidth(520).setHeight(620), 'Add New Event');
}

function showEmmaSidebar() {
  const template = HtmlService.createTemplateFromFile('EmmaSidebar');
  template.context = getPlatformSnapshot();
  SpreadsheetApp.getUi().showSidebar(template.evaluate().setTitle('EMMA'));
}

function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function renderApp_() {
  installDataModel();
  const template = HtmlService.createTemplateFromFile('Index');
  template.config = APP_CONFIG;
  return template.evaluate()
    .setTitle('EMERGEnce Ministry Platform')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
