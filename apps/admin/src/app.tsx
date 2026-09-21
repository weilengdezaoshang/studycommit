import '@ant-design/v5-patch-for-react-19'
import { QueryClientProvider } from '@tanstack/react-query'
import { Avatar, Dropdown, Space, Tag, Typography } from 'antd'
import { GlobalOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons'
import type { RuntimeAntdConfig, RunTimeLayoutConfig } from '@umijs/max'
import { history } from '@umijs/max'
import type { ReactNode } from 'react'
import { spacing } from '@studycommit/design-tokens'
import { BrandMark } from '@/components/BrandMark'
import ForbiddenPage from '@/pages/403'
import NotFoundPage from '@/pages/404'
import { ROLE_LABEL, type AdminRole } from '@/auth/capabilities'
import { adminApi, setLoginRedirect } from '@/services/admin-api'
import { isForbidden, isUnauthorized } from '@/services/api-client'
import { queryClient } from '@/services/query-client'
import { clearSession, getSession, setSession, type AdminSession } from '@/services/session'
import { antdTheme } from '@/theme/antd-theme'
import { applyAdminCssVars } from '@/theme/css-vars'
import { DISPLAY_TIMEZONE } from '@/utils/format'

const LOGIN_PATH = '/login'

export interface InitialState {
  session: AdminSession | null
}

applyAdminCssVars()
setLoginRedirect(() => {
  if (history.location.pathname !== LOGIN_PATH) {
    history.push(LOGIN_PATH)
  }
})

export async function getInitialState(): Promise<InitialState> {
  const session = getSession()
  if (!session) {
    return { session: null }
  }
  try {
    const me = await adminApi.me()
    const next = { ...session, userId: me.userId, role: me.role }
    setSession(next)
    return { session: next }
  } catch (error) {
    if (isUnauthorized(error) || isForbidden(error)) {
      clearSession()
      queryClient.clear()
      return { session: null }
    }
    return { session }
  }
}

export const antd: RuntimeAntdConfig = (memo) => {
  memo.theme = {
    ...memo.theme,
    token: { ...memo.theme?.token, ...antdTheme.token },
    components: { ...memo.theme?.components, ...antdTheme.components },
  }
  memo.appConfig = { message: { maxCount: 3 } }
  memo.button = { ...(memo.button ?? {}), autoInsertSpace: false }
  return memo
}

export const layout: RunTimeLayoutConfig = ({ initialState, setInitialState }) => ({
  title: false,
  logo: false,
  layout: 'mix',
  splitMenus: false,
  siderWidth: 208,
  breakpoint: 'xl',
  fixedHeader: true,
  menuHeaderRender: false,
  headerTitleRender: () => <BrandMark />,
  avatarProps: false,
  token: {
    bgLayout: antdTheme.token.colorBgLayout,
    header: {
      colorBgHeader: antdTheme.token.colorBgContainer,
      heightLayoutHeader: 64,
    },
    sider: {
      colorMenuBackground: antdTheme.token.colorBgContainer,
      colorBgMenuItemSelected: antdTheme.components.Menu.itemSelectedBg,
      colorTextMenuSelected: antdTheme.components.Menu.itemSelectedColor,
      colorTextMenu: antdTheme.components.Menu.itemColor,
    },
    pageContainer: {
      paddingBlockPageContainerContent: spacing.lg,
      paddingInlinePageContainerContent: spacing.lg,
    },
  },
  actionsRender: () => [
    <Tag key="env" color="orange" className="admin-environment-tag">
      ● 本地开发
    </Tag>,
    <Space key="tz" size={6} className="admin-timezone">
      <GlobalOutlined />
      <Typography.Text type="secondary">{DISPLAY_TIMEZONE}</Typography.Text>
    </Space>,
    <Dropdown
      key="user"
      menu={{
        items: [
          {
            key: 'role',
            label: roleLabel(initialState?.session?.role),
            disabled: true,
          },
          {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: '退出登录',
            onClick: () => {
              clearSession()
              queryClient.clear()
              void setInitialState?.({ session: null })
              history.push(LOGIN_PATH)
            },
          },
        ],
      }}
    >
      <Space style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
        <Avatar size={32} icon={<UserOutlined />} />
        <span>{initialState?.session?.nickname?.trim() || '管理员'}</span>
      </Space>
    </Dropdown>,
  ],
  onPageChange: () => {
    const { pathname } = history.location
    if (pathname === LOGIN_PATH) {
      return
    }
    const session = getSession()
    if (!session) {
      history.push(LOGIN_PATH)
      return
    }
    void adminApi
      .me()
      .then((me) => {
        if (getSession()?.accessToken !== session.accessToken) {
          return
        }
        if (me.role !== session.role || me.userId !== session.userId) {
          const next = { ...session, userId: me.userId, role: me.role }
          setSession(next)
          void setInitialState?.({ session: next })
          queryClient.clear()
        }
      })
      .catch((error: unknown) => {
        if (getSession()?.accessToken !== session.accessToken) {
          return
        }
        if (isUnauthorized(error) || isForbidden(error)) {
          clearSession()
          queryClient.clear()
          void setInitialState?.({ session: null })
          history.push(isForbidden(error) ? '/403' : LOGIN_PATH)
        }
      })
  },
  unAccessible: <ForbiddenPage />,
  noFound: <NotFoundPage />,
})

export function rootContainer(container: ReactNode) {
  return <QueryClientProvider client={queryClient}>{container}</QueryClientProvider>
}

function roleLabel(role: AdminRole | undefined) {
  if (!role) {
    return '未登录'
  }
  return ROLE_LABEL[role]
}
