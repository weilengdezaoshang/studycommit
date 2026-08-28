import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DRAWER_TOPIC_LIMIT,
  DEFAULT_TOPIC_NAME,
  formatDisplayCount,
  getDrawerTopicSummary,
  getHomeLoadErrorMessage,
  getNextDefaultTopicName,
} from './home-utils'

describe('home display helpers', () => {
  it.each([
    [0, '0'],
    [3, '3'],
    [99, '99'],
    [100, '99+'],
  ])('将数量 %s 格式化为 %s', (value, expected) => {
    expect(formatDisplayCount(value)).toBe(expected)
  })

  it('将非法数量安全地格式化为零', () => {
    expect(formatDisplayCount(Number.NaN)).toBe('0')
    expect(formatDisplayCount(-1)).toBe('0')
  })

  it('保留有用的首页加载错误信息', () => {
    expect(getHomeLoadErrorMessage(new Error('网络不可用'))).toBe('网络不可用')
    expect(getHomeLoadErrorMessage({})).toBe('暂时取不回你的学习内容，请重试。')
  })

  it('抽屉最多保留四个主题', () => {
    const topics = ['一', '二', '三', '四', '五']

    expect(getDrawerTopicSummary(topics)).toEqual({
      visibleTopics: topics.slice(0, DEFAULT_DRAWER_TOPIC_LIMIT),
      hasMoreTopics: true,
      topicOverflowLabel: '查看全部 5 个箱子',
    })
  })

  it('主题数量等于上限时不显示完整列表入口', () => {
    const topics = ['一', '二', '三', '四']

    expect(getDrawerTopicSummary(topics)).toEqual({
      visibleTopics: topics,
      hasMoreTopics: false,
      topicOverflowLabel: '',
    })
  })

  it('主题上限非法时回退到默认值', () => {
    const topics = ['一', '二', '三', '四', '五']

    expect(getDrawerTopicSummary(topics, 0).visibleTopics).toEqual(topics.slice(0, 4))
  })

  it('首次快速创建时使用未命名的知识', () => {
    expect(getNextDefaultTopicName([])).toBe(DEFAULT_TOPIC_NAME)
  })

  it('默认名称已存在时生成连续且不冲突的名称', () => {
    expect(getNextDefaultTopicName(['未命名的知识', '未命名的知识 2'])).toBe('未命名的知识 3')
  })

  it('默认名称序号有空缺时使用最小可用序号', () => {
    expect(getNextDefaultTopicName(['未命名的知识', '未命名的知识 3'])).toBe('未命名的知识 2')
  })
})
