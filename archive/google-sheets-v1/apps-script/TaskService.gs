function getTasks() {
  installDataModel();
  return tableRows_(APP_CONFIG.sheets.tasks).map(taskView_);
}

function createTask(form) {
  installDataModel();
  const task = {
    'Task ID': uuid_('T'),
    'Task Name': form.taskName || 'Untitled Task',
    'Event ID': form.eventId || '',
    'Event Name': form.eventName || '',
    'Due Date': form.dueDate ? new Date(form.dueDate) : today_(),
    Type: form.type || 'Event',
    Owner: form.owner || 'J',
    Status: form.status || 'Not Started',
    Completion: Number(form.completion || 0),
    Health: form.health || 'Neutral',
    Priority: form.priority || 'Medium',
    Notes: form.notes || '',
    'Last Updated': new Date()
  };
  appendRow_(APP_CONFIG.sheets.tasks, task);
  logActivity('Create Task', task['Task ID'], `Created task: ${task['Task Name']}`);
  return taskView_(task);
}

function updateTaskStatus(taskId, status) {
  const completion = status === 'Complete' ? 1 : status === 'In Review' ? 0.75 : status === 'In Progress' ? 0.45 : status === 'Waiting / Blocked' ? 0.2 : 0;
  const health = status === 'Waiting / Blocked' ? 'At Risk' : status === 'Complete' ? 'On Track' : 'Caution';
  updateRow_(APP_CONFIG.sheets.tasks, 'Task ID', taskId, {
    Status: status,
    Completion: completion,
    Health: health,
    'Last Updated': new Date()
  });
  logActivity('Update Task Status', taskId, `Task moved to ${status}`);
  return getTasks();
}

function getKanbanState() {
  const tasks = getTasks();
  const columns = APP_CONFIG.taskStatuses.map(status => ({
    status,
    tasks: tasks.filter(task => task.status === status)
  }));
  const avgCompletion = tasks.length ? Math.round(tasks.reduce((sum, task) => sum + task.completion, 0) / tasks.length * 100) : 0;
  return {
    columns,
    metrics: {
      totalTasks: tasks.length,
      inProgress: tasks.filter(task => task.status === 'In Progress').length,
      overdue: tasks.filter(task => task.health === 'At Risk').length,
      complete: tasks.filter(task => task.status === 'Complete').length,
      avgCompletion
    }
  };
}

function createBaselineTasks_(eventId, eventName, dueDate, owner, type) {
  [
    ['Build Communication Plan', 'High'],
    ['Confirm Volunteer Needs', 'High'],
    ['Attach Files and Forms', 'Medium'],
    ['Prepare Follow-Up Plan', 'Medium']
  ].forEach(item => createTask({
    taskName: item[0],
    eventId,
    eventName,
    dueDate,
    type,
    owner: owner ? owner.slice(0, 1) : 'J',
    priority: item[1],
    status: 'Not Started'
  }));
}

function taskView_(row) {
  return {
    id: row['Task ID'],
    name: row['Task Name'],
    eventId: row['Event ID'],
    eventName: row['Event Name'],
    dueDate: dateText_(row['Due Date']),
    type: row.Type,
    owner: row.Owner,
    status: row.Status,
    completion: Number(row.Completion || 0),
    health: row.Health,
    priority: row.Priority,
    notes: row.Notes,
    lastUpdated: dateText_(row['Last Updated'])
  };
}
