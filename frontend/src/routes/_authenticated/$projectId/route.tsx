import { createFileRoute } from '@tanstack/react-router'
import { ProjectLayout } from '../../../components/layout/ProjectLayout'

export const Route = createFileRoute('/_authenticated/$projectId')({
  component: ProjectLayout,
})
