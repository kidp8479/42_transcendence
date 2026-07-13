// Top bar for authenticated pages.
// Contains: search bar + notification bell + user avatar dropdown.
// SCAFFOLD ONLY - links have no labels yet, not wired to any UI. Placeholder to establish navigation structure.
import { Link } from "@tanstack/react-router";
import { NavLogo } from "./NavLogo";

export function HeaderAuthenticated() {
  return (
    <header className="flex items-center justify-between px-6 py-4">
      <NavLogo to="/dashboard" />
      <Link to="/dashboard">Dashboard</Link>
      <Link to="/projects">Projects</Link>
      <Link to="/search">Search</Link>
      <Link to="/user-settings">Settings</Link>
    </header>
  );
}
