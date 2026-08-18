export function canStartStudy(topicId: string, goal: string): boolean {
  return topicId.trim().length > 0 && goal.trim().length > 0
}
