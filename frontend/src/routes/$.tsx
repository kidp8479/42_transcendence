// 404 catch-all route (any URL that doesn't match any other route).
// Displayed when the user navigates to a URL that doesn't exist.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$')({
  component: NotFoundPage,
})

function NotFoundPage() {
  return <div>404 - Page not found</div>
}
