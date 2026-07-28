import type { Dayjs } from "dayjs";
import { HiOutlineChevronLeft, HiOutlineChevronRight } from "react-icons/hi";

interface CalendarNavHeaderProps {
  monthAnchor: Dayjs;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

// header row above the month grid: prev/next arrows, current month + year
// label, a Today button, and a hint on the right - triggers a refetch for
// the newly visible month via the onPrevMonth/onNextMonth/onToday callbacks.
export function CalendarNavHeader({
  monthAnchor,
  onPrevMonth,
  onNextMonth,
  onToday,
}: CalendarNavHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="Previous month"
          className="rounded-md p-1.5 text-text-secondary hover:bg-surface-overlay hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          <HiOutlineChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Next month"
          className="rounded-md p-1.5 text-text-secondary hover:bg-surface-overlay hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          <HiOutlineChevronRight className="h-5 w-5" />
        </button>
        <h2 className="ml-1 font-mono text-base font-semibold text-text-primary">
          {monthAnchor.format("MMMM YYYY")}
        </h2>
        <button
          type="button"
          onClick={onToday}
          className="ml-2 rounded-md border border-surface-border px-3 py-1 text-xs font-medium text-text-secondary hover:bg-surface-overlay hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          Today
        </button>
      </div>
      <p className="text-xs text-text-secondary">Click a day to add an event</p>
    </div>
  );
}
