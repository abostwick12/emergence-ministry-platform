function getPlatformSnapshot() {
  const state = getDashboardState();
  return {
    activeEvents: state.metrics.activeEvents,
    overdueTasks: state.metrics.attentionTasks,
    avgCompletion: state.metrics.avgCompletion,
    draftsInReview: state.metrics.draftsInReview
  };
}

function askEmma(promptText) {
  const snapshot = getPlatformSnapshot();
  const prompt = promptText || 'What should I focus on next?';
  return [
    'EMMA ministry operations snapshot',
    '',
    `Active events: ${snapshot.activeEvents}`,
    `Average completion: ${snapshot.avgCompletion}%`,
    `Attention tasks: ${snapshot.overdueTasks}`,
    `Drafts needing review: ${snapshot.draftsInReview}`,
    '',
    `Prompt: ${prompt}`,
    '',
    'Recommended next move: focus on blocked event tasks, then generate/update any parent-facing communication drafts for review.'
  ].join('\n');
}
