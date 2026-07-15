/**
 * Authentication modal container.
 * Handles switching between login and register views.
 * Rendered inside ModalLayer when auth modal is active.
 */
import { useState } from "react";
import type { AuthView } from "../ModalProvider";
import { CreateAccountForm } from "../../forms/CreateAccountForm";
import { SigninForm } from "../../forms/SigninForm";

interface AuthModalProps {
  initialView: AuthView;
}

export function AuthModal({ initialView }: AuthModalProps) {
  const [view, setView] = useState<AuthView>(initialView);

  return (
    <section aria-labelledby="auth-modal-title" className="pb-2 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.28em] text-brand-500">
        42 Project Planner
      </p>
      <h2
        id="auth-modal-title"
        className="mt-3 text-2xl font-bold tracking-tight text-text-primary"
      >
        {view === "signin" ? "Welcome back" : "Create your account"}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">
        {view === "signin"
          ? "Sign in to your workspace"
          : "Start managing projects with your team"}
      </p>

      <div className="mt-6 text-left">
        {view === "signin" ? (
          <SigninForm onCreateAccount={() => setView("signup")} />
        ) : (
          <CreateAccountForm onSignIn={() => setView("signin")} />
        )}
      </div>
    </section>
  );
}
