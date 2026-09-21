import { searchQuerySchema } from '@studycommit/rpc-contracts/search'
import type { SearchApi } from '@studycommit/common/ports'
import { searchIpcChannels } from '../../shared/search-channels'
import { parseIpcInput, type IpcHost } from './ipc-host'

export { searchIpcChannels }

export function registerSearchIpc(host: IpcHost, search: SearchApi): void {
  host.handle(searchIpcChannels.query, (input) =>
    search.query(
      parseIpcInput<{ q: string; limit?: number; cursor?: string }>(
        searchQuerySchema,
        input ?? { q: '' },
      ),
    ),
  )
}
