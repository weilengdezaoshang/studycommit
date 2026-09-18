import { describe, expect, it } from 'vitest'
import {
  canCompensateClaim,
  canManageCampaignDraft,
  canManageRoles,
  canPublishCampaign,
  canPublishPrice,
  canManageProviderConfig,
  canUpdateServiceSwitch,
} from './capabilities'

describe('管理权限能力', () => {
  it('viewer 只能读，不能改草稿或发布', () => {
    expect(canManageCampaignDraft('viewer')).toBe(false)
    expect(canPublishCampaign('viewer')).toBe(false)
    expect(canCompensateClaim('viewer')).toBe(false)
    expect(canPublishPrice('viewer')).toBe(false)
    expect(canUpdateServiceSwitch('viewer')).toBe(false)
    expect(canManageProviderConfig('viewer')).toBe(false)
    expect(canManageRoles('viewer')).toBe(false)
  })

  it('operator 可改草稿但不能发布、补偿或改开关', () => {
    expect(canManageCampaignDraft('operator')).toBe(true)
    expect(canPublishCampaign('operator')).toBe(false)
    expect(canCompensateClaim('operator')).toBe(false)
    expect(canManageRoles('operator')).toBe(false)
  })

  it('publisher 可发布活动与价格、补偿，但不能改服务开关或授权', () => {
    expect(canPublishCampaign('publisher')).toBe(true)
    expect(canCompensateClaim('publisher')).toBe(true)
    expect(canPublishPrice('publisher')).toBe(true)
    expect(canUpdateServiceSwitch('publisher')).toBe(false)
    expect(canManageRoles('publisher')).toBe(false)
  })

  it('角色页仅 super_admin 可进入', () => {
    expect(canManageRoles('super_admin')).toBe(true)
    expect(canUpdateServiceSwitch('super_admin')).toBe(true)
    expect(canManageProviderConfig('super_admin')).toBe(true)
    expect(canManageProviderConfig('publisher')).toBe(false)
    expect(canManageRoles('publisher')).toBe(false)
  })
})
