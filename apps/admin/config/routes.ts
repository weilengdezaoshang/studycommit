export const routes = [
  {
    path: '/login',
    layout: false,
    component: './Login',
  },
  {
    path: '/',
    name: '概览',
    icon: 'HomeOutlined',
    component: './Dashboard',
  },
  {
    path: '/campaigns',
    name: '活动管理',
    icon: 'GiftOutlined',
    component: './Campaigns',
  },
  {
    path: '/campaigns/new',
    component: './Campaigns/New',
    hideInMenu: true,
  },
  {
    path: '/campaigns/:id',
    component: './Campaigns/Detail',
    hideInMenu: true,
  },
  {
    path: '/campaigns/:id/edit',
    component: './Campaigns/Edit',
    hideInMenu: true,
  },
  {
    path: '/runs',
    name: '运行对账',
    icon: 'FileSearchOutlined',
    component: './Runs',
  },
  {
    path: '/credits',
    name: '积分用户',
    icon: 'UserOutlined',
    component: './Credits',
  },
  {
    path: '/pricing',
    name: 'AI 定价与开关',
    icon: 'SettingOutlined',
    component: './Pricing',
  },
  {
    path: '/audit-logs',
    name: '审计日志',
    icon: 'FileTextOutlined',
    component: './AuditLogs',
  },
  {
    path: '/roles',
    name: '管理权限',
    icon: 'SafetyCertificateOutlined',
    component: './Roles',
    access: 'canManageRoles',
  },
  {
    path: '/403',
    component: './403',
    hideInMenu: true,
  },
  {
    path: '/404',
    component: './404',
    hideInMenu: true,
  },
  {
    path: '*',
    component: './404',
    hideInMenu: true,
  },
]
