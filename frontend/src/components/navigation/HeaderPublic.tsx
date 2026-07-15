// Top bar for public pages.
// Contains: logo + Sign In button + Create Account button.
import { Button, Navbar } from "flowbite-react";
import { useLocation } from "@tanstack/react-router";
import { useModal } from "../../hooks/useModal";
import { NavLogo } from "./NavLogo";

export function HeaderPublic() {
  const { openAuthModal } = useModal();
  const { pathname } = useLocation();
  const logoTo = pathname === "/" ? "/dont-panic" : "/";

  return (
    <Navbar
      fluid
      className="sticky top-0 z-40 border-b border-surface-border bg-surface-raised/95 px-4 py-3 backdrop-blur-xl sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between gap-4">
        <NavLogo to={logoTo} />
        <nav className="flex items-center gap-2" aria-label="Account">
          <Button
            color="alternative"
            size="sm"
            onClick={() => openAuthModal("signin")}
            className="border-transparent bg-transparent text-text-secondary hover:border-surface-border hover:bg-surface-overlay hover:text-text-primary"
          >
            Sign in
          </Button>
          <Button
            size="sm"
            onClick={() => openAuthModal("signup")}
            className="bg-brand-700 text-white hover:bg-brand-800 focus:ring-brand-500"
          >
            <span className="hidden sm:inline">Create account</span>
            <span className="sm:hidden">Join</span>
          </Button>
        </nav>
      </div>
    </Navbar>
  );
}
