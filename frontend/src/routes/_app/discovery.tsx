import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/discovery')({
  component: DiscoveryComponent,
})

function DiscoveryComponent() {
  return <div>Hello "/_app/discovery"!</div>
}
