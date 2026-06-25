import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/$projectId/list')({
  component: ListComponent,
})

function ListComponent() {
  return <div>Hello "/_authenticated/_projects/list"!</div>
}
