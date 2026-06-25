// Top bar for public pages.
// Contains: logo + Sign In button + Create Account button.
//
// SCAFFOLD ONLY:
// Authentication modals are not implemented yet.
//
// Future integration:
// - Sign In button will call useModal().openModal('auth')
// - Create Account button will call useModal().openModal('auth')
// - AuthModal will determine whether to display the Sign In
//   or Create Account form.
//
// Temporary behavior:
// Both buttons currently redirect to /dashboard as placeholders.

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