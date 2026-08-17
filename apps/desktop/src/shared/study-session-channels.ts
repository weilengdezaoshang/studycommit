export const studySessionIpcChannels = {
  create: 'study-sessions:create',
  getActive: 'study-sessions:get-active',
  getById: 'study-sessions:get-by-id',
  pause: 'study-sessions:pause',
  resume: 'study-sessions:resume',
  complete: 'study-sessions:complete',
} as const
