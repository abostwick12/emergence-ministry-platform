function getInitialState() {
  installDataModel();
  return {
    config: APP_CONFIG,
    dashboard: getDashboardState(),
    kanban: getKanbanState(),
    communications: getCommunications()
  };
}

function refreshAppState() {
  return getInitialState();
}
