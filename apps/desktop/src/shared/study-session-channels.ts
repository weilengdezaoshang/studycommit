export const studySessionIpcChannels = {
  create: 'study-sessions:create',
  getActive: 'study-sessions:get-active',
  getById: 'study-sessions:get-by-id',
  pause: 'study-sessions:pause',
  resume: 'study-sessions:resume',
  complete: 'study-sessions:complete',
  completePaper: 'study-sessions:complete-paper',
  createFragment: 'study-sessions:create-fragment',
  listFragments: 'study-sessions:list-fragments',
  updateFragment: 'study-sessions:update-fragment',
  pendingFragmentCount: 'study-sessions:pending-fragment-count',
} as const
