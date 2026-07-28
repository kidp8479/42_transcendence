import { useEffect, useState } from "react";

// Matches Tailwind's own "sm" breakpoint (640px) - same value EventPill uses
// to hide its time label (sm:inline). Below this width, a 7-column month
// grid has ~50px per day cell, nowhere near enough room to show a pill's
// title text legibly (verified in a real browser: even a truncated title
// rendered as a single unreadable character) - CalendarDayCell switches to
// colored dots only, and tapping a day with events opens a list instead of
// creating one directly.
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
