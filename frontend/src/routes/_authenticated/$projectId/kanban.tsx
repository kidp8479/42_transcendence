import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/$projectId/kanban')({
  component: KanbanComponent,
})

function KanbanComponent() {
  return <div>Hello "/_authenticated/_projects/kanban"!</div>
}
