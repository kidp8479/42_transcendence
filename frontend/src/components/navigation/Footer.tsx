// Footer shown on all pages (public and authenticated).
// Contains: Privacy + Contact + About + Terms links.
// Required on all pages per the 42 subject.
// This is a basic set up to understand how the layout works (if you go to the localhost:8080 you will see the footer live on all pages !)
import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer>
      <Link to="/about">About</Link>
      <Link to="/contact">Contact</Link>
      <Link to="/privacy">Privacy</Link>
      <Link to="/terms">Terms</Link>
    </footer>
  );
}
