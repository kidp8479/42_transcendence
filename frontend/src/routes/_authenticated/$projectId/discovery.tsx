import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/$projectId/discovery')({
  component: DiscoveryPage,
})

function DiscoveryPage() {
  return <div>Hello "/$projectId/discovery"!</div>
}
