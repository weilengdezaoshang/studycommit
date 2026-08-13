import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { TopicsRepository } from './topics.repository'
import type { CreateTopicInput, ListTopicsInput, UpdateTopicInput } from './topic.schemas'
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
@Injectable()
export class TopicsService {
  constructor(@Inject(TopicsRepository) private readonly repository: TopicsRepository) {}
  async create(userId: string, input: CreateTopicInput, key: string) {
    const requestHash = hash(input)
    const existing = await this.repository.findIdempotency(userId, key)
    if (existing) {
      if (existing.requestHash !== requestHash) throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED', message: '幂等键已用于不同请求' })
      return { topic: await this.get(userId, existing.resourceId), replayed: true }
    }
    return { topic: await this.repository.create(userId, input, { key, hash: requestHash }), replayed: false }
  }
  async list(userId: string, input: ListTopicsInput) { try { return await this.repository.list(userId, input) } catch (error) { if (error instanceof Error && error.message === 'INVALID_CURSOR') throw new BadRequestException({ code: 'INVALID_CURSOR', message: '分页游标无效' }); throw error } }
  async get(userId: string, id: string) { const topic = await this.repository.findById(userId, id); if (!topic) throw new NotFoundException({ code: 'TOPIC_NOT_FOUND', message: '专题不存在' }); return topic }
  async update(userId: string, id: string, input: UpdateTopicInput) {
    const topic = await this.repository.update(userId, id, input)
    if (topic) return topic
    if (!await this.repository.findById(userId, id)) throw new NotFoundException({ code: 'TOPIC_NOT_FOUND', message: '专题不存在' })
    throw new ConflictException({ code: 'TOPIC_VERSION_CONFLICT', message: '专题版本冲突' })
  }
  async remove(userId: string, id: string, version: number) {
    const topic = await this.repository.remove(userId, id, version)
    if (topic) return
    if (!await this.repository.findById(userId, id)) throw new NotFoundException({ code: 'TOPIC_NOT_FOUND', message: '专题不存在' })
    throw new ConflictException({ code: 'TOPIC_VERSION_CONFLICT', message: '专题版本冲突' })
  }
}
