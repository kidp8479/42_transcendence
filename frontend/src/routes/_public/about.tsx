import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_public/about')({
  component: AboutComponent,
})

function AboutComponent() {
  return <div>Hello from About!</div>
}
