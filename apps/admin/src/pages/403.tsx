import { Button, Result } from 'antd'
import { history, useModel } from '@umijs/max'
import { clearAdminQueries } from '@/services/query-client'
import { clearSession } from '@/services/session'

export default function ForbiddenPage() {
  const { setInitialState } = useModel('@@initialState')
  return (
    <Result
      status="403"
      title="403 无管理权限"
      subTitle="您当前没有该功能的管理权限。如需访问，请联系管理员。"
      extra={
        <Button
          type="primary"
          onClick={() => {
            clearSession()
            clearAdminQueries()
            void setInitialState?.({ session: null })
            history.push('/login')
          }}
        >
          切换账号
        </Button>
      }
    />
  )
}
