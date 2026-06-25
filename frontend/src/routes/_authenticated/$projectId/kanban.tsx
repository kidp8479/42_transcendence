import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/$projectId/kanban')({
  component: KanbanPage,
})

function KanbanPage() {
  return <div>Hello "/kanban"!</div>
}
