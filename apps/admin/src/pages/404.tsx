import { Button, Result } from 'antd'
import { history } from '@umijs/max'

export default function NotFoundPage() {
  return (
    <Result
      status="404"
      title="页面不存在"
      subTitle="对象不可用或地址不正确。"
      extra={
        <Button type="primary" onClick={() => history.push('/')}>
          返回概览
        </Button>
      }
    />
  )
}
