// Top bar for public pages.
// Contains: logo + Sign In button + Create Account button.
//
// SCAFFOLD ONLY:
// Authentication modals are not implemented yet.
// Both buttons are inert (#) to avoid bouncing through the auth guard.
//
// Future integration:
// - Sign In button will call useModal().openModal('auth')
// - Create Account button will call useModal().openModal('auth')
// - AuthModal will determine whether to display the Sign In
//   or Create Account form.
import { Button } from "flowbite-react";
import { NavLogo } from "./NavLogo";
//import { useModal } from "../../hooks/useModal"
import { useLocation } from "@tanstack/react-router";

export function HeaderPublic() {
  //const {openModal } = useModal();
  const { pathname } = useLocation();
  const logoTo = pathname === "/" ? "/dont-panic" : "/";

  return (
    <header className="flex items-center justify-between px-6 py-4">
      <NavLogo to={logoTo} />

      <div className="flex items-center gap-4">
        <Button
          className="
		    bg-brand-600
		    text-surface-base
			hover:bg-brand-700
		  "
          onClick={() => {
            // TODO: Open authentication modal
            // Waiting for ModalProvider implemention
          }}
        >
          Create Account
        </Button>

        <Button
          className="
		    border border-brand-600
			bg-transparent
			text-brand-600
			hover:bg-brand-600
			hover:text-surface-base
		  "
          onClick={() => {
            // TODO: Open authentication modal
            // waiting for ModalProvider implementation
          }}
        >
          Sign In
        </Button>
      </div>
    </header>
  );
}
