export const ADMIN_ROLE = {
  viewer: 'viewer',
  operator: 'operator',
  publisher: 'publisher',
  superAdmin: 'super_admin',
} as const

export type AdminRole = (typeof ADMIN_ROLE)[keyof typeof ADMIN_ROLE]

/** 角色权限等级:数值越大权限越高;viewer 只读,super_admin 管理角色与保护开关。 */
export const ADMIN_ROLE_LEVEL: Record<AdminRole, number> = {
  [ADMIN_ROLE.viewer]: 1,
  [ADMIN_ROLE.operator]: 2,
  [ADMIN_ROLE.publisher]: 3,
  [ADMIN_ROLE.superAdmin]: 4,
}

/** 管理操作所需的最低角色;与方案 §11 的最小角色模型对应。 */
export const ADMIN_OPERATION_ROLE = {
  readAll: ADMIN_ROLE.viewer,
  manageCampaignDraft: ADMIN_ROLE.operator,
  publishCampaign: ADMIN_ROLE.publisher,
  publishPrice: ADMIN_ROLE.publisher,
  updateServiceSwitch: ADMIN_ROLE.superAdmin,
  manageProviderConfig: ADMIN_ROLE.superAdmin,
  compensateClaim: ADMIN_ROLE.publisher,
  manageRoles: ADMIN_ROLE.superAdmin,
} as const

export const ADMIN_ERROR = {
  unauthenticated: { code: 'UNAUTHENTICATED', message: '缺少有效管理身份' },
  forbidden: { code: 'ADMIN_FORBIDDEN', message: '当前管理身份无权执行该操作' },
  userNotFound: { code: 'ADMIN_USER_NOT_FOUND', message: '目标用户不存在' },
  lastSuperAdmin: {
    code: 'ADMIN_LAST_SUPER_ADMIN',
    message: '不能降级最后一名超级管理员',
  },
} as const
