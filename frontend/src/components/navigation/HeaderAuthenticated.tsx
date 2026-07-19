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
  const { isCollapsed, toggleSidebar } = useSidebar();

  return (
    <HeaderShell className="flex-wrap gap-3 py-3 md:flex-nowrap md:gap-6 md:py-0">
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!isCollapsed}
        className="ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-transparent text-text-secondary transition hover:border-surface-border hover:bg-surface-overlay hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40 md:hidden"
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
