import { listActiveTopicsInputSchema } from '@studycommit/common/contracts'
import type { TopicQueryApi } from '@studycommit/common/topic'
import { topicIpcChannels } from '../../shared/topic-channels'
import { parseIpcInput, type IpcHost } from './ipc-host'

export { topicIpcChannels }

export function registerTopicIpc(host: IpcHost, client: TopicQueryApi): void {
  host.handle(topicIpcChannels.listActive, (input) =>
    client.listActive(parseIpcInput(listActiveTopicsInputSchema, input ?? {})),
  )
}
