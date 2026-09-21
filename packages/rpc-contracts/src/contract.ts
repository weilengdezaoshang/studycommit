import { adminContract } from './admin.js'
import { aiContract } from './ai.js'
import { authContract } from './auth.js'
import { campaignsContract } from './campaigns.js'
import { creditsContract } from './credits.js'
import { healthContract } from './health.js'
import { learningRecordContract } from './learning-records.js'
import { operationsContract } from './operations.js'
import { paperContract } from './papers.js'
import { puzzlesContract, adminPuzzlesContract } from './puzzles.js'
import { reviewsContract } from './reviews.js'
import { searchContract } from './search.js'
import { studySessionContract } from './study-sessions.js'
import { templateContract } from './templates.js'
import { topicContract } from './topics.js'
import { uploadsContract } from './uploads.js'

export const apiContract = {
  health: healthContract,
  auth: authContract,
  papers: paperContract,
  puzzles: puzzlesContract,
  adminPuzzles: adminPuzzlesContract,
  topics: topicContract,
  templates: templateContract,
  studySessions: studySessionContract,
  learningLogs: learningRecordContract,
  ai: aiContract,
  uploads: uploadsContract,
  reviews: reviewsContract,
  search: searchContract,
  operations: operationsContract,
  campaigns: campaignsContract,
  credits: creditsContract,
  admin: adminContract,
}
