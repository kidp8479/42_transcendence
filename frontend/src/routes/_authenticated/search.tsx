// Search results page (/search).
// Full-page results view with filter tabs: All / Projects / Tickets / Members / Pages.
// The quick-search dropdown in the header is a separate component (not a route) - it links here via "See all results".
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/search')({
  component: SearchPage,
})

function SearchPage() {
  return <div>Hello "/_authenticated/search"!</div>
}
