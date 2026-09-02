import { describe, expect, it } from 'vitest'
import { routes } from './routes'

describe('routes', () => {
  it('generates top-level paths', () => {
    expect(routes.today()).toBe('/today')
    expect(routes.desk()).toBe('/desk')
    expect(routes.settings()).toBe('/settings')
    expect(routes.problems()).toBe('/problems')
    expect(routes.inbox()).toBe('/inbox')
    expect(routes.timeline()).toBe('/timeline')
  })

  it('generates box records paths and safely encodes ids', () => {
    expect(routes.boxRecords('Electron 基础')).toBe('/boxes/Electron%20%E5%9F%BA%E7%A1%80')
    expect(routes.boxRecords('topic-mobile')).toBe('/boxes/topic-mobile')
    expect(routes.dateRecords('2026-08-25')).toBe('/records/2026-08-25')
  })
})
