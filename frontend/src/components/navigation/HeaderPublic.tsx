import { Button } from "flowbite-react";
import { useLocation } from "@tanstack/react-router";
import { useModal } from "../../hooks/useModal";
import { HeaderShell } from "./HeaderShell";
import { NavLogo } from "./NavLogo";

interface HeaderPublicProps {
  authUnavailable?: boolean;
}

export function HeaderPublic({ authUnavailable = false }: HeaderPublicProps) {
  const { openAuthModal } = useModal();
  const { pathname } = useLocation();
  const logoTo = pathname === "/" ? "/dont-panic" : "/";

  return (
    <HeaderShell className="justify-between gap-4">
      <NavLogo to={logoTo} />
      {authUnavailable ? (
        <span role="status" className="text-sm text-text-secondary">
          Sign-in unavailable
        </span>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => openAuthModal("signup")}
            className="bg-brand-600 text-surface-base hover:bg-brand-700"
          >
            <span className="hidden sm:inline">Create account</span>
            <span className="sm:hidden">Join</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => openAuthModal("signin")}
            className="border border-brand-600 bg-transparent text-brand-600 hover:bg-brand-600 hover:text-surface-base"
          >
            Sign in
          </Button>
        </div>
      )}
    </HeaderShell>
  );
}
