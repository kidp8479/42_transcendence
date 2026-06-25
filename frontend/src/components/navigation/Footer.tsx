// Footer shown on all pages (public and authenticated).
// Contains: Privacy + Contact + About + Terms links.
// Required on all pages per the 42 subject.
import { Link } from '@tanstack/react-router'

export function Footer() {
    return (
      <footer>
        <Link to="/about">About</Link>
        <Link to="/contact">Contact</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
      </footer>
    )
}
