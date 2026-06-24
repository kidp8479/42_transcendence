// TEMPORARY placeholder route (/app). To be removed once real app routes are in place.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/app')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello from App!</div>
}
