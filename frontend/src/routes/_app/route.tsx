// Entry point for the _app/ folder.
// TanStack Router requires a route.tsx inside each folder to treat it as a layout route.
// Without this file, _app/ is just a folder - the router ignores it entirely.
// This file makes _app/ a pathless layout - its name does not appear in the URL.
// Every page inside _app/ (dashboard, projects...) is automatically wrapped by AppLayout.
// The auth guard runs before any _app/ page renders - redirects to / if not logged in.
import { createFileRoute } from '@tanstack/react-router'
import { AppLayout, authGuard } from '../../components/layout/AppLayout'

export const Route = createFileRoute('/_app')({
  beforeLoad: authGuard,
  component: AppLayout,
})
