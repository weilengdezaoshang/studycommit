import { getTableColumns } from 'drizzle-orm'
import { papers } from '../database/schema'

const { contentDocument: _listDocument, ...paperListColumns } = getTableColumns(papers)
void _listDocument

export { paperListColumns }
