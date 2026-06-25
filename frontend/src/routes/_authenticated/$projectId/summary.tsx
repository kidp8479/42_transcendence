import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/$projectId/summary')({
  component: SummaryPage,
})

function SummaryPage() {
  return <div>Hello "/$projectId/summary"!</div>
}
