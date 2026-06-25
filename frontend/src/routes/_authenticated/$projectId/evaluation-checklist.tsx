import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/$projectId/evaluation-checklist',
)({
  component: EvaluationChecklistPage,
})

function EvaluationChecklistPage() {
  return <div>Hello "/evaluation-checklist"!</div>
}
