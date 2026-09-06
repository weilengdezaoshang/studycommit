import { aiContract } from './ai.js'
import { authContract } from './auth.js'
import { healthContract } from './health.js'
import { learningRecordContract } from './learning-records.js'
import { paperContract } from './papers.js'
import { reviewsContract } from './reviews.js'
import { studySessionContract } from './study-sessions.js'
import { templateContract } from './templates.js'
import { topicContract } from './topics.js'
import { uploadsContract } from './uploads.js'

export const apiContract = {
  health: healthContract,
  auth: authContract,
  papers: paperContract,
  topics: topicContract,
  templates: templateContract,
  studySessions: studySessionContract,
  learningLogs: learningRecordContract,
  ai: aiContract,
  uploads: uploadsContract,
  reviews: reviewsContract,
}
