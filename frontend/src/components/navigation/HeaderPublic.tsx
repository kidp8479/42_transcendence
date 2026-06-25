// Top bar for public pages.
// Contains: logo + Sign In button + Create Account button.
// SCAFFOLD ONLY - links are not wired to auth modals yet, Sign in/up both redirect to /dashboard as placeholder.
import { Link } from '@tanstack/react-router'

export function HeaderPublic() {
  return (
    <header>
      <Link to="/">Logo</Link>
      <Link to="/dashboard">Sign in</Link>
      <Link to="/dashboard">Sign up</Link>
    </header>
  )
}
