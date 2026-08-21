import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { StudySession } from '@studycommit/common/contracts'
import { activeTopicPageFixture } from '@studycommit/common/contracts'
import {
  DesktopServicesProvider,
  type DesktopRendererServices,
} from '../api/DesktopServicesProvider'
import type {
  LearningLogGateway,
  StudySessionGateway,
  TopicGateway,
} from '../api/desktop-study-session-gateway'
import { AppRoutes } from '../../../app/AppRouter'

export function createStudySessionGateway(
  overrides: Partial<StudySessionGateway> = {},
): StudySessionGateway {
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

export function createTopicGateway(overrides: Partial<TopicGateway> = {}): TopicGateway {
  return {
    listActive: async () => activeTopicPageFixture,
    ...overrides,
  }
}

export function createLearningLogGateway(
  overrides: Partial<LearningLogGateway> = {},
): LearningLogGateway {
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

export function renderStudyApp(
  path: string,
  services?: Partial<DesktopRendererServices>,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  const value: DesktopRendererServices = {
    studySessions: createStudySessionGateway(),
    topics: createTopicGateway(),
    learningLogs: createLearningLogGateway(),
    ...services,
  }
  return render(
    <DesktopServicesProvider services={value}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </DesktopServicesProvider>,
    options,
  )
}

export function sessionWith(
  session: StudySession,
  patch: Partial<StudySession> = {},
): StudySession {
  return { ...session, ...patch }
}
