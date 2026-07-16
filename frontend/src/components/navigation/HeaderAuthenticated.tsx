import type { AuthSession } from "../../lib/auth";
import { HeaderShell } from "./HeaderShell";
import { NavLogo } from "./NavLogo";
import { NotificationBell } from "./NotificationBell";
import { SearchBar } from "./SearchBar";
import { UserMenu } from "./UserMenu";

interface HeaderAuthenticatedProps {
  session: AuthSession;
}

export function HeaderAuthenticated({ session }: HeaderAuthenticatedProps) {
  return (
    <HeaderShell className="flex-wrap gap-3 md:flex-nowrap md:gap-6">
      <NavLogo to="/dashboard" />
      <div className="order-3 w-full md:order-none md:mx-auto md:max-w-2xl">
        <SearchBar />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <NotificationBell />
        <UserMenu session={session} />
      </div>
    </HeaderShell>
  );
}
