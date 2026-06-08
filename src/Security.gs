function getScriptPropertySafe(key) {
  if (!key) return '';
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

function isSecretConfigured(key) {
  return Boolean(getScriptPropertySafe(key));
}

function assertNoSecretInUi(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  const riskyPatterns = [
    /AIza[0-9A-Za-z\-_]{20,}/,
    /ya29\.[0-9A-Za-z\-_]+/,
    /xox[baprs]-[0-9A-Za-z-]+/,
    /sk-[0-9A-Za-z\-_]{20,}/,
    /-----BEGIN [A-Z ]+PRIVATE KEY-----/
  ];
  return riskyPatterns.some((pattern) => pattern.test(text)) ? '[SECRET REDACTED]' : text;
}

function getCurrentUserEmailSafe() {
  try {
    return Session.getActiveUser().getEmail() || 'Unknown user';
  } catch (error) {
    return 'Unknown user';
  }
}

function sanitizeForLog_(value) {
  const text = assertNoSecretInUi(value);
  return text.length > 500 ? `${text.slice(0, 497)}...` : text;
}
