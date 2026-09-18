export const ADMIN_ROLES = ['viewer', 'operator', 'publisher', 'super_admin'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

/** 与后端 ADMIN_ROLE_LEVEL 对齐,仅用于按钮/路由裁剪,不能替代守卫. */
export const ADMIN_ROLE_LEVEL: Record<AdminRole, number> = {
  viewer: 1,
  operator: 2,
  publisher: 3,
  super_admin: 4,
}

export const ROLE_LABEL: Record<AdminRole, string> = {
  viewer: '只读',
  operator: '活动草稿',
  publisher: '活动发布',
  super_admin: '服务与权限',
}

export const ROLE_DESCRIPTION: Record<AdminRole, string> = {
  viewer: '可查看运营数据与基础信息,无操作权限。',
  operator: '可创建、编辑活动草稿,不可发布。',
  publisher: '可发布、暂停、恢复及结束活动。',
  super_admin: '管理用户与权限,拥有所有操作权限。',
}

function level(role: AdminRole | null | undefined): number {
  if (!role) {
return 0
}
  return ADMIN_ROLE_LEVEL[role] ?? 0
}

export function canReadAdmin(role: AdminRole | null | undefined): boolean {
  return level(role) >= ADMIN_ROLE_LEVEL.viewer
}

export function canManageCampaignDraft(role: AdminRole | null | undefined): boolean {
  return level(role) >= ADMIN_ROLE_LEVEL.operator
}

export function canPublishCampaign(role: AdminRole | null | undefined): boolean {
  return level(role) >= ADMIN_ROLE_LEVEL.publisher
}

export function canCompensateClaim(role: AdminRole | null | undefined): boolean {
  return level(role) >= ADMIN_ROLE_LEVEL.publisher
}

export function canPublishPrice(role: AdminRole | null | undefined): boolean {
  return level(role) >= ADMIN_ROLE_LEVEL.publisher
}

export function canUpdateServiceSwitch(role: AdminRole | null | undefined): boolean {
  return role === 'super_admin'
}

export function canManageProviderConfig(role: AdminRole | null | undefined): boolean {
  return role === 'super_admin'
}

export function canManageRoles(role: AdminRole | null | undefined): boolean {
  return role === 'super_admin'
}

export function grantImpact(role: AdminRole): string {
  if (role === 'viewer') {
return '仅可查看运营数据与基础信息,无写操作。'
}
  if (role === 'operator') {
return '可创建与编辑活动草稿,不可发布、暂停或结束。'
}
  if (role === 'publisher') {
return '可发布、暂停、恢复及结束活动,并可补偿待处理领取、发布价格。'
}
  return '可管理服务开关与角色授权,并拥有全部写操作。'
}
