import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/app')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello from App!</div>
}
