export const MONITOR_EVENTS = {
  APP_LAUNCH: 'app_launch',
  APP_ERROR: 'app_error',
  UNHANDLED_REJECTION: 'unhandled_rejection',
  PAGE_NOT_FOUND: 'page_not_found',
  HOME_OPEN_NOTE_EDITOR: 'home_open_note_editor',
  NOTE_EDITOR_OPEN: 'note_editor_open',
  NOTE_QUESTION_TOGGLE: 'note_question_toggle',
  NOTE_SAVE_CLICK: 'note_save_click',
  NOTE_SAVE_SUCCESS: 'note_save_success',
  NOTE_SAVE_FAILED: 'note_save_failed',
} as const

export type MonitorEventName = (typeof MONITOR_EVENTS)[keyof typeof MONITOR_EVENTS]
