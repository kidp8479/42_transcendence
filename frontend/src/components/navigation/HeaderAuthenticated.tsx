// Top bar for authenticated pages.
// Contains: search bar + notification bell + user avatar dropdown.
import { Navbar } from "flowbite-react";
import type { AuthSession } from "../../lib/auth";
import { NavLogo } from "./NavLogo";
import { NotificationBell } from "./NotificationBell";
import { SearchBar } from "./SearchBar";
import { UserMenu } from "./UserMenu";

interface HeaderAuthenticatedProps {
  session: AuthSession;
}

export function HeaderAuthenticated({ session }: HeaderAuthenticatedProps) {
  return (
    <Navbar
      fluid
      className="sticky top-0 z-40 border-b border-surface-border bg-surface-raised/95 px-4 py-3 backdrop-blur-xl sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-center gap-3 md:flex-nowrap md:gap-6">
        <NavLogo to="/dashboard" />
        <div className="order-3 w-full md:order-none md:mx-auto md:max-w-2xl">
          <SearchBar />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <NotificationBell />
          <UserMenu session={session} />
        </div>
      </div>
    </Navbar>
  );
}
