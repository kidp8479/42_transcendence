import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

export type AuthView = "signin" | "signup";
export type ModalState = { type: "auth"; view: AuthView } | null;

interface ModalContextValue {
  activeModal: ModalState;
  openAuthModal: (view?: AuthView) => void;
  closeModal: () => void;
}

export const ModalContext = createContext<ModalContextValue | null>(null);

/**
 * Owns global modal state while ModalLayer handles rendering.
 */
export function ModalProvider({ children }: PropsWithChildren) {
  const [activeModal, setActiveModal] = useState<ModalState>(null);

  const openAuthModal = useCallback((view: AuthView = "signin") => {
    setActiveModal({ type: "auth", view });
  }, []);
  const closeModal = useCallback(() => setActiveModal(null), []);

  const value = useMemo(
    () => ({ activeModal, openAuthModal, closeModal }),
    [activeModal, closeModal, openAuthModal]
  );

  return (
    <ModalContext.Provider value={value}>{children}</ModalContext.Provider>
  );
}
