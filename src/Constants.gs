const EMERGENCE_APP = {
  name: 'EMERGEnce Ministry Platform',
  assistantName: 'EMMA',
  assistantFullName: 'EMMA - Your Emerge Ministry Momentum Assistant',
  timezone: 'America/Chicago',
  packageName: 'Package 1: Platform Foundation',
  packageVersion: '1.0.0',
  activeSourceRoot: '/src'
};

const SHEET_NAMES = {
  EVENTS: 'Events', KANBAN: 'Kanban Board', DOCUMENTS: 'Documents', BUDGET: 'Budget',
  LEADERS: 'Leader List', STUDENTS: 'Student List', WORSHIP: 'Worship', COMMUNICATION: 'Communication',
  VOICE_PROFILES: 'Voice Profiles', PROMPT_TEMPLATES: 'Prompt Templates', SYSTEM_SETTINGS: 'System Settings',
  ENCOURAGEMENT_BANK: 'Encouragement Bank', EVENT_ARCHIVE: 'Event Archive', TASK_ARCHIVE: 'Task Archive', ACTIVITY_LOG: 'Activity Log'
};

const TAB_ORDER = [
  SHEET_NAMES.EVENTS, SHEET_NAMES.KANBAN, SHEET_NAMES.DOCUMENTS, SHEET_NAMES.BUDGET, SHEET_NAMES.LEADERS,
  SHEET_NAMES.STUDENTS, SHEET_NAMES.WORSHIP, SHEET_NAMES.COMMUNICATION, SHEET_NAMES.VOICE_PROFILES,
  SHEET_NAMES.PROMPT_TEMPLATES, SHEET_NAMES.SYSTEM_SETTINGS, SHEET_NAMES.ENCOURAGEMENT_BANK,
  SHEET_NAMES.EVENT_ARCHIVE, SHEET_NAMES.TASK_ARCHIVE, SHEET_NAMES.ACTIVITY_LOG
];

const UI_COLORS = {
  NAVY: '#07162F', INK: '#102033', MUTED: '#526170', PAGE_BG: '#F7FAFC', SOFT_BG: '#F1F7FA',
  CARD_BG: '#FFFFFF', BORDER: '#DDE7EC', EVENTS: '#E7345A', KANBAN: '#D99000', DOCUMENTS: '#2878C8',
  BUDGET: '#2E8B57', LEADERS: '#7B4FB2', STUDENTS: '#007C89', WORSHIP: '#D7265B', COMMUNICATION: '#07162F',
  VOICE_PROFILES: '#0F1E35', PROMPT_TEMPLATES: '#18213B', SYSTEM_SETTINGS: '#101827', ENCOURAGEMENT_BANK: '#34412E',
  EVENT_ARCHIVE: '#56433A', TASK_ARCHIVE: '#263447', ACTIVITY_LOG: '#1E1E24', SUCCESS: '#188038', WARNING: '#F2B84B',
  DANGER: '#D93025', GRAY: '#9AA4AF'
};

const TAB_COLORS = {
  [SHEET_NAMES.EVENTS]: UI_COLORS.EVENTS, [SHEET_NAMES.KANBAN]: UI_COLORS.KANBAN, [SHEET_NAMES.DOCUMENTS]: UI_COLORS.DOCUMENTS,
  [SHEET_NAMES.BUDGET]: UI_COLORS.BUDGET, [SHEET_NAMES.LEADERS]: UI_COLORS.LEADERS, [SHEET_NAMES.STUDENTS]: UI_COLORS.STUDENTS,
  [SHEET_NAMES.WORSHIP]: UI_COLORS.WORSHIP, [SHEET_NAMES.COMMUNICATION]: UI_COLORS.COMMUNICATION,
  [SHEET_NAMES.VOICE_PROFILES]: UI_COLORS.VOICE_PROFILES, [SHEET_NAMES.PROMPT_TEMPLATES]: UI_COLORS.PROMPT_TEMPLATES,
  [SHEET_NAMES.SYSTEM_SETTINGS]: UI_COLORS.SYSTEM_SETTINGS, [SHEET_NAMES.ENCOURAGEMENT_BANK]: UI_COLORS.ENCOURAGEMENT_BANK,
  [SHEET_NAMES.EVENT_ARCHIVE]: UI_COLORS.EVENT_ARCHIVE, [SHEET_NAMES.TASK_ARCHIVE]: UI_COLORS.TASK_ARCHIVE,
  [SHEET_NAMES.ACTIVITY_LOG]: UI_COLORS.ACTIVITY_LOG
};

const STATUS_VALUES = ['Not Started', 'In Progress', 'Working on It', 'Stuck', 'Completed'];
const HEALTH_VALUES = ['On Track', 'Caution', 'At Risk', 'Stuck', 'Complete'];
const PRIORITY_VALUES = ['Low', 'Normal', 'High'];
const ENVIRONMENT_VALUES = ['Test', 'Production'];
const CONFIG_STATUS_VALUES = ['Configured', 'Missing', 'Disabled', 'Needs attention'];
const EVENT_TYPE_VALUES = ['Weekend Service', 'Retreat', 'Camp', 'Outreach', 'Parent Event', 'Training'];
const LOCATION_VALUES = ['Community Life Church', 'Offsite', 'TBD'];
const OWNER_VALUES = ['Andrew', 'Jaci', 'Nick'];
const BUDGET_CATEGORY_VALUES = ['Events', 'Missions', 'Programs', 'Snacks', 'Transportation', 'Lodging', 'Other'];
const EXPENSE_TYPE_VALUES = ['Purchase', 'Refund', 'Credit', 'Correction'];
const REVIEW_STATUS_VALUES = ['Needs Review', 'Approved', 'Rejected', 'Reimbursed', 'Archived'];
const DOCUMENT_STATUS_VALUES = ['Draft', 'Needs Review', 'Final', 'Archived'];
const COMMUNICATION_STATUS_VALUES = ['Needs Review', 'Approved', 'Revised', 'Sent Manually', 'Rejected', 'Archived'];
const GRADE_VALUES = ['6', '7', '8', '9', '10', '11', '12'];

const NAMED_RANGES = {
  STATUSES: 'emergence_status_values', HEALTH: 'emergence_health_values', PRIORITIES: 'emergence_priority_values',
  ENVIRONMENTS: 'emergence_environment_values', CONFIG_STATUSES: 'emergence_config_status_values', EVENT_TYPES: 'emergence_event_type_values',
  LOCATIONS: 'emergence_location_values', OWNERS: 'emergence_owner_values', BUDGET_CATEGORIES: 'emergence_budget_category_values',
  EXPENSE_TYPES: 'emergence_expense_type_values', REVIEW_STATUSES: 'emergence_review_status_values', DOCUMENT_STATUSES: 'emergence_document_status_values',
  COMMUNICATION_STATUSES: 'emergence_communication_status_values', GRADES: 'emergence_grade_values'
};

const DROPDOWN_SOURCES = [
  { label: 'Status Lists', rangeName: NAMED_RANGES.STATUSES, values: STATUS_VALUES },
  { label: 'Health Values', rangeName: NAMED_RANGES.HEALTH, values: HEALTH_VALUES },
  { label: 'Priority Lists', rangeName: NAMED_RANGES.PRIORITIES, values: PRIORITY_VALUES },
  { label: 'Environment Values', rangeName: NAMED_RANGES.ENVIRONMENTS, values: ENVIRONMENT_VALUES },
  { label: 'Configuration Status Values', rangeName: NAMED_RANGES.CONFIG_STATUSES, values: CONFIG_STATUS_VALUES },
  { label: 'Ministry Event Types', rangeName: NAMED_RANGES.EVENT_TYPES, values: EVENT_TYPE_VALUES },
  { label: 'Locations', rangeName: NAMED_RANGES.LOCATIONS, values: LOCATION_VALUES },
  { label: 'Owners/Users', rangeName: NAMED_RANGES.OWNERS, values: OWNER_VALUES },
  { label: 'Budget Categories', rangeName: NAMED_RANGES.BUDGET_CATEGORIES, values: BUDGET_CATEGORY_VALUES },
  { label: 'Expense Types', rangeName: NAMED_RANGES.EXPENSE_TYPES, values: EXPENSE_TYPE_VALUES },
  { label: 'Review Status Values', rangeName: NAMED_RANGES.REVIEW_STATUSES, values: REVIEW_STATUS_VALUES },
  { label: 'Document Status Values', rangeName: NAMED_RANGES.DOCUMENT_STATUSES, values: DOCUMENT_STATUS_VALUES },
  { label: 'Communication Status Values', rangeName: NAMED_RANGES.COMMUNICATION_STATUSES, values: COMMUNICATION_STATUS_VALUES },
  { label: 'Grade Values', rangeName: NAMED_RANGES.GRADES, values: GRADE_VALUES }
];

const SETTINGS_KEYS = {
  PLATFORM_NAME: 'Platform Name', ENVIRONMENT: 'Environment', PRODUCTION_MODE: 'Production Mode', ROOT_DRIVE_FOLDER_ID: 'Root Drive Folder ID',
  EVENT_FOLDERS_ID: 'Event Folders ID', TEMPLATES_FOLDER_ID: 'Templates Folder ID', RECEIPTS_FOLDER_ID: 'Receipts Folder ID',
  SYSTEM_FILES_FOLDER_ID: 'System Files Folder ID', EMERGE_CALENDAR_ID: 'Emerge Calendar ID', PLANNING_CENTER_SOURCE: 'Planning Center Check-Ins Source',
  GEMINI_CONFIGURED: 'Gemini API Configured?', PLANNING_CENTER_CONFIGURED: 'Planning Center Configured?', ADMIN_REVIEW_EMAIL: 'Admin Review Email',
  DEFAULT_TIMEZONE: 'Default Timezone', BUILD_PACKAGE: 'Build Package', BUILD_VERSION: 'Build Version', LAST_SETUP_AT: 'Last Setup At'
};

const REQUIRED_SETTINGS = [
  { section: 'Platform Identity', key: SETTINGS_KEYS.PLATFORM_NAME, value: EMERGENCE_APP.name, notes: 'Display name used in headers.' },
  { section: 'Environment', key: SETTINGS_KEYS.ENVIRONMENT, value: 'Test', notes: 'Use Test while building.' },
  { section: 'Environment', key: SETTINGS_KEYS.PRODUCTION_MODE, value: 'false', notes: 'Keep false until production is ready.' },
  { section: 'Google Drive Mapping', key: SETTINGS_KEYS.ROOT_DRIVE_FOLDER_ID, value: '', notes: 'Folder ID only. Do not store secrets.' },
  { section: 'Google Drive Mapping', key: SETTINGS_KEYS.EVENT_FOLDERS_ID, value: '', notes: 'Folder ID only. Do not store secrets.' },
  { section: 'Google Drive Mapping', key: SETTINGS_KEYS.TEMPLATES_FOLDER_ID, value: '', notes: 'Folder ID only. Do not store secrets.' },
  { section: 'Google Drive Mapping', key: SETTINGS_KEYS.RECEIPTS_FOLDER_ID, value: '', notes: 'Folder ID only. Do not store secrets.' },
  { section: 'Google Drive Mapping', key: SETTINGS_KEYS.SYSTEM_FILES_FOLDER_ID, value: '', notes: 'Folder ID only. Do not store secrets.' },
  { section: 'Calendar Mapping', key: SETTINGS_KEYS.EMERGE_CALENDAR_ID, value: '', notes: 'Calendar ID only. Do not store secrets.' },
  { section: 'Planning Center Placeholder', key: SETTINGS_KEYS.PLANNING_CENTER_SOURCE, value: '[PLACEHOLDER: confirm Emerge Check-Ins source]', notes: 'Package 1 placeholder.' },
  { section: 'API Configuration Status', key: SETTINGS_KEYS.GEMINI_CONFIGURED, value: 'Missing', notes: 'Status only. Secret lives in Apps Script Properties.' },
  { section: 'API Configuration Status', key: SETTINGS_KEYS.PLANNING_CENTER_CONFIGURED, value: 'Missing', notes: 'Status only. Secret lives in Apps Script Properties.' },
  { section: 'API Configuration Status', key: SETTINGS_KEYS.ADMIN_REVIEW_EMAIL, value: '', notes: 'Optional routing email, not a credential.' },
  { section: 'Build Information', key: SETTINGS_KEYS.DEFAULT_TIMEZONE, value: EMERGENCE_APP.timezone, notes: 'Default timezone.' },
  { section: 'Build Information', key: SETTINGS_KEYS.BUILD_PACKAGE, value: EMERGENCE_APP.packageName, notes: 'Current installed package.' },
  { section: 'Build Information', key: SETTINGS_KEYS.BUILD_VERSION, value: EMERGENCE_APP.packageVersion, notes: 'Current package version.' },
  { section: 'Build Information', key: SETTINGS_KEYS.LAST_SETUP_AT, value: '', notes: 'Updated by setup.' }
];

const TABLE_START_ROWS = { EVENTS: 14, GENERIC: 8, WORSHIP_LIBRARY: 8, WORSHIP_PLAN: 19, ACTIVITY_LOG: 5 };

const PACKAGE_ONE_COLUMNS = {
  EVENTS: ['Event ID','Event Name','Event Type','Start Date','End Date','Start Time','Location','Status','Completion','Days Away','Budgeted','Spent','Health','Owner','Last Updated','Internal ID','Created At','Created By','Modified At','Modified By','Drive Folder ID','Calendar Event ID','Baseline Template ID','Expanded?','Archived?','Source'],
  DOCUMENTS: ['Document ID','Related Event','Related Task','Document Type','File Name','File Link','Owner','Uploaded/Linked Date','Notes'],
  BUDGET: ['Expense ID','Event','Category','Description','Estimated Amount','Actual Amount','Vendor','Date','Receipt Link','Approval Status','Notes'],
  LEADERS: ['Leader ID','First Name','Last Name','Display Name','Role','Email','Phone','Birthday','Anniversary','Active?','Notes'],
  STUDENTS: ['Student Name','Grade','Planning Center ID','Active?','Last Attendance Date','Attendance Count'],
  COMMUNICATION: ['Communication ID','Related Event','Platform','Intended Sender','Intended Audience','Draft Status','Admin Review Status','Voice Context Used','Draft Link','Recommended Send Time','Sent Status','Notes'],
  VOICE_PROFILES: ['Voice Profile ID','Sender / Profile Name','Communication Type','Audience','Context Source','Notes','Active?'],
  PROMPT_TEMPLATES: ['Template ID','Workflow Name','Purpose','Use When','Required Inputs','Output Format','Guardrails','Active?'],
  ENCOURAGEMENT_BANK: ['Encouragement ID','Audience','Message','Used Count','Last Used','Active?'],
  EVENT_ARCHIVE: ['Event ID','Event Name','Event Type','Start Date','End Date','Start Time','Location','Status','Completion','Days Away','Budgeted','Spent','Health','Owner','Last Updated','Archive Status','Archived At','Archived By','Archive Notes'],
  TASK_ARCHIVE: ['Task ID','Parent Event ID','Task Name','Due Date','Owner','Status','Priority','Critical?','Archive Type','Completed/Deleted By','Completed/Deleted Date','Restored By','Restored Date'],
  ACTIVITY_LOG: ['Timestamp','User','Action','Area','Record Type','Record ID','Record Name','Before','After','Result','Notes']
};

const WORSHIP_LIBRARY_COLUMNS = ['Song Title','Artist/Version','Default Key','Track Link','Chord/Chart Link','Notes'];
const WORSHIP_PLAN_COLUMNS = ['Service Date','Related Event / Service Name','Rehearsal Date/Time','Song 1','Song 1 Key','Song 1 Lead','Song 2','Song 2 Key','Song 2 Lead','Song 3','Song 3 Key','Song 3 Lead','Optional Song 4','Song 4 Key','Song 4 Lead','Lead Vocal','Background Vocals','Acoustic','Electric','Bass','Keys','Drums','Tracks','Production / Slides','Notes'];

const ERROR_CODES = {
  DRIVE_FOLDER_MISSING: 'DRIVE_FOLDER_MISSING', CALENDAR_ID_MISSING: 'CALENDAR_ID_MISSING', GEMINI_NOT_CONFIGURED: 'GEMINI_NOT_CONFIGURED',
  PLANNING_CENTER_NOT_CONFIGURED: 'PLANNING_CENTER_NOT_CONFIGURED', EVENT_NOT_FOUND: 'EVENT_NOT_FOUND', TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  SETUP_FAILED: 'SETUP_FAILED', LOCK_TIMEOUT: 'LOCK_TIMEOUT', UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};
