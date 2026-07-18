import { HiMenu } from "react-icons/hi";
import { useSidebar } from "../../hooks/useSidebar";
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
  const { toggleSidebar } = useSidebar();

  return (
    <HeaderShell className="flex-wrap gap-3 py-3 md:flex-nowrap md:gap-6 md:py-0">
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        className="ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-surface-border bg-surface-raised text-text-muted hover:bg-surface-overlay hover:text-text-primary md:hidden"
      >
        <HiMenu size={18} />
      </button>
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
