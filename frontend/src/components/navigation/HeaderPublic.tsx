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
				bg-brand-500
				text-white
				hover:bg-brand-600
				dark:bg-brand-500
				dark:text-white
				dark:hover:bg-brand-600
				focus:outline-none
				focus-visible:outline-none
				focus:ring-4
				focus:ring-green-300
			    dark:focus:ring-green-800
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
				border-brand-500
				bg-transparent
				text-brand-500
				hover:border-brand-600
				hover:bg-brand-50
				hover:text-brand-600
				dark:border-brand-500
				dark:bg-transparent
				dark:text-brand-500
				dark:hover:border-brand-600
				dark:hover:bg-brand-500/10
				dark:hover:text-brand-600
				focus:outline-none
				focus-visible:outline-none
				focus:ring-4
				focus:ring-green-300
			    dark:focus:ring-green-800
				"
          >
            Sign in
          </Button>
        </div>
      )}
    </HeaderShell>
  );
}
