import { useEffect, useState } from "react";

// Matches Tailwind's "sm" breakpoint (640px), same as EventPill's own
// sm:inline. Below it, a 7-column grid has too little room per day cell for
// a legible event pill, so CalendarDayCell falls back to dots.
const COMPACT_CALENDAR_QUERY = "(max-width: 639px)";

export function useIsCompactCalendar(): boolean {
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(COMPACT_CALENDAR_QUERY).matches
      : false
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(COMPACT_CALENDAR_QUERY);

    const update = () => setIsCompact(mediaQuery.matches);
    update();

    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return isCompact;
}
