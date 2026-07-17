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
          {/* primary button style */}
          <Button
            type="button"
            size="sm"
            onClick={() => openAuthModal("signup")}
            className="
				bg-brand-700
				text-text-primary
				hover:bg-brand-800
				dark:bg-brand-700
				dark:text-text-primary
				dark:hover:bg-brand-800
				focus:outline-none
				focus:ring-brand-500
			    dark:focus:ring-brand-500
			"
          >
            <span className="hidden sm:inline">Create account</span>
            <span className="sm:hidden">Join</span>
          </Button>
          {/* outline button style */}
          <Button
            type="button"
            size="sm"
            onClick={() => openAuthModal("signin")}
            className="
				border
				border-brand-600
				bg-transparent
				text-brand-600
				hover:border-brand-800
				hover:bg-brand-800
				hover:text-text-primary
				dark:border-brand-600
				dark:bg-transparent
				dark:text-brand-600
				dark:hover:border-brand-800
				dark:hover:bg-brand-800
				dark:hover:text-text-primary
				focus:ring-brand-500
			    dark:focus:ring-brand-500
				"
          >
            Sign in
          </Button>
        </div>
      )}
    </HeaderShell>
  );
}
