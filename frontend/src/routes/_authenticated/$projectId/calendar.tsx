import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/$projectId/calendar')({
  component: CalendarComponent,
})

function CalendarComponent() {
  return <div>Hello "/_authenticated/_projects/calendar"!</div>
}
