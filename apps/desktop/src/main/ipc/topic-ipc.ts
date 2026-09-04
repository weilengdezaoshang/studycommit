import { createTopicInputSchema, listActiveTopicsInputSchema } from '@studycommit/common/contracts'
import type { TopicMutationApi } from '@studycommit/common/ports'
import { removeTopicInputSchema, updateTopicInputSchema } from '@studycommit/rpc-contracts/topics'
import { topicIpcChannels } from '../../shared/topic-channels'
import { parseIpcInput, type IpcHost } from './ipc-host'

export { topicIpcChannels }

export function registerTopicIpc(host: IpcHost, client: TopicMutationApi): void {
  host.handle(topicIpcChannels.listActive, (input) =>
    client.listActive(parseIpcInput(listActiveTopicsInputSchema, input ?? {})),
  )
  host.handle(topicIpcChannels.create, (input) =>
    client.create(parseIpcInput(createTopicInputSchema, input)),
  )
  host.handle(topicIpcChannels.update, (input) =>
    client.update(parseIpcInput(updateTopicInputSchema, input)),
  )
  host.handle(topicIpcChannels.remove, (input) =>
    client.remove(parseIpcInput(removeTopicInputSchema, input)),
  )
}
