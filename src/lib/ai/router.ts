import { AskRequest, ToolResult } from './schemas'
import { askQuestion } from './ask'

export async function routeQuestion(payload: AskRequest, actorEmail?: string | null): Promise<ToolResult> {
  return askQuestion(payload, actorEmail)
}
