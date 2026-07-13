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
import { NavLogo } from "./NavLogo";

export function HeaderPublic() {
  return (
    <header className="flex items-center justify-between px-6 py-4">
      <NavLogo href="/" />
      <a href="#">Sign in</a>
      <a href="#">Sign up</a>
    </header>
  );
}
