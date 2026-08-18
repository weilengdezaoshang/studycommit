import { APP_STACK_HOMES, APP_TAB_MODULES } from './app-modules'

describe('app navigation modules', () => {
  it('registers every primary tab once and keeps stack homes aligned', () => {
    expect(APP_TAB_MODULES.map((module) => module.name)).toEqual([
      'TodayTab',
      'TopicsTab',
      'RecordsTab',
      'ReviewTab',
    ])
    expect(Object.keys(APP_STACK_HOMES)).toEqual(APP_TAB_MODULES.map((module) => module.name))
  })
})
