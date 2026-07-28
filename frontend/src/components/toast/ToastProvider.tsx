import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

const toastDurationMs = 5000;

// team decision (Discord, ui-components, 2026-07-27): stacking every toast
// unbounded "can quickly start to look a bit of a mess" (Carlos) - cap how
// many show at once, oldest collapses out first when a new one arrives
// past the limit (Andrei)
const maxVisibleToasts = 5;

export type ToastType = "error" | "success";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (toast: Omit<Toast, "id">) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ message, type }: Omit<Toast, "id">) => {
      const id = Date.now();
      // slice from the end: clicking past the limit drops the oldest
      // toast(s) immediately rather than waiting out their own 5s timer,
      // so at most maxVisibleToasts ever show at once
      setToasts((current) =>
        [...current, { id, message, type }].slice(-maxVisibleToasts)
      );
      window.setTimeout(() => dismissToast(id), toastDurationMs);
    },
    [dismissToast]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="fixed right-4 bottom-4 z-60 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === "error" ? "alert" : "status"}
            className={`rounded-lg border p-4 shadow-lg ${
              toast.type === "error"
                ? "border-control-error bg-red-950 text-red-100"
                : "border-brand-500 bg-surface-raised text-text-primary"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm">{toast.message}</p>
              <button
                type="button"
                aria-label="Dismiss notification"
                className="shrink-0 text-text-secondary hover:text-text-primary"
                onClick={() => dismissToast(toast.id)}
              >
                &times;
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
