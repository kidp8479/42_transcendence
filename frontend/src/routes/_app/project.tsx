import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/project')({
  component: ProjectPage,
})

function ProjectPage() {
  return <div>Hello "/_app/project"!</div>
}
