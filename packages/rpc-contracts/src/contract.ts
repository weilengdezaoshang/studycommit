import { healthContract } from './health.js'
import { paperContract } from './papers.js'

export const apiContract = {
  health: healthContract,
  papers: paperContract,
}
