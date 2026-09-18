/**
 * 初始管理员授权 CLI(方案 §11):
 *   pnpm --filter @studycommit/api exec tsx scripts/grant-admin.ts \
 *     --account ops_admin --role super_admin --reason "初始管理员"
 * 通过 account 身份定位用户;生产环境必须追加 --confirm,不提供默认密码。
 * 数据库连接读取 DATABASE_URL(与 api.env 一致)。
 */
import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'

function loadEnvFiles() {
  const candidates = [
    process.env.STUDYCOMMIT_CONFIG_FILE,
    join(homedir(), '.config', 'studycommit', 'api.env'),
    '.env.local',
    '.env',
  ].filter((file): file is string => Boolean(file) && existsSync(file))
  for (const file of candidates) {
    const content = readFileSync(file, 'utf8')
    for (const line of content.split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
      if (!match) {
continue
}
      const value = match[2].replace(/^["']|["']$/g, '')
      if (!process.env[match[1]]) {
process.env[match[1]] = value
}
    }
  }
}

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {}
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]
    if (!key.startsWith('--')) {
continue
}
    const next = argv[index + 1]
    if (next === undefined || next.startsWith('--')) {
      args[key.slice(2)] = 'true'
    } else {
      args[key.slice(2)] = next
      index += 1
    }
  }
  return args
}

async function main() {
  loadEnvFiles()
  const args = parseArgs(process.argv.slice(2))
  const account = args['account']
  const userId = args['user-id']
  const role = args['role']
  const reason = args['reason']
  const confirm = args['confirm'] === 'true'

  if (!role || !['viewer', 'operator', 'publisher', 'super_admin'].includes(role)) {
    console.error(
      '用法: --account <账号>|--user-id <uuid> --role <viewer|operator|publisher|super_admin> --reason "<理由>" [--confirm]',
    )
    process.exit(1)
  }
  if (!reason) {
    console.error('必须提供 --reason 授权理由(写入审计)。')
    process.exit(1)
  }
  if (!account && !userId) {
    console.error('必须提供 --account 或 --user-id 定位目标用户。')
    process.exit(1)
  }
  if (process.env.NODE_ENV === 'production' && !confirm) {
    console.error('生产环境必须追加 --confirm 显式确认。')
    process.exit(1)
  }
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('未配置 DATABASE_URL。')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  try {
    let targetUserId = userId ?? null
    if (!targetUserId) {
      const identity = await pool.query(
        `select user_id from auth_identities where provider = 'account' and provider_subject = $1 limit 1`,
        [account],
      )
      if (identity.rows.length === 0) {
        console.error(`账号不存在: ${account}。请先通过 /api/auth/account/register 注册。`)
        process.exit(1)
      }
      targetUserId = identity.rows[0].user_id as string
    }
    const actorUserId = targetUserId
    const client = await pool.connect()
    try {
      await client.query('begin')
      await client.query('select pg_advisory_xact_lock(921002)')
      const superAdmins = await client.query(
        `select user_id, role from admin_roles where role = 'super_admin' order by user_id for update`,
      )
      const current = await client.query(
        `select role from admin_roles where user_id = $1 for update`,
        [targetUserId],
      )
      const beforeRole = (current.rows[0]?.role as string | undefined) ?? null
      if (beforeRole === 'super_admin' && role !== 'super_admin' && superAdmins.rows.length <= 1) {
        await client.query('rollback')
        throw new Error('不能降级最后一名超级管理员')
      }
      await client.query(
        `insert into admin_roles (user_id, role, granted_by, reason)
         values ($1, $2, $1, $3)
         on conflict (user_id) do update set role = $2, reason = $3, updated_at = now()`,
        [targetUserId, role, reason],
      )
      await client.query(
        `insert into admin_audit_logs (id, actor_user_id, action, target_type, target_id, before_snapshot, after_snapshot, reason)
         values ($1, $2, 'admin.grant_role', 'user', $3, $4, $5, $6)`,
        [
          randomUUID(),
          actorUserId,
          targetUserId,
          beforeRole ? JSON.stringify({ role: beforeRole }) : null,
          JSON.stringify({ role, grantedBy: 'bootstrap-cli' }),
          reason,
        ],
      )
      await client.query('commit')
      console.log(`已授予 ${targetUserId} 角色 ${role}。`)
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('授权失败:', error instanceof Error ? error.message : error)
  process.exit(1)
})
