import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/$projectId/evaluation-checklist',
)({
  component: EvaluationChecklistComponent,
})

function EvaluationChecklistComponent() {
  return <div>Hello "/_authenticated/_projects/evaluation-checklist"!</div>
}
