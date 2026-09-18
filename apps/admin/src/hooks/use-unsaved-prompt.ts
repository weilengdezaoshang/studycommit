import { Modal } from 'antd'
import { history } from '@umijs/max'
import { useEffect } from 'react'

export function useUnsavedPrompt(dirty: boolean) {
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) {
return
}
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  useEffect(() => {
    if (!dirty) {
return
}
    const hist = history as typeof history & {
      block?: (blocker: (tx: { retry: () => void }) => void) => () => void
    }
    if (!hist.block) {
return
}
    const unblock = hist.block((tx) => {
      Modal.confirm({
        title: '有未保存的更改',
        content: '离开后当前输入不会保存。',
        okText: '离开',
        cancelText: '继续编辑',
        onOk: () => {
          unblock()
          tx.retry()
        },
      })
    })
    return () => unblock()
  }, [dirty])
}
