/** 通用游标:`${ISO 时间}|${行 id}`;按 (时间, id) 倒序翻页,参数化避免拼接。 */
export function encodeCursor(at: Date, id: string): string {
  return `${at.toISOString()}|${id}`
}

export function decodeCursor(cursor: string | null | undefined): { at: Date; id: string } | null {
  if (!cursor) {
return null
}
  const separator = cursor.lastIndexOf('|')
  if (separator <= 0) {
return null
}
  const at = new Date(cursor.slice(0, separator))
  const id = cursor.slice(separator + 1)
  if (Number.isNaN(at.getTime()) || !id) {
return null
}
  return { at, id }
}
