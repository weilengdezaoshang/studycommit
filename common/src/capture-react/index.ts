import { useReducer } from 'react'
import { captureReducer, captureSummary, type CaptureState } from '../capture-runtime'
/** 桌面与移动端使用同一个页面状态 Hook；原生小程序直接使用纯 reducer。 */
export function useCapturePage(initial: CaptureState) {
  const [state, dispatch] = useReducer(captureReducer, initial)
  return { state, dispatch, summary: captureSummary(state) }
}
