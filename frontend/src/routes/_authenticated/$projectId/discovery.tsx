import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/$projectId/discovery')({
  component: DiscoveryComponent,
})

function DiscoveryComponent() {
  return <div>Hello "/$projectId/discovery"!</div>
}
