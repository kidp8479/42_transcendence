// Text input formatted dd/mm/yyyy, wrapping an ISO (YYYY-MM-DD) value.
//
// Native <input type="date"> displays in whatever format the browser's own
// language setting picks (Chrome ignores the page's lang attribute entirely
// for this), so it can't be forced to dd/mm/yyyy reliably. This component
// keeps the same underlying ISO value/onChange contract as the native input
// (EventForm's state stays "YYYY-MM-DD" throughout), it just controls the
// display format itself instead of delegating it to the browser.
import { useEffect, useState, type ChangeEvent } from "react";
import dayjs from "dayjs";

interface DateInputProps {
  id: string;
  value: string; // ISO, "YYYY-MM-DD"
  onChange: (isoDate: string) => void;
  className: string;
}

export function DateInput({ id, value, onChange, className }: DateInputProps) {
  const [displayValue, setDisplayValue] = useState(() => isoToDisplay(value));

  // resyncs if the parent's value changes from elsewhere (ex: switching
  // between events in the drawer, EventForm's key remounts anyway, but this
  // keeps the component correct even if that ever changes)
  useEffect(() => {
    setDisplayValue(isoToDisplay(value));
  }, [value]);

  function handleChange(changeEvent: ChangeEvent<HTMLInputElement>) {
    const digitsOnly = changeEvent.target.value.replace(/\D/g, "").slice(0, 8);
    setDisplayValue(formatDigitsAsDate(digitsOnly));

    if (digitsOnly.length === 8) {
      const day = digitsOnly.slice(0, 2);
      const month = digitsOnly.slice(2, 4);
      const year = digitsOnly.slice(4, 8);
      const isoCandidate = year + "-" + month + "-" + day;
      // dayjs' default ISO parsing already rejects out-of-range values
      // (ex: month 13, day 32) - no extra plugin needed for that check
      if (dayjs(isoCandidate).format("YYYY-MM-DD") === isoCandidate) {
        onChange(isoCandidate);
      }
    }
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      placeholder="dd/mm/yyyy"
      value={displayValue}
      onChange={handleChange}
      className={className}
    />
  );
}

function isoToDisplay(iso: string): string {
  const parsed = dayjs(iso);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : "";
}

function formatDigitsAsDate(digits: string): string {
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  return [day, month, year].filter((part) => part.length > 0).join("/");
}
