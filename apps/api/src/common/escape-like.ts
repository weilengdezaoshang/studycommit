/** ILIKE 通配符转义:防止查询词中的 % 与 _ 被当作通配符放大命中范围。 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}
