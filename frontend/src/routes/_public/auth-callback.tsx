// OAuth callback page (/auth-callback).
// Landing point after 42 OAuth redirects the user back to the app with ?code=... in the URL.
// This page extracts the code, sends it to the Go auth service to exchange for a token, then redirects to /dashboard.
// The user sees this page for a fraction of a second - it has no visible UI beyond a loading state.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_public/auth-callback')({
  component: AuthCallbackPage,
})

function AuthCallbackPage() {
  return <div>Hello "/_public/auth-callback"!</div>
}
