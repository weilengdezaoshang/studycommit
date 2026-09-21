import { useNavigate } from 'react-router'
import { routes } from '../../app/routes'
import { RecordsHomePage } from './RecordsHomePage'
import { RecordComposer } from './RecordComposer'

/** 兼容独立 /compose 深链接；首页入口内嵌同一个弹窗以保留筛选/滚动位置。 */
export function ComposePage() {
  const navigate = useNavigate()
  return (
    <>
      <div inert>
        <RecordsHomePage />
      </div>
      <RecordComposer
        onClose={() => navigate(routes.timeline(), { replace: true })}
        onSaved={(id) => navigate(`${routes.timeline()}?highlight=${id}`, { replace: true })}
      />
    </>
  )
}
