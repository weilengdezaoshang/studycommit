import type { ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react-native'
import { activeTopicPageFixture } from '@studycommit/common/contracts'
import type { LearningLogApi } from '@studycommit/common/learning-log'
import type { StudySessionApi } from '@studycommit/common/study-session'
import type { TopicQueryApi } from '@studycommit/common/topic'
import { AppProviders } from '../../../core/AppProviders'
import { AppShell } from '../../../core/AppShell'
import type { MobileServices } from '../../../infrastructure/http/create-mobile-services'

export function createStudySessionGateway(
  overrides: Partial<StudySessionApi> = {},
): StudySessionApi {
  return {
    getActive: async () => ({ session: null, serverNow: '2026-08-17T08:00:00.000Z' }),
    getById: async () => {
      throw new Error('getById not stubbed')
    },
    create: async () => {
      throw new Error('create not stubbed')
    },
    pause: async () => {
      throw new Error('pause not stubbed')
    },
    resume: async () => {
      throw new Error('resume not stubbed')
    },
    complete: async () => {
      throw new Error('complete not stubbed')
    },
    ...overrides,
  }
}

export function createTopicGateway(overrides: Partial<TopicQueryApi> = {}): TopicQueryApi {
  return {
    listActive: async () => activeTopicPageFixture,
    ...overrides,
  }
}

export function createLearningLogGateway(overrides: Partial<LearningLogApi> = {}): LearningLogApi {
  return {
    getBySession: async () => {
      throw new Error('getBySession not stubbed')
    },
    update: async () => {
      throw new Error('update not stubbed')
    },
    ...overrides,
  }
}

export async function renderStudyApp(
  services?: Partial<MobileServices>,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  const value: MobileServices = {
    studySessions: createStudySessionGateway(),
    topics: createTopicGateway(),
    learningLogs: createLearningLogGateway(),
    ...services,
  }
  return render(
    <AppProviders services={value}>
      <AppShell />
    </AppProviders>,
    options,
  )
}

export async function renderStudyTree(ui: ReactElement, services?: Partial<MobileServices>) {
  const value: MobileServices = {
    studySessions: createStudySessionGateway(),
    topics: createTopicGateway(),
    learningLogs: createLearningLogGateway(),
    ...services,
  }
  return render(<AppProviders services={value}>{ui}</AppProviders>)
}
